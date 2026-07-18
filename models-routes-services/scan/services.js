const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError, handleCatchError } = require('../../helper/utilities.services')
const { normalizeAndValidateUrl } = require('./engine/validation.service')
const runtimeService = require('./engine/runtime.service')
const { toPublicReport, FINISHED_STATUSES } = require('./engine/merge.service')
const { enqueueScanFlowAsync } = require('./queue/queue.service')
const SiteModel = require('./models/site.model')

const scanServices = {}

const msg = (req) => messages[req.userLanguage] || messages.English

/** Upsert the per-user Site rollup and return its _id for the new scan to link to. */
const upsertSiteForScan = async (iUserId, sUrl) => {
  const sDomain = new URL(sUrl).hostname.toLowerCase()
  const site = await SiteModel.findOneAndUpdate(
    { iUserId, sDomain },
    {
      $inc: { nTotalScans: 1 },
      $setOnInsert: { dFirstScannedAt: new Date() }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  return site._id
}

scanServices.start = async (req, res) => {
  try {
    const validated = normalizeAndValidateUrl(req.body.sUrl)
    if (!validated.ok) {
      return res.status(status.BadRequest).jsonp({
        status: jsonStatus.BadRequest,
        message: msg(req).scan_invalid_url,
        errors: [{ msg: validated.sError }]
      })
    }

    const iUserId = req.user?._id || '123456'
    const iSiteId = iUserId ? await upsertSiteForScan(iUserId, validated.sUrl) : null

    const context = await runtimeService.createScanContext({
      sUrl: validated.sUrl,
      iUserId,
      iSiteId
    })

    console.log(`[scan] [${context.scanId}] Start accepted — returning scanId`, {
      sUrl: context.sUrl,
      iUserId: context.iUserId
    })

    // Background: enqueue phase 1 (parent + 8 independent module jobs)
    enqueueScanFlowAsync({
      scanId: context.scanId,
      sUrl: context.sUrl
    })

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).scan_queued,
      data: {
        scanId: context.scanId,
        status: context.eStatus
      }
    })
  } catch (error) {
    return catchError('scan.start', error, req, res)
  }
}

scanServices.progress = async (req, res) => {
  try {
    const context = await runtimeService.getScanContext(req.params.scanId)
    if (!context) {
      return res.status(status.NotFound).jsonp({
        status: jsonStatus.NotFound,
        message: msg(req).scan_not_found
      })
    }

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).scan_progress,
      data: {
        scanId: context.scanId,
        status: context.eStatus,
        progress: context.nProgress,
        isFinished: FINISHED_STATUSES.includes(context.eStatus)
      }
    })
  } catch (error) {
    return catchError('scan.progress', error, req, res)
  }
}

scanServices.result = async (req, res) => {
  try {
    const context = await runtimeService.getScanContext(req.params.scanId)
    if (!context) {
      return res.status(status.NotFound).jsonp({
        status: jsonStatus.NotFound,
        message: msg(req).scan_not_found
      })
    }

    if (!FINISHED_STATUSES.includes(context.eStatus)) {
      return res.status(202).jsonp({
        status: 202,
        message: msg(req).scan_in_progress,
        data: {
          scanId: context.scanId,
          status: context.eStatus,
          progress: context.nProgress,
          isFinished: false
        }
      })
    }

    const report = await toPublicReport(req.params.scanId)
    if (!report) {
      handleCatchError(new Error(`toPublicReport returned null for finished scan ${req.params.scanId}`))
      return res.status(status.NotFound).jsonp({
        status: jsonStatus.NotFound,
        message: msg(req).scan_not_found
      })
    }

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).scan_result,
      data: report
    })
  } catch (error) {
    return catchError('scan.result', error, req, res)
  }
}

module.exports = scanServices

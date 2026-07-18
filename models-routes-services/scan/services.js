const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const { normalizeAndValidateUrl } = require('./engine/validation.service')
const runtimeService = require('./engine/runtime.service')
const { toPublicReport } = require('./engine/merge.service')
const { enqueueScanFlowAsync } = require('./queue/queue.service')
const { SCAN_STATUS } = require('./constants')

const scanServices = {}

const msg = (req) => messages[req.userLanguage] || messages.English

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

    // Create in-memory context + return immediately (no await on Redis/BullMQ).
    const context = runtimeService.createScanContext({
      sUrl: validated.sUrl,
      iUserId: req.user?._id || null
    })

    console.log(`[scan] [${context.scanId}] Start accepted — returning scanId`, {
      sUrl: context.sUrl,
      iUserId: context.iUserId
    })

    // Background: enqueue parent + 11 module jobs
    enqueueScanFlowAsync({
      scanId: context.scanId,
      sUrl: context.sUrl
    })

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).scan_queued,
      data: {
        scanId: context.scanId,
        status: SCAN_STATUS.QUEUED
      }
    })
  } catch (error) {
    return catchError('scan.start', error, req, res)
  }
}

scanServices.progress = async (req, res) => {
  try {
    const context = runtimeService.getScanContext(req.params.scanId)
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
        progress: context.nProgress
      }
    })
  } catch (error) {
    return catchError('scan.progress', error, req, res)
  }
}

scanServices.result = async (req, res) => {
  try {
    const context = runtimeService.getScanContext(req.params.scanId)
    if (!context) {
      return res.status(status.NotFound).jsonp({
        status: jsonStatus.NotFound,
        message: msg(req).scan_not_found
      })
    }

    const finished = [
      SCAN_STATUS.COMPLETED,
      SCAN_STATUS.PARTIAL,
      SCAN_STATUS.FAILED
    ].includes(context.eStatus)

    if (!finished) {
      return res.status(202).jsonp({
        status: 202,
        message: msg(req).scan_in_progress,
        data: {
          scanId: context.scanId,
          status: context.eStatus,
          progress: context.nProgress
        }
      })
    }

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).scan_result,
      data: toPublicReport(context)
    })
  } catch (error) {
    return catchError('scan.result', error, req, res)
  }
}

module.exports = scanServices

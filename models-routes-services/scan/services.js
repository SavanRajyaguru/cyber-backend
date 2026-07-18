const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError, handleCatchError, ObjectId } = require('../../helper/utilities.services')
const { normalizeAndValidateUrl } = require('./engine/validation.service')
const runtimeService = require('./engine/runtime.service')
const { toPublicReport, FINISHED_STATUSES } = require('./engine/merge.service')
const { enqueueScanFlowAsync } = require('./queue/queue.service')
const SiteModel = require('./models/site.model')
const ScanModel = require('./models/scan.model')

const scanServices = {}

const msg = (req) => messages[req.userLanguage] || messages.English

// Maps the validated, whitelisted `sortBy` query value to the real Mongo field path —
// never pass a raw user-supplied string as a sort key.
const SORT_FIELD_MAP = {
  dCreatedAt: 'dCreatedAt',
  dFinishedAt: 'dFinishedAt',
  nOverall: 'oScores.nOverall'
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

    // Must be a real Mongo ObjectId from JWT — never use fake fallbacks like "123456"
    const iUserId = ObjectId(req.user?._id)
    if (!iUserId) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).err_unauthorized,
        errors: [{ msg: 'Valid authenticated user id is required to start a scan' }]
      })
    }

    const iSiteId = await upsertSiteForScan(iUserId, validated.sUrl)

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

scanServices.list = async (req, res) => {
  try {
    // req.user?._id must be checked BEFORE calling ObjectId() — mongoose.Types.ObjectId(undefined)
    // does not throw or return null, it silently generates a fresh random id, so calling it first
    // and only null-checking the result never catches a missing/unauthenticated user.
    if (!req.user?._id) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).err_unauthorized,
        errors: [{ msg: 'Valid authenticated user id is required to list scans' }]
      })
    }

    const iUserId = ObjectId(req.user._id)
    if (!iUserId) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).err_unauthorized,
        errors: [{ msg: 'Valid authenticated user id is required to list scans' }]
      })
    }

    const page = req.query.page || 1
    const limit = req.query.limit || 20
    const sortBy = SORT_FIELD_MAP[req.query.sortBy] || SORT_FIELD_MAP.dCreatedAt
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1

    const filter = { iUserId }

    if (req.query.eStatus) {
      filter.eStatus = req.query.eStatus
    }

    if (req.query.search) {
      filter.sUrl = { $regex: escapeRegExp(req.query.search), $options: 'i' }
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.dCreatedAt = {}
      if (req.query.dateFrom) filter.dCreatedAt.$gte = req.query.dateFrom
      if (req.query.dateTo) filter.dCreatedAt.$lte = req.query.dateTo
    }

    const [scans, total] = await Promise.all([
      ScanModel.find(filter)
        .select('scanId sUrl eStatus nProgress oScores.nOverall dCreatedAt dFinishedAt')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ScanModel.countDocuments(filter)
    ])

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).scan_list,
      data: {
        scans: scans.map((scan) => ({
          scanId: scan.scanId,
          sUrl: scan.sUrl,
          status: scan.eStatus,
          progress: scan.nProgress,
          isFinished: FINISHED_STATUSES.includes(scan.eStatus),
          nOverall: scan.oScores?.nOverall ?? null,
          dCreatedAt: scan.dCreatedAt,
          dFinishedAt: scan.dFinishedAt
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0
        }
      }
    })
  } catch (error) {
    return catchError('scan.list', error, req, res)
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

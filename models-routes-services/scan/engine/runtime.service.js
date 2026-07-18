const crypto = require('crypto')
const ScanModel = require('../models/scan.model')
const ScanModuleResultModel = require('../models/scanModuleResult.model')
const { SCAN_MODULES, SCAN_STATUS, MODULE_STATUS } = require('../constants')

/**
 * @typedef {Object} ScanContext
 * @property {string} scanId
 * @property {string} sUrl
 * @property {string|null} iUserId
 * @property {string} eStatus
 * @property {Date} dCreatedAt
 * @property {Date|null} dFinishedAt
 * @property {number} nProgress
 */

const toContext = (scanDoc) => {
  if (!scanDoc) return null
  return {
    scanId: scanDoc.scanId,
    sUrl: scanDoc.sUrl,
    iUserId: scanDoc.iUserId ? String(scanDoc.iUserId) : null,
    eStatus: scanDoc.eStatus,
    dCreatedAt: scanDoc.dCreatedAt,
    dFinishedAt: scanDoc.dFinishedAt,
    nProgress: scanDoc.nProgress
  }
}

/**
 * Creates the Scan document + one pending ScanModuleResult per module.
 * @param {{ sUrl: string, iUserId: string, iSiteId?: string|null }} params
 * @returns {Promise<ScanContext>}
 */
const createScanContext = async ({ sUrl, iUserId, iSiteId = null }) => {
  const scanId = crypto.randomUUID()

  const scanDoc = await ScanModel.create({
    scanId,
    sUrl,
    iUserId,
    iSiteId,
    eStatus: SCAN_STATUS.QUEUED,
    nProgress: 0
  })

  await ScanModuleResultModel.insertMany(
    SCAN_MODULES.map((sModule) => ({
      scanId,
      iScanId: scanDoc._id,
      sModule,
      eStatus: MODULE_STATUS.PENDING
    }))
  )

  return toContext(scanDoc)
}

/** @returns {Promise<ScanContext|null>} */
const getScanContext = async (scanId) => {
  const scanDoc = await ScanModel.findOne({ scanId }).lean()
  return toContext(scanDoc)
}

/**
 * Marks a module as running for the current attempt — also bumps the scan
 * itself to `running` the first time any module starts.
 */
const markModuleRunning = async (scanId, sModule) => {
  await ScanModuleResultModel.updateOne(
    { scanId, sModule },
    {
      $set: { eStatus: MODULE_STATUS.RUNNING, dStartedAt: new Date() },
      $inc: { nAttempts: 1 }
    }
  )
  await ScanModel.updateOne(
    { scanId, eStatus: SCAN_STATUS.QUEUED },
    { $set: { eStatus: SCAN_STATUS.RUNNING } }
  )
}

/**
 * Persists a module's final outcome for this attempt and recomputes overall
 * progress from how many modules have reached a terminal state.
 */
const completeModule = async (scanId, sModule, { eStatus, oResult = null, sError = null, nScore = null }) => {
  await ScanModuleResultModel.updateOne(
    { scanId, sModule },
    {
      $set: {
        eStatus,
        oResult,
        sError,
        nScore: typeof nScore === 'number' ? nScore : null,
        dFinishedAt: new Date()
      }
    }
  )

  const finished = await ScanModuleResultModel.countDocuments({
    scanId,
    eStatus: { $in: [MODULE_STATUS.COMPLETED, MODULE_STATUS.FAILED, MODULE_STATUS.TIMEOUT] }
  })

  // Leave headroom for scan-finalize to set 100. eStatus is already RUNNING
  // by this point — markModuleRunning() always runs before completeModule().
  const nProgress = Math.min(99, Math.floor((finished / SCAN_MODULES.length) * 100))
  await ScanModel.updateOne({ scanId }, { $set: { nProgress } })
}

/**
 * Force a scan to a permanent failed state — used when background enqueue
 * to Redis/BullMQ fails, or when the finalize step itself throws.
 */
const markScanFailed = async (scanId, sError, sCode = null) => {
  await ScanModel.updateOne(
    { scanId },
    {
      $set: { eStatus: SCAN_STATUS.FAILED, nProgress: 100, dFinishedAt: new Date() },
      $push: { aErrors: { sMessage: sError || 'Scan failed', ...(sCode ? { sCode } : {}) } }
    }
  )
}

module.exports = {
  createScanContext,
  getScanContext,
  markModuleRunning,
  completeModule,
  markScanFailed
}

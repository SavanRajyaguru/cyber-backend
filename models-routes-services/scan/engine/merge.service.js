const ScanModel = require('../models/scan.model')
const ScanModuleResultModel = require('../models/scanModuleResult.model')
const { SCAN_MODULES, SCAN_STATUS, MODULE_STATUS } = require('../constants')
const { applyScores } = require('./score.service')

const FINISHED_STATUSES = [SCAN_STATUS.COMPLETED, SCAN_STATUS.PARTIAL, SCAN_STATUS.FAILED]

/**
 * Per-module status list for GET /scan/progress/:scanId — ordered by SCAN_MODULES
 * (phase 1 then phase 2) so the frontend can render it directly without sorting.
 * Modules that haven't been picked up by a worker yet still appear as `pending`
 * (rows are pre-created for all 11 modules in runtime.service.createScanContext).
 */
const getModuleStatusList = async (scanId) => {
  const moduleDocs = await ScanModuleResultModel.find({ scanId }).lean()
  const docsByModule = {}
  for (const doc of moduleDocs) docsByModule[doc.sModule] = doc

  return SCAN_MODULES.map((sModule) => {
    const doc = docsByModule[sModule]
    return {
      processId: sModule,
      status: doc?.eStatus || MODULE_STATUS.PENDING,
      nScore: doc?.nScore ?? null,
      dStartedAt: doc?.dStartedAt || null,
      dFinishedAt: doc?.dFinishedAt || null,
      sError: doc?.sError || null
    }
  })
}

/** Builds the `{ sModule: { eStatus, oResult, sError, nScore, dFinishedAt } }` shape from module docs. */
const buildOModules = (moduleDocs) => {
  const oModules = {}
  for (const doc of moduleDocs) {
    oModules[doc.sModule] = {
      eStatus: doc.eStatus,
      oResult: doc.oResult,
      sError: doc.sError,
      nScore: doc.nScore,
      dFinishedAt: doc.dFinishedAt
    }
  }
  return oModules
}

/**
 * Runs once all 11 modules have reached a terminal state (scan-finalize).
 * Scores the scan and writes its final status — does not touch the
 * already-correct per-module ScanModuleResult docs.
 */
const mergeScanResults = async (scanId) => {
  const moduleDocs = await ScanModuleResultModel.find({ scanId }).lean()
  const oModules = buildOModules(moduleDocs)

  const { oScores } = applyScores({ oModules })

  const aErrors = moduleDocs
    .filter((doc) => doc.sError)
    .map((doc) => ({ sModule: doc.sModule, sMessage: doc.sError }))

  const moduleStatuses = moduleDocs.map((doc) => doc.eStatus)
  const allFailed = moduleStatuses.length > 0 && moduleStatuses.every((s) =>
    s === MODULE_STATUS.FAILED || s === MODULE_STATUS.TIMEOUT
  )
  const anyFailed = moduleStatuses.some((s) =>
    s === MODULE_STATUS.FAILED || s === MODULE_STATUS.TIMEOUT
  )

  const eStatus = allFailed ? SCAN_STATUS.FAILED : anyFailed ? SCAN_STATUS.PARTIAL : SCAN_STATUS.COMPLETED

  await ScanModel.updateOne(
    { scanId },
    {
      $set: {
        eStatus,
        nProgress: 100,
        dFinishedAt: new Date(),
        oScores,
        aErrors
      }
    }
  )

  const oModuleStatuses = {}
  for (const doc of moduleDocs) oModuleStatuses[doc.sModule] = doc.eStatus

  return { eStatus, oScores, oModuleStatuses }
}

/** Assembles the full public report for GET /scan/result/:scanId. */
const toPublicReport = async (scanId) => {
  const [scanDoc, moduleDocs] = await Promise.all([
    ScanModel.findOne({ scanId }).lean(),
    ScanModuleResultModel.find({ scanId }).lean()
  ])
  if (!scanDoc) return null

  const oModules = buildOModules(moduleDocs)
  const oResults = {}
  for (const [sModule, slot] of Object.entries(oModules)) {
    if (slot.oResult) oResults[sModule] = slot.oResult
  }

  return {
    scanId: scanDoc.scanId,
    sUrl: scanDoc.sUrl,
    eStatus: scanDoc.eStatus,
    nProgress: scanDoc.nProgress,
    isFinished: FINISHED_STATUSES.includes(scanDoc.eStatus),
    dCreatedAt: scanDoc.dCreatedAt,
    dFinishedAt: scanDoc.dFinishedAt,
    oResults,
    oScores: scanDoc.oScores,
    oModules,
    aErrors: scanDoc.aErrors
  }
}

module.exports = {
  mergeScanResults,
  toPublicReport,
  getModuleStatusList,
  FINISHED_STATUSES
}

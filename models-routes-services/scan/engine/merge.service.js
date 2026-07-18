const { SCAN_STATUS, MODULE_STATUS } = require('../constants')
const { applyScores } = require('./score.service')

const mergeScanResults = (context) => {
  const oResults = {}
  const aErrors = []

  for (const [sModule, slot] of Object.entries(context.oModules || {})) {
    if (slot?.oResult) {
      oResults[sModule] = slot.oResult
    }
    if (slot?.sError) {
      aErrors.push({ sModule, sMessage: slot.sError })
    }
  }

  applyScores(context)
  context.oResults = oResults
  context.aErrors = aErrors

  const moduleStatuses = Object.values(context.oModules || {}).map((m) => m.eStatus)
  const allFailed = moduleStatuses.length > 0 && moduleStatuses.every((s) =>
    s === MODULE_STATUS.FAILED || s === MODULE_STATUS.TIMEOUT
  )
  const anyFailed = moduleStatuses.some((s) =>
    s === MODULE_STATUS.FAILED || s === MODULE_STATUS.TIMEOUT
  )

  if (allFailed) {
    context.eStatus = SCAN_STATUS.FAILED
  } else if (anyFailed) {
    context.eStatus = SCAN_STATUS.PARTIAL
  } else {
    context.eStatus = SCAN_STATUS.COMPLETED
  }

  context.nProgress = 100
  context.dFinishedAt = new Date()
  return context
}

const toPublicReport = (context) => ({
  scanId: context.scanId,
  sUrl: context.sUrl,
  eStatus: context.eStatus,
  nProgress: context.nProgress,
  dCreatedAt: context.dCreatedAt,
  dFinishedAt: context.dFinishedAt,
  oResults: context.oResults,
  oScores: context.oScores,
  oModules: context.oModules,
  aErrors: context.aErrors
})

module.exports = {
  mergeScanResults,
  toPublicReport
}

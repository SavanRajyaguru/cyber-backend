const { handleCatchError } = require('../../../helper/utilities.services')
const runtimeService = require('../engine/runtime.service')
const { mergeScanResults } = require('../engine/merge.service')
const { SCAN_STATUS, SCAN_MODULES, MODULE_STATUS } = require('../constants')

/**
 * Parent worker runs after all children settle (BullMQ flow).
 * Merges module results, scores, and finalizes ScanContext.
 */
module.exports = async (job) => {
  const { scanId, sUrl } = job.data || {}
  const startedAt = Date.now()

  try {
    if (!scanId) {
      console.warn('[scan.parent] Missing scanId')
      return { eStatus: SCAN_STATUS.FAILED }
    }

    console.log(`[scan.parent] [${scanId}] Merge started`, { sUrl: sUrl || null })

    const context = runtimeService.getScanContext(scanId)
    if (!context) {
      console.warn(`[scan.parent] [${scanId}] Context missing for merge`)
      return { eStatus: SCAN_STATUS.FAILED, sError: 'Scan context expired' }
    }

    const moduleSummary = {}
    for (const sModule of SCAN_MODULES) {
      const slot = context.oModules?.[sModule]
      moduleSummary[sModule] = {
        eStatus: slot?.eStatus || MODULE_STATUS.PENDING,
        nScore: slot?.nScore ?? null,
        sError: slot?.sError || null
      }
    }
    console.log(`[scan.parent] [${scanId}] Child module statuses`, moduleSummary)

    mergeScanResults(context)
    runtimeService.saveContext(context)

    const elapsedMs = Date.now() - startedAt
    console.log(`[scan.parent] [${scanId}] Merge finished`, {
      eStatus: context.eStatus,
      nProgress: context.nProgress,
      nOverall: context.oScores?.nOverall ?? null,
      elapsedMs,
      errors: (context.aErrors || []).length
    })

    return {
      scanId,
      eStatus: context.eStatus,
      nProgress: context.nProgress,
      nOverall: context.oScores?.nOverall ?? null
    }
  } catch (error) {
    handleCatchError(error)
    console.error(`[scan.parent] [${scanId}] Merge failed:`, error?.message)
    try {
      const existing = runtimeService.getScanContext(scanId)
      if (existing) {
        existing.eStatus = SCAN_STATUS.FAILED
        existing.nProgress = 100
        existing.dFinishedAt = new Date()
        existing.aErrors = [...(existing.aErrors || []), { sMessage: error?.message || 'Merge failed' }]
        runtimeService.saveContext(existing)
      }
    } catch (inner) {
      handleCatchError(inner)
    }
    return { scanId, eStatus: SCAN_STATUS.FAILED }
  }
}

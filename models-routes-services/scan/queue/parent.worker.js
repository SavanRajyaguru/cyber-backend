const { handleCatchError } = require('../../../helper/utilities.services')
const { debugLog } = require('../../../helper/debugLog')
const runtimeService = require('../engine/runtime.service')
const { mergeScanResults } = require('../engine/merge.service')
const ScanModel = require('../models/scan.model')
const SiteModel = require('../models/site.model')

/**
 * scan-finalize processor: runs once tier 2 (the 3 DB-dependent modules)
 * settle. Scores the scan, sets its final status, and updates the linked
 * Site rollup.
 */
module.exports = async (job) => {
  const { scanId } = job.data || {}
  const startedAt = Date.now()

  try {
    if (!scanId) {
      console.warn('[scan.finalize] Missing scanId')
      return { eStatus: 'failed' }
    }

    console.log(`[scan.finalize] [${scanId}] Merge started`)

    const { eStatus, oScores, oModuleStatuses } = await mergeScanResults(scanId)

    debugLog('scan.finalize', 'Per-module pass/fail', { scanId, oModuleStatuses, oScores })

    const scanDoc = await ScanModel.findOne({ scanId }).lean()
    if (scanDoc?.iSiteId) {
      await SiteModel.updateOne(
        { _id: scanDoc.iSiteId },
        {
          $set: {
            iLastScanId: scanDoc._id,
            nLastOverallScore: oScores?.nOverall ?? null,
            dLastScannedAt: new Date()
          }
        }
      )
    }

    const elapsedMs = Date.now() - startedAt
    console.log(`[scan.finalize] [${scanId}] Merge finished`, {
      eStatus,
      nOverall: oScores?.nOverall ?? null,
      elapsedMs
    })

    return { scanId, eStatus, nOverall: oScores?.nOverall ?? null }
  } catch (error) {
    handleCatchError(error)
    console.error(`[scan.finalize] [${scanId}] Merge failed:`, error?.message)
    await runtimeService.markScanFailed(scanId, error?.message || 'Merge failed', 'FINALIZE_FAILED').catch(handleCatchError)
    return { scanId, eStatus: 'failed' }
  }
}

const { handleCatchError } = require('../../../helper/utilities.services')
const { debugLog } = require('../../../helper/debugLog')
const { toBullJobId } = require('../../../helper/bullmq')
const { JOB_NAMES, QUEUE_NAMES, PHASE2_MODULES } = require('../constants')
const runtimeService = require('../engine/runtime.service')

/**
 * Tier-1 gate: runs once the 8 independent modules settle. Its only job is
 * to enqueue tier 2 (`scan-finalize` + the 3 DB-dependent modules), which
 * read their sibling data straight from MongoDB — no in-memory wait/poll.
 */
module.exports = async (job) => {
  const { scanId, sUrl } = job.data || {}

  try {
    if (!scanId) {
      console.warn('[scan.phase1-gate] Missing scanId')
      return { eStatus: 'failed' }
    }

    // Required here (not at module load) to avoid a require-cycle with queue.service.js
    const { getFlowProducer, buildModuleChildren } = require('./queue.service')

    console.log(`[scan.phase1-gate] [${scanId}] Phase 1 settled — enqueueing phase 2`)
    debugLog('scan.phase1-gate', 'Enqueueing phase 2', { scanId, sUrl })

    await getFlowProducer().add({
      name: JOB_NAMES.FINALIZE,
      queueName: QUEUE_NAMES.PARENT,
      data: { scanId, sUrl },
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 50,
        jobId: toBullJobId(`${scanId}_finalize`)
      },
      children: buildModuleChildren({ scanId, sUrl, aModules: PHASE2_MODULES })
    })

    return { scanId, triggeredFinalize: true }
  } catch (error) {
    handleCatchError(error)
    console.error(`[scan.phase1-gate] [${scanId}] Failed to enqueue phase 2:`, error?.message)
    await runtimeService.markScanFailed(
      scanId,
      error?.message || 'Failed to enqueue phase 2',
      'PHASE2_ENQUEUE_FAILED'
    ).catch(handleCatchError)
    return { scanId, eStatus: 'failed' }
  }
}

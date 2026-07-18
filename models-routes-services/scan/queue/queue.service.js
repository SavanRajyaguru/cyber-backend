const config = require('../../../config/config')
const { handleCatchError } = require('../../../helper/utilities.services')
const { debugLog } = require('../../../helper/debugLog')
const {
  createQueue,
  createFlowProducer,
  toBullJobId,
  subscribeQueuePreserveError
} = require('../../../helper/bullmq')
const runtimeService = require('../engine/runtime.service')
const { QUEUE_NAMES, JOB_NAMES, PHASE1_MODULES } = require('../constants')

let parentQueue = null
let moduleQueue = null
let flowProducer = null
let workersStarted = false

const getParentQueue = () => {
  if (!parentQueue) {
    parentQueue = createQueue({ sQueueName: QUEUE_NAMES.PARENT })
  }
  return parentQueue
}

const getModuleQueue = () => {
  if (!moduleQueue) {
    moduleQueue = createQueue({ sQueueName: QUEUE_NAMES.MODULE })
  }
  return moduleQueue
}

const getFlowProducer = () => {
  if (!flowProducer) {
    flowProducer = createFlowProducer()
  }
  return flowProducer
}

/**
 * Builds the child-job spec for one module — same retry opts regardless of
 * which phase it belongs to.
 */
const buildModuleChildren = ({ scanId, sUrl, aModules }) => aModules.map((sModule) => ({
  name: JOB_NAMES.MODULE,
  queueName: QUEUE_NAMES.MODULE,
  data: { scanId, sUrl, sModule },
  opts: {
    // A permanently-failed module must never block its parent (phase1-gate /
    // scan-finalize) — failParentOnFailure alone does NOT achieve this; without
    // removeDependencyOnFailure the failed jobId stays stuck in the parent's
    // pending-dependencies list forever and the parent never runs.
    failParentOnFailure: false,
    removeDependencyOnFailure: true,
    attempts: Number(config.SCAN_MODULE_MAX_ATTEMPTS) || 3,
    backoff: { type: 'exponential', delay: Number(config.SCAN_MODULE_RETRY_BACKOFF_MS) || 2000 },
    removeOnComplete: true,
    removeOnFail: 50,
    jobId: toBullJobId(`${scanId}_${sModule}`)
  }
}))

/**
 * Enqueues tier 1 only: `phase1-gate` parent + the 8 independent module
 * children. Tier 2 (`scan-finalize` + the 3 DB-dependent modules) is
 * enqueued by phase1Gate.worker.js once tier 1 settles — see docs/SCANNING.md.
 */
const enqueueScanFlow = async ({ scanId, sUrl }) => {
  const flow = await getFlowProducer().add({
    name: JOB_NAMES.PHASE1_GATE,
    queueName: QUEUE_NAMES.PARENT,
    data: { scanId, sUrl },
    opts: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 50,
      jobId: toBullJobId(`${scanId}_phase1_gate`)
    },
    children: buildModuleChildren({ scanId, sUrl, aModules: PHASE1_MODULES })
  })

  return flow
}

/**
 * Fire-and-forget enqueue so /scan/start can return scanId immediately.
 * Failures are written into the Scan document (never crash the API process).
 * @param {{ scanId: string, sUrl: string }} params
 */
const enqueueScanFlowAsync = ({ scanId, sUrl }) => {
  console.log(`[scan] [${scanId}] Queueing background flow`, {
    sUrl,
    phase1Modules: PHASE1_MODULES.length
  })

  setImmediate(() => {
    const startedAt = Date.now()
    enqueueScanFlow({ scanId, sUrl })
      .then(() => {
        console.log(`[scan] [${scanId}] Flow enqueued`, {
          elapsedMs: Date.now() - startedAt
        })
      })
      .catch((error) => {
        handleCatchError(error)
        console.error(`[scan] [${scanId}] Enqueue failed:`, error?.message)
        runtimeService.markScanFailed(
          scanId,
          error?.message || 'Failed to enqueue scan jobs',
          'ENQUEUE_FAILED'
        ).catch(handleCatchError)
      })
  })
}

/**
 * Pre-create queues / flow producer / workers at boot (avoids first-request cold start).
 */
const startScanWorkers = () => {
  if (workersStarted) return
  workersStarted = true

  // Warm producer + queue clients before first API request
  getModuleQueue()
  getParentQueue()
  getFlowProducer()

  const phase1GateWorkerHandler = require('./phase1Gate.worker')
  const finalizeWorkerHandler = require('./parent.worker')
  const moduleWorkerHandler = require('./module.worker')

  const parentDispatch = async (job) => {
    if (job.name === JOB_NAMES.PHASE1_GATE) return phase1GateWorkerHandler(job)
    if (job.name === JOB_NAMES.FINALIZE) return finalizeWorkerHandler(job)
    console.warn(`[scan.parent] Unknown parent job name "${job.name}" — skipping`)
  }

  const moduleWorker = subscribeQueuePreserveError({
    oQueue: getModuleQueue(),
    config: { concurrency: Number(config.SCAN_WORKER_CONCURRENCY) || 5 },
    callBack: moduleWorkerHandler
  })

  // Only the FINAL failed attempt (retries exhausted) gets a permanent DB record.
  moduleWorker.on('failed', (job, error) => {
    const isFinalAttempt = (job?.attemptsMade || 0) >= (job?.opts?.attempts || 1)
    debugLog('scan.module', 'Attempt failed', {
      scanId: job?.data?.scanId,
      sModule: job?.data?.sModule,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      isFinalAttempt,
      error: error?.message
    })
    if (!isFinalAttempt) return
    moduleWorkerHandler.onFinalFailure(job, error).catch(handleCatchError)
  })

  subscribeQueuePreserveError({
    oQueue: getParentQueue(),
    config: { concurrency: Number(config.SCAN_PARENT_CONCURRENCY) || 2 },
    callBack: parentDispatch
  })

  console.log('[scan] BullMQ parent and module workers registered')
}

module.exports = {
  enqueueScanFlow,
  enqueueScanFlowAsync,
  startScanWorkers,
  getParentQueue,
  getModuleQueue,
  getFlowProducer,
  buildModuleChildren
}

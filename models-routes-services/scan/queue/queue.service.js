const config = require('../../../config/config')
const { handleCatchError } = require('../../../helper/utilities.services')
const {
  createQueue,
  createFlowProducer,
  toBullJobId,
  subscribeQueuePreserveError
} = require('../../../helper/bullmq')
const runtimeService = require('../engine/runtime.service')
const { SCAN_MODULES, QUEUE_NAMES, JOB_NAMES } = require('../constants')

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
 * Enqueue parent flow with parallel child module jobs.
 * Children run first; parent processor merges after children settle.
 */
const enqueueScanFlow = async ({ scanId, sUrl }) => {
  const children = SCAN_MODULES.map((sModule) => ({
    name: JOB_NAMES.MODULE,
    queueName: QUEUE_NAMES.MODULE,
    data: { scanId, sUrl, sModule },
    opts: {
      failParentOnFailure: false,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 50,
      jobId: toBullJobId(`${scanId}_${sModule}`)
    }
  }))

  const flow = await getFlowProducer().add({
    name: JOB_NAMES.PARENT,
    queueName: QUEUE_NAMES.PARENT,
    data: { scanId, sUrl },
    opts: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 50,
      jobId: toBullJobId(`${scanId}_parent`)
    },
    children
  })

  return flow
}

/**
 * Fire-and-forget enqueue so /scan/start can return scanId immediately.
 * Failures are written into ScanContext (never crash the API process).
 * @param {{ scanId: string, sUrl: string }} params
 */
const enqueueScanFlowAsync = ({ scanId, sUrl }) => {
  console.log(`[scan] [${scanId}] Queueing background flow`, {
    sUrl,
    modules: SCAN_MODULES.length,
    modulesList: SCAN_MODULES
  })

  setImmediate(() => {
    const startedAt = Date.now()
    enqueueScanFlow({ scanId, sUrl })
      .then(() => {
        console.log(`[scan] [${scanId}] Flow enqueued`, {
          elapsedMs: Date.now() - startedAt,
          childJobs: SCAN_MODULES.length
        })
      })
      .catch((error) => {
        handleCatchError(error)
        console.error(`[scan] [${scanId}] Enqueue failed:`, error?.message)
        try {
          runtimeService.markEnqueueFailed(
            scanId,
            error?.message || 'Failed to enqueue scan jobs'
          )
        } catch (inner) {
          handleCatchError(inner)
        }
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

  const parentWorkerHandler = require('./parent.worker')
  const moduleWorkerHandler = require('./module.worker')

  subscribeQueuePreserveError({
    oQueue: getModuleQueue(),
    config: { concurrency: Number(config.SCAN_WORKER_CONCURRENCY) || 5 },
    callBack: moduleWorkerHandler
  })

  subscribeQueuePreserveError({
    oQueue: getParentQueue(),
    config: { concurrency: Number(config.SCAN_PARENT_CONCURRENCY) || 2 },
    callBack: parentWorkerHandler
  })

  console.log('[scan] BullMQ parent and module workers registered')
}

module.exports = {
  enqueueScanFlow,
  enqueueScanFlowAsync,
  startScanWorkers,
  getParentQueue,
  getModuleQueue
}

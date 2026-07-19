const { Queue, Worker, FlowProducer } = require('bullmq')
const { getRedisConnectionOptions } = require('./redisConnection')

/**
 * Connection OPTIONS (not a shared ioredis instance).
 * BullMQ duplicates connections per Queue/Worker/FlowProducer.
 * Sharing one Redis client between Workers (blocking BRPOP) and producers
 * causes enqueue/start API to stall under load.
 *
 * Configure via REDIS_CONNECTION_STRING (preferred) or REDIS_HOST / PORT / PASSWORD.
 */

/** @deprecated Prefer getRedisConnectionOptions(); kept for callers expecting `connection`. */
const connection = getRedisConnectionOptions()

const createFlowProducer = () => {
  return new FlowProducer({ connection: getRedisConnectionOptions() })
}

const createQueue = ({ sQueueName = '' }) => {
  return new Queue(sQueueName, { connection: getRedisConnectionOptions() })
}

const toBullJobId = (jobId) => {
  if (!jobId) return jobId
  return String(jobId).replace(/:/g, '_')
}

const addJob = async ({ oQueue, sKey, oPayload, nTimeMS, oConfig = {} }) => {
  const opts = {
    delay: nTimeMS,
    removeOnComplete: true,
    removeOnFail: 50,
    jobId: toBullJobId(sKey),
    ...oConfig
  }
  opts.jobId = toBullJobId(opts.jobId)
  return await oQueue.add(sKey, oPayload, opts)
}

const removeRepeatableJob = async ({ oQueue, sKey, oRepeatConfig }) => {
  return await oQueue.removeRepeatable(sKey, oRepeatConfig, toBullJobId(sKey))
}

const addBulkJobs = async ({ oQueue, aJobs }) => {
  const aSanitizedJobs = aJobs.map((job) => {
    const opts = { ...job.opts }
    opts.jobId = toBullJobId(opts.jobId || job.name)
    return { ...job, opts }
  })
  return await oQueue.addBulk(aSanitizedJobs)
}

const deleteJob = async ({ sKey, oQueue }) => {
  const job = await oQueue.getJob(toBullJobId(sKey))
  if (job) await job.remove()
  return true
}

const updateJobTTL = async ({ sKey, nTimeMS, oQueue }) => {
  const job = await oQueue.getJob(toBullJobId(sKey))
  if (job) {
    await job.changeDelay(nTimeMS)
  }
  return true
}

const subscribeQueue = ({ oQueue, config: workerConfig, callBack }) => {
  const queueMsg = `Subscribing data from queue '${oQueue.name
    }' || ${new Date().toLocaleDateString()}|${new Date().toLocaleTimeString()}`
  console.log(queueMsg)
  const worker = new Worker(
    oQueue.name,
    async (job) => {
      try {
        await callBack(job)
      } catch (error) {
        if (error?.message === 'RETRY_JOB') {
          throw new Error(
            `Failed to process the job internally so retrying... attemptsMade:${job.attemptsMade} attemptsStarted:${job.attemptsStarted}`
          )
        } else {
          throw new Error('Something went wrong while processing the job')
        }
      }
    },
    {
      connection: getRedisConnectionOptions(),
      ...workerConfig
    }
  )
  return worker
}

const subscribeQueuePreserveError = ({ oQueue, config: workerConfig, callBack }) => {
  const queueMsg = `Subscribing data from queue '${oQueue.name
    }' || ${new Date().toLocaleDateString()}|${new Date().toLocaleTimeString()}`
  console.log(queueMsg)
  const worker = new Worker(
    oQueue.name,
    async (job) => {
      try {
        await callBack(job)
      } catch (error) {
        if (error?.message === 'RETRY_JOB') {
          throw new Error(
            `RETRY_JOB: attemptsMade:${job.attemptsMade} attemptsStarted:${job.attemptsStarted}`
          )
        }
        throw error
      }
    },
    {
      connection: getRedisConnectionOptions(),
      ...workerConfig
    }
  )
  return worker
}

module.exports = {
  connection,
  getRedisConnectionOptions,
  createQueue,
  createFlowProducer,
  toBullJobId,
  addJob,
  deleteJob,
  updateJobTTL,
  subscribeQueue,
  subscribeQueuePreserveError,
  addBulkJobs,
  removeRepeatableJob
}

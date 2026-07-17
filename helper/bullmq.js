const { Queue, Worker } = require('bullmq')
const Redis = require('ioredis')
const config = require('../config/config')

const connection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: Number(config.REDIS_DB)
})

const createQueue = ({ sQueueName = '' }) => {
  return new Queue(sQueueName, { connection })
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

const subscribeQueue = ({ oQueue, config, callBack }) => {
  const queueMsg = `Subscribing data from queue '${oQueue.name
    }' || ${new Date().toLocaleDateString()}|${new Date().toLocaleTimeString()}`
  console.log(queueMsg)
  const worker = new Worker(
    oQueue.name,
    async job => {
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
      connection,
      ...config
    }
  )
  return worker
}

const subscribeQueuePreserveError = ({ oQueue, config, callBack }) => {
  const queueMsg = `Subscribing data from queue '${oQueue.name
    }' || ${new Date().toLocaleDateString()}|${new Date().toLocaleTimeString()}`
  console.log(queueMsg)
  const worker = new Worker(
    oQueue.name,
    async job => {
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
      connection,
      ...config
    }
  )
  return worker
}

module.exports = {
  createQueue,
  toBullJobId,
  addJob,
  deleteJob,
  updateJobTTL,
  subscribeQueue,
  subscribeQueuePreserveError,
  addBulkJobs,
  removeRepeatableJob
}

/**
 * Build ioredis / BullMQ connection options.
 * Prefer REDIS_CONNECTION_STRING when set; otherwise fall back to HOST/PORT/PASSWORD.
 *
 * URL forms:
 *   redis://localhost:6379
 *   redis://:password@host:6379/0
 *   redis://default:password@host:17839
 *   rediss://...  (TLS — Redis Cloud / Upstash)
 */

const config = require('../config/config')

const parseRedisConnectionString = (connectionString) => {
  const u = new URL(connectionString)
  const opts = {
    host: u.hostname,
    port: Number(u.port) || 6379
  }

  if (u.username) {
    opts.username = decodeURIComponent(u.username)
  }
  if (u.password) {
    opts.password = decodeURIComponent(u.password)
  }

  const pathDb = u.pathname?.replace(/^\//, '')
  if (pathDb !== '' && pathDb != null && !Number.isNaN(Number(pathDb))) {
    opts.db = Number(pathDb)
  }

  // Redis Cloud / managed TLS endpoints use rediss://
  if (u.protocol === 'rediss:') {
    opts.tls = {}
  }

  return opts
}

/**
 * Options object for BullMQ (Queue / Worker / FlowProducer).
 * Do NOT reuse a single ioredis instance across workers + producers.
 */
const getRedisConnectionOptions = () => {
  const connectionString = (config.REDIS_CONNECTION_STRING || '').trim()
  let base

  if (connectionString) {
    try {
      base = parseRedisConnectionString(connectionString)
    } catch (error) {
      console.error('[redis] Invalid REDIS_CONNECTION_STRING — falling back to HOST/PORT:', error.message)
      base = null
    }
  }

  if (!base) {
    base = {
      host: config.REDIS_HOST || config.REDIS_HOST_NAME || 'localhost',
      port: Number(config.REDIS_PORT) || 6379
    }
    if (config.REDIS_PASSWORD) {
      base.password = config.REDIS_PASSWORD
    }
    if (config.REDIS_USERNAME && config.REDIS_PASSWORD) {
      base.username = config.REDIS_USERNAME
    }
  }

  // Explicit REDIS_DB wins when URL has no /db path
  if (base.db == null && config.REDIS_DB != null && config.REDIS_DB !== '') {
    base.db = Number(config.REDIS_DB) || 0
  }

  return {
    ...base,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
}

/** Connection args for a dedicated ioredis client (auth cache, rate limits, etc.). */
const getRedisClientArgs = () => {
  const connectionString = (config.REDIS_CONNECTION_STRING || '').trim()
  if (connectionString) {
    try {
      // Validate URL first
      parseRedisConnectionString(connectionString)
      const opts = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      }
      if (config.REDIS_DB != null && config.REDIS_DB !== '' && !/\/\d+\s*$/.test(connectionString)) {
        opts.db = Number(config.REDIS_DB) || 0
      }
      return { type: 'url', url: connectionString, options: opts }
    } catch (error) {
      console.error('[redis] Invalid REDIS_CONNECTION_STRING for client — falling back to HOST/PORT:', error.message)
    }
  }

  return {
    type: 'host',
    host: config.REDIS_HOST_NAME || config.REDIS_HOST || 'localhost',
    port: Number(config.REDIS_PORT) || 6379,
    password: config.REDIS_PASSWORD || '',
    mode: config.REDIS_MODE || 'single',
    options: {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(config.REDIS_USERNAME && config.REDIS_PASSWORD
        ? { username: config.REDIS_USERNAME }
        : {}),
      ...(config.REDIS_DB != null && config.REDIS_DB !== ''
        ? { db: Number(config.REDIS_DB) || 0 }
        : {})
    }
  }
}

module.exports = {
  parseRedisConnectionString,
  getRedisConnectionOptions,
  getRedisClientArgs
}

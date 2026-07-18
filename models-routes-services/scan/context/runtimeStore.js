const config = require('../../../config/config')
const { CLEANUP_INTERVAL_MS } = require('../constants')

/**
 * @typedef {Object} ModuleSlot
 * @property {string} eStatus
 * @property {Object|null} oResult
 * @property {string|null} sError
 * @property {number|null} nScore
 * @property {Date|null} dFinishedAt
 */

/**
 * @typedef {Object} ScanContext
 * @property {string} scanId
 * @property {string} sUrl
 * @property {string|null} iUserId
 * @property {string} eStatus
 * @property {Date} dCreatedAt
 * @property {Date|null} dFinishedAt
 * @property {number} nProgress
 * @property {Record<string, ModuleSlot>} oModules
 * @property {Object} oResults
 * @property {{ modules: Record<string, number|null>, nOverall: number|null }} oScores
 * @property {Array<{ sModule?: string, sMessage: string }>} aErrors
 */

/** @type {Map<string, ScanContext>} */
const scans = new Map()

const getTtlMs = () => Number(config.SCAN_CONTEXT_TTL_MS) || 600000

const set = (scanId, context) => {
  scans.set(scanId, context)
  return context
}

const get = (scanId) => {
  const context = scans.get(scanId)
  if (!context) return null

  const age = Date.now() - new Date(context.dCreatedAt).getTime()
  if (age > getTtlMs()) {
    scans.delete(scanId)
    return null
  }
  return context
}

const has = (scanId) => Boolean(get(scanId))

const remove = (scanId) => scans.delete(scanId)

const update = (scanId, updater) => {
  const context = get(scanId)
  if (!context) return null
  const next = typeof updater === 'function' ? updater(context) : { ...context, ...updater }
  scans.set(scanId, next)
  return next
}

const sweepExpired = () => {
  const ttl = getTtlMs()
  const now = Date.now()
  for (const [scanId, context] of scans.entries()) {
    const age = now - new Date(context.dCreatedAt).getTime()
    if (age > ttl) {
      scans.delete(scanId)
    }
  }
}

let cleanupTimer = null

const startCleanupScheduler = () => {
  if (cleanupTimer) return
  cleanupTimer = setInterval(sweepExpired, CLEANUP_INTERVAL_MS)
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }
}

startCleanupScheduler()

module.exports = {
  set,
  get,
  has,
  remove,
  update,
  sweepExpired,
  startCleanupScheduler,
  _store: scans
}

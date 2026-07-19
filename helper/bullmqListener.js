// Register BullMQ workers for all environments (API process hosts workers).
// Verify Redis maxmemory-policy before workers attach (BullMQ requires noeviction).
;(async () => {
  try {
    await require('./ensureRedisNoEviction').ensureRedisNoEviction()
  } catch (error) {
    console.error('[redis] Preflight check error:', error.message)
  }
  require('../models-routes-services/scan/queue/queue.service').startScanWorkers()
})()

module.exports = {}

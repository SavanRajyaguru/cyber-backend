// Register BullMQ workers for all environments (API process hosts workers).
require('../models-routes-services/scan/queue/queue.service').startScanWorkers()

module.exports = {}

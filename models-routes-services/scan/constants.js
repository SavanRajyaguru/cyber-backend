const SCAN_MODULES = Object.freeze([
  'header',
  'ssl',
  'dns',
  'javascript',
  'seo',
  'threat',
  'technology',
  'compliance',
  'infrastructure',
  'performance',
  'secret'
])

const SCAN_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial'
})

const MODULE_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
})

const QUEUE_NAMES = Object.freeze({
  PARENT: 'scan-parent',
  MODULE: 'scan-module'
})

const JOB_NAMES = Object.freeze({
  PARENT: 'scan-parent',
  MODULE: 'scan-module'
})

const CLEANUP_INTERVAL_MS = 60 * 1000

module.exports = {
  SCAN_MODULES,
  SCAN_STATUS,
  MODULE_STATUS,
  QUEUE_NAMES,
  JOB_NAMES,
  CLEANUP_INTERVAL_MS
}

// Independent — no dependency on any other module's output
const PHASE1_MODULES = Object.freeze([
  'header',
  'ssl',
  'dns',
  'javascript',
  'seo',
  'technology',
  'performance',
  'secret'
])

// Run only after PHASE1_MODULES finish — read sibling results directly from MongoDB
const PHASE2_MODULES = Object.freeze([
  'infrastructure',
  'threat',
  'compliance'
])

const SCAN_MODULES = Object.freeze([...PHASE1_MODULES, ...PHASE2_MODULES])

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
  // Tier 1: gathers the 8 independent modules, then enqueues FINALIZE
  PHASE1_GATE: 'phase1-gate',
  // Tier 2: gathers the 3 DB-dependent modules, then merges + scores the scan
  FINALIZE: 'scan-finalize',
  MODULE: 'scan-module'
})

module.exports = {
  PHASE1_MODULES,
  PHASE2_MODULES,
  SCAN_MODULES,
  SCAN_STATUS,
  MODULE_STATUS,
  QUEUE_NAMES,
  JOB_NAMES
}

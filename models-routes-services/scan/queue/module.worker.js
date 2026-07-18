const { handleCatchError } = require('../../../helper/utilities.services')
const { debugLog } = require('../../../helper/debugLog')
const { getScanner } = require('../scanners')
const { runScanner } = require('../scanners/base.scanner')
const runtimeService = require('../engine/runtime.service')
const { MODULE_STATUS } = require('../constants')

const log = (scanId, sModule, message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[scan.module] [${scanId}] [${sModule}] ${message}${suffix}`)
}

/** Wraps a scanner failure so it survives the throw→BullMQ-retry→'failed' event round trip. */
const scannerFailure = (sError, eStatus) => {
  const error = new Error(sError || 'Scanner failed')
  error.eStatus = eStatus
  return error
}

/**
 * Child worker: run one scanner module independently, with retry.
 * Any non-success outcome THROWS so BullMQ's `attempts`+`backoff` actually
 * retries it — only the final attempt (see onFinalFailure below) writes a
 * permanent failed ScanModuleResult doc.
 */
module.exports = async (job) => {
  const { scanId, sUrl, sModule } = job.data || {}
  const startedAt = Date.now()
  const attempt = job.attemptsMade + 1

  if (!scanId || !sUrl || !sModule) {
    console.warn('[scan.module] Invalid job payload', job.data)
    throw scannerFailure('Invalid job payload', MODULE_STATUS.FAILED)
  }

  log(scanId, sModule, 'Job picked up', { jobId: job.id, sUrl, attempt })

  const context = await runtimeService.getScanContext(scanId)
  if (!context) {
    console.warn(`[scan.module] [${scanId}] [${sModule}] Scan not found`)
    throw scannerFailure('Scan not found', MODULE_STATUS.FAILED)
  }

  await runtimeService.markModuleRunning(scanId, sModule)
  debugLog('scan.module', 'Attempt starting', { scanId, sModule, attempt, maxAttempts: job.opts.attempts })

  const scanFn = getScanner(sModule)
  const result = await runScanner({ sModule, sUrl, scanId, scanFn })
  const elapsedMs = Date.now() - startedAt

  if (result.eStatus !== MODULE_STATUS.COMPLETED) {
    debugLog('scan.module', 'Attempt failed', { scanId, sModule, attempt, elapsedMs, sError: result.sError })
    throw scannerFailure(result.sError, result.eStatus)
  }

  await runtimeService.completeModule(scanId, sModule, {
    eStatus: result.eStatus,
    oResult: result.oResult,
    sError: result.sError,
    nScore: result.nScore
  })

  log(scanId, sModule, 'Finished', { eStatus: result.eStatus, nScore: result.nScore, elapsedMs })
  debugLog('scan.module', 'Attempt succeeded', {
    scanId,
    sModule,
    nScore: result.nScore,
    findings: Array.isArray(result.oResult?.findings) ? result.oResult.findings.length : null
  })

  return { scanId, sModule, eStatus: result.eStatus, elapsedMs }
}

/**
 * Called from queue.service.js's Worker 'failed' listener, only once — when
 * a module has exhausted all retry attempts. Writes the one permanent
 * failed record; never retried again after this.
 */
module.exports.onFinalFailure = async (job, error) => {
  const { scanId, sModule } = job?.data || {}
  if (!scanId || !sModule) {
    handleCatchError(error)
    return
  }

  const eStatus = error?.eStatus === MODULE_STATUS.TIMEOUT ? MODULE_STATUS.TIMEOUT : MODULE_STATUS.FAILED

  await runtimeService.completeModule(scanId, sModule, {
    eStatus,
    oResult: null,
    sError: error?.message || 'Scanner failed after max attempts',
    nScore: null
  })

  console.error(`[scan.module] [${scanId}] [${sModule}] Permanent failure after ${job.attemptsMade} attempts:`, error?.message)
  debugLog('scan.module', 'Permanent failure recorded', { scanId, sModule, attemptsMade: job.attemptsMade, eStatus })
}

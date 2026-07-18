const { handleCatchError } = require('../../../helper/utilities.services')
const { getScanner } = require('../scanners')
const { runScanner } = require('../scanners/base.scanner')
const runtimeService = require('../engine/runtime.service')
const { MODULE_STATUS } = require('../constants')

const log = (scanId, sModule, message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[scan.module] [${scanId}] [${sModule}] ${message}${suffix}`)
}

/**
 * Child worker: run one scanner module independently.
 * Errors are captured into runtime context — job resolves successfully
 * so remaining siblings and parent merge still run.
 */
module.exports = async (job) => {
  const { scanId, sUrl, sModule } = job.data || {}
  const startedAt = Date.now()

  try {
    if (!scanId || !sUrl || !sModule) {
      console.warn('[scan.module] Invalid job payload', job.data)
      return { eStatus: MODULE_STATUS.FAILED, sError: 'Invalid job payload' }
    }

    log(scanId, sModule, 'Job picked up', {
      jobId: job.id,
      sUrl,
      attempt: job.attemptsMade + 1
    })

    const context = runtimeService.getScanContext(scanId)
    if (!context) {
      console.warn(`[scan.module] [${scanId}] [${sModule}] Context missing — scan expired`)
      return { eStatus: MODULE_STATUS.FAILED, sError: 'Scan context expired' }
    }

    runtimeService.markModuleRunning(scanId, sModule)
    log(scanId, sModule, 'Status → running')

    const scanFn = getScanner(sModule)
    if (!scanFn) {
      log(scanId, sModule, 'Scanner not registered — failing')
    } else {
      log(scanId, sModule, 'Scanner invoked')
    }

    const result = await runScanner({ sModule, sUrl, scanId, scanFn })
    const elapsedMs = Date.now() - startedAt

    runtimeService.completeModule(scanId, sModule, {
      eStatus: result.eStatus,
      oResult: result.oResult,
      sError: result.sError,
      nScore: result.nScore
    })

    const ctx = runtimeService.getScanContext(scanId)
    log(scanId, sModule, 'Finished', {
      eStatus: result.eStatus,
      nScore: result.nScore,
      elapsedMs,
      sError: result.sError || null,
      scanProgress: ctx?.nProgress ?? null,
      scanStatus: ctx?.eStatus ?? null
    })

    return {
      scanId,
      sModule,
      eStatus: result.eStatus,
      elapsedMs
    }
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    handleCatchError(error)
    console.error(
      `[scan.module] [${scanId}] [${sModule}] Unexpected error after ${elapsedMs}ms:`,
      error?.message
    )
    try {
      runtimeService.completeModule(scanId, sModule, {
        eStatus: MODULE_STATUS.FAILED,
        oResult: null,
        sError: error?.message || 'Unexpected module worker error',
        nScore: null
      })
    } catch (inner) {
      handleCatchError(inner)
    }
    return {
      scanId,
      sModule,
      eStatus: MODULE_STATUS.FAILED,
      sError: error?.message || 'Unexpected module worker error',
      elapsedMs
    }
  }
}

const config = require('../../../config/config')
const { MODULE_STATUS } = require('../constants')

const createTimeoutError = (timeoutMs) => {
  const error = new Error(`Scanner timed out after ${timeoutMs}ms`)
  error.code = 'SCAN_TIMEOUT'
  return error
}

const withTimeout = (promise, timeoutMs) => {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer))
}

/**
 * Run a scanner with input validation and timeout isolation.
 * Failures never crash the process — returns a structured envelope.
 */
const runScanner = async ({ sModule, sUrl, scanId = null, scanFn }) => {
  const tag = `[scanner] [${scanId || 'no-scan'}] [${sModule || 'unknown'}]`

  if (!sModule || typeof sModule !== 'string') {
    console.warn(`${tag} Invalid module name`)
    return {
      sModule: sModule || 'unknown',
      eStatus: MODULE_STATUS.FAILED,
      oResult: null,
      sError: 'Invalid module name',
      nScore: null
    }
  }

  if (!sUrl || typeof sUrl !== 'string') {
    console.warn(`${tag} Invalid scan URL`)
    return {
      sModule,
      eStatus: MODULE_STATUS.FAILED,
      oResult: null,
      sError: 'Invalid scan URL',
      nScore: null
    }
  }

  if (typeof scanFn !== 'function') {
    console.warn(`${tag} Not registered`)
    return {
      sModule,
      eStatus: MODULE_STATUS.FAILED,
      oResult: null,
      sError: 'Scanner not registered',
      nScore: null
    }
  }

  const timeoutMs = Number(config.SCAN_MODULE_TIMEOUT_MS) || 30000
  const startedAt = Date.now()

  console.log(`${tag} Start`, { sUrl, timeoutMs })

  try {
    const oResult = await withTimeout(
      Promise.resolve(scanFn({ sUrl, sModule, scanId })),
      timeoutMs
    )
    const elapsedMs = Date.now() - startedAt
    const nScore = typeof oResult?.nScore === 'number' ? oResult.nScore : null
    const isStub = Boolean(oResult?.oMeta?.bStub)

    console.log(`${tag} Completed`, {
      elapsedMs,
      nScore,
      grade: oResult?.grade ?? null,
      findings: Array.isArray(oResult?.findings) ? oResult.findings.length : null,
      stub: isStub
    })

    return {
      sModule,
      eStatus: MODULE_STATUS.COMPLETED,
      oResult: oResult || {
        sModule,
        eStatus: MODULE_STATUS.COMPLETED,
        oFindings: [],
        oMeta: { bStub: true },
        nScore: null
      },
      sError: null,
      nScore
    }
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    const isTimeout = error?.code === 'SCAN_TIMEOUT'
    const eStatus = isTimeout ? MODULE_STATUS.TIMEOUT : MODULE_STATUS.FAILED

    console.error(`${tag} ${isTimeout ? 'Timeout' : 'Failed'}`, {
      elapsedMs,
      timeoutMs,
      code: error?.code || null,
      message: error?.message || 'Scanner failed'
    })

    return {
      sModule,
      eStatus,
      oResult: null,
      sError: error?.message || 'Scanner failed',
      nScore: null
    }
  }
}

module.exports = {
  runScanner,
  withTimeout
}

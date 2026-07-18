const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES } = require('./constants')
const { fetchUrl, mapHttpError } = require('./http.client')
const { analyzeHeaders } = require('./analyzer')
const { calculateHeaderScore } = require('./scoring')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[header-scanner] ${message}${suffix}`)
}

const createFailedResult = ({ sError, errorCode, finalUrl = null }) => ({
  module: 'header',
  sModule: 'header',
  eStatus: MODULE_STATUS.FAILED,
  score: 0,
  nScore: 0,
  grade: 'F',
  risk: 'high',
  redirects: [],
  finalUrl,
  responseTime: 0,
  statusCode: null,
  headers: {},
  findings: [{
    header: 'request',
    code: errorCode || ERROR_CODES.UNKNOWN,
    severity: 'high',
    message: sError || 'Header scan failed'
  }],
  recommendations: [],
  oMeta: { bStub: false },
  sError,
  errorCode
})

/**
 * Orchestrate header scan: one HTTP GET → analyze → score → DTO.
 * Network failures throw structured errors for base.scanner.
 * HTTP 4xx/5xx with a response are analyzed normally.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').HeaderScanResult>}
 */
const runHeaderScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  const targetUrl = validated.sUrl
  let fetchResult

  try {
    log('Request Started', { url: targetUrl })
    fetchResult = await fetchUrl(targetUrl)
    log('Response Received', {
      statusCode: fetchResult.statusCode,
      finalUrl: fetchResult.finalUrl,
      responseTime: fetchResult.responseTime
    })
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : mapped.code
    err.errorCode = mapped.code
    throw err
  }

  const { headers, findings, recommendations } = analyzeHeaders(fetchResult.headers)
  const { score, grade, risk } = calculateHeaderScore(headers)

  // Surface notable HTTP statuses as findings without failing the module
  if (fetchResult.statusCode === 429 || fetchResult.statusCode === 403 || fetchResult.statusCode >= 500) {
    findings.push({
      header: 'http-status',
      code: `HTTP_${fetchResult.statusCode}`,
      severity: fetchResult.statusCode >= 500 ? 'high' : 'medium',
      message: `Target responded with HTTP ${fetchResult.statusCode}`
    })
  }

  log('Analysis Completed', { score, grade, risk, findings: findings.length })

  const result = {
    module: 'header',
    sModule: 'header',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    redirects: fetchResult.redirects,
    finalUrl: fetchResult.finalUrl,
    responseTime: fetchResult.responseTime,
    statusCode: fetchResult.statusCode,
    headers,
    findings,
    recommendations,
    oMeta: { bStub: false }
  }

  log('Worker Finished', { finalUrl: result.finalUrl, score: result.score })
  return result
}

module.exports = {
  runHeaderScan,
  createFailedResult
}

const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES } = require('./constants')
const { fetchHomepage, mapHttpError } = require('./http.client')
const { detectTechnologies } = require('./detector')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[technology-scanner] ${message}${suffix}`)
}

/**
 * Informational technology detection — always score/nScore null.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').TechnologyScanResult>}
 */
const runTechnologyScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  log('Request Started', { url: validated.sUrl })

  let page
  try {
    page = await fetchHomepage(validated.sUrl)
    log('Response Received', {
      statusCode: page.statusCode,
      finalUrl: page.finalUrl,
      htmlBytes: Buffer.byteLength(page.html || '', 'utf8'),
      responseTime: page.responseTime
    })
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : mapped.code
    err.errorCode = mapped.code
    throw err
  }

  const detected = detectTechnologies({
    headerText: page.headerText,
    html: page.html
  })

  log('Analysis Completed', { total: detected.summary.total })

  const result = {
    module: 'technology',
    sModule: 'technology',
    eStatus: MODULE_STATUS.COMPLETED,
    score: null,
    nScore: null,
    summary: detected.summary,
    frontend: detected.frontend,
    backend: detected.backend,
    cms: detected.cms,
    server: detected.server,
    cdn: detected.cdn,
    analytics: detected.analytics,
    libraries: detected.libraries,
    hosting: detected.hosting,
    findings: detected.findings,
    oMeta: {
      bStub: false,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseTime: page.responseTime
    }
  }

  log('Worker Finished', { total: detected.summary.total })
  return result
}

module.exports = {
  runTechnologyScan
}

const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES } = require('./constants')
const { fetchHomepage, downloadResource, mapHttpError, mapPool, getConcurrency } = require('./downloader.service')
const { collectResources } = require('./resource.collector')
const { analyzeSecrets } = require('./analyzers')
const { calculateSecretScore, buildSummary } = require('./scoring.service')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[secret-scanner] ${message}${suffix}`)
}

/**
 * Passive secret scan of public homepage-linked resources.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').SecretScanResult>}
 */
const runSecretScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  log('Request Started', { url: validated.sUrl })

  let homepage
  try {
    homepage = await fetchHomepage(validated.sUrl)
    log('Response Received', {
      statusCode: homepage.statusCode,
      finalUrl: homepage.finalUrl
    })
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : mapped.code
    err.errorCode = mapped.code
    throw err
  }

  const collected = collectResources(homepage.body, homepage.finalUrl)
  log('Resources Collected', {
    linked: collected.resources.length,
    inlines: collected.inlines.length
  })

  const allFindings = []

  // Homepage HTML
  allFindings.push(...analyzeSecrets(homepage.body, homepage.finalUrl))

  // Inline scripts
  for (const inline of collected.inlines) {
    allFindings.push(...analyzeSecrets(inline.body, inline.url))
  }

  // Download linked resources concurrently
  const concurrency = getConcurrency()
  const downloads = await mapPool(collected.resources, concurrency, async (resource) => {
    return downloadResource(resource.url)
  })

  let scannedResources = 1 + collected.inlines.length
  for (const file of downloads) {
    if (!file || file.skipped || !file.ok || !file.body) continue
    scannedResources += 1
    allFindings.push(...analyzeSecrets(file.body, file.url))
  }

  const findings = allFindings
  const { score, grade, risk } = calculateSecretScore(findings)
  const summary = buildSummary(findings)

  log('Analysis Completed', {
    findings: findings.length,
    score,
    grade,
    scannedResources
  })

  const result = {
    module: 'secret',
    sModule: 'secret',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    summary,
    findings,
    oMeta: {
      bStub: false,
      finalUrl: homepage.finalUrl,
      scannedResources,
      linkedResources: collected.resources.length,
      concurrency
    }
  }

  log('Worker Finished', { score, findings: findings.length })
  return result
}

module.exports = {
  runSecretScan
}

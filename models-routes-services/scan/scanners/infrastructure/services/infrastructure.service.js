const { normalizeAndValidateUrl } = require('../../../engine/validation.service')
const { MODULE_STATUS } = require('../../../constants')
const { ERROR_CODES, SOURCE_MODULES } = require('../constants')
const { getSiblingResults } = require('../../../engine/siblingResults.service')
const { detectProviders } = require('./provider.service')
const {
  fallbackResolveAddresses,
  fallbackFetchHeaders
} = require('./network.service')
const {
  calculateInfrastructureScore,
  buildRecommendations
} = require('./scoring.service')
const { flattenHeaders } = require('../utils/headers')
const {
  analyzeHosting,
  analyzeCloud,
  analyzeCdn,
  analyzeServer,
  analyzeNetwork,
  analyzeEmail
} = require('../analyzers')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[infrastructure-scanner] ${message}${suffix}`)
}

/**
 * Passive infrastructure discovery — reuses sibling ScanContext results.
 * @param {{ sUrl: string, scanId?: string|null }} params
 * @returns {Promise<import('../types').InfraScanResult>}
 */
const runInfrastructureScan = async ({ sUrl, scanId = null }) => {
  log('Scan Started', { sUrl, scanId })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  const hostname = new URL(validated.sUrl).hostname.toLowerCase()

  // 1) Collect existing scanner outputs (wait for parallel siblings)
  let collected
  try {
    collected = await getSiblingResults(scanId, SOURCE_MODULES)
    log('Sources Collected', {
      available: collected.available,
      statuses: collected.statuses
    })
  } catch (error) {
    log('Sibling results read failed', { message: error?.message })
    collected = {
      sources: {
        header: null,
        ssl: null,
        dns: null,
        technology: null,
        performance: null
      },
      statuses: {},
      waitedMs: 0,
      available: []
    }
  }

  const { header, ssl, dns, technology, performance } = collected.sources

  // 2) Minimal fallbacks only when required
  let fallbackHttp = null
  let fallbackA = []
  let fallbackAAAA = []

  // Header scanner omits CDN-specific headers (cf-ray, etc.). Fetch once when
  // technology CDN signals are also missing, or when header result is absent.
  if (!header || !technology) {
    log('Fallback/enrichment HTTP headers fetch')
    try {
      fallbackHttp = await fallbackFetchHeaders(validated.sUrl)
    } catch (error) {
      log('Fallback HTTP soft-failed', { message: error?.message })
    }
  }

  if (!dns) {
    log('Fallback DNS A/AAAA resolve')
    try {
      const resolved = await fallbackResolveAddresses(hostname)
      fallbackA = resolved.A || []
      fallbackAAAA = resolved.AAAA || []
    } catch (error) {
      log('Fallback DNS soft-failed', { message: error?.message })
    }
  }

  const headers = flattenHeaders(header, fallbackHttp?.headers || null)

  // Also fold performance compression encoding into header map if missing
  if (!headers['content-encoding'] && performance?.compression?.contentEncoding) {
    headers['content-encoding'] = performance.compression.contentEncoding
  }

  // 3) Provider detection
  const providers = detectProviders({ headers, technology, dns })

  // 4) Analyzers
  const findings = []

  const networkResult = analyzeNetwork({
    hostname,
    dns,
    header,
    ssl,
    performance,
    fallbackHttp,
    fallbackA,
    fallbackAAAA,
    headers
  })
  // Fix https using validated URL scheme when ambiguous
  if (!networkResult.network.httpsEnabled && validated.sUrl.startsWith('https:')) {
    networkResult.network.httpsEnabled = true
    networkResult.httpsScoreRatio = Math.max(networkResult.httpsScoreRatio, 0.7)
  }
  findings.push(...networkResult.findings)

  const serverResult = analyzeServer(headers, technology, providers.proxies)
  findings.push(...serverResult.findings)

  const cdnResult = analyzeCdn(providers.cdn)
  findings.push(...cdnResult.findings)

  const cloudResult = analyzeCloud(providers.cloud)
  findings.push(...cloudResult.findings)

  const hostingResult = analyzeHosting({
    hostingList: providers.hosting,
    proxyList: providers.proxies,
    primaryCdn: providers.primaryCdn?.name || null,
    primaryCloud: providers.primaryCloud?.name || null
  })
  findings.push(...hostingResult.findings)

  const emailResult = analyzeEmail(dns)
  findings.push(...emailResult.findings)

  const { score, grade, risk, breakdown } = calculateInfrastructureScore({
    https: networkResult.httpsScoreRatio,
    cdn: cdnResult.scoreRatio,
    securityHeaders: serverResult.securityScoreRatio,
    emailSecurity: emailResult.scoreRatio,
    ipv6: networkResult.ipv6ScoreRatio,
    hostingBestPractices: hostingResult.scoreRatio
  })

  const recommendations = buildRecommendations(findings)

  log('Analysis Completed', {
    score,
    grade,
    risk,
    findings: findings.length,
    cdn: providers.primaryCdn?.name || null,
    cloud: providers.primaryCloud?.name || null
  })

  const result = {
    module: 'infrastructure',
    sModule: 'infrastructure',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    hosting: hostingResult.hosting,
    network: networkResult.network,
    server: serverResult.server,
    email: emailResult.email,
    cdn: cdnResult.cdn,
    cloud: cloudResult.cloud,
    findings,
    recommendations,
    oMeta: {
      bStub: false,
      scanId,
      sourcesUsed: collected.available,
      sourceStatuses: collected.statuses,
      waitedMs: collected.waitedMs,
      usedFallbackHttp: Boolean(fallbackHttp?.ok),
      usedFallbackDns: !dns && (fallbackA.length > 0 || fallbackAAAA.length > 0),
      scoreBreakdown: breakdown
    }
  }

  log('Worker Finished', { score, findings: findings.length })
  return result
}

module.exports = {
  runInfrastructureScan
}

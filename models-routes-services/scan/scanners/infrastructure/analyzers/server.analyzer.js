const { SECURITY_HEADER_KEYS } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { getHeader } = require('../utils/headers')

/**
 * Infer OS best-effort from Server / powered-by strings.
 * @param {string|null} server
 * @param {string|null} poweredBy
 */
const inferOs = (server, poweredBy) => {
  const blob = `${server || ''} ${poweredBy || ''}`.toLowerCase()
  if (/windows|iis|microsoft/i.test(blob)) return { os: 'Windows', confidence: 70 }
  if (/ubuntu|debian|centos|red hat|linux|unix/i.test(blob)) return { os: 'Linux', confidence: 55 }
  return { os: null, confidence: 0 }
}

/**
 * @param {Record<string, string>} headers
 * @param {Object|null} technology
 * @param {Array} proxyList
 */
const analyzeServer = (headers = {}, technology = null, proxyList = []) => {
  const findings = []
  const serverHeader = getHeader(headers, 'server')
  const poweredBy = getHeader(headers, 'x-powered-by')
  const cacheControl = getHeader(headers, 'cache-control')
  const via = getHeader(headers, 'via')
  const cfCache = getHeader(headers, 'cf-cache-status')
  const xCache = getHeader(headers, 'x-cache')

  const techServers = (technology?.server || []).map((s) => s.name)
  const applicationServer =
    techServers[0] ||
    (poweredBy ? poweredBy.split(/[\/\s]/)[0] : null) ||
    null

  const { os, confidence: osConfidence } = inferOs(serverHeader, poweredBy)

  const securityPresent = SECURITY_HEADER_KEYS.filter((key) => {
    const v = getHeader(headers, key)
    return Boolean(v)
  })
  const securityMissing = SECURITY_HEADER_KEYS.filter((key) => !getHeader(headers, key))

  if (!serverHeader) {
    findings.push(makeFinding({
      title: 'Server software hidden',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'No Server header was exposed (good hygiene) or it was not captured.',
      recommendation: 'Continue omitting or genericizing the Server header.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Server header exposed',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `Server: ${serverHeader}`,
      recommendation: 'Omit or generalize the Server header to reduce fingerprinting.'
    }))
  }

  if (poweredBy) {
    findings.push(makeFinding({
      title: 'X-Powered-By exposed',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `X-Powered-By: ${poweredBy}`,
      recommendation: 'Remove the X-Powered-By header.'
    }))
  }

  const cacheLayer = Boolean(cfCache || xCache || /cache|varnish|cloudflare|fastly/i.test(via || ''))
  if (cacheLayer) {
    findings.push(makeFinding({
      title: 'Cache layer detected',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: `Cache signals: ${[cfCache, xCache, via].filter(Boolean).join(' | ') || 'present'}.`,
      recommendation: 'No action required.'
    }))
  }

  const reverseProxy = proxyList.length > 0 || /cloudflare|nginx|varnish|envoy|trafficserver/i.test(
    `${serverHeader || ''} ${via || ''}`
  )
  if (reverseProxy) {
    findings.push(makeFinding({
      title: 'Reverse proxy present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'Response headers indicate a reverse proxy or edge layer.',
      recommendation: 'No action required.'
    }))
  }

  const securityRatio = securityPresent.length / SECURITY_HEADER_KEYS.length
  if (securityRatio >= 0.7) {
    findings.push(makeFinding({
      title: 'Security headers largely present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `${securityPresent.length}/${SECURITY_HEADER_KEYS.length} key security headers found.`,
      recommendation: 'No action required.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Security headers incomplete',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Missing: ${securityMissing.join(', ') || 'several'}.`,
      recommendation: 'Add HSTS, CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.'
    }))
  }

  return {
    server: {
      serverHeader: serverHeader || null,
      poweredBy: poweredBy || null,
      applicationServer,
      operatingSystem: os,
      osConfidence,
      software: techServers,
      cacheLayer,
      cacheControl: cacheControl || null,
      reverseProxy,
      securityHeaders: {
        present: securityPresent,
        missing: securityMissing,
        score: Math.round(securityRatio * 100)
      }
    },
    findings,
    securityScoreRatio: securityRatio
  }
}

module.exports = {
  analyzeServer
}

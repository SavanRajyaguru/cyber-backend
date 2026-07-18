const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity } = require('../utils/finding')

const get = (headers, label) => headers?.[label] || null

/**
 * Correlate header-scanner output into threat findings.
 * @param {Object|null} header
 * @returns {import('../types').ThreatFinding[]}
 */
const applyHeadersRule = (header) => {
  if (!header || header.oMeta?.bStub) return []

  const findings = []
  const headers = header.headers || {}

  const hsts = get(headers, 'Strict-Transport-Security')
  if (!hsts?.present) {
    findings.push(makeThreatFinding({
      title: 'Missing HSTS',
      category: THREAT_CATEGORIES.HSTS,
      severity: SEVERITY.HIGH,
      confidence: 95,
      affectedModule: 'header',
      description: 'Strict-Transport-Security is not set, enabling SSL-stripping / downgrade risk.',
      recommendation: 'Enable HSTS with a long max-age and includeSubDomains where appropriate.'
    }))
  }

  const csp = get(headers, 'Content-Security-Policy')
  if (!csp?.present) {
    findings.push(makeThreatFinding({
      title: 'Missing CSP',
      category: THREAT_CATEGORIES.CSP,
      severity: SEVERITY.HIGH,
      confidence: 95,
      affectedModule: 'header',
      description: 'Content-Security-Policy is absent, increasing XSS impact risk.',
      recommendation: 'Deploy a restrictive Content-Security-Policy.'
    }))
  } else if (csp.status === 'warn' || /unsafe-inline|unsafe-eval/i.test(csp.value || '')) {
    findings.push(makeThreatFinding({
      title: 'Weak Content-Security-Policy',
      category: THREAT_CATEGORIES.CSP,
      severity: SEVERITY.MEDIUM,
      confidence: 85,
      affectedModule: 'header',
      description: 'CSP is present but allows unsafe-inline or unsafe-eval.',
      recommendation: 'Tighten CSP by removing unsafe-inline/unsafe-eval.'
    }))
  }

  const acao = get(headers, 'Access-Control-Allow-Origin')
  if (acao?.present && (acao.value === '*' || acao.status === 'bad' || acao.status === 'warn')) {
    findings.push(makeThreatFinding({
      title: 'Weak CORS configuration',
      category: THREAT_CATEGORIES.CORS,
      severity: SEVERITY.HIGH,
      confidence: 90,
      affectedModule: 'header',
      description: `Access-Control-Allow-Origin is permissive: ${acao.value}`,
      recommendation: 'Restrict CORS to trusted origins; avoid wildcard with credentials.'
    }))
  }

  const referrer = get(headers, 'Referrer-Policy')
  if (!referrer?.present || referrer.status === 'bad' || referrer.status === 'warn') {
    findings.push(makeThreatFinding({
      title: 'Weak or missing Referrer-Policy',
      category: THREAT_CATEGORIES.REFERRER_POLICY,
      severity: SEVERITY.MEDIUM,
      confidence: 85,
      affectedModule: 'header',
      description: referrer?.present
        ? `Referrer-Policy may leak sensitive URLs: ${referrer.value}`
        : 'Referrer-Policy header is missing.',
      recommendation: 'Set Referrer-Policy to strict-origin-when-cross-origin or stricter.'
    }))
  }

  const permissions = get(headers, 'Permissions-Policy')
  if (!permissions?.present) {
    findings.push(makeThreatFinding({
      title: 'Missing Permissions-Policy',
      category: THREAT_CATEGORIES.PERMISSIONS_POLICY,
      severity: SEVERITY.LOW,
      confidence: 80,
      affectedModule: 'header',
      description: 'Permissions-Policy is not set to limit powerful browser features.',
      recommendation: 'Add a Permissions-Policy denying unused features (camera, mic, geolocation, etc.).'
    }))
  }

  const server = get(headers, 'Server')
  if (server?.present) {
    findings.push(makeThreatFinding({
      title: 'Server software disclosure',
      category: THREAT_CATEGORIES.SERVER_DISCLOSURE,
      severity: SEVERITY.LOW,
      confidence: 90,
      affectedModule: 'header',
      description: `Server header exposes: ${server.value}`,
      recommendation: 'Omit or genericize the Server header.'
    }))
  }

  const powered = get(headers, 'X-Powered-By')
  if (powered?.present) {
    findings.push(makeThreatFinding({
      title: 'Framework / runtime disclosure',
      category: THREAT_CATEGORIES.FRAMEWORK_DISCLOSURE,
      severity: SEVERITY.MEDIUM,
      confidence: 92,
      affectedModule: 'header',
      description: `X-Powered-By exposes: ${powered.value}`,
      recommendation: 'Remove the X-Powered-By header.'
    }))
  }

  const xfo = get(headers, 'X-Frame-Options')
  const xcto = get(headers, 'X-Content-Type-Options')
  if (!xfo?.present) {
    findings.push(makeThreatFinding({
      title: 'Missing X-Frame-Options',
      category: THREAT_CATEGORIES.SECURITY_HEADERS,
      severity: SEVERITY.MEDIUM,
      confidence: 90,
      affectedModule: 'header',
      description: 'Clickjacking protections are not declared via X-Frame-Options (or frame-ancestors in CSP).',
      recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN, or use CSP frame-ancestors.'
    }))
  }
  if (!xcto?.present) {
    findings.push(makeThreatFinding({
      title: 'Missing X-Content-Type-Options',
      category: THREAT_CATEGORIES.SECURITY_HEADERS,
      severity: SEVERITY.MEDIUM,
      confidence: 90,
      affectedModule: 'header',
      description: 'MIME-sniffing protection header is absent.',
      recommendation: 'Set X-Content-Type-Options: nosniff.'
    }))
  }

  // Surface remaining high/medium header findings not already covered
  for (const f of header.findings || []) {
    const sev = normalizeSeverity(f.severity)
    if (sev !== SEVERITY.HIGH && sev !== SEVERITY.MEDIUM) continue
    const title = f.message || f.code || 'Header security issue'
    if (findings.some((x) => x.description.includes(String(f.message || '')) || x.title === title)) {
      continue
    }
    if (/hsts|csp|cors|referrer|permissions|server|powered|frame|content-type/i.test(String(f.header || f.code || ''))) {
      continue
    }
    findings.push(makeThreatFinding({
      title: String(title).slice(0, 120),
      category: THREAT_CATEGORIES.SECURITY_HEADERS,
      severity: sev,
      confidence: 75,
      affectedModule: 'header',
      description: `${f.header || 'header'}: ${f.message || f.code || 'issue detected'}`,
      recommendation: f.message || 'Review and harden security headers.'
    }))
  }

  return findings
}

module.exports = {
  name: 'headers',
  sourceModule: 'header',
  apply: applyHeadersRule
}

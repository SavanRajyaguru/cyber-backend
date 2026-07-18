const { CONTROL_STATUS } = require('../constants')

/**
 * Shared pass/fail helpers used by framework rules.
 * Keeps mapping logic DRY across frameworks.
 */

const hasSource = (sources, moduleName) => Boolean(sources?.[moduleName])

const naIfMissing = (sources, moduleName) =>
  hasSource(sources, moduleName) ? null : CONTROL_STATUS.NOT_APPLICABLE

/**
 * Header analysis entry by display label.
 * @param {Object} sources
 * @param {string} label
 */
const headerAnalysis = (sources, label) =>
  sources?.header?.headers?.[label] || null

const headerPresent = (sources, label) =>
  Boolean(headerAnalysis(sources, label)?.present)

/**
 * Fail if header missing; N/A if header module missing; pass if present.
 */
const requireHeader = (sources, label) => {
  const missing = naIfMissing(sources, 'header')
  if (missing) return missing
  return headerPresent(sources, label) ? CONTROL_STATUS.PASS : CONTROL_STATUS.FAIL
}

/**
 * Fail if header present (disclosure); pass if absent.
 */
const requireHeaderAbsent = (sources, label) => {
  const missing = naIfMissing(sources, 'header')
  if (missing) return missing
  return headerPresent(sources, label) ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
}

/**
 * Match normalized findings by module + title/category regex.
 * @param {import('../types').NormalizedFinding[]} findings
 * @param {Object} opts
 */
const findEvidence = (findings = [], opts = {}) => {
  const moduleName = opts.module
  const titleRe = opts.titleRe
  const categoryRe = opts.categoryRe
  const statusIn = opts.statusIn

  return findings.find((f) => {
    if (moduleName && f.module !== moduleName) return false
    if (statusIn && !statusIn.includes(String(f.status).toLowerCase())) return false
    if (titleRe && !titleRe.test(f.title || '')) return false
    if (categoryRe && !categoryRe.test(f.category || '')) return false
    return true
  }) || null
}

/**
 * Fail when a negative finding exists; pass when source present and no match.
 */
const failOnFinding = (sources, findings, { module, titleRe, categoryRe, requireSource = true }) => {
  if (requireSource) {
    const missing = naIfMissing(sources, module)
    if (missing) return { status: missing, evidence: null }
  }
  const hit = findEvidence(findings, {
    module,
    titleRe,
    categoryRe,
    statusIn: ['fail', 'warn', 'critical', 'high', 'medium']
  })
  if (hit) {
    return {
      status: CONTROL_STATUS.FAIL,
      evidence: hit.evidence || hit.title
    }
  }
  // Also treat explicit fail-like titles without status filter for threat findings
  const any = findEvidence(findings, { module, titleRe, categoryRe })
  if (any && /fail|missing|weak|exposed|critical/i.test(`${any.title} ${any.status}`)) {
    return { status: CONTROL_STATUS.FAIL, evidence: any.evidence || any.title }
  }
  return { status: CONTROL_STATUS.PASS, evidence: null }
}

const sslTlsWeak = (sources) => {
  const missing = naIfMissing(sources, 'ssl')
  if (missing) return missing
  const tls = sources.ssl.tls || {}
  if (tls.weakProtocol || tls.supportsTls10 || tls.supportsTls11) {
    return CONTROL_STATUS.FAIL
  }
  return CONTROL_STATUS.PASS
}

const sslCertValid = (sources) => {
  const missing = naIfMissing(sources, 'ssl')
  if (missing) return missing
  const days = sources.ssl.certificate?.daysRemaining
  if (typeof days === 'number' && days < 0) return CONTROL_STATUS.FAIL
  return CONTROL_STATUS.PASS
}

const httpsEnabled = (sources) => {
  if (sources.ssl?.tls?.httpsEnabled === false) return CONTROL_STATUS.FAIL
  if (sources.infrastructure?.network?.httpsEnabled === false) return CONTROL_STATUS.FAIL
  if (sources.ssl || sources.infrastructure) return CONTROL_STATUS.PASS
  return CONTROL_STATUS.NOT_APPLICABLE
}

const spfPresent = (sources) => {
  const missing = naIfMissing(sources, 'dns')
  if (missing) return missing
  return sources.dns.records?.SPF?.exists ? CONTROL_STATUS.PASS : CONTROL_STATUS.FAIL
}

const dmarcPresent = (sources) => {
  const missing = naIfMissing(sources, 'dns')
  if (missing) return missing
  return sources.dns.records?.DMARC?.exists ? CONTROL_STATUS.PASS : CONTROL_STATUS.FAIL
}

const dmarcEnforcing = (sources) => {
  const missing = naIfMissing(sources, 'dns')
  if (missing) return missing
  const policy = sources.dns.records?.DMARC?.policy || ''
  if (!sources.dns.records?.DMARC?.exists) return CONTROL_STATUS.FAIL
  return /reject|quarantine/i.test(policy) ? CONTROL_STATUS.PASS : CONTROL_STATUS.FAIL
}

const noSecrets = (sources) => {
  const missing = naIfMissing(sources, 'secret')
  if (missing) return missing
  const list = sources.secret.findings || []
  const bad = list.filter((f) =>
    /critical|high|medium/i.test(String(f.severity || ''))
  )
  return bad.length ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
}

const caaPresent = (sources) => {
  const missing = naIfMissing(sources, 'dns')
  if (missing) return missing
  return (sources.dns.records?.CAA || []).length > 0
    ? CONTROL_STATUS.PASS
    : CONTROL_STATUS.FAIL
}

module.exports = {
  hasSource,
  naIfMissing,
  headerAnalysis,
  headerPresent,
  requireHeader,
  requireHeaderAbsent,
  findEvidence,
  failOnFinding,
  sslTlsWeak,
  sslCertValid,
  httpsEnabled,
  spfPresent,
  dmarcPresent,
  dmarcEnforcing,
  noSecrets,
  caaPresent,
  CONTROL_STATUS
}

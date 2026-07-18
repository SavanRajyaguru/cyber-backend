const {
  HEADER_NAMES,
  HEADER_LABELS,
  ANALYZED_HEADERS,
  STATUS,
  SEVERITY,
  MSG
} = require('./constants')

const getHeaderValue = (headers, name) => {
  const value = headers[name]
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

const analysis = (present, value, status, severity, recommendation) => ({
  present,
  value,
  status,
  severity,
  recommendation
})

const parseHstsMaxAge = (value) => {
  const match = /max-age\s*=\s*(\d+)/i.exec(value || '')
  return match ? Number(match[1]) : null
}

const analyzeHsts = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.HIGH, MSG.ENABLE_HSTS)
  }
  const maxAge = parseHstsMaxAge(value)
  if (maxAge !== null && maxAge < 15552000) {
    return analysis(true, value, STATUS.WARN, SEVERITY.MEDIUM, MSG.WEAK_HSTS)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeCsp = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.HIGH, MSG.ENABLE_CSP)
  }
  if (/unsafe-inline|unsafe-eval/i.test(value)) {
    return analysis(true, value, STATUS.WARN, SEVERITY.MEDIUM, 'CSP is present but allows unsafe-inline or unsafe-eval; tighten the policy.')
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeXfo = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.HIGH, MSG.ENABLE_XFO)
  }
  const normalized = value.toUpperCase()
  if (normalized.includes('DENY') || normalized.includes('SAMEORIGIN')) {
    return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
  }
  return analysis(true, value, STATUS.WARN, SEVERITY.MEDIUM, MSG.ENABLE_XFO)
}

const analyzeXcto = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.MEDIUM, MSG.ENABLE_XCTO)
  }
  if (value.toLowerCase().includes('nosniff')) {
    return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
  }
  return analysis(true, value, STATUS.WARN, SEVERITY.MEDIUM, MSG.WEAK_XCTO)
}

const analyzeReferrerPolicy = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.MEDIUM, MSG.ENABLE_REFERRER)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzePermissionsPolicy = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.MEDIUM, MSG.ENABLE_PERMISSIONS)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeCoop = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.MEDIUM, MSG.ENABLE_COOP)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeCorp = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.MEDIUM, MSG.ENABLE_CORP)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeCoep = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.BAD, SEVERITY.MEDIUM, MSG.ENABLE_COEP)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeAcao = (value, acacValue) => {
  if (!value) {
    return analysis(false, null, STATUS.INFO, SEVERITY.INFO, 'No CORS Access-Control-Allow-Origin header (typical for same-origin sites).')
  }
  if (value.trim() === '*') {
    if (acacValue && String(acacValue).toLowerCase() === 'true') {
      return analysis(true, value, STATUS.BAD, SEVERITY.HIGH, MSG.WILDCARD_CORS_CREDENTIALS)
    }
    return analysis(true, value, STATUS.BAD, SEVERITY.HIGH, MSG.WILDCARD_CORS)
  }
  return analysis(true, value, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
}

const analyzeAcac = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.INFO, SEVERITY.INFO, MSG.INFO_PRESENT)
  }
  return analysis(true, value, STATUS.INFO, SEVERITY.INFO, MSG.INFO_PRESENT)
}

const analyzeDisclosure = (value, removeMsg) => {
  if (!value) {
    return analysis(false, null, STATUS.GOOD, SEVERITY.LOW, MSG.NO_ACTION)
  }
  return analysis(true, value, STATUS.WARN, SEVERITY.MEDIUM, removeMsg)
}

const analyzeInfo = (value) => {
  if (!value) {
    return analysis(false, null, STATUS.INFO, SEVERITY.INFO, 'Header not present.')
  }
  return analysis(true, value, STATUS.INFO, SEVERITY.INFO, MSG.INFO_PRESENT)
}

/**
 * Analyze all tracked headers from a single response header map.
 * @param {Record<string, string>} responseHeaders
 */
const analyzeHeaders = (responseHeaders = {}) => {
  const headers = {}
  const findings = []
  const recommendations = []

  const acaoValue = getHeaderValue(responseHeaders, HEADER_NAMES.ACAO)
  const acacValue = getHeaderValue(responseHeaders, HEADER_NAMES.ACAC)

  const analyzers = {
    [HEADER_NAMES.HSTS]: () => analyzeHsts(getHeaderValue(responseHeaders, HEADER_NAMES.HSTS)),
    [HEADER_NAMES.CSP]: () => analyzeCsp(getHeaderValue(responseHeaders, HEADER_NAMES.CSP)),
    [HEADER_NAMES.XFO]: () => analyzeXfo(getHeaderValue(responseHeaders, HEADER_NAMES.XFO)),
    [HEADER_NAMES.XCTO]: () => analyzeXcto(getHeaderValue(responseHeaders, HEADER_NAMES.XCTO)),
    [HEADER_NAMES.REFERRER_POLICY]: () => analyzeReferrerPolicy(getHeaderValue(responseHeaders, HEADER_NAMES.REFERRER_POLICY)),
    [HEADER_NAMES.PERMISSIONS_POLICY]: () => analyzePermissionsPolicy(getHeaderValue(responseHeaders, HEADER_NAMES.PERMISSIONS_POLICY)),
    [HEADER_NAMES.CORP]: () => analyzeCorp(getHeaderValue(responseHeaders, HEADER_NAMES.CORP)),
    [HEADER_NAMES.COEP]: () => analyzeCoep(getHeaderValue(responseHeaders, HEADER_NAMES.COEP)),
    [HEADER_NAMES.COOP]: () => analyzeCoop(getHeaderValue(responseHeaders, HEADER_NAMES.COOP)),
    [HEADER_NAMES.ACAO]: () => analyzeAcao(acaoValue, acacValue),
    [HEADER_NAMES.ACAC]: () => analyzeAcac(acacValue),
    [HEADER_NAMES.SERVER]: () => analyzeDisclosure(getHeaderValue(responseHeaders, HEADER_NAMES.SERVER), MSG.REMOVE_SERVER),
    [HEADER_NAMES.X_POWERED_BY]: () => analyzeDisclosure(getHeaderValue(responseHeaders, HEADER_NAMES.X_POWERED_BY), MSG.REMOVE_X_POWERED_BY),
    [HEADER_NAMES.CACHE_CONTROL]: () => analyzeInfo(getHeaderValue(responseHeaders, HEADER_NAMES.CACHE_CONTROL)),
    [HEADER_NAMES.ETAG]: () => analyzeInfo(getHeaderValue(responseHeaders, HEADER_NAMES.ETAG)),
    [HEADER_NAMES.CONTENT_ENCODING]: () => analyzeInfo(getHeaderValue(responseHeaders, HEADER_NAMES.CONTENT_ENCODING)),
    [HEADER_NAMES.CONTENT_LENGTH]: () => analyzeInfo(getHeaderValue(responseHeaders, HEADER_NAMES.CONTENT_LENGTH)),
    [HEADER_NAMES.CONTENT_TYPE]: () => analyzeInfo(getHeaderValue(responseHeaders, HEADER_NAMES.CONTENT_TYPE))
  }

  for (const name of ANALYZED_HEADERS) {
    const label = HEADER_LABELS[name] || name
    const result = analyzers[name] ? analyzers[name]() : analyzeInfo(getHeaderValue(responseHeaders, name))
    headers[label] = result

    if (result.status === STATUS.BAD || result.status === STATUS.WARN) {
      const code = !result.present
        ? `MISSING_${label.replace(/-/g, '_').toUpperCase()}`
        : `ISSUE_${label.replace(/-/g, '_').toUpperCase()}`

      findings.push({
        header: label,
        code,
        severity: result.severity,
        message: result.recommendation
      })

      if (result.recommendation && result.recommendation !== MSG.NO_ACTION) {
        recommendations.push(result.recommendation)
      }
    }
  }

  return {
    headers,
    findings,
    recommendations: [...new Set(recommendations)]
  }
}

module.exports = {
  analyzeHeaders,
  getHeaderValue
}

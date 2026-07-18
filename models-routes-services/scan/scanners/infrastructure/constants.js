const ERROR_CODES = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  DNS_FAILURE: 'DNS_FAILURE',
  INVALID_URL: 'INVALID_URL',
  UNKNOWN: 'UNKNOWN'
})

const SEVERITY = Object.freeze({
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info'
})

const FINDING_STATUS = Object.freeze({
  FAIL: 'Fail',
  WARN: 'Warn',
  PASS: 'Pass',
  INFO: 'Info'
})

const SCORE_WEIGHTS = Object.freeze({
  HTTPS: 20,
  CDN: 15,
  SECURITY_HEADERS: 20,
  EMAIL_SECURITY: 20,
  IPV6: 10,
  HOSTING_BEST_PRACTICES: 15
})

/** Sibling modules whose outputs we reuse */
const SOURCE_MODULES = Object.freeze([
  'header',
  'ssl',
  'dns',
  'technology',
  'performance'
])

const DEFAULT_FALLBACK_TIMEOUT_MS = 10000
const DEFAULT_USER_AGENT = 'SolveBeatInfraScanner/1.0'

/** Security headers counted toward infrastructure scoring */
const SECURITY_HEADER_KEYS = Object.freeze([
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy'
])

module.exports = {
  ERROR_CODES,
  SEVERITY,
  FINDING_STATUS,
  SCORE_WEIGHTS,
  SOURCE_MODULES,
  DEFAULT_FALLBACK_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  SECURITY_HEADER_KEYS
}

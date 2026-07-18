const ERROR_CODES = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  NXDOMAIN: 'NXDOMAIN',
  SERVFAIL: 'SERVFAIL',
  DNS_UNAVAILABLE: 'DNS_UNAVAILABLE',
  INVALID_URL: 'INVALID_URL',
  INVALID_HOSTNAME: 'INVALID_HOSTNAME',
  UNKNOWN: 'UNKNOWN'
})

const SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  INFO: 'info'
})

const FINDING_STATUS = Object.freeze({
  FAIL: 'fail',
  WARN: 'warn',
  PASS: 'pass'
})

const SCORE_WEIGHTS = Object.freeze({
  SPF: 20,
  DMARC: 20,
  CAA: 15,
  MX: 15,
  IPV6: 10,
  TXT: 10,
  NS: 10
})

const DEFAULT_DNS_TIMEOUT_MS = 10000

const DKIM_SELECTORS = Object.freeze([
  'default',
  'google',
  'selector1',
  'selector2',
  'mail'
])

const RECORD_TYPES = Object.freeze([
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'NS',
  'TXT',
  'SOA',
  'CAA'
])

module.exports = {
  ERROR_CODES,
  SEVERITY,
  FINDING_STATUS,
  SCORE_WEIGHTS,
  DEFAULT_DNS_TIMEOUT_MS,
  DKIM_SELECTORS,
  RECORD_TYPES
}

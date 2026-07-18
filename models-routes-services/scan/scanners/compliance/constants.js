const ERROR_CODES = Object.freeze({
  INVALID_URL: 'INVALID_URL',
  UNKNOWN: 'UNKNOWN'
})

const CONTROL_STATUS = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
  NOT_APPLICABLE: 'not_applicable'
})

const SEVERITY = Object.freeze({
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info'
})

const FRAMEWORK_IDS = Object.freeze({
  OWASP_TOP10: 'OWASP Top 10',
  OWASP_ASVS: 'OWASP ASVS',
  CIS: 'CIS Controls',
  NIST: 'NIST CSF',
  PCI: 'PCI DSS',
  GDPR: 'GDPR',
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001'
})

/** Sibling modules consumed (includes threat). */
const SOURCE_MODULES = Object.freeze([
  'header',
  'ssl',
  'dns',
  'technology',
  'javascript',
  'secret',
  'seo',
  'performance',
  'infrastructure',
  'threat'
])

/** Fail severity → score penalty */
const FAIL_PENALTIES = Object.freeze({
  [SEVERITY.CRITICAL]: 25,
  [SEVERITY.HIGH]: 15,
  [SEVERITY.MEDIUM]: 10,
  [SEVERITY.LOW]: 5,
  [SEVERITY.INFO]: 2
})

module.exports = {
  ERROR_CODES,
  CONTROL_STATUS,
  SEVERITY,
  FRAMEWORK_IDS,
  SOURCE_MODULES,
  FAIL_PENALTIES
}

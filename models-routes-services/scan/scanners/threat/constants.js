const ERROR_CODES = Object.freeze({
  INVALID_URL: 'INVALID_URL',
  UNKNOWN: 'UNKNOWN'
})

const SEVERITY = Object.freeze({
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFORMATIONAL: 'Informational'
})

/** Penalty weights toward raw threat score (higher = more risk) */
const SEVERITY_WEIGHTS = Object.freeze({
  [SEVERITY.CRITICAL]: 40,
  [SEVERITY.HIGH]: 25,
  [SEVERITY.MEDIUM]: 15,
  [SEVERITY.LOW]: 10,
  [SEVERITY.INFORMATIONAL]: 0
})

const THREAT_CATEGORIES = Object.freeze({
  SECURITY_HEADERS: 'Security Headers',
  TLS: 'TLS Weaknesses',
  CERTIFICATE: 'Certificate Issues',
  DNS: 'Weak DNS Configuration',
  EMAIL: 'Missing Email Security',
  TECHNOLOGY: 'Technology Exposure',
  SERVER_DISCLOSURE: 'Server Disclosure',
  FRAMEWORK_DISCLOSURE: 'Framework Disclosure',
  SECRETS: 'Exposed Secrets',
  PUBLIC_TOKENS: 'Public Tokens',
  CORS: 'Weak CORS',
  CSP: 'Missing CSP',
  HSTS: 'Missing HSTS',
  REFERRER_POLICY: 'Weak Referrer Policy',
  PERMISSIONS_POLICY: 'Weak Permissions Policy',
  OUTDATED: 'Outdated Indicators',
  PERFORMANCE: 'Performance Risk Signals',
  SEO: 'SEO / Indexability Risk',
  INFRASTRUCTURE: 'Infrastructure Exposure',
  JAVASCRIPT: 'JavaScript Risk',
  EXTERNAL_INTEL: 'External Threat Intelligence'
})

/** Sibling modules consumed by the threat correlator */
const SOURCE_MODULES = Object.freeze([
  'header',
  'ssl',
  'dns',
  'technology',
  'javascript',
  'secret',
  'seo',
  'performance',
  'infrastructure'
])

const RISK_LEVELS = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFORMATIONAL: 'informational'
})

module.exports = {
  ERROR_CODES,
  SEVERITY,
  SEVERITY_WEIGHTS,
  THREAT_CATEGORIES,
  SOURCE_MODULES,
  RISK_LEVELS
}

const ERROR_CODES = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  REDIRECT_LOOP: 'REDIRECT_LOOP',
  DNS_FAILURE: 'DNS_FAILURE',
  SSL_FAILURE: 'SSL_FAILURE',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  INVALID_URL: 'INVALID_URL',
  UNKNOWN: 'UNKNOWN'
})

const SEVERITY = Object.freeze({
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info'
})

const DEFAULT_SECRET_TIMEOUT_MS = 15000
const DEFAULT_MAX_RESOURCES = 20
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024
const DEFAULT_CONCURRENCY = 5
const DEFAULT_USER_AGENT = 'SolveBeatSecretScanner/1.0'

const TEXT_CONTENT_TYPES = [
  'text/',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/manifest+json',
  'application/x-javascript'
]

module.exports = {
  ERROR_CODES,
  SEVERITY,
  DEFAULT_SECRET_TIMEOUT_MS,
  DEFAULT_MAX_RESOURCES,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_CONCURRENCY,
  DEFAULT_USER_AGENT,
  TEXT_CONTENT_TYPES
}

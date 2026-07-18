const HEADER_NAMES = Object.freeze({
  HSTS: 'strict-transport-security',
  CSP: 'content-security-policy',
  XFO: 'x-frame-options',
  XCTO: 'x-content-type-options',
  REFERRER_POLICY: 'referrer-policy',
  PERMISSIONS_POLICY: 'permissions-policy',
  CORP: 'cross-origin-resource-policy',
  COEP: 'cross-origin-embedder-policy',
  COOP: 'cross-origin-opener-policy',
  ACAO: 'access-control-allow-origin',
  ACAC: 'access-control-allow-credentials',
  SERVER: 'server',
  X_POWERED_BY: 'x-powered-by',
  CACHE_CONTROL: 'cache-control',
  ETAG: 'etag',
  CONTENT_ENCODING: 'content-encoding',
  CONTENT_LENGTH: 'content-length',
  CONTENT_TYPE: 'content-type'
})

/** Display names for reports */
const HEADER_LABELS = Object.freeze({
  [HEADER_NAMES.HSTS]: 'Strict-Transport-Security',
  [HEADER_NAMES.CSP]: 'Content-Security-Policy',
  [HEADER_NAMES.XFO]: 'X-Frame-Options',
  [HEADER_NAMES.XCTO]: 'X-Content-Type-Options',
  [HEADER_NAMES.REFERRER_POLICY]: 'Referrer-Policy',
  [HEADER_NAMES.PERMISSIONS_POLICY]: 'Permissions-Policy',
  [HEADER_NAMES.CORP]: 'Cross-Origin-Resource-Policy',
  [HEADER_NAMES.COEP]: 'Cross-Origin-Embedder-Policy',
  [HEADER_NAMES.COOP]: 'Cross-Origin-Opener-Policy',
  [HEADER_NAMES.ACAO]: 'Access-Control-Allow-Origin',
  [HEADER_NAMES.ACAC]: 'Access-Control-Allow-Credentials',
  [HEADER_NAMES.SERVER]: 'Server',
  [HEADER_NAMES.X_POWERED_BY]: 'X-Powered-By',
  [HEADER_NAMES.CACHE_CONTROL]: 'Cache-Control',
  [HEADER_NAMES.ETAG]: 'ETag',
  [HEADER_NAMES.CONTENT_ENCODING]: 'Content-Encoding',
  [HEADER_NAMES.CONTENT_LENGTH]: 'Content-Length',
  [HEADER_NAMES.CONTENT_TYPE]: 'Content-Type'
})

/** Ordered list of all headers to analyze */
const ANALYZED_HEADERS = Object.freeze(Object.values(HEADER_NAMES))

/** Scoring weights (security headers) — totals 100 */
const HEADER_WEIGHTS = Object.freeze({
  [HEADER_NAMES.HSTS]: 20,
  [HEADER_NAMES.CSP]: 20,
  [HEADER_NAMES.XFO]: 10,
  [HEADER_NAMES.XCTO]: 10,
  [HEADER_NAMES.REFERRER_POLICY]: 8,
  [HEADER_NAMES.PERMISSIONS_POLICY]: 8,
  [HEADER_NAMES.COOP]: 6,
  [HEADER_NAMES.CORP]: 6,
  [HEADER_NAMES.COEP]: 6,
  cors: 6
})

const DISCLOSURE_PENALTY = 5

const STATUS = Object.freeze({
  GOOD: 'good',
  WARN: 'warn',
  BAD: 'bad',
  INFO: 'info'
})

const SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  INFO: 'info'
})

const ERROR_CODES = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  REDIRECT_LOOP: 'REDIRECT_LOOP',
  DNS_FAILURE: 'DNS_FAILURE',
  SSL_FAILURE: 'SSL_FAILURE',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  HTTP_ERROR: 'HTTP_ERROR',
  INVALID_URL: 'INVALID_URL',
  UNKNOWN: 'UNKNOWN'
})

const DEFAULT_USER_AGENT = 'SolveBeatHeaderScanner/1.0'
const DEFAULT_MAX_REDIRECTS = 5
const DEFAULT_HTTP_TIMEOUT_MS = 15000

const MSG = Object.freeze({
  NO_ACTION: 'No action required',
  ENABLE_HSTS: 'Enable Strict-Transport-Security (HSTS) with a sufficient max-age.',
  ENABLE_CSP: 'Enable Content-Security-Policy to mitigate XSS and injection attacks.',
  ENABLE_XFO: 'Set X-Frame-Options (or CSP frame-ancestors) to prevent clickjacking.',
  ENABLE_XCTO: 'Set X-Content-Type-Options to nosniff.',
  ENABLE_REFERRER: 'Set a restrictive Referrer-Policy (e.g. strict-origin-when-cross-origin).',
  ENABLE_PERMISSIONS: 'Set Permissions-Policy to limit powerful browser features.',
  ENABLE_COOP: 'Set Cross-Origin-Opener-Policy (e.g. same-origin).',
  ENABLE_CORP: 'Set Cross-Origin-Resource-Policy (e.g. same-origin or same-site).',
  ENABLE_COEP: 'Set Cross-Origin-Embedder-Policy if cross-origin isolation is required.',
  WILDCARD_CORS: 'Avoid Access-Control-Allow-Origin: *. Restrict to trusted origins.',
  WILDCARD_CORS_CREDENTIALS: 'Do not combine Access-Control-Allow-Origin: * with credentials.',
  REMOVE_SERVER: 'Remove or obfuscate the Server header to reduce information disclosure.',
  REMOVE_X_POWERED_BY: 'Remove the X-Powered-By header to reduce technology disclosure.',
  WEAK_HSTS: 'HSTS is present but max-age is low; increase max-age (e.g. 31536000).',
  WEAK_XCTO: 'X-Content-Type-Options should be set to nosniff.',
  INFO_PRESENT: 'Informational header present.'
})

module.exports = {
  HEADER_NAMES,
  HEADER_LABELS,
  ANALYZED_HEADERS,
  HEADER_WEIGHTS,
  DISCLOSURE_PENALTY,
  STATUS,
  SEVERITY,
  ERROR_CODES,
  DEFAULT_USER_AGENT,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_HTTP_TIMEOUT_MS,
  MSG
}

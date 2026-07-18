const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_TECH_TIMEOUT_MS,
  DEFAULT_MAX_HTML_BYTES,
  DEFAULT_USER_AGENT
} = require('./constants')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

const getTimeoutMs = () =>
  Number(config.SCAN_TECH_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_TECH_TIMEOUT_MS

const getMaxHtmlBytes = () =>
  Number(config.SCAN_TECH_MAX_HTML_BYTES) || DEFAULT_MAX_HTML_BYTES

const getUserAgent = () =>
  config.SCAN_TECH_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

const getMaxRedirects = () =>
  Number(config.SCAN_HTTP_MAX_REDIRECTS) || 5

const client = axios.create({
  timeout: getTimeoutMs(),
  maxRedirects: getMaxRedirects(),
  decompress: true,
  responseType: 'text',
  maxContentLength: getMaxHtmlBytes(),
  maxBodyLength: getMaxHtmlBytes(),
  httpAgent,
  httpsAgent,
  validateStatus: () => true,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': getUserAgent()
  },
  transitional: { clarifyTimeoutError: true }
})

const normalizeHeaders = (raw = {}) => {
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    out[String(key).toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return out
}

/** Flat header string for regex matching (name: value lines) */
const headersToText = (headers) =>
  Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

const mapHttpError = (error) => {
  const code = error?.code
  const message = error?.message || 'HTTP request failed'

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return { code: ERROR_CODES.TIMEOUT, message: 'Request timed out' }
  }
  if (code === 'ERR_FR_TOO_MANY_REDIRECTS' || /max redirects/i.test(message)) {
    return { code: ERROR_CODES.REDIRECT_LOOP, message: 'Too many redirects' }
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code: ERROR_CODES.DNS_FAILURE, message: 'DNS lookup failed' }
  }
  if (/certificate|ssl|tls/i.test(message) || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return { code: ERROR_CODES.SSL_FAILURE, message: 'SSL/TLS connection failed' }
  }
  if (code === 'ECONNREFUSED') {
    return { code: ERROR_CODES.CONNECTION_REFUSED, message: 'Connection refused' }
  }
  if (/max content length|maxBodyLength/i.test(message)) {
    return { code: ERROR_CODES.INVALID_HTML, message: 'HTML response too large' }
  }
  return { code: ERROR_CODES.UNKNOWN, message }
}

/**
 * Single GET — returns headers + truncated HTML body.
 */
const fetchHomepage = async (url) => {
  const startedAt = Date.now()
  const maxBytes = getMaxHtmlBytes()

  const response = await client.get(url, {
    timeout: getTimeoutMs(),
    headers: { 'User-Agent': getUserAgent() }
  })

  const headers = normalizeHeaders(response.headers)
  let body = typeof response.data === 'string' ? response.data : String(response.data ?? '')
  if (Buffer.byteLength(body, 'utf8') > maxBytes) {
    body = Buffer.from(body, 'utf8').subarray(0, maxBytes).toString('utf8')
  }

  const finalUrl =
    response.request?.res?.responseUrl ||
    response.request?.responseURL ||
    response.config?.url ||
    url

  return {
    startUrl: url,
    finalUrl: String(finalUrl),
    statusCode: response.status,
    headers,
    headerText: headersToText(headers),
    html: body,
    responseTime: Date.now() - startedAt
  }
}

module.exports = {
  fetchHomepage,
  mapHttpError,
  normalizeHeaders,
  headersToText
}

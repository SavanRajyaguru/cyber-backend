const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('../../../../config/config')
const {
  DEFAULT_USER_AGENT,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_HTTP_TIMEOUT_MS,
  ERROR_CODES
} = require('./constants')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

const getTimeoutMs = () =>
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  Number(config.SCAN_MODULE_TIMEOUT_MS) ||
  DEFAULT_HTTP_TIMEOUT_MS

const getUserAgent = () => config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

const getMaxRedirects = () =>
  Number(config.SCAN_HTTP_MAX_REDIRECTS) || DEFAULT_MAX_REDIRECTS

const client = axios.create({
  timeout: getTimeoutMs(),
  maxRedirects: getMaxRedirects(),
  decompress: true,
  httpAgent,
  httpsAgent,
  validateStatus: () => true,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': getUserAgent()
  },
  transitional: {
    clarifyTimeoutError: true
  }
})

/**
 * Normalize axios response headers to a flat lowercase string map.
 * @param {import('axios').AxiosResponseHeaders|Object} raw
 * @returns {Record<string, string>}
 */
const normalizeHeaders = (raw = {}) => {
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    const name = String(key).toLowerCase()
    out[name] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return out
}

/**
 * Map axios/network errors to structured scanner error codes.
 * @param {any} error
 * @returns {{ code: string, message: string }}
 */
const mapHttpError = (error) => {
  const code = error?.code
  const message = error?.message || 'HTTP request failed'
  const status = error?.response?.status

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return { code: ERROR_CODES.TIMEOUT, message: 'Request timed out' }
  }
  if (code === 'ERR_FR_TOO_MANY_REDIRECTS' || /max redirects|redirect/i.test(message)) {
    return { code: ERROR_CODES.REDIRECT_LOOP, message: 'Too many redirects or redirect loop' }
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code: ERROR_CODES.DNS_FAILURE, message: 'DNS lookup failed' }
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    /certificate|ssl|tls/i.test(message)
  ) {
    return { code: ERROR_CODES.SSL_FAILURE, message: 'SSL/TLS connection failed' }
  }
  if (code === 'ECONNREFUSED') {
    return { code: ERROR_CODES.CONNECTION_REFUSED, message: 'Connection refused' }
  }
  if (status === 429 || status === 403 || status === 500 || (status >= 400 && status < 600)) {
    return { code: ERROR_CODES.HTTP_ERROR, message: `HTTP ${status}` }
  }
  return { code: ERROR_CODES.UNKNOWN, message }
}

/**
 * Single GET request with redirects; extracts timing and final URL.
 * @param {string} url
 * @returns {Promise<import('./types').HttpFetchResult>}
 */
const fetchUrl = async (url) => {
  const startUrl = url
  const startedAt = Date.now()
  const redirects = []

  const response = await client.get(url, {
    timeout: getTimeoutMs(),
    maxRedirects: getMaxRedirects(),
    headers: {
      'User-Agent': getUserAgent()
    },
    beforeRedirect: (options, responseDetails) => {
      const from = responseDetails?.headers?.location
        ? (redirects.length ? redirects[redirects.length - 1].to : startUrl)
        : startUrl
      const to = options?.href || options?.protocol + '//' + options?.hostname + (options?.path || '')
      redirects.push({
        from: typeof from === 'string' ? from : startUrl,
        to: String(to || ''),
        status: responseDetails?.statusCode ?? null
      })
    }
  })

  const responseTime = Date.now() - startedAt
  const finalUrl =
    response.request?.res?.responseUrl ||
    response.request?.responseURL ||
    response.config?.url ||
    startUrl

  if (!redirects.length && finalUrl && finalUrl !== startUrl) {
    redirects.push({ from: startUrl, to: finalUrl, status: null })
  }

  return {
    startUrl,
    finalUrl: String(finalUrl),
    statusCode: response.status,
    headers: normalizeHeaders(response.headers),
    responseTime,
    redirects
  }
}

module.exports = {
  client,
  fetchUrl,
  mapHttpError,
  normalizeHeaders
}

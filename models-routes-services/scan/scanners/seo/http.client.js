const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_SEO_TIMEOUT_MS,
  DEFAULT_MAX_HTML_BYTES,
  DEFAULT_CONCURRENCY,
  DEFAULT_USER_AGENT
} = require('./constants')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

const getTimeoutMs = () =>
  Number(config.SCAN_SEO_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_SEO_TIMEOUT_MS

const getMaxHtmlBytes = () =>
  Number(config.SCAN_SEO_MAX_HTML_BYTES) || DEFAULT_MAX_HTML_BYTES

const getConcurrency = () =>
  Number(config.SCAN_SEO_CONCURRENCY) || DEFAULT_CONCURRENCY

const getUserAgent = () =>
  config.SCAN_SEO_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

const getMaxRedirects = () => Number(config.SCAN_HTTP_MAX_REDIRECTS) || 5

const client = axios.create({
  timeout: getTimeoutMs(),
  maxRedirects: getMaxRedirects(),
  decompress: true,
  responseType: 'text',
  httpAgent,
  httpsAgent,
  validateStatus: () => true,
  headers: {
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': getUserAgent()
  },
  transitional: { clarifyTimeoutError: true }
})

const mapHttpError = (error) => {
  const code = error?.code
  const message = error?.message || 'HTTP request failed'
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return { code: ERROR_CODES.TIMEOUT, message: 'Request timed out' }
  }
  if (code === 'ERR_FR_TOO_MANY_REDIRECTS') {
    return { code: ERROR_CODES.REDIRECT_LOOP, message: 'Too many redirects' }
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code: ERROR_CODES.DNS_FAILURE, message: 'DNS lookup failed' }
  }
  if (/certificate|ssl|tls/i.test(message)) {
    return { code: ERROR_CODES.SSL_FAILURE, message: 'SSL/TLS failure' }
  }
  if (code === 'ECONNREFUSED') {
    return { code: ERROR_CODES.CONNECTION_REFUSED, message: 'Connection refused' }
  }
  return { code: ERROR_CODES.UNKNOWN, message }
}

const truncate = (text, maxBytes) => {
  if (!text) return ''
  const buf = Buffer.from(String(text), 'utf8')
  if (buf.length <= maxBytes) return String(text)
  return buf.subarray(0, maxBytes).toString('utf8')
}

/**
 * Single homepage GET. Throws on transport failure.
 * @param {string} url
 */
const fetchHomepage = async (url) => {
  const startedAt = Date.now()
  const response = await client.get(url, {
    timeout: getTimeoutMs(),
    maxContentLength: getMaxHtmlBytes(),
    maxBodyLength: getMaxHtmlBytes(),
    headers: {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'User-Agent': getUserAgent()
    }
  })

  const finalUrl =
    response.request?.res?.responseUrl ||
    response.request?.responseURL ||
    response.config?.url ||
    url

  const raw = typeof response.data === 'string' ? response.data : String(response.data || '')
  const truncated = Buffer.byteLength(raw, 'utf8') > getMaxHtmlBytes()

  return {
    finalUrl: String(finalUrl),
    statusCode: response.status,
    html: truncate(raw, getMaxHtmlBytes()),
    truncated,
    responseTime: Date.now() - startedAt,
    headers: response.headers || {}
  }
}

/**
 * HEAD (falls back to GET range-less) — never throws.
 * @param {string} url
 */
const checkUrl = async (url) => {
  const startedAt = Date.now()
  try {
    let response
    try {
      response = await client.head(url, {
        timeout: getTimeoutMs(),
        headers: { 'User-Agent': getUserAgent() }
      })
      // Some servers reject HEAD
      if (response.status === 405 || response.status === 501) {
        throw new Error('HEAD not allowed')
      }
    } catch {
      response = await client.get(url, {
        timeout: getTimeoutMs(),
        maxContentLength: 1024,
        maxBodyLength: 1024,
        headers: {
          'User-Agent': getUserAgent(),
          Range: 'bytes=0-0'
        }
      })
    }

    const ok = response.status >= 200 && response.status < 400
    return {
      url,
      ok,
      statusCode: response.status,
      responseTime: Date.now() - startedAt,
      error: ok ? null : `HTTP ${response.status}`
    }
  } catch (error) {
    const mapped = mapHttpError(error)
    return {
      url,
      ok: false,
      statusCode: error?.response?.status || null,
      responseTime: Date.now() - startedAt,
      error: mapped.message,
      errorCode: mapped.code
    }
  }
}

/**
 * Lightweight GET for robots.txt / sitemap — never throws.
 * @param {string} url
 */
const fetchTextResource = async (url) => {
  try {
    const response = await client.get(url, {
      timeout: getTimeoutMs(),
      maxContentLength: 512 * 1024,
      maxBodyLength: 512 * 1024,
      headers: {
        Accept: 'text/plain,application/xml,text/xml,*/*;q=0.8',
        'User-Agent': getUserAgent()
      }
    })
    const body = typeof response.data === 'string' ? response.data : String(response.data || '')
    return {
      url,
      ok: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      body: body.slice(0, 100_000)
    }
  } catch (error) {
    const mapped = mapHttpError(error)
    return {
      url,
      ok: false,
      statusCode: error?.response?.status || null,
      body: '',
      error: mapped.message
    }
  }
}

module.exports = {
  fetchHomepage,
  checkUrl,
  fetchTextResource,
  mapHttpError,
  getTimeoutMs,
  getConcurrency,
  getUserAgent
}

const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_JS_TIMEOUT_MS,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_HTML_BYTES,
  DEFAULT_USER_AGENT
} = require('./constants')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

const getTimeoutMs = () =>
  Number(config.SCAN_JS_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_JS_TIMEOUT_MS

const getMaxFileBytes = () =>
  Number(config.SCAN_JS_MAX_FILE_BYTES) || DEFAULT_MAX_FILE_BYTES

const getMaxHtmlBytes = () =>
  Number(config.SCAN_JS_MAX_HTML_BYTES) || DEFAULT_MAX_HTML_BYTES

const getUserAgent = () =>
  config.SCAN_JS_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

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
 * Fetch homepage HTML (single request).
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

  return {
    finalUrl: String(finalUrl),
    statusCode: response.status,
    html: truncate(response.data, getMaxHtmlBytes()),
    responseTime: Date.now() - startedAt
  }
}

/**
 * Fetch a single script resource. Never throws — returns error field.
 */
const fetchScript = async (url) => {
  const startedAt = Date.now()
  const maxBytes = getMaxFileBytes()
  try {
    const response = await client.get(url, {
      timeout: getTimeoutMs(),
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      headers: {
        Accept: 'application/javascript,text/javascript,*/*;q=0.8',
        'User-Agent': getUserAgent()
      }
    })

    const contentType = response.headers?.['content-type'] || null
    const body = truncate(response.data, maxBytes)
    const fileSize = Buffer.byteLength(body, 'utf8')

    return {
      url,
      ok: true,
      statusCode: response.status,
      contentType: contentType ? String(contentType) : null,
      body,
      fileSize,
      loadTime: Date.now() - startedAt,
      error: null
    }
  } catch (error) {
    const mapped = mapHttpError(error)
    return {
      url,
      ok: false,
      statusCode: error?.response?.status || null,
      contentType: null,
      body: '',
      fileSize: null,
      loadTime: Date.now() - startedAt,
      error: mapped.message,
      errorCode: mapped.code
    }
  }
}

/**
 * HEAD/GET probe for source map availability (lightweight GET with small limit).
 */
const checkSourceMap = async (mapUrl) => {
  try {
    const response = await client.get(mapUrl, {
      timeout: Math.min(getTimeoutMs(), 5000),
      maxContentLength: 1024,
      maxBodyLength: 1024,
      headers: { 'User-Agent': getUserAgent(), Range: 'bytes=0-512' }
    })
    return response.status >= 200 && response.status < 400
  } catch (_) {
    return false
  }
}

/**
 * Run async tasks with limited concurrency.
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<any>} worker
 */
const mapPool = async (items, concurrency, worker) => {
  const results = new Array(items.length)
  let next = 0

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  })

  await Promise.all(runners)
  return results
}

module.exports = {
  fetchHomepage,
  fetchScript,
  checkSourceMap,
  mapHttpError,
  mapPool,
  getTimeoutMs,
  getMaxFileBytes
}

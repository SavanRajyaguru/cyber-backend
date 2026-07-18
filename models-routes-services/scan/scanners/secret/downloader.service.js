const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_SECRET_TIMEOUT_MS,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_CONCURRENCY,
  DEFAULT_USER_AGENT,
  TEXT_CONTENT_TYPES
} = require('./constants')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

const getTimeoutMs = () =>
  Number(config.SCAN_SECRET_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_SECRET_TIMEOUT_MS

const getMaxBytes = () =>
  Number(config.SCAN_SECRET_MAX_FILE_BYTES) || DEFAULT_MAX_FILE_BYTES

const getConcurrency = () =>
  Number(config.SCAN_SECRET_CONCURRENCY) || DEFAULT_CONCURRENCY

const getUserAgent = () =>
  config.SCAN_SECRET_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

const client = axios.create({
  timeout: getTimeoutMs(),
  maxRedirects: Number(config.SCAN_HTTP_MAX_REDIRECTS) || 5,
  decompress: true,
  responseType: 'arraybuffer',
  httpAgent,
  httpsAgent,
  validateStatus: () => true,
  headers: {
    Accept: 'text/html,application/javascript,application/json,text/plain,*/*;q=0.8',
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
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code: ERROR_CODES.DNS_FAILURE, message: 'DNS lookup failed' }
  }
  if (code === 'ECONNREFUSED') {
    return { code: ERROR_CODES.CONNECTION_REFUSED, message: 'Connection refused' }
  }
  if (/certificate|ssl|tls/i.test(message)) {
    return { code: ERROR_CODES.SSL_FAILURE, message: 'SSL/TLS failure' }
  }
  return { code: ERROR_CODES.UNKNOWN, message }
}

const isBinaryBuffer = (buf) => {
  if (!Buffer.isBuffer(buf) || !buf.length) return false
  const sample = buf.subarray(0, Math.min(buf.length, 512))
  let nulls = 0
  for (const b of sample) if (b === 0) nulls++
  return nulls > 2
}

const isTextContentType = (contentType = '') => {
  const ct = String(contentType).toLowerCase()
  if (!ct) return true
  return TEXT_CONTENT_TYPES.some((t) => ct.includes(t))
}

/**
 * Fetch homepage as text.
 */
const fetchHomepage = async (url) => {
  const startedAt = Date.now()
  const response = await client.get(url, {
    timeout: getTimeoutMs(),
    maxContentLength: getMaxBytes(),
    maxBodyLength: getMaxBytes(),
    responseType: 'text',
    headers: {
      Accept: 'text/html,*/*;q=0.8',
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
    body: typeof response.data === 'string' ? response.data : String(response.data || ''),
    responseTime: Date.now() - startedAt
  }
}

/**
 * Download a single resource. Never throws.
 */
const downloadResource = async (url) => {
  const startedAt = Date.now()
  try {
    const response = await client.get(url, {
      timeout: getTimeoutMs(),
      maxContentLength: getMaxBytes(),
      maxBodyLength: getMaxBytes(),
      headers: { 'User-Agent': getUserAgent() }
    })

    const contentType = response.headers?.['content-type'] || ''
    const buf = Buffer.isBuffer(response.data)
      ? response.data
      : Buffer.from(response.data || '')

    if (response.status === 404) {
      return { url, ok: false, statusCode: 404, body: '', error: 'Not found', skipped: true }
    }

    if (!isTextContentType(contentType) || isBinaryBuffer(buf)) {
      return {
        url,
        ok: false,
        statusCode: response.status,
        body: '',
        error: 'Binary or non-text content skipped',
        skipped: true
      }
    }

    const max = getMaxBytes()
    const body = buf.subarray(0, Math.min(buf.length, max)).toString('utf8')

    return {
      url,
      ok: true,
      statusCode: response.status,
      contentType: String(contentType),
      body,
      fileSize: Buffer.byteLength(body, 'utf8'),
      loadTime: Date.now() - startedAt,
      error: null,
      skipped: false
    }
  } catch (error) {
    const mapped = mapHttpError(error)
    return {
      url,
      ok: false,
      statusCode: error?.response?.status || null,
      body: '',
      error: mapped.message,
      errorCode: mapped.code,
      skipped: false,
      loadTime: Date.now() - startedAt
    }
  }
}

/**
 * Concurrent map with pool limit.
 */
const mapPool = async (items, concurrency, worker) => {
  const results = new Array(items.length)
  let next = 0
  const size = Math.min(concurrency, Math.max(items.length, 0))
  if (!size) return results

  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }))
  return results
}

module.exports = {
  fetchHomepage,
  downloadResource,
  mapHttpError,
  mapPool,
  getConcurrency,
  getTimeoutMs
}

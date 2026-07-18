const http = require('http')
const https = require('https')
const axios = require('axios')
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_PERF_TIMEOUT_MS,
  DEFAULT_MAX_RESOURCE_BYTES,
  DEFAULT_CONCURRENCY,
  DEFAULT_USER_AGENT
} = require('./constants')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

const getTimeoutMs = () =>
  Number(config.SCAN_PERF_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_PERF_TIMEOUT_MS

const getMaxResourceBytes = () =>
  Number(config.SCAN_PERF_MAX_RESOURCE_BYTES) || DEFAULT_MAX_RESOURCE_BYTES

const getConcurrency = () =>
  Number(config.SCAN_PERF_CONCURRENCY) || DEFAULT_CONCURRENCY

const getUserAgent = () =>
  config.SCAN_PERF_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

const client = axios.create({
  timeout: getTimeoutMs(),
  maxRedirects: Number(config.SCAN_HTTP_MAX_REDIRECTS) || 5,
  decompress: true,
  responseType: 'arraybuffer',
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

/**
 * Probe resource size/headers. Prefers HEAD; falls back to ranged GET.
 * Never throws.
 * @param {string} url
 * @param {string} type
 */
const probeResource = async (url, type) => {
  const startedAt = Date.now()
  const maxBytes = getMaxResourceBytes()

  try {
    let response
    let method = 'HEAD'
    try {
      response = await client.head(url, {
        timeout: getTimeoutMs(),
        headers: { 'User-Agent': getUserAgent() }
      })
      if (response.status === 405 || response.status === 501) {
        throw new Error('HEAD not allowed')
      }
    } catch {
      method = 'GET'
      response = await client.get(url, {
        timeout: getTimeoutMs(),
        maxContentLength: Math.min(maxBytes, 64 * 1024),
        maxBodyLength: Math.min(maxBytes, 64 * 1024),
        headers: {
          'User-Agent': getUserAgent(),
          Range: 'bytes=0-0'
        }
      })
    }

    const headers = response.headers || {}
    const contentLength = Number(headers['content-length'])
    const contentRange = String(headers['content-range'] || '')
    const rangeTotal = contentRange.match(/\/(\d+)\s*$/)
    const size = Number.isFinite(contentLength) && contentLength >= 0
      ? contentLength
      : (rangeTotal ? Number(rangeTotal[1]) : null)

    return {
      url,
      type,
      ok: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      method,
      size,
      contentType: headers['content-type'] ? String(headers['content-type']) : null,
      contentEncoding: headers['content-encoding']
        ? String(headers['content-encoding']).toLowerCase()
        : null,
      cacheControl: headers['cache-control'] ? String(headers['cache-control']) : null,
      etag: headers.etag ? String(headers.etag) : null,
      loadTime: Date.now() - startedAt,
      error: null
    }
  } catch (error) {
    const mapped = mapHttpError(error)
    return {
      url,
      type,
      ok: false,
      statusCode: error?.response?.status || null,
      method: null,
      size: null,
      contentType: null,
      contentEncoding: null,
      cacheControl: null,
      etag: null,
      loadTime: Date.now() - startedAt,
      error: mapped.message,
      errorCode: mapped.code
    }
  }
}

module.exports = {
  probeResource,
  mapHttpError,
  getTimeoutMs,
  getConcurrency,
  getUserAgent,
  getMaxResourceBytes
}

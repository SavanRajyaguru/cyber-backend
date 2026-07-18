const dns = require('dns')
const http = require('http')
const https = require('https')
const tls = require('tls')
const zlib = require('zlib')
const { promisify } = require('util')
const { URL } = require('url')
const config = require('../../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_PERF_TIMEOUT_MS,
  DEFAULT_MAX_HTML_BYTES,
  DEFAULT_USER_AGENT
} = require('../constants')

const gunzip = promisify(zlib.gunzip)
const inflate = promisify(zlib.inflate)
const brotliDecompress = promisify(zlib.brotliDecompress)

/**
 * Decompress response body for HTML parsing. Wire size stays in responseSize.
 * @param {Buffer} buf
 * @param {string|null} encoding
 * @returns {Promise<Buffer>}
 */
const decompressBody = async (buf, encoding) => {
  if (!buf?.length || !encoding) return buf
  const enc = encoding.toLowerCase()
  try {
    if (enc.includes('br')) return await brotliDecompress(buf)
    if (enc.includes('gzip')) return await gunzip(buf)
    if (enc.includes('deflate')) return await inflate(buf)
  } catch {
    return buf
  }
  return buf
}

const dnsLookup = dns.promises.lookup

const getTimeoutMs = () =>
  Number(config.SCAN_PERF_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_PERF_TIMEOUT_MS

const getMaxHtmlBytes = () =>
  Number(config.SCAN_PERF_MAX_HTML_BYTES) || DEFAULT_MAX_HTML_BYTES

const getUserAgent = () =>
  config.SCAN_PERF_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

const getMaxRedirects = () => Number(config.SCAN_HTTP_MAX_REDIRECTS) || 5

const mapHttpError = (error) => {
  const code = error?.code
  const message = error?.message || 'HTTP request failed'
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return { code: ERROR_CODES.TIMEOUT, message: 'Request timed out' }
  }
  if (code === ERROR_CODES.REDIRECT_LOOP || /too many redirects/i.test(message)) {
    return { code: ERROR_CODES.REDIRECT_LOOP, message: 'Too many redirects' }
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { code: ERROR_CODES.DNS_FAILURE, message: 'DNS lookup failed' }
  }
  if (/certificate|ssl|tls/i.test(message) || code === 'CERT_HAS_EXPIRED') {
    return { code: ERROR_CODES.SSL_FAILURE, message: 'SSL/TLS failure' }
  }
  if (code === 'ECONNREFUSED') {
    return { code: ERROR_CODES.CONNECTION_REFUSED, message: 'Connection refused' }
  }
  return { code: ERROR_CODES.UNKNOWN, message }
}

const truncate = (buf, maxBytes) => {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf || ''), 'utf8')
  if (buf.length <= maxBytes) return buf.toString('utf8')
  return buf.subarray(0, maxBytes).toString('utf8')
}

/**
 * Detect HTTP/2 via ALPN (does not download the page).
 * @param {string} hostname
 * @param {number} port
 * @returns {Promise<boolean>}
 */
const detectHttp2Alpn = (hostname, port) =>
  new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      ALPNProtocols: ['h2', 'http/1.1'],
      rejectUnauthorized: false,
      timeout: Math.min(getTimeoutMs(), 5000)
    })
    const done = (value) => {
      try { socket.destroy() } catch (_) { /* ignore */ }
      resolve(value)
    }
    socket.once('secureConnect', () => done(socket.alpnProtocol === 'h2'))
    socket.once('error', () => done(false))
    socket.once('timeout', () => done(false))
  })

/**
 * Single HTTP(S) GET with phase timings. Does not follow redirects.
 * @param {string} targetUrl
 * @param {{ timeoutMs?: number, maxBytes?: number }} [opts]
 */
const timedGet = async (targetUrl, opts = {}) => {
  const timeoutMs = opts.timeoutMs || getTimeoutMs()
  const maxBytes = opts.maxBytes || getMaxHtmlBytes()

  let parsed
  try {
    parsed = new URL(targetUrl)
  } catch {
    const err = new Error('Invalid URL')
    err.code = ERROR_CODES.INVALID_URL
    throw err
  }

  const isHttps = parsed.protocol === 'https:'
  const port = parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80)
  const lib = isHttps ? https : http

  const marks = {
    start: Date.now(),
    dnsStart: 0,
    dnsEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    tlsStart: 0,
    tlsEnd: 0,
    firstByte: 0,
    end: 0
  }

  // Measure DNS separately (passive). Request uses normal resolver (usually cached).
  marks.dnsStart = Date.now()
  try {
    await dnsLookup(parsed.hostname)
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code
    throw err
  }
  marks.dnsEnd = Date.now()

  return new Promise((resolve, reject) => {
    let settled = false
    let responseSize = 0
    let truncated = false
    const chunks = []
    /** @type {import('http').IncomingMessage|null} */
    let resRef = null
    /** @type {import('http').ClientRequest|null} */
    let req = null

    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) {
        reject(error)
        return
      }

      const headers = resRef?.headers || {}
      const encoding = String(headers['content-encoding'] || '').toLowerCase()
      const altSvc = String(headers['alt-svc'] || '')
      const http3 = /(?:^|[,;\s])h3/i.test(altSvc) ? true : (altSvc ? false : null)

      const dnsLookupMs = Math.max(0, marks.dnsEnd - marks.dnsStart)
      const tcpConnectMs = marks.connectEnd && marks.connectStart
        ? Math.max(0, marks.connectEnd - marks.connectStart)
        : null
      const tlsHandshakeMs = isHttps && marks.tlsEnd && marks.tlsStart
        ? Math.max(0, marks.tlsEnd - marks.tlsStart)
        : (isHttps ? null : 0)
      const ttfbMs = marks.firstByte
        ? Math.max(0, marks.firstByte - marks.start)
        : null
      const downloadMs = marks.firstByte && marks.end
        ? Math.max(0, marks.end - marks.firstByte)
        : null
      const totalMs = marks.end
        ? Math.max(0, marks.end - marks.start)
        : Math.max(0, Date.now() - marks.start)

      const wireBuf = Buffer.concat(chunks)
      decompressBody(wireBuf, encoding || null)
        .then((decoded) => {
          resolve({
            url: targetUrl,
            finalUrl: targetUrl,
            statusCode: resRef?.statusCode || 0,
            headers,
            html: truncate(decoded, maxBytes),
            truncated: truncated || decoded.length > maxBytes,
            responseSize,
            timings: {
              dnsLookupMs,
              tcpConnectMs,
              tlsHandshakeMs,
              ttfbMs,
              downloadMs,
              totalMs,
              responseSize,
              contentEncoding: encoding || null,
              httpVersion: resRef?.httpVersion ? `HTTP/${resRef.httpVersion}` : null,
              http2: false,
              http3
            }
          })
        })
        .catch((error) => reject(error))
    }

    const timer = setTimeout(() => {
      const err = new Error('Request timed out')
      err.code = ERROR_CODES.TIMEOUT
      try { req?.destroy() } catch (_) { /* ignore */ }
      finish(err)
    }, timeoutMs)

    marks.connectStart = Date.now()

    req = lib.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      servername: parsed.hostname,
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': getUserAgent(),
        Connection: 'close',
        Host: parsed.host
      },
      timeout: timeoutMs
    }, (res) => {
      resRef = res
      // Headers received ≈ first byte for TTFB when body is empty/chunked
      if (!marks.firstByte) marks.firstByte = Date.now()
      res.on('data', (chunk) => {
        if (!marks.firstByte) marks.firstByte = Date.now()
        responseSize += chunk.length
        const currentLen = chunks.reduce((n, c) => n + c.length, 0)
        if (currentLen < maxBytes) {
          const room = maxBytes - currentLen
          if (chunk.length <= room) {
            chunks.push(chunk)
          } else {
            chunks.push(chunk.subarray(0, room))
            truncated = true
          }
        } else {
          truncated = true
        }
      })
      res.on('end', () => {
        marks.end = Date.now()
        // Content-Length may be absent when chunked; prefer accumulated wire size
        if (!responseSize && res.headers?.['content-length']) {
          responseSize = Number(res.headers['content-length']) || responseSize
        }
        finish(null)
      })
      res.on('error', (error) => finish(error))
    })

    req.on('socket', (socket) => {
      const onConnect = () => {
        if (!marks.connectEnd) marks.connectEnd = Date.now()
        if (isHttps && !marks.tlsStart) marks.tlsStart = Date.now()
      }
      if (socket.connecting) socket.once('connect', onConnect)
      else onConnect()

      if (isHttps) {
        socket.once('secureConnect', () => {
          marks.tlsEnd = Date.now()
          if (!marks.connectEnd) {
            marks.connectEnd = marks.tlsEnd
            marks.tlsStart = marks.connectStart
          }
        })
      }
    })

    req.on('error', (error) => finish(error))
    req.on('timeout', () => {
      const err = new Error('Request timed out')
      err.code = ERROR_CODES.TIMEOUT
      req.destroy()
      finish(err)
    })

    req.end()
  })
}

/**
 * Fetch homepage with redirects + detailed timings (final hop measured).
 * @param {string} url
 */
const fetchHomepageTimed = async (url) => {
  let current = url
  const redirectChain = []
  const maxRedirects = getMaxRedirects()

  for (let i = 0; i <= maxRedirects; i++) {
    const result = await timedGet(current)
    const code = result.statusCode
    const location = result.headers?.location

    if (code >= 300 && code < 400 && location) {
      redirectChain.push({ from: current, statusCode: code, to: location })
      try {
        current = new URL(location, current).href
      } catch {
        break
      }
      continue
    }

    let http2 = false
    try {
      const u = new URL(current)
      if (u.protocol === 'https:') {
        http2 = await detectHttp2Alpn(u.hostname, u.port ? Number(u.port) : 443)
      }
    } catch (_) {
      http2 = false
    }

    result.finalUrl = current
    result.redirectChain = redirectChain
    result.timings.http2 = http2
    return result
  }

  const err = new Error('Too many redirects')
  err.code = ERROR_CODES.REDIRECT_LOOP
  throw err
}

module.exports = {
  fetchHomepageTimed,
  detectHttp2Alpn,
  mapHttpError,
  getTimeoutMs,
  getMaxHtmlBytes,
  getUserAgent
}

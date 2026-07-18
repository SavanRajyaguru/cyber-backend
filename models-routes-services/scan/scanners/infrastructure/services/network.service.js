const dns = require('dns')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const config = require('../../../../../config/config')
const {
  DEFAULT_FALLBACK_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  ERROR_CODES
} = require('../constants')

const dnsResolve4 = dns.promises.resolve4
const dnsResolve6 = dns.promises.resolve6

const getTimeoutMs = () =>
  Number(config.SCAN_INFRA_TIMEOUT_MS) ||
  Number(config.SCAN_HTTP_TIMEOUT_MS) ||
  DEFAULT_FALLBACK_TIMEOUT_MS

const getUserAgent = () =>
  config.SCAN_INFRA_USER_AGENT || config.SCAN_HTTP_USER_AGENT || DEFAULT_USER_AGENT

/**
 * Lightweight A/AAAA lookup — only when DNS sibling result is missing.
 * @param {string} hostname
 */
const fallbackResolveAddresses = async (hostname) => {
  const result = { A: [], AAAA: [], error: null }
  try {
    const [v4, v6] = await Promise.allSettled([
      dnsResolve4(hostname),
      dnsResolve6(hostname)
    ])
    if (v4.status === 'fulfilled') result.A = v4.value || []
    if (v6.status === 'fulfilled') result.AAAA = v6.value || []
  } catch (error) {
    result.error = error?.message || 'DNS fallback failed'
  }
  return result
}

/**
 * Single passive homepage GET for headers/redirects when siblings missing.
 * Never throws.
 * @param {string} url
 */
const fallbackFetchHeaders = (url) =>
  new Promise((resolve) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      resolve({
        ok: false,
        error: 'Invalid URL',
        errorCode: ERROR_CODES.INVALID_URL,
        headers: {},
        statusCode: null,
        finalUrl: url,
        redirects: [],
        httpsEnabled: false
      })
      return
    }

    const timeoutMs = getTimeoutMs()
    const maxRedirects = Number(config.SCAN_HTTP_MAX_REDIRECTS) || 5
    const redirects = []
    let current = url
    let hops = 0

    const requestOnce = (target) => {
      let targetUrl
      try {
        targetUrl = new URL(target)
      } catch {
        resolve({
          ok: false,
          error: 'Invalid redirect URL',
          headers: {},
          statusCode: null,
          finalUrl: current,
          redirects,
          httpsEnabled: String(current).startsWith('https:')
        })
        return
      }

      const isHttps = targetUrl.protocol === 'https:'
      const lib = isHttps ? https : http
      const req = lib.request({
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        headers: {
          Accept: 'text/html,*/*;q=0.8',
          'User-Agent': getUserAgent(),
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'close'
        },
        timeout: timeoutMs,
        rejectUnauthorized: false
      }, (res) => {
        const headers = {}
        for (const [k, v] of Object.entries(res.headers || {})) {
          headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)
        }

        // Drain body without storing — headers only
        res.resume()

        if (res.statusCode >= 300 && res.statusCode < 400 && headers.location && hops < maxRedirects) {
          hops += 1
          const next = new URL(headers.location, target).href
          redirects.push({ from: target, statusCode: res.statusCode, to: next })
          current = next
          requestOnce(next)
          return
        }

        resolve({
          ok: true,
          error: null,
          headers,
          statusCode: res.statusCode,
          finalUrl: target,
          redirects,
          httpsEnabled: targetUrl.protocol === 'https:',
          httpVersion: res.httpVersion ? `HTTP/${res.httpVersion}` : null
        })
      })

      req.on('error', (error) => {
        resolve({
          ok: false,
          error: error?.message || 'Request failed',
          headers: {},
          statusCode: null,
          finalUrl: current,
          redirects,
          httpsEnabled: String(current).startsWith('https:')
        })
      })
      req.on('timeout', () => {
        req.destroy()
        resolve({
          ok: false,
          error: 'Request timed out',
          errorCode: ERROR_CODES.TIMEOUT,
          headers: {},
          statusCode: null,
          finalUrl: current,
          redirects,
          httpsEnabled: String(current).startsWith('https:')
        })
      })
      req.end()
    }

    requestOnce(parsed.href)
  })

/**
 * Best-effort private IP check (informational).
 * @param {string} ip
 */
const isPrivateIp = (ip) => {
  if (!ip || typeof ip !== 'string') return false
  if (ip.includes(':')) {
    const lower = ip.toLowerCase()
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
  }
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false
  if (parts[0] === 10) return true
  if (parts[0] === 127) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  return false
}

module.exports = {
  fallbackResolveAddresses,
  fallbackFetchHeaders,
  isPrivateIp,
  getTimeoutMs
}

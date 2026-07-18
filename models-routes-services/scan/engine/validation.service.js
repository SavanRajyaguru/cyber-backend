const net = require('net')

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/
const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$|^localhost$/i

const isValidIpv4 = (value) => {
  if (!IPV4_REGEX.test(value)) return false
  return net.isIP(value) === 4
}

const isValidDomain = (value) => DOMAIN_REGEX.test(value)

/**
 * Normalize and validate scan target.
 * Accepts http/https URLs, bare domains, and IPv4 addresses.
 * @param {string} rawInput
 * @returns {{ ok: true, sUrl: string } | { ok: false, sError: string }}
 */
const normalizeAndValidateUrl = (rawInput) => {
  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    return { ok: false, sError: 'URL is required' }
  }

  let input = rawInput.trim()

  // Reject schemes other than http/https when present
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) {
    const scheme = input.split(':')[0].toLowerCase()
    if (scheme !== 'http' && scheme !== 'https') {
      return { ok: false, sError: 'Only http and https URLs are allowed' }
    }
  } else {
    input = `https://${input}`
  }

  let parsed
  try {
    parsed = new URL(input)
  } catch (error) {
    return { ok: false, sError: 'Invalid URL format' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, sError: 'Only http and https URLs are allowed' }
  }

  const host = parsed.hostname
  if (!host) {
    return { ok: false, sError: 'Host is required' }
  }

  const isIp = isValidIpv4(host)
  const isDomain = isValidDomain(host)
  if (!isIp && !isDomain) {
    return { ok: false, sError: 'Host must be a valid domain or IPv4 address' }
  }

  // Normalize: drop hash, keep pathname/search
  parsed.hash = ''
  return { ok: true, sUrl: parsed.toString() }
}

module.exports = {
  normalizeAndValidateUrl,
  isValidIpv4,
  isValidDomain
}

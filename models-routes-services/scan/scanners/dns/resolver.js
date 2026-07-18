const dns = require('dns').promises
const config = require('../../../../config/config')
const {
  ERROR_CODES,
  DEFAULT_DNS_TIMEOUT_MS,
  DKIM_SELECTORS,
  RECORD_TYPES
} = require('./constants')

const getTimeoutMs = () =>
  Number(config.SCAN_DNS_TIMEOUT_MS) || DEFAULT_DNS_TIMEOUT_MS

/**
 * @param {string} hostname
 * @returns {string} apex-ish domain for email records (strip leading www.)
 */
const toEmailDomain = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '')
  if (host.startsWith('www.')) return host.slice(4)
  return host
}

const withTimeout = async (promise, timeoutMs, label) => {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`DNS ${label} timed out`)
      error.code = ERROR_CODES.TIMEOUT
      reject(error)
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Resolve a single record type; missing records return empty without throwing.
 * @returns {Promise<{ type: string, records: any, error: string|null, code: string|null }>}
 */
const resolveType = async (hostname, type, timeoutMs) => {
  try {
    let records
    switch (type) {
      case 'A':
        records = await withTimeout(dns.resolve4(hostname), timeoutMs, type)
        break
      case 'AAAA':
        records = await withTimeout(dns.resolve6(hostname), timeoutMs, type)
        break
      case 'CNAME':
        records = await withTimeout(dns.resolveCname(hostname), timeoutMs, type)
        break
      case 'MX':
        records = await withTimeout(dns.resolveMx(hostname), timeoutMs, type)
        records = (records || [])
          .map((r) => ({ exchange: r.exchange, priority: r.priority }))
          .sort((a, b) => a.priority - b.priority)
        break
      case 'NS':
        records = await withTimeout(dns.resolveNs(hostname), timeoutMs, type)
        break
      case 'TXT':
        records = await withTimeout(dns.resolveTxt(hostname), timeoutMs, type)
        records = (records || []).map((chunks) => (Array.isArray(chunks) ? chunks.join('') : String(chunks)))
        break
      case 'SOA':
        records = await withTimeout(dns.resolveSoa(hostname), timeoutMs, type)
        break
      case 'CAA':
        records = await withTimeout(dns.resolveCaa(hostname), timeoutMs, type)
        records = (records || []).map((r) => ({
          critical: Boolean(r.critical),
          issue: r.issue || r.issuewild || r.iodef || r.contactemail || r.contactphone || ''
        }))
        break
      default:
        records = []
    }
    return { type, records: records || [], error: null, code: null }
  } catch (error) {
    const code = error.code || ERROR_CODES.UNKNOWN
    if (code === 'ENODATA') {
      return { type, records: type === 'SOA' ? null : [], error: null, code: 'ENODATA' }
    }
    if (code === 'ENOTFOUND') {
      return { type, records: type === 'SOA' ? null : [], error: null, code: 'ENOTFOUND' }
    }
    if (code === 'ETIMEOUT' || code === ERROR_CODES.TIMEOUT) {
      return {
        type,
        records: type === 'SOA' ? null : [],
        error: error.message || 'timeout',
        code: ERROR_CODES.TIMEOUT
      }
    }
    return {
      type,
      records: type === 'SOA' ? null : [],
      error: error.message || String(code),
      code
    }
  }
}

const resolvePtr = async (ip, timeoutMs) => {
  try {
    const records = await withTimeout(dns.reverse(ip), timeoutMs, 'PTR')
    return { records: records || [], error: null }
  } catch (_) {
    return { records: [], error: null }
  }
}

const resolveDkimSelector = async (domain, selector, timeoutMs) => {
  const name = `${selector}._domainkey.${domain}`
  try {
    const txt = await withTimeout(dns.resolveTxt(name), timeoutMs, `DKIM:${selector}`)
    const joined = (txt || []).map((chunks) => (Array.isArray(chunks) ? chunks.join('') : String(chunks)))
    const dkim = joined.find((r) => /v=DKIM1/i.test(r) || /p=/i.test(r))
    if (dkim) return { selector, record: dkim }
    if (joined.length) return { selector, record: joined[0] }
    return null
  } catch (_) {
    return null
  }
}

/**
 * Concurrent DNS resolution for all target record types + DKIM probes + PTR.
 * @param {string} hostname
 */
const resolveAllRecords = async (hostname) => {
  const timeoutMs = getTimeoutMs()
  const host = String(hostname).toLowerCase().replace(/\.$/, '')
  const emailDomain = toEmailDomain(host)

  const settled = await Promise.all(
    RECORD_TYPES.map((type) => resolveType(host, type, timeoutMs))
  )

  const byType = Object.fromEntries(settled.map((r) => [r.type, r]))

  // Email-domain TXT / MX if hostname differs (e.g. www)
  let emailTxt = byType.TXT?.records || []
  let emailMx = byType.MX?.records || []
  if (emailDomain !== host) {
    const [txtExtra, mxExtra] = await Promise.all([
      resolveType(emailDomain, 'TXT', timeoutMs),
      resolveType(emailDomain, 'MX', timeoutMs)
    ])
    emailTxt = [...new Set([...(emailTxt || []), ...(txtExtra.records || [])])]
    if ((!emailMx || !emailMx.length) && mxExtra.records?.length) {
      emailMx = mxExtra.records
    }
  }

  // DMARC at _dmarc.<emailDomain>
  let dmarcRecords = []
  try {
    const dmarc = await resolveType(`_dmarc.${emailDomain}`, 'TXT', timeoutMs)
    dmarcRecords = dmarc.records || []
  } catch (_) {}

  // DKIM selectors concurrently
  const dkimResults = await Promise.all(
    DKIM_SELECTORS.map((selector) => resolveDkimSelector(emailDomain, selector, timeoutMs))
  )
  const dkimFound = dkimResults.find(Boolean) || null

  // PTR for first A
  const aRecords = byType.A?.records || []
  let ptrRecords = []
  if (aRecords.length) {
    const ptr = await resolvePtr(aRecords[0], timeoutMs)
    ptrRecords = ptr.records
  }

  // DNSSEC: best-effort via resolveDnssec / AD flag unavailable in dns.promises;
  // try resolveAny empty check — mark detectable:false unless DS query works
  let dnssec = { detectable: false, enabled: null }
  try {
    if (typeof dns.resolve === 'function') {
      // Node does not expose AD bit reliably; attempt DS lookup as weak signal
      await withTimeout(dns.resolve(emailDomain, 'DS'), timeoutMs, 'DS')
      dnssec = { detectable: true, enabled: true }
    }
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      dnssec = { detectable: true, enabled: false }
    } else {
      dnssec = { detectable: false, enabled: null }
    }
  }

  const anySuccess =
    (byType.A?.records || []).length ||
    (byType.AAAA?.records || []).length ||
    (byType.CNAME?.records || []).length ||
    (byType.NS?.records || []).length ||
    (byType.MX?.records || []).length ||
    (byType.TXT?.records || []).length ||
    byType.SOA?.records

  if (!anySuccess) {
    const codes = settled.map((s) => s.code).filter(Boolean)
    if (codes.includes('ENOTFOUND') && !codes.some((c) => c && c !== 'ENOTFOUND' && c !== 'ENODATA')) {
      const error = new Error('Domain does not exist (NXDOMAIN)')
      error.code = ERROR_CODES.NXDOMAIN
      throw error
    }
    if (codes.length && codes.every((c) => c === ERROR_CODES.TIMEOUT || c === 'ETIMEOUT')) {
      const error = new Error('DNS resolution timed out')
      error.code = ERROR_CODES.TIMEOUT
      throw error
    }
    if (codes.some((c) => c === 'ESERVFAIL' || c === 'SERVFAIL')) {
      const error = new Error('DNS server failure (SERVFAIL)')
      error.code = ERROR_CODES.SERVFAIL
      throw error
    }
  }

  return {
    hostname: host,
    emailDomain,
    A: byType.A?.records || [],
    AAAA: byType.AAAA?.records || [],
    CNAME: byType.CNAME?.records || [],
    MX: emailMx.length ? emailMx : (byType.MX?.records || []),
    NS: byType.NS?.records || [],
    TXT: emailTxt.length ? emailTxt : (byType.TXT?.records || []),
    SOA: byType.SOA?.records || null,
    CAA: byType.CAA?.records || [],
    PTR: ptrRecords,
    dmarcTxt: dmarcRecords,
    dkimFound,
    dkimSelectorsTried: [...DKIM_SELECTORS],
    dnssec,
    partialErrors: settled
      .filter((s) => s.error)
      .map((s) => ({ type: s.type, code: s.code, error: s.error }))
  }
}

module.exports = {
  resolveAllRecords,
  toEmailDomain,
  getTimeoutMs,
  withTimeout
}

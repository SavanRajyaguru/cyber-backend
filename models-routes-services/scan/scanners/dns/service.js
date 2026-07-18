const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES } = require('./constants')
const { resolveAllRecords } = require('./resolver')
const { analyzeDns } = require('./dns.analyzer')
const { calculateDnsScore } = require('./scoring')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[dns-scanner] ${message}${suffix}`)
}

const extractHostname = (sUrl) => {
  const hostname = new URL(sUrl).hostname
  if (!hostname) {
    const error = new Error('Invalid hostname')
    error.code = ERROR_CODES.INVALID_HOSTNAME
    throw error
  }
  return hostname.toLowerCase().replace(/\.$/, '')
}

/**
 * Orchestrate DNS scan: validate → concurrent resolve → analyze → score.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').DnsScanResult>}
 */
const runDnsScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  let hostname
  try {
    hostname = extractHostname(validated.sUrl)
  } catch (error) {
    const err = new Error(error.message || 'Invalid hostname')
    err.code = error.code || ERROR_CODES.INVALID_HOSTNAME
    throw err
  }

  log('Request Started', { hostname })

  let resolved
  try {
    resolved = await resolveAllRecords(hostname)
    log('Response Received', {
      A: resolved.A.length,
      AAAA: resolved.AAAA.length,
      MX: resolved.MX.length,
      NS: resolved.NS.length
    })
  } catch (error) {
    const code = error.code || ERROR_CODES.UNKNOWN
    const err = new Error(error.message || 'DNS scan failed')
    err.code = code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : code
    err.errorCode = code
    throw err
  }

  const { records, findings, flags } = analyzeDns(resolved)
  const { score, grade, risk } = calculateDnsScore({ flags, spf: records.SPF })

  const recommendations = [
    ...new Set(
      findings
        .filter((f) => f.status === 'fail' || f.status === 'warn')
        .map((f) => f.recommendation)
        .filter((r) => r && r !== 'No action required.')
    )
  ]

  log('Analysis Completed', { score, grade, risk, findings: findings.length })

  const result = {
    module: 'dns',
    sModule: 'dns',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    records,
    findings,
    recommendations,
    oMeta: {
      bStub: false,
      hostname: resolved.hostname,
      emailDomain: resolved.emailDomain,
      partialErrors: resolved.partialErrors || []
    }
  }

  log('Worker Finished', { hostname, score })
  return result
}

module.exports = {
  runDnsScan
}

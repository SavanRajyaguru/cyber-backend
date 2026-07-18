const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES } = require('./constants')
const { extractHostPort, connectTls } = require('./tls.client')
const { analyzeCertificate } = require('./certificate.analyzer')
const { analyzeTls } = require('./tls.analyzer')
const { calculateSslScore } = require('./scoring')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[ssl-scanner] ${message}${suffix}`)
}

/**
 * Orchestrate SSL/TLS scan: validate → one TLS connect → analyze → score.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').SslScanResult>}
 */
const runSslScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  let hostname
  let port
  try {
    ({ hostname, port } = extractHostPort(validated.sUrl))
  } catch (error) {
    const err = new Error(error.message || 'Invalid hostname')
    err.code = error.code || ERROR_CODES.INVALID_HOSTNAME
    throw err
  }

  log('Request Started', { hostname, port })

  let connectResult
  try {
    connectResult = await connectTls({ hostname, port })
    log('Response Received', {
      protocol: connectResult.protocol,
      authorized: connectResult.authorized
    })
  } catch (error) {
    const code = error.code || ERROR_CODES.UNKNOWN
    const err = new Error(error.message || 'SSL scan failed')
    err.code = code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : code
    err.errorCode = code
    throw err
  }

  const certAnalysis = analyzeCertificate(connectResult)
  const tlsAnalysis = analyzeTls(connectResult)

  const findings = [...tlsAnalysis.findings, ...certAnalysis.findings]
  const recommendations = [
    ...new Set(
      findings
        .filter((f) => f.status === 'fail' || f.status === 'warn')
        .map((f) => f.recommendation)
        .filter((r) => r && r !== 'No action required.')
    )
  ]

  const { score, grade, risk } = calculateSslScore({
    tls: tlsAnalysis.tls,
    flags: certAnalysis.flags
  })

  log('Analysis Completed', { score, grade, risk, findings: findings.length })

  const result = {
    module: 'ssl',
    sModule: 'ssl',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    certificate: certAnalysis.certificate,
    tls: tlsAnalysis.tls,
    findings,
    recommendations,
    oMeta: { bStub: false }
  }

  log('Worker Finished', { hostname, score })
  return result
}

module.exports = {
  runSslScan
}

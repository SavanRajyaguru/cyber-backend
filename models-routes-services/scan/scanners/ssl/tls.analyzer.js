const { SEVERITY, FINDING_STATUS, TLS_VERSIONS } = require('./constants')

/**
 * Analyze negotiated TLS version from a single handshake.
 * @param {import('./types').TlsConnectResult|null} connectResult
 */
const analyzeTls = (connectResult) => {
  const findings = []

  if (!connectResult?.httpsEnabled) {
    const tlsInfo = {
      version: null,
      httpsEnabled: false,
      supportsTls10: false,
      supportsTls11: false,
      supportsTls12: false,
      supportsTls13: false,
      weakProtocol: false
    }

    findings.push({
      title: 'Missing HTTPS',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'Could not establish a TLS connection to the target.',
      recommendation: 'Enable HTTPS with a valid certificate and modern TLS configuration.'
    })

    return { tls: tlsInfo, findings }
  }

  const version = connectResult.protocol || null
  const supportsTls10 = version === TLS_VERSIONS.TLS10
  const supportsTls11 = version === TLS_VERSIONS.TLS11
  const supportsTls12 = version === TLS_VERSIONS.TLS12
  const supportsTls13 = version === TLS_VERSIONS.TLS13
  const weakProtocol = supportsTls10 || supportsTls11

  const tlsInfo = {
    version,
    httpsEnabled: true,
    supportsTls10,
    supportsTls11,
    supportsTls12,
    supportsTls13,
    weakProtocol
  }

  findings.push({
    title: 'HTTPS enabled',
    severity: SEVERITY.LOW,
    status: FINDING_STATUS.PASS,
    description: 'TLS handshake completed successfully.',
    recommendation: 'No action required.'
  })

  if (weakProtocol) {
    findings.push({
      title: 'Weak TLS',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `Negotiated weak TLS protocol: ${version}.`,
      recommendation: 'Disable TLS 1.0/1.1 and require TLS 1.2 or TLS 1.3.'
    })
  } else if (supportsTls13) {
    findings.push({
      title: 'TLS version',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: 'Negotiated TLS 1.3.',
      recommendation: 'No action required.'
    })
  } else if (supportsTls12) {
    findings.push({
      title: 'TLS version',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Negotiated TLS 1.2. TLS 1.3 is preferred when available.',
      recommendation: 'Enable TLS 1.3 for improved security and performance.'
    })
  } else {
    findings.push({
      title: 'TLS version',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Unexpected or unknown negotiated TLS version: ${version || 'unknown'}.`,
      recommendation: 'Configure the server to support TLS 1.2 and TLS 1.3 only.'
    })
  }

  return { tls: tlsInfo, findings }
}

module.exports = {
  analyzeTls
}

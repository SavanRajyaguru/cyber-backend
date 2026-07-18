const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity, statusToSeverity } = require('../utils/finding')

/**
 * @param {Object|null} ssl
 * @returns {import('../types').ThreatFinding[]}
 */
const applySslRule = (ssl) => {
  if (!ssl || ssl.oMeta?.bStub) return []

  const findings = []
  const tls = ssl.tls || {}
  const cert = ssl.certificate || {}

  if (tls.weakProtocol || tls.supportsTls10 || tls.supportsTls11) {
    findings.push(makeThreatFinding({
      title: 'Weak TLS protocol supported',
      category: THREAT_CATEGORIES.TLS,
      severity: SEVERITY.HIGH,
      confidence: 90,
      affectedModule: 'ssl',
      description: 'Legacy TLS 1.0/1.1 or other weak protocol indicators were detected.',
      recommendation: 'Disable TLS 1.0/1.1; require TLS 1.2+ (prefer TLS 1.3).'
    }))
  }

  if (typeof cert.daysRemaining === 'number') {
    if (cert.daysRemaining < 0) {
      findings.push(makeThreatFinding({
        title: 'Expired TLS certificate',
        category: THREAT_CATEGORIES.CERTIFICATE,
        severity: SEVERITY.CRITICAL,
        confidence: 98,
        affectedModule: 'ssl',
        description: 'The TLS certificate appears expired.',
        recommendation: 'Renew the certificate immediately and automate renewal.'
      }))
    } else if (cert.daysRemaining <= 14) {
      findings.push(makeThreatFinding({
        title: 'TLS certificate expiring soon',
        category: THREAT_CATEGORIES.CERTIFICATE,
        severity: SEVERITY.HIGH,
        confidence: 95,
        affectedModule: 'ssl',
        description: `Certificate expires in ${cert.daysRemaining} day(s).`,
        recommendation: 'Renew the certificate before expiry.'
      }))
    } else if (cert.daysRemaining <= 30) {
      findings.push(makeThreatFinding({
        title: 'TLS certificate nearing expiry',
        category: THREAT_CATEGORIES.CERTIFICATE,
        severity: SEVERITY.MEDIUM,
        confidence: 90,
        affectedModule: 'ssl',
        description: `Certificate expires in ${cert.daysRemaining} day(s).`,
        recommendation: 'Schedule certificate renewal.'
      }))
    }
  }

  if (cert.keySize && cert.keySize < 2048 && /rsa/i.test(cert.publicKeyAlgorithm || '')) {
    findings.push(makeThreatFinding({
      title: 'Weak certificate key size',
      category: THREAT_CATEGORIES.CERTIFICATE,
      severity: SEVERITY.HIGH,
      confidence: 90,
      affectedModule: 'ssl',
      description: `RSA key size is ${cert.keySize} bits.`,
      recommendation: 'Use at least 2048-bit RSA or modern ECDSA keys.'
    }))
  }

  if (/sha1|md5/i.test(cert.signatureAlgorithm || '')) {
    findings.push(makeThreatFinding({
      title: 'Weak certificate signature algorithm',
      category: THREAT_CATEGORIES.CERTIFICATE,
      severity: SEVERITY.HIGH,
      confidence: 92,
      affectedModule: 'ssl',
      description: `Signature algorithm: ${cert.signatureAlgorithm}`,
      recommendation: 'Reissue the certificate with SHA-256 or stronger.'
    }))
  }

  for (const f of ssl.findings || []) {
    const status = String(f.status || '').toLowerCase()
    if (status !== 'fail' && status !== 'warn') continue
    const sev = f.severity ? normalizeSeverity(f.severity) : statusToSeverity(status)
    if (sev === SEVERITY.INFORMATIONAL) continue

    const title = f.title || 'SSL/TLS issue'
    if (findings.some((x) => x.title === title)) continue

    findings.push(makeThreatFinding({
      title,
      category: /cert|expir|issuer|hostname|san/i.test(title)
        ? THREAT_CATEGORIES.CERTIFICATE
        : THREAT_CATEGORIES.TLS,
      severity: sev === SEVERITY.LOW ? SEVERITY.MEDIUM : sev,
      confidence: 80,
      affectedModule: 'ssl',
      description: f.description || title,
      recommendation: f.recommendation || 'Remediate the TLS/certificate finding.'
    }))
  }

  return findings
}

module.exports = {
  name: 'ssl',
  sourceModule: 'ssl',
  apply: applySslRule
}

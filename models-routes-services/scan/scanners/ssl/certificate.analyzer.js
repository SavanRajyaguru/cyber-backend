const crypto = require('crypto')
const tls = require('tls')
const config = require('../../../../config/config')
const {
  SEVERITY,
  FINDING_STATUS,
  DEFAULT_EXPIRY_WARN_DAYS,
  MIN_RSA_KEY_BITS,
  MIN_EC_KEY_BITS,
  WEAK_SIGNATURE_PATTERNS
} = require('./constants')

const getExpiryWarnDays = () =>
  Number(config.SCAN_SSL_EXPIRY_WARN_DAYS) || DEFAULT_EXPIRY_WARN_DAYS

const formatDn = (dn) => {
  if (!dn) return null
  if (typeof dn === 'string') return dn
  return Object.entries(dn)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`)
    .join(', ')
}

const parseSan = (peerCert, x509) => {
  const sans = []
  if (x509?.subjectAltName) {
    for (const part of String(x509.subjectAltName).split(',')) {
      const trimmed = part.trim()
      const match = /^(DNS|IP Address):(.+)$/i.exec(trimmed)
      if (match) sans.push(match[2].trim())
      else if (trimmed) sans.push(trimmed)
    }
  }
  if (!sans.length && peerCert?.subjectaltname) {
    for (const part of String(peerCert.subjectaltname).split(',')) {
      const trimmed = part.trim()
      const match = /^(DNS|IP Address):(.+)$/i.exec(trimmed)
      if (match) sans.push(match[2].trim())
    }
  }
  return [...new Set(sans)]
}

const getKeyInfo = (peerCert, x509) => {
  let publicKeyAlgorithm = null
  let keySize = null

  if (x509) {
    try {
      const keyObject = x509.publicKey
      publicKeyAlgorithm = keyObject?.asymmetricKeyType || null
      const details = keyObject?.asymmetricKeyDetails
      if (details?.modulusLength) keySize = details.modulusLength
      else if (details?.namedCurve) {
        // Approximate EC strength from curve name when bits unavailable
        const curve = String(details.namedCurve)
        if (/256|P-256|prime256/i.test(curve)) keySize = 256
        else if (/384|P-384/i.test(curve)) keySize = 384
        else if (/521|P-521/i.test(curve)) keySize = 521
        else keySize = details.mgf1HashAlgorithm ? null : 256
      }
    } catch (_) {}
  }

  if (!publicKeyAlgorithm && peerCert?.pubkey?.type) {
    publicKeyAlgorithm = peerCert.pubkey.type
  }
  if (keySize == null && typeof peerCert?.bits === 'number') {
    keySize = peerCert.bits
  }

  return { publicKeyAlgorithm, keySize }
}

const isWeakSignature = (algorithm) => {
  if (!algorithm) return false
  return WEAK_SIGNATURE_PATTERNS.some((re) => re.test(algorithm))
}

const isStrongKey = (algorithm, keySize) => {
  if (!keySize || typeof keySize !== 'number') return false
  const algo = String(algorithm || '').toLowerCase()
  if (algo.includes('ec') || algo.includes('ed25519') || algo.includes('ed448')) {
    return keySize >= MIN_EC_KEY_BITS
  }
  return keySize >= MIN_RSA_KEY_BITS
}

const checkHostnameMatch = (hostname, peerCert) => {
  try {
    const err = tls.checkServerIdentity(hostname, peerCert)
    return !err
  } catch (_) {
    return false
  }
}

const isSelfSigned = (peerCert, authorizationError) => {
  if (authorizationError && /SELF_SIGNED/i.test(authorizationError)) return true
  const subject = formatDn(peerCert.subject)
  const issuer = formatDn(peerCert.issuer)
  if (subject && issuer && subject === issuer) return true
  if (peerCert.issuerCertificate && peerCert.issuerCertificate === peerCert) return true
  return false
}

/**
 * @param {import('./types').TlsConnectResult} connectResult
 */
const analyzeCertificate = (connectResult) => {
  const findings = []
  const peerCert = connectResult.peerCertificate
  const hostname = connectResult.hostname

  if (!peerCert || !Object.keys(peerCert).length) {
    findings.push({
      title: 'Certificate unavailable',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'No peer certificate was returned by the TLS handshake.',
      recommendation: 'Ensure the server presents a valid TLS certificate.'
    })
    return {
      certificate: null,
      findings,
      flags: {
        hostnameMatch: false,
        certValid: false,
        selfSigned: false,
        expired: false,
        notYetValid: false,
        expiringSoon: false,
        weakSignature: false,
        weakKey: false,
        chainValid: false,
        daysRemaining: null
      }
    }
  }

  let x509 = null
  try {
    if (connectResult.rawCertificate) {
      x509 = new crypto.X509Certificate(connectResult.rawCertificate)
    }
  } catch (_) {}

  const commonName = peerCert.subject?.CN || x509?.subject?.match(/CN=([^,\n]+)/)?.[1] || null
  const san = parseSan(peerCert, x509)
  const { publicKeyAlgorithm, keySize } = getKeyInfo(peerCert, x509)

  const validFromDate = peerCert.valid_from ? new Date(peerCert.valid_from) : (x509 ? new Date(x509.validFrom) : null)
  const validUntilDate = peerCert.valid_to ? new Date(peerCert.valid_to) : (x509 ? new Date(x509.validTo) : null)
  const now = Date.now()

  let daysRemaining = null
  if (validUntilDate && !Number.isNaN(validUntilDate.getTime())) {
    daysRemaining = Math.floor((validUntilDate.getTime() - now) / (24 * 60 * 60 * 1000))
  }

  const signatureAlgorithm =
    peerCert.sigalg ||
    x509?.signatureAlgorithm ||
    null

  const fingerprintSHA1 =
    peerCert.fingerprint ||
    x509?.fingerprint ||
    null

  const fingerprintSHA256 =
    peerCert.fingerprint256 ||
    x509?.fingerprint256 ||
    null

  const certificate = {
    subject: formatDn(peerCert.subject) || x509?.subject || null,
    issuer: formatDn(peerCert.issuer) || x509?.issuer || null,
    commonName,
    san,
    serialNumber: peerCert.serialNumber || x509?.serialNumber || null,
    signatureAlgorithm,
    publicKeyAlgorithm,
    keySize,
    validFrom: validFromDate && !Number.isNaN(validFromDate.getTime()) ? validFromDate.toISOString() : null,
    validUntil: validUntilDate && !Number.isNaN(validUntilDate.getTime()) ? validUntilDate.toISOString() : null,
    daysRemaining,
    fingerprintSHA1,
    fingerprintSHA256
  }

  const expired = daysRemaining !== null && daysRemaining < 0
  const notYetValid = Boolean(
    validFromDate && !Number.isNaN(validFromDate.getTime()) && validFromDate.getTime() > now
  )
  const expiringSoon =
    daysRemaining !== null &&
    daysRemaining >= 0 &&
    daysRemaining <= getExpiryWarnDays()
  const selfSigned = isSelfSigned(peerCert, connectResult.authorizationError)
  const hostnameMatch = checkHostnameMatch(hostname, peerCert)
  const weakSignature = isWeakSignature(signatureAlgorithm)
  const weakKey = !isStrongKey(publicKeyAlgorithm, keySize)
  const chainValid = Boolean(connectResult.authorized)

  if (expired) {
    findings.push({
      title: 'Expired certificate',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `Certificate expired ${Math.abs(daysRemaining)} day(s) ago.`,
      recommendation: 'Renew and redeploy a valid TLS certificate immediately.'
    })
  } else if (notYetValid) {
    findings.push({
      title: 'Certificate not yet valid',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'Certificate valid-from date is in the future.',
      recommendation: 'Install a certificate that is currently within its validity period.'
    })
  } else if (expiringSoon) {
    findings.push({
      title: 'Certificate expiring soon',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Certificate expires in ${daysRemaining} day(s).`,
      recommendation: 'Renew the certificate before expiry to avoid service disruption.'
    })
  } else {
    findings.push({
      title: 'Certificate validity period',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Certificate is valid with ${daysRemaining} day(s) remaining.`,
      recommendation: 'No action required.'
    })
  }

  if (selfSigned) {
    findings.push({
      title: 'Self-signed certificate',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'The certificate appears to be self-signed.',
      recommendation: 'Use a certificate issued by a trusted Certificate Authority.'
    })
  }

  if (!hostnameMatch) {
    findings.push({
      title: 'Hostname mismatch',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `Certificate CN/SAN does not match hostname "${hostname}".`,
      recommendation: 'Issue a certificate that includes the correct DNS name in CN or SAN.'
    })
  } else {
    findings.push({
      title: 'Hostname match',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: 'Certificate identity matches the requested hostname.',
      recommendation: 'No action required.'
    })
  }

  if (weakSignature) {
    findings.push({
      title: 'Weak signature algorithm',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `Certificate uses weak signature algorithm: ${signatureAlgorithm}.`,
      recommendation: 'Reissue the certificate using SHA-256 or stronger.'
    })
  }

  if (weakKey) {
    findings.push({
      title: 'Weak key',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `Public key strength is insufficient (${publicKeyAlgorithm || 'unknown'}, ${keySize || 'unknown'} bits).`,
      recommendation: `Use RSA ≥ ${MIN_RSA_KEY_BITS} bits or EC ≥ ${MIN_EC_KEY_BITS} bits.`
    })
  } else if (keySize) {
    findings.push({
      title: 'Key strength',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Key strength is adequate (${publicKeyAlgorithm}, ${keySize} bits).`,
      recommendation: 'No action required.'
    })
  }

  if (!chainValid && !selfSigned) {
    findings.push({
      title: 'Invalid certificate chain',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: connectResult.authorizationError
        ? `Certificate chain validation failed: ${connectResult.authorizationError}`
        : 'Certificate chain could not be validated by the platform trust store.',
      recommendation: 'Install intermediate certificates and ensure the chain is complete.'
    })
  } else if (chainValid) {
    findings.push({
      title: 'Certificate chain',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: 'Certificate chain validated successfully.',
      recommendation: 'No action required.'
    })
  }

  return {
    certificate,
    findings,
    flags: {
      hostnameMatch,
      certValid: !expired && !notYetValid && !selfSigned && chainValid,
      selfSigned,
      expired,
      notYetValid,
      expiringSoon,
      weakSignature,
      weakKey,
      chainValid,
      daysRemaining
    }
  }
}

module.exports = {
  analyzeCertificate,
  isStrongKey,
  isWeakSignature,
  checkHostnameMatch
}

/**
 * @typedef {'fail'|'warn'|'pass'} FindingStatus
 * @typedef {'low'|'medium'|'high'|'info'} FindingSeverity
 * @typedef {'A'|'B'|'C'|'D'|'F'} SslGrade
 * @typedef {'low'|'medium'|'high'} SslRisk
 */

/**
 * @typedef {Object} SslFinding
 * @property {string} title
 * @property {FindingSeverity} severity
 * @property {FindingStatus} status
 * @property {string} description
 * @property {string} recommendation
 */

/**
 * @typedef {Object} CertificateInfo
 * @property {string|null} subject
 * @property {string|null} issuer
 * @property {string|null} commonName
 * @property {string[]} san
 * @property {string|null} serialNumber
 * @property {string|null} signatureAlgorithm
 * @property {string|null} publicKeyAlgorithm
 * @property {number|null} keySize
 * @property {string|null} validFrom
 * @property {string|null} validUntil
 * @property {number|null} daysRemaining
 * @property {string|null} fingerprintSHA1
 * @property {string|null} fingerprintSHA256
 */

/**
 * @typedef {Object} TlsInfo
 * @property {string|null} version
 * @property {boolean} httpsEnabled
 * @property {boolean} supportsTls10
 * @property {boolean} supportsTls11
 * @property {boolean} supportsTls12
 * @property {boolean} supportsTls13
 * @property {boolean} weakProtocol
 */

/**
 * @typedef {Object} SslScoreResult
 * @property {number} score
 * @property {SslGrade} grade
 * @property {SslRisk} risk
 */

/**
 * @typedef {Object} TlsConnectResult
 * @property {boolean} httpsEnabled
 * @property {string|null} protocol
 * @property {boolean} authorized
 * @property {string|null} authorizationError
 * @property {Object|null} peerCertificate
 * @property {Buffer|null} rawCertificate
 * @property {string} hostname
 * @property {number} port
 */

/**
 * @typedef {Object} SslScanResult
 * @property {'ssl'} module
 * @property {'ssl'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {SslGrade} grade
 * @property {SslRisk} risk
 * @property {CertificateInfo|null} certificate
 * @property {TlsInfo} tls
 * @property {SslFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

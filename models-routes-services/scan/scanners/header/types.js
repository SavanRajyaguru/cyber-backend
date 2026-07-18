/**
 * @typedef {'good'|'warn'|'bad'|'info'} HeaderStatus
 * @typedef {'low'|'medium'|'high'|'info'} HeaderSeverity
 * @typedef {'A'|'B'|'C'|'D'|'F'} HeaderGrade
 * @typedef {'low'|'medium'|'high'} HeaderRisk
 */

/**
 * @typedef {Object} HeaderAnalysis
 * @property {boolean} present
 * @property {string|null} value
 * @property {HeaderStatus} status
 * @property {HeaderSeverity} severity
 * @property {string} recommendation
 */

/**
 * @typedef {Object} HeaderFinding
 * @property {string} header
 * @property {string} code
 * @property {HeaderSeverity} severity
 * @property {string} message
 */

/**
 * @typedef {Object} HeaderScoreResult
 * @property {number} score
 * @property {HeaderGrade} grade
 * @property {HeaderRisk} risk
 */

/**
 * @typedef {Object} RedirectHop
 * @property {string} from
 * @property {string} to
 * @property {number|null} status
 */

/**
 * @typedef {Object} HeaderScanResult
 * @property {'header'} module
 * @property {'header'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {HeaderGrade} grade
 * @property {HeaderRisk} risk
 * @property {RedirectHop[]} redirects
 * @property {string} finalUrl
 * @property {number} responseTime
 * @property {number|null} statusCode
 * @property {Record<string, HeaderAnalysis>} headers
 * @property {HeaderFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 * @property {string} [sError]
 * @property {string} [errorCode]
 */

/**
 * @typedef {Object} HttpFetchResult
 * @property {string} startUrl
 * @property {string} finalUrl
 * @property {number} statusCode
 * @property {Record<string, string>} headers
 * @property {number} responseTime
 * @property {RedirectHop[]} redirects
 */

module.exports = {}

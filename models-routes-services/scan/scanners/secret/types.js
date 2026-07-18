/**
 * @typedef {'Critical'|'High'|'Medium'|'Low'|'Info'} SecretSeverity
 * @typedef {'A'|'B'|'C'|'D'|'F'} SecretGrade
 * @typedef {'low'|'medium'|'high'|'critical'} SecretRisk
 */

/**
 * @typedef {Object} SecretPattern
 * @property {string} name
 * @property {string} type
 * @property {RegExp} pattern
 * @property {SecretSeverity} severity
 * @property {string} recommendation
 * @property {(value: string) => boolean} [validate]
 */

/**
 * @typedef {Object} SecretFinding
 * @property {string} type
 * @property {SecretSeverity} severity
 * @property {string} title
 * @property {string} resource
 * @property {string} matchedValuePreview
 * @property {number|null} line
 * @property {string} recommendation
 */

/**
 * @typedef {Object} SecretScanResult
 * @property {'secret'} module
 * @property {'secret'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {SecretGrade} grade
 * @property {SecretRisk} risk
 * @property {Object} summary
 * @property {SecretFinding[]} findings
 * @property {Object} oMeta
 */

module.exports = {}

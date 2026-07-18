/**
 * Response schema (JSDoc) for the Infrastructure Discovery scanner.
 *
 * @typedef {'High'|'Medium'|'Low'|'Info'} InfraSeverity
 * @typedef {'Fail'|'Warn'|'Pass'|'Info'} InfraFindingStatus
 * @typedef {'A'|'B'|'C'|'D'|'F'} InfraGrade
 * @typedef {'low'|'medium'|'high'} InfraRisk
 *
 * @typedef {Object} InfraFinding
 * @property {string} title
 * @property {InfraSeverity} severity
 * @property {InfraFindingStatus} status
 * @property {string} description
 * @property {string} recommendation
 *
 * @typedef {Object} InfraScanResult
 * @property {'infrastructure'} module
 * @property {'infrastructure'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {InfraGrade} grade
 * @property {InfraRisk} risk
 * @property {Object} hosting
 * @property {Object} network
 * @property {Object} server
 * @property {Object} email
 * @property {Object} cdn
 * @property {Object} cloud
 * @property {InfraFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

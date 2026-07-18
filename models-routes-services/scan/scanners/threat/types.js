/**
 * Threat Intelligence scanner response schema (JSDoc).
 *
 * @typedef {'Critical'|'High'|'Medium'|'Low'|'Informational'} ThreatSeverity
 * @typedef {'A'|'B'|'C'|'D'|'F'} ThreatGrade
 * @typedef {'low'|'medium'|'high'|'critical'} ThreatRisk
 *
 * @typedef {Object} ThreatFinding
 * @property {string} title
 * @property {string} category
 * @property {ThreatSeverity} severity
 * @property {number} confidence
 * @property {string} affectedModule
 * @property {string} description
 * @property {string} recommendation
 *
 * @typedef {Object} AttackSurfaceSummary
 * @property {string} externalExposure
 * @property {string} configurationRisk
 * @property {string} emailSecurityRisk
 * @property {string} headerRisk
 * @property {string} technologyRisk
 * @property {string} secretExposure
 * @property {string} overallRisk
 *
 * @typedef {Object} ThreatProviderResult
 * @property {string} provider
 * @property {boolean} enabled
 * @property {ThreatFinding[]} findings
 * @property {Object} [meta]
 *
 * @typedef {Object} ThreatScanResult
 * @property {'threat'} module
 * @property {'threat'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {ThreatGrade} grade
 * @property {ThreatRisk} risk
 * @property {Object} summary
 * @property {ThreatFinding[]} findings
 * @property {Object} categories
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

/**
 * Compliance engine response schema (JSDoc).
 *
 * @typedef {'pass'|'fail'|'not_applicable'} ControlStatus
 * @typedef {'Critical'|'High'|'Medium'|'Low'|'Info'} ComplianceSeverity
 * @typedef {'A'|'B'|'C'|'D'|'F'} ComplianceGrade
 * @typedef {'critical'|'high'|'medium'|'low'} ComplianceRisk
 *
 * @typedef {Object} NormalizedFinding
 * @property {string} id
 * @property {string} module
 * @property {string} category
 * @property {string} severity
 * @property {string} title
 * @property {string} status
 * @property {string} evidence
 * @property {string} recommendation
 *
 * @typedef {Object} ComplianceRule
 * @property {string} id
 * @property {string} framework
 * @property {string} control
 * @property {string} title
 * @property {ComplianceSeverity} severity
 * @property {string} description
 * @property {string} recommendation
 * @property {string} evidenceSource
 * @property {(ctx: { sources: Object, findings: NormalizedFinding[] }) => ControlStatus} evaluate
 *
 * @typedef {Object} ComplianceControlResult
 * @property {string} controlId
 * @property {string} title
 * @property {ControlStatus} status
 * @property {ComplianceSeverity} severity
 * @property {string|null} evidence
 * @property {string} recommendation
 * @property {string} [description]
 * @property {string} [ruleId]
 *
 * @typedef {Object} FrameworkResult
 * @property {string} framework
 * @property {number} score
 * @property {number} passed
 * @property {number} failed
 * @property {number} notApplicable
 * @property {ComplianceControlResult[]} controls
 *
 * @typedef {Object} ComplianceScanResult
 * @property {'compliance'} module
 * @property {'compliance'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {ComplianceGrade} grade
 * @property {ComplianceRisk} risk
 * @property {FrameworkResult[]} frameworks
 * @property {Object} summary
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

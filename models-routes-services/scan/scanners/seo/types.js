/**
 * Response schema (JSDoc) for the SEO / On-Page scanner.
 *
 * @typedef {'High'|'Medium'|'Low'|'Info'} SeoSeverity
 * @typedef {'Fail'|'Warn'|'Pass'|'Info'} SeoFindingStatus
 * @typedef {'A'|'B'|'C'|'D'|'F'} SeoGrade
 * @typedef {'low'|'medium'|'high'} SeoRisk
 *
 * @typedef {Object} SeoFinding
 * @property {string} title
 * @property {SeoSeverity} severity
 * @property {SeoFindingStatus} status
 * @property {string} description
 * @property {string} recommendation
 *
 * @typedef {Object} SeoScanResult
 * @property {'seo'} module
 * @property {'seo'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {SeoGrade} grade
 * @property {SeoRisk} risk
 * @property {Object} summary
 * @property {Object} title
 * @property {Object} meta
 * @property {Object} headings
 * @property {Object} images
 * @property {Object} links
 * @property {Object} structuredData
 * @property {Object} social
 * @property {Object} robots
 * @property {Object} content
 * @property {Object} favicon
 * @property {SeoFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

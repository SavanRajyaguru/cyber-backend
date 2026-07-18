/**
 * @typedef {'Frontend'|'Backend'|'CMS'|'Server'|'CDN'|'Analytics'|'Library'|'Hosting'} TechCategory
 */

/**
 * @typedef {Object} DetectedTechnology
 * @property {string} name
 * @property {TechCategory} category
 * @property {string|null} version
 * @property {number} confidence
 * @property {string} evidence
 */

/**
 * @typedef {Object} TechFinding
 * @property {string} title
 * @property {'info'} severity
 * @property {'info'} status
 * @property {string} description
 * @property {string} recommendation
 */

/**
 * @typedef {Object} TechnologyScanResult
 * @property {'technology'} module
 * @property {'technology'} sModule
 * @property {string} eStatus
 * @property {null} score
 * @property {null} nScore
 * @property {Object} summary
 * @property {DetectedTechnology[]} frontend
 * @property {DetectedTechnology[]} backend
 * @property {DetectedTechnology[]} cms
 * @property {DetectedTechnology[]} server
 * @property {DetectedTechnology[]} cdn
 * @property {DetectedTechnology[]} analytics
 * @property {DetectedTechnology[]} libraries
 * @property {DetectedTechnology[]} hosting
 * @property {TechFinding[]} findings
 * @property {Object} oMeta
 */

module.exports = {}

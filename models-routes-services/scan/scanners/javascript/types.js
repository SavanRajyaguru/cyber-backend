/**
 * @typedef {'High'|'Medium'|'Low'|'Info'} JsSeverity
 * @typedef {'Warning'|'Fail'|'Pass'|'Info'} JsFindingStatus
 * @typedef {'A'|'B'|'C'|'D'|'F'} JsGrade
 * @typedef {'low'|'medium'|'high'} JsRisk
 * @typedef {'local'|'external'|'inline'} ScriptKind
 * @typedef {'minified'|'beautified'|'readable'} MinificationState
 */

/**
 * @typedef {Object} JsFinding
 * @property {string} title
 * @property {JsSeverity} severity
 * @property {JsFindingStatus} status
 * @property {string} description
 * @property {string} recommendation
 * @property {string} resource
 */

/**
 * @typedef {Object} ScriptInfo
 * @property {string} url
 * @property {ScriptKind} kind
 * @property {boolean} isModule
 * @property {string|null} contentType
 * @property {number|null} fileSize
 * @property {number|null} statusCode
 * @property {number|null} loadTime
 * @property {MinificationState|null} minification
 * @property {boolean} sourceMapAvailable
 * @property {string|null} error
 */

/**
 * @typedef {Object} DetectedLibrary
 * @property {string} name
 * @property {string|null} version
 * @property {string} evidence
 * @property {string} resource
 */

/**
 * @typedef {Object} JavascriptScanResult
 * @property {'javascript'} module
 * @property {'javascript'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {JsGrade} grade
 * @property {JsRisk} risk
 * @property {ScriptInfo[]} scripts
 * @property {DetectedLibrary[]} libraries
 * @property {JsFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

/**
 * Response schema (JSDoc) for the Performance scanner.
 *
 * @typedef {'High'|'Medium'|'Low'|'Info'} PerfSeverity
 * @typedef {'Fail'|'Warn'|'Pass'|'Info'} PerfFindingStatus
 * @typedef {'A'|'B'|'C'|'D'|'F'} PerfGrade
 * @typedef {'low'|'medium'|'high'} PerfRisk
 *
 * @typedef {Object} PerfFinding
 * @property {string} title
 * @property {PerfSeverity} severity
 * @property {PerfFindingStatus} status
 * @property {string} description
 * @property {string} recommendation
 *
 * @typedef {Object} PerfTimings
 * @property {number|null} dnsLookupMs
 * @property {number|null} tcpConnectMs
 * @property {number|null} tlsHandshakeMs
 * @property {number|null} ttfbMs
 * @property {number|null} downloadMs
 * @property {number|null} totalMs
 * @property {number|null} responseSize
 * @property {string|null} httpVersion
 * @property {boolean} http2
 * @property {boolean|null} http3
 *
 * @typedef {Object} PerfScanResult
 * @property {'performance'} module
 * @property {'performance'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {PerfGrade} grade
 * @property {PerfRisk} risk
 * @property {PerfTimings} timings
 * @property {Object} resources
 * @property {Object} compression
 * @property {Object} images
 * @property {Object} fonts
 * @property {Object} optimization
 * @property {PerfFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

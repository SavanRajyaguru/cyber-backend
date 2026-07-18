/**
 * @typedef {'fail'|'warn'|'pass'} FindingStatus
 * @typedef {'low'|'medium'|'high'|'info'} FindingSeverity
 * @typedef {'A'|'B'|'C'|'D'|'F'} DnsGrade
 * @typedef {'low'|'medium'|'high'} DnsRisk
 */

/**
 * @typedef {Object} DnsFinding
 * @property {string} title
 * @property {FindingSeverity} severity
 * @property {FindingStatus} status
 * @property {string} description
 * @property {string} recommendation
 */

/**
 * @typedef {Object} SpfInfo
 * @property {boolean} exists
 * @property {string[]} records
 * @property {boolean} multiple
 * @property {'hardfail'|'softfail'|'neutral'|'unknown'|null} policy
 * @property {string|null} raw
 */

/**
 * @typedef {Object} DmarcInfo
 * @property {boolean} exists
 * @property {string|null} policy
 * @property {string|null} percentage
 * @property {string|null} rua
 * @property {string|null} ruf
 * @property {string|null} raw
 */

/**
 * @typedef {Object} DkimInfo
 * @property {'found'|'unknown'} status
 * @property {string|null} selector
 * @property {string[]} selectorsTried
 * @property {string|null} record
 */

/**
 * @typedef {Object} DnsRecords
 * @property {string[]} A
 * @property {string[]} AAAA
 * @property {string[]} CNAME
 * @property {Array<{exchange:string, priority:number}>} MX
 * @property {string[]} NS
 * @property {string[]} TXT
 * @property {Object|null} SOA
 * @property {Array<{critical:boolean, issue:string}>} CAA
 * @property {string[]} PTR
 * @property {SpfInfo} SPF
 * @property {DmarcInfo} DMARC
 * @property {DkimInfo} DKIM
 * @property {{ detectable: boolean, enabled: boolean|null }} DNSSEC
 */

/**
 * @typedef {Object} DnsScoreResult
 * @property {number} score
 * @property {DnsGrade} grade
 * @property {DnsRisk} risk
 */

/**
 * @typedef {Object} DnsScanResult
 * @property {'dns'} module
 * @property {'dns'} sModule
 * @property {string} eStatus
 * @property {number} score
 * @property {number} nScore
 * @property {DnsGrade} grade
 * @property {DnsRisk} risk
 * @property {DnsRecords} records
 * @property {DnsFinding[]} findings
 * @property {string[]} recommendations
 * @property {Object} oMeta
 */

module.exports = {}

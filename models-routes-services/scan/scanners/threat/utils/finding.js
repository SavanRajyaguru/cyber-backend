const { SEVERITY } = require('../constants')

/**
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.category
 * @param {string} [params.severity]
 * @param {number} [params.confidence]
 * @param {string} params.affectedModule
 * @param {string} params.description
 * @param {string} params.recommendation
 * @returns {import('../types').ThreatFinding}
 */
const makeThreatFinding = ({
  title,
  category,
  severity = SEVERITY.INFORMATIONAL,
  confidence = 70,
  affectedModule,
  description,
  recommendation
}) => ({
  title,
  category,
  severity,
  confidence: Math.max(0, Math.min(100, Number(confidence) || 0)),
  affectedModule,
  description,
  recommendation
})

/**
 * Map heterogeneous scanner severities into ThreatSeverity.
 * @param {string} raw
 * @returns {string}
 */
const normalizeSeverity = (raw) => {
  const s = String(raw || '').toLowerCase()
  if (s === 'critical') return SEVERITY.CRITICAL
  if (s === 'high') return SEVERITY.HIGH
  if (s === 'medium' || s === 'med') return SEVERITY.MEDIUM
  if (s === 'low') return SEVERITY.LOW
  if (s === 'info' || s === 'informational') return SEVERITY.INFORMATIONAL
  return SEVERITY.MEDIUM
}

/**
 * Map fail/warn/pass style statuses to severity when severity missing.
 * @param {string} status
 */
const statusToSeverity = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'fail') return SEVERITY.HIGH
  if (s === 'warn') return SEVERITY.MEDIUM
  if (s === 'pass') return SEVERITY.INFORMATIONAL
  return SEVERITY.LOW
}

module.exports = {
  makeThreatFinding,
  normalizeSeverity,
  statusToSeverity
}

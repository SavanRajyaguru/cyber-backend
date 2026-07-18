const { SEVERITY, FINDING_STATUS } = require('../constants')

/**
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.severity]
 * @param {string} [params.status]
 * @param {string} params.description
 * @param {string} params.recommendation
 * @returns {import('../types').SeoFinding}
 */
const makeFinding = ({
  title,
  severity = SEVERITY.INFO,
  status = FINDING_STATUS.INFO,
  description,
  recommendation
}) => ({
  title,
  severity,
  status,
  description,
  recommendation
})

module.exports = {
  makeFinding,
  SEVERITY,
  FINDING_STATUS
}

const { CONTROL_STATUS } = require('../constants')

/**
 * Create a compliance rule object.
 * @param {Object} def
 * @param {string} def.id
 * @param {string} def.framework
 * @param {string} def.control
 * @param {string} def.title
 * @param {string} def.severity
 * @param {string} def.description
 * @param {string} def.recommendation
 * @param {string} def.evidenceSource
 * @param {(ctx: { sources: Object, findings: import('../types').NormalizedFinding[] }) => string} def.evaluate
 * @returns {import('../types').ComplianceRule}
 */
const defineRule = (def) => {
  if (!def?.id || !def.framework || !def.control || typeof def.evaluate !== 'function') {
    throw new Error(`Invalid compliance rule: ${def?.id || 'unknown'}`)
  }
  return {
    id: def.id,
    framework: def.framework,
    control: def.control,
    title: def.title || def.control,
    severity: def.severity || 'Medium',
    description: def.description || '',
    recommendation: def.recommendation || '',
    evidenceSource: def.evidenceSource || 'unknown',
    evaluate: (ctx) => {
      try {
        const status = def.evaluate(ctx)
        if (
          status === CONTROL_STATUS.PASS ||
          status === CONTROL_STATUS.FAIL ||
          status === CONTROL_STATUS.NOT_APPLICABLE
        ) {
          return status
        }
        return CONTROL_STATUS.NOT_APPLICABLE
      } catch {
        return CONTROL_STATUS.NOT_APPLICABLE
      }
    }
  }
}

module.exports = {
  defineRule,
  CONTROL_STATUS
}

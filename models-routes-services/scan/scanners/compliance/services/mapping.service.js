const { CONTROL_STATUS } = require('../constants')
const { FRAMEWORK_REGISTRY } = require('../frameworks')
const { runRuleEngine } = require('../engine/rule-engine')

/**
 * Map evaluations into per-framework result objects.
 * @param {Object} params
 * @param {Record<string, Object|null>} params.sources
 * @param {import('../types').NormalizedFinding[]} params.findings
 * @returns {{
 *   frameworks: import('../types').FrameworkResult[],
 *   evaluations: Array,
 *   stats: Object
 * }}
 */
const mapToFrameworks = ({ sources, findings }) => {
  const { evaluations, stats } = runRuleEngine({ sources, findings })

  /** @type {import('../types').FrameworkResult[]} */
  const frameworks = FRAMEWORK_REGISTRY.map((fw) => {
    const fwEvals = evaluations.filter((e) => e.rule.framework === fw.name)

    const controls = fwEvals.map((e) => ({
      controlId: e.rule.control,
      title: e.rule.title,
      status: e.status,
      severity: e.rule.severity,
      evidence: e.evidence,
      recommendation: e.rule.recommendation,
      description: e.rule.description,
      ruleId: e.rule.id
    }))

    const passed = controls.filter((c) => c.status === CONTROL_STATUS.PASS).length
    const failed = controls.filter((c) => c.status === CONTROL_STATUS.FAIL).length
    const notApplicable = controls.filter((c) => c.status === CONTROL_STATUS.NOT_APPLICABLE).length
    const applicable = passed + failed
    // No evidence yet → 0 (unknown), not a perfect score
    const score = applicable === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((passed / applicable) * 100)))

    return {
      framework: fw.name,
      score,
      passed,
      failed,
      notApplicable,
      controls
    }
  })

  return { frameworks, evaluations, stats }
}

module.exports = {
  mapToFrameworks
}

const { CONTROL_STATUS } = require('../constants')
const { getAllRules, FRAMEWORK_REGISTRY, listFrameworks } = require('../frameworks')

/**
 * Evaluate all compliance rules against sources + normalized findings.
 * Soft-fails per rule.
 *
 * @param {Object} params
 * @param {Record<string, Object|null>} params.sources
 * @param {import('../types').NormalizedFinding[]} params.findings
 * @returns {{
 *   evaluations: Array<{
 *     rule: import('../types').ComplianceRule,
 *     status: string,
 *     evidence: string|null
 *   }>,
 *   stats: Object
 * }}
 */
const runRuleEngine = ({ sources = {}, findings = [] }) => {
  const rules = getAllRules()
  const evaluations = []
  let errors = 0

  for (const rule of rules) {
    try {
      const status = rule.evaluate({ sources, findings })
      let evidence = null

      if (status === CONTROL_STATUS.FAIL) {
        // Prefer related normalized finding as evidence
        const related = findings.find((f) =>
          f.module === rule.evidenceSource &&
          /fail|warn|missing|weak|exposed|critical/i.test(`${f.status} ${f.title}`)
        )
        evidence = related?.evidence || related?.title ||
          `${rule.evidenceSource}: control failed`
      } else if (status === CONTROL_STATUS.PASS) {
        evidence = `${rule.evidenceSource}: control satisfied`
      }

      evaluations.push({ rule, status, evidence })
    } catch (error) {
      errors += 1
      evaluations.push({
        rule,
        status: CONTROL_STATUS.NOT_APPLICABLE,
        evidence: error?.message || 'Rule evaluation error'
      })
    }
  }

  return {
    evaluations,
    stats: {
      totalRules: rules.length,
      frameworks: listFrameworks().length,
      errors
    }
  }
}

module.exports = {
  runRuleEngine,
  FRAMEWORK_REGISTRY,
  listFrameworks
}

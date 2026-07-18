const { RULE_REGISTRY } = require('../rules')

/**
 * Run all registered correlation rules against sibling scanner outputs.
 * Soft-fails per rule — never throws.
 *
 * @param {Record<string, Object|null>} sources
 * @returns {{ findings: import('../types').ThreatFinding[], ruleStats: Object[] }}
 */
const runRuleEngine = (sources = {}) => {
  const findings = []
  const ruleStats = []

  for (const rule of RULE_REGISTRY) {
    const input = sources[rule.sourceModule] || null
    try {
      const produced = input ? rule.apply(input) : []
      const list = Array.isArray(produced) ? produced : []
      findings.push(...list)
      ruleStats.push({
        rule: rule.name,
        sourceModule: rule.sourceModule,
        sourceAvailable: Boolean(input),
        findings: list.length
      })
    } catch (error) {
      ruleStats.push({
        rule: rule.name,
        sourceModule: rule.sourceModule,
        sourceAvailable: Boolean(input),
        findings: 0,
        error: error?.message || 'Rule failed'
      })
    }
  }

  return { findings, ruleStats }
}

module.exports = {
  runRuleEngine
}

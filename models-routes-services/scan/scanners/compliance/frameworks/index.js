const owaspTop10 = require('./owasp-top10')
const owaspAsvs = require('./owasp-asvs')
const cis = require('./cis')
const nist = require('./nist')
const pci = require('./pci')
const gdpr = require('./gdpr')
const soc2 = require('./soc2')
const iso27001 = require('./iso27001')

/**
 * Framework registry — add new frameworks here without changing the core engine.
 * Each entry: { id, name, getRules: () => ComplianceRule[] }
 * @type {Array<{ id: string, name: string, getRules: Function }>}
 */
const FRAMEWORK_REGISTRY = [
  owaspTop10,
  owaspAsvs,
  cis,
  nist,
  pci,
  gdpr,
  soc2,
  iso27001
]

/**
 * Collect all rules from registered frameworks.
 * @returns {import('../types').ComplianceRule[]}
 */
const getAllRules = () => {
  const rules = []
  for (const fw of FRAMEWORK_REGISTRY) {
    try {
      const list = fw.getRules()
      if (Array.isArray(list)) rules.push(...list)
    } catch {
      // skip broken framework modules
    }
  }
  return rules
}

/**
 * @returns {string[]}
 */
const listFrameworks = () => FRAMEWORK_REGISTRY.map((f) => f.name)

module.exports = {
  FRAMEWORK_REGISTRY,
  getAllRules,
  listFrameworks
}

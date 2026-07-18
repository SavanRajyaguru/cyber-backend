const headersRule = require('./headers.rule')
const sslRule = require('./ssl.rule')
const dnsRule = require('./dns.rule')
const technologyRule = require('./technology.rule')
const javascriptRule = require('./javascript.rule')
const secretRule = require('./secret.rule')
const seoRule = require('./seo.rule')
const performanceRule = require('./performance.rule')
const infrastructureRule = require('./infrastructure.rule')

/**
 * Ordered rule registry — each rule maps a sibling module → threat findings.
 * @type {Array<{ name: string, sourceModule: string, apply: Function }>}
 */
const RULE_REGISTRY = [
  headersRule,
  sslRule,
  dnsRule,
  technologyRule,
  javascriptRule,
  secretRule,
  seoRule,
  performanceRule,
  infrastructureRule
]

module.exports = {
  RULE_REGISTRY
}

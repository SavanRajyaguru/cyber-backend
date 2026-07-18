const { SECRET_PATTERNS } = require('../patterns/secret.patterns')
const { runPatterns } = require('./base.analyzer')

const CRED_TYPES = new Set([
  'smtp_credentials',
  'basic_auth',
  'webhook_url',
  'internal_api',
  'dev_url'
])

const PATTERNS = SECRET_PATTERNS.filter((p) => CRED_TYPES.has(p.type))

/**
 * @param {string} content
 * @param {string} resource
 */
const analyzeCredentials = (content, resource) => runPatterns(content, resource, PATTERNS)

module.exports = { analyzeCredentials }

const { SECRET_PATTERNS } = require('../patterns/secret.patterns')
const { runPatterns } = require('./base.analyzer')

const KEY_TYPES = new Set([
  'rsa_private_key',
  'pem_private_key',
  'ssh_key'
])

const PATTERNS = SECRET_PATTERNS.filter((p) => KEY_TYPES.has(p.type))

/**
 * @param {string} content
 * @param {string} resource
 */
const analyzePrivateKeys = (content, resource) => runPatterns(content, resource, PATTERNS)

module.exports = { analyzePrivateKeys }

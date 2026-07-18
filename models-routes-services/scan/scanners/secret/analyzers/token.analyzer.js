const { SECRET_PATTERNS } = require('../patterns/secret.patterns')
const { runPatterns } = require('./base.analyzer')

const TOKEN_TYPES = new Set([
  'github_token',
  'gitlab_token',
  'slack_token',
  'discord_token',
  'jwt_token',
  'bearer_token',
  'oauth_token'
])

const PATTERNS = SECRET_PATTERNS.filter((p) => TOKEN_TYPES.has(p.type))

/**
 * @param {string} content
 * @param {string} resource
 */
const analyzeTokens = (content, resource) => runPatterns(content, resource, PATTERNS)

module.exports = { analyzeTokens }

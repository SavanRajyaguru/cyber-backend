const { SECRET_PATTERNS } = require('../patterns/secret.patterns')
const { runPatterns } = require('./base.analyzer')

const DB_TYPES = new Set([
  'mongodb_uri',
  'postgres_uri',
  'redis_uri',
  's3_bucket_url'
])

const PATTERNS = SECRET_PATTERNS.filter((p) => DB_TYPES.has(p.type))

/**
 * @param {string} content
 * @param {string} resource
 */
const analyzeDatabases = (content, resource) => runPatterns(content, resource, PATTERNS)

module.exports = { analyzeDatabases }

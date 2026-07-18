const { analyzeApiKeys } = require('./api-key.analyzer')
const { analyzeTokens } = require('./token.analyzer')
const { analyzeDatabases } = require('./database.analyzer')
const { analyzeCredentials } = require('./credentials.analyzer')
const { analyzePrivateKeys } = require('./privatekey.analyzer')
const { dedupeFindings } = require('./base.analyzer')

/**
 * Run all secret analyzers on a resource body.
 * @param {string} content
 * @param {string} resource
 * @returns {import('../types').SecretFinding[]}
 */
const analyzeSecrets = (content, resource) => {
  const findings = [
    ...analyzeApiKeys(content, resource),
    ...analyzeTokens(content, resource),
    ...analyzeDatabases(content, resource),
    ...analyzeCredentials(content, resource),
    ...analyzePrivateKeys(content, resource)
  ]
  return dedupeFindings(findings)
}

module.exports = {
  analyzeSecrets
}

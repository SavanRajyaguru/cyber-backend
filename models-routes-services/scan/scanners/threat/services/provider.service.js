const { isThreatProvider } = require('../providers/base.provider')
const { localProvider } = require('../providers/local.provider')

/**
 * Registry of threat intelligence providers.
 * Add future providers here without changing threat.service core flow.
 * @type {import('../providers/base.provider').ThreatProvider[]}
 */
const PROVIDERS = [localProvider]

/**
 * Register a provider at runtime (tests / future plugins).
 * @param {import('../providers/base.provider').ThreatProvider} provider
 */
const registerProvider = (provider) => {
  if (!isThreatProvider(provider)) {
    throw new Error('Invalid threat provider: expected { name, enrich() }')
  }
  const idx = PROVIDERS.findIndex((p) => p.name === provider.name)
  if (idx >= 0) PROVIDERS[idx] = provider
  else PROVIDERS.push(provider)
}

/**
 * Run all enabled providers. Never throws; soft-fails per provider.
 * @param {import('../providers/base.provider').ThreatProviderContext} ctx
 * @returns {Promise<import('../types').ThreatProviderResult[]>}
 */
const runProviders = async (ctx) => {
  const results = []
  for (const provider of PROVIDERS) {
    if (provider.enabled === false) continue
    try {
      const result = await provider.enrich(ctx)
      results.push(result || {
        provider: provider.name,
        enabled: true,
        findings: []
      })
    } catch (error) {
      results.push({
        provider: provider.name,
        enabled: true,
        findings: [],
        meta: {
          error: error?.message || 'Provider failed'
        }
      })
    }
  }
  return results
}

/**
 * @returns {string[]}
 */
const listProviders = () => PROVIDERS.map((p) => p.name)

module.exports = {
  registerProvider,
  runProviders,
  listProviders,
  PROVIDERS
}

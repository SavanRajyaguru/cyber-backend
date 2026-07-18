/**
 * Local / no-op threat intelligence provider.
 * Returns no external enrichment — placeholder for future API providers.
 *
 * @type {import('./base.provider').ThreatProvider}
 */
const localProvider = {
  name: 'local',
  enabled: true,

  /**
   * @param {import('./base.provider').ThreatProviderContext} ctx
   * @returns {Promise<import('../types').ThreatProviderResult>}
   */
  async enrich (ctx) {
    return {
      provider: 'local',
      enabled: true,
      findings: [],
      meta: {
        note: 'LocalProvider does not call external APIs. Plug in VirusTotal, AbuseIPDB, Shodan, etc. via provider.service.',
        hostname: ctx?.hostname || null,
        ipv4Count: Array.isArray(ctx?.ipv4) ? ctx.ipv4.length : 0
      }
    }
  }
}

module.exports = {
  localProvider
}

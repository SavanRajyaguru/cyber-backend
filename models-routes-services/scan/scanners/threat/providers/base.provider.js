/**
 * Threat intelligence provider interface (duck-typed).
 *
 * Future providers (VirusTotal, AbuseIPDB, Shodan, Censys, OTX, GreyNoise)
 * should implement the same shape without changing the core scanner.
 *
 * @typedef {Object} ThreatProviderContext
 * @property {string} sUrl
 * @property {string|null} hostname
 * @property {string[]} ipv4
 * @property {Record<string, Object|null>} sources
 *
 * @typedef {Object} ThreatProvider
 * @property {string} name
 * @property {boolean} enabled
 * @property {(ctx: ThreatProviderContext) => Promise<import('../types').ThreatProviderResult>} enrich
 */

/**
 * Validate a provider object implements the expected interface.
 * @param {any} provider
 * @returns {boolean}
 */
const isThreatProvider = (provider) =>
  Boolean(
    provider &&
    typeof provider.name === 'string' &&
    typeof provider.enrich === 'function'
  )

module.exports = {
  isThreatProvider
}

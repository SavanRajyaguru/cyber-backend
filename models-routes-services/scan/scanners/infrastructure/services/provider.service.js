const { matchProviders } = require('../providers/provider.registry')
const { buildEvidenceBlob } = require('../utils/headers')

/**
 * Merge technology detections + registry matches into provider lists.
 * @param {Object} params
 * @param {Record<string, string>} params.headers
 * @param {Object|null} params.technology
 * @param {Object|null} params.dns
 */
const detectProviders = ({ headers = {}, technology = null, dns = null }) => {
  const techNames = []
  for (const key of ['cdn', 'hosting', 'server', 'backend']) {
    const list = technology?.[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (item?.name) techNames.push(item.name)
    }
  }

  const dnsBits = []
  if (dns?.records) {
    for (const c of dns.records.CNAME || []) dnsBits.push(String(c))
    for (const n of dns.records.NS || []) dnsBits.push(String(n))
    for (const m of dns.records.MX || []) {
      dnsBits.push(typeof m === 'string' ? m : String(m.exchange || ''))
    }
  }

  const blob = buildEvidenceBlob(headers, [...techNames, ...dnsBits])
  const matched = matchProviders(blob)

  // Merge tech module names that look like CDN/hosting even if regex missed
  const ensure = (name, category, confidence = 85) => {
    if (!name) return
    const exists = matched.some((m) => m.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
      matched.push({
        name,
        category,
        confidence,
        evidence: `technology:${name}`
      })
    }
  }

  for (const item of technology?.cdn || []) ensure(item.name, 'cdn', item.confidence || 90)
  for (const item of technology?.hosting || []) ensure(item.name, 'hosting', item.confidence || 90)

  const byCategory = (cat) =>
    matched
      .filter((m) => m.category === cat)
      .sort((a, b) => b.confidence - a.confidence)

  const cdns = byCategory('cdn')
  const clouds = byCategory('cloud')
  // CloudFront/AWS overlap — CloudFront implies AWS cloud
  if (cdns.some((c) => c.name === 'CloudFront') && !clouds.some((c) => c.name === 'AWS')) {
    clouds.push({
      name: 'AWS',
      category: 'cloud',
      confidence: 80,
      evidence: 'Implied by CloudFront'
    })
  }

  const hosting = byCategory('hosting')
  const proxies = byCategory('proxy')

  return {
    matched,
    cdn: cdns,
    cloud: clouds,
    hosting,
    proxies,
    primaryCdn: cdns[0] || null,
    primaryCloud: clouds[0] || null,
    primaryHosting: hosting[0] || null
  }
}

module.exports = {
  detectProviders
}

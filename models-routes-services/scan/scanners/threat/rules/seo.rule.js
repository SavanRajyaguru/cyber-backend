const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity, statusToSeverity } = require('../utils/finding')

/**
 * SEO risks that affect security posture (indexability / exposure).
 * @param {Object|null} seo
 * @returns {import('../types').ThreatFinding[]}
 */
const applySeoRule = (seo) => {
  if (!seo || seo.oMeta?.bStub) return []

  const findings = []
  const robots = seo.robots || {}
  const meta = seo.meta || {}

  if (robots.noindex || meta.robots?.noindex) {
    findings.push(makeThreatFinding({
      title: 'Homepage marked noindex',
      category: THREAT_CATEGORIES.SEO,
      severity: SEVERITY.INFORMATIONAL,
      confidence: 90,
      affectedModule: 'seo',
      description: 'noindex reduces public search exposure (may be intentional).',
      recommendation: 'Confirm noindex is intentional for this page.'
    }))
  }

  if (seo.links?.unsafeTargetBlank > 0) {
    findings.push(makeThreatFinding({
      title: 'Unsafe target=_blank links',
      category: THREAT_CATEGORIES.SEO,
      severity: SEVERITY.MEDIUM,
      confidence: 85,
      affectedModule: 'seo',
      description: `${seo.links.unsafeTargetBlank} link(s) open new tabs without noopener/noreferrer.`,
      recommendation: 'Add rel="noopener noreferrer" to target="_blank" anchors.'
    }))
  }

  for (const f of seo.findings || []) {
    const status = String(f.status || '').toLowerCase()
    if (status !== 'fail' && status !== 'warn') continue
    if (!/canonical|robots|nofollow|noindex|noopener|security/i.test(
      `${f.title || ''} ${f.description || ''}`
    )) continue

    findings.push(makeThreatFinding({
      title: f.title || 'SEO security-related issue',
      category: THREAT_CATEGORIES.SEO,
      severity: f.severity ? normalizeSeverity(f.severity) : statusToSeverity(status),
      confidence: 70,
      affectedModule: 'seo',
      description: f.description || f.title,
      recommendation: f.recommendation || 'Review on-page SEO security implications.'
    }))
  }

  return findings
}

module.exports = {
  name: 'seo',
  sourceModule: 'seo',
  apply: applySeoRule
}

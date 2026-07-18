const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding } = require('../utils/finding')

/** Best-effort outdated / EOL hints — informational unless strongly matched */
const OUTDATED_HINTS = [
  { pattern: /jquery[- ]?1\./i, name: 'jQuery 1.x', severity: SEVERITY.MEDIUM },
  { pattern: /jquery[- ]?2\./i, name: 'jQuery 2.x', severity: SEVERITY.LOW },
  { pattern: /angular\.js|angularjs\s*1\./i, name: 'AngularJS 1.x', severity: SEVERITY.HIGH },
  { pattern: /php\/?[5.]/i, name: 'PHP 5.x', severity: SEVERITY.CRITICAL },
  { pattern: /php\/?7\.[0-3]/i, name: 'EOL PHP 7.x', severity: SEVERITY.HIGH },
  { pattern: /wordpress\s*[1-4]\./i, name: 'Legacy WordPress', severity: SEVERITY.HIGH }
]

/**
 * @param {Object|null} technology
 * @returns {import('../types').ThreatFinding[]}
 */
const applyTechnologyRule = (technology) => {
  if (!technology || technology.oMeta?.bStub) return []

  const findings = []
  const all = [
    ...(technology.frontend || []),
    ...(technology.backend || []),
    ...(technology.cms || []),
    ...(technology.server || []),
    ...(technology.libraries || []),
    ...(technology.hosting || []),
    ...(technology.cdn || [])
  ]

  if (technology.server?.length) {
    for (const s of technology.server.slice(0, 5)) {
      findings.push(makeThreatFinding({
        title: `Server technology exposed: ${s.name}`,
        category: THREAT_CATEGORIES.TECHNOLOGY,
        severity: SEVERITY.LOW,
        confidence: s.confidence || 70,
        affectedModule: 'technology',
        description: s.evidence || `${s.name} detected from public signals.`,
        recommendation: 'Minimize technology disclosure and keep components patched.'
      }))
    }
  }

  if (technology.backend?.length || technology.cms?.length) {
    const names = [...(technology.backend || []), ...(technology.cms || [])]
      .map((t) => t.name)
      .slice(0, 6)
    findings.push(makeThreatFinding({
      title: 'Application stack fingerprintable',
      category: THREAT_CATEGORIES.TECHNOLOGY,
      severity: SEVERITY.INFORMATIONAL,
      confidence: 75,
      affectedModule: 'technology',
      description: `Detected: ${names.join(', ')}.`,
      recommendation: 'Ensure frameworks and CMS plugins stay updated; reduce fingerprinting where possible.'
    }))
  }

  for (const tech of all) {
    const blob = `${tech.name || ''} ${tech.version || ''} ${tech.evidence || ''}`
    for (const hint of OUTDATED_HINTS) {
      if (!hint.pattern.test(blob)) continue
      findings.push(makeThreatFinding({
        title: `Possible outdated component: ${hint.name}`,
        category: THREAT_CATEGORIES.OUTDATED,
        severity: hint.severity,
        confidence: 55,
        affectedModule: 'technology',
        description: `Best-effort match against ${tech.name}${tech.version ? ` ${tech.version}` : ''}.`,
        recommendation: 'Verify versions and upgrade end-of-life components.'
      }))
    }
  }

  return findings
}

module.exports = {
  name: 'technology',
  sourceModule: 'technology',
  apply: applyTechnologyRule
}

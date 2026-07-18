const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity } = require('../utils/finding')

/**
 * @param {Object|null} javascript
 * @returns {import('../types').ThreatFinding[]}
 */
const applyJavascriptRule = (javascript) => {
  if (!javascript || javascript.oMeta?.bStub) return []

  const findings = []

  for (const f of javascript.findings || []) {
    const sev = normalizeSeverity(f.severity || f.level || 'medium')
    const title = f.title || f.message || 'JavaScript risk'
    const isSecretLike = /secret|token|api.?key|credential|password/i.test(
      `${title} ${f.description || f.message || ''}`
    )

    findings.push(makeThreatFinding({
      title: String(title).slice(0, 140),
      category: isSecretLike ? THREAT_CATEGORIES.PUBLIC_TOKENS : THREAT_CATEGORIES.JAVASCRIPT,
      severity: sev === SEVERITY.INFORMATIONAL ? SEVERITY.LOW : sev,
      confidence: f.confidence || 70,
      affectedModule: 'javascript',
      description: f.description || f.message || title,
      recommendation: f.recommendation || 'Review client-side JavaScript for sensitive data and unsafe patterns.'
    }))
  }

  // Common summary fields if present
  if (javascript.secrets?.length) {
    for (const s of javascript.secrets.slice(0, 15)) {
      findings.push(makeThreatFinding({
        title: `Client-side token/secret indicator: ${s.type || s.title || 'secret'}`,
        category: THREAT_CATEGORIES.PUBLIC_TOKENS,
        severity: normalizeSeverity(s.severity || SEVERITY.HIGH),
        confidence: 80,
        affectedModule: 'javascript',
        description: s.description || s.preview || 'Potential secret found in JavaScript assets.',
        recommendation: s.recommendation || 'Remove secrets from client-side bundles; use server-side auth.'
      }))
    }
  }

  if (javascript.summary?.largeBundles > 0 || javascript.largeBundles?.length) {
    findings.push(makeThreatFinding({
      title: 'Large JavaScript bundles increase attack surface',
      category: THREAT_CATEGORIES.JAVASCRIPT,
      severity: SEVERITY.LOW,
      confidence: 65,
      affectedModule: 'javascript',
      description: 'Oversized JS bundles may include unused vulnerable dependencies.',
      recommendation: 'Code-split, tree-shake, and audit third-party scripts.'
    }))
  }

  return findings
}

module.exports = {
  name: 'javascript',
  sourceModule: 'javascript',
  apply: applyJavascriptRule
}

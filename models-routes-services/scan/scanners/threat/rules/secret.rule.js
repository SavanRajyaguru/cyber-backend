const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity } = require('../utils/finding')

/**
 * @param {Object|null} secret
 * @returns {import('../types').ThreatFinding[]}
 */
const applySecretRule = (secret) => {
  if (!secret || secret.oMeta?.bStub) return []

  const findings = []

  for (const f of secret.findings || []) {
    const sev = normalizeSeverity(f.severity)
    const elevated =
      sev === SEVERITY.INFORMATIONAL
        ? SEVERITY.LOW
        : sev === SEVERITY.LOW
          ? SEVERITY.MEDIUM
          : sev

    findings.push(makeThreatFinding({
      title: f.title || `Exposed secret: ${f.type || 'unknown'}`,
      category: /token|key|bearer|jwt/i.test(`${f.type || ''} ${f.title || ''}`)
        ? THREAT_CATEGORIES.PUBLIC_TOKENS
        : THREAT_CATEGORIES.SECRETS,
      severity: elevated === SEVERITY.HIGH ? SEVERITY.CRITICAL : elevated,
      confidence: 88,
      affectedModule: 'secret',
      description: [
        f.resource ? `Resource: ${f.resource}` : null,
        f.matchedValuePreview ? `Preview: ${f.matchedValuePreview}` : null,
        f.line != null ? `Line: ${f.line}` : null
      ].filter(Boolean).join(' | ') || 'Potential secret exposed in a public resource.',
      recommendation: f.recommendation || 'Rotate the credential and remove it from public assets.'
    }))
  }

  if ((secret.findings || []).length === 0 && secret.score === 100) {
    findings.push(makeThreatFinding({
      title: 'No public secrets detected',
      category: THREAT_CATEGORIES.SECRETS,
      severity: SEVERITY.INFORMATIONAL,
      confidence: 70,
      affectedModule: 'secret',
      description: 'Secret scanner did not report exposed credentials in scanned resources.',
      recommendation: 'No action required.'
    }))
  }

  return findings
}

module.exports = {
  name: 'secret',
  sourceModule: 'secret',
  apply: applySecretRule
}

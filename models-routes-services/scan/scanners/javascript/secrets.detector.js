const { SEVERITY, FINDING_STATUS } = require('./constants')

/** Compiled once */
const SECRET_PATTERNS = [
  {
    title: 'Potential JWT token exposed',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: SEVERITY.HIGH,
    description: 'A JWT-like token appears in JavaScript source.',
    recommendation: 'Remove secrets from client-side code; use short-lived tokens via secure APIs.'
  },
  {
    title: 'Potential Firebase config exposed',
    pattern: /apiKey\s*[:=]\s*["']AIza[0-9A-Za-z\-_]{20,}["']|firebaseConfig\s*=\s*\{/gi,
    severity: SEVERITY.MEDIUM,
    description: 'Firebase configuration or API key pattern found in client JavaScript.',
    recommendation: 'Restrict Firebase keys with domain rules; avoid embedding privileged credentials.'
  },
  {
    title: 'Potential AWS key exposed',
    pattern: /\bAKIA[0-9A-Z]{16}\b|aws_secret_access_key\s*[:=]\s*["'][^"']{16,}["']/gi,
    severity: SEVERITY.HIGH,
    description: 'AWS access key pattern detected in JavaScript.',
    recommendation: 'Rotate the key immediately and never ship AWS secrets to browsers.'
  },
  {
    title: 'Potential Google API key exposed',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    severity: SEVERITY.MEDIUM,
    description: 'Google API key pattern detected in JavaScript.',
    recommendation: 'Restrict the key by HTTP referrer/API and rotate if abused.'
  },
  {
    title: 'Potential Stripe publishable key exposed',
    pattern: /\bpk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    severity: SEVERITY.LOW,
    description: 'Stripe publishable key found (expected client-side, but verify environment).',
    recommendation: 'Ensure only publishable keys are client-side; never include secret keys (sk_).'
  },
  {
    title: 'Potential Stripe secret key exposed',
    pattern: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    severity: SEVERITY.HIGH,
    description: 'Stripe secret key pattern detected in client JavaScript.',
    recommendation: 'Revoke/rotate the secret key immediately; secrets must stay server-side.'
  },
  {
    title: 'Potential exposed API endpoint',
    pattern: /https?:\/\/[^\s"'`]*(?:\/api\/|api\.[^\s"'`]+)[^\s"'`]*/gi,
    severity: SEVERITY.INFO,
    description: 'Hard-coded API endpoint URL found in JavaScript.',
    recommendation: 'Review endpoints for auth; avoid leaking internal/admin APIs.'
  }
]

/**
 * Detect secret/config patterns in script content.
 * @param {string} content
 * @param {string} resource
 * @returns {import('./types').JsFinding[]}
 */
const detectSecrets = (content = '', resource = '') => {
  const findings = []
  if (!content) return findings

  for (const rule of SECRET_PATTERNS) {
    rule.pattern.lastIndex = 0
    if (rule.pattern.test(content)) {
      findings.push({
        title: rule.title,
        severity: rule.severity,
        status: rule.severity === SEVERITY.HIGH ? FINDING_STATUS.FAIL : FINDING_STATUS.WARNING,
        description: rule.description,
        recommendation: rule.recommendation,
        resource
      })
    }
  }

  return findings
}

/**
 * @param {import('./types').JsFinding[]} findings
 * @returns {boolean}
 */
const hasExposedSecrets = (findings = []) =>
  findings.some((f) =>
    /JWT|AWS|Stripe secret|Firebase|Google API/i.test(f.title) &&
    (f.severity === SEVERITY.HIGH || f.severity === SEVERITY.MEDIUM)
  )

module.exports = {
  detectSecrets,
  hasExposedSecrets,
  SECRET_PATTERNS
}

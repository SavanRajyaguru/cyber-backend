const { PATTERNS, MIN_CONFIDENCE } = require('./patterns')

const HEADER_PATTERNS = PATTERNS.filter((p) => p.source === 'header')

/**
 * Match technologies against flattened response headers.
 * @param {string} headerText
 * @returns {import('./types').DetectedTechnology[]}
 */
const analyzeHeaders = (headerText = '') => {
  const detected = []
  if (!headerText) return detected

  for (const rule of HEADER_PATTERNS) {
    const match = rule.pattern.exec(headerText)
    if (!match) continue
    if (rule.confidence < MIN_CONFIDENCE) continue

    let version = null
    if (rule.versionGroup && match[rule.versionGroup]) {
      version = String(match[rule.versionGroup])
    }

    detected.push({
      name: rule.name,
      category: rule.category,
      version,
      confidence: rule.confidence,
      evidence: rule.evidence
    })
  }

  return detected
}

module.exports = {
  analyzeHeaders
}

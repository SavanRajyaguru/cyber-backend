const { isFalsePositive } = require('../utils/falsePositives')
const { maskSecret, lineNumberAt } = require('../utils/mask')

/**
 * Run a list of patterns against content and return masked findings.
 * @param {string} content
 * @param {string} resource
 * @param {import('../types').SecretPattern[]} patterns
 * @returns {import('../types').SecretFinding[]}
 */
const runPatterns = (content, resource, patterns = []) => {
  const findings = []
  if (!content) return findings

  for (const rule of patterns) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`)
    let match
    while ((match = re.exec(content)) !== null) {
      const raw = match[1] || match[0]
      if (!raw || isFalsePositive(raw)) continue
      if (typeof rule.validate === 'function' && !rule.validate(raw)) continue

      findings.push({
        type: rule.type,
        severity: rule.severity,
        title: rule.name,
        resource,
        matchedValuePreview: maskSecret(raw),
        line: lineNumberAt(content, match.index),
        recommendation: rule.recommendation
      })

      // Avoid pathological regex loops on zero-length
      if (match[0].length === 0) re.lastIndex++
    }
  }

  return findings
}

/**
 * Dedupe findings by type + preview + resource + line.
 * @param {import('../types').SecretFinding[]} findings
 */
const dedupeFindings = (findings = []) => {
  const seen = new Set()
  const out = []
  for (const f of findings) {
    const key = `${f.type}|${f.resource}|${f.matchedValuePreview}|${f.line}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

module.exports = {
  runPatterns,
  dedupeFindings
}

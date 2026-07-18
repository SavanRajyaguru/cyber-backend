const { SEVERITY } = require('./constants')

const scoreToGrade = (score) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const gradeToRisk = (grade, score) => {
  if (score === 0) return 'critical'
  if (grade === 'A' || grade === 'B') return 'low'
  if (grade === 'C') return 'medium'
  return 'high'
}

/**
 * Scoring:
 * No secrets → 100
 * Low-only → 80
 * Medium present → 60
 * High present → 30
 * Critical present → 0
 * @param {import('./types').SecretFinding[]} findings
 */
const calculateSecretScore = (findings = []) => {
  if (!findings.length) {
    return { score: 100, grade: 'A', risk: 'low' }
  }

  const severities = new Set(findings.map((f) => f.severity))
  let score = 100
  if (severities.has(SEVERITY.CRITICAL)) score = 0
  else if (severities.has(SEVERITY.HIGH)) score = 30
  else if (severities.has(SEVERITY.MEDIUM)) score = 60
  else if (severities.has(SEVERITY.LOW) || severities.has(SEVERITY.INFO)) score = 80

  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade, score)
  return { score, grade, risk }
}

/**
 * @param {import('./types').SecretFinding[]} findings
 */
const buildSummary = (findings = []) => {
  const bySeverity = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Info: 0
  }
  for (const f of findings) {
    if (bySeverity[f.severity] !== undefined) bySeverity[f.severity] += 1
  }
  return {
    totalFindings: findings.length,
    bySeverity,
    resourcesWithFindings: new Set(findings.map((f) => f.resource)).size
  }
}

module.exports = {
  calculateSecretScore,
  buildSummary,
  scoreToGrade,
  gradeToRisk
}

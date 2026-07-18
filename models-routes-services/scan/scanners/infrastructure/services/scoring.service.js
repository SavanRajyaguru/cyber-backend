const { SCORE_WEIGHTS, FINDING_STATUS } = require('../constants')

const scoreToGrade = (score) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const gradeToRisk = (grade) => {
  if (grade === 'A' || grade === 'B') return 'low'
  if (grade === 'C') return 'medium'
  return 'high'
}

/**
 * Mostly informational infrastructure score 0–100.
 * @param {Object} ratios
 */
const calculateInfrastructureScore = (ratios = {}) => {
  const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0))

  const raw =
    SCORE_WEIGHTS.HTTPS * clamp(ratios.https) +
    SCORE_WEIGHTS.CDN * clamp(ratios.cdn) +
    SCORE_WEIGHTS.SECURITY_HEADERS * clamp(ratios.securityHeaders) +
    SCORE_WEIGHTS.EMAIL_SECURITY * clamp(ratios.emailSecurity) +
    SCORE_WEIGHTS.IPV6 * clamp(ratios.ipv6) +
    SCORE_WEIGHTS.HOSTING_BEST_PRACTICES * clamp(ratios.hostingBestPractices)

  const weightSum =
    SCORE_WEIGHTS.HTTPS +
    SCORE_WEIGHTS.CDN +
    SCORE_WEIGHTS.SECURITY_HEADERS +
    SCORE_WEIGHTS.EMAIL_SECURITY +
    SCORE_WEIGHTS.IPV6 +
    SCORE_WEIGHTS.HOSTING_BEST_PRACTICES

  const score = Math.max(0, Math.min(100, Math.round((raw / weightSum) * 100)))
  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)

  return {
    score,
    grade,
    risk,
    breakdown: {
      https: Math.round(SCORE_WEIGHTS.HTTPS * clamp(ratios.https)),
      cdn: Math.round(SCORE_WEIGHTS.CDN * clamp(ratios.cdn)),
      securityHeaders: Math.round(SCORE_WEIGHTS.SECURITY_HEADERS * clamp(ratios.securityHeaders)),
      emailSecurity: Math.round(SCORE_WEIGHTS.EMAIL_SECURITY * clamp(ratios.emailSecurity)),
      ipv6: Math.round(SCORE_WEIGHTS.IPV6 * clamp(ratios.ipv6)),
      hostingBestPractices: Math.round(
        SCORE_WEIGHTS.HOSTING_BEST_PRACTICES * clamp(ratios.hostingBestPractices)
      ),
      weightSum
    }
  }
}

/**
 * @param {import('../types').InfraFinding[]} findings
 * @returns {string[]}
 */
const buildRecommendations = (findings = []) => {
  const seen = new Set()
  const out = []
  for (const f of findings) {
    if (f.status !== FINDING_STATUS.FAIL && f.status !== FINDING_STATUS.WARN) continue
    const rec = f.recommendation
    if (!rec || rec === 'No action required.' || seen.has(rec)) continue
    seen.add(rec)
    out.push(rec)
  }
  return out
}

module.exports = {
  calculateInfrastructureScore,
  buildRecommendations,
  scoreToGrade,
  gradeToRisk
}

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
 * Weighted performance score 0–100.
 * @param {Object} ratios
 */
const calculatePerformanceScore = (ratios = {}) => {
  const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0))

  const raw =
    SCORE_WEIGHTS.RESPONSE_TIME * clamp(ratios.responseTime) +
    SCORE_WEIGHTS.COMPRESSION * clamp(ratios.compression) +
    SCORE_WEIGHTS.CACHING * clamp(ratios.caching) +
    SCORE_WEIGHTS.ASSETS * clamp(ratios.assets) +
    SCORE_WEIGHTS.IMAGES * clamp(ratios.images) +
    SCORE_WEIGHTS.CSS_JS * clamp(ratios.cssJs)

  const weightSum =
    SCORE_WEIGHTS.RESPONSE_TIME +
    SCORE_WEIGHTS.COMPRESSION +
    SCORE_WEIGHTS.CACHING +
    SCORE_WEIGHTS.ASSETS +
    SCORE_WEIGHTS.IMAGES +
    SCORE_WEIGHTS.CSS_JS

  const score = Math.max(0, Math.min(100, Math.round((raw / weightSum) * 100)))
  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)

  return {
    score,
    grade,
    risk,
    breakdown: {
      responseTime: Math.round(SCORE_WEIGHTS.RESPONSE_TIME * clamp(ratios.responseTime)),
      compression: Math.round(SCORE_WEIGHTS.COMPRESSION * clamp(ratios.compression)),
      caching: Math.round(SCORE_WEIGHTS.CACHING * clamp(ratios.caching)),
      assets: Math.round(SCORE_WEIGHTS.ASSETS * clamp(ratios.assets)),
      images: Math.round(SCORE_WEIGHTS.IMAGES * clamp(ratios.images)),
      cssJs: Math.round(SCORE_WEIGHTS.CSS_JS * clamp(ratios.cssJs)),
      weightSum
    }
  }
}

/**
 * @param {import('../types').PerfFinding[]} findings
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
  calculatePerformanceScore,
  buildRecommendations,
  scoreToGrade,
  gradeToRisk
}

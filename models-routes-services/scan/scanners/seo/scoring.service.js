const { SCORE_WEIGHTS, FINDING_STATUS } = require('./constants')

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
 * Weighted SEO score. Suggested weights sum to 110; normalized to 0–100.
 * @param {Object} ratios
 * @param {number} ratios.title
 * @param {number} ratios.description
 * @param {number} ratios.headings
 * @param {number} ratios.images
 * @param {number} ratios.structuredData
 * @param {number} ratios.social
 * @param {number} ratios.canonical
 * @param {number} ratios.robots
 * @param {number} ratios.links
 */
const calculateSeoScore = (ratios = {}) => {
  const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0))

  const raw =
    SCORE_WEIGHTS.TITLE * clamp(ratios.title) +
    SCORE_WEIGHTS.DESCRIPTION * clamp(ratios.description) +
    SCORE_WEIGHTS.HEADINGS * clamp(ratios.headings) +
    SCORE_WEIGHTS.IMAGES * clamp(ratios.images) +
    SCORE_WEIGHTS.STRUCTURED_DATA * clamp(ratios.structuredData) +
    SCORE_WEIGHTS.SOCIAL * clamp(ratios.social) +
    SCORE_WEIGHTS.CANONICAL * clamp(ratios.canonical) +
    SCORE_WEIGHTS.ROBOTS * clamp(ratios.robots) +
    SCORE_WEIGHTS.LINKS * clamp(ratios.links)

  const weightSum =
    SCORE_WEIGHTS.TITLE +
    SCORE_WEIGHTS.DESCRIPTION +
    SCORE_WEIGHTS.HEADINGS +
    SCORE_WEIGHTS.IMAGES +
    SCORE_WEIGHTS.STRUCTURED_DATA +
    SCORE_WEIGHTS.SOCIAL +
    SCORE_WEIGHTS.CANONICAL +
    SCORE_WEIGHTS.ROBOTS +
    SCORE_WEIGHTS.LINKS

  const score = Math.max(0, Math.min(100, Math.round((raw / weightSum) * 100)))
  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)

  return {
    score,
    grade,
    risk,
    breakdown: {
      title: Math.round(SCORE_WEIGHTS.TITLE * clamp(ratios.title)),
      description: Math.round(SCORE_WEIGHTS.DESCRIPTION * clamp(ratios.description)),
      headings: Math.round(SCORE_WEIGHTS.HEADINGS * clamp(ratios.headings)),
      images: Math.round(SCORE_WEIGHTS.IMAGES * clamp(ratios.images)),
      structuredData: Math.round(SCORE_WEIGHTS.STRUCTURED_DATA * clamp(ratios.structuredData)),
      social: Math.round(SCORE_WEIGHTS.SOCIAL * clamp(ratios.social)),
      canonical: Math.round(SCORE_WEIGHTS.CANONICAL * clamp(ratios.canonical)),
      robots: Math.round(SCORE_WEIGHTS.ROBOTS * clamp(ratios.robots)),
      links: Math.round(SCORE_WEIGHTS.LINKS * clamp(ratios.links)),
      weightSum
    }
  }
}

/**
 * @param {import('./types').SeoFinding[]} findings
 */
const buildSummary = (findings = [], extras = {}) => {
  const bySeverity = { High: 0, Medium: 0, Low: 0, Info: 0 }
  const byStatus = { Fail: 0, Warn: 0, Pass: 0, Info: 0 }
  for (const f of findings) {
    if (bySeverity[f.severity] !== undefined) bySeverity[f.severity] += 1
    if (byStatus[f.status] !== undefined) byStatus[f.status] += 1
  }
  return {
    totalFindings: findings.length,
    bySeverity,
    byStatus,
    ...extras
  }
}

/**
 * @param {import('./types').SeoFinding[]} findings
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
  calculateSeoScore,
  buildSummary,
  buildRecommendations,
  scoreToGrade,
  gradeToRisk
}

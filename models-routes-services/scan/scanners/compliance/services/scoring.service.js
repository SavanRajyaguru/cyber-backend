const { CONTROL_STATUS, FAIL_PENALTIES, SEVERITY } = require('../constants')

const scoreToGrade = (score) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * @param {number} score
 * @param {string} maxFailSeverity
 */
const toRisk = (score, maxFailSeverity) => {
  if (maxFailSeverity === SEVERITY.CRITICAL || score < 40) return 'critical'
  if (maxFailSeverity === SEVERITY.HIGH || score < 60) return 'high'
  if (maxFailSeverity === SEVERITY.MEDIUM || score < 75) return 'medium'
  return 'low'
}

const severityRank = (s) => {
  switch (s) {
    case SEVERITY.CRITICAL: return 5
    case SEVERITY.HIGH: return 4
    case SEVERITY.MEDIUM: return 3
    case SEVERITY.LOW: return 2
    default: return 1
  }
}

/**
 * Overall compliance score from framework results + failed control penalties.
 * @param {import('../types').FrameworkResult[]} frameworks
 */
const calculateComplianceScore = (frameworks = []) => {
  if (!frameworks.length) {
    return {
      score: 0,
      grade: 'F',
      risk: 'high',
      summary: {
        frameworks: 0,
        totalPassed: 0,
        totalFailed: 0,
        totalNotApplicable: 0,
        averageFrameworkScore: 0,
        incompleteEvidence: true
      },
      recommendations: ['Re-run after sibling scanners complete to produce compliance evidence.']
    }
  }

  const withEvidence = frameworks.filter((f) => (f.passed + f.failed) > 0)
  if (!withEvidence.length) {
    return {
      score: 0,
      grade: 'F',
      risk: 'high',
      summary: {
        frameworks: frameworks.length,
        totalPassed: 0,
        totalFailed: 0,
        totalNotApplicable: frameworks.reduce((n, f) => n + f.notApplicable, 0),
        averageFrameworkScore: 0,
        incompleteEvidence: true
      },
      recommendations: ['Insufficient scanner outputs to assess compliance controls.']
    }
  }

  const avg =
    withEvidence.reduce((sum, f) => sum + (Number(f.score) || 0), 0) / withEvidence.length

  let totalPassed = 0
  let totalFailed = 0
  let totalNa = 0
  let maxFailSeverity = SEVERITY.INFO
  let penalty = 0
  const recommendations = []
  const seenRec = new Set()

  for (const fw of frameworks) {
    totalPassed += fw.passed
    totalFailed += fw.failed
    totalNa += fw.notApplicable

    for (const c of fw.controls || []) {
      if (c.status !== CONTROL_STATUS.FAIL) continue
      if (severityRank(c.severity) > severityRank(maxFailSeverity)) {
        maxFailSeverity = c.severity
      }
      penalty += (FAIL_PENALTIES[c.severity] || FAIL_PENALTIES[SEVERITY.MEDIUM]) * 0.15

      if (c.recommendation && !seenRec.has(c.recommendation)) {
        seenRec.add(c.recommendation)
        recommendations.push(c.recommendation)
      }
    }
  }

  // Blend average framework pass-rate with severity-weighted penalties
  let score = Math.round(avg - Math.min(40, penalty))
  score = Math.max(0, Math.min(100, score))

  const grade = scoreToGrade(score)
  const risk = toRisk(score, maxFailSeverity)

  // Prioritize recommendations by failed severity order already roughly collected
  return {
    score,
    grade,
    risk,
    summary: {
      frameworks: frameworks.length,
      totalPassed,
      totalFailed,
      totalNotApplicable: totalNa,
      averageFrameworkScore: Math.round(avg),
      maxFailSeverity,
      complianceRisk: risk
    },
    recommendations: recommendations.slice(0, 30)
  }
}

module.exports = {
  calculateComplianceScore,
  scoreToGrade,
  toRisk
}

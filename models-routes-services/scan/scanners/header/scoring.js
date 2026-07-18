const {
  HEADER_NAMES,
  HEADER_LABELS,
  HEADER_WEIGHTS,
  DISCLOSURE_PENALTY,
  STATUS
} = require('./constants')

const weightForAnalysis = (analysis) => {
  if (!analysis) return 0
  if (analysis.status === STATUS.GOOD) return 1
  if (analysis.status === STATUS.WARN) return 0.5
  return 0
}

/**
 * @param {Record<string, import('./types').HeaderAnalysis>} headersByLabel
 * @returns {import('./types').HeaderScoreResult}
 */
const calculateHeaderScore = (headersByLabel = {}) => {
  let score = 0

  const getByName = (name) => headersByLabel[HEADER_LABELS[name]]

  score += HEADER_WEIGHTS[HEADER_NAMES.HSTS] * weightForAnalysis(getByName(HEADER_NAMES.HSTS))
  score += HEADER_WEIGHTS[HEADER_NAMES.CSP] * weightForAnalysis(getByName(HEADER_NAMES.CSP))
  score += HEADER_WEIGHTS[HEADER_NAMES.XFO] * weightForAnalysis(getByName(HEADER_NAMES.XFO))
  score += HEADER_WEIGHTS[HEADER_NAMES.XCTO] * weightForAnalysis(getByName(HEADER_NAMES.XCTO))
  score += HEADER_WEIGHTS[HEADER_NAMES.REFERRER_POLICY] * weightForAnalysis(getByName(HEADER_NAMES.REFERRER_POLICY))
  score += HEADER_WEIGHTS[HEADER_NAMES.PERMISSIONS_POLICY] * weightForAnalysis(getByName(HEADER_NAMES.PERMISSIONS_POLICY))
  score += HEADER_WEIGHTS[HEADER_NAMES.COOP] * weightForAnalysis(getByName(HEADER_NAMES.COOP))
  score += HEADER_WEIGHTS[HEADER_NAMES.CORP] * weightForAnalysis(getByName(HEADER_NAMES.CORP))
  score += HEADER_WEIGHTS[HEADER_NAMES.COEP] * weightForAnalysis(getByName(HEADER_NAMES.COEP))

  // CORS hygiene: full weight if ACAO good/absent-info without bad; zero if wildcard bad
  const acao = getByName(HEADER_NAMES.ACAO)
  if (!acao || acao.status === STATUS.INFO || acao.status === STATUS.GOOD) {
    score += HEADER_WEIGHTS.cors
  } else if (acao.status === STATUS.WARN) {
    score += HEADER_WEIGHTS.cors * 0.5
  }

  const server = getByName(HEADER_NAMES.SERVER)
  const xpb = getByName(HEADER_NAMES.X_POWERED_BY)
  if (server?.present) score -= DISCLOSURE_PENALTY
  if (xpb?.present) score -= DISCLOSURE_PENALTY

  score = Math.max(0, Math.min(100, Math.round(score)))

  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)

  return { score, grade, risk }
}

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

module.exports = {
  calculateHeaderScore,
  scoreToGrade,
  gradeToRisk
}

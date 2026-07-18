const { SCORE_WEIGHTS } = require('./constants')
const { hasExposedSecrets } = require('./secrets.detector')

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
 * Aggregate flags across all scripts + findings for scoring.
 * @param {{ flagsList: Object[], findings: import('./types').JsFinding[] }} params
 * @returns {import('./types').JavascriptScanResult extends never ? any : { score: number, grade: string, risk: string }}
 */
const calculateJavascriptScore = ({ flagsList = [], findings = [] }) => {
  const any = (key) => flagsList.some((f) => f && f[key])

  let score = 0

  if (!any('hasEval')) score += SCORE_WEIGHTS.NO_EVAL
  if (!any('hasDebugger')) score += SCORE_WEIGHTS.NO_DEBUGGER
  if (!any('hasDocumentWrite')) score += SCORE_WEIGHTS.NO_DOCUMENT_WRITE
  if (!hasExposedSecrets(findings)) score += SCORE_WEIGHTS.NO_EXPOSED_SECRETS
  if (!any('hasUnsafePostMessage')) score += SCORE_WEIGHTS.NO_UNSAFE_POSTMESSAGE

  // Bundle optimization: full if no large bundles; half if some large but mostly minified
  if (!any('largeBundle')) {
    score += SCORE_WEIGHTS.BUNDLE_OPTIMIZATION
  } else {
    score += Math.round(SCORE_WEIGHTS.BUNDLE_OPTIMIZATION * 0.4)
  }

  if (!any('hasInline')) score += SCORE_WEIGHTS.NO_INLINE_JS

  score = Math.max(0, Math.min(100, Math.round(score)))
  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)
  return { score, grade, risk }
}

module.exports = {
  calculateJavascriptScore,
  scoreToGrade,
  gradeToRisk
}

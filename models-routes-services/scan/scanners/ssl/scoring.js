const { SCORE_WEIGHTS, TLS_VERSIONS } = require('./constants')

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
 * @param {{ tls: import('./types').TlsInfo, flags: Object }} params
 * @returns {import('./types').SslScoreResult}
 */
const calculateSslScore = ({ tls, flags }) => {
  let score = 0

  if (tls?.httpsEnabled) {
    score += SCORE_WEIGHTS.HTTPS_ENABLED
  }

  if (flags?.certValid) {
    score += SCORE_WEIGHTS.CERTIFICATE_VALID
  }

  if (tls?.version === TLS_VERSIONS.TLS13) {
    score += SCORE_WEIGHTS.TLS_VERSION
  } else if (tls?.version === TLS_VERSIONS.TLS12) {
    score += 15
  }

  const days = flags?.daysRemaining
  if (typeof days === 'number') {
    if (days > 90) score += SCORE_WEIGHTS.CERTIFICATE_EXPIRY
    else if (days > 30) score += Math.round(SCORE_WEIGHTS.CERTIFICATE_EXPIRY / 2)
  }

  if (flags?.hostnameMatch) {
    score += SCORE_WEIGHTS.HOSTNAME_MATCH
  }

  if (flags && flags.weakKey === false) {
    score += SCORE_WEIGHTS.KEY_STRENGTH
  }

  if (flags && flags.weakSignature === false) {
    score += SCORE_WEIGHTS.SIGNATURE_ALGORITHM
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)

  return { score, grade, risk }
}

module.exports = {
  calculateSslScore,
  scoreToGrade,
  gradeToRisk
}

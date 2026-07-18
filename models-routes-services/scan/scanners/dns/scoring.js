const { SCORE_WEIGHTS } = require('./constants')

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
 * @param {{ flags: Object, spf?: import('./types').SpfInfo }} params
 * @returns {import('./types').DnsScoreResult}
 */
const calculateDnsScore = ({ flags, spf }) => {
  let score = 0

  if (flags.hasSpf) {
    if (flags.spfStrong || spf?.policy === 'hardfail') score += SCORE_WEIGHTS.SPF
    else if (spf?.policy === 'softfail') score += Math.round(SCORE_WEIGHTS.SPF * 0.6)
    else score += Math.round(SCORE_WEIGHTS.SPF * 0.75)
  }

  if (flags.hasDmarc) {
    if (flags.dmarcEnforcing) score += SCORE_WEIGHTS.DMARC
    else score += Math.round(SCORE_WEIGHTS.DMARC * 0.6)
  }

  if (flags.hasCaa) score += SCORE_WEIGHTS.CAA
  if (flags.hasMx) score += SCORE_WEIGHTS.MX
  if (flags.hasIpv6) score += SCORE_WEIGHTS.IPV6
  if (flags.hasTxt) score += SCORE_WEIGHTS.TXT
  if (flags.hasNs) score += SCORE_WEIGHTS.NS

  score = Math.max(0, Math.min(100, Math.round(score)))
  const grade = scoreToGrade(score)
  const risk = gradeToRisk(grade)
  return { score, grade, risk }
}

module.exports = {
  calculateDnsScore,
  scoreToGrade,
  gradeToRisk
}

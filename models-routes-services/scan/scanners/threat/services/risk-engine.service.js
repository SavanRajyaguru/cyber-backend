const {
  SEVERITY,
  SEVERITY_WEIGHTS,
  THREAT_CATEGORIES,
  RISK_LEVELS
} = require('../constants')

const scoreToGrade = (score) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * @param {string} severity
 * @returns {number}
 */
const severityRank = (severity) => {
  switch (severity) {
    case SEVERITY.CRITICAL: return 5
    case SEVERITY.HIGH: return 4
    case SEVERITY.MEDIUM: return 3
    case SEVERITY.LOW: return 2
    default: return 1
  }
}

/**
 * Map numeric safety score + max severity → risk label.
 * @param {number} safetyScore
 * @param {string} maxSeverity
 */
const toOverallRisk = (safetyScore, maxSeverity) => {
  if (maxSeverity === SEVERITY.CRITICAL || safetyScore < 40) return RISK_LEVELS.CRITICAL
  if (maxSeverity === SEVERITY.HIGH || safetyScore < 60) return RISK_LEVELS.HIGH
  if (maxSeverity === SEVERITY.MEDIUM || safetyScore < 75) return RISK_LEVELS.MEDIUM
  if (maxSeverity === SEVERITY.LOW || safetyScore < 90) return RISK_LEVELS.LOW
  return RISK_LEVELS.INFORMATIONAL
}

/**
 * Bucket risk label for attack-surface dimensions.
 * @param {import('../types').ThreatFinding[]} items
 */
const dimensionRisk = (items = []) => {
  if (!items.length) return RISK_LEVELS.INFORMATIONAL
  let max = 0
  for (const f of items) max = Math.max(max, severityRank(f.severity))
  if (max >= 5) return RISK_LEVELS.CRITICAL
  if (max >= 4) return RISK_LEVELS.HIGH
  if (max >= 3) return RISK_LEVELS.MEDIUM
  if (max >= 2) return RISK_LEVELS.LOW
  return RISK_LEVELS.INFORMATIONAL
}

/**
 * Aggregate findings into threat score, grade, risk, categories, attack surface.
 *
 * Raw threatScore: weighted sum of finding severities (capped 100) — higher = worse.
 * score/nScore: safety posture 100 - threatScore — higher = better (ScanContext compatible).
 *
 * @param {import('../types').ThreatFinding[]} findings
 */
const calculateThreatRisk = (findings = []) => {
  const bySeverity = {
    [SEVERITY.CRITICAL]: 0,
    [SEVERITY.HIGH]: 0,
    [SEVERITY.MEDIUM]: 0,
    [SEVERITY.LOW]: 0,
    [SEVERITY.INFORMATIONAL]: 0
  }

  /** @type {Record<string, import('../types').ThreatFinding[]>} */
  const byCategory = {}
  let maxSeverity = SEVERITY.INFORMATIONAL
  let rawThreat = 0

  for (const f of findings) {
    const sev = bySeverity[f.severity] !== undefined ? f.severity : SEVERITY.LOW
    bySeverity[sev] += 1
    if (severityRank(sev) > severityRank(maxSeverity)) maxSeverity = sev

    const weight = SEVERITY_WEIGHTS[sev] ?? SEVERITY_WEIGHTS[SEVERITY.LOW]
    // Diminishing returns after first of each severity class contribution
    const classCount = bySeverity[sev]
    const factor = classCount === 1 ? 1 : classCount === 2 ? 0.5 : 0.25
    rawThreat += weight * factor

    const cat = f.category || 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(f)
  }

  const threatScore = Math.max(0, Math.min(100, Math.round(rawThreat)))
  const score = Math.max(0, Math.min(100, 100 - threatScore))
  const grade = scoreToGrade(score)
  const risk = toOverallRisk(score, maxSeverity)

  const inCats = (...names) =>
    findings.filter((f) => names.includes(f.category))

  /** @type {import('../types').AttackSurfaceSummary} */
  const attackSurface = {
    externalExposure: dimensionRisk(inCats(
      THREAT_CATEGORIES.INFRASTRUCTURE,
      THREAT_CATEGORIES.TECHNOLOGY,
      THREAT_CATEGORIES.SERVER_DISCLOSURE,
      THREAT_CATEGORIES.FRAMEWORK_DISCLOSURE
    )),
    configurationRisk: dimensionRisk(inCats(
      THREAT_CATEGORIES.SECURITY_HEADERS,
      THREAT_CATEGORIES.CSP,
      THREAT_CATEGORIES.HSTS,
      THREAT_CATEGORIES.CORS,
      THREAT_CATEGORIES.REFERRER_POLICY,
      THREAT_CATEGORIES.PERMISSIONS_POLICY,
      THREAT_CATEGORIES.TLS,
      THREAT_CATEGORIES.CERTIFICATE
    )),
    emailSecurityRisk: dimensionRisk(inCats(THREAT_CATEGORIES.EMAIL)),
    headerRisk: dimensionRisk(inCats(
      THREAT_CATEGORIES.SECURITY_HEADERS,
      THREAT_CATEGORIES.CSP,
      THREAT_CATEGORIES.HSTS,
      THREAT_CATEGORIES.CORS,
      THREAT_CATEGORIES.REFERRER_POLICY,
      THREAT_CATEGORIES.PERMISSIONS_POLICY,
      THREAT_CATEGORIES.SERVER_DISCLOSURE,
      THREAT_CATEGORIES.FRAMEWORK_DISCLOSURE
    )),
    technologyRisk: dimensionRisk(inCats(
      THREAT_CATEGORIES.TECHNOLOGY,
      THREAT_CATEGORIES.OUTDATED,
      THREAT_CATEGORIES.JAVASCRIPT
    )),
    secretExposure: dimensionRisk(inCats(
      THREAT_CATEGORIES.SECRETS,
      THREAT_CATEGORIES.PUBLIC_TOKENS
    )),
    overallRisk: risk
  }

  const categories = {}
  for (const [name, list] of Object.entries(byCategory)) {
    categories[name] = {
      count: list.length,
      maxSeverity: list.reduce(
        (max, f) => (severityRank(f.severity) > severityRank(max) ? f.severity : max),
        SEVERITY.INFORMATIONAL
      ),
      risk: dimensionRisk(list)
    }
  }

  const recommendations = []
  const seen = new Set()
  const actionable = findings
    .filter((f) => f.severity !== SEVERITY.INFORMATIONAL)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))

  for (const f of actionable) {
    const rec = f.recommendation
    if (!rec || rec === 'No action required.' || seen.has(rec)) continue
    seen.add(rec)
    recommendations.push(rec)
    if (recommendations.length >= 25) break
  }

  return {
    threatScore,
    score,
    grade,
    risk,
    maxSeverity,
    bySeverity,
    categories,
    attackSurface,
    recommendations,
    summary: {
      totalFindings: findings.length,
      bySeverity,
      threatScore,
      safetyScore: score,
      maxSeverity,
      attackSurface,
      overallRisk: risk
    }
  }
}

module.exports = {
  calculateThreatRisk,
  scoreToGrade,
  dimensionRisk
}

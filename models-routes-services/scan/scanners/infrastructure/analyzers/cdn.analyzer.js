const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * @param {Array<{ name: string, confidence: number, evidence?: string }>} cdnList
 */
const analyzeCdn = (cdnList = []) => {
  const findings = []
  const names = cdnList.map((c) => c.name)

  if (names.length) {
    for (const c of cdnList.slice(0, 5)) {
      findings.push(makeFinding({
        title: `${c.name} CDN Detected`,
        severity: SEVERITY.INFO,
        status: FINDING_STATUS.PASS,
        description: `CDN signals match ${c.name} (confidence ${c.confidence}).`,
        recommendation: 'No action required. Ensure origin IP remains protected behind the CDN.'
      }))
    }
  } else {
    findings.push(makeFinding({
      title: 'No CDN detected',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: 'No common CDN headers or hostnames were identified.',
      recommendation: 'Consider a CDN for DDoS protection, caching, and global performance.'
    }))
  }

  return {
    cdn: {
      present: names.length > 0,
      providers: names,
      details: cdnList.slice(0, 8)
    },
    findings,
    scoreRatio: names.length ? 1 : 0.35
  }
}

module.exports = {
  analyzeCdn
}

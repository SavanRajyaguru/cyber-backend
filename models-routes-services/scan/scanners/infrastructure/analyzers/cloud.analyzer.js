const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * @param {Array<{ name: string, confidence: number, evidence?: string }>} cloudList
 */
const analyzeCloud = (cloudList = []) => {
  const findings = []
  const names = cloudList.map((c) => c.name)

  if (names.length) {
    for (const c of cloudList.slice(0, 5)) {
      findings.push(makeFinding({
        title: `Hosted on ${c.name}`,
        severity: SEVERITY.INFO,
        status: FINDING_STATUS.INFO,
        description: `Cloud provider signals match ${c.name} (confidence ${c.confidence}).`,
        recommendation: 'Review cloud security posture (IAM, WAF, private origins) for this provider.'
      }))
    }
  } else {
    findings.push(makeFinding({
      title: 'Cloud provider unknown',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'Could not identify a major cloud provider from public signals.',
      recommendation: 'No action required.'
    }))
  }

  return {
    cloud: {
      present: names.length > 0,
      providers: names,
      details: cloudList.slice(0, 8)
    },
    findings
  }
}

module.exports = {
  analyzeCloud
}

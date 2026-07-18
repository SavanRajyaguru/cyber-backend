const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity, statusToSeverity } = require('../utils/finding')

/**
 * @param {Object|null} infrastructure
 * @returns {import('../types').ThreatFinding[]}
 */
const applyInfrastructureRule = (infrastructure) => {
  if (!infrastructure || infrastructure.oMeta?.bStub) return []

  const findings = []
  const network = infrastructure.network || {}
  const server = infrastructure.server || {}
  const hosting = infrastructure.hosting || {}
  const cdn = infrastructure.cdn || {}

  if (network.httpsEnabled === false) {
    findings.push(makeThreatFinding({
      title: 'HTTPS not confirmed',
      category: THREAT_CATEGORIES.INFRASTRUCTURE,
      severity: SEVERITY.CRITICAL,
      confidence: 90,
      affectedModule: 'infrastructure',
      description: 'Infrastructure scan could not confirm HTTPS for the target.',
      recommendation: 'Serve exclusively over HTTPS with a valid certificate.'
    }))
  }

  if (network.httpsEnabled && !network.hstsEnabled) {
    findings.push(makeThreatFinding({
      title: 'HSTS missing at infrastructure layer',
      category: THREAT_CATEGORIES.HSTS,
      severity: SEVERITY.HIGH,
      confidence: 85,
      affectedModule: 'infrastructure',
      description: 'HTTPS is enabled but HSTS was not observed.',
      recommendation: 'Enable Strict-Transport-Security on the edge.'
    }))
  }

  if (network.privateIps?.length) {
    findings.push(makeThreatFinding({
      title: 'Private IP published in DNS',
      category: THREAT_CATEGORIES.INFRASTRUCTURE,
      severity: SEVERITY.MEDIUM,
      confidence: 90,
      affectedModule: 'infrastructure',
      description: `Private addresses: ${network.privateIps.join(', ')}`,
      recommendation: 'Remove private RFC1918 addresses from public DNS.'
    }))
  }

  if (!cdn.present) {
    findings.push(makeThreatFinding({
      title: 'No CDN / edge protection detected',
      category: THREAT_CATEGORIES.INFRASTRUCTURE,
      severity: SEVERITY.LOW,
      confidence: 60,
      affectedModule: 'infrastructure',
      description: 'Origin may be directly exposed without a CDN/WAF layer.',
      recommendation: 'Consider a CDN/WAF to reduce DDoS and scanning exposure.'
    }))
  } else {
    findings.push(makeThreatFinding({
      title: `Edge/CDN in use: ${(cdn.providers || []).join(', ')}`,
      category: THREAT_CATEGORIES.INFRASTRUCTURE,
      severity: SEVERITY.INFORMATIONAL,
      confidence: 80,
      affectedModule: 'infrastructure',
      description: 'CDN reduces some external exposure when origin is locked down.',
      recommendation: 'Ensure origin IP is not publicly reachable outside the CDN.'
    }))
  }

  if (server.serverHeader) {
    findings.push(makeThreatFinding({
      title: 'Infrastructure server disclosure',
      category: THREAT_CATEGORIES.SERVER_DISCLOSURE,
      severity: SEVERITY.LOW,
      confidence: 85,
      affectedModule: 'infrastructure',
      description: `Server: ${server.serverHeader}`,
      recommendation: 'Hide or genericize server banners.'
    }))
  }

  if (hosting.provider) {
    findings.push(makeThreatFinding({
      title: `Hosting provider identified: ${hosting.provider}`,
      category: THREAT_CATEGORIES.INFRASTRUCTURE,
      severity: SEVERITY.INFORMATIONAL,
      confidence: 75,
      affectedModule: 'infrastructure',
      description: 'Provider fingerprint aids targeted reconnaissance.',
      recommendation: 'Apply provider-specific hardening and least-privilege IAM.'
    }))
  }

  for (const f of infrastructure.findings || []) {
    const status = String(f.status || '').toLowerCase()
    if (status !== 'fail' && status !== 'warn') continue
    const title = f.title || 'Infrastructure issue'
    if (findings.some((x) => x.title === title)) continue
    if (/hsts|https|cdn|server|private ip/i.test(title)) continue

    findings.push(makeThreatFinding({
      title,
      category: THREAT_CATEGORIES.INFRASTRUCTURE,
      severity: f.severity ? normalizeSeverity(f.severity) : statusToSeverity(status),
      confidence: 70,
      affectedModule: 'infrastructure',
      description: f.description || title,
      recommendation: f.recommendation || 'Review infrastructure hardening.'
    }))
  }

  return findings
}

module.exports = {
  name: 'infrastructure',
  sourceModule: 'infrastructure',
  apply: applyInfrastructureRule
}

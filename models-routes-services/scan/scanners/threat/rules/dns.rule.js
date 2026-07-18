const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding, normalizeSeverity, statusToSeverity } = require('../utils/finding')

/**
 * @param {Object|null} dns
 * @returns {import('../types').ThreatFinding[]}
 */
const applyDnsRule = (dns) => {
  if (!dns || dns.oMeta?.bStub) return []

  const findings = []
  const records = dns.records || {}
  const spf = records.SPF || {}
  const dmarc = records.DMARC || {}
  const dkim = records.DKIM || {}

  if (!records.AAAA?.length) {
    findings.push(makeThreatFinding({
      title: 'Missing IPv6 (AAAA)',
      category: THREAT_CATEGORIES.DNS,
      severity: SEVERITY.LOW,
      confidence: 85,
      affectedModule: 'dns',
      description: 'No AAAA records — dual-stack clients may fall back or face reachability gaps.',
      recommendation: 'Publish AAAA records if IPv6 is supported at the edge.'
    }))
  }

  if (!records.CAA?.length) {
    findings.push(makeThreatFinding({
      title: 'Missing CAA records',
      category: THREAT_CATEGORIES.DNS,
      severity: SEVERITY.MEDIUM,
      confidence: 90,
      affectedModule: 'dns',
      description: 'No CAA records restrict which CAs may issue certificates.',
      recommendation: 'Publish CAA records limiting allowed certificate authorities.'
    }))
  }

  if (!spf.exists) {
    findings.push(makeThreatFinding({
      title: 'Missing SPF',
      category: THREAT_CATEGORIES.EMAIL,
      severity: SEVERITY.HIGH,
      confidence: 92,
      affectedModule: 'dns',
      description: 'No SPF record was found for the email domain.',
      recommendation: 'Publish a single SPF record authorizing legitimate senders.'
    }))
  } else if (spf.policy === 'softfail' || spf.multiple) {
    findings.push(makeThreatFinding({
      title: 'Weak SPF configuration',
      category: THREAT_CATEGORIES.EMAIL,
      severity: SEVERITY.MEDIUM,
      confidence: 88,
      affectedModule: 'dns',
      description: spf.multiple
        ? 'Multiple SPF records detected.'
        : `SPF uses ${spf.policy} policy.`,
      recommendation: 'Use one SPF record with -all after validating senders.'
    }))
  }

  if (!dmarc.exists) {
    findings.push(makeThreatFinding({
      title: 'Missing DMARC',
      category: THREAT_CATEGORIES.EMAIL,
      severity: SEVERITY.HIGH,
      confidence: 92,
      affectedModule: 'dns',
      description: 'No DMARC policy protects the domain from spoofing.',
      recommendation: 'Publish DMARC; progress from p=none to quarantine/reject.'
    }))
  } else if (!/reject|quarantine/i.test(dmarc.policy || '')) {
    findings.push(makeThreatFinding({
      title: 'Weak DMARC policy',
      category: THREAT_CATEGORIES.EMAIL,
      severity: SEVERITY.MEDIUM,
      confidence: 85,
      affectedModule: 'dns',
      description: `DMARC policy is p=${dmarc.policy || 'none'}.`,
      recommendation: 'Strengthen DMARC to p=quarantine or p=reject.'
    }))
  }

  if (dkim?.status !== 'found') {
    findings.push(makeThreatFinding({
      title: 'DKIM not confirmed',
      category: THREAT_CATEGORIES.EMAIL,
      severity: SEVERITY.LOW,
      confidence: 60,
      affectedModule: 'dns',
      description: 'Common DKIM selectors were not confirmed in DNS.',
      recommendation: 'Publish DKIM keys for your mail provider if email is used.'
    }))
  }

  for (const f of dns.findings || []) {
    const status = String(f.status || '').toLowerCase()
    if (status !== 'fail' && status !== 'warn') continue
    const title = f.title || 'DNS issue'
    if (/spf|dmarc|dkim|aaaa|ipv6|caa/i.test(title)) continue
    if (findings.some((x) => x.title === title)) continue

    findings.push(makeThreatFinding({
      title,
      category: THREAT_CATEGORIES.DNS,
      severity: f.severity ? normalizeSeverity(f.severity) : statusToSeverity(status),
      confidence: 75,
      affectedModule: 'dns',
      description: f.description || title,
      recommendation: f.recommendation || 'Review DNS security configuration.'
    }))
  }

  return findings
}

module.exports = {
  name: 'dns',
  sourceModule: 'dns',
  apply: applyDnsRule
}

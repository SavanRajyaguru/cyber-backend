const { SEVERITY, FINDING_STATUS } = require('./constants')
const { analyzeSpf, analyzeDmarc, analyzeDkim, buildEmailFindings } = require('./email.analyzer')

/**
 * Analyze resolved DNS data into records DTO + findings.
 * @param {Awaited<ReturnType<import('./resolver').resolveAllRecords>>} resolved
 */
const analyzeDns = (resolved) => {
  const spf = analyzeSpf(resolved.TXT || [])
  const dmarc = analyzeDmarc(resolved.dmarcTxt || [])
  const dkim = analyzeDkim(resolved)

  const records = {
    A: resolved.A || [],
    AAAA: resolved.AAAA || [],
    CNAME: resolved.CNAME || [],
    MX: resolved.MX || [],
    NS: resolved.NS || [],
    TXT: resolved.TXT || [],
    SOA: resolved.SOA || null,
    CAA: resolved.CAA || [],
    PTR: resolved.PTR || [],
    SPF: spf,
    DMARC: dmarc,
    DKIM: dkim,
    DNSSEC: resolved.dnssec || { detectable: false, enabled: null }
  }

  const findings = []

  // IPv4
  if (!records.A.length && !records.CNAME.length) {
    findings.push({
      title: 'No IPv4 (A) records',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No A records were found for the hostname.',
      recommendation: 'Publish A records if the host should be reachable over IPv4.'
    })
  } else {
    findings.push({
      title: 'IPv4 present',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Found ${records.A.length || 'CNAME-backed'} IPv4 path(s).`,
      recommendation: 'No action required.'
    })
  }

  // IPv6
  if (!records.AAAA.length) {
    findings.push({
      title: 'No IPv6',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No AAAA records were found.',
      recommendation: 'Publish AAAA records to enable IPv6 reachability.'
    })
  } else {
    findings.push({
      title: 'IPv6 present',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Found ${records.AAAA.length} AAAA record(s).`,
      recommendation: 'No action required.'
    })
  }

  // CAA
  if (!records.CAA.length) {
    findings.push({
      title: 'Missing CAA',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.FAIL,
      description: 'No CAA records were found to restrict certificate authorities.',
      recommendation: 'Publish CAA records limiting which CAs may issue certificates for this domain.'
    })
  } else {
    findings.push({
      title: 'CAA present',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Found ${records.CAA.length} CAA record(s).`,
      recommendation: 'No action required.'
    })
  }

  // NS
  if (records.NS.length >= 2) {
    findings.push({
      title: 'Multiple NS',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Found ${records.NS.length} name servers.`,
      recommendation: 'No action required.'
    })
  } else if (records.NS.length === 1) {
    findings.push({
      title: 'Single NS',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'Only one NS record was found.',
      recommendation: 'Use at least two authoritative name servers for redundancy.'
    })
  } else {
    findings.push({
      title: 'Missing NS',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'No NS records were returned for the hostname.',
      recommendation: 'Ensure authoritative NS records are correctly delegated.'
    })
  }

  // MX
  if (!records.MX.length) {
    findings.push({
      title: 'No MX',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No MX records were found. Email delivery may not be configured.',
      recommendation: 'Publish MX records if the domain sends or receives email.'
    })
  } else {
    findings.push({
      title: 'MX present',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Found ${records.MX.length} MX record(s).`,
      recommendation: 'No action required.'
    })
  }

  // TXT
  if (!records.TXT.length) {
    findings.push({
      title: 'No TXT records',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.WARN,
      description: 'No TXT records were found at the domain apex/host.',
      recommendation: 'Add TXT records for SPF and other domain verifications as needed.'
    })
  } else {
    findings.push({
      title: 'TXT records present',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `Found ${records.TXT.length} TXT record(s).`,
      recommendation: 'No action required.'
    })
  }

  // DNSSEC
  if (records.DNSSEC.detectable && records.DNSSEC.enabled === true) {
    findings.push({
      title: 'DNSSEC enabled',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: 'DS records were detected for the domain.',
      recommendation: 'No action required.'
    })
  } else if (records.DNSSEC.detectable && records.DNSSEC.enabled === false) {
    findings.push({
      title: 'DNSSEC not enabled',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.WARN,
      description: 'No DS records were found for the domain.',
      recommendation: 'Consider enabling DNSSEC at your DNS provider.'
    })
  }

  findings.push(...buildEmailFindings({ spf, dmarc, dkim }))

  const flags = {
    hasSpf: spf.exists && !spf.multiple,
    spfStrong: spf.exists && spf.policy === 'hardfail' && !spf.multiple,
    hasDmarc: dmarc.exists,
    dmarcEnforcing: dmarc.exists && ['quarantine', 'reject'].includes(String(dmarc.policy || '').toLowerCase()),
    hasCaa: records.CAA.length > 0,
    hasMx: records.MX.length > 0,
    hasIpv6: records.AAAA.length > 0,
    hasTxt: records.TXT.length > 0,
    hasNs: records.NS.length >= 2
  }

  return { records, findings, flags }
}

module.exports = {
  analyzeDns
}

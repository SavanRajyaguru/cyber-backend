const { SEVERITY, FINDING_STATUS } = require('./constants')

/**
 * @param {string[]} txtRecords
 * @returns {import('./types').SpfInfo}
 */
const analyzeSpf = (txtRecords = []) => {
  const spfRecords = txtRecords.filter((r) => /^v=spf1\b/i.test(r))
  if (!spfRecords.length) {
    return {
      exists: false,
      records: [],
      multiple: false,
      policy: null,
      raw: null
    }
  }

  const raw = spfRecords[0]
  let policy = 'unknown'
  if (/\-all\b/i.test(raw)) policy = 'hardfail'
  else if (/~all\b/i.test(raw)) policy = 'softfail'
  else if (/\?all\b/i.test(raw) || /\+all\b/i.test(raw)) policy = 'neutral'

  return {
    exists: true,
    records: spfRecords,
    multiple: spfRecords.length > 1,
    policy,
    raw
  }
}

/**
 * @param {string[]} dmarcTxt
 * @returns {import('./types').DmarcInfo}
 */
const analyzeDmarc = (dmarcTxt = []) => {
  const record = dmarcTxt.find((r) => /v=DMARC1/i.test(r))
  if (!record) {
    return {
      exists: false,
      policy: null,
      percentage: null,
      rua: null,
      ruf: null,
      raw: null
    }
  }

  const getTag = (tag) => {
    const match = new RegExp(`(?:^|;\\s*)${tag}=([^;]+)`, 'i').exec(record)
    return match ? match[1].trim() : null
  }

  return {
    exists: true,
    policy: getTag('p'),
    percentage: getTag('pct'),
    rua: getTag('rua'),
    ruf: getTag('ruf'),
    raw: record
  }
}

/**
 * @param {{ dkimFound: {selector:string, record:string}|null, dkimSelectorsTried: string[] }} resolved
 * @returns {import('./types').DkimInfo}
 */
const analyzeDkim = (resolved) => {
  if (resolved.dkimFound) {
    return {
      status: 'found',
      selector: resolved.dkimFound.selector,
      selectorsTried: resolved.dkimSelectorsTried || [],
      record: resolved.dkimFound.record
    }
  }
  return {
    status: 'unknown',
    selector: null,
    selectorsTried: resolved.dkimSelectorsTried || [],
    record: null
  }
}

/**
 * Build email-security findings from SPF/DMARC/DKIM analysis.
 */
const buildEmailFindings = ({ spf, dmarc, dkim }) => {
  const findings = []

  if (!spf.exists) {
    findings.push({
      title: 'Missing SPF',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'No SPF TXT record (v=spf1) was found for the domain.',
      recommendation: 'Publish an SPF record authorizing legitimate mail senders.'
    })
  } else if (spf.multiple) {
    findings.push({
      title: 'Multiple conflicting SPF records',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `Found ${spf.records.length} SPF records. Only one SPF record should exist.`,
      recommendation: 'Merge into a single SPF record to avoid undefined mail authentication behavior.'
    })
  } else if (spf.policy === 'softfail') {
    findings.push({
      title: 'Weak SPF policy',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'SPF uses ~all (SoftFail), which is weaker than -all (HardFail).',
      recommendation: 'Tighten SPF to -all after verifying all legitimate senders are listed.'
    })
  } else if (spf.policy === 'hardfail') {
    findings.push({
      title: 'SPF policy',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: 'SPF is present with a HardFail (-all) policy.',
      recommendation: 'No action required.'
    })
  } else {
    findings.push({
      title: 'SPF present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `SPF is present (policy: ${spf.policy || 'unknown'}).`,
      recommendation: 'Prefer -all once sender inventory is complete.'
    })
  }

  if (!dmarc.exists) {
    findings.push({
      title: 'Missing DMARC',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'No DMARC record was found at _dmarc.<domain>.',
      recommendation: 'Publish a DMARC record (start with p=none, then quarantine/reject).'
    })
  } else {
    const policy = (dmarc.policy || '').toLowerCase()
    if (policy === 'none') {
      findings.push({
        title: 'DMARC monitoring only',
        severity: SEVERITY.MEDIUM,
        status: FINDING_STATUS.WARN,
        description: 'DMARC policy is p=none (monitor-only).',
        recommendation: 'Move to p=quarantine or p=reject after reviewing aggregate reports.'
      })
    } else {
      findings.push({
        title: 'DMARC present',
        severity: SEVERITY.LOW,
        status: FINDING_STATUS.PASS,
        description: `DMARC is present with policy p=${dmarc.policy}.`,
        recommendation: 'No action required.'
      })
    }
  }

  if (dkim.status === 'unknown') {
    findings.push({
      title: 'DKIM unknown',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.WARN,
      description: `DKIM not found for common selectors: ${(dkim.selectorsTried || []).join(', ')}.`,
      recommendation: 'Publish DKIM keys for your mail provider selectors if email is used.'
    })
  } else {
    findings.push({
      title: 'DKIM detected',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.PASS,
      description: `DKIM record found for selector "${dkim.selector}".`,
      recommendation: 'No action required.'
    })
  }

  return findings
}

module.exports = {
  analyzeSpf,
  analyzeDmarc,
  analyzeDkim,
  buildEmailFindings
}

const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { detectMailProvider } = require('../providers/mail.providers')

/**
 * Reuse DNS email security fields (MX/SPF/DMARC/DKIM).
 * @param {Object|null} dns
 */
const analyzeEmail = (dns = null) => {
  const findings = []
  const records = dns?.records || null

  if (!records) {
    findings.push(makeFinding({
      title: 'Email infrastructure unavailable',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'DNS module results were not available to analyze email security.',
      recommendation: 'Re-run with DNS scanner completed for full email posture.'
    }))
    return {
      email: {
        mx: [],
        spf: null,
        dmarc: null,
        dkim: null,
        mailProvider: null,
        available: false
      },
      findings,
      scoreRatio: 0.5
    }
  }

  const mx = records.MX || []
  const spf = records.SPF || null
  const dmarc = records.DMARC || null
  const dkim = records.DKIM || null
  const mail = detectMailProvider(mx)

  if (mail.provider) {
    findings.push(makeFinding({
      title: `Mail provider: ${mail.provider}`,
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: mail.evidence
        ? `Inferred from MX host ${mail.evidence}.`
        : 'Inferred from MX records.',
      recommendation: 'No action required.'
    }))
  }

  let score = 0
  let parts = 0

  // SPF
  parts += 1
  if (spf?.exists) {
    score += spf.policy === 'hardfail' ? 1 : 0.7
    if (spf.policy === 'softfail' || spf.multiple) {
      findings.push(makeFinding({
        title: 'Weak email security (SPF)',
        severity: SEVERITY.MEDIUM,
        status: FINDING_STATUS.WARN,
        description: spf.multiple
          ? 'Multiple SPF records detected.'
          : `SPF policy is ${spf.policy || 'unknown'}.`,
        recommendation: 'Use a single SPF record with -all after validating senders.'
      }))
    }
  } else {
    findings.push(makeFinding({
      title: 'Weak email security (missing SPF)',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No SPF record was found in DNS results.',
      recommendation: 'Publish an SPF record for the email domain.'
    }))
  }

  // DMARC
  parts += 1
  if (dmarc?.exists) {
    const strong = /reject|quarantine/i.test(dmarc.policy || '')
    score += strong ? 1 : 0.6
    if (!strong) {
      findings.push(makeFinding({
        title: 'Weak email security (DMARC)',
        severity: SEVERITY.MEDIUM,
        status: FINDING_STATUS.WARN,
        description: `DMARC policy is p=${dmarc.policy || 'none'}.`,
        recommendation: 'Move DMARC toward p=quarantine or p=reject.'
      }))
    }
  } else {
    findings.push(makeFinding({
      title: 'Weak email security (missing DMARC)',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No DMARC record was found.',
      recommendation: 'Publish a DMARC record at _dmarc.<domain>.'
    }))
  }

  // DKIM
  parts += 1
  if (dkim?.status === 'found') {
    score += 1
    findings.push(makeFinding({
      title: 'DKIM selector found',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `DKIM present for selector ${dkim.selector}.`,
      recommendation: 'No action required.'
    }))
  } else {
    score += 0.4
    findings.push(makeFinding({
      title: 'DKIM not confirmed',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: 'No common DKIM selector was confirmed in DNS results.',
      recommendation: 'Publish DKIM keys for your mail provider if email is used.'
    }))
  }

  // MX presence
  if (!mx.length) {
    findings.push(makeFinding({
      title: 'No MX records',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'No MX records — domain may not receive email.',
      recommendation: 'Add MX records if the domain should receive mail.'
    }))
  }

  return {
    email: {
      mx,
      spf,
      dmarc,
      dkim,
      mailProvider: mail.provider,
      mailProviderEvidence: mail.evidence,
      available: true
    },
    findings,
    scoreRatio: parts ? score / parts : 0.5
  }
}

module.exports = {
  analyzeEmail
}

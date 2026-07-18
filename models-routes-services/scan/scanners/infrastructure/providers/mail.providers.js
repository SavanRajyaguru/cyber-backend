/**
 * Infer mail provider from MX hostnames.
 * @param {Array<{ exchange?: string, priority?: number }|string>} mxRecords
 * @returns {{ provider: string|null, confidence: number, evidence: string|null }}
 */
const detectMailProvider = (mxRecords = []) => {
  const hosts = mxRecords.map((m) => {
    if (typeof m === 'string') return m.toLowerCase()
    return String(m?.exchange || m?.host || '').toLowerCase()
  }).filter(Boolean)

  const blob = hosts.join(' ')
  if (!blob) {
    return { provider: null, confidence: 0, evidence: null }
  }

  const rules = [
    { name: 'Google Workspace', pattern: /aspmx\.l\.google\.com|google\.com|googlemail\.com/i },
    { name: 'Microsoft 365', pattern: /mail\.protection\.outlook\.com|outlook\.com|hotmail\.com/i },
    { name: 'Proofpoint', pattern: /pphosted\.com|proofpoint/i },
    { name: 'Mimecast', pattern: /mimecast/i },
    { name: 'Zoho', pattern: /zoho\.com|zoho\.eu/i },
    { name: 'Amazon SES', pattern: /amazonses\.com/i },
    { name: 'Fastmail', pattern: /fastmail/i },
    { name: 'Proton Mail', pattern: /protonmail|proton\.me/i },
    { name: 'Yahoo', pattern: /yahoodns\.net|yahoo\.com/i },
    { name: 'Cloudflare Email', pattern: /mx\.cloudflare\.net/i }
  ]

  for (const rule of rules) {
    const hit = hosts.find((h) => rule.pattern.test(h))
    if (hit) {
      return { provider: rule.name, confidence: 90, evidence: hit }
    }
  }

  return {
    provider: 'Custom / Unknown',
    confidence: 40,
    evidence: hosts[0] || null
  }
}

module.exports = {
  detectMailProvider
}

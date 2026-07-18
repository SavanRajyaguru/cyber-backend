const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  httpsEnabled,
  sslTlsWeak,
  noSecrets,
  spfPresent,
  dmarcPresent,
  caaPresent,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.ISO27001

/**
 * ISO 27001 — public-facing Annex A oriented mappings only.
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'ISO-A8-24-HTTPS',
    framework: FW,
    control: 'A.8.24',
    title: 'Use of cryptography — HTTPS',
    severity: SEVERITY.CRITICAL,
    description: 'Cryptographic controls for data in transit on public sites.',
    recommendation: 'Enforce HTTPS.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'ISO-A8-24-TLS',
    framework: FW,
    control: 'A.8.24',
    title: 'Use of cryptography — TLS hardening',
    severity: SEVERITY.HIGH,
    description: 'Weak protocols violate cryptographic policy expectations.',
    recommendation: 'Disable TLS 1.0/1.1.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'ISO-A8-9-ACCESS-SECRETS',
    framework: FW,
    control: 'A.8.9',
    title: 'Configuration management — no leaked secrets',
    severity: SEVERITY.CRITICAL,
    description: 'Secrets must not appear in public configurations/assets.',
    recommendation: 'Remove exposed secrets and rotate keys.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'ISO-A8-9-HEADERS',
    framework: FW,
    control: 'A.8.9',
    title: 'Configuration management — security headers',
    severity: SEVERITY.HIGH,
    description: 'Secure baseline configuration for public web services.',
    recommendation: 'Enable HSTS, CSP, X-Content-Type-Options.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const keys = ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options']
      return keys.every((k) => sources.header.headers?.[k]?.present)
        ? CONTROL_STATUS.PASS
        : CONTROL_STATUS.FAIL
    }
  }),

  defineRule({
    id: 'ISO-A5-30-EMAIL',
    framework: FW,
    control: 'A.5.30',
    title: 'ICT readiness — email authenticity (SPF/DMARC)',
    severity: SEVERITY.MEDIUM,
    description: 'Email authentication supports organizational resilience.',
    recommendation: 'Publish SPF and DMARC records.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => {
      if (!sources.dns) return CONTROL_STATUS.NOT_APPLICABLE
      return spfPresent(sources) === CONTROL_STATUS.PASS &&
        dmarcPresent(sources) === CONTROL_STATUS.PASS
        ? CONTROL_STATUS.PASS
        : CONTROL_STATUS.FAIL
    }
  }),

  defineRule({
    id: 'ISO-A8-24-CAA',
    framework: FW,
    control: 'A.8.24',
    title: 'Cryptography — CAA certificate controls',
    severity: SEVERITY.MEDIUM,
    description: 'CAA supports certificate issuance governance.',
    recommendation: 'Publish CAA records.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => caaPresent(sources)
  }),

  defineRule({
    id: 'ISO-A8-9-HSTS',
    framework: FW,
    control: 'A.8.9',
    title: 'Secure configuration — HSTS',
    severity: SEVERITY.HIGH,
    description: 'HSTS hardens transport security configuration.',
    recommendation: 'Enable Strict-Transport-Security.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  }),

  defineRule({
    id: 'ISO-A5-15-DISCLOSURE',
    framework: FW,
    control: 'A.5.15',
    title: 'Access control — reduce information disclosure',
    severity: SEVERITY.LOW,
    description: 'Limit public disclosure of system details.',
    recommendation: 'Remove Server/X-Powered-By headers.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const exposed =
        sources.header.headers?.Server?.present ||
        sources.header.headers?.['X-Powered-By']?.present
      return exposed ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
    }
  })
]

module.exports = {
  id: FW,
  name: FW,
  getRules
}

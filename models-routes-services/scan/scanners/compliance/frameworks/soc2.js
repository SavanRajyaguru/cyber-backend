const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  httpsEnabled,
  sslTlsWeak,
  sslCertValid,
  noSecrets,
  spfPresent,
  dmarcPresent,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.SOC2

/**
 * SOC 2 — public-facing Trust Services Criteria mappings only.
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'SOC2-CC6-HTTPS',
    framework: FW,
    control: 'CC6.1',
    title: 'Logical access — encrypted public channels',
    severity: SEVERITY.CRITICAL,
    description: 'Public systems should protect data in transit.',
    recommendation: 'Enforce HTTPS.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'SOC2-CC6-TLS',
    framework: FW,
    control: 'CC6.1',
    title: 'Logical access — strong TLS',
    severity: SEVERITY.HIGH,
    description: 'Weak TLS weakens access security.',
    recommendation: 'Disable obsolete TLS protocols.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'SOC2-CC6-CERT',
    framework: FW,
    control: 'CC6.7',
    title: 'Transmission of data — valid certificates',
    severity: SEVERITY.HIGH,
    description: 'Certificates must remain valid.',
    recommendation: 'Monitor and renew TLS certificates.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslCertValid(sources)
  }),

  defineRule({
    id: 'SOC2-CC7-HEADERS',
    framework: FW,
    control: 'CC7.1',
    title: 'System operations — hardened HTTP headers',
    severity: SEVERITY.HIGH,
    description: 'Detect/prevent common web abuses via security headers.',
    recommendation: 'Enable HSTS, CSP, and X-Content-Type-Options.',
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
    id: 'SOC2-CC6-SECRETS',
    framework: FW,
    control: 'CC6.1',
    title: 'Logical access — no public secrets',
    severity: SEVERITY.CRITICAL,
    description: 'Exposed secrets bypass access controls.',
    recommendation: 'Remove public secrets and rotate credentials.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'SOC2-CC9-EMAIL',
    framework: FW,
    control: 'CC9.1',
    title: 'Risk mitigation — email authentication',
    severity: SEVERITY.MEDIUM,
    description: 'SPF/DMARC reduce spoofing risk to customers.',
    recommendation: 'Configure SPF and DMARC.',
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
    id: 'SOC2-CC7-HSTS',
    framework: FW,
    control: 'CC7.2',
    title: 'System monitoring support — HSTS',
    severity: SEVERITY.HIGH,
    description: 'HSTS is a preventive control for transport security.',
    recommendation: 'Enable Strict-Transport-Security.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  })
]

module.exports = {
  id: FW,
  name: FW,
  getRules
}

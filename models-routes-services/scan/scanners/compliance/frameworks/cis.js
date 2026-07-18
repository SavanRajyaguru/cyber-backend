const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  httpsEnabled,
  sslTlsWeak,
  noSecrets,
  spfPresent,
  dmarcPresent,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.CIS

/**
 * CIS Controls — web-relevant subset (public site signals only).
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'CIS-3-DATA-PROTECTION-HTTPS',
    framework: FW,
    control: 'CIS 3',
    title: 'Data Protection — encrypt data in transit',
    severity: SEVERITY.CRITICAL,
    description: 'CIS Control 3 expects encryption of sensitive data in transit.',
    recommendation: 'Enforce HTTPS across the public website.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'CIS-3-TLS-HARDENING',
    framework: FW,
    control: 'CIS 3',
    title: 'Data Protection — TLS hardening',
    severity: SEVERITY.HIGH,
    description: 'Disable obsolete TLS versions.',
    recommendation: 'Require TLS 1.2+.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'CIS-4-SECURE-CONFIG-HEADERS',
    framework: FW,
    control: 'CIS 4',
    title: 'Secure Configuration — security headers',
    severity: SEVERITY.HIGH,
    description: 'Harden publicly exposed services with security headers.',
    recommendation: 'Enable HSTS, CSP, and X-Content-Type-Options.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const keys = ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options']
      const ok = keys.every((k) => sources.header.headers?.[k]?.present)
      return ok ? CONTROL_STATUS.PASS : CONTROL_STATUS.FAIL
    }
  }),

  defineRule({
    id: 'CIS-4-NO-BANNER',
    framework: FW,
    control: 'CIS 4',
    title: 'Secure Configuration — reduce fingerprinting',
    severity: SEVERITY.MEDIUM,
    description: 'Remove unnecessary service banners.',
    recommendation: 'Hide Server / X-Powered-By headers.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const exposed =
        sources.header.headers?.Server?.present ||
        sources.header.headers?.['X-Powered-By']?.present
      return exposed ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
    }
  }),

  defineRule({
    id: 'CIS-16-SECRETS',
    framework: FW,
    control: 'CIS 16',
    title: 'Application Software Security — no public secrets',
    severity: SEVERITY.CRITICAL,
    description: 'Prevent credential exposure in application assets.',
    recommendation: 'Remove secrets from client-side code and rotate keys.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'CIS-9-EMAIL-AUTH',
    framework: FW,
    control: 'CIS 9',
    title: 'Email & Web Browser Protections — SPF/DMARC',
    severity: SEVERITY.MEDIUM,
    description: 'Protect the domain from email spoofing.',
    recommendation: 'Configure SPF and DMARC for the email domain.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => {
      if (!sources.dns) return CONTROL_STATUS.NOT_APPLICABLE
      const spf = spfPresent(sources)
      const dmarc = dmarcPresent(sources)
      if (spf === CONTROL_STATUS.PASS && dmarc === CONTROL_STATUS.PASS) {
        return CONTROL_STATUS.PASS
      }
      return CONTROL_STATUS.FAIL
    }
  }),

  defineRule({
    id: 'CIS-4-HSTS',
    framework: FW,
    control: 'CIS 4',
    title: 'Secure Configuration — HSTS',
    severity: SEVERITY.HIGH,
    description: 'Force HTTPS via HSTS.',
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

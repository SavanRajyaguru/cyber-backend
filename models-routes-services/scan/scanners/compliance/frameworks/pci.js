const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  httpsEnabled,
  sslTlsWeak,
  sslCertValid,
  noSecrets,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.PCI

/**
 * PCI DSS — public website related checks only (not full cardholder environment).
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'PCI-4.1-HTTPS',
    framework: FW,
    control: '4.1',
    title: 'Strong cryptography for transmission — HTTPS',
    severity: SEVERITY.CRITICAL,
    description: 'PCI DSS requires strong cryptography when transmitting sensitive data.',
    recommendation: 'Serve the public site over HTTPS only.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'PCI-4.1-TLS',
    framework: FW,
    control: '4.1',
    title: 'Strong cryptography — no weak TLS',
    severity: SEVERITY.CRITICAL,
    description: 'Obsolete TLS versions are not acceptable.',
    recommendation: 'Disable TLS 1.0/1.1.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'PCI-4.2-CERT',
    framework: FW,
    control: '4.2',
    title: 'Valid trusted certificates',
    severity: SEVERITY.CRITICAL,
    description: 'Certificates must be valid.',
    recommendation: 'Maintain non-expired publicly trusted certificates.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslCertValid(sources)
  }),

  defineRule({
    id: 'PCI-6.5-XSS-CSP',
    framework: FW,
    control: '6.5.7',
    title: 'XSS defenses — CSP',
    severity: SEVERITY.HIGH,
    description: 'Public pages should mitigate XSS with CSP.',
    recommendation: 'Deploy Content-Security-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Content-Security-Policy')
  }),

  defineRule({
    id: 'PCI-6.5-CLICKJACK',
    framework: FW,
    control: '6.5.10',
    title: 'Broken authentication / UI redress — framing controls',
    severity: SEVERITY.MEDIUM,
    description: 'Protect against clickjacking on public pages.',
    recommendation: 'Set X-Frame-Options or CSP frame-ancestors.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'X-Frame-Options')
  }),

  defineRule({
    id: 'PCI-8-SECRETS',
    framework: FW,
    control: '8.3',
    title: 'No exposed authentication secrets',
    severity: SEVERITY.CRITICAL,
    description: 'Secrets must not appear in public resources.',
    recommendation: 'Remove and rotate any exposed keys/tokens.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'PCI-2-HARDENING-HSTS',
    framework: FW,
    control: '2.2',
    title: 'Secure configuration — HSTS',
    severity: SEVERITY.HIGH,
    description: 'Harden public web servers with HSTS.',
    recommendation: 'Enable Strict-Transport-Security.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  }),

  defineRule({
    id: 'PCI-2-NO-DEFAULT-DISCLOSURE',
    framework: FW,
    control: '2.2',
    title: 'Secure configuration — no unnecessary services info',
    severity: SEVERITY.MEDIUM,
    description: 'Do not disclose server/software versions publicly.',
    recommendation: 'Remove Server and X-Powered-By headers.',
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

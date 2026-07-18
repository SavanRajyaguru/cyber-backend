const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  sslTlsWeak,
  sslCertValid,
  httpsEnabled,
  spfPresent,
  dmarcPresent,
  noSecrets,
  caaPresent,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.OWASP_ASVS

/**
 * OWASP ASVS — selected web-facing verification requirements.
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'OWASP-ASVS-V9.1-TLS',
    framework: FW,
    control: 'V9.1',
    title: 'Communications security — strong TLS',
    severity: SEVERITY.HIGH,
    description: 'ASVS requires modern TLS configuration.',
    recommendation: 'Use TLS 1.2+ only with strong ciphers.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'OWASP-ASVS-V9.2-HTTPS',
    framework: FW,
    control: 'V9.2',
    title: 'Communications security — HTTPS',
    severity: SEVERITY.CRITICAL,
    description: 'All authenticated and sensitive traffic must use HTTPS.',
    recommendation: 'Serve the site exclusively over HTTPS.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'OWASP-ASVS-V9.3-CERT',
    framework: FW,
    control: 'V9.3',
    title: 'Valid TLS certificate',
    severity: SEVERITY.CRITICAL,
    description: 'Certificates must be valid and unexpired.',
    recommendation: 'Renew certificates before expiry; automate rotation.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslCertValid(sources)
  }),

  defineRule({
    id: 'OWASP-ASVS-V14.4-HSTS',
    framework: FW,
    control: 'V14.4',
    title: 'HTTP Strict Transport Security',
    severity: SEVERITY.HIGH,
    description: 'ASVS V14.4 expects HSTS on HTTPS sites.',
    recommendation: 'Add Strict-Transport-Security with adequate max-age.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  }),

  defineRule({
    id: 'OWASP-ASVS-V14.4-CSP',
    framework: FW,
    control: 'V14.4',
    title: 'Content Security Policy',
    severity: SEVERITY.HIGH,
    description: 'ASVS expects CSP for XSS defense-in-depth.',
    recommendation: 'Deploy a restrictive Content-Security-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Content-Security-Policy')
  }),

  defineRule({
    id: 'OWASP-ASVS-V14.4-XCTO',
    framework: FW,
    control: 'V14.4',
    title: 'X-Content-Type-Options',
    severity: SEVERITY.MEDIUM,
    description: 'Prevent MIME sniffing.',
    recommendation: 'Set X-Content-Type-Options: nosniff.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'X-Content-Type-Options')
  }),

  defineRule({
    id: 'OWASP-ASVS-V14.4-XFO',
    framework: FW,
    control: 'V14.4',
    title: 'Clickjacking protection',
    severity: SEVERITY.MEDIUM,
    description: 'X-Frame-Options or CSP frame-ancestors required.',
    recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'X-Frame-Options')
  }),

  defineRule({
    id: 'OWASP-ASVS-V14.4-REFERRER',
    framework: FW,
    control: 'V14.4',
    title: 'Referrer-Policy',
    severity: SEVERITY.MEDIUM,
    description: 'Control referrer leakage.',
    recommendation: 'Set a strict Referrer-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Referrer-Policy')
  }),

  defineRule({
    id: 'OWASP-ASVS-V2-SECRETS',
    framework: FW,
    control: 'V2.10',
    title: 'No secrets in client-accessible resources',
    severity: SEVERITY.CRITICAL,
    description: 'Credentials must not appear in public JS/HTML.',
    recommendation: 'Remove and rotate any exposed secrets.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'OWASP-ASVS-V6-EMAIL-SPF',
    framework: FW,
    control: 'V6.1',
    title: 'Email authentication — SPF',
    severity: SEVERITY.MEDIUM,
    description: 'SPF helps prevent domain spoofing.',
    recommendation: 'Publish a valid SPF record.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => spfPresent(sources)
  }),

  defineRule({
    id: 'OWASP-ASVS-V6-EMAIL-DMARC',
    framework: FW,
    control: 'V6.1',
    title: 'Email authentication — DMARC',
    severity: SEVERITY.MEDIUM,
    description: 'DMARC completes email authentication posture.',
    recommendation: 'Publish DMARC with an enforcing policy.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => dmarcPresent(sources)
  }),

  defineRule({
    id: 'OWASP-ASVS-V9-CAA',
    framework: FW,
    control: 'V9.4',
    title: 'CAA DNS records',
    severity: SEVERITY.MEDIUM,
    description: 'CAA restricts which CAs may issue certificates.',
    recommendation: 'Publish CAA records for the domain.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => caaPresent(sources)
  })
]

module.exports = {
  id: FW,
  name: FW,
  getRules
}

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

const FW = FRAMEWORK_IDS.NIST

/**
 * NIST Cybersecurity Framework — high-level public-facing mappings.
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'NIST-PR-DS-HTTPS',
    framework: FW,
    control: 'PR.DS',
    title: 'Protect — Data Security (in transit)',
    severity: SEVERITY.CRITICAL,
    description: 'Protect confidentiality of data in transit with HTTPS.',
    recommendation: 'Enforce HTTPS site-wide.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'NIST-PR-DS-TLS',
    framework: FW,
    control: 'PR.DS',
    title: 'Protect — strong cryptography',
    severity: SEVERITY.HIGH,
    description: 'Use strong TLS protocol versions.',
    recommendation: 'Disable weak TLS versions.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'NIST-PR-IP-HEADERS',
    framework: FW,
    control: 'PR.IP',
    title: 'Protect — Information Protection Processes (headers)',
    severity: SEVERITY.HIGH,
    description: 'Baseline protective HTTP headers.',
    recommendation: 'Enable HSTS and CSP.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const hsts = sources.header.headers?.['Strict-Transport-Security']?.present
      const csp = sources.header.headers?.['Content-Security-Policy']?.present
      return hsts && csp ? CONTROL_STATUS.PASS : CONTROL_STATUS.FAIL
    }
  }),

  defineRule({
    id: 'NIST-PR-AC-SECRETS',
    framework: FW,
    control: 'PR.AC',
    title: 'Protect — Access Control (no leaked credentials)',
    severity: SEVERITY.CRITICAL,
    description: 'Credentials must not be publicly accessible.',
    recommendation: 'Rotate and remove exposed secrets.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'NIST-ID-AM-FINGERPRINT',
    framework: FW,
    control: 'ID.AM',
    title: 'Identify — Asset Management (reduce disclosure)',
    severity: SEVERITY.LOW,
    description: 'Minimize unnecessary technology disclosure.',
    recommendation: 'Remove Server/X-Powered-By banners.',
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
    id: 'NIST-PR-DS-CAA',
    framework: FW,
    control: 'PR.DS',
    title: 'Protect — certificate issuance controls (CAA)',
    severity: SEVERITY.MEDIUM,
    description: 'CAA records support certificate governance.',
    recommendation: 'Publish CAA DNS records.',
    evidenceSource: 'dns',
    evaluate: ({ sources }) => caaPresent(sources)
  }),

  defineRule({
    id: 'NIST-PR-AT-EMAIL',
    framework: FW,
    control: 'PR.AT',
    title: 'Protect — Awareness via email authenticity (SPF/DMARC)',
    severity: SEVERITY.MEDIUM,
    description: 'Email authentication reduces spoofing risk to stakeholders.',
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
    id: 'NIST-PR-PT-HSTS',
    framework: FW,
    control: 'PR.PT',
    title: 'Protect — Protective Technology (HSTS)',
    severity: SEVERITY.HIGH,
    description: 'HSTS is a protective browser control.',
    recommendation: 'Enable HSTS.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  })
]

module.exports = {
  id: FW,
  name: FW,
  getRules
}

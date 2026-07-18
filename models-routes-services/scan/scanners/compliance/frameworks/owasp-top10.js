const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  requireHeaderAbsent,
  sslTlsWeak,
  httpsEnabled,
  noSecrets,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.OWASP_TOP10

/**
 * OWASP Top 10 (2021) — public-website oriented mappings.
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'OWASP-T10-A01-CORS',
    framework: FW,
    control: 'A01:2021',
    title: 'Broken Access Control — CORS hygiene',
    severity: SEVERITY.HIGH,
    description: 'Overly permissive CORS can enable unauthorized cross-origin data access.',
    recommendation: 'Restrict Access-Control-Allow-Origin to trusted origins.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const acao = sources.header.headers?.['Access-Control-Allow-Origin']
      if (!acao?.present) return CONTROL_STATUS.PASS
      if (acao.value === '*' || acao.status === 'bad' || acao.status === 'warn') {
        return CONTROL_STATUS.FAIL
      }
      return CONTROL_STATUS.PASS
    }
  }),

  defineRule({
    id: 'OWASP-T10-A02-TLS',
    framework: FW,
    control: 'A02:2021',
    title: 'Cryptographic Failures — TLS strength',
    severity: SEVERITY.HIGH,
    description: 'Weak TLS protocols undermine transport confidentiality.',
    recommendation: 'Disable TLS 1.0/1.1; require TLS 1.2+.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => sslTlsWeak(sources)
  }),

  defineRule({
    id: 'OWASP-T10-A02-HTTPS',
    framework: FW,
    control: 'A02:2021',
    title: 'Cryptographic Failures — HTTPS enabled',
    severity: SEVERITY.CRITICAL,
    description: 'Sites must serve traffic over HTTPS.',
    recommendation: 'Enforce HTTPS for all public pages.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'OWASP-T10-A03-CSP',
    framework: FW,
    control: 'A03:2021',
    title: 'Injection — Content-Security-Policy',
    severity: SEVERITY.HIGH,
    description: 'CSP reduces XSS impact from injection flaws.',
    recommendation: 'Deploy a restrictive Content-Security-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Content-Security-Policy')
  }),

  defineRule({
    id: 'OWASP-T10-A04-HSTS',
    framework: FW,
    control: 'A04:2021',
    title: 'Insecure Design — HSTS',
    severity: SEVERITY.HIGH,
    description: 'HSTS prevents SSL-stripping and cookie downgrade attacks.',
    recommendation: 'Enable Strict-Transport-Security with a sufficient max-age.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  }),

  defineRule({
    id: 'OWASP-T10-A05-SECURITY-HEADERS',
    framework: FW,
    control: 'A05:2021',
    title: 'Security Misconfiguration — core headers',
    severity: SEVERITY.HIGH,
    description: 'Missing baseline security headers indicate misconfiguration.',
    recommendation: 'Set X-Content-Type-Options, X-Frame-Options, and Referrer-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const required = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']
      const missing = required.filter((h) => !sources.header.headers?.[h]?.present)
      return missing.length ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
    }
  }),

  defineRule({
    id: 'OWASP-T10-A05-DISCLOSURE',
    framework: FW,
    control: 'A05:2021',
    title: 'Security Misconfiguration — server disclosure',
    severity: SEVERITY.MEDIUM,
    description: 'Server/Powered-By headers aid attackers in fingerprinting.',
    recommendation: 'Remove Server and X-Powered-By disclosure headers.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => {
      if (!sources.header) return CONTROL_STATUS.NOT_APPLICABLE
      const server = sources.header.headers?.Server?.present
      const powered = sources.header.headers?.['X-Powered-By']?.present
      return server || powered ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
    }
  }),

  defineRule({
    id: 'OWASP-T10-A07-SECRETS',
    framework: FW,
    control: 'A07:2021',
    title: 'Identification Failures — exposed secrets/tokens',
    severity: SEVERITY.CRITICAL,
    description: 'Public secrets undermine authentication and session integrity.',
    recommendation: 'Rotate exposed credentials and remove them from public assets.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'OWASP-T10-A09-MONITORING',
    framework: FW,
    control: 'A09:2021',
    title: 'Security Logging — public error hygiene (best effort)',
    severity: SEVERITY.LOW,
    description: 'Verbose powered-by / stack disclosure can leak operational detail.',
    recommendation: 'Avoid exposing runtime versions in public responses.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeaderAbsent(sources, 'X-Powered-By')
  })
]

module.exports = {
  id: FW,
  name: FW,
  getRules
}

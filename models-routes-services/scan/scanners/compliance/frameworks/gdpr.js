const { FRAMEWORK_IDS, SEVERITY } = require('../constants')
const { defineRule } = require('../utils/rule.factory')
const {
  requireHeader,
  httpsEnabled,
  noSecrets,
  CONTROL_STATUS
} = require('../utils/checks')

const FW = FRAMEWORK_IDS.GDPR

/**
 * GDPR — website-facing best practices only (not legal advice).
 * @returns {import('../types').ComplianceRule[]}
 */
const getRules = () => [
  defineRule({
    id: 'GDPR-32-HTTPS',
    framework: FW,
    control: 'Art. 32',
    title: 'Security of processing — encryption in transit',
    severity: SEVERITY.HIGH,
    description: 'Appropriate technical measures include protecting personal data in transit.',
    recommendation: 'Use HTTPS for all pages that may process personal data.',
    evidenceSource: 'ssl',
    evaluate: ({ sources }) => httpsEnabled(sources)
  }),

  defineRule({
    id: 'GDPR-32-HSTS',
    framework: FW,
    control: 'Art. 32',
    title: 'Security of processing — HSTS',
    severity: SEVERITY.MEDIUM,
    description: 'HSTS reduces downgrade risk for data in transit.',
    recommendation: 'Enable HSTS on the public site.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Strict-Transport-Security')
  }),

  defineRule({
    id: 'GDPR-32-REFERRER',
    framework: FW,
    control: 'Art. 32',
    title: 'Security of processing — referrer leakage control',
    severity: SEVERITY.MEDIUM,
    description: 'Referrer headers can leak personal data in URLs.',
    recommendation: 'Set a restrictive Referrer-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Referrer-Policy')
  }),

  defineRule({
    id: 'GDPR-32-CSP',
    framework: FW,
    control: 'Art. 32',
    title: 'Security of processing — XSS mitigations (CSP)',
    severity: SEVERITY.MEDIUM,
    description: 'CSP helps protect users against script injection impacting personal data.',
    recommendation: 'Deploy Content-Security-Policy.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Content-Security-Policy')
  }),

  defineRule({
    id: 'GDPR-32-NO-SECRETS',
    framework: FW,
    control: 'Art. 32',
    title: 'Security of processing — no public credentials',
    severity: SEVERITY.CRITICAL,
    description: 'Exposed secrets can lead to unlawful access to personal data.',
    recommendation: 'Remove and rotate exposed credentials immediately.',
    evidenceSource: 'secret',
    evaluate: ({ sources }) => noSecrets(sources)
  }),

  defineRule({
    id: 'GDPR-5-PERMISSIONS',
    framework: FW,
    control: 'Art. 5',
    title: 'Data minimisation — browser feature permissions',
    severity: SEVERITY.LOW,
    description: 'Limit unnecessary browser APIs that may collect personal data.',
    recommendation: 'Set Permissions-Policy to deny unused sensitive features.',
    evidenceSource: 'header',
    evaluate: ({ sources }) => requireHeader(sources, 'Permissions-Policy')
  }),

  defineRule({
    id: 'GDPR-32-SAFE-LINKS',
    framework: FW,
    control: 'Art. 32',
    title: 'Integrity — safe external navigation (noopener)',
    severity: SEVERITY.LOW,
    description: 'Unsafe target=_blank can enable tab-nabbing against users.',
    recommendation: 'Use rel="noopener noreferrer" on external new-tab links.',
    evidenceSource: 'seo',
    evaluate: ({ sources }) => {
      if (!sources.seo) return CONTROL_STATUS.NOT_APPLICABLE
      const unsafe = sources.seo.links?.unsafeTargetBlank || 0
      return unsafe > 0 ? CONTROL_STATUS.FAIL : CONTROL_STATUS.PASS
    }
  })
]

module.exports = {
  id: FW,
  name: FW,
  getRules
}

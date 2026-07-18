/**
 * Normalize heterogeneous scanner findings into a common shape.
 */

let seq = 0
const nextId = (moduleName) => {
  seq += 1
  return `${moduleName}-${seq}`
}

const normSeverity = (raw) => {
  const s = String(raw || '').toLowerCase()
  if (s === 'critical') return 'Critical'
  if (s === 'high') return 'High'
  if (s === 'medium' || s === 'med') return 'Medium'
  if (s === 'low') return 'Low'
  if (s === 'info' || s === 'informational') return 'Info'
  return 'Medium'
}

const normStatus = (raw, severity) => {
  const s = String(raw || '').toLowerCase()
  if (['fail', 'failed', 'error'].includes(s)) return 'fail'
  if (['warn', 'warning'].includes(s)) return 'warn'
  if (['pass', 'passed', 'ok', 'good'].includes(s)) return 'pass'
  if (['info', 'informational'].includes(s)) return 'info'
  if (/critical|high/i.test(String(severity || ''))) return 'fail'
  if (/medium/i.test(String(severity || ''))) return 'warn'
  return 'info'
}

/**
 * @param {string} moduleName
 * @param {Object} raw
 * @returns {import('../types').NormalizedFinding}
 */
const toNormalized = (moduleName, raw) => ({
  id: nextId(moduleName),
  module: moduleName,
  category: String(raw.category || raw.header || raw.type || moduleName),
  severity: normSeverity(raw.severity || raw.level),
  title: String(raw.title || raw.message || raw.code || 'Finding'),
  status: normStatus(raw.status, raw.severity),
  evidence: String(
    raw.evidence ||
    raw.description ||
    raw.message ||
    raw.matchedValuePreview ||
    raw.resource ||
    raw.value ||
    ''
  ).slice(0, 500),
  recommendation: String(raw.recommendation || raw.message || 'Review and remediate.')
})

/**
 * Module-specific extractors.
 * @type {Record<string, (result: Object) => import('../types').NormalizedFinding[]>}
 */
const EXTRACTORS = {
  header: (r) => (r.findings || []).map((f) => toNormalized('header', {
    ...f,
    title: f.message || f.code,
    category: f.header || 'header',
    recommendation: f.message
  })),

  ssl: (r) => (r.findings || []).map((f) => toNormalized('ssl', f)),

  dns: (r) => (r.findings || []).map((f) => toNormalized('dns', f)),

  technology: (r) => (r.findings || []).map((f) => toNormalized('technology', f)),

  javascript: (r) => {
    const fromFindings = (r.findings || []).map((f) => toNormalized('javascript', f))
    const fromSecrets = (r.secrets || []).map((f) => toNormalized('javascript', {
      ...f,
      category: 'secret',
      title: f.title || f.type || 'JS secret'
    }))
    return [...fromFindings, ...fromSecrets]
  },

  secret: (r) => (r.findings || []).map((f) => toNormalized('secret', {
    ...f,
    category: f.type || 'secret',
    status: 'fail',
    evidence: [f.resource, f.matchedValuePreview].filter(Boolean).join(' | ')
  })),

  seo: (r) => (r.findings || []).map((f) => toNormalized('seo', f)),

  performance: (r) => (r.findings || []).map((f) => toNormalized('performance', f)),

  infrastructure: (r) => (r.findings || []).map((f) => toNormalized('infrastructure', f)),

  threat: (r) => (r.findings || []).map((f) => toNormalized('threat', {
    ...f,
    status: /critical|high/i.test(f.severity || '') ? 'fail' : f.status || 'warn',
    evidence: f.description
  }))
}

/**
 * Normalize all available scanner outputs.
 * @param {Record<string, Object|null>} sources
 * @returns {import('../types').NormalizedFinding[]}
 */
const normalizeFindings = (sources = {}) => {
  seq = 0
  const out = []
  for (const [moduleName, result] of Object.entries(sources)) {
    if (!result || result.oMeta?.bStub) continue
    const extractor = EXTRACTORS[moduleName]
    if (!extractor) continue
    try {
      out.push(...extractor(result))
    } catch {
      // continue — never crash on unknown shapes
    }
  }
  return out
}

module.exports = {
  normalizeFindings,
  toNormalized
}

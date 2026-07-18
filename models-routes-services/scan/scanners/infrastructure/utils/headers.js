/**
 * Flatten header-scanner analysis map + raw header bag into lowercase name→value.
 * @param {Object|null} headerResult
 * @param {Object|null} rawHeaders
 * @returns {Record<string, string>}
 */
const flattenHeaders = (headerResult = null, rawHeaders = null) => {
  /** @type {Record<string, string>} */
  const out = {}

  if (rawHeaders && typeof rawHeaders === 'object') {
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (v == null || v === '') continue
      out[String(k).toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)
    }
  }

  const analyzed = headerResult?.headers
  if (analyzed && typeof analyzed === 'object') {
    for (const [label, meta] of Object.entries(analyzed)) {
      const value = meta?.value
      if (value == null || value === '') continue
      out[String(label).toLowerCase()] = String(value)
    }
  }

  return out
}

/**
 * @param {Record<string, string>} headers
 * @param {string} name
 */
const getHeader = (headers, name) => {
  if (!headers) return null
  const v = headers[String(name).toLowerCase()]
  return v != null && v !== '' ? String(v) : null
}

/**
 * Build a single searchable blob from headers + tech names + DNS strings.
 * @param {Record<string, string>} headers
 * @param {string[]} extras
 */
const buildEvidenceBlob = (headers = {}, extras = []) => {
  const parts = Object.entries(headers).map(([k, v]) => `${k}: ${v}`)
  for (const e of extras) {
    if (e) parts.push(String(e))
  }
  return parts.join('\n')
}

module.exports = {
  flattenHeaders,
  getHeader,
  buildEvidenceBlob
}

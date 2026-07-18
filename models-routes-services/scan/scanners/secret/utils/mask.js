/**
 * Mask a secret value for safe reporting. Never return the full secret.
 * @param {string} value
 * @returns {string}
 */
const maskSecret = (value = '') => {
  const raw = String(value)
  if (raw.length <= 8) {
    return `${raw.slice(0, 2)}${'*'.repeat(Math.max(raw.length - 2, 4))}`
  }
  const start = raw.slice(0, 4)
  const end = raw.slice(-3)
  return `${start}${'*'.repeat(Math.min(24, raw.length - 7))}${end}`
}

/**
 * Find 1-based line number of a match index in content.
 * @param {string} content
 * @param {number} index
 * @returns {number|null}
 */
const lineNumberAt = (content, index) => {
  if (typeof index !== 'number' || index < 0) return null
  return content.slice(0, index).split(/\r?\n/).length
}

module.exports = {
  maskSecret,
  lineNumberAt
}

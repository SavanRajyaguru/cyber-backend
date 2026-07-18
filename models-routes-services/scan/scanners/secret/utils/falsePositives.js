const PLACEHOLDER_PATTERNS = [
  /example/i,
  /sample/i,
  /placeholder/i,
  /your[_-]?api[_-]?key/i,
  /your[_-]?token/i,
  /changeme/i,
  /dummy/i,
  /lorem/i,
  /test[_-]?key/i,
  /xxxx+/i,
  /\*{3,}/,
  /abc123/i,
  /12345/,
  /todo/i,
  /fixme/i,
  /insert[_-]?key/i,
  /<your/i,
  /\$\{/,
  /process\.env/i,
  /xxx/i,
  /aaaabbbb/i,
  /akiatest/i,
  /sk_test_51example/i,
  /pk_test_example/i
]

/**
 * @param {string} value
 * @returns {boolean} true if value looks like a placeholder / docs sample
 */
const isFalsePositive = (value = '') => {
  const v = String(value).trim()
  if (!v || v.length < 8) return true
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(v))) return true
  // Repeated single char / obviously fake
  if (/^(.)\1{10,}$/.test(v)) return true
  if (/^(abc|xyz|foo|bar|baz)/i.test(v) && v.length < 20) return true
  return false
}

module.exports = {
  isFalsePositive,
  PLACEHOLDER_PATTERNS
}

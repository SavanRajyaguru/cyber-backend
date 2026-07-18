/**
 * @param {string} href
 * @param {string} baseUrl
 * @returns {string|null}
 */
const resolveUrl = (href, baseUrl) => {
  if (!href || typeof href !== 'string') return null
  const trimmed = href.trim()
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return null
  }
  try {
    return new URL(trimmed, baseUrl).href
  } catch {
    return null
  }
}

/**
 * @param {string} url
 * @returns {string}
 */
const pathnameExt = (url) => {
  try {
    const path = new URL(url).pathname.toLowerCase()
    const i = path.lastIndexOf('.')
    return i >= 0 ? path.slice(i) : ''
  } catch {
    return ''
  }
}

module.exports = {
  resolveUrl,
  pathnameExt
}

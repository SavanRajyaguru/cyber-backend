/**
 * Resolve a possibly relative URL against a base.
 * @param {string} href
 * @param {string} baseUrl
 * @returns {string|null}
 */
const resolveUrl = (href, baseUrl) => {
  if (!href || typeof href !== 'string') return null
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') || trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:')) {
    return null
  }
  try {
    return new URL(trimmed, baseUrl).href
  } catch {
    return null
  }
}

/**
 * @param {string} urlA
 * @param {string} urlB
 * @returns {boolean}
 */
const sameHost = (urlA, urlB) => {
  try {
    return new URL(urlA).hostname === new URL(urlB).hostname
  } catch {
    return false
  }
}

/**
 * Origin root for robots.txt / sitemap.xml.
 * @param {string} pageUrl
 * @returns {string}
 */
const originRoot = (pageUrl) => {
  const u = new URL(pageUrl)
  return `${u.protocol}//${u.host}`
}

module.exports = {
  resolveUrl,
  sameHost,
  originRoot
}

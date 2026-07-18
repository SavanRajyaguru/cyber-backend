const config = require('../../../../config/config')
const { DEFAULT_MAX_RESOURCES } = require('./constants')

const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi
const INLINE_SCRIPT_RE = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi
const LINK_HREF_RE = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi
const ABS_URL_RE = /https?:\/\/[^\s"'<>]+/gi

const INTERESTING_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/site.webmanifest',
  '/config.js',
  '/env.js',
  '/settings.js',
  '/runtime.js',
  '/assets/config.js',
  '/static/config.js',
  '/js/config.js',
  '/js/env.js',
  '/js/settings.js',
  '/js/runtime.js'
]

const getMaxResources = () =>
  Number(config.SCAN_SECRET_MAX_RESOURCES) || DEFAULT_MAX_RESOURCES

const resolveUrl = (baseUrl, href) => {
  try {
    return new URL(href, baseUrl).toString()
  } catch (_) {
    return null
  }
}

const isLikelyTextResource = (url) => {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return (
      path.endsWith('.js') ||
      path.endsWith('.mjs') ||
      path.endsWith('.json') ||
      path.endsWith('.xml') ||
      path.endsWith('.txt') ||
      path.endsWith('.map') ||
      path.includes('manifest') ||
      /(?:^|\/)(config|env|settings|runtime)(?:\.|\/)/i.test(path)
    )
  } catch (_) {
    return false
  }
}

/**
 * Collect publicly linked resources from homepage HTML + well-known paths.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {{ homepage: Object, resources: Array<{url:string, kind:string}> }}
 */
const collectResources = (html = '', pageUrl) => {
  const max = getMaxResources()
  const seen = new Set()
  const resources = []

  const add = (url, kind) => {
    if (!url || seen.has(url)) return
    if (resources.length >= max - 1) return // leave room for homepage
    seen.add(url)
    resources.push({ url, kind })
  }

  // Homepage itself always first (analyzed separately as html)
  const origin = new URL(pageUrl).origin

  SCRIPT_SRC_RE.lastIndex = 0
  let match
  while ((match = SCRIPT_SRC_RE.exec(html)) !== null) {
    const absolute = resolveUrl(pageUrl, match[1].trim())
    if (absolute) add(absolute, 'script')
  }

  LINK_HREF_RE.lastIndex = 0
  while ((match = LINK_HREF_RE.exec(html)) !== null) {
    const href = match[1].trim()
    const absolute = resolveUrl(pageUrl, href)
    if (absolute && isLikelyTextResource(absolute)) add(absolute, 'link')
  }

  // Absolute URLs in HTML that look like config/json/js
  ABS_URL_RE.lastIndex = 0
  while ((match = ABS_URL_RE.exec(html)) !== null) {
    const absolute = match[0].replace(/[),.;]+$/, '')
    if (isLikelyTextResource(absolute)) add(absolute, 'embedded-url')
  }

  for (const path of INTERESTING_PATHS) {
    add(`${origin}${path}`, 'well-known')
  }

  // Inline scripts as virtual resources
  const inlines = []
  INLINE_SCRIPT_RE.lastIndex = 0
  let inlineIndex = 0
  while ((match = INLINE_SCRIPT_RE.exec(html)) !== null) {
    const body = (match[1] || '').trim()
    if (!body) continue
    inlineIndex += 1
    inlines.push({
      url: `inline:#${inlineIndex}`,
      kind: 'inline',
      body
    })
  }

  return {
    resources: resources.slice(0, Math.max(0, max - 1)),
    inlines: inlines.slice(0, 5),
    max
  }
}

module.exports = {
  collectResources,
  isLikelyTextResource
}

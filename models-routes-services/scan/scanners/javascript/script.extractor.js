const config = require('../../../../config/config')
const { DEFAULT_MAX_SCRIPTS } = require('./constants')

const SCRIPT_TAG_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const SRC_RE = /\bsrc\s*=\s*["']([^"']+)["']/i
const TYPE_RE = /\btype\s*=\s*["']([^"']+)["']/i

const getMaxScripts = () =>
  Number(config.SCAN_JS_MAX_SCRIPTS) || DEFAULT_MAX_SCRIPTS

/**
 * Resolve a possibly relative script URL against the page URL.
 * @param {string} baseUrl
 * @param {string} src
 * @returns {string|null}
 */
const resolveScriptUrl = (baseUrl, src) => {
  try {
    return new URL(src, baseUrl).toString()
  } catch (_) {
    return null
  }
}

const isExternal = (pageHost, scriptUrl) => {
  try {
    return new URL(scriptUrl).hostname !== pageHost
  } catch (_) {
    return true
  }
}

/**
 * Extract unique script resources from homepage HTML.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {{ external: Array, inline: Array }}
 */
const extractScripts = (html = '', pageUrl) => {
  const pageHost = new URL(pageUrl).hostname
  const seen = new Set()
  const external = []
  const inline = []
  const maxScripts = getMaxScripts()

  SCRIPT_TAG_RE.lastIndex = 0
  let match
  while ((match = SCRIPT_TAG_RE.exec(html)) !== null) {
    const attrs = match[1] || ''
    const body = (match[2] || '').trim()
    const typeMatch = TYPE_RE.exec(attrs)
    const type = typeMatch ? typeMatch[1].toLowerCase() : ''
    const isModule = type === 'module' || /\btype\s*=\s*["']module["']/i.test(attrs)
    const srcMatch = SRC_RE.exec(attrs)

    if (srcMatch) {
      const absolute = resolveScriptUrl(pageUrl, srcMatch[1].trim())
      if (!absolute || seen.has(absolute)) continue
      seen.add(absolute)

      if (external.length + inline.length >= maxScripts) break

      external.push({
        url: absolute,
        kind: isExternal(pageHost, absolute) ? 'external' : 'local',
        isModule,
        inlineContent: null
      })
    } else if (body) {
      const inlineId = `inline:#${inline.length + 1}`
      if (seen.has(inlineId)) continue
      seen.add(inlineId)

      if (external.length + inline.length >= maxScripts) break

      inline.push({
        url: inlineId,
        kind: 'inline',
        isModule,
        inlineContent: body
      })
    }
  }

  // Cap total analyzed scripts (prefer external first, then inline)
  const combined = [...external, ...inline].slice(0, maxScripts)
  return {
    scripts: combined,
    externalCount: combined.filter((s) => s.kind !== 'inline').length,
    inlineCount: combined.filter((s) => s.kind === 'inline').length
  }
}

module.exports = {
  extractScripts,
  resolveScriptUrl
}

const cheerio = require('cheerio')
const config = require('../../../../../config/config')
const {
  RESOURCE_TYPES,
  MAX_RESOURCES
} = require('../constants')
const { resolveUrl, pathnameExt } = require('../utils/url')
const { mapPool } = require('../utils/concurrency')
const { probeResource, getConcurrency } = require('../http.client')

/**
 * Classify a URL/content hint into a resource type.
 * @param {string} url
 * @param {string} [hint]
 */
const classifyResource = (url, hint = '') => {
  const ext = pathnameExt(url)
  const h = String(hint).toLowerCase()

  if (h === 'css' || ext === '.css') return RESOURCE_TYPES.CSS
  if (h === 'javascript' || h === 'js' || ['.js', '.mjs', '.cjs'].includes(ext)) {
    return RESOURCE_TYPES.JAVASCRIPT
  }
  if (h === 'font' || ['.woff2', '.woff', '.ttf', '.otf', '.eot'].includes(ext)) {
    return RESOURCE_TYPES.FONT
  }
  if (h === 'video' || ['.mp4', '.webm', '.ogg', '.mov'].includes(ext)) {
    return RESOURCE_TYPES.VIDEO
  }
  if (h === 'svg' || ext === '.svg') return RESOURCE_TYPES.SVG
  if (
    h === 'image' ||
    ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp'].includes(ext)
  ) {
    return RESOURCE_TYPES.IMAGE
  }
  return RESOURCE_TYPES.OTHER
}

/**
 * Extract unique homepage resources from HTML (no network).
 * @param {string} html
 * @param {string} baseUrl
 */
const extractResources = (html, baseUrl) => {
  let $
  try {
    $ = cheerio.load(html || '')
  } catch {
    $ = cheerio.load('<html></html>')
  }

  /** @type {{ url: string, type: string, meta?: Object }[]} */
  const list = []
  const seen = new Set()

  const push = (raw, hint, meta = {}) => {
    const url = resolveUrl(raw, baseUrl)
    if (!url || seen.has(url)) return
    seen.add(url)
    list.push({ url, type: classifyResource(url, hint), meta })
  }

  $('link[rel]').each((_, el) => {
    const rel = String($(el).attr('rel') || '').toLowerCase()
    const href = $(el).attr('href')
    const as = String($(el).attr('as') || '').toLowerCase()
    if (rel.includes('stylesheet')) push(href, 'css', { renderBlocking: true })
    else if (rel === 'preload' && as === 'style') push(href, 'css', { preload: true })
    else if (rel === 'preload' && as === 'script') push(href, 'js', { preload: true })
    else if (rel === 'preload' && as === 'font') push(href, 'font', { preload: true })
    else if (rel.includes('icon')) push(href, 'image')
  })

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src')
    const async = $(el).attr('async') != null
    const defer = $(el).attr('defer') != null
    const type = String($(el).attr('type') || '').toLowerCase()
    if (type && type !== 'text/javascript' && type !== 'application/javascript' && type !== 'module') {
      return
    }
    push(src, 'js', { renderBlocking: !async && !defer, async, defer })
  })

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src')
    push(src, 'image', {
      width: $(el).attr('width') || null,
      height: $(el).attr('height') || null,
      loading: String($(el).attr('loading') || '').toLowerCase(),
      srcset: Boolean($(el).attr('srcset'))
    })
  })

  $('source[src], source[srcset]').each((_, el) => {
    push($(el).attr('src'), 'image')
  })

  $('video[src], video source[src]').each((_, el) => {
    push($(el).attr('src'), 'video')
  })

  $('video').each((_, el) => {
    push($(el).attr('poster'), 'image')
  })

  // CSS url() fonts/images — skip deep parse; @font-face often external via link/google
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').each((_, el) => {
    push($(el).attr('href'), 'font', { googleFonts: true })
  })

  $('style').each((_, el) => {
    const css = $(el).html() || ''
    const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi
    let m
    while ((m = re.exec(css))) {
      const u = m[1]
      if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u)) push(u, 'font')
      else if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u)) push(u, 'image')
    }
  })

  const max = Number(config.SCAN_PERF_MAX_RESOURCES) || MAX_RESOURCES
  const capped = list.slice(0, max)
  const domElements = $('*').length

  return {
    resources: capped,
    totalDiscovered: list.length,
    capped: list.length > capped.length,
    domElements,
    $
  }
}

/**
 * Probe extracted resources concurrently (deduped, max 100).
 * @param {{ url: string, type: string, meta?: Object }[]} resources
 */
const probeResources = async (resources) => {
  const concurrency = getConcurrency()
  const probed = await mapPool(resources, concurrency, async (item) => {
    const result = await probeResource(item.url, item.type)
    return { ...result, meta: item.meta || {} }
  })
  return probed.filter(Boolean)
}

/**
 * Aggregate counts/sizes by type.
 * @param {Object[]} probed
 */
const summarizeByType = (probed = []) => {
  const empty = () => ({ count: 0, totalSize: 0, averageSize: 0, items: [] })
  const buckets = {
    css: empty(),
    javascript: empty(),
    image: empty(),
    font: empty(),
    video: empty(),
    svg: empty(),
    other: empty()
  }

  for (const r of probed) {
    const key = buckets[r.type] ? r.type : 'other'
    const b = buckets[key]
    b.count += 1
    if (typeof r.size === 'number' && r.size >= 0) {
      b.totalSize += r.size
      b.items.push({ url: r.url, size: r.size, ok: r.ok })
    } else {
      b.items.push({ url: r.url, size: null, ok: r.ok })
    }
  }

  for (const b of Object.values(buckets)) {
    const sized = b.items.filter((i) => typeof i.size === 'number')
    b.averageSize = sized.length
      ? Math.round(b.totalSize / sized.length)
      : 0
    // Keep payload lean
    b.items = b.items.slice(0, 15)
  }

  return buckets
}

module.exports = {
  classifyResource,
  extractResources,
  probeResources,
  summarizeByType
}

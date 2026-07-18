const { CATEGORIES } = require('./constants')
const { analyzeHeaders } = require('./header.analyzer')
const { analyzeHtml } = require('./html.analyzer')

/**
 * Merge detections: keep highest confidence per name+category; prefer version if present.
 * @param {import('./types').DetectedTechnology[]} items
 */
const mergeDetections = (items = []) => {
  /** @type {Map<string, import('./types').DetectedTechnology>} */
  const map = new Map()

  for (const item of items) {
    const key = `${item.category}::${item.name}`.toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...item })
      continue
    }
    if (item.confidence > existing.confidence) {
      map.set(key, {
        ...item,
        version: item.version || existing.version,
        evidence: item.evidence
      })
    } else if (!existing.version && item.version) {
      existing.version = item.version
    }
  }

  return [...map.values()].sort((a, b) => b.confidence - a.confidence)
}

const byCategory = (list, category) => list.filter((t) => t.category === category)

/**
 * Run full technology detection on one homepage response.
 * @param {{ headerText: string, html: string }} page
 */
const detectTechnologies = (page) => {
  const fromHeaders = analyzeHeaders(page.headerText || '')
  const fromHtml = analyzeHtml(page.html || '')
  const all = mergeDetections([...fromHeaders, ...fromHtml])

  const frontend = byCategory(all, CATEGORIES.FRONTEND)
  const backend = byCategory(all, CATEGORIES.BACKEND)
  const cms = byCategory(all, CATEGORIES.CMS)
  const server = byCategory(all, CATEGORIES.SERVER)
  const cdn = byCategory(all, CATEGORIES.CDN)
  const analytics = byCategory(all, CATEGORIES.ANALYTICS)
  const libraries = byCategory(all, CATEGORIES.LIBRARY)
  const hosting = byCategory(all, CATEGORIES.HOSTING)

  const findings = all.map((tech) => ({
    title: `${tech.name} Detected`,
    severity: 'info',
    status: 'info',
    description: `${tech.name} identified in category ${tech.category}` +
      (tech.version ? ` (version ${tech.version})` : '') +
      `. Evidence: ${tech.evidence}.`,
    recommendation: 'Informational only — no security action required from this module.'
  }))

  if (!server.length) {
    findings.push({
      title: 'Unknown Server',
      severity: 'info',
      status: 'info',
      description: 'No recognizable web server fingerprint was found in response headers.',
      recommendation: 'Informational only.'
    })
  }

  const summary = {
    total: all.length,
    frontend: frontend.length,
    backend: backend.length,
    cms: cms.length,
    server: server.length,
    cdn: cdn.length,
    analytics: analytics.length,
    libraries: libraries.length,
    hosting: hosting.length
  }

  return {
    summary,
    frontend,
    backend,
    cms,
    server,
    cdn,
    analytics,
    libraries,
    hosting,
    findings,
    all
  }
}

module.exports = {
  detectTechnologies,
  mergeDetections
}

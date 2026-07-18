const { PATTERNS, MIN_CONFIDENCE } = require('./patterns')

const HTML_PATTERNS = PATTERNS.filter((p) => p.source === 'html')
const SCRIPT_PATTERNS = PATTERNS.filter((p) => p.source === 'script')
const META_PATTERNS = PATTERNS.filter((p) => p.source === 'meta')
const LINK_PATTERNS = PATTERNS.filter((p) => p.source === 'link')

const SCRIPT_SRC_RE = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi
const LINK_HREF_RE = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi
const META_GENERATOR_RE = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["'][^>]*>/gi
const META_GENERATOR_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["'][^>]*>/gi

const extractMatches = (html, regex) => {
  const values = []
  regex.lastIndex = 0
  let match
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) values.push(match[1])
  }
  return values
}

/**
 * Extract script URLs, link hrefs, and generator meta from HTML.
 */
const extractHtmlFeatures = (html = '') => {
  const scripts = extractMatches(html, SCRIPT_SRC_RE)
  const links = extractMatches(html, LINK_HREF_RE)
  const generators = [
    ...extractMatches(html, META_GENERATOR_RE),
    ...extractMatches(html, META_GENERATOR_RE_ALT)
  ]
  return { scripts, links, generators, html }
}

const applyPatterns = (text, rules) => {
  const detected = []
  if (!text) return detected

  for (const rule of rules) {
    const match = rule.pattern.exec(text)
    if (!match) continue
    if (rule.confidence < MIN_CONFIDENCE) continue

    let version = null
    if (rule.versionGroup && match[rule.versionGroup]) {
      version = String(match[rule.versionGroup])
    }

    detected.push({
      name: rule.name,
      category: rule.category,
      version,
      confidence: rule.confidence,
      evidence: rule.evidence
    })
  }
  return detected
}

/**
 * Analyze HTML body, scripts, meta, and link tags.
 * @param {string} html
 * @returns {import('./types').DetectedTechnology[]}
 */
const analyzeHtml = (html = '') => {
  const features = extractHtmlFeatures(html)
  const detected = []

  detected.push(...applyPatterns(features.html, HTML_PATTERNS))

  const scriptsBlob = features.scripts.join('\n')
  detected.push(...applyPatterns(scriptsBlob, SCRIPT_PATTERNS))
  // Also scan inline script tags content lightly (same html)
  detected.push(...applyPatterns(features.html, SCRIPT_PATTERNS))

  const metaBlob = features.generators.join('\n')
  detected.push(...applyPatterns(metaBlob, META_PATTERNS))

  const linksBlob = features.links.join('\n')
  detected.push(...applyPatterns(linksBlob, LINK_PATTERNS))

  return detected
}

module.exports = {
  analyzeHtml,
  extractHtmlFeatures
}

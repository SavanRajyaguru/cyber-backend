const cheerio = require('cheerio')
const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES } = require('./constants')
const { fetchHomepage, mapHttpError } = require('./http.client')
const {
  analyzeTitle,
  analyzeMeta,
  analyzeHeadings,
  analyzeImages,
  analyzeLinks,
  analyzeStructuredData,
  analyzeSocial,
  analyzeContent,
  analyzeRobots,
  analyzeFavicon
} = require('./analyzers')
const {
  calculateSeoScore,
  buildSummary,
  buildRecommendations
} = require('./scoring.service')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[seo-scanner] ${message}${suffix}`)
}

/**
 * Safely load HTML with Cheerio — never throws.
 * @param {string} html
 */
const loadDom = (html) => {
  try {
    return cheerio.load(html || '', {
      xml: false
    })
  } catch (error) {
    log('Invalid HTML — using empty DOM', { message: error?.message })
    return cheerio.load('<html><head></head><body></body></html>')
  }
}

/**
 * Homepage-only passive SEO / on-page scan.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').SeoScanResult>}
 */
const runSeoScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  log('Request Started', { url: validated.sUrl })

  let page
  try {
    page = await fetchHomepage(validated.sUrl)
    log('Response Received', {
      statusCode: page.statusCode,
      finalUrl: page.finalUrl,
      htmlBytes: Buffer.byteLength(page.html || '', 'utf8'),
      truncated: page.truncated,
      responseTime: page.responseTime
    })
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : mapped.code
    err.errorCode = mapped.code
    throw err
  }

  const $ = loadDom(page.html)
  const findings = []

  if (page.statusCode === 404) {
    findings.push({
      title: 'Homepage returned 404',
      severity: 'High',
      status: 'Fail',
      description: 'The homepage URL responded with HTTP 404.',
      recommendation: 'Ensure the scanned URL resolves to a valid homepage.'
    })
  } else if (page.statusCode >= 400) {
    findings.push({
      title: `Homepage HTTP ${page.statusCode}`,
      severity: 'High',
      status: 'Warn',
      description: `Homepage responded with status ${page.statusCode}; analysis continued on returned HTML.`,
      recommendation: 'Verify the URL is publicly reachable and returns 200.'
    })
  }

  if (page.truncated) {
    findings.push({
      title: 'Large HTML truncated',
      severity: 'Low',
      status: 'Warn',
      description: 'Homepage HTML exceeded the size limit and was truncated before analysis.',
      recommendation: 'Reduce homepage HTML size for more complete on-page analysis.'
    })
  }

  // Synchronous analyzers on shared DOM
  const titleResult = analyzeTitle($)
  const metaResult = analyzeMeta($)
  const headingResult = analyzeHeadings($)
  const structuredResult = analyzeStructuredData($)
  const socialResult = analyzeSocial($)
  const contentResult = analyzeContent($, page.html, titleResult.title.value)

  findings.push(
    ...titleResult.findings,
    ...metaResult.findings,
    ...headingResult.findings,
    ...structuredResult.findings,
    ...socialResult.findings,
    ...contentResult.findings
  )

  // Concurrent network-backed checks (images, links, robots, favicon)
  const [imageResult, linkResult, robotsResult, faviconResult] = await Promise.all([
    analyzeImages($, page.finalUrl).catch((e) => {
      log('Image analysis soft-failed', { message: e?.message })
      return { images: { total: 0, missingAlt: 0, emptyAlt: 0, lazyLoaded: 0, brokenCount: 0, broken: [], checked: 0 }, findings: [], scoreRatio: 0.5 }
    }),
    analyzeLinks($, page.finalUrl).catch((e) => {
      log('Link analysis soft-failed', { message: e?.message })
      return { links: { total: 0, internal: 0, external: 0, nofollow: 0, noopener: 0, noreferrer: 0, targetBlank: 0, unsafeTargetBlank: 0, brokenCount: 0, broken: [], checked: 0 }, findings: [], scoreRatio: 0.5 }
    }),
    analyzeRobots({
      finalUrl: page.finalUrl,
      canonical: metaResult.meta.canonical,
      robotsMeta: metaResult.meta.robots
    }).catch((e) => {
      log('Robots analysis soft-failed', { message: e?.message })
      return {
        robots: {
          robotsTxt: { available: false, url: null, statusCode: null },
          sitemap: { available: false, url: null },
          canonicalPresent: Boolean(metaResult.meta.canonical.present),
          noindex: Boolean(metaResult.meta.robots.noindex),
          nofollow: Boolean(metaResult.meta.robots.nofollow)
        },
        findings: [],
        scoreRatio: 0.3
      }
    }),
    analyzeFavicon($, page.finalUrl).catch((e) => {
      log('Favicon analysis soft-failed', { message: e?.message })
      return { favicon: { exists: false, accessible: false, url: null, statusCode: null }, findings: [] }
    })
  ])

  findings.push(
    ...imageResult.findings,
    ...linkResult.findings,
    ...robotsResult.findings,
    ...faviconResult.findings
  )

  const { score, grade, risk, breakdown } = calculateSeoScore({
    title: titleResult.scoreRatio,
    description: metaResult.descriptionScoreRatio,
    headings: headingResult.scoreRatio,
    images: imageResult.scoreRatio,
    structuredData: structuredResult.scoreRatio,
    social: socialResult.scoreRatio,
    canonical: metaResult.canonicalScoreRatio,
    robots: robotsResult.scoreRatio,
    links: linkResult.scoreRatio
  })

  const recommendations = buildRecommendations(findings)
  const summary = buildSummary(findings, {
    statusCode: page.statusCode,
    wordCount: contentResult.content.wordCount,
    scoreBreakdown: breakdown
  })

  log('Analysis Completed', {
    findings: findings.length,
    score,
    grade,
    risk
  })

  const result = {
    module: 'seo',
    sModule: 'seo',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    summary,
    title: titleResult.title,
    meta: metaResult.meta,
    headings: headingResult.headings,
    images: imageResult.images,
    links: linkResult.links,
    structuredData: structuredResult.structuredData,
    social: socialResult.social,
    robots: robotsResult.robots,
    content: contentResult.content,
    favicon: faviconResult.favicon,
    findings,
    recommendations,
    oMeta: {
      bStub: false,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      responseTime: page.responseTime,
      truncated: page.truncated,
      htmlBytes: Buffer.byteLength(page.html || '', 'utf8')
    }
  }

  log('Worker Finished', { score, findings: findings.length })
  return result
}

module.exports = {
  runSeoScan
}

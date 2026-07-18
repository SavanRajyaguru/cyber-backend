const { DEFAULT_IMAGE_CHECK_LIMIT } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { resolveUrl } = require('../utils/url')
const { mapPool } = require('../utils/concurrency')
const { checkUrl, getConcurrency } = require('../http.client')
const config = require('../../../../../config/config')

/**
 * Analyze images: alt, lazy-loading, broken refs (homepage only).
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} baseUrl
 */
const analyzeImages = async ($, baseUrl) => {
  const findings = []
  const images = []

  $('img').each((_, el) => {
    const src = ($(el).attr('src') || $(el).attr('data-src') || '').trim()
    const altAttr = $(el).attr('alt')
    const altMissing = altAttr === undefined
    const altEmpty = altAttr !== undefined && String(altAttr).trim() === ''
    const loading = ($(el).attr('loading') || '').toLowerCase()
    const resolved = resolveUrl(src, baseUrl)
    images.push({
      src: src || null,
      resolvedUrl: resolved,
      altMissing,
      altEmpty,
      lazy: loading === 'lazy'
    })
  })

  const total = images.length
  const missingAlt = images.filter((i) => i.altMissing).length
  const emptyAlt = images.filter((i) => i.altEmpty).length
  const withLazy = images.filter((i) => i.lazy).length

  if (total === 0) {
    findings.push(makeFinding({
      title: 'No images on homepage',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'No <img> elements found.',
      recommendation: 'No action required unless images are expected.'
    }))
  } else {
    if (missingAlt > 0) {
      findings.push(makeFinding({
        title: 'Images missing ALT attribute',
        severity: SEVERITY.MEDIUM,
        status: FINDING_STATUS.FAIL,
        description: `${missingAlt} of ${total} images lack an alt attribute.`,
        recommendation: 'Add descriptive alt text to every meaningful image.'
      }))
    }
    if (emptyAlt > 0) {
      findings.push(makeFinding({
        title: 'Images with empty ALT',
        severity: SEVERITY.LOW,
        status: FINDING_STATUS.WARN,
        description: `${emptyAlt} images use empty alt="" (decorative or incomplete).`,
        recommendation: 'Use empty alt only for decorative images; otherwise describe them.'
      }))
    }
    if (missingAlt === 0 && emptyAlt === 0) {
      findings.push(makeFinding({
        title: 'All images have ALT text',
        severity: SEVERITY.INFO,
        status: FINDING_STATUS.PASS,
        description: `${total} images checked.`,
        recommendation: 'No action required.'
      }))
    }
    if (withLazy === 0 && total > 3) {
      findings.push(makeFinding({
        title: 'No lazy-loading attributes',
        severity: SEVERITY.INFO,
        status: FINDING_STATUS.INFO,
        description: 'None of the images use loading="lazy".',
        recommendation: 'Consider loading="lazy" for below-the-fold images.'
      }))
    }
  }

  const limit = Number(config.SCAN_SEO_IMAGE_CHECK_LIMIT) || DEFAULT_IMAGE_CHECK_LIMIT
  const toCheck = images
    .map((i) => i.resolvedUrl)
    .filter(Boolean)
    .filter((u, idx, arr) => arr.indexOf(u) === idx)
    .slice(0, limit)

  const checks = await mapPool(toCheck, getConcurrency(), (url) => checkUrl(url))
  const broken = (checks || []).filter((c) => c && !c.ok)

  if (broken.length) {
    findings.push(makeFinding({
      title: 'Broken image references',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.FAIL,
      description: `${broken.length} image URL(s) returned errors (checked ${toCheck.length}).`,
      recommendation: 'Fix or remove broken image sources on the homepage.'
    }))
  } else if (toCheck.length) {
    findings.push(makeFinding({
      title: 'Image references accessible',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Checked ${toCheck.length} unique image URL(s).`,
      recommendation: 'No action required.'
    }))
  }

  const altCoverage = total === 0 ? 1 : (total - missingAlt) / total
  let scoreRatio = altCoverage * 0.7
  if (broken.length === 0) scoreRatio += 0.3
  else scoreRatio += Math.max(0, 0.3 * (1 - broken.length / Math.max(toCheck.length, 1)))

  return {
    images: {
      total,
      missingAlt,
      emptyAlt,
      lazyLoaded: withLazy,
      brokenCount: broken.length,
      broken: broken.slice(0, 10).map((b) => ({
        url: b.url,
        statusCode: b.statusCode,
        error: b.error
      })),
      checked: toCheck.length
    },
    findings,
    scoreRatio: Math.min(1, scoreRatio)
  }
}

module.exports = {
  analyzeImages
}

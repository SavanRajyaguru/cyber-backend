const { LARGE_IMAGE_BYTES, MODERN_IMAGE_EXTS } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { pathnameExt } = require('../utils/url')

/**
 * Analyze homepage images for size, dimensions, lazy-load, modern formats.
 * @param {Object[]} probed
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeImages = (probed = [], $) => {
  const findings = []
  const images = probed.filter((r) => r.type === 'image' || r.type === 'svg')

  const sizes = images.map((i) => i.size).filter((n) => typeof n === 'number')
  const totalSize = sizes.reduce((a, b) => a + b, 0)
  const averageSize = sizes.length ? Math.round(totalSize / sizes.length) : 0
  const largeImages = images.filter(
    (i) => typeof i.size === 'number' && i.size >= LARGE_IMAGE_BYTES
  )

  let missingWidth = 0
  let missingHeight = 0
  let lazyCount = 0
  let imgCount = 0
  let modernCount = 0

  if ($) {
    $('img').each((_, el) => {
      imgCount += 1
      if (!$(el).attr('width')) missingWidth += 1
      if (!$(el).attr('height')) missingHeight += 1
      if (String($(el).attr('loading') || '').toLowerCase() === 'lazy') lazyCount += 1
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      const ext = pathnameExt(src)
      if (MODERN_IMAGE_EXTS.includes(ext)) modernCount += 1
    })
  }

  for (const img of images) {
    const ext = pathnameExt(img.url)
    if (MODERN_IMAGE_EXTS.includes(ext) || /image\/(webp|avif|svg)/i.test(img.contentType || '')) {
      modernCount += 1
    }
  }
  // modernCount may double-count; prefer markup count when available
  if (imgCount > 0) {
    modernCount = 0
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (MODERN_IMAGE_EXTS.includes(pathnameExt(src))) modernCount += 1
    })
  }

  if (largeImages.length) {
    findings.push(makeFinding({
      title: 'Large images detected',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${largeImages.length} image(s) ≥ ${Math.round(LARGE_IMAGE_BYTES / 1024)} KB.`,
      recommendation: 'Compress images and serve modern formats (WebP/AVIF) at appropriate dimensions.'
    }))
  }

  if (imgCount > 0 && missingWidth + missingHeight > 0) {
    findings.push(makeFinding({
      title: 'Images missing width/height',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `${missingWidth} missing width, ${missingHeight} missing height.`,
      recommendation: 'Set width and height to reduce layout shift (CLS).'
    }))
  }

  if (imgCount > 3 && lazyCount === 0) {
    findings.push(makeFinding({
      title: 'Missing lazy loading on images',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${imgCount} images found; none use loading="lazy".`,
      recommendation: 'Add loading="lazy" to below-the-fold images.'
    }))
  } else if (lazyCount > 0) {
    findings.push(makeFinding({
      title: 'Lazy loading used',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `${lazyCount} image(s) use loading="lazy".`,
      recommendation: 'No action required.'
    }))
  }

  if (imgCount > 0 && modernCount / imgCount < 0.3) {
    findings.push(makeFinding({
      title: 'Few modern image formats',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: `${modernCount}/${imgCount} images use WebP/AVIF/SVG sources.`,
      recommendation: 'Prefer WebP or AVIF with fallbacks for photographic content.'
    }))
  }

  if (imgCount === 0 && images.length === 0) {
    findings.push(makeFinding({
      title: 'No images on homepage',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'No image resources were detected.',
      recommendation: 'No action required.'
    }))
  }

  let scoreRatio = 1
  if (largeImages.length) scoreRatio -= Math.min(0.45, largeImages.length * 0.15)
  if (imgCount > 3 && lazyCount === 0) scoreRatio -= 0.2
  if (imgCount > 0 && (missingWidth > 0 || missingHeight > 0)) scoreRatio -= 0.15
  if (imgCount > 0 && modernCount / imgCount < 0.3) scoreRatio -= 0.1

  return {
    images: {
      count: Math.max(imgCount, images.length),
      probed: images.length,
      totalSize,
      averageSize,
      largeCount: largeImages.length,
      large: largeImages.slice(0, 10).map((i) => ({ url: i.url, size: i.size })),
      missingWidth,
      missingHeight,
      lazyLoaded: lazyCount,
      modernFormats: modernCount
    },
    findings,
    scoreRatio: Math.max(0, Math.min(1, scoreRatio))
  }
}

module.exports = {
  analyzeImages
}

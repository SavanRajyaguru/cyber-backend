const { LARGE_FONT_BYTES } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze font loading strategy and sizes.
 * @param {Object[]} probed
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeFonts = (probed = [], $) => {
  const findings = []
  const fonts = probed.filter((r) => r.type === 'font' || r.meta?.googleFonts)

  let googleFonts = false
  let googleStylesheet = 0
  if ($) {
    $('link[href]').each((_, el) => {
      const href = String($(el).attr('href') || '')
      if (/fonts\.googleapis\.com/i.test(href)) {
        googleFonts = true
        googleStylesheet += 1
      }
      if (/fonts\.gstatic\.com/i.test(href)) googleFonts = true
    })
  }

  for (const f of fonts) {
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(f.url)) googleFonts = true
  }

  const selfHosted = fonts.filter(
    (f) => !/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(f.url)
  )
  const sizes = fonts.map((f) => f.size).filter((n) => typeof n === 'number')
  const totalSize = sizes.reduce((a, b) => a + b, 0)
  const largeFonts = fonts.filter(
    (f) => typeof f.size === 'number' && f.size >= LARGE_FONT_BYTES
  )

  if (googleFonts) {
    findings.push(makeFinding({
      title: 'Google Fonts detected',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: `${googleStylesheet || 'External'} Google Fonts stylesheet/resource reference(s).`,
      recommendation: 'Self-host fonts or subset to reduce third-party latency.'
    }))
  }

  if (selfHosted.length) {
    findings.push(makeFinding({
      title: 'Self-hosted fonts',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `${selfHosted.length} self-hosted font resource(s) detected.`,
      recommendation: 'No action required.'
    }))
  }

  if (fonts.length > 4) {
    findings.push(makeFinding({
      title: 'High font count',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${fonts.length} font resources on the homepage.`,
      recommendation: 'Limit font families/weights and use font-display: swap.'
    }))
  }

  if (largeFonts.length) {
    findings.push(makeFinding({
      title: 'Large font files',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${largeFonts.length} font file(s) ≥ ${Math.round(LARGE_FONT_BYTES / 1024)} KB.`,
      recommendation: 'Subset fonts and prefer WOFF2.'
    }))
  }

  if (!fonts.length && !googleFonts) {
    findings.push(makeFinding({
      title: 'No external fonts detected',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'No font files or Google Fonts links found on the homepage.',
      recommendation: 'No action required.'
    }))
  }

  return {
    fonts: {
      count: Math.max(fonts.length, googleFonts ? googleStylesheet : 0),
      googleFonts,
      selfHosted: selfHosted.length,
      totalSize,
      largeCount: largeFonts.length,
      large: largeFonts.slice(0, 8).map((f) => ({ url: f.url, size: f.size }))
    },
    findings
  }
}

module.exports = {
  analyzeFonts
}

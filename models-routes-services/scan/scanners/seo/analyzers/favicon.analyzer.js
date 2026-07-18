const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { resolveUrl, originRoot } = require('../utils/url')
const { checkUrl } = require('../http.client')

/**
 * Favicon presence + accessibility check.
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} baseUrl
 */
const analyzeFavicon = async ($, baseUrl) => {
  const findings = []
  const candidates = []

  $('link[rel]').each((_, el) => {
    const rel = String($(el).attr('rel') || '').toLowerCase()
    if (!rel.includes('icon')) return
    const href = String($(el).attr('href') || '').trim()
    const resolved = resolveUrl(href, baseUrl)
    if (resolved) candidates.push(resolved)
  })

  const fallback = `${originRoot(baseUrl)}/favicon.ico`
  if (!candidates.includes(fallback)) candidates.push(fallback)

  let accessible = false
  let usedUrl = null
  let statusCode = null

  for (const url of candidates.slice(0, 5)) {
    const check = await checkUrl(url)
    if (check.ok) {
      accessible = true
      usedUrl = url
      statusCode = check.statusCode
      break
    }
    usedUrl = usedUrl || url
    statusCode = check.statusCode
  }

  const existsInMarkup = $('link[rel]').filter((_, el) =>
    String($(el).attr('rel') || '').toLowerCase().includes('icon')
  ).length > 0

  if (!accessible) {
    findings.push(makeFinding({
      title: 'Favicon not accessible',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: 'Could not fetch a favicon for the homepage origin.',
      recommendation: 'Add a favicon link and ensure /favicon.ico is reachable.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Favicon accessible',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Favicon: ${usedUrl}`,
      recommendation: 'No action required.'
    }))
  }

  return {
    favicon: {
      exists: existsInMarkup || accessible,
      accessible,
      url: usedUrl,
      statusCode
    },
    findings
  }
}

module.exports = {
  analyzeFavicon
}

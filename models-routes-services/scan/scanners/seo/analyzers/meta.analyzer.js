const { DESC_MIN, DESC_MAX } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} name
 */
const metaByName = ($, name) => {
  const target = name.toLowerCase()
  let value = ''
  $('meta[name]').each((_, el) => {
    const n = String($(el).attr('name') || '').toLowerCase()
    if (n === target && !value) value = String($(el).attr('content') || '').trim()
  })
  return value
}

/**
 * @param {import('cheerio').CheerioAPI} $
 */
const getCharset = ($) => {
  const direct = $('meta[charset]').attr('charset')
  if (direct) return String(direct).trim()
  let fromHttpEquiv = ''
  $('meta[http-equiv]').each((_, el) => {
    const httpEquiv = String($(el).attr('http-equiv') || '').toLowerCase()
    if (httpEquiv !== 'content-type') return
    const content = String($(el).attr('content') || '')
    const match = content.match(/charset=([^\s;]+)/i)
    if (match?.[1] && !fromHttpEquiv) fromHttpEquiv = match[1].trim()
  })
  return fromHttpEquiv
}

/**
 * Analyze core meta tags (description, keywords, canonical, robots, viewport, charset, lang).
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeMeta = ($) => {
  const findings = []

  const description = metaByName($, 'description')
  const keywords = metaByName($, 'keywords')
  const robotsMeta = metaByName($, 'robots')
  const viewport = metaByName($, 'viewport')
  const charset = getCharset($)
  const language = ($('html').attr('lang') || '').trim()

  let canonical = ''
  $('link[rel]').each((_, el) => {
    const rel = String($(el).attr('rel') || '').toLowerCase()
    if (rel === 'canonical' && !canonical) {
      canonical = String($(el).attr('href') || '').trim()
    }
  })

  const descriptionExists = Boolean(description)
  const descriptionLength = description.length
  let descriptionLengthOk = false

  if (!descriptionExists) {
    findings.push(makeFinding({
      title: 'Missing meta description',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'No meta description was found on the homepage.',
      recommendation: `Add a meta description between ${DESC_MIN}–${DESC_MAX} characters.`
    }))
  } else if (descriptionLength < DESC_MIN) {
    findings.push(makeFinding({
      title: 'Meta description too short',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Description is ${descriptionLength} characters.`,
      recommendation: `Aim for ${DESC_MIN}–${DESC_MAX} characters.`
    }))
  } else if (descriptionLength > DESC_MAX) {
    findings.push(makeFinding({
      title: 'Meta description too long',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Description is ${descriptionLength} characters.`,
      recommendation: `Keep the description under ${DESC_MAX} characters.`
    }))
  } else {
    descriptionLengthOk = true
    findings.push(makeFinding({
      title: 'Meta description length optimal',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Description is ${descriptionLength} characters.`,
      recommendation: 'No action required.'
    }))
  }

  const keywordsPresent = Boolean(keywords)
  if (keywordsPresent) {
    findings.push(makeFinding({
      title: 'Meta keywords present (deprecated)',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: 'Meta keywords are ignored by major search engines.',
      recommendation: 'Remove the meta keywords tag; focus on content and other meta tags.'
    }))
  }

  const canonicalPresent = Boolean(canonical)
  if (!canonicalPresent) {
    findings.push(makeFinding({
      title: 'Missing canonical URL',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.FAIL,
      description: 'No rel="canonical" link was found.',
      recommendation: 'Add a canonical link pointing to the preferred homepage URL.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Canonical URL present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Canonical: ${canonical}`,
      recommendation: 'No action required.'
    }))
  }

  const robotsLower = robotsMeta.toLowerCase()
  const noindex = /\bnoindex\b/.test(robotsLower)
  const nofollow = /\bnofollow\b/.test(robotsLower)

  if (robotsMeta) {
    findings.push(makeFinding({
      title: 'Robots meta present',
      severity: noindex ? SEVERITY.HIGH : SEVERITY.INFO,
      status: noindex ? FINDING_STATUS.FAIL : FINDING_STATUS.PASS,
      description: `robots meta: ${robotsMeta}`,
      recommendation: noindex
        ? 'Remove noindex if this page should appear in search results.'
        : 'No action required.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'No robots meta tag',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: 'Page relies on default index,follow behavior.',
      recommendation: 'Optional: add an explicit robots meta for clarity.'
    }))
  }

  if (!viewport) {
    findings.push(makeFinding({
      title: 'Missing viewport meta',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No viewport meta tag for mobile rendering.',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">'
    }))
  }

  if (!charset) {
    findings.push(makeFinding({
      title: 'Missing charset declaration',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: 'No charset meta was detected.',
      recommendation: 'Add <meta charset="utf-8"> early in <head>.'
    }))
  }

  if (!language) {
    findings.push(makeFinding({
      title: 'Missing html lang attribute',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: 'The <html> element has no lang attribute.',
      recommendation: 'Set lang (e.g. lang="en") for accessibility and SEO.'
    }))
  }

  const descriptionScoreRatio = !descriptionExists
    ? 0
    : descriptionLengthOk
      ? 1
      : 0.45

  const canonicalScoreRatio = canonicalPresent ? 1 : 0

  return {
    meta: {
      description: {
        exists: descriptionExists,
        value: description || null,
        length: descriptionLength,
        lengthOk: descriptionLengthOk
      },
      keywords: {
        present: keywordsPresent,
        value: keywords || null,
        deprecated: true
      },
      canonical: {
        present: canonicalPresent,
        value: canonical || null
      },
      robots: {
        present: Boolean(robotsMeta),
        value: robotsMeta || null,
        noindex,
        nofollow
      },
      viewport: {
        present: Boolean(viewport),
        value: viewport || null
      },
      charset: {
        present: Boolean(charset),
        value: charset || null
      },
      language: {
        present: Boolean(language),
        value: language || null
      }
    },
    findings,
    descriptionScoreRatio,
    canonicalScoreRatio
  }
}

module.exports = {
  analyzeMeta
}

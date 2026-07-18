const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

const metaContent = ($, { name, property }) => {
  let value = ''
  if (property) {
    $(`meta[property]`).each((_, el) => {
      const p = String($(el).attr('property') || '').toLowerCase()
      if (p === property.toLowerCase() && !value) {
        value = String($(el).attr('content') || '').trim()
      }
    })
  }
  if (name) {
    $(`meta[name]`).each((_, el) => {
      const n = String($(el).attr('name') || '').toLowerCase()
      if (n === name.toLowerCase() && !value) {
        value = String($(el).attr('content') || '').trim()
      }
    })
  }
  return value
}

/**
 * Analyze Open Graph and Twitter Card tags.
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeSocial = ($) => {
  const findings = []

  const og = {
    title: metaContent($, { property: 'og:title' }),
    description: metaContent($, { property: 'og:description' }),
    image: metaContent($, { property: 'og:image' }),
    url: metaContent($, { property: 'og:url' })
  }

  const twitter = {
    title: metaContent($, { name: 'twitter:title' }),
    description: metaContent($, { name: 'twitter:description' }),
    image: metaContent($, { name: 'twitter:image' }),
    card: metaContent($, { name: 'twitter:card' })
  }

  const ogRequired = ['title', 'description', 'image', 'url']
  const ogMissing = ogRequired.filter((k) => !og[k])
  const twitterRequired = ['card', 'title', 'description', 'image']
  const twitterMissing = twitterRequired.filter((k) => !twitter[k])

  if (ogMissing.length === ogRequired.length) {
    findings.push(makeFinding({
      title: 'Missing Open Graph tags',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.FAIL,
      description: 'No core og:* tags were found.',
      recommendation: 'Add og:title, og:description, og:image, and og:url.'
    }))
  } else if (ogMissing.length) {
    findings.push(makeFinding({
      title: 'Incomplete Open Graph tags',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `Missing: ${ogMissing.map((k) => `og:${k}`).join(', ')}.`,
      recommendation: 'Complete Open Graph tags for better link previews.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Open Graph tags complete',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'og:title, og:description, og:image, and og:url are present.',
      recommendation: 'No action required.'
    }))
  }

  if (twitterMissing.length === twitterRequired.length) {
    findings.push(makeFinding({
      title: 'Missing Twitter Card tags',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: 'No twitter:* card tags were found.',
      recommendation: 'Add twitter:card and related title/description/image tags.'
    }))
  } else if (twitterMissing.length) {
    findings.push(makeFinding({
      title: 'Incomplete Twitter Card tags',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `Missing: ${twitterMissing.map((k) => `twitter:${k}`).join(', ')}.`,
      recommendation: 'Complete Twitter Card meta tags.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Twitter Card tags complete',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Core twitter:* tags are present.',
      recommendation: 'No action required.'
    }))
  }

  const ogScore = (ogRequired.length - ogMissing.length) / ogRequired.length
  const twScore = (twitterRequired.length - twitterMissing.length) / twitterRequired.length
  const scoreRatio = ogScore * 0.65 + twScore * 0.35

  return {
    social: { openGraph: og, twitter },
    findings,
    scoreRatio
  }
}

module.exports = {
  analyzeSocial
}

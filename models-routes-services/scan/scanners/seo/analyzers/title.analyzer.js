const { TITLE_MIN, TITLE_MAX } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze document title.
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeTitle = ($) => {
  const findings = []
  const raw = ($('head > title').first().text() || $('title').first().text() || '').replace(/\s+/g, ' ').trim()
  const exists = Boolean(raw)
  const length = raw.length
  const words = raw ? raw.toLowerCase().split(/\s+/).filter(Boolean) : []
  const wordCounts = {}
  for (const w of words) wordCounts[w] = (wordCounts[w] || 0) + 1
  const duplicateWords = Object.entries(wordCounts)
    .filter(([, count]) => count > 1)
    .map(([word]) => word)

  let lengthOk = false
  if (!exists) {
    findings.push(makeFinding({
      title: 'Missing page title',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'The homepage has no <title> element.',
      recommendation: 'Add a unique, descriptive title between 30–60 characters.'
    }))
  } else if (length < TITLE_MIN) {
    findings.push(makeFinding({
      title: 'Title too short',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Title is ${length} characters (recommended ${TITLE_MIN}–${TITLE_MAX}).`,
      recommendation: 'Expand the title with relevant keywords while staying under 60 characters.'
    }))
  } else if (length > TITLE_MAX) {
    findings.push(makeFinding({
      title: 'Title too long',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Title is ${length} characters (recommended ${TITLE_MIN}–${TITLE_MAX}).`,
      recommendation: 'Shorten the title so it is not truncated in SERPs.'
    }))
  } else {
    lengthOk = true
    findings.push(makeFinding({
      title: 'Title length optimal',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Title is ${length} characters.`,
      recommendation: 'No action required.'
    }))
  }

  if (duplicateWords.length) {
    findings.push(makeFinding({
      title: 'Duplicate words in title',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `Repeated words: ${duplicateWords.join(', ')}.`,
      recommendation: 'Remove redundant words from the title for clarity.'
    }))
  }

  const scoreRatio = (() => {
    if (!exists) return 0
    let r = 0.5
    if (lengthOk) r += 0.4
    else if (length > 0) r += 0.15
    if (!duplicateWords.length) r += 0.1
    return Math.min(1, r)
  })()

  return {
    title: {
      exists,
      value: raw || null,
      length,
      lengthOk,
      duplicateWords
    },
    findings,
    scoreRatio
  }
}

module.exports = {
  analyzeTitle
}

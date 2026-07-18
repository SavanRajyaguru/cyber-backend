const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze H1–H3 structure and hierarchy.
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeHeadings = ($) => {
  const findings = []
  const collect = (tag) =>
    $(tag)
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)

  const h1 = collect('h1')
  const h2 = collect('h2')
  const h3 = collect('h3')

  const missingH1 = h1.length === 0
  const multipleH1 = h1.length > 1

  if (missingH1) {
    findings.push(makeFinding({
      title: 'Missing H1',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'The homepage has no H1 heading.',
      recommendation: 'Add a single clear H1 that describes the page topic.'
    }))
  } else if (multipleH1) {
    findings.push(makeFinding({
      title: 'Multiple H1 headings',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Found ${h1.length} H1 elements.`,
      recommendation: 'Use exactly one H1 per page.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Single H1 present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `H1: ${h1[0].slice(0, 120)}`,
      recommendation: 'No action required.'
    }))
  }

  // Hierarchy: walk all h1–h6 in document order
  const levels = []
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el.tagName || el.name || '').toLowerCase()
    const level = Number(tag.replace('h', ''))
    if (level >= 1 && level <= 6) levels.push(level)
  })

  let hierarchyOk = true
  const skips = []
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      hierarchyOk = false
      skips.push(`h${levels[i - 1]} → h${levels[i]}`)
    }
  }

  if (!hierarchyOk) {
    findings.push(makeFinding({
      title: 'Heading hierarchy skipped levels',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `Skipped levels detected: ${skips.slice(0, 5).join(', ')}.`,
      recommendation: 'Keep heading levels sequential (e.g. H1 → H2 → H3).'
    }))
  } else if (levels.length) {
    findings.push(makeFinding({
      title: 'Heading hierarchy looks valid',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Analyzed ${levels.length} headings.`,
      recommendation: 'No action required.'
    }))
  }

  let scoreRatio = 0
  if (!missingH1) scoreRatio += 0.5
  if (!multipleH1 && !missingH1) scoreRatio += 0.3
  if (hierarchyOk && levels.length) scoreRatio += 0.2
  else if (hierarchyOk) scoreRatio += 0.1

  return {
    headings: {
      h1,
      h2,
      h3,
      counts: { h1: h1.length, h2: h2.length, h3: h3.length },
      missingH1,
      multipleH1,
      hierarchyOk,
      hierarchySkips: skips
    },
    findings,
    scoreRatio: Math.min(1, scoreRatio)
  }
}

module.exports = {
  analyzeHeadings
}

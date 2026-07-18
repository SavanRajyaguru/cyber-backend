const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Content metrics from parsed DOM (reuse Cheerio; avoid re-parse).
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} html
 * @param {string|null} titleValue
 */
const analyzeContent = ($, html, titleValue) => {
  const findings = []

  const clone = $.root().clone()
  clone.find('script, style, noscript, svg').remove()
  const text = clone.text().replace(/\s+/g, ' ').trim()
  const words = text ? text.split(/\s+/).filter(Boolean) : []
  const wordCount = words.length

  const paragraphs = $('p')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
  const paragraphCount = paragraphs.length
  const longestParagraph = paragraphs.reduce((max, p) => Math.max(max, p.length), 0)

  const titleWords = (titleValue || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const titleWordCounts = {}
  for (const w of titleWords) titleWordCounts[w] = (titleWordCounts[w] || 0) + 1
  const duplicateTitleWords = Object.entries(titleWordCounts)
    .filter(([, c]) => c > 1)
    .map(([w]) => w)

  const htmlBytes = Buffer.byteLength(html || '', 'utf8')
  const textBytes = Buffer.byteLength(text, 'utf8')
  const textToHtmlRatio = htmlBytes > 0
    ? Math.round((textBytes / htmlBytes) * 10000) / 100
    : 0

  if (wordCount < 100) {
    findings.push(makeFinding({
      title: 'Thin homepage content',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Word count is ${wordCount}.`,
      recommendation: 'Add substantive on-page copy (typically 300+ words for key pages).'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Content word count',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `${wordCount} words detected on the homepage.`,
      recommendation: 'No action required.'
    }))
  }

  if (textToHtmlRatio < 10 && htmlBytes > 5000) {
    findings.push(makeFinding({
      title: 'Low text-to-HTML ratio',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: `Text is ~${textToHtmlRatio}% of HTML size.`,
      recommendation: 'Reduce markup/script noise or increase meaningful text content.'
    }))
  }

  return {
    content: {
      wordCount,
      paragraphCount,
      duplicateTitleWords,
      longestParagraph,
      textToHtmlRatio
    },
    findings
  }
}

module.exports = {
  analyzeContent
}

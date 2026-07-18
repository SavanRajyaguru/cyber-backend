const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

const collectTypes = (node, out = new Set()) => {
  if (!node) return out
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out)
    return out
  }
  if (typeof node !== 'object') return out

  const t = node['@type']
  if (typeof t === 'string') out.add(t)
  else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && out.add(x))

  if (node['@graph']) collectTypes(node['@graph'], out)
  for (const key of Object.keys(node)) {
    if (key === '@type' || key === '@context') continue
    const val = node[key]
    if (val && typeof val === 'object') collectTypes(val, out)
  }
  return out
}

/**
 * Detect JSON-LD, microdata, and common schema types.
 * @param {import('cheerio').CheerioAPI} $
 */
const analyzeStructuredData = ($) => {
  const findings = []
  const jsonLdBlocks = []
  const schemaTypes = new Set()

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || $(el).text() || ''
    try {
      const parsed = JSON.parse(raw)
      jsonLdBlocks.push(parsed)
      collectTypes(parsed, schemaTypes)
    } catch {
      findings.push(makeFinding({
        title: 'Malformed JSON-LD',
        severity: SEVERITY.MEDIUM,
        status: FINDING_STATUS.WARN,
        description: 'A JSON-LD script block could not be parsed.',
        recommendation: 'Validate and fix JSON-LD structured data.'
      }))
    }
  })

  const microdataItems = $('[itemscope]').length
  const hasJsonLd = jsonLdBlocks.length > 0
  const hasMicrodata = microdataItems > 0
  const hasSchemaOrg = hasJsonLd || hasMicrodata ||
    $('[itemtype*="schema.org"]').length > 0 ||
    jsonLdBlocks.some((b) => JSON.stringify(b).includes('schema.org'))

  const hasOrganization = [...schemaTypes].some((t) => /organization|localbusiness|corporation/i.test(t))
  const hasBreadcrumb = [...schemaTypes].some((t) => /breadcrumb/i.test(t))
  const hasArticle = [...schemaTypes].some((t) => /article|blogposting|newsarticle/i.test(t))
  const hasFaq = [...schemaTypes].some((t) => /faqpage|question/i.test(t))

  // OpenGraph / Twitter counted in social analyzer; flag presence here for schema completeness
  const hasOpenGraph = $('meta[property^="og:"]').length > 0
  const hasTwitterCards = $('meta[name^="twitter:"]').length > 0

  if (!hasJsonLd && !hasMicrodata) {
    findings.push(makeFinding({
      title: 'No structured data detected',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No JSON-LD or microdata was found on the homepage.',
      recommendation: 'Add JSON-LD for Organization (and other relevant types).'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Structured data present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `JSON-LD blocks: ${jsonLdBlocks.length}, microdata items: ${microdataItems}.`,
      recommendation: 'No action required.'
    }))
  }

  if (hasJsonLd && !hasOrganization) {
    findings.push(makeFinding({
      title: 'Organization schema not detected',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: 'JSON-LD is present but Organization schema was not found.',
      recommendation: 'Consider adding Organization schema for brand entity signals.'
    }))
  }

  let scoreRatio = 0
  if (hasJsonLd || hasMicrodata) scoreRatio += 0.45
  if (hasOrganization) scoreRatio += 0.2
  if (hasBreadcrumb || hasArticle || hasFaq) scoreRatio += 0.15
  if (hasOpenGraph) scoreRatio += 0.1
  if (hasTwitterCards) scoreRatio += 0.1

  return {
    structuredData: {
      jsonLd: hasJsonLd,
      jsonLdCount: jsonLdBlocks.length,
      microdata: hasMicrodata,
      microdataCount: microdataItems,
      openGraph: hasOpenGraph,
      twitterCards: hasTwitterCards,
      schemaOrg: hasSchemaOrg,
      organization: hasOrganization,
      breadcrumb: hasBreadcrumb,
      article: hasArticle,
      faq: hasFaq,
      types: [...schemaTypes].slice(0, 40)
    },
    findings,
    scoreRatio: Math.min(1, scoreRatio)
  }
}

module.exports = {
  analyzeStructuredData
}

const { DEFAULT_LINK_CHECK_LIMIT } = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { resolveUrl, sameHost } = require('../utils/url')
const { mapPool } = require('../utils/concurrency')
const { checkUrl, getConcurrency } = require('../http.client')
const config = require('../../../../../config/config')

/**
 * Analyze homepage links (internal/external, rel, target, broken HEAD checks).
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} baseUrl
 */
const analyzeLinks = async ($, baseUrl) => {
  const findings = []
  const links = []

  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim()
    const resolved = resolveUrl(href, baseUrl)
    if (!resolved) return

    const rel = String($(el).attr('rel') || '').toLowerCase()
    const relTokens = new Set(rel.split(/\s+/).filter(Boolean))
    const target = String($(el).attr('target') || '').toLowerCase()
    const internal = sameHost(resolved, baseUrl)

    links.push({
      href,
      resolvedUrl: resolved,
      internal,
      external: !internal,
      nofollow: relTokens.has('nofollow'),
      noopener: relTokens.has('noopener'),
      noreferrer: relTokens.has('noreferrer'),
      targetBlank: target === '_blank'
    })
  })

  const internalLinks = links.filter((l) => l.internal)
  const externalLinks = links.filter((l) => l.external)
  const nofollowCount = links.filter((l) => l.nofollow).length
  const targetBlank = links.filter((l) => l.targetBlank)
  const unsafeBlank = targetBlank.filter((l) => !l.noopener && !l.noreferrer)

  if (unsafeBlank.length) {
    findings.push(makeFinding({
      title: 'target="_blank" without noopener/noreferrer',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${unsafeBlank.length} link(s) open in a new tab without rel="noopener" or "noreferrer".`,
      recommendation: 'Add rel="noopener noreferrer" to target="_blank" links.'
    }))
  } else if (targetBlank.length) {
    findings.push(makeFinding({
      title: 'New-tab links use safe rel attributes',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `${targetBlank.length} target="_blank" link(s) include noopener/noreferrer.`,
      recommendation: 'No action required.'
    }))
  }

  findings.push(makeFinding({
    title: 'Homepage link inventory',
    severity: SEVERITY.INFO,
    status: FINDING_STATUS.INFO,
    description: `${internalLinks.length} internal, ${externalLinks.length} external, ${nofollowCount} nofollow.`,
    recommendation: 'No action required.'
  }))

  const limit = Number(config.SCAN_SEO_LINK_CHECK_LIMIT) || DEFAULT_LINK_CHECK_LIMIT
  const toCheck = links
    .map((l) => l.resolvedUrl)
    .filter(Boolean)
    .filter((u, idx, arr) => arr.indexOf(u) === idx)
    .slice(0, limit)

  const checks = await mapPool(toCheck, getConcurrency(), (url) => checkUrl(url))
  const broken = (checks || []).filter((c) => c && !c.ok)

  if (broken.length) {
    findings.push(makeFinding({
      title: 'Broken homepage links',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `${broken.length} of ${toCheck.length} checked links appear broken.`,
      recommendation: 'Fix or remove broken links on the homepage.'
    }))
  } else if (toCheck.length) {
    findings.push(makeFinding({
      title: 'Checked links are accessible',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `HEAD/GET checks passed for ${toCheck.length} unique link(s).`,
      recommendation: 'No action required.'
    }))
  }

  let scoreRatio = 0.5
  if (broken.length === 0) scoreRatio += 0.35
  else scoreRatio += Math.max(0, 0.35 * (1 - broken.length / Math.max(toCheck.length, 1)))
  if (unsafeBlank.length === 0) scoreRatio += 0.15

  return {
    links: {
      total: links.length,
      internal: internalLinks.length,
      external: externalLinks.length,
      nofollow: nofollowCount,
      noopener: links.filter((l) => l.noopener).length,
      noreferrer: links.filter((l) => l.noreferrer).length,
      targetBlank: targetBlank.length,
      unsafeTargetBlank: unsafeBlank.length,
      brokenCount: broken.length,
      broken: broken.slice(0, 15).map((b) => ({
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
  analyzeLinks
}

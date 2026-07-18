const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { originRoot } = require('../utils/url')
const { fetchTextResource, checkUrl } = require('../http.client')

/**
 * Indexability: robots.txt, sitemap.xml, canonical, noindex/nofollow.
 * @param {Object} params
 * @param {string} params.finalUrl
 * @param {{ present: boolean, value: string|null }} params.canonical
 * @param {{ noindex: boolean, nofollow: boolean, value: string|null }} params.robotsMeta
 */
const analyzeRobots = async ({ finalUrl, canonical, robotsMeta }) => {
  const findings = []
  const root = originRoot(finalUrl)
  const robotsUrl = `${root}/robots.txt`
  const sitemapCandidates = [
    `${root}/sitemap.xml`,
    `${root}/sitemap_index.xml`
  ]

  const robotsRes = await fetchTextResource(robotsUrl)
  const robotsTxtAvailable = Boolean(robotsRes.ok)

  let sitemapAvailable = false
  let sitemapUrl = null
  // Prefer sitemap declared in robots.txt
  if (robotsTxtAvailable && robotsRes.body) {
    const match = robotsRes.body.match(/^\s*Sitemap:\s*(\S+)/im)
    if (match?.[1]) {
      const declared = match[1].trim()
      const check = await checkUrl(declared)
      if (check.ok) {
        sitemapAvailable = true
        sitemapUrl = declared
      }
    }
  }
  if (!sitemapAvailable) {
    for (const candidate of sitemapCandidates) {
      const check = await checkUrl(candidate)
      if (check.ok) {
        sitemapAvailable = true
        sitemapUrl = candidate
        break
      }
    }
  }

  if (!robotsTxtAvailable) {
    findings.push(makeFinding({
      title: 'robots.txt not available',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${robotsUrl} was not reachable.`,
      recommendation: 'Publish a robots.txt at the site root.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'robots.txt available',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Found ${robotsUrl}.`,
      recommendation: 'No action required.'
    }))
  }

  if (!sitemapAvailable) {
    findings.push(makeFinding({
      title: 'sitemap.xml not available',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No sitemap was found via robots.txt or common paths.',
      recommendation: 'Publish sitemap.xml and reference it in robots.txt.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Sitemap available',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Sitemap: ${sitemapUrl}`,
      recommendation: 'No action required.'
    }))
  }

  if (robotsMeta?.noindex) {
    findings.push(makeFinding({
      title: 'Homepage is noindex',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'Robots meta includes noindex.',
      recommendation: 'Remove noindex if the homepage should be indexed.'
    }))
  }

  if (robotsMeta?.nofollow) {
    findings.push(makeFinding({
      title: 'Homepage is nofollow',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'Robots meta includes nofollow.',
      recommendation: 'Remove nofollow unless intentional for this page.'
    }))
  }

  let scoreRatio = 0
  if (robotsTxtAvailable) scoreRatio += 0.35
  if (sitemapAvailable) scoreRatio += 0.35
  if (!robotsMeta?.noindex) scoreRatio += 0.2
  if (canonical?.present) scoreRatio += 0.1

  return {
    robots: {
      robotsTxt: {
        available: robotsTxtAvailable,
        url: robotsUrl,
        statusCode: robotsRes.statusCode || null
      },
      sitemap: {
        available: sitemapAvailable,
        url: sitemapUrl
      },
      canonicalPresent: Boolean(canonical?.present),
      noindex: Boolean(robotsMeta?.noindex),
      nofollow: Boolean(robotsMeta?.nofollow)
    },
    findings,
    scoreRatio: Math.min(1, scoreRatio)
  }
}

module.exports = {
  analyzeRobots
}

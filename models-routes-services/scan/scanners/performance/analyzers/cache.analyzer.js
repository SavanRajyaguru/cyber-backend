const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze Cache-Control / ETag on homepage and assets.
 * @param {Object} pageHeaders
 * @param {Object[]} probedResources
 */
const analyzeCache = (pageHeaders = {}, probedResources = []) => {
  const findings = []
  const cacheControl = pageHeaders['cache-control']
    ? String(pageHeaders['cache-control'])
    : null
  const etag = pageHeaders.etag ? String(pageHeaders.etag) : null

  const hasCacheControl = Boolean(cacheControl)
  const hasEtag = Boolean(etag)
  const noStore = /\bno-store\b/i.test(cacheControl || '')
  const noCache = /\bno-cache\b/i.test(cacheControl || '')
  const maxAgeMatch = String(cacheControl || '').match(/max-age=(\d+)/i)
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : null

  if (!hasCacheControl) {
    findings.push(makeFinding({
      title: 'Missing Cache-Control on homepage',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No Cache-Control header on the HTML response.',
      recommendation: 'Set an appropriate Cache-Control policy for HTML and long-lived assets.'
    }))
  } else if (noStore) {
    findings.push(makeFinding({
      title: 'Homepage uses no-store',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: `Cache-Control: ${cacheControl}`,
      recommendation: 'Expected for highly dynamic HTML; ensure static assets are cached aggressively.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Cache-Control present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Cache-Control: ${cacheControl}`,
      recommendation: 'No action required.'
    }))
  }

  if (hasEtag) {
    findings.push(makeFinding({
      title: 'ETag present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Homepage response includes an ETag.',
      recommendation: 'No action required.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Missing ETag',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: 'No ETag header on the homepage response.',
      recommendation: 'Consider ETag or Last-Modified for conditional requests.'
    }))
  }

  const staticAssets = probedResources.filter((r) =>
    ['css', 'javascript', 'image', 'font', 'svg'].includes(r.type)
  )
  const withCache = staticAssets.filter((r) => r.cacheControl).length
  const missingCacheAssets = staticAssets.length - withCache

  if (staticAssets.length >= 3 && missingCacheAssets / staticAssets.length > 0.5) {
    findings.push(makeFinding({
      title: 'Many assets missing Cache-Control',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${missingCacheAssets}/${staticAssets.length} probed assets lacked Cache-Control.`,
      recommendation: 'Add long-lived cache headers for fingerprinted static assets.'
    }))
  }

  let scoreRatio = 0
  if (hasCacheControl && !noStore) scoreRatio += 0.55
  else if (hasCacheControl) scoreRatio += 0.35
  if (hasEtag) scoreRatio += 0.2
  if (staticAssets.length) {
    scoreRatio += 0.25 * (withCache / staticAssets.length)
  } else {
    scoreRatio += 0.15
  }

  return {
    cache: {
      cacheControl,
      etag,
      hasCacheControl,
      hasEtag,
      noStore,
      noCache,
      maxAge,
      assetsWithCacheControl: withCache,
      assetsChecked: staticAssets.length
    },
    findings,
    scoreRatio: Math.min(1, scoreRatio)
  }
}

module.exports = {
  analyzeCache
}

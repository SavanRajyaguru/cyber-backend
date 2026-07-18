const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Cross-cutting optimization signals (render-blocking, lazy-load, etc.).
 * @param {Object} params
 * @param {Object[]} params.probed
 * @param {import('cheerio').CheerioAPI} params.$
 * @param {Object} params.compression
 * @param {Object} params.cache
 * @param {Object} params.images
 * @param {Object} params.resources
 */
const analyzeOptimization = ({
  probed = [],
  $,
  compression,
  cache,
  images,
  resources
}) => {
  const findings = []

  const renderBlockingCss = probed.filter(
    (r) => r.type === 'css' && r.meta?.renderBlocking
  )
  const renderBlockingJs = probed.filter(
    (r) => r.type === 'javascript' && r.meta?.renderBlocking
  )

  let blockingCssInHead = renderBlockingCss.length
  let blockingJs = renderBlockingJs.length

  if ($) {
    blockingCssInHead = $('head link[rel="stylesheet"]').length
    blockingJs = $('script[src]:not([async]):not([defer])').length
  }

  if (blockingCssInHead > 2) {
    findings.push(makeFinding({
      title: 'Render-blocking CSS',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${blockingCssInHead} stylesheet link(s) in <head>.`,
      recommendation: 'Inline critical CSS and defer non-critical stylesheets.'
    }))
  }

  if (blockingJs > 0) {
    findings.push(makeFinding({
      title: 'Render-blocking JavaScript',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${blockingJs} script(s) without async/defer.`,
      recommendation: 'Add async or defer to non-critical scripts.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'No render-blocking scripts detected',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'External scripts use async/defer or none were found.',
      recommendation: 'No action required.'
    }))
  }

  const optimization = {
    missingCompression: !compression?.enabled,
    missingCacheControl: !cache?.hasCacheControl,
    tooManyRequests: (resources?.discovered || 0) > 50,
    largeDom: (resources?.domElements || 0) > 1500,
    renderBlockingCss: blockingCssInHead,
    renderBlockingJavascript: blockingJs,
    missingLazyLoading: (images?.count || 0) > 3 && (images?.lazyLoaded || 0) === 0,
    largeJavascriptBundles: (resources?.byType?.javascript?.items || []).some(
      (i) => typeof i.size === 'number' && i.size >= 500 * 1024
    ),
    largeCss: (resources?.byType?.css?.items || []).some(
      (i) => typeof i.size === 'number' && i.size >= 200 * 1024
    ),
    largeImages: (images?.largeCount || 0) > 0
  }

  return { optimization, findings }
}

module.exports = {
  analyzeOptimization
}

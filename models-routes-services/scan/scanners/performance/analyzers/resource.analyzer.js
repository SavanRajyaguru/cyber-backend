const {
  LARGE_JS_BYTES,
  LARGE_CSS_BYTES,
  TOO_MANY_REQUESTS,
  LARGE_DOM_ELEMENTS
} = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze resource inventory and CSS/JS weight.
 * @param {Object} byType
 * @param {{ totalDiscovered: number, capped: boolean, domElements: number }} meta
 * @param {Object[]} probed
 */
const analyzeResources = (byType, meta, probed = []) => {
  const findings = []
  const totalCount = probed.length
  const totalSize = probed.reduce(
    (sum, r) => sum + (typeof r.size === 'number' ? r.size : 0),
    0
  )

  if (meta.totalDiscovered > TOO_MANY_REQUESTS) {
    findings.push(makeFinding({
      title: 'Too many homepage resource requests',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Discovered ${meta.totalDiscovered} resources (threshold ${TOO_MANY_REQUESTS}).`,
      recommendation: 'Bundle, defer, and remove unused assets to cut request count.'
    }))
  }

  if (meta.domElements > LARGE_DOM_ELEMENTS) {
    findings.push(makeFinding({
      title: 'Large DOM',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `DOM contains ~${meta.domElements} elements.`,
      recommendation: 'Simplify markup and avoid excessive nested nodes.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'DOM size acceptable',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `DOM element count: ${meta.domElements}.`,
      recommendation: 'No action required.'
    }))
  }

  const largeJs = (byType.javascript?.items || []).filter(
    (i) => typeof i.size === 'number' && i.size >= LARGE_JS_BYTES
  )
  const largeCss = (byType.css?.items || []).filter(
    (i) => typeof i.size === 'number' && i.size >= LARGE_CSS_BYTES
  )

  if (largeJs.length) {
    findings.push(makeFinding({
      title: 'Large JavaScript bundles',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: `${largeJs.length} JS file(s) ≥ ${Math.round(LARGE_JS_BYTES / 1024)} KB.`,
      recommendation: 'Code-split, tree-shake, and defer non-critical JavaScript.'
    }))
  }

  if (largeCss.length) {
    findings.push(makeFinding({
      title: 'Large CSS files',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${largeCss.length} CSS file(s) ≥ ${Math.round(LARGE_CSS_BYTES / 1024)} KB.`,
      recommendation: 'Remove unused CSS and split critical vs non-critical styles.'
    }))
  }

  if (meta.capped) {
    findings.push(makeFinding({
      title: 'Resource probe capped',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: `Analysis limited to the first ${totalCount} of ${meta.totalDiscovered} resources.`,
      recommendation: 'Reduce homepage asset count for fuller analysis coverage.'
    }))
  }

  // Assets score: fewer requests + smaller total weight
  let assetsRatio = 1
  if (meta.totalDiscovered > TOO_MANY_REQUESTS) {
    assetsRatio -= Math.min(0.5, (meta.totalDiscovered - TOO_MANY_REQUESTS) / 100)
  }
  if (meta.domElements > LARGE_DOM_ELEMENTS) {
    assetsRatio -= Math.min(0.3, (meta.domElements - LARGE_DOM_ELEMENTS) / 5000)
  }
  if (totalSize > 2 * 1024 * 1024) assetsRatio -= 0.2
  else if (totalSize > 1024 * 1024) assetsRatio -= 0.1

  // CSS/JS score
  let cssJsRatio = 1
  if (largeJs.length) cssJsRatio -= Math.min(0.6, largeJs.length * 0.25)
  if (largeCss.length) cssJsRatio -= Math.min(0.3, largeCss.length * 0.15)
  const jsTotal = byType.javascript?.totalSize || 0
  const cssTotal = byType.css?.totalSize || 0
  if (jsTotal > LARGE_JS_BYTES * 2) cssJsRatio -= 0.15
  if (cssTotal > LARGE_CSS_BYTES * 2) cssJsRatio -= 0.1

  return {
    resources: {
      total: totalCount,
      discovered: meta.totalDiscovered,
      totalSize,
      averageSize: totalCount
        ? Math.round(totalSize / Math.max(1, probed.filter((r) => typeof r.size === 'number').length))
        : 0,
      domElements: meta.domElements,
      byType
    },
    findings,
    assetsScoreRatio: Math.max(0, Math.min(1, assetsRatio)),
    cssJsScoreRatio: Math.max(0, Math.min(1, cssJsRatio))
  }
}

module.exports = {
  analyzeResources
}

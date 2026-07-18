const { THREAT_CATEGORIES, SEVERITY } = require('../constants')
const { makeThreatFinding } = require('../utils/finding')

/**
 * Performance signals that can indicate operational / security risk.
 * @param {Object|null} performance
 * @returns {import('../types').ThreatFinding[]}
 */
const applyPerformanceRule = (performance) => {
  if (!performance || performance.oMeta?.bStub) return []

  const findings = []
  const compression = performance.compression || {}
  const cache = performance.cache || {}
  const optimization = performance.optimization || {}
  const timings = performance.timings || {}

  if (compression.enabled === false || optimization.missingCompression) {
    findings.push(makeThreatFinding({
      title: 'Missing response compression',
      category: THREAT_CATEGORIES.PERFORMANCE,
      severity: SEVERITY.LOW,
      confidence: 85,
      affectedModule: 'performance',
      description: 'Homepage responses are not compressed (gzip/br).',
      recommendation: 'Enable Brotli or Gzip at the CDN/origin.'
    }))
  }

  if (cache.hasCacheControl === false || optimization.missingCacheControl) {
    findings.push(makeThreatFinding({
      title: 'Missing Cache-Control',
      category: THREAT_CATEGORIES.PERFORMANCE,
      severity: SEVERITY.LOW,
      confidence: 80,
      affectedModule: 'performance',
      description: 'No Cache-Control on the homepage response.',
      recommendation: 'Set appropriate cache policies for HTML and static assets.'
    }))
  }

  if (typeof timings.ttfbMs === 'number' && timings.ttfbMs > 1200) {
    findings.push(makeThreatFinding({
      title: 'Slow TTFB may indicate origin stress',
      category: THREAT_CATEGORIES.PERFORMANCE,
      severity: SEVERITY.INFORMATIONAL,
      confidence: 55,
      affectedModule: 'performance',
      description: `TTFB was ${timings.ttfbMs} ms.`,
      recommendation: 'Investigate origin latency; slow origins can worsen DoS impact.'
    }))
  }

  if (optimization.renderBlockingJavascript > 3) {
    findings.push(makeThreatFinding({
      title: 'Many render-blocking scripts',
      category: THREAT_CATEGORIES.PERFORMANCE,
      severity: SEVERITY.LOW,
      confidence: 65,
      affectedModule: 'performance',
      description: `${optimization.renderBlockingJavascript} render-blocking script(s) detected.`,
      recommendation: 'Defer non-critical scripts to reduce attack surface during load.'
    }))
  }

  return findings
}

module.exports = {
  name: 'performance',
  sourceModule: 'performance',
  apply: applyPerformanceRule
}

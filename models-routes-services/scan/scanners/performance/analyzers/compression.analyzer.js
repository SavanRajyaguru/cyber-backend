const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze homepage compression / content-encoding.
 * @param {Object} pageHeaders
 * @param {Object} timings
 * @param {Object[]} probedResources
 */
const analyzeCompression = (pageHeaders = {}, timings = {}, probedResources = []) => {
  const findings = []
  const encoding = String(
    timings.contentEncoding || pageHeaders['content-encoding'] || ''
  ).toLowerCase()

  const gzip = encoding.includes('gzip')
  const brotli = encoding.includes('br')
  const deflate = encoding.includes('deflate')
  const enabled = gzip || brotli || deflate

  const resourcesWithEncoding = probedResources.filter((r) => r.contentEncoding)
  const textLike = probedResources.filter((r) =>
    r.type === 'css' || r.type === 'javascript' || r.type === 'svg'
  )
  const textCompressed = textLike.filter((r) => r.contentEncoding).length

  if (!enabled) {
    findings.push(makeFinding({
      title: 'Missing homepage compression',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'Homepage response has no Content-Encoding (gzip/br).',
      recommendation: 'Enable Brotli or Gzip compression at the CDN/origin.'
    }))
  } else if (brotli) {
    findings.push(makeFinding({
      title: 'Brotli compression enabled',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Homepage uses brotli (br) compression.',
      recommendation: 'No action required.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'Gzip compression enabled',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Homepage Content-Encoding: ${encoding}.`,
      recommendation: 'Consider Brotli for better text compression ratios.'
    }))
  }

  if (textLike.length >= 3 && textCompressed / textLike.length < 0.5) {
    findings.push(makeFinding({
      title: 'Some text assets lack compression',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `${textCompressed}/${textLike.length} CSS/JS/SVG probes reported Content-Encoding.`,
      recommendation: 'Ensure Gzip/Brotli for all compressible static assets.'
    }))
  }

  let scoreRatio = enabled ? (brotli ? 1 : 0.8) : 0
  if (textLike.length) {
    const ratio = textCompressed / textLike.length
    scoreRatio = scoreRatio * 0.7 + ratio * 0.3
  }

  return {
    compression: {
      enabled,
      gzip,
      brotli,
      deflate,
      contentEncoding: encoding || null,
      resourcesReportingEncoding: resourcesWithEncoding.length
    },
    findings,
    scoreRatio
  }
}

module.exports = {
  analyzeCompression
}

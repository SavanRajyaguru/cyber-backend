const {
  TTFB_GOOD_MS,
  TTFB_OK_MS,
  TOTAL_GOOD_MS,
  TOTAL_OK_MS
} = require('../constants')
const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * Analyze homepage timing metrics.
 * @param {Object} timings
 * @param {number} [statusCode]
 */
const analyzeTiming = (timings = {}, statusCode) => {
  const findings = []
  const ttfb = timings.ttfbMs
  const total = timings.totalMs

  if (typeof ttfb === 'number') {
    if (ttfb <= TTFB_GOOD_MS) {
      findings.push(makeFinding({
        title: 'Excellent TTFB',
        severity: SEVERITY.INFO,
        status: FINDING_STATUS.PASS,
        description: `Time to first byte was ${ttfb} ms.`,
        recommendation: 'No action required.'
      }))
    } else if (ttfb <= TTFB_OK_MS) {
      findings.push(makeFinding({
        title: 'TTFB could be improved',
        severity: SEVERITY.LOW,
        status: FINDING_STATUS.WARN,
        description: `TTFB was ${ttfb} ms (good target ≤ ${TTFB_GOOD_MS} ms).`,
        recommendation: 'Optimize server response time, caching, and origin distance.'
      }))
    } else {
      findings.push(makeFinding({
        title: 'Slow TTFB',
        severity: SEVERITY.HIGH,
        status: FINDING_STATUS.FAIL,
        description: `TTFB was ${ttfb} ms.`,
        recommendation: 'Investigate server latency, cold starts, and backend bottlenecks.'
      }))
    }
  }

  if (typeof total === 'number') {
    if (total <= TOTAL_GOOD_MS) {
      findings.push(makeFinding({
        title: 'Fast total response time',
        severity: SEVERITY.INFO,
        status: FINDING_STATUS.PASS,
        description: `Total homepage response time was ${total} ms.`,
        recommendation: 'No action required.'
      }))
    } else if (total <= TOTAL_OK_MS) {
      findings.push(makeFinding({
        title: 'Moderate total response time',
        severity: SEVERITY.MEDIUM,
        status: FINDING_STATUS.WARN,
        description: `Total response time was ${total} ms.`,
        recommendation: 'Reduce payload size and improve server/network latency.'
      }))
    } else {
      findings.push(makeFinding({
        title: 'Slow total response time',
        severity: SEVERITY.HIGH,
        status: FINDING_STATUS.FAIL,
        description: `Total response time was ${total} ms.`,
        recommendation: 'Compress responses, trim HTML, and optimize origin performance.'
      }))
    }
  }

  if (timings.http2) {
    findings.push(makeFinding({
      title: 'HTTP/2 offered',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Server ALPN advertises HTTP/2 (h2).',
      recommendation: 'No action required.'
    }))
  } else if (String(timings.httpVersion || '').includes('1.')) {
    findings.push(makeFinding({
      title: 'HTTP/2 not detected',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.INFO,
      description: `Measured protocol ${timings.httpVersion || 'HTTP/1.x'}; h2 ALPN not confirmed.`,
      recommendation: 'Enable HTTP/2 on the edge/origin for multiplexing benefits.'
    }))
  }

  if (timings.http3 === true) {
    findings.push(makeFinding({
      title: 'HTTP/3 advertised',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Alt-Svc header advertises h3.',
      recommendation: 'No action required.'
    }))
  }

  if (statusCode === 404) {
    findings.push(makeFinding({
      title: 'Homepage returned 404',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'Performance was measured on a 404 response.',
      recommendation: 'Scan a valid publicly reachable homepage URL.'
    }))
  }

  // Score ratio from TTFB + total
  let scoreRatio = 0.5
  if (typeof ttfb === 'number') {
    if (ttfb <= TTFB_GOOD_MS) scoreRatio = 1
    else if (ttfb <= TTFB_OK_MS) scoreRatio = 0.7
    else if (ttfb <= 1200) scoreRatio = 0.35
    else scoreRatio = 0.1
  }
  if (typeof total === 'number') {
    let totalRatio = 0.5
    if (total <= TOTAL_GOOD_MS) totalRatio = 1
    else if (total <= TOTAL_OK_MS) totalRatio = 0.65
    else if (total <= 5000) totalRatio = 0.3
    else totalRatio = 0.1
    scoreRatio = scoreRatio * 0.55 + totalRatio * 0.45
  }

  return {
    timings: {
      dnsLookupMs: timings.dnsLookupMs ?? null,
      tcpConnectMs: timings.tcpConnectMs ?? null,
      tlsHandshakeMs: timings.tlsHandshakeMs ?? null,
      ttfbMs: timings.ttfbMs ?? null,
      downloadMs: timings.downloadMs ?? null,
      totalMs: timings.totalMs ?? null,
      responseSize: timings.responseSize ?? null,
      contentEncoding: timings.contentEncoding ?? null,
      httpVersion: timings.httpVersion ?? null,
      http2: Boolean(timings.http2),
      http3: timings.http3 ?? null
    },
    findings,
    scoreRatio
  }
}

module.exports = {
  analyzeTiming
}

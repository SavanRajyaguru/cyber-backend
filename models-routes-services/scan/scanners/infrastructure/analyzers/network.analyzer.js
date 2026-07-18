const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')
const { getHeader } = require('../utils/headers')
const { isPrivateIp } = require('../services/network.service')

/**
 * @param {Object} params
 * @param {string} params.hostname
 * @param {Object|null} params.dns
 * @param {Object|null} params.header
 * @param {Object|null} params.ssl
 * @param {Object|null} params.performance
 * @param {Object|null} params.fallbackHttp
 * @param {string[]} [params.fallbackA]
 * @param {string[]} [params.fallbackAAAA]
 * @param {Record<string, string>} params.headers
 */
const analyzeNetwork = ({
  hostname,
  dns = null,
  header = null,
  ssl = null,
  performance = null,
  fallbackHttp = null,
  fallbackA = [],
  fallbackAAAA = [],
  headers = {}
}) => {
  const findings = []

  const ipv4 = (dns?.records?.A?.length ? dns.records.A : fallbackA).map(String)
  const ipv6 = (dns?.records?.AAAA?.length ? dns.records.AAAA : fallbackAAAA).map(String)
  const cnames = (dns?.records?.CNAME || []).map(String)
  const privateIps = [...ipv4, ...ipv6].filter(isPrivateIp)

  const redirects = header?.redirects || fallbackHttp?.redirects || []
  const finalUrl = header?.finalUrl || fallbackHttp?.finalUrl || null
  const httpVersion =
    performance?.timings?.httpVersion ||
    fallbackHttp?.httpVersion ||
    null
  const http2 = Boolean(performance?.timings?.http2)
  const http3 = performance?.timings?.http3 ?? null

  let https = null
  if (finalUrl) https = String(finalUrl).startsWith('https:')
  else if (ssl?.certificate || ssl?.tls) https = true
  else if (fallbackHttp) https = Boolean(fallbackHttp.httpsEnabled)

  const hsts = Boolean(getHeader(headers, 'strict-transport-security'))
  const compression =
    Boolean(getHeader(headers, 'content-encoding')) ||
    Boolean(performance?.compression?.enabled)

  if (!ipv4.length && !cnames.length) {
    findings.push(makeFinding({
      title: 'No IPv4 address resolved',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No A records were available from DNS results.',
      recommendation: 'Ensure the hostname resolves publicly over IPv4 if required.'
    }))
  }

  if (!ipv6.length) {
    findings.push(makeFinding({
      title: 'Missing IPv6',
      severity: SEVERITY.LOW,
      status: FINDING_STATUS.WARN,
      description: 'No AAAA records were found.',
      recommendation: 'Publish AAAA records to enable IPv6 connectivity.'
    }))
  } else {
    findings.push(makeFinding({
      title: 'IPv6 available',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Resolved ${ipv6.length} AAAA address(es).`,
      recommendation: 'No action required.'
    }))
  }

  if (privateIps.length) {
    findings.push(makeFinding({
      title: 'Private IP in public DNS',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: `Private address(es) published: ${privateIps.join(', ')}.`,
      recommendation: 'Avoid exposing private RFC1918 addresses in public DNS.'
    }))
  }

  if (https) {
    findings.push(makeFinding({
      title: 'HTTPS enabled',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: 'Target is reachable over HTTPS.',
      recommendation: 'No action required.'
    }))
  } else if (https === false) {
    findings.push(makeFinding({
      title: 'HTTPS not confirmed',
      severity: SEVERITY.HIGH,
      status: FINDING_STATUS.FAIL,
      description: 'Could not confirm HTTPS for the homepage.',
      recommendation: 'Serve the site exclusively over HTTPS with a valid certificate.'
    }))
  }

  if (hsts) {
    findings.push(makeFinding({
      title: 'HSTS enabled',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Strict-Transport-Security: ${getHeader(headers, 'strict-transport-security')}`,
      recommendation: 'No action required.'
    }))
  } else if (https) {
    findings.push(makeFinding({
      title: 'HSTS not enabled',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARN,
      description: 'No Strict-Transport-Security header was observed.',
      recommendation: 'Enable HSTS with a sufficient max-age and includeSubDomains where appropriate.'
    }))
  }

  if (compression) {
    findings.push(makeFinding({
      title: 'Response compression enabled',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: `Content-Encoding / performance compression detected.`,
      recommendation: 'No action required.'
    }))
  }

  if (redirects.length) {
    findings.push(makeFinding({
      title: 'Redirect chain observed',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: `${redirects.length} redirect hop(s) before the final response.`,
      recommendation: 'Keep redirect chains short (ideally one hop to HTTPS).'
    }))
  }

  let httpsRatio = https ? 1 : 0
  if (https && hsts) httpsRatio = 1
  else if (https && !hsts) httpsRatio = 0.7

  return {
    network: {
      hostname,
      ipv4,
      ipv6,
      resolvedDomains: [hostname, ...cnames].filter(Boolean),
      cnames,
      redirectChain: redirects,
      finalUrl,
      httpVersion,
      http2,
      http3,
      httpsEnabled: Boolean(https),
      hstsEnabled: hsts,
      compression,
      privateIps
    },
    findings,
    httpsScoreRatio: httpsRatio,
    ipv6ScoreRatio: ipv6.length ? 1 : 0.2
  }
}

module.exports = {
  analyzeNetwork
}

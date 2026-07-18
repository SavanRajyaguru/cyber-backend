const { makeFinding, SEVERITY, FINDING_STATUS } = require('../utils/finding')

/**
 * @param {Object} params
 * @param {Array} params.hostingList
 * @param {Array} params.proxyList
 * @param {string|null} params.primaryCdn
 * @param {string|null} params.primaryCloud
 */
const analyzeHosting = ({
  hostingList = [],
  proxyList = [],
  primaryCdn = null,
  primaryCloud = null
}) => {
  const findings = []
  const platforms = hostingList.map((h) => h.name)
  const provider =
    platforms[0] ||
    primaryCloud ||
    primaryCdn ||
    null

  if (platforms.length) {
    findings.push(makeFinding({
      title: `Hosting platform: ${platforms[0]}`,
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.INFO,
      description: `Deployment/hosting signals match ${platforms.join(', ')}.`,
      recommendation: 'Keep platform hardening and least-privilege deploy credentials in place.'
    }))
  }

  const reverseProxy = proxyList.length > 0 || Boolean(primaryCdn)
  if (reverseProxy) {
    findings.push(makeFinding({
      title: 'Reverse proxy / edge present',
      severity: SEVERITY.INFO,
      status: FINDING_STATUS.PASS,
      description: primaryCdn
        ? `Traffic appears fronted by ${primaryCdn} (CDN/reverse proxy).`
        : `Proxy signals: ${proxyList.map((p) => p.name).join(', ')}.`,
      recommendation: 'No action required.'
    }))
  }

  // Best practices: HTTPS edge + CDN or known platform
  let bestPracticesRatio = 0.4
  if (platforms.length || primaryCloud) bestPracticesRatio += 0.3
  if (primaryCdn) bestPracticesRatio += 0.3

  return {
    hosting: {
      provider,
      platform: platforms[0] || null,
      platforms,
      cloudProvider: primaryCloud,
      cdnProvider: primaryCdn,
      reverseProxy,
      loadBalancer: proxyList.some((p) => /elb|haproxy|load/i.test(p.name)) || Boolean(primaryCdn),
      deploymentPlatform: platforms[0] || null,
      details: hostingList.slice(0, 8)
    },
    findings,
    scoreRatio: Math.min(1, bestPracticesRatio)
  }
}

module.exports = {
  analyzeHosting
}

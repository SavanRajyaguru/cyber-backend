/**
 * Passive provider/CDN/hosting detection patterns.
 * Matched against header blob, DNS hostnames, and technology names.
 *
 * @typedef {'cdn'|'cloud'|'hosting'|'proxy'|'platform'} ProviderCategory
 * @typedef {{
 *   name: string,
 *   category: ProviderCategory,
 *   patterns: RegExp[],
 *   confidence: number
 * }} ProviderRule
 */

/** @type {ProviderRule[]} */
const PROVIDER_RULES = [
  // CDN
  {
    name: 'Cloudflare',
    category: 'cdn',
    confidence: 98,
    patterns: [
      /cf-ray\s*:/i,
      /server\s*:\s*cloudflare/i,
      /cf-cache-status\s*:/i,
      /\.cloudflare\.com/i,
      /cloudflare/i
    ]
  },
  {
    name: 'CloudFront',
    category: 'cdn',
    confidence: 95,
    patterns: [
      /x-amz-cf-id\s*:/i,
      /via\s*:.*cloudfront/i,
      /x-cache\s*:.*cloudfront/i,
      /\.cloudfront\.net/i
    ]
  },
  {
    name: 'Fastly',
    category: 'cdn',
    confidence: 92,
    patterns: [/x-served-by\s*:.*cache-/i, /via\s*:.*fastly/i, /fastly/i]
  },
  {
    name: 'Akamai',
    category: 'cdn',
    confidence: 92,
    patterns: [/x-akamai-/i, /akamai-origin-hop/i, /server\s*:\s*AkamaiGHost/i, /akamai/i]
  },
  {
    name: 'BunnyCDN',
    category: 'cdn',
    confidence: 95,
    patterns: [/cdn-pullzone\s*:/i, /server\s*:\s*BunnyCDN/i, /bunnycdn/i, /b-cdn\.net/i]
  },

  // Cloud
  {
    name: 'AWS',
    category: 'cloud',
    confidence: 90,
    patterns: [
      /x-amz-/i,
      /\.amazonaws\.com/i,
      /\.awsglobalaccelerator\.com/i,
      /ec2.*amazonaws/i,
      /\belb\b.*amazonaws/i
    ]
  },
  {
    name: 'Azure',
    category: 'cloud',
    confidence: 90,
    patterns: [
      /x-azure-/i,
      /x-ms-request-id\s*:/i,
      /\.azurewebsites\.net/i,
      /\.cloudapp\.azure\.com/i,
      /\.azurefd\.net/i,
      /\.azureedge\.net/i
    ]
  },
  {
    name: 'Google Cloud',
    category: 'cloud',
    confidence: 88,
    patterns: [
      /x-goog-/i,
      /server\s*:\s*gws/i,
      /\.googleapis\.com/i,
      /\.googleusercontent\.com/i,
      /\.appspot\.com/i,
      /ghs\.google/i
    ]
  },
  {
    name: 'DigitalOcean',
    category: 'cloud',
    confidence: 85,
    patterns: [/digitalocean/i, /\.ondigitalocean\.app/i, /x-do-/i]
  },
  {
    name: 'Hetzner',
    category: 'cloud',
    confidence: 80,
    patterns: [/hetzner/i, /\.your-server\.de/i]
  },
  {
    name: 'OVH',
    category: 'cloud',
    confidence: 80,
    patterns: [/\bovh\b/i, /\.ovh\.net/i, /\.ovhcloud\.com/i]
  },
  {
    name: 'Linode',
    category: 'cloud',
    confidence: 80,
    patterns: [/linode/i, /\.linode\.com/i, /\.linodeobjects\.com/i]
  },
  {
    name: 'Vultr',
    category: 'cloud',
    confidence: 80,
    patterns: [/\bvultr\b/i, /\.vultr\.com/i]
  },

  // Hosting / platforms
  {
    name: 'Vercel',
    category: 'hosting',
    confidence: 98,
    patterns: [/x-vercel-/i, /server\s*:\s*Vercel/i, /\.vercel\.app/i, /vercel/i]
  },
  {
    name: 'Netlify',
    category: 'hosting',
    confidence: 98,
    patterns: [/x-nf-/i, /server\s*:\s*Netlify/i, /\.netlify\.app/i, /netlify/i]
  },
  {
    name: 'Firebase Hosting',
    category: 'hosting',
    confidence: 92,
    patterns: [/x-firebase-/i, /firebaseapp\.com/i, /\.web\.app\b/i, /firebase hosting/i]
  },
  {
    name: 'GitHub Pages',
    category: 'hosting',
    confidence: 95,
    patterns: [/github\.io/i, /x-github-/i, /pages-custom-domain/i, /GitHub\.com/i]
  },
  {
    name: 'Render',
    category: 'hosting',
    confidence: 90,
    patterns: [/x-render-/i, /\.onrender\.com/i, /\brender\b/i]
  },
  {
    name: 'Railway',
    category: 'hosting',
    confidence: 90,
    patterns: [/x-railway/i, /\.up\.railway\.app/i, /railway\.app/i]
  },
  {
    name: 'Heroku',
    category: 'hosting',
    confidence: 88,
    patterns: [/via\s*:.*vegur/i, /\.herokuapp\.com/i, /heroku/i]
  },

  // Reverse proxy / load balancer signals
  {
    name: 'nginx',
    category: 'proxy',
    confidence: 85,
    patterns: [/server\s*:\s*nginx/i]
  },
  {
    name: 'Apache',
    category: 'proxy',
    confidence: 85,
    patterns: [/server\s*:\s*Apache/i]
  },
  {
    name: 'HAProxy',
    category: 'proxy',
    confidence: 80,
    patterns: [/via\s*:.*haproxy/i, /x-haproxy/i]
  },
  {
    name: 'AWS ELB',
    category: 'proxy',
    confidence: 90,
    patterns: [/awselb/i, /\.elb\.amazonaws\.com/i, /x-amzn-trace-id\s*:/i]
  }
]

/**
 * Match providers against an evidence blob.
 * @param {string} blob
 * @returns {Array<{ name: string, category: string, confidence: number, evidence: string }>}
 */
const matchProviders = (blob = '') => {
  const text = String(blob || '')
  if (!text) return []

  const hits = []
  const seen = new Set()

  for (const rule of PROVIDER_RULES) {
    for (const pattern of rule.patterns) {
      if (!pattern.test(text)) continue
      const key = `${rule.category}:${rule.name}`
      if (seen.has(key)) break
      seen.add(key)
      const match = text.match(pattern)
      hits.push({
        name: rule.name,
        category: rule.category,
        confidence: rule.confidence,
        evidence: match?.[0] ? String(match[0]).slice(0, 120) : rule.name
      })
      break
    }
  }

  return hits.sort((a, b) => b.confidence - a.confidence)
}

module.exports = {
  PROVIDER_RULES,
  matchProviders
}

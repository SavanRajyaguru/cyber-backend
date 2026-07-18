const { CATEGORIES } = require('./constants')

/**
 * Pattern registry — regex compiled once at load.
 * Sources: header | html | script | meta | link
 * @type {Array<{
 *   name: string,
 *   category: string,
 *   source: 'header'|'html'|'script'|'meta'|'link',
 *   pattern: RegExp,
 *   confidence: number,
 *   evidence: string,
 *   versionGroup?: number
 * }>}
 */
const PATTERNS = [
  // ========== Frontend ==========
  { name: 'React', category: CATEGORIES.FRONTEND, source: 'html', pattern: /data-reactroot|data-reactid|_reactRootContainer|__NEXT_DATA__/i, confidence: 90, evidence: 'React DOM markers in HTML' },
  { name: 'React', category: CATEGORIES.FRONTEND, source: 'script', pattern: /react(?:[-.]dom)?(?:\.production)?(?:\.min)?\.js/i, confidence: 85, evidence: 'React script URL' },
  { name: 'React', category: CATEGORIES.FRONTEND, source: 'html', pattern: /"react(?:-dom)?"\s*:\s*"([\d.]+)"/i, confidence: 80, evidence: 'React version in HTML', versionGroup: 1 },
  { name: 'Next.js', category: CATEGORIES.FRONTEND, source: 'html', pattern: /__NEXT_DATA__|_next\/static/i, confidence: 95, evidence: 'Next.js runtime markers' },
  { name: 'Next.js', category: CATEGORIES.FRONTEND, source: 'header', pattern: /x-powered-by\s*:\s*Next\.js/i, confidence: 98, evidence: 'x-powered-by: Next.js' },
  { name: 'Vue', category: CATEGORIES.FRONTEND, source: 'html', pattern: /data-v-[a-f0-9]{8}|__VUE__/i, confidence: 88, evidence: 'Vue scoped attributes / runtime' },
  { name: 'Vue', category: CATEGORIES.FRONTEND, source: 'script', pattern: /vue(?:\.runtime)?(?:\.esm)?(?:\.min)?\.js/i, confidence: 85, evidence: 'Vue script URL' },
  { name: 'Nuxt', category: CATEGORIES.FRONTEND, source: 'html', pattern: /__NUXT__|_nuxt\//i, confidence: 95, evidence: 'Nuxt runtime markers' },
  { name: 'Angular', category: CATEGORIES.FRONTEND, source: 'html', pattern: /ng-version=["']([^"']+)["']|ng-app=|_ngcontent/i, confidence: 92, evidence: 'Angular attributes', versionGroup: 1 },
  { name: 'Angular', category: CATEGORIES.FRONTEND, source: 'script', pattern: /@angular\/|angular(?:\.min)?\.js/i, confidence: 85, evidence: 'Angular script URL' },
  { name: 'Svelte', category: CATEGORIES.FRONTEND, source: 'html', pattern: /__svelte|class="svelte-/i, confidence: 85, evidence: 'Svelte markers in HTML' },
  { name: 'Astro', category: CATEGORIES.FRONTEND, source: 'html', pattern: /astro-island|data-astro-/i, confidence: 95, evidence: 'Astro island / data attributes' },
  { name: 'Remix', category: CATEGORIES.FRONTEND, source: 'html', pattern: /__remixContext|remix-run/i, confidence: 90, evidence: 'Remix runtime markers' },
  { name: 'Preact', category: CATEGORIES.FRONTEND, source: 'script', pattern: /preact(?:\.min)?\.js|from\s*['"]preact['"]/i, confidence: 85, evidence: 'Preact script / import' },

  // ========== Backend ==========
  { name: 'Express', category: CATEGORIES.BACKEND, source: 'header', pattern: /x-powered-by\s*:\s*Express/i, confidence: 95, evidence: 'x-powered-by: Express' },
  { name: 'Laravel', category: CATEGORIES.BACKEND, source: 'header', pattern: /set-cookie\s*:.*laravel_session/i, confidence: 92, evidence: 'laravel_session cookie' },
  { name: 'Laravel', category: CATEGORIES.BACKEND, source: 'html', pattern: /name=["']csrf-token["'][^>]*content=["'][^"']+["']/i, confidence: 60, evidence: 'CSRF meta (possible Laravel)' },
  { name: 'Django', category: CATEGORIES.BACKEND, source: 'header', pattern: /set-cookie\s*:.*csrftoken|set-cookie\s*:.*sessionid/i, confidence: 70, evidence: 'Django-style cookies' },
  { name: 'Django', category: CATEGORIES.BACKEND, source: 'html', pattern: /csrfmiddlewaretoken/i, confidence: 90, evidence: 'csrfmiddlewaretoken field' },
  { name: 'Flask', category: CATEGORIES.BACKEND, source: 'header', pattern: /set-cookie\s*:.*session=.*\./i, confidence: 50, evidence: 'Flask-like session cookie' },
  { name: 'ASP.NET', category: CATEGORIES.BACKEND, source: 'header', pattern: /x-aspnet-version|x-powered-by\s*:\s*ASP\.NET|set-cookie\s*:.*ASP\.NET_SessionId/i, confidence: 95, evidence: 'ASP.NET headers/cookies' },
  { name: 'ASP.NET', category: CATEGORIES.BACKEND, source: 'html', pattern: /__VIEWSTATE|__EVENTVALIDATION/i, confidence: 95, evidence: 'ASP.NET ViewState fields' },
  { name: 'Spring Boot', category: CATEGORIES.BACKEND, source: 'header', pattern: /x-application-context|set-cookie\s*:.*JSESSIONID/i, confidence: 70, evidence: 'Java/Spring session indicators' },
  { name: 'Ruby on Rails', category: CATEGORIES.BACKEND, source: 'header', pattern: /x-powered-by\s*:.*Phusion|set-cookie\s*:.*_session_id|x-runtime\s*:/i, confidence: 75, evidence: 'Rails-style headers' },
  { name: 'Ruby on Rails', category: CATEGORIES.BACKEND, source: 'html', pattern: /name=["']csrf-token["']/i, confidence: 55, evidence: 'CSRF meta (possible Rails)' },
  { name: 'PHP', category: CATEGORIES.BACKEND, source: 'header', pattern: /x-powered-by\s*:\s*PHP\/?([\d.]+)?/i, confidence: 95, evidence: 'x-powered-by: PHP', versionGroup: 1 },
  { name: 'PHP', category: CATEGORIES.BACKEND, source: 'header', pattern: /set-cookie\s*:.*PHPSESSID/i, confidence: 90, evidence: 'PHPSESSID cookie' },
  { name: 'Node.js', category: CATEGORIES.BACKEND, source: 'header', pattern: /x-powered-by\s*:\s*(Express|Next\.js|Nuxt)/i, confidence: 80, evidence: 'Node-powered framework header' },

  // ========== CMS ==========
  { name: 'WordPress', category: CATEGORIES.CMS, source: 'html', pattern: /wp-content\/|wp-includes\/|wordpress/i, confidence: 95, evidence: 'WordPress asset paths' },
  { name: 'WordPress', category: CATEGORIES.CMS, source: 'meta', pattern: /WordPress\s*([\d.]+)?/i, confidence: 98, evidence: 'generator: WordPress', versionGroup: 1 },
  { name: 'Drupal', category: CATEGORIES.CMS, source: 'html', pattern: /Drupal\.settings|sites\/default\/files|misc\/drupal\.js/i, confidence: 92, evidence: 'Drupal markers' },
  { name: 'Drupal', category: CATEGORIES.CMS, source: 'header', pattern: /x-generator\s*:\s*Drupal\s*([\d.]+)?|x-drupal-/i, confidence: 95, evidence: 'Drupal headers', versionGroup: 1 },
  { name: 'Joomla', category: CATEGORIES.CMS, source: 'html', pattern: /\/media\/jui\/|option=com_|\/components\/com_/i, confidence: 90, evidence: 'Joomla paths' },
  { name: 'Joomla', category: CATEGORIES.CMS, source: 'meta', pattern: /Joomla[! ]*\s*-?\s*([\d.]+)?/i, confidence: 95, evidence: 'generator: Joomla', versionGroup: 1 },
  { name: 'Ghost', category: CATEGORIES.CMS, source: 'meta', pattern: /Ghost\s*([\d.]+)?/i, confidence: 95, evidence: 'generator: Ghost', versionGroup: 1 },
  { name: 'Ghost', category: CATEGORIES.CMS, source: 'html', pattern: /ghost\.org|content\/themes\//i, confidence: 75, evidence: 'Ghost theme/content paths' },
  { name: 'Shopify', category: CATEGORIES.CMS, source: 'html', pattern: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i, confidence: 95, evidence: 'Shopify CDN / theme' },
  { name: 'Shopify', category: CATEGORIES.CMS, source: 'header', pattern: /x-shopid\s*:|x-sorting-hat-/i, confidence: 95, evidence: 'Shopify headers' },
  { name: 'Magento', category: CATEGORIES.CMS, source: 'html', pattern: /Mage\.Cookies|static\/version|skin\/frontend\//i, confidence: 90, evidence: 'Magento markers' },
  { name: 'Magento', category: CATEGORIES.CMS, source: 'header', pattern: /x-magento-/i, confidence: 95, evidence: 'X-Magento headers' },
  { name: 'Wix', category: CATEGORIES.CMS, source: 'html', pattern: /static\.wixstatic\.com|X-Wix-/i, confidence: 95, evidence: 'Wix static assets' },
  { name: 'Wix', category: CATEGORIES.CMS, source: 'header', pattern: /x-wix-/i, confidence: 95, evidence: 'X-Wix headers' },
  { name: 'Squarespace', category: CATEGORIES.CMS, source: 'html', pattern: /squarespace\.com|static\.squarespace/i, confidence: 95, evidence: 'Squarespace assets' },
  { name: 'Webflow', category: CATEGORIES.CMS, source: 'html', pattern: /webflow\.|assets\.website-files\.com/i, confidence: 92, evidence: 'Webflow assets' },

  // ========== Server ==========
  { name: 'nginx', category: CATEGORIES.SERVER, source: 'header', pattern: /server\s*:\s*nginx\/?([\d.]+)?/i, confidence: 95, evidence: 'Server: nginx', versionGroup: 1 },
  { name: 'Apache', category: CATEGORIES.SERVER, source: 'header', pattern: /server\s*:\s*Apache\/?([\d.]+)?/i, confidence: 95, evidence: 'Server: Apache', versionGroup: 1 },
  { name: 'IIS', category: CATEGORIES.SERVER, source: 'header', pattern: /server\s*:\s*Microsoft-IIS\/?([\d.]+)?/i, confidence: 95, evidence: 'Server: Microsoft-IIS', versionGroup: 1 },
  { name: 'LiteSpeed', category: CATEGORIES.SERVER, source: 'header', pattern: /server\s*:\s*LiteSpeed/i, confidence: 95, evidence: 'Server: LiteSpeed' },
  { name: 'Caddy', category: CATEGORIES.SERVER, source: 'header', pattern: /server\s*:\s*Caddy/i, confidence: 95, evidence: 'Server: Caddy' },

  // ========== CDN ==========
  { name: 'Cloudflare', category: CATEGORIES.CDN, source: 'header', pattern: /cf-ray\s*:|server\s*:\s*cloudflare|cf-cache-status\s*:/i, confidence: 98, evidence: 'Cloudflare headers' },
  { name: 'CloudFront', category: CATEGORIES.CDN, source: 'header', pattern: /x-amz-cf-id\s*:|via\s*:.*cloudfront|x-cache\s*:.*cloudfront/i, confidence: 95, evidence: 'CloudFront headers' },
  { name: 'Fastly', category: CATEGORIES.CDN, source: 'header', pattern: /x-served-by\s*:.*cache-|via\s*:.*fastly|fastly-io-/i, confidence: 92, evidence: 'Fastly headers' },
  { name: 'Akamai', category: CATEGORIES.CDN, source: 'header', pattern: /x-akamai-|akamai-origin-hop|server\s*:\s*AkamaiGHost/i, confidence: 92, evidence: 'Akamai headers' },
  { name: 'BunnyCDN', category: CATEGORIES.CDN, source: 'header', pattern: /cdn-pullzone\s*:|server\s*:\s*BunnyCDN/i, confidence: 95, evidence: 'BunnyCDN headers' },
  { name: 'Google CDN', category: CATEGORIES.CDN, source: 'header', pattern: /server\s*:\s*gws|via\s*:.*google|x-google-/i, confidence: 70, evidence: 'Google CDN/proxy headers' },

  // ========== Analytics ==========
  { name: 'Google Analytics', category: CATEGORIES.ANALYTICS, source: 'script', pattern: /google-analytics\.com\/analytics\.js|gtag\/js|googletagmanager\.com\/gtag/i, confidence: 95, evidence: 'Google Analytics script' },
  { name: 'Google Analytics', category: CATEGORIES.ANALYTICS, source: 'html', pattern: /UA-\d{4,}-\d+|G-[A-Z0-9]+/i, confidence: 85, evidence: 'GA tracking ID in HTML' },
  { name: 'Google Tag Manager', category: CATEGORIES.ANALYTICS, source: 'script', pattern: /googletagmanager\.com\/gtm\.js/i, confidence: 95, evidence: 'GTM script URL' },
  { name: 'Google Tag Manager', category: CATEGORIES.ANALYTICS, source: 'html', pattern: /GTM-[A-Z0-9]+/i, confidence: 90, evidence: 'GTM container ID' },
  { name: 'Hotjar', category: CATEGORIES.ANALYTICS, source: 'script', pattern: /static\.hotjar\.com|hotjar-/i, confidence: 95, evidence: 'Hotjar script' },
  { name: 'Mixpanel', category: CATEGORIES.ANALYTICS, source: 'script', pattern: /cdn\.mxpnl\.com|mixpanel/i, confidence: 90, evidence: 'Mixpanel script' },
  { name: 'Facebook Pixel', category: CATEGORIES.ANALYTICS, source: 'script', pattern: /connect\.facebook\.net\/.*fbevents\.js/i, confidence: 95, evidence: 'Facebook Pixel script' },
  { name: 'Facebook Pixel', category: CATEGORIES.ANALYTICS, source: 'html', pattern: /fbq\s*\(\s*['"]init['"]/i, confidence: 90, evidence: 'fbq init call' },
  { name: 'Microsoft Clarity', category: CATEGORIES.ANALYTICS, source: 'script', pattern: /clarity\.ms\/tag\//i, confidence: 95, evidence: 'Clarity script URL' },

  // ========== Libraries ==========
  { name: 'jQuery', category: CATEGORIES.LIBRARY, source: 'script', pattern: /jquery[-.]([\d.]+)(?:\.min)?\.js|jquery(?:\.min)?\.js/i, confidence: 90, evidence: 'jQuery script URL', versionGroup: 1 },
  { name: 'Bootstrap', category: CATEGORIES.LIBRARY, source: 'script', pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.js/i, confidence: 88, evidence: 'Bootstrap JS URL' },
  { name: 'Bootstrap', category: CATEGORIES.LIBRARY, source: 'link', pattern: /bootstrap(?:\.min)?\.css/i, confidence: 90, evidence: 'Bootstrap CSS URL' },
  { name: 'Tailwind', category: CATEGORIES.LIBRARY, source: 'html', pattern: /tailwindcss|cdn\.tailwindcss\.com|class=["'][^"']*\b(?:sm|md|lg|xl):/i, confidence: 75, evidence: 'Tailwind markers / utility classes' },
  { name: 'Alpine.js', category: CATEGORIES.LIBRARY, source: 'html', pattern: /\bx-data=|\bx-show=|alpinejs/i, confidence: 90, evidence: 'Alpine.js directives' },
  { name: 'Alpine.js', category: CATEGORIES.LIBRARY, source: 'script', pattern: /alpine(?:\.min)?\.js|cdn\.jsdelivr\.net\/npm\/alpinejs/i, confidence: 92, evidence: 'Alpine.js script' },
  { name: 'Lodash', category: CATEGORIES.LIBRARY, source: 'script', pattern: /lodash(?:\.min)?\.js/i, confidence: 90, evidence: 'Lodash script URL' },
  { name: 'Chart.js', category: CATEGORIES.LIBRARY, source: 'script', pattern: /chart(?:\.umd)?(?:\.min)?\.js|cdn\.jsdelivr\.net\/npm\/chart\.js/i, confidence: 90, evidence: 'Chart.js script URL' },

  // ========== Hosting ==========
  { name: 'Vercel', category: CATEGORIES.HOSTING, source: 'header', pattern: /x-vercel-|server\s*:\s*Vercel/i, confidence: 98, evidence: 'Vercel headers' },
  { name: 'Netlify', category: CATEGORIES.HOSTING, source: 'header', pattern: /x-nf-|server\s*:\s*Netlify/i, confidence: 98, evidence: 'Netlify headers' },
  { name: 'Firebase Hosting', category: CATEGORIES.HOSTING, source: 'header', pattern: /x-firebase-|server\s*:.*Firebase/i, confidence: 90, evidence: 'Firebase Hosting headers' },
  { name: 'Firebase Hosting', category: CATEGORIES.HOSTING, source: 'html', pattern: /firebaseapp\.com|web\.app\//i, confidence: 70, evidence: 'Firebase hosting domain markers' },
  { name: 'Render', category: CATEGORIES.HOSTING, source: 'header', pattern: /x-render-|rndr/i, confidence: 85, evidence: 'Render headers' },
  { name: 'Railway', category: CATEGORIES.HOSTING, source: 'header', pattern: /x-railway|railway\.app/i, confidence: 85, evidence: 'Railway headers' },
  { name: 'DigitalOcean', category: CATEGORIES.HOSTING, source: 'header', pattern: /digitalocean|x-do-/i, confidence: 70, evidence: 'DigitalOcean indicators' },
  { name: 'Heroku', category: CATEGORIES.HOSTING, source: 'header', pattern: /via\s*:.*vegur|heroku/i, confidence: 85, evidence: 'Heroku routing headers' }
]

const MIN_CONFIDENCE = 55

module.exports = {
  PATTERNS,
  MIN_CONFIDENCE
}

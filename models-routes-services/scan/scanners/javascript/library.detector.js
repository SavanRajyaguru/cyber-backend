/** Compiled library fingerprints */
const LIBRARY_PATTERNS = [
  { name: 'jQuery', pattern: /jQuery\s*[:=]\s*function|jquery(?:\.min)?\.js(?:\?|#|$)|jquery(?:[-.]|@)([\d.]+)/i, versionGroup: 1 },
  { name: 'React', pattern: /react(?:\.production)?(?:\.min)?\.js|__REACT_DEVTOOLS|React\.createElement/i },
  { name: 'Angular', pattern: /@angular\/|ng-version=["']([^"']+)["']|angular(?:\.min)?\.js/i, versionGroup: 1 },
  { name: 'Vue', pattern: /Vue\.version\s*=\s*["']([^"']+)["']|vue(?:\.runtime)?(?:\.min)?\.js/i, versionGroup: 1 },
  { name: 'Bootstrap', pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.js|bootstrap(?:[-.]|@)([\d.]+)/i, versionGroup: 1 },
  { name: 'Tailwind', pattern: /tailwindcss|cdn\.tailwindcss\.com/i },
  { name: 'Lodash', pattern: /lodash(?:\.min)?\.js|_\.VERSION\s*=\s*["']([^"']+)["']/i, versionGroup: 1 },
  { name: 'Axios', pattern: /axios(?:\.min)?\.js|axios(?:[-.]|@)([\d.]+)|AxiosError/i, versionGroup: 1 },
  { name: 'Chart.js', pattern: /chart(?:\.umd)?(?:\.min)?\.js|Chart\.defaults/i },
  { name: 'Moment.js', pattern: /moment(?:\.min)?\.js|moment\.version\s*=\s*["']([^"']+)["']/i, versionGroup: 1 }
]

/**
 * Detect libraries from URL and/or content.
 * @param {string} resource
 * @param {string} content
 * @returns {import('./types').DetectedLibrary[]}
 */
const detectLibraries = (resource = '', content = '') => {
  const blob = `${resource}\n${content}`
  const found = []

  for (const rule of LIBRARY_PATTERNS) {
    const match = rule.pattern.exec(blob)
    if (!match) continue
    found.push({
      name: rule.name,
      version: rule.versionGroup && match[rule.versionGroup] ? String(match[rule.versionGroup]) : null,
      evidence: `Matched ${rule.name} fingerprint`,
      resource
    })
  }

  return found
}

/**
 * Dedupe libraries by name (prefer entry with version).
 * @param {import('./types').DetectedLibrary[]} list
 */
const mergeLibraries = (list = []) => {
  const map = new Map()
  for (const lib of list) {
    const key = lib.name.toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, lib)
    } else if (!existing.version && lib.version) {
      map.set(key, lib)
    }
  }
  return [...map.values()]
}

module.exports = {
  detectLibraries,
  mergeLibraries,
  LIBRARY_PATTERNS
}

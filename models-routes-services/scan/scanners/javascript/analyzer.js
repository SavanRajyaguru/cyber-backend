const config = require('../../../../config/config')
const {
  SEVERITY,
  FINDING_STATUS,
  DEFAULT_LARGE_BUNDLE_BYTES
} = require('./constants')
const { detectSecrets } = require('./secrets.detector')
const { detectLibraries } = require('./library.detector')

const getLargeBundleBytes = () =>
  Number(config.SCAN_JS_LARGE_BUNDLE_BYTES) || DEFAULT_LARGE_BUNDLE_BYTES

/** Security pattern checks (compiled once) */
const SECURITY_CHECKS = [
  {
    title: 'eval() detected',
    pattern: /\beval\s*\(/g,
    severity: SEVERITY.HIGH,
    description: 'eval() can execute arbitrary code and increases XSS impact.',
    recommendation: 'Replace eval() with safer alternatives (JSON.parse, explicit parsers).',
    flag: 'hasEval'
  },
  {
    title: 'new Function() detected',
    pattern: /new\s+Function\s*\(/g,
    severity: SEVERITY.HIGH,
    description: 'new Function() is similar to eval() and can execute dynamic code.',
    recommendation: 'Avoid dynamic code generation in the browser.',
    flag: 'hasEval'
  },
  {
    title: 'debugger statement detected',
    pattern: /\bdebugger\b/g,
    severity: SEVERITY.MEDIUM,
    description: 'debugger statements should not ship to production.',
    recommendation: 'Remove debugger statements from production builds.',
    flag: 'hasDebugger'
  },
  {
    title: 'console statements detected',
    pattern: /console\.(log|debug|info|warn|error|table|dir)\s*\(/g,
    severity: SEVERITY.LOW,
    description: 'Console logging may leak sensitive debugging information.',
    recommendation: 'Strip console statements from production bundles.',
    flag: null
  },
  {
    title: 'document.write() detected',
    pattern: /document\.write\s*\(/g,
    severity: SEVERITY.HIGH,
    description: 'document.write() is obsolete and can enable XSS / parser issues.',
    recommendation: 'Use DOM APIs (createElement, textContent) instead of document.write().',
    flag: 'hasDocumentWrite'
  },
  {
    title: 'innerHTML usage detected',
    pattern: /\.innerHTML\s*=/g,
    severity: SEVERITY.MEDIUM,
    description: 'Assigning to innerHTML with untrusted data can cause XSS.',
    recommendation: 'Prefer textContent or sanitized HTML rendering.',
    flag: null
  },
  {
    title: 'outerHTML usage detected',
    pattern: /\.outerHTML\s*=/g,
    severity: SEVERITY.MEDIUM,
    description: 'Assigning to outerHTML with untrusted data can cause XSS.',
    recommendation: 'Avoid outerHTML assignment with untrusted input.',
    flag: null
  },
  {
    title: 'setTimeout(string) detected',
    pattern: /setTimeout\s*\(\s*["'`]/g,
    severity: SEVERITY.HIGH,
    description: 'Passing a string to setTimeout is an implicit eval.',
    recommendation: 'Pass a function reference to setTimeout instead of a string.',
    flag: 'hasEval'
  },
  {
    title: 'setInterval(string) detected',
    pattern: /setInterval\s*\(\s*["'`]/g,
    severity: SEVERITY.HIGH,
    description: 'Passing a string to setInterval is an implicit eval.',
    recommendation: 'Pass a function reference to setInterval instead of a string.',
    flag: 'hasEval'
  },
  {
    title: 'Unsafe postMessage("*") detected',
    pattern: /\.postMessage\s*\(\s*[^,]+,\s*["']\*["']\s*\)/g,
    severity: SEVERITY.HIGH,
    description: 'postMessage with targetOrigin "*" allows any origin to receive data.',
    recommendation: 'Specify an explicit target origin for postMessage.',
    flag: 'hasUnsafePostMessage'
  },
  {
    title: 'Unsafe localStorage usage detected',
    pattern: /localStorage\.(setItem|getItem)\s*\(/g,
    severity: SEVERITY.LOW,
    description: 'Sensitive data in localStorage is readable by any XSS on the origin.',
    recommendation: 'Avoid storing secrets/tokens in localStorage; prefer httpOnly cookies.',
    flag: null
  },
  {
    title: 'Unsafe sessionStorage usage detected',
    pattern: /sessionStorage\.(setItem|getItem)\s*\(/g,
    severity: SEVERITY.LOW,
    description: 'Sensitive data in sessionStorage is readable by XSS on the origin.',
    recommendation: 'Avoid storing secrets in sessionStorage.',
    flag: null
  }
]

/**
 * Heuristic minification detection.
 * @param {string} content
 * @returns {'minified'|'beautified'|'readable'}
 */
const detectMinification = (content = '') => {
  if (!content) return 'readable'
  const lines = content.split(/\r?\n/)
  const avgLine = content.length / Math.max(lines.length, 1)
  const longLines = lines.filter((l) => l.length > 200).length
  if (avgLine > 300 || (lines.length < 20 && content.length > 5000) || longLines > lines.length * 0.3) {
    return 'minified'
  }
  if (avgLine < 80 && lines.length > 30) return 'beautified'
  return 'readable'
}

/**
 * Analyze one script's content for security issues, libraries, minification.
 * @param {{ url: string, kind: string, content: string, fileSize?: number|null, sourceMapAvailable?: boolean }} script
 */
const analyzeScriptContent = (script) => {
  const resource = script.url
  const content = script.content || ''
  const findings = []
  const flags = {
    hasEval: false,
    hasDebugger: false,
    hasDocumentWrite: false,
    hasUnsafePostMessage: false,
    hasInline: script.kind === 'inline',
    largeBundle: false,
    sourceMapAvailable: Boolean(script.sourceMapAvailable)
  }

  if (script.kind === 'inline' && content) {
    findings.push({
      title: 'Inline JavaScript',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARNING,
      description: 'Inline scripts make CSP harder and increase XSS impact surface.',
      recommendation: 'Move scripts to external files and use a strict Content-Security-Policy.',
      resource
    })
  }

  const size = typeof script.fileSize === 'number' ? script.fileSize : Buffer.byteLength(content, 'utf8')
  if (size > getLargeBundleBytes()) {
    flags.largeBundle = true
    findings.push({
      title: 'Large JavaScript bundle',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARNING,
      description: `Script size is ${Math.round(size / 1024)} KB (threshold ${Math.round(getLargeBundleBytes() / 1024)} KB).`,
      recommendation: 'Code-split and tree-shake production bundles.',
      resource
    })
  }

  if (flags.sourceMapAvailable) {
    findings.push({
      title: 'Source map exposed',
      severity: SEVERITY.MEDIUM,
      status: FINDING_STATUS.WARNING,
      description: 'A .map source map appears publicly accessible.',
      recommendation: 'Do not deploy source maps to public production origins.',
      resource: resource.endsWith('.map') ? resource : `${resource}.map`
    })
  }

  for (const check of SECURITY_CHECKS) {
    check.pattern.lastIndex = 0
    if (check.pattern.test(content)) {
      if (check.flag) flags[check.flag] = true
      findings.push({
        title: check.title,
        severity: check.severity,
        status: check.severity === SEVERITY.HIGH ? FINDING_STATUS.FAIL : FINDING_STATUS.WARNING,
        description: check.description,
        recommendation: check.recommendation,
        resource
      })
    }
  }

  const secretFindings = detectSecrets(content, resource)
  findings.push(...secretFindings)

  const libraries = detectLibraries(resource, content)
  const minification = detectMinification(content)

  return { findings, libraries, flags, minification }
}

module.exports = {
  analyzeScriptContent,
  detectMinification,
  SECURITY_CHECKS
}

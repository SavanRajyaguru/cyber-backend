const config = require('../../../../config/config')
const { normalizeAndValidateUrl } = require('../../engine/validation.service')
const { MODULE_STATUS } = require('../../constants')
const { ERROR_CODES, DEFAULT_CONCURRENCY } = require('./constants')
const { fetchHomepage, fetchScript, checkSourceMap, mapHttpError, mapPool } = require('./http.client')
const { extractScripts } = require('./script.extractor')
const { analyzeScriptContent } = require('./analyzer')
const { mergeLibraries } = require('./library.detector')
const { calculateJavascriptScore } = require('./scoring')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[javascript-scanner] ${message}${suffix}`)
}

const getConcurrency = () =>
  Number(config.SCAN_JS_CONCURRENCY) || DEFAULT_CONCURRENCY

const hasSourceMappingUrl = (content = '') =>
  /\/\/[#@]\s*sourceMappingURL=\s*\S+/i.test(content) ||
  /\/\*[#@]\s*sourceMappingURL=\s*\S+\s*\*\//i.test(content)

/**
 * Orchestrate JS security scan.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('./types').JavascriptScanResult>}
 */
const runJavascriptScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  log('Request Started', { url: validated.sUrl })

  let homepage
  try {
    homepage = await fetchHomepage(validated.sUrl)
    log('Response Received', {
      statusCode: homepage.statusCode,
      finalUrl: homepage.finalUrl
    })
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : mapped.code
    err.errorCode = mapped.code
    throw err
  }

  const extracted = extractScripts(homepage.html, homepage.finalUrl)
  log('Scripts Extracted', {
    total: extracted.scripts.length,
    external: extracted.externalCount,
    inline: extracted.inlineCount
  })

  const concurrency = getConcurrency()
  const toFetch = extracted.scripts.filter((s) => s.kind !== 'inline')

  const fetched = await mapPool(toFetch, concurrency, async (script) => {
    const result = await fetchScript(script.url)
    let sourceMapAvailable = false
    if (result.ok && result.body) {
      sourceMapAvailable = hasSourceMappingUrl(result.body)
      if (!sourceMapAvailable) {
        sourceMapAvailable = await checkSourceMap(`${script.url}.map`)
      }
    }
    return { script, result, sourceMapAvailable }
  })

  const fetchByUrl = new Map(fetched.map((f) => [f.script.url, f]))

  const scriptsOut = []
  const allFindings = []
  const allLibraries = []
  const flagsList = []

  for (const item of extracted.scripts) {
    if (item.kind === 'inline') {
      const analysis = analyzeScriptContent({
        url: item.url,
        kind: 'inline',
        content: item.inlineContent || '',
        fileSize: Buffer.byteLength(item.inlineContent || '', 'utf8'),
        sourceMapAvailable: false
      })

      scriptsOut.push({
        url: item.url,
        kind: 'inline',
        isModule: item.isModule,
        contentType: 'text/javascript',
        fileSize: Buffer.byteLength(item.inlineContent || '', 'utf8'),
        statusCode: null,
        loadTime: null,
        minification: analysis.minification,
        sourceMapAvailable: false,
        error: null
      })
      allFindings.push(...analysis.findings)
      allLibraries.push(...analysis.libraries)
      flagsList.push(analysis.flags)
      continue
    }

    const fetchedItem = fetchByUrl.get(item.url)
    const result = fetchedItem?.result
    const sourceMapAvailable = Boolean(fetchedItem?.sourceMapAvailable)

    if (!result || !result.ok) {
      scriptsOut.push({
        url: item.url,
        kind: item.kind,
        isModule: item.isModule,
        contentType: result?.contentType || null,
        fileSize: result?.fileSize ?? null,
        statusCode: result?.statusCode ?? null,
        loadTime: result?.loadTime ?? null,
        minification: null,
        sourceMapAvailable: false,
        error: result?.error || 'Failed to download script'
      })
      allFindings.push({
        title: 'JavaScript resource unavailable',
        severity: 'Medium',
        status: 'Warning',
        description: result?.error || `Could not fetch script (HTTP ${result?.statusCode || 'n/a'}).`,
        recommendation: 'Ensure production assets are reachable and not blocked.',
        resource: item.url
      })
      flagsList.push({})
      continue
    }

    // Non-2xx still analyze body if present
    const analysis = analyzeScriptContent({
      url: item.url,
      kind: item.kind,
      content: result.body || '',
      fileSize: result.fileSize,
      sourceMapAvailable
    })

    if (result.statusCode === 404) {
      allFindings.push({
        title: 'JavaScript 404',
        severity: 'Medium',
        status: 'Warning',
        description: 'Script URL returned HTTP 404.',
        recommendation: 'Remove dead script references from the homepage.',
        resource: item.url
      })
    }

    scriptsOut.push({
      url: item.url,
      kind: item.kind,
      isModule: item.isModule,
      contentType: result.contentType,
      fileSize: result.fileSize,
      statusCode: result.statusCode,
      loadTime: result.loadTime,
      minification: analysis.minification,
      sourceMapAvailable,
      error: null
    })
    allFindings.push(...analysis.findings)
    allLibraries.push(...analysis.libraries)
    flagsList.push(analysis.flags)
  }

  const libraries = mergeLibraries(allLibraries)
  const { score, grade, risk } = calculateJavascriptScore({
    flagsList,
    findings: allFindings
  })

  const recommendations = [
    ...new Set(
      allFindings
        .filter((f) => f.status === 'Fail' || f.status === 'Warning')
        .map((f) => f.recommendation)
        .filter(Boolean)
    )
  ]

  log('Analysis Completed', {
    scripts: scriptsOut.length,
    findings: allFindings.length,
    score,
    grade
  })

  const result = {
    module: 'javascript',
    sModule: 'javascript',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    scripts: scriptsOut,
    libraries,
    findings: allFindings,
    recommendations,
    oMeta: {
      bStub: false,
      finalUrl: homepage.finalUrl,
      scriptsAnalyzed: scriptsOut.length,
      concurrency
    }
  }

  log('Worker Finished', { score, scripts: scriptsOut.length })
  return result
}

module.exports = {
  runJavascriptScan
}

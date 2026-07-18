const { normalizeAndValidateUrl } = require('../../../engine/validation.service')
const { MODULE_STATUS } = require('../../../constants')
const { ERROR_CODES } = require('../constants')
const { fetchHomepageTimed, mapHttpError } = require('./timing.service')
const {
  extractResources,
  probeResources,
  summarizeByType
} = require('./resource.service')
const {
  calculatePerformanceScore,
  buildRecommendations
} = require('./scoring.service')
const {
  analyzeTiming,
  analyzeResources,
  analyzeCompression,
  analyzeImages,
  analyzeFonts,
  analyzeCache,
  analyzeOptimization
} = require('../analyzers')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[performance-scanner] ${message}${suffix}`)
}

/**
 * Passive homepage performance scan.
 * @param {{ sUrl: string }} params
 * @returns {Promise<import('../types').PerfScanResult>}
 */
const runPerformanceScan = async ({ sUrl }) => {
  log('Scan Started', { sUrl })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  log('Request Started', { url: validated.sUrl })

  let page
  try {
    page = await fetchHomepageTimed(validated.sUrl)
    log('Response Received', {
      statusCode: page.statusCode,
      finalUrl: page.finalUrl,
      totalMs: page.timings?.totalMs,
      ttfbMs: page.timings?.ttfbMs,
      responseSize: page.responseSize,
      encoding: page.timings?.contentEncoding
    })
  } catch (error) {
    const mapped = mapHttpError(error)
    const err = new Error(mapped.message)
    err.code = mapped.code === ERROR_CODES.TIMEOUT ? 'SCAN_TIMEOUT' : mapped.code
    err.errorCode = mapped.code
    throw err
  }

  const findings = []

  if (page.truncated) {
    findings.push({
      title: 'Large HTML truncated',
      severity: 'Low',
      status: 'Warn',
      description: 'Homepage HTML exceeded the configured size limit during capture.',
      recommendation: 'Reduce homepage HTML size for more accurate analysis.'
    })
  }

  // Timing analysis (no extra network)
  const timingResult = analyzeTiming(page.timings, page.statusCode)
  findings.push(...timingResult.findings)

  // Parse HTML once; extract resources
  let extracted
  try {
    extracted = extractResources(page.html, page.finalUrl)
  } catch (error) {
    log('HTML parse soft-failed', { message: error?.message })
    extracted = {
      resources: [],
      totalDiscovered: 0,
      capped: false,
      domElements: 0,
      $: null
    }
    findings.push({
      title: 'Invalid HTML',
      severity: 'Medium',
      status: 'Warn',
      description: 'Homepage HTML could not be fully parsed; resource analysis is limited.',
      recommendation: 'Fix malformed HTML on the homepage.'
    })
  }

  // Concurrent resource probes (max 100, deduped)
  let probed = []
  try {
    probed = await probeResources(extracted.resources)
    log('Resources Probed', {
      discovered: extracted.totalDiscovered,
      probed: probed.length
    })
  } catch (error) {
    log('Resource probe soft-failed', { message: error?.message })
    probed = []
  }

  const byType = summarizeByType(probed)

  const resourceResult = analyzeResources(
    byType,
    {
      totalDiscovered: extracted.totalDiscovered,
      capped: extracted.capped,
      domElements: extracted.domElements
    },
    probed
  )
  findings.push(...resourceResult.findings)

  const compressionResult = analyzeCompression(page.headers, page.timings, probed)
  findings.push(...compressionResult.findings)

  const cacheResult = analyzeCache(page.headers, probed)
  findings.push(...cacheResult.findings)

  const imageResult = analyzeImages(probed, extracted.$)
  findings.push(...imageResult.findings)

  const fontResult = analyzeFonts(probed, extracted.$)
  findings.push(...fontResult.findings)

  const optimizationResult = analyzeOptimization({
    probed,
    $: extracted.$,
    compression: compressionResult.compression,
    cache: cacheResult.cache,
    images: imageResult.images,
    resources: resourceResult.resources
  })
  findings.push(...optimizationResult.findings)

  const { score, grade, risk, breakdown } = calculatePerformanceScore({
    responseTime: timingResult.scoreRatio,
    compression: compressionResult.scoreRatio,
    caching: cacheResult.scoreRatio,
    assets: resourceResult.assetsScoreRatio,
    images: imageResult.scoreRatio,
    cssJs: resourceResult.cssJsScoreRatio
  })

  const recommendations = buildRecommendations(findings)

  log('Analysis Completed', { score, grade, risk, findings: findings.length })

  const result = {
    module: 'performance',
    sModule: 'performance',
    eStatus: MODULE_STATUS.COMPLETED,
    score,
    nScore: score,
    grade,
    risk,
    timings: timingResult.timings,
    resources: resourceResult.resources,
    compression: compressionResult.compression,
    cache: cacheResult.cache,
    images: imageResult.images,
    fonts: fontResult.fonts,
    optimization: optimizationResult.optimization,
    findings,
    recommendations,
    oMeta: {
      bStub: false,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      redirectCount: page.redirectChain?.length || 0,
      scoreBreakdown: breakdown,
      resourcesProbed: probed.length,
      resourcesDiscovered: extracted.totalDiscovered
    }
  }

  log('Worker Finished', { score, findings: findings.length })
  return result
}

module.exports = {
  runPerformanceScan
}

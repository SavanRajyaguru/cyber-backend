const { normalizeAndValidateUrl } = require('../../../engine/validation.service')
const { MODULE_STATUS } = require('../../../constants')
const { ERROR_CODES, SOURCE_MODULES } = require('../constants')
const { getSiblingResults } = require('../../../engine/siblingResults.service')
const { normalizeFindings } = require('../engine/normalizer')
const { mapToFrameworks } = require('./mapping.service')
const { calculateComplianceScore } = require('./scoring.service')
const { listFrameworks } = require('../frameworks')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[compliance-scanner] ${message}${suffix}`)
}

/**
 * Compliance mapping engine — no network I/O; maps sibling ScanContext outputs.
 * @param {{ sUrl: string, scanId?: string|null }} params
 * @returns {Promise<import('../types').ComplianceScanResult>}
 */
const runComplianceScan = async ({ sUrl, scanId = null }) => {
  log('Scan Started', { sUrl, scanId })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  let collected
  try {
    collected = await getSiblingResults(scanId, SOURCE_MODULES)
    log('Sources Collected', { available: collected.available })
  } catch (error) {
    log('Sibling results read failed', { message: error?.message })
    collected = {
      sources: {},
      statuses: {},
      waitedMs: 0,
      available: []
    }
  }

  const sources = collected.sources || {}

  let findings = []
  try {
    findings = normalizeFindings(sources)
  } catch (error) {
    log('Normalize soft-failed', { message: error?.message })
    findings = []
  }

  log('Findings Normalized', { count: findings.length })

  let frameworks = []
  let mapStats = {}
  try {
    const mapped = mapToFrameworks({ sources, findings })
    frameworks = mapped.frameworks
    mapStats = mapped.stats
  } catch (error) {
    log('Mapping soft-failed', { message: error?.message })
    frameworks = listFrameworks().map((name) => ({
      framework: name,
      score: 100,
      passed: 0,
      failed: 0,
      notApplicable: 0,
      controls: []
    }))
  }

  const scored = calculateComplianceScore(frameworks)

  log('Analysis Completed', {
    score: scored.score,
    grade: scored.grade,
    risk: scored.risk,
    frameworks: frameworks.length,
    failed: scored.summary.totalFailed
  })

  const result = {
    module: 'compliance',
    sModule: 'compliance',
    eStatus: MODULE_STATUS.COMPLETED,
    score: scored.score,
    nScore: scored.score,
    grade: scored.grade,
    risk: scored.risk,
    frameworks,
    summary: {
      ...scored.summary,
      normalizedFindings: findings.length,
      sourcesAvailable: collected.available,
      sourcesMissing: Object.entries(collected.statuses || {})
        .filter(([, st]) => st !== 'completed')
        .map(([m]) => m),
      partialData: collected.available.length < 10,
      frameworksEvaluated: listFrameworks()
    },
    recommendations: scored.recommendations,
    oMeta: {
      bStub: false,
      scanId,
      waitedMs: collected.waitedMs,
      sourceStatuses: collected.statuses,
      ruleEngine: mapStats,
      normalizedFindingSample: findings.slice(0, 5).map((f) => ({
        id: f.id,
        module: f.module,
        title: f.title,
        severity: f.severity
      }))
    }
  }

  log('Worker Finished', { score: result.score, grade: result.grade })
  return result
}

module.exports = {
  runComplianceScan
}

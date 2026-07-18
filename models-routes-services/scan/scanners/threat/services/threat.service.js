const { normalizeAndValidateUrl } = require('../../../engine/validation.service')
const { MODULE_STATUS } = require('../../../constants')
const { ERROR_CODES } = require('../constants')
const { collectSiblingResults } = require('./context.collector')
const { runRuleEngine } = require('./rule-engine.service')
const { calculateThreatRisk } = require('./risk-engine.service')
const { runProviders, listProviders } = require('./provider.service')

const log = (message, meta = {}) => {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[threat-scanner] ${message}${suffix}`)
}

/**
 * Deduplicate findings by title+category+affectedModule.
 * @param {import('../types').ThreatFinding[]} findings
 */
const dedupeFindings = (findings = []) => {
  const seen = new Set()
  const out = []
  for (const f of findings) {
    const key = `${f.affectedModule}|${f.category}|${f.title}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

/**
 * Passive threat intelligence correlation over sibling scanner outputs.
 * @param {{ sUrl: string, scanId?: string|null }} params
 * @returns {Promise<import('../types').ThreatScanResult>}
 */
const runThreatScan = async ({ sUrl, scanId = null }) => {
  log('Scan Started', { sUrl, scanId })

  const validated = normalizeAndValidateUrl(sUrl)
  if (!validated.ok) {
    const error = new Error(validated.sError || 'Invalid URL')
    error.code = ERROR_CODES.INVALID_URL
    throw error
  }

  let hostname = null
  try {
    hostname = new URL(validated.sUrl).hostname.toLowerCase()
  } catch (_) {
    hostname = null
  }

  let collected
  try {
    collected = await collectSiblingResults(scanId)
    log('Sources Collected', {
      available: collected.available,
      waitedMs: collected.waitedMs,
      statuses: collected.statuses
    })
  } catch (error) {
    log('Context collect soft-failed', { message: error?.message })
    collected = {
      sources: {},
      statuses: {},
      waitedMs: 0,
      available: []
    }
  }

  const sources = collected.sources || {}

  // Rule engine correlation (no network)
  const { findings: ruleFindings, ruleStats } = runRuleEngine(sources)

  // Optional enrichment providers (LocalProvider = no external calls)
  const ipv4 = sources.dns?.records?.A ||
    sources.infrastructure?.network?.ipv4 ||
    []

  let providerResults = []
  try {
    providerResults = await runProviders({
      sUrl: validated.sUrl,
      hostname,
      ipv4: Array.isArray(ipv4) ? ipv4 : [],
      sources
    })
  } catch (error) {
    log('Providers soft-failed', { message: error?.message })
    providerResults = []
  }

  const providerFindings = providerResults.flatMap((p) => p.findings || [])
  const findings = dedupeFindings([...ruleFindings, ...providerFindings])

  const assessed = calculateThreatRisk(findings)

  log('Analysis Completed', {
    findings: findings.length,
    threatScore: assessed.threatScore,
    score: assessed.score,
    grade: assessed.grade,
    risk: assessed.risk
  })

  const result = {
    module: 'threat',
    sModule: 'threat',
    eStatus: MODULE_STATUS.COMPLETED,
    score: assessed.score,
    nScore: assessed.score,
    grade: assessed.grade,
    risk: assessed.risk,
    summary: {
      ...assessed.summary,
      sourcesAvailable: collected.available,
      sourcesMissing: Object.entries(collected.statuses || {})
        .filter(([, st]) => st !== 'completed')
        .map(([m]) => m),
      providers: listProviders(),
      partialData: collected.available.length < 9
    },
    findings,
    categories: assessed.categories,
    recommendations: assessed.recommendations,
    oMeta: {
      bStub: false,
      scanId,
      waitedMs: collected.waitedMs,
      sourceStatuses: collected.statuses,
      ruleStats,
      providerResults: providerResults.map((p) => ({
        provider: p.provider,
        findings: (p.findings || []).length,
        meta: p.meta || null
      })),
      threatScore: assessed.threatScore,
      maxSeverity: assessed.maxSeverity
    }
  }

  log('Worker Finished', {
    score: result.score,
    threatScore: assessed.threatScore,
    findings: findings.length
  })
  return result
}

module.exports = {
  runThreatScan
}

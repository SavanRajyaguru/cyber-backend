const ScanModuleResultModel = require('../models/scanModuleResult.model')
const { MODULE_STATUS } = require('../constants')

/**
 * Reads already-persisted sibling module results directly from MongoDB.
 * Used by the phase-2 scanners (infrastructure, threat, compliance) — by
 * construction they only run after phase 1 has fully settled, so this is a
 * single query, never a wait/poll loop.
 *
 * @param {string|null} scanId
 * @param {string[]} aModules - which sibling modules to read
 * @returns {Promise<{
 *   sources: Record<string, Object|null>,
 *   statuses: Record<string, string|null>,
 *   waitedMs: number,
 *   available: string[]
 * }>}
 */
const getSiblingResults = async (scanId, aModules) => {
  const sources = {}
  const statuses = {}
  for (const m of aModules) {
    sources[m] = null
    statuses[m] = null
  }

  if (!scanId) {
    return { sources, statuses, waitedMs: 0, available: [] }
  }

  const moduleDocs = await ScanModuleResultModel.find({
    scanId,
    sModule: { $in: aModules }
  }).lean()

  for (const doc of moduleDocs) {
    statuses[doc.sModule] = doc.eStatus
    if (doc.eStatus === MODULE_STATUS.COMPLETED && doc.oResult) {
      sources[doc.sModule] = doc.oResult
    }
  }

  const available = aModules.filter((m) => Boolean(sources[m]))
  return { sources, statuses, waitedMs: 0, available }
}

module.exports = { getSiblingResults }

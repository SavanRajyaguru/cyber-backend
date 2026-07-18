const config = require('../../../../../config/config')
const runtimeService = require('../../../engine/runtime.service')
const { MODULE_STATUS } = require('../../../constants')
const {
  SOURCE_MODULES,
  DEFAULT_WAIT_MS,
  DEFAULT_POLL_MS
} = require('../constants')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isTerminal = (status) =>
  status === MODULE_STATUS.COMPLETED ||
  status === MODULE_STATUS.FAILED ||
  status === MODULE_STATUS.TIMEOUT

/**
 * Wait until sibling source modules finish (or timeout), then collect oResults.
 * Modules run in parallel — infrastructure may start before sources complete.
 *
 * @param {string|null} scanId
 * @param {{ waitMs?: number, pollMs?: number }} [opts]
 * @returns {Promise<{
 *   sources: Record<string, Object|null>,
 *   statuses: Record<string, string|null>,
 *   waitedMs: number,
 *   available: string[]
 * }>}
 */
const collectSiblingResults = async (scanId, opts = {}) => {
  const waitMs = Number(opts.waitMs) ||
    Number(config.SCAN_INFRA_WAIT_MS) ||
    DEFAULT_WAIT_MS
  const pollMs = Number(opts.pollMs) || DEFAULT_POLL_MS
  const started = Date.now()

  /** @type {Record<string, Object|null>} */
  const sources = {}
  /** @type {Record<string, string|null>} */
  const statuses = {}

  for (const m of SOURCE_MODULES) {
    sources[m] = null
    statuses[m] = null
  }

  if (!scanId) {
    return { sources, statuses, waitedMs: 0, available: [] }
  }

  while (Date.now() - started < waitMs) {
    const context = runtimeService.getScanContext(scanId)
    if (!context?.oModules) break

    let allDone = true
    for (const m of SOURCE_MODULES) {
      const slot = context.oModules[m]
      statuses[m] = slot?.eStatus || null
      if (slot?.eStatus === MODULE_STATUS.COMPLETED && slot.oResult) {
        sources[m] = slot.oResult
      } else if (!isTerminal(slot?.eStatus)) {
        allDone = false
      }
    }

    if (allDone) break
    await sleep(pollMs)
  }

  // Final snapshot
  const context = runtimeService.getScanContext(scanId)
  if (context?.oModules) {
    for (const m of SOURCE_MODULES) {
      const slot = context.oModules[m]
      statuses[m] = slot?.eStatus || statuses[m]
      if (slot?.eStatus === MODULE_STATUS.COMPLETED && slot.oResult) {
        sources[m] = slot.oResult
      }
    }
  }

  const available = SOURCE_MODULES.filter((m) => Boolean(sources[m]))
  return {
    sources,
    statuses,
    waitedMs: Date.now() - started,
    available
  }
}

module.exports = {
  collectSiblingResults,
  SOURCE_MODULES
}

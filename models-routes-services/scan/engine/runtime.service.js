const crypto = require('crypto')
const runtimeStore = require('../context/runtimeStore')
const { SCAN_MODULES, SCAN_STATUS, MODULE_STATUS } = require('../constants')

const buildEmptyModules = () => {
  const oModules = {}
  for (const sModule of SCAN_MODULES) {
    oModules[sModule] = {
      eStatus: MODULE_STATUS.PENDING,
      oResult: null,
      sError: null,
      nScore: null,
      dFinishedAt: null
    }
  }
  return oModules
}

const createScanContext = ({ sUrl, iUserId = null }) => {
  const scanId = crypto.randomUUID()
  const context = {
    scanId,
    sUrl,
    iUserId: iUserId ? String(iUserId) : null,
    eStatus: SCAN_STATUS.QUEUED,
    dCreatedAt: new Date(),
    dFinishedAt: null,
    nProgress: 0,
    oModules: buildEmptyModules(),
    oResults: {},
    oScores: { modules: {}, nOverall: null },
    aErrors: []
  }
  return runtimeStore.set(scanId, context)
}

const getScanContext = (scanId) => runtimeStore.get(scanId)

const markRunning = (scanId) => {
  return runtimeStore.update(scanId, (ctx) => {
    if (ctx.eStatus === SCAN_STATUS.QUEUED) {
      ctx.eStatus = SCAN_STATUS.RUNNING
    }
    return ctx
  })
}

const markModuleRunning = (scanId, sModule) => {
  return runtimeStore.update(scanId, (ctx) => {
    if (!ctx.oModules[sModule]) return ctx
    ctx.oModules[sModule].eStatus = MODULE_STATUS.RUNNING
    if (ctx.eStatus === SCAN_STATUS.QUEUED) {
      ctx.eStatus = SCAN_STATUS.RUNNING
    }
    return ctx
  })
}

const completeModule = (scanId, sModule, { eStatus, oResult = null, sError = null, nScore = null }) => {
  return runtimeStore.update(scanId, (ctx) => {
    if (!ctx.oModules[sModule]) return ctx

    ctx.oModules[sModule] = {
      eStatus,
      oResult,
      sError,
      nScore: typeof nScore === 'number' ? nScore : null,
      dFinishedAt: new Date()
    }

    const finished = Object.values(ctx.oModules).filter((m) =>
      m.eStatus === MODULE_STATUS.COMPLETED ||
      m.eStatus === MODULE_STATUS.FAILED ||
      m.eStatus === MODULE_STATUS.TIMEOUT
    ).length

    const total = SCAN_MODULES.length
    // Leave headroom for parent merge to set 100
    ctx.nProgress = Math.min(99, Math.floor((finished / total) * 100))
    if (ctx.eStatus === SCAN_STATUS.QUEUED) {
      ctx.eStatus = SCAN_STATUS.RUNNING
    }
    return ctx
  })
}

const saveContext = (context) => runtimeStore.set(context.scanId, context)

/**
 * Mark scan failed when background enqueue to Redis/BullMQ fails.
 * @param {string} scanId
 * @param {string} sError
 */
const markEnqueueFailed = (scanId, sError) => {
  return runtimeStore.update(scanId, (ctx) => {
    ctx.eStatus = SCAN_STATUS.FAILED
    ctx.nProgress = 100
    ctx.dFinishedAt = new Date()
    ctx.aErrors = [
      ...(ctx.aErrors || []),
      { sMessage: sError || 'Failed to enqueue scan jobs', sCode: 'ENQUEUE_FAILED' }
    ]
    return ctx
  })
}

module.exports = {
  createScanContext,
  getScanContext,
  markRunning,
  markModuleRunning,
  completeModule,
  markEnqueueFailed,
  saveContext,
  buildEmptyModules
}

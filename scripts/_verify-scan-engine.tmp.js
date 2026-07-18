// Temporary one-off verification script — deleted after use.
require('dotenv').config()

const mongoose = require('mongoose')
const runtimeService = require('../models-routes-services/scan/engine/runtime.service')
const { enqueueScanFlowAsync } = require('../models-routes-services/scan/queue/queue.service')
const SiteModel = require('../models-routes-services/scan/models/site.model')
const ScanModuleResultModel = require('../models-routes-services/scan/models/scanModuleResult.model')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

;(async () => {
  const iUserId = new mongoose.Types.ObjectId()
  const sUrl = process.argv[2] || 'https://bucketx.in'

  const sDomain = new URL(sUrl).hostname.toLowerCase()
  const site = await SiteModel.findOneAndUpdate(
    { iUserId, sDomain },
    { $inc: { nTotalScans: 1 }, $setOnInsert: { dFirstScannedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  console.log('site upserted', { siteId: site._id.toString(), nTotalScans: site.nTotalScans })

  const context = await runtimeService.createScanContext({ sUrl, iUserId, iSiteId: site._id })
  console.log('scan created', context)

  enqueueScanFlowAsync({ scanId: context.scanId, sUrl: context.sUrl })

  const deadline = Date.now() + 120000
  let ctx
  do {
    await sleep(3000)
    ctx = await runtimeService.getScanContext(context.scanId)
    console.log('poll', { eStatus: ctx.eStatus, nProgress: ctx.nProgress })
  } while (ctx.eStatus !== 'completed' && ctx.eStatus !== 'partial' && ctx.eStatus !== 'failed' && Date.now() < deadline)

  const moduleDocs = await ScanModuleResultModel.find({ scanId: context.scanId }).lean()
  console.log('\n=== MODULE RESULTS ===')
  for (const doc of moduleDocs) {
    console.log(`  ${doc.sModule.padEnd(15)} ${doc.eStatus.padEnd(10)} nAttempts=${doc.nAttempts} nScore=${doc.nScore} ${doc.sError ? 'error=' + doc.sError : ''}`)
  }

  const scanDoc = await mongoose.connection.db.collection('scans').findOne({ scanId: context.scanId })
  console.log('\n=== FINAL SCAN DOC ===')
  console.log(JSON.stringify(scanDoc, null, 2))

  console.log('\n=== FULL MODULE DETAIL (JSON) ===')
  console.log(JSON.stringify(moduleDocs, null, 2))

  const siteAfter = await SiteModel.findById(site._id).lean()
  console.log('\n=== SITE AFTER FINALIZE ===')
  console.log(siteAfter)

  console.log('\nSCAN_ID_FOR_LOOKUP:', context.scanId)

  process.exit(0)
})().catch((error) => {
  console.error('VERIFICATION FAILED', error)
  process.exit(1)
})

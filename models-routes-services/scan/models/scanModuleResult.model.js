const mongoose = require('mongoose')
const { DBConnect } = require('../../../database/mongoose')
const { SCAN_MODULES, MODULE_STATUS } = require('../constants')
const Schema = mongoose.Schema

const ScanModuleResult = new Schema({
  scanId: { type: String, required: true },
  iScanId: { type: Schema.Types.ObjectId, ref: 'scans', required: true },
  sModule: { type: String, enum: SCAN_MODULES, required: true },
  eStatus: { type: String, enum: Object.values(MODULE_STATUS), default: MODULE_STATUS.PENDING },
  oResult: { type: Schema.Types.Mixed, default: null },
  nScore: { type: Number, default: null },
  sError: { type: String, default: null },
  nAttempts: { type: Number, default: 0 },
  dStartedAt: { type: Date, default: null },
  dFinishedAt: { type: Date, default: null }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

ScanModuleResult.index({ scanId: 1, sModule: 1 }, { unique: true })

const ScanModuleResultModel = DBConnect.model('scan_module_results', ScanModuleResult)

module.exports = ScanModuleResultModel

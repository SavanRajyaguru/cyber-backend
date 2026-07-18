const mongoose = require('mongoose')
const { DBConnect } = require('../../../database/mongoose')
const { SCAN_STATUS } = require('../constants')
const Schema = mongoose.Schema

const Scan = new Schema({
  scanId: { type: String, required: true, unique: true, index: true },
  sUrl: { type: String, required: true, trim: true },
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  iSiteId: { type: Schema.Types.ObjectId, ref: 'sites', default: null },
  eStatus: { type: String, enum: Object.values(SCAN_STATUS), default: SCAN_STATUS.QUEUED },
  nProgress: { type: Number, default: 0 },
  oScores: {
    modules: { type: Schema.Types.Mixed, default: {} },
    nOverall: { type: Number, default: null }
  },
  aErrors: { type: [{ sModule: String, sMessage: String }], default: [] },
  dFinishedAt: { type: Date, default: null }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Scan.index({ iUserId: 1, dCreatedAt: -1 })

const ScanModel = DBConnect.model('scans', Scan)

module.exports = ScanModel

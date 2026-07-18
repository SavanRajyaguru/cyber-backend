const mongoose = require('mongoose')
const { DBConnect } = require('../../../database/mongoose')
const Schema = mongoose.Schema

const Site = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  sDomain: { type: String, required: true, trim: true, lowercase: true },
  iLastScanId: { type: Schema.Types.ObjectId, ref: 'scans', default: null },
  nLastOverallScore: { type: Number, default: null },
  nTotalScans: { type: Number, default: 0 },
  dFirstScannedAt: { type: Date, default: null },
  dLastScannedAt: { type: Date, default: null }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Site.index({ iUserId: 1, sDomain: 1 }, { unique: true })

const SiteModel = DBConnect.model('sites', Site)

module.exports = SiteModel

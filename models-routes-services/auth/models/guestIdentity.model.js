const mongoose = require('mongoose')
const { DBConnect } = require('../../../database/mongoose')
const Schema = mongoose.Schema

const GuestIdentity = new Schema({
  sIp: { type: String, required: true, unique: true },
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
  dExpiresAt: { type: Date, required: true }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

GuestIdentity.index({ dExpiresAt: 1 }, { expireAfterSeconds: 0 })

const GuestIdentityModel = DBConnect.model('guest_identities', GuestIdentity)

module.exports = GuestIdentityModel

const mongoose = require('mongoose')
const { DBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema

const RefreshToken = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
  sTokenHash: { type: String, required: true },
  dExpiresAt: { type: Date, required: true }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

RefreshToken.index({ dExpiresAt: 1 }, { expireAfterSeconds: 0 })

const RefreshTokenModel = DBConnect.model('refresh_tokens', RefreshToken)

module.exports = RefreshTokenModel

const mongoose = require('mongoose')
const { DBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema

const Otp = new Schema({
  sEmail: { type: String, required: true, trim: true, lowercase: true, unique: true },
  sOtpHash: { type: String, required: true },
  dExpiresAt: { type: Date, required: true },
  nAttempts: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

// Auto-remove expired OTP documents
Otp.index({ dExpiresAt: 1 }, { expireAfterSeconds: 0 })

const OtpModel = DBConnect.model('otps', Otp)

module.exports = OtpModel

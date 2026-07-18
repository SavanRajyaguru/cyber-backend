const mongoose = require('mongoose')
const { DBConnect } = require('../../database/mongoose')
const { eStatus, eRole, eAuthProvider } = require('../../data')
const Schema = mongoose.Schema

const User = new Schema({
  sEmail: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  sName: { type: String, trim: true },
  sProfilePic: { type: String, trim: true, default: null },
  eRole: { type: String, enum: eRole.value, default: eRole.map.USER },
  eAuthProvider: { type: String, enum: eAuthProvider.value, default: eAuthProvider.map.EMAIL },
  // Omit when unset — sparse unique ignores missing fields, not explicit null
  sGoogleId: { type: String, trim: true, sparse: true, unique: true },
  eStatus: { type: String, enum: eStatus.value, default: eStatus.map.ACTIVE },
  dLastLogin: { type: Date, default: null }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

User.index({ eRole: 1, eStatus: 1 })

const UserModel = DBConnect.model('users', User)

module.exports = UserModel

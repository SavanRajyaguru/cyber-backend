const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const config = require('../config/config')

const SALT_ROUNDS = 10

const hashValue = async (value) => {
  return bcrypt.hash(value, SALT_ROUNDS)
}

const compareHash = async (value, hash) => {
  return bcrypt.compare(value, hash)
}

const generateOtp = (length = Number(config.OTP_LENGTH) || 6) => {
  const max = 10 ** length
  const min = 10 ** (length - 1)
  return String(crypto.randomInt(min, max))
}

const signAccessToken = (payload, expiresIn = config.JWT_VALIDITY) => {
  return jwt.sign(payload, config.JWT_SECRET_USER, { expiresIn })
}

const signRefreshToken = (payload, expiresIn = config.REFRESH_TOKEN_VALIDITY) => {
  return jwt.sign(payload, config.REFRESH_TOKEN_SECRET, { expiresIn })
}

const signGuestToken = (payload, expiresIn = config.GUEST_TOKEN_VALIDITY || '24h') => {
  return jwt.sign(payload, config.JWT_SECRET_USER, { expiresIn })
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET_USER)
}

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.REFRESH_TOKEN_SECRET)
}

const buildUserPayload = (user) => ({
  _id: String(user._id),
  sEmail: user.sEmail || null,
  eRole: user.eRole,
  eAuthProvider: user.eAuthProvider
})

const toPublicUser = (user) => ({
  _id: user._id,
  sEmail: user.sEmail || null,
  sName: user.sName || null,
  sProfilePic: user.sProfilePic || null,
  eRole: user.eRole,
  eAuthProvider: user.eAuthProvider,
  dLastLogin: user.dLastLogin || null
})

const getExpiryDateFromJwt = (token) => {
  const decoded = jwt.decode(token)
  if (!decoded?.exp) return null
  return new Date(decoded.exp * 1000)
}

module.exports = {
  hashValue,
  compareHash,
  generateOtp,
  signAccessToken,
  signRefreshToken,
  signGuestToken,
  verifyAccessToken,
  verifyRefreshToken,
  buildUserPayload,
  toPublicUser,
  getExpiryDateFromJwt
}

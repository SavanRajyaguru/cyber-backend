const { body } = require('express-validator')

const sendOtp = [
  body('sEmail')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email')
    .normalizeEmail()
]

const verifyOtp = [
  body('sEmail')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email')
    .normalizeEmail(),
  body('sOtp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric')
]

const googleLogin = [
  body('idToken')
    .trim()
    .notEmpty().withMessage('Google ID token is required')
]

const refresh = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Refresh token is required')
]

const logout = [
  body('refreshToken')
    .optional()
    .trim()
    .notEmpty().withMessage('Refresh token cannot be empty')
]

module.exports = {
  sendOtp,
  verifyOtp,
  googleLogin,
  refresh,
  logout
}

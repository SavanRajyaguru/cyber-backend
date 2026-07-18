const router = require('express').Router()
const { validate, isUserAuthenticated } = require('../../middlewares/auth.middleware')
const validators = require('./validators')
const authServices = require('./services')

router.post('/send-otp', validators.sendOtp, validate, authServices.sendOtp)
router.post('/verify-otp', validators.verifyOtp, validate, authServices.verifyOtp)
router.post('/google', validators.googleLogin, validate, authServices.googleLogin)
router.post('/guest', authServices.guestLogin)
router.post('/refresh', validators.refresh, validate, authServices.refresh)
router.post('/logout', isUserAuthenticated, validators.logout, validate, authServices.logout)

module.exports = router

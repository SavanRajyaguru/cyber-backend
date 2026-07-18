const router = require('express').Router()
const { validate, isUserAuthenticated, denyGuest } = require('../../middlewares/auth.middleware')
const validators = require('./validators')
const scanServices = require('./services')

router.post('/start', validators.startScan, validate, scanServices.start)
router.get('/progress/:scanId', validators.scanIdParam, validate, scanServices.progress)
router.get('/result/:scanId', validators.scanIdParam, validate, scanServices.result)

module.exports = router

const router = require('express').Router()
const { validate, isUserAuthenticated, denyGuest } = require('../../middlewares/auth.middleware')
const validators = require('./validators')
const scanServices = require('./services')

router.post('/start', isUserAuthenticated, validators.startScan, validate, scanServices.start)
router.get('/list', isUserAuthenticated, validators.listScans, validate, scanServices.list)
router.get('/progress/:scanId', isUserAuthenticated, validators.scanIdParam, validate, scanServices.progress)
router.get('/result/:scanId', isUserAuthenticated, denyGuest, validators.scanIdParam, validate, scanServices.result)

module.exports = router

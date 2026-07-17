const router = require('express').Router()
const isUserAuthenticated = require('../../middlewares/isUserAuthenticated')
const userAuthServices = require('./services')

router.put('/user/logout/v1', isUserAuthenticated, userAuthServices.logout)

module.exports = router
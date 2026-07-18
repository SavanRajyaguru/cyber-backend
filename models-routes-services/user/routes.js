const router = require('express').Router()
const { isUserAuthenticated } = require('../../middlewares/auth.middleware')
const userAuthServices = require('./services')

router.put('/user/logout/v1', isUserAuthenticated, userAuthServices.logout)

module.exports = router

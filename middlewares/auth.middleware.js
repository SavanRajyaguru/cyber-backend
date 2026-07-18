const { validationResult } = require('express-validator')
const { status, jsonStatus, messages } = require('../helper/api.responses')
const { catchError, ObjectId } = require('../helper/utilities.services')
const { verifyAccessToken } = require('../helper/jwt.services')
const { eRole } = require('../data')

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(status.UnprocessableEntity).jsonp({
      status: jsonStatus.UnprocessableEntity,
      message: messages[req.userLanguage || 'English']?.invalid?.replace('##', 'request') || 'Invalid request',
      errors: errors.array()
    })
  }
  return next()
}

const isUserAuthenticated = async (req, res, next) => {
  try {
    const token = req.header('Authorization')
    if (!token) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage || 'English'].err_unauthorized
      })
    }

    const rawToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim()
    let decoded

    try {
      decoded = verifyAccessToken(rawToken)
    } catch (error) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage || 'English'].err_unauthorized
      })
    }

    req.user = {
      ...decoded,
      _id: ObjectId(decoded._id) || decoded._id
    }
    return next()
  } catch (error) {
    return catchError('isUserAuthenticated', error, req, res)
  }
}

const denyGuest = (req, res, next) => {
  if (req.user?.eRole === eRole.map.GUEST) {
    return res.status(status.Forbidden).jsonp({
      status: jsonStatus.Forbidden,
      message: messages[req.userLanguage || 'English'].guest_access_denied
    })
  }
  return next()
}

module.exports = {
  validate,
  isUserAuthenticated,
  denyGuest
}

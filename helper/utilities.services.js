const Sentry = require('@sentry/node')
const mongoose = require('mongoose')
const { status, jsonStatus, messages } = require('./api.responses')

const ObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id)
  } catch (error) {
    return null
  }
}

const getIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    ''
  )
}

const handleCatchError = (error) => {
  console.error(error)
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error)
  }
}

const catchError = (name, error, req, res) => {
  handleCatchError(error)
  const language = req?.userLanguage || 'English'
  return res.status(status.InternalServerError).jsonp({
    status: jsonStatus.InternalServerError,
    message: messages[language]?.err_internal || messages.English.err_internal
  })
}

module.exports = {
  ObjectId,
  getIp,
  handleCatchError,
  catchError
}

const { body, param } = require('express-validator')

const startScan = [
  body('sUrl')
    .trim()
    .notEmpty().withMessage('URL is required')
    .isString().withMessage('URL must be a string')
    .isLength({ max: 2048 }).withMessage('URL is too long')
]

const scanIdParam = [
  param('scanId')
    .trim()
    .notEmpty().withMessage('scanId is required')
    .isUUID().withMessage('scanId must be a valid UUID')
]

module.exports = {
  startScan,
  scanIdParam
}

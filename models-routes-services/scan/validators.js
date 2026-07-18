const { body, param, query } = require('express-validator')
const { SCAN_STATUS } = require('./constants')

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

const listScans = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
    .toInt(),
  query('eStatus')
    .optional()
    .isIn(Object.values(SCAN_STATUS)).withMessage(`eStatus must be one of: ${Object.values(SCAN_STATUS).join(', ')}`),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('search is too long'),
  query('dateFrom')
    .optional()
    .isISO8601().withMessage('dateFrom must be a valid ISO8601 date')
    .toDate(),
  query('dateTo')
    .optional()
    .isISO8601().withMessage('dateTo must be a valid ISO8601 date')
    .toDate(),
  query('sortBy')
    .optional()
    .isIn(['dCreatedAt', 'dFinishedAt', 'nOverall']).withMessage('sortBy must be one of: dCreatedAt, dFinishedAt, nOverall'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc')
]

module.exports = {
  startScan,
  scanIdParam,
  listScans
}

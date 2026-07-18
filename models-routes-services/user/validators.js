const { body } = require('express-validator')

const login = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

module.exports = { login }

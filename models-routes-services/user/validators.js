const login = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

module.exports = {
  login
}
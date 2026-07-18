const { status, jsonStatus, messages } = require('../helper/api.responses')

module.exports = (app) => {
  app.get('/api/health-check', (req, res) => {
    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: messages.English.success,
      data: { ok: true }
    })
  })

  app.use('/api/auth', [
    require('../models-routes-services/auth/routes')
  ])

  app.use('/api/scan', [
    require('../models-routes-services/scan/routes')
  ])

  app.use((req, res) => {
    return res.status(status.NotFound).jsonp({
      status: jsonStatus.NotFound,
      message: messages[req.userLanguage || 'English'].not_found.replace('##', 'Route')
    })
  })
}

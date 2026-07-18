const { analyzeHosting } = require('./hosting.analyzer')
const { analyzeCloud } = require('./cloud.analyzer')
const { analyzeCdn } = require('./cdn.analyzer')
const { analyzeServer } = require('./server.analyzer')
const { analyzeNetwork } = require('./network.analyzer')
const { analyzeEmail } = require('./email.analyzer')

module.exports = {
  analyzeHosting,
  analyzeCloud,
  analyzeCdn,
  analyzeServer,
  analyzeNetwork,
  analyzeEmail
}

const { runInfrastructureScan } = require('./infrastructure/services/infrastructure.service')

module.exports = {
  scan: runInfrastructureScan
}

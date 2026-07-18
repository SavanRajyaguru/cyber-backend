const { runComplianceScan } = require('./compliance/services/compliance.service')

module.exports = {
  scan: runComplianceScan
}

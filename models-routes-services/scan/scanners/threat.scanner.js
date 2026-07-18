const { runThreatScan } = require('./threat/services/threat.service')

module.exports = {
  scan: runThreatScan
}

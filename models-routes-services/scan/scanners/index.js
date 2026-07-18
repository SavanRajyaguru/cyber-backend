const { SCAN_MODULES } = require('../constants')

const registry = {
  header: require('./header.scanner').scan,
  ssl: require('./ssl.scanner').scan,
  dns: require('./dns.scanner').scan,
  javascript: require('./javascript.scanner').scan,
  seo: require('./seo.scanner').scan,
  threat: require('./threat.scanner').scan,
  technology: require('./technology.scanner').scan,
  compliance: require('./compliance.scanner').scan,
  infrastructure: require('./infrastructure.scanner').scan,
  performance: require('./performance.scanner').scan,
  secret: require('./secret.scanner').scan
}

const getScanner = (sModule) => registry[sModule] || null

const listRegisteredModules = () => SCAN_MODULES.filter((m) => Boolean(registry[m]))

module.exports = {
  getScanner,
  listRegisteredModules,
  registry
}

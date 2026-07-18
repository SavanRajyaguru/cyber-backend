const { runSslScan } = require('./ssl/service')

/**
 * SSL/TLS scanner entry — called by module worker via scanners registry.
 * @param {{ sUrl: string, sModule?: string }} params
 */
const scan = async ({ sUrl }) => {
  return runSslScan({ sUrl })
}

module.exports = { scan }

const { runDnsScan } = require('./dns/service')

/**
 * DNS scanner entry — called by module worker via scanners registry.
 * @param {{ sUrl: string, sModule?: string }} params
 */
const scan = async ({ sUrl }) => {
  return runDnsScan({ sUrl })
}

module.exports = { scan }

const { runHeaderScan } = require('./header/service')

/**
 * Header scanner entry — called by module worker via scanners registry.
 * @param {{ sUrl: string, sModule?: string }} params
 */
const scan = async ({ sUrl }) => {
  return runHeaderScan({ sUrl })
}

module.exports = { scan }

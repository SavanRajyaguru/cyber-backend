const { runTechnologyScan } = require('./technology/service')

/**
 * Technology detection entry — informational only (nScore null).
 * @param {{ sUrl: string, sModule?: string }} params
 */
const scan = async ({ sUrl }) => {
  return runTechnologyScan({ sUrl })
}

module.exports = { scan }

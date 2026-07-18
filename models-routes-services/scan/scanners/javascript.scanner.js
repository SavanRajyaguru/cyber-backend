const { runJavascriptScan } = require('./javascript/service')

/**
 * JavaScript security scanner entry — called by module worker.
 * @param {{ sUrl: string, sModule?: string }} params
 */
const scan = async ({ sUrl }) => {
  return runJavascriptScan({ sUrl })
}

module.exports = { scan }

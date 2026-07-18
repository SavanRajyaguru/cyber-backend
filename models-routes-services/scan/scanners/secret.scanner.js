const { runSecretScan } = require('./secret/service')

/**
 * Secret scanner entry — passive public-resource secret search.
 * @param {{ sUrl: string, sModule?: string }} params
 */
const scan = async ({ sUrl }) => {
  return runSecretScan({ sUrl })
}

module.exports = { scan }

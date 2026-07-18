const { MODULE_STATUS } = require('../constants')

/**
 * Factory for stub scanners — real logic plugs in later.
 */
const createStubScanner = (sModule) => {
  return async ({ sUrl }) => ({
    sModule,
    eStatus: MODULE_STATUS.COMPLETED,
    oFindings: [],
    oMeta: {
      bStub: true,
      sUrl,
      sNote: `${sModule} scanner stub — implementation pending`
    },
    nScore: null
  })
}

module.exports = { createStubScanner }

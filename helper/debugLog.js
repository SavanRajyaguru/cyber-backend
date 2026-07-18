const config = require('../config/config')

/**
 * No-ops unless DEBUG_LOG=true — layers extra detail on top of the always-on
 * info/error logs without changing default (production) log output.
 */
const debugLog = (sTag, sMessage, oMeta = {}) => {
  if (!config.DEBUG_LOG) return
  const suffix = Object.keys(oMeta).length ? ` ${JSON.stringify(oMeta)}` : ''
  console.log(`[DEBUG] [${sTag}] ${sMessage}${suffix}`)
}

module.exports = { debugLog }

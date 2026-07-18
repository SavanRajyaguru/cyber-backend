const { MODULE_STATUS } = require('../constants')

/**
 * Stub scoring until real scanners provide scores.
 * Completed modules without a score contribute null (excluded from average).
 */
const calculateModuleScores = (oModules = {}) => {
  const modules = {}
  for (const [sModule, slot] of Object.entries(oModules)) {
    if (slot?.eStatus === MODULE_STATUS.COMPLETED && typeof slot.nScore === 'number') {
      modules[sModule] = slot.nScore
    } else if (slot?.eStatus === MODULE_STATUS.COMPLETED) {
      modules[sModule] = null
    } else {
      modules[sModule] = null
    }
  }
  return modules
}

const calculateOverallScore = (moduleScores = {}) => {
  const values = Object.values(moduleScores).filter((v) => typeof v === 'number')
  if (!values.length) return null
  const sum = values.reduce((acc, n) => acc + n, 0)
  return Math.round((sum / values.length) * 100) / 100
}

const applyScores = (context) => {
  const modules = calculateModuleScores(context.oModules)
  const nOverall = calculateOverallScore(modules)
  context.oScores = { modules, nOverall }

  for (const [sModule, nScore] of Object.entries(modules)) {
    if (context.oModules[sModule]) {
      context.oModules[sModule].nScore = nScore
    }
  }
  return context
}

module.exports = {
  calculateModuleScores,
  calculateOverallScore,
  applyScores
}

const { analyzeTiming } = require('./timing.analyzer')
const { analyzeResources } = require('./resource.analyzer')
const { analyzeCompression } = require('./compression.analyzer')
const { analyzeImages } = require('./image.analyzer')
const { analyzeFonts } = require('./font.analyzer')
const { analyzeCache } = require('./cache.analyzer')
const { analyzeOptimization } = require('./optimization.analyzer')

module.exports = {
  analyzeTiming,
  analyzeResources,
  analyzeCompression,
  analyzeImages,
  analyzeFonts,
  analyzeCache,
  analyzeOptimization
}

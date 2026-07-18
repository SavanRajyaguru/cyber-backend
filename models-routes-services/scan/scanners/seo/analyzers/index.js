const { analyzeTitle } = require('./title.analyzer')
const { analyzeMeta } = require('./meta.analyzer')
const { analyzeHeadings } = require('./heading.analyzer')
const { analyzeImages } = require('./image.analyzer')
const { analyzeLinks } = require('./link.analyzer')
const { analyzeStructuredData } = require('./structured-data.analyzer')
const { analyzeSocial } = require('./social.analyzer')
const { analyzeContent } = require('./content.analyzer')
const { analyzeRobots } = require('./robots.analyzer')
const { analyzeFavicon } = require('./favicon.analyzer')

module.exports = {
  analyzeTitle,
  analyzeMeta,
  analyzeHeadings,
  analyzeImages,
  analyzeLinks,
  analyzeStructuredData,
  analyzeSocial,
  analyzeContent,
  analyzeRobots,
  analyzeFavicon
}

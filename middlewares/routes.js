const { status, jsonStatus, messages } = require('../helper/api.responses')
const { DISABLE_ADMIN_ROUTES } = require('../config/config')
const { checkAccess } = require('./middleware')

module.exports = (app) => {
  if (DISABLE_ADMIN_ROUTES) {
    app.all('/api/admin/*', (req, res) => { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound }) })
  }

  app.use('/api', (req, res, next) => {
    if (req.path.includes('/admin/')) {
      return checkAccess(req, res, next)
    }
    return next()
  })
  app.use('/', [
    require('../models-routes-services/sitemap/routes')
  ])
  app.use(require('../models-routes-services/customDeepLink/routes'))
  app.use('/.well-known', require('../models-routes-services/customDeepLink/routes'))

  app.use('/api/link', [
    require('../models-routes-services/customDeepLink/routes')
  ])

  // Admin Module Routess
  app.use('/api/administrator', [
    require('../models-routes-services/admin/auth/routes'), // Admin auth routes
    require('../models-routes-services/admin/permissions/routes'), // Admin permissions routes
    require('../models-routes-services/admin/subAdmin/routes'), // Sub admin routes
    require('../models-routes-services/admin/roles/routes'), // Admin roles routes
    require('../models-routes-services/admin/adminLogs/routes'), // Admin logs routes
    // require('../models-routes-services/commonRules/routes'), // Common rules routes
    require('../models-routes-services/admin/columnPreference/routes'), // Column preference routes
    require('../models-routes-services/networkAccess/routes'), // Network access routes
    require('../models-routes-services/setting/routes'), // Setting routes
    require('../models-routes-services/reelFollowing/routes'), // Reel Following routes
    require('../models-routes-services/reels/routes'), // Reels routes
    require('../models-routes-services/reelcategory/routes'), // Reels routes
    require('../models-routes-services/Dashboard/routes')
  ])

  app.use('/api/statics', [
    require('../models-routes-services/version/routes'), // Version routes
    //   require('../models-routes-services/cms/routes'), // CMS routes
    //   require('../models-routes-services/version/routes'), // Version routes
    require('../models-routes-services/cms/routes') // CMS routes
    //   require('../models-routes-services/maintenance/routes'), // Maintenance routes
    //   require('../models-routes-services/emailTemplates/routes'), // Email template routes`
    //   require('../models-routes-services/banner/routes'), // Banner routes
    //   require('../models-routes-services/banner/statistics/routes'),
    //   require('../models-routes-services/user/statistics/routes')
  ])

  app.use('/api/notification', [
    require('../models-routes-services/notification/routes'), // Notification routes
    require('../models-routes-services/notification/statistics/routes'), // Notification statistics routes
    require('../models-routes-services/userNotifyPreferences/routes') // User notify preferences routes
  ])

  app.use('/api/auth', [
    require('../models-routes-services/user/auth/routes'),
    require('../models-routes-services/user/profile/routes'),
    require('../models-routes-services/userStreak/routes'),
    require('../models-routes-services/streak/routes')
    // require('../models-routes-services/user/otpVerifications/routes'),
  ])

  app.use('/api/common', [
    require('../models-routes-services/common/routes')
  ])

  app.use('/api', [
    require('../models-routes-services/rssfeed/routes'), // Rss feed routes
    require('../models-routes-services/category/routes'), // Category routes
    require('../models-routes-services/feedArticalData/routes'), // Feed artical data routes
    require('../models-routes-services/lingo/routes'), // Lingo routes
    require('../models-routes-services/lingoArticle/routes'), // Lingo artical routes
    require('../models-routes-services/bookMark/routes'), // bookmark routes
    require('../models-routes-services/user/preference/routes'), // User preference routes
    require('../models-routes-services/reportProblem/routes'), // Report problem routes
    require('../models-routes-services/lingoArticle/reaction/routes'),
    require('../models-routes-services/liveLine/sports/routes'),
    require('../models-routes-services/liveLine/routes'),
    require('../models-routes-services/game/routes'),
    require('../models-routes-services/liveLine/teams/routes'),
    require('../models-routes-services/commentaryLingo/routes'),
    require('../models-routes-services/liveLine/commentary/routes'),
    require('../models-routes-services/liveLine/players/routes'),
    require('../models-routes-services/telegramAutomation/routes'),
    require('../models-routes-services/liveLine/competition/routes'),
    require('../models-routes-services/thirdPartyAiLogs/routes'),
    require('../models-routes-services/card/routes'),
    require('../models-routes-services/matchTeam/routes'),
    require('../models-routes-services/prediction/sub-category/routes'),
    require('../models-routes-services/prediction/events/routes'),
    require('../models-routes-services/prediction/eventResponse/routes'),
    require('../models-routes-services/coinSystem/routes'),
    require('../models-routes-services/leaderboard/routes'),
    require('../models-routes-services/reelcategory/userRoutes'),
    require('../models-routes-services/reels/userRoutes'),
    require('../models-routes-services/lingoFeedback/routes'),
    require('../models-routes-services/userStatistics/routes'),
    require('../models-routes-services/merchandise/sizes/routes'),
    require('../models-routes-services/merchandise/productCategory/routes'),
    require('../models-routes-services/merchandise/products/routes'),
    require('../models-routes-services/merchandise/orders/routes'),
    require('../models-routes-services/esportsCategory/routes'),
    require('../models-routes-services/esportsFollowing/routes'),
    require('../models-routes-services/esportsVideos/routes'),
    require('../models-routes-services/videos/routes'),
    require('../models-routes-services/videoFollowing/routes'),
    require('../models-routes-services/videoCategory/routes'),
    require('../models-routes-services/userHistory/routes'),
    require('../models-routes-services/audioAds/routes'),
    require('../models-routes-services/userRecommendation/routes'),
    require('../models-routes-services/leaderboardSponsor/routes'),
    require('../models-routes-services/userAvatar/router'),
    require('../models-routes-services/Entertainment/award/routes'),
    require('../models-routes-services/Entertainment/content/routes'),
    require('../models-routes-services/Entertainment/genre/routes'),
    require('../models-routes-services/Entertainment/platform/routes'),
    require('../models-routes-services/Entertainment/person/routes'),
    require('../models-routes-services/Entertainment/castCrew/routes'),
    require('../models-routes-services/Entertainment/media/routes'),
    require('../models-routes-services/Entertainment/reviews/routes'),
    require('../models-routes-services/Entertainment/relevantContent/routes'),
    require('../models-routes-services/trendingTopic/routes'),
    require('../models-routes-services/tab/routes'),
    require('../models-routes-services/Seo/routes')
  ])

  app.get('/api/health-check', (req, res) => {
    const sDate = new Date().toJSON()
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, sDate })
  })

  app.get('*', (req, res) => {
    return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', 'route') })
  })
}

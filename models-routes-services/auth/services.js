const { OAuth2Client } = require('google-auth-library')
const config = require('../../config/config')
const { eRole, eAuthProvider, eStatus } = require('../../data')
const { status, jsonStatus, messages } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const {
  hashValue,
  compareHash,
  generateOtp,
  signAccessToken,
  signRefreshToken,
  signGuestToken,
  verifyRefreshToken,
  buildUserPayload,
  toPublicUser,
  getExpiryDateFromJwt
} = require('../../helper/jwt.services')
const { sendOtpEmail } = require('../../helper/email.services')
const { redisClient } = require('../../helper/redis')
const UserModel = require('../user/model')
const OtpModel = require('../otp/model')
const RefreshTokenModel = require('../refreshToken/model')

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID)

const authServices = {}

const msg = (req) => messages[req.userLanguage] || messages.English

const otpSendKey = (email) => `otp:send:${email}`

const assertActiveUser = (user, req, res) => {
  if (!user || user.eStatus !== eStatus.map.ACTIVE) {
    res.status(status.Forbidden).jsonp({
      status: jsonStatus.Forbidden,
      message: msg(req).user_blocked
    })
    return false
  }
  return true
}

const issueTokenPair = async (user) => {
  const payload = buildUserPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)
  const sTokenHash = await hashValue(refreshToken)
  const dExpiresAt = getExpiryDateFromJwt(refreshToken) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await RefreshTokenModel.create({
    iUserId: user._id,
    sTokenHash,
    dExpiresAt
  })

  return { accessToken, refreshToken }
}

const findStoredRefreshToken = async (userId, refreshToken) => {
  const tokens = await RefreshTokenModel.find({ iUserId: userId }).lean()
  for (const tokenDoc of tokens) {
    const matches = await compareHash(refreshToken, tokenDoc.sTokenHash)
    if (matches) return tokenDoc
  }
  return null
}

authServices.sendOtp = async (req, res) => {
  try {
    const sEmail = String(req.body.sEmail).toLowerCase().trim()
    const windowSeconds = (Number(config.OTP_SEND_WINDOW_MINUTES) || 15) * 60
    const maxSends = Number(config.OTP_MAX_SEND_PER_WINDOW) || 5
    const rateKey = otpSendKey(sEmail)

    const currentCount = await redisClient.incr(rateKey)
    if (currentCount === 1) {
      await redisClient.expire(rateKey, windowSeconds)
    }
    if (currentCount > maxSends) {
      return res.status(status.TooManyRequests).jsonp({
        status: jsonStatus.TooManyRequests,
        message: msg(req).otp_rate_limit
      })
    }

    const expiryMinutes = Number(config.OTP_EXPIRY_MINUTES) || 5
    const isNonProd = (config.NODE_ENV || process.env.NODE_ENV) !== 'production'
    const useStaticOtp = isNonProd && process.env.ENABLE_STATIC_OTP === 'true' && String(config.STATIC_OTP || '').length === 6
    const otp = useStaticOtp ? String(config.STATIC_OTP) : generateOtp(Number(config.OTP_LENGTH) || 6)
    const sOtpHash = await hashValue(otp)
    const dExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await OtpModel.findOneAndUpdate(
      { sEmail },
      { sOtpHash, dExpiresAt, nAttempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const hasSmtp = Boolean(config.MAIL_TRANSPORTER?.auth?.user && config.MAIL_TRANSPORTER?.auth?.pass)
    if (!hasSmtp) {
      if (!useStaticOtp) {
        return res.status(status.InternalServerError).jsonp({
          status: jsonStatus.InternalServerError,
          message: msg(req).email_not_configured
        })
      }
      console.log(`[auth] Static OTP for ${sEmail}: ${otp}`)
    } else {
      await sendOtpEmail({ to: sEmail, otp, expiryMinutes })
    }

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).otp_sent,
      data: { sEmail, dExpiresAt }
    })
  } catch (error) {
    return catchError('auth.sendOtp', error, req, res)
  }
}

authServices.verifyOtp = async (req, res) => {
  try {
    const sEmail = String(req.body.sEmail).toLowerCase().trim()
    const sOtp = String(req.body.sOtp).trim()
    const maxAttempts = Number(config.OTP_MAX_VERIFY_ATTEMPTS) || 5

    const otpDoc = await OtpModel.findOne({ sEmail })
    if (!otpDoc) {
      return res.status(status.BadRequest).jsonp({
        status: jsonStatus.BadRequest,
        message: msg(req).otp_invalid
      })
    }

    if (otpDoc.dExpiresAt.getTime() < Date.now()) {
      await OtpModel.deleteOne({ _id: otpDoc._id })
      return res.status(status.BadRequest).jsonp({
        status: jsonStatus.BadRequest,
        message: msg(req).otp_expired
      })
    }

    if (otpDoc.nAttempts >= maxAttempts) {
      await OtpModel.deleteOne({ _id: otpDoc._id })
      return res.status(status.TooManyRequests).jsonp({
        status: jsonStatus.TooManyRequests,
        message: msg(req).otp_max_attempts
      })
    }

    const isValid = await compareHash(sOtp, otpDoc.sOtpHash)
    if (!isValid) {
      otpDoc.nAttempts += 1
      await otpDoc.save()

      if (otpDoc.nAttempts >= maxAttempts) {
        await OtpModel.deleteOne({ _id: otpDoc._id })
        return res.status(status.TooManyRequests).jsonp({
          status: jsonStatus.TooManyRequests,
          message: msg(req).otp_max_attempts
        })
      }

      return res.status(status.BadRequest).jsonp({
        status: jsonStatus.BadRequest,
        message: msg(req).otp_invalid
      })
    }

    await OtpModel.deleteOne({ _id: otpDoc._id })

    let user = await UserModel.findOne({ sEmail })
    if (!user) {
      user = await UserModel.create({
        sEmail,
        sName: sEmail.split('@')[0],
        eRole: eRole.map.USER,
        eAuthProvider: eAuthProvider.map.EMAIL,
        eStatus: eStatus.map.ACTIVE,
        dLastLogin: new Date()
      })
    } else {
      if (!assertActiveUser(user, req, res)) return
      user.dLastLogin = new Date()
      if (!user.eAuthProvider) user.eAuthProvider = eAuthProvider.map.EMAIL
      await user.save()
    }

    const tokens = await issueTokenPair(user)

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).login_success,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: toPublicUser(user)
      }
    })
  } catch (error) {
    return catchError('auth.verifyOtp', error, req, res)
  }
}

authServices.googleLogin = async (req, res) => {
  try {
    if (!config.GOOGLE_CLIENT_ID) {
      return res.status(status.InternalServerError).jsonp({
        status: jsonStatus.InternalServerError,
        message: msg(req).google_auth_failed
      })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.idToken,
      audience: config.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).google_auth_failed
      })
    }

    const sEmail = String(payload.email).toLowerCase().trim()
    const sGoogleId = payload.sub
    const sName = payload.name || sEmail.split('@')[0]
    const sProfilePic = payload.picture || null

    let user = await UserModel.findOne({
      $or: [{ sGoogleId }, { sEmail }]
    })

    if (!user) {
      user = await UserModel.create({
        sEmail,
        sName,
        sProfilePic,
        sGoogleId,
        eRole: eRole.map.USER,
        eAuthProvider: eAuthProvider.map.GOOGLE,
        eStatus: eStatus.map.ACTIVE,
        dLastLogin: new Date()
      })
    } else {
      if (!assertActiveUser(user, req, res)) return
      user.sGoogleId = user.sGoogleId || sGoogleId
      user.sName = user.sName || sName
      user.sProfilePic = sProfilePic || user.sProfilePic
      user.eAuthProvider = eAuthProvider.map.GOOGLE
      user.dLastLogin = new Date()
      await user.save()
    }

    const tokens = await issueTokenPair(user)

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).login_success,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: toPublicUser(user)
      }
    })
  } catch (error) {
    if (error?.message?.includes('Token used too late') || error?.message?.includes('Invalid token')) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).google_auth_failed
      })
    }
    return catchError('auth.googleLogin', error, req, res)
  }
}

authServices.guestLogin = async (req, res) => {
  try {
    const guestSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const user = await UserModel.create({
      sName: `Guest_${guestSuffix}`,
      eRole: eRole.map.GUEST,
      eAuthProvider: eAuthProvider.map.GUEST,
      eStatus: eStatus.map.ACTIVE,
      dLastLogin: new Date()
    })

    const accessToken = signGuestToken(buildUserPayload(user), config.GUEST_TOKEN_VALIDITY || '24h')

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).guest_login_success,
      data: {
        accessToken,
        user: toPublicUser(user)
      }
    })
  } catch (error) {
    return catchError('auth.guestLogin', error, req, res)
  }
}

authServices.refresh = async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken).trim()
    let decoded

    try {
      decoded = verifyRefreshToken(refreshToken)
    } catch (error) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).invalid_refresh_token
      })
    }

    const user = await UserModel.findById(decoded._id)
    if (!assertActiveUser(user, req, res)) return

    if (user.eRole === eRole.map.GUEST) {
      return res.status(status.Forbidden).jsonp({
        status: jsonStatus.Forbidden,
        message: msg(req).guest_access_denied
      })
    }

    const stored = await findStoredRefreshToken(user._id, refreshToken)
    if (!stored) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).invalid_refresh_token
      })
    }

    if (stored.dExpiresAt.getTime() < Date.now()) {
      await RefreshTokenModel.deleteOne({ _id: stored._id })
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: msg(req).invalid_refresh_token
      })
    }

    await RefreshTokenModel.deleteOne({ _id: stored._id })
    const tokens = await issueTokenPair(user)

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).token_refreshed,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: toPublicUser(user)
      }
    })
  } catch (error) {
    return catchError('auth.refresh', error, req, res)
  }
}

authServices.logout = async (req, res) => {
  try {
    const userId = req.user._id
    const refreshToken = req.body?.refreshToken

    if (refreshToken) {
      const stored = await findStoredRefreshToken(userId, refreshToken)
      if (stored) {
        await RefreshTokenModel.deleteOne({ _id: stored._id })
      }
    } else {
      await RefreshTokenModel.deleteMany({ iUserId: userId })
    }

    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).logout_success
    })
  } catch (error) {
    return catchError('auth.logout', error, req, res)
  }
}

module.exports = authServices

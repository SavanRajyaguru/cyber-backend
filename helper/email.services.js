const path = require('path')
const ejs = require('ejs')
const nodemailer = require('nodemailer')
const config = require('../config/config')
const { handleCatchError } = require('./utilities.services')

let transporter

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(config.MAIL_TRANSPORTER)
  }
  return transporter
}

const renderTemplate = async (templateName, data = {}) => {
  const templatePath = path.join(global.appRootPath || process.cwd(), 'templates', `${templateName}.ejs`)
  return ejs.renderFile(templatePath, data)
}

const sendMail = async ({ to, subject, html, text }) => {
  try {
    const from = config.SMTP_FROM || config.MAIL_TRANSPORTER?.auth?.user
    const info = await getTransporter().sendMail({
      from,
      to,
      subject,
      html,
      text
    })
    return info
  } catch (error) {
    handleCatchError(error)
    throw error
  }
}

const sendOtpEmail = async ({ to, otp, expiryMinutes }) => {
  const html = await renderTemplate('otp', {
    otp,
    expiryMinutes,
    appName: 'SolveBeat'
  })

  return sendMail({
    to,
    subject: 'Your SolveBeat login OTP',
    html,
    text: `Your SolveBeat OTP is ${otp}. It expires in ${expiryMinutes} minutes.`
  })
}

module.exports = {
  sendMail,
  sendOtpEmail,
  renderTemplate
}

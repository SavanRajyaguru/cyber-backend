require('dotenv').config()
const http = require('http')
const jwt = require('jsonwebtoken')
const config = require('../config/config')

const request = (method, path, body, headers = {}) => new Promise((resolve, reject) => {
  const data = body ? JSON.stringify(body) : ''
  const req = http.request({
    hostname: 'localhost',
    port: config.PORT || 5000,
    path,
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      ...headers
    }
  }, (res) => {
    let raw = ''
    res.on('data', (chunk) => { raw += chunk })
    res.on('end', () => {
      let parsed = raw
      try { parsed = JSON.parse(raw || '{}') } catch (_) {}
      resolve({ status: res.statusCode, body: parsed })
    })
  })
  req.on('error', reject)
  if (data) req.write(data)
  req.end()
})

;(async () => {
  const guest = await request('POST', '/api/auth/guest', {})
  console.log('guest', guest.status, guest.body.message)
  if (!guest.body?.data?.accessToken) process.exit(1)

  const guestToken = guest.body.data.accessToken
  const start = await request('POST', '/api/scan/start', { sUrl: 'example.com' }, {
    Authorization: `Bearer ${guestToken}`
  })
  console.log('start', start.status, JSON.stringify(start.body))
  const scanId = start.body?.data?.scanId
  if (!scanId) process.exit(1)

  await new Promise((r) => setTimeout(r, 5000))

  const progress = await request('GET', `/api/scan/progress/${scanId}`, null, {
    Authorization: `Bearer ${guestToken}`
  })
  console.log('progress', progress.status, JSON.stringify(progress.body))

  // Result requires non-guest (denyGuest)
  const userToken = jwt.sign(
    { _id: '000000000000000000000001', sEmail: 'test@example.com', eRole: 'USER', eAuthProvider: 'EMAIL' },
    config.JWT_SECRET_USER,
    { expiresIn: '1h' }
  )
  const result = await request('GET', `/api/scan/result/${scanId}`, null, {
    Authorization: `Bearer ${userToken}`
  })
  console.log('result', result.status, result.body?.data?.eStatus, result.body?.data?.nProgress, Object.keys(result.body?.data?.oResults || {}))
  process.exit(0)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

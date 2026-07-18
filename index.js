require('dotenv').config()
const express = require('express')
const path = require('path')
const http = require('http')
const config = require('./config/config')
const app = express()
const server = http.createServer(app)

global.appRootPath = __dirname

app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs')

require('./middlewares/index')(app)
require('./middlewares/routes')(app)

// Optional Socket.IO — do not block auth bootstrap if the package is missing
// try {
//   const { Server } = require('socket.io')
//   const io = new Server(server, {
//     pingInterval: 10000,
//     pingTimeout: 8000,
//     maxHttpBufferSize: 1e8,
//     allowUpgrades: true,
//     perMessageDeflate: false,
//     serveClient: true,
//     cookie: false,
//     transports: ['websocket'],
//     connectTimeout: 45000,
//     allowEIO3: true,
//     cors: {
//       origin: '*',
//       methods: ['GET', 'POST'],
//       credentials: false
//     }
//   })
//   require('./socket')(io)
// } catch (error) {
//   console.warn('Socket.IO not available; continuing without realtime support.')
// }

require('./helper/bullmqListener')

server.listen(config.PORT || 3000, () => {
  console.log(`Server is running on port: ${config.PORT || 3000}`)
})

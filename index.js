require('dotenv').config() // Load environment variables
const express = require('express')
const path = require('path')
const http = require('http')
const config = require('./config/config') // Ensure you have a config file for your PORT
const app = express() // Initialize Express
const server = http.createServer(app) // Create an HTTP server for WebSocket support if needed

const io = require('socket.io')(server, {
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 1e8,
  allowUpgrades: true,
  perMessageDeflate: false,
  serveClient: true,
  cookie: false,
  transports: ['websocket'],
  connectTimeout: 45000,
  allowEIO3: true,
  cors: {
    origin: '*:*',
    methods: ['GET', 'POST'],
    credentials: false
  }
})
require('./socket')(io) // socket configuration

// Set the global root path
global.appRootPath = __dirname

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')))

// Set the view engine to EJS
app.set('view engine', 'ejs')

// Load middlewares
require('./middlewares/index')(app)

// Load routes
require('./middlewares/routes')(app)

// Start worker
require('./helper/bullmqListener')

// Start the server
server.listen(config.PORT || 3000, () => {
  console.log(`🚀 Server is running on port: ${config.PORT || 3000}`)
})

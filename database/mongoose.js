const mongoose = require('mongoose')

const config = require('../config/config')
const DBConnect = connection(config.USER_DB_URL, parseInt(config.USERS_DB_POOLSIZE), 'Users')

function connection(DB_URL, maxPoolSize = 10, DB) {
  try {
    const dbConfig = { readPreference: 'secondaryPreferred', maxPoolSize }

    const conn = mongoose.createConnection(DB_URL, dbConfig)
    conn.on('connected', () => console.log(`Connected to ${DB} database.`))
    return conn
  } catch (error) {
    console.log('error', error)
  }
}
// mongoose.set('debug', true)
module.exports = {
  DBConnect
}

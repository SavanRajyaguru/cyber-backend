const Redis = require('ioredis')
const config = require('../config/config')
class RedisClient {
  constructor(name, host, port, password, mode = 'single', options = {}) {
    this.name = name
    this.password = password
    this.host = host
    this.port = port
    this.mode = mode
    this.options = options
  }

  connect = () => {
    let redis = null
    if (this.mode === 'cluster') {
      // cluster Configuration
      let hosts = []
      this.host?.split(',').forEach(host => {
        const parts = host.split(':')
        hosts.push({
          host: parts[0] || this.host,
          port: parts[1] || this.port
        })
      })

      let config = {
        redisOptions: {
          password: this.password,
        },
        ...this.options
      }

      redis = new Redis.Cluster(hosts, config)
    } else {
      let config = {
        host: this.host,
        port: this.port,
        password: this.password,
        ...this.options
      }
      // Redis single instance Configuration
      redis = new Redis(config)
    }

    redis.on('connect', () => {
      console.log(`${this.name} connected successfully`)
    })
    redis.on('error', (error) => {
      console.error(`${this.name} connection error:`, error)
    })
    redis.on('reconnecting', () => {
      console.log(`${this.name} reconnecting...`)
    })
    redis.on('end', () => {
      console.log(`${this.name} connection ended`)
    })
    redis.on('close', () => {
      console.log(`${this.name} connection closed`)
    })
    return redis
  }
}


const redisClient = new RedisClient('Redis', config.REDIS_HOST_NAME, config.REDIS_PORT, config.REDIS_PASSWORD, config.REDIS_MODE).connect()

module.exports = { redisClient }
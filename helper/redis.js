const Redis = require('ioredis')
const { getRedisClientArgs } = require('./redisConnection')

class RedisClient {
  constructor(name, args) {
    this.name = name
    this.args = args
  }

  connect = () => {
    let redis = null
    const { args } = this

    if (args.type === 'url') {
      redis = new Redis(args.url, args.options || {})
    } else if (args.mode === 'cluster') {
      const hosts = []
      args.host?.split(',').forEach((host) => {
        const parts = host.split(':')
        hosts.push({
          host: parts[0] || args.host,
          port: parts[1] || args.port
        })
      })

      redis = new Redis.Cluster(hosts, {
        redisOptions: {
          password: args.password || undefined,
          ...(args.options || {})
        }
      })
    } else {
      const config = {
        host: args.host,
        port: args.port,
        ...(args.options || {})
      }
      if (args.password) {
        config.password = args.password
      }
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

const redisClient = new RedisClient('Redis', getRedisClientArgs()).connect()

module.exports = { redisClient }

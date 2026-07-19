const Redis = require('ioredis')
const { getRedisClientArgs, getRedisConnectionOptions } = require('./redisConnection')

const readPolicyViaConfig = async (client) => {
  try {
    const policy = await client.config('GET', 'maxmemory-policy')
    if (Array.isArray(policy) && policy.length >= 2 && policy[1]) return String(policy[1])
    if (policy && typeof policy === 'object' && policy['maxmemory-policy']) {
      return String(policy['maxmemory-policy'])
    }
  } catch {
    // CONFIG often blocked on Redis Cloud
  }
  return null
}

/** Redis Cloud usually allows INFO even when CONFIG is hidden. */
const readPolicyViaInfo = async (client) => {
  try {
    const info = await client.info('memory')
    const match = /maxmemory_policy:(.+)/.exec(info)
    if (match?.[1]) return match[1].trim()
  } catch {
    // ignore
  }
  return null
}

/**
 * BullMQ requires maxmemory-policy=noeviction.
 * On Redis Cloud: Database → Configuration → Data eviction policy → "no eviction"
 */
const ensureRedisNoEviction = async () => {
  let client
  try {
    const args = getRedisClientArgs()
    client =
      args.type === 'url'
        ? new Redis(args.url, { ...args.options, lazyConnect: true, maxRetriesPerRequest: 1 })
        : new Redis({
            host: args.host,
            port: args.port,
            password: args.password || undefined,
            ...args.options,
            lazyConnect: true,
            maxRetriesPerRequest: 1
          })

    await client.connect()

    const current =
      (await readPolicyViaConfig(client)) ||
      (await readPolicyViaInfo(client))

    if (!current) {
      console.warn('[redis] Could not read maxmemory-policy (CONFIG/INFO blocked).')
      console.warn('[redis] Set it manually in Redis Cloud:')
      console.warn('  → Database → Configuration → Data eviction policy → "no eviction"')
      console.warn('  Then restart this server. BullMQ will keep warning until that is set.')
      return
    }

    if (current === 'noeviction') {
      console.log('[redis] maxmemory-policy=noeviction ✓ (BullMQ OK)')
      return
    }

    console.warn(`[redis] maxmemory-policy is "${current}" — BullMQ needs "noeviction". Trying CONFIG SET…`)

    try {
      await client.config('SET', 'maxmemory-policy', 'noeviction')
      const next =
        (await readPolicyViaConfig(client)) ||
        (await readPolicyViaInfo(client))
      if (next === 'noeviction') {
        console.log('[redis] maxmemory-policy set to noeviction ✓')
        return
      }
    } catch (setError) {
      // Expected on Redis Cloud
      console.error(`[redis] CONFIG SET not allowed: ${setError.message}`)
    }

    console.error('[redis] Fix this in the Redis Cloud dashboard (code cannot change it):')
    console.error('  1. Open https://app.redislabs.com')
    console.error('  2. Select your database')
    console.error('  3. Configuration / Edit')
    console.error('  4. Data eviction policy → choose "no eviction"')
    console.error('  5. Save, then restart nodemon')
    console.error(`  Current policy detected: ${current}`)
  } catch (error) {
    console.error('[redis] Eviction policy check failed:', error.message)
    console.error('[redis] Connection host:', getRedisConnectionOptions().host)
  } finally {
    if (client) {
      try {
        await client.quit()
      } catch {
        client.disconnect()
      }
    }
  }
}

module.exports = { ensureRedisNoEviction }

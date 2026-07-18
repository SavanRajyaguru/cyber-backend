/**
 * Concurrent map with pool limit.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
const mapPool = async (items, concurrency, worker) => {
  const results = new Array(items.length)
  let next = 0
  const size = Math.min(concurrency, Math.max(items.length, 0))
  if (!size) return results

  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = await worker(items[i], i)
      } catch (error) {
        results[i] = { error: error?.message || 'Worker failed' }
      }
    }
  }))
  return results
}

module.exports = {
  mapPool
}

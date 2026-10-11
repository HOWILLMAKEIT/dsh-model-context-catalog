import { createCatalogCache } from './catalog-cache.js'
import { CATALOG_CACHE_TTL, downloadCatalog, validCatalogSnapshot, catalogInfo } from './catalog-source.js'

/** Load on demand, share concurrent requests, and keep the last successful data if an expired refresh fails. */
export function createCatalogLoader({
  fetcher = (...args) => globalThis.fetch(...args),
  cache = createCatalogCache(),
  now = Date.now,
  timeoutMs = 30_000,
} = {}) {
  let memory
  let pending
  const fresh = (snapshot) => validCatalogSnapshot(snapshot, now()) && now() - snapshot.fetchedAt < CATALOG_CACHE_TTL
  const result = (snapshot, status) => ({ records: snapshot.records, info: catalogInfo(snapshot), status })
  async function readAndRefresh() {
    if (fresh(memory)) return result(memory, 'cached')
    let previous = validCatalogSnapshot(memory, now()) ? memory : undefined
    try {
      const stored = await cache.read()
      if (validCatalogSnapshot(stored, now()) && (!previous || stored.fetchedAt > previous.fetchedAt)) previous = stored
    } catch {
      // Browser storage may be denied; fetching and the in-memory cache remain available.
    }
    if (fresh(previous)) {
      memory = previous
      return result(previous, 'cached')
    }
    const controller = new AbortController()
    let timer
    try {
      // Race also bounds a broken transport that does not observe AbortSignal.
      const snapshot = await Promise.race([
        downloadCatalog(fetcher, controller.signal, now),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error('CAPACITY_CATALOG_UNAVAILABLE'))
          }, timeoutMs)
        }),
      ])
      clearTimeout(timer)
      memory = snapshot
      try {
        await cache.write(snapshot)
      } catch {
        // A full or denied browser store must not discard successfully fetched references.
      }
      return result(snapshot, 'downloaded')
    } catch {
      if (!previous) throw new Error('CAPACITY_CATALOG_UNAVAILABLE')
      memory = previous
      return result(previous, 'stale')
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    load() {
      if (!pending) pending = readAndRefresh().finally(() => (pending = undefined))
      return pending
    },
  }
}

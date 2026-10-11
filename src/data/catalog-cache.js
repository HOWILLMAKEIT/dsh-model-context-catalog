const DATABASE = 'dsh-model-context-catalog'
const STORE = 'references'
const KEY = 'models.dev'
const STORAGE_TIMEOUT = 5000

/** Browser-local public reference cache; it never contains user model settings or credentials. */
export function createCatalogCache(indexedDB = globalThis.indexedDB) {
  function open() {
    return new Promise((resolve, reject) => {
      if (!indexedDB) return reject(new Error('CATALOG_CACHE_UNAVAILABLE'))
      let settled = false
      const request = indexedDB.open(DATABASE, 1)
      const timer = setTimeout(() => {
        settled = true
        reject(new Error('CATALOG_CACHE_UNAVAILABLE'))
      }, STORAGE_TIMEOUT)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => {
        clearTimeout(timer)
        if (settled) return request.result.close()
        settled = true
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
      request.onerror = () => {
        clearTimeout(timer)
        settled = true
        reject(request.error)
      }
    })
  }
  async function run(mode, value) {
    const db = await open()
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const store = transaction.objectStore(STORE)
        const request = mode === 'readonly' ? store.get(KEY) : store.put(value, KEY)
        const timer = setTimeout(() => transaction.abort(), STORAGE_TIMEOUT)
        transaction.oncomplete = () => {
          clearTimeout(timer)
          resolve(request.result)
        }
        transaction.onabort = transaction.onerror = () => {
          clearTimeout(timer)
          reject(transaction.error ?? new Error('CATALOG_CACHE_UNAVAILABLE'))
        }
      })
    } finally {
      db.close()
    }
  }
  return { read: () => run('readonly'), write: (value) => run('readwrite', value) }
}

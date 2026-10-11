import assert from 'node:assert/strict'
import test from 'node:test'
import { IDBFactory } from 'fake-indexeddb'
import { createCatalogCache } from '../src/data/catalog-cache.js'
import { createCatalogLoader } from '../src/data/catalog-loader.js'
import { CATALOG_URL, CATALOG_CACHE_TTL, catalogSnapshot } from '../src/data/catalog-source.js'

const START = Date.UTC(2026, 9, 12)
const payload = (context = 1000000) => {
  const model = { name: 'MiniMax M3', limit: { context }, modalities: { output: ['text'] } }
  return {
    providers: {
      minimax: { name: 'MiniMax', models: { 'minimax-m3': { ...model, canonical_model_id: 'minimax/minimax-m3' } } },
    },
    models: { 'minimax/minimax-m3': model },
  }
}
const response = (data) => ({ ok: true, text: async () => JSON.stringify(data) })
function fixture({ initial, fetcher, cache } = {}) {
  let time = START
  const requests = [],
    writes = []
  let stored = initial
  const storage = cache ?? {
    read: async () => structuredClone(stored),
    write: async (value) => {
      stored = structuredClone(value)
      writes.push(value)
    },
  }
  const loader = createCatalogLoader({
    now: () => time,
    cache: storage,
    fetcher: async (...args) => {
      requests.push(args)
      return fetcher ? fetcher(...args) : response(payload())
    },
  })
  return {
    loader,
    requests,
    writes,
    storage,
    setTime: (value) => {
      time = value
    },
  }
}

test('first click downloads references without configuration or credentials, then caches them for 24 hours', async () => {
  const f = fixture()
  assert.equal(f.requests.length, 0)
  const first = await f.loader.load()
  assert.equal(first.status, 'downloaded')
  assert.equal(first.info.modelRecords, 1)
  assert.equal(first.info.updatedAt, new Date(START).toISOString())
  assert.equal(first.records[0].contextWindow, 1000000)
  const [url, options] = f.requests[0]
  assert.equal(url, CATALOG_URL)
  assert.equal(options.method, 'GET')
  assert.equal(options.credentials, 'omit')
  assert.equal(options.referrerPolicy, 'no-referrer')
  assert.equal(options.cache, 'no-store')
  assert.equal(options.body, undefined)
  assert.equal(options.headers, undefined)
  assert.equal(f.writes.length, 1)
  f.setTime(START + CATALOG_CACHE_TTL - 1)
  assert.equal((await f.loader.load()).status, 'cached')
  assert.equal(f.requests.length, 1)
  f.setTime(START + CATALOG_CACHE_TTL)
  assert.equal((await f.loader.load()).status, 'downloaded')
  assert.equal(f.requests.length, 2)
})

test('browser cache survives a new loader and expired data is replaced only after a successful refresh', async () => {
  const cache = createCatalogCache(new IDBFactory())
  const first = fixture({ cache })
  await first.loader.load()
  const second = fixture({ cache, fetcher: async () => response(payload(1048576)) })
  assert.equal((await second.loader.load()).status, 'cached')
  assert.equal(second.requests.length, 0)
  second.setTime(START + CATALOG_CACHE_TTL)
  const fresh = await second.loader.load()
  assert.equal(fresh.status, 'downloaded')
  assert.ok(fresh.records.every((record) => record.contextWindow === 1048576))
  const saved = await cache.read()
  assert.equal(saved.fetchedAt, START + CATALOG_CACHE_TTL)
  assert.equal(saved.records[0].contextWindow, 1048576)
})

test('concurrent clicks share one download and later clicks use the successful cache', async () => {
  let complete
  const transport = new Promise((resolve) => {
    complete = resolve
  })
  const f = fixture({ fetcher: () => transport })
  const a = f.loader.load(),
    b = f.loader.load()
  assert.equal(a, b)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(f.requests.length, 1)
  complete(response(payload()))
  assert.equal((await a).status, 'downloaded')
  assert.equal((await b).status, 'downloaded')
  assert.equal((await f.loader.load()).status, 'cached')
  assert.equal(f.requests.length, 1)
})

test('failed refresh keeps previous references and their original age; next click retries', async () => {
  const initial = catalogSnapshot(payload(), START - CATALOG_CACHE_TTL)
  let available = false
  const f = fixture({
    initial,
    fetcher: async () => {
      if (!available) throw new Error('offline')
      return response(payload(1048576))
    },
  })
  const stale = await f.loader.load()
  assert.equal(stale.status, 'stale')
  assert.equal(stale.info.updatedAt, new Date(initial.fetchedAt).toISOString())
  assert.equal(f.writes.length, 0)
  available = true
  assert.equal((await f.loader.load()).status, 'downloaded')
  assert.equal(f.requests.length, 2)
})

test('HTTP, JSON and incomplete catalog failures never replace a successful cache', async () => {
  const initial = catalogSnapshot(payload(), START - CATALOG_CACHE_TTL)
  const invalid = [
    { ok: false, text: async () => JSON.stringify(payload()) },
    { ok: true, text: async () => '<html>proxy error</html>' },
    response({ providers: {}, models: {} }),
    response({ providers: [], models: payload().models }),
    response(payload(-1)),
  ]
  for (const failure of invalid) {
    const f = fixture({ initial, fetcher: async () => failure })
    assert.equal((await f.loader.load()).status, 'stale')
    assert.equal(f.writes.length, 0)
    assert.deepEqual(await f.storage.read(), initial)
  }
})

test('corrupt, incompatible and future-dated caches cannot suppress refresh or provide an offline fallback', async () => {
  const snapshot = catalogSnapshot(payload(), START)
  for (const initial of [
    { ...snapshot, version: 0 },
    { ...snapshot, fetchedAt: START + 1 },
    { ...snapshot, records: [{ ...snapshot.records[0], contextWindow: NaN }] },
    { ...snapshot, records: null },
  ]) {
    const offline = fixture({
      initial,
      fetcher: async () => {
        throw new Error('offline')
      },
    })
    await assert.rejects(offline.loader.load(), /CAPACITY_CATALOG_UNAVAILABLE/)
    const online = fixture({ initial })
    assert.equal((await online.loader.load()).status, 'downloaded')
    assert.equal(online.requests.length, 1)
  }
})

test('first-use failure can retry, and unavailable browser storage does not prevent matching or memory caching', async () => {
  let available = false
  const f = fixture({
    cache: {
      read: async () => {
        throw new Error('storage denied')
      },
      write: async () => {
        throw new Error('quota exceeded')
      },
    },
    fetcher: async () => {
      if (!available) throw new Error('offline')
      return response(payload())
    },
  })
  await assert.rejects(f.loader.load(), /CAPACITY_CATALOG_UNAVAILABLE/)
  available = true
  assert.equal((await f.loader.load()).status, 'downloaded')
  assert.equal((await f.loader.load()).status, 'cached')
  assert.equal(f.requests.length, 2)
  await assert.rejects(createCatalogCache(undefined).read(), /CATALOG_CACHE_UNAVAILABLE/)
})

test('a stalled request times out, aborts its signal and leaves the next click able to retry', async () => {
  let signal
  const loader = createCatalogLoader({
    cache: { read: async () => undefined },
    fetcher: (_url, options) => {
      signal = options.signal
      return new Promise(() => {})
    },
    timeoutMs: 10,
  })
  await assert.rejects(loader.load(), /CAPACITY_CATALOG_UNAVAILABLE/)
  assert.equal(signal.aborted, true)
  await assert.rejects(loader.load(), /CAPACITY_CATALOG_UNAVAILABLE/)
})

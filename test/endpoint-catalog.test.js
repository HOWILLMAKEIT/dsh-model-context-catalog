import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { parseEndpointCatalog, loadEndpointContexts } from '../src/discovery/endpoint-catalog.js'
import { createCapacityDiscovery } from '../src/discovery/index.js'
import { endpointCatalogUrl, probeEndpointCatalog, registerEndpointDiscovery } from '../src/host/endpoint-catalog.js'
import { routeKey } from '../src/shared/contracts.js'

function fixture(profile = {}) {
  const value = {
    providers: { gateway: { baseURL: 'https://gateway.invalid/proxy/v1', models: [{ id: 'alias' }], ...profile } },
  }
  const secrets = []
  return {
    settings: { describe: () => [{ ns: 'llm-pi-ai', revision: 1, value }] },
    get: (key) =>
      key === 'credentials'
        ? {
            resolve: async (ref) => {
              secrets.push(ref)
              return { value: 'fixture-key' }
            },
          }
        : undefined,
    secrets,
  }
}

test('parses only declared context fields, falls back from invalid values and rejects conflicting duplicate slugs', () => {
  assert.equal(parseEndpointCatalog({ data: [{ id: 'alias', context_window: 123 }] }).status, 'unsupported')
  const parsed = parseEndpointCatalog({
    models: [
      { slug: 'alias', context_window: 0, max_context_window: 200000 },
      { slug: 'output-only', max_tokens: 999999 },
      { slug: 'conflict', context_window: 10 },
      { slug: 'conflict', context_window: 20 },
      { slug: 'bad', context_window: '200000' },
      { slug: 'unsafe', context_window: 2 ** 53 },
      { slug: 'preferred', context_window: 100, max_context_window: 200 },
      { slug: ' ', context_window: 200 },
      null,
    ],
  })
  assert.deepEqual(parsed, {
    status: 'supported',
    models: [
      { id: 'alias', contextWindow: 200000 },
      { id: 'preferred', contextWindow: 100 },
    ],
  })
  assert.equal(parseEndpointCatalog({ models: [] }).status, 'empty')
})

test('preserves deployment prefixes and queries without guessing /v1 or accepting URL credentials', () => {
  assert.equal(
    endpointCatalogUrl('https://gateway.invalid/proxy/v1/?tenant=x#fragment').href,
    'https://gateway.invalid/proxy/v1/models?tenant=x&client_version=1',
  )
  assert.equal(endpointCatalogUrl('http://localhost:8317/prefix').pathname, '/prefix/models')
  for (const url of ['https://user:secret@example.com/v1', 'file:///tmp/test'])
    assert.throws(() => endpointCatalogUrl(url), /CAPACITY_unsupported/)
})

test('host uses stored headers and credentials, returns only exact configured IDs and refuses redirects', async () => {
  const ctx = fixture({ api: 'openai-responses', apiKeyEnv: 'STORED_REF', headers: { 'x-tenant': 'team' } })
  const result = await probeEndpointCatalog(ctx, 'gateway', {
    fetcher: async (url, options) => {
      assert.equal(url.pathname, '/proxy/v1/models')
      assert.equal(url.searchParams.get('client_version'), '1')
      assert.equal(options.headers.get('authorization'), 'Bearer fixture-key')
      assert.equal(options.headers.get('x-tenant'), 'team')
      assert.equal(options.redirect, 'error')
      return Response.json({
        models: [
          { slug: 'alias', context_window: 200000 },
          { slug: 'unconfigured', context_window: 1000000 },
        ],
      })
    },
  })
  assert.deepEqual(result, [{ id: 'alias', contextWindow: 200000 }])
  assert.deepEqual(ctx.secrets, ['STORED_REF'])
  await assert.rejects(probeEndpointCatalog(ctx, 'not-configured'), /CAPACITY_unsupported/)
})

test('host reports safe failures, bounds body bytes, rejects unsupported protocols and honors timeout', async () => {
  for (const [response, message] of [
    [new Response('upstream-secret', { status: 401 }), 'auth'],
    [new Response('', { status: 403 }), 'auth'],
    [new Response('', { status: 404 }), 'unsupported'],
    [Response.json({ data: [] }), 'unsupported'],
    [Response.json({ models: [] }), 'empty'],
    [new Response('not-json-secret'), 'failed'],
    [new Response('small', { headers: { 'content-length': String(5 * 1024 * 1024) } }), 'failed'],
    [new Response('x'.repeat(4 * 1024 * 1024 + 1)), 'failed'],
  ])
    await assert.rejects(probeEndpointCatalog(fixture(), 'gateway', { fetcher: async () => response }), {
      message: `CAPACITY_${message}`,
    })
  await assert.rejects(
    probeEndpointCatalog(fixture(), 'gateway', {
      fetcher: async () => {
        throw new Error('fixture-secret')
      },
    }),
    { message: 'CAPACITY_failed' },
  )
  await assert.rejects(probeEndpointCatalog(fixture({ api: 'anthropic-messages' }), 'gateway'), /CAPACITY_unsupported/)
  await assert.rejects(
    probeEndpointCatalog(fixture(), 'gateway', {
      timeout: 5,
      fetcher: async (_, { signal }) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    }),
    /CAPACITY_timeout/,
  )
})

test('route-specific endpoint values win recommendations, preserve current values and never match aliases across providers', () => {
  const records = [{ kind: 'context', scope: 'model', id: 'alias', contextWindow: 1000000, source: 'models.dev' }]
  const discovery = createCapacityDiscovery(records, { [routeKey('gateway', 'alias')]: 200000 })
  const pi = {
    providers: {
      gateway: { models: [{ id: 'alias' }, { id: 'ALIAS' }] },
      other: { models: [{ id: 'alias' }] },
      configured: { models: [{ id: 'alias', contextWindow: 64000 }] },
    },
  }
  const rows = discovery.scanModels(pi)
  assert.equal(rows[0].recommended.key, 'endpoint:200000')
  assert.equal(rows[0].conflict, true)
  assert.equal(rows[0].selectedByDefault, true)
  assert.equal(rows[0].choices.length, 2)
  assert.equal(rows[1].recommended.contextWindow, 1000000)
  assert.equal(rows[2].recommended.contextWindow, 1000000)
  assert.equal(rows[3].recommended.contextWindow, 64000)
  const entry = discovery.planSelectedEntries(pi, {}, rows, { [rows[0].key]: rows[0].recommended.key }).added[0]
  assert.equal(entry.contextWindow, 200000)
  assert.match(entry.note, /CLIProxyAPI/)
  assert.equal(entry.sourceUrl, '')
})

test('client isolates statuses and limits per-scan concurrency to four provider requests', async () => {
  let active = 0,
    maximum = 0,
    calls = 0
  const providers = ['supported', 'auth', 'unsupported', 'empty', 'throws', 'timeout']
  const result = await loadEndpointContexts(providers, async (provider) => {
    calls++
    active++
    maximum = Math.max(maximum, active)
    await new Promise((resolve) => setImmediate(resolve))
    active--
    if (provider === 'throws') throw new Error('transport')
    if (provider === 'supported') return { ok: true, value: [{ id: 'alias', contextWindow: 200000 }] }
    return { ok: false, error: { message: `CAPACITY_${provider}` } }
  })
  assert.equal(calls, providers.length)
  assert.ok(maximum <= 4)
  assert.equal(result.contexts[routeKey('supported', 'alias')], 200000)
  assert.deepEqual(result.statuses.map((item) => item.status).sort(), [
    'auth',
    'empty',
    'failed',
    'supported',
    'timeout',
    'unsupported',
  ])
})

test('real DSH discovery carrier queries a local CPA fixture, ignores draft endpoints and deduplicates concurrent scans', async () => {
  let requests = 0
  const server = createServer((req, res) => {
    requests++
    assert.equal(req.url, '/proxy/v1/models?client_version=1')
    assert.equal(req.headers.authorization, 'Bearer fixture-key')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ models: [{ slug: 'alias', context_window: 200000 }] }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const ctx = new Context()
  try {
    const host = fixture({ baseURL: `http://127.0.0.1:${server.address().port}/proxy/v1`, apiKeyEnv: 'STORED_REF' })
    ctx.provide('settings', host.settings)
    ctx.provide('credentials', host.get('credentials'))
    const llm = new LlmRuntime(ctx)
    const dispose = registerEndpointDiscovery(ctx)
    const results = await Promise.all(
      [1, 2].map(() =>
        llm.remoteDiscoverModels('model-context-catalog', {
          provider: 'gateway',
          baseURL: 'http://untrusted.invalid',
          apiKey: 'do-not-use',
        }),
      ),
    )
    assert.equal(requests, 1)
    assert.deepEqual(results[0], [{ id: 'alias', contextWindow: 200000 }])
    await assert.rejects(
      llm.remoteDiscoverModels('model-context-catalog', { provider: 'absent' }),
      (error) => error.code === 'llm/model-discovery-rejected' && error.message === 'CAPACITY_unsupported',
    )
    dispose()
  } finally {
    await ctx.fiber.dispose()
    await new Promise((resolve) => server.close(resolve))
  }
})

test('credential resolution is included in the timeout and missing named credentials never fall through to ambient auth', async () => {
  const hanging = fixture({ apiKeyEnv: 'STORED_REF' })
  hanging.get = () => ({ resolve: () => new Promise(() => {}) })
  await assert.rejects(probeEndpointCatalog(hanging, 'gateway', { timeout: 5 }), /CAPACITY_timeout/)
  const missing = fixture({ apiKeyEnv: 'STORED_REF' })
  missing.get = () => ({ resolve: async () => undefined })
  await assert.rejects(probeEndpointCatalog(missing, 'gateway'), /CAPACITY_auth/)
  await assert.rejects(probeEndpointCatalog(fixture({ baseURL: 'invalid-url-with-secret' }), 'gateway'), {
    message: 'CAPACITY_failed',
  })
})

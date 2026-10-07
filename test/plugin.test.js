import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, Config } from '../index.js'
import { catalogSettingsEntries } from '../catalog.js'

const flush = async () => { await new Promise((resolve) => setImmediate(resolve)) }
function fixture({ entries = catalogSettingsEntries([{ provider: 'glm-coding', model: 'glm-5.3', contextWindow: 1000000 }]), section = { providers: { 'glm-coding': { models: [{ id: 'glm-5.3' }] } } } } = {}) {
  const listeners = new Map()
  const updates = []
  const logs = []
  const effects = []
  const state = { revision: 0, section, entries }
  const ctx = {
    settings: {
      configure: (options) => { assert.deepEqual(options, { auto: false }); return () => {} },
      describe: () => state.section === undefined ? [] : [{ ns: 'llm-pi-ai', revision: state.revision, value: state.section }],
      mutate: async (ns, ops, revision) => {
        assert.equal(revision, state.revision)
        updates.push({ ns, ops, revision })
        for (const { path, value } of ops) state.section.providers[path[1]].models[Number(path[3])].contextWindow = value
        state.revision += 1
        listeners.get('settings/document-updated')?.(ns)
      },
    },
    effect: (effect) => { effects.push(effect()) },
    on: (event, listener) => { listeners.set(event, listener); return () => listeners.delete(event) },
    logger: { info: (s) => logs.push(s), warn: (s) => logs.push(s) },
  }
  return { ctx, state, updates, logs, listeners, effects, config: { entries: { get: () => state.entries } } }
}

test('DSH 0.2 Config declares a volatile entries form and keeps enabled defaults', () => {
  assert.equal(Config.dict.entries.meta.volatile, true)
  assert.deepEqual(Config({}).entries.get(), {})
  const resolved = Config({ entries: { 'custom::model': { provider: 'custom', model: 'model', contextWindow: 64000 } } })
  assert.equal(resolved.entries.get()['custom::model'].enabled, true)
})

test('retains existing saved routes and their disabled state without adding defaults', async () => {
  const entries = { 'custom::alias': { provider: 'custom', model: 'alias', contextWindow: 64000, enabled: false } }
  const resolved = Config({ entries })
  assert.deepEqual(resolved.entries.get(), entries)
  const f = fixture({ entries: resolved.entries.get(), section: { providers: { custom: { models: [{ id: 'alias', contextWindow: 32000 }] } } } })
  apply(f.ctx, f.config)
  await flush()
  assert.equal(f.updates.length, 0)
  assert.equal(f.state.section.providers.custom.models[0].contextWindow, 32000)
})

test('uses the DSH 0.2 descriptor and path mutation APIs; converges after its event', async () => {
  const f = fixture()
  const dispose = apply(f.ctx, f.config)
  await flush()
  assert.equal(f.updates.length, 1)
  assert.deepEqual(f.updates[0].ops, [{ op: 'set', path: ['providers', 'glm-coding', 'models', '0', 'contextWindow'], value: 1000000 }])
  assert.equal(f.state.section.providers['glm-coding'].models[0].contextWindow, 1000000)
  dispose()
  assert.equal(f.listeners.size, 0)
})

test('retries revision conflict and re-resolves a reordered model array', async () => {
  const f = fixture()
  let attempts = 0
  const mutate = f.ctx.settings.mutate
  f.ctx.settings.mutate = async (...args) => {
    attempts += 1
    if (attempts === 1) {
      f.state.section.providers['glm-coding'].models.unshift({ id: 'other', contextWindow: 32000 })
      f.state.revision += 1
      throw Object.assign(new Error('conflict'), { code: 'SETTINGS_CONFLICT' })
    }
    return mutate(...args)
  }
  apply(f.ctx, f.config)
  await flush()
  assert.equal(attempts, 2)
  assert.equal(f.updates[0].ops[0].path[3], '1')
  assert.equal(f.state.section.providers['glm-coding'].models[0].contextWindow, 32000)
})

test('preserves gateway credentials, model aliases, output limits and unknown fields', async () => {
  const row = { id: 'gpt-6-astra-cdx', maxTokens: 1234, headers: { Authorization: 'fixture-secret' }, extra: { marker: 7 } }
  const f = fixture({ entries: { x: { provider: 'dmx', model: row.id, contextWindow: 64000 } }, section: { providers: { dmx: { models: [row], baseURL: 'https://gateway.invalid/v1', apiKeyEnv: 'TEST_KEY' } } } })
  apply(f.ctx, f.config)
  await flush()
  assert.equal(row.contextWindow, 64000)
  assert.equal(row.headers.Authorization, 'fixture-secret')
  assert.equal(row.maxTokens, 1234)
  assert.deepEqual(row.extra, { marker: 7 })
  assert.equal(f.updates[0].ops.length, 1)
  assert.equal(JSON.stringify(f.updates).includes('fixture-secret'), false)
})

test('reacts to catalog volatile updates and stops writing once an entry is disabled', async () => {
  const f = fixture()
  apply(f.ctx, f.config)
  await flush()
  f.state.entries = { x: { provider: 'glm-coding', model: 'glm-5.3', contextWindow: 500000 } }
  f.listeners.get('loader/volatile-update')()
  await flush()
  assert.equal(f.state.section.providers['glm-coding'].models[0].contextWindow, 500000)
  f.state.entries.x.enabled = false
  f.state.section.providers['glm-coding'].models[0].contextWindow = 123
  f.listeners.get('settings/document-updated')('model-context-catalog')
  await flush()
  assert.equal(f.state.section.providers['glm-coding'].models[0].contextWindow, 123)
})

test('does not write unavailable namespaces, unreadable catalog data, or disposed work', async () => {
  for (const scenario of ['namespace', 'catalog', 'disposed']) {
    const f = fixture()
    if (scenario === 'namespace') f.state.section = undefined
    if (scenario === 'catalog') f.state.entries = undefined
    const dispose = apply(f.ctx, f.config)
    if (scenario === 'disposed') dispose()
    await flush()
    assert.equal(f.updates.length, 0)
  }
})

test('bounds repeated CAS conflicts and logs a non-conflict failure', async () => {
  const f = fixture()
  let attempts = 0
  f.ctx.settings.mutate = async () => { attempts += 1; throw Object.assign(new Error('conflict'), { code: 'SETTINGS_CONFLICT' }) }
  apply(f.ctx, f.config)
  await flush()
  assert.equal(attempts, 3)
  assert.match(f.logs.at(-1), /settings kept changing/)
  f.ctx.settings.mutate = async () => { throw new Error('write failed') }
  f.listeners.get('loader/volatile-update')()
  await flush()
  assert.match(f.logs.at(-1), /write failed/)
})

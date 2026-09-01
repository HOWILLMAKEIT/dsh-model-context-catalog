import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, CatalogSettingsSchema } from '../index.js'
import { catalogSettingsEntries } from '../catalog.js'

test('catalog settings schema accepts built-ins and applies enabled defaults', () => {
  const resolved = CatalogSettingsSchema({ entries: {
    'custom::model': { provider: 'custom', model: 'model', contextWindow: 64_000 },
  } })
  assert.equal(resolved.entries['custom::model'].enabled, true)
  assert.equal(resolved.entries['custom::model'].contextWindow, 64_000)
})

const catalogRegistration = () => ({
  get: () => ({ entries: catalogSettingsEntries() }),
  watch: () => () => {},
})

test('plugin persists a minimal correction and converges after its own event', async () => {
  let section = {
    providers: {
      'glm-coding': {
        api: 'openai-completions',
        models: [{ id: 'glm-5.3' }],
      },
    },
  }
  const listeners = new Map()
  const updates = []
  const logs = []
  let revision = 0
  const ctx = {
    settings: {
      register: catalogRegistration,
      get: (ns) => ns === 'llm-pi-ai' ? section : undefined,
      describe: () => [{ ns: 'llm-pi-ai', revision }],
      update: async (ns, patch, expectedRevision) => {
        assert.equal(expectedRevision, revision)
        updates.push({ ns, patch, expectedRevision })
        section = {
          ...section,
          providers: {
            ...section.providers,
            'glm-coding': {
              ...section.providers['glm-coding'],
              ...patch.providers['glm-coding'],
            },
          },
        }
        revision += 1
        listeners.get('settings/document-updated')?.('llm-pi-ai', revision)
      },
    },
    llm: {},
    logger: {
      info: (message) => logs.push(message),
      warn: (message) => logs.push(message),
    },
    on: (event, listener) => {
      listeners.set(event, listener)
      return () => listeners.delete(event)
    },
  }

  const dispose = apply(ctx)
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(updates.length, 1)
  assert.equal(section.providers['glm-coding'].models[0].contextWindow, 1_000_000)
  assert.match(logs[0], /glm-coding\/glm-5\.3/)

  dispose()
  assert.equal(listeners.has('settings/document-updated'), false)
})

test('plugin retries a revision conflict without overwriting the newer model row', async () => {
  let revision = 4
  let section = { providers: { 'glm-coding': { models: [{ id: 'glm-5.3', name: 'old' }] } } }
  let attempts = 0
  const ctx = {
    settings: {
      register: catalogRegistration,
      get: () => section,
      describe: () => [{ ns: 'llm-pi-ai', revision }],
      update: async (_ns, patch, expectedRevision) => {
        attempts += 1
        if (attempts === 1) {
          section = { providers: { 'glm-coding': { models: [{ id: 'glm-5.3', name: 'newer' }] } } }
          revision += 1
          const conflict = new Error('conflict')
          conflict.code = 'SETTINGS_CONFLICT'
          throw conflict
        }
        assert.equal(expectedRevision, revision)
        section = { providers: { 'glm-coding': { models: patch.providers['glm-coding'].models } } }
      },
    },
    llm: {},
    logger: { info: () => {}, warn: () => {} },
    on: () => () => {},
  }

  apply(ctx)
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(attempts, 2)
  assert.deepEqual(section.providers['glm-coding'].models[0], {
    id: 'glm-5.3',
    name: 'newer',
    contextWindow: 1_000_000,
  })
})

test('plugin tolerates an unreadable catalog scope without touching llm-pi-ai', async () => {
  let section = { providers: { 'glm-coding': { models: [{ id: 'glm-5.3' }] } } }
  const updates = []
  const logs = []
  const ctx = {
    settings: {
      register: () => ({ get: () => undefined, watch: () => () => {} }),
      get: (ns) => ns === 'llm-pi-ai' ? section : undefined,
      describe: () => [{ ns: 'llm-pi-ai', revision: 0 }],
      update: async (ns, patch) => { updates.push({ ns, patch }) },
    },
    llm: {},
    logger: { info: (message) => logs.push(message), warn: (message) => logs.push(message) },
    on: () => () => {},
  }

  const dispose = apply(ctx)
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(updates.length, 0)
  assert.equal(section.providers['glm-coding'].models[0].contextWindow, undefined)
  dispose()
})

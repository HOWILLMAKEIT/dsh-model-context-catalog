import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activeCatalogFromSettings,
  catalogEntryKey,
  catalogSettingsEntries,
  contextMetadata,
  planPiAiContextUpdate,
} from '../catalog.js'

test('corrects the configured GLM routes and preserves every other field', () => {
  const section = {
    providers: {
      'glm-coding': {
        baseURL: 'https://example.invalid/v4',
        models: [
          { id: 'glm-5.3', name: 'GLM', maxTokens: 123 },
          { id: 'glm-5.3-flash', input: ['text'], contextWindow: 262_144 },
          { id: 'future-model', contextWindow: 42 },
        ],
      },
    },
  }

  const plan = planPiAiContextUpdate(section)
  assert.deepEqual(plan.corrections.map(({ provider, model, from, to }) => ({ provider, model, from, to })), [
    { provider: 'glm-coding', model: 'glm-5.3', from: undefined, to: 1_000_000 },
    { provider: 'glm-coding', model: 'glm-5.3-flash', from: 262_144, to: 1_000_000 },
  ])
  assert.deepEqual(plan.patch.providers['glm-coding'].models, [
    { id: 'glm-5.3', name: 'GLM', maxTokens: 123, contextWindow: 1_000_000 },
    { id: 'glm-5.3-flash', input: ['text'], contextWindow: 1_000_000 },
    { id: 'future-model', contextWindow: 42 },
  ])
  assert.equal(section.providers['glm-coding'].models[0].contextWindow, undefined)
})

test('returns no patch when configured capacities already match', () => {
  const plan = planPiAiContextUpdate({
    providers: {
      'glm-coding': {
        models: [
          { id: 'glm-5.3', contextWindow: 1_000_000 },
          { id: 'glm-5.3-flash', contextWindow: 1_000_000 },
        ],
      },
    },
  })
  assert.equal(plan.patch, null)
  assert.deepEqual(plan.corrections, [])
})

test('keeps route-specific limits for the same model id', () => {
  assert.equal(contextMetadata('glm-coding', 'glm-5.3').contextWindow, 1_000_000)
  assert.equal(contextMetadata('ark-agent-plan-cn', 'glm-5.3').contextWindow, 1_024_000)
})

test('round-trips the settings catalog and omits disabled entries', () => {
  const entries = catalogSettingsEntries()
  const key = catalogEntryKey('glm-coding', 'glm-5.3')
  entries[key] = { ...entries[key], enabled: false }
  entries['custom::model'] = {
    provider: 'custom',
    model: 'model',
    contextWindow: 42_000,
    sourceUrl: 'https://example.invalid',
    note: 'user entry',
    enabled: true,
  }
  const active = activeCatalogFromSettings(entries)
  assert.equal(active.some((item) => item.provider === 'glm-coding' && item.model === 'glm-5.3'), false)
  assert.equal(active.find((item) => item.provider === 'custom').contextWindow, 42_000)
})

test('ignores malformed, unknown, and catalog-only provider rows', () => {
  const plan = planPiAiContextUpdate({
    providers: {
      broken: null,
      unknown: { models: [{ id: 'x' }] },
      'ark-agent-plan-cn': { displayName: 'base supplies models elsewhere' },
    },
  })
  assert.equal(plan.patch, null)
})

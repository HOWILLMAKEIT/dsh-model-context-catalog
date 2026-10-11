import assert from 'node:assert/strict'
import test from 'node:test'
import { capacitySourceNote, readableSourceNote } from '../src/domain/source-notes.js'

const legacy = 'models.dev · DeepSeek · Volcengine Ark Coding Plan · deepseek-v4-flash · limit.context'
const providerUrl = 'https://models.dev/providers/volcengine-coding-plan'

test('source notes distinguish the service provider from the model manufacturer', () => {
  const evidence = {
    scope: 'provider',
    manufacturerName: 'DeepSeek',
    providerName: 'Volcengine Ark Coding Plan',
    source: 'models.dev',
  }
  assert.equal(capacitySourceNote(evidence), 'Volcengine Ark Coding Plan (models.dev)')
  assert.equal(capacitySourceNote({ ...evidence, scope: 'model' }), 'DeepSeek (models.dev)')
})

test('legacy automatic notes remain readable without mutating stored entries', () => {
  const entry = { note: legacy, sourceUrl: providerUrl, contextWindow: 1000000 }
  assert.equal(readableSourceNote(entry), 'Volcengine Ark Coding Plan (models.dev)')
  assert.equal(entry.note, legacy)
  assert.equal(entry.sourceUrl, providerUrl)
  const model = {
    note: 'models.dev · MiniMax · Model default · minimax/MiniMax-M3 · limit.context',
    sourceUrl: 'https://models.dev/models/minimax/MiniMax-M3',
  }
  assert.equal(readableSourceNote(model), 'MiniMax (models.dev)')
})

test('manual notes, non-catalog links and incomplete legacy formats stay untouched', () => {
  for (const entry of [
    { note: '按套餐文档确认，2026-10-11', sourceUrl: providerUrl },
    { note: legacy, sourceUrl: 'https://example.com/providers/volcengine-coding-plan' },
    { note: legacy, sourceUrl: 'https://models.dev/models/deepseek/deepseek-v4-flash' },
    { note: legacy, sourceUrl: 'invalid URL' },
    { note: legacy, sourceUrl: 'https://models.dev/api.json' },
    { note: legacy + ' · 手写补充', sourceUrl: providerUrl },
    { note: legacy.replace('limit.context', 'max_input_tokens'), sourceUrl: providerUrl },
    { note: 'Volcengine Ark Coding Plan (models.dev)', sourceUrl: providerUrl },
  ]) {
    assert.equal(readableSourceNote(entry), entry.note)
  }
  assert.equal(readableSourceNote({}), '')
})

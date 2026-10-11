import assert from 'node:assert/strict'
import test from 'node:test'
import { createCapacityDiscovery, loadNativeContexts } from '../src/discovery/index.js'
import { normalizeCapacitySources } from '../src/data/normalize.js'
import { REFERENCE_MODEL_CAPACITIES, CAPACITY_CATALOG_INFO } from '../src/data/model-capacities.js'

const record = (id, contextWindow = 1000000, overrides = {}) => ({
  id,
  name: id,
  provider: 'zai',
  scope: 'model',
  manufacturer: 'zhipuai',
  manufacturerName: 'Zhipu AI',
  contextWindow,
  kind: 'context',
  source: 'models.dev',
  field: 'limit.context',
  sourceUrl: 'https://models.dev/api.json',
  ...overrides,
})
const records = [
  record('glm-5.3'),
  record('glm-5.3-flash', 128000),
  record('glm-4.7', 204800),
  record('gpt-4.1', 1047576, { provider: 'openai' }),
  record('gpt-4.1-mini', 1047576, { provider: 'openai' }),
]
const discovery = createCapacityDiscovery(records)
const profile = (models) => ({ providers: { custom: { models, apiKey: 'secret-not-to-copy' } } })

test('matches case, separators, namespaces, and display names without rewriting routes', () => {
  for (const id of ['GLM-5.3', 'glm_5_3', 'GLM 5.3', 'proxy/GLM-5.3']) {
    assert.equal(discovery.matchModel(id).recommended.contextWindow, 1000000)
  }
  const named = discovery.matchModel('opaque-deployment', 'GLM-5.3 (Coding Plan)')
  assert.equal(named.method, 'name')
  assert.equal(named.recommended.contextWindow, 1000000)
  const rows = discovery.scanModels(profile([{ id: 'opaque-deployment', name: 'GLM-5.3 (Coding Plan)' }]))
  assert.equal(rows[0].model, 'opaque-deployment')
  assert.equal(rows[0].selectedByDefault, false)
})

test('date and deployment-version suffixes match, but semantic versions and variants stay distinct', () => {
  for (const id of [
    'GLM-5.3-20260814',
    'glm-5.3-2026-08-14',
    'glm-5.3-latest',
    'glm-5.3-v2',
    'glm-5.3-20260814-latest',
  ]) {
    const matched = discovery.matchModel(id)
    assert.equal(matched.method, 'version')
    assert.equal(matched.recommended.contextWindow, 1000000)
    assert.equal(discovery.scanModels(profile([{ id }]))[0].selectedByDefault, false)
  }
  for (const id of ['glm-5.2', 'glm-5.3-flashx', 'glm-5.3-thinking', 'gpt-4.1-nano', 'unrecognized']) {
    assert.equal(discovery.matchModel(id).choices.length, 0, id)
  }
  assert.equal(discovery.matchModel('glm-5.3-flash').recommended.contextWindow, 128000)
  const deepseek = createCapacityDiscovery([record('deepseek-v3')])
  assert.equal(deepseek.matchModel('deepseek-v2').choices.length, 0)
  assert.equal(deepseek.matchModel('deepseek').choices.length, 0)
})

test('input-only records are excluded; dated aliases use full context with confirmation', () => {
  const d = createCapacityDiscovery([
    record('gpt-4.1', 1047576, { provider: 'openai' }),
    record('gpt-4.1-2025-04-14', 1047576, {
      provider: 'openai',
      kind: 'input',
      source: 'LiteLLM',
      field: 'max_input_tokens',
    }),
    record('---', 4096),
  ])
  const row = d.scanModels(profile([{ id: 'GPT-4.1-20250414' }]))[0]
  assert.equal(row.method, 'version')
  assert.equal(row.recommended.contextWindow, 1047576)
  assert.equal(row.choices.length, 1)
  assert.equal(row.selectedByDefault, false)
  assert.equal(d.matchModel('___').choices.length, 0)
})

test('matches provider IDs and names; unknown custom providers use only canonical defaults', () => {
  const d = createCapacityDiscovery([
    record('glm-5.3', 1000000),
    record('glm-5.3', 327680, { provider: 'gateway', providerName: 'Example Gateway', scope: 'provider' }),
  ])
  assert.equal(d.matchModel('glm-5.3', undefined, 'gateway').recommended.contextWindow, 327680)
  assert.equal(d.matchModel('glm-5.3', undefined, 'GATE_WAY').recommended.contextWindow, 327680)
  assert.equal(d.matchModel('glm-5.3', undefined, 'custom', 'Example Gateway').recommended.contextWindow, 327680)
  const custom = d.matchModel('glm-5.3', undefined, 'custom')
  assert.equal(custom.recommended.contextWindow, 1000000)
  assert.equal(custom.recommended.evidence[0].provider, 'zai')
  assert.equal(custom.referenceScope, 'model')
  assert.equal(custom.choices.length, 1)
  const onlyGateway = createCapacityDiscovery([record('glm-5.3', 327680, { provider: 'gateway', scope: 'provider' })])
  assert.equal(onlyGateway.matchModel('glm-5.3', undefined, 'custom').choices.length, 0)
})

test('MiniMax M3 default matches the model catalog while a named provider retains its deployment limit', () => {
  const d = createCapacityDiscovery(REFERENCE_MODEL_CAPACITIES)
  const fallback = d.matchModel('minimax-m3', 'MiniMax M3 (Agent Plan)', 'custom-gateway')
  assert.equal(fallback.choices.length, 1)
  assert.equal(fallback.recommended.contextWindow, 1048576)
  assert.equal(fallback.recommended.evidence[0].manufacturerName, 'MiniMax')
  assert.equal(fallback.referenceScope, 'model')
  const nativeProvider = d.matchModel('minimax-m3', undefined, 'MiniMax')
  assert.equal(nativeProvider.recommended.contextWindow, 1000000)
  assert.equal(nativeProvider.referenceScope, 'provider')
  assert.match(nativeProvider.recommended.evidence[0].providerName, /MiniMax/)
})

test('Ark plan aliases use the subscription provider without conflating ordinary Ark routes', () => {
  const d = createCapacityDiscovery([
    record('minimax-m3', 1048576),
    record('minimax-m3', 1024000, {
      scope: 'provider',
      provider: 'volcengine-coding-plan',
      providerName: 'Volcengine Ark Coding Plan',
    }),
    record('minimax-m3', 128000, { scope: 'provider', provider: 'volcengine', providerName: 'Volcengine Ark' }),
  ])
  for (const alias of ['ark-agent-plan-cn', 'ARK_CODING_PLAN_CN', 'ark-agent-plan', 'ark-coding-plan']) {
    const matched = d.matchModel('MiniMax-M3', undefined, alias)
    assert.equal(matched.referenceScope, 'provider')
    assert.equal(matched.recommended.contextWindow, 1024000)
    assert.equal(matched.recommended.evidence[0].provider, 'volcengine-coding-plan')
  }
  assert.equal(d.matchModel('minimax-m3', undefined, 'volcengine').recommended.contextWindow, 128000)
  assert.equal(d.matchModel('minimax-m3', undefined, 'ark-production-proxy').referenceScope, 'model')
  const bundled = createCapacityDiscovery(REFERENCE_MODEL_CAPACITIES).matchModel(
    'minimax-m3',
    undefined,
    'ark-agent-plan-cn',
  )
  assert.equal(bundled.referenceScope, 'provider')
  assert.equal(bundled.recommended.contextWindow, 1048576)
  assert.equal(bundled.recommended.evidence[0].sourceUrl, 'https://models.dev/providers/volcengine-coding-plan')
})

test('ambiguous full-context evidence is never selected by default', () => {
  const d = createCapacityDiscovery([
    record('unknown-coder', 128000, { provider: 'a' }),
    record('unknown-coder', 256000, { provider: 'b' }),
  ])
  const row = d.scanModels(profile([{ id: 'unknown-coder' }]))[0]
  assert.equal(row.conflict, true)
  assert.equal(row.recommended, undefined)
  assert.equal(row.selectedByDefault, false)
})

test('scans accurate and native windows too, while excluding routes already managed', () => {
  const pi = profile([{ id: 'GLM-5.3' }, { id: 'glm-5.3-flash', contextWindow: 128000 }, { id: 'glm-4.7' }, null])
  pi.providers.zai = { models: [{ id: 'glm-5.3' }] }
  pi.providers.empty = { models: 'invalid' }
  const entries = { disabled: { provider: 'custom', model: 'glm-4.7', contextWindow: 204800, enabled: false } }
  const rows = discovery.scanModels(pi, entries, { zai: { 'glm-5.3': 1000000 } })
  assert.deepEqual(
    rows.map((r) => r.model),
    ['GLM-5.3', 'glm-5.3-flash', 'glm-5.3'],
  )
  assert.equal(rows[0].selectedByDefault, true)
  assert.equal(rows[1].reason, 'same')
  assert.equal(rows[1].selectedByDefault, false)
  assert.equal(rows[2].windowSource, 'native')
  assert.equal(rows[2].recommended.contextWindow, 1000000)
  assert.equal(rows[2].selectedByDefault, false)
  assert.equal(discovery.scanModels({ providers: { zai: {} } }).length, 0)
  assert.equal(pi.providers.custom.models[0].contextWindow, undefined)
})

test('deleted management entries can be re-added using their existing accurate window', () => {
  const pi = profile([{ id: 'glm-5.3', contextWindow: 1000000, maxTokens: 1234 }])
  const entries = { old: { provider: 'custom', model: 'glm-5.3', contextWindow: 1000000, enabled: true } }
  assert.equal(discovery.scanModels(pi, entries).length, 0)
  delete entries.old
  const [row] = discovery.scanModels(pi, entries)
  assert.equal(row.reason, 'same')
  assert.equal(row.selectedByDefault, false)
  const plan = discovery.planSelectedEntries(pi, entries, [row], { [row.key]: row.recommended.key })
  assert.equal(plan.added[0].contextWindow, 1000000)
  assert.equal(pi.providers.custom.models[0].maxTokens, 1234)
})

test('adopting a different or unknown configured window preserves it unless a reference is chosen', () => {
  const pi = profile([
    { id: 'glm-5.3', contextWindow: 64000 },
    { id: 'private-model', contextWindow: 96000 },
  ])
  const rows = discovery.scanModels(pi)
  assert.equal(rows[0].recommended.contextWindow, 64000)
  assert.equal(rows[1].hasReference, false)
  const selections = Object.fromEntries(rows.map((row) => [row.key, row.recommended.key]))
  const kept = discovery.planSelectedEntries(pi, {}, rows, selections)
  assert.deepEqual(
    kept.added.map((entry) => entry.contextWindow),
    [64000, 96000],
  )
  assert.equal(kept.added[0].sourceUrl, '')
  assert.equal(kept.added[0].note, '')
  const reference = rows[0].choices.find((choice) => choice.contextWindow === 1000000)
  const updated = discovery.planSelectedEntries(pi, {}, rows, { [rows[0].key]: reference.key })
  assert.equal(updated.added[0].contextWindow, 1000000)
  assert.equal(updated.added[0].note, 'Zhipu AI (models.dev)')
})

test('provider defaults and native windows can be adopted without treating them as public references', () => {
  const pi = profile([{ id: 'private-model' }])
  pi.providers.custom.defaultContextWindow = 32000
  const [defaults] = discovery.scanModels(pi)
  assert.equal(defaults.windowSource, 'provider')
  assert.equal(defaults.recommended.contextWindow, 32000)
  assert.equal(defaults.selectedByDefault, false)
  const [native] = discovery.scanModels(pi, {}, { custom: { 'private-model': 64000 } })
  assert.equal(native.windowSource, 'native')
  assert.equal(native.recommended.contextWindow, 64000)
  assert.equal(native.recommended.evidence[0].scope, 'configured')
  const plan = discovery.planSelectedEntries(
    pi,
    {},
    [native],
    { [native.key]: native.recommended.key },
    {
      custom: { 'private-model': 64000 },
    },
  )
  assert.equal(plan.added[0].contextWindow, 64000)
  assert.equal(plan.added[0].sourceUrl, '')
})

test('adoption refuses a changed configuration origin even when the capacity stays equal', () => {
  const pi = profile([{ id: 'glm-5.3' }])
  pi.providers.custom.defaultContextWindow = 1000000
  const [row] = discovery.scanModels(pi)
  pi.providers.custom.models[0].contextWindow = 1000000
  assert.throws(
    () => discovery.planSelectedEntries(pi, {}, [row], { [row.key]: row.recommended.key }),
    /STALE_CANDIDATES/,
  )
})

test('different explicit values and provider defaults need opt-in; invalid values need repair', () => {
  const pi = profile([
    { id: 'glm-5.3', contextWindow: 262144 },
    { id: 'glm-5.3-flash', contextWindow: 0 },
  ])
  const rows = discovery.scanModels(pi, {}, { custom: { 'glm-5.3-flash': 128000 } })
  assert.equal(rows[0].reason, 'different')
  assert.equal(rows[0].selectedByDefault, false)
  assert.equal(rows[1].reason, 'missing')
  assert.equal(rows[1].selectedByDefault, true)
  pi.providers.custom.defaultContextWindow = 262144
  assert.equal(discovery.scanModels(pi)[1].selectedByDefault, false)
})

test('batch plan adds only checked exact routes and keeps existing entries and all model fields', () => {
  const pi = profile([
    { id: 'GLM-5.3', name: 'Raw Name', maxTokens: 321, headers: { token: 'fixture-secret' } },
    { id: 'glm-5.3-flash' },
  ])
  const entries = { kept: { provider: 'custom', model: 'unrelated', enabled: false, note: 'keep' } }
  const rows = discovery.scanModels(pi, entries)
  const plan = discovery.planSelectedEntries(pi, entries, rows, { [rows[0].key]: rows[0].recommended.key })
  assert.equal(plan.added.length, 1)
  assert.equal(plan.added[0].model, 'GLM-5.3')
  assert.equal(plan.added[0].enabled, true)
  assert.equal(plan.added[0].note, 'Zhipu AI (models.dev)')
  assert.equal(plan.added[0].sourceUrl, rows[0].recommended.evidence[0].sourceUrl)
  assert.equal(plan.entries.kept, entries.kept)
  assert.equal(Object.hasOwn(plan.entries, 'custom::glm-5.3-flash'), false)
  assert.equal(pi.providers.custom.models[0].contextWindow, undefined)
  assert.equal(pi.providers.custom.models[0].maxTokens, 321)
  assert.equal(JSON.stringify(plan).includes('fixture-secret'), false)
  assert.equal(JSON.stringify(plan).includes('secret-not-to-copy'), false)
})

test('stale batch plans refuse removed routes, new declarations, or new managed entries', () => {
  for (const change of [
    (pi) => {
      pi.providers.custom.models = []
    },
    (pi) => {
      pi.providers.custom.models[0].contextWindow = 64000
    },
    (_pi, entries) => {
      entries.other = { provider: 'custom', model: 'glm-5.3', enabled: false }
    },
  ]) {
    const pi = profile([{ id: 'glm-5.3' }]),
      entries = {}
    const rows = discovery.scanModels(pi, entries)
    change(pi, entries)
    assert.throws(
      () => discovery.planSelectedEntries(pi, entries, rows, { [rows[0].key]: rows[0].recommended.key }),
      /STALE_CANDIDATES/,
    )
  }
})

test('only full context fields become references; other limits never become candidates', () => {
  const normalized = normalizeCapacitySources({
    malformed: null,
    p: {
      models: {
        malformed: null,
        chat: { name: 'Chat', limit: { context: 200000, output: 8192 }, modalities: { output: ['text'] } },
        image: { limit: { context: 4096 }, modalities: { output: ['image'] } },
        input: { limit: { input: 190000, output: 8192 }, modalities: { output: ['text'] } },
        output: { limit: { output: 8192 }, modalities: { output: ['text'] } },
      },
    },
  })
  assert.deepEqual(
    normalized.map((r) => [r.id, r.kind, r.contextWindow]),
    [['chat', 'context', 200000]],
  )
  const inputOnly = createCapacityDiscovery([record('input', 190000, { kind: 'input' })]).scanModels(
    profile([{ id: 'input' }]),
  )[0]
  assert.equal(inputOnly.choices.length, 0)
  assert.equal(inputOnly.selectedByDefault, false)
})

test('native catalog lookup uses only provider names, respects errors and bounds concurrency', async () => {
  let active = 0,
    maximum = 0
  const providers = Array.from({ length: 9 }, (_, i) => `provider-${i}`)
  const native = await loadNativeContexts(providers, async (provider) => {
    active += 1
    maximum = Math.max(maximum, active)
    await new Promise((resolve) => setImmediate(resolve))
    active -= 1
    return provider === 'provider-0'
      ? { ok: true, value: [{ id: 'glm-5.3', contextWindow: 1000000 }] }
      : { ok: false, error: { code: 'llm/model-discovery-rejected' } }
  })
  assert.equal(maximum, 4)
  assert.equal(native['provider-0']['glm-5.3'], 1000000)
  await assert.rejects(loadNativeContexts(['x'], undefined), /NATIVE_CATALOG_UNAVAILABLE/)
  await assert.rejects(
    loadNativeContexts(['x'], async () => ({ ok: false, error: { code: 'gateway/unavailable' } })),
    /NATIVE_CATALOG_UNAVAILABLE/,
  )
})

test('bundled reference snapshot covers mainstream coding families with positive sourced capacities', () => {
  assert.equal(CAPACITY_CATALOG_INFO.records, REFERENCE_MODEL_CAPACITIES.length)
  assert.ok(REFERENCE_MODEL_CAPACITIES.length > 1000)
  const d = createCapacityDiscovery(REFERENCE_MODEL_CAPACITIES)
  for (const id of [
    'gpt-4.1',
    'claude-sonnet-4-5',
    'gemini-2.5-pro',
    'GLM-5.3',
    'Qwen3-Coder-Plus',
    'deepseek-chat',
    'kimi-k2',
  ]) {
    assert.ok(d.matchModel(id).choices.length, id)
  }
  for (const item of REFERENCE_MODEL_CAPACITIES) {
    assert.ok(Number.isSafeInteger(item.contextWindow) && item.contextWindow > 0)
    assert.equal(item.source, 'models.dev')
    assert.equal(item.kind, 'context')
    assert.ok(['model', 'provider'].includes(item.scope))
  }
})

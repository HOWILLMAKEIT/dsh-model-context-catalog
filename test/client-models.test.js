import assert from 'node:assert/strict'
import test from 'node:test'

const clientUrl = new URL('../client.js', import.meta.url)

async function loadPlugin(tag) {
  let registration
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  try {
    await import(`${clientUrl.href}?test=client-models-${tag}`)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
  assert.equal(registration.id, 'dsh-model-context-catalog')
  return registration.factory((id) => {
    assert.equal(id, 'react')
    return { createElement: () => null }
  })
}

const samplePi = () => ({
  providers: {
    'ark-agent-plan-cn': {
      displayName: 'Ark Agent Plan',
      models: [
        { id: 'doubao-seed-2.1-pro', name: 'Doubao Seed 2.1 Pro (Agent Plan)', contextWindow: 256_000 },
        { id: 'doubao-seed-2.0-mini', name: 'Doubao Seed 2.0 Mini (Agent Plan)', contextWindow: 256_000 },
      ],
    },
    'glm-coding': {
      models: [
        { id: 'glm-5.3', contextWindow: 1_000_000 },
        { id: 'glm-5.3-flash', name: '', contextWindow: 1_000_000 },
      ],
    },
    'broken': { displayName: 'Broken', models: 'not-an-array' },
    'empty-provider': { displayName: '', models: [{ contextWindow: 1 }, null, { id: 7 }] },
  },
})

test('model names stay faithful to the configured rows, "(Agent Plan)" suffixes included', async () => {
  const plugin = await loadPlugin('names')
  const pi = samplePi()
  const options = plugin.configuredModels(pi)
  const byValue = new Map(options.map((option) => [option.value, option]))

  assert.equal(byValue.get('ark-agent-plan-cn\u0000doubao-seed-2.1-pro').modelName, 'Doubao Seed 2.1 Pro (Agent Plan)')
  assert.equal(byValue.get('ark-agent-plan-cn\u0000doubao-seed-2.0-mini').modelName, 'Doubao Seed 2.0 Mini (Agent Plan)')
  assert.equal(byValue.get('glm-coding\u0000glm-5.3').modelName, 'glm-5.3')
  assert.equal(byValue.get('glm-coding\u0000glm-5.3-flash').modelName, 'glm-5.3-flash')

  const clone = samplePi()
  assert.deepEqual(pi, clone)
})

test('provider identity keeps the configured displayName and the raw key', async () => {
  const plugin = await loadPlugin('providers')
  const options = plugin.configuredModels(samplePi())
  const byValue = new Map(options.map((option) => [option.value, option]))

  assert.equal(byValue.get('ark-agent-plan-cn\u0000doubao-seed-2.1-pro').providerName, 'Ark Agent Plan')
  assert.equal(byValue.get('ark-agent-plan-cn\u0000doubao-seed-2.1-pro').provider, 'ark-agent-plan-cn')
  assert.equal(byValue.get('glm-coding\u0000glm-5.3').providerName, 'glm-coding')
})

test('rows without a configured models array and invalid model rows are skipped', async () => {
  const plugin = await loadPlugin('skips')
  const options = plugin.configuredModels(samplePi())

  assert.equal(options.some((option) => option.provider === 'broken'), false)
  assert.equal(options.some((option) => option.provider === 'empty-provider'), false)
  assert.deepEqual(options.map((option) => option.model), [
    'doubao-seed-2.0-mini', 'doubao-seed-2.1-pro', 'glm-5.3', 'glm-5.3-flash',
  ])
})

test('search text covers provider key, displayName, model id, and verbatim name', async () => {
  const plugin = await loadPlugin('search')
  const [pro] = plugin.configuredModels(samplePi()).filter((option) => option.model === 'doubao-seed-2.1-pro')

  for (const needle of ['ark-agent-plan-cn', 'ark agent plan', 'doubao-seed-2.1-pro', 'doubao seed 2.1 pro (agent plan)']) {
    assert.equal(pro.searchText.includes(needle), true, `searchText should include ${needle}`)
  }
  assert.equal(plugin.filterOptions([{ searchText: 'x' }, pro], 'agent plan')[0], pro)
  assert.equal(plugin.filterOptions([pro], 'zzz-no-hit').length, 0)
})

test('grouping is deterministic and ordered by displayName then provider key', async () => {
  const plugin = await loadPlugin('groups')
  const pi = samplePi()
  pi.providers['aardvark-route'] = { displayName: 'Ark Agent Plan', models: [{ id: 'glm-5.3' }] }

  const groups = plugin.groupModelsByProvider(plugin.configuredModels(pi))
  assert.deepEqual(groups.map((group) => group.provider), ['aardvark-route', 'ark-agent-plan-cn', 'glm-coding'])
  assert.equal(groups[0].title, 'Ark Agent Plan')
  assert.equal(groups[1].title, 'Ark Agent Plan')
  assert.equal(groups[1].options.length, 2)
  assert.deepEqual(groups.map((group) => group.provider), plugin.groupModelsByProvider(plugin.configuredModels(pi)).map((group) => group.provider))
})

test('filtering with an empty query returns every option', async () => {
  const plugin = await loadPlugin('filter')
  const options = plugin.configuredModels(samplePi())
  assert.deepEqual(plugin.filterOptions(options, '   '), options)
  assert.equal(plugin.filterOptions(options, 'glm').length, 2)
})

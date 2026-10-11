import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createCatalogLoader } from '../src/data/catalog-loader.js'
import { CATALOG_CACHE_VERSION } from '../src/data/catalog-source.js'
import { REFERENCE_MODEL_CAPACITIES } from './fixtures/model-capacities.js'
import { IDBFactory } from 'fake-indexeddb'

async function fixture({
  accepted = true,
  writable = true,
  language = 'zh',
  native = {},
  unavailable = false,
  catalogLoader,
} = {}) {
  let registration
  const previous = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load: (value) => {
        registration = value
      },
    },
  }
  try {
    await import(`../lib/client.js?bulk=${Math.random()}`)
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
  const plugin = registration.factory((id) => {
    assert.equal(id, 'react')
    return React
  })
  const state = {
    catalog: {
      status: 'ready',
      writable,
      revision: 7,
      value: {
        entries: {
          kept: { provider: 'other', model: 'managed', contextWindow: 64000, enabled: false },
        },
      },
    },
    pi: {
      status: 'ready',
      revision: 8,
      value: {
        providers: {
          custom: {
            apiKey: 'fixture-secret',
            models: [
              { id: 'GLM-5.3', name: 'GLM Coding' },
              { id: 'GLM-5.3-20260814' },
              { id: 'glm-5.3-flash', contextWindow: 64000 },
              { id: 'unknown-model' },
            ],
          },
        },
      },
    },
  }
  const mutations = [],
    probes = [],
    listeners = new Set()
  const catalogScope = {
    getSnapshot: () => state.catalog,
    subscribe: (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    mutate: async (ops, revision) => {
      mutations.push({ ops, revision })
      if (!accepted) return false
      const entries = { ...state.catalog.value.entries }
      for (const op of ops) {
        if (op.op === 'unset') delete entries[op.path[1]]
        else entries[op.path[1]] = op.value
      }
      state.catalog = { ...state.catalog, revision: revision + 1, value: { entries } }
      for (const f of listeners) f()
      return true
    },
  }
  const piScope = { getSnapshot: () => state.pi, subscribe: () => () => {} }
  let dictionaries, Page, props
  plugin.apply({
    get: () => ({
      llm: {
        discoverModels: async (ns, request) => {
          probes.push({ ns, request })
          if (unavailable) throw new Error('transport unavailable')
          return native[request.provider]
            ? { ok: true, value: native[request.provider] }
            : { ok: false, error: { code: 'llm/model-discovery-rejected' } }
        },
      },
    }),
    configForms: { get: (ns) => (ns === 'model-context-catalog' ? catalogScope : piScope) },
    locale: {
      bind:
        () =>
        (key, params = {}) =>
          dictionaries[language][key].replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`)),
      register: (_ns, value) => {
        dictionaries = value
        return () => {}
      },
    },
    effect: (effect, label) => {
      if (!label.includes('styles')) effect()
    },
    slots: {
      inject: (_name, register) => register(),
      register: (options, component) => {
        Page = component
        props = options.inject()
        return () => {}
      },
    },
  })
  if (catalogLoader !== false)
    props.catalogLoader =
      catalogLoader ??
      createCatalogLoader({
        cache: {
          read: async () => ({
            version: CATALOG_CACHE_VERSION,
            fetchedAt: Date.now(),
            records: REFERENCE_MODEL_CAPACITIES,
          }),
        },
        fetcher: async () => {
          throw new Error('unexpected external request')
        },
      })
  let tree
  await act(async () => {
    tree = TestRenderer.create(React.createElement(Page, props))
  })
  return { tree, state, mutations, probes }
}
const button = (tree, label) => tree.root.findAllByType('button').find((node) => node.children.includes(label))
const selected = (tree) =>
  tree.root.findAllByType('input').filter((node) => node.props.type === 'checkbox' && node.props.checked)

test('built client fetches on click, displays downloaded metadata, and reuses persisted references without extra buttons', async () => {
  const previousFetch = globalThis.fetch
  const previousIndexedDB = globalThis.indexedDB
  const requests = []
  globalThis.indexedDB = new IDBFactory()
  globalThis.fetch = async (...args) => {
    requests.push(args)
    const model = { name: 'GLM 5.3', limit: { context: 123456 }, modalities: { output: ['text'] } }
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          providers: {
            zai: { name: 'Z.AI', models: { 'glm-5.3': { ...model, canonical_model_id: 'zhipuai/glm-5.3' } } },
          },
          models: { 'zhipuai/glm-5.3': model },
        }),
    }
  }
  let f, reopened
  try {
    f = await fixture({ catalogLoader: false })
    assert.equal(requests.length, 0)
    assert.deepEqual(
      f.tree.root
        .findAllByType('button')
        .slice(0, 2)
        .map((node) => node.children[0]),
      ['添加模型', '一键匹配'],
    )
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.equal(requests.length, 1)
    assert.match(JSON.stringify(f.tree.toJSON()), /1 个模型|已获取最新资料/)
    assert.doesNotMatch(JSON.stringify(f.tree.toJSON()), /451 个模型/)
    assert.equal(f.mutations.length, 0)
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    assert.equal(f.mutations[0].ops[0].value.contextWindow, 123456)
    assert.equal(requests.length, 1)
    reopened = await fixture({ catalogLoader: false })
    await act(async () => button(reopened.tree, '一键匹配').props.onClick())
    assert.match(JSON.stringify(reopened.tree.toJSON()), /使用 24 小时内缓存/)
    assert.equal(requests.length, 1)
    assert.equal(requests[0][0], 'https://models.dev/catalog.json')
    assert.equal(JSON.stringify(requests).includes('fixture-secret'), false)
  } finally {
    f?.tree.unmount()
    reopened?.tree.unmount()
    globalThis.fetch = previousFetch
    if (previousIndexedDB === undefined) delete globalThis.indexedDB
    else globalThis.indexedDB = previousIndexedDB
  }
})

test('network failure keeps manual management available and displays stale-data status in both locales', async () => {
  for (const language of ['zh', 'en']) {
    const empty = await fixture({
      language,
      catalogLoader: createCatalogLoader({
        cache: { read: async () => undefined },
        fetcher: async () => {
          throw new Error('offline')
        },
      }),
    })
    try {
      await act(async () => button(empty.tree, language === 'zh' ? '一键匹配' : 'Match models').props.onClick())
      assert.match(
        empty.tree.root.findByProps({ role: 'alert' }).children.join(''),
        language === 'zh' ? /无法获取容量资料/ : /Cannot fetch capacity references/,
      )
      assert.equal(empty.mutations.length, 0)
      await act(async () => button(empty.tree, language === 'zh' ? '添加模型' : 'Add model').props.onClick())
      assert.ok(empty.tree.root.findByType('form'))
    } finally {
      empty.tree.unmount()
    }
    const stale = await fixture({
      language,
      catalogLoader: createCatalogLoader({
        cache: {
          read: async () => ({
            version: CATALOG_CACHE_VERSION,
            fetchedAt: Date.now() - 86400001,
            records: REFERENCE_MODEL_CAPACITIES,
          }),
        },
        fetcher: async () => {
          throw new Error('offline')
        },
      }),
    })
    try {
      await act(async () => button(stale.tree, language === 'zh' ? '一键匹配' : 'Match models').props.onClick())
      assert.match(
        JSON.stringify(stale.tree.toJSON()),
        language === 'zh' ? /更新失败，使用上次资料/ : /Refresh failed; using previous references/,
      )
      assert.equal(stale.mutations.length, 0)
    } finally {
      stale.tree.unmount()
    }
  }
})

test('configuration changed while downloading is rejected before displaying candidates', async () => {
  let finish
  const pending = new Promise((resolve) => {
    finish = resolve
  })
  const f = await fixture({ catalogLoader: { load: () => pending } })
  try {
    let scanning
    await act(async () => {
      scanning = button(f.tree, '一键匹配').props.onClick()
    })
    assert.equal(button(f.tree, '匹配中…').props.disabled, true)
    f.state.pi = { ...f.state.pi, revision: f.state.pi.revision + 1 }
    await act(async () => {
      finish({ records: REFERENCE_MODEL_CAPACITIES })
      await scanning
    })
    assert.match(f.tree.root.findByProps({ role: 'alert' }).children.join(''), /请重新匹配/)
    assert.equal(f.mutations.length, 0)
    assert.equal(f.tree.root.findAllByType('table').length, 0)
  } finally {
    f.tree.unmount()
  }
})

test('existing accurate entries remain available after deletion and can be re-added', async () => {
  const f = await fixture()
  try {
    f.state.pi.value.providers.custom.models = [{ id: 'GLM-5.3', contextWindow: 1000000 }]
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.equal(selected(f.tree).length, 0)
    await act(async () => button(f.tree, '全选').props.onClick())
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    const card = f.tree.root
      .findAllByProps({ className: 'mcc-card' })
      .find((node) =>
        node.findAllByProps({ className: 'mcc-route' }).some((r) => r.children.includes('custom / GLM-5.3')),
      )
    const remove = card.findAllByType('button').find((node) => node.children.includes('删除'))
    await act(async () => remove.props.onClick())
    assert.equal(Object.hasOwn(f.state.catalog.value.entries, 'custom::GLM-5.3'), false)
    assert.equal(f.state.pi.value.providers.custom.models[0].contextWindow, 1000000)
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.equal(f.tree.root.findByProps({ 'aria-label': '添加 custom / GLM-5.3' }).props.disabled, false)
    await act(async () => button(f.tree, '全选').props.onClick())
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    assert.equal(f.state.catalog.value.entries['custom::GLM-5.3'].contextWindow, 1000000)
  } finally {
    f.tree.unmount()
  }
})

test('Astra aliases show review and sourced alternatives in both locales, with existing windows preserved until selection', async () => {
  for (const language of ['zh', 'en']) {
    const f = await fixture({ language })
    try {
      f.state.pi.value.providers = { dmx: { models: [{ id: 'gpt-6-astra-cdx', contextWindow: 1000000 }] } }
      await act(async () => button(f.tree, language === 'zh' ? '一键匹配' : 'Match models').props.onClick())
      assert.equal(selected(f.tree).length, 0)
      const menu = f.tree.root.findByType('select')
      assert.equal(menu.props.value, 'configured:1000000')
      assert.ok(menu.findAllByType('option').some((option) => option.children.join('').includes('OpenAI')))
      assert.match(
        JSON.stringify(f.tree.toJSON()),
        language === 'zh' ? /模型信息匹配，待确认/ : /Model identity match; review/,
      )
      assert.equal(f.mutations.length, 0)
      await act(async () => menu.props.onChange({ target: { value: 'context:1050000' } }))
      const link = f.tree.root
        .findAllByType('a')
        .find((node) => node.props.href === 'https://models.dev/models/openai/gpt-6-astra')
      assert.ok(link)
      const sourceUrl = link.props.href
      const checkbox = f.tree.root.findAllByType('input').find((node) => node.props.type === 'checkbox')
      await act(async () => checkbox.props.onChange({ target: { checked: true } }))
      await act(async () =>
        button(f.tree, language === 'zh' ? '添加并启用 1 个模型' : 'Add and enable 1 models').props.onClick(),
      )
      const entry = f.state.catalog.value.entries['dmx::gpt-6-astra-cdx']
      assert.equal(entry.contextWindow, 1050000)
      assert.equal(entry.sourceUrl, sourceUrl)
      assert.equal(entry.model, 'gpt-6-astra-cdx')
    } finally {
      f.tree.unmount()
    }
  }
})

test('adopting configured windows keeps their values and exposes references as an explicit alternative', async () => {
  const f = await fixture()
  try {
    f.state.pi.value.providers.custom.models = [
      { id: 'GLM-5.3', contextWindow: 64000 },
      { id: 'private-model', contextWindow: 96000 },
    ]
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.equal(selected(f.tree).length, 0)
    const choices = f.tree.root.findByType('select')
    assert.equal(choices.props.value, 'configured:64000')
    assert.match(JSON.stringify(f.tree.toJSON()), /保留当前窗口|容量来源：当前模型配置/)
    assert.equal(f.tree.root.findByProps({ 'aria-label': '添加 custom / private-model' }).props.disabled, false)
    await act(async () => button(f.tree, '全选').props.onClick())
    await act(async () => button(f.tree, '添加并启用 2 个模型').props.onClick())
    assert.deepEqual(
      f.mutations[0].ops.map((op) => op.value.contextWindow),
      [64000, 96000],
    )
    assert.ok(f.mutations[0].ops.every((op) => op.value.sourceUrl === '' && op.value.note === ''))
  } finally {
    f.tree.unmount()
  }
  const changed = await fixture()
  try {
    changed.state.pi.value.providers.custom.models = [{ id: 'GLM-5.3', contextWindow: 64000 }]
    await act(async () => button(changed.tree, '一键匹配').props.onClick())
    const select = changed.tree.root.findByType('select')
    await act(async () => select.props.onChange({ target: { value: 'context:1000000' } }))
    await act(async () => button(changed.tree, '全选').props.onClick())
    await act(async () => button(changed.tree, '添加并启用 1 个模型').props.onClick())
    assert.equal(changed.mutations[0].ops[0].value.contextWindow, 1000000)
    assert.match(changed.mutations[0].ops[0].value.sourceUrl, /^https:\/\/models.dev\/models\//)
  } finally {
    changed.tree.unmount()
  }
})

test('bulk preview sends only provider names to DSH and writes nothing until confirmation', async () => {
  const f = await fixture()
  try {
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.deepEqual(f.probes, [{ ns: 'llm-pi-ai', request: { provider: 'custom' } }])
    assert.equal(f.mutations.length, 0)
    assert.equal(selected(f.tree).length, 1)
    assert.match(JSON.stringify(f.tree.toJSON()), /日期 \/ 版本后缀匹配|默认保留|未找到资料/)
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    assert.equal(f.mutations.length, 1)
    assert.equal(f.mutations[0].ops.length, 1)
    const op = f.mutations[0].ops[0]
    assert.deepEqual(op.path, ['entries', 'custom::GLM-5.3'])
    assert.equal(op.value.contextWindow, 1000000)
    assert.equal(Object.hasOwn(f.state.catalog.value.entries, 'kept'), true)
    assert.equal(JSON.stringify(f.mutations).includes('fixture-secret'), false)
    assert.equal(f.state.pi.value.providers.custom.models[0].contextWindow, undefined)
  } finally {
    f.tree.unmount()
  }
})

test('checkboxes and select-all control which matched models are added, unmatched models stay excluded', async () => {
  const f = await fixture()
  try {
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    await act(async () => button(f.tree, '取消全选').props.onClick())
    assert.equal(selected(f.tree).length, 0)
    assert.equal(button(f.tree, '添加并启用 0 个模型').props.disabled, true)
    await act(async () => button(f.tree, '全选').props.onClick())
    assert.equal(selected(f.tree).length, 3)
    const version = f.tree.root.findByProps({ 'aria-label': '添加 custom / GLM-5.3-20260814' })
    await act(async () => version.props.onChange({ target: { checked: false } }))
    await act(async () => button(f.tree, '添加并启用 2 个模型').props.onClick())
    assert.deepEqual(
      f.mutations[0].ops.map((op) => op.value.model),
      ['GLM-5.3', 'glm-5.3-flash'],
    )
  } finally {
    f.tree.unmount()
  }
})

test('capacity rows name the manufacturer and source, and do not merge unrelated provider choices', async () => {
  const f = await fixture()
  try {
    f.state.pi.value.providers.custom.models = [{ id: 'minimax-m3' }]
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    const content = JSON.stringify(f.tree.toJSON())
    assert.match(content, /1,048,576/)
    assert.match(content, /模型厂家：MiniMax/)
    assert.match(content, /容量来源：模型默认值/)
    assert.equal(f.tree.root.findAllByType('select').length, 0)
    assert.doesNotMatch(content, /512,000|262,144/)
    await act(async () => button(f.tree, '取消').props.onClick())
    f.state.pi.value.providers.custom.displayName = 'MiniMax (minimax.io)'
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.match(JSON.stringify(f.tree.toJSON()), /1,000,000/)
    assert.match(JSON.stringify(f.tree.toJSON()), /容量来源：MiniMax \(minimax.io\)/)
  } finally {
    f.tree.unmount()
  }
})

test('batch refuses stale model configuration and leaves the preview open', async () => {
  const f = await fixture()
  try {
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    f.state.pi = {
      ...f.state.pi,
      revision: 9,
      value: { providers: { custom: { models: [{ id: 'GLM-5.3', contextWindow: 64000 }] } } },
    }
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    assert.equal(f.mutations.length, 0)
    assert.ok(f.tree.root.findByProps({ 'aria-label': '选择要管理的模型' }))
    assert.match(f.tree.root.findByProps({ role: 'alert' }).children.join(''), /请重新匹配/)
  } finally {
    f.tree.unmount()
  }
})

test('batch displays form refusal and allows retry without claiming success', async () => {
  const f = await fixture({ accepted: false })
  try {
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    assert.ok(button(f.tree, '添加并启用 1 个模型'))
    assert.match(f.tree.root.findByProps({ role: 'alert' }).children.join(''), /配置已变更/)
    assert.equal(Object.hasOwn(f.state.catalog.value.entries, 'custom::GLM-5.3'), false)
  } finally {
    f.tree.unmount()
  }
})

test('installed catalog windows can be managed; unavailable lookup stops automatic filling', async () => {
  const f = await fixture({
    native: {
      custom: [
        { id: 'GLM-5.3', contextWindow: 1000000 },
        { id: 'GLM-5.3-20260814', contextWindow: 1000000 },
      ],
    },
  })
  try {
    await act(async () => button(f.tree, '一键匹配').props.onClick())
    assert.equal(selected(f.tree).length, 0)
    const row = f.tree.root.findByProps({ 'aria-label': '添加 custom / GLM-5.3' })
    assert.equal(row.props.disabled, false)
    await act(async () => row.props.onChange({ target: { checked: true } }))
    await act(async () => button(f.tree, '添加并启用 1 个模型').props.onClick())
    assert.equal(f.mutations[0].ops[0].value.contextWindow, 1000000)
  } finally {
    f.tree.unmount()
  }
  const unavailable = await fixture({ unavailable: true })
  try {
    await act(async () => button(unavailable.tree, '一键匹配').props.onClick())
    assert.match(unavailable.tree.root.findByProps({ role: 'alert' }).children.join(''), /无法核对 DSH 内置窗口/)
    assert.equal(unavailable.mutations.length, 0)
  } finally {
    unavailable.tree.unmount()
  }
})

test('read-only and English bulk flows expose the same selection controls', async () => {
  const readOnly = await fixture({ writable: false })
  try {
    assert.equal(button(readOnly.tree, '一键匹配').props.disabled, true)
  } finally {
    readOnly.tree.unmount()
  }
  const english = await fixture({ language: 'en' })
  try {
    await act(async () => button(english.tree, 'Match models').props.onClick())
    assert.ok(button(english.tree, 'Add and enable 1 models'))
    assert.match(JSON.stringify(english.tree.toJSON()), /Managed window and source/)
  } finally {
    english.tree.unmount()
  }
})

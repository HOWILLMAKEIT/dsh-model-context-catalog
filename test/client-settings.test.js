import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'

async function pageFixture({ accepted = true, writable = true, defaulted = false, enabled = true, missing = false, language = 'zh' } = {}) {
  let registration
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  try { await import(`../client.js?settings=${Math.random()}`) }
  finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow }
  const plugin = registration.factory((id) => { assert.equal(id, 'react'); return React })
  const entry = { provider: 'dmx', model: 'alias', contextWindow: 64000, sourceUrl: 'https://example.invalid/capacity', note: '', enabled }
  const mutations = []
  let snapshot = { status: 'ready', value: { entries: { 'dmx::alias': entry } }, user: { entries: { 'dmx::alias': entry } }, base: { entries: {} }, revision: 7, writable }
  const pi = { status: 'ready', value: { providers: { dmx: { defaultContextWindow: 64000, models: missing ? [] : [{ id: 'alias', name: 'Alias (Plan)', ...defaulted ? {} : { contextWindow: 64000 } }] } } } }
  const listeners = new Set()
  const catalogScope = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    mutate: async (ops, revision) => {
      mutations.push({ ops, revision })
      if (accepted) {
        const entries = { ...snapshot.value.entries }
        for (const op of ops) { if (op.op === 'unset') delete entries[op.path[1]]; else entries[op.path[1]] = op.value }
        snapshot = { ...snapshot, value: { entries }, revision: snapshot.revision + 1 }
        for (const listener of listeners) listener()
      }
      return accepted
    },
    dispose: () => { throw new Error('shared form must not be disposed') },
  }
  const piScope = { getSnapshot: () => pi, subscribe: () => () => {}, dispose: catalogScope.dispose }
  const cleanups = []
  let dictionaries, Page, props
  const ctx = {
    configForms: { get: (ns) => ns === 'model-context-catalog' ? catalogScope : piScope },
    locale: { bind: () => (key, params = {}) => dictionaries[language][key].replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`)), register: (_ns, value) => { dictionaries = value; return () => {} } },
    effect: (effect, label) => { if (!label.includes('styles')) cleanups.push(effect()) },
    slots: { inject: (_name, register) => register(), register: (options, component) => { Page = component; props = options.inject(); return () => {} } },
  }
  plugin.apply(ctx)
  let tree
  await act(async () => { tree = TestRenderer.create(React.createElement(Page, props)) })
  return { tree, mutations, cleanups, plugin }
}
const button = (tree, label) => tree.root.findAllByType('button').find((node) => node.children.includes(label))

test('DSH form refusal leaves the editor open and displays a failure', async () => {
  const f = await pageFixture({ accepted: false })
  try {
    await act(async () => button(f.tree, '编辑').props.onClick())
    await act(async () => f.tree.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    assert.equal(f.tree.root.findAllByType('form').length, 1)
    assert.match(JSON.stringify(f.tree.toJSON()), /配置已变更或当前无法写入/)
    assert.equal(f.mutations[0].revision, 7)
  } finally { f.tree.unmount(); for (const dispose of f.cleanups) dispose() }
})

test('accepted edits persist capacity and source only on the selected catalog entry', async () => {
  const f = await pageFixture()
  try {
    await act(async () => button(f.tree, '编辑').props.onClick())
    const numeric = f.tree.root.findAllByType('input').find((n) => n.props.type === 'number')
    await act(async () => numeric.props.onChange({ target: { value: '96000' } }))
    await act(async () => f.tree.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    assert.equal(f.tree.root.findAllByType('form').length, 0)
    assert.equal(f.mutations[0].ops.length, 1)
    assert.deepEqual(f.mutations[0].ops[0].path, ['entries', 'dmx::alias'])
    assert.equal(f.mutations[0].ops[0].value.contextWindow, 96000)
    assert.equal(f.mutations[0].ops[0].value.sourceUrl, 'https://example.invalid/capacity')
  } finally { f.tree.unmount() }
})

test('a fallback equal to the managed capacity still produces a sync notice', async () => {
  const f = await pageFixture({ defaulted: true })
  try {
    const text = JSON.stringify(f.tree.toJSON())
    assert.match(text, /模型配置尚未同步/)
    assert.doesNotMatch(text, /已生效|路由默认值|插件预置|自定义/)
  } finally { f.tree.unmount() }
})

test('read-only views disable add, toggle, remove and save', async () => {
  const f = await pageFixture({ writable: false })
  try {
    for (const label of ['添加模型', '删除']) assert.equal(button(f.tree, label).props.disabled, true)
    assert.equal(f.tree.root.findByProps({ role: 'switch' }).props.disabled, true)
    await act(async () => button(f.tree, '编辑').props.onClick())
    assert.equal(button(f.tree, '保存').props.disabled, true)
  } finally { f.tree.unmount() }
})

test('normal rows show only the enable switch; toggling preserves their contents', async () => {
  const f = await pageFixture()
  try {
    assert.doesNotMatch(JSON.stringify(f.tree.toJSON()), /已生效|插件预置|路由默认值|自定义|尚未同步/)
    assert.equal(f.tree.root.findByProps({ role: 'switch' }).props['aria-checked'], true)
    await act(async () => f.tree.root.findByProps({ role: 'switch' }).props.onClick())
    assert.equal(f.tree.root.findByProps({ role: 'switch' }).props['aria-checked'], false)
    assert.equal(f.mutations[0].ops[0].value.enabled, false)
    assert.equal(f.mutations[0].ops[0].value.contextWindow, 64000)
    assert.equal(f.mutations[0].ops[0].value.sourceUrl, 'https://example.invalid/capacity')
  } finally { f.tree.unmount() }
})

test('editing a disabled entry does not silently enable its management', async () => {
  const f = await pageFixture({ enabled: false, defaulted: true })
  try {
    assert.equal(f.tree.root.findAllByProps({ role: 'status' }).length, 0)
    await act(async () => button(f.tree, '编辑').props.onClick())
    await act(async () => f.tree.root.findAllByType('input').find((n) => n.props.type === 'number').props.onChange({ target: { value: '96000' } }))
    await act(async () => f.tree.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    assert.equal(f.mutations[0].ops[0].value.enabled, false)
    assert.equal(f.tree.root.findByProps({ role: 'switch' }).props['aria-checked'], false)
  } finally { f.tree.unmount() }
})

test('a missing route produces an actionable notice only while enabled', async () => {
  const f = await pageFixture({ missing: true })
  try {
    assert.match(JSON.stringify(f.tree.toJSON()), /请重新添加模型或删除此条目/)
    await act(async () => f.tree.root.findByProps({ role: 'switch' }).props.onClick())
    assert.equal(f.tree.root.findAllByProps({ role: 'status' }).length, 0)
  } finally { f.tree.unmount() }
})

test('a refused switch change stays checked and displays an error outside the editor', async () => {
  const f = await pageFixture({ accepted: false })
  try {
    await act(async () => f.tree.root.findByProps({ role: 'switch' }).props.onClick())
    assert.equal(f.tree.root.findByProps({ role: 'switch' }).props['aria-checked'], true)
    assert.equal(f.tree.root.findAllByType('form').length, 0)
    assert.match(f.tree.root.findByProps({ role: 'alert' }).children.join(''), /当前无法写入/)
  } finally { f.tree.unmount() }
})

test('English rows use the same enable-only interface', async () => {
  const f = await pageFixture({ language: 'en' })
  try {
    assert.equal(f.tree.root.findByProps({ role: 'switch' }).props['aria-label'], 'Enable context window management for dmx / alias')
    assert.doesNotMatch(JSON.stringify(f.tree.toJSON()), /Plugin preset|Reset preset|Route default|Applied|Custom/)
    assert.ok(button(f.tree, 'Delete'))
  } finally { f.tree.unmount() }
})

test('catalog path edits leave unrelated entries out of the write', async () => {
  const f = await pageFixture()
  try {
    assert.deepEqual(f.plugin.entryMutations({ a: { n: 1 }, b: { n: 2 } }, { a: { n: 1 }, b: { n: 3 } }), [{ op: 'set', path: ['entries', 'b'], value: { n: 3 } }])
  } finally { f.tree.unmount() }
})

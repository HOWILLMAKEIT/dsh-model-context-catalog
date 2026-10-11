import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clientUrl = new URL('../lib/client.js', import.meta.url)

test('overlapping hot reload keeps the replacement stylesheet after old cleanup', async () => {
  let registration
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const nodes = []
  globalThis.window = { __ModuleLoader__: { load: (value) => (registration = value) } }
  globalThis.document = {
    querySelector: () => nodes[0],
    createElement: () => {
      const node = { dataset: {}, remove: () => nodes.splice(nodes.indexOf(node), 1) }
      return node
    },
    head: { append: (node) => nodes.push(node) },
  }
  try {
    await import(`${clientUrl.href}?styles=${Date.now()}`)
    const plugin = registration.factory(() => ({ createElement: () => null }))
    const disposals = []
    const ctx = {
      configForms: { get: () => ({}) },
      locale: { bind: () => () => '' },
      slots: { inject: () => {} },
      effect: (effect, label) => {
        if (label.includes('styles')) disposals.push(effect())
      },
    }
    plugin.apply(ctx)
    plugin.apply(ctx)
    disposals[0]()
    assert.equal(nodes.length, 1)
    assert.match(nodes[0].textContent, /\.mcc-page/)
    disposals[1]()
    assert.equal(nodes.length, 0)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})

test('client bundle registers the expected DSH module and service contract', async () => {
  let registration
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load: (value) => {
        registration = value
      },
    },
  }
  try {
    await import(`${clientUrl.href}?test=${Date.now()}`)
    assert.equal(registration.id, 'dsh-model-context-catalog')
    const ReactStub = {
      createElement: () => null,
      useState: () => [undefined, () => {}],
      useCallback: (value) => value,
      useSyncExternalStore: () => ({}),
    }
    const plugin = registration.factory((id) => {
      assert.equal(id, 'react')
      return ReactStub
    })
    assert.equal(typeof plugin.apply, 'function')
    assert.deepEqual(plugin.inject, ['slots', 'locale', 'configForms', 'remote', 'remote.llm'])
    assert.equal(typeof plugin.configuredModels, 'function')
    assert.equal(typeof plugin.groupModelsByProvider, 'function')
    assert.equal(typeof plugin.filterOptions, 'function')
    assert.equal(typeof plugin.floatingMenuLayout, 'function')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('floating menu positions a wide fixed dropdown within the viewport', async () => {
  let registration
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load: (value) => {
        registration = value
      },
    },
  }
  try {
    await import(`${clientUrl.href}?test=${Date.now()}`)
    const ReactStub = {
      createElement: () => null,
      useState: () => [undefined, () => {}],
      useCallback: (value) => value,
      useSyncExternalStore: () => ({}),
    }
    const plugin = registration.factory((id) => (id === 'react' ? ReactStub : {}))
    const wide = plugin.floatingMenuLayout({ left: 1800, width: 200, bottom: 600, top: 560 }, 1900, 900)
    assert.equal(wide.position, 'fixed')
    assert.equal(wide.width, '240px')
    assert.ok(parseInt(wide.left, 10) + parseInt(wide.width, 10) <= 1900)
    const nearBottom = plugin.floatingMenuLayout({ left: 100, width: 240, bottom: 890, top: 860 }, 1200, 900)
    assert.ok(parseInt(nearBottom.top, 10) < 860)
    assert.ok(parseInt(nearBottom['--mcc-menu-list-max'], 10) > 0)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('model menu keeps the compact official-style visual contract', () => {
  const source =
    readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8') +
    readFileSync(new URL('../src/client/components/model-combobox.js', import.meta.url), 'utf8')

  assert.match(source, /mcc-combo-option\.selected\s*\{\s*background:\s*var\(--dsw-alias-interactive-bg-hover/)
  assert.match(source, /mcc-combo-group-sub/)
  assert.match(source, /`· \$\{group\.provider\}`/)
  assert.match(source, /scrollbar-width:\s*thin/)
  assert.match(source, /mcc-combo-search:focus-visible\s*\{\s*outline:\s*none/)
  assert.doesNotMatch(source, /mcc-combo-check/)
  assert.doesNotMatch(source, /t\('modelCount'/)
  assert.doesNotMatch(source, /className: 'mcc-combo-secondary'/)
})

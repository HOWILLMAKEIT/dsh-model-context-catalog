import assert from 'node:assert/strict'
import test from 'node:test'

const clientUrl = new URL('../client.js', import.meta.url)

test('client bundle registers the expected DSH module and service contract', async () => {
  let registration
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load: (value) => { registration = value },
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
    assert.deepEqual(plugin.inject, ['slots', 'locale', 'settingsScope'])
    assert.equal(typeof plugin.configuredModels, 'function')
    assert.equal(typeof plugin.groupModelsByProvider, 'function')
    assert.equal(typeof plugin.filterOptions, 'function')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'))

test('package-lock resolves only from the official npm registry', async () => {
  const lock = await readJson('package-lock.json')
  const content = JSON.stringify(lock)
  assert.equal(content.includes('registry.npmmirror.com'), false, 'lockfile still references the npmmirror registry')
  const urls = Object.values(lock.packages)
    .flatMap((entry) => [entry.resolved, entry.locked])
    .filter((url) => typeof url === 'string')
  assert.ok(urls.length > 0, 'lockfile has no tarball URLs to validate')
  for (const url of urls) {
    assert.ok(url.startsWith('https://registry.npmjs.org/'), `non-official resolved URL: ${url}`)
  }
})

test('package files boundary and export targets stay stable', async () => {
  const pkg = await readJson('package.json')
  assert.deepEqual(pkg.files, [
    'lib',
    'assets',
    'cordis.patch.yml',
    'README.md',
    'CONTRIBUTING.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
  ])
  assert.deepEqual(pkg.exports, {
    '.': './lib/index.js',
    './catalog': './lib/catalog.js',
    './client': './lib/client.js',
    './package.json': './package.json',
  })
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/')
  for (const target of ['lib/index.js', 'lib/catalog.js', 'lib/client.js']) {
    await assert.doesNotReject(() => readFile(path.join(root, target), 'utf8'), `missing build output ${target}`)
  }
})

test('bundled host and capacity modules preserve their source exports and route patch behavior', async () => {
  for (const [built, source] of [
    ['index', 'host/index'],
    ['catalog', 'domain/catalog'],
    ['discovery', 'discovery/index'],
  ]) {
    const [output, input] = await Promise.all([import(`../lib/${built}.js`), import(`../src/${source}.js`)])
    assert.deepEqual(Object.keys(output).sort(), Object.keys(input).sort(), `${built} export contract changed`)
    if (built === 'catalog') {
      const section = { providers: { gateway: { models: [{ id: 'alias', contextWindow: 32000, apiKey: 'keep' }] } } }
      const entries = [{ provider: 'gateway', model: 'alias', contextWindow: 64000 }]
      assert.deepEqual(output.planPiAiContextUpdate(section, entries), input.planPiAiContextUpdate(section, entries))
    }
  }
})

test('built lib/client.js registers as the DSH client module with its contract', async () => {
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
    const built = new URL('../lib/client.js?test=package', import.meta.url)
    await import(built.href)
    assert.equal(registration.id, 'dsh-model-context-catalog')
    const plugin = registration.factory((id) => {
      assert.equal(id, 'react')
      return { createElement: () => null }
    })
    assert.equal(typeof plugin.apply, 'function')
    assert.deepEqual(plugin.inject, ['slots', 'locale', 'configForms', 'remote', 'remote.llm'])
    assert.equal(typeof plugin.configuredModels, 'function')
    assert.equal(typeof plugin.groupModelsByProvider, 'function')
    assert.equal(typeof plugin.filterOptions, 'function')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

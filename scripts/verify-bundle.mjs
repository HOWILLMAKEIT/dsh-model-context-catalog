/**
 * Bundle smoke gate: proves the published surface is coherent without any
 * heavyweight tooling.
 *
 * 1. lib/ is byte-identical to the module bundles build.mjs produces.
 * 2. The built lib/client.js still registers as a DSH client module and keeps
 *    its factory export contract.
 * 3. `npm pack --dry-run` ships exactly the declared file set (stable package
 *    boundary). --ignore-scripts keeps this safe to run from `npm run check`.
 *
 * Uses the same esbuild options as the build; Node >= 22.
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import { BUILD_SOURCES, buildOutput } from './build-source.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sources = BUILD_SOURCES

// 1. lib/ matches build.mjs output byte for byte.
for (const file of sources) {
  const [output, built] = await Promise.all([
    buildOutput(new URL('../', import.meta.url), file),
    readFile(path.join(root, 'lib', file), 'utf8'),
  ])
  assert.equal(built, output.code, `lib/${file} is stale; run npm run build`)
  if (file === 'client.js') {
    assert.ok(
      Object.keys(output.metadata.inputs).every(
        (input) => !input.startsWith('src/host/') && !input.startsWith('test/') && !input.includes('node_modules/'),
      ),
      'browser bundle must not include host code or a second React runtime',
    )
    assert.ok(
      Object.values(output.metadata.outputs).every((item) => item.imports.length === 0),
      'DSH browser entry must be self-contained; React comes from the module loader',
    )
  }
}
console.log(`verify-bundle: lib/ in sync with ${sources.length} sources`)

// 2. The built client module registers and keeps its export contract.
{
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
    const clientUrl = new URL(`../lib/client.js?smoke=${Date.now()}`, import.meta.url)
    await import(clientUrl.href)
    assert.equal(registration.id, 'dsh-model-context-catalog')
    const plugin = registration.factory((id) => {
      assert.equal(id, 'react')
      return { createElement: () => null }
    })
    assert.deepEqual(plugin.inject, ['slots', 'locale', 'configForms', 'remote', 'remote.llm'])
    for (const key of ['apply', 'configuredModels', 'groupModelsByProvider', 'filterOptions']) {
      assert.equal(typeof plugin[key], 'function', `lib/client.js factory export "${key}" missing`)
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}
console.log('verify-bundle: lib/client.js registers with the expected contract')

// 3. The package boundary is exactly the declared file set.
const expectedFiles = [
  'package.json',
  'LICENSE',
  'README.md',
  'CONTRIBUTING.md',
  'THIRD_PARTY_NOTICES.md',
  'cordis.patch.yml',
  'lib/catalog.js',
  'lib/client.js',
  'lib/index.js',
  'lib/discovery.js',
  'assets/settings.png',
  'assets/image.png',
].sort()
const stdout = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--loglevel=error'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
  shell: process.platform === 'win32',
})
const packed = JSON.parse(stdout)
const entry = Array.isArray(packed) ? packed[0] : packed
const shipped = entry.files.map((file) => file.path).sort()
assert.deepEqual(shipped, expectedFiles, 'packed file set drifted from the declared package boundary')
console.log(`verify-bundle: package boundary stable (${shipped.length} files)`)
console.log('verify-bundle: OK')

/**
 * Bundle smoke gate: proves the published surface is coherent without any
 * heavyweight tooling.
 *
 * 1. lib/ is byte-identical to the banner + source pair build.mjs produces.
 * 2. The built lib/client.js still registers as a DSH client module and keeps
 *    its factory export contract.
 * 3. `npm pack --dry-run` ships exactly the declared file set (stable package
 *    boundary). --ignore-scripts keeps this safe to run from `npm run check`.
 *
 * Zero dependencies; Node >= 22.
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sources = ['index.js', 'catalog.js', 'client.js']
const BANNER = (file) => `// Generated from ${file}; run npm run build after editing source.\n`

// 1. lib/ matches build.mjs output byte for byte.
for (const file of sources) {
  const [source, built] = await Promise.all([
    readFile(path.join(root, file), 'utf8'),
    readFile(path.join(root, 'lib', file), 'utf8'),
  ])
  assert.equal(built, `${BANNER(file)}${source}`, `lib/${file} is stale; run npm run build`)
}
console.log(`verify-bundle: lib/ in sync with ${sources.length} sources`)

// 2. The built client module registers and keeps its export contract.
{
  let registration
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  try {
    const clientUrl = new URL(`../lib/client.js?smoke=${Date.now()}`, import.meta.url)
    await import(clientUrl.href)
    assert.equal(registration.id, 'dsh-model-context-catalog')
    const plugin = registration.factory((id) => {
      assert.equal(id, 'react')
      return { createElement: () => null }
    })
    assert.deepEqual(plugin.inject, ['slots', 'locale', 'settingsScope'])
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
  'ROOT_CAUSE.md',
  'cordis.patch.yml',
  'lib/catalog.js',
  'lib/client.js',
  'lib/index.js',
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

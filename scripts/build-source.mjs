import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/** Stable npm entry points, independent of the source directory layout. */
export const BUILD_ENTRIES = {
  'index.js': 'src/host/index.js',
  'catalog.js': 'src/domain/catalog.js',
  'client.js': 'src/client/index.js',
  'discovery.js': 'src/discovery/index.js',
  'model-capacities.js': 'src/data/model-capacities.js',
}
export const BUILD_SOURCES = Object.keys(BUILD_ENTRIES)

export async function buildOutput(root, file) {
  const entry = BUILD_ENTRIES[file]
  if (!entry) throw new Error(`Unknown build entry: ${file}`)
  const client = file === 'client.js'
  const result = await build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: [entry],
    bundle: true,
    write: false,
    metafile: true,
    packages: 'external',
    platform: client ? 'browser' : 'node',
    format: client ? 'iife' : 'esm',
    target: client ? 'es2022' : 'node22',
    charset: 'utf8',
    loader: { '.css': 'text' },
    // Compact generated data; retain names for diagnostics.
    minifyWhitespace: client || file === 'model-capacities.js',
    lineLimit: 120,
    banner: { js: `// Generated from ${entry}; edit src/ and run npm run build.` },
    logLevel: 'silent',
  })
  return { code: result.outputFiles[0].text, metadata: result.metafile }
}

export async function builtSource(root, file) {
  return (await buildOutput(root, file)).code
}

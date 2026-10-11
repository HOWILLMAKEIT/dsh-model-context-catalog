import { mkdir, writeFile } from 'node:fs/promises'
import { BUILD_SOURCES, builtSource } from './build-source.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'lib')
const sources = BUILD_SOURCES

await mkdir(output, { recursive: true })
for (const file of sources) {
  await writeFile(path.join(output, file), await builtSource(new URL('../', import.meta.url), file), 'utf8')
}

console.log(`built ${sources.length} files in ${path.relative(root, output)}/`)

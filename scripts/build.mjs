import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'lib')
const sources = ['index.js', 'catalog.js', 'client.js']

await mkdir(output, { recursive: true })
for (const file of sources) {
  const source = await readFile(path.join(root, file), 'utf8')
  const banner = `// Generated from ${file}; run npm run build after editing source.\n`
  await writeFile(path.join(output, file), `${banner}${source}`, 'utf8')
}

console.log(`built ${sources.length} files in ${path.relative(root, output)}/`)

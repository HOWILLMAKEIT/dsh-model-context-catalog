import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { normalizeCapacitySources } from '../src/data/normalize.js'

const sources = [{ name: 'models.dev', url: 'https://models.dev/catalog.json' }]
const downloaded = await Promise.all(
  sources.map(async (source) => {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`)
    const text = await response.text()
    return { ...source, sha256: createHash('sha256').update(text).digest('hex'), data: JSON.parse(text) }
  }),
)
const catalog = downloaded[0].data
const records = normalizeCapacitySources(catalog.providers, catalog.models)
if (records.filter((record) => record.scope === 'model').length < 100)
  throw new Error('models.dev: incomplete model defaults')
for (const source of sources) {
  if (records.filter((record) => record.source === source.name).length < 100)
    throw new Error(`${source.name}: incomplete catalog`)
}
const info = {
  updatedAt: new Date().toISOString(),
  records: records.length,
  modelRecords: records.filter((record) => record.scope === 'model').length,
  sources: downloaded.map(({ data, ...metadata }) => metadata),
}
const output =
  '// Generated offline test fixture; not bundled with the plugin.\n' +
  `export const CAPACITY_CATALOG_INFO = ${JSON.stringify(info, null, 2)}\n` +
  'export const REFERENCE_MODEL_CAPACITIES = [\n' +
  records.map((record) => `  ${JSON.stringify(record)}`).join(',\n') +
  '\n]\n'
await writeFile(new URL('../test/fixtures/model-capacities.js', import.meta.url), output)
console.log(`Saved ${records.length} capacity records from ${sources.map((source) => source.name).join(' and ')}`)

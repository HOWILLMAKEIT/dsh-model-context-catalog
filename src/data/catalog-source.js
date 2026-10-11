import { normalizeCapacitySources } from './normalize.js'
import { validContextWindow } from '../shared/contracts.js'

export const CATALOG_URL = 'https://models.dev/catalog.json'
export const CATALOG_CACHE_TTL = 24 * 60 * 60 * 1000
export const CATALOG_CACHE_VERSION = 1
const MAX_CATALOG_BYTES = 16 * 1024 * 1024
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string' && value.length > 0

/** Normalize a complete public catalog; never cache an empty or malformed response. */
export function catalogSnapshot(payload, fetchedAt) {
  if (!object(payload) || !object(payload.providers) || !object(payload.models))
    throw new Error('CAPACITY_CATALOG_INVALID')
  const records = normalizeCapacitySources(payload.providers, payload.models)
  const snapshot = { version: CATALOG_CACHE_VERSION, fetchedAt, records }
  if (!validCatalogSnapshot(snapshot, fetchedAt)) throw new Error('CAPACITY_CATALOG_INVALID')
  return snapshot
}

/** Stored references must use this normalizer version and contain valid model and provider capacities. */
export function validCatalogSnapshot(snapshot, now) {
  return (
    object(snapshot) &&
    snapshot.version === CATALOG_CACHE_VERSION &&
    Number.isSafeInteger(snapshot.fetchedAt) &&
    snapshot.fetchedAt >= 0 &&
    snapshot.fetchedAt <= now &&
    Array.isArray(snapshot.records) &&
    snapshot.records.some((record) => record?.scope === 'model') &&
    snapshot.records.some((record) => record?.scope === 'provider') &&
    snapshot.records.every(
      (record) =>
        object(record) &&
        text(record.id) &&
        text(record.name) &&
        text(record.provider) &&
        text(record.providerName) &&
        ['model', 'provider'].includes(record.scope) &&
        record.source === 'models.dev' &&
        record.kind === 'context' &&
        record.field === 'limit.context' &&
        validContextWindow(record.contextWindow) &&
        typeof record.sourceUrl === 'string' &&
        record.sourceUrl.startsWith('https://models.dev/') &&
        (record.canonicalId === undefined || text(record.canonicalId)) &&
        (record.aliases === undefined || (Array.isArray(record.aliases) && record.aliases.every(text))),
    )
  )
}

/** Fetch only public metadata, without browser credentials, referring URLs or model configuration. */
export async function downloadCatalog(fetcher, signal, now) {
  const response = await fetcher(CATALOG_URL, {
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    mode: 'cors',
    signal,
  })
  if (!response.ok) throw new Error('CAPACITY_CATALOG_UNAVAILABLE')
  if (Number(response.headers?.get('content-length')) > MAX_CATALOG_BYTES) throw new Error('CAPACITY_CATALOG_INVALID')
  const body = await response.text()
  if (body.length > MAX_CATALOG_BYTES) throw new Error('CAPACITY_CATALOG_INVALID')
  return catalogSnapshot(JSON.parse(body), now())
}

export function catalogInfo(snapshot) {
  return {
    updatedAt: new Date(snapshot.fetchedAt).toISOString(),
    records: snapshot.records.length,
    modelRecords: snapshot.records.filter((record) => record.scope === 'model').length,
    sources: [{ name: 'models.dev', url: CATALOG_URL }],
  }
}

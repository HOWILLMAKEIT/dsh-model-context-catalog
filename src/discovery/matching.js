import { validContextWindow as validWindow } from '../shared/contracts.js'
import { compact, baseName, variants } from './names.js'
import { providerEntries } from './providers.js'
import { createIdentityMatcher, hasModelInformation } from './identity.js'

/** Match model identities within a provider first, then within canonical defaults. */
export function createModelMatcher(records) {
  const indexed = records
    .filter(
      (record) =>
        record && validWindow(record.contextWindow) && record.kind === 'context' && typeof record.id === 'string',
    )
    .map((record) => {
      const names = [record.id, ...(record.scope === 'model' ? (record.aliases ?? []) : [])].flatMap(variants)
      return {
        record,
        exact: names.map(compact).filter(Boolean),
        base: names.map((v) => compact(baseName(v))).filter(Boolean),
      }
    })

  const matchIdentity = createIdentityMatcher(indexed)

  function matchModel(id, name = id, provider = '', providerName = provider) {
    const providerRecords = providerEntries(indexed, provider, providerName)
    const defaultRecords = indexed.filter(({ record }) => record.scope === 'model')
    let matches = [],
      method = 'exact',
      referenceScope = 'model'
    // Match the configured provider first. Unknown custom names fall back to
    // canonical model metadata, never a pool of unrelated gateway limits.
    for (const pool of [providerRecords, defaultRecords]) {
      for (const [query, fromName] of [
        [id, false],
        [name, true],
      ]) {
        const keys = variants(query).map(compact).filter(Boolean)
        matches = pool.filter((item) => item.exact.some((key) => keys.includes(key)))
        if (matches.length) {
          method = fromName ? 'name' : 'exact'
          break
        }
        const baseKeys = variants(query)
          .map((v) => compact(baseName(v)))
          .filter((v) => v.length >= 2 && hasModelInformation(v))
        matches = pool.filter((item) => item.base.some((key) => baseKeys.includes(key)))
        if (matches.length) {
          method = fromName ? 'name' : 'version'
          break
        }
      }
      if (matches.length) {
        referenceScope = matches[0].record.scope
        break
      }
    }
    // Existing exact/known-alias matches take precedence over an inferred name.
    if (!matches.length) {
      for (const pool of [providerRecords, defaultRecords]) {
        for (const query of [id, name]) {
          matches = matchIdentity(pool, query)
          if (matches.length) break
        }
        if (matches.length) {
          method = 'fuzzy'
          referenceScope = matches[0].record.scope
          break
        }
      }
    }
    const groups = new Map()
    for (const { record } of matches) {
      const key = `${record.kind}:${record.contextWindow}`
      if (!groups.has(key))
        groups.set(key, { key, contextWindow: record.contextWindow, kind: record.kind, evidence: [] })
      groups.get(key).evidence.push(record)
    }
    const choices = [...groups.values()].sort((a, b) => a.contextWindow - b.contextWindow)
    const recommended = choices.length === 1 ? choices[0] : undefined
    return { method, choices, recommended, conflict: choices.length > 1, referenceScope }
  }

  return matchModel
}

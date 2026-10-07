/** No deployment capacities are supplied by the plugin. Existing saved entries
 * remain authoritative; users add their own exact routes and confirmed limits.
 * Keep the empty export for consumers of the earlier catalog API.
 */
export const MODEL_CONTEXT_CATALOG = Object.freeze([])

export const catalogEntryKey = (provider, model) => `${provider}::${model}`
const catalogKey = (provider, model) => `${provider}\u0000${model}`

/** Convert a supplied route catalog to the settings namespace's merge-friendly dict. */
export function catalogSettingsEntries(catalog = MODEL_CONTEXT_CATALOG) {
  return Object.fromEntries(catalog.map((item) => [catalogEntryKey(item.provider, item.model), {
    provider: item.provider,
    model: item.model,
    contextWindow: item.contextWindow,
    sourceUrl: item.sourceUrl,
    note: item.note,
    enabled: true,
  }]))
}

/** Convert a resolved settings dict back to active reconciliation entries. */
export function activeCatalogFromSettings(entries) {
  if (entries === null || typeof entries !== 'object' || Array.isArray(entries)) return []
  return Object.values(entries)
    .filter((item) => item && item.enabled !== false)
    .map((item) => Object.freeze({
      provider: item.provider,
      model: item.model,
      contextWindow: item.contextWindow,
      sourceUrl: item.sourceUrl ?? '',
      note: item.note ?? '',
    }))
}

export function indexCatalog(catalog = MODEL_CONTEXT_CATALOG) {
  const result = new Map()
  for (const item of catalog) {
    const key = catalogKey(item.provider, item.model)
    if (result.has(key)) throw new Error(`duplicate context metadata for ${item.provider}/${item.model}`)
    if (!Number.isSafeInteger(item.contextWindow) || item.contextWindow <= 0) {
      throw new Error(`invalid context window for ${item.provider}/${item.model}`)
    }
    result.set(key, item)
  }
  return result
}

/** Return the authoritative entry for one exact deployed route. */
export function contextMetadata(provider, model, catalog = MODEL_CONTEXT_CATALOG) {
  return indexCatalog(catalog).get(catalogKey(provider, model))
}

/**
 * Build the smallest settings patch that corrects configured pi-ai model rows.
 * Unknown routes and routes without an explicit models array remain untouched.
 */
export function planPiAiContextUpdate(section, catalog = MODEL_CONTEXT_CATALOG) {
  const providers = section?.providers
  if (providers === null || typeof providers !== 'object' || Array.isArray(providers)) {
    return Object.freeze({ patch: null, ops: Object.freeze([]), corrections: Object.freeze([]) })
  }

  const indexed = indexCatalog(catalog)
  const providerPatch = {}
  const corrections = []
  const ops = []

  for (const [provider, profile] of Object.entries(providers)) {
    if (!Array.isArray(profile?.models)) continue
    let changed = false
    const models = profile.models.map((model, index) => {
      if (model === null || typeof model !== 'object' || Array.isArray(model) || typeof model.id !== 'string') return model
      const expected = indexed.get(catalogKey(provider, model.id))
      if (expected === undefined || model.contextWindow === expected.contextWindow) return model
      changed = true
      ops.push(Object.freeze({
        op: 'set',
        path: Object.freeze(['providers', provider, 'models', String(index), 'contextWindow']),
        value: expected.contextWindow,
      }))
      corrections.push(Object.freeze({
        provider,
        model: model.id,
        from: model.contextWindow,
        to: expected.contextWindow,
        sourceUrl: expected.sourceUrl,
      }))
      return { ...model, contextWindow: expected.contextWindow }
    })
    if (changed) providerPatch[provider] = { models }
  }

  return Object.freeze({
    patch: corrections.length === 0 ? null : { providers: providerPatch },
    ops: Object.freeze(ops),
    corrections: Object.freeze(corrections),
  })
}

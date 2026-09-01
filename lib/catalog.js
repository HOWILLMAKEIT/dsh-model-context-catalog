// Generated from catalog.js; run npm run build after editing source.
const entry = (provider, model, contextWindow, sourceUrl, note) => Object.freeze({
  provider,
  model,
  contextWindow,
  sourceUrl,
  note,
})

/**
 * Route-specific context capacities for the models in the current Web profile.
 *
 * Values are deliberately keyed by provider and model. The same wire model id
 * may be deployed with a different limit by another gateway or subscription.
 */
export const MODEL_CONTEXT_CATALOG = Object.freeze([
  entry('glm-coding', 'glm-5.3', 1_000_000, 'https://docs.bigmodel.cn/cn/guide/start/model-overview', 'GLM Coding Plan long-context route'),
  entry('glm-coding', 'glm-5.3-flash', 1_000_000, 'https://docs.bigmodel.cn/cn/guide/start/model-overview', 'GLM Coding Plan long-context route'),

  entry('ark-agent-plan-cn', 'doubao-seed-evolving', 1_024_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan'),
  entry('ark-agent-plan-cn', 'doubao-seed-2.1-pro', 256_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan'),
  entry('ark-agent-plan-cn', 'doubao-seed-2.1-turbo', 256_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan'),
  entry('ark-agent-plan-cn', 'doubao-seed-2.0-lite', 256_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan'),
  entry('ark-agent-plan-cn', 'doubao-seed-2.0-mini', 256_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan'),
  entry('ark-agent-plan-cn', 'glm-5.3', 1_024_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan deployment limit'),
  entry('ark-agent-plan-cn', 'kimi-k3', 1_024_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan deployment limit'),
  entry('ark-agent-plan-cn', 'deepseek-v4-pro', 1_024_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan deployment limit'),
  entry('ark-agent-plan-cn', 'minimax-m3', 1_024_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan deployment limit'),
  entry('ark-agent-plan-cn', 'deepseek-v4-flash', 1_024_000, 'https://www.volcengine.com/docs/82379/2549861', 'Ark Agent Plan deployment limit'),
])

export const catalogEntryKey = (provider, model) => `${provider}::${model}`
const catalogKey = (provider, model) => `${provider}\u0000${model}`

/** Convert the built-in array to the settings namespace's merge-friendly dict. */
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
    return Object.freeze({ patch: null, corrections: Object.freeze([]) })
  }

  const indexed = indexCatalog(catalog)
  const providerPatch = {}
  const corrections = []

  for (const [provider, profile] of Object.entries(providers)) {
    if (!Array.isArray(profile?.models)) continue
    let changed = false
    const models = profile.models.map((model) => {
      if (model === null || typeof model !== 'object' || Array.isArray(model) || typeof model.id !== 'string') return model
      const expected = indexed.get(catalogKey(provider, model.id))
      if (expected === undefined || model.contextWindow === expected.contextWindow) return model
      changed = true
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
    corrections: Object.freeze(corrections),
  })
}

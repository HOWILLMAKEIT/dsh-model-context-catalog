import { routeKey } from '../shared/contracts.js'

/**
 * The capacity llm-pi-ai currently serves for one route. `explicit` marks a
 * row-configured value; a provider-level fallback is reported separately so
 * the adapter's 262,144-style default is never shown as the real limit.
 */
export function actualContext(pi, provider, model) {
  const profile = pi?.providers?.[provider]
  const row = Array.isArray(profile?.models) ? profile.models.find((item) => item?.id === model) : undefined
  if (!row) return undefined
  if (typeof row.contextWindow === 'number' && Number.isFinite(row.contextWindow))
    return { value: row.contextWindow, explicit: true }
  if (typeof profile.defaultContextWindow === 'number' && Number.isFinite(profile.defaultContextWindow))
    return { value: profile.defaultContextWindow, explicit: false }
  return { value: undefined, explicit: false }
}
export function formatTokens(value) {
  return new Intl.NumberFormat().format(value)
}
/** Filter options by the combobox query; empty queries keep everything. */
export function filterOptions(options, query) {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized === '') return options
  return options.filter((option) => option.searchText.includes(normalized))
}
/**
 * Group options by provider in a deterministic order. Both the configured
 * displayName and the raw provider key remain available in the compact
 * one-line group heading.
 */
export function groupModelsByProvider(options) {
  const groups = new Map()
  for (const option of options) {
    let group = groups.get(option.provider)
    if (!group) {
      group = { provider: option.provider, title: option.providerName, options: [] }
      groups.set(option.provider, group)
    }
    group.options.push(option)
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title) || a.provider.localeCompare(b.provider))
}
/** Position a tall fixed menu outside editor/card clipping boundaries. */
export function floatingMenuLayout(rect, viewportWidth, viewportHeight) {
  const margin = 8
  const gap = 5
  const width = Math.min(Math.max(rect.width, 240), Math.max(viewportWidth - margin * 2, 0))
  const left = Math.min(Math.max(rect.left, margin), Math.max(viewportWidth - width - margin, margin))
  const below = viewportHeight - rect.bottom - gap - margin
  const above = rect.top - gap - margin
  const opensAbove = below < 260 && above > below
  const available = Math.max(opensAbove ? above : below, 160)
  const menuHeight = Math.min(420, available)
  const top = opensAbove ? Math.max(margin, rect.top - gap - menuHeight) : rect.bottom + gap
  return {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(width)}px`,
    '--mcc-menu-list-max': `${Math.max(Math.floor(menuHeight - 43), 117)}px`,
  }
}
/** The model display name exactly as configured; the id only fills absences. */
const faithfulModelName = (model) => (typeof model.name === 'string' && model.name.length > 0 ? model.name : model.id)
/**
 * The configured route options, built solely from the resolved llm-pi-ai
 * document. Display names are kept verbatim — plan suffixes like
 * "(Agent Plan)" are data, never rewritten or stripped here.
 */
export function configuredModels(pi) {
  const result = []
  for (const [provider, profile] of Object.entries(pi?.providers ?? {})) {
    if (!profile || typeof profile !== 'object' || !Array.isArray(profile.models)) continue
    const providerName =
      typeof profile.displayName === 'string' && profile.displayName.length > 0 ? profile.displayName : provider
    for (const model of profile.models) {
      if (!model || typeof model.id !== 'string') continue
      const modelName = faithfulModelName(model)
      result.push({
        value: routeKey(provider, model.id),
        provider,
        providerName,
        model: model.id,
        modelName,
        searchText: `${provider} ${providerName} ${model.id} ${modelName}`.toLocaleLowerCase(),
      })
    }
  }
  return result.sort((a, b) =>
    `${a.providerName}\u0000${a.modelName}`.localeCompare(`${b.providerName}\u0000${b.modelName}`),
  )
}

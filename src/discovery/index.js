import { validContextWindow as validWindow, routeKey, catalogEntryKey } from '../shared/contracts.js'
import { createModelMatcher } from './matching.js'
import { capacitySourceNote } from '../domain/source-notes.js'
import { managementChoices } from './management.js'
export { loadNativeContexts } from './native-contexts.js'

/** Candidate discovery and revalidation operate only on configured routes. */
export function createCapacityDiscovery(records) {
  const matchModel = createModelMatcher(records)
  function scanModels(pi, entries = {}, nativeContexts = {}) {
    const rows = []
    const managed = new Set(
      Object.values(entries)
        .filter(Boolean)
        .map((entry) => routeKey(entry.provider, entry.model)),
    )
    const seen = new Set()
    for (const [provider, profile] of Object.entries(pi?.providers ?? {})) {
      if (!Array.isArray(profile?.models)) continue
      for (const model of profile.models) {
        if (!model || typeof model.id !== 'string' || !model.id) continue
        const key = routeKey(provider, model.id)
        if (seen.has(key) || managed.has(key)) continue
        seen.add(key)
        const match = matchModel(model.id, model.name, provider, profile.displayName)
        const inherited = nativeContexts[provider]?.[model.id]
        const explicit = validWindow(model.contextWindow)
        const native = model.contextWindow == null && validWindow(inherited)
        const currentWindow = explicit ? model.contextWindow : native ? inherited : profile.defaultContextWindow
        const windowSource = explicit
          ? 'model'
          : native
            ? 'native'
            : validWindow(currentWindow)
              ? 'provider'
              : undefined
        const isSame =
          validWindow(currentWindow) && match.choices.some((choice) => choice.contextWindow === currentWindow)
        const reason = isSame
          ? 'same'
          : explicit || native
            ? match.choices.length
              ? 'different'
              : 'configured'
            : 'missing'
        rows.push({
          key,
          provider,
          model: model.id,
          modelName: model.name || model.id,
          currentWindow: validWindow(currentWindow) ? currentWindow : undefined,
          windowSource,
          hasReference: match.choices.length > 0,
          reason,
          ...managementChoices(match, currentWindow, windowSource),
          selectedByDefault: !validWindow(currentWindow) && match.method === 'exact' && Boolean(match.recommended),
        })
      }
    }
    return rows
  }

  /** Build route entries only after rechecking the exact candidate snapshot. */
  function planSelectedEntries(pi, entries, rows, selections, nativeContexts = {}) {
    const fresh = new Map(scanModels(pi, entries, nativeContexts).map((row) => [row.key, row]))
    const next = { ...entries }
    const added = []
    for (const row of rows) {
      const selectedKey = selections[row.key]
      if (!selectedKey) continue
      const current = fresh.get(row.key)
      if (
        !current ||
        current.currentWindow !== row.currentWindow ||
        current.windowSource !== row.windowSource ||
        current.reason !== row.reason
      ) {
        throw new Error('STALE_CANDIDATES')
      }
      const choice = current.choices.find((item) => item.key === selectedKey)
      if (!choice) throw new Error('STALE_CANDIDATES')
      const evidence = choice.evidence[0]
      const key = catalogEntryKey(row.provider, row.model)
      if (Object.hasOwn(next, key)) throw new Error('STALE_CANDIDATES')
      const entry = {
        provider: row.provider,
        model: row.model,
        contextWindow: choice.contextWindow,
        sourceUrl: evidence.sourceUrl ?? '',
        note: capacitySourceNote(evidence),
        enabled: true,
      }
      next[key] = entry
      added.push(entry)
    }
    return { entries: next, added }
  }
  return { matchModel, scanModels, planSelectedEntries }
}

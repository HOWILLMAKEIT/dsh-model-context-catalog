import { loadNativeContexts } from '../discovery/native-contexts.js'
import { createCapacityDiscovery } from '../discovery/index.js'
import { configuredModels } from './models.js'
import { entryMutations } from './settings.js'
import { readableSourceNote } from '../domain/source-notes.js'
import { catalogEntryKey, routeKey, validContextWindow } from '../shared/contracts.js'

/** Own page state and configuration writes; components only render and dispatch actions. */
export function createCatalogController(React) {
  function useScope(scope) {
    return React.useSyncExternalStore(
      React.useCallback((listener) => scope.subscribe(listener), [scope]),
      React.useCallback(() => scope.getSnapshot(), [scope]),
    )
  }
  return function useCatalogController({ catalogScope, piScope, discoverBuiltin, catalogLoader, t }) {
    const snapshot = useScope(catalogScope)
    const piSnapshot = useScope(piScope)
    const entries = snapshot.value?.entries ?? {}
    const options = configuredModels(piSnapshot.value)
    const [editingKey, setEditingKey] = React.useState(null)
    const [route, setRoute] = React.useState('')
    const [windowValue, setWindowValue] = React.useState('')
    const [note, setNote] = React.useState('')
    const [sourceUrl, setSourceUrl] = React.useState('')
    const [error, setError] = React.useState('')
    const [saving, setSaving] = React.useState(false)
    const [scanning, setScanning] = React.useState(false)
    const [batch, setBatch] = React.useState(null)
    const [message, setMessage] = React.useState('')

    const closeEditor = () => {
      setEditingKey(null)
      setRoute('')
      setWindowValue('')
      setNote('')
      setSourceUrl('')
      setError('')
    }
    const startAdd = (candidate) => {
      const firstUnused = options.find(
        (option) =>
          !Object.values(entries).some((item) => item.provider === option.provider && item.model === option.model),
      )
      setBatch(null)
      setMessage('')
      setEditingKey('__new__')
      setRoute(candidate?.key ?? firstUnused?.value ?? options[0]?.value ?? '')
      setWindowValue('')
      setNote('')
      setSourceUrl('')
      setError('')
    }
    const startAuto = async () => {
      setScanning(true)
      setError('')
      setMessage('')
      closeEditor()
      setBatch(null)
      try {
        const currentPi = piScope.getSnapshot()
        if (currentPi.status !== 'ready') throw new Error('NATIVE_CATALOG_UNAVAILABLE')
        const [references, native] = await Promise.all([
          catalogLoader.load(),
          loadNativeContexts(Object.keys(currentPi.value?.providers ?? {}), discoverBuiltin),
        ])
        const capacityDiscovery = createCapacityDiscovery(references.records)
        const latestPi = piScope.getSnapshot()
        if (latestPi.revision !== currentPi.revision || latestPi.value !== currentPi.value)
          throw new Error('STALE_CANDIDATES')
        setBatch({
          rows: capacityDiscovery.scanModels(latestPi.value, catalogScope.getSnapshot().value?.entries ?? {}, native),
          native,
          capacityDiscovery,
          references,
        })
      } catch (cause) {
        setError(
          t(
            cause.message === 'STALE_CANDIDATES'
              ? 'candidatesChanged'
              : cause.message === 'CAPACITY_CATALOG_UNAVAILABLE'
                ? 'referencesUnavailable'
                : 'nativeUnavailable',
          ),
        )
      } finally {
        setScanning(false)
      }
    }
    const startEdit = (key, item) => {
      setEditingKey(key)
      setRoute(routeKey(item.provider, item.model))
      setWindowValue(String(item.contextWindow))
      setNote(readableSourceNote(item))
      setSourceUrl(item.sourceUrl ?? '')
      setError('')
    }
    const commitEntries = async (next) => {
      setSaving(true)
      setError('')
      try {
        const accepted = await catalogScope.mutate(entryMutations(entries, next), snapshot.revision)
        if (!accepted) {
          setError(t('writeRefused'))
          return false
        }
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
        return false
      } finally {
        setSaving(false)
      }
    }
    const submit = async (event) => {
      event.preventDefault()
      const existing = editingKey && editingKey !== '__new__' ? entries[editingKey] : undefined
      const selected =
        options.find((option) => option.value === route) ??
        (existing && route === routeKey(existing.provider, existing.model)
          ? { provider: existing.provider, model: existing.model }
          : undefined)
      const contextWindow = Number(windowValue)
      if (!selected || !validContextWindow(contextWindow)) {
        setError(t('invalid'))
        return
      }
      const key = catalogEntryKey(selected.provider, selected.model)
      const next = { ...entries }
      if (editingKey && editingKey !== '__new__' && editingKey !== key) delete next[editingKey]
      next[key] = {
        provider: selected.provider,
        model: selected.model,
        contextWindow,
        sourceUrl: sourceUrl.trim(),
        note: note.trim(),
        enabled: existing?.enabled !== false,
      }
      if (await commitEntries(next)) closeEditor()
    }
    const toggle = (key, item) => commitEntries({ ...entries, [key]: { ...item, enabled: item.enabled === false } })
    const remove = async (key) => {
      const next = { ...entries }
      delete next[key]
      if ((await commitEntries(next)) && editingKey === key) closeEditor()
    }
    const addSelected = async (selections) => {
      setSaving(true)
      setError('')
      try {
        const currentPi = piScope.getSnapshot()
        const currentCatalog = catalogScope.getSnapshot()
        if (currentPi.status !== 'ready' || currentCatalog.status !== 'ready' || !currentCatalog.writable)
          throw new Error('STALE_CANDIDATES')
        const plan = batch.capacityDiscovery.planSelectedEntries(
          currentPi.value,
          currentCatalog.value?.entries ?? {},
          batch.rows,
          selections,
          batch.native,
        )
        if (plan.added.length === 0) return
        const previous = currentCatalog.value?.entries ?? {}
        const accepted = await catalogScope.mutate(entryMutations(previous, plan.entries), currentCatalog.revision)
        if (!accepted) {
          setError(t('writeRefused'))
          return
        }
        setBatch(null)
        setMessage(t('addedSummary', { count: plan.added.length }))
      } catch (cause) {
        setError(
          cause.message === 'STALE_CANDIDATES'
            ? t('candidatesChanged')
            : cause instanceof Error
              ? cause.message
              : String(cause),
        )
      } finally {
        setSaving(false)
      }
    }
    return {
      snapshot,
      piSnapshot,
      entries,
      options,
      editingKey,
      route,
      windowValue,
      note,
      sourceUrl,
      error,
      saving,
      scanning,
      batch,
      message,
      setRoute,
      setWindowValue,
      setNote,
      setSourceUrl,
      closeEditor,
      startAdd,
      startAuto,
      startEdit,
      submit,
      toggle,
      remove,
      addSelected,
      cancelBatch: () => {
        setBatch(null)
        setError('')
      },
    }
  }
}

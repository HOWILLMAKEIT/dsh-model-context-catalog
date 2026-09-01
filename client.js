window.__ModuleLoader__.load({
  id: 'dsh-model-context-catalog',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const SETTINGS_NS = 'model-context-catalog'
    const LOCALE_NS = 'settings.modelContextCatalog'
    const PI_NS = 'llm-pi-ai'
    const h = React.createElement

    const CSS = `
.mcc-page{max-width:900px;padding:8px 4px 48px;color:var(--dsw-alias-label-primary)}
.mcc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.mcc-heading{min-width:0;max-width:680px}
.mcc-title{font-size:21px;line-height:30px;font-weight:650;margin:0 0 5px}.mcc-sub{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);margin:0}.mcc-count{margin-top:10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.mcc-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:13px;margin-bottom:10px;overflow:hidden;transition:border-color .16s ease,box-shadow .16s ease}.mcc-card.open{border-color:var(--dsw-static-deepseek-500,#4d6bfe);box-shadow:0 0 0 2px rgba(77,107,254,.08)}
.mcc-row{display:flex;gap:14px;align-items:center;padding:14px 16px}.mcc-main{min-width:0;flex:1}.mcc-route{font-size:14px;line-height:21px;font-weight:620;overflow-wrap:anywhere}.mcc-meta{margin-top:5px;font-size:12px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mcc-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;font-size:11px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}.mcc-badge.ok{color:#16865c;background:rgba(22,134,92,.09)}.mcc-badge.warn{color:#a55b00;background:rgba(229,139,0,.10)}.mcc-badge.off{color:var(--dsw-alias-label-tertiary)}
.mcc-actions{display:flex;gap:6px;flex:none}.mcc-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;min-height:34px;padding:6px 11px;font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}.mcc-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}.mcc-btn.primary{background:var(--dsw-static-deepseek-500,#4d6bfe);color:#fff;border-color:transparent;font-weight:600}.mcc-btn.primary:hover{filter:brightness(.96)}.mcc-btn.danger{color:#c44343}.mcc-btn:disabled{opacity:.48;cursor:not-allowed}
.mcc-editor{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);padding:16px}.mcc-new{border:1px solid var(--dsw-alias-border-l2);border-radius:13px;margin:0 0 14px;overflow:hidden}.mcc-editor-title{font-size:13px;font-weight:620;margin:0 0 13px}.mcc-form{display:grid;grid-template-columns:minmax(220px,1.2fr) minmax(160px,.8fr);gap:12px}.mcc-field{display:flex;flex-direction:column;gap:6px}.mcc-field.full{grid-column:1/-1}.mcc-label{font-size:12px;color:var(--dsw-alias-label-secondary)}.mcc-input{box-sizing:border-box;width:100%;height:38px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font:inherit;font-size:13px;outline:none}.mcc-input:focus{border-color:var(--dsw-static-deepseek-500,#4d6bfe);box-shadow:0 0 0 2px rgba(77,107,254,.08)}select.mcc-input{cursor:pointer}.mcc-textarea{height:68px;padding:9px 10px;resize:vertical;line-height:20px}
.mcc-form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:2px}.mcc-error{grid-column:1/-1;color:#c44343;font-size:12px}.mcc-empty{padding:34px;text-align:center;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-tertiary)}.mcc-hint{font-size:12px;line-height:19px;color:var(--dsw-alias-label-tertiary)}
.mcc-combo{position:relative}.mcc-combo-trigger{width:100%;min-height:40px;display:flex;align-items:center;gap:8px;text-align:left;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font:inherit;cursor:pointer}.mcc-combo-trigger:hover,.mcc-combo-trigger.open{border-color:var(--dsw-alias-border-l3)}.mcc-combo-trigger:disabled{opacity:.65;cursor:not-allowed}.mcc-combo-value{min-width:0;flex:1}.mcc-combo-primary{display:block;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcc-combo-chevron{flex:none;width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);color:var(--dsw-alias-label-tertiary)}.mcc-combo-trigger.open .mcc-combo-chevron{transform:rotate(225deg) translate(-2px,-1px)}
.mcc-combo-menu{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 5px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden}.mcc-combo-search-wrap{padding:6px 6px 3px}.mcc-combo-search{width:100%;height:32px;box-sizing:border-box;border:1px solid transparent;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;padding:0 9px;font:inherit;font-size:12px;outline:none}.mcc-combo-search:hover{border-color:var(--dsw-alias-border-l2)}.mcc-combo-search:focus{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1)}.mcc-combo-list{max-height:286px;overflow:auto;padding:3px 5px 5px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l3) transparent}.mcc-combo-list::-webkit-scrollbar{width:6px}.mcc-combo-list::-webkit-scrollbar-track{background:transparent}.mcc-combo-list::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l3);border-radius:999px}.mcc-combo-group+.mcc-combo-group{margin-top:4px;padding-top:3px}.mcc-combo-group-head{position:sticky;top:0;z-index:1;display:flex;align-items:baseline;gap:6px;padding:8px 8px 4px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-tertiary)}.mcc-combo-group-title{font-size:11px;line-height:15px;font-weight:500}.mcc-combo-group-sub{min-width:0;font-size:10px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcc-combo-option{width:100%;min-height:34px;display:flex;align-items:center;border:0;background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 9px;text-align:left;font:inherit;cursor:pointer}.mcc-combo-option:hover,.mcc-combo-option.active,.mcc-combo-option.selected{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}.mcc-combo-option.selected .mcc-combo-primary{font-weight:540}.mcc-combo-empty{padding:18px 12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}
.mcc-notice{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-left:3px solid var(--dsw-static-deepseek-500,#4d6bfe);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:10px 12px;margin:0 0 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mcc-btn:focus-visible,.mcc-combo-trigger:focus-visible,.mcc-input:focus-visible{outline:2px solid var(--dsw-static-deepseek-500,#4d6bfe);outline-offset:1px}.mcc-combo-search:focus-visible{outline:none;box-shadow:0 0 0 1px var(--dsw-alias-border-l2)}
@media(max-width:680px){.mcc-head{align-items:stretch;flex-direction:column}.mcc-head>.mcc-btn{align-self:flex-start}.mcc-form{grid-template-columns:1fr}.mcc-field.full,.mcc-form-actions,.mcc-error{grid-column:1}.mcc-row{align-items:flex-start;flex-direction:column}.mcc-actions{width:100%;justify-content:flex-end;flex-wrap:wrap}}
`

    function installStyles() {
      if (document.querySelector('style[data-plugin="dsh-model-context-catalog"]')) return () => {}
      const node = document.createElement('style')
      node.dataset.plugin = 'dsh-model-context-catalog'
      node.textContent = CSS
      document.head.append(node)
      return () => node.remove()
    }

    function decodeCatalog(value) {
      if (!value || typeof value !== 'object' || !value.entries || typeof value.entries !== 'object') return undefined
      return value
    }
    function decodePi(value) {
      return value && typeof value === 'object' ? value : undefined
    }
    function useScope(scope) {
      return React.useSyncExternalStore(
        React.useCallback((listener) => scope.subscribe(listener), [scope]),
        React.useCallback(() => scope.getSnapshot(), [scope]),
      )
    }
    /**
     * The capacity llm-pi-ai currently serves for one route. `explicit` marks a
     * row-configured value; a provider-level fallback is reported separately so
     * the adapter's 262,144-style default is never shown as the real limit.
     */
    function actualContext(pi, provider, model) {
      const profile = pi?.providers?.[provider]
      const row = Array.isArray(profile?.models) ? profile.models.find((item) => item?.id === model) : undefined
      if (!row) return undefined
      if (typeof row.contextWindow === 'number' && Number.isFinite(row.contextWindow)) return { value: row.contextWindow, explicit: true }
      if (typeof profile.defaultContextWindow === 'number' && Number.isFinite(profile.defaultContextWindow)) return { value: profile.defaultContextWindow, explicit: false }
      return { value: undefined, explicit: false }
    }
    function formatTokens(value) {
      return new Intl.NumberFormat().format(value)
    }
    function field(label, value, onChange, props = {}) {
      const control = props.multiline
        ? h('textarea', { className: 'mcc-input mcc-textarea', value, placeholder: props.placeholder ?? '', onChange: (event) => onChange(event.target.value) })
        : h('input', { className: 'mcc-input', value, type: props.type ?? 'text', placeholder: props.placeholder ?? '', onChange: (event) => onChange(event.target.value), min: props.min })
      return h('label', { className: `mcc-field${props.full ? ' full' : ''}` }, h('span', { className: 'mcc-label' }, label), control)
    }
    /** Filter options by the combobox query; empty queries keep everything. */
    function filterOptions(options, query) {
      const normalized = query.trim().toLocaleLowerCase()
      if (normalized === '') return options
      return options.filter((option) => option.searchText.includes(normalized))
    }
    /**
     * Group options by provider in a deterministic order. Both the configured
     * displayName and the raw provider key remain available in the compact
     * one-line group heading.
     */
    function groupModelsByProvider(options) {
      const groups = new Map()
      for (const option of options) {
        let group = groups.get(option.provider)
        if (!group) { group = { provider: option.provider, title: option.providerName, options: [] }; groups.set(option.provider, group) }
        group.options.push(option)
      }
      return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title) || a.provider.localeCompare(b.provider))
    }
    let comboSeq = 0
    function ModelCombobox({ label, value, onChange, options, disabled, t }) {
      const [open, setOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [activeIndex, setActiveIndex] = React.useState(0)
      const rootRef = React.useRef(null)
      const triggerRef = React.useRef(null)
      const searchRef = React.useRef(null)
      const listboxId = React.useRef(`mcc-combo-list-${++comboSeq}`).current
      const selected = options.find((option) => option.value === value)
      const visible = filterOptions(options, query)
      const groups = groupModelsByProvider(visible)
      const close = () => { setOpen(false); setQuery(''); setActiveIndex(0) }
      const toggleOpen = () => {
        if (disabled) return
        if (open) { close(); return }
        setActiveIndex(Math.max(options.findIndex((option) => option.value === value), 0))
        setOpen(true)
      }
      React.useEffect(() => {
        if (!open) return undefined
        const closeOnOutside = (event) => { if (!rootRef.current?.contains(event.target)) close() }
        const closeOnEscape = (event) => { if (event.key === 'Escape') { close(); triggerRef.current?.focus() } }
        document.addEventListener('pointerdown', closeOnOutside)
        document.addEventListener('keydown', closeOnEscape)
        queueMicrotask(() => searchRef.current?.focus())
        return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape) }
      }, [open])
      React.useEffect(() => {
        if (!open) return
        rootRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
      }, [open, activeIndex])
      const choose = (option) => { onChange(option.value); close() }
      const moveActive = (next) => setActiveIndex(visible.length === 0 ? 0 : (next + visible.length) % visible.length)
      const onMenuKeyDown = (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(activeIndex + 1) }
        else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(activeIndex - 1) }
        else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0) }
        else if (event.key === 'End') { event.preventDefault(); setActiveIndex(Math.max(visible.length - 1, 0)) }
        else if (event.key === 'Enter' && visible[activeIndex]) { event.preventDefault(); choose(visible[activeIndex]) }
      }
      let rendered = 0
      return h('div', { className: 'mcc-field' },
        h('span', { className: 'mcc-label' }, label),
        h('div', { className: 'mcc-combo', ref: rootRef },
          h('button', {
            type: 'button', disabled, ref: triggerRef, 'aria-haspopup': 'listbox', 'aria-expanded': open,
            'aria-controls': open ? listboxId : undefined,
            className: `mcc-combo-trigger${open ? ' open' : ''}`,
            title: selected ? `${selected.providerName} (${selected.provider}) · ${selected.model}` : undefined,
            onClick: toggleOpen,
            onKeyDown: (event) => { if (!disabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); toggleOpen() } },
          },
            h('span', { className: 'mcc-combo-value' },
              h('span', { className: 'mcc-combo-primary' }, selected?.modelName || selected?.model || t('selectPlaceholder')),
            ),
            h('span', { className: 'mcc-combo-chevron', 'aria-hidden': 'true' }),
          ),
          open ? h('div', { className: 'mcc-combo-menu' },
            h('div', { className: 'mcc-combo-search-wrap' },
              h('input', { ref: searchRef, className: 'mcc-combo-search', value: query, placeholder: t('searchModels'), onChange: (event) => { setQuery(event.target.value); setActiveIndex(0) }, onKeyDown: onMenuKeyDown, 'aria-label': t('searchModels'), 'aria-controls': listboxId }),
            ),
            h('div', { className: 'mcc-combo-list', role: 'listbox', id: listboxId, 'aria-activedescendant': visible[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined },
              groups.length === 0 ? h('div', { className: 'mcc-combo-empty' }, t('noMatches')) : groups.map((group) => {
                const startIndex = rendered
                rendered += group.options.length
                return h('div', { className: 'mcc-combo-group', key: group.provider },
                  h('div', { className: 'mcc-combo-group-head' },
                    h('span', { className: 'mcc-combo-group-title' }, group.title),
                    group.provider !== group.title ? h('span', { className: 'mcc-combo-group-sub' }, `· ${group.provider}`) : null,
                  ),
                  group.options.map((option, offset) => {
                    const index = startIndex + offset
                    return h('button', {
                      type: 'button', role: 'option', id: `${listboxId}-opt-${index}`, 'aria-selected': option.value === value,
                      'data-active': index === activeIndex ? 'true' : undefined,
                      title: `${option.modelName}\n${option.providerName} (${option.provider}) · ${option.model}`,
                      className: `mcc-combo-option${option.value === value ? ' selected' : ''}${index === activeIndex ? ' active' : ''}`,
                      key: option.value, onClick: () => choose(option), onMouseEnter: () => setActiveIndex(index),
                    },
                      h('span', { className: 'mcc-combo-value' },
                        h('span', { className: 'mcc-combo-primary' }, option.modelName),
                      ),
                    )
                  }),
                )
              }),
            ),
          ) : null,
        ),
      )
    }
    /** The model display name exactly as configured; the id only fills absences. */
    const faithfulModelName = (model) => (typeof model.name === 'string' && model.name.length > 0 ? model.name : model.id)
    /**
     * The configured route options, built solely from the resolved llm-pi-ai
     * document. Display names are kept verbatim — plan suffixes like
     * "(Agent Plan)" are data, never rewritten or stripped here.
     */
    function configuredModels(pi) {
      const result = []
      for (const [provider, profile] of Object.entries(pi?.providers ?? {})) {
        if (!profile || typeof profile !== 'object' || !Array.isArray(profile.models)) continue
        const providerName = typeof profile.displayName === 'string' && profile.displayName.length > 0 ? profile.displayName : provider
        for (const model of profile.models) {
          if (!model || typeof model.id !== 'string') continue
          const modelName = faithfulModelName(model)
          result.push({
            value: `${provider}\u0000${model.id}`,
            provider,
            providerName,
            model: model.id,
            modelName,
            searchText: `${provider} ${providerName} ${model.id} ${modelName}`.toLocaleLowerCase(),
          })
        }
      }
      return result.sort((a, b) => `${a.providerName}\u0000${a.modelName}`.localeCompare(`${b.providerName}\u0000${b.modelName}`))
    }

    function CatalogPage({ catalogScope, piScope, t }) {
      const snapshot = useScope(catalogScope)
      const piSnapshot = useScope(piScope)
      const entries = snapshot.value?.entries ?? {}
      const baseEntries = snapshot.base?.entries ?? {}
      const options = configuredModels(piSnapshot.value)
      const [editingKey, setEditingKey] = React.useState(null)
      const [route, setRoute] = React.useState('')
      const [windowValue, setWindowValue] = React.useState('')
      const [note, setNote] = React.useState('')
      const [error, setError] = React.useState('')
      const [saving, setSaving] = React.useState(false)

      const closeEditor = () => {
        setEditingKey(null); setRoute(''); setWindowValue(''); setNote(''); setError('')
      }
      const startAdd = () => {
        const firstUnused = options.find((option) => !Object.values(entries).some((item) => item.provider === option.provider && item.model === option.model))
        setEditingKey('__new__'); setRoute(firstUnused?.value ?? options[0]?.value ?? ''); setWindowValue(''); setNote(''); setError('')
      }
      const startEdit = (key, item) => {
        setEditingKey(key); setRoute(`${item.provider}\u0000${item.model}`); setWindowValue(String(item.contextWindow)); setNote(item.note ?? ''); setError('')
      }
      const commitEntries = async (next) => {
        setSaving(true); setError('')
        try { await catalogScope.set('entries', next); return true }
        catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false }
        finally { setSaving(false) }
      }
      const submit = async (event) => {
        event.preventDefault()
        const existing = editingKey && editingKey !== '__new__' ? entries[editingKey] : undefined
        const selected = options.find((option) => option.value === route) ?? (existing && route === `${existing.provider}\u0000${existing.model}` ? { provider: existing.provider, model: existing.model } : undefined)
        const contextWindow = Number(windowValue)
        if (!selected || !Number.isSafeInteger(contextWindow) || contextWindow <= 0) { setError(t('invalid')); return }
        const key = `${selected.provider}::${selected.model}`
        const previous = editingKey && editingKey !== '__new__' ? entries[editingKey] : undefined
        const next = { ...entries }
        if (editingKey && editingKey !== '__new__' && editingKey !== key) delete next[editingKey]
        next[key] = {
          provider: selected.provider, model: selected.model, contextWindow,
          sourceUrl: previous?.sourceUrl ?? entries[key]?.sourceUrl ?? '', note: note.trim(), enabled: true,
        }
        if (await commitEntries(next)) closeEditor()
      }
      const toggle = (key, item) => commitEntries({ ...entries, [key]: { ...item, enabled: item.enabled === false } })
      const remove = async (key) => {
        const next = { ...entries }; delete next[key]
        if (await commitEntries(next) && editingKey === key) closeEditor()
      }
      const editor = (title) => {
        const selectedItem = editingKey && editingKey !== '__new__' ? entries[editingKey] : undefined
        const editorOptions = route && !options.some((option) => option.value === route) && selectedItem
          ? [{ value: route, provider: selectedItem.provider, providerName: selectedItem.provider, model: selectedItem.model, modelName: selectedItem.model, searchText: `${selectedItem.provider} ${selectedItem.model}`.toLocaleLowerCase() }, ...options]
          : options
        return h('form', { className: 'mcc-editor', onSubmit: submit },
        h('div', { className: 'mcc-editor-title' }, title),
        h('div', { className: 'mcc-form' },
          h(ModelCombobox, { label: t('chooseModel'), value: route, onChange: setRoute, options: editorOptions, disabled: editingKey !== '__new__', t }),
          field(t('window'), windowValue, setWindowValue, { type: 'number', min: 1, placeholder: '1000000' }),
          field(t('note'), note, setNote, { full: true, multiline: true, placeholder: t('notePlaceholder') }),
          editorOptions.length === 0 ? h('div', { className: 'mcc-error' }, t('noConfiguredModels')) : null,
          error ? h('div', { className: 'mcc-error' }, error) : null,
          h('div', { className: 'mcc-form-actions' },
            h('button', { type: 'button', className: 'mcc-btn', onClick: closeEditor }, t('cancel')),
            h('button', { type: 'submit', className: 'mcc-btn primary', disabled: saving || !snapshot.writable || editorOptions.length === 0 }, saving ? t('saving') : t('save')),
          ),
        ),
      )
      }

      const rows = Object.entries(entries).sort((a, b) => `${a[1].provider}/${a[1].model}`.localeCompare(`${b[1].provider}/${b[1].model}`))
      const activeCount = rows.filter(([, item]) => item.enabled !== false).length
      return h('div', { className: 'mcc-page' },
        h('div', { className: 'mcc-head' },
          h('div', { className: 'mcc-heading' },
            h('h2', { className: 'mcc-title' }, t('title')),
            h('p', { className: 'mcc-sub' }, t('subtitle')),
            h('div', { className: 'mcc-count' }, t('summary', { active: activeCount, configured: options.length })),
          ),
          h('button', { type: 'button', className: 'mcc-btn primary', onClick: editingKey === '__new__' ? closeEditor : startAdd, disabled: editingKey !== '__new__' && snapshot.writable === false }, editingKey === '__new__' ? t('close') : t('add')),
        ),
        snapshot.status === 'unavailable' ? h('div', { className: 'mcc-notice' }, t('catalogUnavailable')) : null,
        snapshot.status === 'ready' && snapshot.writable === false ? h('div', { className: 'mcc-notice' }, t('readOnly')) : null,
        piSnapshot.status === 'unavailable' ? h('div', { className: 'mcc-notice' }, t('piUnavailable')) : null,
        editingKey === '__new__' ? h('div', { className: 'mcc-new' }, editor(t('addTitle'))) : null,
        rows.length === 0 ? h('div', { className: 'mcc-empty' }, t('empty')) : rows.map(([key, item]) => {
          const actual = actualContext(piSnapshot.value, item.provider, item.model)
          const enabled = item.enabled !== false
          const matched = actual !== undefined
          const explicit = matched && actual.value !== undefined
          const correct = explicit && actual.value === item.contextWindow
          const defaulted = matched && !explicit
          const open = editingKey === key
          return h('div', { className: `mcc-card${open ? ' open' : ''}`, key },
            h('div', { className: 'mcc-row' },
              h('div', { className: 'mcc-main' },
                h('div', { className: 'mcc-route' }, `${item.provider} / ${item.model}`),
                h('div', { className: 'mcc-meta' },
                  h('span', null, `${t('window')}: ${formatTokens(item.contextWindow)}`),
                  h('span', {
                    className: `mcc-badge ${!enabled || !matched ? 'off' : correct ? 'ok' : defaulted ? '' : 'warn'}`,
                    title: defaulted && actual.value !== undefined ? `${t('providerDefault')}: ${formatTokens(actual.value)}` : undefined,
                  }, !enabled ? t('disabled') : correct ? t('applied') : defaulted ? t('providerDefault') : matched ? t('pending') : t('unmatched')),
                  h('span', { className: 'mcc-badge' }, Object.hasOwn(baseEntries, key) ? t('builtin') : t('custom')),
                ),
                item.note ? h('div', { className: 'mcc-meta' }, item.note) : null,
              ),
              h('div', { className: 'mcc-actions' },
                h('button', { type: 'button', className: 'mcc-btn', onClick: () => open ? closeEditor() : startEdit(key, item) }, open ? t('close') : t('edit')),
                h('button', { type: 'button', className: 'mcc-btn', onClick: () => toggle(key, item), disabled: saving }, enabled ? t('disable') : t('enable')),
                !Object.hasOwn(baseEntries, key) ? h('button', { type: 'button', className: 'mcc-btn danger', onClick: () => remove(key), disabled: saving }, t('remove')) : null,
              ),
            ),
            open ? editor(t('editTitle')) : null,
          )
        }),
      )
    }

    const dictionaries = {
      zh: { nav: '上下文窗口', title: '模型上下文窗口', subtitle: '从当前已经配置的模型中选择，并为精确的 provider/model 路由维护容量。启用项会自动同步到 llm-pi-ai。', summary: '已启用 {active} 项 · 当前配置中发现 {configured} 个模型', add: '添加模型', addTitle: '新建上下文窗口', editTitle: '编辑上下文窗口', chooseModel: '选择已配置模型', selectPlaceholder: '选择模型', selectHint: '按服务商分组，可搜索服务商、模型名称或 ID', searchModels: '搜索服务商、模型…', noMatches: '没有匹配的模型', modelCount: '{count} 个模型', window: '上下文窗口', note: '备注（可选）', notePlaceholder: '例如：Coding Plan 长上下文路由', save: '保存', saving: '保存中…', cancel: '取消', close: '收起', edit: '编辑', enable: '启用', disable: '停用', remove: '删除', applied: '已生效', pending: '等待同步', unmatched: '未配置此路由', providerDefault: '提供方默认容量', disabled: '已停用', builtin: '内置', custom: '自定义', empty: '还没有模型容量条目', noConfiguredModels: 'llm-pi-ai 中暂未发现已经配置的模型。', catalogUnavailable: '目录设置暂不可用，请稍后重试。', piUnavailable: '已配置模型列表暂不可用。', readOnly: '当前为只读视图，无法保存更改。', invalid: '请选择模型，并填写大于 0 的整数上下文窗口。' },
      en: { nav: 'Context windows', title: 'Model context windows', subtitle: 'Choose from currently configured models and maintain capacity for each exact provider/model route. Enabled entries sync to llm-pi-ai.', summary: '{active} enabled · {configured} configured models found', add: 'Add model', addTitle: 'New context window', editTitle: 'Edit context window', chooseModel: 'Configured model', selectPlaceholder: 'Choose a model', selectHint: 'Grouped by provider; search provider, name or ID', searchModels: 'Search providers, models…', noMatches: 'No matching models', modelCount: '{count} models', window: 'Context window', note: 'Note (optional)', notePlaceholder: 'For example: Coding Plan long-context route', save: 'Save', saving: 'Saving…', cancel: 'Cancel', close: 'Collapse', edit: 'Edit', enable: 'Enable', disable: 'Disable', remove: 'Delete', applied: 'Applied', pending: 'Pending sync', unmatched: 'Route not configured', providerDefault: 'Provider default capacity', disabled: 'Disabled', builtin: 'Built in', custom: 'Custom', empty: 'No context metadata entries yet', noConfiguredModels: 'No configured llm-pi-ai models were found.', catalogUnavailable: 'Catalog settings are unavailable right now.', piUnavailable: 'The configured model list is unavailable right now.', readOnly: 'Read-only view; changes cannot be saved.', invalid: 'Choose a model and enter a positive integer context window.' },
    }

    const inject = ['slots', 'locale', 'settingsScope']
    function apply(ctx) {
      const t = ctx.locale.bind(LOCALE_NS)
      const catalogScope = ctx.settingsScope.bind({ namespace: SETTINGS_NS, decode: decodeCatalog })
      const piScope = ctx.settingsScope.bind({ namespace: PI_NS, decode: decodePi })
      ctx.effect(installStyles, 'model-context-catalog: settings styles')
      ctx.effect(() => ctx.locale.register(LOCALE_NS, dictionaries), 'model-context-catalog: dictionaries')
      ctx.effect(() => () => { void catalogScope.dispose(); void piScope.dispose() }, 'model-context-catalog: settings scopes')
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section', id: 'model-context-catalog', order: 11,
        label: () => t('nav'), inject: () => ({ catalogScope, piScope, t }),
      }, CatalogPage))
    }

    exports.apply = apply
    exports.inject = inject
    exports.configuredModels = configuredModels
    exports.groupModelsByProvider = groupModelsByProvider
    exports.filterOptions = filterOptions
    return module.exports
  },
})

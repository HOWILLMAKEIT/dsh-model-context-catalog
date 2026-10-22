import { actualContext, formatTokens } from '../models.js'
import { createCatalogController } from '../controller.js'
import { createModelCombobox } from './model-combobox.js'
import { createBatchPanel } from './batch-panel.js'
import { readableSourceNote } from '../../domain/source-notes.js'

export function createCatalogPage(React) {
  const h = React.createElement
  const ModelCombobox = createModelCombobox(React)
  const BatchPanel = createBatchPanel(React)
  const useCatalogController = createCatalogController(React)
  function field(label, value, onChange, props = {}) {
    const control = props.multiline
      ? h('textarea', {
          className: 'mcc-input mcc-textarea',
          value,
          placeholder: props.placeholder ?? '',
          onChange: (event) => onChange(event.target.value),
        })
      : h('input', {
          className: 'mcc-input',
          value,
          type: props.type ?? 'text',
          placeholder: props.placeholder ?? '',
          onChange: (event) => onChange(event.target.value),
          min: props.min,
        })
    return h(
      'label',
      { className: `mcc-field${props.full ? ' full' : ''}` },
      h('span', { className: 'mcc-label' }, label),
      control,
    )
  }
  return function CatalogPage(props) {
    const { t } = props
    const {
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
      cancelBatch,
    } = useCatalogController(props)
    const editor = (title) => {
      const selectedItem = editingKey && editingKey !== '__new__' ? entries[editingKey] : undefined
      const editorOptions =
        route && !options.some((option) => option.value === route) && selectedItem
          ? [
              {
                value: route,
                provider: selectedItem.provider,
                providerName: selectedItem.provider,
                model: selectedItem.model,
                modelName: selectedItem.model,
                searchText: `${selectedItem.provider} ${selectedItem.model}`.toLocaleLowerCase(),
              },
              ...options,
            ]
          : options
      return h(
        'form',
        { className: 'mcc-editor', onSubmit: submit },
        h('div', { className: 'mcc-editor-title' }, title),
        h(
          'div',
          { className: 'mcc-form' },
          h(ModelCombobox, {
            label: t('chooseModel'),
            value: route,
            onChange: setRoute,
            options: editorOptions,
            disabled: editingKey !== '__new__' || !snapshot.writable,
            t,
          }),
          field(t('window'), windowValue, setWindowValue, { type: 'number', min: 1, placeholder: '128000' }),
          field(t('sourceUrl'), sourceUrl, setSourceUrl, { full: true, placeholder: 'https://…' }),
          field(t('note'), note, setNote, { full: true, multiline: true, placeholder: t('notePlaceholder') }),
          editorOptions.length === 0 ? h('div', { className: 'mcc-error' }, t('noConfiguredModels')) : null,
          error ? h('div', { className: 'mcc-error' }, error) : null,
          h(
            'div',
            { className: 'mcc-form-actions' },
            h('button', { type: 'button', className: 'mcc-btn', onClick: closeEditor }, t('cancel')),
            h(
              'button',
              {
                type: 'submit',
                className: 'mcc-btn primary',
                disabled: saving || !snapshot.writable || editorOptions.length === 0,
              },
              saving ? t('saving') : t('save'),
            ),
          ),
        ),
      )
    }

    const rows = Object.entries(entries).sort((a, b) =>
      `${a[1].provider}/${a[1].model}`.localeCompare(`${b[1].provider}/${b[1].model}`),
    )
    const activeCount = rows.filter(([, item]) => item.enabled !== false).length
    return h(
      'div',
      { className: 'mcc-page' },
      h(
        'div',
        { className: 'mcc-head' },
        h(
          'div',
          { className: 'mcc-heading' },
          h('h2', { className: 'mcc-title' }, t('title')),
          h('p', { className: 'mcc-sub' }, t('subtitle')),
          h('div', { className: 'mcc-count' }, t('summary', { active: activeCount, configured: options.length })),
        ),
        h(
          'div',
          { className: 'mcc-toolbar' },
          h(
            'button',
            {
              type: 'button',
              className: 'mcc-btn',
              onClick: editingKey === '__new__' ? closeEditor : () => startAdd(),
              disabled: saving || scanning || snapshot.writable === false,
            },
            editingKey === '__new__' ? t('close') : t('add'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mcc-btn primary',
              onClick: startAuto,
              disabled: saving || scanning || !snapshot.writable || piSnapshot.status !== 'ready',
            },
            scanning ? t('scanning') : t('autoAdd'),
          ),
        ),
      ),
      snapshot.status === 'unavailable' ? h('div', { className: 'mcc-notice' }, t('catalogUnavailable')) : null,
      snapshot.status === 'ready' && snapshot.writable === false
        ? h('div', { className: 'mcc-notice' }, t('readOnly'))
        : null,
      piSnapshot.status === 'unavailable' ? h('div', { className: 'mcc-notice' }, t('piUnavailable')) : null,
      error && editingKey === null ? h('div', { className: 'mcc-error', role: 'alert' }, error) : null,
      message ? h('div', { className: 'mcc-notice', role: 'status' }, message) : null,
      batch
        ? h(BatchPanel, {
            rows: batch.rows,
            references: batch.references,
            endpointStatuses: batch.endpointStatuses,
            writable: snapshot.writable && piSnapshot.status === 'ready',
            saving,
            onSave: addSelected,
            onCancel: cancelBatch,
            onManual: startAdd,
            t,
          })
        : null,
      editingKey === '__new__' ? h('div', { className: 'mcc-new' }, editor(t('addTitle'))) : null,
      rows.length === 0
        ? h('div', { className: 'mcc-empty' }, t('empty'))
        : rows.map(([key, item]) => {
            const actual = actualContext(piSnapshot.value, item.provider, item.model)
            const enabled = item.enabled !== false
            const matched = actual !== undefined
            const explicit = matched && actual.explicit && actual.value !== undefined
            const correct = explicit && actual.value === item.contextWindow
            const open = editingKey === key
            const syncNotice =
              enabled && piSnapshot.status === 'ready' && !correct ? t(matched ? 'syncPending' : 'routeMissing') : null
            return h(
              'div',
              { className: `mcc-card${open ? ' open' : ''}${enabled ? '' : ' off'}`, key },
              h(
                'div',
                { className: 'mcc-row' },
                h(
                  'div',
                  { className: 'mcc-main' },
                  h('div', { className: 'mcc-route' }, `${item.provider} / ${item.model}`),
                  h(
                    'div',
                    { className: 'mcc-meta' },
                    h('span', null, `${t('window')}: ${formatTokens(item.contextWindow)}`),
                  ),
                  item.note ? h('div', { className: 'mcc-meta' }, readableSourceNote(item)) : null,
                  syncNotice ? h('div', { className: 'mcc-sync-notice', role: 'status' }, syncNotice) : null,
                ),
                h(
                  'div',
                  { className: 'mcc-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mcc-btn',
                      onClick: () => (open ? closeEditor() : startEdit(key, item)),
                    },
                    open ? t('close') : t('edit'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mcc-btn danger',
                      onClick: () => remove(key),
                      disabled: saving || !snapshot.writable,
                    },
                    t('remove'),
                  ),
                  h(
                    'label',
                    { className: 'mcc-toggle' },
                    h('span', null, t('enable')),
                    h(
                      'button',
                      {
                        type: 'button',
                        role: 'switch',
                        className: 'mcc-switch',
                        'aria-label': t('manageRoute', { route: `${item.provider} / ${item.model}` }),
                        'aria-checked': enabled,
                        onClick: () => toggle(key, item),
                        disabled: saving || !snapshot.writable,
                      },
                      h('span', { className: 'mcc-switch-thumb', 'aria-hidden': 'true' }),
                    ),
                  ),
                ),
              ),
              open ? editor(t('editTitle')) : null,
            )
          }),
    )
  }
}

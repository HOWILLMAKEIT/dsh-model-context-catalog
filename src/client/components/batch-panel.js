import { CAPACITY_CATALOG_INFO } from '../../data/model-capacities.js'
import { formatTokens } from '../models.js'

export function createBatchPanel(React) {
  const h = React.createElement
  function BatchPanel({ rows, writable, saving, onSave, onCancel, onManual, t }) {
    const [choices, setChoices] = React.useState(() =>
      Object.fromEntries(rows.map((row) => [row.key, row.recommended?.key ?? ''])),
    )
    const [checked, setChecked] = React.useState(() =>
      Object.fromEntries(rows.map((row) => [row.key, row.selectedByDefault])),
    )
    const selected = rows.filter((row) => checked[row.key] && choices[row.key])
    const disabled = saving || !writable
    return h(
      'section',
      { className: 'mcc-batch', 'aria-label': t('autoTitle') },
      h(
        'div',
        { className: 'mcc-batch-head' },
        h('h3', { className: 'mcc-batch-title' }, t('autoTitle')),
        h('p', { className: 'mcc-sub' }, t('autoHint')),
        h(
          'div',
          { className: 'mcc-count' },
          t('referenceSummary', {
            count: CAPACITY_CATALOG_INFO.modelRecords,
            date: CAPACITY_CATALOG_INFO.updatedAt.slice(0, 10),
          }),
        ),
        h(
          'div',
          { className: 'mcc-batch-tools' },
          h('span', null, t('selectionSummary', { selected: selected.length, total: rows.length })),
          h(
            'div',
            { className: 'mcc-toolbar' },
            h(
              'button',
              {
                type: 'button',
                className: 'mcc-btn',
                disabled,
                onClick: () => setChecked(Object.fromEntries(rows.map((row) => [row.key, Boolean(choices[row.key])]))),
              },
              t('selectAll'),
            ),
            h(
              'button',
              { type: 'button', className: 'mcc-btn', disabled, onClick: () => setChecked({}) },
              t('selectNone'),
            ),
          ),
        ),
      ),
      rows.length === 0
        ? h('div', { className: 'mcc-empty' }, t('noCandidates'))
        : h(
            'div',
            { className: 'mcc-batch-scroll' },
            h(
              'table',
              { className: 'mcc-batch-table' },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', { scope: 'col' }, t('select')),
                  h('th', { scope: 'col' }, t('chooseModel')),
                  h('th', { scope: 'col' }, t('currentWindow')),
                  h('th', { scope: 'col' }, t('referenceWindow')),
                ),
              ),
              h(
                'tbody',
                null,
                rows.map((row) => {
                  const choice = row.choices.find((item) => item.key === choices[row.key])
                  const evidence = choice?.evidence[0]
                  return h(
                    'tr',
                    { key: row.key },
                    h(
                      'td',
                      null,
                      h('input', {
                        type: 'checkbox',
                        className: 'mcc-check',
                        checked: Boolean(checked[row.key] && choice),
                        'aria-label': t('selectRoute', { route: `${row.provider} / ${row.model}` }),
                        disabled: disabled || !choice,
                        onChange: (event) => setChecked({ ...checked, [row.key]: event.target.checked }),
                      }),
                    ),
                    h(
                      'td',
                      null,
                      h('div', { className: 'mcc-route' }, row.modelName),
                      h('div', { className: 'mcc-batch-route' }, `${row.provider} / ${row.model}`),
                      h(
                        'div',
                        { className: 'mcc-batch-method' },
                        t(row.hasReference ? `match_${row.method}` : row.currentWindow ? 'existingOnly' : 'unmatched'),
                      ),
                    ),
                    h(
                      'td',
                      null,
                      row.currentWindow ? formatTokens(row.currentWindow) : t('notDeclared'),
                      h('div', { className: 'mcc-batch-method' }, t(`${row.reason}Window`)),
                    ),
                    h(
                      'td',
                      null,
                      row.choices.length
                        ? h(
                            React.Fragment,
                            null,
                            row.choices.length === 1
                              ? h('div', { className: 'mcc-route' }, formatTokens(choice.contextWindow))
                              : h(
                                  'select',
                                  {
                                    className: 'mcc-input',
                                    value: choices[row.key],
                                    disabled,
                                    'aria-label': t('chooseCapacity', { route: `${row.provider} / ${row.model}` }),
                                    onChange: (event) => setChoices({ ...choices, [row.key]: event.target.value }),
                                  },
                                  h('option', { value: '' }, t(row.conflict ? 'resolveConflict' : 'chooseReference')),
                                  row.choices.map((item) =>
                                    h(
                                      'option',
                                      { key: item.key, value: item.key },
                                      `${formatTokens(item.contextWindow)} · ${item.evidence
                                        .map((e) =>
                                          e.scope === 'configured'
                                            ? t('keepCurrent')
                                            : e.scope === 'model'
                                              ? `${e.manufacturerName || e.provider} ${t('modelDefault')}`
                                              : e.providerName || e.provider,
                                        )
                                        .filter((v, i, values) => values.indexOf(v) === i)
                                        .join(' / ')}`,
                                    ),
                                  ),
                                ),
                            evidence && evidence.scope !== 'configured'
                              ? h(
                                  'div',
                                  { className: 'mcc-batch-method' },
                                  t('manufacturer', {
                                    name:
                                      evidence.manufacturerName || evidence.manufacturer || t('unknownManufacturer'),
                                  }),
                                )
                              : null,
                            evidence
                              ? h(
                                  'div',
                                  { className: 'mcc-batch-method' },
                                  t(
                                    evidence.scope === 'configured'
                                      ? `fromCurrent_${evidence.windowSource}`
                                      : evidence.scope === 'model'
                                        ? 'fromModelDefault'
                                        : 'fromProvider',
                                    { name: evidence.providerName || evidence.provider },
                                  ),
                                )
                              : null,
                            evidence?.sourceUrl
                              ? h(
                                  'div',
                                  { className: 'mcc-batch-evidence' },
                                  h(
                                    'a',
                                    { href: evidence.sourceUrl, target: '_blank', rel: 'noreferrer' },
                                    evidence.source,
                                  ),
                                  ` · ${evidence.id}`,
                                )
                              : null,
                          )
                        : h(
                            'button',
                            { type: 'button', className: 'mcc-btn', disabled, onClick: () => onManual(row) },
                            t('manualCapacity'),
                          ),
                    ),
                  )
                }),
              ),
            ),
          ),
      h(
        'div',
        { className: 'mcc-batch-footer' },
        h('button', { type: 'button', className: 'mcc-btn', disabled: saving, onClick: onCancel }, t('cancel')),
        h(
          'button',
          {
            type: 'button',
            className: 'mcc-btn primary',
            disabled: disabled || selected.length === 0,
            onClick: () => onSave(Object.fromEntries(selected.map((row) => [row.key, choices[row.key]]))),
          },
          t('addSelected', { count: selected.length }),
        ),
      ),
    )
  }
  return BatchPanel
}

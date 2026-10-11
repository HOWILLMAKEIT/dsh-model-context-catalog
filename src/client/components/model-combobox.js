import { filterOptions, groupModelsByProvider, floatingMenuLayout } from '../models.js'

export function createModelCombobox(React) {
  const h = React.createElement
  let comboSeq = 0
  function ModelCombobox({ label, value, onChange, options, disabled, t }) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [menuStyle, setMenuStyle] = React.useState(undefined)
    const rootRef = React.useRef(null)
    const triggerRef = React.useRef(null)
    const searchRef = React.useRef(null)
    const menuFocusedRef = React.useRef(false)
    const listboxId = React.useRef(`mcc-combo-list-${++comboSeq}`).current
    const selected = options.find((option) => option.value === value)
    const visible = filterOptions(options, query)
    const groups = groupModelsByProvider(visible)
    const close = () => {
      setOpen(false)
      setQuery('')
      setActiveIndex(0)
      setMenuStyle(undefined)
      menuFocusedRef.current = false
    }
    const toggleOpen = () => {
      if (disabled) return
      if (open) {
        close()
        return
      }
      setActiveIndex(
        Math.max(
          options.findIndex((option) => option.value === value),
          0,
        ),
      )
      setOpen(true)
    }
    React.useEffect(() => {
      if (!open) return undefined
      const updatePosition = () => {
        const rect = triggerRef.current?.getBoundingClientRect()
        if (rect) setMenuStyle(floatingMenuLayout(rect, window.innerWidth, window.innerHeight))
      }
      const closeOnOutside = (event) => {
        if (!rootRef.current?.contains(event.target)) close()
      }
      const closeOnEscape = (event) => {
        if (event.key === 'Escape') {
          close()
          triggerRef.current?.focus()
        }
      }
      updatePosition()
      document.addEventListener('pointerdown', closeOnOutside)
      document.addEventListener('keydown', closeOnEscape)
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      const reposition = window.setInterval(updatePosition, 120)
      return () => {
        document.removeEventListener('pointerdown', closeOnOutside)
        document.removeEventListener('keydown', closeOnEscape)
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
        window.clearInterval(reposition)
      }
    }, [open])
    React.useEffect(() => {
      if (open && menuStyle && !menuFocusedRef.current) {
        searchRef.current?.focus()
        menuFocusedRef.current = true
      }
      const active = rootRef.current?.querySelector('[data-active="true"]')
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' })
    }, [open, menuStyle, activeIndex])
    const choose = (option) => {
      onChange(option.value)
      close()
    }
    const moveActive = (next) => setActiveIndex(visible.length === 0 ? 0 : (next + visible.length) % visible.length)
    const onMenuKeyDown = (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveActive(activeIndex + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveActive(activeIndex - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        setActiveIndex(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        setActiveIndex(Math.max(visible.length - 1, 0))
      } else if (event.key === 'Enter' && visible[activeIndex]) {
        event.preventDefault()
        choose(visible[activeIndex])
      }
    }
    let rendered = 0
    return h(
      'div',
      { className: 'mcc-field' },
      h('span', { className: 'mcc-label' }, label),
      h(
        'div',
        { className: 'mcc-combo', ref: rootRef },
        h(
          'button',
          {
            type: 'button',
            disabled,
            ref: triggerRef,
            'aria-haspopup': 'listbox',
            'aria-expanded': open,
            'aria-controls': open ? listboxId : undefined,
            className: `mcc-combo-trigger${open ? ' open' : ''}`,
            title: selected ? `${selected.providerName} (${selected.provider}) · ${selected.model}` : undefined,
            onClick: toggleOpen,
            onKeyDown: (event) => {
              if (!disabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault()
                toggleOpen()
              }
            },
          },
          h(
            'span',
            { className: 'mcc-combo-value' },
            h(
              'span',
              { className: 'mcc-combo-primary' },
              selected?.modelName || selected?.model || t('selectPlaceholder'),
            ),
          ),
          h('span', { className: 'mcc-combo-chevron', 'aria-hidden': 'true' }),
        ),
        open
          ? h(
              'div',
              { className: 'mcc-combo-menu', style: menuStyle ?? { visibility: 'hidden' } },
              h(
                'div',
                { className: 'mcc-combo-search-wrap' },
                h('input', {
                  ref: searchRef,
                  className: 'mcc-combo-search',
                  value: query,
                  placeholder: t('searchModels'),
                  onChange: (event) => {
                    setQuery(event.target.value)
                    setActiveIndex(0)
                  },
                  onKeyDown: onMenuKeyDown,
                  'aria-label': t('searchModels'),
                  'aria-controls': listboxId,
                }),
              ),
              h(
                'div',
                {
                  className: 'mcc-combo-list',
                  role: 'listbox',
                  id: listboxId,
                  'aria-activedescendant': visible[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined,
                },
                groups.length === 0
                  ? h('div', { className: 'mcc-combo-empty' }, t('noMatches'))
                  : groups.map((group) => {
                      const startIndex = rendered
                      rendered += group.options.length
                      return h(
                        'div',
                        { className: 'mcc-combo-group', key: group.provider },
                        h(
                          'div',
                          { className: 'mcc-combo-group-head' },
                          h('span', { className: 'mcc-combo-group-title' }, group.title),
                          group.provider !== group.title
                            ? h('span', { className: 'mcc-combo-group-sub' }, `· ${group.provider}`)
                            : null,
                        ),
                        group.options.map((option, offset) => {
                          const index = startIndex + offset
                          return h(
                            'button',
                            {
                              type: 'button',
                              role: 'option',
                              id: `${listboxId}-opt-${index}`,
                              'aria-selected': option.value === value,
                              'data-active': index === activeIndex ? 'true' : undefined,
                              title: `${option.modelName}\n${option.providerName} (${option.provider}) · ${option.model}`,
                              className: `mcc-combo-option${option.value === value ? ' selected' : ''}${index === activeIndex ? ' active' : ''}`,
                              key: option.value,
                              onClick: () => choose(option),
                              onMouseEnter: () => setActiveIndex(index),
                            },
                            h(
                              'span',
                              { className: 'mcc-combo-value' },
                              h('span', { className: 'mcc-combo-primary' }, option.modelName),
                            ),
                          )
                        }),
                      )
                    }),
              ),
            )
          : null,
      ),
    )
  }
  return ModelCombobox
}

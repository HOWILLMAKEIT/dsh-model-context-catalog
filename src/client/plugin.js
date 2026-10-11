import { createCapacityDiscovery } from '../discovery/index.js'
import { REFERENCE_MODEL_CAPACITIES } from '../data/model-capacities.js'
import {
  CATALOG_SETTINGS_NAMESPACE as SETTINGS_NS,
  MODEL_SETTINGS_NAMESPACE as PI_NS,
  LOCALE_NAMESPACE as LOCALE_NS,
} from '../shared/contracts.js'
import { dictionaries } from './locales.js'
import { installStyles } from './styles.js'
import { createCatalogPage } from './components/catalog-page.js'
import { configuredModels, groupModelsByProvider, filterOptions, floatingMenuLayout, actualContext } from './models.js'
import { entryMutations } from './settings.js'

export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.llm']

export function createClientPlugin(React) {
  const capacityDiscovery = createCapacityDiscovery(REFERENCE_MODEL_CAPACITIES)
  const CatalogPage = createCatalogPage(React, capacityDiscovery)
  function apply(ctx) {
    const t = ctx.locale.bind(LOCALE_NS)
    const catalogScope = ctx.configForms.get(SETTINGS_NS)
    const piScope = ctx.configForms.get(PI_NS)
    const remote = ctx.get?.('remote') ?? ctx.remote
    const discoverBuiltin = remote?.llm?.discoverModels
      ? (provider) => remote.llm.discoverModels(PI_NS, { provider })
      : undefined
    ctx.effect(installStyles, 'model-context-catalog: settings styles')
    ctx.effect(() => ctx.locale.register(LOCALE_NS, dictionaries), 'model-context-catalog: dictionaries')
    ctx.slots.inject('settings.section', () =>
      ctx.slots.register(
        {
          name: 'settings.section',
          id: 'model-context-catalog',
          order: 11,
          label: () => t('nav'),
          inject: () => ({ catalogScope, piScope, discoverBuiltin, t }),
        },
        CatalogPage,
      ),
    )
  }
  const plugin = {
    apply,
    inject,
    configuredModels,
    groupModelsByProvider,
    filterOptions,
    floatingMenuLayout,
    entryMutations,
    actualContext,
    capacityDiscovery,
  }
  Object.defineProperty(plugin, Symbol.toStringTag, { value: 'Module' })
  return plugin
}

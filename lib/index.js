// Generated from index.js; run npm run build after editing source.
import z from '@deepseek-ai/schemastery'
import {
  MODEL_CONTEXT_CATALOG,
  activeCatalogFromSettings,
  catalogSettingsEntries,
  planPiAiContextUpdate,
} from './catalog.js'

export const name = 'model-context-catalog'
export const inject = ['settings', 'llm']

const SETTINGS_NAMESPACE = 'llm-pi-ai'
export const CATALOG_SETTINGS_NAMESPACE = 'model-context-catalog'

const CatalogEntrySchema = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  contextWindow: z.number().step(1).min(1).required(),
  sourceUrl: z.string(),
  note: z.string(),
  enabled: z.boolean().default(true),
})

export const CatalogSettingsSchema = z.object({
  entries: z.dict(CatalogEntrySchema).default({}),
})

const correctionText = (item) => `${item.provider}/${item.model}: ${String(item.from ?? 'unknown')} -> ${item.to}`

/**
 * Correct the registered pi-ai settings section through its public settings
 * seam. The adapter's own watcher then rebuilds the route snapshot atomically.
 */
export function apply(ctx) {
  let disposed = false
  let queue = Promise.resolve()
  const catalogScope = ctx.settings.register(
    CATALOG_SETTINGS_NAMESPACE,
    CatalogSettingsSchema,
    { base: { entries: catalogSettingsEntries() } },
  )

  const reconcile = async () => {
    for (let attempt = 0; attempt < 3 && !disposed; attempt += 1) {
      const descriptor = ctx.settings
        .describe({ redactSecrets: true })
        .find((candidate) => String(candidate.ns) === SETTINGS_NAMESPACE)
      const section = ctx.settings.get(SETTINGS_NAMESPACE)
      if (descriptor === undefined || section === undefined) {
        ctx.logger.warn('model-context-catalog: llm-pi-ai settings namespace is unavailable')
        return
      }

      const catalog = activeCatalogFromSettings(catalogScope.get()?.entries ?? {})
      const plan = planPiAiContextUpdate(section, catalog)
      if (plan.patch === null) return

      try {
        await ctx.settings.update(SETTINGS_NAMESPACE, plan.patch, descriptor.revision)
      } catch (error) {
        if (error?.code === 'SETTINGS_CONFLICT') continue
        throw error
      }
      for (const correction of plan.corrections) {
        ctx.logger.info(`model-context-catalog: corrected ${correctionText(correction)} (${correction.sourceUrl})`)
      }
      return
    }
    if (!disposed) ctx.logger.warn('model-context-catalog: settings kept changing; deferred reconciliation to the next update')
  }

  const schedule = () => {
    queue = queue.then(reconcile, reconcile).catch((error) => {
      ctx.logger.warn(`model-context-catalog: reconciliation failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const stopDocument = ctx.on('settings/document-updated', (ns) => {
    if (String(ns) === SETTINGS_NAMESPACE) schedule()
  })
  const stopCatalog = catalogScope.watch(schedule)

  schedule()

  return () => {
    disposed = true
    stopDocument()
    stopCatalog()
  }
}

export { MODEL_CONTEXT_CATALOG, planPiAiContextUpdate } from './catalog.js'

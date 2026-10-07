// Generated from index.js; run npm run build after editing source.
import z from '@deepseek-ai/schemastery'
import {
  MODEL_CONTEXT_CATALOG,
  activeCatalogFromSettings,
  catalogSettingsEntries,
  planPiAiContextUpdate,
} from './catalog.js'

export const name = 'model-context-catalog'
export const inject = ['settings']

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

// DSH 0.2 projects a plugin's volatile Config fields into Settings forms.
// Existing model-context-catalog entries remain under the same Loader id.
export const Config = z.object({
  entries: z.dict(CatalogEntrySchema).default(catalogSettingsEntries()).volatile(),
})
export const CatalogSettingsSchema = Config

const correctionText = (item) => `${item.provider}/${item.model}: ${String(item.from ?? 'unknown')} -> ${item.to}`

/**
 * Maintain capacities for explicitly listed custom model routes. Read the
 * Settings descriptor and mutate only contextWindow paths with revision CAS.
 */
export function apply(ctx, config) {
  let disposed = false
  let queue = Promise.resolve()
  ctx.effect(() => ctx.settings.configure({ auto: false }))

  const reconcile = async () => {
    for (let attempt = 0; attempt < 3 && !disposed; attempt += 1) {
      const descriptor = ctx.settings
        .describe({ redactSecrets: true })
        .find((candidate) => String(candidate.ns) === SETTINGS_NAMESPACE)
      const section = descriptor?.value
      if (descriptor === undefined || section === undefined) {
        ctx.logger.warn('model-context-catalog: llm-pi-ai settings namespace is unavailable')
        return
      }

      const catalog = activeCatalogFromSettings(config.entries.get())
      const plan = planPiAiContextUpdate(section, catalog)
      if (plan.ops.length === 0) return

      try {
        // A descriptor may redact fields inside a model row. Never write that
        // row back wholesale: path edits preserve credentials and unknown data.
        await ctx.settings.mutate(SETTINGS_NAMESPACE, plan.ops, descriptor.revision)
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
    const enqueue = () => {
      queue = queue.then(reconcile, reconcile).catch((error) => {
        ctx.logger.warn(`model-context-catalog: reconciliation failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    // DSH 0.2 HMR uses AsyncLocalStorage to reject nested profile edits.
    // A Promise created by its update event inherits that transaction even
    // after the event returns. Exit it before queuing a separate Settings edit.
    // executing is a version-specific HMR implementation detail; no HMR is
    // required in non-web hosts or the isolated Settings fixture.
    const transaction = ctx.get?.('hmr')?.executing
    if (typeof transaction?.exit === 'function') transaction.exit(enqueue)
    else enqueue()
  }

  const stopDocument = ctx.on('settings/document-updated', (ns) => {
    if ([SETTINGS_NAMESPACE, CATALOG_SETTINGS_NAMESPACE].includes(String(ns))) schedule()
  })
  // Loader scopes volatile updates to the changed plugin's fiber. Model
  // settings belong to another fiber, so an ordinary listener misses them.
  const stopCatalog = ctx.on('loader/volatile-update', schedule, { global: true })
  const stopReload = ctx.on('app-boot/config-reload', schedule)

  schedule()

  const dispose = () => {
    disposed = true
    stopDocument()
    stopCatalog()
    stopReload()
  }
  ctx.effect(() => dispose)
  return dispose
}

export { MODEL_CONTEXT_CATALOG, planPiAiContextUpdate } from './catalog.js'

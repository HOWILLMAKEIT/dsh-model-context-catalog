import z from '@deepseek-ai/schemastery'
import { catalogSettingsEntries } from '../domain/catalog.js'

export const name = 'model-context-catalog'
export const inject = ['settings']

export { synchronizeContexts as apply } from './synchronize.js'
export { CATALOG_SETTINGS_NAMESPACE } from '../shared/contracts.js'

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

export { MODEL_CONTEXT_CATALOG, planPiAiContextUpdate } from '../domain/catalog.js'

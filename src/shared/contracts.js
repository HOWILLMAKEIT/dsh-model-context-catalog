/** Stable DSH service names and route identity shared by host and browser. */
export const CLIENT_ID = 'dsh-model-context-catalog'
export const CATALOG_SETTINGS_NAMESPACE = 'model-context-catalog'
export const MODEL_SETTINGS_NAMESPACE = 'llm-pi-ai'
export const LOCALE_NAMESPACE = 'settings.modelContextCatalog'
export const routeKey = (provider, model) => `${provider}\u0000${model}`
export const catalogEntryKey = (provider, model) => `${provider}::${model}`
export const validContextWindow = (value) => Number.isSafeInteger(value) && value > 0

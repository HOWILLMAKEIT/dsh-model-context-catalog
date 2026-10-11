import { compact } from '../discovery/names.js'
import { validContextWindow as positive } from '../shared/contracts.js'

/** Extract full context-window references only. */
export function normalizeCapacitySources(modelsDev, modelMetadata = {}) {
  const records = []
  const manufacturerNames = {
    minimax: 'MiniMax',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    deepseek: 'DeepSeek',
    alibaba: 'Alibaba',
    zhipuai: 'Zhipu AI',
    moonshotai: 'Moonshot AI',
    xai: 'xAI',
    mistral: 'Mistral',
  }
  const modelIds = Object.keys(modelMetadata)
  const manufacturerFor = (id) => {
    const manufacturer = id?.split('/')[0]
    return manufacturer ? { manufacturer, manufacturerName: manufacturerNames[manufacturer] || manufacturer } : {}
  }
  const aliases = new Map()
  for (const [provider, profile] of Object.entries(modelsDev ?? {})) {
    for (const [id, model] of Object.entries(profile?.models ?? {})) {
      if (!id || !model || !positive(model.limit?.context) || !model.modalities?.output?.includes('text')) continue
      const inferred = modelIds.filter((key) => compact(key.split('/').at(-1)) === compact(id.split('/').at(-1)))
      const canonicalId = model.canonical_model_id || (inferred.length === 1 ? inferred[0] : undefined)
      if (canonicalId && Object.hasOwn(modelMetadata, canonicalId)) {
        if (!aliases.has(canonicalId)) aliases.set(canonicalId, new Set())
        aliases.get(canonicalId).add(id)
      }
      records.push({
        provider,
        providerName: profile.name || provider,
        scope: 'provider',
        ...manufacturerFor(canonicalId),
        ...(canonicalId ? { canonicalId } : {}),
        id,
        name: model.name || id,
        contextWindow: model.limit.context,
        kind: 'context',
        source: 'models.dev',
        field: 'limit.context',
        sourceUrl: `https://models.dev/providers/${encodeURIComponent(provider)}`,
      })
    }
  }
  for (const [id, model] of Object.entries(modelMetadata)) {
    if (!model || !positive(model.limit?.context) || !model.modalities?.output?.includes('text')) continue
    const factory = manufacturerFor(id)
    records.push({
      ...factory,
      provider: factory.manufacturer,
      providerName: factory.manufacturerName,
      scope: 'model',
      id,
      canonicalId: id,
      name: model.name || id,
      aliases: [...(aliases.get(id) ?? [])].sort(),
      contextWindow: model.limit.context,
      kind: 'context',
      source: 'models.dev',
      field: 'limit.context',
      sourceUrl: `https://models.dev/models/${id.split('/').map(encodeURIComponent).join('/')}`,
    })
  }
  return records.sort((a, b) =>
    `${a.scope}/${a.provider}/${a.id}`.localeCompare(`${b.scope}/${b.provider}/${b.id}`, 'en'),
  )
}

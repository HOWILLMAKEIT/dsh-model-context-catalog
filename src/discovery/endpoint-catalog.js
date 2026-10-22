import { validContextWindow, routeKey } from '../shared/contracts.js'

/** Parse capacity declarations, never output limits or inferred model aliases. */
export function parseEndpointCatalog(body) {
  if (!body || !Array.isArray(body.models)) return { status: 'unsupported', models: [] }
  const capacities = new Map()
  const conflicts = new Set()
  for (const row of body.models) {
    if (typeof row?.slug !== 'string' || !row.slug.trim()) continue
    const value = [row.context_window, row.max_context_window].find(validContextWindow)
    if (value === undefined) continue
    if (capacities.has(row.slug) && capacities.get(row.slug) !== value) conflicts.add(row.slug)
    capacities.set(row.slug, value)
  }
  const models = [...capacities]
    .filter(([id]) => !conflicts.has(id))
    .map(([id, contextWindow]) => ({ id, contextWindow }))
  return { status: models.length ? 'supported' : 'empty', models }
}

/** Preserve route identity; endpoint declarations never enter the global name index. */
export function mergeEndpointMatch(match, endpoint, provider, model, providerName) {
  if (!validContextWindow(endpoint)) return match
  const choice = {
    key: `endpoint:${endpoint}`,
    contextWindow: endpoint,
    kind: 'context',
    evidence: [
      { scope: 'endpoint', provider, providerName: providerName || provider, id: model, source: 'CLIProxyAPI' },
    ],
  }
  return {
    ...match,
    method: 'endpoint',
    choices: [choice, ...match.choices],
    recommended: choice,
    conflict: match.choices.some((item) => item.contextWindow !== endpoint),
    referenceScope: 'endpoint',
  }
}

/** One bounded batch per click; remote failures only affect their own provider. */
export async function loadEndpointContexts(providers, discover) {
  const contexts = Object.create(null)
  const statuses = []
  for (let offset = 0; offset < providers.length; offset += 4) {
    await Promise.all(
      providers.slice(offset, offset + 4).map(async (provider) => {
        let status = 'failed'
        try {
          if (typeof discover !== 'function') throw new Error('CAPACITY_UNAVAILABLE')
          const result = await discover(provider)
          if (result.ok) {
            status = result.value.length ? 'supported' : 'empty'
            for (const model of result.value) {
              if (typeof model.id === 'string' && validContextWindow(model.contextWindow))
                contexts[routeKey(provider, model.id)] = model.contextWindow
            }
          } else {
            const code = result.error?.message
            status = /^CAPACITY_(unsupported|empty|auth|timeout|failed|unavailable)$/.test(code ?? '')
              ? code.slice('CAPACITY_'.length)
              : 'failed'
          }
        } catch {
          status = 'failed'
        }
        statuses.push({ provider, status })
      }),
    )
  }
  return { contexts, statuses }
}

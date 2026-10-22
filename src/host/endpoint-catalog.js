import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { parseEndpointCatalog } from '../discovery/endpoint-catalog.js'
import { MODEL_SETTINGS_NAMESPACE, CATALOG_SETTINGS_NAMESPACE } from '../shared/contracts.js'

const MAX_BYTES = 4 * 1024 * 1024
const PROTOCOLS = new Set(['openai-completions', 'openai-responses'])
const failure = (status) => new Error(`CAPACITY_${status}`)

/** Keep deployment prefixes and existing query parameters; never guess /v1. */
export function endpointCatalogUrl(baseURL) {
  const url = new URL(baseURL)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw failure('unsupported')
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/models`
  url.searchParams.set('client_version', '1')
  url.hash = ''
  return url
}

async function abortable(task, signal) {
  signal.throwIfAborted()
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([Promise.resolve().then(task), aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

async function boundedJson(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {
    await response.body?.cancel()
    throw failure('failed')
  }
  if (!response.body) throw failure('failed')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let body = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) throw failure('failed')
      body += decoder.decode(value, { stream: true })
    }
    return JSON.parse(body + decoder.decode())
  } finally {
    await reader.cancel().catch(() => {})
  }
}

/** Query only a stored provider. Neither credentials nor raw response text cross Remote. */
export async function probeEndpointCatalog(ctx, provider, { fetcher = globalThis.fetch, signal, timeout = 5000 } = {}) {
  const profile = ctx.settings.describe().find((item) => String(item.ns) === MODEL_SETTINGS_NAMESPACE)?.value
    ?.providers?.[provider]
  if (!profile || !Object.hasOwn(profile, 'baseURL') || !PROTOCOLS.has(profile.api ?? 'openai-completions'))
    throw failure('unsupported')
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  const timer = setTimeout(abort, timeout)
  try {
    const url = endpointCatalogUrl(profile.baseURL)
    const headers = new Headers(profile.headers)
    headers.set('accept', 'application/json')
    if (profile.apiKeyEnv !== undefined) {
      const credentials = ctx.get?.('credentials')
      const key = credentials
        ? (await abortable(() => credentials.resolve(profile.apiKeyEnv), controller.signal))?.value
        : launchEnvironmentOf(ctx).get(profile.apiKeyEnv)?.value
      if (typeof key !== 'string' || !key.trim()) throw failure('auth')
      headers.set('authorization', `Bearer ${key.trim()}`)
    }
    const response = await fetcher(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      // Refuse all redirects, so secrets never reach another origin or URL.
      redirect: 'error',
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw failure([401, 403].includes(response.status) ? 'auth' : response.status === 404 ? 'unsupported' : 'failed')
    }
    const parsed = parseEndpointCatalog(await boundedJson(response))
    if (parsed.status !== 'supported') throw failure(parsed.status)
    const configured = new Set((profile.models ?? []).map((model) => model.id))
    return parsed.models.filter((model) => configured.has(model.id))
  } catch (error) {
    if (controller.signal.aborted) throw failure('timeout')
    // Never include a URL, key, headers or upstream body in a wire error.
    throw /^CAPACITY_(unsupported|empty|auth|failed)$/.test(error?.message ?? '') ? error : failure('failed')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/** Use DSH's existing authenticated Remote model-discovery carrier. */
export function registerEndpointDiscovery(ctx) {
  const inFlight = new Map()
  return ctx.llm.registerModelDiscovery(CATALOG_SETTINGS_NAMESPACE, (request, signal) => {
    if (typeof request.provider !== 'string' || !request.provider) throw failure('unsupported')
    // Re-read settings on every scan; revision participates in concurrent deduplication.
    const revision = ctx.settings
      .describe({ redactSecrets: true })
      .find((item) => String(item.ns) === MODEL_SETTINGS_NAMESPACE)?.revision
    const key = JSON.stringify([revision, request.provider])
    if (!inFlight.has(key)) {
      const pending = probeEndpointCatalog(ctx, request.provider, { signal: signal ?? request.signal }).finally(() =>
        inFlight.delete(key),
      )
      inFlight.set(key, pending)
    }
    return inFlight.get(key)
  })
}

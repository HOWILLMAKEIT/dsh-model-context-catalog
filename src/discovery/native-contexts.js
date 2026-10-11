/** Provider-only discovery reads DSH's installed catalog, never endpoint APIs. */
export async function loadNativeContexts(providers, discover) {
  if (typeof discover !== 'function') throw new Error('NATIVE_CATALOG_UNAVAILABLE')
  const contexts = Object.create(null)
  // Bound concurrency on large profiles; no API URL or credential is sent.
  for (let offset = 0; offset < providers.length; offset += 4) {
    await Promise.all(
      providers.slice(offset, offset + 4).map(async (provider) => {
        const response = await discover(provider)
        if (!response.ok) {
          if (response.error?.code !== 'llm/model-discovery-rejected') throw new Error('NATIVE_CATALOG_UNAVAILABLE')
          contexts[provider] = {}
          return
        }
        contexts[provider] = Object.fromEntries(
          response.value
            .filter(
              (row) => typeof row.id === 'string' && Number.isSafeInteger(row.contextWindow) && row.contextWindow > 0,
            )
            .map((row) => [row.id, row.contextWindow]),
        )
      }),
    )
  }
  return contexts
}

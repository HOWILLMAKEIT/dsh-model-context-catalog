/** Keep provenance readable; model IDs and raw data fields already have their own place. */
export function capacitySourceNote(evidence) {
  if (evidence.scope === 'configured') return ''
  if (evidence.scope === 'endpoint') return 'CLIProxyAPI'
  const name =
    evidence.scope === 'model'
      ? evidence.manufacturerName || evidence.manufacturer || evidence.providerName || evidence.provider
      : evidence.providerName || evidence.provider
  return `${name} (${evidence.source})`
}

/** Present old generated notes cleanly without rewriting configuration or manual notes. */
export function readableSourceNote(entry) {
  const note = entry.note ?? ''
  const parts = note.split(' · ')
  if (parts.length !== 5 || parts[0] !== 'models.dev' || parts[4] !== 'limit.context') return note
  if (parts.some((part) => !part)) return note
  let source
  try {
    source = new URL(entry.sourceUrl)
  } catch {
    return note
  }
  if (source.protocol !== 'https:' || source.hostname !== 'models.dev') return note
  const isDefault = parts[2] === 'Model default'
  if (!source.pathname.startsWith(isDefault ? '/models/' : '/providers/')) return note
  return capacitySourceNote({
    scope: isDefault ? 'model' : 'provider',
    manufacturerName: parts[1],
    providerName: parts[2],
    source: parts[0],
  })
}

import { compact } from './names.js'

// Known names for the same subscription provider. Keep pay-as-you-go Ark
// separate; a shared brand alone does not identify a Coding Plan route.
export const PROVIDER_ALIASES = new Map(
  ['ark-agent-plan-cn', 'ark-agent-plan', 'ark-coding-plan-cn', 'ark-coding-plan'].map((alias) => [
    compact(alias),
    compact('volcengine-coding-plan'),
  ]),
)

/** Exact provider IDs win, followed by known aliases and configured display names. */
export function providerEntries(indexed, provider, providerName) {
  const keys = [provider, providerName].map(compact).filter(Boolean)
  const aliases = keys.map((key) => PROVIDER_ALIASES.get(key)).filter(Boolean)
  const records = indexed.filter(({ record }) => record.scope === 'provider')
  const direct = records.filter(({ record }) => keys.includes(compact(record.provider)))
  const aliased = records.filter(({ record }) => aliases.includes(compact(record.provider)))
  const named = records.filter(({ record }) => keys.includes(compact(record.providerName)))
  return direct.length ? direct : aliased.length ? aliased : named
}

import { baseName, compact, variants } from './names.js'

// A family alone is not enough to identify a model. Other words and version
// numbers come from catalog identities, rather than a list of individual models.
const families = new Set([
  'gpt',
  'glm',
  'claude',
  'gemini',
  'deepseek',
  'minimax',
  'kimi',
  'qwen',
  'llama',
  'grok',
  'mistral',
  'jamba',
  'command',
  'nova',
  'phi',
  'gemma',
  'v',
])
const routeWords = new Set(['cdx', 'proxy', 'gateway', 'router', 'api', 'official', 'custom', 'agent', 'plan', 'cn'])
const variantWord = /^(?:flash|mini|nano|thinking|reasoning|codex|pro|max|fast|lite|turbo|plus|instruct|vision|audio)/

function identity(value) {
  const text = baseName(variants(value).at(-1))
  const tokens = text.match(/[a-z]+|\d+/g) ?? []
  return {
    key: compact(text),
    words: new Set(tokens.filter((token) => !/^\d+$/.test(token))),
    version: tokens.filter((token) => /^\d+$/.test(token)).join('.'),
  }
}

export function hasModelInformation(value) {
  const model = identity(value)
  return Boolean(model.version) || [...model.words].some((word) => !families.has(word) && !routeWords.has(word))
}

/** Infer reordered/partial route names only when they identify one catalog model. */
export function createIdentityMatcher(indexed) {
  const identities = new Map(indexed.map((item) => [item, identity(item.record.canonicalId || item.record.id)]))
  const vocabulary = new Set([...identities.values()].flatMap((model) => [...model.words]))

  return (pool, query) => {
    const supplied = identity(query)
    const words = [...supplied.words].filter(
      (word) => !routeWords.has(word) && (vocabulary.has(word) || variantWord.test(word)),
    )
    // "gpt" or an arbitrary route label cannot identify a model.
    if (!words.length || (!supplied.version && words.every((word) => families.has(word)))) return []
    const matches = pool.filter((item) => {
      const model = identities.get(item)
      if (supplied.version && supplied.version !== model.version) return false
      if (!words.every((word) => model.words.has(word))) return false
      // Do not drop model variants such as Astra Fast, GPT mini or GLM flash.
      return [...model.words].every((word) => families.has(word) || supplied.words.has(word))
    })
    // Missing versions must not arbitrarily pick one generation, even when
    // several generations declare the same capacity.
    return new Set(matches.map((item) => identities.get(item).key)).size === 1 ? matches : []
  }
}

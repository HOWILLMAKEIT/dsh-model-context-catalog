// Generated from src/discovery/index.js; edit src/ and run npm run build.

// src/shared/contracts.js
var routeKey = (provider, model) => `${provider}\0${model}`;
var catalogEntryKey = (provider, model) => `${provider}::${model}`;
var validContextWindow = (value) => Number.isSafeInteger(value) && value > 0;

// src/discovery/names.js
var compact = (value) => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
var undecorated = (value) => String(value ?? "").normalize("NFKC").toLowerCase().trim().replace(/\s*\((?:agent plan|coding plan|coding|plan)\)\s*$/i,
"");
var baseName = (value) => {
  let text = undecorated(value), previous;
  do {
    previous = text;
    text = text.replace(/[-_ ](?:20\d{2}[-_]\d{2}[-_]\d{2}|20\d{6}|(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/, "").replace(
    /[-_ ](?:latest|preview)$/, "");
    const deploymentVersion = /^(.*)[-_ ]v\d+$/.exec(text);
    if (deploymentVersion && /\d/.test(deploymentVersion[1])) text = deploymentVersion[1];
  } while (text !== previous);
  return text;
};
var variants = (value) => {
  const text = undecorated(value);
  return [...new Set([text, text.split("/").at(-1)].filter(Boolean))];
};

// src/discovery/providers.js
var PROVIDER_ALIASES = new Map(
  ["ark-agent-plan-cn", "ark-agent-plan", "ark-coding-plan-cn", "ark-coding-plan"].map((alias) => [
    compact(alias),
    compact("volcengine-coding-plan")
  ])
);
function providerEntries(indexed, provider, providerName) {
  const keys = [provider, providerName].map(compact).filter(Boolean);
  const aliases = keys.map((key) => PROVIDER_ALIASES.get(key)).filter(Boolean);
  const records = indexed.filter(({ record }) => record.scope === "provider");
  const direct = records.filter(({ record }) => keys.includes(compact(record.provider)));
  const aliased = records.filter(({ record }) => aliases.includes(compact(record.provider)));
  const named = records.filter(({ record }) => keys.includes(compact(record.providerName)));
  return direct.length ? direct : aliased.length ? aliased : named;
}

// src/discovery/identity.js
var families = /* @__PURE__ */ new Set([
  "gpt",
  "glm",
  "claude",
  "gemini",
  "deepseek",
  "minimax",
  "kimi",
  "qwen",
  "llama",
  "grok",
  "mistral",
  "jamba",
  "command",
  "nova",
  "phi",
  "gemma",
  "v"
]);
var routeWords = /* @__PURE__ */ new Set(["cdx", "proxy", "gateway", "router", "api", "official", "custom", "agent", "pl\
an", "cn"]);
var variantWord = /^(?:flash|mini|nano|thinking|reasoning|codex|pro|max|fast|lite|turbo|plus|instruct|vision|audio)/;
function identity(value) {
  const text = baseName(variants(value).at(-1));
  const tokens = text.match(/[a-z]+|\d+/g) ?? [];
  return {
    key: compact(text),
    words: new Set(tokens.filter((token) => !/^\d+$/.test(token))),
    version: tokens.filter((token) => /^\d+$/.test(token)).join(".")
  };
}
function hasModelInformation(value) {
  const model = identity(value);
  return Boolean(model.version) || [...model.words].some((word) => !families.has(word) && !routeWords.has(word));
}
function createIdentityMatcher(indexed) {
  const identities = new Map(indexed.map((item) => [item, identity(item.record.canonicalId || item.record.id)]));
  const vocabulary = new Set([...identities.values()].flatMap((model) => [...model.words]));
  return (pool, query) => {
    const supplied = identity(query);
    const words = [...supplied.words].filter(
      (word) => !routeWords.has(word) && (vocabulary.has(word) || variantWord.test(word))
    );
    if (!words.length || !supplied.version && words.every((word) => families.has(word))) return [];
    const matches = pool.filter((item) => {
      const model = identities.get(item);
      if (supplied.version && supplied.version !== model.version) return false;
      if (!words.every((word) => model.words.has(word))) return false;
      return [...model.words].every((word) => families.has(word) || supplied.words.has(word));
    });
    return new Set(matches.map((item) => identities.get(item).key)).size === 1 ? matches : [];
  };
}

// src/discovery/matching.js
function createModelMatcher(records) {
  const indexed = records.filter(
    (record) => record && validContextWindow(record.contextWindow) && record.kind === "context" && typeof record.id === "\
string"
  ).map((record) => {
    const names = [record.id, ...record.scope === "model" ? record.aliases ?? [] : []].flatMap(variants);
    return {
      record,
      exact: names.map(compact).filter(Boolean),
      base: names.map((v) => compact(baseName(v))).filter(Boolean)
    };
  });
  const matchIdentity = createIdentityMatcher(indexed);
  function matchModel(id, name = id, provider = "", providerName = provider) {
    const providerRecords = providerEntries(indexed, provider, providerName);
    const defaultRecords = indexed.filter(({ record }) => record.scope === "model");
    let matches = [], method = "exact", referenceScope = "model";
    for (const pool of [providerRecords, defaultRecords]) {
      for (const [query, fromName] of [
        [id, false],
        [name, true]
      ]) {
        const keys = variants(query).map(compact).filter(Boolean);
        matches = pool.filter((item) => item.exact.some((key) => keys.includes(key)));
        if (matches.length) {
          method = fromName ? "name" : "exact";
          break;
        }
        const baseKeys = variants(query).map((v) => compact(baseName(v))).filter((v) => v.length >= 2 && hasModelInformation(
        v));
        matches = pool.filter((item) => item.base.some((key) => baseKeys.includes(key)));
        if (matches.length) {
          method = fromName ? "name" : "version";
          break;
        }
      }
      if (matches.length) {
        referenceScope = matches[0].record.scope;
        break;
      }
    }
    if (!matches.length) {
      for (const pool of [providerRecords, defaultRecords]) {
        for (const query of [id, name]) {
          matches = matchIdentity(pool, query);
          if (matches.length) break;
        }
        if (matches.length) {
          method = "fuzzy";
          referenceScope = matches[0].record.scope;
          break;
        }
      }
    }
    const groups = /* @__PURE__ */ new Map();
    for (const { record } of matches) {
      const key = `${record.kind}:${record.contextWindow}`;
      if (!groups.has(key))
        groups.set(key, { key, contextWindow: record.contextWindow, kind: record.kind, evidence: [] });
      groups.get(key).evidence.push(record);
    }
    const choices = [...groups.values()].sort((a, b) => a.contextWindow - b.contextWindow);
    const recommended = choices.length === 1 ? choices[0] : void 0;
    return { method, choices, recommended, conflict: choices.length > 1, referenceScope };
  }
  return matchModel;
}

// src/domain/source-notes.js
function capacitySourceNote(evidence) {
  if (evidence.scope === "configured") return "";
  const name = evidence.scope === "model" ? evidence.manufacturerName || evidence.manufacturer || evidence.providerName ||
  evidence.provider : evidence.providerName || evidence.provider;
  return `${name} (${evidence.source})`;
}

// src/discovery/management.js
function managementChoices(match, currentWindow, windowSource) {
  if (!validContextWindow(currentWindow)) return match;
  const same = match.choices.find((choice) => choice.contextWindow === currentWindow);
  const current = same ?? {
    key: `configured:${currentWindow}`,
    contextWindow: currentWindow,
    kind: "context",
    evidence: [{ scope: "configured", windowSource }]
  };
  return {
    ...match,
    choices: same ? match.choices : [current, ...match.choices],
    recommended: current
  };
}

// src/discovery/native-contexts.js
async function loadNativeContexts(providers, discover) {
  if (typeof discover !== "function") throw new Error("NATIVE_CATALOG_UNAVAILABLE");
  const contexts = /* @__PURE__ */ Object.create(null);
  for (let offset = 0; offset < providers.length; offset += 4) {
    await Promise.all(
      providers.slice(offset, offset + 4).map(async (provider) => {
        const response = await discover(provider);
        if (!response.ok) {
          if (response.error?.code !== "llm/model-discovery-rejected") throw new Error("NATIVE_CATALOG_UNAVAILABLE");
          contexts[provider] = {};
          return;
        }
        contexts[provider] = Object.fromEntries(
          response.value.filter(
            (row) => typeof row.id === "string" && Number.isSafeInteger(row.contextWindow) && row.contextWindow > 0
          ).map((row) => [row.id, row.contextWindow])
        );
      })
    );
  }
  return contexts;
}

// src/discovery/index.js
function createCapacityDiscovery(records) {
  const matchModel = createModelMatcher(records);
  function scanModels(pi, entries = {}, nativeContexts = {}) {
    const rows = [];
    const managed = new Set(
      Object.values(entries).filter(Boolean).map((entry) => routeKey(entry.provider, entry.model))
    );
    const seen = /* @__PURE__ */ new Set();
    for (const [provider, profile] of Object.entries(pi?.providers ?? {})) {
      if (!Array.isArray(profile?.models)) continue;
      for (const model of profile.models) {
        if (!model || typeof model.id !== "string" || !model.id) continue;
        const key = routeKey(provider, model.id);
        if (seen.has(key) || managed.has(key)) continue;
        seen.add(key);
        const match = matchModel(model.id, model.name, provider, profile.displayName);
        const inherited = nativeContexts[provider]?.[model.id];
        const explicit = validContextWindow(model.contextWindow);
        const native = model.contextWindow == null && validContextWindow(inherited);
        const currentWindow = explicit ? model.contextWindow : native ? inherited : profile.defaultContextWindow;
        const windowSource = explicit ? "model" : native ? "native" : validContextWindow(currentWindow) ? "provider" : void 0;
        const isSame = validContextWindow(currentWindow) && match.choices.some((choice) => choice.contextWindow === currentWindow);
        const reason = isSame ? "same" : explicit || native ? match.choices.length ? "different" : "configured" : "missi\
ng";
        rows.push({
          key,
          provider,
          model: model.id,
          modelName: model.name || model.id,
          currentWindow: validContextWindow(currentWindow) ? currentWindow : void 0,
          windowSource,
          hasReference: match.choices.length > 0,
          reason,
          ...managementChoices(match, currentWindow, windowSource),
          selectedByDefault: !validContextWindow(currentWindow) && match.method === "exact" && Boolean(match.recommended)
        });
      }
    }
    return rows;
  }
  function planSelectedEntries(pi, entries, rows, selections, nativeContexts = {}) {
    const fresh = new Map(scanModels(pi, entries, nativeContexts).map((row) => [row.key, row]));
    const next = { ...entries };
    const added = [];
    for (const row of rows) {
      const selectedKey = selections[row.key];
      if (!selectedKey) continue;
      const current = fresh.get(row.key);
      if (!current || current.currentWindow !== row.currentWindow || current.windowSource !== row.windowSource || current.
      reason !== row.reason) {
        throw new Error("STALE_CANDIDATES");
      }
      const choice = current.choices.find((item) => item.key === selectedKey);
      if (!choice) throw new Error("STALE_CANDIDATES");
      const evidence = choice.evidence[0];
      const key = catalogEntryKey(row.provider, row.model);
      if (Object.hasOwn(next, key)) throw new Error("STALE_CANDIDATES");
      const entry = {
        provider: row.provider,
        model: row.model,
        contextWindow: choice.contextWindow,
        sourceUrl: evidence.sourceUrl ?? "",
        note: capacitySourceNote(evidence),
        enabled: true
      };
      next[key] = entry;
      added.push(entry);
    }
    return { entries: next, added };
  }
  return { matchModel, scanModels, planSelectedEntries };
}
export {
  createCapacityDiscovery,
  loadNativeContexts
};

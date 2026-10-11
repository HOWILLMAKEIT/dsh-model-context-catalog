// Generated from src/domain/catalog.js; edit src/ and run npm run build.

// src/shared/contracts.js
var routeKey = (provider, model) => `${provider}\0${model}`;
var catalogEntryKey = (provider, model) => `${provider}::${model}`;
var validContextWindow = (value) => Number.isSafeInteger(value) && value > 0;

// src/domain/catalog.js
var MODEL_CONTEXT_CATALOG = Object.freeze([]);
function catalogSettingsEntries(catalog = MODEL_CONTEXT_CATALOG) {
  return Object.fromEntries(
    catalog.map((item) => [
      catalogEntryKey(item.provider, item.model),
      {
        provider: item.provider,
        model: item.model,
        contextWindow: item.contextWindow,
        sourceUrl: item.sourceUrl,
        note: item.note,
        enabled: true
      }
    ])
  );
}
function activeCatalogFromSettings(entries) {
  if (entries === null || typeof entries !== "object" || Array.isArray(entries)) return [];
  return Object.values(entries).filter((item) => item && item.enabled !== false).map(
    (item) => Object.freeze({
      provider: item.provider,
      model: item.model,
      contextWindow: item.contextWindow,
      sourceUrl: item.sourceUrl ?? "",
      note: item.note ?? ""
    })
  );
}
function indexCatalog(catalog = MODEL_CONTEXT_CATALOG) {
  const result = /* @__PURE__ */ new Map();
  for (const item of catalog) {
    const key = routeKey(item.provider, item.model);
    if (result.has(key)) throw new Error(`duplicate context metadata for ${item.provider}/${item.model}`);
    if (!validContextWindow(item.contextWindow)) {
      throw new Error(`invalid context window for ${item.provider}/${item.model}`);
    }
    result.set(key, item);
  }
  return result;
}
function contextMetadata(provider, model, catalog = MODEL_CONTEXT_CATALOG) {
  return indexCatalog(catalog).get(routeKey(provider, model));
}
function planPiAiContextUpdate(section, catalog = MODEL_CONTEXT_CATALOG) {
  const providers = section?.providers;
  if (providers === null || typeof providers !== "object" || Array.isArray(providers)) {
    return Object.freeze({ patch: null, ops: Object.freeze([]), corrections: Object.freeze([]) });
  }
  const indexed = indexCatalog(catalog);
  const providerPatch = {};
  const corrections = [];
  const ops = [];
  for (const [provider, profile] of Object.entries(providers)) {
    if (!Array.isArray(profile?.models)) continue;
    let changed = false;
    const models = profile.models.map((model, index) => {
      if (model === null || typeof model !== "object" || Array.isArray(model) || typeof model.id !== "string")
        return model;
      const expected = indexed.get(routeKey(provider, model.id));
      if (expected === void 0 || model.contextWindow === expected.contextWindow) return model;
      changed = true;
      ops.push(
        Object.freeze({
          op: "set",
          path: Object.freeze(["providers", provider, "models", String(index), "contextWindow"]),
          value: expected.contextWindow
        })
      );
      corrections.push(
        Object.freeze({
          provider,
          model: model.id,
          from: model.contextWindow,
          to: expected.contextWindow,
          sourceUrl: expected.sourceUrl
        })
      );
      return { ...model, contextWindow: expected.contextWindow };
    });
    if (changed) providerPatch[provider] = { models };
  }
  return Object.freeze({
    patch: corrections.length === 0 ? null : { providers: providerPatch },
    ops: Object.freeze(ops),
    corrections: Object.freeze(corrections)
  });
}
export {
  MODEL_CONTEXT_CATALOG,
  activeCatalogFromSettings,
  catalogEntryKey,
  catalogSettingsEntries,
  contextMetadata,
  indexCatalog,
  planPiAiContextUpdate
};

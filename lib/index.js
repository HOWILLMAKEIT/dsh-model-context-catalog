// Generated from src/host/index.js; edit src/ and run npm run build.

// src/host/index.js
import z from "@deepseek-ai/schemastery";

// src/shared/contracts.js
var CATALOG_SETTINGS_NAMESPACE = "model-context-catalog";
var MODEL_SETTINGS_NAMESPACE = "llm-pi-ai";
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

// src/host/synchronize.js
var correctionText = (item) => `${item.provider}/${item.model}: ${String(item.from ?? "unknown")} -> ${item.to}`;
function synchronizeContexts(ctx, config) {
  let disposed = false;
  let queue = Promise.resolve();
  ctx.effect(() => ctx.settings.configure({ auto: false }));
  const reconcile = async () => {
    for (let attempt = 0; attempt < 3 && !disposed; attempt += 1) {
      const descriptor = ctx.settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === MODEL_SETTINGS_NAMESPACE);
      const section = descriptor?.value;
      if (descriptor === void 0 || section === void 0) {
        ctx.logger.warn("model-context-catalog: llm-pi-ai settings namespace is unavailable");
        return;
      }
      const catalog = activeCatalogFromSettings(config.entries.get());
      const plan = planPiAiContextUpdate(section, catalog);
      if (plan.ops.length === 0) return;
      try {
        await ctx.settings.mutate(MODEL_SETTINGS_NAMESPACE, plan.ops, descriptor.revision);
      } catch (error) {
        if (error?.code === "SETTINGS_CONFLICT") continue;
        throw error;
      }
      for (const correction of plan.corrections) {
        ctx.logger.info(`model-context-catalog: corrected ${correctionText(correction)} (${correction.sourceUrl})`);
      }
      return;
    }
    if (!disposed)
      ctx.logger.warn("model-context-catalog: settings kept changing; deferred reconciliation to the next update");
  };
  const schedule = () => {
    const enqueue = () => {
      queue = queue.then(reconcile, reconcile).catch((error) => {
        ctx.logger.warn(
          `model-context-catalog: reconciliation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    };
    const transaction = ctx.get?.("hmr")?.executing;
    if (typeof transaction?.exit === "function") transaction.exit(enqueue);
    else enqueue();
  };
  const stopDocument = ctx.on("settings/document-updated", (ns) => {
    if ([MODEL_SETTINGS_NAMESPACE, CATALOG_SETTINGS_NAMESPACE].includes(String(ns))) schedule();
  });
  const stopCatalog = ctx.on("loader/volatile-update", schedule, { global: true });
  const stopReload = ctx.on("app-boot/config-reload", schedule);
  schedule();
  const dispose = () => {
    disposed = true;
    stopDocument();
    stopCatalog();
    stopReload();
  };
  ctx.effect(() => dispose);
  return dispose;
}

// src/host/index.js
var name = "model-context-catalog";
var inject = ["settings"];
var CatalogEntrySchema = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  contextWindow: z.number().step(1).min(1).required(),
  sourceUrl: z.string(),
  note: z.string(),
  enabled: z.boolean().default(true)
});
var Config = z.object({
  entries: z.dict(CatalogEntrySchema).default(catalogSettingsEntries()).volatile()
});
var CatalogSettingsSchema = Config;
export {
  CATALOG_SETTINGS_NAMESPACE,
  CatalogSettingsSchema,
  Config,
  MODEL_CONTEXT_CATALOG,
  synchronizeContexts as apply,
  inject,
  name,
  planPiAiContextUpdate
};

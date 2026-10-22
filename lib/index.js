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

// src/host/endpoint-catalog.js
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";

// src/discovery/endpoint-catalog.js
function parseEndpointCatalog(body) {
  if (!body || !Array.isArray(body.models)) return { status: "unsupported", models: [] };
  const capacities = /* @__PURE__ */ new Map();
  const conflicts = /* @__PURE__ */ new Set();
  for (const row of body.models) {
    if (typeof row?.slug !== "string" || !row.slug.trim()) continue;
    const value = [row.context_window, row.max_context_window].find(validContextWindow);
    if (value === void 0) continue;
    if (capacities.has(row.slug) && capacities.get(row.slug) !== value) conflicts.add(row.slug);
    capacities.set(row.slug, value);
  }
  const models = [...capacities].filter(([id]) => !conflicts.has(id)).map(([id, contextWindow]) => ({ id, contextWindow }));
  return { status: models.length ? "supported" : "empty", models };
}

// src/host/endpoint-catalog.js
var MAX_BYTES = 4 * 1024 * 1024;
var PROTOCOLS = /* @__PURE__ */ new Set(["openai-completions", "openai-responses"]);
var failure = (status) => new Error(`CAPACITY_${status}`);
function endpointCatalogUrl(baseURL) {
  const url = new URL(baseURL);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw failure("unsupported");
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/models`;
  url.searchParams.set("client_version", "1");
  url.hash = "";
  return url;
}
async function abortable(task, signal) {
  signal.throwIfAborted();
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(task), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
async function boundedJson(response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw failure("failed");
  }
  if (!response.body) throw failure("failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw failure("failed");
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    await reader.cancel().catch(() => {
    });
  }
}
async function probeEndpointCatalog(ctx, provider, { fetcher = globalThis.fetch, signal, timeout = 5e3 } = {}) {
  const profile = ctx.settings.describe().find((item) => String(item.ns) === MODEL_SETTINGS_NAMESPACE)?.value?.providers?.[provider];
  if (!profile || !Object.hasOwn(profile, "baseURL") || !PROTOCOLS.has(profile.api ?? "openai-completions"))
    throw failure("unsupported");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, timeout);
  try {
    const url = endpointCatalogUrl(profile.baseURL);
    const headers = new Headers(profile.headers);
    headers.set("accept", "application/json");
    if (profile.apiKeyEnv !== void 0) {
      const credentials = ctx.get?.("credentials");
      const key = credentials ? (await abortable(() => credentials.resolve(profile.apiKeyEnv), controller.signal))?.value :
      launchEnvironmentOf(ctx).get(profile.apiKeyEnv)?.value;
      if (typeof key !== "string" || !key.trim()) throw failure("auth");
      headers.set("authorization", `Bearer ${key.trim()}`);
    }
    const response = await fetcher(url, {
      method: "GET",
      headers,
      signal: controller.signal,
      // Refuse all redirects, so secrets never reach another origin or URL.
      redirect: "error"
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw failure([401, 403].includes(response.status) ? "auth" : response.status === 404 ? "unsupported" : "failed");
    }
    const parsed = parseEndpointCatalog(await boundedJson(response));
    if (parsed.status !== "supported") throw failure(parsed.status);
    const configured = new Set((profile.models ?? []).map((model) => model.id));
    return parsed.models.filter((model) => configured.has(model.id));
  } catch (error) {
    if (controller.signal.aborted) throw failure("timeout");
    throw /^CAPACITY_(unsupported|empty|auth|failed)$/.test(error?.message ?? "") ? error : failure("failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
function registerEndpointDiscovery(ctx) {
  const inFlight = /* @__PURE__ */ new Map();
  return ctx.llm.registerModelDiscovery(CATALOG_SETTINGS_NAMESPACE, (request, signal) => {
    if (typeof request.provider !== "string" || !request.provider) throw failure("unsupported");
    const revision = ctx.settings.describe({ redactSecrets: true }).find((item) => String(item.ns) === MODEL_SETTINGS_NAMESPACE)?.
    revision;
    const key = JSON.stringify([revision, request.provider]);
    if (!inFlight.has(key)) {
      const pending = probeEndpointCatalog(ctx, request.provider, { signal: signal ?? request.signal }).finally(
        () => inFlight.delete(key)
      );
      inFlight.set(key, pending);
    }
    return inFlight.get(key);
  });
}

// src/host/index.js
var name = "model-context-catalog";
var inject = ["settings", "llm"];
function apply(ctx, config) {
  const stopDiscovery = registerEndpointDiscovery(ctx);
  const stopSync = synchronizeContexts(ctx, config);
  return () => {
    stopDiscovery();
    stopSync();
  };
}
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
  apply,
  inject,
  name,
  planPiAiContextUpdate
};

# dsh-model-context-catalog

A DeepSeek Harness (DSH) Host + Web plugin that keeps a per-route context-window
catalog for configured `llm-pi-ai` models, and corrects the adapter metadata
through the public settings API before token pressure and overflow recovery
read it.

- Compatibility: DSH `>= 0.1.1-rc.2`, Node `>= 22`
- Surfaces: Host (settings namespace + reconciliation) and Web (settings page)
- License: MIT · Repository: `HOWILLMAKEIT/dsh-model-context-catalog`

## The problem it fixes

Long sessions on custom model routes can die with:

```
pi-ai detected context overflow for model "glm-5.3-flash"
```

even though the endpoint served the request fine. The chain behind it:

1. **The adapter needs a number for every model.** `@deepseek-ai/dsh-llm-pi-ai`
   materializes each configured model with a `contextWindow`. A custom route
   that does not declare one receives the adapter fallback —
   `DEFAULT_CONTEXT_WINDOW = 262,144` tokens in DSH 0.1.1-rc.2. That value is a
   **guess**, not a provider limit.
2. **The guess is treated as truth.** pi-ai's silent-overflow heuristic classifies
   a finished `stop` turn as `CONTEXT_WINDOW_EXCEEDED` whenever reported usage
   (input plus cache reads) exceeds that window. DSH surfaces it as the
   `pi-ai detected context overflow …` message.
3. **Tool loops survive; the answer dies.** The heuristic branch only inspects
   terminal natural-language (`stop`) finishes. Tool-use finishes are not
   checked, so a long tool loop keeps running and only the final response is
   amputated.
4. **`/compact` fails for the same reason.** Compaction picks the latest routed
   model as its default summarizer. The summary request is typically *larger*
   than the false 262,144 limit, so the terminal summary hits the same false
   positive, the transaction records `compaction/end.error`, and
   `compaction/summary` is never committed — the surface stays stuck and every
   retry repeats the cycle.

**The fix** is to give each route its real, deployment-specific window. This
plugin stores those values in a dedicated settings namespace, reconciles them
into the resolved `llm-pi-ai` section through the public settings API, and lets
pi-ai's own settings watcher rebuild its immutable adapter snapshot. It does not
monkey-patch DSH or pi-ai internals, and it does not touch the overflow
classifier or the compaction machinery.

The verified session evidence, measurements, and upstream code-path anchors are
in [`ROOT_CAUSE.md`](./ROOT_CAUSE.md).

## Behavior

- Registers a dedicated `model-context-catalog` settings namespace.
- Adds **Settings → Context windows / 上下文窗口** for adding, editing,
  enabling, disabling, and deleting route metadata.
- Matches entries by the **exact `provider/model` route pair** — the same model
  id through a different gateway gets its own value.
- Persists only corrected `models` arrays via `settings.update` with revision
  CAS (up to 3 retries on conflict) and preserves endpoint, credential
  reference, protocol, model name, modalities, output limit, compatibility
  flags, and unknown models.
- Reconciles again whenever the `llm-pi-ai` section changes externally.
- Capacity sources are shown honestly: a row-configured value is **applied**;
  a provider-level default is labeled **提供方默认容量 / Provider default
  capacity** (hover for the number) and is never displayed as the real limit.
- The Web model picker lists only models that actually exist in the resolved
  `llm-pi-ai` configuration — no synthetic rows. (One exception by design: an
  entry whose route has since been removed stays visible in its own editor so
  it can be edited or removed rather than silently vanishing.)

## Settings UI

Open **Settings → Context windows / 上下文窗口**（标题：模型上下文窗口 /
Model context windows）. The page lists built-in and custom entries with live
status against the resolved `llm-pi-ai` model list.

- **Add model / 添加模型** — pick an already-configured model, enter its context
  window (positive integer), optional note.
- **Model picker** — grouped by provider with sticky group headers showing the
  display name, the raw provider key, and the model count; searchable by
  provider, model name, or id; full keyboard support (ArrowUp/Down, Home/End,
  Enter, Escape). Model names are shown **verbatim**, including plan suffixes
  such as `(Agent Plan)` — the suffix is data, never stripped.
- **Status badges** — 已生效 (Applied) · 等待同步 (Pending sync) ·
  未配置此路由 (Route not configured) · 提供方默认容量 (Provider default
  capacity) · 已停用 (Disabled); each row also carries 内置 (Built in) or
  自定义 (Custom).
- **Edit** expands inline directly below the selected row; custom entries can
  be deleted, built-in entries can be disabled or overridden and stay
  recoverable.
- If the catalog settings are unavailable, the view is read-only, or the
  configured model list cannot be loaded, a notice explains which one and
  saving is disabled accordingly.

## Install

From npm (recommended, once v0.2.0 is published):

```bash
dsh plugin --profile web add dsh-model-context-catalog
```

From a local checkout:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-model-context-catalog
```

Refresh the already-open DSH Web page after the host loads the new patch;
client-only changes need no restart. Host namespace/schema changes require a
Host restart.

## FAQ

**I installed the plugin but still see the overflow error.**
Check the entry for that route: the badge must read 已生效 (Applied), not
提供方默认容量 (Provider default capacity) or 未配置此路由 (Route not
configured). The route must match exactly — `glm-coding/glm-5.3-flash` and
`zai-coding-cn/glm-5.3-flash` are different routes. Then re-run the failing
request; already-amputated history is not restored.

**Is 262,144 my model's real context window?**
No. It is the pi-ai adapter fallback for routes that declare nothing. Real
capacity is model- and deployment-specific (the verified GLM routes serve
~1,000,000 tokens).

**Why does the picker show names like `Doubao Seed 2.1 Pro (Agent Plan)`?**
Faithful display by design. The suffix comes from the configured route data and
is searchable, so nothing is hidden or rewritten.

**Does it fix non-pi-ai providers?**
No. Scope is the `llm-pi-ai` settings namespace and its routes only.

**Do Vision Router routes need their own entry?**
No. A twin adapter such as `glm-coding-vision` delegates `resolveModel()` to its
base route and mirrors its context metadata.

**Can it discover official limits automatically?**
No. Enter the real value from the provider's documentation or console for that
deployment. Both error directions are harmful: a too-small value causes
needless compaction amputation of successful responses; a too-large value lets
real overflows through as silent turn failures.

## Development

```
index.js            Host settings namespace + reconciliation controller
catalog.js          Pure route catalog and llm-pi-ai patch planner
client.js           React/Cordis settings page (slots, locale, settingsScope)
scripts/build.mjs   Deterministic build into publishable lib/
test/               19 node:test suites: catalog, schema, concurrency, client, package
.github/workflows/  ci.yml (node 22/24 + dsh-plugin-checker), release.yml
docs/release.md     Release runbook (tag-driven npm Trusted Publishing/OIDC)
```

```bash
npm install
npm run build     # regenerate lib/ from the root sources
npm run check     # build + syntax check of lib artifacts
npm test          # build + node --test
npm pack --dry-run
```

CI runs the same gates on Node 22 and 24, plus the community
`dsh-plugin-checker` action (manifest → real `dsh plugin add` →
`--dump-config` layer verification). See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for workflow and catalog rules.

## Release

Releases are tag-driven and use **npm Trusted Publishing (OIDC)** — no
long-lived `NPM_TOKEN` exists anywhere:

1. Bump `package.json` `version` and add a `## X.Y.Z` section to
   [`CHANGELOG.md`](./CHANGELOG.md) (the pipeline refuses to publish a version
   without one).
2. Push the version tag — the only release action:

   ```bash
   git tag -a vX.Y.Z -m "release vX.Y.Z" && git push origin vX.Y.Z
   ```

3. GitHub Actions verifies tag↔version, CHANGELOG section, reproducible build,
   tests, and the tarball boundary, then publishes with `--provenance` and
   creates an idempotent GitHub Release from the CHANGELOG section.

Never run `npm publish` locally. First-time npm/GitHub configuration and the
emergency fallback are described in [`docs/release.md`](./docs/release.md).

## Security & limitations

- No network access, no telemetry: the Host side only reads/writes settings
  through DSH's public settings API; the Web side only binds existing settings
  scopes. It does not take over provider credentials — existing credential
  references are preserved verbatim. Report vulnerabilities privately via
  [`SECURITY.md`](./SECURITY.md).
- Route coverage is exactly what you declare. Routes without an entry keep the
  upstream fallback behavior, including its false-positive risk — declaring the
  real window per route is the only fix this plugin can offer from user space.
- Honest reporting matters more than flattering numbers: capacities must come
  from provider documentation for your deployment, and this README will not
  claim "official" limits for models it has no evidence for.

## 中文速览

本插件为 DSH 的 `llm-pi-ai` 模型路由维护**路由级**上下文窗口目录，并通过公开
settings API 自动回写修正。它解决的核心问题：自定义路由未声明 `contextWindow`
时，适配器用 262,144 的猜测兜底；pi-ai 的静默溢出启发式把「用量超过该猜测值的
成功 `stop` 回合」误判为 `CONTEXT_WINDOW_EXCEEDED`，于是工具循环正常、最终自然
语言回答被截断；`/compact` 默认用同一路由做摘要，同样的误判让摘要请求也失败、
事务回滚，压缩永远不落地。修复方式：在 **设置 → 上下文窗口** 为精确的
`provider/model` 路由填写真实容量（按服务商文档），插件自动同步进 `llm-pi-ai`，
由其原生 watcher 原子重建路由快照。安装：`dsh plugin --profile web add
dsh-model-context-catalog`，刷新页面即可。机制证据见
[`ROOT_CAUSE.md`](./ROOT_CAUSE.md)；未声明条目的路由仍保留上游兜底行为与相应风险。

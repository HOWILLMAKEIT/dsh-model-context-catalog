# Changelog

All notable changes to `dsh-model-context-catalog` are documented here.
Each released version keeps a `## X.Y.Z` section; the release pipeline
extracts that section as its release notes and refuses to publish a version
without one.

## 0.2.0

First npm release. Fixes the `pi-ai detected context overflow …` false
positive on custom model routes: the pi-ai adapter materializes an undeclared
route with a guessed 262,144-token fallback (`DEFAULT_CONTEXT_WINDOW`), and
its silent-overflow heuristic treats that guess as the real limit — successful
long-context `stop` turns get classified as `CONTEXT_WINDOW_EXCEEDED` (tool
loops survive, the final answer dies), and `/compact` fails for the same
reason because the summarizer reuses the same route. The plugin declares real
per-route capacities and reconciles them into `llm-pi-ai` through the public
settings API; evidence and upstream anchors in
[`ROOT_CAUSE.md`](./ROOT_CAUSE.md).

- Faithful model display: the settings-page model picker shows configured
  names verbatim (including suffixes like `(Agent Plan)`); the id fills in
  only when no name is configured. Plan suffixes are searchable data, never
  rewritten.
- Provider-grouped model combobox: sticky group headers with display name,
  raw provider key, and model count; search across provider, name, and id;
  full keyboard navigation (ArrowUp/Down, Home/End, Enter, Escape) with ARIA
  listbox semantics.
- Honest capacity status: row-configured windows show 已生效 (Applied);
  provider-level defaults are labeled 提供方默认容量 (Provider default
  capacity) with the number on hover — the adapter's 262,144 fallback is
  never presented as a real limit. Other states: 等待同步 (Pending sync),
  未配置此路由 (Route not configured), 已停用 (Disabled).
- Three service notices (catalog unavailable / read-only view / configured
  model list unavailable); read-only mode disables Add and Save.
- Reconciliation hardening: revision CAS with bounded retries; unchanged
  llm-pi-ai fields and unrelated routes are always preserved; an unreadable
  catalog scope is tolerated without touching llm-pi-ai.
- Packaging and distribution: `engines >= 22`, `publishConfig`, `repository`
  metadata; CI on Node 22/24 plus `dsh-plugin-checker`; tag-driven release via
  GitHub Actions npm Trusted Publishing (OIDC) with `--provenance`, a
  tarball-boundary check, and a per-version CHANGELOG guard (runbook in
  [`docs/release.md`](./docs/release.md)).

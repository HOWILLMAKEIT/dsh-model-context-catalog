# Contributing

## Development workflow

1. Install dependencies with `npm install` (Node `>= 22`).
2. Edit the source files at the repository root (`index.js`, `catalog.js`, and
   `client.js`).
3. Run `npm run build` to regenerate the publishable `lib/` directory.
4. Run `npm run check && npm test` (19 `node:test` suites across `test/`).
5. Use `npm pack --dry-run` to inspect the package boundary before release.

CI (`.github/workflows/ci.yml`) runs the same gates on Node 22 and 24, plus
`dsh-plugin-checker` as a required gate (manifest → real `dsh plugin add` →
`--dump-config` verification).

The Web profile in this checkout links directly to this repository. DSH serves
client plugins from the package export. Refresh the existing Web page after a
client change; Host namespace/schema changes require a Host restart.

## Catalog rules

- Identify entries by the exact `(provider, model)` route pair.
- Use a positive safe-integer token capacity taken from provider documentation
  for that deployment — never invent or "round up" a value, and never present
  the adapter fallback (262,144) as a real limit.
- Record deployment-specific limits instead of assuming equal limits for the
  same model ID across gateways.
- Preserve unrelated provider/model fields during reconciliation.
- Add or update tests for new catalog and settings behavior.

## UI rules

- Model choices must come from the resolved `llm-pi-ai` configuration; never
  synthesize rows that are not configured.
- Model names render verbatim (`model.name`, falling back to `model.id` only
  when the name is absent). Plan suffixes such as `(Agent Plan)` are data —
  do not rewrite, truncate, or strip them; CSS ellipsis is the only allowed
  truncation.
- Keep the create/edit surface limited to model, context window, and optional
  note. Editing a row expands directly below that row.
- Distinguish row-configured capacity from provider-level defaults; the
  default must never display as the real limit (badge + hover value).
- Keep listbox semantics intact (grouped options, `aria-activedescendant`,
  Arrow/Home/End/Enter/Escape handling) and the three service notices
  (catalog unavailable / read-only / configured list unavailable).
- Use DSH theme tokens (`--dsw-alias-*`) with explicit color fallbacks for
  critical controls.

## Docs & release rules

- Every version gets a `## X.Y.Z` section in `CHANGELOG.md` before its tag;
  the release pipeline refuses to publish without it.
- Keep `README.md` (user language), `ROOT_CAUSE.md` (evidence chain), and this
  file (process) non-overlapping: user-facing mechanism and instructions live
  in the README, verified session evidence and upstream anchors in
  ROOT_CAUSE, workflow rules here.
- Releases are tag-driven via npm Trusted Publishing/OIDC; see
  [`docs/release.md`](./docs/release.md). Never run `npm publish` locally, and
  never introduce a long-lived `NPM_TOKEN`.

## Security

Report vulnerabilities privately via GitHub Security Advisories on
`HOWILLMAKEIT/dsh-model-context-catalog` — the full policy, supported versions, the
plugin's security boundary, and report hygiene (never include API keys or
session logs) are documented in [`SECURITY.md`](./SECURITY.md). Keep that file
in sync when the security boundary changes. The plugin requests no network
permissions, ships no telemetry, and talks to DSH exclusively through the
public settings API.

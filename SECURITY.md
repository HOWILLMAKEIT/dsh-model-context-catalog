# Security Policy

## Reporting a vulnerability

Please report vulnerabilities **privately** — do not open a public issue for
anything you believe is exploitable:

1. GitHub → `HOWILLMAKEIT/dsh-model-context-catalog` → **Security → Report a
   vulnerability** (private security advisory).
2. Include: affected version/tag, reproduction steps, impact assessment, and
   whether the issue also reproduces on the current `main`.
3. Maintainers will acknowledge, assess, coordinate a fix, and disclose via a
   GitHub advisory plus a `CHANGELOG.md` entry.

**Never include secrets or private content in reports:** API keys, tokens,
credentials, or full session logs. DSH session logs can contain prompt and
file content — redact before attaching anything.

## Supported versions

| Version | Supported |
| --- | --- |
| `0.2.0` (current, first npm release) | ✅ security fixes target the latest tag |
| earlier | never released to npm; not supported |

## Security boundary of this plugin

What the plugin is, in security-relevant terms:

- **No network access.** The declared DSH permission set is empty
  (`dshhub.permissions.network: []`); the plugin makes no HTTP calls and ships
  no telemetry or analytics.
- **Public settings API only.** The Host half registers a dedicated
  `model-context-catalog` settings namespace and reconciles values into the
  resolved `llm-pi-ai` section through `settings.update` (revision CAS,
  bounded retries). Namespace descriptors are read via
  `settings.describe({ redactSecrets: true })` — secret values are never
  requested in the clear.
- **One write target.** The Web half binds a read-only view of `llm-pi-ai`
  and a read/write scope of its own namespace; the only thing it ever writes
  is the `entries` field of `model-context-catalog`. No eval, no remote code,
  no dynamic fetches.
- **It does not take over provider credentials.** The plugin never stores,
  rotates, displays, or transmits API keys. Reconciliation preserves the
  existing credential *reference* (and endpoint/protocol/modalities) of each
  model row verbatim and corrects only the context-window metadata.
  Credentials remain owned by your DSH `llm-pi-ai` configuration — anything
  claiming to be this plugin and asking for credentials is not this plugin.
- **No monkey-patching.** It does not patch DSH or pi-ai internals; tests
  lock the reconciliation behavior to the public settings seam.

## Release integrity

Releases are cut by `git tag vX.Y.Z` → GitHub Actions → npm Trusted
Publishing (OIDC). There is **no long-lived `NPM_TOKEN`** anywhere in the
pipeline; publish credentials are short-lived OIDC exchanges authorized by the
Trusted Publisher registration (`HOWILLMAKEIT/dsh-model-context-catalog` +
`release.yml` + `release` environment). Every release carries npm provenance —
verify the “Built and published from GitHub…” attestation on npmjs.com. The
pipeline also enforces tag↔version match, a per-version CHANGELOG section,
reproducible build + tests, and a tarball boundary check (no
`node_modules`/`.env`/`test`/`scripts`/`.github` inside the package). See
[`docs/release.md`](./docs/release.md) for the full runbook and the manual
emergency fallback.

## Scope

**In scope:** vulnerabilities in this plugin's code, its npm package contents,
and its release workflow in this repository.

**Out of scope (report upstream instead):**

- DeepSeek Harness / pi-ai adapter behaviors — including the context-overflow
  false positive documented in [`ROOT_CAUSE.md`](./ROOT_CAUSE.md). That is a
  correctness issue with a user-space fix, not a vulnerability in this plugin;
  report upstream DSH behavior to `deepseek-ai/deepseek-harness`.
- Vulnerabilities in DSH core or other plugins you run alongside this one.

# GLM context-overflow false positive: root-cause report

## Verdict

The observed `pi-ai detected context overflow for model "glm-5.3[-flash]"`
is an adapter-side false positive, not evidence that the GLM endpoint exhausted
its real context window.

The custom `glm-coding` rows omitted `contextWindow`. DSH 0.1.1-rc.2 therefore
materialized both models with pi-ai's 262,144-token fallback. pi-ai's silent
overflow heuristic converts a successful terminal `stop` into
`CONTEXT_WINDOW_EXCEEDED` whenever reported input plus cache-read usage exceeds
the supplied window. Tool-use finishes are not checked by that branch, which is
why long tool loops continue and only the final natural-language response dies.

## Independent evidence

### Session `session-beb4a757-e2e9-4769-8c4e-5265fa627869`

- Previous route: `deepseek-v4-pro`, recorded context window 1,024,000.
- `dsh-context` projection at the switch:
  - estimated request total: 430,111;
  - provider-reported prompt: 544,630;
  - newly recorded GLM context window: 262,144.
- `glm-coding/glm-5.3` subsequently returned successful tool-use messages with
  prompt usage up to 529,587 tokens.
- The session then recorded 10 terminal overflow turns, 49 failed compactions,
  and zero successful `compaction/summary` events.

### Session `session-cb8ee285-0e9b-445c-91b1-d11600923df6`

- The same `glm-5.3-flash` model previously used through `zai-coding-cn` was
  recorded with a 1,000,000-token window.
- Switching the route to custom `glm-coding` changed only the recorded capacity
  to 262,144.
- The endpoint still returned successful tool-use messages with prompt usage up
  to 724,675 tokens.
- Seven terminal turns were then classified as context overflow.

A direct reproduction with pi-ai's exported implementation behavior and the
observed 724,675-token usage gives:

```json
{
  "terminalAtFallback": true,
  "terminalAtRealWindow": false,
  "toolUseAtFallback": false
}
```

## Code path (upstream anchors)

All permalinks verified against `deepseek-ai/deepseek-harness` tag
`dsh-v0.1.1-rc.2` (commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`) and the
pi-ai vendored pi `v0.82.1` (commit `b4f293684bba718d59cc1157679bcf6157b3a7f5`).
Every behavior below still exists unchanged in `dsh-v0.1.2-alpha.3`
(`dd6322d604e00eec1ba5e0c8541159906a21094a`).

1. `packages/llm/llm-pi-ai/src/config.ts#L61` defines
   `DEFAULT_CONTEXT_WINDOW = 262144`, introduced upstream in
   `f376ee23d1f9310892dd4796e3cba693e825dc4b` ("size unknown models and refuse
   a section that cannot be served").
2. The profile schema applies that value as `defaultContextWindow`; a configured
   model row without `contextWindow` inherits the fallback. The
   three-level materialization chain lives at
   `packages/llm/llm-pi-ai/src/catalog.ts#L851` (rc.2) → `#L866` (alpha.3):
   row value → built-in catalog value → guessed default.
3. `streamWithSnapshot()` passes `model.contextWindow` to `toStreamChunks()`
   (`packages/llm/llm-pi-ai/src/stream.ts#L76-L89`).
4. pi-ai `isContextOverflow()` (`earendil-works/pi`
   `packages/ai/src/utils/overflow.ts#L132-L161`) treats successful `stop`
   usage above that value as silent overflow; the pi side has zero logic
   changes between v0.82.1 and v0.84.4.
5. DSH maps the flag to the synthetic message
   `pi-ai detected context overflow …` (`packages/llm/llm/src/error.ts#L80-L86`).
   The `length` stop-reason branch never recovers, and although pi upstream
   added `isRecoverableLength` for bounded compact-and-retry (pi#7540,
   `overflow.ts#L166-L175`), DSH does not consume it (zero references in both
   rc.2 and alpha.3).

Scope boundary: models whose id resolves inside the installed pi-ai catalog
are judged against real catalog values. Any other id — custom renames, gateway
aliases, stale catalogs — falls through to the guessed default, which then
feeds both the 0.8× pressure threshold and the overflow classifier.

## Why `/compact` also failed

`compaction-basic` chooses the latest routed model as its default summarizer.
The summary request contained substantially more than the false 262,144-token
limit. GLM could process that request, but its terminal summary `stop` hit the
same silent-overflow false positive. The transaction wrote
`compaction/end.error` and never committed `compaction/summary`, leaving the
surface unchanged for the next attempt.

## Applied repair

The built-in catalog shipped with `dsh-model-context-catalog` declares the
verified GLM routes at 1,000,000 tokens, and the settings page lets any route
be corrected the same way. The plugin keeps those values reconciled through
the public DSH settings API (`settings.update` with revision CAS and bounded
retries); it does not patch adapter internals. The pi-ai settings watcher
atomically rebuilds its immutable route snapshot after each correction. The
Web UI shows which state each route is in — applied, pending, provider
default, or not configured — and never presents the 262,144 fallback as a real
limit. Usage instructions live in the [`README`](./README.md).

The generated `glm-coding-vision` route needs no separate row: Vision Router's
twin adapter delegates `resolveModel()` to `glm-coding` and mirrors its context
metadata.

## Remaining upstream hardening

The upstream design note itself
(`.agents/notes/implemented/architecture/2026-07-10-after-call-compaction-pressure-and-overflow-recovery.md`,
rc.2) admits the open edges: `maxOverflowRetries` defaults to 1, "provider
wording and heuristic character density remain maintenance risks", and
"surface compaction still cannot repair an envelope that alone exceeds the
window". User-space fixes cannot address the following; DSH/pi-ai upstream
would need to:

1. Decouple the guessed capacity from the overflow classifier — pressure
   estimates may use a fallback, but turning a successful response into an
   error should require an explicit model value, a trusted catalog value, or a
   provider-confirmed limit (metadata provenance should be retained).
2. Consume pi's `isRecoverableLength` (pi#7540) so a `length` stop below the
   desired output cap gets a bounded compact-and-retry instead of a terminal
   failure.
3. Shrink the recovery window across retries; today a single fixed-window
   recovery attempt is spent even when the summary itself self-overflows, and
   summary self-overflow cannot self-heal.

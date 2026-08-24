# S1/W5 — Liquid security + performance evidence

`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` (`packages/theme-engine/src/theme-governance.ts:16-21`) names
render-parity, security, SSTI/XSS, and performance evidence as the ARB flip gate. This document states,
per dimension, what is proven, by which test, and what is honestly **NOT_PROVEN** — never a fabricated
GREEN.

## Verdict table

| Dimension | Verdict | Citing test path |
|---|---|---|
| SSTI (settings values never re-evaluated as Liquid) | **GREEN** | `packages/theme-engine/test/qi-security.test.ts` (SEC-3a, SEC-3b) + `packages/theme-engine/test/liquid-s1-w5-adversarial-security.test.ts` (W5-block-ssti) |
| XSS (sanitizer neutralizes injected markup/attributes/URLs) | **GREEN** | `packages/theme-engine/test/qi-security.test.ts` (SEC-1, SEC-2, SEC-9, SEC-10) + `packages/theme-engine/test/liquid-s1-w5-adversarial-security.test.ts` (W5-XSS-*, W5-block-xss, W5-app-block-xss) |
| Prototype pollution / credential-key leakage into Liquid scope | **GREEN** | `packages/theme-engine/test/qi-security.test.ts` (SEC-4 through SEC-7) + `liquid-s1-w5-adversarial-security.test.ts` (W5-app-block-settings-filtered) |
| Render performance (single-process latency, this machine) | **GREEN**, scope-limited — see note | `packages/theme-engine/test/liquid-render-benchmark.test.ts` |
| Render-limit contention (concurrent renders do not starve/drop sections) | **GREEN** | `packages/theme-engine/test/liquid-render-limit-contention.test.ts` |
| Production concurrent-load / multi-request throughput capacity | **NOT_PROVEN** | no test exercises this — see note below |

## What each test file actually proves (brutal, not polished)

### `qi-security.test.ts` (630 lines, 17 tests, pre-existing) — GREEN, genuinely behavioral
Read end-to-end for this phase. Every test renders real input through the real `LiquidRenderer` /
`sanitizeRenderedHtml` / `buildLiquidThemeHeadAssets` path and asserts on the OUTPUT, not on source-file
string presence — this is real proof, not governance theater. It covers: DOMPurify `FORBID_TAGS`
(`<base>`/`<embed>`/`<object>`) and `FORBID_ATTR` (`style=`); two independent SSTI probes (a section-
settings Liquid-expression string, and a `liquidContext.settings` Liquid-tag string) proven never
re-evaluated; the `toLiquidDrop` depth limit (4) and key-count limit (80); prototype-pollution key
filtering for both prototype-chain (`__proto__` literal) and own-enumerable (`JSON.parse`) forms;
`BLOCKED_DROP_KEYS` completeness (13 credential-adjacent keys, pinned); CSS token injection (a poisoned
`primaryColor` cannot break out of the `:root{}` block); and the DOMPurify `uponSanitizeAttribute` hook
blocking `data-*` XSS and `javascript:`/`data:text/html` URLs.

**Gaps this phase found and closed** (`liquid-s1-w5-adversarial-security.test.ts`, 10 new tests, all GREEN):
this file did not test XSS through every declared settings *field type*, injection via *block* settings
(as opposed to section settings), the `{{ block.content | raw }}` re-embed pattern three section templates
use, or the `@app` block handle path (`liquidAppBlocks`). All four gaps are now covered. Fixing the test
harness itself surfaced one real methodology bug worth recording: an early version of the new file's
`assertNeutralised()` helper did a raw string search for the payload's marker text and produced **false
positives** — DOMPurify correctly HTML-entity-escapes `<script>` to `&lt;script&gt;`, so the marker string
still appears as *inert escaped text*, which a naive substring/regex check cannot distinguish from a live,
executable node. The helper was rewritten to parse the output into a real DOM (`jsdom`, the same engine
`sanitizeRenderedHtml` itself uses internally) and assert the absence of live `<script>` elements and
`on*` attributes — the correct standard for "was this neutralized," not "does this substring appear
anywhere." No production code changed to make this pass; the fix was in the test's own assertion, and is
called out here so the distinction between "adjusted the harness" and "adjusted the target" is explicit
(per this phase's rule to never tune a harness until it goes green for the wrong reason).

**Also confirmed, not merely assumed**: the field-type vocabulary this repo's schema system actually
declares is `text, textarea, url, image, richtext, select` (queried live from
`database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json`). "html" and "liquid" are not real
declared field types — `richtext` is the closest analog to "html" and is confirmed still auto-escaped (no
renderer code path applies the `| raw` filter to a settings VALUE; the one legitimate `| raw` use is
`{{ block.content | raw }}`, and `block.content` is populated from `sanitizeRenderedHtml()` output,
`packages/theme-engine/src/theme-renderer.ts:926`, before that filter ever runs on it).

### `liquid-render-limit-contention.test.ts` (86 lines, 3 tests, pre-existing) — GREEN, genuinely behavioral
A real regression guard for a documented incident (concurrent product/collection/search renders emitting
an empty shell because LiquidJS's wall-clock `renderLimit` tripped under sibling event-loop contention,
not actual per-render cost). It renders the real Urban Kicks product template, including 4 renders fired
concurrently via `Promise.all`, and asserts none of them drop a section to an `lb:section-error`
placeholder. This is real evidence for exactly what it claims: the render-limit budget absorbs realistic
sibling contention. Re-run fresh on this machine for this phase: 3/3 pass.

### `liquid-render-benchmark.test.ts` (325 lines, 5 tests, pre-existing) — GREEN, but SCOPE-LIMITED
This is a real, measured microbenchmark — `Date.now()` deltas around N=25 actual `LiquidRenderer.render()`
calls, not a hardcoded number. It is honest about its own limits in its own header comment (kept, not
rewritten): the "production" scenario measures the full stack (Zod bundle parse + scope build + LiquidJS
+ DOMPurify); the three reference scenarios are explicitly flagged as a PARTIAL path not apples-to-apples
with production. What it does NOT measure, and what this phase does not claim it measures: concurrent
multi-request throughput under real traffic, memory pressure across many simultaneous Worker isolates, or
capacity at any merchant count. It is a single-process, single-request-at-a-time latency benchmark.

**Re-measured fresh for this phase** (not reusing the stale 2026-07-05 numbers already in the file header),
on this machine — Apple M4 Pro, 12 cores, 24 GB RAM, macOS (Darwin 25.3.0), Node v26.5.1, JSDOM-backed:

| Scenario | cold (ms) | steady (ms) | p95 (ms) | total (ms, N=25) | status |
|---|---|---|---|---|---|
| `cache:true + parallel` (production, F1+F2) | 19 | 11 | 19 | 277 | PASS |
| `cache:true + sequential` (F1 only, reference) | 2 | 2 | 5 | 46 | PASS |
| `cache:false + parallel` (F2 only, reference) | 2 | 2 | 4 | 42 | PASS |
| `cache:false + sequential` (baseline, reference) | 2 | 2 | 4 | 41 | PASS |

Production steady-state: 11ms/render, well inside the file's 200ms expectation and the 30s/N=25 budget.
These numbers are consistent with (slightly better than) the July 2026 recorded run, on different
hardware — both are real measurements, not fabricated or copy-pasted between runs.

### Concurrent-load / production-capacity — NOT_PROVEN (honest gap, not closed by this phase)
No test in this repository — before or after this phase — exercises many SIMULTANEOUS requests against a
running storefront-runtime instance (e.g. an autocannon/k6-style load test hitting an HTTP endpoint). The
contention test above proves the render pipeline survives realistic *event-loop* contention from a few
concurrent in-process renders; the benchmark proves single-process latency. Neither proves throughput or
tail latency under the request volumes named in `CLAUDE.md`'s scale envelope (up to 10,000 merchants,
~30,000 orders/month). This phase did not attempt to close this gap — building a real HTTP load-test
harness against a running storefront-runtime instance is a materially different, larger undertaking than
authoring in-process unit/integration tests, and is out of this phase's scope (W5 asked for a verdict on
existing + adversarially-extended evidence, not a new load-testing framework). Recorded here as
**NOT_PROVEN**, not GREEN, and not silently omitted.

## Security invariants preserved (not weakened to make anything pass)

- DOMPurify `FORBID_TAGS`/`FORBID_ATTR`, the `uponSanitizeAttribute` hook, and `outputEscape:'escape'` are
  untouched by this phase — grep confirms zero diffs to `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` or the
  LiquidJS engine options in `packages/theme-engine/src/theme-renderer.ts`.
- The one fix this phase made to `scripts/validators/migration-safety-validator.mjs` (W3) only excludes a
  specific, fixed dollar-quote tag (`$liquidbundle$...$liquidbundle$`) — a known, pre-existing data-payload
  convention — from a destructive-SQL-keyword regex scan; it does not touch the sanitizer, the renderer, or
  any security-relevant runtime code path.

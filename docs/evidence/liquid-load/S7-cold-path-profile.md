# S7 — Cold-Path Root-Cause Investigation

**Date:** 2026-08-24. **Method:** `node`/browser-global `performance`-based span timing
added directly to `packages/theme-engine/src/theme-renderer.ts` (env-gated behind
`LB_S7_PROFILE=1`, zero cost when unset — see that file's own comment), a real
`next start` production build hit with real `curl` requests and the load harness, one
span per request logged as structured JSON (`{"event":"lb:s7:profile", ...}`). No
guessing: every claim below is a directly-observed span value, not an estimate.

## 1. Finding #1 — CONFIRMED root cause, FIXED

**The cause.** `getThemeDomPurify()` (`theme-renderer.ts`) lazily initializes a
module-level singleton (`domPurifyPromise`) the first time any request reaches it. That
initialization does two real things, both timed directly:

| Span | Observed cost (first-ever call, repeated across 2 independent fresh-process trials) |
|---|---|
| `import('dompurify')` + `import(/* webpackIgnore */ 'jsdom')` (dynamic imports) | 194ms, 454ms |
| `new JSDOM('<!doctype html>...')` (singleton window construction) | 34ms, 38ms |
| `createDOMPurify(window)` | 0ms, 1ms |
| **Total first-init** | **230ms, ~493ms** |

**Confirmed NOT a recurring cost, NOT render cost.** Five sequential, isolated `curl`
requests to the same warm route, 3 seconds apart (mirroring S6's exact steady-rate
inter-arrival spacing) were ALL fast (32–46ms) once past the first request — the
singleton persists correctly. Every individual `sanitizeRenderedHtml` call after
first-init logs 0–13ms; `LiquidRenderer.render:total` after first-init logs 6–51ms. The
~230–493ms is paid exactly once per process lifetime, on whichever request happens to
arrive first — not something the render pipeline itself is slow at.

**The fix.** `warmupThemeDomPurify()` (new export, `theme-renderer.ts`) fire-and-forget
triggers `getThemeDomPurify()`. Called from a new
`apps/storefront-runtime/src/instrumentation.ts` (`register()`, Next.js's documented
server-boot hook, Node.js runtime only — jsdom/DOMPurify are server-only and this hook
also runs under the Edge runtime, where they don't apply). This moves the cost to server
boot, which nobody is timing, instead of the first real request.

**Verified fixed, directly.** Fresh process, `LB_S7_PROFILE=1`: the
`getThemeDomPurify:dynamic import...` / `new JSDOM(singleton window)` spans now appear at
`processUptimeMs≈700–740` — during boot, before any HTTP request was sent (confirmed: no
`curl` had been issued yet). The first real request afterward measured 229ms end-to-end
(down from ~460–500ms cold), and a follow-up isolation test (first request React, second
request React, third request Liquid — all after the same boot-time warmup) measured
282ms / 13ms / 57ms respectively: the THIRD (first-ever Liquid) request was fast (57ms),
confirming the Liquid-specific singleton cost is gone. **This fix is real, profile-justified,
does not touch the sanitizer's allowlist/FORBID lists/outputEscape, and is kept.**

**Side finding, disclosed, not fixed (out of scope):** that same isolation test showed
the FIRST-EVER request to `/preview` — using the REACT engine — also cost 282ms, dropping
to 13ms on the second hit to the same route. This is a generic Next.js per-route
first-hit cost (RSC/route-module linking), confirmed engine-agnostic (it hit React, which
never touches DOMPurify/JSDOM at all), not a theme-engine or Liquid characteristic, and
not something this phase's sanitizer-focused fix should or does touch.

## 2. Finding #2 — a residual low-rate anomaly, corrected re-measurement, NOT_ROOT_CAUSED

With the Finding #1 fix applied and the harness's warmup fixed (S7-verdict-correction.md
§2: warmup is now request-count-based — 5 requests per scenario, all awaited to
completion — not time-boxed), a full corrected re-measurement was run:

- **Peak (10 req/s, 20s, n=33/scenario, 3 trials):** GREEN, unchanged from S6/S7-correction
  — deltas within 0.6–1.8ms. `docs/evidence/liquid-load/S7-load-results-peak.json`.
- **Low-rate (2 req/s, 90s, n=30/scenario, 3 trials, properly warmed):**
  `docs/evidence/liquid-load/S7-load-results-steady.json`. **The ~500–555ms anomaly is
  still present** — on every Liquid scenario, in every trial. This is NOT the Finding #1
  cause (warmup is confirmed complete — 5/5 per scenario every trial — well before
  measurement starts).

**Critical new observation that changes the classification.** In trial 3 of this
corrected run, the SAME ~536–546ms spike appeared on `index/react`, `product/react` AND
`collection/react` — i.e., not exclusive to Liquid in this trial. Cross-referencing host
telemetry recorded with every trial:

| Trial | `freeMemMb` before | `freeMemMb` after | Liquid p95 | React p95 |
|---|---|---|---|---|
| 1 | 2555 | 2492 | 543–555ms | 63–105ms |
| 2 | 2340 | **719** | 542–550ms | 55–198ms |
| 3 | **666** | 2226 | 542–553ms | **536–546ms** |

Free memory swung from 2340MB to 719MB during trial 2 and stayed low into trial 3 before
recovering to 2226MB by trial 3's end — a sharp drop-then-recover pattern within
~180 seconds, consistent with another process on this shared machine (per the phase's own
warning: ~90 competing node/next processes from the other concurrent sessions) performing
a heavy build or compile during that exact window, not a leak in this test. React's own
p95 tracking that same swing (fast in trials 1–2 when memory was ample, slow in trial 3
when memory was tight) is the strongest available evidence that at least PART of what
S6 attributed entirely to "Liquid" is actually **shared-host memory pressure that a laptop
running 6+ competing sessions cannot cleanly separate from an engine-specific cost.**

**What this does NOT let me conclude.** Liquid's p95 was elevated in EVERY trial
(542–555ms), including trials 1 and 2 where React stayed fast and free memory was ample
(2340–2555MB) — so host memory pressure does not fully explain Finding #2 either. There
may still be a genuine, smaller, Liquid-specific low-rate cost underneath the
host-pressure confound. **This investigation could not separate the two within this
phase's time and hardware constraints** (a shared 12-CPU laptop with ~90 competing
processes, not a dedicated or idle machine).

**Classification: NOT_ROOT_CAUSED.** Ruled out: LiquidJS render cost itself (0–13ms per
span, every trial); the Finding #1 singleton cold-start (warmup confirmed complete);
sanitize-call cost individually (0–8ms per call, every trial). Plausible but NOT
confirmed: a residual Liquid-specific cost independent of host memory pressure. Confirmed
present but not fully attributable: host-level memory pressure from competing processes
on this shared development machine, which this investigation cannot fix and should not
attempt to — it is not a defect in this repository's code.

**No fix was applied for Finding #2.** Per the phase's own prohibited-shortcuts list —
"never fix without a profile" and "a fabricated cause is not [an acceptable outcome]" —
applying any change here (e.g., more aggressive caching, different concurrency limits)
would be exactly that: tuning against noise this investigation could not attribute.
**Recommended follow-up:** re-run `apps/storefront-runtime/scripts/liquid-load-harness.mjs`
with `LB_S7_PROFILE=1` on an idle or dedicated machine (no competing sessions), to
determine whether Finding #2 fully disappears (confirming it was 100% host confound) or a
smaller residual remains (confirming a genuine, smaller Liquid-specific low-rate cost
still exists and needs its own profile).

## 3. Sanitizer integrity — unchanged, verified

No change was made to `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`, the `ADD_TAGS`/`ADD_ATTR`
allowlists, `FORBID_TAGS`/`FORBID_ATTR`, the `uponSanitizeAttribute` hook, or
`outputEscape`. The fix is purely a change in WHEN the existing singleton gets
constructed, never WHAT it sanitizes or HOW. `test/liquid-s1-w5-adversarial-security.test.ts`
re-run clean (§4 of the final report) — required by the phase's own explicit gate.

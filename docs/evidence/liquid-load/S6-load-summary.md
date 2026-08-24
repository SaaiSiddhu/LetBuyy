# S6 — Concurrent-Load Evidence for the Liquid Flip

**Date:** 2026-08-24. **Status:** dated evidence snapshot, not a certification (per the
Constitution's production-readiness law). Commit at time of measurement: see
`EXECUTION_LEDGER.md`'s `PHASE-S6-CONCURRENT-LOAD` row for the exact SHA range this
evidence was produced against (HEAD drifted under this session mid-phase, as expected —
attributed there, not claimed).

## 1. What this document answers, and what it does not

Per `packages/theme-engine/src/theme-governance.ts:16-21`'s
`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION`, the flip remains `status: 'deferred'` pending
render-parity (GREEN, S1/S3), security/SSTI/XSS (GREEN, S1), and performance evidence.
This phase supplies the performance evidence — but only the part that can honestly be
answered without a ratified latency SLO:

- **CAN answer:** does rendering through Liquid degrade the storefront **relative to
  React**, on the same machine, in the same run, under a realistic (constitution-derived)
  concurrent request rate? — Answer below, with numbers.
- **CANNOT answer:** is the storefront fast enough in absolute terms? That needs a
  latency budget, which does not exist (`infrastructure/monitoring/slo-catalog.yaml` has
  no storefront latency SLO). A **PROPOSED, unratified** budget is offered in §6 for the
  owner to accept or reject (open question F-8,
  `docs/research/2026-08-16-architecture-truth-foundation-and-scale/17_OPEN_QUESTIONS_AND_HUMAN_ACTIONS.md`).

## 2. Method

- **Harness:** `apps/storefront-runtime/scripts/liquid-load-harness.mjs` (new, this
  phase). Node standard library only (`fetch`, `perf_hooks`, `os`) — no new dependency
  (`supply-chain-validator`/`dependency-manifest-validator` re-run clean).
- **Server under test:** `pnpm --filter @letbuyy/storefront-runtime build && npx next
  start -p 3939` — a real production build, not `next dev`. Verified `NODE_ENV` is what
  `next start` sets it to; the harness never talks to a dev server.
- **A/B mechanism:** `apps/storefront-runtime/src/app/preview/page.tsx`'s existing
  Urban Kicks demo path (`?demo=urban-kicks`), extended this phase with two **demo-only,
  additive** query params: `engine=react|liquid` (forces
  `templateConfig.liquidRenderingCanary`; see `resolveEngineOverride` and its comment —
  a real merchant's `?subdomain=` preview never reaches this branch, so its own canary
  resolution is untouched) and `route_type=index|product|collection` (surface selector;
  `resolveDemoRouteType`, same gate). This is the "test fixture/local override only"
  mechanism the phase mandated: **no migration, seed, or committed default was changed**
  — `letbuyy-core` stays DARK (verified, §7) and no real store's canary is touched.
- **Why `/preview`, not the real `/store/[subdomain]` route:** the real route already has
  a dev-only engine override (`resolveDevEngineOverride`,
  `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:230`) but it is
  explicitly `NODE_ENV === 'production'`-gated OFF — under `next start` it is always a
  no-op, so it cannot drive a production-build A/B at all. `/preview` has no such gate
  (verified by reading the file — zero `NODE_ENV`/`VERCEL_ENV` checks in it), and its
  demo path was already reachable in every environment before this phase (S1/W6). Using
  it is lower-risk than building a parallel bench-only route, because it reuses the
  **exact same render pipeline** (`resolveStorefrontTemplate` →
  `StorefrontCompositionEngine` → `LiquidRenderer`/React) real preview traffic already
  exercises — not a bench-specific reimplementation that could silently diverge from
  reality.
- **Known content-parity caveats of this A/B mechanism, disclosed up front (see §5 for
  the fixes made and what remains asymmetric):**
  - **Home:** Liquid renders the full 10-section `letbuyy-core`/Urban Kicks composition
    (S5). The demo store's REACT JSON-contract template
    (`getDefaultStorefrontThemeTemplate('urban-kicks', …)`) only ever had 6 sections, and
    3 of Liquid's 10 (`banner-carousel`, `video-hero`, `spotlight`) have **no React
    section at all** — not a demo-store oversight, a structural fact (ART-17 freezes
    React at 20 files; `video-hero`/`spotlight` were deliberately built Liquid-only in
    S5). **The home-surface comparison below is NOT section-count-normalized** — Liquid
    is doing genuinely more rendering work per request on this surface. This is disclosed
    plainly, not hidden.
  - **Product/collection:** the demo store's `templateConfig.templates` had **no**
    `product`/`collection` entries before this phase — every non-index demo preview
    request silently fell back to a single generic placeholder section on the React side
    (`template: "product-resource-fallback"`, confirmed in a raw server-log capture
    before the fix, `latency_ms: 0`), while Liquid rendered its real 2-section template.
    That is not a fair comparison, so this phase closed it (see §5) by adding a
    `product`/`collection` entry to `getUrbanKicksDemoStore()`'s React template, using the
    closest available React section registrations. **Collection is an approximation**:
    Liquid's `collection-banner`/`collection-product-list` section types have no React
    counterpart in `renderer-registry.tsx` at all (verified — grepped every registered
    `sectionTypes` entry), so the React side substitutes `heroBanner` + `productGrid` (2
    sections, matching Liquid's 2-section count, but not identical section types).
    Product uses exact type-for-type equivalents (`productDetail`, `featuredProducts`
    both have real 1:1 React registrations) — the product-surface comparison is the
    cleanest of the three.
- **Determinism:** scenario order is a fixed round-robin array, never randomised;
  interleaving alternates every scenario every request (not "all of React then all of
  Liquid") — a shared machine's load drifts over even a 15–20s window, and a sequential
  design would attribute that drift to the wrong engine.
- **Open-loop rate control:** requests are scheduled at a fixed interval derived from the
  target aggregate RPS, not "wait for the previous response" — avoids coordinated
  omission (a closed-loop generator under-counts tail latency exactly when a server is
  struggling, which is precisely the scenario this phase needs to see clearly).
- **Warmup:** every trial runs a warmup window first and **discards** it explicitly (exact
  discarded-request counts are logged per trial and stored in the JSON — 49–50 requests
  per warmup at the peak-rate config, 6 at the steady-rate config).
- **Body drained:** every request's response body is fully read (`res.arrayBuffer()`)
  before recording latency — a fair comparison must include transfer cost, not just
  time-to-first-byte.
- **Host load recorded, not ignored:** `os.loadavg()` captured before and after every
  trial; this machine's 1-minute load average was consistently 4.2–5.9 throughout every
  run in this phase (12 CPUs; ~90 node/next processes already running from the other
  concurrent sessions the phase prompt warned about) — recorded in the JSON per trial, not
  a hidden confound.

## 3. Results — peak scenario (10 req/s aggregate, 3 surfaces × 2 engines, 3 trials)

Derived from `S6-workload-definition.md` §3: the constitution's own arithmetic (30,000
orders/month at the 10,000-merchant envelope top → ~0.069 orders/s at an assumed evening
peak → ~4–7 browsing requests/s at a 50–100:1 browse-to-order ratio). 10 req/s is chosen
with headroom above that derived range, not at the edge of it.

Full distributions and per-trial data: `docs/evidence/liquid-load/S6-load-results-peak.json`.
Mean ± stddev across 3 trials, in ms:

| Surface | Engine | p50 | p95 | p99 | throughput (req/s) | errors |
|---|---|---|---|---|---|---|
| home | react | 40.6 ± 15.2 | 138.6 ± 5.5 | 143.3 ± 7.3 | 1.65 | 0 |
| home | liquid | 38.7 ± 6.6 | 137.5 ± 9.6 | 138.4 ± 9.8 | 1.65 | 0 |
| product | react | 46.1 ± 13.9 | 129.6 ± 5.4 | 130.1 ± 5.1 | 1.65 | 0 |
| product | liquid | 31.4 ± 10.8 | 130.4 ± 6.9 | 132.3 ± 8.7 | 1.65 | 0 |
| collection | react | 35.5 ± 2.3 | 131.9 ± 8.3 | 135.0 ± 9.4 | 1.65 | 0 |
| collection | liquid | 34.3 ± 7.3 | 132.6 ± 7.3 | 134.3 ± 9.2 | 1.6 | 0 |

**At the derived peak rate, the p95/p99 delta between engines is within a few
milliseconds on every surface — well inside the run-to-run variance (stddev) of either
engine individually.** Zero errors, zero non-200 responses, across 594 total requests (33
per scenario × 6 scenarios × 3 trials, minus 2 dropped-connection samples on
`collection/liquid`, both counted in the histogram, neither an application error). **This
is a GREEN result for the question this phase exists to answer: at a realistic,
constitution-derived request rate, Liquid does not measurably degrade the storefront
relative to React.**

## 4. Results — steady/off-peak scenario (2 req/s aggregate, 2 trials) — the phase's central finding

Full data: `docs/evidence/liquid-load/S6-load-results-steady.json`. Mean ± stddev across 2 trials:

| Surface | Engine | p50 | p95 | throughput | errors |
|---|---|---|---|---|---|
| home | react | 24.8 ± 3.1 | 37.6 ± 15.0 | 0.33 | 0 |
| home | liquid | **530.2 ± 0.3** | **543.8 ± 16.5** | 0.33 | 0 |
| product | react | 37.3 ± 10.6 | 45.5 ± 11.5 | 0.33 | 0 |
| product | liquid | **54.6 ± 25.1** (p50) | **533.5 ± 12.7** | 0.33 | 0 |
| collection | react | 32.3 ± 11.4 | 41.7 ± 19.0 | 0.33 | 0 |
| collection | liquid | **518.8 ± 0.6** | **532.0 ± 10.5** | 0.33 | 0 |

**This is a genuine, reproducible RED finding, and it is the opposite shape of what "load
degrades Liquid" would predict.** At the LOWER request rate (2 req/s, not 10), Liquid's
p95 is **10–14× React's** on every surface — react stays 26–55ms; liquid jumps to
518–544ms — and the effect is tightly reproducible (home/liquid p50 stddev across the two
trials is 0.3ms on a ~530ms value). At the HIGHER rate (10 req/s, §3) the gap is within
noise. **Higher load does not reveal this problem — lower load does.**

**Root cause investigated, not fully resolved, and reported honestly as such.** Cross-
referenced against `composition-engine.tsx`'s own internal `lb:canary:render` structured
log (its `latency_ms` field times only the `renderLiquidPlan()` call, not the full HTTP
request — confirmed by reading the code, `composition-engine.tsx:659-664`, and a genuine,
independently useful finding of this phase: **that field is not a valid engine-comparison
metric on its own, because it silently measures ~0ms for every React request** — the
Liquid-vs-React branch is decided upstream, so a React plan returns from
`renderLiquidPlan()` almost instantly by construction, not because React rendering itself
is instant. This phase's HTTP-level harness does not have this flaw; it is flagged here so
a future phase does not mistake that log field for a fair per-engine timer).

Reading that same internal timer during the steady-rate run's actual Liquid requests:
**the Liquid render itself consistently took 4–13ms** (sample values pulled directly from
the server log: `5, 6, 13, 5, 7, 12, 4, 6, 13, 5, 6, 12, 6, 5, 12, 6, 8ms` across 17
consecutive Liquid renders during the steady run). **The ~500ms gap is NOT LiquidJS
render cost — it is happening somewhere else in the request path**, specifically and only
when requests to the Liquid variant are spaced roughly 3 or more seconds apart (the gap
between same-scenario hits at 2 req/s aggregate ÷ 6 round-robin scenarios). It is uniform
across all three surfaces regardless of section count (10-section home ≈ 2-section
product ≈ 2-section collection, all ~520–544ms), which further rules out render-proportional
cost and points at a fixed, per-request-path cost specific to the Liquid code path when
idle time precedes it.

**What was checked and ruled out within this phase's time budget:** the server log showed
zero warnings/errors during the steady run; response sizes were confirmed genuinely
different between engines (374,915 vs 337,380 bytes for home), ruling out a caching
artifact; the effect is stable across both trials (not a one-time cold-start amortised
over a run). **What was NOT investigated further, and is explicitly NOT_PROVEN:** the
exact mechanism (candidates not eliminated: a lazy dynamic import/module-resolution cost
specific to the LiquidJS/JSDOM/DOMPurify chain, a GC or memory-compaction pause on the
Node process, an idle-timeout-driven de-optimisation, or something specific to this
particular test harness/OS combination) would require CPU profiling (`--prof`, heap
snapshots, or targeted timing instrumentation around `createThemeRenderer`) that is a
separate, deeper investigation this phase's scope does not cover.

## 5. Fixes made while building the harness (pre-existing gaps, not new features)

Both are additive, demo-path-only, and covered by the existing test suite plus a
targeted assertion update (see §7):

1. **`apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts`** —
   `buildSectionDataPlan` unconditionally called the live backend
   (`ProductService.getProductsByIds`/`getProductsByStoreSubdomain`) for any section
   requesting product data, with no demo-store special case — the ONE place in the demo
   preview pipeline that still needed a real `services/api-gateway` to be running. Fixed
   to source from `ProductService.getUrbanKicksDemoProducts()` when
   `route.subdomain === URBAN_KICKS_DEMO_SUBDOMAIN`, mirroring the special case
   `loadProductsForStore` (in `preview/page.tsx`) already had for the store's top-level
   product list. Without this fix, `/preview?demo=urban-kicks` (home surface) 500'd with
   `ECONNREFUSED` in a bare `next start` environment with no gateway running.
2. **`apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts`** — added
   `templates.product`/`templates.collection` to `getUrbanKicksDemoStore()`'s React
   `templateConfig` (previously only `templates.index` existed), so those two surfaces
   render a real composed template on React instead of a single fallback placeholder —
   see §2's disclosed caveat on the collection approximation.

## 6. PROPOSED latency budget — NOT RATIFIED

Not authorised to set an SLO (explicit exclusion). Offered for the owner to ratify,
reject, or amend (see `SKIPPED_HUMAN_DECISIONS.md`), grounded in what was actually
measured:

| Surface | Percentile | Proposed threshold | Why |
|---|---|---|---|
| Home / collection / product | p95 | **250ms**, uncached origin render | ~1.8× the highest observed peak-scenario p95 (138.6ms) on either engine, leaving headroom for real network latency (this test ran over loopback) and real Cloudflare-edge-to-origin hops this test cannot reproduce. |
| Home / collection / product | p99 | **400ms**, uncached origin render | Covers the steady-rate anomaly's th observed range with margin, so if the root cause recurs in production it trips an alert rather than silently degrading UX. |

This budget is deliberately **not** derived from the steady-rate ~530ms anomaly being
"acceptable" — it is set BELOW that number specifically so the anomaly, if it recurs in
production, would breach the proposed p99 budget and page someone, rather than being
silently absorbed into "normal."

## 7. Verification (protected suites, builds, validators)

- `pnpm --filter @letbuyy/theme-engine test` → 1816/1816 (unchanged; no theme-engine file
  touched this phase).
- Parity harness → 8/20 text-matrix / 10/10 behavioural, zero React-only gaps (unregressed).
- `tsc --noEmit` both apps → 0 errors.
- Launch suite → 68/68 (one assertion in `lb-s2-route-template-closure.test.mjs` updated
  to match `/preview/page.tsx`'s new `routeContext` variable — same intent, `type:
  'index'` is still the unconditional default for any non-demo preview, now additionally
  asserted that the override is `isDemoPreview`-gated).
- S1 adversarial + S3 parity + S4 drift guard → 69/69. S5 composition suite → 15/15.
  `liquid-s1-w3-letbuyy-core-attach.test.ts` → 4/4 (**letbuyy-core confirmed still DARK**).
- `pnpm --filter @letbuyy/storefront-runtime build` → exit 0 (this is also the exact build
  the harness drove — not a separate, unverified artifact).
- 7 named validators (theme-governance, no-noop-test-script, test-coverage-governance,
  supply-chain, dependency-manifest, meta-no-theater, production-readiness) → all clean.
- Full 111-validator sweep → PASS=109, FAIL=2 (`stale-artifact-validator` — documented
  individual-run false positive; `branch-lag-guard-validator` — real, owner-only, lag=3 at
  time of the final sweep, HEAD having drifted twice more under concurrent sessions during
  this phase, both attributed in `EXECUTION_LEDGER.md`).

## 8. Per-dimension verdict

| Dimension | Verdict | Evidence |
|---|---|---|
| Concurrent load at constitution-derived peak rate (10 req/s) | **GREEN** | §3 — deltas within noise, zero errors, 3 trials. |
| Concurrent load at a lower/steady rate (2 req/s) | **RED** | §4 — reproducible 10–14× p95 gap, root cause not fully diagnosed. |
| Behaviour under overload / beyond the constitutional envelope | **NOT_PROVEN** | Out of scope by constitutional rule — not attempted. |
| Real Cloudflare edge, multi-region, production hardware | **NOT_PROVEN** | This ran on a laptop over loopback against `next start`; no edge, no real network. |
| Real merchant data volumes | **NOT_PROVEN** | Demo fixture data only (6 products, 3 reviews). |
| Cart/checkout/payment render cost | **NOT_PROVEN** | Explicitly out of scope this phase (§5, workload doc §5). |

## 9. Honest flip recommendation

**Do not flip `letbuyy-core` to Liquid on the strength of this evidence alone.** The
peak-rate result is genuinely GREEN and supports the flip on that dimension. But this
phase surfaced a real, reproducible, currently-unexplained ~500ms latency anomaly specific
to the Liquid render path at lower request rates — exactly the kind of evidence the ARB
gate exists to catch before a flip, not after. Recommend: (1) a focused follow-up
investigation (CPU profiling / targeted timing around the Liquid render entry point) to
root-cause the steady-rate anomaly before any flip decision; (2) once root-caused and
either fixed or understood-and-accepted, re-run this phase's harness (it is
`--rerunnable`, no code changes needed) to confirm the anomaly is gone or bounded; (3) the
render-parity and security/SSTI/XSS gates remain independently GREEN and are not affected
by this finding — this is a performance-only blocker, not a correctness or security
regression.

Regardless of the above, the following remain **NOT_PROVEN** and unaffected by any
resolution of the steady-rate anomaly: production hardware, real Cloudflare edge caching,
real merchant data volumes, multi-region operation, and checkout/payment render cost. None
of these were in this phase's scope, and none should be read as implicitly cleared by a
GREEN concurrent-load result.

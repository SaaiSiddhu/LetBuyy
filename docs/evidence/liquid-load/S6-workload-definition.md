# S6 — Concurrent-Load Workload Definition

**Date:** 2026-08-24
**Status:** evidence document, not a certification. Every number below is labelled
**ASSUMPTION** or **SOURCED**. LetBuyy has zero production merchants and therefore zero
production traffic history — nearly every number here is a stated assumption, and saying
so plainly is the honest form (per the phase prompt's own instruction).

## 1. What this document is for

Before building or running a load harness, this phase must define the workload the
harness will exercise — per `LETBUYY_CONSTITUTION.md`'s instruction that a concurrency
figure must never be translated into infrastructure without first defining browsing vs
authenticated traffic, origin requests per user, checkout percentage, read/write ratio,
duration, and traffic shape. This document is that definition, derived from the
constitution's own stated scale envelope, not invented independently of it.

## 2. The scale envelope (SOURCED)

- **SOURCED** — `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:108`: "India-only.
  Design for 100 → 1,000 → 10,000 merchants. NEVER optimize for 100,000+ or 1,000,000+."
- **SOURCED** — `LETBUYY_CONSTITUTION.md:110`: "At the top of the envelope, throughput is
  approximately 30,000 orders per month — trivial for one PostgreSQL on one region."

## 3. Deriving a peak storefront request rate — arithmetic shown

All steps below are **ASSUMPTION** (the input scale envelope is SOURCED; the shape
assumptions layered on top of it — evening-peak concentration and browse-to-order ratio —
are not sourced from any measured LetBuyy data, because none exists yet).

1. 30,000 orders/month ÷ 30 days ≈ **1,000 orders/day** at the top of the envelope
   (10,000 merchants). — ASSUMPTION (simple monthly average, no seasonality modelled).
2. **ASSUMPTION** — India-first evening peak: assume the peak hour carries roughly 6× the
   flat 24-hour average share (a common retail/D2C rule-of-thumb, not measured for
   LetBuyy). Flat average = 1,000 orders/day ÷ 24 ≈ 41.7 orders/hour. Peak-hour orders ≈
   41.7 × 6 ≈ **250 orders in the peak hour** ≈ 4.17 orders/minute ≈ **0.069 orders/second**
   at peak.
3. **ASSUMPTION** — browse-to-order ratio 50:1 to 100:1 (i.e., for every completed order,
   50–100 total storefront page requests occur across all browsing sessions that did or
   did not convert — home, category, product, cart views). Applying both bounds to the
   peak order rate:
   - low bound: 0.069 req/s × 50 ≈ **3.5 requests/second**
   - high bound: 0.069 req/s × 100 ≈ **6.9 requests/second**
4. **Derived peak storefront request rate: ~4–7 requests/second**, landing in the
   "single-digit-to-low-tens" region the phase prompt itself anticipates. This is the
   sanity check requested — the arithmetic does **not** produce a target in the hundreds
   or thousands of RPS, confirming a small harness is the constitutionally correct scope,
   not an opinion.

**Chosen load-test targets** (rounded up modestly from the derived range, for a small
safety margin and to give the harness a non-trivial, reproducible number to hold):
- **Peak scenario: 10 requests/second**, sustained for the test window.
- **Off-peak / steady scenario: 2 requests/second**, sustained for the test window.

Both are **well within** — not at the edge of — the derived 4–7 req/s range; this phase
does not attempt to find a breaking point (that would already be over-scoped for a
10,000-merchant envelope) — it measures whether Liquid costs materially more than React
at a load level the constitution's own arithmetic says is realistic.

**Explicitly out of scope by constitutional rule (§6), not by opinion:** any target in the
hundreds or thousands of requests/second. This phase does not build or run one.

## 4. Traffic composition (mostly ASSUMPTION)

- **Browsing vs authenticated split** — ASSUMPTION: the vast majority of storefront
  requests (home, collection, product) are anonymous/browsing; only cart, checkout, and
  account routes are authenticated. This phase's harness exercises only the anonymous
  browsing surfaces (home, collection, product) — checkout/cart/account are explicitly
  **out of scope** for this phase's load comparison (see §6).
- **Origin requests per user session and what the edge absorbs** — SOURCED (structural,
  not measured): `tests/performance/storefront-cache.test.mjs` and
  `services/api-gateway/src/lib/storefront-cache.ts` show the API gateway wraps public
  storefront REST reads (bootstrap, products, product-detail, categories, navigation,
  pages, policies, blog) in a Cloudflare Cache API layer — `STOREFRONT_CACHE_TTL_SECONDS
  = 60`, `STOREFRONT_CACHE_SWR_SECONDS = 300`, store/handle-scoped cache tags purged on
  theme publish. That is the **data-layer** cache. This phase's harness does **not**
  exercise it: `/preview` (the route this phase's harness drives, see
  `S6-load-summary.md`) is marked `export const dynamic = 'force-dynamic'` — always a full
  origin compute, uncached at the page level, in every environment. This is a deliberate,
  disclosed choice: it isolates the render-engine cost (the thing this phase measures)
  from an edge-cache hit/miss ratio this phase has no way to reproduce locally (no real
  Cloudflare edge in a laptop `next start`). **What this does NOT prove:** the real
  production request rate hitting the ORIGIN (as opposed to the edge) once page-level
  caching is added for real merchant traffic — that is a separate, NOT_PROVEN question.
- **Checkout/payment percentage of traffic** — ASSUMPTION, out of scope: checkout and
  payment routes are excluded from this phase's load comparison entirely (see §6). They
  are money-critical, RLS-gated, and out of scope for a render-engine performance
  question — mixing them in would risk exercising real payment code paths under
  synthetic load, which this phase's exclusions forbid.
- **Read/write ratio** — ASSUMPTION: for the surfaces in scope (home/collection/product),
  traffic is effectively 100% read (page renders); this phase performs zero writes.
- **Traffic shape and duration** — ASSUMPTION: steady, not spike/flash-sale-shaped (a
  flash-sale burst model would need its own separate, larger-scope evidence phase). Each
  run in this phase is a short, fixed-duration steady-rate window (see
  `S6-load-summary.md` for the exact duration used), chosen to be a good citizen on a
  shared development machine (prompt's own explicit constraint) rather than to
  characterise sustained hour-long peak behaviour.

## 5. Surfaces in scope / out of scope

**In scope for this phase's head-to-head comparison:**
- **Home** (`route_type=index`) — the newly composed 10-section `letbuyy-core`/Urban
  Kicks Liquid template (S5). This is now the heaviest template in the bundle.
- **Product** (`route_type=product`) — product-detail + featured-products.
- **Collection** (`route_type=collection`) — collection listing.

**Out of scope, explicitly, for this phase:**
- Cart, checkout, payment, account/order-history routes — money-critical and/or
  auth-gated; mixing them into a render-engine comparison harness is out of scope by the
  phase's own exclusions and would risk exercising real payment code under synthetic
  load.
- Any multi-region, real-Cloudflare-edge, or real-merchant-data-volume scenario — NOT
  reproducible locally, reported as NOT_PROVEN in `S6-load-summary.md`, not modelled here.

## 6. What degraded behaviour would be acceptable under overload (ASSUMPTION, PROPOSED only)

Not ratified — an owner/ARB decision (see `SKIPPED_HUMAN_DECISIONS.md`). As a directional
input for that future decision: the constitution's own operational text (CLAUDE.md quick
context, "shed analytics, recommendations and other non-critical work before rejecting
money-critical operations") suggests degrading non-critical storefront personalization or
recommendation surfaces before rejecting a browse request outright, and rejecting a
browse request before ever failing a checkout/payment write. This phase does not test
overload/failure behaviour — it tests whether Liquid materially costs more than React at
a realistic, in-envelope, non-overload rate. Overload/failure-mode testing is a separate,
larger scope this phase does not attempt.

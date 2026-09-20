# 00 — Executive Summary

> **Date:** 2026-08-05 · **Branch:** `stepup/main` · **Baseline HEAD:** `bf35062e`
> **Scope:** the LetBuyy theme system — `letbuyy-core`, the Liquid renderer, the 10 canonical presets,
> the theme lifecycle, and the boundaries to shopper auth, cart, checkout and payments.

---

## 1. Readiness calls

Each call is a judgement about **this theme system**, on the evidence in
[21-final-test-evidence.md](21-final-test-evidence.md) and [20-final-feature-matrix.md](20-final-feature-matrix.md).

| Deployment level | Call | Why |
|---|---|---|
| **Local development** | ✅ **Ready** | Full migration replay is clean, all four affected workspaces build, the theme suite is green (1 730/1 730), and `letbuyy-core` now exists on a fresh database. |
| **Internal testing** | ⚠️ **Ready with known blockers** | Usable end to end for staff, but shoppers cannot recover a password, `/search` 404s, there is no `/customers/register` route, and checkout carries open ARB items. See [24-known-limitations.md](24-known-limitations.md). |
| **Existing controlled per-site canary** | ⚠️ **Continue only under current safeguards** | The one Liquid store may continue **because** the global default stays OFF and the store is explicitly opted in. No safeguard may be relaxed. |
| **New merchant canary expansion** | ❌ **Not approved** | THEME-R6 designates the per-theme `renderer.engine` switch as the rollback. It does not work: the React fallback cannot render 22 of 44 bundle sections (their coerced `rendererKey` never matches `COMPATIBILITY_RENDERER_KEYS`). Expanding a canary without a working rollback is unsafe. The parity harness is also wired into no CI job. |
| **Broad merchant enablement** | ❌ **Not ready** | Adds the unresolved shopper-auth gaps and the open checkout/GST ARB docket to the above. |
| **Production default** | ❌ **Not ready** | Flipping the global Liquid default is a Class-A constitutional act (ART-17 / THEME-R6) requiring ARB, and its gate is not green. |

**The single most important finding for these calls:** *Liquid currently has no working rollback.*
Everything downstream of "existing controlled canary" is blocked on that, independently of theme quality.

---

## 2. What changed in this engagement

Three tenant-isolation P0s were authorized and are closed; the theme system itself was materially completed.

**Security (ARB-authorized, tenant isolation only)**

- **Cross-tenant storefront leak closed.** `sites.subdomain` and `sites.store_name` are each unique per
  column but never against each other, and handle resolution matched *either* with `LIMIT 1` and no
  `ORDER BY`. Demonstrated live: under a forced sequential plan the old predicate returned the
  **attacker's** row for the victim's handle. Now single-valued and fail-closed across all resolvers.
- **Three further leak surfaces closed** in the same defect class, each found by adversarial review after
  the previous one was fixed: a `startsWith` prefix match that served sibling tenants, `/store/<handle>`
  ungated on the platform root, and `/preview?subdomain=` rendering any store with no token.
- **Migration 196** — replaced the `USING(true)` PUBLIC policy on `themes` (which had begun exposing
  site-private themes) with scoped policies, and raised forced-RLS coverage on theme tables from 7 to 31.

**Theme system**

- **Migration 197** — `letbuyy-core` is now a real first-class row on *any* database. It did not exist on
  any fresh or production DB: migration 188 clones from a row the **seed** creates, and seeds run after
  migrations. 188's own header admits this; nothing ever re-ran it.
- **The four Liquid data-binding failures are fixed** — and were not data-binding failures at all
  (§3 below).
- **Bundle completed**: 71 → 75 files, 21 → 23 templates, 42 → 44 sections; layout 425 B → 4 157 B with a
  skip link, landmarks, `:focus-visible` and mobile-first CSS.
- **Branding leak closed** — `compilePortableToLiquidBundle` based every compiled storefront on the Urban
  Kicks demo fixture (`Urban Kicks` ×8 → **0**).

---

## 3. The four "Liquid data-binding failures" were a concurrency defect

This is the correction that matters most technically, and it explains a contradiction in the discovery
record (one agent reported "365 pass / 0 fail", another reported 4 failures — both were observing the
same machine-speed-dependent behaviour).

LiquidJS `renderLimit` is a **wall-clock** budget, not CPU time and not an iteration count. It was set to
**250 ms**. Sections render concurrently via `Promise.all`, and `sanitizeRenderedHtml` runs jsdom +
DOMPurify **synchronously** — so a section that is itself trivial gets aborted because a *sibling*
blocked the event loop while its clock ran.

Proof: `sections/product-detail.liquid` renders in **2.9 ms in isolation under the identical 250 ms
limit**, yet was aborted inside the concurrent pipeline and replaced by an `lb:section-error` comment.
The visible symptom was a correct page shell with empty product containers — which reads exactly like a
data-binding bug.

Raising the budget to 5 s fixes all four. The structural sandbox guards (`ownPropertyOnly`, drop scrub,
`outputEscape`, upload-time `{% render %}` forbidding, `parseLimit`, `memoryLimit`) are untouched.

The deeper finding, recorded for follow-up: the project's own F9 benchmark shows the parallel section
path is **~5× slower** than sequential (227 ms vs 42 ms for N=25). The concurrency is both the cause of
the aborts and a pessimisation.

---

## 4. Governance: three distinct states, not one

| State | True? |
|---|---|
| **Gate green** | ❌ **No.** 23 of 107 validators fail. |
| **No validator regression from this work** | ✅ **Yes.** Every one of the 23 is pre-existing at clean `HEAD` or caused by user-owned files. |
| **Gate still red for pre-existing reasons** | ✅ **Yes.** This is the accurate statement. |

Measured: **22 fail at clean `HEAD`**, 24 in the working tree at baseline, **23 now** —
`single-source-crypto-validator` fixed, zero regressions. Full row-by-row classification with owners and
dispositions is in [21-final-test-evidence.md](21-final-test-evidence.md) §3.

The inherited handoff claimed "two pre-existing governance failures." The real clean-`HEAD` count is
**22**. The undercount is explained: `scripts/validate-governance.mjs` `process.exit`s at the *first*
failing validator, so anyone reading its output sees one failure and stops.

> ⚠️ That same script `rm -rf`s every `node_modules`, `.next`, `dist`, `.turbo`, `build` under `apps/`,
> `packages/` and `services/` ([validate-governance.mjs:169-192](../../scripts/validate-governance.mjs)).
> All measurements here were taken by running the 107 validators individually.

---

## 5. What is blocked, and on whom

| Blocker | Class | Owner |
|---|---|---|
| Liquid has no working rollback (React fallback broken for 22 sections; parity harness unwired) | **ARB** — gates every canary decision | ARB + theme |
| Unsigned public order-create bypassing the built-but-orphaned ART-14 signed handoff | **ARB** — public contract | ARB + checkout |
| Pre-payment inventory hard-decrement never released | **ARB** — ART-14 | ARB + checkout |
| GST computed to zero; GST invoices never issued | **ARB** — India-first legal | ARB + finance |
| COD never ledgered at confirm | **ARB** — PAY-R2 | ARB + finance |
| `customers/reset_password` — backend complete, **storefront route absent** | **Missing platform route** | storefront-runtime |
| `customers/activate_account` — **no platform contract at all** | **Missing platform route + ARB** | identity + gateway |
| `GET /themes/:slug/editor` mutates `theme_instances`; `GET /themes/:slug/schema` writes unauthenticated | **ARB** — lifecycle contract | ARB + theme |
| Three disagreeing active-theme stores (`sites.theme_id` / `theme_instances` / `store_themes`) | **ARB** — R-15 ruling | ARB |

Full docket: [17-open-decisions-and-arb-gates.md](17-open-decisions-and-arb-gates.md).

---

## 6. Confidence

**MEDIUM-HIGH** on everything measured here: every claim is backed by a command, a SQL result, or a
`path:line`, and the security fixes were validated by three adversarial review rounds that failed the
work twice before passing.

**The largest remaining uncertainty is runtime behaviour.** Verification was static, unit, integration
and database-level. **No browser session was run** against a live storefront across the viewport matrix,
so every "renders correctly" claim for the 10 presets is `Complete but not runtime-verified`, never
`Complete and verified` — see [22-preset-certification-matrix.md](22-preset-certification-matrix.md).
The second uncertainty is production database state: migration 188's no-op means `letbuyy-core` may or
may not exist in production, and that was not probed.

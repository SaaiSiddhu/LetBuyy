# PHASE L14 — PARITY REPORT (Full Liquid V1)

**Date:** 2026-06-13 · **HEAD:** `50980f6b` · **Method:** repository truth only — no fabricated screenshots/DOM/metrics.

## Verdict

> **Engine-side parity (the Liquid render is correct per route): VERIFIED** by executable render tests against the live `LiquidRenderer`.
> **Cross-engine parity (React ↔ Liquid DOM + screenshot + live behavioral diff): CANNOT RUN in this environment → PENDING-STAGING.**

L14 as specified ("Render React, Render Liquid, capture DOM, capture screenshots, compare") requires a **deployed staging storefront** running *both* engines. That is not available here, and the FORBIDDEN rule ("never fake parity / screenshots / metrics") prohibits inventing it. **L14 does NOT pass in this environment; it is BLOCKED-STAGING.** The Liquid side is proven; the comparison against live React is the gated step.

## Why cross-engine parity cannot run here (code-cited)

| Requirement | Status here |
|---|---|
| `scripts/liquid-parity/run-parity-matrix.mjs` → `requireEnv('STAGING_STOREFRONT_BASE_URL')` + `requireEnv('STAGING_TEST_SUBDOMAIN')` | **unset** (hard-fail) — `harness-lib.mjs:46` |
| `fetchStorefrontPage(baseUrl, …)` fetches a **deployed** storefront | no deployed staging URL |
| React storefront render output | **no `.next` build**; the Next app is not runnable in this sandbox |
| Liquid canary endpoint to capture Liquid output | canary OFF + no deployed env |
| Browser for screenshots | `playwright` present, but **nothing running to point it at** |
| Existing 200-cell matrix `LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/PARITY_MATRIX.md` | **202 PENDING** / 3 PASS / 1 FAIL — unrun |

## Engine-side parity matrix — VERIFIED (executable render tests, live LiquidRenderer)

| Route | Liquid template | Structural | Data binding | Security (escape/sanitize) | Cross-engine DOM/screenshot | Live behavioral | Evidence (executable) |
|---|---|---|---|---|---|---|---|
| Home / index | ✅ | ✅ | ✅ | ✅ | ⏳ staging | ⏳ staging | `liquid-l2-assets`, `theme-engine` D7 |
| Product | ✅ | ✅ | ✅ (title/images/price) | ✅ | ⏳ staging | ⏳ staging | `liquid-l5-product.test.ts` |
| Collection | ✅ | ✅ | ✅ (title/desc/products) | ✅ | ⏳ staging | ⏳ staging | `liquid-l6-collection.test.ts` |
| Search | ✅ | ✅ | ✅ (terms/results) | ✅ | ⏳ staging | ⏳ staging | `liquid-l7-search.test.ts` |
| Cart | ✅ | ✅ | ✅ (items/total/handoff) | ✅ (server total, signed handoff) | ⏳ staging | ⏳ staging | `liquid-l8-cart.test.ts` |
| Account | ✅ | ✅ | ✅ (customer drop) | ✅ (auth-gated, PII escaped) | ⏳ staging | ⏳ staging | `liquid-l10-account.test.ts` |
| Orders (history) | ✅ | ✅ | ✅ (customer.orders) | ✅ | ⏳ staging | ⏳ staging | `liquid-l11-orders.test.ts` |
| Order (detail+tracking) | ✅ | ✅ | ✅ (order drop + timeline) | ✅ | ⏳ staging | ⏳ staging | `liquid-l11-orders`, `liquid-l12-tracking.test.ts` |
| Login / Register | ✅ | ✅ | ✅ (forms) | ✅ | ⏳ staging | ⏳ staging | `liquid-l9-auth.test.ts` · **live register BLOCKED-LB12** |
| Chrome (header/footer) | ✅ | ✅ | ✅ (nav blocks) | ✅ (`javascript:` dropped) | ⏳ staging | ⏳ staging | `liquid-l4-chrome.test.ts` |

**Classification of the gated cells:** all PENDING cells are the *cross-engine visual/DOM/behavioral* comparison — **Behavioral/Cosmetic dimensions that require live React + live Liquid**. No Security or Data mismatch is known (engine-side security + data binding are verified above).

## The exact path to a real parity PASS (the gated step)

1. Deploy staging with the urban-kicks Liquid bundle persisted (regenerate via `scripts/liquid-parity/build-urban-kicks-bundle.mjs`; re-persist — the live re-persist is L15) and a canary store flagged `liquidRenderingCanary:true`.
2. `export STAGING_STOREFRONT_BASE_URL=… STAGING_TEST_SUBDOMAIN=…`.
3. `node scripts/liquid-parity/run-parity-matrix.mjs` (React snapshot vs Liquid snapshot, all routes × viewports) → fills `PARITY_MATRIX.md`.
4. Classify each mismatch (Cosmetic / Behavioral / Security / Data), fix, repeat until green.

## Downstream cascade (this final wave)

- **L15 Canary** — needs a deployed canary env + real traffic → **BLOCKED** (`HR-LIQUID-CANARY-DEPLOY`).
- **L16 Flip** — needs **ARB sign-off** (`theme-governance-validator` pins the platform flip `deferred`) + L14/L15 green → **BLOCKED** (`HR-LIQUID-ARB-FLIP`).
- **L17 React decommission** — **constitutional** (ART-17 forbids deleting React before the hardening-wave data decision) + parity/canary green → **BLOCKED** (`HR-LIQUID-REACT-DECOMMISSION`).
- **L18 Certification** — depends on all above → cannot certify complete.

*Engine parity is real and green. The cross-engine comparison, canary, flip, and React deletion are deployment + human/constitutional gates, recorded as seams. No parity was faked.*

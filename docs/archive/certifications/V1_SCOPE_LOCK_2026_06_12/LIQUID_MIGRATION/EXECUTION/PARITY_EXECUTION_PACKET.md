# PARITY EXECUTION PACKET (L14)

**Date:** 2026-06-13 · **HEAD:** `77b681f1` · Repository truth. No fabricated parity/screenshots/metrics.

## What is already done (repo-side)
- **Engine-side parity VERIFIED** — Liquid renders correct structure/data/security for every customer-facing route (`PARITY_REPORT.md`; theme-engine render suites 56/56).
- **Bundle is current** — migration `172_liquid_bundle_refresh.sql` re-persisted the full 12-template bundle, so a canary store renders the whole funnel (not index-fallback). Was the top repo-side parity blocker; now eliminated.
- Harness present: `scripts/liquid-parity/{run-parity-matrix,capture-snapshot,compare-snapshots,harness-lib}.mjs`; Playwright installed.

## The ONLY remaining input (human/infra — `HR-LIQUID-PARITY-STAGING`)
A **deployed staging storefront running both engines**. The harness `requireEnv('STAGING_STOREFRONT_BASE_URL')` + `STAGING_TEST_SUBDOMAIN` and `fetchStorefrontPage(baseUrl,…)` need a live URL — not satisfiable in this sandbox (no `.next` build, no deployed storefront, no Liquid canary endpoint).

## Exact executable sequence (run when staging exists)
```bash
# 1. Apply migrations incl. 172 to the staging DB; flag a test store canary-on (see CANARY_EXECUTION_PACKET).
# 2. Point the harness at staging:
export STAGING_STOREFRONT_BASE_URL="https://<staging-storefront>"
export STAGING_TEST_SUBDOMAIN="<canary-store-subdomain>"
# 3. Capture + diff React vs Liquid across all routes × viewports:
node scripts/liquid-parity/run-parity-matrix.mjs
# -> writes LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/PARITY_MATRIX.md (currently 202 PENDING)
```
Routes to cover: home · product · collection · search · cart · account · orders · order(+tracking) · login/register · chrome.

## Remediation loop (Phase 2)
For each non-green cell, classify and fix **repo-side** then re-run:
| Class | Likely fix locus |
|---|---|
| Data | `composition-engine.tsx` drop population (collection title/desc, cart token, customer) |
| DOM/Visual | the section `body` in `theme-bundle.ts` + `LIQUID_THEME_BASE_CSS` in `theme-renderer.ts` |
| Behavior | `liquid-hydration-islands.tsx` (variant reprice, cart, search, wishlist) |
| Security | **must stay green** — DOMPurify forbid-list / `outputEscape` are not to be weakened |

**Exit:** every matrix cell green → L15. **No phase completion until parity is green** (not satisfiable in-sandbox).

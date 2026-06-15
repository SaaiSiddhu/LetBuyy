# Liquid Parity Report — Phase 6

> Mission Phase 6. **Status: NOT RUN — environment-bound.** No parity numbers are fabricated. This documents the harness, exact run requirements, and the statically-predicted outcome.

## Why it was not run here

The parity harness is a **live-HTTP** harness, not a standalone renderer:

- `run-parity-matrix.mjs:21-22` requires env `STAGING_STOREFRONT_BASE_URL`, `STAGING_TEST_SUBDOMAIN`, and `STAGING_LIQUID_SUBDOMAIN`.
- `harness-lib.mjs:80-93` `fetchStorefrontPage()` does `fetch(${baseUrl}/store/${subdomain})` — it needs a **running storefront** plus **two seeded stores**: one React-engine, one Liquid-canary (`liquidRenderingCanary = true`).
- It captures React + Liquid snapshots for 20 frozen sections × 2 viewports (`harness-lib.mjs:12-33`), then `compare-snapshots.mjs` structural-diffs them.

None of that infrastructure is available in this working session. Producing pass/fail here would be fabrication, which the mission forbids.

## How to run it (staging)

```bash
export STAGING_STOREFRONT_BASE_URL="https://<staging-storefront>"
export STAGING_TEST_SUBDOMAIN="<react-store-subdomain>"
export STAGING_LIQUID_SUBDOMAIN="<liquid-canary-store-subdomain>"   # store with liquidRenderingCanary=true
node scripts/liquid-parity/run-parity-matrix.mjs            # all 20 sections
# evidence → LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/
```

Seed the Liquid store by setting `liquidRenderingCanary` truthy in its release manifest / template config (Phase 7) — the bundle is already persisted (`migration 172`) and falls back to the in-code fixture.

## Predicted outcome per route (static, from Phases 2/4/5 — to be confirmed by a real run)

| Route | Predicted | Reason (evidence) |
|-------|-----------|-------------------|
| Homepage | ⚠️ **FAIL** | chrome double-render / full-doc injection (Phase 2 §3.1) |
| Product | ⚠️ **FAIL** | §3.1 + variant picker not emitted (Phase 5) |
| Collection | ⚠️ **FAIL** | §3.1 + collection title/description degraded to slug (Phase 4) |
| Cart | ⚠️ **N/A / FAIL** | no themed cart route (Phase 2); SSR cart empty (Phase 4); drawer toggle mis-placed (Phase 5) |

These are **predictions, not measurements.** A real run is required after the Phase 8 blockers are fixed.

## Gate

Per `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` (governance) and Document 6 §2 (`run-parity-matrix.mjs:87`), **any red cell blocks canary advancement.** Parity must be re-run green on staging before Phase 9 (canary rollout) may proceed.

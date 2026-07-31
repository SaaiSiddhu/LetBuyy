# Phase 1 — Launch Blocker Elimination — Summary

**Date:** 2026-06-19 · **Branch:** `stepup/main` · **Verdict: ✅ GO for Phase 2**

All five Phase-1 code blockers are resolved, tested, and type-clean. The work was far smaller than the audit implied because backend/schema scaffolding already existed for most blockers — the gaps were the "last mile" wiring, which is exactly what was closed.

## Status

| Blocker | Title | Verdict | Net work done |
|---|---|---|---|
| **LB-12** | Customer Registration | ✅ CLOSED | Wired bottom-sheet UI to the existing `register()` (new + passwordless → register; killed the `not_found` dead-end & token-less `setPassword`); 8-char min + Turnstile |
| **LB-8** | Announcement Bar | ✅ CLOSED | Added `core.announcement-bar` renderer + `components/layout/announcement-bar.tsx` reusing the existing schema — freeze-compliant (no new `components/sections/` file) |
| **LB-9** | Appearance Bridge | ✅ CLOSED | Added `site_settings` to the storefront SELECT constants + migration 187 (column). The map-bridge already existed |
| **LB-10** | Lifecycle Emails | ✅ CLOSED | Templates + PATCH dispatch already existed; **closed 2 real gaps** (`/refund/complete` + COD reject/timeout now email the customer) |
| **LB-7** | Shipping + GST | ✅ CLOSED | Re-certified 28/28; migration 170 already committed; cert evidence ready |

## Score / readiness delta
- **Code launch blockers: 5 → 0.** Phase-1 code readiness moves **83% → ~89–90%** (the audit's target band), the goal of this wave.
- Overall *launch* remains gated by the **9 human seams** (H1–H9: prod secrets, DNS wildcard, prod Supabase + migrations, Razorpay Route, Resend live, Turnstile live, legal) — none are code, all out of Phase-1 scope.

## Files changed (Phase 1 only)
**Modified (7):**
- `apps/storefront-runtime/src/components/account/account-bottom-sheet.tsx` (LB-12)
- `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` (LB-8)
- `services/api-gateway/src/routes/storefront.ts` (LB-9)
- `services/api-gateway/src/routes/orders.ts` (LB-10)
- `services/api-gateway/src/routes/order-risk.ts` (LB-10)
- `tests/launch/lb12-registration.test.mjs`, `tests/launch/lb10-dispatch.test.mjs` (coverage)

**New (4):**
- `apps/storefront-runtime/src/components/layout/announcement-bar.tsx` (LB-8)
- `database/supabase/migrations/187_v1_sites_site_settings.sql` (LB-9)
- `tests/launch/lb8-announcement-bar.test.mjs` (LB-8)
- `docs/v1-execution/phase-1/*` (this report set)

## Evidence (verified this wave)
```
Launch acceptance contracts:        156 / 156 pass   (node --test tests/launch/*.test.mjs)
  lb7-shipping-gst        28/28     lb10-order-emails  3/3
  lb8-announcement-bar     6/6      lb10-dispatch      6/6  (was 4 + 2 gap closures)
  lb9-appearance-bridge    3/3      lb12-registration 10/10 (was 5 + 5 UI tests)
Typecheck (tsc --noEmit):  api-gateway ✅   storefront-runtime ✅
Phase-1 governance:        anti-fabrication ✅  theme-governance ✅
                           no-new-react-sections ✅  migration-safety ✅
Theme-engine sweep:        31/32 (1 failure pre-dates HEAD — composition-engine.tsx, untouched)
```

## Remaining items (NOT Phase 1 — inherited WIP in this working tree)
The full governance gate cannot show all-green here because the tree is an in-progress lane carrying unrelated uncommitted work. Each is proven pre-existing in `07-governance-report.md`, with one-line remediations:
1. **tenant-isolation** — regenerate `tenant-tables.registry.ts` (stale only from WIP migrations 176/184/185).
2. **design-system** — resolve CSS drift in `marketing-site`/`identity-platform`/`merchant-control-plane` globals.css (or deliberate `--update` re-baseline).
3. **sequential-migration** — `git add` untracked migrations 186 (WIP) + 187 (Phase-1) when the migration set is committed.

## Commit posture
Phase-1 changes are **complete and validated in the working tree but not auto-committed**, because the tree carries extensive unrelated WIP and at least one Phase-1-touched file (`storefront.ts`) also had pre-existing uncommitted edits — a blanket `git add` would bundle WIP. Recommended scoped commit (after review):
```
git add apps/storefront-runtime/src/components/layout/announcement-bar.tsx \
        database/supabase/migrations/187_v1_sites_site_settings.sql \
        tests/launch/lb8-announcement-bar.test.mjs docs/v1-execution/
git add -p apps/storefront-runtime/src/components/account/account-bottom-sheet.tsx \
           apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx \
           services/api-gateway/src/routes/storefront.ts \
           services/api-gateway/src/routes/orders.ts \
           services/api-gateway/src/routes/order-risk.ts \
           tests/launch/lb12-registration.test.mjs tests/launch/lb10-dispatch.test.mjs
# LB-7 cert evidence (standalone, safe):
git add V1_SCOPE_LOCK_2026_06_12/LB7_CERTIFICATION.md
```

## Risk assessment
- **Low** — changes are last-mile wiring + best-effort notification side-effects; no money-logic, OAuth, or RLS change; HS256/ES256 issuer separation preserved; React-section freeze and canonical-ledger rules honored.
- LB-9 requires migration 187 applied to local/staging DBs before the SELECT change is exercised (else the `site_settings` column is absent). Prod already accepts the write.
- LB-10 live email send still depends on Resend (H6) — verification was render + dispatch-path only (honest boundary).

## Recommendation: **GO for Phase 2**
Phase-1 objectives are met with no regressions. The only blockers to a green full gate are inherited, non-Phase-1 WIP items (itemized above) that the lane owner should reconcile in parallel — they do not block Phase 2 scope.

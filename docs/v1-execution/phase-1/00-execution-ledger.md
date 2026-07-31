# Phase 1 — Launch Blocker Elimination — Execution Ledger

**Started:** 2026-06-19
**Branch:** `stepup/main`
**Goal:** Eliminate LB-7, LB-8, LB-9, LB-10, LB-12. Raise readiness 83% → 89–90%.

This ledger is the single source of truth for the execution wave. Updated as work lands.

---

## Verified state after reconnaissance (parallel recon agents + direct verification)

The audit (`docs/launch-readiness/15-launch-blockers.md`) over-stated several blockers. Recon
against current code + the `tests/launch/lb*.test.mjs` acceptance contracts establishes the
**actual** remaining work:

| Blocker | Audit claim | Verified actual state | Real work |
|---|---|---|---|
| **LB-12** Registration | "broken — setPassword w/o resetToken" | Backend (`/customer/register` gateway + proxy + context `register()`) **already implemented & tested**. Bug is **UI-only**: `account-bottom-sheet.tsx` routes new users to a dead-end `not_found` and passwordless users to the broken `set_password`. The context already exposes `register()`. | Wire bottom-sheet UI to `register()`; add regression assertions. **1 file + test.** |
| **LB-8** Announcement bar | "missing + governance-trapped; fold into header" | `announcementBar` **schema already exists** (theme-registry, in the 25 built-in types) + theme editor already renders it. Only the **storefront renderer entry is missing** → falls to `UnknownSectionFallback`. | Add `core.announcement-bar` renderer entry + a `components/layout/announcement-bar.tsx` component (mirrors header/footer — NOT in frozen `components/sections/`). **Governance-safe.** + test. |
| **LB-9** Appearance bridge | "writes w/o reads; +1 migration" | `mapSupabaseToStore` bridge **already written** (passes lb9 tests 2 & 3). Only gap: `site_settings` omitted from gateway SELECT constants (lb9 test 1 fails). `site_settings` is in **no migration / not in baseline** (max migration = 186). | Add `site_settings` to SELECT constants (storefront.ts) + migration **187** (so adding to SELECT doesn't break local dev). + type field. |
| **LB-10** Lifecycle emails | "missing order_cancelled/order_refunded templates" | Templates, `planEmailNotificationForEvent` mapping, `enqueueOrderLifecycleEmail` producer, PATCH-route dispatch, and worker allowlist **all already exist**. Both `lb10-*` launch tests' contracts are met. | **Verify** (run tests). Optionally close 2 real dispatch gaps (refund/complete + COD cancel) found by recon — evaluate risk first (money-path files). |
| **LB-7** Shipping + GST | "validated 28/28, uncommitted (index.lock)" | Migration `170` **already git-tracked**. Resolver, adapter, checkout routes, coupon guard, MCP routes/page all present. Only `V1_SCOPE_LOCK_2026_06_12/LB7_CERTIFICATION.md` is **untracked**. | **Verify** (run lb7 test = 28 assertions + migration validator) + **commit cert evidence** + regenerate cert report. |

---

## Governance constraints honored

- **`no-new-react-sections-validator`**: freezes exactly 20 `.tsx` under `apps/storefront-runtime/src/components/sections/`. LB-8 adds NO file there (uses `components/layout/` + a renderer entry, exactly like header/footer). ✅
- **`theme-governance-validator`**: pins 25 built-in section types / 20 frozen React sections / 20 Liquid-parity entries. LB-8 changes **none** of these counts (reuses the existing announcementBar schema). ✅
- **`theme-section-registry.test.ts`**: structural (no count/golden snapshot) — a new renderer entry is fine. ✅
- **Design-system ratchet**: `--lb-*` tokens only; merchant runtime colors via `style=` (same pattern as `dynamic-header.tsx`). LB-8 component will comply. ✅
- **Canonical-ledger-only**: LB-10 dispatch gaps (if closed) are best-effort notification side-effects (try/catch, no money mutation), mirroring the existing PATCH-route pattern. ✅
- **Two issuers never crossed**: LB-12 stays entirely in HS256 customer issuer (verified by lb12 test). ✅

---

## Execution status

| Stream | Blocker | Status | Result |
|---|---|---|---|
| A | LB-12 Registration | ✅ DONE | bottom-sheet wired to `register()`; lb12 **10/10**; storefront typecheck ✅ |
| B | LB-8 Announcement bar | ✅ DONE | renderer + `components/layout/announcement-bar.tsx`; lb8 **6/6**; freeze + theme-gov ✅ |
| C | LB-9 Appearance bridge | ✅ DONE | SELECT + migration 187; lb9 **3/3**; migration-safety ✅; gateway typecheck ✅ |
| D | LB-10 Lifecycle email | ✅ DONE | contract met + closed 2 dispatch gaps; lb10 **3/3 + 6/6** |
| E | LB-7 Shipping + GST | ✅ DONE | re-certified **28/28**; mig 170 already tracked; cert ready |
| F | Regression | ✅ DONE | **156/156** launch tests; 2 typechecks clean; 1 theme test pre-dates HEAD |
| G | Governance | ✅ DONE | Phase-1 validators all pass; 2 gate failures proven PRE-EXISTING (WIP) |
| H | Documentation | ✅ DONE | ledger + 8 reports in `docs/v1-execution/phase-1/` |

Legend: ⏳ TODO · 🟡 IN PROGRESS · ✅ DONE · 🔴 BLOCKED

## Final verdict: GO for Phase 2
All 5 Phase-1 code blockers eliminated. Code readiness 83% → ~89–90%. No regressions.
The full gate's only red signals (tenant-isolation registry staleness, design-system CSS drift,
untracked migration 186) are pre-existing WIP in this lane — not Phase 1. See `08-phase-1-summary.md`.

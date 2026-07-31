# 01 — Phase 4 Final State (frozen baseline)

**Date:** 2026-06-19 · **Branch:** `stepup/main` · **Scope:** Merchant Control Plane (`apps/merchant-control-plane` + its `services/api-gateway` routes). Captured before Phase 5. **No code changes were made in this lock** — validation found nothing requiring a fix inside Phase-4 scope.

## Deliverables verified present
- **Documentation:** 34 reports — `phase-4-completion/` (15), `phase-4-5-completion/` (6), `phase-4-75-final/` (13). All present.
- **Code:** every Phase-4.x page, proxy, middleware, and test exists (see `02`/`03`).

## Gate matrix (authoritative, re-run for the lock)
| Check | Result |
|---|---|
| merchant-control-plane `tsc --noEmit` | ✅ EXIT 0 |
| api-gateway `tsc --noEmit` | ✅ EXIT 0 |
| Launch suite (`tests/launch/*.test.mjs`) | ✅ **184/184** |
| Gateway unit suite | ⚠️ **313/316** — the 3 fails are PRE-EXISTING + unrelated to Phase-4 merchant work (AI-route mount, executive-analytics migration RLS, storefront payment-route ownership) |
| migration-safety-validator | ✅ PASS |
| production-safety-validator | ✅ PASS |
| frozen-path-override-gate | ✅ PASS |
| foundation-antifabrication-gate | ✅ PASS |
| canonical-ledger-only-validator | ✅ PASS |
| session-security-validator | ✅ PASS |
| tenant-isolation-validator | 🔴 PRE-EXISTING — `tenant-tables.registry.ts` drift (run `scripts/generators/generate-tenant-table-registry.mjs`); driven by parallel-workstream schema, NOT Phase-4 merchant code |
| validate-design-system | 🔴 PRE-EXISTING — cross-app CSS drift (marketing-site/identity/shared); Phase-4 app pages added **0** new drift (`tsxRawHex` 0) |

## Frozen readiness (from Phase 4.75 — no new work this lock)
Products 72 · Collections 62 · Inventory 40 · Orders 72 · Customers 62 · Discounts 85 · Analytics 72 · Domains 93 · Shipping 80 · Settings 84 · Staff 66 · Marketing 75 → **Merchant Control Plane ~72% UI / ~89% backend.**

## Integrity note
The order-detail background agent's process failed (orphaned on a parent-process exit) but its files had already flushed to disk; re-verified post-failure as complete + compiling + contract-tested (page 699 lines with a clean default export; proxy 47 lines). Certification rested on the files + the gate, not the agent's report — so the failure changed nothing. This is the verify-don't-trust principle holding under a real failure.

**State:** Phase-4 merchant scope is complete-to-its-documented-level, compiles, and is regression-clean with zero new governance drift. The two red validators are inherited, out-of-scope WIP (see `05-known-gaps.md`).

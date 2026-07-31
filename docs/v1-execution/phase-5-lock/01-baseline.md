# 01 — Phase 5 Final Baseline (frozen)

**Date:** 2026-06-19 · **Branch:** `stepup/main` · **Action:** freeze only, no feature work.

## Documentation (70 docs across 5 sub-phases)
`phase-5` (15) · `phase-5-5` (10) · `phase-5-75` (15) · `phase-5-final` (15) · `phase-5-complete` (15). All present.

## Frozen state
- **Backend completion ~95% · merchant exposure ~82%.**
- **9 commerce verticals live** (PO, transfers, inventory history/reservations/receipts/KPIs, vendors, warehouses, notifications, payment toggles, smart collections) + an operations dashboard.
- **3 decision engines** unit-tested (smart-collection 35 + automation 36 + audit-variance 26 = 97).
- **RBAC** across 30 commerce write handlers (dry-run-safe).
- **Staff invite-acceptance flow** — verified addition (page `/accept-invite` + public proxy → the existing gateway `POST /employees/auth/accept-invite`; compiles + contract-tested).

## Gate (re-run at lock)
- tenant-core / api-client / api-gateway / merchant-control-plane typecheck: **all EXIT 0**.
- Launch suite **205/205** · commerce contract **21/21** · evaluator cores **97/97**.
- canonical-ledger / anti-fabrication / production-safety / session-security: **PASS**.
- design-system / tenant-isolation: 🔴 PRE-EXISTING inherited cross-app/registry drift (0 new drift introduced across all of Phase 5).

## Not in the baseline (ARB/live-DB-gated, blueprinted)
Audit + automation **engine schema** (`inventory_count_sessions`, `automation_rules` + ledger-writing RPCs) — their **logic cores are built + tested**, but the schema is NOT shipped (needs migration + ARB + a live DB; shipping unverified ledger SQL would be fabrication).

**State:** Phase 5 is complete-to-its-verifiable-maximum, compiles, regression-clean (0 new drift), and ready to freeze.

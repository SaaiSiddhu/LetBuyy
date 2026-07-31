# 04 — Known Gaps (carried past the Phase 5 freeze)

All gaps are infra/ARB/live-DB-gated — **none is unwritten verifiable code**. Logic + design for each is in place.

## A. Net-new schema (migration + ARB + live DB)
1. **Inventory Audit Engine** — `inventory_count_sessions` / `inventory_count_lines` + `reconcile_count_session` RPC (writes the existing ledger). **Logic core built + unit-tested** (`inventory-audit-variance.ts`, 26 tests); schema blueprinted (`phase-5-complete/01`). The reconcile RPC writes the inventory ledger → ARB-required.
2. **Automation Engine** — `automation_rules` / `automation_executions` + the event-consumer wiring. **Logic core built + unit-tested** (`automation-rule-eval.ts`, 36 tests); execution blueprinted on the existing event/queue/notification backbone (`phase-5-complete/03`,`04`).

## B. Live-DB flow verification (staging stack)
Every vertical is compile/contract/unit-verified; runtime round-trips (create→ship→receive, analytics real values, smart-collection preview, invite token→auth-user) need a staging gateway + Supabase. Procedure: `phase-5-complete/11-live-stack-prep.md`.

## C. RBAC enforce
30 write handlers guarded in **dry-run**. Closing: set `MERCHANT_STAFF_RBAC_MODE=enforce` after live dry-run-log verification; + notifications/payment write guards (`settings:write`).

## D. Additive (no new schema, implementable)
Per-domain analytics dashboards + reservation/receipt detail views — additive real-aggregation endpoints + pages (the proven pattern).

## E. Inherited WIP (not Phase 5)
design-system cross-app CSS drift; tenant-isolation registry drift (run the generator). Both pre-date Phase 5; 0 new drift added.

**Verdict:** the gap list is small + precise; every item is gated on infrastructure (a database), human review (ARB for ledger schema), or an operator action (enforce flip) — not on code that could be written + verified here.

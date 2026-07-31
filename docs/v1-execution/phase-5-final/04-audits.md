# 04 — Inventory Audit Engine

**Status: NET-NEW SCHEMA → blueprint only (the single commerce subsystem that genuinely requires a migration). Per the mission: "If absent: create blueprint only. Never fabricate."**

## Backend reality (confirmed — truth map + 5.75 audit doc)
There is **no** `audit_sessions`/`cycle_count` table. What exists: `inventory_adjustments` (with `reason='recount'`) + `inventory_events` (`manual_adjusted`) + `inventory_levels`. So *ad-hoc recount adjustments* are already possible, but a structured count/audit session with variance + reconciliation is absent.

## Why not built
Building an "Audit Explorer / Variance View / Reconciliation View" requires `audit_sessions` + `audit_lines` tables. Authoring untested money/inventory-adjacent migrations and calling them done would be fabricated completion — and the repo's governance requires ARB review + a live DB for such schema. So this is a blueprint, consistent with every prior phase's discipline.

## Blueprint (reuse the existing ledger — no parallel system)
1. **Schema (new migration, ARB):** `inventory_count_sessions` (site_id, location_id, status open/counting/reconciling/closed, RLS GUC) + `inventory_count_lines` (session_id, product_id/variant_id, system_qty snapshot, counted_qty, variance computed, RLS). Idempotency + tenant GUC mirroring the existing inventory tables.
2. **RPC `reconcile_count_session(session_id)` (SECURITY DEFINER):** for each variance line, emit an `inventory_adjustments` row (reason='recount') + `inventory_events` — **reusing the existing ledger**, never a parallel stock system.
3. **Exposure:** api-client + proxies + UI (session list → counting screen → variance review → reconcile) — the standard verifiable pattern, after the migration lands.

**Verdict:** the audit engine is the one Phase-5 feature gated on a migration + ARB + live DB. Blueprinted precisely (reusing the existing adjustment/event ledger); not fabricated. It is the correct contents of the Phase-5 "freeze candidate" list rather than this wave.

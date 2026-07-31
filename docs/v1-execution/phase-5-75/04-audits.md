# 04 — Inventory Audit System

**Status: NET-NEW SCHEMA — blueprint only (not built; would require a migration + ARB + live DB).**

## What exists (reuse)
`inventory_adjustments` (with `reason='recount'`) + `inventory_events` (`manual_adjusted`) + `inventory_levels` already record stock + adjustments. So *individual* recount adjustments are already possible.

## What is ABSENT (and why not built)
A structured **audit/cycle-count system** — `audit_sessions` (a counting session over a location), `audit_lines` (counted vs system qty per SKU), variance detection, reconciliation-into-adjustment — has **no tables**. Per the mission's "no new schema without need / no fabrication", building an audit UI over non-existent `audit_sessions` would be fabricated. This is genuinely net-new schema.

## Blueprint (requires migration + ARB + live DB)
1. **Schema:** `inventory_count_sessions` (site_id, location_id, status: open/counting/reconciling/closed, RLS) + `inventory_count_lines` (session_id, product_id/variant_id, system_qty snapshot, counted_qty, variance, RLS). Idempotency + tenant GUC like the existing inventory tables.
2. **RPC:** `reconcile_count_session(session_id)` (SD) — for each line with variance, emit an `inventory_adjustments` row (reason='recount') + `inventory_events`, reusing the EXISTING ledger (no parallel system).
3. **UI:** session list → counting screen (scan/enter counts) → variance review → reconcile.

**Verdict:** the audit system is the one genuinely net-new-schema commerce feature; it must reuse the existing adjustment/event ledger on reconcile. Blueprinted, gated on a migration + ARB + live DB — not faked.

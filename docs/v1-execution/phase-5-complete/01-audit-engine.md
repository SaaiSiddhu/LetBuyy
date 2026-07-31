# 01 — Inventory Audit Engine

**Exposure: ~25%.** The audit **logic core is built + unit-tested**; the schema/RPC/UI is a precise blueprint gated on a migration + ARB + live DB (the one genuinely net-new-schema commerce engine).

## Built + verified this wave
- **`services/api-gateway/src/lib/inventory-audit-variance.ts`** (pure, no I/O): `computeVariance(systemQty, countedQty)` → `{ variance, direction: over|short|match }`; `reconcileSessionLines(lines)` → `AdjustmentDelta[]` (skips zero-variance, outputs deltas ready for the EXISTING `adjust_inventory_level` RPC, reason='recount'); `summarizeSession(lines)`. **26/26 unit tests pass.** This is the verifiable truth of the audit logic.

## Blueprint (proposed — NOT shipped; requires migration + ARB + live DB)
Authoring + certifying never-run inventory-ledger migrations would be fabrication, and the canonical-ledger/ARB governance requires human review. Proposed schema, reusing the existing ledger:
```sql
-- inventory_count_sessions: site_id, location_id, status (open|counting|reconciling|closed),
--   created_by, created_at; RLS GUC (store_id = current_site_id()); FORCE RLS.
-- inventory_count_lines: session_id, product_id, variant_id, system_qty (snapshot),
--   counted_qty, variance (generated), RLS via session join.
-- RPC reconcile_count_session(session_id) SECURITY DEFINER:
--   for each non-zero-variance line → call the EXISTING adjust path
--   (adjust_inventory_level / emit inventory_adjustments + inventory_events, reason='recount').
--   Idempotency-keyed; tenant GUC; NO parallel stock system.
```
The reconcile RPC writes the canonical inventory ledger → **must** go through ARB + live verification. The `reconcileSessionLines` core (built above) already produces the exact deltas this RPC would apply.

## Exposure path (after the migration)
api-client `audits.{sessions, lines, reconcile}` → proxies → UI (`02-audit-ui.md`). Standard verifiable pattern, post-migration.

**Verdict:** the audit *logic* (variance + reconciliation) is real + unit-tested; the persistence/RPC is the one Phase-5 item that genuinely needs a migration + ARB + a database — correctly blueprinted, not faked.

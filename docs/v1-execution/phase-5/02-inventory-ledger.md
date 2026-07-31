# 02 — Inventory Ledger

**Backend status: REAL (reuse, do not rebuild).** Phase-5 work = expose + surface, not build a ledger.

## What already exists (evidence)
- **Tables** (`000_baseline.sql` + `141_executable_inventory_reservations.sql`, all RLS/FORCE-RLS): `inventory_levels` (available/reserved/committed/on_hand/safety_stock/version), `inventory_reservations` (status lifecycle + idempotency keys + expiry), `inventory_adjustments` (quantity_change + reason), `inventory_events` (11 event types: sale_committed/released, po_ordered/received, transfer_*, return_restocked, manual_adjusted — the **journal/ledger**), `inventory_level_duplicate_snapshots` (reconciliation).
- **RPCs (SECURITY DEFINER):** `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `expire_inventory_reservations` (sweeper), `adjust_inventory_level`, `set_inventory_levels_available_batch`, `release_order_inventory_with_ledger` (emits `inventory_events`), `ensure_inventory_level_for_location`.
- **Gateway:** `/inventory/levels` (`?low_stock=`), `/adjust`, `/bulk-adjust`, `/history`, `/reserve`, `/commit`, `/release`; events → `outbox_events` via `emitInventoryEvent`.

## The real gap (exposure — verifiable)
- **Typed api-client:** only `inventory.levels()` + `adjust()`. Add `reserve`/`commit`/`release`/`history`/`bulkAdjust`.
- **Merchant UI:** view + adjust exist; **history/movements (the `inventory_events` journal), reservations, and an audit trail** are not surfaced. Build them as read views over `/inventory/history` + the events.
- **RBAC:** wire `products:write` (or a new `inventory:write`) on the adjust/reserve routes (dry-run-safe, same `assertStaffPermission` pattern).

## Implementation spec
api-client `inventory.{reserve,commit,release,history,bulkAdjust}` → merchant proxies `api/stores/[store]/inventory/{history,reserve,...}` → an inventory **History/Movements** tab + a **Reservations** view on the inventory page. All compile + contract verifiable; flow needs a live DB.

**Verdict:** the inventory ledger is **built and canonical** at the DB layer; Phase-5 delivers the typed client + the history/reservations UI. No new schema.

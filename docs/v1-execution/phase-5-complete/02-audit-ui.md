# 02 — Audit Operations UI

**Status: blueprint (gated behind `01`'s schema migration + ARB).** Not built — building a UI over non-existent `inventory_count_sessions` tables would be dead UI / fabrication.

## Spec (after the audit schema migration lands)
- **Audit Sessions** list (status, location, created) → `audits.sessions.list`.
- **Audit Detail / Counting screen** — per-line system_qty vs counted_qty entry (scan or manual) → `audits.lines`.
- **Variance Explorer** — lines with non-zero variance (the `computeVariance` core, already built + tested, classifies over/short/match).
- **Reconciliation View** — preview the `reconcileSessionLines` deltas (already-built core) → confirm → `reconcile_count_session` RPC.
- **Adjustment Timeline / Audit Reports** — reuse the existing `inventory_events` (manual_adjusted/recount) + the inventory-history view.

## Why not built
The UI consumes endpoints that consume tables that don't exist yet. The variance/reconcile **logic** it would display is already real + unit-tested (`01`); only the persistence + exposure layer is pending the migration.

**Verdict:** blueprinted to consume the built audit logic core; build it post-migration with visual verification on a live stack.

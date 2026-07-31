# 01 — Inventory Operations

**Exposure: ~55% → ~75%.** The inventory ledger is now surfaced to merchants (history/movements), on top of the existing real backend.

## Shipped this phase (verified)
- **Inventory History / Movements view** — new page `[store]/products/inventory-history/page.tsx` (451 lines) + proxy `api/stores/[store]/inventory/history/route.ts` (ownership-checked) over the existing `GET /inventory/history`. Movements table (reason badge, product name from join, quantity delta +/−, note, en-IN date), filter by product, pagination, loading/empty/error. **Nav-linked** (Products → Inventory history).
- **api-client exposure:** `inventory.{history,reserve,commit,release}` added (typed; `history` paginated).
- The gateway `/inventory/history` returns `inventory_adjustments` rows (the agent grounded in the real shape via a normalized `AdjustmentRow`, not a fabricated `inventory_events` assumption).

## Already real (prior)
view + adjust UI; `inventory_levels/reservations/adjustments/events` + the ledgered RPCs.

## Remaining (exposure)
- **Reservation viewer** — `reserve/commit/release` are exposed in the client, but there is **no `GET reservations` gateway route**, so an active-reservations list can't be built without a small additive gateway read endpoint (honest gap, not fabricated).
- A dedicated audit view + movement filters beyond product. RBAC (`inventory:write`) on adjust/reserve — follow-up.

**Verdict:** the ledger is now visible to merchants (movements/history); reservations-list needs one additive gateway read route. No new schema.

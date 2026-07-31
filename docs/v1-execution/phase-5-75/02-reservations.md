# 02 — Reservation Operations

**Backend (actions) REAL; a reservation EXPLORER needs one additive read endpoint that does not yet exist.**

## Real
- RPCs `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `expire_inventory_reservations` (SD, idempotent). Gateway `POST /inventory/{reserve,commit,release}`. api-client `inventory.{reserve,commit,release}` (exposed Phase 5.5). The `inventory_reservations` table has the full status lifecycle. Reservation EVENTS appear in the movements view (`inventory-history`, shipped).

## NOT built (missing read endpoint)
- A **Reservation Dashboard / Explorer / Timeline** needs to LIST reservations — but there is **no `GET /inventory/reservations` route** (only the action POSTs). Building an explorer would require either a new gateway read endpoint or a direct table read (which the merchant app must not do — proxies only). So a reservation list is not buildable without the additive endpoint.

## Implementation spec
Add `GET /inventory/reservations?store_id=&status=&product_id=` (reads `inventory_reservations` with RLS) → api-client `inventory.reservations.list` → proxy → an explorer/timeline UI. Additive read route over the existing table (no new schema), + a live DB to verify.

**Verdict:** reservation actions are real + the create/commit/release flow is exposed; a reservation *explorer* is gated on one additive gateway read endpoint — specced, not faked.

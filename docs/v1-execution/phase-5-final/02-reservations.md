# 02 — Reservation Operations

**Exposure: ~40% → ~80% — SHIPPED.** The reservation explorer now exposes the existing reservation backend.

## Shipped this wave (verified)
- **Additive gateway read:** `GET /inventory/reservations?store_id=&status=&product_id=` (queries `inventory_reservations` joined `products!inner(store_id)`, ownership-checked, paginated, missing-table → empty). Additive read over the existing table — no new schema.
- **api-client:** `inventory.reservations.list(query)` → `PaginatedResult<InventoryReservation>`.
- **Proxy:** `inventory/reservations` (ownership-checked).
- **UI:** `[store]/products/reservations/page.tsx` (411 lines) — reservation explorer (status/product/qty/expires), filters, pagination. **Nav-linked** (Products → Reservations). 0 fabrication, token-clean.
- Reservation actions (reserve/commit/release) were already exposed (Phase 5.5); reservation EVENTS already appear in inventory-history.

## Verification
3 typechecks EXIT 0 · contract test (GET endpoint + api-client + proxy + page) PASS · launch 200/200.

## Remaining
A reservation timeline/detail view (the explorer lists; per-reservation event timeline is a follow-up). RBAC: reads (no write guard needed).

**Verdict:** the reservation backend is now fully explorable by merchants (list + filters) over an additive real read endpoint. No new schema.

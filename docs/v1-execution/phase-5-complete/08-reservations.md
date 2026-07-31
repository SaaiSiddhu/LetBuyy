# 08 — Reservation Expansion

**Exposure: ~82%.** The reservation explorer + actions are shipped; deeper detail/timeline is a thin follow-up over the existing endpoint.

## Shipped (Phase 5.9, verified)
- `GET /inventory/reservations` (additive read over `inventory_reservations`, ownership-checked, paginated, missing-table→empty) + api-client `inventory.reservations.list` + proxy + explorer page (status/product/qty/expires filters). Nav-linked.
- Reservation actions (reserve/commit/release) exposed in Phase 5.5; reservation events visible in inventory-history.

## Remaining (additive, over the existing data)
- **Reservation detail / timeline** — a per-reservation view (the row data + its events from `inventory_events`); client-side or a `GET /inventory/reservations/:id`.
- **Reservation analytics** — counts by status / expiring-soon; an additive aggregation in the `commerce-analytics` pattern (`06`).
- Search by order_id — client-side filter or a query param (the endpoint already accepts `status`/`product_id`).

**Verdict:** the reservation backend is fully explorable (list + filters + actions); detail/timeline/analytics are additive follow-ups over the existing data — no new schema.

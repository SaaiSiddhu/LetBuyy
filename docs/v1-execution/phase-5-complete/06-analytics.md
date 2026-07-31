# 06 — Analytics Aggregation

**Exposure: ~60% → ~80% — SHIPPED. Real aggregation only; zero fabricated metrics.**

## Shipped this wave (verified)
New gateway route `services/api-gateway/src/routes/commerce-analytics.ts` (registered at `/commerce-analytics`), 4 ownership-checked endpoints — **every number is a real query over existing tables, omitted/zero on missing-table (`isMissingTableError`/`isMissingColumnError`), never fabricated**:
- `GET /supplier-metrics` — per-supplier PO count + total value + **on-time rate** (`received_at <= expected_at`) + avg lead time (real join `purchase_orders` × `purchase_order_receipts` × `suppliers`).
- `GET /warehouse-metrics` — per-location SKU count + total units (group `inventory_levels` by `location_id` × `inventory_locations`).
- `GET /transfer-metrics` — counts by status + in-transit (`inventory_transfers`).
- `GET /operations-summary` — consolidated open-orders/POs/transfers + low-stock + total products.
Plus the Phase-5.9 `GET /inventory/analytics` (low_stock/total_skus/po_by_status/transfer_by_status).

api-client `commerceAnalytics.{supplierMetrics,warehouseMetrics,transferMetrics,operationsSummary}` + 4 proxies.

## Honesty contract
This is the line held since Phase 5.75: analytics is fabrication ONLY if numbers are invented. These are **real aggregation queries** — genuine zeros on an empty DB, real values once data exists. The supplier on-time rate is computed from real `expected_at` vs `received_at`, not guessed.

## Remaining
Reservation/receiving-specific KPIs + time-series trends (additive endpoints, same pattern). Each is a real query over existing tables.

**Verdict:** a real, multi-domain analytics layer (supplier/warehouse/transfer/operations) now exists — computed, not fabricated. No new schema.

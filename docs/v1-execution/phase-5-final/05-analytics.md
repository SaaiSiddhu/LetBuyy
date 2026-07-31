# 05 — Analytics Foundation

**Exposure: ~0% → ~60% — SHIPPED (real aggregation only; zero fabricated metrics).** This directly resolves the Phase-5.75 honesty gap: the metrics endpoint now EXISTS and computes from real tables.

## Shipped this wave (verified)
- **Additive gateway aggregation:** `GET /inventory/analytics?store_id=` returns **only real computed metrics**:
  - `low_stock_count` — `COUNT(*)` from `inventory_levels WHERE available <= 10` (joined to owned store products).
  - `total_skus` — `COUNT(*)` from `products WHERE store_id IN (owned) AND deleted_at IS NULL`.
  - `po_by_status` — `purchase_orders.status` grouped.
  - `transfer_by_status` — `inventory_transfers.status` grouped.
  Each metric is **OMITTED if its table is missing** (`isMissingTableError` fallback) — never fabricated.
- **api-client:** `inventory.analytics(query)` → `InventoryAnalyticsResult`.
- **Proxy + UI:** `inventory/analytics` proxy + a **KPI banner** (4 cards) on the inventory-history page consuming it.

## Honesty contract
This is the line the mission drew ("build only real analytics, no fabricated metrics"): the numbers are **real aggregation queries over real tables** — they show genuine zeros on an empty DB and real counts once data exists. No invented figures.

## Remaining (additive, same pattern)
Deeper metrics need more aggregation endpoints (avg PO lead time / on-time rate from `expected_at` vs `received_at`; per-location stock value; transfer fulfillment time) → `06-dashboards.md`. Each is a real query over existing tables — additive, no new schema.

**Verdict:** a real analytics foundation exists (inventory + PO + transfer counts, low-stock) — computed, not fabricated. Deeper metric endpoints are the additive follow-up.

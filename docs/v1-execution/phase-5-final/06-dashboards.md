# 06 — Commerce Dashboards

**Exposure: ~50% — KPI foundation shipped; full per-domain dashboards are additive follow-ups.**

## Shipped this wave (verified)
- **Inventory KPI banner** on the inventory-history page — 4 cards (low-stock count, total SKUs, PO-by-status, transfer-by-status) over the real `/inventory/analytics` endpoint (`05`). Real data, empty when zero, never fabricated.

## Remaining (additive, real-query, no new schema — NOT fabricated)
Full per-domain dashboards (Operations / Inventory / Warehouse / Supplier / Transfer) need additional **real aggregation endpoints** (the `05` pattern extended): e.g.
- Warehouse: per-location SKU/unit counts (group `inventory_levels` by `location_id`).
- Supplier: PO count + total value + on-time rate (from `expected_at` vs `received_at`) per supplier.
- Transfer: avg ship→receive duration, in-transit count.
Each is a real query over existing tables → additive endpoint + a dashboard page. They were not built this wave to keep the build verifiable + bounded, but they are genuinely implementable (no new schema, no fabrication) — the recommended next analytics increment.

## Why bounded
Building 5 dashboard suites + their aggregation endpoints exceeds a single verifiable wave; the KPI foundation + the real-aggregation pattern (`05`) is shipped, and the remaining dashboards follow it exactly.

**Verdict:** the KPI foundation is real + shipped; full dashboards are additive real-aggregation endpoints + pages (specced, no new schema), the natural next analytics step.

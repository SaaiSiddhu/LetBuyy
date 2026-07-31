# 07 — Commerce Dashboards

**Exposure: ~50% → ~75% — SHIPPED.** An operations dashboard now consumes the real analytics layer.

## Shipped this wave (verified)
`apps/merchant-control-plane/src/app/[store]/products/operations-dashboard/page.tsx` (466 lines, 0 raw hex/px, 0 fabrication) — consumes the `commerce-analytics` endpoints (`06`):
- **Operations snapshot** — 8 KPI cards (open orders/POs/transfers, low-stock, total products, …) from `operations-summary`.
- **Supplier performance** table — PO count/value/on-time/lead-time per supplier.
- **Warehouse & location inventory** table — SKU count + total units per location.
- **Transfer pipeline** — KPI cards + status breakdown.
Independent loading/empty/error per section; genuine zeros on empty DB; `—` where a value can't be computed (e.g. on-time with no receipts). **Nav-linked** (Products → Operations dashboard).

## Remaining
Per-domain dedicated dashboards (Inventory/Supplier/Warehouse/Transfer/Receiving as separate pages) + time-series charts — additive, consuming the same/extended real endpoints. The consolidated operations dashboard covers the core now.

**Verdict:** a real commerce operations dashboard is shipped over the real analytics layer; per-domain dashboards + trends are additive follow-ups (no new schema, no fabrication).

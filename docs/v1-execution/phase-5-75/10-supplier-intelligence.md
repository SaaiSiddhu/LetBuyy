# 10 — Supplier Intelligence

**Operational vendors REAL + shipped (Phase 5.5); "metrics/performance/reliability" need aggregation that does not exist.**

## Real + shipped
Vendor management UI (list/create) over `suppliers` (Phase 5.5). Suppliers are selectable on POs (PO create form, Phase 5).

## NOT built (would be fabricated metrics)
**Supplier metrics / performance / reliability / activity / analytics** (on-time-receipt rate, avg lead time, total PO value, fill rate) need aggregation over `purchase_orders` + `purchase_order_receipts` joined to `suppliers` — the gateway exposes **no supplier-analytics endpoint**. "Reliability" (on-time %) specifically requires comparing `expected_at` vs `received_at` across POs — computable, but only via a new aggregation endpoint, not invented in the UI.

## Implementation spec
Add `GET /inventory/suppliers/:id/metrics` (aggregates PO + receipt history for the supplier: PO count, total value, on-time rate from expected_at vs received_at, avg lead time) → api-client → a supplier detail/metrics view. Additive read endpoint over existing tables (no new schema) + live DB to verify. A supplier-linked PO list is also buildable once a supplier-filtered PO read exists.

**Verdict:** vendor management is real + wired into POs; supplier *intelligence* needs an additive analytics endpoint (real data, real formula) — specced, not faked.

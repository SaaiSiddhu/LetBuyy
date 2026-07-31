# 03 — Receiving Operations

**Receive ACTIONS are REAL + shipped; a receiving DASHBOARD/history needs an additive read endpoint.**

## Real + shipped
- **Receive against PO** — shipped in the PO vertical (Phase 5): `ReceivePOModal` (per-line received qty, idempotency-keyed) → `POST /inventory/purchase-orders/:id/receive` → `receive_purchase_order` (SD, partial receipts supported via `quantity_received`/status).
- **Receive transfer** — shipped in the transfers vertical (Phase 5.5): `ReceiveTransferModal` → `POST /inventory/transfers/:id/receive`.
- `purchase_order_receipts` + `inventory_transfer_receipts` tables (idempotency-keyed, RLS) record every receipt; `inventory_events` emits po_received/transfer_received.

## NOT built (missing read endpoint)
- A **Receiving Dashboard / Receipt History / Timeline** needs to LIST receipts — there is **no `GET` route for `purchase_order_receipts`/`inventory_transfer_receipts`**. Building a history view would require an additive read endpoint (merchant app must use proxies, not direct table reads).

## Implementation spec
Add `GET /inventory/receipts?store_id=&po_id=|transfer_id=` (reads the receipt tables with RLS) → api-client → proxy → a receipt-history/timeline UI. Additive read route (no new schema) + live DB to verify.

**Verdict:** receiving (partial + idempotent + ledgered) works on PO + transfer details today; a receipt-history dashboard is gated on one additive read endpoint — specced, not faked.

# 06 — Receiving

**Backend status: REAL** (part of the PO + transfer engines).

## What already exists
- **PO receiving:** `purchase_order_receipts` table (idempotency-keyed per site, RLS); RPCs `receive_purchase_order(po, lines)` + `receive_purchase_order_line(...)` (SD) — update `inventory_levels`, insert receipts, emit `inventory_events` (po_received). Gateway `POST /inventory/purchase-orders/:id/receive`.
- **Transfer receiving:** `inventory_transfer_receipts` (idempotency-keyed, RLS); RPC `receive_inventory_transfer(_line)` (SD) — debit source / credit destination, emit `inventory_events` (transfer_received). Gateway `POST /inventory/transfers/:id/receive`.

Receiving is **idempotent + ledgered** at the DB layer (the hard, money-adjacent part is done correctly).

## The real gap (exposure — verifiable)
- **Receiving UI:** a per-line "received quantity" form on the PO detail and the transfer detail, calling the existing receive endpoints. Partial receiving is supported by the schema (`quantity_received` per line, `partially_received` status).
- The PO receiving UI ships in the **Purchase Orders vertical** this phase (`05`); transfer receiving UI ships with **Transfers** (`07`).

## Implementation spec
Surface receiving as an action on the PO/transfer detail views → `inventory.purchaseOrders.receive(id, lines)` / `inventory.transfers.receive(id, lines)` → existing proxies → existing RPCs. Compile + contract verifiable; the idempotency + ledger correctness is already DB-enforced.

**Verdict:** receiving is real and idempotent at the backend; Phase-5 delivers the receiving UI on PO + transfer details. No new schema.

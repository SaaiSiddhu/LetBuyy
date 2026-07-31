# 09 — Receipt Expansion

**Exposure: ~85%.** Receipt history + receive actions shipped; detail/analytics are additive follow-ups.

## Shipped (Phase 5/5.5/5.9, verified)
- `GET /inventory/receipts` (additive read over `purchase_order_receipts` + `inventory_transfer_receipts`, ownership-checked, paginated, missing-table→empty) + api-client `inventory.receipts.list` + proxy + receipt-history page. Nav-linked.
- Receive ACTIONS (PO receive partial/full, transfer receive) shipped on the PO + transfer detail flows; receipts are idempotency-keyed + ledgered (`inventory_events`).

## Remaining (additive)
- **Receipt detail / timeline** — per-receipt view (line + linked PO/transfer + the `inventory_events` it produced).
- **Receiving analytics** — receipts over time, avg receive lead time — additive aggregation (`06` pattern, using the supplier on-time/lead-time logic already shipped).
- Search/filter by PO/transfer — the endpoint already accepts `po_id`/`transfer_id`.

**Verdict:** receiving (idempotent + ledgered) has a full history view + actions; detail/analytics are additive follow-ups over the existing data — no new schema.

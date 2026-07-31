# 03 — Receipt History

**Exposure: ~70% → ~85% — SHIPPED.** Receipt history now exposes the existing receiving records.

## Shipped this wave (verified)
- **Additive gateway read:** `GET /inventory/receipts?store_id=&po_id=&transfer_id=` (queries `purchase_order_receipts` joined `purchase_orders!inner(site_id)` + `inventory_transfer_receipts` joined `inventory_transfers!inner(site_id)`, ownership-checked, paginated, missing-table → empty). Additive read — no new schema.
- **api-client:** `inventory.receipts.list(query)` → `PaginatedResult<InventoryReceipt>`.
- **Proxy:** `inventory/receipts` (ownership-checked).
- **UI:** `[store]/products/receipts/page.tsx` (374 lines) — receipt history (PO/transfer link, quantity_received, date), filters. **Nav-linked** (Products → Receipts). 0 fabrication, token-clean.
- Receive ACTIONS (PO receive, transfer receive) were already shipped (Phase 5/5.5) on the PO + transfer detail flows.

## Verification
3 typechecks EXIT 0 · contract test (GET endpoint + api-client + proxy + page) PASS · launch 200/200.

## Remaining
A per-receipt detail/timeline view; receiving analytics (counts/throughput) is part of the analytics endpoint (`05`).

**Verdict:** receiving (partial + idempotent + ledgered) now has a full history view over an additive real read endpoint. No new schema.

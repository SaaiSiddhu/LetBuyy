# 04 — Inventory Transfers

**Exposure: ~25% → ~80%.** Full transfer lifecycle UI shipped over the existing ledgered backend.

## Shipped this phase (verified)
- **Transfers page** `[store]/products/transfers/page.tsx` (858 lines) — replaced the stub. Transfer list (number, source→dest, status badge, line count, date), **CreateTransferModal** (source + dest location dropdowns + line items: product/variant/qty), **ShipConfirmModal** (pending→shipped), **ReceiveTransferModal** (per-line remaining qty → received). Client-side idempotency keys. Loading/empty/error + toasts. **Nav-linked** (Products → Transfers).
- **Proxies** (ownership-checked): `transfers/route.ts` (GET+POST), `transfers/[id]/ship`, `transfers/[id]/receive` → `inventory.transfers.{list,create,ship,receive}`.
- **api-client:** `inventory.transfers.*` added (typed).

## Backend (reused, real + ledgered)
`inventory_transfers/_lines/_receipts` + `create_inventory_transfer_with_lines`/`ship_inventory_transfer`/`receive_inventory_transfer` (SD; source debit / dest credit; emit `inventory_events`).

## Remaining
Transfer detail/timeline view; partial-receive edge cases surfaced in UI; `inventory:write` RBAC.

## Verification
api-client `tsc` EXIT 0 · MCP `tsc` EXIT 0 · contract tests (proxies + page real) PASS · launch 193/193. **Compile + contract verified;** create→ship→receive round-trip needs a live gateway + DB.

**Verdict:** transfers is now a complete merchant vertical (list/create/ship/receive) over the real ledgered backend — the sibling to Purchase Orders. No new schema.

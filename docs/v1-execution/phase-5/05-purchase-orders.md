# 05 — Purchase Orders (SHIPPED this phase — the proof vertical)

**Status: backend REAL + merchant vertical now BUILT end-to-end (compile + contract verified).** This converts the long-standing PO stub into a working feature over the existing backend.

## Backend (pre-existing, reused — no new schema)
`purchase_orders/_lines/_receipts` tables (RLS) + `create_purchase_order_with_lines`, `receive_purchase_order`, `receive_purchase_order_line` (SECURITY DEFINER, idempotent, emit `inventory_events`) + gateway `/inventory/purchase-orders` (+ `/:id/receive`), `/inventory/suppliers`, `/inventory/locations`.

## Built this phase (verified)
- **api-client** (`@letbuyy/api-client`): typed `inventory.purchaseOrders.{list,create,receive}` + `inventory.suppliers.{list,create}` + `inventory.locations.{list,create}` with request/response types aligned to the gateway's Zod schemas (`CreatePurchaseOrderSchema`, `ReceivePurchaseOrderSchema`, …). `tsc` EXIT 0.
- **Proxies** (ownership-checked via `resolveOwnedStoreId`): `purchase-orders` (GET+POST), `purchase-orders/[id]/receive` (POST), `suppliers` (GET+POST), `inventory-locations` (GET+POST).
- **UI** (`products/purchase-orders/page.tsx`, 723 lines — replaced the stub): PO list (number/supplier/location/status/line-count/total/dates), **CreatePOModal** (supplier + location + dynamic line items: product→variant→qty→unit cost + estimated total), **ReceivePOModal** (per-line received qty, idempotency-keyed). `@letbuyy/ui` + `--lb-*` tokens only (no raw hex/px), loading/empty/error states, INR + en-IN dates, mobile-first.

## Verification
api-client `tsc` EXIT 0 · merchant-control-plane `tsc` EXIT 0 · `lb-phase5-commerce` contract tests **4/4** (api-client exposure, ownership-checked proxies, real page no-stub, no direct table writes) · launch suite **188/188** · anti-fabrication + canonical-ledger PASS (UI writes nothing directly — all via RPCs through the gateway).

## Honest boundary
**Compile + contract verified.** **Flow-verification needs a live gateway (:9010) + migrated Supabase** — the create→receive→inventory-level-update round-trip has not been run here. No fabrication: real endpoints, real RPCs, real types; visual/runtime correctness is the live-stack step.

**Verdict:** Purchase Orders is the proof that Phase-5 is a verifiable exposure build — shipped + verified to the compile/contract boundary. The remaining verticals (transfers, inventory history, warehouses, vendors UI) follow this identical, proven pattern.

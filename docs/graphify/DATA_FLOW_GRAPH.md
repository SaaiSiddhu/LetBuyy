# Phase 4 — Data Flow Graph

**Flows traced through graph `calls`/`imports`/`references` edges + code-verified handlers (file:line). Where a hop crosses into SQL, the graph goes dark (SQL ungraphed) and the migration is cited as authority.**

## Customer → Checkout → Payment → Order → Refund → Ledger
```
checkout-client.tsx ──fetch /api/orders──▶ storefront-runtime/app/api/orders/route.ts
   └▶ [HTTP] api-gateway storefront/checkout-payment-routes.ts:251  (server-authoritative totals)
        ├─ shipping-rate-resolver.ts  ── p_shipping_rate_id ──▶ create_checkout_order (SQL, mig 170)
        ├─ checkout-core GST calc (793–828) ──▶ p_tax_amount
        └─ create_checkout_order ──▶ orders + outbox_events  [SQL — ungraphed]
   Razorpay verify (617–661: sig+replay+amount) ──▶ confirmPayment ──▶ emitStorefrontOrderPaidEvent
   refund: payments.ts:462–667 (step-up→provider→postPaymentLedger) ──▶ ledger_entries [SQL]
```
**Graph note:** the TS hops are edges in the graph; the `create_checkout_order`/`postPaymentLedger`/ledger hops terminate in SQL RPCs that are **not** nodes (only 2 DB nodes total), so the money tail of this flow is invisible to Graphify and must be read from migrations 139/160/170. **Defect on this path:** `app/api/orders/route.ts:48–57` drops `shippingRateId` (cert finding).

## Merchant → Product → Inventory → Storefront
```
merchant-control-plane/products ──createMerchantApiClient (deg 187)──▶ api-gateway products routes
   └▶ ProductExecutionAdapter (ownership re-derived) ──▶ products/inventory tables [SQL]
storefront-runtime ──ISR/KV──▶ api-gateway storefront.ts (route node deg 124) ──▶ published catalog
```
Inventory reservation is a `FOR UPDATE` RPC (SQL) — ungraphed; truth in migrations.

## Gift Card → Issue → Redeem → Refund
```
merchant gift-cards UI ──▶ api-gateway gift-cards.ts ──▶ issue_gift_card (mig 173) ─▶ gift_card_accounts + ledger
checkout ──▶ create_checkout_order (mig 170) ─▶ gift_card_redemptions + ledger (same SHA-256 code_hash)
refund ──▶ restore_gift_card_on_refund
```
All three hops are SQL RPCs → **the entire gift-card flow is ungraphed** (giftcard keyword finds 99 *TS* nodes — the route/handler wrappers — but not the RPCs). Graph cannot certify this flow; migrations 170/173 do (split-brain fixed, redeemable).

## What the graph *can* trace end-to-end
TS/Dart symbol flows: `createMerchantApiClient → merchantApiErrorResponse → shared-types`, `resolveOwnedStoreId → verifySiteOwnership`, `Button()/UI → 184 consumers`. The application/control-plane data flow is fully graphed; the **money/data-persistence tail is not** (SQL boundary). This asymmetry is the central data-flow takeaway: Graphify maps how the *app* moves data up to the DB call, then the migrations own the rest.

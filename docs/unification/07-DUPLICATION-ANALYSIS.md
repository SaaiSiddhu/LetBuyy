# 07 — Duplication Analysis

For each domain implemented more than once: what each implementation does well and badly, the canonical choice, and how the others are folded in. Decisions: **KEEP** · **MERGE** · **REWRITE** · **MIGRATE** (data or UI moves onto the canonical) · **DEPRECATE**. Comparison axes: completeness, UI quality, backend design, security, scalability, maintainability, data model, tests, production readiness.

## 1. Products / catalogue

| | S1 canonical | S2 Firestore | S3 AgriMore |
|---|---|---|---|
| Advantages | tenant-scoped, variants with SKU/barcode, HSN, collections, metafields, media, import, channel listings + moderation; tests and validators | rich seller/product UI already shipped; attributes per category | `brands`, `unit_label`, `mrp` vs sale price, search documents, global catalogue identity |
| Disadvantages | no brand table, no SKU/barcode uniqueness, one price, `products.stock` cache duplication | document model, denormalised counters, no tenancy boundary in the DB, security rules with open reads | store-scoped listing layer designed but absent |
| Verdict | **KEEP** as canonical Product; add `brands`, uniqueness, and the Listing/Offer layers | **MIGRATE** data already largely done for reads (FB-2); remaining writes move at cutover; **DEPRECATE** Firestore products | **MERGE** the useful fields (brand, mrp, unit) into S1 schema; **DEPRECATE** tables |

## 2. Cart

| | S1 | S2 | S3 |
|---|---|---|---|
| Advantages | site-scoped carts with cart token, buyer identity, discount codes, checkout-url handoff | complete cart UX on mobile, web, desktop with coupon selection | cart bound to one store; quote step reserves stock with expiry |
| Disadvantages | Ecommerce only; no location binding | Firestore + local state, no server pricing | skeleton UI |
| Verdict | **KEEP** backend for the Ecommerce basket; **MERGE** S3's store binding + quote into a new Quick basket | **KEEP UI / REPLACE DATA** | **MERGE** semantics, **DEPRECATE** code |

## 3. Checkout and payment

| | S1 | S2 | S3 |
|---|---|---|---|
| Advantages | server totals, GST, coupons, gift card/loyalty tender, advisory-locked idempotency, parent purchase, Razorpay order bound to `orders.total`, HMAC verify with stored order id and replay check, webhook raw-body HMAC + dedupe, refunds, COD reconciliation, ledger | mature checkout UX incl. saved cards, VPA validation, COD | quote → intent → confirm with reservation consumed at confirm; webhook path |
| Disadvantages | verify path does not read provider capture state; refund `created` treated as done; late payment after stock release unguarded; hosted checkout callers unverified | client writes the order after payment success; callable verification; no ledger | signature check conditional; header-trust hop |
| Verdict | **KEEP** and repair the three defects | **KEEP UI / REPLACE DATA**; saved-card and VPA UX only if the founder wants them (new backend) | **MERGE** the quote object for Quick; **DEPRECATE** functions |

## 4. Orders and fulfilment

| | S1 | S2 | S3 |
|---|---|---|---|
| Advantages | full merchant workflow (fulfil, labels, packing slips, returns, refunds, risk, drafts), snapshots and tax lines, status vocabularies with DB checks | order history/detail/tracking/returns screens | explicit Quick lifecycle enum, order status events, versioned transitions, store-ops handlers, dispatch |
| Disadvantages | no Quick lifecycle, no dispatch | Firestore orders, status strings | skeleton beyond SQL |
| Verdict | **KEEP** the Order domain; **MERGE** S3's Quick state machine and store-ops transitions as a second fulfilment flow ([14](./14-ORDER-FULFILMENT-ARCHITECTURE.md)) | **KEEP UI / REPLACE DATA**; live-map tracking **REWRITE** | **MERGE** design, **DEPRECATE** code |

## 5. Inventory

| | S1 | S2 | S3 |
|---|---|---|---|
| Advantages | levels with available/reserved/committed/unavailable/incoming/safety, TTL reservations, transfers with partial receipt, purchase orders, adjustments, event log; race and idempotency **proven** | none | append-only `stock_movements` with reason codes, `CHECK reserved ≤ on_hand`, safety stock; per-store availability read |
| Disadvantages | single-owner locations, no custody, in-transit only implicit, `products.stock` cache | Firestore counters | sequential tests only, no transfers |
| Verdict | **KEEP** as the one Inventory authority; extend with node kinds, custody and reason codes | **DEPRECATE**; migrate stock numbers at cutover if sellers keep selling | **MERGE** reason-code discipline; **DEPRECATE** code |

## 6. Customer profile, addresses, wishlist, notifications

| | S1 | S2 | S3 |
|---|---|---|---|
| Advantages | buyer realm, per-store customer records, wishlists, buyer inbox, DSR export | complete profile UX, address book with Google Maps picker, notifications with FCM, wishlists, loyalty screens | geo addresses, device push tokens |
| Disadvantages | no platform address book, no coordinates, email-only buyers | Firestore user docs, UID coupling | skeleton |
| Verdict | **KEEP** backend; add platform address book with coordinates and phone OTP | **KEEP UI / REPLACE DATA**; this is the UX to preserve | **MERGE** address storage shape; **DEPRECATE** |

## 7. Seller / merchant identity and onboarding

S1 identity-platform + onboarding is canonical (**KEEP**). S2 seller auth, store deployment, domain mapping, subscriptions and wallet were **DEPRECATED** by owner decision on 2026-09-04 (retired list in `decisions.md` §2a). S3 seller onboarding and seller app: **DEPRECATE**; its `store_operator`/`rider` roles inform the membership model.

## 8. Payments money model: commission, wallet, payouts

| | S1 | S2 | S3 |
|---|---|---|---|
| Model | 0% commission (constitutional), double-entry ledger, record-only payouts, no custody | category/tier commission + ₹20/order fee, mutable seller wallet, weekly/auto payouts | 3–4% commission designed, customer wallet with locks, `balance_after` ledger |
| Verdict | **KEEP** the ledger; the founder now wants per-channel fees and product-based commission, which reverses D-1 and reopens custody (D-2). The **calculation ideas** in S2 (`commissionService.ts`) and S3 (effective-dated rate rules) inform the design; none of the code is reused. Payout execution stays record-only until the custody decision is made. |

## 9. Notifications

S1 queue-workers (Resend, Twilio WhatsApp, FCM/APNs dispatcher) + buyer inbox: **KEEP**. S2 Cloud Functions: **DEPRECATE**, but **FCM remains the mobile push transport** (tokens re-registered against the buyer principal). S3 `send-notification`: **DEPRECATE**.

## 10. Search

S1 Postgres FTS: **KEEP for now**; S2 Firestore search + trending + visual/voice UI: **KEEP UI / REPLACE DATA**; S3 Typesense sync: **DEPRECATE** code, keep as the candidate provider when location-aware ranking outgrows FTS.

## 11. Realtime

S1 none; S2 Firestore listeners (12); S3 Durable Object + WebSocket + Redis. Verdict: **build in S1 using S3's pattern** (a Durable Object per delivery/order room with ephemeral presence in KV or Redis; Postgres remains the authority). Firestore listeners are replaced by push + polling for Ecommerce and by the realtime channel for Quick tracking.

## 12. Storefront builder

Only S1 has one. S2's `deployStore`/`serveStore` is retired. **KEEP**.

## 13. Admin / operations

S1 `admin_web` (22 pages, prod login broken) vs S2 admin functions (retired) vs S3 admin skeleton. **KEEP S1 screens**, **REWRITE the login** as an operator realm, and add zones, nodes, partners, riders, live operations. Whether the console lives in `admin_web` or as an operator mode inside `merchant_web` is a founder decision (stated preference 2026-09-19: no separate admin apps).

## 14. Serviceability, zones, dark stores, dispatch, riders, store ops

Only S3 has them. Verdict: **MIGRATE the design and schema shapes into S1** (zones with polygons, node with point/radius/hours/capacity, deliveries, offers with expiry, versioned transitions, presence/live location), **REWRITE** the resolver (overlap list + choice + explanation), **KEEP UI / REPLACE DATA** for `rider_app` and `store_ops_app`, **DEPRECATE** S3 Workers and Edge Functions.

## 15. Design systems

`@letbuyy/ui` + `packages/dart/ui_kit` (S1, token-governed), `marketplace_ui_kit` (S2, the polished shopper components), `agrimore_design_system` (S3). Verdict: one token source, role-level themes; **MERGE** `marketplace_ui_kit` components into the unified customer app's kit; **DEPRECATE** `agrimore_design_system` after lifting its Store Ops and Rider patterns.

## 16. Summary table

| Domain | Canonical | Others |
|---|---|---|
| Identity | S1 identity-platform | S2 Firebase Auth MIGRATE users; S3 DEPRECATE |
| Merchant / tenant | S1 `sites` + memberships | S2 sellers MIGRATE; S3 DEPRECATE |
| Catalog | S1 | S2 MIGRATE; S3 MERGE fields |
| Listing | S1 `channel_listings` + new offers | — |
| Inventory | S1 | S3 MERGE reason codes |
| Cart | S1 (+ Quick basket) | S2 UI KEEP; S3 MERGE quote |
| Order | S1 (+ Quick flow) | S2 UI KEEP; S3 MERGE state machine |
| Payment / ledger | S1 | S2/S3 DEPRECATE |
| Notification | S1 (+ FCM transport) | S2/S3 DEPRECATE |
| Search | S1 FTS | S3 Typesense candidate |
| Realtime | new in S1 | S3 pattern |
| Fulfilment / delivery | new in S1 | S3 schema + UI |
| Storefront | S1 | — |
| Operations | S1 screens, new login | S3 concepts |

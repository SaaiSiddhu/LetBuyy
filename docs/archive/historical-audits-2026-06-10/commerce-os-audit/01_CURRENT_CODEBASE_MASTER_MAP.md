# 01 Current Codebase Master Map

## Executive Summary

LetBuyy is a multi-tenant commerce and site-builder platform centered on `sites` as the database ownership entity and `store` as the merchant-facing term. The runtime is split across Next.js consumer/admin apps, Cloudflare Hono workers, Supabase Postgres/Auth/Storage, a Flutter builder surface, and shared TypeScript/Dart packages. The codebase has recently added important enterprise primitives: worker-side `/v1` APIs, Zod request schemas, store ownership checks, inventory-level tables, atomic order creation RPCs, payment webhook persistence, an outbox table, audit activity events, theme releases, customer accounts, and review moderation.

The system is still short of a Shopify-grade commerce operating system. Most critical commerce flows exist as thin CRUD or single-step RPCs rather than durable domain engines. The strongest path is checkout order creation via `create_order_with_inventory_reservations`, but cart persistence, coupon redemption, gift-card redemption, shipping/tax calculation, fulfillment, refund/return, purchase orders, inventory transfers, outbox dispatch, subscriptions enforcement, and observability are either partial, placeholder, or not connected to the transaction boundary.

Scores:

| Dimension | Score | Rationale |
|---|---:|---|
| Production readiness | 43/100 | Real auth, rate limiting, worker routing, payment signatures and RLS exist, but observability, queues, CSRF parity, rollback workflows, DR, and CI gates are incomplete. |
| Scalability | 38/100 | Supabase schema has useful indexes and inventory locks, but no event consumers, no search/indexing service, no read model strategy, no sharding/partitioning plan, and broad service-role runtime access. |
| SaaS maturity | 41/100 | Tenant ownership checks and plans exist, but quotas, usage metering, billing enforcement, enterprise RBAC, audit visibility, admin operations and app lifecycle are shallow. |

## Deep Analysis

### Repository Runtime Map

```
Browser / Mobile
  |
  |-- apps/web/consumer/accounts          -> merchant auth, signup, OTP, onboarding, store selection
  |-- apps/web/consumer/admin             -> merchant dashboard, CRUD surfaces, theme editor proxy routes
  |-- apps/web/consumer/storefront        -> public storefront, cart, checkout, customer account, policy pages
  |-- apps/web/consumer/landing           -> marketing/pricing
  |-- apps/web/consumer/app-store         -> app catalog/developer submission
  |-- apps/web/consumer/theme-marketplace -> theme catalog, purchase/install flow
  |-- apps/web/administrative/console     -> super-admin scaffold
  |-- apps/web/administrative/team        -> support/team scaffold
  |
  |-- apps/flutter/builder                -> native builder/dashboard/editor surfaces
  |-- apps/flutter/super_admin            -> native super-admin scaffold
  |-- apps/flutter/team                   -> native team scaffold
  |
Cloudflare Worker API
  |
  |-- backend/workers/api/src/index.ts    -> Hono /v1, auth, CORS, rate limits, route mount
  |-- backend/workers/webhooks/src/index.ts -> Razorpay/Stripe webhook worker
  |
Supabase
  |
  |-- backend/supabase/migrations         -> core tables, commerce schema, RLS, RPCs
  |-- Storage/Auth/PostgREST
```

### Application Map

| Surface | Primary responsibility | Source-backed status |
|---|---|---|
| Accounts | Merchant auth and onboarding | `apps/web/consumer/accounts/AGENTS.md` lists lookup, login, signup, OTP, reset, store select and onboarding routes. Auth ownership is correct but split with worker auth routes. |
| Admin | Merchant dashboard | `apps/web/consumer/admin/src/components/Sidebar.tsx` exposes Orders, Products, Collections, Inventory, Purchase orders, Transfers, Gift cards, Customers, Reviews, Discounts, Analytics, Online Store. Several child pages are placeholders. |
| Storefront | Public tenant rendering and checkout | `apps/web/consumer/storefront/src/app/store/[subdomain]/*` and `/api/*` proxy public checkout/customer/payment flows to the worker. Cart remains `localStorage` based in `src/context/cart-context.tsx`. |
| API worker | Canonical commerce API | `backend/workers/api/src/index.ts` mounts public `auth`, `contacts`, `storefront`, `themes`, `app-store` and protected admin/commerce routes under `/v1`. |
| Webhooks worker | Provider webhook ingestion | `backend/workers/webhooks/src/index.ts` verifies Razorpay/Stripe signatures, writes `payment_webhook_events`, updates orders/subscriptions. It duplicates some order inventory logic that newer RPCs centralize. |
| Console/team | Platform operations scaffolds | Route scaffolds exist, but production-grade allowlists, MFA workflows, escalation policies, activity drill-down and operational tooling are not complete. |
| Flutter builder | Native builder/editor | Models/services packages exist, but commerce-critical canonical behavior is in the Hono worker and Supabase, not Flutter services. |

### Package Map

| Package | Role | Audit note |
|---|---|---|
| `packages/typescript/api-types` | Shared domain and API types | Defines `Store`, `Product`, `InventoryLevel`, `Order`, `DomainOutboxEvent`, `AuditActivityEvent`. Good extraction point, but `dist/*` is generated output and should not be source of truth. |
| `packages/typescript/ui` | Shared UI primitives | Small Button/Input/DataTable package. Admin still uses app-local classes and Material Symbols in many places. |
| `packages/typescript/utils` | Shared Supabase/API/auth helpers | Useful but not yet a strong cross-app platform SDK. |
| `packages/dart/models/services/ui_kit/core` | Flutter domain/UI support | Broad commerce models exist, including order/return/loyalty concepts that are not fully represented in web runtime. |

## Architecture Diagram

```
Accounts app
   |  signs lb_session / internal session
   v
Admin Next proxy routes ----signed internal request----> Hono /v1 protected routes
   |                                                    |
   | resolves /[store] to sites.id                      | service-role Supabase client
   v                                                    v
Merchant UI                                      Supabase Postgres

Storefront pages
   |-- localStorage cart
   |-- /api/orders proxy
   |-- /api/payments/{razorpay,stripe,paypal}
   v
Hono /v1/storefront public routes ----RPC----> create_order_with_inventory_reservations
                                            -> attach_order_payment_reference
                                            -> confirm_order_payment
                                            -> record_order_payment_failure

Provider webhooks
   v
backend/workers/webhooks ----REST service role----> payment_webhook_events + orders
```

## Dependency Maps

### Runtime Dependency Graph

```
admin route handlers
  -> apps/web/consumer/admin/src/lib/api/worker-client.ts
  -> backend/workers/api protected /v1 routes
  -> getSupabaseAdmin(c)
  -> services + RPCs + tables

storefront checkout
  -> localStorage lb_cart
  -> /api/orders
  -> workerFetch('/storefront/:subdomain/orders')
  -> OrderService.createOrder()
  -> RPC create_order_with_inventory_reservations()

payments
  -> storefront Next provider route
  -> worker internal/public payment routes
  -> PaymentService
  -> RPC attach/confirm/failure
  -> payment_webhook_events

themes
  -> admin/theme-marketplace routes
  -> ThemeService
  -> theme_editor_drafts + theme_releases + store_themes + theme_purchases
```

### Critical Modules

| Module | Why critical | Current risk |
|---|---|---|
| `backend/workers/api/src/services/order.service.ts` | Main commerce transaction boundary | RPC path is strong; fallback path is non-transactional and decrements products sequentially. |
| `backend/supabase/migrations/032_inventory_reservations_order_commit.sql` | Atomic order and inventory lock implementation | It commits reservations immediately, not a timed checkout hold; coupons/shipping/tax/gift cards are excluded. |
| `backend/supabase/migrations/033_payment_state_machine.sql` | Payment reference and confirmation | Good idempotent event storage; does not create `payment_transactions`. |
| `backend/workers/api/src/routes/storefront.ts` | Public store resolution, checkout, customer, reviews | Large multi-domain route module; many actions bypass Zod and return raw DB messages. |
| `backend/workers/api/src/services/product.service.ts` | Product/options/variant persistence | Multi-table writes are not transactional; admin currently sends product options but no generated variant rows. |
| `backend/workers/api/src/routes/inventory.ts` | Locations, levels, adjustments | Inventory levels exist, but no reservations UI, no transfers/receiving/PO flows, bulk adjust is sequential. |
| `backend/workers/webhooks/src/index.ts` | Provider webhook state sync | Duplicates inventory fallback logic and uses direct PostgREST instead of shared service/RPC uniformly. |
| `backend/workers/api/src/services/event.service.ts` | Outbox and audit emission | Emits events, but no dispatcher/consumer/cron/queue implementation was found. |

## Entity Maps

```
sites
  -> products
      -> product_options
      -> product_variants
      -> collection_products -> collections
      -> inventory_levels -> inventory_locations
      -> inventory_adjustments
      -> product_reviews
  -> orders
      -> order_items
      -> inventory_reservations
      -> payment_webhook_events via last_payment_event_id / provider refs
      -> customer_addresses through customer_email/store_id
  -> coupons
  -> gift_cards
  -> store_customers
      -> customer_wishlists
      -> customer_activity_log
      -> customer_addresses
  -> shipping_zones -> shipping_rates
  -> tax_rates
  -> pages/blog/media/forms/themes
```

## Commerce Lifecycle Overview

1. Merchant creates store in Accounts/onboarding and `sites`.
2. Merchant creates products in Admin via Next proxy to `/v1/products`.
3. ProductService writes `products`, `product_options`, `product_variants`, then inventory RPCs.
4. Storefront resolves `/:subdomain` against published `sites`.
5. Shopper adds products to `lb_cart` in browser `localStorage`.
6. Checkout creates a worker order with product IDs/variant IDs/quantities only.
7. RPC locks inventory, inserts order/order_items/reservations/adjustments and emits outbox/audit rows.
8. Payment provider routes attach a reference and confirm/fail payment.
9. Admin moves order status with `/v1/orders/:id` state transition helpers.
10. Fulfillment is currently status/tracking mutation, not a shipment/fulfillment-order engine.

## State Machines

### Current Order State

```
pending -> confirmed -> processing -> shipped -> delivered -> refunded
   |          |             |          |
   v          v             v          v
cancelled  cancelled     cancelled  cancelled
```

Source: `backend/workers/api/src/schemas/order.schema.ts` `VALID_TRANSITIONS`, used by `OrderService.transitionStatus`.

Issues:

- No `on_hold`, `partially_fulfilled`, `return_requested`, `return_in_progress`, `partially_refunded`, `disputed`, `failed_payment_review`, `fraud_review`, or `closed` state.
- Optional `version` exists in schemas but is not enforced in `OrderService.transitionStatus`.
- Fulfillment and payment are compressed into order status instead of separate state machines.

### Current Payment State

```
pending -> paid
pending -> failed -> cancelled
paid    -> refunded
```

Source: `033_payment_state_machine.sql`, `035_payment_failure_state.sql`, `PaymentService`.

Issues:

- No authorization/capture split.
- No partial capture/refund ledger.
- No provider transaction ledger despite `payment_transactions` migration.

## Gap Analysis

### Dead or Orphaned Modules

| Area | Evidence | Impact |
|---|---|---|
| Purchase orders | Admin placeholder `apps/web/consumer/admin/src/app/[store]/products/purchase-orders/page.tsx`; no `purchase_orders` tables/routes found. | Incoming inventory cannot be planned, received, costed, or reconciled. |
| Inventory transfers | Admin placeholder `products/transfers/page.tsx`; no transfer table/route found. | Multi-location balancing exists only as manual adjustments. |
| Persistent carts | `carts` table exists in migration `027_missing_tables.sql`, but storefront cart uses `localStorage` in `src/context/cart-context.tsx`. | Abandoned cart, cross-device cart, server-side validation and cart-level discounting are missing. |
| Gift card redemption | `gift_cards` table and admin issue UI exist; no checkout redemption or ledger found. | Gift cards are issuance-only, not a payment instrument. |
| Returns/refunds | `return_requests` and `payment_transactions` exist in migration `023_customer_system.sql`; no worker route found. | RMA is policy text plus basic order cancellation/refund status, not an engine. |
| Outbox dispatch | `outbox_events` and `EventService` exist; no consumer/queue/cron found. | Events are written but not operationally delivered. |
| Legacy/generated output | `backend/workers/api/dist/*` and `packages/typescript/api-types/dist/*` are tracked/generated. | Drift risk and noisy reviews. |
| Legacy API helper | `apps/web/consumer/admin/src/lib/api.ts` is a bearer-token style client while newer proxy uses `src/lib/api/worker-client.ts`. | Confusing ownership and possible stale path. |

### Circular Dependencies

No direct TypeScript import cycle was exhaustively proven without running a graph analyzer. Manual inspection shows a more important runtime cycle:

```
storefront Next payment route -> worker internal payment route -> payment RPC -> webhooks worker may also mutate same order
```

This is not an import cycle; it is a state ownership cycle. The same order payment state can be mutated by public verify routes and webhooks. Idempotent provider event IDs reduce damage, but the ownership boundary should be explicit: provider webhooks should be canonical for final settlement; client verify routes should confirm only where provider guarantees synchronous verification.

### Tech Debt Hotspots

- Broad service-role access in worker routes with app-level ownership checks.
- Raw DB error messages in several route responses, e.g. product/coupon/review/storefront routes.
- Multiple non-standard timestamp trigger function names exist in migrations, including `update_updated_at_column()`.
- `console.*` remains in worker and frontend sources, especially checkout and webhook processing.
- Inline styles are pervasive in admin pages and placeholders.
- Admin still uses Material Symbols despite web icon governance requiring Lucide React.
- Analytics route reads `customers` table, while current customer system uses `store_customers` and order-derived customers.

## Scaling Blockers

| Blocker | Current implementation | Required direction |
|---|---|---|
| No durable event workers | `outbox_events` is inserted but not consumed. | Cloudflare Queue/Durable Object/cron outbox dispatcher with retries, DLQ, idempotent consumers. |
| Search/filtering | Product/customer/admin lists use PostgREST filters and client search. | Store-scoped search index with async projections and saved views. |
| Cart transaction boundary | Browser `localStorage` cart and demo coupons. | Server cart with price/tax/shipping/promotion snapshot and validation before order commit. |
| Inventory reservations | Order commit deducts immediately. | Timed reservation/hold lifecycle, expiration sweeper, stock allocation service. |
| Fulfillment | Tracking number/status update. | Fulfillment orders, shipments, allocations, labels, carrier events, partial fulfillment. |
| Admin data volume | Simple tables, no virtualization, no saved filters. | Cursor pagination, virtualized tables, saved views, bulk actions and background jobs. |
| Tenant metering | Plans exist; no hard quota enforcement seen at write boundaries. | Entitlement middleware and usage counters for products/orders/media/themes/API calls. |

## Shopify Comparison

Shopify-level systems separate inventory states, order payment status, fulfillment status, return status, app extensions, Functions, webhooks, Admin API and Storefront API. LetBuyy has early equivalents but compressed domain models:

- Shopify inventory differentiates on hand, available, committed, unavailable and incoming. LetBuyy has `available`, `reserved`, `incoming`, `on_hand`, but checkout deducts `available` immediately and does not model draft holds or unavailable reasons.
- Shopify orders are a hub across customer, payments, fulfillments, discounts, returns, events and source app. LetBuyy has `orders`, `order_items`, payment refs and audit/outbox, but no order event timeline UI, shipment objects, return engine or payment transaction ledger.
- Shopify extensions/functions provide app-safe backend customization. LetBuyy app store/theme marketplace exist, but app install side effects, scopes, permissions, webhooks and extension points are not mature.

## Enterprise Recommendations

1. Make the worker/RPC layer the only commerce write authority; remove direct alternate payment/order mutation paths.
2. Introduce domain services for Cart, Pricing, Promotion, GiftCard, Fulfillment, Return, InventoryReservation, PurchaseOrder and Transfer.
3. Implement outbox dispatch before adding more side effects.
4. Move webhook logic to shared RPC/service calls; stop duplicating inventory mutations in the webhooks worker.
5. Add store-scoped entitlement middleware for quotas and billing enforcement.
6. Build operational read models and saved views for high-volume admin surfaces.
7. Introduce `payment_transactions`, `gift_card_transactions`, `promotion_redemptions`, `fulfillment_orders`, `shipments`, `return_requests` APIs and ledgers.
8. Create a formal state-machine layer with version checks and transition audit events.

## Implementation Recommendations

Immediate:

- Connect `payment_transactions` to `confirm_order_payment` and provider webhooks.
- Add `promotion_redemptions` and compute coupon discounts inside `create_order_with_inventory_reservations`.
- Remove/demo-gate storefront cart hardcoded coupons.
- Add a queue/cron consumer for `outbox_events`.
- Implement missing purchase-order and transfer tables before enabling admin buttons.

Near-term:

- Refactor `storefront.ts` into route modules by domain.
- Replace service fallback order creation with a hard failure once migrations are required.
- Add browser tests for checkout/order/payment happy paths and cancellation paths.
- Add migration verification for non-standard triggers and duplicate migration prefixes.

## Production Readiness Score

43/100. The API worker and schema contain meaningful production intent, but the system lacks durable event processing, centralized logs/metrics/tracing, end-to-end payment/order reconciliation, and full rollback handling.

## Scalability Score

38/100. Multi-location inventory tables and partial indexes are a start. Scalability is blocked by no queue workers, serverless route modules doing too much, no search/indexing service, and admin list patterns that will degrade at high volume.

## SaaS Maturity Score

41/100. Tenant isolation is a first-class governance rule and often enforced. Enterprise SaaS maturity still needs role/permission depth, plan enforcement, usage metering, audit visibility, custom domains hardening, incident tooling, and app extension governance.

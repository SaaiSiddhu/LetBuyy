# End-to-End Transactional Workflows

## Executive Summary

This document traces the major LetBuyy commerce workflows from admin or storefront entry point through API route, service/RPC, database tables, state transitions, side effects, and failure modes. The analysis is based on the current codebase, especially:

- `backend/workers/api/src/index.ts`
- `backend/workers/api/src/routes/*.ts`
- `backend/workers/api/src/services/*.ts`
- `backend/workers/api/src/schemas/*.ts`
- `backend/supabase/migrations/*.sql`
- `apps/web/consumer/admin/src/app/[store]/**`
- `apps/web/consumer/admin/src/app/api/stores/[store]/**`
- `apps/web/consumer/storefront/src/app/store/[subdomain]/**`
- `apps/web/consumer/storefront/src/app/api/**`
- `backend/workers/webhooks/src/index.ts`

The highest-risk pattern is that several workflows have a visible UI entry point before the durable commerce model exists. Purchase orders and transfers appear in admin navigation but do not have real backend engines. Coupons and gift cards have partial CRUD but not transactional ledgers. Orders and inventory have a stronger core, but payment, fulfillment, tax, shipping, discount, return, and analytics are not fully composed into one consistent state machine.

## Architecture Diagram

```text
Merchant Admin UI
  -> Next API proxy
    -> signed internal Hono worker /v1
      -> route
        -> service
          -> Supabase tables/RPC
          -> audit/outbox best effort

Storefront UI
  -> Next API route
    -> Hono public storefront routes
      -> OrderService / PaymentService / CustomerService
        -> Supabase tables/RPC

Payment providers
  -> Cloudflare webhooks worker or storefront Next webhook
    -> provider signature verification
      -> payment_webhook_events
      -> order payment state RPC/update
```

## Global Runtime Entry Points

### Worker Mounts

`backend/workers/api/src/index.ts` mounts public routes before auth:

- `/v1/auth`
- `/v1/contacts`
- `/v1/storefront`
- `/v1/themes`
- `/v1/app-store`

Then protected routes under global auth/rate limit:

- `/v1/admin`
- `/v1/ai`
- `/v1/analytics`
- `/v1/app-store`
- `/v1/auth`
- `/v1/blog`
- `/v1/categories`
- `/v1/contacts`
- `/v1/coupons`
- `/v1/customers`
- `/v1/employee`
- `/v1/export`
- `/v1/inventory`
- `/v1/media`
- `/v1/notifications`
- `/v1/onboarding`
- `/v1/orders`
- `/v1/payments`
- `/v1/portfolio`
- `/v1/products`
- `/v1/resume`
- `/v1/reviews`
- `/v1/shipping-tax`
- `/v1/storefront`
- `/v1/stores`
- `/v1/themes`
- `/v1/upload`

### Admin Proxy Pattern

Admin pages call local Next route handlers under:

```text
apps/web/consumer/admin/src/app/api/stores/[store]/*
```

Those handlers resolve store ownership and forward to the worker with signed internal session headers using:

```text
apps/web/consumer/admin/src/lib/api/worker-client.ts
apps/web/consumer/admin/src/lib/resolve-owned-store.ts
```

### Storefront Proxy Pattern

Storefront pages call local Next handlers, especially:

```text
apps/web/consumer/storefront/src/app/api/orders/route.ts
apps/web/consumer/storefront/src/app/api/coupons/validate/route.ts
apps/web/consumer/storefront/src/app/api/razorpay/*
apps/web/consumer/storefront/src/app/api/stripe/*
apps/web/consumer/storefront/src/app/api/paypal/*
```

Those handlers forward to public or signed worker routes.

## State Machine Overview

### Current Order Status State Machine

Defined in `backend/workers/api/src/schemas/order.schema.ts`:

```text
pending
  -> confirmed
  -> cancelled

confirmed
  -> processing
  -> cancelled

processing
  -> shipped
  -> cancelled

shipped
  -> delivered
  -> cancelled

delivered
  -> refunded

cancelled terminal
refunded terminal
```

### Current Payment Status Shape

Payment status is distributed across:

- `orders.payment_status`
- provider reference fields from `030_theme_editor_and_payment_events.sql`
- `payment_webhook_events`
- `payment_transactions` from `023_customer_system.sql`, not consistently wired
- provider-specific Next routes and webhooks

Current observed values include pending/paid/failed/refunded.

### Current Inventory Reservation Shape

From `032_inventory_reservations_order_commit.sql`:

```text
inventory_reservations.status:
  committed
  released
```

There is no cart/draft temporary hold state and no expiration workflow.

## Workflow 1: Product Creation

### Entry Points

- Admin UI: `apps/web/consumer/admin/src/app/[store]/products/new/page.tsx`
- Admin proxy: `apps/web/consumer/admin/src/app/api/stores/[store]/products/route.ts`
- Worker route: `POST /v1/products` in `backend/workers/api/src/routes/products.ts`
- Service: `ProductService.createProduct` in `backend/workers/api/src/services/product.service.ts`
- Schema: `CreateProductSchema` in `backend/workers/api/src/schemas/product.schema.ts`

### Steps

1. Merchant opens the product form.
2. UI builds payload with title, description, category text, price, compare-at price, stock, status, SEO fields, media, and option fields.
3. Next proxy resolves the store handle/id to a site using `resolve-owned-store.ts`.
4. Proxy forwards payload to worker `/products` with signed internal session.
5. Worker validates payload with Zod.
6. `ProductService.createProduct` verifies site ownership using `sites`.
7. Service inserts `products`.
8. Service replaces product options.
9. Service replaces product variants.
10. Service sets inventory available through `setInventoryAvailable` RPC for the product/variant.
11. Response returns product.

### Tables

- `sites`
- `products`
- `product_options`
- `product_variants`
- `inventory_locations`
- `inventory_levels`
- `inventory_adjustments` depending on RPC behavior

### State Transitions

```text
draft/admin form -> products row inserted -> options/variants replaced -> inventory mirror updated
```

### Failure Points

- Product insert can succeed while options, variants, or inventory update fail.
- `variants: []` is currently submitted by admin UI, so variant modeling is underused.
- Collection assignment is not part of product creation.
- Media handling is not one canonical asset workflow.
- Slug uniqueness must be enforced per site; service generates slug but collisions need hard constraints.
- No product publish workflow; status updates are direct field changes.

### Missing Enterprise Controls

- Product workflow transaction.
- Product versioning and publish/revert.
- Variant inventory item linkage.
- Bulk product import jobs.
- Validation for category vs collection vs product type.
- Audit event required for create/update/delete.

## Workflow 2: Product Variant Creation

### Entry Points

- Product create/update payload through `ProductService`.
- Schema support in `product.schema.ts`.
- `product_variants` table from `010_products_section.sql`.

### Steps

1. Admin form can collect options, but current product page does not generate full variant matrix.
2. Worker route accepts variants in schema.
3. Service deletes/replaces existing variants for product update.
4. Service inserts variant rows.
5. Inventory availability is set for variants when provided.

### Tables

- `product_options`
- `product_variants`
- `inventory_levels`
- `inventory_adjustments`
- `products` stock mirror

### Risks

- Delete/replace variant updates can break order history references if not carefully constrained.
- Variant SKU uniqueness is not consistently modeled as a per-site invariant.
- Admin UI does not expose serious variant management.
- Variant price/stock is not the canonical storefront path in all flows.

### Recommended State Machine

```text
draft variant -> active variant -> archived variant
                    |
                    -> unavailable due to inventory policy
```

## Workflow 3: Collection Assignment

### Entry Points

- Admin proxy: `/api/stores/[store]/collections`
- Worker route: `/v1/products/collections`
- Tables: `collections`, `collection_products`

### Current Flow

1. Merchant can list/create collections.
2. Worker can create/list collections.
3. Collection-product mapping table exists.
4. Product creation page does not assign products to collections.

### Missing

- Add/remove product to collection UI.
- Smart collection evaluator.
- Collection sort order management at scale.
- Materialized storefront collection index.
- Collection publish visibility controls.

## Workflow 4: Inventory Updates

### Entry Points

- Worker route: `backend/workers/api/src/routes/inventory.ts`
- RPC: `adjust_inventory_level` from `034_inventory_level_runtime.sql`
- Admin page: `apps/web/consumer/admin/src/app/[store]/products/inventory/page.tsx`
- Admin proxy: `/api/stores/[store]/inventory/levels`

### Current Steps

1. Admin inventory page lists levels.
2. Worker `GET /inventory/levels` returns product/variant/location inventory.
3. Worker `POST /inventory/adjust` validates adjustment and calls RPC.
4. Worker `POST /inventory/bulk-adjust` loops through adjustments sequentially.
5. RPC updates levels and mirrors product/variant stock.
6. Adjustment history can be queried.

### Tables

- `inventory_locations`
- `inventory_levels`
- `inventory_adjustments`
- `products`
- `product_variants`

### Risks

- Bulk adjustment is not a single job with durable status.
- No admin adjustment UI in current inventory page.
- No receiving/transfer integration.
- No safety stock/unavailable/incoming fields.
- No approval workflow for material adjustments.

## Workflow 5: Purchase Order Creation

### Entry Points

- Admin sidebar: `Products > Purchase orders`
- Admin page: `apps/web/consumer/admin/src/app/[store]/products/purchase-orders/page.tsx`

### Current Flow

The current purchase order workflow is UI placeholder only. There is no durable purchase order schema, route module, service, or receiving workflow identified in the current worker/migrations.

### Missing Tables

- `suppliers`
- `purchase_orders`
- `purchase_order_lines`
- `purchase_order_receipts`
- `purchase_order_receipt_lines`
- `inventory_receiving_adjustments`

### Required State Machine

```text
draft -> ordered -> partially_received -> received -> closed
   \         \              \                 \
    -> cancelled            -> cancelled       -> adjusted
```

### Critical Risk

Admin navigation suggests functionality that does not exist. Merchants can see the workflow label but cannot operate procurement.

## Workflow 6: Inventory Receiving

### Current Flow

No real receiving workflow was found. Incoming inventory is not represented. `inventory_adjustments` can increment stock, but that is not the same as receiving against a purchase order.

### Missing

- Incoming quantity.
- Receipt variance.
- Supplier invoice/cost capture.
- Landed cost.
- Receiving audit.
- Partial receipt.
- Putaway location/bin.

## Workflow 7: Inventory Transfer

### Entry Points

- Admin sidebar: `Products > Transfers`
- Admin page: `apps/web/consumer/admin/src/app/[store]/products/transfers/page.tsx`

### Current Flow

No durable transfer workflow was found. There is no transfer table, service, or worker route.

### Required State Machine

```text
draft -> pending -> in_transit -> partially_received -> received
   \        \           \                \
    -> cancelled         -> lost/damaged  -> adjusted
```

### Missing Consistency Rules

- Deduct source available when shipped.
- Increase destination incoming while in transit.
- Increase destination available when received.
- Handle variance/loss/damage.

## Workflow 8: Cart Creation

### Entry Points

- `apps/web/consumer/storefront/src/context/cart-context.tsx`
- `apps/web/consumer/storefront/src/app/store/[subdomain]/cart/page.tsx`

### Current Steps

1. Shopper adds products to client-side cart.
2. Cart is stored in `localStorage` as `lb_cart`.
3. Cart totals are computed on the client.
4. Demo coupon logic exists in the cart page for codes like `SAVE10`, `FLAT50`, and `FIRST100`.

### Tables

- `carts` table exists in `027_missing_tables.sql`, but the current primary cart flow is localStorage.

### Risks

- Client cart has no server reservation.
- Coupon preview can differ from checkout/order commit.
- No cart merge across devices.
- No abandoned cart event pipeline.
- No cart TTL cleanup in observed runtime.

## Workflow 9: Checkout

### Entry Points

- `apps/web/consumer/storefront/src/app/store/[subdomain]/checkout/checkout-client.tsx`
- Storefront Next order API: `apps/web/consumer/storefront/src/app/api/orders/route.ts`
- Worker route: `POST /v1/storefront/:subdomain/orders`
- Service: `OrderService.createOrder`
- RPC: `create_order_with_inventory_reservations`

### Current Steps

1. Shopper submits contact, shipping, cart items, payment method, and optional coupon.
2. Storefront Next handler forwards to worker.
3. Worker validates storefront order payload.
4. Worker resolves store by subdomain/site id.
5. Worker ignores client-submitted item prices and uses product IDs/variant IDs/quantity.
6. `OrderService.createOrder` calls `create_order_with_inventory_reservations`.
7. RPC locks product/inventory rows, verifies stock, creates order and order_items, decrements available stock, creates committed reservations.
8. Order returns to frontend.
9. Payment flow begins depending on method.

### Tables

- `sites`
- `products`
- `product_variants`
- `inventory_locations`
- `inventory_levels`
- `orders`
- `order_items`
- `inventory_reservations`
- `inventory_adjustments`
- `outbox_events`
- `audit_activity_events`

### Missing

- Server-side shipping calculation.
- Server-side tax calculation.
- Server-side discount calculation.
- Idempotency key required from client.
- Cart-to-order linkage.
- Fraud/risk evaluation.
- Address validation.
- Customer identity required/linked consistently.

## Workflow 10: Coupon Validation

### Entry Points

- Admin: coupons page/proxy.
- Worker: `backend/workers/api/src/routes/coupons.ts`
- Storefront public route in `storefront.ts`.
- Storefront Next proxy: `apps/web/consumer/storefront/src/app/api/coupons/validate/route.ts`

### Current Steps

1. Coupon code and order total are submitted.
2. Worker finds active coupon scoped to site/store.
3. Worker checks date bounds, usage limit, minimum order.
4. Worker computes discount for percentage/fixed/free shipping.
5. Worker returns valid/invalid.

### Tables

- `coupons`

### Risks

- Uses submitted order total rather than canonical checkout subtotal.
- Does not atomically reserve or increment usage.
- Does not enforce product/category applicability despite schema fields.
- Does not enforce customer eligibility or per-customer limit.
- Does not participate in order RPC totals.
- No redemption ledger.

## Workflow 11: Gift Card Redemption

### Entry Points

- Admin page: `apps/web/consumer/admin/src/app/[store]/products/gift-cards/page.tsx`
- Worker route: `backend/workers/api/src/routes/products.ts` under `/gift-cards`
- Table: `gift_cards`

### Current Flow

Gift cards can be issued/listed. No storefront redemption integration, partial redemption, order application, balance ledger, or refund-to-gift-card flow was found.

### Required State Machine

```text
issued -> active -> partially_redeemed -> redeemed
   \         \              \
    -> void  -> expired      -> refunded_adjusted
```

## Workflow 12: Order Placement

### Current Strong Path

`create_order_with_inventory_reservations` is the canonical order placement implementation.

### Current Fallback Path

`OrderService.createOrder` contains `createOrderCompat`, which:

- reads products scoped to store,
- calculates subtotal,
- inserts `orders`,
- inserts `order_items`,
- decrements `products.stock` sequentially.

### Risk

The fallback path is not transactionally equivalent to the RPC. It should not be used silently for production order placement.

## Workflow 13: Payment Capture

### Entry Points

- Razorpay create/verify: storefront Next routes and worker public storefront route.
- Stripe checkout/webhook: storefront Next routes.
- PayPal create/capture/webhook: storefront Next routes.
- Webhook worker: `backend/workers/webhooks/src/index.ts` for Razorpay/Stripe.
- Payment service: `backend/workers/api/src/services/payment.service.ts`.
- RPCs: `attach_order_payment_reference`, `confirm_order_payment`, `record_order_payment_failure`.

### Current Steps

1. Payment intent/order/session is created after LetBuyy order exists.
2. Provider reference is attached.
3. Provider redirect/callback/webhook confirms payment.
4. Signature verification happens in webhook/verify route.
5. Payment confirmation RPC updates order state.
6. Webhook event is stored idempotently.

### Tables

- `orders`
- `payment_webhook_events`
- `billing_history`
- `subscriptions`
- `payment_transactions` exists but is not canonical.

### Risks

- Payment transactions are not consistently recorded as the source of truth.
- PayPal webhook handling is not centralized in Cloudflare webhooks worker.
- COD bypasses online payment ledger.
- Capture/refund/void are not normalized.

## Workflow 14: Order Processing

### Entry Points

- Admin orders page.
- Admin proxy GET orders.
- Worker route `PATCH /v1/orders/:id`.
- `OrderService.transitionStatus`.

### Current Steps

1. Merchant views order table.
2. Merchant clicks Confirm/Process/Ship/Cancel depending on current status.
3. Worker validates transition.
4. Service updates order status and limited payment/fulfillment fields.

### Missing

- Order detail page.
- Order timeline.
- Order edit.
- Payment capture/refund workflow from admin.
- Fulfillment item selection.
- Risk hold/release.
- Bulk processing.

## Workflow 15: Fulfillment

### Current Flow

Fulfillment is represented as:

- order status transition to shipped,
- `fulfillment_status`,
- tracking number,
- carrier,
- order item fulfillment status.

### Missing

- Fulfillment order table.
- Shipment table.
- Fulfillment line table.
- Pick/pack workflow.
- Partial fulfillment.
- Location assignment.
- Carrier label/rates.
- Tracking webhooks.
- Fulfillment provider callbacks.

## Workflow 16: Shipment

### Current Flow

Shipment is effectively freeform fields on order transition. Shipping zones/rates exist in `shipping-tax.ts`, but are not tightly integrated into checkout/order commit.

### Missing

- Shipping method quote selection stored on order.
- Shipment label.
- Carrier event ingestion.
- Delivery exceptions.
- Address validation.
- Shipping tax interaction.

## Workflow 17: Refunds

### Current Entry Points

- Worker route `POST /v1/orders/:id/refund`
- `OrderService.transitionStatus` can move delivered to refunded.
- Webhook worker can mark failed/refunded in provider events.

### Current Gaps

- No refund line items.
- No refund transactions ledger.
- No restock options.
- No gift-card refund.
- No partial refund amount enforcement.
- No provider-specific refund request orchestration.

## Workflow 18: Returns

### Current Data

`return_requests` exists in `023_customer_system.sql`.

### Current Runtime

No complete return/RMA flow was found in worker/admin/storefront.

### Required Flow

```text
requested -> approved -> label_created -> in_transit -> received -> inspected
      \          \             \              \           \
       -> denied  -> cancelled  -> lost        -> rejected -> refunded/restocked
```

## Workflow 19: Review Creation

### Entry Points

- Worker route: public storefront review create in `storefront.ts`
- Reviews route: `backend/workers/api/src/routes/reviews.ts`
- Admin sidebar/page for reviews.

### Current Steps

1. Shopper submits review.
2. Duplicate check by product and customer email.
3. Review is inserted with pending moderation default.
4. Admin can list/moderate through reviews route/page.

### Tables

- `product_reviews`

### Risks

- No verified purchase enforcement.
- No abuse detection.
- No moderation audit timeline.
- No review media pipeline.

## Workflow 20: Analytics Tracking

### Entry Points

- Worker analytics route: `backend/workers/api/src/routes/analytics.ts`
- `ProductService.recordStorefrontView`
- Admin analytics page.

### Current Flow

Analytics are mostly aggregate queries from orders/products and product view count increments.

### Risks

- Product view increment is read/update and race-prone.
- Customers route derives customers from paginated orders, which can undercount.
- No event stream.
- No attribution/session model.
- No data warehouse/OLAP separation.

## Workflow 21: Store Theme Rendering

### Entry Points

- Theme service: `backend/workers/api/src/services/theme.service.ts`
- Theme routes: `backend/workers/api/src/routes/themes.ts`
- Storefront rendering under `apps/web/consumer/storefront/src/app/store/[subdomain]/**`
- Theme marketplace under `apps/web/consumer/theme-marketplace`

### Current Flow

Theme drafts, releases, store themes, premium purchases, install/publish semantics, cache tags, and audit/outbox support exist. This is one of the more advanced non-order domains.

### Risks

- Needs publish pipeline integration with CDN/cache purge.
- Needs tenant-specific preview auth.
- Needs rollback UI.
- Needs app/section extension contract.

## Workflow 22: Multi-store Routing

### Entry Points

- Storefront middleware/app routes.
- Admin dynamic `[store]` routes.
- Store context middleware in worker.
- DNS/Terraform docs mention wildcard tenant routing.

### Current Flow

Storefront subdomains map to `sites`. Admin store handles/ids are resolved and ownership-checked. Worker protected routes can resolve store context by param/header/query in `store-context.ts`.

### Risks

- Some routes still perform manual site checks.
- Handle/subdomain uniqueness must be enforced.
- Custom domain verification and takeover protection must be complete before production use.
- Tenant context must be mandatory for all merchant-owned records.

## Cross-Workflow Race Conditions

| Workflow | Race Risk | Current Mitigation | Gap |
|---|---|---|---|
| Checkout inventory | Oversell on concurrent checkout | RPC row locks | Fallback path unsafe |
| Coupon usage | Multiple checkouts same coupon | None found | Need redemption reservation/ledger |
| Gift card redemption | Double spend | None found | Need balance ledger row locks |
| Product views | Lost increments | None | Need atomic increment/event |
| Bulk inventory | Partial adjustment failure | Sequential calls | Need job transaction/reconciliation |
| Payment webhooks | Duplicate provider events | `payment_webhook_events` | Need provider-neutral transaction ledger |
| Admin order transitions | Concurrent status changes | Status validation | Need version enforcement |

## Missing Rollback Handling

Workflows that need compensation:

- Product create/update with variants and inventory.
- Theme install/publish and cache purge.
- Checkout with discount/tax/shipping/payment intent.
- Payment capture with order state and inventory release.
- Refund with payment provider, order totals, restock, and gift card.
- Fulfillment with inventory, shipment labels, tracking, notifications.
- Purchase order receipt with inventory and supplier cost.

## Missing Queues and Event Sourcing

`outbox_events` exists but needs runtime:

```text
transaction writes outbox_events
  -> dispatcher polls/schedules
    -> queue topic
      -> consumer
        -> delivery ledger
          -> retry/dead-letter/replay
```

Required event categories:

- `product.created`, `product.updated`, `product.deleted`
- `inventory.adjusted`, `inventory.reserved`, `inventory.released`, `inventory.received`
- `checkout.started`, `order.created`, `order.cancelled`
- `payment.authorized`, `payment.captured`, `payment.failed`, `payment.refunded`
- `fulfillment.requested`, `fulfillment.shipped`, `shipment.delivered`
- `promotion.redeemed`, `gift_card.redeemed`
- `theme.published`

## Observability Gaps

- `X-Request-ID` exists, but there is no distributed trace across Next route -> worker -> Supabase RPC -> webhook worker.
- Structured logs are not consistently enforced.
- Production `console.log` debt exists per AGENTS scan.
- No SLO dashboards or alerting definitions.
- No job queue metrics.
- No webhook delivery metrics.

## Production Readiness Score

| Workflow Group | Score |
|---|---:|
| Product/catalog | 4/10 |
| Inventory/order placement | 5/10 |
| Coupon/gift-card | 2/10 |
| Payment capture | 5/10 |
| Fulfillment/shipping | 1/10 |
| Returns/refunds | 2/10 |
| Analytics | 2/10 |
| Theme rendering | 5/10 |
| Multi-store routing | 5/10 |

## Scalability Score

| Layer | Score | Reason |
|---|---:|---|
| Transactional checkout | 5/10 | RPC locks are good; surrounding systems incomplete |
| Admin operations | 3/10 | No background jobs/bulk workflows |
| Event processing | 2/10 | Outbox without dispatcher |
| Inventory lifecycle | 3/10 | Sale reservation only |
| Customer analytics | 2/10 | Aggregate queries, no event stream |

## SaaS Maturity Score

Overall workflow maturity: **3/10**.

LetBuyy has enough real implementation to justify an enterprise audit. It does not yet have enough workflow orchestration to behave safely under thousands of stores, millions of products, and high-concurrency checkout.

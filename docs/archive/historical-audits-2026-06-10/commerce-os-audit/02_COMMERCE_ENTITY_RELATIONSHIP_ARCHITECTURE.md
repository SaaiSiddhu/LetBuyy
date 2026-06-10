# 02 Commerce Entity Relationship Architecture

## Executive Summary

LetBuyy’s commerce model is transitioning from a simple store/product/order schema toward a serious commerce platform. The schema already includes products, variants, options, collections, categories, inventory locations/levels/adjustments/reservations, orders/order_items, coupons, gift cards, customers, reviews, shipping/tax, themes, app marketplace, subscriptions, audit events and outbox events. The strongest relational work appears in migrations `029_order_items.sql`, `032_inventory_reservations_order_commit.sql`, `033_payment_state_machine.sql`, `034_inventory_level_runtime.sql`, `035_payment_failure_state.sql`, `041_store_employee_runtime_alignment.sql`, `042_collections_gift_cards_runtime_alignment.sql`, and `044_theme_purchase_payment_runtime.sql`.

The central weakness is uneven relational ownership and transactional consistency. Several entities exist without runtime flows (`carts`, `return_requests`, `payment_transactions`, purchase orders, transfers). Several runtime flows write multiple tables without a database transaction (`ProductService` product/options/variants writes, inventory bulk adjustments). Some tables are used only as compatibility mirrors (`products.stock`, `product_variants.inventory_qty`) while the more normalized tables (`inventory_levels`) are not consistently reflected in all UI paths.

Scores:

| Dimension | Score | Rationale |
|---|---:|---|
| Production readiness | 46/100 | Useful table coverage and RLS exist, but missing ledgers, incomplete constraints, raw DB errors and unused tables reduce confidence. |
| Scalability | 44/100 | Indexes are present for common paths; high-scale blockers are missing partitioning, search projections, event consumers and robust multi-location workflows. |
| SaaS maturity | 45/100 | Store scoping is pervasive, but several entities rely on service-role enforcement and not all tables have complete lifecycle/audit semantics. |

## Deep Analysis

## Entity Maps

### Core Ownership

```
users_custom / users
  -> sites (store)
       -> commerce entities
       -> content entities
       -> theme/app/subscription entities
```

`sites` is the canonical tenant table. The UI and URLs call this concept a store. This mapping is enforced in root `AGENTS.md` and visible in migrations and routes: worker code consistently resolves `store_id` against `sites.id`.

### Product Catalog

```
sites
  1 -> N products
products
  1 -> N product_options
  1 -> N product_variants
  N -> N collections through collection_products
  N -> 1 product_categories (partially implemented; category_id/category string coexist)
  1 -> N product_reviews
```

Evidence:

- `backend/supabase/migrations/001_initial_schema.sql` creates initial `products`.
- `010_products_section.sql` creates `product_options`, `product_variants`, `collections`, `collection_products`, `gift_cards`.
- `backend/workers/api/src/services/product.service.ts` writes products/options/variants.
- `backend/workers/api/src/routes/categories.ts` manages hierarchical `product_categories`.
- `backend/workers/api/src/routes/products.ts` exposes `/products`, `/products/collections`, `/products/gift-cards`, bulk and delete endpoints.

Relationship concerns:

- `products.category` string and category tables coexist. Category route updates `products.category_id`, but product form currently submits `category` as text.
- Product options are persisted, but admin new-product page sends `variants: []`; variant matrix generation is not implemented.
- `ProductService.createProduct` writes `products`, deletes/inserts options, deletes/inserts variants and calls inventory RPCs outside one explicit transaction.

### Inventory

```
products/product_variants
  -> inventory_levels(location_id, product_id, variant_id?)
inventory_locations
  -> inventory_levels
inventory_levels
  -> inventory_adjustments
orders/order_items
  -> inventory_reservations
```

Evidence:

- `027_missing_tables.sql` creates `inventory_locations`, `inventory_levels`, `inventory_adjustments`.
- `032_inventory_reservations_order_commit.sql` creates `inventory_reservations`, deduplicates inventory levels, and adds unique partial indexes for variant/null cases.
- `034_inventory_level_runtime.sql` creates `ensure_default_inventory_location`, `set_inventory_level_available`, and `adjust_inventory_level`.
- `backend/workers/api/src/routes/inventory.ts` exposes locations, levels, adjustments, bulk adjustments and history.

Relationship concerns:

- `inventory_levels` has `available`, `reserved`, `incoming`, `on_hand`, but the order commit RPC reduces `available` directly and records reservations as `committed`; it does not increment/decrement `reserved` as a timed hold.
- Product stock and variant inventory are compatibility mirrors. Any path that updates only `products.stock` can drift from `inventory_levels`.
- No purchase-order or transfer entity feeds `incoming`, despite `incoming` being present.
- Bulk adjustment loops over items and calls the RPC per item; failure after item N leaves prior adjustments committed.

### Orders, Payments and Fulfillment

```
sites
  -> orders
orders
  -> order_items
  -> inventory_reservations
  -> payment_webhook_events through provider_event_id/last_payment_event_id
  -> payment_transactions (table exists; runtime not wired)
  -> return_requests (table exists; runtime route absent)
orders
  -> customer by customer_email/store_id or store_customers
```

Evidence:

- `001_initial_schema.sql` creates `orders` with JSON `items`.
- `029_order_items.sql` creates normalized `order_items`.
- `032_inventory_reservations_order_commit.sql` inserts `orders`, `order_items`, `inventory_reservations`, `inventory_adjustments`.
- `033_payment_state_machine.sql` manages payment references and confirmation.
- `023_customer_system.sql` creates `return_requests` and `payment_transactions`.
- `backend/workers/api/src/services/order.service.ts` is the main service.
- `backend/workers/api/src/routes/orders.ts` exposes listing, status update, fulfill, refund.

Relationship concerns:

- Order item snapshots are good, but totals currently exclude real shipping/tax/discount/gift card logic inside the RPC.
- Fulfillment is `tracking_number` and status mutation; no `fulfillment_orders`, `shipments`, `shipment_items`, label, carrier or partial fulfillment object.
- Refund route uses `transitionStatus(... refunded/cancelled)` semantics rather than a payment/return transaction model.
- `payment_transactions` is not written by payment confirmation/webhooks.

### Coupons, Discounts and Gift Cards

```
sites -> coupons
sites -> gift_cards
orders -> coupon_code
missing -> promotion_redemptions
missing -> gift_card_transactions
missing -> discount_applications / order_adjustments
```

Evidence:

- `001_initial_schema.sql` creates coupons.
- `010_products_section.sql` creates gift cards.
- `042_collections_gift_cards_runtime_alignment.sql` adds runtime columns/indexes.
- `backend/workers/api/src/routes/coupons.ts` implements CRUD and validation.
- `backend/workers/api/src/routes/products.ts` implements gift-card issuance/listing.

Relationship concerns:

- Coupon validation checks active/start/expiry/usage/minimum and computes a discount from caller-submitted order total. Order creation stores `coupon_code` but calculates `discount=0`.
- No redemption ledger, usage increment transaction, per-customer limit enforcement, product/category eligibility enforcement, stacking rules, or abuse controls.
- Gift cards have issuance and balance fields, but no checkout application, partial redemption, transaction ledger, refund/reversal or customer binding.

### Customers and Reviews

```
sites
  -> store_customers
       -> customer_addresses
       -> customer_wishlists
       -> customer_activity_log
  -> customer_credentials
  -> product_reviews
orders
  -> order-derived customer list by customer_email
```

Evidence:

- `026_store_customers.sql` creates `store_customers`, wishlist and activity log.
- `025_customer_credentials.sql` creates legacy order-tracking credentials.
- `027_missing_tables.sql` creates `product_reviews`.
- `037_product_reviews_moderation_status.sql` adds review moderation state.
- `backend/workers/api/src/routes/storefront.ts` implements customer lifecycle, wishlist, addresses, order lookup and reviews.
- `backend/workers/api/src/routes/customers.ts` lists customers derived from orders, not `store_customers`.

Relationship concerns:

- Admin customer list is order-derived and does not fully use `store_customers`.
- Customer identity is split between `store_customers`, `customer_credentials`, JWT cookie sessions and guest order emails.
- Review verification is boolean from session, not linked to delivered order item ownership.

### Shipping and Tax

```
sites -> shipping_zones -> shipping_rates
sites -> tax_rates
orders -> shipping_amount/tax_amount
missing -> checkout quote snapshot / tax line items / shipment rating
```

Evidence:

- `027_missing_tables.sql` creates `tax_rates`.
- `036_shipping_tax_runtime_alignment.sql` aligns shipping/tax runtime columns.
- `backend/workers/api/src/routes/shipping-tax.ts` exposes shipping zones/rates and tax rates.

Relationship concerns:

- Checkout UI hardcodes standard free and express `₹99`; order RPC sets shipping/tax to zero.
- No address-based rate selection, tax jurisdiction resolution, line tax allocation or immutable quote snapshot.

### Themes, Apps and SaaS

```
sites
  -> store_themes
  -> theme_editor_drafts
  -> theme_releases
themes
  -> theme_purchases
  -> theme_reviews
app_developers -> marketplace_apps -> app_installations/app_reviews
plans -> subscriptions -> billing_history
```

Evidence:

- `018_theme_marketplace_extensions.sql`, `030_theme_editor_and_payment_events.sql`, `031_enterprise_events_theme_releases.sql`, `043_app_store_runtime_alignment.sql`, `044_theme_purchase_payment_runtime.sql`.
- `backend/workers/api/src/services/theme.service.ts` and `routes/themes.ts`.
- `backend/workers/api/src/routes/app-store.ts`.
- `backend/workers/api/src/routes/payments.ts` subscription flows.

Relationship concerns:

- Theme purchase has provider refs/idempotency but app installs need clearer permission/scopes/webhook lifecycle.
- Subscription writes exist, but quota enforcement at product/media/order/API write points is incomplete.

## Complete ERD-Style Textual Analysis

| Entity | Owner | Cardinality | Normalization score | Notes |
|---|---|---|---:|---|
| `sites` | user/custom user | user 1:N sites | 8 | Correct tenant root. Avoid `stores` table. |
| `products` | site/store | site 1:N products | 6 | Carries denormalized category/stock/variants JSON compatibility fields. |
| `product_options` | product | product 1:N options | 8 | Good normalized option model. |
| `product_variants` | product | product 1:N variants | 7 | Exists, but admin variant generation incomplete. |
| `collections` | site | site 1:N collections | 7 | Manual collections exist; smart collections separate and underused. |
| `collection_products` | collection/product | N:N | 8 | Correct join table pattern. |
| `product_categories` | site | site tree | 6 | Category string and category_id need consolidation. |
| `inventory_locations` | site | site 1:N | 7 | Good start; no warehouse address/capacity/fulfillment flags depth. |
| `inventory_levels` | product/variant/location | item 1:N locations | 7 | Partial unique indexes fix null variant issue. |
| `inventory_adjustments` | item/location | level 1:N events | 6 | Movement ledger exists but not complete transfer/PO/order allocation ledger. |
| `inventory_reservations` | order/item/location | order 1:N | 6 | Current use is committed deduction, not cart hold lifecycle. |
| `orders` | site | site 1:N | 6 | JSON item compatibility plus normalized items; missing sales agreements/payment collections/shipments. |
| `order_items` | order | order 1:N | 8 | Good snapshot pattern. |
| `payment_webhook_events` | provider/order | provider event unique | 7 | Good idempotency base. |
| `payment_transactions` | order | order 1:N | 2 | Table exists; not wired. |
| `return_requests` | order | order 1:N | 2 | Table exists; route/workflow absent. |
| `coupons` | site | site 1:N | 4 | CRUD exists; missing redemption/eligibility joins. |
| `gift_cards` | site | site 1:N | 3 | Issuance exists; missing transaction ledger/redemption path. |
| `store_customers` | site | site 1:N | 6 | Runtime uses it; admin customer list still order-derived. |
| `customer_addresses` | site/customer email | customer 1:N | 5 | Email-scoped rather than strongly linked to `store_customers.id` in some routes. |
| `product_reviews` | product/site | product 1:N | 6 | Moderation exists; purchase verification weak. |
| `shipping_zones/rates` | site | zone 1:N rates | 5 | Management exists; checkout not integrated. |
| `tax_rates` | site | site 1:N | 5 | Management exists; checkout not integrated. |

## Missing Relational Integrity

- Coupon redemptions should have `store_id`, `coupon_id`, `order_id`, `customer_id/email`, `discount_amount`, `idempotency_key`, timestamps and unique constraints.
- Gift card transactions should have `gift_card_id`, `order_id`, `amount`, `type`, `balance_before`, `balance_after`, `provider/idempotency reference`.
- Payment transactions should be the ledger of provider auth/capture/refund/void/dispute, not only order fields.
- Fulfillment requires `fulfillment_orders`, `fulfillment_order_items`, `shipments`, `shipment_items`, carrier events and tracking events.
- Purchase orders require suppliers/vendors, purchase-order items, receiving events and cost snapshots.
- Transfers require source/destination locations, transfer items, in-transit quantities and receiving/variance records.
- Products and variants need unique SKU constraints scoped by store when SKU is present.
- Customer addresses should consistently link to `store_customers.id` instead of email-only ownership.
- Product review uniqueness should include `store_id`, `product_id`, `customer_id` or verified order item, not only customer email.

## Missing Indexes and Constraints

Recommended additions:

- `products(store_id, sku) WHERE deleted_at IS NULL AND sku IS NOT NULL`.
- `product_variants(product_id, sku) WHERE deleted_at IS NULL AND sku IS NOT NULL`.
- `orders(store_id, created_at DESC, status, payment_status) WHERE deleted_at IS NULL`.
- `orders(store_id, customer_email, created_at DESC) WHERE deleted_at IS NULL`.
- `order_items(store_id?, product_id, created_at)` via denormalized `store_id` or join-friendly index.
- `coupon_redemptions(coupon_id, customer_id/email)` and `(coupon_id, order_id)` unique indexes.
- `gift_card_transactions(gift_card_id, created_at)`.
- `payment_transactions(order_id, provider, provider_transaction_id)` unique where present.
- `inventory_reservations(store_id, expires_at) WHERE status='active'`.
- `outbox_events(status, available_at, locked_at) WHERE status IN ('queued','failed')`.

## Missing Transactional Consistency

| Flow | Current behavior | Risk |
|---|---|---|
| Product create/update | Multiple service calls across products/options/variants/inventory. | Partial product creation; option deletion before variant insert failure; stock mirror drift. |
| Bulk inventory adjust | Sequential RPC calls. | Partial bulk success without batch transaction or compensating record. |
| Coupon validation/order commit | Validation separate from order RPC. | Race on usage limit, discount not applied, mismatch between cart display and order total. |
| Customer auto-create stats | Best-effort after checkout success from client. | Customer analytics can miss orders or double count if retried with order data. |
| Webhook order payment | Webhook worker may update order directly via REST, separate from worker RPC path. | Divergent payment/inventory behavior across providers or entry paths. |

## Event Consistency Problems

- `outbox_events` exist, but no dispatcher/consumer was found.
- `audit_activity_events` are emitted by some services/RPCs but not all mutations.
- Storefront payment routes and webhooks both mutate payment state; event ownership is not formally defined.
- Customer stats update is client-triggered, not event-driven from `order.created`/`payment.paid`.
- Product view count increments via read/update in `ProductService.recordStorefrontView`, which is race-prone and not event based.

## Race Condition Risks

- Product view count increments can lose updates.
- Coupon usage count validation is not locked and is not incremented in the same transaction.
- Gift card balance is never locked because redemption is absent.
- Bulk inventory adjustment can partially apply.
- ProductService update can overwrite concurrent option/variant edits.
- Order status update ignores version.
- Customer login count increments by read/update, not atomic increment.

## Data Corruption Risks

- `products.stock` and `inventory_levels.available` can diverge if non-RPC paths update stock.
- Admin product form creates options without variant rows, producing storefront option UI without SKU-level inventory.
- `customers` route derives customers from paginated order rows, then deduplicates after pagination; total counts can be inaccurate.
- Shipping and tax admin data can exist but checkout ignores it, producing false merchant configuration confidence.
- `return_requests` and policy pages can imply RMA support that runtime does not enforce.

## Multi-Tenant Isolation Analysis

Strengths:

- Worker uses `resolveCustomUser` and `verifySiteOwnership` broadly.
- Public storefront resolves only published sites for product/order creation.
- Store context middleware checks subscription freeze.
- RLS exists on many tables and service-role policies are explicit.

Weaknesses:

- Service-role client bypasses RLS, so every route must be correct forever.
- Some RLS policies in historical migrations used broad authenticated access before later repair.
- Public customer endpoints accept `store_id`, `customer_id`, email and rely on worker checks, not strong session token binding in every path.
- Admin customer list and order contact lookup rely on email/phone matching and should be protected from enumeration and rate-limited.

## Shopify-Style Architecture Comparison

Shopify separates:

- Product/variant/inventory item/location/inventory level.
- Order financial status, fulfillment status, return status and timeline events.
- Discount applications and price adjustments.
- Fulfillment orders and shipment tracking.
- Inventory states: on hand, available, committed, unavailable, incoming.
- Apps/extensions/functions with defined scopes.

LetBuyy equivalents:

- Product/variant/location/level exists, but inventory state semantics are incomplete.
- Order/payment/fulfillment are present but not fully independent state machines.
- Discounts/gift cards exist as records, not engines.
- Fulfillment is status/tracking only.
- App/theme marketplace exists, but extension and permission lifecycle are immature.

## Architecture Diagrams

### Target Commerce Aggregate Boundaries

```
Catalog Aggregate
  Product -> Variant -> Option -> Category/Collection

Inventory Aggregate
  Location -> InventoryLevel -> Reservation -> Adjustment -> Transfer/PO Receive

Cart/Pricing Aggregate
  Cart -> CartLine -> ShippingQuote -> TaxLine -> DiscountApplication -> GiftCardApplication

Order Aggregate
  Order -> OrderItem -> PaymentCollection -> FulfillmentOrder -> Return -> Refund

Tenant/SaaS Aggregate
  Site -> Subscription -> Entitlement -> UsageMeter -> AuditEvent
```

## Gap Analysis

Critical gaps:

- No promotion/redemption ledger.
- No gift-card ledger/redemption.
- No purchase-order or transfer schema.
- No fulfillment object model.
- No payment transaction ledger integration.
- No return/refund workflow integration.
- No event dispatcher.
- Inconsistent customer source of truth.
- Product categories and collections overlap without a formal merchandising model.

## Enterprise Recommendations

1. Establish aggregate owners and enforce all writes through service/RPC functions.
2. Make order commit include pricing, promotion, gift card, tax, shipping and inventory decisions in one transaction.
3. Add domain ledgers before adding UI features that imply money movement.
4. Treat compatibility fields as read models; define triggers/jobs to sync them or remove dependency on them.
5. Add optimistic concurrency using `version` on product/order/coupon updates.
6. Add migration tests for every FK, partial unique index, RLS policy and trigger.

## Implementation Recommendations

Phase sequencing:

1. Normalize transactional money: `payment_transactions`, `promotion_redemptions`, `gift_card_transactions`, `order_adjustments`.
2. Normalize fulfillment: `fulfillment_orders`, `shipment_items`, status/event tables.
3. Normalize inventory movement: `purchase_orders`, `purchase_order_items`, `inventory_transfers`, `inventory_transfer_items`, receiving ledger.
4. Make cart a server aggregate using `carts` and `cart_items`.
5. Build read models for admin tables and analytics.

## Production Readiness Score

46/100. The entity surface is broad, but too many entities are disconnected from runtime flows.

## Scalability Score

44/100. Good index intent exists, but high-volume order/customer/product reads need projections, partitions and search.

## SaaS Maturity Score

45/100. Store ownership is solid; entity lifecycle, ledgers and quota-aware writes need enterprise discipline.

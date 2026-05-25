# Billion-Dollar Commerce OS Implementation Roadmap

## Executive Summary

LetBuyy should not try to become Shopify by adding more pages first. It should become a commerce operating system by hardening the irreversible core:

1. Tenant context and permissions.
2. Idempotent checkout and order commit.
3. Inventory ledger and reconciliation.
4. Payment/refund transaction ledger.
5. Promotion/gift card ledger.
6. Fulfillment orders and returns.
7. Event bus, queues, and webhooks.
8. Search, analytics, app/theme extensibility, and multi-region read scale.

The roadmap below is sequenced to avoid building visible workflows on missing engines. Each phase includes objectives, modules affected, migration risks, breaking changes, infrastructure changes, complexity, scalability impact, and production impact.

## Dependency Graph

```text
TenantContext + RBAC + Idempotency
  -> Checkout Workflow
    -> Payment Ledger
    -> Promotion/Gift Card Ledger
    -> Inventory Ledger
      -> Fulfillment Orders
      -> Returns/Refunds
      -> Purchase Orders/Transfers
  -> Outbox Dispatcher + Queue
    -> Webhook Platform
    -> Analytics Pipeline
    -> Search Indexing
  -> Admin Operations Surfaces
    -> Bulk Jobs
    -> Activity Timelines
    -> Developer Logs
  -> App/Theme Extensibility
  -> Multi-region Read Scale
```

## Foundational Principles

- `sites` remains the tenant root. Do not create a `stores` table.
- Store is a UI/URL term only.
- Worker `/v1` remains the canonical API boundary.
- Business logic belongs in services/workflows, not route handlers.
- Every irreversible mutation requires idempotency.
- Every side effect emits an outbox event.
- Every ledger is append-only where possible.
- Admin UI exposes only workflows backed by durable engines.
- Generated artifacts stay out of source control.

## Phase 1: Platform Safety Foundation

### Objectives

- Make tenant context unavoidable.
- Remove unsafe order fallback.
- Add idempotency foundation.
- Add structured audit/event/log discipline.
- Harden security and CI.

### Files/Modules Affected

- `backend/workers/api/src/middleware/auth.ts`
- `backend/workers/api/src/middleware/store-context.ts`
- `backend/workers/api/src/middleware/rbac.ts`
- `backend/workers/api/src/lib/auth-user.ts`
- `backend/workers/api/src/services/*.ts`
- `backend/workers/api/src/routes/*.ts`
- `backend/workers/api/src/index.ts`
- `backend/supabase/migrations/*`
- `apps/web/consumer/admin/src/lib/api/worker-client.ts`
- `apps/web/consumer/admin/src/app/api/stores/[store]/**`
- `apps/web/consumer/storefront/src/app/api/**`
- CI/workspace package scripts.

### Key Work

1. Define `TenantContext`.
2. Refactor services to require `TenantContext`.
3. Add idempotency table:

```text
idempotency_keys
  site_id
  key
  scope
  request_hash
  response_hash
  status
  expires_at
```

4. Remove silent `createOrderCompat` fallback for production checkout.
5. Add global sanitized error serializer.
6. Add structured logging fields.
7. Add migration checks for `update_updated_at()` governance.
8. Feature-gate purchase orders/transfers until implemented.
9. Add admin-visible request IDs on errors.
10. Add no-generated-artifacts CI guard.

### Migration Risks

- Services currently accept raw IDs; refactor can break many routes.
- Some legacy ownership paths use `custom_user_id` and `user_id`.
- Internal signed proxy must preserve current admin flows.

### Breaking Changes

- API mutations may reject requests missing idempotency keys.
- Routes that previously accepted raw `site_id` should stop doing so from browser clients.

### Infrastructure Changes

- Structured log sink.
- CI secret scan and generated artifact guard.
- Optional Redis/Upstash hardening for rate limits.

### Estimated Complexity

High. This touches many routes but is foundational.

### Scalability Impact

Medium immediate, high long-term. It enables safe multi-tenant scaling.

### Production Impact

Critical. This phase reduces cross-tenant, duplicate mutation, and silent fallback risks.

## Phase 2: Canonical Checkout, Payment, and Pricing Engine

### Objectives

- Create one canonical server-side checkout workflow.
- Compute product price, discounts, shipping, tax, gift cards, and payment amount server-side.
- Add payment transaction ledger.
- Make payment capture/refund idempotent and provider-neutral.

### Files/Modules Affected

- `backend/workers/api/src/services/order.service.ts`
- `backend/workers/api/src/services/payment.service.ts`
- `backend/workers/api/src/routes/storefront.ts`
- `backend/workers/api/src/routes/payments.ts`
- `backend/workers/api/src/routes/orders.ts`
- `backend/workers/api/src/schemas/order.schema.ts`
- `backend/workers/api/src/schemas/coupon.schema.ts`
- `backend/workers/webhooks/src/index.ts`
- `apps/web/consumer/storefront/src/app/store/[subdomain]/checkout/checkout-client.tsx`
- `apps/web/consumer/storefront/src/app/store/[subdomain]/cart/page.tsx`
- `apps/web/consumer/storefront/src/app/api/razorpay/**`
- `apps/web/consumer/storefront/src/app/api/stripe/**`
- `apps/web/consumer/storefront/src/app/api/paypal/**`
- new Supabase migrations.

### Key Work

1. Introduce checkout workflow service:

```text
load canonical cart
price lines
evaluate promotions
quote shipping
calculate tax
apply gift cards
reserve inventory
create order
create payment intent/reference
emit outbox events
```

2. Add tables:

```text
checkout_sessions
order_line_adjustments
order_shipping_lines
order_tax_lines
payment_transactions
payment_attempts
refund_transactions
```

3. Wire `payment_transactions` as canonical provider-neutral ledger.
4. Normalize Razorpay/Stripe/PayPal/COD into provider adapters.
5. Update checkout UI to display server-returned totals only.
6. Stop cart page demo coupon logic from influencing checkout.
7. Add payment reconciliation job.

### Migration Risks

- Existing orders have JSONB items and partial payment fields.
- Need backfill into new payment/order adjustment tables.
- Current storefront payment routes depend on existing order total shape.

### Breaking Changes

- Checkout API payload/response should change.
- Provider verification routes may move toward one payment service contract.

### Infrastructure Changes

- Payment event queue or scheduled reconciliation.
- Secret management for provider adapters.

### Estimated Complexity

Very high.

### Scalability Impact

High. This is the foundation for real money correctness.

### Production Impact

Critical. This phase is required before serious merchant checkout.

## Phase 3: Inventory, Warehouse, Fulfillment, and Returns Engine

### Objectives

- Replace stock mirrors as business truth with inventory ledger/projections.
- Add purchase orders, transfers, and incoming inventory.
- Add fulfillment orders and shipments.
- Add returns/RMA and restocking.

### Files/Modules Affected

- `backend/workers/api/src/routes/inventory.ts`
- `backend/workers/api/src/routes/orders.ts`
- `backend/workers/api/src/services/order.service.ts`
- `backend/workers/api/src/services/product.service.ts`
- new services: `inventory.service.ts`, `fulfillment.service.ts`, `purchase-order.service.ts`, `transfer.service.ts`, `return.service.ts`
- admin pages under:
  - `apps/web/consumer/admin/src/app/[store]/orders/**`
  - `apps/web/consumer/admin/src/app/[store]/products/inventory/**`
  - `apps/web/consumer/admin/src/app/[store]/products/purchase-orders/**`
  - `apps/web/consumer/admin/src/app/[store]/products/transfers/**`
- new migrations.

### Key Work

1. Add inventory state columns:

```text
on_hand_quantity
available_quantity
committed_quantity
unavailable_quantity
incoming_quantity
safety_stock_quantity
```

2. Add immutable `inventory_events`.
3. Expand `inventory_reservations` statuses.
4. Add purchase order tables and receiving workflow.
5. Add transfer tables and in-transit workflow.
6. Add fulfillment orders:

```text
fulfillment_orders
fulfillment_order_lines
shipments
shipment_events
```

7. Add returns:

```text
returns
return_lines
refunds
refund_lines
restock_events
```

8. Build admin detail pages and adjustment flows.
9. Add inventory/order reconciliation jobs.

### Migration Risks

- Existing `products.stock` and `product_variants.stock_quantity` must become projections.
- Existing order reservations need backfill/state normalization.
- Admin UI must handle legacy orders without fulfillment orders.

### Breaking Changes

- Inventory APIs should shift from direct stock update to adjustment/event commands.
- Order shipping/fulfillment APIs should shift from status field update to fulfillment order actions.

### Infrastructure Changes

- Inventory job queue.
- Reconciliation scheduler.
- Optional carrier integration secrets.

### Estimated Complexity

Very high.

### Scalability Impact

Very high. This unlocks multi-location commerce.

### Production Impact

Critical for physical commerce and serious merchants.

## Phase 4: Platform Event Bus, Webhooks, Search, Analytics, and Admin Operations

### Objectives

- Turn `outbox_events` into a real event platform.
- Add queues, retries, dead-letter, replay.
- Build tenant app webhooks.
- Add search and analytics pipelines.
- Upgrade admin to operations-grade UX.

### Files/Modules Affected

- `backend/workers/api/src/services/event.service.ts`
- `backend/workers/api/src/index.ts`
- new worker/queue consumers under `backend/workers`
- `backend/supabase/migrations/031_enterprise_events_theme_releases.sql`
- admin analytics/orders/products/customers pages
- app-store worker/app modules
- theme marketplace/app modules.

### Key Work

1. Add outbox dispatcher.
2. Add event schema registry.
3. Add queue consumers:

```text
inventory-jobs
payment-events
webhook-deliveries
analytics-events
search-indexing
theme-publishing
```

4. Add webhook platform:

```text
webhook_subscriptions
webhook_deliveries
webhook_delivery_attempts
webhook_secrets
```

5. Add search indexing for products/orders/customers.
6. Add analytics event stream.
7. Add admin saved views, bulk jobs, activity timelines, developer logs.
8. Add command palette.

### Migration Risks

- Existing audit/outbox rows may have inconsistent payloads.
- Search/analytics backfill requires careful rate limiting.
- Webhook delivery can create external side effects and support burden.

### Breaking Changes

- Some synchronous operations become asynchronous jobs.
- Admin pages should show job status instead of assuming immediate completion.

### Infrastructure Changes

- Cloudflare Queues or equivalent.
- Dead-letter storage.
- Search service.
- Analytics warehouse or OLAP store.
- Observability dashboards.

### Estimated Complexity

High.

### Scalability Impact

Very high. This separates write paths from projections and integrations.

### Production Impact

High. This makes the platform operable, observable, and extensible.

## Phase 5: Enterprise SaaS, Extensibility, GraphQL, Multi-Region, and Ecosystem

### Objectives

- Add enterprise-grade SaaS controls.
- Build app/plugin/theme ecosystem contracts.
- Add public/admin GraphQL where useful.
- Prepare multi-region read scale.
- Add enterprise APIs and governance.

### Files/Modules Affected

- `apps/web/consumer/app-store/**`
- `apps/web/consumer/theme-marketplace/**`
- `apps/web/administrative/console/**`
- `apps/web/administrative/team/**`
- `backend/workers/api/src/routes/app-store.ts`
- `backend/workers/api/src/routes/themes.ts`
- `backend/workers/api/src/services/theme.service.ts`
- new API gateway/schema modules
- infrastructure under `infrastructure/**`
- Flutter builder packages if aligned with API contracts.

### Key Work

1. Add staff memberships, roles, permissions UI.
2. Add plan features, entitlements, quotas, usage meters.
3. Add app OAuth/token model.
4. Add app permissions and install/uninstall lifecycle.
5. Add extension points:

```text
admin_action_extensions
theme_section_extensions
checkout_extensions
webhook_subscriptions
function-like promotion/shipping/payment hooks
```

6. Add Admin GraphQL/API schema for external apps.
7. Add Storefront GraphQL for catalog/cart/customer-safe reads.
8. Add API versioning and deprecation policy.
9. Add multi-region catalog/theme/search read replicas.
10. Add enterprise compliance: audit retention, data export/delete, privacy webhooks.

### Migration Risks

- Public APIs become contracts and are hard to change.
- App ecosystem requires strict permission boundaries.
- Multi-region reads require cache invalidation/event ordering.

### Breaking Changes

- Existing app/theme marketplace routes may need versioned contracts.
- API response schemas may become stricter.

### Infrastructure Changes

- API gateway/versioning.
- App token/secret storage.
- Regional cache/search replicas.
- Webhook delivery isolation.
- Enterprise audit storage.

### Estimated Complexity

Very high.

### Scalability Impact

Very high. This turns LetBuyy from a commerce app into a commerce platform.

### Production Impact

Strategic. This is the billion-dollar platform phase, but only after core transaction systems are correct.

## Database Redesign Plan

### Keep

- `sites` as tenant root.
- normalized `order_items`.
- inventory location/level direction.
- theme release/draft model.
- payment webhook idempotency concept.
- outbox/audit concept.

### Refactor

- Make `orders.items` JSONB a snapshot only.
- Make `products.stock` and `product_variants.stock_quantity` projections.
- Normalize promotions/gift cards/payment/refunds/fulfillment.
- Backfill customers from `store_customers`, not order-derived only.
- Clean migration prefix conflicts.
- Replace any non-governance trigger function names with `update_updated_at()`.

### Add

```text
idempotency_keys
site_memberships / roles / permissions
promotion_* tables
gift_card_* tables
payment_transactions / refund_transactions
inventory_events
purchase_order_* tables
inventory_transfer_* tables
fulfillment_order_* tables
shipment_* tables
return/refund/restock tables
webhook_* tables
usage_meter_* tables
```

## Event Architecture Plan

```text
transaction
  -> writes domain rows
  -> writes outbox_events
dispatcher
  -> claims rows
  -> publishes queue message
consumer
  -> processes idempotently
  -> writes delivery/projection records
  -> marks success/failure
dead letter
  -> admin replay
```

## Queue Architecture Plan

Recommended queues:

- `outbox-dispatch`
- `payment-events`
- `inventory-jobs`
- `fulfillment-jobs`
- `webhook-deliveries`
- `search-indexing`
- `analytics-events`
- `bulk-admin-jobs`
- `theme-publishing`

Each message must include:

```text
event_id
site_id
request_id
trace_id
idempotency_key
schema_version
attempt
```

## Search Architecture Plan

Indexes:

- products,
- variants,
- collections,
- orders,
- customers,
- gift cards masked metadata,
- admin app/theme marketplace listings.

Requirements:

- tenant filter mandatory,
- partial update from outbox,
- full reindex jobs,
- deletion tombstones,
- faceted product collection filters.

## Analytics Architecture Plan

Event categories:

- storefront view/search/cart/checkout,
- order/payment/refund/fulfillment,
- inventory movement,
- promotion/gift-card redemption,
- theme/app events.

Architecture:

```text
event capture -> queue -> warehouse/projection -> dashboard aggregates
```

Do not run high-volume analytics directly from operational order tables.

## SaaS Billing Architecture Plan

Entities:

```text
plans
plan_features
site_subscriptions
site_entitlements
usage_meters
usage_meter_events
billing_invoices
billing_invoice_lines
billing_payment_attempts
```

Enforcement points:

- product creation,
- order count,
- staff seats,
- locations,
- storage,
- API calls,
- webhooks,
- apps/themes.

## Plugin and Extensibility Architecture Plan

Start with narrow extension points:

1. Webhooks.
2. Theme sections/blocks.
3. Admin action links.
4. Promotion rule provider later.
5. Shipping/rate provider later.
6. Payment provider later.

Do not allow apps to mutate database tables directly.

## Enterprise API and GraphQL Plan

REST remains for internal/operational APIs. Add GraphQL where graph-shaped reads help:

- Admin GraphQL for apps and console.
- Storefront GraphQL for catalog and content.

Requirements:

- versioning,
- scopes,
- query complexity limits,
- persisted queries for storefront,
- tenant context,
- audit logs,
- deprecation policy.

## Webhook Architecture Plan

```text
webhook_subscriptions
  site_id
  app_installation_id
  topic
  callback_url
  secret
  enabled

webhook_deliveries
  subscription_id
  event_id
  status
  next_attempt_at

webhook_delivery_attempts
  delivery_id
  status_code
  response_body_hash
  latency_ms
  error
```

Features:

- HMAC signatures,
- retries with backoff,
- dead letter,
- replay,
- per-app isolation,
- delivery logs in admin/developer UI.

## Priority Matrix

| Priority | Work | Why |
|---|---|---|
| P0 | TenantContext, idempotency, remove unsafe fallback | Prevent irreversible data/security failures |
| P0 | Server-side checkout pricing | Money correctness |
| P0 | Payment transaction ledger | Refund/reconciliation correctness |
| P0 | Promotion/gift-card ledger before redemption | Prevent financial abuse |
| P1 | Event bus/outbox dispatcher | Reliability and extensibility |
| P1 | Inventory ledger/reconciliation | Stock correctness |
| P1 | Fulfillment orders | Operational order management |
| P2 | Purchase orders/transfers | Warehouse maturity |
| P2 | Search/analytics | Merchant scale |
| P3 | App ecosystem/GraphQL/multi-region | Platform expansion |

## Final Target Architecture

```text
Client surfaces
  Accounts
  Admin
  Storefront
  App Store
  Theme Marketplace
  Console/Team
  Flutter Builder

API layer
  Hono /v1
  Admin GraphQL
  Storefront GraphQL
  Webhook ingress

Core engines
  Tenant/RBAC/Billing
  Catalog
  Checkout
  Orders
  Payments
  Promotions/Gift Cards
  Inventory/Warehouse
  Fulfillment/Returns
  Themes
  Apps

Platform layer
  Event bus
  Queues
  Webhooks
  Search
  Analytics
  Observability
  Audit
  Quotas

Data layer
  Supabase/Postgres transactional core
  R2 media
  Search index
  Analytics warehouse
  Redis/rate/cache
```

## Production Readiness Score After Roadmap

If all five phases are implemented with tests, migrations, observability, and admin workflows:

| Area | Target Score |
|---|---:|
| Tenant/security | 8/10 |
| Checkout/payment | 8/10 |
| Inventory/order | 8/10 |
| Fulfillment/returns | 7/10 |
| Promotion/gift cards | 8/10 |
| Events/webhooks | 8/10 |
| Admin operations | 8/10 |
| SaaS billing/RBAC | 8/10 |
| Multi-region readiness | 6/10 |

## Scalability Score After Roadmap

Target scalability: **8/10 for single-region transactional commerce with multi-region reads**.

True multi-region writes for inventory/payment/gift-card redemption should remain a later specialized architecture decision, not an early requirement.

## SaaS Maturity Score After Roadmap

Target SaaS maturity: **8/10**.

The missing 2 points would require years of enterprise hardening: compliance certifications, global support operations, ecosystem governance, advanced fraud, data residency, marketplace trust/safety, and proven incident response under scale.

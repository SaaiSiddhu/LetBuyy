# Enterprise Inventory and Order Engine Analysis

## Executive Summary

LetBuyy's inventory and order engine is a hybrid of three generations:

1. The initial MVP generation: `products.stock`, `orders.items` JSONB, direct product stock decrement.
2. The normalization generation: `order_items`, `product_variants`, `inventory_locations`, `inventory_levels`, `inventory_adjustments`.
3. The enterprise-intent generation: `inventory_reservations`, row-locking checkout RPC, payment state RPCs, outbox/audit tables.

The strongest implementation is `create_order_with_inventory_reservations` in `backend/supabase/migrations/032_inventory_reservations_order_commit.sql`. It is the only current path that resembles an enterprise commerce commit boundary: it locks product/inventory rows, validates capacity, creates the order and line items, decrements inventory levels, creates reservations, and emits audit/outbox records.

The current engine is still not production-grade because it only handles the order placement slice. It does not yet model the full inventory lifecycle: on hand, available, committed, unavailable, incoming, purchase receiving, transfer in transit, safety stock, damaged stock, allocation, backorder, reconciliation, or multi-location fulfillment routing. It also lacks a complete order ledger, fulfillment order model, payment transaction model, refund ledger, and event-driven processing pipeline.

## Current Architecture

```text
Product catalog
  products.stock
  product_variants.stock_quantity

Inventory runtime
  inventory_locations
  inventory_levels
  inventory_adjustments
  inventory_reservations

Order runtime
  orders
  order_items
  OrderService
  create_order_with_inventory_reservations RPC
  release_order_inventory RPC

Payment runtime
  attach_order_payment_reference RPC
  confirm_order_payment RPC
  record_order_payment_failure RPC
  payment_webhook_events

Admin runtime
  orders page
  inventory page
  purchase order placeholder
  transfer placeholder
```

## Critical Files and Tables

### Backend Code

- `backend/workers/api/src/services/order.service.ts`
- `backend/workers/api/src/services/product.service.ts`
- `backend/workers/api/src/services/payment.service.ts`
- `backend/workers/api/src/routes/orders.ts`
- `backend/workers/api/src/routes/inventory.ts`
- `backend/workers/api/src/routes/storefront.ts`
- `backend/workers/api/src/schemas/order.schema.ts`
- `backend/workers/api/src/schemas/product.schema.ts`
- `backend/workers/webhooks/src/index.ts`

### Database Migrations

- `backend/supabase/migrations/001_initial_schema.sql`
- `backend/supabase/migrations/010_products_section.sql`
- `backend/supabase/migrations/027_missing_tables.sql`
- `backend/supabase/migrations/029_order_items.sql`
- `backend/supabase/migrations/030_theme_editor_and_payment_events.sql`
- `backend/supabase/migrations/032_inventory_reservations_order_commit.sql`
- `backend/supabase/migrations/033_payment_state_machine.sql`
- `backend/supabase/migrations/034_inventory_level_runtime.sql`
- `backend/supabase/migrations/035_payment_failure_state.sql`

### Admin UI

- `apps/web/consumer/admin/src/app/[store]/orders/page.tsx`
- `apps/web/consumer/admin/src/app/[store]/products/inventory/page.tsx`
- `apps/web/consumer/admin/src/app/[store]/products/purchase-orders/page.tsx`
- `apps/web/consumer/admin/src/app/[store]/products/transfers/page.tsx`

## Current Inventory Model

### Product Mirror

`products.stock` is still a visible and operational quantity. This was the first stock model and is still used in product listing, storefront display, and fallback order code.

### Variant Mirror

`product_variants.stock_quantity` exists and is updated by runtime inventory RPCs. It is not yet consistently the canonical quantity for variant availability.

### Inventory Location/Level

`inventory_locations` and `inventory_levels` add multi-location shape. The runtime migration fixes uniqueness for null and non-null variant IDs and creates default inventory locations.

Observed conceptual fields:

- product id
- variant id
- location id
- quantity/available-style quantity
- reserved quantity

### Inventory Adjustment

`inventory_adjustments` records changes. The worker exposes history and adjustment routes.

### Inventory Reservation

`inventory_reservations` is used during order commit and release. Current status is effectively:

```text
committed -> released
```

There is no temporary hold/reserved-for-cart state.

## Current Order Model

### Orders

`orders` is tenant-scoped by `site_id` and contains:

- order number
- customer fields
- status
- payment status
- fulfillment status
- total/subtotal/discount/shipping/tax
- payment provider/reference fields
- inventory reservation timestamps/flags
- JSONB `items`

### Order Items

`order_items` normalizes line items with snapshot fields and fulfillment status. This is the right direction and should become the operational truth for order lines.

### State Transitions

The route/service pair enforces the allowed order transitions defined by `VALID_TRANSITIONS`. This is helpful, but it is not enough for enterprise order management because payment and fulfillment are separate axes.

## Checkout Atomicity Analysis

### Strong Path

```text
POST /v1/storefront/:subdomain/orders
  -> StorefrontCreateOrderSchema
  -> OrderService.createOrder
  -> RPC create_order_with_inventory_reservations
```

The RPC:

- resolves products under the site;
- locks product/inventory rows with `FOR UPDATE`;
- checks available capacity;
- inserts `orders`;
- inserts `order_items`;
- updates inventory levels;
- creates `inventory_reservations`;
- writes inventory adjustments;
- writes outbox/audit records where available.

### Why This Matters

This is the correct place to prevent overselling. The system should preserve this pattern and expand it rather than moving checkout logic back into JavaScript route handlers.

### Weak Surrounding Edges

- The RPC calculates item totals but currently stores discount as zero even if coupon code exists.
- Shipping and tax are zero in the RPC.
- Gift card redemption is not part of the transaction.
- Payment intent creation happens after order commit, so unpaid orders consume stock immediately unless release-on-failure/cancel is robust.
- `createOrderCompat` fallback in `OrderService` is non-transactional and should not be production fallback.
- Idempotency key is optional/missing on storefront order creation.

## Overselling Prevention

### Current Protection

The SQL RPC is the primary oversell prevention mechanism. It locks relevant rows and checks quantities.

### Remaining Risks

| Risk | Why It Can Happen |
|---|---|
| Fallback oversell | `createOrderCompat` decrements products sequentially |
| Coupon/payment retry duplicate | No mandatory idempotency key at checkout boundary |
| Multi-location oversell | No allocation/routing engine across locations |
| External channel oversell | No channel reservations or sync reconciliation |
| Cart race | Cart additions do not reserve stock |
| Admin adjustment race | Manual adjustment can collide with order activity without workflow context |
| Webhook legacy decrement | Webhook worker has fallback `adjustInventory` if no reservation timestamp |

## Stock Locking Strategy Analysis

### Current Locking

`FOR UPDATE` row locking in the RPC is appropriate for single-region Postgres checkout. It can safely serialize concurrent checkouts for the same inventory rows.

### Scaling Limits

- Hot products can serialize checkout and increase latency.
- Bulk inventory updates can contend with checkout.
- No queue/backpressure is defined for flash-sale conditions.
- Multi-region writes cannot rely on a single Postgres row lock unless all writes route to the primary region.

### Recommendation

Short term:

- Keep single-region authoritative inventory writes.
- Make checkout idempotent.
- Remove unsafe fallback.
- Use inventory reservations as the only order stock mutation path.

Medium term:

- Add reservation states and TTL.
- Add queued bulk inventory operations.
- Add inventory snapshots/materialized availability for reads.
- Separate read availability from write commit.

Long term:

- Add channel/location allocation.
- Add regional read replicas for catalog.
- Keep global inventory writes centralized or shard by tenant/site.

## Shopify-Style Inventory State Gap

Shopify models inventory states including on hand, available, committed, unavailable, and incoming. LetBuyy currently approximates available/reserved/committed through levels and reservations, but does not expose the full state model.

### Required LetBuyy Inventory Equation

```text
on_hand = available + committed + unavailable
sellable = available - safety_stock - channel_reservations
incoming = purchase_order_incoming + transfer_incoming
```

### Proposed Columns/Concepts

For `inventory_levels`:

- `on_hand_quantity`
- `available_quantity`
- `committed_quantity`
- `unavailable_quantity`
- `incoming_quantity`
- `safety_stock_quantity`
- `reserved_quantity`
- `version`

For `inventory_reservations`:

- `status`: `hold`, `committed`, `released`, `expired`, `fulfilled`, `cancelled`
- `source`: `cart`, `checkout`, `order`, `draft_order`, `app`, `manual`
- `expires_at`
- `idempotency_key`

For new `inventory_events`:

- immutable inventory movement ledger.

## Purchase Order Analysis

### Current State

Purchase orders appear in admin navigation and a page exists, but no durable backend system was found.

### Enterprise Gap

Purchase orders are necessary to manage incoming inventory. Without POs, the system can only manually adjust stock.

### Required Objects

```text
suppliers
purchase_orders
purchase_order_lines
purchase_order_receipts
purchase_order_receipt_lines
inventory_receipts
supplier_invoices
landed_cost_allocations
```

### Required PO State Machine

```text
draft
  -> submitted
  -> ordered
  -> partially_received
  -> received
  -> closed

draft/submitted/ordered -> cancelled
partially_received -> closed_with_variance
```

### Inventory Effects

```text
PO ordered:
  incoming += ordered_quantity

Receipt posted:
  incoming -= received_quantity
  available/on_hand += accepted_quantity
  unavailable += rejected_quantity
```

## Transfer System Analysis

### Current State

Transfers appear in admin navigation and page shell, but no tables/services/routes were found.

### Required Objects

```text
inventory_transfers
inventory_transfer_lines
inventory_transfer_receipts
```

### Required Transfer State Machine

```text
draft -> requested -> approved -> picked -> in_transit -> partially_received -> received -> closed
   \         \           \         \            \                  \
    -> cancelled          -> rejected            -> lost/damaged    -> adjusted
```

### Inventory Effects

```text
approved:
  source.available -= reserved_transfer_qty
  source.unavailable += reserved_transfer_qty

shipped:
  source.on_hand -= shipped_qty
  source.unavailable -= shipped_qty
  destination.incoming += shipped_qty

received:
  destination.incoming -= received_qty
  destination.available += received_qty
```

## Fulfillment and Order Engine Gap

### Current Order Fulfillment

Order processing currently updates status fields on the order. This is insufficient because fulfillment is work, not just state.

### Required Fulfillment Model

```text
fulfillment_orders
  id
  site_id
  order_id
  assigned_location_id
  status
  request_status
  hold_reason
  fulfill_at
  provider_id
  version

fulfillment_order_lines
  fulfillment_order_id
  order_item_id
  quantity
  fulfilled_quantity

shipments
  fulfillment_order_id
  carrier
  tracking_number
  label_url
  status

shipment_events
  shipment_id
  event_type
  occurred_at
  payload
```

### Fulfillment State Machine

```text
open -> on_hold -> open
open -> submitted -> accepted -> in_progress -> shipped -> delivered -> closed
open/submitted/accepted -> cancelled
submitted -> rejected -> open
```

## Refund and Return Engine Gap

### Existing Data

`return_requests` and `payment_transactions` exist in migration `023_customer_system.sql`, but the order engine does not fully use them.

### Required Objects

```text
returns
return_lines
refunds
refund_lines
refund_transactions
restock_events
```

### Required Return/Refund Interaction

```text
return approved
  -> optionally create return shipment
  -> receive items
  -> inspect
  -> restock accepted quantity
  -> create refund authorization
  -> capture provider refund
  -> record refund transaction
```

## Backorders

No backorder policy was found. Backorders should not be bolted onto product stock booleans.

Required:

- product/variant inventory policy: deny, continue, preorder, backorder.
- expected availability date.
- customer-facing messaging.
- fulfillment split between available and backordered quantities.
- payment capture policy for backordered goods.

## Restocking

Current restocking is manual adjustment or inventory release on cancellation/payment failure. Enterprise restocking must distinguish:

- cancelled before fulfillment,
- returned sellable,
- returned damaged,
- carrier lost,
- exchange restock,
- correction/recount,
- supplier receipt.

Each must write a different immutable inventory event.

## Inventory Reconciliation

No reconciliation job was found.

Required reconciliation:

```text
products.stock mirror
product_variants.stock_quantity mirror
inventory_levels aggregate
inventory_reservations committed/released
order_items fulfilled/unfulfilled
payment/order cancellation state
```

Recommended scheduled checks:

- negative available inventory,
- stale unpaid orders holding inventory,
- orders paid without inventory reservation,
- inventory reservation without order,
- product stock mirror mismatch,
- payment events without order state transition,
- duplicate order numbers.

## Queue Architecture Recommendations

### Required Queues

```text
checkout-events
inventory-jobs
payment-events
fulfillment-jobs
webhook-deliveries
analytics-events
reconciliation-jobs
```

### Queue Design

- Each job must include `site_id`, `request_id`, `idempotency_key`, `event_id`, `attempt`, and `traceparent`.
- Side effects must write status transitions before external calls when possible.
- Failed jobs must move to dead letter with replay controls.
- Admin bulk jobs must be visible in UI.

## Event-Driven Inventory Recommendations

### Event Ledger

Introduce immutable `inventory_events`:

```text
sale_committed
sale_released
manual_adjusted
po_ordered
po_received
transfer_reserved
transfer_shipped
transfer_received
return_restocked
damage_recorded
reconciliation_corrected
```

### Projection Tables

`inventory_levels` should become the projection of the ledger, not the only record of truth. This improves auditability and replay.

## Warehouse Architecture Recommendations

### Minimum Warehouse Model

```text
warehouses/inventory_locations
  address
  active
  fulfills_online_orders
  priority
  cutoff_time
  timezone

warehouse_zones
bins
pick_lists
pack_stations
shipping_profiles
```

### Allocation Algorithm

Initial routing can be simple:

1. Filter locations that fulfill online orders.
2. Filter locations with available stock for all shippable lines.
3. Prefer merchant-configured priority.
4. Prefer shipping zone proximity later.
5. Split only if single-location fulfillment is impossible and store policy allows split.

## Critical Flaws

| Severity | Issue | Evidence | Impact |
|---|---|---|---|
| Critical | Unsafe fallback order creation | `OrderService.createOrder` fallback | Overselling/non-atomic writes |
| Critical | Discount not in order commit | RPC sets discount zero | Incorrect financial totals |
| Critical | Gift cards not transactional | Gift card CRUD only | Double-spend risk if redemption added casually |
| High | No fulfillment order model | Orders route status fields only | Cannot scale fulfillment ops |
| High | No purchase/transfer engine | Admin placeholders | No incoming/in-transit inventory |
| High | Payment ledger incomplete | `payment_transactions` not canonical | Refund/reconciliation risk |
| High | Bulk inventory not job-based | route loops adjustments | Partial failure and contention |
| Medium | Product stock mirrors | `products.stock`, variants, levels | Drift risk |
| Medium | Admin lacks adjustment workflows | inventory page list-only | Operational blind spots |

## Production Readiness Score

| Area | Score |
|---|---:|
| Checkout inventory commit | 6/10 |
| General inventory lifecycle | 2/10 |
| Purchase orders | 0/10 |
| Transfers | 0/10 |
| Fulfillment orders | 1/10 |
| Refund/return integration | 2/10 |
| Payment/order ledger | 4/10 |
| Reconciliation | 1/10 |
| Overall inventory/order engine | 2.5/10 |

## Scalability Score

| Dimension | Score |
|---|---:|
| Single-location checkout concurrency | 5/10 |
| Multi-location inventory | 2/10 |
| Bulk operations | 2/10 |
| Flash-sale handling | 2/10 |
| Warehouse operations | 1/10 |
| Multi-region writes | 1/10 |

## SaaS Maturity Score

Inventory/order SaaS maturity: **2.5/10**.

The core order reservation RPC is valuable and should be protected. The next engineering milestone must surround it with complete ledgers, workflow orchestration, admin operations, and reconciliation.


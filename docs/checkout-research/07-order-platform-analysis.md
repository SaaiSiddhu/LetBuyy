# Order Platform Analysis

> Evidence-based analysis. Sources: `services/api-gateway/src/routes/orders.ts`, `…/execution/order-execution.adapter.ts`, `…/lib/order-confirmation-email.ts`, `…/lib/order-ownership.ts`, `…/routes/order-risk.ts`, `…/schemas/order.schema.ts`, `…/routes/returns.ts`, `…/routes/shipping-labels.ts`, `packages/checkout-core/src/index.ts`, `apps/storefront-runtime/src/app/api/orders/*`, `apps/storefront-runtime/src/lib/order-service.ts`.

---

## 1. Order Data Model

### Order Entity

Fields enumerated from `ORDER_LIST_COLUMN_NAMES` (orders.ts L59–107) and `OrderSourceRow` (checkout-core L1489–1513):

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `store_id` / `site_id` | uuid | Tenant scope (both present; `store_id` is the FK) |
| `order_number` | text | Human-readable identifier (collision-free; generated inside `create_checkout_order` RPC) |
| `customer_name` | text | Buyer full name |
| `customer_email` | text | Buyer email; used for confirmation emails and guest lookup |
| `customer_phone` | text | Buyer phone; used for COD confirmation and risk |
| `customer_gstin` | text | Optional buyer GSTIN for B2B invoicing |
| `shipping_address` | jsonb | Full shipping address (line1, city, state, pincode, country) |
| `billing_address` | jsonb | Billing address (may differ from shipping) |
| `items` | jsonb | Denormalized line-items snapshot (legacy column; relational reads via `order_items` table preferred when `ORDER_ITEMS_RELATIONAL_READS=on`) |
| `subtotal` | numeric | Sum of line item totals (major units) |
| `shipping_cost` | numeric | Shipping charge (major units) |
| `tax` | numeric | GST tax amount (major units; overwritten by GST invoice generation) |
| `discount` | numeric | Total discount applied |
| `total` | numeric | Final order total = subtotal + shipping_cost + tax − discount |
| `coupon_code` | text | Applied coupon code |
| `coupon_discount` | numeric | Coupon discount amount |
| `status` | text | Order lifecycle status (see Section 2) |
| `payment_status` | text | `pending` / `paid` / `failed` / `refunded` |
| `payment_method` | text | `cod` / `razorpay` / `stripe` / `paypal` |
| `payment_id` | text | Provider payment reference (Razorpay ID, Stripe session ID, etc.) |
| `payment_gateway` | text | Gateway identifier string |
| `payment_processed_at` | timestamptz | When payment confirmation was received |
| `payment_failure_reason` | text | Reason string when payment fails |
| `last_payment_event_id` | text | Most recent payment event identifier |
| `fulfillment_status` | text | Summary fulfillment state |
| `fulfillment_state` | text | Detail fulfillment state (`unfulfilled` / `hold` / `fulfilled` / `cancelled`) |
| `tracking_number` | text | Carrier tracking number (set on fulfillment) |
| `carrier` | text | Carrier name |
| `shipping_method` | text | `standard` / `express` |
| `notes` | text | Order notes / cancellation reason |
| `version` | integer | Optimistic lock version |
| `inventory_reserved_at` | timestamptz | When inventory was reserved by the RPC |
| `inventory_released_at` | timestamptz | When inventory was released (on cancellation) |
| `currency` | text | Always `INR` |
| `return_status` | text | Return lifecycle status |
| `refund_status` | text | Refund lifecycle status |
| `risk_score` | integer | 0–100 risk score (populated by risk assessment) |
| `risk_level` | text | `low` / `medium` / `high` |
| `cod_confirmation_status` | text | `requested` / `confirmed` / `rejected` / `expired` |
| `rto_status` | text | Return-to-origin status (`at_risk` when high risk) |
| `place_of_supply_state` | text | GST place of supply state code |
| `gst_invoice_number` | text | Generated GST invoice number |
| `gst_invoice` | jsonb | Full GST invoice JSON (immutable once set) |

### Order Line Item Entity (`order_items` table)

Fields from `hydrateOrderItems` select + `GstOrderItemRow` (order-execution.adapter.ts L55–68):

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `order_id` | uuid | FK to orders |
| `product_id` | uuid | FK to products |
| `variant_id` | uuid | FK to product variant (nullable) |
| `title` / `name` | text | Product name at time of order |
| `sku` | text | SKU at time of order |
| `quantity` | integer | Quantity ordered |
| `unit_price` | numeric | Price per unit (major units, sourced from DB at order creation) |
| `price` | numeric | Alias for unit_price (both columns present) |
| `total` | numeric | unit_price × quantity |
| `variant_title` | text | Variant display label |
| `image_url` | text | Product image snapshot |
| `product_snapshot` | jsonb | Full product record snapshot at order time |
| `hsn_code` | text | HSN code (set during GST invoice generation) |
| `gst_rate` | numeric | GST rate in percent (set during GST invoice generation) |
| `taxable_amount` | numeric | GST taxable amount (set during GST invoice generation) |
| `cgst_amount` | numeric | CGST component (intra-state) |
| `sgst_amount` | numeric | SGST component (intra-state) |
| `igst_amount` | numeric | IGST component (inter-state) |

---

## 2. Order Lifecycle

### Status State Machine

From `VALID_TRANSITIONS` (checkout-core L1426–1435) and `planOrderStatusTransition` (L1445–1470):

```
                ┌─────────────────────────────────────────┐
                ▼                                         │
PENDING ──────────────────► CONFIRMED ──► PROCESSING ──► SHIPPED ──► DELIVERED ──► REFUNDED
   │               │             │             │              │
   │         [COD risk]          ▼             ▼              ▼
   │        PENDING_COD ──► CANCELLED      CANCELLED      CANCELLED
   │             │
   └─────────────┘
   (COD timeout/rejection → CANCELLED)
```

| Status | Trigger | Side Effects |
|---|---|---|
| `pending` | `create_checkout_order` RPC succeeds | Inventory reserved; initial state for both COD and card payments |
| `pending_cod` | Risk assessment requests COD confirmation (score ≥ 35) | `cod_confirmation_status=requested`; 12-hour expiry timer set; WhatsApp event emitted (sandbox) |
| `confirmed` | Razorpay/Stripe webhook payment verified OR COD customer confirms | `payment_status=paid` (card); COD sets `cod_confirmation_status=confirmed`, `fulfillment_state=unfulfilled` |
| `processing` | Merchant transitions via PATCH `/orders/:id` | Domain event `order.paid` |
| `shipped` | PATCH to `shipped` delegates to `create_order_fulfillment` RPC | `order.fulfilled` event; tracking number set |
| `delivered` | Merchant transitions via PATCH `/orders/:id` | `payment_status=paid`; `order.delivered` + `order.paid` events |
| `cancelled` | Merchant, COD rejection, COD timeout | `payment_status=refunded`; `release_order_inventory_with_ledger` RPC; `order.cancelled` event; lifecycle email queued; gift-card balance restored (`restore_gift_card_on_refund`) |
| `refunded` | Merchant transitions delivered order | `order.returned` + `order.refunded` events; lifecycle email queued; gift-card balance restored |

---

## 3. Checkout → Order Creation

### Sequence

1. **Storefront → BFF proxy**: `POST /api/orders` (storefront-runtime) receives `{ subdomain, customer, items, paymentMethod, idempotencyKey }`. Preview mode blocked (409). Routes to `StorefrontApiClient.storefront.createOrder`.

2. **BFF → API Gateway**: Gateway route `POST /orders` (orders.ts L1227) validates with `CreateOrderSchema`, resolves tenant context, claims idempotency slot.

3. **OrderExecutionAdapter.createOrder** (order-execution.adapter.ts L146–193):
   - Checks monthly order quota against plan entitlements.
   - Calls `this.db.rpc('create_checkout_order', { p_store_id, p_customer_name, p_customer_email, p_customer_phone, p_shipping_address, p_items, p_payment_method, p_notes, p_coupon_code, p_gift_card_code, p_shipping_method, p_idempotency_key, p_actor_id, p_request_id, p_shipping_rate_id, p_tax_amount })`.
   - **All prices are computed inside the RPC from DB product prices — the client never sends amount/total.**

4. **Post-commit work** (`completeOrderPostCommitWork`, L196–231):
   - Records SaaS usage meter `orders +1`.
   - Calls `generateAndPersistGstInvoice` if the site has a `gstin` and the order has a buyer GSTIN or state code.

5. **Order immediately after creation**: status=`pending`, inventory reserved, GST invoice generated if applicable.

6. **Payment confirmation** (separate payment routes — Razorpay/Stripe webhooks):
   - Razorpay: HMAC-SHA256 signature verified server-side; then `confirm_order_payment_with_ledger` RPC is called.
   - COD: no payment confirmation; order stays `pending` until merchant marks confirmed or risk assessment requests COD confirmation.

---

## 4. Payment Ledger Integration

### Canonical Money Flow

All money mutations go through `SECURITY DEFINER` Postgres RPCs called via `db.rpc`. Direct `.from(orders).insert/update` on money columns is forbidden by the `canonical-ledger-only-validator`.

| RPC | Where called | Arguments | What it does |
|---|---|---|---|
| `create_checkout_order` | `OrderExecutionAdapter.createOrder` (adapter L158) | store_id, customer fields, items (product_id+quantity), payment_method, coupon_code, gift_card_code, shipping_rate_id, tax_amount, idempotency_key, actor_id, request_id | Creates order + order_items from DB prices; reserves inventory; applies coupon/gift-card; creates payment_transaction record in `pending`; idempotent via ON CONFLICT |
| `confirm_order_payment_with_ledger` | Payment webhook routes (Razorpay/Stripe, not in orders.ts) | (inferred: order_id, provider_payment_id, idempotency_key) | Marks payment_transaction as paid; updates order payment_status=paid; writes ledger entry |
| `create_order_fulfillment` | `OrderExecutionAdapter.fulfillOrder` (adapter L466) | order_id, lines, location_id, carrier, tracking_number, tracking_url, actor_id, request_id, idempotency_key | Creates fulfillment_order record; updates order fulfillment_state |
| `create_order_return_and_refund` | `OrderExecutionAdapter.createRefund` (adapter L486) | order_id, lines, reason, refund_method, restock, actor_id, request_id, idempotency_key | Creates `returns` + `refunds` records; sets return_status; optionally restocks inventory |
| `complete_order_refund` | `OrderExecutionAdapter.completeRefund` (adapter L505); also returns.ts L279 | refund_id, provider_refund_id, provider_event_id, actor_id, request_id, idempotency_key | Marks refund as completed; writes ledger entry for refund; updates order refund_status |
| `release_order_inventory_with_ledger` | `OrderExecutionAdapter.returnInventory` (adapter L530) | order_id, actor_id, request_id, release_reason | Releases reserved inventory back to products when order is cancelled |
| `restore_gift_card_on_refund` | orders.ts L1193 (best-effort after cancel/refund status change) | p_store_id, p_order_id, p_actor_id, p_request_id | Restores gift-card balance consumed by the cancelled/refunded order via ledger projection |

### Ledger Entries Per Order

- **Order creation**: inventory reservation entry + `payment_transaction` in `pending` state (inside `create_checkout_order`).
- **Payment confirmation**: ledger credit entry + `payment_transaction` status=`paid` (inside `confirm_order_payment_with_ledger`).
- **Refund initiation**: `refunds` record created (inside `create_order_return_and_refund`).
- **Refund completion**: ledger debit entry (payout/reversal) written by `complete_order_refund`.
- **Cancellation**: inventory release ledger entry (inside `release_order_inventory_with_ledger`); gift-card balance ledger restoration.

---

## 5. Order Confirmation Email

### What triggers it

`enqueueOrderConfirmationEmail` is called from the Razorpay/Stripe payment confirmation webhook (not from orders.ts directly; the orders.ts `POST /orders` route does NOT call it — confirmation email fires only on payment success). The `enqueueOrderLifecycleEmail` IS called from orders.ts L1175 when status transitions to `cancelled` or `refunded`.

### What it contains

Built by `buildOrderConfirmationEmail` (order-confirmation-email.ts L43–86):
- Subject: `Order {orderNumber} confirmed`
- Greeting by customer name
- Line items: `{quantity} x {product_name}: INR {total}`
- Order total
- Fulfilment update promise

Lifecycle emails (`buildOrderLifecycleEmail`, L159–195):
- Cancelled: subject `Order {orderNumber} cancelled`; refund-in-progress notice.
- Refunded: subject `Refund issued for order {orderNumber}`; refund amount.

### Email service used

**Resend** (`sendResendEmail` from `@letbuyy/infrastructure/resend-adapter`), using `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. When `NOTIFICATION_QUEUE` is bound (Cloudflare Queue), the email payload is enqueued as an HMAC-signed tenant envelope (`signQueueTenantEnvelope`) with job type `email.order_confirmation` / `email.order_cancelled` / `email.order_refunded` — the queue-workers service sends the actual email. If neither the queue nor Resend is configured, the send is skipped with a `warn` log.

---

## 6. Fulfillment Pipeline

### After order confirmation

1. **Merchant initiates fulfillment**: `POST /orders/:id/fulfill` (orders.ts L1287) with `FulfillOrderInput` (carrier, tracking_number, tracking_url, lines, location_id, idempotency_key).

2. **Logistics label (optional)**: If `create_shipping_label=true` and `logistics_provider` is set, `applyLogisticsLabel` (orders.ts L493) calls the logistics adapter (`createLogisticsProvider`). Providers: `shiprocket`, `delhivery`, `pickrr`. Mode: `sandbox` by default (`LOGISTICS_MODE=live` required for production, and `liveLogisticsProviderAvailable()` currently returns `false`). Label result fills `carrier`, `tracking_number`, `tracking_url`.

3. **`create_order_fulfillment` RPC**: Called by `OrderExecutionAdapter.fulfillOrder` (adapter L466). Creates `fulfillment_order` record; sets order `fulfillment_state`.

4. **Shipping label storage**: Separate `POST /v1/shipping/labels` route (shipping-labels.ts L279). Label PDF generated via `createSimplePdfBytes`, stored in R2 (`R2_BUCKET`) at key `shipping-labels/{id}.pdf`. Label includes: order number, carrier, tracking number, ship-to address.

5. **Tracking number**: Stored on `orders.tracking_number` + `orders.carrier` after fulfillment. Label accessible via `GET /v1/shipping/labels/:id/pdf`.

6. **Delivery notification**: Status transition `shipped` → `delivered` emits `order.delivered` + `order.paid` events. No explicit push notification found in orders.ts (would come from queue-workers subscribing to domain events).

### Shipping label routes (shipping-labels.ts)

| Route | Purpose |
|---|---|
| `POST /v1/shipping/rates` | Get rate estimate for a logistics provider (sandbox: formula-based) |
| `GET /v1/shipping/provider-mode` | Returns `sandbox` or `live` for the store |
| `POST /v1/shipping/labels` | Buy a label (idempotent via `idempotency_key`); stores PDF in R2 |
| `GET /v1/shipping/labels/:id/pdf` | Download label PDF from R2 |
| `POST /v1/shipping/labels/:id/void` | Void a label |

---

## 7. Returns & Refunds

### Return request flow (returns.ts)

1. `POST /v1/returns` — merchant creates a return. Internally calls `OrderExecutionAdapter.createRefund` which calls `create_order_return_and_refund` RPC. Returns a `return_id`.
2. `GET /v1/returns` — list returns for a store (filterable by status, order_id).
3. `GET /v1/returns/:id` — single return with join to `orders`, `return_lines`, `refunds`.
4. `PATCH /v1/returns/:id` — merchant advances return status. Status timestamps written:
   - `authorized` / `approved` → `authorized_at`
   - `received` → `received_at`
   - `inspected` → `inspected_at`
   - `refunded` → `refunded_at`
   - `closed` / `cancelled` / `rejected` → `closed_at`

### Refund processing (returns.ts + orders.ts)

- `POST /v1/returns/:id/refund/complete` (returns.ts L259) — calls `complete_order_refund` RPC directly with `p_refund_id`, `p_provider_refund_id`, `p_provider_event_id`.
- `POST /orders/:id/refund` (orders.ts L1378) — creates refund intent via `OrderExecutionAdapter.createRefund` (RPC: `create_order_return_and_refund`). Returns 202 Accepted.
- `POST /orders/:id/refund/complete` (orders.ts L1333) — marks refund succeeded via `OrderExecutionAdapter.completeRefund` (RPC: `complete_order_refund`). Emits `order.refunded` event.

### Ledger entries for refunds

`create_order_return_and_refund` RPC creates `returns` + `refunds` records. `complete_order_refund` RPC writes the ledger debit entry. Gift-card redemptions on the original order are restored via `restore_gift_card_on_refund` (best-effort, called after `cancelled` / `refunded` status change).

### Normalized return fields

`normalizeReturn` (returns.ts L72–101):
- `status`, `reason`, `refund_method` (default `original_payment`)
- `refund_id`, `refund_status`, `refund_amount`, `currency`
- Timestamps: `authorized_at`, `received_at`, `inspected_at`, `refunded_at`, `closed_at`
- `lines` (return_lines), `metadata`

---

## 8. Order Risk / Fraud Detection

### Risk signals (assessOrderRisk, checkout-core L277–319)

| Signal | Score Added | Reason Tag |
|---|---|---|
| Payment method = COD | +25 | `cod_payment` |
| Order total ≥ ₹1,000 (100,000 minor units) | +20 | `high_order_value` |
| Prior RTO count > 0 | +15 per RTO (max +40) | `prior_rto` |
| Phone missing or < 8 chars | +15 | `weak_phone_signal` |
| Invalid/missing Indian pincode | +10 | `weak_pincode_signal` |
| Merchant COD confirmation policy enabled | +10 | `merchant_cod_confirmation_policy` |

### Risk levels

- `low`: score 0–34
- `medium`: score 35–59 → triggers `request_cod_confirmation` for COD orders
- `high`: score ≥ 60 → triggers `hold_fulfillment` + `request_cod_confirmation` for COD

### Actions on high-risk orders (order-risk.ts L214–247)

- `request_cod_confirmation`: sets `order.status=pending_cod`, `cod_confirmation_status=requested`, `cod_expires_at = now + 12 hours`; creates `cod_confirmation_requests` record; emits `cod.confirmation_requested` event (WhatsApp sandbox; `[HUMAN-REQUIRED] HR-WHATSAPP-LIVE` before going live).
- `hold_fulfillment`: sets `fulfillment_state=hold`, `rto_status=at_risk`.

### COD confirmation flow

- `POST /orders/:id/cod/confirm` (order-risk.ts L282): merchant/customer confirms or rejects. Confirmed → `status=confirmed`, `fulfillment_state=unfulfilled`. Rejected → `status=cancelled`, `fulfillment_state=cancelled`. Emits `order.confirmed_cod` or `order.cancelled`.
- `POST /orders/:id/cod/timeout` (order-risk.ts L362): if confirmation not received within 12 hours. Sets `status=cancelled`, `cod_confirmation_status=expired`, `rto_status=at_risk`. Emits `order.cancelled`.

### Risk assessment persistence

`order_risk_assessments` table — upsert on `(site_id, idempotency_key)`. Risk score + level + reasons + actions + input stored. Order row updated with `risk_score` + `risk_level`.

---

## 9. Ownership & Multi-Tenancy

### Tenant scoping (order-ownership.ts + tenant-context)

- `listOwnedStoreIds` (order-ownership.ts): queries `sites` table with `OR(custom_user_id.eq.{userId}, user_id.eq.{userId})` + `deleted_at IS NULL`. Optionally scoped to `session.storeId`. Returns array of `site_id` strings.
- Every order query includes `.eq('store_id', siteId)` — orders are strictly tenant-scoped by `store_id`.
- `verifySiteOwnership` (auth-user lib) is called before any single-order read or list to ensure the authenticated merchant owns the store.
- `resolveTenantContextForOrder` resolves `siteId` from the order record itself, preventing cross-tenant access.
- Draft orders and draft order lines both carry `site_id` and are filtered by it.
- `order_risk_assessments` and `cod_confirmation_requests` are scoped by `site_id`.

---

## 10. Guest Order Access

### Architecture

Guest (storefront customer) order access is entirely separate from the merchant API. It uses the storefront BFF (`apps/storefront-runtime/src/app/api/orders/*`).

### Order lookup by contact

- `GET /api/orders/check?contact={emailOrPhone}&subdomain={subdomain}` (orders/check/route.ts): returns `{ hasOrders: boolean, hasPassword: boolean }`. Calls `getOrderContactSummary` → `StorefrontApiClient.storefront.orderContactSummary`.
- Guest identifies themselves by email or phone number. No authentication token required for the check.

### Order lookup with authentication

- `apps/storefront-runtime/src/app/api/orders/login/route.ts` — guest login with email/phone + password.
- `getOrderContactSummary` (order-service.ts L26–39) calls the storefront API's `orderContactSummary` endpoint. Returns list of orders mapped to `OrderModel`.

### Set password flow for guests

- `POST /api/orders/set-password` (orders/set-password/route.ts): accepts `{ emailOrPhone, password, subdomain }`. Password minimum 4 characters.
  1. Calls `setCustomerPassword` → `StorefrontApiClient.storefront.setOrderCredential`.
  2. Returns orders for the contact via `getOrdersByContact`.
- Guest can convert to a registered customer by setting a password after placing an order.

### Success page

`apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx`: A static redirect page (kept to avoid 404 for stale Stripe redirects from V1). Displays "Order status" and links to `/store/{subdomain}/orders`. Razorpay orders resolve inline via the checkout client; this page is not the primary success path.

### OrderModel fields (guest view)

From `mapOrderRow` (order-service.ts L105–158):
- `id`, `storeId`, `orderNumber`
- `customer`: name, email, phone, address (line1→address, city, state, pincode)
- `items`: productId, name, price, quantity, image, variant
- `pricing`: subtotal, deliveryCharge, discount, total
- `payment`: method, status, razorpayPaymentId / stripeSessionId / paypalOrderId
- `status`: `pending` / `confirmed` / `processing` / `shipped` / `delivered` / `cancelled` / `refunded`
- `tracking`: number, carrier (if present)
- `createdAt`, `updatedAt`

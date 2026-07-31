# LCIS Checkout Intelligence Analysis

Evidence source: `services/api-gateway/src/routes/checkout.ts`, `payments.ts`, `shipping.ts`, `coupons.ts`, `orders.ts`, `routes/shipping-tax.ts`, `routes/stores.ts`; `apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx`, `settings/payments/page.tsx`, `api/stores/[store]/payment-config/route.ts`.

---

## 1. Checkout Operations Available Today (API-Driven)

### Checkout Configuration Operations

| Operation | API Exists? | Endpoint | LCIS-Callable? | Notes |
|---|---|---|---|---|
| enable_cod | Indirect | `GET/POST /v1/stores/:id/payment-config` | Yes | `cod_enabled` is a read-only field in the GET response; it is set to `true` automatically when Razorpay keys are saved. No dedicated toggle endpoint. |
| disable_cod | No | — | No | No API endpoint to flip `cod_enabled` independently. The field is set in `stores.ts` at `online_payment_enabled=true, cod_enabled=store.cod_enabled` during key save. A direct PATCH on the `sites` table `cod_enabled` column has no gateway endpoint. |
| set_checkout_settings | Yes | `PATCH /v1/stores/:id` (via `site_settings.checkout`) | Yes | Persists `contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`, `tip_option` under `site_settings.checkout`. |
| get_checkout_config | Yes | `GET /v1/stores/:id` | Yes | Returns `site_settings` blob which contains the `checkout` key. |
| set_payment_provider | Indirect | `POST /v1/stores/:id/payment-config` | Yes | Saves Razorpay `key_id`, `key_secret`, `test_mode`. Sets `online_payment_enabled=true` as a side effect. |

### Coupon / Discount Operations

| Operation | API Exists? | Endpoint | LCIS-Callable? | Notes |
|---|---|---|---|---|
| create_coupon | Yes | `POST /v1/coupons` | Yes | Requires `store_id`, `code`, `type` (percentage/fixed/free_shipping; bogo blocked at API level), `value`. |
| update_coupon | Yes | `PATCH /v1/coupons/:id` | Yes | Partial patch; uses `planCouponUpdate` normalizer. |
| list_coupons | Yes | `GET /v1/coupons` | Yes | Paginated; supports `store_id`, `status` (active/expired), `page`, `limit` query params. |
| delete_coupon | Yes | `DELETE /v1/coupons/:id` | Yes | Soft-delete: sets `is_active=false` (not a hard row delete). |
| pause_coupon | Indirect | `PATCH /v1/coupons/:id` | Yes | No dedicated pause endpoint; set `is_active=false` via PATCH to achieve pause. |
| get_coupon_performance | No | — | No | No analytics/redemption count endpoint exists in the coupons route. Redemption data lives in `coupon_redemptions` table but there is no aggregate API. |

### Shipping Configuration Operations

| Operation | API Exists? | Endpoint | LCIS-Callable? | Notes |
|---|---|---|---|---|
| create_shipping_zone | Yes | `POST /v1/shipping/zones` (shipping-tax router) | Yes | Creates a zone row in `shipping_zones`. |
| create_shipping_rate | Yes | `POST /v1/shipping` (shipping-tax router) | Yes | Creates a `shipping_rates` row. |
| update_shipping_rate | Yes | `PATCH /v1/shipping/:id` (shipping-tax router) | Yes | Updates fields on a shipping rate. |
| delete_shipping_zone | Yes | `DELETE /v1/shipping/zones/:id` (shipping-tax router) | Yes | Hard delete on `shipping_zones`. |
| set_free_shipping_threshold | Indirect | `POST /v1/shipping` with `type=free_shipping` and a `min_order` condition | Partial | No dedicated field; must be encoded as a rate with conditions. Exact schema depends on `CreateShippingRateSchema` — not verified as supporting a min_order condition directly. |
| enable_free_shipping | Indirect | `POST /v1/shipping` with `price=0` | Partial | Create a rate with `price=0`. No toggle endpoint; requires creating/deleting rates. |

### Payment Configuration Operations

| Operation | API Exists? | Endpoint | LCIS-Callable? | Notes |
|---|---|---|---|---|
| configure_razorpay | Yes | `POST /v1/stores/:id/payment-config` | Yes | Fields: `key_id`, `key_secret`, `test_mode`. Side effect: sets `online_payment_enabled=true`. |
| get_payment_config | Yes | `GET /v1/stores/:id/payment-config` | Yes | Returns masked config: `online_payment_enabled`, `cod_enabled`, `provider_mode`, `payment_settings` (with `razorpay.key_id` masked). |
| enable_upi | No | — | No | UPI is not a configurable field in the payment-config API. The `gateways` array in `payment_settings` reflects provider config but has no write endpoint. |
| set_payment_methods | No | — | No | No API to toggle individual payment methods (UPI/card/netbanking). Only provider key rotation is supported. |

### Order Operations (Merchant-Facing)

| Operation | API Exists? | Endpoint | LCIS-Callable? | Notes |
|---|---|---|---|---|
| list_orders | Yes | `GET /v1/orders` | Yes | Cursor + offset paginated. Supports `store_id`, `status`, `payment_status`, `search`, `sort`, `order`, `cursor`. |
| get_order | Yes | `GET /v1/orders/:id` | Yes | Returns normalized order with hydrated `order_items`. |
| update_order_status | Yes | `PATCH /v1/orders/:id` | Yes | State-machine transition. Valid statuses: `delivered`, `shipped`, `cancelled`, `refunded`. Emits domain events. |
| cancel_order | Yes | `PATCH /v1/orders/:id` with `status=cancelled` | Yes | Triggers `order.cancelled` event + cancellation email via queue. |
| initiate_refund | Yes | `POST /v1/orders/:id/refund` | Yes | Creates a refund intent via `OrderExecutionAdapter.createRefund`. Returns 202. |
| mark_shipped | Yes | `POST /v1/orders/:id/fulfill` | Yes | Creates fulfillment + optionally creates a logistics label (sandbox only; carrier live credentials are HUMAN-REQUIRED). |

---

## 2. LCIS Tool Candidates

| Tool | Purpose | Required API | Status | Value |
|---|---|---|---|---|
| optimize_checkout | Analyze current checkout config and suggest improvements (contact method, customer accounts, tip, notes) | `GET /v1/stores/:id` → `site_settings.checkout` | Callable today | High — reads the config object and can flag suboptimal defaults (e.g. customer_accounts=disabled, tip_option=false for high-AOV stores). |
| enable_cod | Enable COD for the store | No dedicated toggle endpoint — `cod_enabled` is a column on `sites`; no write API wraps it separately | Not callable — API gap | High value: COD is a primary Indian checkout method. Needs a `PATCH /v1/stores/:id/payment-config` extension to set `cod_enabled`. |
| configure_shipping | Set up shipping zones and rates | `POST /v1/shipping/zones`, `POST /v1/shipping` | Callable today | High — can scaffold a zone + standard + express rate pair for a new store. |
| create_discount | Create a promotional coupon | `POST /v1/coupons` | Callable today | High — full CRUD available. LCIS can create and manage percentage/fixed/free_shipping coupons. |
| publish_checkout | Apply checkout configuration changes | `PATCH /v1/stores/:id` (site_settings.checkout) | Callable today | Medium — checkout settings save is already a PATCH; LCIS can apply a computed config object. |
| list_order_issues | Find orders with payment/fulfillment problems | `GET /v1/orders` with `payment_status=failed` or `status=cancelled` | Callable today | High — can query failed-payment or unfulfilled orders and surface them. |
| analyze_payment_failures | Report on recent payment failure patterns | `GET /v1/orders` with `payment_status` filter | Partial | Medium — can list failed orders but no aggregate failure-reason breakdown endpoint exists. `payment_failure_reason` is a column in the orders response. |
| get_checkout_health | Current checkout configuration health check | `GET /v1/stores/:id/payment-config` + `GET /v1/stores/:id` | Callable today | High — can cross-check: Razorpay connected? COD status? Contact method? Shipping rates present? |
| detect_revenue_risk | Identify checkout bottlenecks from order data | `GET /v1/orders` (filter combinations) | Partial | Medium — can detect orders stuck in pending payment, high cancellation rate, but no funnel analytics endpoint; must be inferred from order list queries. |

---

## 3. Merchant Settings Checkout UI

### Checkout Settings Page (`apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx`)

The checkout settings page reads and writes `site_settings.checkout` via `GET/PATCH /api/stores/:store/settings`. Configurable fields:

- **Customer contact method**: `email` | `phone` | `both` — controls which contact detail customers use at checkout.
- **Customer accounts**: `disabled` | `optional` | `required` — whether accounts are required, optional, or unavailable.
- **Full name field**: `required_both` | `required_last` | `optional`.
- **Company name field**: `hidden` | `optional` | `required`.
- **Order notes**: boolean toggle — allow customers to add delivery notes.
- **Tipping option**: boolean toggle — show a tip field at checkout.

No COD toggle, no shipping method selection, and no payment provider selection appear in this UI. These are in the payments page.

### Payments Settings Page (`apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx`)

The payments page reads from `GET /api/stores/:store/payment-config` (proxied to `GET /v1/stores/:id/payment-config`) and writes via `POST /api/stores/:store/payment-config`. Fields visible and writable:

- **Razorpay Key ID** — input field; displayed masked on read.
- **Razorpay Key Secret** — password input; write-only (never shown after save).
- **Sandbox mode toggle** — `test_mode` boolean; controls whether `rzp_test_*` or `rzp_live_*` keys are validated.
- **Status badge** — Verified / Saved / Not connected (derived from `razorpay.verified` and `razorpay.secret_configured`).

Display-only fields (read from `payment-config`):

- `online_payment_enabled` — shown as "Online payments enabled/disabled".
- `cod_enabled` — shown as "COD available / COD disabled".
- `payment_settings.mode` — "Seller Razorpay account" vs "Shared LetBuyy account".
- `payment_settings.gateways` — array of configured gateways.

There is **no UI toggle for COD** in this page; `cod_enabled` is display-only. The merchant cannot enable or disable COD from the UI; it is derived from the `sites` table column.

---

## 4. Missing Operations for Full LCIS Checkout Control

The following operations have no gateway API endpoint as of this analysis:

1. **Toggle COD on/off independently** — `cod_enabled` is a column on the `sites` table. The `POST /stores/:id/payment-config` preserves its existing value (`cod_enabled: store.cod_enabled !== false`) but does not expose a write field. A `PATCH /v1/stores/:id/payment-config` accepting `cod_enabled: boolean` is missing.

2. **Get coupon performance / redemption analytics** — No endpoint aggregates redemption counts, usage rates, or revenue impact for a coupon. The `coupons` route returns metadata only; `coupon_redemptions` table has no read API in this router.

3. **Set individual payment method availability** (UPI, card, netbanking, wallets) — Only provider-level key rotation is available. No API writes to the `gateways` array or enables/disables sub-methods.

4. **Set a free-shipping threshold as a policy** — The current `POST /v1/shipping` accepts a flat rate; there is no `min_order_amount` policy field visible in the shipping-tax route comments (lines 4-5 of `shipping-tax.ts` show `GET/POST /shipping` for create; whether the schema supports conditional free shipping is unverified without reading `CreateShippingRateSchema`).

5. **Bulk coupon creation / batch discount operations** — All coupon writes are single-record only.

6. **Get checkout funnel metrics** (add-to-cart rate, checkout start vs complete ratio, cart abandonment) — The `checkout_sessions` table records state transitions, but no aggregate analytics endpoint exists. `checkout.started` and `checkout.completed` domain events are emitted but there is no query API over them.

7. **Archive / hard-delete a shipping zone and cascade to rates** — `DELETE /v1/shipping/zones/:id` exists but no cascade behavior is confirmed in the API layer.

---

## 5. Checkout Intelligence Data

The following data is accessible to LCIS via existing API endpoints:

**Order data (via `GET /v1/orders`):**
- `status` — pending / confirmed / shipped / delivered / cancelled / refunded
- `payment_status` — pending / paid / failed / refunded
- `payment_method` — razorpay / cod / stripe / cashfree
- `payment_failure_reason` — column present in order select list (line 34 of `orders.ts`)
- `coupon_code`, `coupon_discount` — per order
- `shipping_method` — standard / express
- `risk_score`, `risk_level` — from order risk assessment
- `cod_confirmation_status`, `rto_status` — COD and return-to-origin tracking
- `fulfillment_status`, `fulfillment_state` — fulfillment tracking

**Checkout session data (via `GET /v1/checkout/:id`):**
- `state` — contact / delivery / payment_intent / completed / failed
- `payment_method`, `payment_intent.provider` — selected provider
- `delivery_quote` — shipping rate and COD flag
- `confirmed_at`, `failed_at` — timing data

**Coupon data (via `GET /v1/coupons`):**
- `is_active`, `expires_at`, `type`, `value` — coupon configuration
- `minimum_order_amount`, `maximum_discount` — constraints
- No usage count / redemption count available through the coupon list API

**Payment config (via `GET /v1/stores/:id/payment-config`):**
- `online_payment_enabled`, `cod_enabled`, `provider_mode`
- `razorpay.verified`, `razorpay.test_mode`, `razorpay.connected_at`

**Shipping rates (via `GET /v1/shipping` in shipping-tax router):**
- `name`, `type`, `price`, `is_active`, `estimated_days_min/max`

---

## 6. Autonomous Checkout Optimization

### COD rate too high in region → suggest COD rules

**Data available:** `payment_method=cod` orders are queryable via `GET /v1/orders`. `cod_confirmation_status` and `rto_status` columns are present in the order response, indicating whether COD orders were confirmed or returned. `shipping_serviceability_rules` has `cod_available` and `max_cod_amount_minor` per pincode.

**Detection capability:** Yes — LCIS can query orders where `payment_method=cod` and `rto_status` is not null (returned), compute an RTO rate, and flag if it exceeds a threshold. Pincode-level COD limits in `shipping_serviceability_rules` are readable via `GET /v1/shipping/serviceability/:pincode`.

**Remediation capability:** Partial — LCIS can flag the issue and suggest disabling COD for high-RTO pincodes, but the write path to update `shipping_serviceability_rules` per pincode or to toggle `cod_enabled` globally has no API endpoint (gap noted in section 4).

### Payment failures spiking → suggest Razorpay key rotation check

**Data available:** `GET /v1/orders` with `payment_status=failed` returns failed orders with `payment_failure_reason`. `payment_processed_at` and `last_payment_event_id` are present. `provider_mode` is returned by `GET /v1/stores/:id/payment-config`.

**Detection capability:** Yes — LCIS can query recent orders with `payment_status=failed`, aggregate by `payment_failure_reason` and time window, and detect a spike. If `provider_mode=sandbox` but the store is on live traffic, that is a detectable misconfiguration.

**Remediation capability:** Partial — LCIS can surface the issue and trigger `POST /v1/stores/:id/payment-config` to update keys, but cannot verify the new keys are correct without a Razorpay API probe (which is gated on `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` env vars — HUMAN-REQUIRED in production, per `checkout.ts` line 574).

### Cart abandonment high → suggest free shipping threshold

**Data available:** `checkout_sessions` with `state=contact` or `state=delivery` and no `confirmed_at` represent abandoned sessions, but only via direct DB inspection. The `GET /v1/checkout/:id` endpoint requires a known checkout ID; there is no list endpoint for checkout sessions. `orders` with `status=pending` and no payment update are a proxy.

**Detection capability:** Partial — LCIS cannot enumerate abandoned checkout sessions via the API (no list endpoint). It can infer abandonment from orders that never moved past pending, but that undercounts cart drops before order creation.

**Remediation capability:** Yes — LCIS can call `POST /v1/shipping` (shipping-tax router) to create a zero-price (`price=0`) shipping rate, effectively enabling free shipping. Deletion of existing paid rates requires `DELETE /v1/shipping/:id`.

### Coupon overuse → flag anomaly

**Data available:** `GET /v1/coupons` returns `is_active`, `expires_at`, `type`, `value`, `minimum_order_amount`, `maximum_discount` per coupon. Order data contains `coupon_code` and `coupon_discount` per order.

**Detection capability:** Partial — LCIS can join orders by `coupon_code` to count how many orders used a given coupon code and compute total discount given. It cannot retrieve a redemption count directly from the coupons API (gap noted in section 4); must be derived by querying orders. If a fixed-value coupon appears on many low-value orders (exceeding `minimum_order_amount`), that is a detectable pattern.

**Remediation capability:** Yes — LCIS can immediately call `PATCH /v1/coupons/:id` to reduce `value`, set `expires_at` to now, or call `DELETE /v1/coupons/:id` (soft-deactivate) to stop overuse.

---

## Key Evidence References

- Gateway route mounting: `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/index.ts` lines 690, 728–733, 744, 765–766
- Checkout session state machine: `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/checkout.ts`
- COD fields in payment-config: `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/stores.ts` lines 99, 141–145, 382, 444–445
- Coupon CRUD: `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/coupons.ts`
- Shipping zone + rate CRUD: `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/shipping-tax.ts` lines 77–340
- Order columns (all available fields): `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/orders.ts` lines 59–107
- Payments route (sessions/capture/refund/Razorpay): `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/payments.ts`
- Merchant checkout settings UI: `/Users/saai_sidd/Git/Letbuyy_Store/apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx`
- Merchant payments settings UI: `/Users/saai_sidd/Git/Letbuyy_Store/apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx`
- Merchant payment-config proxy route: `/Users/saai_sidd/Git/Letbuyy_Store/apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts`

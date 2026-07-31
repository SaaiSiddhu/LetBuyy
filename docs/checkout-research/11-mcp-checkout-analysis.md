# MCP Readiness Analysis — Checkout

**Date:** 2026-06-18
**Source files examined:**
- `services/api-gateway/src/routes/checkout.ts`
- `services/api-gateway/src/routes/coupons.ts`
- `services/api-gateway/src/routes/shipping.ts`
- `services/api-gateway/src/routes/shipping-tax.ts`
- `services/api-gateway/src/routes/orders.ts`
- `services/api-gateway/src/routes/order-risk.ts`
- `services/api-gateway/src/routes/analytics.ts`
- `services/api-gateway/src/index.ts` (route mounts)

---

## 1. MCP Tool Candidate Registry

### READY (API exists, callable with merchant JWT + `verifySiteOwnership`)

| Tool | Purpose | Endpoint | Auth |
|---|---|---|---|
| `list_coupons` | List store coupons with status filter | `GET /v1/coupons?store_id=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `create_coupon` | Create a percentage/fixed/free-shipping coupon | `POST /v1/coupons` | Merchant ES256 JWT + `verifySiteOwnership` |
| `get_coupon` | Get coupon by ID | `GET /v1/coupons/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `update_coupon` | Update coupon fields (type, value, expiry, usage limit) | `PATCH /v1/coupons/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `deactivate_coupon` | Soft-delete (deactivate) a coupon | `DELETE /v1/coupons/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `validate_coupon` | Check coupon validity for a cart | `POST /v1/coupons/validate` | Merchant ES256 JWT + `verifySiteOwnership` |
| `list_orders` | List orders with status/payment_status filter + search | `GET /v1/orders?store_id=&status=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `get_order` | Get full order detail | `GET /v1/orders/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `update_order_status` | State-machine status transition (confirmed → shipped → delivered → cancelled) | `PATCH /v1/orders/:id` | Merchant ES256 JWT + `verifySiteOwnership` (via `resolveTenantContextForOrder`) |
| `fulfill_order` | Create fulfillment + optional logistics label (Shiprocket/Delhivery/Pickrr sandbox) | `POST /v1/orders/:id/fulfill` | Merchant ES256 JWT + `verifySiteOwnership` |
| `create_refund` | Initiate return + refund intent | `POST /v1/orders/:id/refund` | Merchant ES256 JWT + `verifySiteOwnership` |
| `complete_refund` | Mark provider refund as succeeded | `POST /v1/orders/:id/refund/complete` | Merchant ES256 JWT + `verifySiteOwnership` |
| `create_draft_order` | Create a merchant-initiated draft order | `POST /v1/orders/drafts` | Merchant ES256 JWT + `verifySiteOwnership` |
| `list_draft_orders` | List draft orders | `GET /v1/orders/drafts?store_id=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `convert_draft_order` | Convert draft to live order via canonical order engine | `POST /v1/orders/drafts/:id/convert` | Merchant ES256 JWT + `verifySiteOwnership` |
| `get_packing_slip` | Get PDF + HTML packing slip for an order | `GET /v1/orders/:id/packing-slip` | Merchant ES256 JWT + `verifySiteOwnership` |
| `list_shipping_zones` | List shipping zones for a store | `GET /v1/shipping-tax/shipping/zones?store_id=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `create_shipping_zone` | Create a named shipping zone | `POST /v1/shipping-tax/shipping/zones` | Merchant ES256 JWT + `verifySiteOwnership` |
| `update_shipping_zone` | Update shipping zone details | `PATCH /v1/shipping-tax/shipping/zones/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `delete_shipping_zone` | Remove a shipping zone | `DELETE /v1/shipping-tax/shipping/zones/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `list_shipping_rates` | List shipping rates for a store | `GET /v1/shipping-tax/shipping?store_id=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `create_shipping_rate` | Create a flat/weight-based shipping rate | `POST /v1/shipping-tax/shipping` | Merchant ES256 JWT + `verifySiteOwnership` |
| `update_shipping_rate` | Update a shipping rate | `PATCH /v1/shipping-tax/shipping/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `delete_shipping_rate` | Remove a shipping rate | `DELETE /v1/shipping-tax/shipping/:id` | Merchant ES256 JWT + `verifySiteOwnership` |
| `check_shipping_serviceability` | Check if a pincode is serviceable + COD availability | `GET /v1/shipping/serviceability/:pincode?store_id=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `get_available_shipping_rates` | Get live shipping rates for a cart (pincode + subtotal) | `POST /v1/shipping/rates` | Merchant ES256 JWT + `verifySiteOwnership` |
| `get_checkout_branding` | Read current checkout branding (logo, colors, theme) | `GET /v1/stores/:storeId/branding` (public) | None (public endpoint) |
| `update_checkout_branding` | Set checkout branding (logo URL, colors, theme) | `PUT /v1/stores/:storeId/branding` | Merchant ES256 JWT + `verifySiteOwnership` |
| `list_tax_rates` | List tax rates for a store | `GET /v1/shipping-tax/taxes?store_id=` | Merchant ES256 JWT + `verifySiteOwnership` |
| `create_tax_rate` | Create a tax rate | `POST /v1/shipping-tax/taxes` | Merchant ES256 JWT + `verifySiteOwnership` |
| `update_tax_rate` | Update a tax rate | `PATCH /v1/shipping-tax/taxes/:id` | Merchant ES256 JWT + `verifySiteOwnership` |

### PARTIAL (API exists but has gaps or constraints)

| Tool | Purpose | Gap |
|---|---|---|
| `get_checkout_analytics` | Checkout conversion metrics (cart adds, checkouts started) | `GET /v1/analytics/live` returns `checkouts_started` and `cart_adds` but not conversion rate or abandonment rate directly. No `checkout_completed` metric — completions require joining ledger data. The dashboard endpoint at `GET /v1/analytics/dashboard` has order counts but not funnel stages. |
| `enable_cod` | Enable/disable COD for a store | No dedicated endpoint for toggling COD globally. COD is toggled per-checkout via `payment_method: 'cod'` in the order creation path. Serviceability rules in `shipping_serviceability_rules` carry `cod_available` per pincode, but there is no `PATCH /stores/:id/settings/cod` endpoint. COD management requires direct DB rule manipulation. |
| `track_shipment` | Get shipment tracking for an order | `GET /v1/shipping/track/:trackingNumber?provider=` exists but requires a raw tracking number + provider name; order-level tracking is not exposed as `GET /v1/orders/:id/tracking`. Live carrier integration requires `[HUMAN-REQUIRED] HR-CARRIER-LIVE` credential installation. |
| `assess_order_risk` | Trigger COD risk assessment for an order | `POST /v1/orders/assess` exists via `orderRiskRouter` but is internal to the order creation flow; it requires an order record to already exist and is typically called automatically, not as a standalone MCP action. |

### BLOCKED (API does not exist or requires new infrastructure)

| Tool | Purpose | Blocker |
|---|---|---|
| `get_checkout_funnel_analytics` | Detailed checkout funnel (contact → delivery → payment → completed, with drop-off rates) | No endpoint. Analytics router has `checkouts_started` but no stage-level funnel data. Checkout session states exist in `checkout_sessions` but no aggregation API is exposed. |
| `create_live_payment_intent` | Create a Razorpay/Stripe live payment intent for a checkout | `POST /v1/checkout/:cartId/payment-intent` returns 503 for `mode: 'live'` with `[HUMAN-REQUIRED] HR-MERCHANT-PSP-LIVE`. Requires live PSP key installation by a human. |
| `get_checkout_abandonment_report` | Cart and checkout abandonment by session/time | No endpoint. Cart status is in the DB but no abandonment aggregation API exists. |
| `configure_payment_providers` | Enable/disable Razorpay, COD, etc. at store level | No store-level payment provider configuration endpoint. Payment methods are accepted from the checkout session's `payment_intent.provider` field — there is no stored payment config CRUD. |
| `get_order_gst_invoice` | Retrieve GST invoice for an order | `gst_invoice_number` and `gst_invoice` columns are present in `orders` SELECT but no dedicated `GET /v1/orders/:id/invoice` endpoint exists. |
| `bulk_cancel_orders` | Cancel multiple orders at once | No bulk-action endpoint. Only single-order `PATCH /v1/orders/:id` with `status: 'cancelled'`. |

---

## 2. Complete MCP Tool Design

### `create_coupon`
**Input schema:**
```json
{
  "store_id": "string (required)",
  "code": "string (required, uppercased by server)",
  "type": "'percentage' | 'fixed' | 'free_shipping' (required; 'bogo' rejected with 422)",
  "value": "number (required)",
  "min_order_amount": "number (optional)",
  "max_discount": "number (optional)",
  "expiry_date": "ISO8601 string (optional)",
  "usage_limit": "integer (optional)"
}
```
**Gateway call:** `POST /v1/coupons`
**Returns:** Normalized coupon object (id, code, type, value, is_active, expires_at, usage_count, usage_limit, created_at)
**Ready: YES** — Evidence: `coupons.ts` L83–130; `verifySiteOwnership` guard at L103; `planCouponCreate` from `@letbuyy/checkout-core`; 409 on duplicate code. BOGO explicitly blocked (L90–98).

---

### `enable_cod`
**Input schema:**
```json
{
  "store_id": "string",
  "pincode": "string (optional, to update a specific pincode rule)",
  "enabled": "boolean",
  "cod_fee_amount": "number (optional, minor units)"
}
```
**Gateway call:** No dedicated endpoint exists.
**Returns:** N/A
**Ready: NO** — Evidence: COD availability is stored in `shipping_serviceability_rules.cod_available` (per pincode) and applied at checkout when `payment_method: 'cod'` is used. There is no `PATCH /stores/:storeId/settings` or COD toggle endpoint. An MCP tool for this requires a new endpoint or direct serviceability-rule manipulation.

---

### `create_shipping_rate`
**Input schema:**
```json
{
  "store_id": "string (required)",
  "name": "string (required)",
  "type": "'flat' | 'weight' (required)",
  "price": "number (required)",
  "zone_id": "string (optional)",
  "min_order_value": "number (optional)",
  "free_above": "number (optional)",
  "estimated_days_min": "integer (optional)",
  "estimated_days_max": "integer (optional)"
}
```
**Gateway call:** `POST /v1/shipping-tax/shipping`
**Returns:** Shipping rate object (id, store_id, zone_id, name, type, price, is_active, created_at)
**Ready: YES** — Evidence: `shipping-tax.ts` L232; `verifySiteOwnership` guard; `planShippingRateCreate` from `@letbuyy/checkout-core`.

---

### `list_pending_orders`
**Input schema:**
```json
{
  "store_id": "string (required)",
  "status": "'pending' | 'confirmed' | 'processing' | 'shipped' | 'all' (optional, default 'all')",
  "payment_status": "'pending' | 'paid' | 'failed' | 'all' (optional, default 'all')",
  "limit": "integer (optional, default 20)",
  "cursor": "string (optional, for cursor pagination)",
  "search": "string (optional, searches order_number/email/name)"
}
```
**Gateway call:** `GET /v1/orders?store_id=&status=pending`
**Returns:** Cursor-paginated order list with full order fields including GST invoice fields.
**Ready: YES** — Evidence: `orders.ts` L541–634; `ListOrdersQuery` with `status`, `payment_status`, `sort`, `order`, `search`, `cursor`, `withCount` query params; `verifySiteOwnership` guard at L557.

---

### `cancel_order`
**Input schema:**
```json
{
  "order_id": "string (required)",
  "idempotency_key": "string (required)",
  "reason": "string (optional, stored in notes/metadata)",
  "cancel_refund_if_paid": "boolean (optional)"
}
```
**Gateway call:** `PATCH /v1/orders/:id` with body `{ status: 'cancelled', idempotency_key, ... }`
**Returns:** Updated order object. Also triggers `order.cancelled` event + cancellation email enqueue + gift card restoration.
**Ready: YES** — Evidence: `orders.ts` L1141–1223; `UpdateOrderStatusSchema` accepts `status: 'cancelled'`; `orderEventsForStatus('cancelled')` returns `['order.cancelled']`; `enqueueOrderLifecycleEmail` called at L1173; `restore_gift_card_on_refund` RPC called at L1193.

---

### `get_checkout_analytics`
**Input schema:**
```json
{
  "store_id": "string (required)",
  "from_date": "ISO8601 string (optional)",
  "to_date": "ISO8601 string (optional)"
}
```
**Gateway call:** `GET /v1/analytics/live?site_id=` (partial) or `GET /v1/analytics/dashboard?site_id=`
**Returns:** cart_adds, checkouts_started from live traffic; order counts from dashboard.
**Ready: PARTIAL** — Evidence: `analytics.ts` L218–219 has `cart_adds` and `checkouts_started` from Analytics Engine event rollup. No `checkout_completed` or funnel conversion rate is returned. A full checkout conversion metric (started → paid) requires a join across `checkout_sessions` + `ledger_transactions` with no existing API endpoint.

---

### `update_checkout_branding`
**Input schema:**
```json
{
  "store_id": "string (required)",
  "logo_url": "string (optional)",
  "favicon_url": "string (optional)",
  "primary_color": "string hex (optional)",
  "accent_color": "string hex (optional)",
  "checkout_theme": "'system' | 'light' | 'dark' (optional)",
  "tokens": "object (optional)"
}
```
**Gateway call:** `PUT /v1/stores/:storeId/branding`
**Returns:** Updated branding object (site_id, logo_url, favicon_url, primary_color, accent_color, checkout_theme, tokens)
**Ready: YES** — Evidence: `checkout.ts` L791–813; `StoreBrandingSchema` validation; `assertBrandingIsDataOnly` prevents script injection; `verifySiteOwnership` guard at L797. Upserts to `store_branding` table.

---

### `fulfill_order`
**Input schema:**
```json
{
  "order_id": "string (required)",
  "idempotency_key": "string (required)",
  "tracking_number": "string (optional)",
  "carrier": "string (optional)",
  "tracking_url": "string (optional)",
  "logistics_provider": "'shiprocket' | 'delhivery' | 'pickrr' (optional, for label creation)",
  "create_shipping_label": "boolean (optional)",
  "package_weight_grams": "integer (optional)",
  "package_dimensions_cm": "{ length, width, height } (optional)"
}
```
**Gateway call:** `POST /v1/orders/:id/fulfill`
**Returns:** Fulfillment order object with tracking fields. Emits `order.fulfilled` event.
**Ready: YES (sandbox)** — Evidence: `orders.ts` L1287–1330; `applyLogisticsLabel` creates sandbox labels only (`{ mode: 'sandbox' }`); live carrier credentials require `[HUMAN-REQUIRED] HR-CARRIER-LIVE`.

---

### `validate_coupon_for_cart`
**Input schema:**
```json
{
  "store_id": "string (required)",
  "code": "string (required)",
  "order_total": "number (required)",
  "product_ids": ["string"] (optional),
  "customer_id": "string (optional)"
}
```
**Gateway call:** `POST /v1/coupons/validate`
**Returns:** `{ valid, reason?, coupon: { code, type, value, discount_class, combines_with, minimum_order_amount, maximum_discount }, pricing_authority }`
**Ready: YES** — Evidence: `coupons.ts` L240–283; design note in comments: "Checkout is the only authority for discount amounts"; returns `pricing_authority` field to signal server-authoritative discount computation.

---

## 3. Authentication Strategy

### Token type required
All merchant management endpoints use **ES256 JWT** issued by `identity-platform` (`LETBUYY_IDENTITY_PUBLIC_JWKS`). This is distinct from the customer HS256 session token and must never be crossed (per CLAUDE.md security rules).

### Endpoint auth breakdown

| Endpoint group | Auth mechanism | Site scope enforcement |
|---|---|---|
| `GET /v1/coupons`, `POST /v1/coupons`, `PATCH /v1/coupons/:id`, `DELETE /v1/coupons/:id` | `c.get('auth')` (merchant JWT middleware on route mount) + `verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId)` | Explicit per-request DB check against `sites` table |
| `GET /v1/orders`, `GET /v1/orders/:id`, `PATCH /v1/orders/:id`, `POST /v1/orders/:id/fulfill` | Same pattern + `resolveTenantContextForOrder` | Verifies order's `store_id` belongs to the authenticated user |
| `GET /v1/shipping-tax/shipping`, `POST /v1/shipping-tax/shipping` | Same `verifySiteOwnership` pattern via `resolveCustomUser` + `verifySiteOwnership` | `store_id` query/body param |
| `PUT /v1/stores/:storeId/branding` | `resolveCustomUser` + `verifySiteOwnership` | `storeId` path param |
| `GET /v1/stores/:storeId/branding` (public) | **None** — `publicStoreBrandingRouter` is mounted without auth middleware | No auth required |
| `POST /v1/checkout/:cartId/*` (consumer-facing) | **HMAC handoff signature** (not merchant JWT) — `verifyCheckoutHandoff` validates `signature`, `cart_digest`, `expires_at` query params | Signed by `CHECKOUT_SIGNING_SECRET`, not a JWT |

### How an MCP client obtains a merchant JWT
1. The merchant must complete the ES256 auth flow at `identity-platform` (OAuth/session login).
2. The resulting token has `storeId` claim embedded (`auth.user.storeId`).
3. The MCP server presents this token in the `Authorization: Bearer <token>` header on every gateway call.
4. The gateway's auth middleware (`jwtAuth`) verifies the ES256 signature against `LETBUYY_IDENTITY_PUBLIC_JWKS`.
5. `verifySiteOwnership` then confirms the token's `storeId` matches the requested `store_id` in the body/query.

The MCP server itself must store the merchant JWT (or refresh it) — the gateway has no MCP-specific auth flow. No public API key or service account bypass exists in the current code.

---

## 4. Readiness Summary

| Category | Ready | Partial | Blocked |
|---|---|---|---|
| Coupon Management | list, create, get, update, deactivate, validate — **6 tools** | — | bogo type (V1 scope-lock) |
| Shipping Config | list/create/update/delete zones + rates, serviceability check, rate lookup — **10 tools** | — | — |
| Checkout Config (Branding) | get + update branding — **2 tools** | — | payment provider config |
| Order Management | list, get, create, update status (ship/deliver/cancel), fulfill, create draft, convert draft, packing slip — **10 tools** | risk assessment (internal) | bulk cancel, GST invoice endpoint |
| Payment Config | — | COD toggle (no dedicated endpoint) | live payment intent (`HUMAN-REQUIRED`), payment provider config |
| Analytics | — | `checkouts_started` + `cart_adds` (no funnel stages) | checkout funnel, abandonment report |
| Refund Management | initiate refund, complete refund — **2 tools** | — | — |

**Totals: ~30 READY tools, 3 PARTIAL, 6 BLOCKED**

---

## 5. Highest-Value MCP Server Scope

Given the current API surface, the smallest viable checkout MCP server with genuine merchant value is a **three-domain bundle**: Coupon CRUD (all 6 endpoints exist, fully auth-gated, no gaps), Order Operations (list orders by status, update order status through the state machine, fulfill with tracking number, initiate refund — 5 endpoints, all idempotency-keyed), and Shipping Config (create/list shipping zones and rates, check pincode serviceability — 6 endpoints). This 17-tool scope covers the three most common merchant workflows — running a promotion, processing a backlog of orders, and setting up delivery zones — without requiring any new gateway endpoints, live PSP credentials, or infrastructure. The checkout handoff flow (`POST /v1/checkout/:cartId/*`) is intentionally excluded: it is consumer-facing, HMAC-signed (not merchant-JWT-authenticated), and not appropriate for an MCP tool surface. Analytics and COD toggle are excluded due to partial/blocked status. The `PUT /v1/stores/:storeId/branding` endpoint can be added as an optional fourth domain (branding configuration) because it is complete and auth-gated, raising the scope to 19 tools at minimal incremental risk.

---

## Appendix: Route Mount Reference

| Gateway prefix | Source file | Auth model |
|---|---|---|
| `/v1/checkout` | `routes/checkout.ts` (checkoutRouter) | HMAC handoff (consumer) |
| `/v1/stores` | `routes/checkout.ts` (storeBrandingManagementRouter) | Merchant ES256 |
| `/v1/stores/:id/branding` (GET) | `routes/checkout.ts` (publicStoreBrandingRouter) | None |
| `/v1/coupons` and `/v1/discounts` | `routes/coupons.ts` | Merchant ES256 |
| `/v1/orders` | `routes/orders.ts` + `routes/order-risk.ts` (orderCodRouter) | Merchant ES256 |
| `/v1/shipping` | `routes/shipping.ts` | Merchant ES256 |
| `/v1/shipping-tax` | `routes/shipping-tax.ts` | Merchant ES256 |
| `/v1/analytics` | `routes/analytics.ts` | Merchant ES256 |
| `/v1/cod` | `routes/cod-reconciliation.ts` | Merchant ES256 |

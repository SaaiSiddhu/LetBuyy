# Checkout System Inventory

> Evidence-based inventory. All findings drawn directly from source files. No code was modified.

---

## 1. Complete File Inventory

### Storefront Runtime — Pages

| File | Purpose | Lines |
|---|---|---|
| `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx` | Server component. Resolves store by subdomain via `StoreService.getStoreBySubdomain`, passes `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled` as props to `CheckoutClient`. Generates noindex SEO metadata. | 39 |
| `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` | Primary checkout UI (client component). Implements two-step flow: Step 1 = address form, Step 2 = payment selection. Handles COD and Razorpay payment paths, coupon validation, shipping rate fetch, saved-address autofill, idempotency key generation. | 1160 |
| `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/layout.tsx` | Layout wrapper for success route. Generates `Order Confirmation` noindex metadata. Renders children passthrough. | 22 |
| `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx` | Stub page kept to prevent 404s on stale Stripe redirect links (Stripe deferred per LB-2). Redirects user to `/store/{subdomain}/orders` to check order status. | 39 |
| `apps/storefront-runtime/src/app/store/[subdomain]/checkout/paypal-return/page.tsx` | Stub page kept to prevent 404s on stale PayPal return links (PayPal deferred per LB-2). Redirects user to `/store/{subdomain}/orders`. | 38 |
| `apps/storefront-runtime/src/app/store/[subdomain]/cart/cart-client.tsx` | Full-page cart view (client component). Reads from `useCart` context; renders item list with quantity controls; "Proceed to Checkout" button links to `/{basePath}/checkout`. | 199 |

### Storefront Runtime — Components

| File | Purpose | Lines |
|---|---|---|
| `apps/storefront-runtime/src/components/cart/cart-drawer.tsx` | Side-drawer cart overlay (client component). Reads from `useCart` context. Renders item list, subtotal, "View bag" and "Checkout" links. Locks body scroll when open; Escape key closes. | 242 |

### Storefront Runtime — Cart Context

| File | Purpose | Lines |
|---|---|---|
| `apps/storefront-runtime/src/context/cart-context.tsx` | React context + provider for client-side cart state. Persists to `localStorage` (keys: `lb_cart`, `lb_cart_token`). Syncs to the gateway server cart via `POST /api/storefront/{subdomain}/cart` (new) or `PATCH /api/storefront/{subdomain}/cart/{cartToken}` (existing). | ~250 |

### Storefront Runtime — BFF API Routes

| File | Purpose | Lines |
|---|---|---|
| `apps/storefront-runtime/src/app/api/orders/route.ts` | BFF proxy. Forwards `POST /api/orders` to the gateway `POST /v1/storefront/{subdomain}/orders`. Creates the checkout order (COD or Razorpay). | 88 |
| `apps/storefront-runtime/src/app/api/coupons/validate/route.ts` | BFF proxy. Forwards `GET /api/coupons/validate?code=&subdomain=&subtotal=` to the gateway storefront coupon validation endpoint. | 31 |
| `apps/storefront-runtime/src/app/api/shipping/rates/route.ts` | BFF proxy. Forwards `POST /api/shipping/rates` to the gateway. Returns store shipping rates for a given pincode and subtotal. | 38 |
| `apps/storefront-runtime/src/app/api/customer/addresses/route.ts` | BFF proxy. `GET /api/customer/addresses` returns saved addresses for authenticated customers. Used by checkout for autofill. | 134 |
| `apps/storefront-runtime/src/app/api/customer/auto-create/route.ts` | BFF proxy. `POST /api/customer/auto-create` creates a guest customer record after order success. Fire-and-forget (errors do not block checkout). | 29 |
| `apps/storefront-runtime/src/app/api/orders/check/route.ts` | Order lookup by order number / email for guest order tracking. | — |
| `apps/storefront-runtime/src/app/api/orders/login/route.ts` | Customer login via order number. | — |
| `apps/storefront-runtime/src/app/api/orders/set-password/route.ts` | Set account password for guest customer after first order. | — |
| `apps/storefront-runtime/src/app/api/customer/orders/route.ts` | Authenticated customer order history. | — |

### Storefront Runtime — Lib (checkout-related)

| File | Purpose |
|---|---|
| `apps/storefront-runtime/src/lib/api/browser-client.ts` | `storefrontBrowserApiFetch(subdomain, path)` — constructs same-origin URL `/api/storefront/{subdomain}{path}` for browser-side gateway calls. Used by checkout for Razorpay order creation and signature verification. |
| `apps/storefront-runtime/src/lib/order-service.ts` | Server-side order service (referenced by lib grep). |
| `apps/storefront-runtime/src/lib/customer-service.ts` | Server-side customer service. |

---

### API Gateway — Checkout & Payment Routes

| File | Purpose | Lines |
|---|---|---|
| `services/api-gateway/src/routes/checkout.ts` | Hosted checkout session router (cart-handoff flow). Handles HMAC-signed cart handoff verification, session state machine (`contact` → `delivery` → `payment_intent` → `completed`/`failed`), order creation via `OrderExecutionAdapter`, payment capture via `PaymentExecutionAdapter`, compensation recording on failure, domain event emission. Mounted at `/v1/checkout`. Also hosts `publicStoreBrandingRouter` and `storeBrandingManagementRouter`. | 816 |
| `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts` | Direct storefront order + payment routes. Registered into the `/v1/storefront` router by `public-routes.ts`. Covers: `POST /{subdomain}/orders` (create order RPC with GST + shipping-rate resolution), `POST /{subdomain}/payments/razorpay/order`, `POST /{subdomain}/payments/razorpay/verify`, `POST /{subdomain}/payments/cashfree/order`, `POST /{subdomain}/payments/cashfree/verify`, `POST /{subdomain}/payments/stripe/checkout`, `POST /{subdomain}/payments/paypal/order`, `POST /{subdomain}/payments/paypal/capture`. | 1274 |
| `services/api-gateway/src/routes/storefront/cart-routes.ts` | Server-side cart persistence. Registered into the `/v1/storefront` router. Covers: `POST /{subdomain}/cart` (create), `GET /{subdomain}/cart/{cartToken}`, `PATCH /{subdomain}/cart/{cartToken}` (update), `PUT /{subdomain}/cart/{cartToken}/buyer-identity`, `POST /{subdomain}/cart/{cartToken}/discount-codes`, `GET /{subdomain}/cart/{cartToken}/checkout-url` (HMAC-signed handoff URL), `DELETE /{subdomain}/cart/{cartToken}`. Emits `cart.created`, `cart.email_captured`, `cart.abandoned` domain events. | 622 |
| `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` | Internal payment routes protected by `INTERNAL_API_SECRET`. `GET /internal/orders/{orderId}/payable`, `POST /internal/payments/reference` (attach provider order ID), `POST /internal/payments/confirm` (confirm payment + emit `order.paid`), `POST /internal/payments/failure`, `POST /internal/payments/event`. Used by queue-workers and webhooks. | 233 |
| `services/api-gateway/src/routes/storefront/public-routes.ts` | Aggregator that registers `registerStorefrontCartRoutes`, `registerStorefrontCheckoutPaymentRoutes`, `registerStorefrontCustomerEngagementRoutes` onto the main storefront router. Also hosts coupon validation (`GET /{subdomain}/coupons/validate`), product/collection/search/review endpoints. | ~1300 |

### API Gateway — Supporting Routes

| File | Purpose | Lines |
|---|---|---|
| `services/api-gateway/src/routes/coupons.ts` | Merchant coupon CRUD. `GET /v1/coupons`, `POST /v1/coupons`, `GET /v1/coupons/:id`, `PATCH /v1/coupons/:id`, `DELETE /v1/coupons/:id`, `POST /v1/coupons/validate`. V1 supports `percentage`, `fixed`, `free_shipping`; `bogo` is blocked at API layer. Pricing authority is checkout (server-side RPC), not this endpoint. | 304 |
| `services/api-gateway/src/routes/shipping.ts` | Shipping serviceability and rates. `GET /v1/shipping/serviceability/:pincode`, `POST /v1/shipping/rates` (reads `shipping_rates` table; falls back to a sandbox `standard` rate), `GET /v1/shipping/track/:trackingNumber`. Supports `shiprocket`, `delhivery`, `pickrr`. Live credentials guarded by `[HUMAN-REQUIRED]`. | 175 |

---

### Merchant Control Plane — Checkout Config

| File | Purpose | Lines |
|---|---|---|
| `apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx` | Merchant checkout-form settings UI. Configures `contact_method` (email/phone/both), `customer_accounts` (disabled/optional/required), `full_name`, `company_name`, `order_notes`, `tip_option`. Reads/writes via `GET /api/stores/{store}/settings` + `PATCH /api/stores/{store}/settings`. | 372 |
| `apps/merchant-control-plane/src/app/[store]/settings/payments/page.tsx` | Merchant payment settings UI. Configures Razorpay `key_id`, `key_secret`, sandbox/live mode. Shows COD and online payment enabled status. Reads via `GET /api/stores/{store}/payment-config`, saves via `POST /api/stores/{store}/payment-config`. | 416 |
| `apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts` | MCP BFF proxy for payment config. `GET` fetches via `createMerchantApiClient().stores.paymentConfig.get(storeId)`. `POST` saves `key_id`, `key_secret`, `test_mode` via `createMerchantApiClient().stores.paymentConfig.save(...)`. | 48 |

---

## 2. Route Map

### Storefront Public Routes (browser-facing)

| URL Pattern | Handler | Method | Purpose |
|---|---|---|---|
| `/store/{subdomain}/cart` | `apps/storefront-runtime/src/app/store/[subdomain]/cart/cart-client.tsx` (page) | GET (navigate) | Full-page cart view |
| `/store/{subdomain}/checkout` | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx` | GET (navigate) | Main checkout page (two-step: address then payment) |
| `/store/{subdomain}/checkout/success` | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx` | GET (navigate) | Order status stub; redirects to orders page (stale Stripe return) |
| `/store/{subdomain}/checkout/paypal-return` | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/paypal-return/page.tsx` | GET (navigate) | PayPal return stub; redirects to orders page (PayPal deferred) |

### Storefront BFF API Routes (same-origin Next.js API)

| URL Pattern | File | Method | Purpose |
|---|---|---|---|
| `/api/orders` | `storefront-runtime/src/app/api/orders/route.ts` | POST | Create checkout order (COD or Razorpay). Proxies to gateway. |
| `/api/coupons/validate` | `storefront-runtime/src/app/api/coupons/validate/route.ts` | GET | Validate coupon code against subdomain and subtotal. Proxies to gateway. |
| `/api/shipping/rates` | `storefront-runtime/src/app/api/shipping/rates/route.ts` | POST | Fetch store shipping rates for a pincode and subtotal. Proxies to gateway. |
| `/api/customer/addresses` | `storefront-runtime/src/app/api/customer/addresses/route.ts` | GET | Return saved customer addresses for autofill. Proxies to gateway. |
| `/api/customer/auto-create` | `storefront-runtime/src/app/api/customer/auto-create/route.ts` | POST | Fire-and-forget guest customer creation after order. |
| `/api/storefront/{subdomain}/payments/razorpay/order` | (BFF proxy via `storefrontBrowserApiFetch`) | POST | Create Razorpay order. Calls gateway `POST /v1/storefront/{subdomain}/payments/razorpay/order`. |
| `/api/storefront/{subdomain}/payments/razorpay/verify` | (BFF proxy via `storefrontBrowserApiFetch`) | POST | Verify Razorpay signature. Calls gateway `POST /v1/storefront/{subdomain}/payments/razorpay/verify`. |

### Gateway Storefront Routes (cart + checkout + payment)

All mounted under `/v1/storefront`.

| URL Pattern | File | Method | Purpose |
|---|---|---|---|
| `/v1/storefront/{subdomain}/cart` | `cart-routes.ts` | POST | Create or upsert server-side cart |
| `/v1/storefront/{subdomain}/cart/{cartToken}` | `cart-routes.ts` | GET | Fetch cart by token |
| `/v1/storefront/{subdomain}/cart/{cartToken}` | `cart-routes.ts` | PATCH | Update cart items |
| `/v1/storefront/{subdomain}/cart/{cartToken}/buyer-identity` | `cart-routes.ts` | PUT | Attach email/customer ID to cart |
| `/v1/storefront/{subdomain}/cart/{cartToken}/discount-codes` | `cart-routes.ts` | POST | Apply coupon codes to server cart |
| `/v1/storefront/{subdomain}/cart/{cartToken}/checkout-url` | `cart-routes.ts` | GET | Generate HMAC-signed checkout handoff URL |
| `/v1/storefront/{subdomain}/cart/{cartToken}` | `cart-routes.ts` | DELETE | Clear cart items |
| `/v1/storefront/{subdomain}/orders` | `checkout-payment-routes.ts` | POST | Create checkout order (server-authoritative totals, GST, shipping) |
| `/v1/storefront/{subdomain}/payments/razorpay/order` | `checkout-payment-routes.ts` | POST | Create Razorpay payment intent |
| `/v1/storefront/{subdomain}/payments/razorpay/verify` | `checkout-payment-routes.ts` | POST | Verify Razorpay HMAC signature + confirm payment |
| `/v1/storefront/{subdomain}/payments/cashfree/order` | `checkout-payment-routes.ts` | POST | Create Cashfree payment intent |
| `/v1/storefront/{subdomain}/payments/cashfree/verify` | `checkout-payment-routes.ts` | POST | Verify Cashfree payment |
| `/v1/storefront/{subdomain}/payments/stripe/checkout` | `checkout-payment-routes.ts` | POST | Create Stripe checkout session (deferred, LB-2) |
| `/v1/storefront/{subdomain}/payments/paypal/order` | `checkout-payment-routes.ts` | POST | Create PayPal order (deferred, LB-2) |
| `/v1/storefront/{subdomain}/payments/paypal/capture` | `checkout-payment-routes.ts` | POST | Capture PayPal payment |
| `/v1/storefront/{subdomain}/coupons/validate` | `public-routes.ts` | GET | Public storefront coupon validation |
| `/v1/storefront/internal/orders/{orderId}/payable` | `internal-payment-routes.ts` | GET | Internal: read payable order |
| `/v1/storefront/internal/payments/reference` | `internal-payment-routes.ts` | POST | Internal: attach provider order reference |
| `/v1/storefront/internal/payments/confirm` | `internal-payment-routes.ts` | POST | Internal: confirm payment + emit `order.paid` |
| `/v1/storefront/internal/payments/failure` | `internal-payment-routes.ts` | POST | Internal: record payment failure/refund state |
| `/v1/storefront/internal/payments/event` | `internal-payment-routes.ts` | POST | Internal: record raw provider event |

### Gateway Hosted Checkout Routes (cart-handoff flow)

All mounted under `/v1/checkout`.

| URL Pattern | File | Method | Purpose |
|---|---|---|---|
| `/v1/checkout/{cartId}/contact` | `checkout.ts` | POST | Submit customer email/name/phone; emits `checkout.started` |
| `/v1/checkout/{cartId}/delivery` | `checkout.ts` | POST | Submit shipping address and method; resolves rate server-side |
| `/v1/checkout/{cartId}/payment-intent` | `checkout.ts` | POST | Record payment provider and mode |
| `/v1/checkout/{cartId}/confirm` | `checkout.ts` | POST | Confirm order; creates order + confirms payment; emits `checkout.completed` |
| `/v1/checkout/{id}` | `checkout.ts` | GET | Read checkout session state |
| `/v1/stores/{storeId}/branding` | `checkout.ts` (`publicStoreBrandingRouter`) | GET | Public store branding (colors, logo, checkout theme) |
| `/v1/stores/{storeId}/branding` | `checkout.ts` (`storeBrandingManagementRouter`) | PUT | Merchant: update store branding |

### Gateway Merchant Routes (shipping, coupons)

| URL Pattern | File | Method | Purpose |
|---|---|---|---|
| `/v1/coupons` | `coupons.ts` | GET | List store coupons |
| `/v1/coupons` | `coupons.ts` | POST | Create coupon |
| `/v1/coupons/:id` | `coupons.ts` | GET | Get coupon |
| `/v1/coupons/:id` | `coupons.ts` | PATCH | Update coupon |
| `/v1/coupons/:id` | `coupons.ts` | DELETE | Deactivate coupon (soft delete) |
| `/v1/coupons/validate` | `coupons.ts` | POST | Merchant-auth coupon validation |
| `/v1/discounts` | `coupons.ts` | (all) | Alias to `/v1/coupons` |
| `/v1/shipping/serviceability/:pincode` | `shipping.ts` | GET | Pincode serviceability check |
| `/v1/shipping/rates` | `shipping.ts` | POST | Fetch active shipping rates |
| `/v1/shipping/track/:trackingNumber` | `shipping.ts` | GET | Carrier shipment tracking |

### Merchant Control Plane — Payment Config Routes

| URL Pattern | File | Method | Purpose |
|---|---|---|---|
| `/api/stores/{store}/payment-config` | `merchant-control-plane/.../payment-config/route.ts` | GET | Fetch masked Razorpay config |
| `/api/stores/{store}/payment-config` | `merchant-control-plane/.../payment-config/route.ts` | POST | Save Razorpay key_id + key_secret + test_mode |
| `/api/stores/{store}/settings` | (merchant settings BFF) | GET | Fetch site_settings (includes checkout sub-object) |
| `/api/stores/{store}/settings` | (merchant settings BFF) | PATCH | Update checkout settings |

---

## 3. Dependency Map

### checkout-client.tsx — Imports

| Import | Source | What it provides |
|---|---|---|
| `useCart` | `@/context/cart-context` | `items`, `cartTotal`, `clearCart` — the entire client cart state |
| `useEffect`, `useRef`, `useState` | `react` | React hooks for state, effects, ref-based idempotency keys |
| `Image` / `ImageLoaderProps` | `next/image` | Product image rendering with passthrough loader |
| `Button`, `Input`, `AlertCircle`, `ArrowLeft`, `CheckCircle`, `CreditCard`, `Loader2`, `Lock`, `ShieldCheck`, `MapPin`, `Truck`, `Clock`, `Package`, `User`, `Phone`, `Mail`, `Home` | `@letbuyy/ui` | All UI primitives (design system) |
| `Link` | `next/link` | Client-side navigation |
| `motion`, `AnimatePresence` | `framer-motion` | Step transition animations |
| `Script` | `next/script` | Loads Razorpay checkout.js from CDN |
| `readStorefrontApiJson`, `storefrontBrowserApiFetch`, `storefrontApiErrorMessage` | `@/lib/api/browser-client` | Same-origin gateway proxy calls (Razorpay order + verify) |
| `StorefrontEmptyState` | `@/components/storefront/storefront-states` | Empty cart state UI |
| `window.Razorpay` | (declared global via `declare global`) | Razorpay browser SDK (loaded by `<Script>`) |

### checkout.ts (gateway) — RPCs and DB Operations

| Operation | Table / RPC | Purpose |
|---|---|---|
| `db.from('carts').select(...)` | `carts` | Verify cart exists and belongs to site during handoff |
| `db.from('checkout_sessions').select/insert/update(...)` | `checkout_sessions` | Persist checkout state machine steps |
| `db.from('inventory_reservations').select(...)` | `inventory_reservations` | Revalidate active inventory reservations on confirm |
| `db.from('coupons').select(...)` | `coupons` | Revalidate discount codes on confirm |
| `db.from('ledger_transactions').select(...)` | `ledger_transactions` | Prove payment capture was posted to ledger |
| `db.from('compensation_actions').upsert(...)` | `compensation_actions` | Record pending refund compensation on failure |
| `db.from('carts').update({status: 'converted'})` | `carts` | Mark cart as converted after successful order |
| `new OrderExecutionAdapter(db).createOrder(command, tenant)` | RPC `create_checkout_order` (via adapter) | Create the canonical order |
| `new PaymentExecutionAdapter(db).confirmPayment(...)` | RPC `confirm_order_payment_with_ledger` (via adapter) | Post payment capture to ledger |
| `new IdempotencyExecutionAdapter(db).begin/complete/fail(...)` | `idempotency_keys` | Per-step idempotency guard |
| `new EventExecutionAdapter(db).emitDomainEvent(...)` | `domain_events` | Emit `checkout.started`, `checkout.completed`, `checkout.failed` |

---

## 4. Integration Points

### Cart ↔ Checkout

Cart state is managed entirely in the browser via `CartContext` (`apps/storefront-runtime/src/context/cart-context.tsx`). The context stores items in `localStorage` (key: `lb_cart`) and a server cart token in `localStorage` (key: `lb_cart_token`). On every mutation it syncs to the gateway via `POST /api/storefront/{subdomain}/cart` (new cart) or `PATCH /api/storefront/{subdomain}/cart/{cartToken}` (existing cart).

When the customer navigates to checkout, `CheckoutClient` reads `items`, `cartTotal`, and `clearCart` directly from `useCart()`. No additional API call is needed to load cart data — it is already in React state from the context. The items are passed directly into `buildOrderPayload()` as the order line items. On order success, `clearCart()` is called to empty context and localStorage.

The gateway cart server (`cart-routes.ts`) is the canonical server-side cart, but the storefront checkout (`checkout-client.tsx`) uses the context items (not a fresh server cart read) to build the order payload. The gateway's order RPC (`create_checkout_order`) is the authoritative price and inventory resolver.

### Checkout ↔ Payment

Two-phase for Razorpay online payments:

1. **Phase 1 — Order creation:** `checkout-client.tsx` calls `POST /api/orders` (storefront BFF) with the full order payload including items, customer, address, paymentMethod `'razorpay'`, shippingRateId, couponCode, and a `crypto.randomUUID()` idempotencyKey. The gateway creates the order row (via `create_checkout_order` RPC). Returns `{ id, orderNumber, status, total }`.

2. **Phase 2 — Razorpay order:** `checkout-client.tsx` calls `storefrontBrowserApiFetch(subdomain, '/payments/razorpay/order', ...)` → resolves to `POST /api/storefront/{subdomain}/payments/razorpay/order`. The gateway loads the order by ID, calls `createRazorpayPaymentProvider().createIntent(...)`, attaches `providerOrderId` to the order row, and returns `{ keyId, razorpayOrderId, amount, currency }`.

3. **Phase 3 — Razorpay checkout modal:** `new window.Razorpay(options).open()` launches the modal. On success, the `handler` calls `storefrontBrowserApiFetch(subdomain, '/payments/razorpay/verify', ...)` → gateway verifies HMAC signature (`timingSafeEqualHex`), checks provider payment not already replayed via `assertProviderPaymentNotReplayed`, then calls `paymentService.confirmPayment(...)` which triggers the `confirm_order_payment_with_ledger` RPC. Returns `{ verified: true }`.

For COD, only Phase 1 is executed with `paymentMethod: 'cod'`. The RPC handles COD internally.

The Razorpay browser SDK is loaded via `<Script src="https://checkout.razorpay.com/v1/checkout.js">` at render time; a `razorpayLoaded` flag gates the Pay button.

### Checkout ↔ Coupon

In `checkout-client.tsx`, when the customer clicks "Apply":
1. `fetch('/api/coupons/validate?code={code}&subdomain={subdomain}&subtotal={cartTotal}')` — GET request to the storefront BFF.
2. The BFF proxies to the gateway storefront coupon validation (`GET /v1/storefront/{subdomain}/coupons/validate`).
3. A valid response returns `{ valid: true, coupon: { code, type, value, discount, freeShipping } }`.
4. The `appliedCoupon` state is set; `discountAmount` and `effectiveDeliveryCharges` are recalculated in the client.
5. When order is placed, `couponCode: appliedCoupon?.code` is included in `buildOrderPayload()` and sent to the gateway for final authoritative discount application inside the `create_checkout_order` RPC.

Note: the coupon `discount` and `freeShipping` amounts are computed client-side for display only. The canonical discount is always applied by the server RPC (pricing authority = checkout).

### Checkout ↔ Shipping

On component mount (and when `cartTotal` changes), `checkout-client.tsx` fires:
```
POST /api/shipping/rates  { store_id, pincode: '000000', subtotal_minor }
```
A placeholder pincode `'000000'` is used at mount time because the real pincode is not yet entered. The BFF proxies to `POST /v1/shipping/rates`.

The gateway queries `shipping_rates` table for the store (filtered by `is_active = true`). If rates exist, they are returned. If none exist (or only the `sandbox-standard` fallback), the client falls back to the hardcoded `standard = FREE` / `express = ₹99` UI.

The selected rate's `id` is passed as `shippingRateId` in the order payload. The gateway `checkout-payment-routes.ts` calls `resolveShippingRate(db, store.id, body.shippingRateId)` to look up the canonical rate server-side (client-supplied price is never trusted).

### Checkout ↔ Order

After a successful Razorpay signature verification (or COD confirmation), the gateway has already persisted the order via `create_checkout_order`. The response includes `{ id, orderNumber, status, total }`.

In `checkout-client.tsx`, on success:
1. `setOrderNumber(result.order.orderNumber)` — displayed in the inline success screen.
2. `setIsSuccess(true)` — switches the UI to the confirmation card.
3. `clearCart()` — empties localStorage and React state.
4. `autoCreateCustomer()` — fire-and-forget `POST /api/customer/auto-create` to create a guest customer row.

There is no redirect to a separate success page. The success screen is rendered inline in `checkout-client.tsx` via `if (isSuccess) return <SuccessUI>`.

The `/store/{subdomain}/checkout/success` page is a stub kept only for stale Stripe redirect links; Razorpay flow does not use it.

---

## 5. State Management

All checkout state is managed in the browser using React `useState` hooks within `CheckoutClient`. There is no Redux, Zustand, or URL-state-based checkout state. Specific state variables:

| State | Type | Purpose |
|---|---|---|
| `step` | `1 | 2` | Which checkout step is visible (1 = Address, 2 = Review & Pay) |
| `formData` | `FormData` | Name, email, phone, address, city, state, pincode |
| `errors` | `Partial<FormData>` | Field validation errors |
| `paymentMethod` | `'online' | 'cod'` | Selected payment method |
| `deliveryOption` | `'standard' | 'express'` | Fallback delivery type when no store rates |
| `storeRates` | `StoreShippingRate[] | null` | Real store shipping rates (null = fallback) |
| `selectedRateId` | `string | null` | Selected rate from `storeRates` |
| `appliedCoupon` | `AppliedCoupon | null` | Active coupon with discount amounts |
| `couponInput` | `string` | Raw coupon input field value |
| `isProcessing` | `boolean` | Prevents double-submit during payment |
| `isSuccess` | `boolean` | Triggers inline success screen |
| `orderNumber` | `string` | Displayed in success screen |
| `razorpayLoaded` | `boolean` | Set by `<Script onLoad>` for Razorpay SDK |
| `savedAddresses` | `SavedAddress[]` | Loaded from `/api/customer/addresses` on mount |
| `idempotencyKeysRef` | `useRef<Record<string, string>>` | Per-scope idempotency keys (never regenerated mid-session) |

Cart state lives in `CartContext` (persisted to `localStorage` with keys `lb_cart` and `lb_cart_token`). `CheckoutClient` reads `items`, `cartTotal`, `clearCart` from `useCart()`.

There are no cookies, URL params, or session-storage used for checkout state in the storefront-runtime client. The cart token (`lb_cart_token`) in localStorage is the only cross-page persistence identifier.

---

## 6. External Services Used

### Razorpay (active in V1)

- **Browser SDK:** `https://checkout.razorpay.com/v1/checkout.js` — loaded via `<Script>` in `checkout-client.tsx`. Provides `window.Razorpay` constructor.
- **Server-side:** `createRazorpayPaymentProvider({ keyId, keySecret })` from `@letbuyy/infrastructure/razorpay-adapter`. Called in `checkout-payment-routes.ts` to `createIntent` and `verify` (HMAC-SHA256 signature check using `timingSafeEqualHex`).
- **Environment variables:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in the gateway. Merchant-specific keys stored encrypted (managed via payment-config API).

### Cashfree (adapter present, not exposed in checkout-client.tsx V1 UI)

- `createCashfreePaymentProvider(credentials)` from `@letbuyy/infrastructure/cashfree-adapter`.
- Routes exist: `POST /payments/cashfree/order` and `POST /payments/cashfree/verify`.
- Environment variables: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENVIRONMENT`, `CASHFREE_API_VERSION`.
- Not surfaced in the storefront UI (`checkout-client.tsx` only shows Razorpay and COD).

### Stripe (deferred — LB-2)

- `createStripePaymentProvider({ secretKey })` from `@letbuyy/infrastructure/stripe-adapter`.
- Route exists: `POST /payments/stripe/checkout`.
- Environment variable: `STRIPE_SECRET_KEY`.
- Comment in `checkout-client.tsx` line 99: "V1 ships Razorpay+COD; Stripe and PayPal deferred (LB-2)".
- The `/checkout/success` page stub was kept for stale Stripe redirect links.

### PayPal (deferred — LB-2)

- `createPayPalPaymentProvider(credentials)` from `@letbuyy/infrastructure/paypal-adapter`.
- Routes exist: `POST /payments/paypal/order` and `POST /payments/paypal/capture`.
- Environment variables: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`.
- The `/checkout/paypal-return` stub was kept for stale PayPal return links.

### Shiprocket / Delhivery / Pickrr (logistics, sandbox default)

- `createLogisticsProvider(providerName, options)` from `@letbuyy/infrastructure/logistics-adapter`.
- Used in `shipping.ts` for `GET /shipping/track/:trackingNumber`.
- Live credentials guarded by `[HUMAN-REQUIRED]` comment; `sandbox` mode used otherwise.
- Environment variables: `SHIPROCKET_TOKEN`, `DELHIVERY_TOKEN`, `PICKRR_TOKEN`.

### Framer Motion

- `motion`, `AnimatePresence` from `framer-motion`.
- Used in `checkout-client.tsx` and `cart-drawer.tsx` for step transitions and slide-in/out animations.

### Resend (email, post-payment)

- `enqueueOrderConfirmationEmail` imported in `storefront.ts` (line 23).
- Fires after `order.paid` event via `emitStorefrontOrderPaidEvent`.
- Not directly referenced in checkout-client but part of the post-payment flow.

# Conversion Optimization Analysis

_Research date: 2026-06-18. Evidence-only. No code was modified._

---

## 1. Current Checkout Analytics

### What Events Are Tracked

The analytics pipeline defines and consumes five storefront events that constitute the upper-funnel measurement:

| Event name | Source | Notes |
|---|---|---|
| `storefront.sessions.active` | `analytics_rollups_daily` | Active session count |
| `storefront.sessions.started` | `analytics_rollups_daily` | Session starts / visitor arrivals |
| `storefront.page.view` / `storefront.page.views` | `analytics_rollups_daily` | Page-level impressions |
| `storefront.cart.added` | `analytics_rollups_daily` | Add-to-cart signals |
| `storefront.checkouts.started` | `analytics_rollups_daily` | Checkout entry point |

_Source: `services/api-gateway/src/routes/analytics.ts` lines 31–42, `LIVE_VIEW_METRICS` constant._

The gateway also tracks lower-funnel order outcomes via rollup metrics `orders.created`, `orders.paid`, and `revenue.paid_minor` consumed by `/analytics/dashboard` and `/analytics/revenue` endpoints.

Cart-level domain events are emitted by `emitCartEvent()` in `services/api-gateway/src/routes/storefront/cart-routes.ts`:
- `cart.created`
- `cart.email_captured` — fired when `buyer_email` is present on the cart record
- `cart.abandoned` — fired when the abandonment check is enqueued (see §2)

### What Is NOT Tracked

No event is fired for any of the following checkout funnel stages, confirmed by the absence of any `track`, `event`, `analytics`, `gtm`, `pixel`, `mixpanel`, or `segment` call in `checkout-client.tsx`:

- Step 1 form started (address page viewed)
- Contact info entered / validated
- Shipping method selected
- "Continue to Payment" clicked (step transition)
- Payment method selected (online vs COD)
- Razorpay modal opened
- Razorpay modal dismissed without payment
- Payment failed (`payment.failed` Razorpay event is handled locally but fires no analytics event)
- Order confirmed (success screen displayed)

_Source: `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` — full file search for tracking calls returned zero results; only `payment.failed` appears on line 57 as the Razorpay SDK event type declaration._

### Analytics Integration

There is no unified client-side analytics integration (no GTM, no Segment, no Mixpanel, no Meta Pixel) present in `checkout-client.tsx` or `cart-client.tsx`. The analytics system is entirely server-side, reading from the `analytics_rollups_daily` Postgres table. The `storefront.checkouts.started` metric must be emitted server-side or from a middleware layer not visible in the checkout component; its exact emission point is not in the checkout client.

---

## 2. Cart Abandonment System

### Does Abandonment Tracking Exist?

Partial infrastructure exists. The `enqueueAbandonmentCheck()` function in `cart-routes.ts` (lines 340–382) writes a `cart.abandonment_check` job to `platform_queue_jobs` with `queue_name: 'analytics-events'` and `available_at: +1 hour`. It requires `buyer_email` to be set and the cart to have at least one line.

The job is enqueued successfully; however, `services/queue-workers/src/platform-queue-consumer.ts` contains no handler for `job_type: 'cart.abandonment_check'`. Grep across all queue-worker source files returns zero matches for `abandonment_check`, `cart.abandoned`, or `abandoned`. **The job is enqueued but never consumed — no recovery action is taken downstream.**

_Source: `services/api-gateway/src/routes/storefront/cart-routes.ts` lines 340–382; `services/queue-workers/src/` full search — no consumer found._

### Cart Persistence

The cart is stored client-side in `localStorage` under two keys: `CART_STORAGE_KEY` (serialized item array) and `CART_TOKEN_STORAGE_KEY` (server cart token). On mount, items are loaded from `localStorage`; mutations sync to a server `carts` table record via `/api/cart` and write the cart token back to `localStorage`.

_Source: `apps/storefront-runtime/src/context/cart-context.tsx` lines 111, 129, 154–155, 170._

**Durability contract:** items survive browser reload and tab close (localStorage). They do NOT survive clearing browser storage, using a different browser/device, or private-mode sessions. There is no server-side cart restore by email or session for unauthenticated shoppers.

### Recovery Email System

No "you left items in your cart" email flow exists. The `cart.abandonment_check` queue job payload carries `buyer_email`, `cart_id`, and `cart_token`, but there is no queue consumer that reads this job and dispatches an email or WhatsApp message.

The WhatsApp routes file (`whatsapp.ts`) includes `'abandoned_cart'` in a template key array (line 32) and a `cart_abandonment` session type (line 341), indicating an intent to send WhatsApp recovery messages, but no automated trigger wires the enqueued job to this template.

_Source: `services/api-gateway/src/routes/whatsapp.ts` lines 32, 341; queue-workers `src/` — no abandonment consumer._

---

## 3. Checkout Funnel Tracking

| Stage | Tracked? | Event Name | Evidence |
|---|---|---|---|
| Product view | YES | `storefront.product.views` | `analytics.ts` line 36 — in `LIVE_VIEW_METRICS` |
| Add to cart | YES | `storefront.cart.added` | `analytics.ts` line 37 — in `LIVE_VIEW_METRICS` |
| Cart → Begin checkout | YES (server-side) | `storefront.checkouts.started` | `analytics.ts` line 38 — in `LIVE_VIEW_METRICS`; emission point not in `checkout-client.tsx` |
| Contact info entered | NO | — | No event in `checkout-client.tsx`; `validateForm()` fires no analytics call |
| Shipping method selected | NO | — | `setDeliveryOption` / `setSelectedRateId` fire no analytics call |
| Payment method selected | NO | — | `setPaymentMethod` fires no analytics call |
| Order confirmed | NO | — | `setIsSuccess(true)` fires no analytics call; only `autoCreateCustomer()` is called |
| Payment failed | NO | — | `rzp.on('payment.failed', ...)` sets local state only; no analytics event emitted |
| Cart abandoned | PARTIAL | `cart.abandoned` | Emitted as domain event + job enqueued, but no downstream consumer acts on it |

---

## 4. Conversion Dashboard

The merchant dashboard (`DashboardClient.tsx`) renders four `MetricCard` components:

1. **Revenue** — `formatInrCurrency(homeData.totalRevenue)` with period-over-period `revenueChangePct` delta. Sourced from `orders.paid` / `revenue.paid_minor` rollups.
2. **Orders** — `formatNumber(homeData.totalOrders)` with `ordersChangePct` delta.
3. **Visitors** — hard-coded string `"Not tracked"` with delta `"Needs storefront session analytics"`.
4. **Conversion** — hard-coded string `"Not tracked"` with delta `"Needs visitor and checkout funnel data"`.

_Source: `DashboardClient.tsx` lines 342–366._

The dashboard explicitly acknowledges that conversion rate is uncomputed because visitor and funnel data are not yet wired. Revenue and order counts are available; conversion rate, visitor count, and checkout funnel metrics are absent from the merchant-facing view.

---

## 5. Payment Failure Recovery

When Razorpay fires `payment.failed`:

```
rzp.on('payment.failed', function () {
    setIsProcessing(false);
    showCheckoutError('Payment failed. Please try again.');
});
```

- `isProcessing` is reset to `false`.
- An error banner is shown at the top of the page.
- The checkout stays on Step 2 (payment step) with all previously entered address and item data intact.
- The Razorpay SDK instance was already created via `new window.Razorpay(options)` — to retry, the customer clicks the pay button again, which calls `handlePayment()` again, which re-creates a new `razorpay` instance. **The form data is preserved in React state across the failure; re-entry is not required.**
- The previously created order (`createCheckoutOrder('razorpay')`) is NOT reused — a new order is created on each `handlePayment()` call. Idempotency is handled by `getIdempotencyKey()` which returns the same key for `'order-razorpay'` scope within the same component mount, so the second attempt will reuse the same order.
- There is no explicit "retry payment" button — the same "Pay ₹X" CTA reruns the full flow.
- Razorpay modal dismiss (`ondismiss`) also resets `isProcessing` to `false`, leaving the checkout in a retry-ready state.

_Source: `checkout-client.tsx` lines 534–548, 256–261, 445–549._

**Summary:** payment failure is recoverable in the current session without re-entering data, but the UX does not proactively explain the retry path beyond a generic error message.

---

## 6. Express Checkout

No "buy now" or express checkout path exists. The only checkout entry point across the storefront runtime is the standard `/store/{subdomain}/checkout` route, reachable only after adding items to the cart and navigating through the cart page. No single-product direct checkout, no product-page buy button that bypasses the cart, and no one-click purchase flow were found.

_Source: Full `buy_now`, `buyNow`, `express.*checkout`, `quick.*buy`, `one.*click` grep across `apps/storefront-runtime` — zero results._

---

## 7. Checkout Performance

No code-splitting, lazy imports, `Suspense`, or `preload`/`prefetch` directives are present in `checkout-client.tsx` itself. The only external script load is the Razorpay SDK via Next.js `<Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={...} />`, which uses Next.js's default `afterInteractive` strategy and gates the payment button via `razorpayLoaded` state to prevent clicks before the SDK is ready.

The checkout component is a monolithic client component (`'use client'`) loaded as a single bundle. Framer Motion is included for step transitions. Image loading uses `next/image` with `unoptimized` and a passthrough loader, which bypasses Next.js image optimization.

_Source: `checkout-client.tsx` lines 1–11, 621–625; no `dynamic()` import, `React.lazy`, or `Suspense` boundaries found._

---

## 8. Conversion Optimization Gaps

### 1. Cart Abandonment Recovery — PARTIAL (infrastructure only, no downstream action)

The `cart.abandonment_check` job is enqueued to `platform_queue_jobs` when `buyer_email` is captured and cart has items. The job fires +1 hour after the email is captured. However, `platform-queue-consumer.ts` contains no handler for this job type. Neither the recovery email flow nor the WhatsApp `abandoned_cart` template is wired to the queue job. The `abandoned_cart` WhatsApp template key exists in `whatsapp.ts` but has no automated trigger.

### 2. Payment Failure Retry UX — PARTIAL (functional but minimal)

Payment failure preserves form state and reuses the idempotency key for the order, so retry works without re-entry. However, the UX shows only a generic error banner with no explicit retry CTA, no explanation of what failed, and no alternative payment suggestion (e.g. "try COD instead").

### 3. Address Autocomplete — MISSING

No Google Places, India Post PIN-to-city lookup, or any address autocomplete integration exists in the checkout form. The pincode field is a free-text input with only a 6-digit numeric validation. City and state fields are also free-text with no lookup or auto-fill from pincode.

_Source: `checkout-client.tsx` lines 805–816; grep for `google.*places`, `postai`, `pincode.*lookup` — zero results._

### 4. Saved Addresses for Returning Customers — PARTIAL (UI exists, backend required)

`checkout-client.tsx` fetches saved addresses via `GET /api/customer/addresses` and renders address autofill buttons if the response contains data. The `applySavedAddress()` function fills the form from a `SavedAddress` object. This feature is functional if the customer has saved addresses in the backend, making it a partial implementation dependent on customer authentication and prior address saves.

_Source: `checkout-client.tsx` lines 192–205, 280–292._

### 5. One-Click Reorder — MISSING

No "reorder" action exists in the storefront runtime. Order history pages (linked from checkout success via `/store/{subdomain}/orders`) are not audited here, but no express reorder path populating the cart from a past order was found.

### 6. Express Checkout (from product page) — MISSING

No buy-now flow exists. Confirmed by full grep across `apps/storefront-runtime` (see §6).

### 7. Checkout Progress Persistence (Reload-Safe) — MISSING

The checkout form state (`formData`, `step`, `paymentMethod`, `appliedCoupon`) lives exclusively in React component state. A page reload returns the customer to an empty Step 1 form, losing all entered address data. The cart items persist via `localStorage`, but the checkout form itself does not.

_Source: `checkout-client.tsx` lines 156–184 — all state via `useState`, no `localStorage` or `sessionStorage` save._

### 8. SMS/WhatsApp OTP for Checkout — MISSING

There is no OTP-based identity verification at checkout. The phone field is captured for delivery contact only. No SMS or WhatsApp OTP step gates the checkout flow.

_Source: `checkout-client.tsx` full text — no OTP, SMS, or WhatsApp send call._

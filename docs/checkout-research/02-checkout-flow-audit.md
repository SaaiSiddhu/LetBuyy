# Checkout Flow Audit

**Evidence source:** direct file reads and grep output from commit `stepup/main` as of 2026-06-18.
**Scope:** storefront-runtime checkout UI + api-gateway checkout/order/payment routes + execution adapters.

---

## 1. Complete Flow Map (Step by Step)

```
STEP 1: Shopping Cart
  File: apps/storefront-runtime/src/app/store/[subdomain]/cart/cart-client.tsx (lines 1–199)
  What happens:
    - useCart() hook provides client-side cart state (items, cartTotal, removeFromCart,
      updateQuantity, clearCart).
    - Items are displayed with quantity controls; quantity max enforced at 99 client-side.
    - Order Summary sidebar computes subtotal from cartTotal (client-side only);
      shipping shows "Free" unconditionally at this stage — no server rate fetch here.
    - Cart IS persisted server-side via the gateway (see cart-routes.ts), but the cart-client
      does NOT call any API — it reads entirely from the React CartContext in memory.
    - The "carts" Supabase table is the server-side cart store; the session_id column
      serves as the cart_token.
  UI: product list with +/- quantity, remove, Order Summary card with subtotal/shipping/total.
  State: useCart() React context (client memory). No per-page API call.
  API calls: NONE from cart-client.tsx. Cart writes happen elsewhere (add-to-cart flows).
  Transition: "Proceed to Checkout" → Link to /store/{subdomain}/checkout (plain Next.js link,
    no server handoff URL; cart state travels in React context, not as URL params).

STEP 2: Enter Checkout
  Transition: /store/{subdomain}/cart → /store/{subdomain}/checkout
  Mechanism: <Link href={`${basePath}/checkout`}> (cart-client.tsx line 170).
  State transfer: React CartContext is already mounted; no cart token passed in URL.
  The separate hosted-checkout flow (checkout.ts) requires a signed handoff URL
  (HMAC-SHA256 over site_id/cart_id/cart_token/expires_at); that path is NOT used by
  the storefront checkout-client. The storefront checkout calls /api/orders directly.

STEP 3: Checkout Form — Step 1: Address
  File: checkout-client.tsx (lines 150–897)
  Sections:
    - Saved address autofill panel (GET /api/customer/addresses, lines 192–205)
    - Full Name, Phone, Email (required)
    - Address textarea (house/flat/street), City, State, Pincode (6-digit, inputMode=numeric)
    - Delivery Speed selector (Step 3a — shipping is selected ON STEP 1, not step 2)
  State: useState for formData, errors, savedAddresses, storeRates, selectedRateId,
         deliveryOption, appliedCoupon, couponInput, couponError, isCheckingCoupon,
         checkoutError, step (1 or 2), orderNumber, isSuccess.
  Validation (client-side, validateForm()):
    - name: truthy
    - email: regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    - phone: stripped digits >= 10
    - address: truthy
    - city: truthy
    - state: truthy
    - pincode: exactly 6 digits
  "Continue to Payment" calls proceedToPayment() → validateForm() → setStep(2).

STEP 4: Shipping Selection
  Location: WITHIN Step 1 (Address form), lines 821–887 of checkout-client.tsx.
  How rates are fetched:
    POST /api/shipping/rates (checkout-client.tsx line 217) on mount.
    Body: { store_id, pincode: '000000' (placeholder), subtotal_minor }
    NOTE: Pincode used for rate fetch is a hardcoded placeholder '000000' — actual pincode
    is not yet available at mount time. This is a known V1 limitation (comment at line 222).
  Rate display:
    - If store has rates (storeRates.length > 0): renders real rate cards with name, amount, days.
    - If no rates: falls back to hardcoded Standard (FREE, 5-7 days) / Express (₹99, 2-3 days).
  Rate selection: click sets selectedRateId; selectedRate.amount_minor/100 is the delivery charge.
  Filter: rates with id === 'sandbox-standard' are excluded (line 232).

STEP 5: Payment Selection
  Location: Step 2 of checkout-client.tsx (lines 899–1041).
  Payment methods available:
    - Online (Razorpay): shown if onlinePaymentEnabled prop === true.
      Display: "Pay Online (Razorpay)" / "UPI, Cards, Net Banking".
    - COD: shown if codEnabled prop === true.
      Display: "Cash on Delivery (COD)".
    - If neither: amber warning "Payment methods unavailable".
  V1 comment (line 99): "V1 ships Razorpay+COD; Stripe and PayPal deferred (LB-2)".
  Default selection: online if enabled, else cod, else online (line 154).
  Razorpay script loaded via Next.js <Script src="https://checkout.razorpay.com/v1/checkout.js">
  (line 622); razorpayLoaded gate before opening modal (line 449).

STEP 6: Order Creation
  Triggered by: "Confirm COD order" or "Pay ₹X" button (line 1017).
  Both COD and Razorpay call createCheckoutOrder() first (line 413):
    POST /api/orders
    Body (buildOrderPayload, lines 338–364):
      { storeId, sellerId, subdomain, idempotencyKey, customer: { name, email, phone,
        address: { address, city, state, pincode } }, items: [{ productId, variantId, quantity }],
        paymentMethod, deliveryOption, couponCode?, shippingRateId? }
    NOTE: No prices are sent by the client. Prices are computed server-side.
  Gateway route: POST /:subdomain/orders
    File: checkout-payment-routes.ts line 251.
    Steps:
      1. loadPublishedStore — verify store exists.
      2. idempotency.begin — claim or replay (scope: 'storefront.checkout.order.create').
      3. resolveShippingRate(db, store.id, shippingRateId) — server-side rate resolution.
      4. Server-side GST computation from tax_registrations + tax_rates + product prices.
      5. service.createOrder(orderCommand, tenant, { deferPostCommit }) →
         db.rpc('create_checkout_order', ...) (order-execution.adapter.ts line 158).
         RPC: create_checkout_order — SECURITY DEFINER, calculates totals from DB prices,
         reserves inventory atomically.
      6. Optionally defers post-commit work (usage metering + GST invoice generation) via
         c.executionCtx.waitUntil().
      7. emitStorefrontOrderCreatedEvent → domain event 'order.created'.
      8. idempotency.complete — record response.
    Response: { success: true, order: { id, orderNumber, status, total, gstInvoiceNumber? } }

STEP 7: Payment Processing
  RAZORPAY FLOW (handlePayment, lines 444–550):
    a. createCheckoutOrder('razorpay') → POST /api/orders → order.id obtained.
    b. POST /payments/razorpay/order
       File: checkout-payment-routes.ts lines 449–566.
       Body: { orderId, idempotencyKey }
       Steps:
         - paymentService.loadStorefrontPayableOrder — verify order unpaid.
         - Amount mismatch guard: client-supplied amount checked against DB total.
         - createRazorpayPaymentProvider.createIntent → creates Razorpay order at Razorpay API.
         - paymentService.attachPaymentReference →
           db.rpc('attach_order_payment_reference_with_ledger') (payment-execution.adapter.ts line 70).
         - idempotency.complete.
       Response: { keyId, razorpayOrderId, amount (minor units), currency }
    c. Browser opens Razorpay checkout modal (window.Razorpay(options).open()).
    d. On modal success (handler callback), browser calls:
       POST /payments/razorpay/verify
       Body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, idempotencyKey }
       File: checkout-payment-routes.ts lines 568–698.
       Steps:
         - Security: order.payment_id MUST match razorpay_order_id (cross-order replay prevention).
         - assertProviderPaymentNotReplayed — check payment ID not already recorded for another order.
         - createRazorpayPaymentProvider.verify — HMAC-SHA256 signature verification.
         - paymentService.confirmPayment →
           db.rpc('confirm_order_payment_with_ledger') (payment-execution.adapter.ts line 94).
         - emitStorefrontOrderPaidEvent → domain event 'order.paid'.
         - idempotency.complete.
       Response: { verified: true, order: confirmedOrder }
    e. On verify success: setOrderNumber, setIsSuccess(true), clearCart(), autoCreateCustomer().
    f. On modal dismiss: setIsProcessing(false) (no error shown).
    g. On payment.failed event: showCheckoutError('Payment failed. Please try again.').

  COD FLOW (handleCODOrder, lines 424–442):
    a. createCheckoutOrder('cod') → POST /api/orders.
    b. The RPC create_checkout_order handles COD: order is created with payment_method='cod',
       status likely 'pending' (no payment step).
    c. On result.success: setOrderNumber, setIsSuccess(true), clearCart(), autoCreateCustomer().
    d. No second API call — no Razorpay interaction.

  WEBHOOK HANDLING:
    - Razorpay webhooks reach the webhook-service (services/webhook-service), which calls
      the internal payment routes (internal-payment-routes.ts):
      POST /storefront/internal/payments/confirm — calls confirm_order_payment_with_ledger.
      POST /storefront/internal/payments/failure — calls record_order_payment_failure_with_ledger.
    - The internal routes are gated by isInternalApiSecretRequest (INTERNAL_API_SECRET env var).
    - This provides a server-to-server fallback path for webhook-driven confirmation,
      independent of the browser callback.

STEP 8: Order Confirmation
  Mechanism: isSuccess flag → inline success screen rendered within checkout-client.tsx
    (lines 553–601). No navigation/redirect occurs. The checkout page stays mounted and
    renders the success UI in-place.
  Success page (app/store/[subdomain]/checkout/success/page.tsx):
    This file is a STUB for stale Stripe redirects. Comment: "V1 ships Razorpay+COD; Stripe
    deferred (LB-2). This route is kept so old links do not 404." It redirects users to
    /store/{subdomain}/orders for status. NOT the primary success path for V1.
  Inline success state shows:
    - "Order Confirmed!" heading.
    - "Thank you for your purchase" message.
    - Order number in monospace span.
    - COD-specific message vs. online payment confirmation message.
    - "Track Your Order" → /store/{subdomain}/orders.
    - "Continue Shopping" → /store/{subdomain}.
  Order reference: displayed as orderNumber (human-readable, e.g. "LB-0001").
  Email: autoCreateCustomer() fires silently post-success (POST /api/customer/auto-create).
    This creates the customer record; transactional order confirmation email would depend
    on queue-workers processing 'order.created' / 'order.paid' domain events. No direct
    email call from checkout-client; email delivery is event-driven.
```

---

## 2. Multi-Step Checkout Analysis

The checkout has exactly **two explicit steps** controlled by a single `step` integer state variable (`useState(1)` at line 156).

- **Step 1 (step === 1):** "Address" — contact info (name/email/phone), delivery address (address/city/state/pincode), shipping speed selection, and saved address autofill. Also contains the coupon code entry in the sidebar. Clicking "Continue to Payment" runs `validateForm()` and sets `step = 2`.
- **Step 2 (step === 2):** "Payment" — address summary (read-only with a "Change" back button), item list, payment method selection (Razorpay/COD), final payment button.

A visual progress bar with two numbered circles ("Address" / "Payment") is rendered at lines 647–669. There is NO separate shipping step — shipping rate selection is embedded inside step 1.

The flow is a simple two-step linear state machine with no explicit state machine library. `AnimatePresence` / `framer-motion` provides slide transitions between steps.

A third pseudo-state (`isSuccess === true`) renders an inline confirmation screen that replaces the form entirely, without a URL change.

The **hosted-checkout router** (`services/api-gateway/src/routes/checkout.ts`) implements a richer server-side state machine with stages: `contact → delivery → payment_intent → completed | failed`. This path is gated by a signed handoff URL from `GET /:subdomain/cart/:cartToken/checkout-url` and is currently blocked in live mode (`HR-MERCHANT-PSP-LIVE` comment at line 573). The storefront checkout-client does NOT use this hosted path.

---

## 3. Guest vs Authenticated Checkout

The checkout-client **supports guest checkout** fully. No auth check is performed before entering the checkout page. The form collects name/email/phone directly.

Evidence:
- Props received: `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled` — no `userId` or auth token.
- `buildOrderPayload()` sends `customer: { name, email, phone, address }` from form state, not from session.
- Saved addresses: `GET /api/customer/addresses` is called on mount but failures are silently ignored (`setSavedAddresses([])` in catch, line 199). An empty saved-addresses array is the normal guest experience.
- `autoCreateCustomer()` (line 295) fires silently AFTER order success, calling `POST /api/customer/auto-create`. Comment: "Silently fail — customer creation should not block checkout success." This creates a customer record for future login but does not require one to place the order.

**Guest order tracking:** after order creation the success screen shows "Track Your Order" → `/store/{subdomain}/orders`. Whether a guest can actually track without logging in depends on the orders page auth handling, which is outside the scope of the files read here. The success page stub (`/checkout/success`) also redirects to `/store/{subdomain}/orders`.

---

## 4. Cart Data Flow

**Cart entity in DB:** Yes. `services/api-gateway/src/routes/storefront/cart-routes.ts` persists carts to the `carts` Supabase table. The schema includes: `id`, `store_id`, `customer_id`, `buyer_email`, `session_id` (= cart_token), `items` (JSONB array of line objects), `coupon_code`, `status`, `channel`, `checkout_handoff`, `expires_at`, `abandonment_enqueued_at`. Lines are stored as JSONB via `normalizeCartItems()` (line 149).

**Cart-client vs. server cart:** The storefront cart-client (`cart-client.tsx`) reads entirely from the React `useCart()` context (client-side state). It does NOT call the server-side cart API. The `carts` table is used by:
  - The server-side cart routes (POST/GET/PATCH `/:subdomain/cart`, etc.) — used by API-first or headless integrations.
  - The hosted-checkout flow (checkout.ts) — which reads from `carts` during handoff verification.
  - Cart abandonment queue jobs.

The storefront checkout-client does **not** validate the cart against the server before order submission. It trusts the React context. Server-side validation happens at order creation via `create_checkout_order` RPC which validates products and stock.

**Cart validation at checkout time:** The `create_checkout_order` RPC performs server-side validation:
  - Products must exist and be active (implied by RPC design).
  - Inventory is checked and reserved atomically.
  - If insufficient stock: RPC returns error with 'insufficient stock' string (order-execution.adapter.ts line 187), which surfaces as a ValidationError → 400 response → `showCheckoutError()` in the client.

**Preventing out-of-stock orders:** the `create_checkout_order` RPC throws on insufficient stock (line 187). The client only shows the generic "Order creation failed. Please try again." message on non-success result. No specific out-of-stock message is surfaced to the user in the current client implementation.

---

## 5. API Call Sequence Diagram

Complete sequence for a Razorpay online payment:

```
1. GET  /api/customer/addresses
     On mount (checkout-client.tsx line 192)
     Purpose: load saved addresses for autofill
     Response: { addresses: SavedAddress[] }

2. POST /api/shipping/rates
     On mount (checkout-client.tsx line 217)
     Body: { store_id, pincode: '000000', subtotal_minor }
     Purpose: fetch store shipping rates
     Response: { data: { rates: StoreShippingRate[] } }

3. [User fills form, selects shipping, enters coupon (optional)]

4. GET  /api/coupons/validate?code=X&subdomain=Y&subtotal=Z
     On coupon "Apply" click (checkout-client.tsx line 377)
     Purpose: validate coupon code
     Response: { valid, coupon: { code, type, value, discount, freeShipping } }

5. [User clicks "Continue to Payment" — step 1→2, no API call]

6. POST /api/orders
     On "Pay ₹X" click (checkout-client.tsx line 413)
     Body: { storeId, sellerId, subdomain, idempotencyKey, customer, items, paymentMethod: 'razorpay',
             deliveryOption, couponCode?, shippingRateId? }
     Gateway: POST /:subdomain/orders (checkout-payment-routes.ts line 251)
     RPC: create_checkout_order
     Response: { success, order: { id, orderNumber, status, total } }

7. POST /api/{subdomain}/payments/razorpay/order
     Called via storefrontBrowserApiFetch (checkout-client.tsx line 466)
     Body: { orderId, idempotencyKey }
     Gateway: POST /:subdomain/payments/razorpay/order (checkout-payment-routes.ts line 449)
     RPC: attach_order_payment_reference_with_ledger
     Response: { keyId, razorpayOrderId, amount (minor), currency }

8. [Razorpay checkout.js modal opens in browser — no server call until completion]

9. POST /api/{subdomain}/payments/razorpay/verify
     Called via storefrontBrowserApiFetch after Razorpay success callback (checkout-client.tsx line 494)
     Body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, idempotencyKey }
     Gateway: POST /:subdomain/payments/razorpay/verify (checkout-payment-routes.ts line 568)
     RPC: confirm_order_payment_with_ledger
     Response: { verified: true, order: confirmedOrder }

10. POST /api/customer/auto-create
      Called silently after verify success (checkout-client.tsx line 297)
      Body: { email, fullName, phone, storeId }
      Purpose: create/link customer record; failure is silent
```

Complete sequence for a COD order (steps 1–5 same, then):

```
6. POST /api/orders
     Body: same as above but paymentMethod: 'cod'
     RPC: create_checkout_order (COD variant — no payment step needed)
     Response: { success, order: { id, orderNumber, status, total } }

7. POST /api/customer/auto-create  (silent, same as above)
```

---

## 6. Failure Modes

**Payment fails (Razorpay):**
- Modal `payment.failed` event: `setIsProcessing(false)`, `showCheckoutError('Payment failed. Please try again.')` (line 541–544).
- Modal dismissed by user (`ondismiss`): `setIsProcessing(false)`, no error shown (line 534–537).
- Verify call fails (network error / server error): `showCheckoutError('Payment verification failed. Please contact support.')` (line 513–514).
- Verify returns non-success: `showCheckoutError(storefrontApiErrorMessage(...))` (line 512).
- The order is already created (step 6) before the Razorpay modal opens. If the user dismisses or payment fails, the order exists in DB with status 'pending' and payment_status 'pending'. There is no automatic cancellation from the client. Razorpay webhooks can trigger `record_order_payment_failure_with_ledger` via the webhook-service / internal payment routes.
- Idempotency on verify: if re-submitted with same key, idempotency.begin returns 'replay' and returns cached response.

**Out of stock at time of order:**
- `create_checkout_order` RPC throws with 'insufficient stock' message.
- Gateway converts to 400 response with ValidationError.
- Client: `result.success` is false → `showCheckoutError('Order creation failed. Please try again.')` (line 435/461). No stock-specific message surfaced to user in V1.

**Shipping rate fetch fails:**
- `fetch('/api/shipping/rates')` catch: `setStoreRates(null)` (line 239).
- UI falls back to hardcoded Standard/Express options. Checkout continues normally.

**Coupon expired at checkout time:**
- `/api/coupons/validate` returns `{ valid: false, error: '...' }` → `setCouponError(payload.error || 'Invalid coupon code')` (line 386).
- Coupon is NOT applied. Checkout can continue without it.
- The coupon is re-validated server-side during `create_checkout_order` RPC — if it expired between client validation and order creation, the RPC will fail or ignore it (RPC behavior not visible in gateway code).
- In checkout.ts (hosted path), coupon validity is re-checked in `revalidateConfirmInputs()` (line 407–416) which queries `coupons` table for `is_active = true`. If expired: returns `{ ok: false, reason: 'discount_invalid' }` → order creation is blocked and `compensation_actions` record is written.

**Network error during payment:**
- createCheckoutOrder fetch catch: `showCheckoutError('Order creation failed. Please try again.')` (line 437/547).
- storefrontBrowserApiFetch catch: `showCheckoutError('Payment failed. Please try again.')` (line 547).
- Idempotency keys scoped per checkout instance (`useRef` for idempotencyKeysRef, line 172) mean retrying with the same key on the same page load will replay the cached response.

---

## 7. Redirect Flows

**PayPal return URL:** PayPal is implemented in the gateway (`checkout-payment-routes.ts` lines 1050–1272) with a `POST /:subdomain/payments/paypal/capture` route for the capture step. The `returnUrl` / `cancelUrl` are passed by the caller. However, the storefront checkout-client (`checkout-client.tsx`) does NOT implement PayPal — it only supports 'online' (Razorpay) and 'cod' as `PaymentMethod` types. The V1 comment (line 99) explicitly defers PayPal to LB-2. The checkout success page stub (`/checkout/success/page.tsx`) was originally built for Stripe return-URL handling and is now a redirect to orders page.

**COD success flow vs. card payment flow:**
- COD: single `POST /api/orders` call → on success, inline success screen (no modal, no redirect).
  Success message: "COD order confirmed. Keep the order amount ready for the delivery partner."
- Card (Razorpay): three calls (`POST /api/orders` → `POST /payments/razorpay/order` → Razorpay modal → `POST /payments/razorpay/verify`) → on verify success, same inline success screen.
  Success message: "Payment confirmation is complete. Keep this order number for support."
- Both paths: `clearCart()`, `autoCreateCustomer()`, `setIsSuccess(true)` → inline success screen.
- Neither path uses `useRouter().push()` or `redirect()`. The URL stays at `/store/{subdomain}/checkout` throughout.

---

## 8. Order Success State

**What the success screen shows (checkout-client.tsx lines 553–601):**
- Full-page green checkmark circle with spring animation.
- Heading: "Order Confirmed!"
- Message: "Thank you for your purchase. We will send order updates to the contact details you provided."
- Order Number badge: `<span className="font-mono font-semibold">{orderNumber}</span>` — the human-readable order number returned by `create_checkout_order` RPC (e.g. "LBY-0042").
- Payment-method-specific message (COD vs. card).
- CTA: "Track Your Order" → `/store/{subdomain}/orders`.
- CTA: "Continue Shopping" → `/store/{subdomain}`.

**Order data available immediately post-checkout:**
- `orderNumber` (string) — set from `result.order.orderNumber` (COD) or `orderResult.order.orderNumber` (Razorpay).
- `paymentMethod` state — determines which message to show.
- The full order object is NOT stored client-side beyond the order number.

**How the order is referenced:**
- URL: none — no `/orders/{id}` redirect happens at success time. User must navigate to `/store/{subdomain}/orders` to find the order.
- Display: human-readable order number (e.g. `orderNumber` from RPC `order_number` column).
- The `id` (UUID) is used internally for payment API calls but not surfaced to the shopper in the success UI.

**Email:**
- `autoCreateCustomer()` fires silently; this does NOT send a confirmation email.
- Transactional emails (order confirmation, payment confirmation) are event-driven: `order.created` and `order.paid` domain events are emitted and consumed by `queue-workers` / `notification-service`. Email delivery is asynchronous and not confirmed in the client flow.

---

## Appendix: RPC Chain Summary

| Gateway Action | RPC Called | File |
|---|---|---|
| Create order | `create_checkout_order` | order-execution.adapter.ts:158 |
| Attach Razorpay order reference | `attach_order_payment_reference_with_ledger` | payment-execution.adapter.ts:70 |
| Confirm payment (Razorpay/PayPal/etc.) | `confirm_order_payment_with_ledger` | payment-execution.adapter.ts:94 |
| Record payment failure | `record_order_payment_failure_with_ledger` | payment-execution.adapter.ts:122 |
| Fulfill order | `create_order_fulfillment` | order-execution.adapter.ts:466 |
| Create refund | `create_order_return_and_refund` | order-execution.adapter.ts:486 |
| Complete refund | `complete_order_refund` | order-execution.adapter.ts:505 |
| Release inventory on cancel | `release_order_inventory_with_ledger` | order-execution.adapter.ts:530 |

All money-touching operations go through SECURITY DEFINER RPCs. No direct `.from(orders).insert/update` for money mutations in the checkout path.

## Appendix: Key File Locations

| Concern | File |
|---|---|
| Cart UI | `apps/storefront-runtime/src/app/store/[subdomain]/cart/cart-client.tsx` |
| Checkout UI (2-step) | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` |
| Success page (stub) | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx` |
| Server-side cart API | `services/api-gateway/src/routes/storefront/cart-routes.ts` |
| Order creation + payment provider routes | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts` |
| Internal payment routes (webhook path) | `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` |
| Hosted checkout state machine | `services/api-gateway/src/routes/checkout.ts` |
| Order RPC adapter | `services/api-gateway/src/execution/order-execution.adapter.ts` |
| Payment RPC adapter | `services/api-gateway/src/execution/payment-execution.adapter.ts` |

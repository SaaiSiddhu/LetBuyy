# Checkout Audit

**Date:** 2026-06-19  
**LCIS Domain:** `orders` (checkout flow), `payments` (3 routes, 18 RPCs, 11 tables)  
**Evidence:** `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`, `services/api-gateway/src/routes/checkout.ts` (816 lines), `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`

---

## Completion Score: **82%**

---

## Sub-System Audit

### Cart
**Score: 93%**

**What exists:**
- Cart page: `apps/storefront-runtime/src/app/store/[subdomain]/cart/cart-client.tsx`
- Cart drawer: `apps/storefront-runtime/src/components/cart/cart-drawer.tsx`
- Cart context and state management
- Cart API routes: `services/api-gateway/src/routes/storefront/cart-routes.ts`
- `carts` table with site_id isolation
- Add to cart, remove, quantity update
- Variant selection in cart
- Coupon/discount application: `apps/storefront-runtime/src/app/api/coupons/validate/route.ts`
- Guest cart with session persistence

**Evidence:** `cart-routes.ts`, `cart-drawer.tsx`, `cart-client.tsx`, `carts` table in LCIS orders domain

---

### Checkout Flow
**Score: 88%**

**What exists:**
- Full checkout page: `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` (confirmed large component with full form)
- Shipping address collection (name, email, phone, address)
- Shipping rate selection (POST `/api/shipping/rates`)
- Payment method selection (Razorpay / COD)
- Order summary with line items, discounts, totals
- `checkout_sessions` table for session state
- `CHECKOUT_SIGNING_SECRET` for session integrity
- Server-authoritative totals (computed in `create_checkout_order` RPC, not client)

**What is missing:**
- UPI as a standalone payment method (handled via Razorpay's UPI option, not a separate integration)
- Multiple shipping address steps (one-page checkout)

**Evidence:** `checkout-client.tsx` (confirmed full implementation with Razorpay + COD), `checkout.ts:816 lines`

---

### Shipping (at Checkout)
**Score: 72%** ← **Partially blocked by LB-7**

**What exists:**
- Shipping rates API: `apps/storefront-runtime/src/app/api/shipping/rates/route.ts`
- `shipping_rates` + `shipping_zones` tables
- Rate resolver: `services/api-gateway/src/lib/shipping-rate-resolver.ts` (LB-7)
- Migration 170: `170_v1_shipping_rates_gst.sql` — **validated, passed 28/28 tests, BUT UNCOMMITTED**
- Shipping cost applied server-side in `create_checkout_order` RPC

**What is blocked:**
- LB-7 is validated but the migration and rate resolver cannot be committed due to `git index.lock` in the current sandbox
- Until LB-7 is committed, the gateway falls back to flat-rate or no-rate shipping

**Evidence:** `LB7_CERTIFICATION.md` — "lb7 28/28, gate green except untracked-170"; `ACTUAL_STATE.md` LB-7

---

### Taxes / GST
**Score: 78%** ← **Partially blocked by LB-7**

**What exists:**
- GST domain: 1 route, 1 RPC, 6 tables
- `shipping-tax.ts` route: `services/api-gateway/src/routes/shipping-tax.ts`
- GST computed server-side in `create_checkout_order`
- GST invoice tables
- GSTIN capture in merchant settings
- Tax inclusive/exclusive pricing

**What is blocked:**
- Tax rate application depends on LB-7 (shipping+GST migration 170)

**Evidence:** LCIS gst domain, `shipping-tax.ts`, `ACTUAL_STATE.md`

---

### Razorpay
**Score: 90%**

**What exists:**
- Razorpay order creation at checkout (server-side)
- HMAC-SHA256 signature verification: `timingSafeEqualHex`
- `attach_order_payment_reference_with_ledger` RPC (canonical)
- `confirm_order_payment_with_ledger` RPC (canonical)
- Webhook verification: `services/webhook-service/`
- Payment attempt tracking: `payment_attempts` table
- Payment failure recording: `record_order_payment_failure_with_ledger` RPC
- Idempotency on all payment RPCs
- `checkout-client.tsx` — full Razorpay SDK integration (Razorpay class, handler, prefill, modal)
- LB-2 committed: "Razorpay+COD-only checkout: 7 stripe/paypal storefront routes deleted" (commit `90368dc6`)

**What is missing (environment, not code):**
- Live Razorpay credentials (H2 — human seam)
- Production webhook registration with Razorpay

**Evidence:** `ACTUAL_STATE.md` LB-2/LB-3, `checkout-client.tsx` Razorpay types and handler, payments domain LCIS (18 RPCs)

---

### COD (Cash on Delivery)
**Score: 92%**

**What exists:**
- COD payment path implemented
- `set_pending_cod_order_status` RPC
- COD reconciliation route: `services/api-gateway/src/routes/cod-reconciliation.ts`
- COD enabled/disabled per store (merchant settings)
- Checkout shows COD option when enabled
- `codEnabled` prop in `CheckoutClientProps`

**Evidence:** `checkout-client.tsx` interface definition with `codEnabled`, `cod-reconciliation.ts`

---

### UPI
**Score: 45%**

**What exists:**
- UPI available as a Razorpay payment method (handled automatically by Razorpay checkout modal)
- No separate UPI integration required

**What is missing:**
- Dedicated UPI deep-link / UPI collect flow (not needed for V1 — Razorpay handles it)
- UPI-specific retry logic (Razorpay handles it)

**Note:** UPI works via Razorpay's modal. A standalone UPI integration is not in V1 scope.

---

### Order Success
**Score: 92%**

**What exists:**
- Success page: `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx`
- Success layout: `checkout/success/layout.tsx`
- Order confirmation email: `order_confirmation` template exists
- Customer account auto-creation on first order: `orders/set-password/route.ts`
- Payment return handling: `checkout/paypal-return/page.tsx` (PayPal removed but page may persist)

**Evidence:** `checkout/success/` pages, notification-core order_confirmation template

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| LB-7 | Shipping rates + GST uncommitted | 🟡 High | Rates not applied at checkout until committed |
| LB-9 | Appearance bridge dead island | 🔴 High | Merchant appearance settings not applied to storefront |
| H2 | Razorpay live credentials | Human seam | Payments fail until credentials provisioned |
| H3 | DNS wildcards | Human seam | Storefront unreachable without DNS |
| CAP-C01 | Live capture-ledger certification | Capability gap | Money must be certified in staging |

---

## Launch Readiness

**Checkout is 82% ready.** The core flow (cart → Razorpay → success, cart → COD → pending) is implemented and tested. The gaps:

1. **LB-7** must be committed (1 human action in a real environment)
2. **LB-9** must be fixed (2–3 dev-days) so merchant appearance settings reach the storefront
3. **H2** (Razorpay live keys) is a human provisioning task

After these three items: checkout is production-ready.

**Recommended V1.0.0 scope:** Razorpay + COD + basic shipping rates + GST + success page.

**Delay to V1.1:** One-click checkout, saved cards, installment payments (EMI), PayPal (removed, good).

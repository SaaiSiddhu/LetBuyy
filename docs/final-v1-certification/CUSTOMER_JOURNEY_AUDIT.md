# Phase G — Customer Journey Audit

**HEAD `587dc988`. Score: 65/100. PASS / PARTIAL / FAIL per step.**

| Step | Status | Evidence |
|---|---|---|
| Landing / store by hostname | **PASS** | Next 16 `proxy.ts` host-routing (LB-1 satisfied); ISR + KV |
| Browse (products/collections) | PASS | ISR `revalidate=60`, gateway storefront routes |
| Registration | PASS | `customer-registration.ts:62–149` not-exists precondition + Turnstile + rate-limit + HS256 mint; **UI note:** account sheet uses order-first creation, doesn't call `register()` |
| Login | PASS | `customer-engagement-routes.ts:698` rate-limit + Turnstile |
| Cart | PASS | cart-context + signed handoff token |
| Checkout — address/shipping | **PARTIAL** | shipping selectable in UI (`checkout-client.tsx:217–234`) but `shippingRateId` dropped at `app/api/orders/route.ts:48–57` → merchant rate bypassed |
| Checkout — COD | **PARTIAL** | order created, but **no confirmation email** (email fires on `order.paid`; COD stays pending) |
| Checkout — Razorpay | PASS | sig + reference-match + cross-order replay + amount guard (`checkout-payment-routes.ts:617–661`) |
| Announcement bar (default theme) | **FAIL** | `renderer-registry.tsx:56–203` has no `announcementBar` renderer → broken placeholder box (LB-8) |
| Order tracking | PASS | order status + fulfillment tracking RPC |
| Refund (customer-visible) | PASS | merchant-initiated, ledger-posted, status reflected |
| Gift card redemption | **FAIL** | no redemption input in checkout (LB-11); backend would accept it |
| Shipped notification (email) | **FAIL** | no `email.order_shipped` dispatch in live queue path (only WhatsApp planned, dormant) |

## Summary
**8 PASS · 3 PARTIAL · 3 FAIL** (incl. 1 carried). The front door and payment core are solid; the failures are presentation/notification completeness: the broken announcement bar (visible on every default store), the silently-wrong shipping charge, unredeemable gift cards, and missing COD/shipped emails. None is a security or data-integrity defect, but together they make the buyer experience not pilot-ready until LB-8 + shipping-drop are fixed.

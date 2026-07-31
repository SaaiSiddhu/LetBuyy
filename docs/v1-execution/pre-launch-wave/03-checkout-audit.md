# 03 — Checkout Flow Audit (Stream C)

**Readiness: ~80% code-ready** (up from ~78% after the shippingRateId fix). Live gates remain (Razorpay credentials, Resend, merchant rate/GST config).

## Per-path (code level)
| Path | Verdict |
|---|---|
| Cart | ✅ Production Ready |
| Checkout form | ✅ Production Ready |
| Shipping (server-resolved rates) | ✅ **FIXED this wave** (was Partial — `shippingRateId` was dropped at the storefront proxy; now forwarded end to end) |
| GST (server-computed) | 🟡 Partial — `stateCode` is never collected/sent by the checkout client → GST computes to 0 (I-2). Compliance gap for GST-registered merchants only; not a blocker for unregistered stores. |
| Discounts/coupons | ✅ Production Ready (bogo blocked 422) |
| Payment — COD | ✅ Production Ready (code) |
| Payment — Razorpay/UPI | ✅ Production Ready (code); LIVE gate = real credentials + webhook registration |
| Success / order creation | ✅ Production Ready — canonical `create_checkout_order` RPC, server-authoritative totals, idempotent, replay-guarded |

## Hard rules — verified
Server-authoritative totals ✅ · Razorpay HMAC-SHA256 + `timingSafeEqual` ✅ · idempotency keys on money RPCs ✅ · no direct money-table writes in TS ✅ · cross-order replay guard ✅.

## Fixed this wave
- **I-1 (HIGH) — shippingRateId proxy gap:** added `shippingRateId?: string|null` to `StorefrontCreateOrderInput` (api-client) + forwarded it in `apps/storefront-runtime/src/app/api/orders/route.ts`. The gateway already consumes `body.shippingRateId` (`checkout-payment-routes.ts:293/391`) → shipping rates now resolve end to end. Contract-tested (`lb-checkout-hardening.test.mjs`).

## Open issues (documented)
- **I-2 (HIGH→merchant-GST-only):** collect `stateCode` (pincode→state lookup or dropdown) so GST computes for registered merchants. UI change + needs visual verification.
- **I-3 (MEDIUM):** stale `payments.test.ts` Stripe/PayPal assertions (pre-existing, LB-2) — flip to `doesNotMatch`.

## Live gates (cannot be code-verified)
RAZORPAY_KEY_ID/SECRET (H2), webhook registration, CHECKOUT_SIGNING_SECRET, merchant `shipping_rates`/`tax_registrations` data, Resend (H6).

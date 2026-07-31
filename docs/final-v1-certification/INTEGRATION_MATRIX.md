# Phase B — Integration Matrix

**HEAD `587dc988`. PASS / PARTIAL / FAIL with evidence.**

| Integration | Status | Evidence | Note |
|---|---|---|---|
| Storefront → Gateway (browse/cart) | PASS | `next.config.ts:108–115` rewrite | |
| Storefront → Gateway (order create) | PARTIAL | `app/api/orders/route.ts:48–57` | drops `shippingRateId` (High) |
| Storefront → Gateway (Razorpay verify) | PASS | `checkout-payment-routes.ts:617–661` | sig+replay+amount guards |
| Storefront → Gateway (customer auth) | PASS | HS256 `X-LetBuyy-Customer-Session` | |
| Merchant → Gateway (product/order/refund/payout) | PASS | `createMerchantApiClient` + `resolveOwnedStoreId` | step-up on refund/payout |
| Identity → Gateway (session verify) | PASS | `identity-session-verifier.ts:42–109` | ES256/JWKS, no HMAC fallback |
| Identity → Gateway (store create) | PASS | `create-store/route.ts:34–139` | proxy, no local DB write |
| Gateway → Queues | PASS | `signQueueTenantEnvelope` | HMAC envelope |
| Queues → Workers (email/search/analytics) | PASS | `platform-queue-consumer.ts:216–420` | circuit breaker + DLQ |
| Workers → Resend | PASS (fail-closed) | `queue-workers/src/index.ts:477–501` | no key → skip, no crash |
| Webhook → Payments (Razorpay) | PASS | `webhook-service/src/index.ts:677–696` | HMAC + dedupe |
| Webhook → Payments (PayPal) | PASS | `paypal-adapter:240–259` | real verify (non-V1) |
| Console → Internal (reconciliation) | PASS | `money-reconciliation/page.tsx` | dual-approver |
| Console → Internal (KYC review) | FAIL | zero KYC files in `platform-console` | no operator surface |
| Storefront ↔ Gift-card redemption | FAIL | no input in `checkout-client.tsx` | LB-11 |
| Merchant teams invite ↔ acceptance | FAIL | no acceptance page | invited staff inert |
| Storefront search ↔ catalog backend | PARTIAL | client filter only | `search-service` reserved |

**12 PASS · 4 PARTIAL · 4 FAIL.** No FAIL is a money/identity/tenancy break; all are UX/ops completeness gaps.

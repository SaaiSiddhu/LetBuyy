# Phase B — Cross-App Integration Audit

**HEAD `587dc988`. Every integration traced to code.**

## Storefront Runtime ↔ API Gateway — **PASS** (one defect)
- `next.config.ts:108–115` rewrites `/api/storefront/:subdomain/:path*` → `${gateway}/storefront/...`. Customer-scoped calls carry HS256 `X-LetBuyy-Customer-Session`; internal calls HMAC-signed (`createLetbuyyInternalAppHeaders`).
- **DEFECT (High):** `app/api/orders/route.ts:48–57` calls `storefront.createOrder` **without `shippingRateId`**, though `checkout-client.tsx:363` sends it → merchant rate cards bypassed (gateway uses deliveryOption legacy, migration 170 standard=0/express=99).

## Merchant Control Plane ↔ API Gateway — **PASS**
- App API routes proxy via `createMerchantApiClient()` behind `resolveOwnedStoreId`; product→order→fulfill→refund→payout all reach gateway routes with `idempotency_key`. Step-up refunds wired (`orders/page.tsx:194–198`).

## Identity Platform ↔ API Gateway — **PASS**
- Merchant session ES256/EdDSA issued by identity-platform, verified at gateway against JWKS (`identity-session-verifier.ts:42–109`); no symmetric fallback. Store creation proxies to gateway `/stores` (never writes DB locally).

## Queue Workers ↔ API Gateway — **PASS**
- Gateway enqueues to 5 queues (HMAC tenant envelope `signQueueTenantEnvelope`); `queue-workers` consumes with circuit breaker + dead-letter (`platform-queue-consumer.ts:216–420`). Resend dispatch fail-closed without key.

## Webhook Service ↔ Payments — **PASS**
- Razorpay/Stripe/PayPal/Cashfree all HMAC-verified before side effects (`webhook-service/src/index.ts:677–696` etc.); dedupe via `payment_webhook_events` ON CONFLICT.

## Platform Console ↔ Internal APIs — **PARTIAL**
- money-reconciliation calls `/internal/console/money/reconciliation` (dual-approver) — works. **Gap:** no KYC review surface (zero KYC files in `platform-console`).

## Cross-app gaps
- **Gift card** — backend issuance+redemption unified (`gift_card_accounts`, mig 173) but storefront has **no redemption input** + merchant nav still shows it (LB-11).
- **Merchant teams** — `employees` invite chain wired owner-only, but **no acceptance page** in merchant-control-plane → invited staff cannot activate; `site_memberships` RBAC computed but never enforced (`tenant-context.ts:192–195`).
- **Search** — storefront search is client-side filter only; `search-service` reserved.

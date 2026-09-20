# 04 — API Inventory

Every entry names application, domain, method/path (or function), authentication, main tables touched, callers, and a disposition: **REUSE**, **REUSE+EXTEND**, **DUPLICATE** (of a canonical one), **OBSOLETE**. Evidence: inspected source at the snapshots in [00-README.md](./00-README.md). Route-level behaviour was **not** exercised in a running stack.

## 1. S1 — `services/api-gateway` (Hono, `/v1`)

Mount table: `services/api-gateway/src/index.ts:722-857`. Authentication layers: `authMiddleware` (JWKS-verified identity sessions plus legacy internal HMAC verifiers, `src/middleware/auth.ts:163-224`), `requireBuyerSession` (buyer realm only, `middleware/buyer-session.ts:41`), per-store customer session (`middleware/customer-session.ts`), `internalPerimeter` / `isInternalRequest` (`INTERNAL_API_SECRET`, optional IP allowlist), `rateLimit`, `staff-permission` (advisory by default).

### 1.1 Public and buyer-facing (`/v1/storefront/*`)

| Path | Domain | Auth | Tables / RPCs | Callers | Disposition |
|---|---|---|---|---|---|
| `GET /storefront/marketplace/feed`, `/marketplace/categories`, `/marketplace/listings/:id` | Marketplace discovery | none | `marketplace_feed` RPC, `channel_listings`, `marketplace_categories`, `products` | `customer_app` (FB-2 seam) | REUSE+EXTEND (location-aware variant for Quick) |
| `GET /storefront/lookup`, `/directory`, `/store/:storeId`, `/store/:storeId/products`, `/store/:storeId/coupons/validate`, `/reviews` | Storefront public | none | `sites`, `products`, `coupons`, `reviews` | `customer_web` | REUSE |
| `GET /storefront/:subdomain`, `/status`, `/products`, `/products/by-ids`, `/products/:slug`, `/collections/:slug`, `/categories`, `/navigation`, `/pages`, `/pages/:slug`, `/policies`, `/policies/:type`, `/coupons/validate`, `/theme-preview`, `/checkout/extensions`; `POST /:subdomain/contact`, `/:subdomain/analytics/beacon` | Storefront rendering | none (preview token for preview) | `sites`, `products`, `collections`, `theme_*`, `pages`, `analytics_events` | `customer_web` | REUSE |
| `POST /storefront/:subdomain/cart`; `GET/PATCH/DELETE …/cart/:cartToken`; `PUT …/buyer-identity`; `POST …/discount-codes`; `GET …/checkout-url` | Cart | cart token | `carts`, `coupons` | `customer_web` | REUSE (Ecommerce basket) |
| `POST /storefront/:subdomain/orders` | Checkout | none + Turnstile/rate limit | `create_checkout_order` via `OrderExecutionAdapter` → `purchases`, `orders`, `order_items`, `order_tax_lines`, inventory RPCs, gift/loyalty ledgers | `customer_web` | REUSE (storefront + marketplace single-child) |
| `POST /storefront/:subdomain/payments/razorpay/order`, `…/verify` | Payment | none (order bound to published store) | `attach_order_payment_reference_with_ledger`, `confirm_order_payment_with_ledger`, `payment_transactions` | `customer_web` `checkout-client.tsx` | REUSE; **fix**: read provider capture state before confirming |
| `GET /storefront/internal/orders/:orderId/payable`; `POST /storefront/internal/payments/{reference,confirm,failure,event}` | Payment (internal) | `isInternalRequest` | same RPCs | `webhook-service` | REUSE |
| `POST /storefront/buyer/register`, `/buyer/verify-credentials`, `POST /buyer/link-store-customer` | Buyer identity | none / buyer session | `buyer_accounts`, `buyer_store_customers` | identity-platform buyer routes, apps | REUSE |
| buyer account, loyalty, notifications, returns, support, personalization, seller-follow, sponsored, banners, mobile-release, blog (`routes/storefront/*-routes.ts`) | Customer features | buyer session where personal | `buyer_notifications`, `loyalty_*`, `customer_wishlists`, `seller_followers`, `ad_*`, `marketplace_banners`, `app update` tables | `customer_app` (after cutover) | REUSE |
| `POST /storefront/:subdomain/customers/register`, customer login/session, addresses, engagement | Per-store customer | HS256 customer session | `store_customers`, `customer_credentials`, `customer_addresses` | `customer_web` | REUSE now; collapse onto buyer realm later |
| `/storefront/graphql`, `/graphql/storefront` | Storefront GraphQL | none | same | none known | keep behind `FEATURE_GRAPHQL` |

### 1.2 Merchant-facing (`authMiddleware`, tenant-scoped)

| Path prefix | Domain | Tables / RPCs | Callers | Disposition |
|---|---|---|---|---|
| `/stores` (list, create, get, patch, health, payment-config, public/:subdomain, handle/:handle) | Merchant / tenant | `sites`, `payment_credentials` | merchant_web, merchant_app, identity create-store | REUSE+EXTEND (channel enrolment) |
| `/onboarding/*` | Merchant onboarding | onboarding attempt tables, `sites` | merchant_app, merchant_web | REUSE+EXTEND (channel selection step) |
| `/products`, `/categories`, `/smart-collections`, `/metafields`, `/resource-search`, `/export` | Catalog | `products`, `product_variants`, `collections`, `metafields` | merchant apps | REUSE |
| `/channel-listings` (list, create, get, patch, `POST /:id/transition`) | Listing | `channel_listings`, `channel_listing_moderation_events`, `transition_channel_listing` | merchant_web (to build), admin | REUSE+EXTEND (apply pricing, add Quick node scope) |
| `/inventory` (locations, suppliers, purchase-orders + receive, transfers + ship/receive, reserve, commit, release, levels, adjust, bulk-adjust, reservations, receipts, analytics, history) | Inventory | `inventory_*`, `purchase_*`, RPCs `reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation`, `create_inventory_transfer_with_lines`, `ship_inventory_transfer`, `receive_inventory_transfer`, `adjust_inventory_level` | merchant apps | REUSE+EXTEND (node kinds, custody, in-transit) |
| `/orders` (list, drafts + convert, `:id`, packing-slip, line-items, status patch, create, fulfill, refund, refund/complete), `/orders` COD, `/risk`, `/returns`, `/cod/reconciliation` | Order | `orders`, `order_items`, `draft_orders`, `fulfillment_orders`, `refunds`, `returns`, RPCs `complete_order_refund`, `create_order_return_and_refund`, `release_order_inventory_with_ledger`, `reconcile_cod_remittance_with_ledger` | merchant apps | REUSE+EXTEND (Quick lifecycle) |
| `/shipping` (serviceability/:pincode, rates, track), `/shipping/labels` (rates, provider-mode, buy, pdf, void), `/shipping-tax`, `/tax` | Fulfilment / Tax | `shipping_*`, `shipments`, `shipping_labels`, `tax_rates`, `tax_registrations` | merchant apps, customer_web | REUSE |
| `/payments` (plans, sessions, capture, void, refund, subscription/*, razorpay/order, razorpay/verify) | Payment / Billing | `payment_transactions`, `billing_history`, `merchant_billing_invoices` | merchant apps | REUSE |
| `/payouts` (list, summary, create, `:id`, settle), `/settlements` (`:site`, ingest), `/wallet`, `/commission` | Settlement | `payout_statements`, `payout_items`, `settlements`, `wallet_ledger_entries`, `commission` | merchant apps, ops | REUSE+EXTEND (per-channel commission per founder direction) |
| `/gift-cards`, `/coupons` (`/discounts` alias), `/loyalty`, `/ads`, `/marketing`, `/email`, `/whatsapp`, `/reviews`, `/form-submissions`, `/pages`, `/blog`, `/media`, `/upload` | Marketing / content / media | respective tables, R2 | merchant apps | REUSE |
| `/customers`, `/notifications`, `/analytics`, `/commerce-analytics` | Customer / Notification / Analytics | `store_customers`, `customer_*`, `notifications`, `analytics_events` | merchant apps | REUSE+EXTEND (channel breakdown) |
| `/domains` (search, purchase), `/custom` (domains add/verify/status/primary/history, domain-reviews), `/store-access` (password, preview links), `/themes/*` | Storefront | `sites`, `site_domains`, `site_domain_verifications`, `site_preview_links`, `theme_*` | merchant apps | REUSE |
| `/employees`, `/security`, `/2fa`, `/kyc`, `/billing`, `/founding`, `/portfolio`, `/resume`, `/ai`, `/app`, `/app-store`, `/stores-localization` | Staff, security, KYC, billing, misc | `employees`, `merchant_kyc_documents`, `billing_*` | merchant apps | REUSE (prune frozen app-platform if unused) |

### 1.3 Internal, operator and platform

| Path | Domain | Auth | Disposition |
|---|---|---|---|
| `/internal/console`, `/internal/billing`, `/internal/founding`, `/internal/events`, `/internal/store-access` (resolve host, verify password), `/internal/custom-domain-reconcile` | Operations / platform | internal secret + allowlist; console token | REUSE (needs a production operator realm) |
| `/admin`, `/admin/graphql`, `/operations/rbac`, `/operations` (incident command, marketplace listings) | Operations | admin auth | REUSE |
| `/auth`, `/contacts`, `/whatsapp/inbound`, `/wa/webhook`, founding/demo/contact public forms | Identity, inbound webhooks, marketing | varies | REUSE |

### 1.4 Other S1 services

| Service | Entry points | Auth | Disposition |
|---|---|---|---|
| `services/webhook-service` | Razorpay webhook ingress (raw-body HMAC, `payment_webhook_events` UNIQUE(provider, provider_event_id)); calls gateway internal payment routes with HMAC session headers; outbound app-lifecycle webhooks signed `X-LetBuyy-Hmac-SHA256` | HMAC | REUSE; **fix** retry-after-failure and unstable fallback event id |
| `services/queue-workers` | queue consumers: events, analytics, search, notifications, dead-letters, platform queue; cron `17 */6 * * *` → `runInventoryReservationSweeper`, `runLoyaltyEarnSweeper`, `runMerchantSessionJtiConsumptionSweeper`, `runMoneyLedgerReconciliation`, `runSloTelemetryEmitter` | queue tenant envelope HMAC | REUSE+EXTEND (quote/offer sweepers, dispatch) |
| `services/mobile-bff` | `GET /v1/mobile/dashboard`, health | session token, Turnstile | REUSE |
| `apps/identity-platform` API | `api/auth/*` (accounts, create-store, login, logout, lookup, reset, magic, session, set-password, signup, stores, switch, validate-subdomain, verify, verify-otp), `api/buyer/{register,login}`, `/jwks`, `oauth2/*` | own | REUSE+EXTEND (phone OTP, operator realm) |
| `apps/merchant_web` API | 130 proxy routes under `/api/stores/[store]/…`, `/api/plans`, `/api/employees/accept-invite`, `/api/auth/logout` | identity cookie | REUSE (proxies only) |
| `apps/customer_web` API | rewrite `/api/storefront/:subdomain/*` → gateway; 8 helper routes | — | REUSE |
| `apps/admin_web` API | `console-auth/{login,callback,mfa,logout}`, `founding` | console session | REBUILD login |

### 1.5 Postgres RPCs that matter (canonical money and stock authority)

`create_checkout_order` (latest `234`), `create_order_with_inventory_reservations` (`166`), `reserve_inventory`, `commit_inventory_reservation` (`216`), `release_inventory_reservation`, `expire_inventory_reservations` (`141`), `expire_unpaid_committed_reservations` (`211`), `release_order_inventory[_with_ledger]` (`246`, `212`), `create_inventory_transfer_with_lines`, `ship_inventory_transfer`, `receive_inventory_transfer[_line]`, `create_purchase_order_with_lines`, `receive_purchase_order[_line]`, `adjust_inventory_level`, `attach_order_payment_reference_with_ledger`, `confirm_order_payment_with_ledger`, `record_order_payment_failure_with_ledger` (`168`), `complete_order_refund`, `create_order_return_and_refund`, `request_order_return`, `issue_gst_invoice` (`214`), `post_ledger_transaction`, `enforce_ledger_transaction_balance`, `ledger_balance_breaks` (`139`), `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`, `redeem_loyalty_points`, `award_loyalty_points`, `restore_loyalty_on_refund`, `transition_channel_listing`, `marketplace_feed` (`217`), `reconcile_cod_remittance_with_ledger`, `claim_payout_statement_release`, `post_settlement_ledger_transaction`, `evaluate_checkout_promotion`. All `SECURITY DEFINER`; callers are the execution adapters in `services/api-gateway/src/execution/*` (validated by `canonical-ledger-only-validator`).

## 2. S2 — Firebase Cloud Functions (archived source, `services/compatibility/firebase_bridge/src`, 115 exports)

Grouped by file; triggers: 50 `onRequest`, 44 `onCall`, Firestore triggers on `orders/{orderId}` and others.

| File | Functions (selection) | Domain | Called by | Disposition |
|---|---|---|---|---|
| `sellerAuth.ts`, `storeAuth.ts`, `emailVerification.ts`, `passwordReset.ts`, `adminAuth.ts`, `adminTOTP.ts`, `adminProfile.ts` | `sendSellerLoginOTP`, `verifySellerOTP`, `verifySellerPassword`, `registerSellerForOTP`, `sendSignupEmailOTP`, `verifyEmailOTPAndSignup`, `verifyEmailOTPAndLogin`, `requestPasswordReset`, `resetPassword`, `sendAdminLoginOTP`, `initAdminTOTP`, `verifyAdminTOTPCode`, `approveStoreAuth`, `cleanupExpired*` | Identity | customer_app (email OTP), retired seller/admin apps | OBSOLETE → identity-platform |
| `razorpayService.ts` | `createRazorpayOrder`, `verifyPaymentSignature`, `validateVPA`, `saveCardToken`, `getSavedCards`, `deleteSavedCard`, `connectOwnRazorpay`, `getPaymentConfigForOrder` | Payment | customer_app checkout | OBSOLETE → gateway payment routes (saved-card feature is new if wanted) |
| `commissionService.ts`, `settlementService.ts`, `walletService.ts` | `calculateOrderCommission`, `processDeliveredOrderCommission`, `handleReturnCommission`, `applyRTOCharges`, `getCommissionAnalytics`, `processWeeklyPayouts`, `processAutoPayouts`, `releaseHeldPayouts`, `requestWithdrawal`, `generateSettlementInvoice`, `getSellerWalletStats`, `resetWeeklyLimits`, `adminProcessPayout` | Money | customer_app (`calculateOrderCommission`, `processDeliveredOrderCommission`), seller app | OBSOLETE as code (custody + mutable wallet forbidden); **logic ideas** feed the per-channel commission design |
| `subscriptionService.ts`, `subscriptionWebhook.ts` | `createSubscription`, `upgradeSubscription`, `processSubscriptionPayment`, `checkTrialStatus`, `enforceProductLimit`, `decrementProductCount` | Subscription | seller app | OBSOLETE → S1 billing |
| `kycVerification.ts` | `submitKycDocuments`, `extractPanDetails`, `extractAadhaarDetails`, `verifyKycNames`, `verifySelfieFaceMatch`, `adminReviewKyc`, `adminReviewFaceVerification` | KYC | seller app | OBSOLETE as code; flow shape reusable behind the vendor adapter |
| `returnService.ts` | `onReturnRequested`, `onReturnStatusChanged`, `processReturnRefund`, `createExchangeOrder`, `autoRejectStaleReturns`, `getReturnAnalytics` | Returns | customer_app returns | OBSOLETE → S1 returns (exchange order concept is new) |
| `storeDeployment.ts`, `storeTemplates.ts`, `domainMapping.ts` | `deployStore`, `serveStore`, `generateStoreHtml`, `markStoreAsLive`, `updateStoreSite`, `onStorePublished`, `checkSubdomainAvailability` | Store builder | seller app | OBSOLETE → S1 storefront |
| `notifications.ts`, `orderNotifications.ts` | `sendNotificationToUser`, `sendBroadcastNotification`, `sendOrderUpdateNotification`, `sendNewOrderNotificationToSeller`, `onOrderCreated`, `onOrderDelivered`, `getNotificationStats` | Notification | customer_app | OBSOLETE → queue-workers push dispatcher + buyer inbox |
| `analyticsService.ts` | `onAnalyticsEvent`, `aggregateAnalyticsHourly/Daily`, `getSellerAnalytics`, `triggerAnalyticsAggregation` | Analytics | seller app | OBSOLETE → S1 analytics |
| `bankIfscSearch.ts`, misc | `searchIfscCodes`, `getDistrictsByState`, `checkEmailAvailability`, `checkPhoneAvailability`, `freezeStore`, `updateSellerTiers`, `updateSellerStatus` | Utilities / ops | seller/admin apps | OBSOLETE (IFSC lookup may be re-added behind the KYC adapter) |

Direct Firestore access from the app (not through functions): `products`, `sellers`, `users`, `addresses`, `orders`, `carts`, `wishlists`, `notifications`, `reels`, `saved_reels`, `reviews`, `loyalty`, `ad_*`, `recently_viewed`, `followers`, `trending_searches`, `app_updates`, `sessions`, `auth_logs` — see [05](./05-DATABASE-MAP.md).

## 3. S3 — AgriMore

### 3.1 Worker route policies (`Agrimore_Supabase:workers/api-gateway/src/routes.ts`)

| Method / path | Upstream Edge Function | Auth | Idempotent | Disposition |
|---|---|---|---|---|
| `GET /v1/catalog/{categories,home-feed,products/:id,search}` | `catalog-*` | none | no | DUPLICATE of S1 marketplace/storefront reads (search concept → location-aware search) |
| `GET /v1/serviceability/public-zones` | `serviceability-check` (returns `not_implemented`) | none | no | REBUILD in S1 |
| `GET` user reads: `/v1/me`, `/v1/cart`, `/v1/orders`, `/v1/orders/:id`, `/v1/addresses`, `/v1/wallet`, `/v1/notifications`, `/v1/rider/{profile,deliveries,earnings}`, `/v1/store/{queue,orders/:id/picklist,inventory}`, `/v1/seller/*` | respective functions | user | no | rider/store reads → port semantics; others DUPLICATE |
| `POST /v1/auth/{otp,otp/verify,refresh}` | `auth-*` | none | — | OBSOLETE → identity-platform |
| `POST` commands: `/v1/cart/items`, `/v1/checkout/quote`, `/v1/orders`, `/v1/payments/{intents,create-order}`, `/v1/orders/:id/cancel`, `/v1/addresses`, `/v1/addresses/serviceability`, `/v1/rider/{availability,heartbeat,deliveries/:id/accept,deliveries/:id/status,deliveries/:id/proof}`, `/v1/delivery/:id/transition`, `/v1/store/orders/:id/{pick,pack,items/:itemId/confirm,ready}`, `/v1/store/inventory/adjust`, `/v1/seller/{onboarding,catalog/products}`, `/v1/notifications/register-token`, `/v1/admin/override`, `/v1/ops/dispatch/control`, `/v1/admin/sellers/:sellerId/approve`; `PATCH /v1/rider/status`, `/v1/seller/catalog/products/:id`; `PUT/DELETE /v1/addresses/:id`; `DELETE /v1/cart*` | command functions | user (`highRisk` rate limits) | yes (Redis) | quote, rider, store-ops, delivery transition semantics → **port into S1 gateway modules**; rest DUPLICATE |
| `POST /v1/payments/webhook`, `/v1/webhooks/razorpay`, `/v1/webhooks/notification-provider` | `webhooks-*` | webhook HMAC | yes | DUPLICATE of S1 webhook-service |
| `GET /v1/ops/summary` | `ops-summary` | admin | — | concept → Operations |
| cron `*/1 * * * *` → `enqueuePendingOutbox`; queue → `handleOutboxQueue` | outbox relay | — | — | DUPLICATE of S1 outbox |

### 3.2 Edge Functions (`supabase/functions/*`, 2,004 lines)

`assign-rider` (278), `checkout-submit` (233), `typesense-sync` (197), `checkout-quote` (193), `confirm-payment` (169), `dispatch-order` (153), `cancel-order` (119), `send-notification` (98), `payment-intents` (97), `cart-write` (84), `dispatch-orders` (60), `addresses-write` (57), `order-read` (52), `rider-status` (38), `cart-read`, `wallet-read`, `orders-read`, `notifications-read`, `auth-context`, `serviceability-check`, `addresses-read`. All trust `x-user-id` headers from the gateway (`_shared/worker_context.ts`). **Do not import**; port `assign-rider`, `dispatch-order`, `checkout-quote`/`expire_checkout_quote` behaviour as gateway modules + RPCs.

### 3.3 Realtime gateway (`workers/realtime-gateway`)

WebSocket upgrade with channel authorisation by role (`realtime/auth.ts:49-64`), Durable Object rooms tagged `order`, `rider.location_updated` events, Redis keys `rider:presence`, `rider:geo:<city>`, `rider:active_delivery`, `delivery:live`, `delivery:subscribers`, `dispatch:candidates`, `dispatch:offer`. **Port the pattern** (see [13](./13-QUICK-COMMERCE-ARCHITECTURE.md)); fix the auth parsing bug first.

### 3.4 RPCs

`commerce.{create_checkout_quote, expire_checkout_quote, create_payment_intent, confirm_order_from_quote, cancel_order, create_inventory_reservation, release_inventory_reservation, adjust_inventory, lock_wallet_amount, can_transition_order}`, `logistics.{assign_rider, transition_delivery, can_transition_delivery}`, `ops.{find_serviceable_store, emit_event, write_audit_log}`, `app.{current_user_*, assert_service_role, handle_new_auth_user}`.

## 4. Cross-system duplicates and gaps at the API layer

| Capability | S1 | S2 | S3 | Canonical |
|---|---|---|---|---|
| Create order | `POST /storefront/:subdomain/orders` → RPC | Firestore write from app + `calculateOrderCommission` | `POST /v1/orders` → `confirm_order_from_quote` | S1, with a quote step added for Quick |
| Verify payment | gateway verify (HMAC, bound, replay) + webhook | callable `verifyPaymentSignature` | Edge `confirm-payment` (conditional) | S1 |
| Serviceability | pincode rules | — | nearest-store RPC | new S1 module using S3 schema |
| Rider / dispatch | — | — | S3 commands + realtime | new S1 module ported from S3 |
| Notifications | queue-workers + inbox | Cloud Functions + FCM | Edge `send-notification` | S1 (FCM retained as transport) |
| Search | FTS | Firestore | Typesense | S1 now; provider later |

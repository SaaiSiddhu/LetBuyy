# 02 — Feature Inventory

Status vocabulary: `COMPLETE` (implemented end to end in source, tested at some layer) · `PARTIAL` · `UI_ONLY` · `BACKEND_ONLY` · `DEAD_CODE` · `DUPLICATE` · `LEGACY` · `UNKNOWN`. A status describes the **best** implementation among the three systems; the per-system cells say what each one has. "Target" names the destination in the unified platform ([08](./08-TARGET-DOMAIN-MODEL.md), [09](./09-TARGET-ARCHITECTURE.md)). Nothing here was exercised end to end in a running stack; "tested" means unit or isolated-Postgres suites.

Abbreviations: S1 = Store Builder / canonical, S2 = Firebase Marketplace, S3 = AgriMore. `—` = absent.

## Identity and accounts

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Merchant login / signup | identity-platform email OTP, Turnstile, rate limits, ES256/EdDSA session (`apps/identity-platform/src/app/api/auth/*`) | seller auth callables (`sellerAuth.ts`, 115-function bridge) — retired by decision | Supabase OTP (`/v1/auth/otp`) | COMPLETE | S1 | Identity | S2 seller auth explicitly retired 2026-09-04 |
| Customer login | per-store `store_customers` + HS256 session; platform `buyer_accounts` email+password, asymmetric buyer realm (`223_platform_buyer_identity.sql`) | Firebase Auth email+password, Google sign-in, email OTP callables | Supabase OTP | PARTIAL / DUPLICATE | S1 buyer realm (asymmetric) for identity; S2 UX | Identity | phone OTP absent in S1; S2 has Google sign-in |
| Operator login | dev-only magic link (`admin_web/…/console-auth/login/route.ts:27-29`) | admin OTP + TOTP callables | Supabase role `admin` | PARTIAL | none production-ready | Identity (operator realm) | S1 blocks in production |
| Rider / store-operator identity | — | — | `app.user_role` enum incl. `rider`, `store_operator`; `app.user_roles` scoped by city/store | BACKEND_ONLY | S3 model | Identity + Membership | port as scoped memberships |
| Staff / employees | `employees`, `employee_roles`, permissions JSON, invites; enforcement default `dryrun` | store users in Firestore (`store_users`) | memberships in ADR only | PARTIAL | S1 | Merchant / Membership | enforce mode never verified |
| Organisation model | `organizations`, `org_memberships`, `org_store_links` (159) behind `FEATURE_ORG_MODEL`, unwired | — | ADR-0004 design | BACKEND_ONLY | S1 DDL + S3 design | Merchant | DDL-real, wiring-dead |
| KYC | `merchant_kyc_documents`, `/kyc` routes; vendor adapter absent | PAN/Aadhaar extraction, face match, admin review callables (`kycVerification.ts`) | seller onboarding skeleton | PARTIAL | S1 storage + S2 flow ideas | Merchant | D-7 chose a licensed vendor; vendor open |
| Two-factor / step-up | `two-factor`, `security` routes, `STEP_UP_SIGNING_SECRET` | admin TOTP callables | — | PARTIAL | S1 | Identity | step-up on refunds/payouts not re-verified |

## Merchant, tenant, onboarding, billing

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Merchant onboarding wizard | `/onboarding` routes (start/status/steps/complete), `merchant_app` wizard | seller onboarding in retired seller app | `submitSellerOnboarding` | COMPLETE | S1 | Merchant | channel selection step absent |
| Multi-store ownership | `sites.custom_user_id`; `listOwnedStoreIds` | one seller per user | one seller profile | COMPLETE | S1 | Merchant | store = tenant; no org above it |
| Plans / subscriptions | `billing`, `internal-billing`, `payments/subscription/*`, `site_entitlement_overrides`, `site_usage_meters`, `plan_code` | `subscriptionService`, `store_subscriptions` | — | COMPLETE | S1 | Subscription / Entitlement | no per-channel entitlements yet |
| Entitlement checks | `site_entitlement_overrides` + plan limits; scattered checks | product limit enforcement (`enforceProductLimit`) | — | PARTIAL | S1 | Entitlement | needs `MARKETPLACE_CHANNEL`-style features |
| Trial / freeze | `sites.trial_*`, `frozen_at`; `checkTrialStatus` in S2 | `freezeStore`, `checkTrialStatus` | — | COMPLETE | S1 | Subscription | |
| Store suspension | `site.status` read in internal console | `updateSellerStatus` | `is_blocked` on profiles | PARTIAL | S1 | Merchant / Operations | no operator UI reachable in prod |

## Catalogue, listings, pricing

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Master product + variants | `products` (store-scoped, `variants` jsonb + `product_variants` with `sku`, `barcode`, `inventory_qty`), `hsn_code`, images, tags, metafields | Firestore `products` per seller (44 model files) | `catalog.products` + `product_variants` (`sku`, `barcode`, `mrp`, `default_sale_price`, `weight_g`), brands, categories | COMPLETE | S1 | Catalog | S1 lacks brand table and SKU uniqueness; S3 has `brands`, `unit_label`, `mrp` |
| Collections / smart collections | `collections`, `smart-collections`, `categories` routes | categories/subcategories, `category_attributes` | `catalog.categories`, `home_feed_shelves` | COMPLETE | S1 | Catalog | |
| Channel listing (per channel status, moderation) | `channel_listings` (`storefront`/`marketplace`/`instant`), moderation events, `transition_channel_listing`, admin queue (`217`) | products flagged in Firestore, admin approval callables | per-location listing designed (PDR-0002 §4), not built | COMPLETE (backend) | S1 | Listing | `pricing_policy` stored, unapplied |
| Channel pricing | `pricing_policy` jsonb only; feed reads `products.price` | one price | `mrp` + `default_sale_price` per variant; location prices designed | PARTIAL | none | Listing / Offer | new work |
| Location pricing | — | — | designed only | — | — | Listing / Offer | new work |
| Coupons / discounts / promotions | `coupons`, `discount_allocations`, `evaluate_checkout_promotion`, `promotion_*` tables | `coupons`, `deals` (admin-approved flash deals) | `commerce.coupons` (fixed, percentage, free delivery, cashback) with redemptions | COMPLETE | S1 | Promotion | funder concept absent everywhere except S3 design |
| Gift cards | `gift_card_*` ledger-backed RPCs | — | — | COMPLETE | S1 | Payment (tender) | |
| Loyalty | merchant-funded ledger points (`231`, `234` tender) | `loyalty`, `loyalty_transactions` cashback tiers | wallet cashback coupon type | COMPLETE | S1 | Promotion / Ledger | per-merchant, by decision D-17 |
| Reviews / ratings | `reviews` route, `review-checks` worker | `reviews`, `reviewStats`, review images to Storage | — | COMPLETE | S1 backend, S2 UI | Customer | |
| Bulk import | `products/import` proxy route, `merchant_app` import screen | — | — | PARTIAL | S1 | Catalog | verify behaviour |
| Search | Postgres FTS + `resource-search` | Firestore queries + `trending_searches` + visual/voice search UI | Typesense | PARTIAL | S1 for now; S2 UI | Catalog / Search | quick search must be location-aware |

## Inventory and fulfilment locations

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Locations | `inventory_locations(store_id, is_default)` | — | `ops.dark_stores` (geo point, radius, SLA, `accepts_orders`) | COMPLETE / DUPLICATE | S1 tenancy + S3 geo columns | Fulfilment Node | merge into one node entity |
| Stock levels | `inventory_levels` (available, reserved, committed, unavailable, incoming, safety) | `products.stock` counters | `commerce.inventory_items` (on_hand, reserved, safety, `CHECK reserved <= on_hand`) | COMPLETE | S1 | Inventory | S1 proven under concurrency |
| Reservations | `inventory_reservations` TTL, reserve/commit/release/expire RPCs; sweeper worker | — | reserve at quote, consume at confirm, expiry function unscheduled | COMPLETE | S1 | Inventory | S3 quote-time reservation pattern worth adopting for Quick |
| Transfers | create/ship/receive with partial receipt; same-site only | — | — | COMPLETE | S1 | Inventory | no cross-owner custody |
| Purchase orders / receiving | `purchase_orders`, receipts | — | store inventory adjust | COMPLETE | S1 | Inventory | |
| Adjustments + audit trail | `inventory_adjustments`, `inventory_events` | — | `stock_movements` append-only with reasons | COMPLETE | S1 + S3 reason codes | Inventory | |
| Node-level availability for Quick | — | — | `getAvailableInventory` per store | PARTIAL | S3 concept | Inventory | new in S1 |
| External till / feed ingestion | — | — | designed (ADR-0006 §6) | — | — | Inventory | new |

## Cart, checkout, payments

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Cart | `carts` (site, session, items jsonb), storefront cart routes with `cartToken`, buyer identity, discount codes | Firestore `carts` + local state; mobile/web/desktop cart screens | `commerce.carts` bound to one store; KV cart cache | COMPLETE / DUPLICATE | S1 backend; S2 UI | Cart | separate baskets per mode recommended |
| Checkout (storefront) | `POST /storefront/:subdomain/orders` → `create_checkout_order` (server totals, GST, shipping rates, coupons, gift card, loyalty, parent purchase) | Firestore order write after Razorpay success | quote → intent → confirm RPCs | COMPLETE | S1 | Order | S1 proven at SQL |
| Quote with expiry | hosted `checkout_sessions` (unverified callers) | — | `create_checkout_quote` / `expire_checkout_quote` | PARTIAL | S3 pattern | Order (Quick) | |
| Razorpay | order creation bound to `orders.total`, verify HMAC + stored order id + replay check, webhook raw-body HMAC + dedupe, refunds | `createRazorpayOrder`, `verifyPaymentSignature`, saved cards, VPA validation | intents + conditional signature | COMPLETE | S1 | Payment | S1 verify path does not read capture state |
| COD | `set_pending_cod_order_status`, COD reconciliation + ledger | COD orders in Firestore | disabled by PDR | COMPLETE | S1 | Payment | |
| UPI AutoPay / mandates | `LETBUYY_AUTOPAY_MODE` env, blocked on live activation | — | — | PARTIAL | S1 | Payment | |
| Wallet / stored value | wallet ledger projection, store credit ledger | seller wallet (retired), ad wallets | customer wallet with locks | PARTIAL | S1 ledger | Payment | S3 customer wallet is a mutable balance |
| Refunds / returns | two-step refund, `complete_order_refund`, returns routes, buyer return requests | `returnService` (QC reports, auto-reject, exchange orders) | `cancel_order` | COMPLETE | S1 backend; S2 return flow ideas | Order / Payment | provider `created` treated as refunded |
| GST invoices | `issue_gst_invoice`, immutable, tax lines per item | `generateSettlementInvoice` | tax_code only | COMPLETE | S1 | Order / Tax | |
| Ledger | double-entry with balance trigger (`139`) | balance history | `balance_after` column | COMPLETE | S1 | Ledger | |
| Commission | `commission_bps = 0` by validator; `commission` routes reconcile | `calculateOrderCommission`, tiers, RTO charges, platform fee | 3–4% commission designed | PARTIAL | S2 logic ideas; S1 ledger | Ledger / Settlement | conflicts with D-1; founder now wants per-channel commission |
| Settlement / payouts | `settlements/ingest`, `payout_statements`, manual settle, no rail | weekly/auto payouts, withdrawals (retired) | seller payouts read | COMPLETE (record-only) | S1 | Settlement | custody question open (D-2) |

## Orders and fulfilment

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Order model | `orders` + `order_items` (snapshot, tax breakdown), `purchases` parent, `order_line_adjustments`, risk assessments | Firestore `orders` with items array | `commerce.orders` (+ items, status events, read models) | COMPLETE | S1 | Order | |
| Merchant order workflow | list, detail, line edits, status patch, fulfil, packing slip, refund, returns; `merchant_app` screens | seller order screens (retired app) | seller orders read | COMPLETE | S1 | Order | |
| Fulfilment orders / shipments / labels | `fulfillment_orders`, `shipments`, `shipment_events`, label adapters (Shiprocket, Delhivery, Pickrr; sandbox) | — | — | COMPLETE (sandbox) | S1 | Fulfilment | live carriers not enabled |
| Shipping zones / rates / serviceability by pincode | `shipping_zones`, `shipping_rates`, `shipping_serviceability_rules`, `shipping_profiles` | seller shipping settings | — | COMPLETE | S1 | Fulfilment | pincode based |
| Quick order lifecycle (picking → rider → delivered) | — | — | `commerce.order_status` enum + store-ops handlers + dispatch | PARTIAL | S3 | Order (Quick) | port |
| Order tracking (customer) | order detail + shipment status | tracking screen (Firestore) | status timeline + ETA text | PARTIAL | S2 UI | Customer | live map only in AgriMore's archived Firebase app |
| Draft orders | `orders/drafts` + convert | — | — | COMPLETE | S1 | Order / POS seed | |

## Quick commerce and delivery

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Geo addresses | — (jsonb addresses, pincode) | Google Maps + geolocator address picker | `app.addresses.location geography` | PARTIAL | S2 UI + S3 storage | Customer / Fulfilment | |
| Zones (circle / polygon) | — | — | `ops.service_zones` polygon, `dark_stores.service_radius_m` | BACKEND_ONLY | S3 | Fulfilment | polygons unused by resolver |
| Serviceability resolver | pincode rules | — | `find_serviceable_store` nearest-one; Edge Function returns `not_implemented` | PARTIAL | S3 shape | Fulfilment | rewrite |
| Fulfilment node kinds (own, dark, partner) | one kind | — | dark stores only | — | — | Fulfilment | new |
| Store ops flows | — | — | queue/picklist/pick/pack/confirm/ready handlers + app | PARTIAL | S3 | Fulfilment | port |
| Rider profile / shift / availability | — | — | `rider_profiles`, `rider_shifts`, heartbeat, presence in Redis | PARTIAL | S3 | Delivery | |
| Dispatch / offers | — | — | `assign_rider`, 45 s offers, unique offer id, accept, versioned transitions; no re-offer job | PARTIAL | S3 | Delivery | |
| Live location / tracking | — | — | DO + WebSocket + Redis live state; rebuilt customer app shows text only | PARTIAL | S3 plumbing | Delivery / Realtime | map UI new |
| Proof of delivery | — | — | signed proof upload | PARTIAL | S3 | Delivery | |
| Rider earnings / wallet | — | — | earnings read from records | PARTIAL | S3 | Delivery / Ledger | must post to ledger |
| ETA | — | — | static `target_sla_seconds` | PARTIAL | — | Delivery | routing provider needed |

## Customer-facing features

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Marketplace home / feed / banners / sponsored | `marketplace_feed`, banners, sponsored strip, follower graph, personalization (CAP-FB-*) | mature home with banners, sponsored, suggested, rate-your-purchases | home shelves | COMPLETE backend; COMPLETE UI | S1 backend + S2 UI | Customer | |
| Product detail / seller store / seller profile | listing detail route | rich screens | product detail | COMPLETE | S2 UI + S1 data | Customer | |
| Wishlist | `customer_wishlists` (bounded writes) | `wishlists` | — | COMPLETE | S1 backend, S2 UI | Customer | |
| Reels | blocked on media pipeline (RESERVED root) | reels feed, saved reels, comments, likes | — | UI_ONLY (canonically) | S2 UI | Customer | ARB-gated |
| Buyer ↔ seller chat, AI chat | buyer support tickets + conversations | support chat, AI chat (Gemini) | — | PARTIAL | S1 tickets; S2 UI | Customer | AI chat superseded per decision |
| Notifications inbox | `buyer_notifications` | Firestore `notifications` + FCM | `ops.notifications` | COMPLETE | S1 + FCM | Notification | |
| Returns (buyer) | `request_order_return` RPC, buyer return routes | return request/tracking screens, QC | — | COMPLETE | S1 backend, S2 UI | Order | |
| Addresses | `customer_addresses` per store; buyer-level absent | Firestore `addresses` with map picker | geo addresses | PARTIAL | S2 UI + S3 storage | Customer | platform address book new |
| App update gating | `mobile-release-routes` | `app_updates` | — | COMPLETE | S1 | Platform | |
| Downloads / digital goods | — | downloads screen | — | UNKNOWN | S2 | Customer | verify backend |
| Referral / growth | — | — | `app.referrals`, growth feature | PARTIAL | S3 | Customer | |

## Storefront builder

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Subdomain + custom domain + TXT verification + SSL via Vercel | complete (`custom-domains.ts`) | `deployStore`, `serveStore`, `domainMapping` (retired) | — | COMPLETE | S1 | Storefront | |
| Themes: drafts, publish, releases, rollback, preview, packages | complete (`themes.ts`) | `store_themes` | — | COMPLETE | S1 | Storefront | Liquid canonical, default off |
| Pages, navigation, policies, blog | complete | — | — | COMPLETE | S1 | Storefront | |
| Password-protected / preview links | complete | — | — | COMPLETE | S1 | Storefront | |
| SEO (robots, sitemap) | complete | — | — | COMPLETE | S1 | Storefront | |

## Marketing, ads, analytics

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Email campaigns / leads / WhatsApp | `marketing`, `email`, `whatsapp` routes | broadcast notifications | — | COMPLETE | S1 | Marketing | |
| Ads: prepaid credits, campaigns, sponsored ranking, signed events | complete (CAP-FB-ADS) | ad campaigns, ad wallets, impressions/clicks | — | COMPLETE | S1 | Marketing / Ledger | |
| Merchant analytics | `analytics` (dashboard, revenue, top products, traffic, live), `commerce-analytics` (supplier, warehouse, transfer, operations) | seller analytics aggregation | seller analytics read | COMPLETE | S1 | Analytics | channel breakdown absent |

## Operations / admin

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Listing moderation queue | `admin_web/marketplace-listings` + RPC | admin approval callables | seller approve | COMPLETE (backend); UI unreachable in prod | S1 | Operations | login blocker |
| Merchants, users, risk, incidents, reconciliation, revenue, compliance, audit logs | `admin_web` pages | admin app (retired) | ops summary | PARTIAL | S1 | Operations | |
| Zones / dark stores / partner stores / riders admin | — | — | dispatch control stub | — | — | Operations | new |
| Support | tickets + conversations | support chat | — | PARTIAL | S1 | Operations | |

## Platform infrastructure

| Feature | S1 | S2 | S3 | Status | Best | Target | Notes |
|---|---|---|---|---|---|---|---|
| Idempotency | `IdempotencyExecutionAdapter`, advisory locks in RPCs, `(site_id, idempotency_key)` uniques | — | Redis + `ops.idempotency_keys` | COMPLETE | S1 | Platform | |
| Outbox / queues / DLQ | `outbox_events`, `outbox_dead_letters`, 7 consumers | Firestore triggers | `ops.outbox_events` relay | COMPLETE | S1 | Platform | |
| Webhooks (in/out) | webhook-service | Razorpay webhook function | `/v1/webhooks/razorpay` | COMPLETE | S1 | Platform | |
| Rate limiting / Turnstile | fail-closed limiter, Turnstile | — | Redis rate limits per route policy | COMPLETE | S1 | Platform | |
| Media | R2 + MIME allowlist + signed intents | Firebase Storage | R2 media-gateway | COMPLETE | S1 | Media | asset URL migration needed for S2 |
| Realtime | — | Firestore listeners | DO + WebSocket + Redis | PARTIAL | S3 | Realtime | new in S1 |
| Governance gate | 114 validators, executable suites | — | foundation CI | COMPLETE | S1 | Platform | |

# Phase 2 — Domain Discovery & Ownership (LetBuyy Platform)

Investigation date: 2026-06-05

Scope and exclusions identical to Phase 1. Every domain assignment below is grounded in source files; the designed/intended boundaries are cross-checked against `docs/governance/domain-governance.md` and `AGENTS.md`, but actual ownership is determined from code, not prose.

## Method

- Domain seeding: `docs/governance/domain-governance.md` "Canonical Domain Package Targets" table (read in full) and `AGENTS.md` "Domain Ownership Rules" (lines 110–117) provided the intended package list; treated as claims, then verified.
- Located logic per domain with `Grep` for domain-characteristic symbols/tables across `apps/`, `services/`, `packages/`:
  - checkout/orders/tax: `computeOrderTotals|subtotal|gstRateBps|cgst|igst|OrderExecutionAdapter|generateGstInvoice`
  - auth: `verifyPassword|hashPassword|bcrypt|createSession|customer_credentials|users_custom|password_hash|by-email`
  - theme: `Liquid|renderTheme|renderSection|theme_editor|theme-engine`
  - commerce: `planProductCreate|ProductExecutionAdapter|@letbuyy/commerce-core`
  - search: `search_documents|textSearch|trigram|SearchProviderAdapterPort`
  - media: `R2_BUCKET|media_assets|upload`
  - CMS/portfolio: `RESUME_CONTENT_SECTION_TABLES|portfolio_projects|resume_versions|site_type`
  - operations/runtime: `/v1/operations/runtime|replay|rollback|queue` and `packages/distributed-runtime`
- Read representative ownership-defining files in each domain (route → execution-adapter → application-service → domain package chains).
- Read `apps/merchant-control-plane/src/components/merchantNavigation.ts`, mobile `app_config.dart`, `product_service.dart`, both `lib/api/client.ts` files, `apps/storefront-runtime/src/lib/customer-service.ts`, `services/api-gateway/src/routes/storefront.ts`, `apps/identity-platform/src/app/api/auth/login/route.ts`.

---

## 1. Business domains present (with evidence)

| Domain | Present? | Primary evidence |
|---|---|---|
| Identity / merchant auth | Yes | `apps/identity-platform` (login/signup/OTP/reset routes), `packages/auth-core`, api-gateway `routes/auth.ts` (`users_custom`) |
| Customer auth (storefront) | Yes | api-gateway `routes/storefront.ts` (`customer_credentials`, bcrypt), `apps/storefront-runtime/src/app/api/customer/*`, `packages/auth-core/src/customer-session` |
| Catalog / commerce (products, categories, collections, customers) | Yes | `packages/commerce-core`, api-gateway `routes/{products,categories,customers,reviews}.ts` + `execution/product-execution.adapter.ts` |
| Inventory (levels, transfers, POs, suppliers) | Yes | `packages/commerce-core` (transfer/PO/adjust schemas), api-gateway `routes/inventory.ts`, DB tables `inventory_*`, `purchase_orders`, `inventory_transfers` |
| Checkout / orders / GST tax | Yes | `packages/checkout-core` (line-level CGST/SGST/IGST math lines 406–418), api-gateway `routes/orders.ts` → `execution/order-execution.adapter.ts` (`generateGstInvoice`) |
| Payments | Yes | `packages/payments` (provider-neutral contracts), `packages/infrastructure/{razorpay,stripe,paypal,cashfree,phonepe,upi,cod}-adapter`, api-gateway `routes/payments.ts`, `services/webhook-service` |
| Billing / subscriptions / plans | Yes | `packages/billing-core` (65 exports), api-gateway `routes/admin.ts` + payments subscription, merchant `api/stores/[store]/plan` proxy, DB `plans`/`subscriptions`/`plan_entitlements` |
| Tenant / store / sites | Yes | `packages/tenant-core` (`SiteType`, subdomain validation), api-gateway `routes/stores.ts`, DB `sites` (not `stores`, per naming rule) |
| Theme system | Yes | `packages/theme-engine` (liquidjs renderer), api-gateway `routes/themes.ts` + `execution/theme-execution.adapter.ts`, `apps/storefront-runtime/src/lib/theme-engine/*`, merchant `components/theme-editor/*`, mobile `widgets/editor/*` |
| Theme marketplace | Yes | `apps/theme-marketplace`, api-gateway `routes/themes.ts`, DB `theme_packages`/`theme_purchases`/`theme_releases` |
| CMS (pages, navigation, policies, blog) | Yes | `packages/cms-core`, api-gateway `routes/{pages,blog,form-submissions}.ts`, DB `storefront_pages`/`blog_posts`/`navigation_menus` |
| Portfolio / resume / multi-site-type | Yes | `packages/cms-core` (`RESUME_CONTENT_SECTION_TABLES`), api-gateway `routes/{portfolio,resume}.ts`, merchant `[store]/{projects,skills,experience,education,certifications,testimonials,gallery,leads,ats-score}` pages, DB `portfolio_projects`/`resume_versions`/`skills`/`education`/`work_experience`/`certifications` |
| App marketplace / extensions | Yes | `packages/app-engine`, `packages/extension-host`, `apps/app-marketplace`, api-gateway `routes/app-store.ts` + `extensions/app-functions-runtime.ts`, DB `marketplace_apps`/`app_installations`/`app_extensions` |
| Search | Yes (thin) | `packages/search-core` (47 LOC contracts), execution in api-gateway `routes/storefront.ts` (Postgres `search_documents` textSearch), migration `084_trigram_search_indexes.sql`; `services/search-service` reserved |
| Media / uploads | Yes | api-gateway `routes/{upload,media}.ts` (`R2_BUCKET.put`), `packages/infrastructure/storage-adapter`, DB `media`/`media_assets`; `services/media-service` reserved |
| Notifications / email | Yes | `packages/notification-core`, `packages/infrastructure/resend-adapter`, api-gateway `routes/notifications.ts`, identity `lib/email/resend.ts`, DB `notifications`/`email_logs`/`device_tokens`; `services/notification-service` reserved |
| Analytics | Yes | api-gateway `routes/analytics.ts` (`analytics_rollups_daily`), CF `ANALYTICS_QUEUE`, DB `analytics_events`/`analytics_event_stream`; `services/analytics-pipeline` reserved |
| Platform operations / runtime control | Yes | `packages/distributed-runtime` (75 modules), api-gateway `routes/operations.ts` (`/v1/operations/runtime`, 126 runtime/replay/queue refs), consumed by `apps/platform-console` + `apps/platform-operations-portal` |
| Developer platform | Yes (docs-only) | `apps/developer-portal` (static reference of real gateway/app-engine/theme-engine contracts; absent surfaces marked `SKIP - NEEDS BACKEND`/`SKIP - NEEDS SDK/CLI` in `src/lib/reference.ts`) |
| AI assistant | Yes | api-gateway `routes/ai.ts` + `schemas/ai.schema.ts`, `packages/app-engine` (AI payloads), merchant/storefront `ai` surfaces, DB `ai_credits`/`ai_usage` |
| Shipping / fulfillment / returns | Yes | api-gateway `routes/shipping-tax.ts`, `packages/checkout-core` (fulfillment/shipping types), DB `shipments`/`fulfillment_orders`/`returns`/`shipping_zones`/`shipping_rates` |
| Coupons / promotions / gift cards | Yes | `packages/commerce-core` (gift card) + `packages/checkout-core` (discounts), api-gateway `routes/coupons.ts`, DB `coupons`/`promotions`/`gift_cards`/`promotion_rules` |
| RBAC / employees / platform staff | Yes | `packages/auth-core` (RBAC types), api-gateway `routes/employee.ts` + `internal-console.ts` + `middleware/rbac.ts`, DB `employees`/`employee_roles`/`site_roles`/`super_admin_allowlist` |
| Legacy commerce (retired) | Present but quarantined | `legacy/firebase/functions/src/*` (sellerAuth, settlementService, walletService, commissionService, kycVerification) — not imported by active runtimes |

## 2. Domain Ownership Report (domain → owning workspaces → key files)

### Identity / merchant authentication
- **Contract owner:** `packages/auth-core` (`SignUpSchema`, `SignInSchema`, `OtpVerifySchema`, `ActorIdentity`, RBAC types — `src/index.ts:6-60`).
- **Credential storage owner:** `services/api-gateway` — `routes/auth.ts` reads/writes `users_custom.password_hash` (`/custom/users/by-email` line 143; password update line 536).
- **Verification + hashing owner:** `apps/identity-platform` — owns its own bcrypt at **12 salt rounds** (`src/lib/auth/password.ts:3`) and performs `verifyPassword(password, user.password_hash)` locally in `src/app/api/auth/login/route.ts:85` after fetching the hash from the gateway (`/auth/custom/users/by-email`, route line 50). Also owns sessions/tokens/CSRF/device/Turnstile under `src/lib/auth/*` and `src/lib/{turnstile,rate-limit}.ts`, plus password-set-intent and reset.
- **Key files:** auth-core `src/index.ts`; identity `src/app/api/auth/{login,signup,verify-otp,reset-password,set-password,switch,send-magic,send-reset,validate-subdomain,accounts,stores,session}/route.ts` (18 routes); api-gateway `routes/auth.ts`.

### Customer (shopper) authentication — separate per AGENTS.md "Storefront customer auth must remain separate from merchant/admin auth"
- **Credential + hashing owner:** `services/api-gateway` — `routes/storefront.ts` owns `customer_credentials`, hashing with `bcrypt.hash(password, 10)` (**10 rounds**, lines 3812/3966), verification at line 4065.
- **Session-cookie owner:** `apps/storefront-runtime` — `src/lib/session.ts` (`createSession`) and `src/lib/customer-service.ts` (`verifyCustomerPassword` delegates to gateway via storefront API client, lines 154-161). Customer routes: `src/app/api/customer/{login,logout,session,check,auto-create,profile,addresses,orders,wishlist,set-password}/route.ts`.
- **Contract owner:** `packages/auth-core/src/customer-session` (re-exported from auth-core index line 4).

### Catalog / commerce (products, categories, collections, customers, reviews)
- **Contract + pure logic owner:** `packages/commerce-core/src/index.ts` (1,076 lines) — Zod schemas + planners `planProductCreate` (line 1000), `planProductUpdate` (1046), `buildCategoryTree` (710), `buildCustomerSummaries` (857), inventory mappers.
- **Execution owner:** `services/api-gateway` — `routes/{products,categories,customers,reviews}.ts` → `execution/product-execution.adapter.ts`, delegating workflow to `packages/application-services/commerce-application`.
- **Consumers:** `apps/merchant-control-plane` (proxy routes `api/stores/[store]/products/*`), `apps/storefront-runtime` (read via `src/lib/product-service.ts`), `apps/mobile/merchant-app` (`lib/services/product_service.dart`).

### Inventory
- **Owner:** `packages/commerce-core` (transfer/PO/supplier/adjust schemas + `mapInventoryLevelRecord`), api-gateway `routes/inventory.ts`. DB tables `inventory_levels`, `inventory_transfers(+_lines/_receipts)`, `purchase_orders(+_lines/_receipts)`, `inventory_reservations`, `suppliers`. Migration `088_inventory_available_batch.sql`.

### Checkout / orders / GST taxation
- **Pure tax/totals owner:** `packages/checkout-core/src/index.ts` — line-item GST math computing `cgstAmountMinor`/`sgstAmountMinor`/`igstAmountMinor` from `gstRateBps` and intra/inter-state supply type (lines 406-418); order/cart/fulfillment/refund schemas and status enums.
- **Execution owner:** `services/api-gateway` — `routes/orders.ts` uses `OrderExecutionAdapter` (line 474) which imports `CHECKOUT_APPLICATION_WORKFLOWS` from `packages/application-services` and `generateGstInvoice`/`planOrderStatusTransition` from `checkout-core` (`execution/order-execution.adapter.ts:6-24`).
- **Workflow owner:** `packages/application-services/checkout-application`.
- DB: `orders`, `order_items`, `order_{tax,shipping}_lines`, `checkout_sessions`, `carts`, `refunds`, `returns`.

### Payments
- **Contract owner:** `packages/payments/src/index.ts` (INR minor units, branded `IdempotencyKey`, provider-neutral intent types).
- **Provider SDK owner (sole):** `packages/infrastructure/*-adapter` — razorpay/stripe/paypal/cashfree/phonepe/upi/cod. Confirmed provider SDKs (stripe, etc.) appear only in `packages/infrastructure/package.json`.
- **Execution owner:** api-gateway `routes/payments.ts` + `execution/payment-execution.adapter.ts`; **webhook owner:** `services/webhook-service` (signature verification + idempotent `payment_webhook_events`, `src/index.ts:64-75`).

### Billing / subscriptions / plans
- **Contract owner:** `packages/billing-core` (plans/entitlements/usage/subscription contracts, 65 exports). **Execution:** api-gateway (admin/payments subscription). **UI:** merchant-control-plane (`[store]/settings/{plan,billing,subscribe}`, proxy `api/stores/[store]/plan`), platform-console (`subscriptions`). DB `plans`, `subscriptions`, `plan_entitlements`, `billing_history`, `usage_meter_entries`, `site_usage_meters`.

### Tenant / store / sites
- **Contract owner:** `packages/tenant-core` (`SiteType = store|portfolio|resume|blog|landing` line 5; subdomain validation, reserved subdomains, navigation). **Execution:** api-gateway `routes/stores.ts`. DB authority is `sites` (naming rule: "Do not create a `stores` table"). `tenant-core` depends on `theme-engine` (theme settings live with tenant).

### Theme system (engine + editing + marketplace) — multi-workspace
- **Contract + render-core owner:** `packages/theme-engine/src/*` (theme-registry, theme-renderer, theme-bundle, execution-runtime; only package with `liquidjs`).
- **Storefront render runtime:** `apps/storefront-runtime/src/lib/theme-engine/*` (composition-engine.tsx, liquid-hydration-islands.tsx, template-resolver.ts, data-binding-engine.ts, renderer-registry.tsx) — Liquid rendering also present here (see boundary report).
- **Web editor UI:** `apps/merchant-control-plane/src/components/theme-editor/*` (9 components) + `[store]/online-store/themes/[themeId]/editor`.
- **Mobile editor UI:** `apps/mobile/merchant-app/lib/widgets/editor/*` + `lib/models/theme_editor_models.dart`.
- **Marketplace:** `apps/theme-marketplace` + api-gateway `routes/themes.ts` + `execution/theme-execution.adapter.ts`.
- **Persisted authority:** ~30 `theme_*` DB tables (theme_packages, theme_releases, theme_instances, theme_templates, theme_section_definitions, theme_editor_drafts, etc.).

### CMS + Portfolio/Resume (multi-site-type content)
- **Contract owner:** `packages/cms-core` — pages/nav/policies plus portfolio/resume: `RESUME_CONTENT_SECTION_TABLES` (line 199, maps `projects→portfolio_projects` etc.), `sanitizeResumeContentInput`, `PortfolioProject` (line 767).
- **Execution owner:** api-gateway `routes/{pages,blog,portfolio,resume,form-submissions}.ts` (resume route imports cms-core helpers, `routes/resume.ts:5-11`).
- **UI owner:** `apps/merchant-control-plane` — `src/components/merchantNavigation.ts` defines five navigation sets keyed by `SiteType` (`storeNavigation`/`portfolioNavigation`/`resumeNavigation`/`landingNavigation`/`blogNavigation`, lines 63/125/153/179/187) selected via `getMerchantNavigation(storeData.site_type)` (`Sidebar.tsx:33`). Pages: `[store]/{projects,skills,experience,education,certifications,testimonials,gallery,leads,contact,ats-score}`.
- DB: `storefront_pages`, `blog_posts(+categories/tags/comments)`, `portfolio_projects`, `resume_versions`, `skills`, `education`, `work_experience`, `certifications`, `testimonials`, `gallery_items`, `leads`, `contacts`.

### App marketplace / extensions
- **Contract owner:** `packages/app-engine` (app contracts, AI payloads, app blocks) + `packages/extension-host`. **Execution:** api-gateway `routes/app-store.ts` + `extensions/app-functions-runtime.ts`; lifecycle dispatch in `services/webhook-service/src/app-lifecycle-dispatch.ts`. **UI:** `apps/app-marketplace`. DB `marketplace_apps`, `app_installations`, `app_extensions`, `app_developers`, `app_webhooks`, `app_reviews`.

### Search
- **Contract owner:** `packages/search-core` (47 LOC: `SearchDocument`, `SearchQuerySchema`, providers postgres/typesense/meilisearch/algolia). **Port stub:** `packages/infrastructure/search-provider-adapter` (interface only). **Actual execution:** api-gateway `routes/storefront.ts` Postgres `search_documents` `.textSearch('search_vector', …)` (line 916) + ilike fallbacks; `services/search-service` is reserved (manifest-only).

### Media / uploads
- **Execution owner:** api-gateway `routes/upload.ts` writes R2 directly via `c.env.R2_BUCKET.put` (line 86) and `routes/media.ts` registers `media`/`media_assets` metadata. `packages/infrastructure/storage-adapter` exists. `services/media-service` reserved.

### Notifications / email
- **Contract owner:** `packages/notification-core`. **Provider:** `packages/infrastructure/resend-adapter`. **Execution:** api-gateway `routes/notifications.ts`; identity-platform sends transactional email via `src/lib/email/resend.ts` (store-creation success/failure routes). `services/notification-service` reserved. DB `notifications`, `notification_preferences`, `email_logs`, `device_tokens`, `devices`.

### Analytics
- **Execution owner:** api-gateway `routes/analytics.ts` reads `analytics_rollups_daily` (line 63); events fan out via CF `ANALYTICS_QUEUE` to `services/queue-workers`. `services/analytics-pipeline` reserved. DB `analytics_events`, `analytics_event_stream`, `analytics_rollups_daily`.

### Platform operations / distributed runtime
- **Contract/algorithm owner:** `packages/distributed-runtime` (75 `*-runtime.ts`: leases, fencing, WAL, CRDT, saga-recovery, replay, queue-partitioning, telemetry) + `packages/orchestration` + `packages/projection-runtime`.
- **Execution owner:** `services/api-gateway` — `routes/operations.ts` exposes `/v1/operations/runtime` (126 runtime/replay/queue/rollback references), `durable/runtime-coordinator.ts` (Durable Object), and 8 `execution/*-execution.adapter.ts`.
- **Consumers:** `apps/platform-console` (`(dashboard)/operations/page.tsx` fetches `/v1/operations/runtime/overview`, line 5) and `apps/platform-operations-portal`.
- **Persisted authority:** ~50 runtime/ops DB tables (`runtime_*`, `replay_*`, `queue_*`, `projection_*`, `deployment_*`, `chaos_experiment_runs`, `load_test_runs`, etc.) in `000_baseline.sql`.

### Developer platform (documentation)
- **Owner:** `apps/developer-portal` — static `src/lib/reference.ts` mirrors real gateway/app-engine/theme-engine/auth-core/webhook source files (`sourceFiles` array) with explicit `SKIP - NEEDS BACKEND` / `SKIP - NEEDS SDK/CLI` status for unbuilt surfaces (API-key management line 312, CLI line 269). No backend of its own (only dep `@letbuyy/ui`).

## 3. Domain Boundary Report (crisp vs blurred)

### Crisp boundaries (well-separated, evidenced)

1. **Provider SDK isolation — crisp.** All payment/storage/email/db/cache SDKs live only in `packages/infrastructure/*-adapter` (verified: stripe/resend/@supabase/postgres/@upstash appear only in `packages/infrastructure/package.json`). Routes and webhook-service consume adapters, never SDKs.
2. **Merchant API proxy vs gateway execution — crisp.** `apps/merchant-control-plane` API routes delegate to the gateway via `@letbuyy/api-client` (`api/stores/[store]/products/route.ts:35` `createMerchantApiClient().products.list`); no direct DB access in the app.
3. **Storefront has no DB credentials — crisp.** No `@supabase`/`SERVICE_ROLE`/`createClient` references anywhere in `apps/storefront-runtime/src`; the `/api/seed` route is intentionally disabled (returns 410, route lines 17-23). All reads flow through the storefront API client to the gateway.
4. **Commerce/checkout pure logic in packages — crisp.** Totals/GST math (`checkout-core`) and product/category planning (`commerce-core`) are framework-free pure functions consumed by gateway execution adapters; matches `domain-governance.md` targets.
5. **Domain `*-core` → application-services → runtime-composition layering — crisp.** Dependency edges (Phase 1 §7.3) never reverse; no package imports an app or service.

### Blurred / split boundaries (same domain in multiple workspaces — file evidence)

1. **Authentication is split three ways and duplicated across runtimes (HIGH blur).**
   - Merchant password **hashing** lives in `apps/identity-platform/src/lib/auth/password.ts` (bcrypt, **12 rounds**), but the **storage** of `users_custom.password_hash` is in `services/api-gateway/routes/auth.ts`. Verification (`bcrypt.compare`) is performed in the identity app, not the gateway (`login/route.ts:85`).
   - Customer password hashing+verification lives entirely in `services/api-gateway/routes/storefront.ts` (bcrypt, **10 rounds**, `customer_credentials`).
   - Result: two different bcrypt cost factors (12 vs 10) for two actor types, in two different runtimes, with `packages/auth-core` holding only schemas/types — no shared hashing implementation. For merchants the "credential authority" is split between identity-platform (compute) and api-gateway (persist); for customers it is unified in api-gateway. (The actor separation is intentional per AGENTS.md "customer auth separate from merchant auth", but the *location* of merchant hash computation outside the credential-owning service is a boundary smear.)

2. **Theme rendering exists in both `packages/theme-engine` and `apps/storefront-runtime/src/lib/theme-engine` (HIGH blur).** Liquid usage (`grep Liquid`) is found in theme-engine `theme-bundle.ts`/`theme-renderer.ts` AND in storefront-runtime `composition-engine.tsx`/`liquid-hydration-islands.tsx`/`template-resolver.ts`. The package owns schema/registry/renderer contracts; the app owns a parallel React/Liquid composition+hydration runtime (`data-binding-engine.ts`, `renderer-registry.tsx`). `runtime-boundaries.md:38` even carves out a special rule ("`apps/storefront-runtime/consumer-storefront` may not be used as a nested runtime or theme authority"), signalling historical theme-authority tension at the app boundary.

3. **Theme editing UI duplicated across three runtimes (MEDIUM blur).** Web editor (`apps/merchant-control-plane/src/components/theme-editor/*`, 9 components), Flutter editor (`apps/mobile/merchant-app/lib/widgets/editor/*` with its own `theme_editor_models.dart`), and theme-marketplace install/preview. Each re-implements section/block editing UI against the shared `theme-engine` contracts (TS) — the mobile editor cannot import the TS contracts and re-declares them in Dart.

4. **Commerce contracts re-declared in Dart (MEDIUM blur — cross-language).** `packages/commerce-core` (TS) is the product/order contract authority, but `apps/mobile/merchant-app/lib/services/product_service.dart` independently constructs product payloads (`price`, `compare_price`, `stock`, `variants` — lines 72-95) and `lib/models/*` re-declare order/store/product shapes. The mobile app targets the same gateway (`app_config.dart:8` `api.letbuyy.store/v1`), so the contract is duplicated in two languages with no shared source; `packages/dart/models` is the intended Dart home (per `domain-governance.md:32`) but app-local models persist.

5. **Search contract vs execution split, with a dead port (MEDIUM blur).** `packages/search-core` defines documents and 5 providers; `packages/infrastructure/search-provider-adapter` defines a `SearchProviderAdapterPort` interface — but the only real implementation is inline Postgres `textSearch`/`ilike` in `api-gateway/routes/storefront.ts`. The adapter port has no concrete provider, and `services/search-service` is manifest-only, so "search" is contractually a domain but operationally a few queries inside the storefront route.

6. **Multi-site-type CMS spans tenant-core + cms-core + merchant UI (MEDIUM blur).** `SiteType` is defined in **both** `packages/tenant-core` (`src/index.ts:5`) and re-declared in `apps/merchant-control-plane/src/components/merchantNavigation.ts:1` (`MerchantSiteType`). The same five-way enum (store/portfolio/resume/landing/blog) drives navigation in the app, content tables in cms-core, and plan resolution in DB function `000_baseline.sql:7281` — three independent definitions of the site-type taxonomy.

7. **Media R2 access in the route, not the adapter (LOW blur).** `api-gateway/routes/upload.ts` calls `c.env.R2_BUCKET.put/.delete` directly (lines 86/123) even though `packages/infrastructure/storage-adapter` exists — the storage provider boundary is bypassed for upload while `media.ts` handles metadata. Minor inconsistency with the "provider use belongs in infrastructure adapters" rule.

8. **Reserved services own domains that are actually executed in the gateway (LOW blur, by design but worth flagging).** `services/{notification,search,media,analytics,checkout-runtime,event-bus}` each carry a `runtime.manifest.json` claiming ownership of their domain (e.g. analytics-pipeline manifest's `eventStoreOwnership`/`queueProviderOwnership`), but the live logic for notifications/search/media/analytics/checkout currently runs inside `services/api-gateway` and `services/queue-workers`. The declared owner and the executing runtime diverge for these domains.

9. **Two API surfaces for storefront/admin reads (LOW blur).** The gateway exposes both REST routers and GraphQL (`graphql/admin.ts`, `graphql/storefront.ts`, mounted at `/admin/graphql` and `/storefront/graphql`, `index.ts:380-399`) plus a `graphql/rest-shim.ts`. Two co-existing query protocols for the same commerce/storefront domains, gated by `FEATURE_GRAPHQL` (off in production per `wrangler.toml:213`).

## 4. Domain-to-table coverage note

`database/supabase/migrations/000_baseline.sql` defines **233 tables** (grep count). They cluster cleanly by domain prefix: `theme_*` (~30), `runtime_*`/`replay_*`/`queue_*`/`projection_*`/`deployment_*` operations (~50), `order_*`/`payment_*`/`refund_*`/`return_*`/`shipment_*` commerce-checkout (~25), `inventory_*`/`purchase_order_*`/`product_*` (~15), `app_*`/`marketplace_*` (~8), `blog_*`/`portfolio_*`/`resume_*`/CMS content (~20), `site_*`/`store_*`/tenant (~12), auth (`users`, `users_custom`, `sessions`, `customer_credentials`, `employees`, `site_roles`) (~15). The table taxonomy corroborates the domain map above.

## Evidence Index

- docs/governance/domain-governance.md (full); docs/governance/runtime-boundaries.md:38; AGENTS.md:110-117 (Domain Ownership Rules)
- packages/auth-core/src/index.ts:4-60; packages/commerce-core/src/index.ts:663-1075; packages/checkout-core/src/index.ts:406-418; packages/payments/src/index.ts; packages/tenant-core/src/index.ts:5,24,42; packages/cms-core/src/index.ts:199,205,347,767; packages/search-core/src/index.ts (full, 47 lines); packages/theme-engine/src/{theme-bundle,theme-renderer,index}.ts; packages/billing-core/src/index.ts; packages/infrastructure/search-provider-adapter/index.ts; packages/infrastructure/package.json
- services/api-gateway/src/index.ts:373-424; routes/auth.ts:143,536; routes/storefront.ts:6,910,916,3786-3986,4065; routes/orders.ts:6,474; routes/{products,categories,customers,reviews,inventory,coupons,pages,blog,portfolio,resume,analytics,operations,upload,media,notifications,app-store,themes,payments}.ts; execution/order-execution.adapter.ts:6-24; execution/product-execution.adapter.ts; graphql/{admin,storefront,rest-shim}.ts; durable/runtime-coordinator.ts; middleware/rbac.ts; wrangler.toml:213
- services/webhook-service/src/index.ts:64-75; src/app-lifecycle-dispatch.ts; services/queue-workers/src/index.ts
- services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/runtime.manifest.json
- apps/identity-platform/src/lib/auth/password.ts:3,9,17; src/app/api/auth/login/route.ts:50,85; src/lib/email/resend.ts
- apps/storefront-runtime/src/lib/customer-service.ts:148-163; src/lib/session.ts; src/app/api/customer/login/route.ts:3-4,17; src/app/api/seed/route.ts:17-23; src/lib/theme-engine/{composition-engine.tsx,liquid-hydration-islands.tsx,template-resolver.ts,data-binding-engine.ts,renderer-registry.tsx}; src/lib/product-service.ts; AGENTS.md (generated)
- apps/merchant-control-plane/src/components/merchantNavigation.ts:1,63,125,153,179,187,207-210; src/components/Sidebar.tsx:33; src/components/theme-editor/* (9 files); src/app/api/stores/[store]/products/route.ts:35; src/lib/api/client.ts:14
- apps/platform-console/src/app/(dashboard)/operations/page.tsx:5,22
- apps/developer-portal/src/lib/reference.ts:11,16-27,269,279,312,322; src/components/PortalChrome.tsx:36
- apps/mobile/merchant-app/lib/config/app_config.dart:8; lib/services/product_service.dart:72-95; lib/models/theme_editor_models.dart; lib/widgets/editor/*
- database/supabase/migrations/000_baseline.sql (233 CREATE TABLE; site_type plan fn lines 7263-7342; 7713); 084_trigram_search_indexes.sql; 088_inventory_available_batch.sql
- legacy/firebase/functions/src/{sellerAuth,adminAuth,settlementService,walletService,commissionService,kycVerification}.ts

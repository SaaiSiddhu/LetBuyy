# Shopify Gap Analysis

Comparison of observed LetBuyy capabilities against the Shopify Online Store 2.0 / app-platform reference model named in the investigation brief. "Present" means implemented with cited evidence elsewhere in this report; this file consolidates the gaps.

## Capability matrix

| Shopify capability | LetBuyy status | Gap detail |
|--------------------|---------------|------------|
| **Online Store 2.0 — JSON templates per page** | PRESENT | `StoreTemplateConfig.templates` |
| Sections everywhere + section groups | PRESENT | sectionGroups + resolver |
| Blocks & app blocks in themes | PARTIAL | blocks yes; app blocks render only from theme data — installed-app auto-surfacing missing (I-1) |
| Theme settings schema | PRESENT (JSON-based, not `{% schema %}`) | format divergence affects theme portability from Shopify |
| Liquid rendering | PRESENT (liquidjs) | secondary path; preview doesn't use it (V-M1) |
| **Theme Editor** (drafts, autosave, preview iframe, postMessage) | PRESENT | no concurrent-edit conflict handling; one-step publish (V-H6) |
| Theme versioning/releases/rollback | PRESENT | `theme_releases` + rollback route |
| **Theme CLI** (`shopify theme dev/push/pull`), Theme Check | **MISSING** | no CLI/bin anywhere; developer-portal self-labels `[SKIP - NEEDS SDK/CLI]` |
| Theme Store with review pipeline | PARTIAL | marketplace + purchases exist; moderation workflow UI scaffold-only |
| Dawn-equivalent reference theme | PARTIAL | urban-kicks exists but is hardcoded demo + seed dual-source (D-2) |
| **App Marketplace** | PRESENT | catalog/install/developer registration |
| App OAuth + scopes | PRESENT | auth-code flow, hashed tokens, scope checks |
| Mandatory compliance webhooks (GDPR trio) | PRESENT | `customers/data_request`, `customers/redact`, `shop/redact` |
| Webhook signing/retries | PRESENT | HMAC v1 + backoff ×8 |
| App billing API | PRESENT (INR-only) | no multi-currency; Razorpay-rail payouts |
| Embedded apps (App Bridge) | PRESENT (basic) | sandbox+postMessage+scoped bridge fetch (GET-only proxy) |
| Shopify Functions equivalent | PARTIAL | WASM `app_function_registrations` with 4 hooks; runtime present; no developer toolchain |
| Checkout UI extensions | PARTIAL | registry + retrieval; storefront checkout render integration not found (I-4) |
| Admin UI extensions | PRESENT (basic) | settings_page/dashboard_widget/product_action/order_action |
| **App CLI / SDK / partner dashboard** | **MISSING** | docs-only developer-portal; manifests hand-built |
| **Storefront API (public, tokenized)** | PARTIAL | storefront GraphQL router exists in gateway; no public token issuance/limits documented |
| Admin GraphQL API | PARTIAL | router mounted; versioning/deprecation policy absent |
| Multi-location inventory | PRESENT (schema) | `inventory_locations`, `inventory_levels`, transfers, reservations tables |
| Markets / multi-currency / multi-language storefronts | **MISSING** | INR-centric; admin locales exist (`admin-locales.ts`) but no storefront localization templates |
| Checkout extensibility + hosted checkout hardening | PARTIAL | checkout in storefront app + gateway; PCI posture not evidenced |
| **Shop-level CDN & edge caching of rendered pages** | PARTIAL | Next/static caching only; no gateway-level page cache evidence |
| Webhooks for merchants (non-app consumers) | PARTIAL | `webhook_subscriptions` table exists; merchant UI for endpoints not found |
| Analytics (reports, ShopifyQL) | MINIMAL | `routes/analytics.ts` + Analytics Engine counters; declared analytics-pipeline empty |
| Search & discovery (storefront search API, filters) | **MISSING in runtime** | search-core contracts + SEARCH_QUEUE producer; no indexer/consumer/service (I-3) |
| Notifications/email system (order/customer emails) | PARTIAL | Resend wired in identity; gateway TODOs for invite/notification emails (I-7) |
| Mobile shopper app (Shop-app analog) | **MISSING** | shopper-app manifest-only |
| POS | MISSING (not claimed) | — |
| Fulfillment/3PL network integrations | MINIMAL | logistics-adapter stub in infrastructure package; shipping zones/rates tables exist |
| Fraud analysis | MISSING | no fraud signals besides Turnstile on identity |
| B2B/wholesale | MISSING | — |
| Gift cards | PRESENT (schema+admin) | `gift_card_*` tables, admin routes |
| Discounts/promotions engine | PRESENT (schema) | promotions/rules/effects/redemptions/usage_counters tables |

## Missing systems (consolidated)

1. Developer toolchain (theme CLI, theme-check, app CLI/SDK, partner dashboard) — the single largest ecosystem gap; without it the marketplace platform cannot acquire third-party supply.
2. Search runtime (declared, queued, never consumed).
3. Internationalization of the selling surface (currency, language, markets).
4. Shopper mobile experience.
5. Transactional email/notification completion (3 TODOs at the exact integration points).
6. Public, versioned API program (tokens, rate limits, deprecation policy) — prerequisite for an external developer ecosystem.
7. Independent runtimes for declared domains (checkout/search/media/notifications/events/analytics) if the microservice topology is to be honest; otherwise an honest single-service topology document.

## Missing workflows

- Theme submission → review → listing moderation (tables exist; workflow/UI absent).
- App review/approval pipeline for marketplace listing.
- Staged theme publish (draft → preview release → live).
- Merchant webhook self-service management.
- Data-request/redact webhook fulfillment runbooks (topics fire; downstream compliance handling unevidenced).

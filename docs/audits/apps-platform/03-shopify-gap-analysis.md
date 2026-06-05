# Shopify Gap Analysis & Apps Compatibility Report

**Reference model:** Shopify App Platform as of mid-2026 (verified against shopify.dev: theme app extensions, app blocks/embeds, token exchange + managed installation, Shopify App Pricing/Billing API, App Store requirements).
**Scoring:** 0 = absent · 1 = schema/types only · 2 = partial runtime · 3 = working but non-parity · 4 = parity with gaps · 5 = full parity.

---

## 1. Compatibility Scorecard

| # | Shopify capability | LetBuyy equivalent (evidence) | Score /5 |
|---|---|---|---|
| 1 | App Store (listing, search, categories, reviews) | `apps/app-marketplace` + gateway catalog endpoints | **3** |
| 2 | App install + managed installation | `POST /apps/:id/install`; no managed-install (scope auto-grant on admin entry) | **2** |
| 3 | OAuth authorization-code grant | `/apps/:id/oauth/authorize` + `/oauth/token` (app-store.ts:1592-1863) | **3** |
| 4 | Token exchange (session→access token, embedded) | `/oauth/token-exchange` (1865) — exists; no App Bridge SDK, JWT session-token contract undocumented | **2** |
| 5 | Offline vs online access tokens | Absent; single token hash in `app_installations.config` JSONB | **0** |
| 6 | Access scopes (granular, enforced, re-consent) | Free-string scopes; no request-time enforcement; no re-consent flow | **1** |
| 7 | App Bridge (client SDK for embedded apps) | Server proxy (`bridge/fetch`) + admin iframe host with postMessage bridge (`EmbeddedAppBridgeClient.tsx`); no published client SDK or protocol docs for app developers | **2** |
| 8 | Admin UI extensions (blocks in admin surfaces) | app-engine targets `admin.button/modal/section`; extension-host unwired | **1** |
| 9 | Theme app extensions (bundle: blocks/embeds/assets/snippets) | No app-side bundle format; no ingestion pipeline | **0** |
| 10 | App blocks (merchant-positioned, JSON-template sections, `@app` type) | `appBlockSlot` dedicated sections + inline/iframe `AppBlockInstance` — non-parity model: only static content or iframe; no app Liquid; no `@app` in arbitrary sections | **2** |
| 11 | App embeds (head/body injection, on/off, theme-agnostic) | Absent (`content_for_header/footer` globals exist but no app injection path) | **0** |
| 12 | App proxy (storefront `/apps/*` reverse proxy to app backend) | Absent | **0** |
| 13 | Checkout UI extensions | Surfaces/targets typed (`checkout.payment/shipping`); `CheckoutExtensionHost.tsx` scaffold; checkout-runtime service manifest-only | **1** |
| 14 | Shopify Functions (server-side custom logic) | `AppFunctionRegistryRecord` + I/O types (app-engine:289-345, 471-496); no executor/runtime | **1** |
| 15 | Webhooks for apps (topic catalog, HMAC, retries, mandatory compliance topics) | Outbox→deliveries→HMAC→backoff pipeline real; `MANDATORY_COMPLIANCE_WEBHOOK_TOPICS` typed but unenforced at review/install | **3** |
| 16 | Billing API (subscriptions, usage charges, one-time, trials, proration) | One-time/recurring charge + merchant approval only (1334-1590) | **2** |
| 17 | Managed pricing (plan selection page, plan_handle redirects) | Absent | **0** |
| 18 | Revenue share / partner payouts | `partner_payout_ledger_entries` table + `payout.*` events typed; no producer/payout flow | **1** |
| 19 | Partner Dashboard (orgs, teams, apps, API creds, analytics, payouts) | `GET /partners/dashboard`, collaborator-code endpoint; `developer-portal` app is a ~10-file shell | **1** |
| 20 | App review/approval workflow | `marketplace_apps.status` transitions only; no reviewer tooling in platform-console | **1** |
| 21 | App versioning & staged releases | Absent (no `app_versions` table) | **0** |
| 22 | CLI & dev tooling (app scaffold, dev stores, hot-reload extensions) | Absent | **0** |
| 23 | Dev/test stores | Absent | **0** |
| 24 | Admin GraphQL/REST API for apps (rate-limited, versioned) | `/v1` REST + `/graphql/admin` exist for first-party; **no app-token-authenticated API surface mapping scopes→resources** | **1** |
| 25 | Storefront API for apps | `/v1/storefront` REST+GraphQL exists (first-party, public) — not app-scoped | **2** |
| 26 | Session token auth for embedded UI (JWT, 1-min expiry) | Embed-session endpoint exists; token semantics (expiry/claims/audience) not standardized | **1** |
| 27 | GDPR/compliance webhooks enforcement (customers/redact etc.) | Topics auto-subscribed at install (`planAppWebhookSubscriptions`); handler verification at review absent | **2** |
| 28 | App analytics for developers (installs, churn, revenue) | Partner dashboard endpoint returns aggregates; no UI, no events pipeline | **1** |
| 29 | Theme editor app-block insertion UX | Theme editor exists (drafts/releases/preview in control-plane); no app-block picker fed by extension registry | **1** |
| 30 | OS 2.0 theme architecture (JSON templates, sections everywhere, settings_schema) | Liquid bundle contract `2026-06-liquid-sections` + JSON templates + settings schema — **real** (theme-bundle.ts) | **4** |

**Aggregate: 39/150 (26%) weighted-equal** (post-verification: items 7 and 27 upgraded after direct code checks). Cluster view: Theme/Liquid foundation strong (OS2.0 ≈ 4/5); app distribution/identity mid (2–3); extension delivery + monetization + partner tooling near-zero (0–1).

## 2. Capability-Cluster Gap Detail

### 2.1 Distribution (App Store) — score 3
Missing vs Shopify App Store requirements: listing review checklist, demo screencast/screenshot validation, mandatory webhook verification at submission, app status lifecycle (draft→submitted→in_review→changes_requested→approved→published→delisted), staff pick/collections merchandising, install attribution, uninstall surveys.

### 2.2 Identity & Authorization — score 2.0 avg
Missing: dedicated token store (`oauth_tokens`: token_hash, scopes, expires_at, last_used_at, revoked_at), offline/online split, refresh & rotation, scope catalog with route-mapping middleware, re-consent on scope expansion, per-app rate-limit identity, HMAC-signed install/redirect params (`hmac`, `state` validation hardening), session-token JWT contract (iss/aud/exp/nbf) for embedded apps, managed installation (admin-driven grant without redirect loop).

### 2.3 Extension Delivery — score 0.7 avg (the core parity blocker)
Shopify model: app ships a **theme app extension bundle** (`blocks/*.liquid` [app blocks], `blocks/*.liquid` with `target: body|head` [app embeds], `snippets/`, `assets/`, `locales/`) versioned and deployed via CLI; Shopify hosts assets on CDN; blocks render in any OS2.0 section supporting `@app`; embeds inject before `</head>`/`</body>`; merchant toggles in theme editor; asset files load only when block is used.
LetBuyy has: slot sections + static-content/iframe instances. Apps cannot ship Liquid, JS, or CSS into the theme. No extension versioning, validation pipeline, CDN, or editor UX. This single cluster blocks ~half of real-world Shopify app categories (reviews, upsells, badges, popups, analytics pixels, chat).

### 2.4 Monetization — score 1.0 avg
Missing: `app_subscriptions` (status, trial_ends_at, current_period_end, price, capped_amount), `app_usage_records`, billing attempts/dunning, refund/credit notes for app charges, payout computation job (gross − platform fee), payout statements, tax handling beyond hardcoded 18%.

### 2.5 Partner/Developer Platform — score 1.0 avg
Backend endpoints outpace the UI: developer-portal must become the console for app CRUD, credentials (client_secret rotation), webhook debugging (delivery log + redrive), extension upload, version submission, metrics, payouts. Orgs/teams/membership tables absent.

### 2.6 Runtime APIs for Apps — score 1.3 avg
Gateway serves first-party clients with internal-session auth. Needed: app-token auth path in `middleware/auth.ts` (3rd identity class beside internal SSO + Supabase JWT), scope→resource authorization map, per-app+per-store rate buckets, API versioning policy (`X-LetBuyy-API-Version` exists — formalize deprecation calendar), webhook topic permissioning tied to scopes.

## 3. What Already Matches Shopify (preserve, don't rebuild)
1. **OS 2.0-style theme architecture**: JSON templates + Liquid sections/blocks + settings_schema + locales, with validation limits — `packages/theme-engine/src/theme-bundle.ts`.
2. **Sandboxed Liquid rendering** with forbidden-tag policy and output sanitization — stricter than Shopify in places (no `{% render %}` yet; needed for app snippets, see blueprint 12).
3. **Transactional outbox → signed webhook delivery with backoff/dead-letter** — equivalent to Shopify's delivery semantics.
4. **Token-exchange-shaped embedded auth** — matches Shopify's recommended 2026 direction (token exchange over auth-code for embedded apps).
5. **Theme release/version/rollback model** (`theme_releases.is_current`, rollback pointer) — parity-grade.
6. **Charge + merchant-approval flow** mirrors Shopify's `appPurchaseOneTime`/`appSubscriptionCreate` confirmation UX at the data level.

## 4. Priority Order to Close Gaps (informs roadmap doc 21)
1. Extension delivery system (TAE bundles, app blocks with app Liquid, app embeds, asset CDN) — unlocks ecosystem.
2. OAuth/token hardening (tables, scopes enforcement, rotation) — security precondition for (1).
3. Partner/developer console on existing endpoints — onboarding precondition.
4. Billing completion (subscriptions/usage/payouts) — monetization.
5. Review/moderation workflow — marketplace trust.
6. App proxy + checkout/admin extension hosts + functions runtime — long tail.

**Sources:** [Theme app extensions configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration) · [App blocks for themes](https://shopify.dev/docs/storefronts/themes/architecture/blocks/app-blocks) · [Token exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange) · [Authorization code grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant) · [Shopify App Pricing (managed pricing)](https://shopify.dev/docs/apps/launch/billing/managed-pricing) · [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)

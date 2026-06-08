# App Platform Architecture Audit (Phase 11)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

**Central question:** *Can a real third-party ecosystem exist on this architecture?* Answer: **the primitives are sound enough to build on — OAuth/PKCE, enforced scopes, an extension/function model, mandatory privacy webhooks — but four structural gaps (no update/versioning, no payout settlement, no developer webhook/analytics management, and weak data-layer isolation) would each become load-bearing problems as the ecosystem grows.**

## 1. Identity & auth (3 token types)

| Identity | Mechanism | Verdict |
|---|---|---|
| Merchant / developer | `authMiddleware` accepts Supabase `Bearer` JWT **or** signed internal-SSO headers (`middleware/auth.ts:161`, `:68-119`); store ownership re-checked per request via `verifySiteOwnership` (`install-lifecycle-routes.ts:57`) | ✅ Solid; defense beyond the token |
| App / OAuth token | `appAuthMiddleware(requiredScopes)` verifies an HS256 app-scoped JWT and enforces **four** checks: identity match, installation `scopes_granted ⊇ required`, token scopes ⊆ granted, **and token hash == stored hash** so revoked tokens fail (`middleware/app-auth.ts:78-101`; mint at `auth-core:1013`) | ✅ Genuinely enforced |
| Embedded session | `token-exchange` mints a 15-min embedded token (`billing-oauth-routes.ts:920`) | ✅ (unused by UI) |

**OAuth** is a correct PKCE (S256-only) implementation: authorize issues a 15-min single-use code (hash + `redeemed_at`), token exchange verifies signature, client_id/redirect_uri match, single-use, and PKCE verifier (`billing-oauth-routes.ts:530-877`); refresh tokens supported. **Caveat:** a **second, simpler install path** (`POST /apps/:id/install`) mints an app token immediately with no OAuth and no refresh token (`install-lifecycle-routes.ts:128`) — two doors into the same house; pick one.

## 2. Scopes & permissions

Scopes are declared per app in `marketplace_apps.api_scopes`; `normalizeAppInstallScopes` rejects any requested scope outside the app's allowed set (`app-engine:1330`). The bridge maps request path → required scope (`shared.ts:396-412`) and re-signs internal-SSO identity as the `installed_by` user to call the gateway on the merchant's behalf (`extension-routes.ts:465-483`). Known scopes: `read_products/orders/customers/themes/storefront`, `write_app_metadata`, `write_discounts`. **Gap:** the collaborator scopes (`app_collaboration`, `write_themes`) referenced in `partnerRequestCode` aren't in the enforced app-token set — dead scopes.

## 3. App data API

`/v1/app/*`: `GET /app/products`, `GET /app/orders`, `PATCH /app/installation/metadata` (`app-api.ts:152,209,271`), all behind `appAuthMiddleware`. Secret-like keys are rejected from metadata writes (`app-api.ts:95-124`) — good hygiene. **Narrow but correct.** A real ecosystem will need far more surface (customers, fulfillment, inventory, webhooks-as-source).

## 4. Webhooks

- **Mandatory GDPR webhooks** (`customers/data_request`, `customers/redact`, `shop/redact`) exist and are auto-subscribed at install (`app-engine:154,1438`); `shop/redact` also fires on uninstall (`install-lifecycle-routes.ts:344`). Delivery is via the webhook-service, fire-and-forget (`shared.ts:553`).
- **Compliance endpoints** are merchant-triggered fan-outs (`compliance-routes.ts:135-139`) — they dispatch to the store's app subscriptions when a merchant POSTs, **not** when actual customer/shop data is deleted. So `customers/redact` is not wired to the real customer-record lifecycle.
- **No developer webhook management.** `app_webhooks` is **only read** (joined at install/authorize) and **has no writer anywhere** — effectively a dead table. There is no CRUD for a developer to register/list/update/delete app webhook endpoints; the only webhook-subscription CRUD lives in the ops portal.

## 5. Extensions & functions

Three surfaces (`admin.ui`, `checkout.ui`, `theme.app_block`), three renderers (`iframe`, `web_component`, `liquid_app_block`), plus WASM **functions** with a fixed hook enum, `wasm_sha256`, and timeout/memory caps (`app-engine:197,224`; `076_app_extension_registry.sql:105-109`). Manifests are validated at dry-run, submit, and install (`developer-routes.ts:285,603`; `shared.ts:645`); per-install registry rows go to `app_extension_registrations`/`app_function_registrations` with prior rows revoked on re-install and all revoked on uninstall (`shared.ts:681-797`). Enable/disable is merchant-controlled (`extension-routes.ts:149,223`) behind a `FEATURE_EXTENSIONS` gate. **This is a real, well-shaped extension model** — its only problem is that the **merchant-facing config UI is a stub** and there are **two extension tables** (legacy `app_extensions` declaration with no real RLS vs the newer registry with real RLS), which invites confusion.

## 6. Billing APIs

Charge create → `pending_merchant_approval`; approve requires verified Razorpay proof to reach `active`, else `approved` (`billing-oauth-routes.ts:62,208,410`). Split: partner `revenue_share_bps` (default **8000 = partner 80% / platform 20%**) + GST 18% on partner share (`billing-core:269,577-581`). Modes: `recurring`/`usage` only. **Architectural gaps:** no one-time charge, no trials, **no usage metering endpoint**, **no pricing plans/tiers**, and — critically — **the payout side is record-only**: ledger rows are written `pending` and never settled (`queue-execution.adapter.ts:474`). `partner_payout_ledger_entries.charge_id`/`source_event_id` are `NOT NULL` but have **no FK** (integrity gap).

## 7. Data layer & multi-tenancy

- **12 tables**; denormalization triggers (`install_count`, `rating_avg`, `review_count`) are real (`000_baseline.sql:7812-7838`).
- **Tenant column inconsistency:** `app_billing_charges`/payout ledger/registries use `site_id`; `app_installations`/`app_reviews` use `store_id` — same concept (`public.sites`), two names.
- **Two-tier RLS:** the 7 original tables (`marketplace_apps`, `app_developers`, `app_categories`, `app_extensions`, `app_installations`, `app_reviews`, `app_webhooks`) have RLS *enabled* but only a blanket `service_role USING(true)` policy — **no row-level tenant isolation** (`000_baseline.sql:24311+`); isolation depends entirely on the gateway running as service_role and filtering in code. Newer tables (billing charges, review records, payout ledger, the two registries) have **real** per-tenant/per-partner RLS. This is a defense-in-depth gap.
- **Missing tables** for an ecosystem: `app_versions`/releases, install/usage event analytics, rate-limit/quota accounting, pricing plans/tiers, support/ticketing, persisted OAuth codes/tokens.

## 8. Rate limiting & abuse

A generic IP/user cost bucket (leaky, cap 200, 20 pts/s) covers all `/v1/*` (`index.ts:543`, `rateLimit.ts`), but the **security-sensitive `/oauth/token`, `/oauth/authorize`, `/bridge/fetch` have no dedicated brute-force limit** the way `/auth/*` does (`index.ts:570`); the coarse IP bucket is bypassable by IP rotation. Limiting is skipped in dev and requires Redis in prod.

## 9. Can an ecosystem exist on this?

**Yes, structurally — with four must-fixes before scale:**

1. **App update/versioning** (+ `app_versions`, re-review, staged rollout) — without it, no living ecosystem.
2. **Payout settlement** (+ ledger state machine, transfer execution, FK integrity) — without it, no paid developers.
3. **Developer self-service for webhooks & analytics** (+ writers for `app_webhooks`, time-series analytics) — without it, no serious SaaS will build.
4. **Real tenant RLS + dedicated OAuth rate limits + unified `site_id`** — without it, security/scale risk grows with every tenant.

The encouraging finding: the **hard, get-them-wrong-and-rebuild primitives (OAuth, scope enforcement, extension/function model, privacy webhooks) are already right**. The remaining work is finishing the lifecycle and hardening the data layer — additive, not a rewrite. See [`ECOSYSTEM_SCALABILITY_REPORT.md`](ECOSYSTEM_SCALABILITY_REPORT.md).

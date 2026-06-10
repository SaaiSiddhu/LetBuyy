# 12 — API Refactoring Roadmap (Phase 10)

Scope: `services/api-gateway` (Hono, `/v1`, ~35 routers + 2 GraphQL endpoints), `services/webhook-service`, Next.js BFF routes across apps. Middleware baseline (EXISTS, good): `securityHeaders`, `requestId`, `inputValidation`, `errorResponseSanitizer`, CORS, `authMiddleware` (Supabase JWT or HMAC internal SSO), CSRF, rate limits, `storeContext()` ownership verification, Zod validation on writes, super-admin ops guards.

---

## 1. Endpoint Inventory Disposition

| Group | Routes | Verdict |
|---|---|---|
| Core commerce (`stores, products, orders, payments, inventory, coupons, categories, customers, reviews, analytics, export, shipping-tax, onboarding`) | EXIST, real | KEEP; tenancy column unification per doc 11 §2 (accept `site_id`, alias `store_id` deprecated with sunset header) |
| `storefront/*` + storefront GraphQL | EXIST | KEEP; close gaps §4; becomes the **only** customer data path (doc 04 V-17) |
| `themes/*` | EXIST | EXTEND per docs 08–09 (draft patches, preview-render, diff, export/import/upgrade/duplicate, validation submit) |
| `app-store/*` | EXISTS | EXTEND per doc 10 (OAuth, extension registry, embeds toggles) |
| `portfolio, resume, employees` | EXIST | KEEP but segregate under `/v1/sites/:siteType/...` long-term (V-32); no work this roadmap beyond docs |
| `ai/*` | EXISTS (generate content/image, chat — schemas in app-engine) | KEEP; add per-store quota + audit log |
| `admin/*`, `operations/*`, `internal/console/*` | EXIST | KEEP; auth upgrades §4.3 |
| BFF routes in merchant-control-plane (62) / app-marketplace (8) / theme-marketplace (3) | proxies to gateway | KEEP pattern (cookie→HMAC internal headers); forbid new business logic (lint rule: BFF route files may import only api-client + zod) |
| storefront-runtime `api/customer*`+`api/orders*` (10) | parallel customer auth stack | **MIGRATE→DELETE** (Phase 7): replace with gateway `/v1/storefront/customer/*` + thin cookie adapter |
| storefront-runtime `api/{reviews, coupons/validate, store-lookup, themes/*}` | thin proxies | KEEP |
| `api/seed` | dev-only (410 prod) | DELETE Phase 1 |
| Empty payment route dirs (paypal×3, razorpay×2, stripe×2, request-password-reset) | dead scaffolding | DELETE Phase 0 (doc 05) |
| `developer-portal` reference manifest | static | regenerate from OpenAPI (§5) |

Dead-endpoint scan method (repeat each phase): route table dump (Hono `app.routes`) ↔ grep of `api-client` call sites + Flutter `api_client` usages; anything uncalled for 2 phases → deprecation header → delete. Initial suspects: none confirmed dead in gateway (all reachable from clients); the dead surface is app-local (above).

## 2. Consistency Standards (apply to every touched route)

- **Errors:** single envelope `{error: {code, message, request_id, details?}}`; map Zod issues → `details[]`; never leak Supabase errors (sanitizer EXISTS — make shape uniform).
- **Pagination:** keyset `?limit&cursor` everywhere (PaginationQuery EXISTS in shared-types); deprecate offset params with `Deprecation` header.
- **Idempotency:** `Idempotency-Key` accepted on ALL POST mutations (orders/payments have it — `idempotency_keys` table EXISTS; extend middleware to themes publish, app install, marketplace submit).
- **Tenancy:** every authenticated route resolves tenant via `storeContext()`/`requireStoreOwner` — audit checklist in §4.1; storefront routes scope by subdomain→site lookup only.
- **Versioning:** `/v1` frozen at GA of each surface; additive-only; breaking → `/v2` router mount (Hono makes parallel mounts cheap). Publish `API_STABILITY.md` per router: `experimental|stable|deprecated`.
- **Naming:** plural resources, kebab paths, snake_case JSON (already dominant — codify in governance doc + lint).

## 3. GraphQL Posture

Two endpoints EXIST (`/v1/admin/graphql`, `/v1/storefront/graphql` + aliases). Decision: **Storefront GraphQL becomes the strategic read API** (theme data requirements + future headless SDK); Admin GraphQL stays thin over REST services (don't duplicate business logic). Work: schema SDL checked into `packages/typescript/api-types` (single source → codegen for api-client + Dart client); persisted-query allowlist for storefront (cost control — `queryCostRateLimit` EXISTS, extend with depth/complexity caps); disable introspection in production for admin endpoint.

## 4. Security Remediations (ordered)

### 4.1 P0 (roadmap Phase 1)
1. **Internal-secret fallback** `services/api-gateway/src/routes/storefront.ts` L1376–1378 (`isInternalRequest`): `if (!configuredSecret && ENVIRONMENT !== 'production') return true` → replace with fail-closed (secret required in every env); staging gets a real secret. Affected: `GET /storefront/internal/orders/:orderId/payable`, `POST /storefront/internal/payments/{reference,confirm,failure}`.
2. **Email enumeration**: `GET /storefront/customer/by-email`, `/customer/status` → require store-scoped capability token (issued to checkout session) or return uniform 200 regardless; add per-IP limiter bucket (Upstash EXISTS).
3. **Nullable tenancy** double-write check before doc 11 080 (route-level assert `site_id` present on create paths).
4. **Stale RLS file** deletion (doc 11 §3).

### 4.2 P1 (Phase 2–3)
5. `internal/console` static bearer (`PLATFORM_CONSOLE_API_TOKEN`) → short-lived signed JWT (operator session from platform-console auth flow that EXISTS) + dedicated rate bucket + IP allowlist option; audit-log writes already exist — add token-id to entries.
6. Themes `optionalAuth` surface: confirm `GET /:slug/schema` exposes only public schema (no draft data); add explicit test.
7. CSRF: verify enforced on all browser-cookie mutation paths incl. BFF-forwarded internal-header calls (HMAC headers mitigate — document the trust chain).
8. Webhook-service: add replay-window check for Cashfree (ts skew ≤ 5 min — Stripe has tolerance, mirror it); per-provider rate limits.

### 4.3 P2 (Phase 6+)
9. App OAuth + scoped tokens + per-app rate buckets (doc 10 §2).
10. mTLS/service-binding-only enforcement for worker↔worker (bindings EXIST — reject public-origin calls to internal dispatch routes by binding-presence check).

## 5. Contract & SDK Pipeline (feeds developer-portal)

- OpenAPI 3.1 generated from Zod (`zod-openapi`) per router; CI artifact + published to developer-portal (replaces hand-typed `src/lib/reference.ts` manifest).
- TS SDK = regenerate `@letbuyy/api-client` from spec (keep hand-written ergonomics layer); Dart client codegen for Flutter (`packages/dart/api_client` currently hand-rolled).
- Contract tests: Schemathesis (or `zod-openapi` round-trip) against staging in `deploy-staging.yml` — a REAL gate replacing source-regex tests for routes (doc 17).
- Webhook topics doc auto-generated from `AppWebhookDefinition` + event-core envelopes.

## 6. Gateway Decomposition Guardrail

35 routers in one worker is approaching monolith-by-stealth. Rule: **no new domain routers in api-gateway**; new surfaces land in their reserved service (doc 18) fronted by gateway service-bindings (pattern EXISTS with WEBHOOK_SERVICE). Extraction order tied to roadmap: search → media → checkout-runtime → notification. Each extraction: routes move, gateway keeps path + proxies via binding (zero client change), then client base migrates.

## 7. Sequenced Plan

| Phase (doc 14) | API work |
|---|---|
| 0–1 | §4.1 P0 fixes; delete dead app routes/seed; idempotency middleware broadened; error envelope unification on touched routes |
| 2–3 | themes API extensions (drafts/patches/preview-render); OpenAPI pipeline live; storefront GraphQL persisted queries |
| 4 | editor APIs complete (diff, schedule); §4.2 P1 items |
| 5 | marketplace supply APIs (submit/validate/sign/export/import/upgrade/duplicate); payouts |
| 6 | app OAuth + extension registry + embeds; compliance webhook enforcement |
| 7 | customer-auth collapse onto `/v1/storefront/customer/*`; delete app-local stack; `store_id` param sunset |
| 8–9 | service extractions per §6; `/v1` stability declaration; contract-test gate mandatory |

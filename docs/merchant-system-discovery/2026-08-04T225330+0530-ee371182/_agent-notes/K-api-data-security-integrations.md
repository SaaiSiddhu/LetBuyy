# AGENT K — API, Data Model, RLS, Webhooks, Jobs, Integration Architecture

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-bf35062e`
Branch `stepup/main` @ `bf35062e`. Read-only discovery. No files changed except this one.

**Governance read before inspection:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (via commander brief),
root `AGENTS.md`, `CLAUDE.md`, `apps/merchant-control-plane/AGENTS.md`, `services/api-gateway/AGENTS.md`,
`services/queue-workers/AGENTS.md`. No local `AGENTS.md` exists under `database/` or `packages/typescript/api-client/`.

**Method + honesty statement.** Everything below is STATIC evidence: source files, migration SQL, wrangler/workflow
config. I had **no live database, no running gateway, no deployed environment, and no ability to introspect
`pg_policies` / `pg_class.relforcerowsecurity` / actual GRANTs**. Every RLS/coverage number is derived by replaying
migration DDL in filename order in a parser I wrote to `/private/tmp/.../scratchpad/` (scratch only, not in repo).
Where a Postgres behaviour depends on platform-level default privileges that do not live in this repo (Supabase's
`anon`/`authenticated` grants), I say so explicitly rather than guessing. **Nothing here is VERIFIED_E2E.** The
ceiling for this agent is `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.

---

## 0. HEADLINE FINDINGS (detail + evidence in later sections)

| # | Finding | Status | Severity |
|---|---|---|---|
| G-K-01 | The entire RLS/GUC tenancy backstop is **unreachable at runtime** — `withTenantTx` (`SET LOCAL ROLE app_tenant`) has zero callers; all gateway DB access is `service_role` (BYPASSRLS) | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (dead-path proven statically) | P0 |
| G-K-02 | Shopper checkout money-in uses the **PLATFORM** Razorpay key, not the merchant's — LetBuyy takes custody (ART-11/R-7) | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P0 |
| G-K-03 | `POST /v1/settlements/ingest` accepts **client-supplied money amounts** and posts them into the canonical double-entry ledger + schedules payouts, guarded only by site ownership | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P0 |
| G-K-04 | Gateway merchant auth has **no ES256/JWKS verifier wired**; live verifiers are 2× shared-symmetric HMAC + Supabase GoTrue bearer. `internal-identity-hmac` lets any `INTERNAL_API_SECRET` holder assert an arbitrary user identity | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P0 |
| G-K-05 | Merchant Razorpay `key_secret_ciphertext` is written but **never decrypted or used anywhere** — the "connect your Razorpay" flow is write-only | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P1 |
| G-K-06 | `storeContext()` middleware (frozen-store gate, plan/entitlement resolution, tenant context) is **defined and never mounted** | `NOT_IMPLEMENTED` (dead code) | P1 |
| G-K-07 | Staff RBAC (`MERCHANT_STAFF_RBAC_MODE`) defaults to **`dryrun` = log-only, never blocks**, and is not set in any config or workflow | `PARTIAL` | P1 |
| G-K-08 | `verifySiteOwnership` is **owner-only**; `site_memberships`/`employees` never grant gateway access. Staff cannot operate the store | `PARTIAL` | P1 |
| G-K-09 | Staff invite acceptance is **broken**: a documented "public, pre-auth" proxy targets a gateway route that sits behind `authMiddleware` | `BROKEN` | P1 |
| G-K-10 | `POST /v1/orders/:id/refund` and `/refund/complete` have **no step-up**; only `/v1/payments/:id/refund` does. Both order routes are reachable with a plain merchant session | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P1 |
| G-K-11 | Step-up token is **not single-use** and is not bound to the refund/payout/amount — one token authorises unlimited sensitive actions for 10 minutes | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P1 |
| G-K-12 | 16 live `USING (true)` RLS policies remain reachable by PUBLIC/anon/authenticated (incl. `gift_cards`, `collections`, `pages`); the `no-public-using-true-validator` cannot see them (excludes `000_baseline.sql`, only matches explicit `TO` clauses) | `CONTRADICTORY_EVIDENCE` | P1 |
| G-K-13 | Platform session cookie `lb_session` is set with `Domain=.letbuyy.com` and merchant app API routes have **no CSRF token / no Origin check** → same-site CSRF from merchant-authored storefront subdomains | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P1 |
| G-K-14 | `commission_bps = 0` (R-9) is enforced only by `DEFAULT 0` + one backfill; the CHECK constraint still allows `0..10000` | `PARTIAL` | P2 |
| G-K-15 | `orders.total` / `payment_transactions.amount` are `numeric(10,2)` rupees while the ledger is `bigint` paise — ART-10 "bigint minor everywhere" not met | `PARTIAL` | P2 |
| G-K-16 | `services/webhook-service` falls back `INTERNAL_API_SECRET \|\| AUTH_SECRET`; the session-security validator checks 4 other files but not this one | `IMPLEMENTED_NOT_RUNTIME_VERIFIED` | P2 |
| G-K-17 | `services/lcis-api` occupies `services/` but is not one of the 8 canonical runtimes; no manifest, no deploy config, and **no authentication at all** | `DORMANT_FLAGGED` | P2 |
| G-K-18 | Doc drift: `AGENTS.md` MIG-R2 says max migration 161 (real: 197); SEC-R6 says migration 162 re-scopes the PUBLIC policies (it is actually 163); PAY-R2 says `confirm_order_payment_with_ledger` posts zero ledger entries (migration 168 fixed that) | `CONTRADICTORY_EVIDENCE` | P2 |
| G-K-19 | Merchant "Custom data" page claims no metafields backend exists; `/v1/metafields` has 7 live routes | `CONTRADICTORY_EVIDENCE` | P2 |
| G-K-20 | Widespread unbounded list endpoints (CODE-R4): `gift-cards`, `shipping-tax`, `categories`, `commerce-analytics` have zero pagination; no pagination validator exists | `PARTIAL` | P2 |

**Constitutional checks that PASSED (stated so the dossier does not re-litigate them):**
- All 6 reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`,
  `media-service`, `search-service`) and both reserved mobile roots contain **only** `runtime.manifest.json` + `AGENTS.md`.
  No constitutional violation. (`find services/<name> -type f`)
- **Zero** Supabase/pg/Drizzle client usage anywhere under `apps/`. Zero `service_role` / `SUPABASE_SERVICE_ROLE_KEY`
  references under `apps/`. Apps genuinely do not touch the database.
- All 121 `/stores/*` merchant proxies call `resolveOwnedStoreId` before forwarding.
- Checkout totals and GST are computed **server-side from DB product prices**; the client sends only
  `productId`/`variantId`/`quantity`.
- Step-up is **real HMAC-SHA256** with a constant-time compare, not a string-length check.
- Queue tenant envelopes are HMAC-signed and the consumer **fails closed** on a missing/invalid envelope.
- Razorpay/Stripe/PayPal/Cashfree inbound webhooks all verify signatures and dedupe by provider event id.
- Dev auth bypass flags require `NODE_ENV=development` **and** an explicit opt-in flag, and are validator-gated.

---

## 1. MERCHANT PROXY INVENTORY — `apps/merchant-control-plane/src/app/api/**/route.ts`

**130 route files.** Full machine-extracted table: I walked every file and recorded exported HTTP methods, the
typed-client calls, the raw `merchantApiFetch` paths, and whether `resolveOwnedStoreId` is used.

### 1.1 The proxy contract (single shared authority)

`apps/merchant-control-plane/src/lib/api/client.ts` (139 lines) is the only egress path. Import census across the
130 route files:

```
130  next/server
129  @/lib/api/client
121  @/lib/stores/resolve-owned-store
 51  @letbuyy/api-client
  5  @letbuyy/shared-types
  1  next/headers, @letbuyy/theme-engine, @letbuyy/auth-core, @/lib/public-urls
```

Flow (`apps/merchant-control-plane/src/lib/api/client.ts:43-87`):
1. Read `lb_session` cookie (`LETBUYY_MERCHANT_SESSION_COOKIE`, `packages/auth-core/src/index.ts:128`).
2. `createLetbuyyInternalSessionHeaders(sessionToken, getLetbuyyInternalAuthSecret({INTERNAL_API_SECRET, LETBUYY_INTERNAL_API_SECRET}))`
   → HMAC-SHA256 over `token.timestamp.jti` (`packages/auth-core/src/index.ts:616-647`).
3. Set `X-LetBuyy-Internal-Session-Token | -Timestamp | -JTI | -Signature`, `X-Client: admin-web`, `X-Request-ID`.
4. `fetch(LETBUYY_API_BASE_URL + path, { cache: 'no-store' })`.

`createMerchantApiClient()` (line 89-99) forces `requireSession: true` on every typed-client call, so the
`requireSession` column being `N` on api-client-based proxies is **not** a gap — the flag is applied inside the client.

`resolveOwnedStoreId` (`apps/merchant-control-plane/src/lib/stores/resolve-owned-store.ts:7-26`) resolves the
`[store]` route param (UUID or handle) through `apiClient.stores.get/getByHandle` — i.e. the gateway is the
ownership authority; the app only maps handle→id.

### 1.2 Direct-DB-access check (governance: apps MUST NOT write the DB)

```
grep -rln --include='*.ts' --include='*.tsx' -e createClient -e '@supabase/supabase-js' \
   -e getSupabaseAdmin -e drizzle apps/     →  0 hits
grep -rn  'SERVICE_ROLE|service_role' apps/  →  0 hits
```
Case-insensitive `supabase` hits under `apps/` are **all** comments, test scripts, or local mapper function names
(`mapSupabaseToProduct` in `apps/storefront-runtime/src/lib/product-service.ts:111`). Two merchant files mention
Supabase only in prose:
- `apps/merchant-control-plane/src/app/api/employees/accept-invite/route.ts:7` — comment.
- `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts:42` — "Never imports or calls Supabase / database drivers directly."

**Verdict: NO app→DB violations.** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (clean).

### 1.3 Ownership resolution coverage

All 121 proxies under `/stores/[store]/…` call `resolveOwnedStoreId`. The 9 that do not are non-store-scoped:

| Proxy | Methods | Forwards to | Ownership |
|---|---|---|---|
| `/auth/logout` | POST | (cookie clear) | n/a |
| `/employees/accept-invite` | POST | `POST /v1/employees/auth/accept-invite` | **pre-auth by design — see G-K-09** |
| `/plans` | GET | `payments.plans` | public catalog |
| `/subscribe`, `/subscribe/coupon`, `/subscribe/verify` | POST | `payments.subscription.*` | gateway-side |
| `/themes/install` | POST | `themes.uploadPackage` + `themes.install` | **`storeId` from client body** → gateway `ThemeExecutionAdapter.installTheme` calls `verifyStoreOwner(input.store_id, userId)` (`services/api-gateway/src/execution/theme-execution.adapter.ts:870`) ✔ |
| `/themes/publish` | POST | `stores.publish` / `stores.update` | **`storeId` from client body** → gateway `POST /stores/:id/publish` scopes the UPDATE with `.eq('id', storeId).or(ownedByCustomUserFilter(customUser.id))` (`services/api-gateway/src/routes/stores.ts:826-832`) ✔ |
| `/themes/[themeId]/sections` | GET | `themes.schema` | read-only schema |

Both client-body-`storeId` proxies are backstopped by the gateway. Acceptable, but they are the only two merchant
proxies where the tenant identity crosses the boundary unverified by the app layer — worth an explicit note for the
dossier because a future gateway refactor would silently open them.

### 1.4 Type-escape hatches in proxies (drift signal — see §3)

Only 3 in 130 files:
- `apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts:78-79`
  `await createMerchantApiClient().stores.update(resolved.storeId, updates as any)` with the comment
  *"The cast bridges the shared-types Store schema (which omits these columns) to the actual DB columns"* —
  i.e. `cod_enabled` / `online_payment_enabled` exist in the DB and in the gateway PATCH allow-list but **not** in
  `@letbuyy/shared-types` `Store`. Real, documented type drift.
- `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:67,103`
  `fromWorkerCoupon(coupon as unknown as Record<string, unknown>)` — the gateway coupon shape and the client coupon
  shape are not the same type; the app hand-maps them.

---

## 2. GATEWAY ROUTE INVENTORY — `services/api-gateway`

### 2.1 Scale

- Registration file: `services/api-gateway/src/index.ts` (1017 lines). Mounts at lines **710-822**.
- `services/api-gateway/src/routes/` — **97 `.ts` files** (67 top-level + subdirectories `app-store/`,
  `internal-console/`, `operations/`, `storefront/`, `themes/`).
- **1,226** non-`use()` route definitions.

### 2.2 Global middleware chain (`services/api-gateway/src/index.ts:641-752`)

```
642 securityHeaders            → all
643 requestId
644 inputValidation
645 errorResponseSanitizer
652 observability
654 cors (credentials:true, origin resolved by resolveCredentialedCorsOrigin)
672 basePath('/v1')
673 apiVersioning
681 queryCostRateLimit(20/s, cap 200)
702 authRateLimit on /auth/*  (GET /auth/custom/session exempted)
--- PUBLIC MOUNTS: /auth /contacts /storefront /checkout /stores(branding) /themes
    /app-store /app /whatsapp/inbound /wa/webhook + founding/demo/contact public routers
741 internalPerimeter on /internal/*
--- 750 authMiddleware      ← everything below requires auth
--- 751 csrfProtection
--- 752 protectedMutationIdempotency
763-822 all merchant + operations routers
```

**Order hazard:** `/v1/themes` is mounted **twice** — publicly at line 726 and again (implicitly, same router) it is
the only router reachable both before and after `authMiddleware`. `themes.ts` is 1,871 lines / 66 route defs and is
the largest single module; its 22 `resolveCustomUser` calls are the per-handler auth. Any theme route that does not
call `resolveCustomUser` is effectively public. This needs a dedicated per-route pass (Agent J owns themes; flagged
here as a contract hazard).

### 2.3 Auth issuers actually wired

`services/api-gateway/src/middleware/auth.ts:189-205` — `legacyGatewayAuthVerifiers`, tried in order:

| Order | Verifier | Mechanism | Evidence |
|---|---|---|---|
| 1 | `internal-session-hmac` | HMAC-SHA256 of an **opaque** session token with `INTERNAL_API_SECRET`, then `validate_and_rotate_merchant_session` RPC + `users_custom` lookup | `auth.ts:116-156`, `lib/merchant-session.ts:60-70` |
| 2 | `internal-identity-hmac` | HMAC-SHA256 over `userId+email+storeId+ts+jti` — **caller asserts the identity** | `auth.ts:79-114` |
| 3 | `supabase-bearer` | `supabase.auth.getUser(token)` against Supabase GoTrue (anon client) | `auth.ts:158-187` |

`oidc-jwks` — the ES256/EdDSA identity-platform verifier — is registered in
`services/api-gateway/src/identity-foundation/auth-verifier-registry.ts:40-45` with `activeByDefault: false`,
gated on `FEATURE_OIDC_CLIENT`. **It is not present in `legacyGatewayAuthVerifiers` at all**, so flipping the flag
would change nothing in `authMiddleware`. `grep -rn 'oidc-jwks'` returns only the registry file and its own type union.

The real ES256 verifier `services/api-gateway/src/lib/identity-session-verifier.ts` (`jwtVerify` +
`createLocalJWKSet`, `algorithms: ['ES256','EdDSA']`, lines 57/90/95) has exactly **one** production caller:
`services/api-gateway/src/routes/auth.ts:1129` — inside the *session-creation* route. The identity-issued JWT is
verified **once at session creation** and then stored verbatim as the opaque `sessions.token`
(`routes/auth.ts:1141-1148`). Per-request auth is a DB session lookup, not JWT verification.

**Consequence (G-K-04).** Against ART-05 ("identity-platform is the SOLE issuer, asymmetric sole-signer;
everyone else verify-only"):
- The gateway's live trust roots are a **shared symmetric secret** (`INTERNAL_API_SECRET`) shared across
  merchant-control-plane, identity-platform, storefront-runtime, app-marketplace, theme-marketplace,
  platform-operations-portal, webhook-service, and queue-workers (`scripts/validators/session-security-validator.mjs:60-77`
  enumerates the sharers), **plus Supabase GoTrue** as a second independent issuer.
- `internal-identity-hmac` is the sharpest edge: any holder of `INTERNAL_API_SECRET` can mint headers asserting
  **any** `userId`/`email`/`storeId` and the gateway accepts it as `authSource: 'internal-sso'`
  (`auth.ts:106-113`). Its only legitimate caller in the whole repo is
  `services/api-gateway/src/routes/app-store/extension-routes.ts:471` — one call site.
- Replay is bounded (`isFreshLetbuyyInternalTimestamp`, `consumedInternalJtis`), and the secret is a deploy-time
  secret, so this is a **trust-domain-collapse** finding rather than a remote-unauthenticated finding.

CLAUDE.md's claim of "merchant **ES256** (identity-platform, `LETBUYY_IDENTITY_PUBLIC_JWKS`)" as the live
per-request merchant auth is **not what the code does**. The customer **HS256** path CLAUDE.md describes is real
(`packages/auth-core/src/index.ts:751-769`, `alg:'HS256'`, `CUSTOMER_SESSION_SECRET`) and is a deviation from ART-05
exactly as the commander anticipated — reported, not accepted.

### 2.4 Tenancy / authorization per module

**`storeContext()` is dead.** `services/api-gateway/src/middleware/store-context.ts:72` defines it; the only other
occurrence in the entire tree is its own usage comment at line 70. It is **never mounted**. Everything it does is
therefore not happening:
- `trial_status === 'frozen'` → 403 gate (lines 134-148) — **never runs**
- plan resolution from `subscriptions` (150-159) — **never runs**
- `resolveTenantAccessProfile` → `c.set('tenant', …)` with roles/permissions/entitlements (160-196) — **never runs**

**`requireStaffPermission`** (`middleware/staff-permission.ts:200`) — **zero route usages**.
**`requirePermission`** (`middleware/permission.ts:112`) — used **only** in `routes/operations/*` (8 files, 79 uses).
Zero uses in any merchant commerce route.

What routes actually use, by module (machine census, `verifySiteOwnership` / `resolveCustomUser` / zod / rpc / idempotency / range+limit / permission / step-up):

| module | lines | route defs | verifySiteOwnership | resolveCustomUser | z.object | rpc | idem refs | range/limit | perm | step-up |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| themes.ts | 1871 | 66 | 0 | 22 | 0 | 0 | 15 | 4 | 0 | 0 |
| inventory.ts | 1296 | 54 | 21 | 22 | 0 | 10 | 51 | 6 | 0 | 0 |
| customers.ts | 1497 | 48 | 0 | 10 | 0 | 0 | 2 | 4 | 0 | 0 |
| payments.ts | 1324 | 42 | 9 | 15 | 0 | 1 | 72 | 4 | 0 | 11 |
| notifications.ts | 700 | 39 | 2 | 2 | 4 | 0 | 9 | 2 | 0 | 0 |
| products.ts | 1243 | 37 | 2 | 15 | 0 | 0 | 1 | 3 | 0 | 0 |
| operations.ts | 1018 | 35 | 0 | 0 | 0 | 12 | 2 | 20 | 8 | 0 |
| auth.ts | 1499 | 32 | 0 | 2 | 0 | 0 | 0 | 3 | 0 | 0 |
| blog.ts | 606 | 30 | 14 | 14 | 0 | 0 | 0 | 2 | 0 | 0 |
| app-store.ts | 1473 | 28 | 5 | 7 | 1 | 0 | 1 | 11 | 6 | 0 |
| shipping-tax.ts | 474 | 27 | 13 | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| orders.ts | 1468 | 24 | 3 | 3 | 0 | 2 | 71 | 3 | 0 | **0** |
| stores.ts | 864 | 24 | 0 | 11 | 0 | 0 | 1 | 3 | 0 | 0 |
| pages.ts | 812 | 23 | 8 | 6 | 0 | 0 | 0 | 3 | 0 | 0 |
| employee.ts | 668 | 21 | 6 | 6 | 0 | 0 | 0 | 2 | 0 | 0 |
| stores-localization.ts | 696 | 19 | 0 | 2 | 4 | 0 | 0 | 1 | 0 | 0 |
| marketing.ts | 624 | 18 | 2 | 4 | 0 | 0 | 7 | 5 | 0 | 0 |
| whatsapp.ts | 898 | 16 | 2 | 4 | 3 | 0 | 32 | 7 | 0 | 0 |
| gift-cards.ts | 237 | 15 | 6 | 6 | 0 | 5 | 3 | **0** | 0 | 0 |
| coupons.ts | 315 | 15 | 7 | 7 | 0 | 0 | 0 | 2 | 0 | 0 |
| onboarding.ts | 531 | 15 | 0 | 6 | 1 | 0 | 1 | 6 | 0 | 0 |
| returns.ts | 296 | 13 | 3 | 6 | 0 | 1 | 4 | 1 | 0 | 0 |
| checkout.ts | 817 | 12 | 2 | 2 | 0 | 0 | 43 | 0 | 0 | 0 |
| categories.ts | 288 | 12 | 6 | 6 | 0 | 0 | 0 | **0** | 0 | 0 |
| metafields.ts | 502 | 11 | 0 | 2 | 2 | 0 | 0 | 2 | 0 | 0 |
| payouts.ts | 712 | 9 | 0 | 0 | 2 | 2 | 18 | 2 | 0 | **8** |
| billing.ts | 441 | 8 | 0 | 0 | 0 | 0 | 25 | 2 | 0 | 0 |
| smart-collections.ts | 273 | 8 | 5 | 5 | 0 | 0 | 0 | 3 | 0 | 0 |
| commerce-analytics.ts | 446 | 8 | 5 | 5 | 0 | 0 | 0 | **0** | 0 | 0 |
| shipping.ts | 176 | 6 | 2 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| cod-reconciliation.ts | 383 | 6 | 0 | 0 | 3 | 1 | 25 | 1 | 0 | 0 |
| kyc.ts | 340 | 5 | 0 | 0 | 1 | 0 | 3 | 0 | 0 | 0 |
| settlements.ts | 518 | 4 | 0 | 0 | 1 | 1 | 34 | 1 | 0 | 1 |
| commission.ts | 358 | 4 | 0 | 0 | 2 | 1 | 12 | 2 | 0 | 0 |
| wallet.ts | 189 | 2 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 |
| resource-search.ts | 324 | 2 | 4 | 4 | 1 | 0 | 0 | 6 | 0 | 0 |

*(full 97-row table generated at `scratchpad/analyze.mjs`; the rows above are the merchant-relevant set)*

Four **different** tenant-scoping idioms coexist — a duplicate-authority smell worth its own remediation item:
1. `resolveOwnedStoreScope` / `resolveTenantContextForOwnedSite` / `resolveTenantContextForOrder`
   (`lib/tenant-context.ts:183-244`) — used by `orders`(11), `payouts`(6), `shipping-labels`(5), `billing`(5),
   `security`(4), `order-risk`(4), `kyc`(4), `cod-reconciliation`(4), `settlements`(3), `founding`(3),
   `commission`(3), `wallet`(2), `returns`(2), `customers`(2).
2. `resolveCustomUser` + `verifySiteOwnership` inline (most commerce modules).
3. Per-module private helpers: `hasOwnedStoreScope` (`routes/customers.ts:183`), `verifyStoreOwnership`
   (`routes/products.ts:1214`, `routes/marketing.ts:206`), `verifyOptionalStoreOwnership`
   (`routes/notifications.ts:102`), `resolveOwnedLocalizationStore` (`routes/stores-localization.ts:133`),
   `requireCustomUser` (`routes/two-factor.ts:60`, `lib/theme-marketplace-auxiliary-routes.ts:163`).
4. WHERE-clause scoping only (`.eq('id', storeId).or(ownedByCustomUserFilter(...))`) — `routes/stores.ts`.

`verifySiteOwnership` itself (`services/api-gateway/src/lib/auth-user.ts:39-66`) checks **only**
`sites.custom_user_id` / `sites.user_id`. It never consults `site_memberships` or `employees` → **G-K-08**.

### 2.5 `site_id` source — client-supplied vs authenticated principal

Client-supplied `store_id` in a body/query is **pervasive** (49 refs in `customers.ts`, 39 in `inventory.ts`,
26 in `ai.ts`, 18 in `themes.ts`, 15 in `payments.ts`, 15 in `marketing.ts`, 13 in `products.ts`…). This is
**acceptable under the current design** because the value is always passed through an ownership check before use
(e.g. `routes/inventory.ts:270-273` does `verifySiteOwnership(db, body.store_id, …)` then `assertStaffPermission`).

The gateway has a second, runtime backstop: `createTenantGuardedSupabaseClient`
(`services/api-gateway/src/tenant/tenant-scoped.ts:112-124`) proxies `.from()` for the 262 tables in
`services/api-gateway/src/tenant/tenant-tables.registry.ts` and **rejects the query at `await` time** if no
scope-column predicate was applied (line 89-92). Two important limits:
- It proves a **predicate exists**, not that the value belongs to the caller. `eq('site_id', <attacker-chosen>)`
  passes the guard.
- It wraps **only `.from()`**. `.rpc()` calls are entirely unguarded — and every money mutation is an `.rpc()`.

### 2.6 Idempotency

`middleware/idempotency.ts` — `protectedMutationIdempotency` mounted globally at `index.ts:752`. Covers 34 prefixes
(`IDEMPOTENT_PROTECTED_PREFIXES`, lines 12-49) for POST/PUT/PATCH/DELETE. `POST /stores` is deliberately exempt
(bootstrap, no site yet). **Not covered:** `/admin`, `/employees`, `/security`, `/settlements`, `/billing`,
`/commission`, `/founding`, `/app-store`, `/app`, `/operations/*`, `/themes` — notably `/settlements` and
`/commission`, both of which write money tables. Those routes each carry their own `idempotency_key` field, so this
is defence-in-depth loss rather than an outright hole, but it is inconsistent.

### 2.7 CSRF

`middleware/security.ts:251-286` — double-submit cookie. It **short-circuits** when
`X-LetBuyy-Internal-Signature` is present (line 263) — which every merchant-app request carries. So gateway CSRF
never applies to merchant traffic. That is architecturally fine (server-to-server), but it moves the entire CSRF
burden onto the merchant Next.js app, which has **no CSRF token, no Origin check, and no `middleware.ts`**
(`find apps/merchant-control-plane -maxdepth 2 -name middleware.ts` → none; `grep -ril csrf apps/merchant-control-plane/src` → none). See **G-K-13**.

### 2.8 Pagination (CODE-R4)

83 uses of `paginated()` / `cursorPaginated()` across 1,226 route defs. Helpers exist and are good
(`lib/supabase.ts:40-112`, cursor + exact-total flag). But there is **no pagination validator** in
`scripts/validators/` and the coverage is uneven:

| module | GET routes | paginated | any range/limit |
|---|--:|--:|--:|
| gift-cards | 0 (all POST) | 0 | 0 |
| shipping-tax | 3 | 0 | 0 |
| categories | 2 | 0 | 0 |
| commerce-analytics | 4 | 0 | 0 |
| smart-collections | 2 | 0 | 3 |
| employee | 5 | 0 | 2 |
| shipping | 2 | 0 | 1 |
| coupons | 2 | 2 | 2 |
| customers | 7 | 2 | 4 |
| products | 5 | 2 | 3 |
| orders | 4 | 3 | 3 |

### 2.9 Gap direction (a) — gateway routes with NO merchant consumer

Computed by intersecting every `api.route()` mount with (i) every `merchantApiFetch` path literal and (ii) every
api-client namespace referenced anywhere in `apps/merchant-control-plane/src`, resolved to its URL prefixes.

**Merchant app consumes 39 prefixes:** `/2fa /ai /analytics /app-store /auth /billing /blog /categories
/commerce-analytics /commission /coupons /custom /customers /domains /employees /export /form-submissions
/founding /founding-program /inventory /kyc /marketing /media /notifications /orders /pages /payments /payouts
/pricing /products /resume /reviews /security /shipping /shipping-tax /smart-collections /stores /themes /upload`

**Merchant-relevant gateway routers with ZERO merchant consumer** (`BACKEND_ONLY`):

| Mount | Router | Live route defs | Note |
|---|---|--:|---|
| `/settlements` | `settlements.ts` | 4 (`GET /:site`, `POST /ingest`) | writes settlements/payouts/payout_items/recon_breaks/wallet_ledger_entries — **G-K-03** |
| `/returns` | `returns.ts` | 13 (`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/refund/complete`) | full returns lifecycle, no merchant UI |
| `/wallet` | `wallet.ts` | 2 (`GET /`) | merchant wallet balance never surfaced |
| `/cod` | `cod-reconciliation.ts` | 6 (`GET /reconciliation`, `POST /reconciliation`, `POST /reconciliation/:id/reconcile`) | COD remittance never surfaced |
| `/risk` | `order-risk.ts` | `POST /assess`; `orderCodRouter`: `POST /orders/:id/cod/confirm`, `/cod/timeout` | risk engine unreachable from UI |
| `/metafields` | `metafields.ts` | 7 (`/definitions` CRUD, `/values` GET/PUT/DELETE) | **contradicted by the UI — G-K-19** |
| `/onboarding` | `onboarding.ts` | 15 | merchant onboarding served elsewhere (identity-platform) |
| `/tax` | `tax.ts` | 5 (`POST /calculate`, `GET /invoice/:orderId`) | GST invoice retrieval unwired |
| `/discounts` | alias of `coupons.ts` | — | duplicate mount, only `/coupons` used |
| `/email` | `email.ts` | 5 | |
| `/whatsapp` + `/wa` | `whatsapp.ts` | 16 | zero references to "whatsapp" anywhere in the merchant app |
| `/store-access` | `custom-domains.ts` export | — | |
| `/contacts`, `/portfolio` | — | 3 / 8 | site-builder leftovers |

Legitimately non-merchant (not gaps): `/internal/*` (6 routers), `/operations/*` (8 routers), `/storefront`,
`/checkout`, `/app`, `/admin`, `/graphql/*`.

### 2.10 Gap direction (b) — merchant UI needs with NO gateway route

Only **one** explicit marker exists in the whole merchant app:
`apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx:15,17,19` —
`requirement="[SKIP - NEEDS BACKEND: metafields and metaobjects API]"` and
*"No `metafields`, `metaobjects`, or custom-data gateway route was found in current services/packages."*

That claim is **false as of this commit**: `services/api-gateway/src/routes/metafields.ts` has 7 routes and is
mounted at `services/api-gateway/src/index.ts:799`, and `@letbuyy/api-client` exposes a `metafields` namespace
(`packages/typescript/api-client/src/index.ts`, `readonly metafields` block). The gap is a **wiring gap, not a
backend gap** → `CONTRADICTORY_EVIDENCE` (G-K-19). The generic `BackendNeededPane` component has exactly one
consumer, so there is no larger inventory of declared UI-needs-backend gaps to mine here — other missing surfaces
are silent (see §2.9, which is the better proxy for them).

---

## 3. TYPED API CLIENT + SHARED TYPES

- `@letbuyy/api-client` = `packages/typescript/api-client/` — **`src/index.ts` 5,852 lines + `src/graphql.ts` 377**.
  (Note: `packages/api-client/` does **not** exist; the package lives under `packages/typescript/`. Any doc or tool
  that says `packages/api-client` is stale.)
- `@letbuyy/shared-types` = `packages/shared-types/src/` — `index.ts` 4,856 lines + `foundation-execution-contracts.ts`
  217 + `app-platform.ts`/`brand.ts`/`contact.ts`.

**Merchant-relevant client namespaces** (`readonly <ns> = {` in `LetbuyyApiClient`, class starts at line 3807):
`stores, auth, notifications, metafields, whatsapp, marketing, customDomains, domains, onboarding, appStore,
appApi, operations, internalConsole, employees, media, upload, analytics, ai, products, categories,
smartCollections, inventory, commerceAnalytics, orders, returns, shippingLabels, payouts, wallet, commission,
cod, kyc, twoFactor, customers, pages, coupons, blog, formSubmissions, exports, reviews, resume, shipping,
taxes, themes, payments, billing, foundingProgram, foundingAdmin, storefront, graphql` (49).

Of these, the merchant app references **32**. Never referenced by the merchant app: `metafields`, `whatsapp`,
`onboarding`, `appApi`, `operations`, `internalConsole`, `returns`, `wallet`, `cod`, `twoFactor`, `foundingAdmin`,
`storefront`, `graphql` — consistent with §2.9.

### 3.1 Confirmed drift instances (each is a real bug class)

| # | Drift | Evidence |
|---|---|---|
| D1 | `Store` in shared-types omits `cod_enabled` / `online_payment_enabled`, which the gateway PATCH allow-list writes and the merchant UI toggles | `apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts:74-79` (with an explicit in-repo comment naming the drift) |
| D2 | Coupon shape differs between gateway response and client type; the app hand-maps via `fromWorkerCoupon(... as unknown as Record<string, unknown>)` | `apps/merchant-control-plane/src/app/api/stores/[store]/coupons/route.ts:67,103` |
| D3 | Money representation split: `SettlementIngestSchema`, `packages/shared-types/src/index.ts:753-875`, and the ledger all use `*_minor: z.number().int()`; but `orders.total`, `orders.subtotal`, `orders.tax`, `orders.shipping_cost`, `payment_transactions.amount` are `numeric(10,2)` **rupees** in `database/supabase/migrations/000_baseline.sql:10131-10135, 10311`. `create_checkout_order` takes `p_tax_amount numeric(12,2)`; `confirm_order_payment_with_ledger` converts with `round(total*100)::bigint` (`database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:177`) | G-K-15 |
| D4 | Gateway request validation is **not centralised**: only 17 files exist in `services/api-gateway/src/schemas/`, and only `payment.schema.ts` declares any money field. All other money-bearing validators are inline in route files or in `packages/billing-core` / `packages/shared-types`. There is no single place to audit "what money can a client send". | `ls services/api-gateway/src/schemas/` |

I did **not** find an automated schema-parity check between shared-types, the client, the gateway validators, and
the DB. `UNKNOWN` whether one is planned.

---

## 4. DATA MODEL — `database/supabase/migrations`

### 4.1 Census (parsed from SQL, filename order)

| Metric | Value |
|---|--:|
| `.sql` files in `database/supabase/migrations/` | **126** |
| `find database/supabase -name '*.sql'` (incl. `rollback/`, `seeds/`, `scripts/`, `verification/`) | 197 |
| Total SQL lines in `migrations/` | 49,659 |
| Numeric prefix range | `000`, then `073`…`197` contiguous, **no gaps, no duplicates** |
| Rollback files in `database/supabase/rollback/` | 48 |
| `CREATE TABLE` (distinct) | **423** |
| Tables with `site_id` or `store_id` at CREATE | **259** |
| `CREATE (OR REPLACE) FUNCTION` (distinct names) | **173** |
| `CREATE TRIGGER` (distinct) | 393 |
| `CREATE INDEX` (distinct) | 846 |
| `CREATE VIEW` | 2 |
| `CREATE POLICY` statements | 731 |
| **Live** policies after replaying `DROP POLICY` in order | **681** |

**Commander's brief said "187 .sql files, highest numbered 195".** Correction: `migrations/` holds **126**
files and the highest is **197** (`197_letbuyy_core_first_class_theme.sql`). 187/197 is the count across all of
`database/supabase/`. The `000_baseline.sql` prefix + `073…197` contiguity means the historical `001-072`
migrations were collapsed into the baseline (their originals are in `docs/archive/migrations-history/`, 72 files).

**AGENTS.md drift (G-K-18):** `AGENTS.md:156` MIG-R2 — *"New migrations MUST be numbered sequentially from the
current max (161)"* and *"MUST fix the existing duplicate prefix (129)"*. Reality: max is **197** and there is
**no duplicate prefix**. `AGENTS.md:7` also cites "the real 91 / 419" migrations/tables — real is 126 / 423.

### 4.2 RLS coverage — how it is actually applied (and why naive greps mislead)

RLS is applied three ways, and only the first is greppable:
1. Literal `ALTER TABLE x ENABLE/FORCE ROW LEVEL SECURITY` + `CREATE POLICY`.
2. **`DO $$ … FOREACH v_table IN ARRAY ARRAY['a','b',…] … EXECUTE format(…)`** — e.g.
   `139_executable_foundation_ledger_core.sql:384-406` (ledger tables),
   `151_executable_settlement_ledger.sql:255-283` (settlement/payout tables),
   `153_executable_identity_security.sql:224-256` (consents/store_credit/step_up).
3. **`164_d4_tenant_role_guc.sql:33-75` — a catalog-driven `DO` block** that queries
   `information_schema.columns` for every `public` BASE TABLE with `site_id` or `store_id` and, for each one,
   runs `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `GRANT SELECT,INSERT,UPDATE,DELETE … TO app_tenant`,
   and `CREATE POLICY … FOR ALL TO app_tenant USING (COALESCE(site_id,store_id) = public.current_site_id())`.

**Honest coverage statement:**
- As of migration **164**, **every** tenant table that existed at that point receives `ENABLE + FORCE + an
  `app_tenant` GUC policy. Static coverage is therefore effectively complete for those ~255 tables.
- Only **4** tenant tables were created after 164. All four have `ENABLE + FORCE`; none has a
  `current_site_id()` GUC policy, and three have **no policy at all** (which under `FORCE` means zero rows for any
  non-BYPASSRLS role — fail-closed, but functionally broken if `app_tenant` were ever used):

| table | created in | ENABLE | FORCE | GUC policy | any policy |
|---|---|---|---|---|---|
| `founding_merchant_allocations` | `176_v1_founding_program_schema.sql` | Y | Y | NO | Y |
| `subscription_coupon_redemptions` | `184_v1_subscription_coupons.sql` | Y | Y | NO | **NO** |
| `site_domains` | `185_v1_site_domains.sql` | Y | Y | NO | **NO** |
| `site_domain_verifications` | `185_v1_site_domains.sql` | Y | Y | NO | **NO** |

- Money tables specifically: `ledger_accounts`, `ledger_transactions`, `ledger_entries` get ENABLE+FORCE+
  `site_id = current_site_id()` at `139_…:384-406`. `settlements`, `reserves`, `payouts`, `payout_items`,
  `recon_breaks`, `payout_statements`, `wallet_ledger_entries`, `commission_schedules`,
  `commission_reconciliation_entries` at `151_…:255-283`. `consents`, `store_credit`,
  `store_credit_ledger_entries`, `step_up_challenges`, `sensitive_action_approvals` at `153_…:224-256`.
  `165_d5_canonical_money_paths.sql` additionally does
  `REVOKE UPDATE, DELETE ON public.ledger_transactions / ledger_entries FROM PUBLIC, anon, authenticated, service_role, app_tenant`
  — append-only enforced at the privilege layer, plus a `reject_ledger_mutation()` trigger
  (`139_…:163+`) and a deferred `enforce_ledger_transaction_balance()` trigger (`139_…:378-382`). **This part is good.**

### 4.3 THE CRITICAL FINDING — the whole GUC layer is unreachable (G-K-01)

`164_d4_tenant_role_guc.sql:2-3` states the contract in its own header:
> *"Adds a non-BYPASSRLS app_tenant role and app_tenant GUC policies for site/store-scoped tables. **The gateway
> must SET LOCAL ROLE app_tenant and** [set the GUC]."*

The only code that would do that is:

```
services/api-gateway/src/lib/tenant-transaction.ts:15-35
  export async function withTenantTx(env, tenant, callback) {
      const sql = getPooledSql(env, …);
      if (!sql) throw new TenantTransactionUnavailableError();
      return sql.begin(async (tx) => {
          await tx.unsafe('SET LOCAL ROLE app_tenant');            // line 29
          await tx.unsafe(statement.sql, [...statement.values]);   // SET LOCAL app.site_id
          await tx.unsafe('SELECT set_config($1,$2,true)', ['app.request_id', tenant.requestId]);
          return callback(tx);
      });
  }
```
exposed as `withResolvedTenantTx` at `services/api-gateway/src/lib/tenant-context.ts:67-73`.

```
grep -rn 'withTenantTx|withResolvedTenantTx|tenantTx' services/api-gateway/src/routes/   →  0 hits
grep -rn 'SET LOCAL ROLE|set_config|current_site_id' services/*/src apps/*/src --include='*.ts' (excl. tests)
   → only lib/tenant-transaction.ts and packages/tenant-core constants
```

**Zero callers.** Every gateway DB call goes through `getSupabaseAdmin(c)` →
`createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))` (`services/api-gateway/src/lib/supabase.ts:13-19`)
— the Supabase **service_role** key over PostgREST. `service_role` is `BYPASSRLS`. `getSupabaseAdmin` appears in
**114 files** under `services/api-gateway/src`.

Therefore, against ART-08 / R-1…R-4:
- "the gateway MUST NOT connect as blanket service_role for tenant data" → **violated**, universally.
- "unset GUC ⇒ ZERO rows" → **never exercised**; RLS is bypassed before the GUC matters.
- The `app_tenant` role, the 255+ `app_tenant_guc_*` policies, and the `*_tenant_site_guc` policies from
  139/151/153 are **inert defence-in-depth that has never been engaged**.

The *actual* tenant isolation in production is:
1. `verifySiteOwnership` in TypeScript (owner-only, per-handler, four different idioms), and
2. the `createTenantGuardedSupabaseClient` proxy, which enforces "a scope predicate was applied" but not "the
   scope value belongs to you", and does not cover `.rpc()`.

**And the validators do not catch it.** Both `scripts/validators/no-blanket-service-role-validator.mjs:16-21`
and `scripts/validators/tenant-isolation-validator.mjs:47-52` assert that
`services/api-gateway/src/lib/tenant-transaction.ts` **contains** the string `SET LOCAL ROLE app_tenant`.
Neither asserts it is **called**. The gate is green on a dead code path — this is the exact
"presence-as-coverage" pattern AGENTS.md TEST-R10 warns against, applied to the tenancy backstop itself.

### 4.4 `USING (true)` policies — final state after DROP replay (G-K-12)

Raw: 136 `CREATE POLICY … USING (true)` statements. After replaying every `DROP POLICY` in migration order,
**681 live policies**, of which **103** still use `USING (true)`; **87** of those are correctly restricted
`TO service_role`. The remaining **16 are reachable by PUBLIC / anon / authenticated**:

| file:line | table | FOR | TO |
|---|---|---|---|
| `000_baseline.sql:24277` | `plans` | SELECT | PUBLIC (implicit) |
| `000_baseline.sql:24284` | `employee_roles` | SELECT | PUBLIC (implicit) |
| `000_baseline.sql:25865` | `skill_endorsements` | SELECT | `authenticated, anon` |
| `000_baseline.sql:25924` | `smart_collections` | SELECT | `anon` |
| `000_baseline.sql:26645` | `collection_products` | **ALL** | PUBLIC (implicit) |
| `000_baseline.sql:26652` | `collections` | **ALL** | PUBLIC (implicit) |
| `000_baseline.sql:26666` | **`gift_cards`** | **ALL** | PUBLIC (implicit) |
| `000_baseline.sql:26694` | `onboarding_attempts` | **ALL** | PUBLIC (implicit) |
| `000_baseline.sql:26708` | `pages` | **ALL** | PUBLIC (implicit) |
| `000_baseline.sql:26743` | `store_surveys` | **ALL** | PUBLIC (implicit) |
| `078_password_set_intents.sql:52` | `auth_password_set_intents` | **ALL** | PUBLIC (implicit) |
| `100_app_discovery_foundation.sql:133` | `app_collections` | ALL | PUBLIC (implicit) |
| `100_app_discovery_foundation.sql:145` | `app_collection_items` | ALL | PUBLIC (implicit) |
| `100_app_discovery_foundation.sql:152` | `app_featured_placements` | ALL | PUBLIC (implicit) |
| `100_app_discovery_foundation.sql:155` | `app_discovery_events` | ALL | PUBLIC (implicit) |
| `107_security_rls_hardening_and_payment_uniqueness.sql:121` | `employee_permissions` | SELECT | PUBLIC (implicit) |

All are named `service_role_*` / `*_service_all` — the **intent** was service-role-only, but the `TO service_role`
clause was omitted, and in Postgres a policy with no `TO` applies to `PUBLIC`. `103_app_api_quota_and_legacy_rls.sql`
and `107_security_rls_hardening_and_payment_uniqueness.sql` fixed this pattern for ~11 tables by re-creating them
`TO service_role`; the 16 above were missed. `gift_cards` (`FOR ALL USING(true)` to PUBLIC) is the money-adjacent one.

**Why the validator misses it** — `scripts/validators/no-public-using-true-validator.mjs`:
- line 13-15: `legacySqlFiles = new Set(['database/supabase/migrations/000_baseline.sql'])` and it `continue`s past it;
- line 25: `const publicRole = /\bTO\s+(PUBLIC|anon|authenticated)\b/i.test(block)` — an **implicit** PUBLIC
  (no `TO` clause) is never matched.

So the validator is green while 16 PUBLIC-reachable `USING(true)` policies are live.

**Exploitability — honest UNKNOWN.** The only `REVOKE`s in the whole migration set are:
- `163_d2_live_data_leak_rls.sql:202-214` — `REVOKE INSERT, UPDATE, DELETE … FROM PUBLIC, anon, authenticated`
  on exactly 11 tables (`products, product_variants, product_options, orders, sites, store_customers,
  customer_activity_log, customer_wishlists, wishlists, subscriptions, billing_history`);
- `163_…:216` — `REVOKE ALL ON public.super_admin_allowlist FROM PUBLIC, anon, authenticated`;
- `165_d5_canonical_money_paths.sql` — ledger append-only revokes;
- `195_contact_requests.sql` — one function revoke.

None of the 16 tables above is in that list. Whether `anon`/`authenticated` actually hold table privileges depends
on Supabase's platform-level `ALTER DEFAULT PRIVILEGES`, which **is not in this repo**. I can prove the policy
defect statically; I **cannot** prove reachability without live introspection. Reported as
`CONTRADICTORY_EVIDENCE`, severity P1, likelihood MEDIUM, and it must be settled by a live `\dp` / `pg_policies`
query before anyone claims it is safe.

### 4.5 Policy role census (live state)

| policies | `TO` role |
|--:|---|
| 456 | PUBLIC (implicit — **no `TO` clause**) |
| 121 | `service_role` |
| 95 | `authenticated` |
| 4 | `app_tenant` (explicit) + ~255 more created dynamically by 164 |
| 3 | `authenticated, anon` |
| 2 | `anon` |

The 456 implicit-PUBLIC policies are the dominant class. Most have real predicates (not `USING(true)`), so they are
not automatically wrong — but "no `TO` clause" as the house style is what allowed the 16 above to slip through, and
it makes the whole policy set hard to reason about.

### 4.6 RPCs (`SECURITY DEFINER` money kernel)

173 distinct functions defined in migrations. **65 distinct RPCs** are actually called from
`services/{api-gateway,queue-workers,webhook-service}/src`. Money-critical ones in use:

```
create_checkout_order                      attach_order_payment_reference_with_ledger
confirm_order_payment_with_ledger          record_order_payment_failure_with_ledger
complete_order_refund                      create_order_return_and_refund
post_settlement_ledger_transaction         reconcile_cod_remittance_with_ledger
release_order_inventory_with_ledger        refresh_money_ledger_site_reconciliation
issue_gift_card  set_gift_card_status  restore_gift_card_on_refund
check_gift_card_balance  gift_card_transactions  list_gift_cards
claim_payout_statement_release
```

**PAY-R2 re-verified by opening the SQL, as instructed.** `AGENTS.md` states `confirm_order_payment_with_ledger`
*"posts ZERO ledger entries despite its name"*. That was true of the `000_baseline.sql:1590` definition.
`database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:133-303` **replaces** it and it now:
- calls `confirm_order_payment(...)`, then `SELECT … FROM orders … FOR UPDATE` (line 168-171);
- upserts `payment_transactions` with `status='captured'`;
- **posts a balanced 2-line canonical ledger transaction** via `post_settlement_ledger_transaction(...)`
  (lines 232-259): `debit pa_clearing` / `credit merchant_payable` for `v_amount_minor`;
- stamps `payment_transactions.metadata.canonical_ledger_transaction_id` (263-267);
- inserts a `payment_attempts` row `ON CONFLICT DO NOTHING`.

→ **PAY-R2 is STALE DOCUMENTATION.** The named RPC does post to the canonical ledger as of migration 168.
Caveat retained: `v_amount_minor := round(COALESCE(v_order.total,0) * 100)::bigint` (line 177) converts from
`numeric(10,2)` rupees — see G-K-15.

### 4.7 Direct money-table writes from TypeScript

Precise scan (`.from('<money table>')` followed within 6 lines by `.insert|.update|.upsert|.delete`, excluding tests):
**38 call sites.**

| table | writes | files |
|---|--:|---|
| `partner_payout_ledger_entries` | 9 | `execution/queue-execution.adapter.ts:485,540,566`; `routes/operations/developers.ts:241,272,359`; `services/queue-workers/src/platform-queue-consumer.ts:1357,1411,1437` |
| `app_billing_charges` | 6 | `routes/app-store/billing-oauth-routes.ts:93,310,623,719,806,919` |
| `payout_statements` | 5 | `routes/payouts.ts:452,523,637,670`; `routes/settlements.ts:213` |
| `billing_history` | 3 | `execution/subscription-execution.adapter.ts:200`; `routes/billing.ts:276,367` |
| `wallet_ledger_entries` | 3 | `routes/payouts.ts:484,674`; `routes/settlements.ts:243` |
| `cod_reconciliation_entries` | 2 | `routes/cod-reconciliation.ts:203,333` |
| `commission_reconciliation_entries` | 2 | `routes/commission.ts:316,344` |
| `settlements` | 2 | `routes/settlements.ts:347,392` |
| `payouts` | 2 | `routes/payouts.ts:237`; `routes/settlements.ts:429` |
| `commission_schedules` | 1 | `routes/commission.ts:196` |
| `merchant_billing_invoices` | 1 | `routes/billing.ts:133` (upsert) |
| `payout_items` | 1 | `routes/settlements.ts:460` |
| `recon_breaks` | 1 | `routes/settlements.ts:403` |

**Zero** direct writes to `ledger_entries`, `ledger_transactions`, `ledger_accounts`, `payment_transactions`,
`refunds`, `refund_transactions`, `gift_card_*` — those are RPC-only. **That is the good news and the core
invariant holds.**

The validator `scripts/validators/canonical-ledger-only-validator.mjs:12-26` covers 13 tables and permits a write
when the same file also contains "canonical ledger evidence" (a `post_settlement_ledger_transaction` /
`ledger_transaction_id` reference), plus two named skip lists. **Its table list omits**: `payout_items`,
`reserves`, `recon_breaks`, `commission_reconciliation_entries`, `commission_schedules`,
`merchant_billing_invoices`, `billing_usage_events`, `store_credit`, `store_credit_ledger_entries`,
`billing_history`, `app_billing_charges`, `gift_card_redemptions`. Every write in `routes/settlements.ts` to
`payout_items` / `recon_breaks` is therefore unvalidated. **Validator coverage gap, P2.**

### 4.8 0% commission (R-9) — G-K-14

`162_phase_a_commission_zero.sql` does exactly three things:
```
ALTER TABLE commission_schedules            ALTER COLUMN commission_bps SET DEFAULT 0;
ALTER TABLE commission_reconciliation_entries ALTER COLUMN commission_bps SET DEFAULT 0;
UPDATE … SET commission_bps = 0 … WHERE COALESCE(commission_bps,0) <> 0;
```
The CHECK constraint is unchanged and still permissive:
`119_mobile_money_ledgers.sql:95,125` — `CHECK (commission_bps >= 0 AND commission_bps <= 10000 …)`.

A `DEFAULT` is overridable by any explicit write, and `routes/commission.ts:196` inserts into
`commission_schedules` directly from TypeScript. R-9's "permanent 0%" is a **soft** guarantee. A
`commission-bps-zero-validator.mjs` exists in `scripts/validators/`, but a source-lint cannot stop a runtime write;
only `CHECK (commission_bps = 0)` can.

---

## 5. TARGETED VIOLATION SEARCHES

Each row: the exact search, the raw hit count, then the **manually judged** production verdict.

### 5.1 `service_role` usage outside `services/`

```
grep -rn -e SERVICE_ROLE -e service_role --include='*.ts' --include='*.tsx' --include='*.mjs' \
  --include='*.sql' --include='*.toml' --include='*.yml' .   (excluding node_modules/.next/dist/.turbo/
  .wrangler/build/graphify-out/.claude/legacy and docs/archive)
```
**Raw: ~1,050 hits.** Distribution: `database/supabase/migrations` 543, `docs/archive/migrations-history` 288,
`packages/lcis-operations` 38, `database/supabase/rollback` 35, `services/api-gateway/src` 27, tests ~60, rest scattered.

| Location | Hits | Verdict |
|---|--:|---|
| `apps/**` | **0** | ✅ CLEAN |
| `packages/infrastructure/supabase-adapter/index.ts:25,35,67,68` | 4 | ✅ The single audited adapter (`createSupabaseServiceClient`, `auth:{autoRefreshToken:false,persistSession:false}`). Explicitly allow-listed by `no-blanket-service-role-validator.mjs:23-25`. |
| `services/api-gateway/src/index.ts:104` | 1 | ✅ `Env` type declaration. |
| `services/api-gateway/src/routes/contact-public.ts:193`, `demo-requests-public.ts:175` | 2 | ⚠️ **Judged: MISUSE, low severity.** `hashIp(ip, c.env.SUPABASE_SERVICE_ROLE_KEY ?? 'letbuyy')` — the service-role key is used as an **HMAC pepper** for IP hashing. Functionally it works, but it couples an IP-hash salt to the most privileged credential in the system: rotating the DB key silently invalidates every stored `ip_hash`, and it widens the blast radius of that key. Should be its own `IP_HASH_PEPPER`. P3. |
| `packages/lcis-*` (adapters/operations/security/performance/business) | ~55 | ✅ FALSE POSITIVE — LCIS intelligence packages naming the **env var** for "NOT CONNECTED" reporting; no client construction. |
| `tools/graph-server/*.mjs`, `scripts/dev/*`, `scripts/utilities/*` | ~20 | ✅ Dev tooling. |
| `tests/**` | ~60 | ✅ Test harnesses (ephemeral Postgres). |
| `.github/workflows/production-deploy.yml` (3), `staging-deploy.yml` (1) | 4 | ✅ Secret injection by name. |
| migrations / rollback / archive SQL | 866 | ✅ `TO service_role` policy grants — the intended design. |

**Verdict: no `service_role` violation outside `services/`.** The real service-role problem is *inside* services —
see G-K-01.

### 5.2 RLS policies with `USING (true)` to PUBLIC/anon/authenticated

Covered in **§4.4**. Raw 136 statements → 103 live → **16 PUBLIC/anon/authenticated-reachable**. Validator blind.

### 5.3 Direct DB access from `apps/`

**Raw: 0.** ✅ CLEAN (§1.2).

### 5.4 Direct writes to money tables from TypeScript

**Raw: 38 call sites.** Covered in **§4.7**. Canonical ledger + payment_transactions + refunds + gift cards are
RPC-only ✅. Settlement/payout/commission/billing surfaces write directly, 12 of the tables not covered by the
validator ⚠️.

### 5.5 Webhook handlers without signature verification

Inbound handler enumeration:

| Endpoint | File:line | Signature | Replay window | Idempotency |
|---|---|---|---|---|
| `POST /razorpay` | `services/webhook-service/src/index.ts:718` | ✅ double check: local `verifyRazorpayWebhookSignature(body, sig, RAZORPAY_WEBHOOK_SECRET)` **and** adapter `webhookVerify` (`:720-736`) | ❌ none — deliberate; `:754-760` logs but does not reject old events | ✅ `writeWebhookEvent` → `payment_webhook_events` returns `duplicate` |
| `POST /stripe` | `:912` | ✅ `STRIPE_WEBHOOK_SECRET` | not audited in depth | ✅ same store |
| `POST /paypal` | `:1111` | ✅ `PAYPAL_WEBHOOK_ID` | " | ✅ |
| `POST /cashfree` | `:1249` | ✅ `CASHFREE_SECRET_KEY` | " | ✅ |
| `POST /app-lifecycle/dispatch` | `:603` | ⚠️ `internalDispatchSecret()` = `INTERNAL_API_SECRET \|\| AUTH_SECRET` — **G-K-16** | n/a | n/a |
| `POST /webhook-deliveries/dispatch` | `:693` | ⚠️ same helper | n/a | n/a |
| `POST /v1/whatsapp/inbound` (+ `/v1/wa/webhook`) | `services/api-gateway/src/routes/whatsapp.ts:791` → `requireWhatsAppWebhookSignature` `:559` → `packages/infrastructure/whatsapp-commerce-adapter/index.ts:324-336` | **live**: Twilio HMAC + `timingSafeEqual` ✅. **sandbox**: plain header `===` compare, and if the secret is unconfigured it returns `!isProductionRuntime(credentials)` — i.e. **accepts unsigned** outside production | ❌ none | ✅ `provider_message_id` dedupe (`whatsapp.ts:817-830`) |

**Verdict: no unsigned inbound provider webhook in production.** Two sub-findings: the WhatsApp sandbox fallback
uses a non-constant-time compare and open-accepts when unconfigured (P3, non-production only), and no provider
handler enforces a timestamp/replay window (mitigated by event-id idempotency, documented at
`webhook-service/src/index.ts:755-756`).

**Outbound webhooks**: dispatched by `dispatchWebhookDeliveries` (webhook-service) driven from the gateway cron
(`services/api-gateway/src/index.ts:923-936`) with `X-LetBuyy-Internal-Secret`. Delivery rows live in
`webhook_deliveries` / `webhook_deliveries_partitioned`; DLQ via `outbox_dead_letters` +
`replay_outbox_dead_letter` RPC. Merchant-facing webhook subscription CRUD exists at
`/v1/operations/webhook-subscriptions` (`routes/operations.ts:304,326`) — **ops-only, no merchant UI**.

### 5.6 Queue jobs without a signed tenant envelope

Producer: `services/api-gateway/src/lib/queue-tenant-envelope.ts:34-50` —
`signature = HMAC-SHA256(secret, siteId.messageId.idempotencyKey.issuedAt)`, secret =
`QUEUE_TENANT_ENVELOPE_SECRET || INTERNAL_API_SECRET`, with placeholder rejection
(`SKIP_NEEDS_HUMAN_`, `replace-with`).

Consumer: `services/queue-workers/src/index.ts:148-185` — `verifiedTenantSiteId`:
- detects tenant scope by `siteId` **or** any nested `site_id/store_id/siteId/storeId` in the payload (`:134-146`);
- **throws deterministically** if envelope/secret/signature missing (`:165`);
- rejects `envelope.siteId !== candidateSiteId` (`:167`);
- rejects `|now - issuedAt| > 15 min` (`:171-174`);
- constant-time signature compare (`:180`).

**Verdict: FAIL-CLOSED ✅.** Producers found: `lib/order-confirmation-email.ts:128,228`,
`lib/transactional-email.ts:117`, `lib/gift-card-email.ts:96`, `routes/storefront.ts:251`,
`routes/app-store/shared.ts:189`. One sharp edge: `signQueueTenantEnvelope` **silently returns the unsigned body**
when the secret is missing (line 39-40), so a misconfigured deploy produces messages that the consumer then
deterministically dead-letters. Fail-closed, but silently — P3 observability gap.

### 5.7 Queries on tenant tables missing a site filter

Enforced at runtime, not at lint time, by `createTenantGuardedSupabaseClient`
(`services/api-gateway/src/tenant/tenant-scoped.ts:79-124`) over the 262-entry
`tenant-tables.registry.ts` (generated; parity asserted by `tenant-isolation-validator.mjs:27-31`).
The static half is `tenant-isolation-validator.mjs:69+` which flags
`getSupabaseAdmin(...).from('<tenant table>')` patterns. Limits already stated in §2.5: predicate-presence only,
`.from()` only, no `.rpc()` coverage.

### 5.8 Client-supplied amounts reaching persistence

**Checkout: CLEAN.** `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:336-364` recomputes
GST server-side by re-reading `products.price` from the DB per line item and calling `calculateGstLine`;
`orderCommand.items` carry only `product_id/variant_id/quantity`
(`:379-385`). `create_checkout_order` (`database/supabase/migrations/170_v1_shipping_rates_gst.sql:105-158`)
resolves the shipping rate **server-side and site-scoped**
(`WHERE sr.id = p_shipping_rate_id AND sz.site_id = p_store_id AND sr.is_active` → `RAISE EXCEPTION` if not found).
Two caveats:
  - the GST computation is wrapped in `try { … } catch { computedTaxAmount = null }` (`:366-369`) — a transient DB
    error silently produces a **zero-GST order**. Compliance risk, flagged for Agent H.
  - `min_order_amount` / `max_weight_grams` range checks are explicitly *"advisory (display-only) in V1"*
    (`170_…:135`), so a client can select any active rate id belonging to the store, including the cheapest.

**Settlements: NOT CLEAN — G-K-03.** `POST /v1/settlements/ingest`
(`services/api-gateway/src/routes/settlements.ts:319`) validates against `SettlementIngestSchema`
(`packages/billing-core/src/index.ts:138-152`), which accepts:
```
gross_amount_minor : z.number().int().nonnegative()      ← client
platform_fee_minor : … .default(0)                       ← client
gst_minor          : … .default(0)                       ← client
net_amount_minor   : … .optional()                       ← client
reserve_minor      : … .default(0)                       ← client
provider_mode      : … .default('sandbox')               ← client
```
`planSettlementLedgerPosting` (`packages/billing-core/src/index.ts:573-620`) turns those numbers directly into
ledger lines, and the route then:
- inserts `settlements` with the client's amounts (`routes/settlements.ts:347-366`);
- if balanced, calls `postSettlementLedgerTransaction` → **canonical `ledger_transactions` + `ledger_entries`**
  (`:378-395`);
- if `net_amount_minor > 0 && rail === 'pa_split'`, inserts `payout_statements`, `payouts`
  (`status:'scheduled'`, `requires_step_up:true`), `payout_items`, and `wallet_ledger_entries`
  (`:425-470`, `settlements.ts:213,243,429,460`).

The only gate is `assertLiveSettlementReady` (`routes/settlements.ts:58-71`), which **returns immediately when
`provider_mode !== 'live'`** — and `'sandbox'` is the schema default. The route is mounted in the
**merchant-authenticated** block (`index.ts:778`), not under `/internal/*`, and authorization is
`resolveTenantContextForOwnedSite(c, body.store_id)` — i.e. plain site ownership.

**Net effect:** any authenticated store owner can inject arbitrary amounts into their own canonical double-entry
ledger, materialise `merchant_payable` credits, and queue payouts. Actual fund movement still requires an external
PA execution + step-up on `POST /payouts/:id/settle`, so this is a **ledger-integrity and reconciliation
corruption** finding rather than direct fund theft — but the ledger is the constitutional source of truth (R-5),
and this route has **no merchant UI consumer** (§2.9), so nothing legitimate calls it from the product.

### 5.9 Tokens in `localStorage` (SEC-R4)

```
grep -rn 'localStorage' apps/merchant-control-plane/src   → 1 hit, non-auth
```
Storefront uses `localStorage` for `lb_cart`, `lb_cart_token`, `lb_wishlist` only
(`apps/storefront-runtime/src/context/cart-context.tsx:111,129,154-170`,
`wishlist-context.tsx:48,59`, `lib/theme-engine/liquid-hydration-islands.tsx:67,122-137,280-289,794-804`).
`CART_TOKEN_STORAGE_KEY` is a **guest cart identifier**, not a session/auth token — it is minted server-side for an
anonymous cart. Sessions are `httpOnly` cookies (`packages/auth-core`, `apps/identity-platform/src/lib/auth/cookies.ts:60-65`).
**Verdict: NO SEC-R4 violation.** ✅

### 5.10 Hardcoded provider key identifiers (CODE-R10)

```
grep -rlnE 'rzp_(live|test)_[A-Za-z0-9]{8,}|sk_(live|test)_[A-Za-z0-9]{12,}|pk_(live|test)_…|whsec_…|AIza…|<jwt-header-b64>' \
  services/ apps/ packages/ config/ scripts/ database/
```
**Raw: 1 file — `scripts/dev/setup-local-env.mjs`.** Judged **FALSE POSITIVE** for a production violation:
lines 71/103/104/148-152 assign obvious local-dev placeholders (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) whose values are literal `…_localdev`
strings; lines 42/44 contain the well-known Supabase local-demo JWT header prefix. **No value is transcribed here.**
Minor smell: the script uses `joinLocalValue("rzp_test", "_localdev")` to split the literal so scanners do not
match — placeholder obfuscation that defeats future secret scanning. P3.
`scripts/validators/committed-secret-placeholder-validator.mjs` exists and is presumably the authority here.

### 5.11 `AUTH_SECRET` used as a fallback for another secret (SEC-R7)

**Raw: 5 production fallbacks.**

| Site | Chain | Verdict |
|---|---|---|
| `services/webhook-service/src/index.ts:584` | `INTERNAL_API_SECRET \|\| AUTH_SECRET` | ⚠️ **REAL SEC-R7 VIOLATION.** Cross-trust-domain: the identity cookie-signing secret becomes an internal-dispatch bearer. `scripts/validators/session-security-validator.mjs` asserts no-AUTH_SECRET for `packages/auth-core`, `services/api-gateway/src/lib/internal-auth.ts`, `.../internal-secret.ts`, `.../routes/app-store/shared.ts`, 2 app clients and 4 more app clients — **but never checks `services/webhook-service`**. Validator coverage gap. **G-K-16, P2.** |
| `services/api-gateway/src/routes/export.ts:174` | `INTERNAL_API_SECRET \|\| CUSTOMER_SESSION_SECRET \|\| AUTH_SECRET` | ⚠️ Three-way cross-domain fallback. P2. |
| `services/api-gateway/src/routes/checkout.ts:88` and `routes/storefront/cart-routes.ts:307` | `CHECKOUT_SIGNING_SECRET \|\| AUTH_SECRET \|\| STORE_ACCESS_SIGNING_KEY` | ⚠️ Checkout handoff signing falls back to the identity secret. P2. |
| `services/api-gateway/src/routes/media.ts:60` | `MEDIA_UPLOAD_SIGNING_SECRET \|\| AUTH_SECRET` | ⚠️ P3. |
| `services/api-gateway/src/routes/internal-console.ts:441` | `c.env.AUTH_SECRET` (direct, not a fallback) | Judged: intentional console-token domain; `scripts/validators/secret-topology-validator.mjs:81-85` separately bans it in `apps/platform-console`. Noted, not scored. |

`apps/identity-platform/src/lib/auth/cookies.ts:13-22` — `AUTH_SECRET` is the *primary* identity secret and
correctly hard-fails in production if missing/<16 chars, with a `dev-only-insecure-…` value only outside production. ✅

### 5.12 `*_DEV_AUTH_BYPASS` style flags (TEST-R9)

**Raw: 9 references, 1 flag family (`LETBUYY_ENABLE_DEV_AUTH_BYPASS` / `NEXT_PUBLIC_…`).**

`apps/identity-platform/src/lib/dev-auth-bypass.ts:19-23`:
```
canUseIdentityDevAuthBypass = !isProductionIdentityRuntime(env)
                            && NODE_ENV === 'development'
                            && LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'
```
`isProductionIdentityRuntime` checks `NODE_ENV | APP_ENV | VERCEL_ENV | NEXT_PUBLIC_ENV`. Same pattern in
`apps/platform-console/src/lib/console-auth-server.ts:173-183` for the dev MFA code.
`scripts/validators/dev-auth-bypass-validator.mjs` (56+ lines) gates: signup `devOtp` echo, Turnstile
`dev-bypass-token`, the Turnstile widget, the console MFA bypass, that env templates default both flags to `false`,
and that both names are in the env schema.

**Verdict: PROPERLY GATED ✅.** Residual note: `NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS` is inlined into the
client bundle at build time (`apps/identity-platform/src/components/TurnstileWidget.tsx:27`,
`apps/storefront-runtime/src/components/security/turnstile-widget.tsx:27`,
`apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx:517`). If a production build ever
carried it, the client would emit `dev-bypass-token` — but the server-side Turnstile verifier still requires
`NODE_ENV=development`, so the fail-safe holds. P3 defence-in-depth note.

---

## 6. WEBHOOKS — consolidated

Covered in §5.5. Additional consumer-effect detail for the merchant-critical Razorpay path
(`services/webhook-service/src/index.ts:718-900+`):

```
POST /razorpay
  → verify x-razorpay-signature (HMAC-SHA256) twice                        :720-736
  → JSON.parse; log-only age check (>300s warns, does NOT reject)          :754-760
  → providerEventId = verification.event.id || razorpayProviderEventId(...) :764
  → writeWebhookEvent(payment_webhook_events) → { duplicate }              :766-778
  → switch(event.event):
      payment.captured → resolveRazorpayNotes → findOrderByPaymentCandidates
                        → markOrderPaid(...)                               :798-830+
```
Tenant routing is **derived from the order**, not from the webhook payload's site claim — correct.
**Custody note (feeds G-K-02):** there is exactly **one** `RAZORPAY_WEBHOOK_SECRET` and one
`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` for the whole platform (`webhook-service/src/index.ts:38-40, 243-244,
478-481`). Under a true merchant-of-record model each merchant's own Razorpay account has its **own** webhook
secret, and a single platform secret is structurally incompatible with per-merchant accounts.

---

## 7. QUEUES AND SCHEDULED JOBS — `services/queue-workers`

`services/queue-workers/wrangler.toml`. **One cron for the whole runtime: `17 */6 * * *`** (every 6 h), identical
in `[triggers]`, `[env.staging.triggers]`, `[env.production.triggers]`.

### 7.1 Queue consumers (production names shown; staging mirrors)

| Queue | batch | timeout | concurrency | retries | delay | DLQ |
|---|--:|--:|--:|--:|--:|---|
| `letbuyy-events-production` | 50 | 10 | 10 | 3 | 30 | `letbuyy-dead-letters-production` |
| `letbuyy-analytics-queue-production` | 50 | 10 | 10 | 8 | 30 | ↑ |
| `letbuyy-search-queue-production` | 25 | 10 | 10 | 8 | 45 | ↑ |
| `letbuyy-notifications-queue-production` | 25 | 10 | 5 | 6 | 60 | ↑ |
| `letbuyy-dead-letters-production` | 25 | 30 | 3 | 3 | 300 | (terminal) |
| `letbuyy-production-queue` | 50 | 10 | 10 | 10 | 30 | `letbuyy-production-dead-letter-queue` |
| `letbuyy-production-dead-letter-queue` | 25 | 30 | 3 | 3 | 300 | (terminal) |

Bindings: `API_GATEWAY_SERVICE` → `letbuyy-api`; `RUNTIME_TELEMETRY` → `letbuyy-production-telemetry`;
`[placement] mode = "smart"`.

`queue()` handler (`services/queue-workers/src/index.ts:561-619`): normalize (verifies the signed tenant envelope,
throws deterministically on failure) → `persistQueueBatch` → `consumePlatformQueuesForCloudflareQueue` →
`dispatchEmailDeliveries` → risk-scoring → review-checks → support-automation → compliance →
executive-analytics → incident-command → `ack()` all. On any throw the **entire batch** is `retry()`d
(`:610-611`) — no per-message isolation, so one poison message re-drives up to 49 healthy siblings until
`max_retries` sends them all to the DLQ. **P2 reliability finding.**

### 7.2 Scheduled jobs — proven registered

All six are registered inside `scheduled()` (`services/queue-workers/src/index.ts:620-700`) on the single
`17 */6 * * *` cron:

| Job | Entry | Line |
|---|---|--:|
| custom-domain reconciler | `triggerCustomDomainReconciler(env, cron)` → gateway `POST /v1/internal/custom-domain-reconcile` | 622 (impl 528-557) |
| inventory reservation sweeper | `runInventoryReservationSweeper` (`src/inventory-reservations.ts`, 40 lines) | 623-636 |
| money-ledger reconciliation | `runMoneyLedgerReconciliation` (`src/money-ledger-reconciliation.ts`, 107 lines) → `refresh_money_ledger_site_reconciliation` RPC | 637-652 |
| executive analytics rollup | `runExecutiveAnalyticsRollup` (`src/executive-analytics.ts`, 477 lines) | 653-668 |
| incident postmortem reminders | `runIncidentPostmortemReminders` (`src/incident-command.ts`, 220 lines) | 669-683 |
| compliance audit export **dry-run** | `runComplianceAuditExportDryRun` (`src/compliance.ts`, 211 lines) | 684-699 |

Gateway has its **own** `scheduled()` (`services/api-gateway/src/index.ts:869-1010`) for outbox/webhook/queue
dispatch across `analytics-events`, `search-indexing`, `payment-events`, with a `hasPendingScheduledDispatchWork`
preflight and deliberate "no queue write on failure-only churn" behaviour (`:939-945`, `:996-998`).

### 7.3 DORMANT — defined but never scheduled

- **`services/queue-workers/src/push-dispatcher.ts` (400 lines)** — `dispatchPushNotificationToDevices` is called
  only from `platform-queue-consumer.ts:665`, i.e. it is queue-driven, never scheduled. More importantly
  `PUSH_DISPATCH_MODE = "dry-run"` in **all three** wrangler blocks including `[env.production.vars]`, and
  `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` are all literal
  `SKIP_NEEDS_HUMAN_PUSH_*` placeholders in production. **Push notifications do not send in production.**
  `DORMANT_FLAGGED`, P2 (merchant-app relevant).
- `runComplianceAuditExportDryRun` — the name and its reason string (*"Scheduled local dry-run audit export cursor
  advance."*) say it advances a cursor without exporting. `DORMANT_FLAGGED`, P3.
- `services/queue-workers/src/review-checks.ts`, `risk-scoring.ts`, `support-automation.ts` are queue-delivery
  driven only — correct by design, listed for completeness.

### 7.4 Cadence risk

A 6-hour cron is the **only** timer for inventory-reservation expiry and money-ledger reconciliation. An expired
checkout reservation can hold stock for up to 6 hours; a ledger break can go unreconciled for up to 6 hours.
Flagged as a P2 operational finding for the dossier (business-tolerance decision, not a code defect).

---

## 8. ENVIRONMENT VARIABLES — NAMES ONLY

No `.env` file was opened. All names below come from `Env` interfaces, `process.env.X` references, `wrangler.toml`
`[vars]`, and workflow `env:` keys. **No values are reproduced.**

### 8.1 `services/api-gateway` — `Env` interface, `services/api-gateway/src/index.ts` — **180 declared**

Required (typed non-optional → the code assumes presence):
`SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
ENVIRONMENT, RUNTIME_NAME, PRIMARY_REGION, EDGE_SCOPE` (+ bindings `CACHE, R2_BUCKET, RUNTIME_DB,
RUNTIME_TELEMETRY, RUNTIME_QUEUE, RUNTIME_COORDINATOR, EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE,
NOTIFICATION_QUEUE, WEBHOOK_SERVICE, HYPERDRIVE, STOREFRONT_CACHE`).

Security/identity: `AUTH_SECRET?, CSRF_SECRET, CUSTOMER_SESSION_SECRET, INTERNAL_API_SECRET,
INTERNAL_API_SECRET_PREVIOUS, LETBUYY_INTERNAL_API_SECRET, LETBUYY_INTERNAL_API_SECRET_PREVIOUS,
WORKER_INTERNAL_API_SECRET, INTERNAL_GATEWAY_IP_ALLOWLIST, LETBUYY_IDENTITY_ISSUER,
LETBUYY_IDENTITY_PUBLIC_JWKS, STEP_UP_SIGNING_SECRET, TOTP_ENCRYPTION_KEY, TURNSTILE_SECRET_KEY,
CHECKOUT_SIGNING_SECRET, STORE_ACCESS_SIGNING_KEY, MEDIA_UPLOAD_SIGNING_SECRET, PREVIEW_SIGNING_KEY,
QUEUE_TENANT_ENVELOPE_SECRET, PAYMENT_CONFIG_ENCRYPTION_KEY, PLATFORM_CONSOLE_API_TOKEN,
LETBUYY_KMS_MODE, LETBUYY_KMS_KEY_ID, LETBUYY_KMS_SANDBOX_SECRET`.

Payments/money: `RAZORPAY_ROUTE_ACCOUNT_ID, RAZORPAY_ROUTE_KEY_SECRET, RAZORPAY_ROUTE_MODE,
AI_CREDIT_RAZORPAY_KEY_ID, AI_CREDIT_RAZORPAY_KEY_SECRET, AI_CREDIT_PRICE_INR_PAISE, AI_CREDIT_PURCHASE_MODE,
AI_CREDIT_PURCHASE_PROVIDER, STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE,
PAYPAL_WEBHOOK_ID, CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENVIRONMENT, CASHFREE_API_VERSION,
LETBUYY_PAYMENT_MODE, LETBUYY_RAZORPAY_MODE, LETBUYY_CASHFREE_MODE, LETBUYY_UPI_MODE, LETBUYY_COD_MODE,
LETBUYY_AUTOPAY_MODE, LETBUYY_GST_IRP_MODE`.

Feature flags (16): `FEATURE_GRAPHQL, FEATURE_EXTENSIONS, FEATURE_LIQUID, FEATURE_OIDC_CLIENT,
FEATURE_IDENTITY_PROVIDER, FEATURE_ORG_MODEL, FEATURE_AUDIT_DUAL_WRITE, FEATURE_NEW_AUDIT_ENGINE,
FEATURE_NEW_CSRF, FEATURE_NEW_KEY_SERVICE, FEATURE_NEW_MFA_ENGINE, FEATURE_NEW_PERMISSION_ENGINE,
FEATURE_NEW_SESSION_ENGINE, FEATURE_PERUSER_ADMIN_TOTP, FEATURE_SHADOW_AUTH, FEATURE_SHADOW_PERMISSION,
FEATURE_SHADOW_SESSION, FEATURE_TOKEN_HASH_SHADOW`.

**Referenced in code but NOT declared in `Env`:** `MERCHANT_STAFF_RBAC_MODE`
(`services/api-gateway/src/middleware/staff-permission.ts:46` reads it via
`(env as unknown as { MERCHANT_STAFF_RBAC_MODE?: string })` — an explicit cast around the missing declaration).
It is set in **no** wrangler block, **no** `config/env/*`, and **no** workflow → defaults to `dryrun`. **G-K-07.**

### 8.2 `apps/merchant-control-plane` — **14 names**

`COOKIE_DOMAIN, INTERNAL_API_SECRET, LETBUYY_INTERNAL_API_SECRET, LETBUYY_API_BASE_URL, LETBUYY_API_URL,
NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_ACCOUNTS_URL, NEXT_PUBLIC_ADMIN_URL,
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_STOREFRONT_URL,
NEXT_PUBLIC_THEME_MARKETPLACE_URL, NODE_ENV`

Notably **absent**: any Supabase, Razorpay, Turnstile, Resend, or session-signing secret. ✅ Correct proxy posture.

### 8.3 `services/webhook-service` — 23

`SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_API_SECRET, AUTH_SECRET (⚠ fallback),
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE, PAYPAL_WEBHOOK_ID, CASHFREE_APP_ID, CASHFREE_SECRET_KEY,
CASHFREE_ENVIRONMENT, CASHFREE_API_VERSION, API_GATEWAY_SERVICE, ENVIRONMENT, APP_ENV, NODE_ENV,
DEPLOYMENT_ENV, TELEMETRY_ENV`

### 8.4 `services/queue-workers` — 22

`API_GATEWAY_SERVICE, RUNTIME_TELEMETRY, INTERNAL_API_SECRET, QUEUE_TENANT_ENVELOPE_SECRET,
RESEND_API_KEY, RESEND_FROM_EMAIL, PLATFORM_QUEUE_CLAIM_LIMIT, PLATFORM_QUEUE_DRAIN_BUDGET_PER_BATCH,
PLATFORM_QUEUE_CIRCUIT_FAILURE_THRESHOLD, PLATFORM_QUEUE_CIRCUIT_OPEN_SECONDS,
PLATFORM_QUEUE_DRAIN_GENERIC_FANOUT, INVENTORY_RESERVATION_SWEEPER_LIMIT,
MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT, CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT, ENVIRONMENT, APP_ENV, NODE_ENV,
DEPLOYMENT_ENV, TELEMETRY_ENV, RUNTIME_NAME, PRIMARY_REGION, EDGE_SCOPE`
Plus push (all placeholder in production): `PUSH_DISPATCH_MODE, FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY,
APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY, APNS_ENVIRONMENT`.
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are consumed indirectly through the shared adapter.

### 8.5 `apps/identity-platform` — 32

`AUTH_SECRET, COOKIE_DOMAIN, INTERNAL_API_SECRET, LETBUYY_INTERNAL_API_SECRET, LETBUYY_IDENTITY_ISSUER,
LETBUYY_IDENTITY_PRIVATE_JWK, LETBUYY_IDENTITY_PUBLIC_JWKS, LETBUYY_IDENTITY_MERCHANT_PUBLIC_JWKS,
TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, LETBUYY_REMOTE_RATE_LIMIT, FEATURE_MAGIC_LINK,
FEATURE_PASSKEY, LETBUYY_ENABLE_LEGACY_SITE_TYPES, NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS,
NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES, ADMIN_ORIGIN, API_URL, LETBUYY_API_URL,
IDENTITY_PROVIDER_ORIGIN, NEXT_PUBLIC_IDENTITY_PROVIDER_ORIGIN, NEXT_PUBLIC_ACCOUNTS_URL,
NEXT_PUBLIC_ADMIN_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN, PLATFORM_ROOT_DOMAIN,
RESEND_FROM_EMAIL, NODE_ENV, VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_PROJECT_PRODUCTION_URL`

`LETBUYY_IDENTITY_PRIVATE_JWK` is injected only for the identity app
(`.github/workflows/production-deploy.yml:446` — `matrix.app == 'identity-platform' && … || ''`). ✅ Sole-signer key
custody is correct **at the config layer**; it is the *verification* side that is not wired (G-K-04).

### 8.6 Cookie-domain configuration (G-K-13)

`.github/workflows/production-deploy.yml:450` sets `COOKIE_DOMAIN: .letbuyy.com` in a **single `env:` block that
applies to the whole app matrix** — `marketing-site, identity-platform, merchant-control-plane,
storefront-runtime, platform-console` (`:398-409`). `config/env/production.env.template:112` explicitly instructs
*"STOREFRONT runtime: leave COOKIE_DOMAIN unset so shopper cookies are host-only."* The workflow contradicts the
template. Mitigating fact I verified: `apps/storefront-runtime/src/lib/session.ts` does **not** read
`COOKIE_DOMAIN`, so the storefront's own customer cookie stays host-only regardless.

The live risk is the other direction: `apps/identity-platform/src/lib/auth/cookies.ts:60-65` sets **every**
platform cookie — including `lb_session` (`:80-87`, `sameSite:'lax'`, `httpOnly`, 30-day `maxAge`) — with
`domain: .letbuyy.com`. Storefronts are `{store}.letbuyy.com` (CLAUDE.md; DEPLOY-R3 mandates one canonical domain).
So a logged-in merchant browsing **any** merchant's subdomain storefront transmits `lb_session` to that origin, and
`admin.letbuyy.com`'s 130 API route handlers accept a same-site POST with no CSRF token and no Origin check.
`SameSite=Lax` blocks cross-**site** attacks but not same-site subdomain ones. The doc comment at
`cookies.ts:39-48` describes the two-realm split as *"the tenant-isolation guarantee"* — that guarantee covers the
storefront cookie not having a parent domain; it does **not** address the platform cookie descending into
merchant-controlled subdomains. `CONTRADICTORY_EVIDENCE` on the doc claim; P1 on the CSRF vector.

---

## 9. `services/lcis-api` — topology assessment (G-K-17)

`services/lcis-api/package.json` — `@letbuyy/lcis-api`, private, *"LCIS API — internal read-only HTTP service over
the LCIS engine (Hono). Consumes @letbuyy/lcis-core."* Deps: 7 `@letbuyy/lcis-*` workspace packages + `hono`,
`@hono/node-server`, `zod`. Source: `src/{index,app,server,middleware}.ts`, ~1,527 lines total. Tests: 2 files.

Evidence for the verdict:
- **No** `wrangler.toml`, **no** `vercel.json`, **no** Dockerfile.
- **No** `runtime.manifest.json` (every canonical and every reserved runtime has one).
- **Zero** references in `.github/workflows/`, `turbo.json`, or `pnpm-workspace.yaml` deploy paths.
- `src/server.ts` is a plain Node `@hono/node-server` on `LCIS_API_PORT ?? 7100`, guarded by
  `if (import.meta.url === \`file://${process.argv[1]}\`)` — a manual `npm start` only.
- `src/middleware.ts` provides request-id, security headers, an in-memory per-IP token bucket, Zod validation and
  audit logging — and **no authentication of any kind** (`grep -n 'auth|token|Bearer|secret' src/app.ts` → 0 hits).

**Verdict: DEV-ONLY TOOL, not a deployed runtime → not a runtime-topology violation in the deploy sense.** It *is*
a **namespace violation**: it occupies `services/`, which the Constitution reserves for the 8 canonical runtimes +
6 empty reserved roots, and no validator currently notices (`grep -rn 'lcis-api' scripts/validators/*.mjs` → 0).
The latent risk is that a fully unauthenticated service already sits in the directory that deploy tooling scans.
Recommended framing for the dossier: relocate under `tools/` (where `tools/graph-server`, `tools/central-intelligence`
already live) or add an explicit Constitution carve-out + a validator assertion that it can never be deployed.

---

## 10. END-TO-END TRACES

### T1 — Merchant refunds an order (the money path the UI actually uses)

```
Merchant UI: /[store]/orders/[orderId] → Refund action
  → POST /api/stores/[store]/orders/[orderId]/refund
      apps/merchant-control-plane/src/app/api/stores/[store]/orders/[orderId]/refund/route.ts:7
  → resolveOwnedStoreId(store)                                              (route.ts:14)
  → GET /v1/orders/:orderId   (merchantApiFetch, requireSession)            (route.ts:26)
      → gateway resolves order + ownership; returns order.payment_id
  → POST /v1/payments/:paymentId/refund                                     (route.ts:49)
      headers: X-Step-Up-Token, X-Step-Up-Verified-At                       (route.ts:45-47)
      body: { idempotency_key, amount_minor?, reason?, provider_refund_id? }
  → gateway authMiddleware: internal-session-hmac → sessions RPC → users_custom
  → csrfProtection: SKIPPED (X-LetBuyy-Internal-Signature present)          security.ts:263
  → protectedMutationIdempotency (/payments is in the prefix list)          idempotency.ts:26
  → routes/payments.ts:467  validate('json', PaymentRefundSchema)
  → loadOwnedPaymentSession(paymentId, customUser.id, auth.user.storeId)    payments.ts:486
  → status must be 'captured'; cumulative refund ≤ captured                 payments.ts:487-497
  → verifySensitiveActionStepUp({action:'refund.approve', actorId, siteId}) payments.ts:497-507
        HMAC-SHA256 + constant-time, 10-min window                          security-controls.ts:160-235
  → IdempotencyExecutionAdapter.begin(scope: payment.refund:<id>)           payments.ts:510-517
  → complete_order_refund RPC (SECURITY DEFINER) → canonical ledger
  → restore_gift_card_on_refund RPC (best-effort)
  → order lifecycle email enqueued (signed tenant envelope) → NOTIFICATION_QUEUE
```
**MISSING links:**
- **MISSING** — `POST /v1/orders/:id/refund` (`routes/orders.ts:1427`) and `POST /v1/orders/:id/refund/complete`
  (`routes/orders.ts:1342`) provide the *same* capability with **no step-up**. Both are inside the
  merchant-authenticated block, both reachable directly with a valid `lb_session`. `assertStaffPermission(...,
  'orders:write')` is their only extra gate, and that is in **`dryrun`** (§5, G-K-07) → it blocks nothing.
  **G-K-10.**
- **MISSING** — step-up token is not burned. `payload.jti` is generated (`security-controls.ts:145`) and the tables
  `step_up_challenges` / `sensitive_action_approvals` exist (`153_executable_identity_security.sql:98,120`), but
  `verifySensitiveActionStepUp` never records or checks the `jti`, and the token is bound to
  `action + actor_id + site_id` only — **not to the payment, order, or amount**. One token → unlimited
  `refund.approve` calls for 10 minutes. **G-K-11.**
- **MISSING** — no runtime observation. `UNVERIFIED_RUNTIME`.

### T2 — Merchant connects their Razorpay account (never-custody)

```
UI: /[store]/settings/payments
  → POST /api/stores/[store]/payment-config
      apps/merchant-control-plane/src/app/api/stores/[store]/payment-config/route.ts:25
  → resolveOwnedStoreId
  → client.stores.paymentConfig.save(storeId, {key_id, key_secret, test_mode})
  → POST /v1/stores/:id/payment-config     services/api-gateway/src/routes/stores.ts:366
  → validate('json', PaymentConfigSchema); resolveCustomUser
  → require PAYMENT_CONFIG_ENCRYPTION_KEY else 503                          stores.ts:381-391
  → SELECT sites.payment_settings WHERE id=:store AND ownedByCustomUser      stores.ts:393-407
  → encryptPaymentSecret(key_secret, PAYMENT_CONFIG_ENCRYPTION_KEY)          stores.ts:425
      AES-GCM, key = SHA-256(env string), single platform-wide key
      lib/store-payment-config.ts:32-46
  → write sites.payment_settings.razorpay.key_secret_ciphertext             stores.ts:445
```
**MISSING links — this is where G-K-02 and G-K-05 live:**
- **MISSING** — `key_secret_ciphertext` is **never decrypted**. `grep -rn 'key_secret_ciphertext'` across all
  services returns 3 hits, all in `lib/store-payment-config.ts` (type decl :8, `secret_configured` boolean :66,
  a mode toggle :77) and the write at `stores.ts:445`. `importPaymentEncryptionKey` requests **`['encrypt']` only**
  (`store-payment-config.ts:34`) — there is no decrypt capability. The merchant's credential is write-only.
- **MISSING** — the actual money-in path uses the **platform** key:
  `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:464` (`if (!c.env.RAZORPAY_KEY_ID ||
  !c.env.RAZORPAY_KEY_SECRET) → PAYMENT_UNAVAILABLE`), `:505-507`
  `createRazorpayPaymentProvider({ keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET })`,
  `:544-545` returns `key_id: c.env.RAZORPAY_KEY_ID` to the shopper's browser, `:584` verify uses
  `c.env.RAZORPAY_KEY_SECRET`. Same for merchant subscriptions
  (`lib/subscription-checkout.ts:118,133,152,208,227`) and AI credits (`routes/ai.ts:472-473`).
  **⇒ LetBuyy is the merchant-of-record for shopper payments. Direct ART-11 / R-7 NEVER-CUSTODY violation.**
- **MISSING** — two competing credential authorities. `payment_credentials`
  (`142_executable_payment_sessions.sql:7-24`, per-site, `kms_key_ref`, `encrypted_credentials jsonb`,
  `UNIQUE(site_id, provider, mode)`) is the *designed* home. It has exactly **one** reference in all of `services/`:
  a `SELECT id` at `lib/payment-route-support.ts:98`. **No code ever inserts into it.** The credential actually
  lands in `sites.payment_settings` jsonb instead. `requireLivePaymentCredential`
  (`payment-route-support.ts:122-138`) throws `HumanRequiredError` / `[HUMAN-REQUIRED] HR-MERCHANT-PSP-LIVE` when
  `mode==='live'` and no row exists — so the V1 payment-session path is honestly blocked, while the **legacy
  storefront Razorpay path bypasses it entirely** using the platform key. Two rails, one honest, one live.
- **MISSING** — one platform `RAZORPAY_WEBHOOK_SECRET` for all merchants (§6). Structurally incompatible with
  per-merchant accounts.
- **MISSING** — no runtime observation. `UNVERIFIED_RUNTIME`.

### T3 — Staff member accepts an invite (broken)

```
Invite email → /accept-invite?token=…
  → POST /api/employees/accept-invite
      apps/merchant-control-plane/src/app/api/employees/accept-invite/route.ts:8
      header comment: "PUBLIC (pre-auth). The invitee has no merchant session yet"
  → merchantApiFetch('/employees/auth/accept-invite', { method:'POST' })    (route.ts:21)
      no requireSession → client.ts:62 `if (sessionToken)` is FALSE
      → NO X-LetBuyy-Internal-* headers are attached                        client.ts:62-80
  → gateway: api.use('/*', authMiddleware)                                  index.ts:750
     api.route('/employees', employeeRouter)                                index.ts:789
  → authMiddleware: no Authorization header, no internal headers
     → all three verifiers decline → 401 UNAUTHORIZED                       auth.ts:270-278
  → POST /v1/employees/auth/accept-invite (routes/employee.ts:208)  ← NEVER REACHED
```
**MISSING link: the gateway route is mounted 39 lines AFTER the global `authMiddleware`, but the flow is
pre-auth by design. `BROKEN` — G-K-09.** Same defect applies to `POST /v1/employees/auth/login`
(`routes/employee.ts:135`): an employee-login endpoint that requires an existing session. Both are chicken-and-egg.
Confidence HIGH on the static trace; `UNVERIFIED_RUNTIME` on the 401 itself.

### T4 — Any merchant read/write reaching the database (the tenancy spine)

```
merchant proxy → /v1/<resource> → authMiddleware → route handler
  → resolveCustomUser(db, auth.user)                     lib/auth-user.ts:20
  → verifySiteOwnership(db, siteId, customUser.id, …)    lib/auth-user.ts:39   ← OWNER-ONLY
       checks sites.custom_user_id / sites.user_id; site_memberships + employees IGNORED
  → [optional] assertStaffPermission(...)                middleware/staff-permission.ts:185
       → staffRbacMode(env) defaults 'dryrun' → { block:false } ALWAYS
  → getSupabaseAdmin(c)                                  lib/supabase.ts:17
       = createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))
       → SUPABASE_SERVICE_ROLE_KEY over PostgREST  ⇒ BYPASSRLS
  → .from('<table>')  → proxy asserts a scope predicate exists (value unchecked)
                      → 262-table registry, .rpc() NOT covered
  → RLS policies (*_tenant_site_guc, app_tenant_guc_*)  ← NEVER EVALUATED
  → SET LOCAL ROLE app_tenant / SET LOCAL app.site_id    ← NEVER EXECUTED (0 callers)
```
**MISSING links:** the GUC transaction (`withTenantTx`, 0 callers), `storeContext()` (never mounted → no frozen-store
gate, no plan/entitlement enforcement), staff RBAC (dryrun), and staff/membership authorization entirely.
**G-K-01, G-K-06, G-K-07, G-K-08.** `UNVERIFIED_RUNTIME`.

### T5 — Settlement ingest → canonical ledger → payout (the client-amount hole)

```
(no merchant UI consumer — reachable only by a direct authenticated call)
POST /v1/settlements/ingest       services/api-gateway/src/routes/settlements.ts:319
  → authMiddleware (merchant session OK)
  → validate('json', SettlementIngestSchema)     packages/billing-core/src/index.ts:138-152
       gross_amount_minor / platform_fee_minor / gst_minor / net_amount_minor / reserve_minor
       ALL client-supplied;  provider_mode defaults to 'sandbox'
  → assertLiveSettlementReady(env, body)         settlements.ts:58-71
       `if (input.provider_mode !== 'live') return;`   ← default path returns immediately
  → resolveTenantContextForOwnedSite(c, body.store_id)   ← ownership only
  → planSettlementLedgerPosting(body)             billing-core/src/index.ts:573-620
  → INSERT settlements (client amounts)           settlements.ts:347-366
  → postSettlementLedgerTransaction(...)          settlements.ts:378-395
       ⇒ canonical ledger_transactions + ledger_entries
  → if recon_break ≠ 0: INSERT recon_breaks       settlements.ts:403-415
  → if net > 0 && rail='pa_split':
       ensureSettlementPayoutStatement → INSERT payout_statements   settlements.ts:213
       INSERT payouts (status 'scheduled', requires_step_up true)   settlements.ts:429
       INSERT payout_items                                          settlements.ts:460
       INSERT wallet_ledger_entries                                 settlements.ts:243
```
**MISSING links:** no ops/internal role gate; no provider-side reconciliation of the claimed amounts; no
idempotency middleware (`/settlements` is not in `IDEMPOTENT_PROTECTED_PREFIXES`, though the route carries its own
`idempotency_key`); no merchant consumer; no validator coverage for the `payout_items` / `recon_breaks` writes.
**G-K-03.** `UNVERIFIED_RUNTIME`.

---

## 11. GAP LIST

Format per the brief. `[HIGH-STAKES]` = money/payments/refunds/gift cards/payouts/settlements/GST/auth/tenancy/RLS.

---
### G-K-01 — The RLS/GUC tenancy backstop is never engaged; the gateway is blanket service_role `[HIGH-STAKES]`
- **Domain:** tenancy / data access. **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (dead path proven statically).
- **Impact:** the platform's *entire* database-level multi-tenant defence is inert. A single missing or wrong
  `verifySiteOwnership` call — in any of 1,226 route definitions across 97 files using 4 different scoping idioms —
  is a cross-tenant data breach with **no second line of defence**. Migrations 139/151/153/164 built that second
  line and nothing uses it.
- **Evidence:** `database/supabase/migrations/164_d4_tenant_role_guc.sql:2-3` (the stated contract),
  `:33-75` (the catalog-driven policy loop); `services/api-gateway/src/lib/tenant-transaction.ts:15-35`
  (`SET LOCAL ROLE app_tenant`, line 29); `services/api-gateway/src/lib/tenant-context.ts:67-73`
  (`withResolvedTenantTx`); `grep -rn 'withTenantTx|withResolvedTenantTx' services/api-gateway/src/routes/` → **0**;
  `services/api-gateway/src/lib/supabase.ts:13-19` (service_role everywhere); `getSupabaseAdmin` in **114** files.
- **Expected:** every tenant-scoped read/write runs inside `withTenantTx` on a pooled connection as `app_tenant`
  with `app.site_id` set, so an unset GUC yields zero rows.
- **Root cause:** Cloudflare Workers reach Supabase over PostgREST with the service-role key. `SET LOCAL ROLE`
  requires a real session, which needs `HYPERDRIVE`/`DATABASE_URL` pooled SQL. `getPooledSql` exists
  (`packages/infrastructure/pooled-sql-adapter/index.ts:36-59`) and is used by exactly one other place
  (`routes/storefront.ts:30`). The migration path was built; the route migration was never done.
- **Blast radius:** all 259 tenant tables, all merchant and shopper data, every runtime that reaches the DB.
- **Severity:** P0. **Likelihood:** HIGH (the control is 100% inert today). **Reversibility:** reversible.
- **Dependencies:** `HYPERDRIVE`/`DATABASE_URL` provisioned; connection-pool budget; per-route migration.
- **Remediation APPROACH (no code):** (1) add a validator that fails when `withTenantTx` has zero callers, so the
  gate stops being green on a dead path; (2) pick one merchant domain (orders) and route its reads through
  `withResolvedTenantTx` behind a flag, comparing results against the service_role path; (3) expand by domain,
  highest-blast-radius first; (4) only then consider removing service_role from non-admin paths. Do **not**
  attempt a big-bang cutover.
- **Acceptance criteria:** a red-team test that sets no GUC and asserts zero rows on ≥1 tenant table through the
  real route path; a validator that fails on zero callers; documented list of routes still on service_role.
- **Required tests:** ephemeral-Postgres `SET ROLE app_tenant` isolation suite (`tests/executable/tenant-redteam-postgres.test.mjs`
  already exists and can be extended); integration test proving a route returns zero rows for a foreign `site_id`.
- **Owner:** lead engineer + security + ARB. **Confidence:** HIGH on the static finding; MEDIUM on the
  remediation sequencing.

---
### G-K-02 — Shopper checkout charges the PLATFORM Razorpay account, not the merchant's `[HIGH-STAKES]` `[IRREVERSIBLE]`
- **Domain:** payments / custody. **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
- **Impact:** LetBuyy receives shopper funds into its own PSP account and therefore becomes merchant-of-record and
  a money custodian. This is the single constitutional line ART-11 / R-7 draws (*"money-in goes to the MERCHANT'S
  OWN Razorpay"*). It is a **licensing and regulatory** exposure in India, not merely an architectural one, and
  every rupee that flows through it is irreversible.
- **Evidence:** `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:464` (gate on
  `c.env.RAZORPAY_KEY_ID/SECRET`), `:505-507` (provider constructed with platform keys), `:544-545`
  (platform `key_id` returned to the shopper's browser), `:584` (verify with platform secret).
  Same pattern: `services/api-gateway/src/lib/subscription-checkout.ts:118,133,152,208,227`;
  `services/api-gateway/src/routes/ai.ts:472-473`; `services/webhook-service/src/index.ts:243-244,478-481`.
- **Expected:** the order is created on the merchant's own Razorpay account using their stored credentials; LetBuyy
  never holds funds; payouts are PA-split instructions + statement mirrors.
- **Root cause:** the merchant-credential rail (`payment_credentials`, `requireLivePaymentCredential`) was built and
  correctly gated `[HUMAN-REQUIRED]`, but the **legacy storefront Razorpay route was never migrated onto it** and
  still short-circuits to platform env keys.
- **Blast radius:** every shopper payment on every store; settlements; payouts; GST liability; company licensing.
- **Severity:** P0. **Likelihood:** HIGH. **Reversibility:** IRREVERSIBLE per transaction.
- **Dependencies:** G-K-05 (decrypt path), merchant PSP onboarding UX, Razorpay Route/Easy-Split contract,
  legal sign-off.
- **Remediation APPROACH:** treat live shopper checkout as **blocked** until the merchant-credential rail is the
  only rail. Route `/storefront/:subdomain/payments/razorpay/*` through `requireLivePaymentCredential`, which
  already fails closed with `HUMAN_REQUIRED`. Never propose a direct money-table write. Per-merchant webhook
  secrets must be part of the same change.
- **Acceptance criteria:** no code path constructs a Razorpay provider from `c.env.RAZORPAY_KEY_SECRET` for a
  shopper order; a validator forbids it; `payment_credentials` is the only source; a per-merchant webhook secret is
  resolved per event.
- **Required tests:** contract test asserting shopper checkout 503s (`PAYMENT_SETUP_REQUIRED`) when the merchant has
  no live credential; security test that platform keys are never returned to a shopper browser.
- **Owner:** founder + payments-provider + ARB + security. **Confidence:** HIGH.

---
### G-K-03 — `POST /v1/settlements/ingest` writes client-supplied amounts into the canonical ledger `[HIGH-STAKES]`
- **Domain:** money / ledger integrity. **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
- **Impact:** any authenticated store owner can post arbitrary balanced settlement amounts into the canonical
  double-entry ledger for their own site, create `merchant_payable` credits, and queue payouts. R-5 declares the
  ledger the single money truth; this route lets an untrusted party author it.
- **Evidence:** `services/api-gateway/src/routes/settlements.ts:319` (route), `:58-71`
  (`assertLiveSettlementReady` returns immediately when `provider_mode !== 'live'`), `:328-329`
  (`resolveTenantContextForOwnedSite` — ownership only), `:347-366` (INSERT with client amounts),
  `:378-395` (canonical ledger posting), `:403-415` (`recon_breaks`), `:429-470` (`payouts` + `payout_items`),
  `:213,243` (`payout_statements`, `wallet_ledger_entries`);
  `packages/billing-core/src/index.ts:138-152` (schema: 5 client money fields, `provider_mode` default `'sandbox'`),
  `:573-620` (`planSettlementLedgerPosting` uses them verbatim);
  `services/api-gateway/src/index.ts:778` (mounted in the merchant-auth block, not `/internal/*`).
- **Expected:** settlement facts originate from the PA's settlement feed/report, are ingested by an internal
  reconciler, and are never client-authored.
- **Root cause:** the route was built as a reconciliation ingest but mounted on the merchant-authenticated router
  with ownership as its only authorization; the "live" guard does not cover the default `sandbox` mode.
- **Blast radius:** `ledger_transactions`, `ledger_entries`, `settlements`, `reserves`, `recon_breaks`, `payouts`,
  `payout_items`, `payout_statements`, `wallet_ledger_entries`; every reconciliation and merchant-balance figure.
- **Severity:** P0. **Likelihood:** MEDIUM (needs a deliberate direct API call; no UI reaches it).
  **Reversibility:** ledger is append-only ⇒ corrections require compensating entries, not deletes.
- **Dependencies:** none blocking.
- **Remediation APPROACH:** move the router under `/v1/internal/*` behind `internalPerimeter`, or add an
  ops-principal requirement; and make the amounts provider-derived rather than request-derived. Extend
  `canonical-ledger-only-validator.mjs` to cover `payout_items`, `reserves`, `recon_breaks`,
  `commission_reconciliation_entries`, `commission_schedules`, `merchant_billing_invoices`, `store_credit*`,
  `billing_history`, `app_billing_charges`, `gift_card_redemptions`. **Never** propose a direct money-table write
  as the fix.
- **Acceptance criteria:** a merchant session receives 401/403 on `POST /settlements/ingest`; a security test proves
  no client-supplied `*_minor` value reaches `post_settlement_ledger_transaction`.
- **Required tests:** security test (merchant token → forbidden); integration test (internal principal + provider
  feed → correct ledger); regression test that `provider_mode:'sandbox'` no longer bypasses the readiness gate.
- **Owner:** security + payments-provider + ARB. **Confidence:** HIGH.

---
### G-K-04 — No ES256/JWKS verifier is wired; live merchant auth is shared-symmetric HMAC + Supabase GoTrue `[HIGH-STAKES]`
- **Domain:** identity. **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` / `CONTRADICTORY_EVIDENCE` vs CLAUDE.md.
- **Impact:** ART-05 requires identity-platform to be the sole, asymmetric issuer and everyone else verify-only.
  Instead the gateway has **two** independent trust roots (a symmetric secret shared by 8+ runtimes, and Supabase
  GoTrue), and `internal-identity-hmac` lets any secret-holder assert an arbitrary `userId`/`email`/`storeId`.
  A leak of `INTERNAL_API_SECRET` from **any** of those runtimes is full merchant impersonation platform-wide.
- **Evidence:** `services/api-gateway/src/middleware/auth.ts:189-205` (the 3 live verifiers), `:79-114`
  (`getInternalAuthContext` — caller-asserted identity), `:158-187` (Supabase bearer);
  `services/api-gateway/src/identity-foundation/auth-verifier-registry.ts:40-45`
  (`oidc-jwks`, `activeByDefault:false`, and absent from the live array);
  `services/api-gateway/src/lib/identity-session-verifier.ts:24,57,90,95` (the real ES256/EdDSA verifier);
  its sole production caller `services/api-gateway/src/routes/auth.ts:1129` (session creation only);
  `services/api-gateway/src/lib/merchant-session.ts:60-70` (per-request auth is a DB session RPC);
  `scripts/validators/session-security-validator.mjs:60-77` (the 8 runtimes sharing `INTERNAL_API_SECRET`);
  `packages/auth-core/src/index.ts:751-769` (customer HS256, `alg:'HS256'`).
- **Expected:** per-request merchant auth verifies an ES256/EdDSA JWT against `LETBUYY_IDENTITY_PUBLIC_JWKS`;
  customer sessions likewise; symmetric secrets only for same-trust-domain service calls.
- **Root cause:** the identity foundation was scaffolded (registry, verifier, mock key service, feature flags) but
  the cutover was never performed; the legacy verifier array was left as the live code path.
- **Blast radius:** every authenticated merchant route (all 1,226 defs behind `authMiddleware`).
- **Severity:** P0. **Likelihood:** MEDIUM (requires secret compromise). **Reversibility:** reversible.
- **Dependencies:** identity-platform issuing ES256 session JWTs end-to-end; JWKS rotation plan.
- **Remediation APPROACH:** (1) add `oidc-jwks` to `legacyGatewayAuthVerifiers` behind `FEATURE_OIDC_CLIENT` and run
  it in **shadow** (`token-shadow.ts`/`shadow-compare.ts` already exist in `identity-foundation/`); (2) once parity
  holds, promote it and demote `supabase-bearer` to an explicitly enumerated legacy allow-list;
  (3) **remove `internal-identity-hmac` entirely** — it has one caller
  (`routes/app-store/extension-routes.ts:471`) which should use a scoped service token instead.
- **Acceptance criteria:** `identity-sole-issuer-validator.mjs` fails when a second issuer is active;
  an integration test proves a valid ES256 identity JWT authenticates and a forged HMAC identity assertion does not.
- **Required tests:** unit (verifier order), integration (ES256 accept / HMAC-identity reject), security
  (cross-runtime secret cannot mint an identity).
- **Owner:** security + ARB. **Confidence:** HIGH on the code reading.

---
### G-K-05 — Merchant Razorpay secret is stored but never used `[HIGH-STAKES]`
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (write path implemented; read path `NOT_IMPLEMENTED`).
- **Impact:** merchants are asked for, and the platform stores, their live PSP secret — for nothing. That is both a
  trust problem (a secret held with no purpose is pure liability) and the reason G-K-02 exists.
- **Evidence:** `services/api-gateway/src/routes/stores.ts:366-445` (write);
  `services/api-gateway/src/lib/store-payment-config.ts:32-46` (`importPaymentEncryptionKey` → `['encrypt']` only);
  `grep -rn 'key_secret_ciphertext' services/` → 3 hits, none a decrypt;
  `database/supabase/migrations/142_executable_payment_sessions.sql:7-24` (`payment_credentials`, the intended
  home) with exactly one reader `services/api-gateway/src/lib/payment-route-support.ts:98` and **zero** writers.
- **Additional defect:** a single platform-wide `PAYMENT_CONFIG_ENCRYPTION_KEY`, key = `SHA-256(env string)`, no
  per-tenant key, no KMS envelope — while `payment_credentials.kms_key_ref` defaults to
  `'sandbox-kms://letbuyy/payment-credentials'` and `services/api-gateway/src/lib/crypto.ts:155,239` already
  implements an envelope/KMS path that this flow does not use.
- **Severity:** P1. **Likelihood:** HIGH. **Reversibility:** reversible.
- **Remediation APPROACH:** either wire decryption + per-merchant provider construction (the ART-11 fix, jointly
  with G-K-02) **or** stop collecting the secret until that rail is live. Consolidate onto `payment_credentials`
  and delete the `sites.payment_settings.razorpay` authority. Move to the existing KMS envelope helper.
- **Acceptance criteria:** exactly one credential authority; a decrypt path exists and is exercised; no secret is
  collected that has no consumer.
- **Owner:** founder + payments-provider + security. **Confidence:** HIGH.

---
### G-K-06 — `storeContext()` middleware is never mounted; frozen-store and plan gates do not run `[HIGH-STAKES]`
- **Status:** `NOT_IMPLEMENTED` (dead code).
- **Impact:** a store with `trial_status='frozen'` is **not blocked**; `plan` and `entitlements` are never
  populated by the middleware; the `tenant` context it would set is absent. Billing enforcement and plan limits
  are therefore not enforced at the gateway boundary.
- **Evidence:** `services/api-gateway/src/middleware/store-context.ts:72` (definition), `:134-148` (frozen gate),
  `:150-196` (plan + `resolveTenantAccessProfile` + `c.set('tenant')`);
  `grep -rn 'storeContext' services/api-gateway/src` → only the file itself and its own usage comment at `:70`.
- **Severity:** P1. **Likelihood:** HIGH. **Reversibility:** reversible.
- **Remediation APPROACH:** decide deliberately — either mount it on `/stores/:storeId/*` (and accept the extra DB
  round-trips), or delete it and move the frozen-store + entitlement checks into the shared
  `resolveOwnedStoreScope` that 14 modules already use. Do not leave a third parallel implementation.
- **Acceptance criteria:** a frozen store receives 403 `STORE_FROZEN` on a mutating merchant route; a test proves it.
- **Owner:** lead engineer + founder (billing policy). **Confidence:** HIGH.

---
### G-K-07 — Staff RBAC is permanently in `dryrun` (log-only) `[HIGH-STAKES]`
- **Status:** `PARTIAL`.
- **Impact:** every `assertStaffPermission(...)` call — 32 across `inventory`(13), `products`(5), `orders`(5),
  `shipping-tax`(4), `coupons`(4), `smart-collections`(3), `customers`(3) — evaluates, logs, and **returns
  `{block:false}`**. Permission grants in `employees.permissions.granted` are decorative.
- **Evidence:** `services/api-gateway/src/middleware/staff-permission.ts:45-52`
  (`staffRbacMode` → *"Safe default: evaluate + log, never block, until live-verified"* → `'dryrun'`), `:135-160`
  (`block: !decision.allowed && mode === 'enforce'`), `:161-168` (catch → `{block:false}`);
  `MERCHANT_STAFF_RBAC_MODE` is read via a type cast because it is not in `Env`
  (`services/api-gateway/src/index.ts` has no such field) and appears in **no** wrangler block, **no**
  `config/env/*`, **no** workflow.
- **Severity:** P1. **Likelihood:** HIGH. **Reversibility:** reversible (flip the flag).
- **Note:** partially masked today because `verifySiteOwnership` runs first and is owner-only (G-K-08) — a
  non-owner cannot reach these handlers at all. The two findings must be fixed **together**: fixing G-K-08 without
  fixing G-K-07 grants every staff member full access.
- **Remediation APPROACH:** declare `MERCHANT_STAFF_RBAC_MODE` in `Env` and in the env templates; run `dryrun` in
  staging with the existing `staff_rbac_decision` logs to build the deny inventory; then set `enforce` in
  production **before** membership-based authorization ships.
- **Acceptance criteria:** production config sets `enforce`; an integration test proves a staff member without
  `orders:write` receives 403 on `POST /orders/:id/refund`.
- **Owner:** security + lead engineer. **Confidence:** HIGH.

---
### G-K-08 — Gateway authorization is owner-only; staff/memberships never grant access `[HIGH-STAKES]`
- **Status:** `PARTIAL`.
- **Impact:** the product ships staff invites, roles, seat limits, and a Users settings surface, but the gateway's
  authorization predicate is `sites.custom_user_id = me OR sites.user_id = me`. A staff member is not the site
  owner, so essentially every merchant route returns 403/404 for them. The `site_memberships` table and
  `resolveTenantAccessProfile`'s membership lookup are unreachable because `buildOwnedTenantContext` calls
  `verifySiteOwnership` **first** and throws.
- **Evidence:** `services/api-gateway/src/lib/auth-user.ts:39-66` (`verifySiteOwnership`, owner columns only);
  `services/api-gateway/src/lib/tenant-context.ts:183-196` (`buildOwnedTenantContext` → ownership → `ForbiddenError`
  before membership is consulted), `:92+` (`loadMembership`, only reachable after ownership passes);
  `services/api-gateway/src/lib/order-ownership.ts:3-19` (`listOwnedStoreIds` — same owner-only `.or()`).
- **Severity:** P1. **Likelihood:** HIGH. **Reversibility:** reversible.
- **Remediation APPROACH:** introduce an explicit `resolveSiteAccess(siteId, userId) → {owner|member|none} + roles`
  used by all four scoping idioms, backed by `site_memberships`/`employees`; land it **behind** G-K-07's `enforce`
  so membership immediately implies scoped permissions, never blanket access.
- **Acceptance criteria:** a staff member with `orders:read` can list orders and cannot refund; an owner is
  unaffected; a non-member gets 404.
- **Required tests:** integration matrix owner / staff-with-grant / staff-without-grant / non-member × read/write.
- **Owner:** lead engineer + security. **Confidence:** MEDIUM-HIGH (static; the trace is unambiguous but I could
  not exercise a staff login).

---
### G-K-09 — Staff invite acceptance and employee login are unreachable (behind `authMiddleware`) `[HIGH-STAKES]`
- **Status:** `BROKEN`.
- **Impact:** a merchant cannot onboard staff. The invite email lands on a flow that returns 401.
- **Evidence:** `apps/merchant-control-plane/src/app/api/employees/accept-invite/route.ts:4-6` (header comment
  declaring the flow PUBLIC/pre-auth), `:21` (`merchantApiFetch` without `requireSession`);
  `apps/merchant-control-plane/src/lib/api/client.ts:62` (`if (sessionToken)` — no cookie ⇒ no internal headers);
  `services/api-gateway/src/index.ts:750` (`api.use('/*', authMiddleware)`) vs `:789`
  (`api.route('/employees', employeeRouter)`);
  `services/api-gateway/src/routes/employee.ts:208` (`POST /auth/accept-invite`), `:135` (`POST /auth/login`).
- **Expected:** both `/employees/auth/*` routes mounted in the PUBLIC block (before line 750), rate-limited and
  Turnstile-gated like `/auth/*`.
- **Severity:** P1. **Likelihood:** HIGH. **Reversibility:** reversible.
- **Remediation APPROACH:** split an `employeeAuthRouter` (login + accept-invite) and mount it with the other public
  routers, under `authRateLimit`; keep the rest of `employeeRouter` protected. Add a route-ownership lockstep test.
- **Acceptance criteria:** an E2E invite→accept→login flow succeeds with no prior session.
- **Owner:** lead engineer. **Confidence:** HIGH.

---
### G-K-10 — Order refund routes bypass step-up `[HIGH-STAKES]` `[IRREVERSIBLE]`
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
- **Impact:** `POST /v1/orders/:id/refund` and `POST /v1/orders/:id/refund/complete` move money without the
  step-up that ART-11 requires for refunds. The merchant UI uses the protected path, so this is a **bypass**
  available to anyone with a session (or a compromised session), not the default flow.
- **Evidence:** `services/api-gateway/src/routes/orders.ts:1427-1465` (`POST /:id/refund` — idempotency +
  `assertStaffPermission('orders:write')`, **no** `verifySensitiveActionStepUp`);
  `:1342-1400` (`POST /:id/refund/complete` — same); contrast
  `services/api-gateway/src/routes/payments.ts:497-507` (step-up enforced, 428 on failure) and
  `services/api-gateway/src/routes/payouts.ts:576-585`. `grep -rn 'verifySensitiveActionStepUp' services/` returns
  exactly 3 production call sites: `security.ts:317`, `payouts.ts:576`, `payments.ts:497`.
  `services/api-gateway/src/routes/returns.ts:259` (`POST /:id/refund/complete`) also has none.
- **Severity:** P1. **Likelihood:** MEDIUM. **Reversibility:** IRREVERSIBLE (funds leave).
- **Remediation APPROACH:** apply the same step-up assertion to all refund-completing routes, or collapse them onto
  the single `payments` refund path and mark the `orders`/`returns` variants LEGACY. Add a validator that every
  route touching a refund RPC carries a step-up check.
- **Acceptance criteria:** all four refund routes return 428 without a valid step-up token; a security test enumerates
  refund-capable routes and asserts step-up coverage.
- **Owner:** security + payments. **Confidence:** HIGH.

---
### G-K-11 — Step-up tokens are replayable and not bound to the specific action instance `[HIGH-STAKES]`
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
- **Impact:** one successful step-up authorises **unlimited** `refund.approve` (or `payout.release`) calls for
  10 minutes, on any amount, for any order/payment in that site. Step-up degrades from per-action confirmation to a
  10-minute elevated-privilege window.
- **Evidence:** `services/api-gateway/src/lib/security-controls.ts:29` (`STEP_UP_WINDOW_MS = 10 * 60 * 1000`),
  `:126-156` (`signSensitiveActionStepUp` — payload binds `action, actor_id, site_id, challenge_id, jti`;
  **not** the resource id or amount), `:160-235` (`verifySensitiveActionStepUp` — checks signature, action, actor,
  site, `verified_at`, `exp`; **never reads or records `jti`**). The tables that would hold the burn record exist
  and are unused for this purpose: `database/supabase/migrations/153_executable_identity_security.sql:98`
  (`step_up_challenges`), `:120` (`sensitive_action_approvals`); the only writes to `step_up_challenges` are in
  `services/api-gateway/src/routes/security.ts:183,220,226` (challenge issue/consume, not token burn).
- **Severity:** P1. **Likelihood:** MEDIUM. **Reversibility:** IRREVERSIBLE per refund.
- **Remediation APPROACH:** bind the token payload to the resource (`payment_id`/`payout_id`) and the
  `amount_minor`, and record `jti` in `sensitive_action_approvals` with a unique constraint so verification is
  single-use. Shorten the window.
- **Acceptance criteria:** replaying a used token returns 428/409; a token issued for payment A cannot refund
  payment B; a token issued for ₹100 cannot refund ₹1000.
- **Required tests:** unit (payload binding), security (replay, cross-resource, amount escalation).
- **Owner:** security. **Confidence:** HIGH.

---
### G-K-12 — 16 live `USING (true)` policies reachable by PUBLIC/anon/authenticated; the validator is blind `[HIGH-STAKES]`
- **Status:** `CONTRADICTORY_EVIDENCE` (defect proven; reachability unproven without live introspection).
- **Impact:** if `anon`/`authenticated` hold table privileges (Supabase's platform default behaviour), these
  policies permit unrestricted access. `gift_cards` (`FOR ALL USING(true)`) is money-adjacent;
  `collections`/`collection_products`/`pages`/`store_surveys` are cross-tenant merchant content;
  `auth_password_set_intents` is an auth artefact.
- **Evidence:** full table in **§4.4** with `file:line` for all 16.
  Validator blind spots: `scripts/validators/no-public-using-true-validator.mjs:13-15` (skips `000_baseline.sql`)
  and `:25` (only matches an **explicit** `TO PUBLIC|anon|authenticated`, so a missing `TO` clause is invisible).
  The only `REVOKE`s are `163_d2_live_data_leak_rls.sql:202-216` (11 tables + allowlist),
  `165_d5_canonical_money_paths.sql` (ledger append-only), `195_contact_requests.sql` (one function) — none covers
  the 16.
- **Severity:** P1. **Likelihood:** MEDIUM (grant-dependent). **Reversibility:** reversible.
- **Remediation APPROACH:** (1) run a live `pg_policies` + `information_schema.role_table_grants` query to settle
  reachability — this is the single highest-value live check in this whole report; (2) re-issue the 16 policies with
  an explicit `TO service_role` (the pattern `103_…` and `107_…` already established); (3) fix the validator to
  treat a **missing** `TO` clause as PUBLIC and to stop excluding `000_baseline.sql` for the `USING(true)` check.
- **Acceptance criteria:** zero live policies with `USING(true)` reachable by PUBLIC/anon/authenticated; the
  validator fails on a synthetic no-`TO` `USING(true)` policy.
- **Required tests:** ephemeral-Postgres test that `SET ROLE anon` sees zero rows on each of the 16 tables.
- **Owner:** security + ARB. **Confidence:** HIGH on the policy state; **UNKNOWN** on live grants.

---
### G-K-13 — Platform session cookie spans storefront subdomains; merchant app has no CSRF defence `[HIGH-STAKES]`
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
- **Impact:** `lb_session` (`SameSite=Lax`, `Domain=.letbuyy.com`, 30-day) is transmitted to every
  `{store}.letbuyy.com` storefront. Storefront pages render merchant/marketplace-authored theme content. The
  merchant app's 130 API route handlers have no CSRF token, no Origin/Referer check, and no `middleware.ts`, and
  the gateway's CSRF middleware short-circuits for exactly these requests. A merchant-authored storefront can
  therefore issue authenticated, state-changing same-site requests against `admin.letbuyy.com` on behalf of any
  logged-in merchant or staff member who visits it.
- **Evidence:** `.github/workflows/production-deploy.yml:450` (`COOKIE_DOMAIN: .letbuyy.com`, applied to the whole
  app matrix at `:398-409`); `apps/identity-platform/src/lib/auth/cookies.ts:53,60-65` (`domain: COOKIE_DOMAIN` in
  `BASE_OPTIONS`), `:80-87` (`lb_session`, `sameSite:'lax'`);
  `services/api-gateway/src/middleware/security.ts:263` (CSRF bypass on `X-LetBuyy-Internal-Signature`);
  `grep -ril csrf apps/merchant-control-plane/src` → 0;
  `find apps/merchant-control-plane -maxdepth 2 -name middleware.ts` → none.
  Doc tension: `apps/identity-platform/src/lib/auth/cookies.ts:39-48` calls the two-realm split *"the
  tenant-isolation guarantee"* while describing only the storefront cookie's host-only property.
- **Severity:** P1. **Likelihood:** MEDIUM (requires a merchant to visit a hostile storefront while logged in;
  the theme sanitizer is a partial control). **Reversibility:** reversible.
- **Remediation APPROACH:** add an Origin/Referer allow-list check (or a double-submit CSRF token) to every
  mutating merchant `route.ts` — ideally in one shared wrapper, not 130 times. Separately, evaluate serving
  storefronts from a distinct registrable domain so `SameSite` does the work; that is a DEPLOY-R3 conversation and
  needs ARB.
- **Acceptance criteria:** a cross-subdomain POST to any merchant `/api/*` route is rejected; a validator asserts
  every mutating merchant route handler goes through the shared guard.
- **Owner:** security + ARB. **Confidence:** MEDIUM-HIGH (config + code proven; exploitation not demonstrated).

---
### G-K-14 — `commission_bps = 0` is a DEFAULT, not a constraint `[HIGH-STAKES]`
- **Status:** `PARTIAL`. **Severity:** P2. **Likelihood:** LOW. **Reversibility:** reversible.
- **Evidence:** `database/supabase/migrations/162_phase_a_commission_zero.sql:3-22` (DEFAULT + one-time UPDATE, no
  constraint change); `database/supabase/migrations/119_mobile_money_ledgers.sql:95,125`
  (`CHECK (commission_bps >= 0 AND commission_bps <= 10000 …)` — unchanged);
  `services/api-gateway/src/routes/commission.ts:196` (direct `commission_schedules` insert from TypeScript).
- **Remediation APPROACH:** a new migration adding `CHECK (commission_bps = 0)` (and the equivalent on
  `commission_amount_minor`) with a paired DOWN, so R-9 is enforced by the database rather than by convention.
- **Acceptance criteria:** an attempt to write a non-zero `commission_bps` raises at the DB layer.
- **Owner:** founder + ARB (it is a pricing promise) + lead engineer. **Confidence:** HIGH.

---
### G-K-15 — Dual money representation: `numeric(10,2)` rupees on orders/payments vs `bigint` paise in the ledger `[HIGH-STAKES]`
- **Status:** `PARTIAL`. **Severity:** P2. **Likelihood:** MEDIUM. **Reversibility:** reversible (Wave-5 cutover).
- **Evidence:** `database/supabase/migrations/000_baseline.sql:10131-10135` (`subtotal/shipping_cost/tax/discount/
  total numeric(10,2)`), `:10311` (`payment_transactions.amount numeric(10,2)`);
  `database/supabase/migrations/139_executable_foundation_ledger_core.sql:132` (`amount_minor bigint CHECK > 0`);
  the conversion `round(COALESCE(v_order.total,0)*100)::bigint` at
  `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:177`;
  `services/api-gateway/src/execution/order-execution.adapter.ts:110-112` (`majorToMinor`).
  AGENTS.md MIG-R5 explicitly defers this ("the bigint cutover is Wave 5"), so it is a **known, accepted** deviation
  from ART-10 rather than an unknown defect — recorded so the dossier states it rather than assuming compliance.
- **Remediation APPROACH:** keep it on the Wave-5 plan; in the interim, add a reconciliation assertion that
  `sum(ledger merchant_payable) == round(sum(orders.total)*100)` per site (the
  `refresh_money_ledger_site_reconciliation` RPC already exists and runs on the 6-hourly cron) so rounding drift is
  detected rather than discovered.
- **Owner:** lead engineer + CA-tax (rounding has GST consequences). **Confidence:** HIGH.

---
### G-K-16 — `webhook-service` falls back `INTERNAL_API_SECRET || AUTH_SECRET`; validator does not cover it `[HIGH-STAKES]`
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. **Severity:** P2. **Likelihood:** MEDIUM.
- **Evidence:** `services/webhook-service/src/index.ts:583-585` (`internalDispatchSecret`), consumed at `:604`
  (`POST /app-lifecycle/dispatch`) and `:694` (`POST /webhook-deliveries/dispatch`);
  `scripts/validators/session-security-validator.mjs:28,42,53,57,65,75` enumerates the files it checks —
  `services/webhook-service/**` is absent. Sibling fallbacks: `services/api-gateway/src/routes/export.ts:174`
  (3-way incl. `CUSTOMER_SESSION_SECRET`), `routes/checkout.ts:88` + `routes/storefront/cart-routes.ts:307`,
  `routes/media.ts:60`.
- **Remediation APPROACH:** remove all four cross-domain `AUTH_SECRET` fallbacks (fail closed with a clear
  `SERVER_MISCONFIGURED` instead), and extend `session-security-validator.mjs` to every runtime rather than an
  enumerated file list.
- **Acceptance criteria:** validator fails on any `AUTH_SECRET` fallback in any runtime; the dispatch endpoints
  503 when `INTERNAL_API_SECRET` is unset.
- **Owner:** security. **Confidence:** HIGH.

---
### G-K-17 — `services/lcis-api` occupies the reserved `services/` namespace, unauthenticated, undeployed
- **Status:** `DORMANT_FLAGGED`. **Severity:** P2. **Likelihood:** LOW. **Reversibility:** reversible.
- **Evidence:** full detail in **§9**. No `runtime.manifest.json`, no wrangler/vercel config, zero workflow
  references, no auth middleware (`services/lcis-api/src/middleware.ts` has request-id, security headers, rate
  limit, Zod, audit — no authentication; `src/app.ts` has no auth references), manual start only
  (`src/server.ts:10-20`). No validator mentions it.
- **Remediation APPROACH:** move to `tools/lcis-api` alongside the other LCIS tooling, or add an explicit
  Constitution carve-out plus a validator assertion that it is never a deploy target. Either way, add authentication
  before it can bind to anything other than loopback.
- **Owner:** ARB. **Confidence:** HIGH.

---
### G-K-18 — Root `AGENTS.md` contains three material stale claims
- **Status:** `CONTRADICTORY_EVIDENCE`. **Severity:** P2. **Likelihood:** HIGH (it misdirects every future agent).
- **Evidence:**
  - `AGENTS.md:156` MIG-R2 — *"numbered sequentially from the current max (161)"*, *"MUST fix the existing
    duplicate prefix (129)"*. Reality: max = **197**; **no** duplicate prefixes (`000, 073…197` contiguous).
  - `AGENTS.md:232` SEC-R6 — the six baseline PUBLIC policies are *"re-scoped … in migration `162`"*. Reality:
    `162_phase_a_commission_zero.sql` is the commission-zero migration; the re-scoping is
    `163_d2_live_data_leak_rls.sql:10-216`.
  - `AGENTS.md` PAY-R2 — `confirm_order_payment_with_ledger` *"posts ZERO ledger entries despite its name"*.
    Reality: `168_b1_b2_capture_refund_ledgering.sql:232-267` posts a balanced `pa_clearing`/`merchant_payable`
    canonical transaction (verified by opening the SQL as instructed).
  - `AGENTS.md:7` cites "the real 91 / 419" migrations/tables; real is **126 / 423**.
  - Also: the commander's brief and CLAUDE.md refer to `packages/api-client`; the package is at
    `packages/typescript/api-client`. And "107 validators" — there are **112** scripts and **115** references in
    `scripts/validate-governance.mjs`.
- **Remediation APPROACH:** a documentation-truth pass with a validator that recomputes max-migration/table/validator
  counts and fails when `AGENTS.md` disagrees, so these can never drift again.
- **Owner:** ARB. **Confidence:** HIGH.

---
### G-K-19 — Merchant "Custom data" page declares a backend gap that does not exist
- **Status:** `CONTRADICTORY_EVIDENCE`. **Severity:** P2. **Likelihood:** HIGH. **Reversibility:** reversible.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx:15,17,19`
  (*"[SKIP - NEEDS BACKEND: metafields and metaobjects API]"*, *"No `metafields`, `metaobjects`, or custom-data
  gateway route was found in current services/packages"*) versus
  `services/api-gateway/src/routes/metafields.ts:278,294,327,359,390,406,477` (7 live routes) mounted at
  `services/api-gateway/src/index.ts:799`, and a `metafields` namespace in
  `packages/typescript/api-client/src/index.ts`.
- **Remediation APPROACH:** build the proxy + UI against the existing routes, or correct the claim. Add a check that
  a `[SKIP - NEEDS BACKEND]` marker naming a resource fails when a gateway router of that name is mounted.
- **Owner:** lead engineer. **Confidence:** HIGH.

---
### G-K-20 — Unbounded list endpoints (CODE-R4) with no validator
- **Status:** `PARTIAL`. **Severity:** P2. **Likelihood:** HIGH at merchant scale. **Reversibility:** reversible.
- **Evidence:** 83 `paginated()`/`cursorPaginated()` uses across 1,226 route defs; per-module table in **§2.8** —
  `gift-cards.ts`, `shipping-tax.ts`, `categories.ts`, `commerce-analytics.ts` have **zero** pagination and zero
  `.range()`/`.limit()`. No pagination validator in `scripts/validators/` (112 scripts, none matches `pagin|list`).
  Good helpers already exist: `services/api-gateway/src/lib/supabase.ts:40-112`.
- **Remediation APPROACH:** add a validator that every `router.get` returning an array uses the pagination helper or
  is explicitly allow-listed; then retrofit the four zero-coverage modules first.
- **Owner:** lead engineer. **Confidence:** HIGH.

---
### G-K-21 — Queue batch failure retries the whole batch (poison-message amplification)
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. **Severity:** P2. **Likelihood:** MEDIUM.
- **Evidence:** `services/queue-workers/src/index.ts:562-611` — one `try` around the whole batch; the `catch` calls
  `delivery.message.retry()` for **every** message (`:610-611`). With `max_batch_size` 50 and `max_retries` 10 on
  `letbuyy-production-queue`, a single poison message re-drives 49 healthy siblings up to 10 times before all 50
  land in the DLQ.
- **Remediation APPROACH:** per-message try/catch with individual `ack()`/`retry()`, so a poison message is isolated.
- **Owner:** lead engineer. **Confidence:** HIGH.

---
### G-K-22 — Push notifications are `dry-run` with placeholder credentials in production
- **Status:** `DORMANT_FLAGGED`. **Severity:** P2 (merchant mobile app). **Likelihood:** HIGH.
- **Evidence:** `services/queue-workers/wrangler.toml` `[env.production.vars]` —
  `PUSH_DISPATCH_MODE = "dry-run"`, `FCM_PROJECT_ID/FCM_CLIENT_EMAIL/APNS_KEY_ID/APNS_TEAM_ID/APNS_BUNDLE_ID`
  all literal `SKIP_NEEDS_HUMAN_PUSH_*`. Dispatcher: `services/queue-workers/src/push-dispatcher.ts` (400 lines),
  called from `platform-queue-consumer.ts:665`.
- **Remediation APPROACH:** treat as `[HUMAN-REQUIRED]` provider onboarding; make the launch checklist assert
  `PUSH_DISPATCH_MODE != 'dry-run'` in production before any merchant-app push feature is claimed shipped.
- **Owner:** founder (provider accounts) + lead engineer. **Confidence:** HIGH.

---
### G-K-23 — Idempotency middleware does not cover `/settlements`, `/commission`, `/billing`, `/security`, `/employees`, `/themes`, `/app-store` `[HIGH-STAKES]`
- **Status:** `PARTIAL`. **Severity:** P2. **Likelihood:** MEDIUM.
- **Evidence:** `services/api-gateway/src/middleware/idempotency.ts:12-49` (`IDEMPOTENT_PROTECTED_PREFIXES`, 34
  entries). `/settlements` and `/commission` both write money tables (§4.7) and are absent. Each carries its own
  `idempotency_key` field and calls `IdempotencyExecutionAdapter` in-handler, so this is defence-in-depth loss and
  an inconsistency, not an outright duplicate-write hole.
- **Remediation APPROACH:** add the money-writing prefixes to the list; add a validator that every prefix which
  writes a money table is present.
- **Owner:** lead engineer + security. **Confidence:** HIGH.

---
### G-K-24 — GST computation failure silently produces a zero-tax order `[HIGH-STAKES]`
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. **Severity:** P2 (defer detailed ownership to Agent H).
- **Evidence:** `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:366-369` —
  `} catch { computedTaxAmount = null; }` with the comment *"GST computation is best-effort; fall through to 0 if
  it fails."* `create_checkout_order` then does `v_tax_amount := COALESCE(p_tax_amount, 0)`
  (`database/supabase/migrations/170_v1_shipping_rates_gst.sql:159`). A transient failure reading
  `products.price`/tax registration under-charges GST on a real, invoiced order.
- **Remediation APPROACH:** fail the checkout closed when the store has a GST registration and tax computation
  errors, rather than silently charging zero.
- **Owner:** CA-tax + lead engineer. **Confidence:** HIGH on the code path.

---
### G-K-25 — Service-role key reused as an IP-hash pepper
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. **Severity:** P3.
- **Evidence:** `services/api-gateway/src/routes/contact-public.ts:193` and
  `services/api-gateway/src/routes/demo-requests-public.ts:175` —
  `hashIp(ip, c.env.SUPABASE_SERVICE_ROLE_KEY ?? 'letbuyy')`.
- **Impact:** couples an IP-hash salt to the most privileged credential (rotating the DB key invalidates every
  stored `ip_hash`); widens that key's blast radius.
- **Remediation APPROACH:** introduce a dedicated `IP_HASH_PEPPER`.
- **Owner:** security. **Confidence:** HIGH.

---
### G-K-26 — Four tenant tables created after migration 164 have FORCE RLS with no policy
- **Status:** `PARTIAL`. **Severity:** P3 (latent; fail-closed today).
- **Evidence:** table in **§4.2** — `founding_merchant_allocations` (`176_…`, has a policy but no GUC),
  `subscription_coupon_redemptions` (`184_…`), `site_domains`, `site_domain_verifications` (`185_…`) — the last
  three have `ENABLE + FORCE` and **no policy at all**. Harmless while everything runs as service_role; they become
  hard zero-row failures the moment G-K-01 is fixed.
- **Remediation APPROACH:** add `*_tenant_site_guc` policies as part of the G-K-01 work; add a validator that every
  new tenant table ships ENABLE + FORCE + a GUC policy, so migration 164's catalog sweep is not the only source of
  coverage.
- **Owner:** lead engineer. **Confidence:** HIGH.

---

## 12. CONTRADICTIONS (explicitly unresolved or doc-vs-code)

1. **CLAUDE.md vs `middleware/auth.ts`** — CLAUDE.md: *"merchant ES256 (identity-platform,
   `LETBUYY_IDENTITY_PUBLIC_JWKS`)"*. Code: no ES256 verifier is in `legacyGatewayAuthVerifiers`; ES256 is verified
   once at session creation only (`routes/auth.ts:1129`), and per-request auth is HMAC + DB session or Supabase
   GoTrue. → G-K-04.
2. **`AGENTS.md` PAY-R2 vs `168_b1_b2_capture_refund_ledgering.sql`** — the doc says the RPC posts zero ledger
   entries; migration 168 makes it post a balanced canonical transaction. The doc is stale. → G-K-18.
3. **`AGENTS.md` SEC-R6 vs migration numbering** — SEC-R6 attributes the PUBLIC-policy re-scoping to migration 162;
   it is 163. → G-K-18.
4. **`AGENTS.md` MIG-R2 vs the filesystem** — "current max (161)" and "duplicate prefix (129)"; reality is max 197
   with no duplicates. → G-K-18.
5. **Merchant custom-data page vs `routes/metafields.ts`** — the UI asserts no metafields backend exists; 7 routes
   are mounted. → G-K-19.
6. **`164_d4_tenant_role_guc.sql` header vs runtime** — the migration states *"The gateway must SET LOCAL ROLE
   app_tenant"*; no gateway code ever does. → G-K-01.
7. **`cookies.ts:39-48` "tenant-isolation guarantee" vs `COOKIE_DOMAIN=.letbuyy.com`** — the comment establishes the
   storefront cookie as host-only, which is true, but the platform cookie descends into storefront subdomains and
   the comment does not address that. → G-K-13.
8. **`config/env/production.env.template:112` vs `production-deploy.yml:450`** — the template says the storefront
   runtime must leave `COOKIE_DOMAIN` unset; the workflow sets it for the entire app matrix. Mitigated because
   `apps/storefront-runtime/src/lib/session.ts` never reads it, but the config intent and the config reality
   disagree.
9. **`payment_credentials` (migration 142) vs `sites.payment_settings` (routes/stores.ts:445)** — two competing
   authorities for merchant PSP credentials; the designed one is never written. → G-K-05.
10. **Commander's brief vs the tree** — "187 .sql files, highest numbered 195" (real: 126 in `migrations/`,
    max 197); "107 validators" (real: 112 scripts / 115 references); `packages/api-client` (real:
    `packages/typescript/api-client`). Recorded so the dossier's own numbers are right.

---

## 13. UNKNOWNS (honest)

1. **Live GRANTs to `anon` / `authenticated`.** Decides whether G-K-12's 16 policies are exploitable or merely
   ugly. Requires `information_schema.role_table_grants` on the real database. **The single most valuable live
   check in this report.**
2. **Live `pg_policies` / `relforcerowsecurity`.** My coverage numbers replay migration DDL; I cannot confirm the
   deployed database matches (e.g. whether a hotfix altered anything out of band).
3. **Whether `MERCHANT_STAFF_RBAC_MODE` is set at the Cloudflare secret/var layer.** It is in no repo file; it
   could be set manually in the dashboard. If so, G-K-07 downgrades.
4. **Whether `INTERNAL_GATEWAY_IP_ALLOWLIST` is populated in production.** If empty, `internalPerimeter` returns
   503 for all `/internal/*` (`middleware/internal-perimeter.ts:83-91`) — a fail-closed outage rather than a hole,
   but it means the internal cron dispatch path may be dead. Not verifiable from the repo.
5. **Whether any merchant has ever saved payment credentials**, and therefore how much of G-K-05 is theoretical.
6. **Actual queue depth / DLQ occupancy**, so I cannot judge whether G-K-21 has already bitten.
7. **Whether `HYPERDRIVE` / `DATABASE_URL` is bound in production.** Determines whether G-K-01's remediation is a
   config change or a provisioning project. `wrangler.toml` for the gateway was not fully read in this pass.
8. **The 456 implicit-PUBLIC policies with real predicates** — I classified only the `USING(true)` subset. A full
   per-policy predicate review is a separate piece of work and could surface more.
9. **`themes.ts` per-route auth.** The router is mounted both before and after `authMiddleware`
   (`index.ts:726` and inside the protected block); 66 route defs with 0 `verifySiteOwnership` and 22
   `resolveCustomUser`. Any theme route lacking `resolveCustomUser` is effectively public. I did not enumerate all
   66 — **flagged for Agent J** as a concrete follow-up with a specific method (list every `router.<verb>` in
   `themes.ts` and check for a `resolveCustomUser`/`verifyStoreOwner` call in its body).
10. **Whether `apps/mobile/merchant-app` (Flutter) consumes gateway routes that the web merchant app does not** —
    out of my scope; it would change the "no merchant consumer" list in §2.9 for some routers
    (`/onboarding` in particular, which has a `POST /mobile-progress` route at `routes/onboarding.ts:199`).

---

## 14. BLOCKERS

1. **No live environment.** Everything is `IMPLEMENTED_NOT_RUNTIME_VERIFIED` at best. Items 1, 2, 3, 4, 6, 7 in
   §13 need a read-only production or staging session. `BLOCKED_EXTERNAL`.
2. **No database introspection.** `pg_policies`, `pg_class.relforcerowsecurity`, `role_table_grants`, and
   `pg_proc.prosecdef` would settle G-K-12 and validate §4.2 in minutes. `BLOCKED_EXTERNAL`.
3. **No provider consoles.** Cannot confirm whether the platform Razorpay account is a Route/marketplace account
   (which would soften G-K-02's custody framing) or a plain merchant account (which would harden it).
   Requires founder/payments-provider access. `BLOCKED_EXTERNAL`.
4. **Cannot run the governance gate.** `node scripts/validate-governance.mjs` would confirm my claim that it is
   green despite G-K-01/G-K-12, but running it is out of scope for a read-only discovery pass and would produce
   output I could not attribute to this commit cleanly. My validator-blind-spot claims are based on reading the
   validator source, which I quoted with line numbers.

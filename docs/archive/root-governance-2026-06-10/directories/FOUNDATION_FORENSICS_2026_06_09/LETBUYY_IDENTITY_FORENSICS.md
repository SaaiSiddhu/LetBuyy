# LetBuyy Identity & Auth Forensics — Phase D

**Date:** 2026-06-09
**Scope:** Read-only, code-grounded due-diligence ahead of a hypothetical $100M acquisition.
**Method:** Trust only code / imports / runtime wiring. Comments and docs were treated as claims to be *disproven* against code, not as evidence.
**Auditor role:** Identity Architect + Security Architect.

> Every finding below carries a `file:line` anchor and a severity. Where a comment narrates a "fix," the report states whether the code actually implements it.

---

## 0. Executive Summary

LetBuyy's identity stack is **two systems wearing one name**:

1. **The system that runs** — a Hono API gateway (`services/api-gateway`) using **Supabase as a dumb datastore accessed exclusively through the SERVICE-ROLE key**, an **opaque DB-backed `sessions` table** for merchants, **Supabase GoTrue JWTs** as a *second, parallel* merchant credential, a **Next.js BFF** (`apps/identity-platform`) that brokers login over HMAC-signed internal calls, and a genuinely-real **internal/ops RBAC** layer (allowlist + employee roles + break-glass + dual-control).
2. **The system that is narrated but does not run** — a sophisticated "identity-foundation / V2" layer (`services/api-gateway/src/identity-foundation/*` + the `*-core` contract packages) describing realms, ReBAC/ABAC permission engines, refresh-chains with reuse detection, OIDC, passkeys — **all of which is dormant, shadow, or skeleton code wired into nothing on the request path.**

The headline risk is structural, not a single bug: **685 `CREATE POLICY` RLS statements across 64 tables are defense-theater** because the authenticated data path uses the service-role key, which bypasses RLS entirely. The **only** tenant boundary that actually exists is **hand-written `verifySiteOwnership` / `store_id` scoping repeated in ~80 route files**. It is applied correctly in the routes sampled (products, orders), but it is a manual invariant with no backstop — one forgotten check is a cross-tenant IDOR with no second line of defense.

The previously-reported **unauthenticated account-takeover via `/api/auth/switch` is genuinely fixed** in the working tree. OIDC is a **501 skeleton with a mock JWKS**. MFA exists for merchants (real TOTP) but is **never enforced at login**; admin MFA is a **single shared TOTP secret**.

**Identity Score: 34 / 100. Auth-portion of Security Score: 41 / 100.** (Justification in §12.)

---

## 1. The Decisive Question — SERVICE_ROLE vs RLS

### 1.1 The verdict
**The authenticated request/data path uses the Supabase SERVICE-ROLE key, which bypasses all RLS. RLS is therefore not a security control in production. App-code scoping is the sole tenant boundary.**

### 1.2 Evidence chain

- `services/api-gateway/src/lib/supabase.ts:12-18` — `getSupabaseAdmin(c)` / `getSupabaseAdminFromEnv(env)` returns `createSupabaseServiceClient(env)`. The function's own comment: *"service role — bypasses RLS"*.
- `packages/infrastructure/supabase-adapter/index.ts:34-39` — `createSupabaseServiceClient` calls `createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken:false, persistSession:false }})`. Service-role key → PostgREST runs as `service_role` → RLS bypassed by design.
- `services/api-gateway/src/lib/supabase.ts:23-25` — an RLS-respecting client `getSupabaseUser(c, token)` (via `createSupabaseUserClient`, anon key + user Bearer) **exists**.
- **It is never called.** `getSupabaseUser(` appears exactly once in the entire repo: its own definition (grep: 1 hit, `supabase.ts:23`). By contrast `getSupabaseAdmin(`/`getSupabaseAdminFromEnv(` resolves to **579 call-sites across 80 files** (grep count). Every product, order, payout, customer, admin, and storefront data query runs as service-role.

**Severity: CRITICAL.** The 64 RLS-enabled tables / 685 policies provide *zero* runtime protection on the gateway path. Their presence is actively misleading to an acquirer's security reviewer (they imply database-enforced tenant isolation that does not exist).

### 1.3 Why it isn't (yet) an open barn door
The app-code boundary is applied consistently in the routes inspected:
- `services/api-gateway/src/lib/auth-user.ts:40-67` — `verifySiteOwnership(db, siteId, customUserId, sessionStoreId)` checks `sites.id == siteId AND (custom_user_id == user OR user_id == user)`, and short-circuits if the session's `storeId` ≠ requested site.
- `services/api-gateway/src/lib/tenant-context.ts:176-209,211-233` — `buildOwnedTenantContext` / `resolveOwnedStoreScope` call `verifySiteOwnership` before returning a tenant context; `resolveTenantContextForOrder` (235-249) resolves `store_id` *from the order* then re-verifies ownership.
- `services/api-gateway/src/routes/products.ts:981` (GET `/:id`) and the PATCH handler (`:id`, ~1019) fetch by `id` then gate on `verifyStoreOwnership(db, product.store_id, customUser.id, auth.user.storeId)`.
- `services/api-gateway/src/routes/orders.ts:970` mirrors this for order-by-id; list endpoints scope via `.in('store_id', ownedStoreIds)` (orders.ts:570, products.ts:474).

**Risk framing for the deal:** tenant isolation is *correct-by-convention*, not *correct-by-construction*. With 80 files and service-role everywhere, the probability that at least one current or future `:id` handler queries without a `store_id`/ownership filter is high, and any such handler is an immediate cross-tenant read/write (IDOR) with **no RLS backstop to catch it**. This is the single largest latent identity risk (see §11).

**Recommendation (not performed — read-only):** either (a) move the authenticated path onto `createSupabaseUserClient` + real RLS, or (b) introduce a mandatory tenant-scoped query wrapper that *fails closed* if a `store_id` predicate is absent (`assertTenantScopedQuery` exists in `tenant-context.ts:62-64` but is advisory and not enforced globally).

---

## 2. Route Authentication Topology — which routes are actually protected

Middleware is applied by **ordering** in `services/api-gateway/src/index.ts`. `authMiddleware` is registered at **line 692**. Everything `api.route(...)`-mounted **before** line 692 is *not* covered by it.

**Mounted BEFORE `authMiddleware` (index.ts:664-689) — "public" by ordering:**
`/auth`, `/contacts`, `/storefront`, `/checkout`, `/stores` (public branding), `/themes`, `/app-store`, `/app`, `/whatsapp/inbound`, `/wa/webhook`, **`/internal/console`, `/internal/billing`, `/internal/events`, `/internal/store-access`, `/internal/custom-domain-reconcile`**.

**Mounted AFTER (index.ts:692-761):** products, orders, payouts, wallet, customers, admin, kyc, 2fa, payments, operations/*, etc. — all behind `authMiddleware` → `csrfProtection` → `protectedMutationIdempotency`.

### 2.1 The `/internal/*` routers self-protect (verified)
They are not left open — each guards itself, but **per-handler or via a router-local `.use`, not via the global `authMiddleware`**:
- `internal-console.ts:173-196` — a **blanket `router.use('*')`** requires `PLATFORM_CONSOLE_API_TOKEN` (timing-safe compare, `timingSafeEqualText`); returns 503 if unconfigured, 401 if wrong. This covers all 20 handlers. The additional per-handler `hasInternalConsoleGuard` checks (e.g. lines 721, 867, 976, 1239) are defense-in-depth that *also* accept `INTERNAL_API_SECRET`.
- `internal-billing.ts:51`, `internal-events.ts:22` — `isInternalApiSecretRequest` gate.
- `internal-store-access.ts:18-27` — direct `INTERNAL_API_SECRET` (timing-safe) **or** `verifyInternalAppRequest(c,'storefront')` HMAC.
- `internal-custom-domain-reconcile.ts:21-26,113` — `requireInternal` (INTERNAL_API_SECRET).

**Severity: MEDIUM (structural fragility).** Self-guarding-per-router is correct *today* but brittle: a newly-added internal handler that forgets the guard is silently unauthenticated, because the framework provides no enforcement that internal routes are protected. The pattern relies on every author remembering. The `internal-console` blanket `.use` is the *right* pattern; the secret-based ones are not.

### 2.2 Static-token super-admin minting
- `services/api-gateway/src/middleware/auth.ts:216-231` — the `platform-console-token` verifier mints a synthetic principal `id: '00000000-0000-4000-8000-000000000000', email: 'platform-console@letbuyy.local', role: 'super_admin'` for any GET/HEAD `/v1/operations/*` request bearing the correct `PLATFORM_CONSOLE_API_TOKEN`.
- `middleware/rbac.ts:79-86,330-333,451-454,546-549` — `isPlatformConsoleTokenRequest` then **short-circuits `requirePermission`, `requireRoleCategory('ops')`, and `requireSuperAdmin`** entirely.

**Severity: HIGH.** A single shared bearer secret grants read access to the entire operations/console surface (executive analytics, merchant search, merchant overview) **with no per-operator identity, no MFA, and audit logs attributed to a fake UUID**. Leakage of `PLATFORM_CONSOLE_API_TOKEN` = full read compromise of platform-wide merchant data with no attribution. This is a coarse trust boundary inconsistent with the SoD/dual-control sophistication elsewhere in `rbac.ts`.

---

## 3. The Dormant / Shadow / Skeleton Identity Layer

The `*-core` packages (session-core, token-core, permission-core, identity-core, etc.) declare a mature model. **None of it executes on the request path.** The api-gateway "implementation" of that model is explicitly dormant:

- `identity-foundation/session-services.ts:29-75` — `createDormantSessionService`: sessions stored in an **in-process `Map`** (`const sessions = new Map(...)`). On Cloudflare Workers this Map is per-isolate and evaporates; it is *named* "Dormant." `validate()` checks `revokedAt` / `expiresAt` / `idleExpiresAt` — but only against the volatile Map.
- `identity-foundation/session-services.ts:77-95` — `createDormantRefreshTokenService`: refresh **rotation + reuse-detection** backed by an in-memory `Set`; `rotate()` returns `tokenHash: shadow:${presentedTokenHash}`. This is the *only* place `RefreshChain` / reuse-detection is "implemented," and it persists nothing.
- `identity-foundation/permission-engine.ts:17-47` — `createShadowPermissionEngine`: the ReBAC/RBAC/ABAC/`default_deny` `PermissionDecision` engine. Named "Shadow."
- `identity-foundation/oauth-skeleton.ts` — discovery docs, `planAuthorizationCode` (`codeHash: sha256:${code}` is **string concatenation, not a hash**, line 56), `tokenEnvelopeForSubject` — plain object factories, no endpoints, no signing, no JWKS.
- `identity-foundation/admin-mfa-scaffold.ts:6-18` — per-user admin TOTP "plan" that preserves `legacySharedSecretName: 'PLATFORM_CONSOLE_TOTP_SECRET'` — i.e. admin TOTP today is a **single shared secret**.
- **Wiring:** these are consumed **only** by `identity-foundation/repository-implementations.ts:70-71` (`sessionService || createDormantSessionService()`, `permissionEngine || createShadowPermissionEngine()`). Grep for the factory names across `services/` returns **only** that file plus their own definitions. No router, middleware, or handler imports the foundation runtime. `repository-boundary.ts:41-61` maps tables (`sessions_v2`, `refresh_chains`, `oauth_grants`, `authorization_codes`, `federation_tokens`, `organizations`, …) to repositories that **front the dormant layer**.

**Severity: HIGH (diligence integrity).** This is the "two parallel systems" pattern: a large, well-typed identity architecture exists in the tree and in docs, but the *running* system is the legacy custom-auth path. An acquirer reading the packages or docs would massively over-estimate maturity. The dormant layer is roadmap, not product.

---

## 4. Sessions (the real ones)

There are **two** live merchant session mechanisms (a third for storefront customers — §8).

### 4.1 Opaque DB session (the primary, BFF-driven path)
- Mint: `routes/auth.ts:1035-1078` (`POST /auth/custom/sessions/create`) — `token = randomHex(32)`, `expires_at = now + AUTH_SESSION_DURATION_MS`, inserted into `sessions` table (service-role).
- Validate: `routes/auth.ts:266-348` (`GET /auth/custom/session`) and `middleware/auth.ts:130-183` (`getInternalSessionAuthContext`) — look up token in `sessions`, reject if `expires_at < now` (and delete), update `last_active`.
- Revoke: `routes/auth.ts:1080-1106` — `destroy` (by token) and `destroy-all` (by user_id) are **real DB deletes**. Logout is real.
- BFF wrapper: `apps/identity-platform/src/lib/auth/session.ts` — `createSession`/`validateSession`/`destroySession`/`destroyAllUserSessions` all proxy to the above over HMAC-signed internal calls.

**Properties:** opaque (server-side revocable ✔), DB-persisted ✔, logout/revocation real ✔.
**Gaps:**
- **`AUTH_SESSION_DURATION_MS = 30 days`** (`packages/auth-core/src/index.ts:127`); cookie `maxAge` also 30 days (`apps/identity-platform/src/lib/auth/cookies.ts:86`). **No idle/inactivity timeout** — `last_active` is written but **never compared** to expire a stale session (grep for idle/last_active comparison: only the *dormant* `session-services.ts:62` does this; the live path does not). **Severity: MEDIUM.**
- **No refresh-token rotation / reuse-detection** on this token — it is a long-lived 30-day bearer. The `RefreshChain`/`reuseDetectedAt` design is dormant-only (§3). **Severity: MEDIUM.**

### 4.2 Supabase GoTrue JWT (parallel, duplicate)
- `routes/auth.ts:1244-1268` (`POST /auth/signin`) returns `{access_token, refresh_token, expires_at}` from `supabase.auth.signInWithPassword`. `middleware/auth.ts:185-214` (`getSupabaseBearerAuthContext`) accepts these as `Authorization: Bearer` via `supabase.auth.getUser(token)`.
- This is a **completely separate credential and user record** from the custom path: `/signin` users live in Supabase GoTrue + `user_profiles` (auth.ts:1232-1237, role `seller`), while the custom path uses `users_custom` + `password_hash`.

**Severity: HIGH (duplicate auth path).** Two parallel merchant auth systems coexist with two user tables (`users_custom` vs GoTrue/`user_profiles`), two password stores (custom bcryptjs vs GoTrue's own), two session formats (opaque vs JWT), and two logout semantics. The gateway accepts **either**. This doubles the attack surface and the "which is source of truth?" ambiguity, and means a credential reset in one system does not invalidate the other.

---

## 5. Password Handling

- **Custom/merchant path:** `services/api-gateway/src/lib/merchant-password.ts:1-12` — `bcryptjs`, **cost 12**. `verifyMerchantPassword` returns false on empty inputs.
- **Supabase path:** GoTrue manages its own hashing (bcrypt) outside the repo.
- **Strength validation:** `routes/auth.ts` uses Zod `SignUpSchema`/`PasswordUpdateSchema` (auth.ts:18-23, 1214, 1350); comments claim "8+ chars upper/lower/number/special."
- **Reset flow:** custom path uses verified-email → `password-set-intents` (create/consume, single-use, 15-min TTL — auth.ts:785-894) → `set-password` (auth.ts:896-975, re-checks `email_verified`). Supabase path uses `resetPasswordForEmail` (auth.ts:1332-1346) → `updateUser` (auth.ts:1350-1372).

**Assessment:** bcrypt cost 12 is acceptable (not argon2, but defensible). The set-password-intent design (single-use, TTL, email-verified gate, intent cookie `lb_password_set_intent` sameSite=strict — cookies.ts:115-136) is sound. **Severity: LOW.** Main note: bcrypt(js) cost-12 is CPU-heavy on Workers and is duplicated against GoTrue's hashing (two hash regimes).

---

## 6. MFA / Two-Factor

### 6.1 Merchant TOTP — real, but not enforced
- `routes/two-factor.ts` — full lifecycle: enroll (176-222), verify (224-264), disable (266-302).
- Secret generation: `lib/totp.ts:55-58` — 20 random bytes, base32. RFC-6238 `verifyTotpCode` (89-107): HMAC-SHA1, ±1 step window, **timing-safe** compare. Correct.
- Secret at rest: AES-GCM encrypted (`encryptTextAesGcm`) before storage in `merchant_2fa_factors.secret_ciphertext` (two-factor.ts:192, 200).
- Recovery codes: 8 codes, **SHA-256 hashed** with factor-id salt (two-factor.ts:144-157, 252).

**Critical gap — MFA is never required at login.** Grep: no login/session-create path reads `merchant_2fa_factors` (only `two-factor.ts` references it). `POST /auth/custom/users/authenticate` (auth.ts:411-480) verifies password + `email_verified` and returns success — **it never checks for an active TOTP factor.** So a merchant who enables 2FA still authenticates with **password only**; the second factor is decorative.
**Severity: HIGH.** 2FA that cannot gate login provides a false sense of security and zero step-up on the auth boundary.

Secondary: the TOTP **encryption key is reused from the app auth secret** — `configuredSecret(env) = AUTH_SECRET || INTERNAL_API_SECRET` (two-factor.ts:54-58). Same secret encrypts TOTP seeds, signs the `lb_accounts` JWT, and signs internal HMAC. **Key reuse across distinct cryptographic purposes. Severity: MEDIUM.**

### 6.2 Admin/operator MFA — single shared secret
- `identity-foundation/admin-mfa-scaffold.ts:8` — `legacySharedSecretName: 'PLATFORM_CONSOLE_TOTP_SECRET'`. The per-user admin TOTP is a *dormant plan*; the live control is one shared secret for all operators.
- `realm-registry.ts:50` sets admin `mfaPolicy: 'required'` — but this registry is part of the dormant foundation (`DEFAULT_MOCK_IDENTITY_ORIGIN = 'http://identity.localhost'`, line 18) and is not enforced at runtime.

**Severity: HIGH.** No per-operator MFA identity for platform admins.

---

## 7. OAuth / OIDC — real vs skeleton

**Verdict: 501 skeleton with a mock JWKS. There is no functioning OpenID Provider.**

- `apps/identity-platform/src/app/.well-known/openid-configuration/route.ts` → `oidcSkeletonResponse('openid-configuration')`.
- `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts`:
  - `identityProviderEnabled()` gates everything on `features.identityFoundation.FEATURE_IDENTITY_PROVIDER` (18-20). If off → **404 `IDENTITY_PROVIDER_DISABLED`** (22-37).
  - If on, `openid-configuration` returns a discovery doc tagged **`mock: true`** (53-74) advertising `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `jwks_uri`.
  - `jwks` returns hardcoded **`MOCK_JWKS`** with `x:'mock-x-coordinate', y:'mock-y-coordinate'` (4-16, 76-88) — a **fake EC key**, not a usable signing key.
  - **Every other endpoint (token, authorize, userinfo) falls through to HTTP 501 `IDENTITY_PROVIDER_NOT_CONFIGURED`** (90-103).
- `apps/identity-platform/src/app/oauth2/token/route.ts` → `oidcSkeletonResponse('oauth2/token')` → **501**. `oauth2/authorize`, `jwks/route.ts` identical pattern.
- The gateway-side `identity-foundation/oauth-skeleton.ts` (discovery/token-envelope/authorization-code factories) is **never mounted** as endpoints (§3); `codeHash: sha256:${code}` (line 56) is not even a real hash.

**Net:** the advertised discovery document points to a `token`/`authorize` that return 501 and a `jwks` that is mock. `token-core`'s `device_code`/`authorization_code`/`federation_token` types are unused on any live path. **Severity: HIGH** if marketed as "OIDC-capable" — it is not. (Storefront customer **federation tokens** in `@letbuyy/auth-core` are a separate, real feature — §8 — not OIDC.)

---

## 8. Multi-Realm Separation

**Truly separated at the cookie/secret layer — this is a genuine strength.**

| Realm | Cookie | Secret | Session model | Evidence |
|---|---|---|---|---|
| **Customer/shopper** | `LETBUYY_CUSTOMER_SESSION_COOKIE` (host-only, no parent domain) | `CUSTOMER_SESSION_SECRET` | Signed JWT, store-scoped `{storeId, customerId}` | `apps/storefront-runtime/src/lib/session.ts:31-67`; gateway verify `middleware/customer-session.ts:56-68` |
| **Merchant/staff/partner** | `LETBUYY_MERCHANT_SESSION_COOKIE` (`lb_session`, parent-domain `.letbuyy.store`) | `INTERNAL_API_SECRET`/`AUTH_SECRET` | Opaque DB `sessions` token (+ parallel GoTrue JWT) | cookies.ts:31,58-67; §4 |
| **Admin/platform** | `LETBUYY_PLATFORM_SESSION_COOKIE` | — | console relies on shared `PLATFORM_CONSOLE_API_TOKEN` for the token path | realm-registry.ts:47; auth.ts:216 |

- Customer and platform realms use **different secrets** and the customer cookie is **host-only** (no `domain` attribute) — `cookies.ts:38-48` documents this as the tenant-isolation guarantee, and `storefront-runtime/src/lib/session.ts` honors it (no domain set, secure in prod). **Good.**
- **Within** the merchant realm, however, the three mechanisms (opaque session / GoTrue JWT / internal-SSO HMAC headers) are **commingled** and all accepted by one `authMiddleware` (§4, §2). The separation is *across* realms, not *within* the merchant realm.

**Severity: LOW** for the (good) cross-realm split; the intra-merchant commingling is captured as HIGH in §4.2.

Note: the platform SSO cookie is **parent-domain `.letbuyy.store`** (cookies.ts:58-59), shared across accounts/admin/apps/themes/developer/console. httpOnly mitigates theft, but an XSS in **any** one platform subapp can drive authenticated requests as the merchant to all of them (cookie auto-attached). **Severity: MEDIUM (broad SSO blast radius).**

---

## 9. Cookies & the `lb_accounts` PII Question

- All auth cookies: `httpOnly:true, secure:true, path:'/'` (`cookies.ts:62-67`).
- CSRF cookie `letbuyy_csrf` is **intentionally non-httpOnly** (`cookies.ts:144`) for the double-submit pattern — correct.
- **`lb_accounts` is SIGNED, not encrypted.** `encryptAccounts`/`decryptAccounts` (cookies.ts:176-193) use **`SignJWT(... HS256)` / `jwtVerify`** — the names are misleading. The body holds up to **10 accounts of `{email, name, avatar, lastLogin}`** (addAccount, 209-225) for **365 days**. JWT payload is base64, not encrypted, so **PII is readable to anyone who obtains the cookie value** (httpOnly limits this to non-JS theft vectors, e.g. a server log, proxy, or a future XSS that bypasses httpOnly). **Severity: MEDIUM** (PII at rest in a signed-only token, mislabeled as encrypted).
- `getSigningKey()` (cookies.ts:12-25) **refuses** `AUTH_SECRET` shorter than 16 chars in any production-like runtime (`isProductionIdentityRuntime`) — **SEC-H3 confirmed real**. In dev it uses a clearly-marked insecure literal. **Good.**

---

## 10. Mobile (Flutter) Auth

`apps/mobile/merchant-app` — 164 Dart files. **No hardcoded secrets/bypasses found** (grep for SERVICE_ROLE / INTERNAL_API_SECRET / sk_live / inline secrets: empty).

- **Flow** (`lib/services/store_auth_service.dart`): the app talks to the **BFF, not the gateway** — `GET /login` to seed CSRF cookie (377-385) → `POST /api/auth/login {email, password, turnstileToken}` (160-197) → extracts the **httpOnly `lb_session` cookie from `set-cookie`** (181, `_extractCookie` 538-543) → validates via `GET /api/auth/session` (405-430). Token stored in **`flutter_secure_storage`** (`_sessionTokenKey='lb_session'`, 459).
- **Turnstile is mandatory:** `_requireTurnstileToken` (364-375) throws if the token is missing/empty/`SKIP_NEEDS_HUMAN_`. The login screen drives a `TurnstileChallengeScreen` (Cloudflare widget, `turnstile_challenge_screen.dart`), and the token comes from `--dart-define` (`app_config.dart:36-42`).
  **This is the production login blocker:** if `turnstileToken`/`turnstileSiteKey` are not provisioned at build time, **login is impossible** on prod builds (no token → exception before any network call). **Severity: HIGH (availability/usability), not a vuln.**
- Cookie parsing via regex over `set-cookie` (446-456, 538-543) is **brittle** for multi-cookie or comma-containing `set-cookie` headers — could mis-extract the session token. **Severity: LOW.**
- `updatePassword` is intentionally disabled (310-314), forcing the BFF reset flow — fine.
- Sessions persist in OS keystore (Keychain/Keystore) — appropriate for mobile.

**Assessment:** the mobile auth client is the *cleanest* part of the stack — delegates to the BFF, no secrets, httpOnly session, secure storage, mandatory bot-check. Its weakness is operational (Turnstile provisioning) and the brittle cookie regex.

---

## 11. Findings Table

| # | Finding | Evidence (file:line) | Severity |
|---|---|---|---|
| F1 | Authenticated data path uses SERVICE_ROLE key → **685 RLS policies bypassed**; RLS is not a runtime control | `lib/supabase.ts:12-18`; `infrastructure/supabase-adapter/index.ts:34-39`; service-role client = 579 call-sites/80 files vs RLS client = 0 calls (`lib/supabase.ts:23`) | CRITICAL |
| F2 | Tenant isolation is hand-written app-code scoping with **no backstop**; any unscoped `:id` query = cross-tenant IDOR | `lib/auth-user.ts:40-67`; `lib/tenant-context.ts:176-249`; applied OK in `routes/products.ts:981`, `routes/orders.ts:970` — but unenforced globally (`tenant-context.ts:62-64` advisory only) | CRITICAL (latent) |
| F3 | Entire "identity-foundation / V2" (sessions, refresh-rotation, ReBAC engine, OIDC, passkeys) is **dormant/shadow/skeleton**, wired into nothing | `identity-foundation/session-services.ts:29-95` (in-memory Map/Set); `permission-engine.ts:17-47` ("shadow"); consumed only by `repository-implementations.ts:70-71` | HIGH |
| F4 | **Two parallel merchant auth systems** (Supabase GoTrue JWT vs custom `users_custom`+opaque session); gateway accepts either | `routes/auth.ts:1244-1268` & `middleware/auth.ts:185-214` (GoTrue) vs `routes/auth.ts:411-480,1035-1078` (custom); user tables `user_profiles` vs `users_custom` | HIGH |
| F5 | **MFA never enforced at login** — TOTP is real but `authenticate` ignores `merchant_2fa_factors` | `routes/auth.ts:411-480` (no factor check); factor table read only in `routes/two-factor.ts` | HIGH |
| F6 | **Admin/operator MFA is a single shared secret** (`PLATFORM_CONSOLE_TOTP_SECRET`); per-user admin TOTP is dormant | `identity-foundation/admin-mfa-scaffold.ts:8`; `realm-registry.ts:50` (required-but-dormant) | HIGH |
| F7 | Static `PLATFORM_CONSOLE_API_TOKEN` mints synthetic `super_admin` and short-circuits all ops authz; audit logs attributed to fake UUID | `middleware/auth.ts:216-231`; `middleware/rbac.ts:330-333,451-454,546-549` | HIGH |
| F8 | OIDC is a **501 skeleton + mock JWKS**; discovery advertises endpoints that return 501/fake keys | `apps/identity-platform/.../oidc-disabled.ts:4-16,76-103`; `oauth2/token/route.ts`; gateway `oauth-skeleton.ts:56` (`codeHash` = concat, not hash) | HIGH |
| F9 | Merchant session = **30-day absolute, no idle timeout, no rotation**; `last_active` tracked but never used to expire | `packages/auth-core/src/index.ts:127`; `cookies.ts:86`; idle logic only in dormant `session-services.ts:62` | MEDIUM |
| F10 | **Crypto key reuse**: `AUTH_SECRET`/`INTERNAL_API_SECRET` used for TOTP-seed AES-GCM, `lb_accounts` JWT signing, and internal HMAC | `routes/two-factor.ts:54-58`; `cookies.ts:12-24`; `lib/internal-auth.ts:17-24` | MEDIUM |
| F11 | `lb_accounts` cookie is **SIGNED not encrypted** (mislabeled `encrypt/decrypt`); stores 10 accounts' PII for 365 days | `apps/identity-platform/src/lib/auth/cookies.ts:176-225` | MEDIUM |
| F12 | Platform SSO cookie is **parent-domain `.letbuyy.store`** → XSS in any one platform subapp drives authenticated requests across all | `cookies.ts:58-67,81-88` | MEDIUM |
| F13 | `/internal/*` routers self-guard per-router (not via global middleware) → a future handler that forgets the guard is silently open | `internal-billing.ts:51`, `internal-events.ts:22`, `internal-store-access.ts:18-27`, `internal-custom-domain-reconcile.ts:21-26`; cf. good blanket guard `internal-console.ts:173-196` | MEDIUM |
| F14 | `requireRole` trusts JWT-carried `auth.user.role` (defaults `'seller'`) — metadata-derived; only `requireRoleCategory`/`requireSuperAdmin` use persistence | `middleware/rbac.ts:416-443` vs `449-491,544-563` | MEDIUM |
| F15 | Mobile login hard-blocked without build-time Turnstile token (`SKIP_NEEDS_HUMAN_` rejected) | `apps/mobile/merchant-app/lib/services/store_auth_service.dart:364-375`; `config/app_config.dart:36-42` | HIGH (availability) |
| F16 | Mobile `set-cookie` parsed by brittle regex → possible session-token mis-extraction with multi-cookie headers | `store_auth_service.dart:446-456,538-543` | LOW |
| F17 | Prior **unauth account-takeover via `/api/auth/switch` is FIXED** (rate-limit→CSRF→valid session→proven-account in signed httpOnly `lb_accounts`) | `apps/identity-platform/src/app/api/auth/switch/route.ts:30-104` | RESOLVED (was CRITICAL) |
| F18 | Positive: opaque DB sessions are server-side revocable; logout/destroy/destroy-all are real | `routes/auth.ts:1080-1106` | (strength) |
| F19 | Positive: real internal HMAC auth (HMAC-SHA256, timestamp freshness, timing-safe), multi-secret rotation support | `lib/internal-auth.ts:32-77`; `lib/internal-secret.ts:11-15` | (strength) |
| F20 | Positive: internal/ops RBAC genuinely real — allowlist + employee roles + break-glass (TTL/used_at) + SoD + dual-control + step-up | `middleware/rbac.ts:185-326`; `lib/security-controls.ts` (step-up); `routes/security.ts` | (strength) |

---

## 12. Scoring Justification

### Identity Score: 34 / 100
- **Authentication (run path) — partial.** Real opaque sessions + working BFF + HMAC internal trust (+). But duplicated GoTrue path (F4), no MFA enforcement (F5), shared admin MFA (F6), 30-day no-idle sessions (F9).
- **Authorization — split.** Internal/ops RBAC is genuinely good (F20); merchant authz is coarse and the console-token bypass (F7) + JWT-role trust (F14) undercut it.
- **Identity store — fragmented.** Two user tables, service-role-only access (F1), no unified principal.
- **Advanced identity (OIDC, refresh rotation, ReBAC, passkeys) — non-existent at runtime** (F3, F8). The sophisticated model is dormant.
- The score is dragged down primarily because the *advertised* maturity (V2 packages, OIDC, ReBAC) is dormant/skeleton, so capability ≠ what ships. The fixed switch-route (F17) and real ops-RBAC keep it out of the 20s.

### Auth-portion of Security Score: 41 / 100
- **Crypto hygiene — mixed.** bcrypt-12 ✔, AES-GCM TOTP ✔, timing-safe compares ✔, SEC-H3 weak-key refusal ✔ — but pervasive **key reuse** (F10) and **signed-not-encrypted PII cookie** (F11).
- **Tenant boundary — the dominant risk.** Service-role bypass (F1) + manual scoping (F2) means one mistake is a breach with no DB backstop. This single structural fact caps the auth-security score well below 60.
- **Trust boundaries — coarse in places.** Static super-admin token (F7), parent-domain SSO blast radius (F12), per-router internal guards (F13).
- **Positives** (real logout/revocation F18, real internal HMAC F19, real SoD/dual-control F20, fixed F17) lift it from the 30s into the low 40s.

> Both scores are defensible as **"a competent legacy auth path carrying a large dormant aspirational layer, with database-level tenant isolation that is theater."** The numbers should move *up* materially only when (a) the authenticated path stops using service-role / RLS becomes load-bearing, and (b) the GoTrue/custom duplication is collapsed.

---

## 13. The Single Biggest Identity Risk

**Service-role-everywhere makes the 685 RLS policies inert, so the *entire* multi-tenant boundary rests on ~80 route files each remembering to call `verifySiteOwnership`/scope by `store_id` — with no fail-closed backstop.** (F1 + F2.) The sampled routes do it correctly, but the architecture guarantees that the *first* `:id` handler that queries without an ownership predicate is an immediate, silent, cross-tenant read/write (IDOR) exposing another merchant's orders, customers, payouts, or PII. For a commerce platform handling money and customer data, a tenant boundary that is correct-by-convention rather than correct-by-construction is the finding most likely to become a breach — and the one an acquirer must price in remediation for before close.

*(End of report.)*

# IDENTITY TRUTH REPORT — LetBuyy Repository Truth Audit

- **Date:** 2026-06-10
- **Axis:** Identity Truth (auth, sessions, tokens, tenancy, service_role, OIDC, step-up)
- **Branch / HEAD:** `stepup/main` @ `c4fc3cd6` (2026-06-10 08:42 +0530)
- **Working tree:** massively dirty (998 changed paths). The D3-P4-IDENTITY work is **uncommitted** — not at HEAD, not at `main`.
- **Method:** Static read of working-tree source; `git show HEAD:` / `git show main:` for divergence; validators run read-only with plain `node`. Live providers (Cloudflare Turnstile, Supabase Auth/KMS, deployed Workers) NOT exercised — all marked UNVERIFIED.

---

## Executive Summary

The **working tree** implements a credible, modern identity topology: an asymmetric (ES256/EdDSA) **identity-issued merchant session token** minted only by `apps/identity-platform`, verified by `services/api-gateway` against an env-injected **public JWKS** before any DB session row is written, with the private signing key (`LETBUYY_IDENTITY_PRIVATE_JWK`) scoped exclusively to identity-platform in CI. The `/api/auth/switch` account-takeover hole is closed (valid-session + proven-account guards), Turnstile and rate-limiting fail **closed** in production, customer/platform/merchant cookie realms are cleanly separated, TOTP secrets are AES-GCM encrypted, and a runtime `Proxy` tenant-guard forces a tenant predicate on every registered table.

**The load-bearing caveat:** essentially the *entire* asymmetric-issuance topology, the `/switch` takeover fix, the switch rate-limit bucket, and the CI key-distribution wiring are **uncommitted working-tree changes**. At **HEAD** and at **`main`**, the deployable reality is the OLD topology:

- `/custom/sessions/create` (gateway) mints `randomHex(32)` opaque tokens — **no identity token, no JWKS verification** (HEAD line ~1098; identical at `main`).
- `/api/auth/switch` (identity) **mints a session for any `email_verified` user** with no current-session proof and no proven-account check — the unauthenticated **account-takeover** (verified at `main`, route source quoted below).
- There is **no `switch` rate-limit bucket** at HEAD.
- The asymmetric files (`identity-issued-session.ts`, `identity-session-verifier.ts`) **do not exist** in HEAD.
- The CI lines that distribute `LETBUYY_IDENTITY_PRIVATE_JWK` / `..._PUBLIC_JWKS` **do not exist** at HEAD or `main`.

So whatever is *deployed* (UNVERIFIED, but the committed history is what CI builds from) very likely still carries the takeover surface and opaque-token model. The new topology is real **in source** but **undeployed**.

Secondary truths: **OIDC is a pure 404/501 skeleton** (every `/oauth2/*` and `/.well-known/*` route returns `oidcSkeletonResponse`, `implemented: false`). **Step-up is mock-mode theater** — the challenge route mints `mock-step-up-${uuid}` and verification only checks token length ≥ 12 + a timestamp window, gated by a validator that asserts the *mock* exists. `AUTH_SECRET` symmetric HMAC still signs the PII-bearing `lb_accounts` cookie, the platform-console session, customer sessions, and multiple gateway signing helpers — the asymmetric re-key did **not** retire the shared symmetric secret. **664** `getSupabaseAdmin()` (service-role) call sites exist in the gateway; the no-blanket-service-role validator only asserts the *wrapper* is applied at one factory and bans the literal in `apps/`, not the 664 server-side uses.

---

## 1. Identity Topology (Working Tree) — diagram-as-text

```
                         apps/identity-platform  (Next.js — accounts.letbuyy.com)
                         =========================================================
  login/verify/switch ─► createSession(userId, deviceId)            [src/lib/auth/session.ts]
                           │
                           ├─► createIdentityIssuedMerchantSessionToken()   [identity-issued-session.ts]
                           │     • signs ES256 | EdDSA  (alg from private JWK)
                           │     • iss = LETBUYY_IDENTITY_ISSUER (accounts.letbuyy.com)
                           │     • aud = "letbuyy:merchant-session"
                           │     • claims: realm=merchant, token_use=merchant_session, sub=userId, jti, 30d exp
                           │     • PRIVATE key from LETBUYY_IDENTITY_PRIVATE_JWK  (prod: required, else throw)
                           │
                           └─► POST gateway /auth/custom/sessions/create  { user_id, device_id, token }
                                   (signed via INTERNAL_API_SECRET HMAC app headers, app="accounts")
                                          │
   services/api-gateway  ◄───────────────┘   [routes/auth.ts:1106]
   ====================
     • requireAccountsInternal()  → verifyInternalAppRequest(c,'accounts')  (HMAC + replay-jti)
     • if prod && !token → 503 IDENTITY_ISSUER_REQUIRED
     • validateIdentityIssuedMerchantSessionToken(env, token, userId)   [identity-session-verifier.ts]
           - header.alg must be ES256|EdDSA (rejects HS256)
           - aud/iss/sub/realm/token_use/exp/iat/jti structural checks
           - jwtVerify(token, createLocalJWKSet(LETBUYY_IDENTITY_PUBLIC_JWKS), {iss,aud,sub,algs})
     • INSERT sessions { user_id, device_id, token:<the identity JWT>, expires_at }   (service-role)
           └─ token persisted = the ES256/EdDSA JWT itself (becomes the lb_session value)

  Cookie set back at identity-platform:  lb_session = <identity JWT>   [cookies.ts setSessionCookie]

  Admin (merchant-control-plane.* )  reads lb_session, forwards to gateway:
     • createLetbuyyInternalSessionHeaders(lb_session, INTERNAL_API_SECRET)  [mcp/src/lib/api/client.ts:63]
     • gateway authMiddleware → getInternalSessionAuthContext():
           verifyInternalSessionHeaders (HMAC) → validateMerchantSessionToken (DB RPC validate_and_rotate)
           → users_custom lookup → AuthContext{authSource:'internal-sso'}
```

**Audiences / issuers (working tree):**

| Audience | Cookie | Issued by | Alg | Verified by |
|---|---|---|---|---|
| Merchant web (admin SSO) | `lb_session` | identity-platform → gateway stores it | **ES256/EdDSA** (asym) + DB row | gateway `identity-session-verifier` (JWKS) at create; later via HMAC-wrapped DB RPC |
| Shopper storefront | `lb_customer_session` | storefront-runtime (host-only) | **HS256** (`CUSTOMER_SESSION_SECRET`) | auth-core `verifyCustomerSessionToken` |
| Platform staff/console | `lb_console_session` | platform-console | **HS256** (`PLATFORM_CONSOLE_SESSION_SECRET`/`AUTH_SECRET`) | auth-core `verifyLetbuyyPlatformSessionToken` |
| Mobile (merchant app) | `lb_session` (proxied) | identity-platform (same as web) | same as web | mobile-bff forwards via HMAC to gateway |
| App-marketplace OAuth | bearer (app access token) | auth-core `createAppScopedAccessToken` | **HS256** (`*_SIGNING`/internal) | auth-core `verifyAppScopedAccessToken` |

> Only the **merchant session** is asymmetric. Shopper, console, app-tokens, customer-federation, magic-links, and the multi-account `lb_accounts` cookie are all still **HS256 over a shared/symmetric secret**. The "asymmetric sole-issuer" property is therefore partial — it covers exactly one token type.

**JWKS endpoint reality:** The HTTP JWKS endpoints (`/.well-known/jwks.json`, `/jwks`) return only the **disabled placeholder** `{kty:EC, x:'disabled-x-coordinate', ...}` (`oidc-disabled.ts:4`). The gateway does **not** fetch JWKS over HTTP — it reads `LETBUYY_IDENTITY_PUBLIC_JWKS` from env and builds a **local** JWK set (`createLocalJWKSet`). So key distribution is env/secret-store, not the published endpoint; the live JWKS URL is non-functional.

**Key material env names & scoping (CI, `.github/workflows/*` — uncommitted):**
- `LETBUYY_IDENTITY_PRIVATE_JWK` → injected **only** when `matrix.app == 'identity-platform'` (`staging-deploy.yml:238`, `production-deploy.yml:416`). Correct scoping.
- `LETBUYY_IDENTITY_PUBLIC_JWKS` → `wrangler secret put` on the **gateway** (`staging-deploy.yml:85`, `production-deploy.yml:289`).
- `LETBUYY_IDENTITY_ISSUER` literal in `services/api-gateway/wrangler.toml` (staging `accounts-staging.letbuyy.com`, prod `accounts.letbuyy.com`).

---

## 2. HEAD & `main` Divergence

| Property | Working tree | HEAD (`c4fc3cd6`) | `main` |
|---|---|---|---|
| `identity-issued-session.ts` (ES256/EdDSA mint) | **Present** | **Absent** (`exists on disk, but not in HEAD`) | Absent |
| `identity-session-verifier.ts` (JWKS verify) | **Present** | **Absent** | Absent |
| `session.ts` passes identity token to gateway | **Yes** (`token: identityIssuedToken`) | **No** (no token field) | No |
| gateway `/sessions/create` JWKS-verifies | **Yes** (`validateIdentityIssuedMerchantSessionToken`) | **No** — `token = randomHex(32)` only | No |
| `/api/auth/switch` requires valid session + proven account | **Yes** (SEC-C1 guards) | **No** (0 guard matches) | **No** — mints session for any `email_verified` user |
| `switch` rate-limit bucket | **Present** (`5/15m`) | **Absent** | Absent |
| CI distributes IDENTITY_PRIVATE_JWK / PUBLIC_JWKS | **Present** | **Absent** | Absent |
| `lb_accounts` weak-key prod guard (SEC-H3) | Present | Present (committed earlier) | Present |

**`main` `/api/auth/switch` — the still-live takeover (quoted from `git show main:`):**
```ts
// Destroy current session
const currentToken = await getSessionCookie()
if (currentToken) { await destroySession(currentToken) }
// Find the target user
const userResponse = await identityApiRequest('/auth/custom/users/by-email', { ... email ... })
const user = userPayload?.data
if (!user || !user.email_verified) {
    return NextResponse.json({ error: 'Account not found or not verified' }, { status: 404 })
}
// Create new session for target account  ◄── no proof the caller owns this account
const sessionToken = await createSession(user.id, deviceId)
await setSessionCookie(sessionToken)
```
No current-session validation, no `getAccounts()` proof, only CSRF (a JS-readable double-submit cookie). This is the **SEC-C1 account-takeover**. It is fixed **only in the uncommitted working tree**.

**Live state:** UNVERIFIED. Nothing in the repo proves what is deployed. But CI builds from committed refs, and both committed refs carry the OLD topology — so the most defensible inference is that the deployed identity plane is the insecure one until a deploy from this working tree lands.

---

## 3. Session / Cookie Census (code-quoted)

All platform cookies share `BASE_OPTIONS = { httpOnly:true, secure:true, path:'/', [domain: COOKIE_DOMAIN if set] }` (`identity-platform/src/lib/auth/cookies.ts:59`). `COOKIE_DOMAIN` is env-driven (unset ⇒ host-only).

| Cookie | Realm | Domain | HttpOnly | Secure | SameSite | maxAge | Signed/alg | Source |
|---|---|---|---|---|---|---|---|---|
| `lb_session` | merchant/platform | `COOKIE_DOMAIN` (parent ⇒ SSO) | yes | yes | `lax` | **30d** | value = ES256/EdDSA JWT (WT) / opaque hex (HEAD) | cookies.ts:78 |
| `lb_accounts` | multi-account PII list | `COOKIE_DOMAIN` | yes | yes | `lax` | **90d** | **HS256** over `AUTH_SECRET` | cookies.ts:28,174,217 |
| `lb_device` | device id | `COOKIE_DOMAIN` | yes | yes | `lax` | 90d | none | cookies.ts:154 |
| `letbuyy_csrf` | CSRF double-submit | `COOKIE_DOMAIN` | **no** (JS-readable by design) | yes | `strict` | 1h | none | cookies.ts:137 |
| `lb_password_set_intent` | pw-set flow | `COOKIE_DOMAIN` | yes | yes | `strict` | 15m | none | cookies.ts:112 |
| `lb_customer_session` | shopper | **host-only** (no domain) | yes | `NODE_ENV==='production'` only | `lax` | **7d** | **HS256** `CUSTOMER_SESSION_SECRET` | storefront-runtime/src/lib/session.ts:59 |
| `lb_console_session` | platform staff | (console app) | — | — | — | **8h** TTL | **HS256** `PLATFORM_CONSOLE_SESSION_SECRET`/`AUTH_SECRET` | platform-console/src/lib/console-session.ts |

**Notes / risks:**
- Storefront cookie `secure` is `process.env.NODE_ENV === 'production'` (storefront/session.ts:61) — narrower than the platform cookies' hard `secure:true`. On a non-`production` NODE_ENV deploy the shopper cookie could go out without Secure.
- `lb_accounts` carries email/name/avatar (PII) for up to 10 accounts, signed **HS256** with `AUTH_SECRET`. Realm separation is enforced only by the host-only vs parent-domain split (documented at cookies.ts:39).
- **Session storage:** Postgres `sessions` table (gateway `/sessions/create` INSERT, `/destroy` DELETE, `/destroy-all` DELETE by user). Local-dev fallback uses an in-memory `Map` (`localAuthSessions`). Customer/console sessions are **stateless JWTs** (no server row, no revocation list).
- **Rotation:** merchant sessions support DB-side `validate_and_rotate_merchant_session` RPC (idle 8h, rotation 10m — `merchant-session.ts:38`). Customer/console JWTs do **not** rotate.
- **Revocation:** merchant logout/destroy-all delete DB rows; but the `lb_session` value is itself a 30-day signed JWT — if any consumer trusts the JWT signature alone (the create-path JWKS check does), revocation depends on the DB row being consulted on every request. The admin path does re-validate via DB RPC (`validateMerchantSessionToken`), so revocation works there. Customer/console JWTs cannot be revoked before expiry.

---

## 4. Auth Flow Truth

- **Password login** (`identity /api/auth/login` → gateway `/custom/users/authenticate`): real. bcrypt (`bcryptjs`, `verifyMerchantPassword`), email-verified gate, **MFA enforced if enrolled** (`enforceMerchantMfaIfEnrolled` decrypts TOTP secret via AES-GCM and calls `verifyTotpCode`). Turnstile + rate-limit + CSRF in front.
- **Signup** (`/api/auth/signup`): present; dev-bypass path guarded by `canUseIdentityDevAuthBypass` (NODE_ENV=development AND `LETBUYY_ENABLE_DEV_AUTH_BYPASS==='true'`, blocked in any production-like env — `dev-auth-bypass.ts:20`).
- **OAuth Google/Apple:** **not implemented in identity-platform.** `/auth/callback` redirects to `/lookup?error=oauth_unavailable` (auth/callback/route.ts:9). Comment says "provider OAuth is owned by the gateway"; no working provider flow found on this axis.
- **Magic links / passkeys:** feature-flag gated (`FEATURE_MAGIC_LINK`, `FEATURE_PASSKEY`, default false — features.ts). Magic-link token helpers exist in auth-core (HS256). No passkey/WebAuthn implementation found.
- **Account switch (`/api/auth/switch`) — current WORKING-TREE guard (quoted):**
  ```ts
  const rl = await checkRateLimit('switch', ip)                     // SEC-H7
  if (!validateCsrf(request)) return 403
  const currentToken = await getSessionCookie()
  const currentSession = currentToken ? await validateSession(currentToken) : null
  if (!currentToken || !currentSession) return 401 ('must be signed in')   // SEC-C1 (1/2)
  const savedAccounts = await getAccounts()
  const isProvenAccount = savedAccounts.some(a => a.email... === normalizedEmail)
  if (!isProvenAccount) return 403 (redirect to /login)             // SEC-C1 (2/2)
  await destroySession(currentToken); ... createSession(target)
  ```
  This is correct and ordered (proof before any destroy/mint). **But `validateSession` round-trips the gateway** (`/auth/custom/session`), which trusts the DB session row — sound.
- **Switch guard test** (`__tests__/auth-switch-guard.test.ts`, **untracked**): asserts only the *source text ordering* (`indexOf` checks) + rate-limit bucket regex. It is **not a behavioral test** — it cannot catch a logic regression that preserves the string layout. The file itself documents that the real route-contract test "belongs in the route integration suite" and is not present. (Test could not be executed in this sandbox: `tsx`/esbuild platform mismatch — darwin binary in a linux node_modules. The pure-`node` governance gate confirms the same guards: exit 0.)
- **Turnstile fail behavior:** **fail-closed.** Missing `TURNSTILE_SECRET_KEY` ⇒ `return false` (`turnstile.ts:13`); `dev-bypass-token` only honored when `canUseIdentityDevAuthBypass`. Gateway/mobile-bff equivalents also fail closed and env-gate the bypass (`security.ts:222` → `isLocalTurnstileRuntime`, mobile-bff returns `unavailable` when unconfigured).
- **Rate-limit fail behavior:** **fail-closed in production** — on gateway error/unavailable it returns `{allowed:false, retryAfter:60}` unless `NODE_ENV==='development'` (rate-limit.ts:106-110). Dev with no Redis ⇒ allow-all.
- **CSRF:** double-submit; cookie is `SameSite=strict`, JS-readable (`httpOnly:false`) by design; `validateCsrf` requires cookie===header, len≥16 (csrf.ts).

---

## 5. Tenancy Enforcement Truth

- **Tenant scope source:** request → `auth` context (HMAC internal-SSO or Supabase bearer) → `resolveOwnedStoreScope(c, siteId)` → `verifySiteOwnership(db, siteId, customUser.id, authUser.storeId)` (tenant-context.ts:192). `siteId` comes from the **route/body/param**, then ownership is checked against `site_memberships`/site ownership. Tenancy is **not** taken from a forgeable header or subdomain on these paths — it is verified against DB membership.
- **GUC path:** `withTenantTx` (tenant-transaction.ts) runs `SET LOCAL ROLE app_tenant` + `tenantGucSetLocalStatement(siteId)` (`app.site_id`) + `app.request_id` inside a **pooled SQL** transaction, and **throws `TenantTransactionUnavailableError`** if no pooled connection (explicitly refuses to fake `SET LOCAL` over Supabase REST). This is real RLS-GUC enforcement — *when used*.
- **Runtime tenant guard:** `getSupabaseAdmin` returns `createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))` (supabase.ts:14). The guard is a `Proxy` (tenant-scoped.ts) that, for any table in `tenant-tables.registry`, **rejects execution** (`.then` ⇒ rejected promise) unless an `eq/in/filter/match/or/insert/upsert` carrying a scope column ran first. Tables **not** in the registry pass through unguarded.
- **Forgeability / gaps:**
  - The guard is **pattern-based**, not RLS. A registered table accessed via the **raw REST helpers** in the supabase-adapter (`selectSupabaseRows`/`patchSupabaseRows`/`supabaseServiceHeaders`, index.ts:65-150) **bypasses the Proxy entirely** — these use `fetch` with the service-role key directly. Any caller using those helpers gets unguarded service-role access.
  - `createPublicStorefrontTenantContext` builds a tenant context with `userId:null` and roles `['storefront_customer']` from a `siteId` with **no ownership check** (tenant-context.ts:260) — correct for public storefront reads, but it grants `checkout:create` permission scoped only by `siteId`.
- **Queue tenant envelope signing** (queue-tenant-envelope.ts): HMAC-SHA256 over `siteId.messageId.idempotencyKey.issuedAt` using `QUEUE_TENANT_ENVELOPE_SECRET` (falls back to `INTERNAL_API_SECRET`). **Fails open:** if `!body.siteId` it returns the body **unsigned** (line 38), and if the secret is a placeholder it returns **unsigned** (line 39-40). So envelope integrity is best-effort, not enforced at sign time; consumer-side verification not audited on this axis.

---

## 6. service_role / anon Exposure Census

- **`createSupabaseServiceClient(` call sites (non-test): 6 files** — `packages/infrastructure/supabase-adapter/index.ts` (factory, allowed), `services/api-gateway/src/lib/supabase.ts` (the wrapped factory), and direct uses in `api-gateway/src/middleware/auth.ts`, `routes/auth.ts`, `routes/employee.ts`, plus `services/queue-workers/{inventory-reservations,platform-queue-consumer}.ts`. The middleware/auth and routes/auth direct calls construct a **raw** service client (`createSupabaseServiceClient`, not the guarded `getSupabaseAdmin`) — i.e. **unguarded** service-role for the auth verification/session paths.
- **`getSupabaseAdmin()` (guarded service-role) call sites: 664** across gateway routes (operations.ts 41, customer-engagement 27, themes 24, app-store 22, internal-console 21, customers 20, …). Every one bypasses RLS at the Postgres level and relies on the Proxy guard (only for registry tables) + explicit `siteId` predicates.
- **anon client (`createSupabaseAnonClient`) sites: 9** (middleware/auth.ts, routes/auth.ts, routes/employee.ts). Used for `supabase.auth.getUser(token)` (Supabase-bearer verification) — legitimate.
- **What `no-blanket-service-role-validator.mjs` actually asserts:** (a) `supabase.ts` contains the exact string `createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))`; (b) `tenant-transaction.ts` contains `SET LOCAL ROLE app_tenant` + the refuse-fake-REST string; (c) no `service_role`/`SUPABASE_SERVICE_ROLE_KEY`/`createSupabaseServiceClient(` literal appears under `apps/`. It does **NOT** assert anything about the 664 `getSupabaseAdmin` uses, the raw-REST adapter helpers, or the direct unguarded service-client construction inside the gateway's own `services/` tree. **Validator passes (exit 0); the runtime exposure it claims to bound is much larger than what it checks.**
- **Internal route perimeter** (`internal-perimeter.ts`): in production, requires `INTERNAL_GATEWAY_IP_ALLOWLIST` configured (else 503) AND source IP in allowlist (CIDR/exact) AND an internal credential header (bearer / `X-Internal-API-Secret` / signed `X-LetBuyy-Internal-*`). Solid in principle; `hasInternalCredential` only checks header *presence*, not validity — actual signature validation happens later in the route handler (`requireAccountsInternal`/`verifyInternalAppRequest`).
- **Internal secret model:** `INTERNAL_API_SECRET` (+ `_PREVIOUS`, `LETBUYY_INTERNAL_API_SECRET`, `WORKER_INTERNAL_API_SECRET`) — a **shared symmetric HMAC** secret used for all internal app/session/identity headers with replay-jti cache (5-min window, in-memory `Map`). The replay cache is per-isolate (Workers) — not globally consistent.

---

## 7. OIDC & Step-Up Truth

**OIDC: pure skeleton (NOT implemented).**
- Every endpoint delegates to `oidcSkeletonResponse(...)`: `/oauth2/{authorize,token,userinfo,consent,callback,logout}`, `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/jwks`.
- Behavior (oidc-disabled.ts): if `FEATURE_IDENTITY_PROVIDER` is off ⇒ **404** `IDENTITY_PROVIDER_DISABLED`. If on, `openid-configuration` returns metadata with **`implemented: false`**; `jwks` returns the disabled placeholder key with `implemented:false`; everything else ⇒ **501** `IDENTITY_PROVIDER_NOT_CONFIGURED`. Quote:
  ```ts
  return NextResponse.json({ error: { code:'IDENTITY_PROVIDER_NOT_CONFIGURED',
    message:`${endpoint} is not configured.` } }, { status: 501, ... })
  ```
- The published `jwks_uri` would serve `{x:'disabled-x-coordinate', y:'disabled-y-coordinate'}` — non-functional. (The real merchant-session JWKS is env-injected into the gateway, not served here.)

**Step-up / TOTP:**
- **TOTP (2FA) is real:** secrets stored as `secret_ciphertext`, decrypted via AES-GCM (`decryptTextAesGcm`, SHA-256-derived key from `TOTP_ENCRYPTION_KEY`), verified by `verifyTotpCode`; enforced at login if a factor is active (auth.ts:140-202). `TOTP_ENCRYPTION_KEY` placeholders rejected (`configuredTotpEncryptionSecret`).
- **Sensitive-action step-up is MOCK theater:** `/security/step-up/challenges` (security.ts:123) mints `token = 'mock-step-up-' + crypto.randomUUID()`, stores `status:'verified', metadata:{mode:'mock'}` immediately — **no actual challenge**. Verification `verifySensitiveActionStepUp` (security-controls.ts:27) only checks `plausibleToken` (len ≥ 12, not a placeholder) + a parseable `verified_at` within a 10-min window. So the "step-up" guarding refund/payout/DSR-erase is satisfied by **any** ≥12-char token plus a fresh timestamp the caller can obtain from the mock endpoint.
- **What `stepup-crypto-validator.mjs` asserts:** that `security-controls.ts` exports `verifySensitiveActionStepUp`, that `security.ts` references `step_up_challenges`, and that no *weak string/timestamp* patterns appear **outside** `security-controls.ts`. It explicitly **allowlists `security-controls.ts`** (`legacyAllowedUntilD5`) — i.e. it green-lights the very mock/length-check implementation it would otherwise flag. **Validator passes; it certifies the mock.**

---

## 8. Residual Risk Register

| # | Risk | Evidence | Severity |
|---|---|---|---|
| R1 | **Account-takeover live**: committed `/api/auth/switch` mints a session for any `email_verified` user; fix is uncommitted | `git show main:.../switch/route.ts`; HEAD switch guards = 0 | **Critical (if deployed)** |
| R2 | **Asymmetric topology undeployed**: ES256/EdDSA mint + JWKS verify + switch fix + CI key wiring all working-tree-only | `identity-issued-session.ts`/`identity-session-verifier.ts` absent at HEAD & main; prod-deploy.yml JWKS lines absent at HEAD & main | **Critical (deploy gap)** |
| R3 | **Step-up is mock**: refund/payout/DSR-erase "step-up" satisfied by a self-served mock token | security.ts:128; security-controls.ts:20-83 | **High** |
| R4 | **Shared symmetric `AUTH_SECRET` still doing auth**: signs `lb_accounts` (PII, 90d), console session, customer session, media/checkout/export signing | cookies.ts:13,174; console-session.ts:24; media.ts:60; checkout.ts:88; export.ts:174; cart-routes.ts:307 | **High** |
| R5 | **Raw-REST service-role bypass** of the tenant Proxy guard | supabase-adapter index.ts:65-150 (`supabaseServiceHeaders` + fetch) | **High** |
| R6 | **Unguarded direct service client** in gateway auth path | middleware/auth.ts & routes/auth.ts call `createSupabaseServiceClient` directly (not `getSupabaseAdmin`) | Medium-High |
| R7 | **Validator theater**: no-blanket-service-role checks 1 wrapper + bans literal in apps/, ignores 664 admin uses; stepup-crypto allowlists the mock; sole-issuer allowlists auth-core HS256 | the three validators (exit 0) vs §6/§7 reality | Medium-High |
| R8 | **Switch guard test is text-matching only**, not behavioral; the route-contract test is documented-but-absent | auth-switch-guard.test.ts:41-67 | Medium |
| R9 | **Queue tenant envelope fails open** (unsigned when no siteId or placeholder secret) | queue-tenant-envelope.ts:38-40 | Medium |
| R10 | **Stateless customer/console JWTs cannot be revoked** before expiry (7d/8h) | storefront/session.ts; console-session.ts | Medium |
| R11 | **Storefront cookie `secure` gated on NODE_ENV==='production'** only (not APP_ENV/VERCEL_ENV) — weaker than platform cookies | storefront/session.ts:61 | Low-Medium |
| R12 | **JS-readable CSRF + parent-domain `lb_session`**: SSO across all platform apps means a single XSS on any platform app can read CSRF and ride the shared cookie | cookies.ts:39-64,137 | Low-Medium |
| R13 | **Internal replay-jti cache is per-isolate** in-memory `Map` (Workers) — replay protection not globally consistent | internal-auth.ts:45; security model assumes single isolate | Low-Medium |
| R14 | **Identity issuer/JWKS default fallbacks** to `https://accounts.letbuyy.com` if env unset — a misconfigured gateway could verify against a default issuer string | identity-session-verifier.ts:5,20 | Low |

---

## 9. Unknowns / UNVERIFIED

- **Live/deployed identity topology** — cannot be determined from the repo. CI builds from committed refs (old topology); working-tree fix is undeployed. Whether a hotfix already shipped out-of-band is UNKNOWN.
- **Cloudflare Turnstile** real verdicts (siteverify) — not called; only fail-open/closed *paths* read.
- **Supabase Auth** (`supabase.auth.getUser`) and **Supabase RLS policy contents** — the SQL RLS policies behind `app_tenant`/`app.site_id` were not read on this axis; GUC plumbing is real but policy correctness is UNVERIFIED.
- **KMS provider** (`resolveKmsProviderFromEnv`, `encryptFieldWithKms`) live behavior — mock-fail-closed path confirmed (`Mock KMS is not permitted in production`), real provider not exercised.
- **`validate_and_rotate_merchant_session` RPC** body (Postgres function) — referenced but its SQL not audited here.
- **Whether any production secret values are weak/placeholder** — secret *values* live in the secret store, not the repo; only env *names* and placeholder-rejection logic were verified.
- **`tsx` test execution** of the auth-switch-guard suite — blocked by an esbuild platform mismatch in this sandbox (darwin binaries under linux); logic verified by reading + the `node`-based governance gate, but the TAP run itself is UNVERIFIED here.
- **mobile-bff / shopper-app / operator-app** — mobile-bff is a thin HMAC-forwarding proxy (verified); the reserved shopper/operator mobile apps are not implemented.

---

### Validator run log (read-only, this audit)
```
identity-security-gate.mjs            → exit 0 (SEC-C1/C2/C3/H3 guards present)
identity-sole-issuer-validator.mjs    → exit 0 (allowlists auth-core HS256 + mock-key-service)
stepup-crypto-validator.mjs           → exit 0 (allowlists security-controls.ts mock)
no-blanket-service-role-validator.mjs → exit 0 (asserts wrapper + apps/ literal ban only)
```

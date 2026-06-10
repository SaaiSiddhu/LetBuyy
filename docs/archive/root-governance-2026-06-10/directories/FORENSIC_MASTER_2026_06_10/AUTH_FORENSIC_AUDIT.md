# PHASE 6 — AUTHENTICATION FORENSIC AUDIT

**Repo:** `Letbuyy_Store` | **Audit date:** 2026-06-10
**Auditor:** Principal authentication / identity security audit, code-only working-tree analysis
**Scope:** `apps/identity-platform`, `apps/platform-console`, `apps/storefront-runtime`, `apps/mobile/merchant-app`, `services/api-gateway`, `services/mobile-bff`, `services/webhook-service`, `packages/auth-core`, `packages/identity-core`/`session-core`/`token-core` (as present), and the auth-relevant slices of `database/supabase/migrations`.
**Baseline constitution:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §3 (passwordless buyer OTP; merchant/staff login + RBAC enforcing stored `employee_permissions` scopes; OAuth2/PKCE; claims→GUC bridge; validated JWT claims drive per-transaction tenant GUC; identity-platform owns buyer OTP + merchant/staff login + OAuth2/PKCE) and §6 (layered tenant isolation depends on validated JWT claims; OIDC readiness noted).

### Methodology

1. **`/api/auth/switch` contradiction resolved with git, first.** Read the working-tree file, then `git diff HEAD`, `git log` on the file, and `git show <branch>:<file>` for `HEAD`, `main`, `develop`, `origin/main`, `origin/develop`, `stepup/main`, `stepup/wave-4-session-security`. The Phase 1 (branch-lag) vs Phase 2/3 (FIXED) contradiction is settled in §4 with the byte-level evidence.
2. **Token signing/verification census.** `grep` of `AUTH_SECRET`, `JWT_SECRET`, `SESSION_SECRET`, `SUPABASE_JWT_SECRET`, `jwtVerify`, `SignJWT`, `jose`, `jsonwebtoken`, `hmacSha256` across `apps/` + `services/` + `packages/`. Every signing call site was read to determine algorithm, key derivation, alg-pinning, and shared-secret reuse.
3. **Per-area code reads** for sessions/cookies, escalation, cross-tenant, buyer OTP, merchant/staff login + reset, mobile, OAuth2/PKCE/OIDC, and rate-limiting. Every claim cites `file:line` with quoted code.
4. **Prior-forensics hypotheses re-verified** against the current working tree and marked **FIXED / PARTIAL / OPEN / WORKING-TREE-ONLY**: IDENTITY_PLATFORM_AUDIT composite ≈30/100; `/api/auth/switch` takeover; OIDC 501 skeleton; shared `AUTH_SECRET`; JWT-role escalation; platform-console god-mode; FND-005 `super_admin_allowlist` anon-insert; RBAC scope-fineness.
5. Claims that depend on live runtime, deployed env-var values, or PostgREST table exposure (not provable from code) are explicitly marked **UNVERIFIED**.

---

## 1. Executive Verdict

**LetBuyy's authentication has been substantially hardened in the working tree, but the single most important fix in the entire identity surface — the `/api/auth/switch` account-takeover — is uncommitted, so every deployable branch is still exploitable.** This is not a nuance. `git log` proves the patched `switch/route.ts` exists only as an unstaged working-tree edit; `HEAD`, `main`, `develop`, `origin/main`, `origin/develop`, `stepup/main`, and `stepup/wave-4-session-security` all carry the vulnerable version that mints a full session for **any** `email_verified` account named in the request body, with no proof the caller owns it. Anyone who can satisfy a JS-readable CSRF token (trivial, same-origin) can take over any verified merchant or staff account on production today. Phase 1 was right about the branch lag; Phase 2/3's "FIXED" was true only for the working tree they were inspecting. **AUTH-001, S0.**

Beneath that headline, the picture is genuinely mixed-good. The token kernel in `packages/auth-core` is **HS256 throughout, with algorithm confusion designed out**: the platform/app token format is a 2-segment `payload.signature` blob with no `alg` header to confuse (`index.ts:1213`), and the one true 3-segment JWT (customer session) **pins `alg==='HS256'` on verify** (`index.ts:797`, `customer-session.ts:83`). There is no `alg:none` or RS256-confusion path. Signature comparison is timing-safe (`index.ts:1278`). Passwords are **bcrypt cost 12** (`merchant-password.ts:3`) — not weak, not plaintext. Merchant sessions are **server-side, rotating, idle-timed, and reuse-detecting** via a DB RPC (`merchant-session.ts:38–39`, statuses `revoked`/`reuse_detected`), so logout and revocation actually kill tokens (`logout/route.ts:41`). Rate-limiting is **real and fail-closed** — Upstash Redis (atomic Lua) → Cloudflare KV → in-memory only in local/dev, returning `503 RATE_LIMIT_UNAVAILABLE` in production when backends are down (`rateLimit.ts:882`). App-marketplace OAuth2 is **a real authorization-code + PKCE-S256 flow** with redirect_uri allowlisting and code↔client↔redirect binding (`app-store/shared.ts:284`, `billing-oauth-routes.ts:1319`). Turnstile and the dev-auth bypass are **production-tight** (triple-gated, `dev-auth-bypass.ts:20`). The OIDC IdP is, as prior memory recorded, a **501/404 skeleton** serving placeholder JWKS coordinates (`oidc-disabled.ts:11`).

The remaining systemic weaknesses cluster into four themes:

- **Shared-secret blast radius (AUTH-002, S1).** `AUTH_SECRET` is the *fallback* signing/verification key for at least seven independent trust domains: the identity `lb_accounts` PII cookie (`cookies.ts:13`), platform-console sessions (`console-session.ts:24`), checkout authorization (`checkout.ts:86`, `cart-routes.ts:306`), media-upload signing (`media.ts:60`), data-export auth (`export.ts:174`), internal-console auth (`internal-console.ts:439`), and webhook internal auth (`webhook-service/src/index.ts:543`). Because every token is HS256 (symmetric), *the verification key is also the forgery key*. If one `AUTH_SECRET` value is shared across these (which the fallback chains invite whenever the specific per-domain secret is unset), a single secret leak lets an attacker forge console sessions, checkout grants, and media-upload tickets — not just identity cookies.

- **The RBAC ceiling rests on one broken RLS policy (AUTH-003, S0/S1).** The operations/admin surface is correctly gated — every ops route stacks `requireRoleCategory('ops') + requireSuperAdmin` (`admin.ts:10`, `operations.ts:55`, `risk.ts:31`, `trust-safety.ts:32`), and `requireSuperAdmin` is DB-backed against `super_admin_allowlist`. But the baseline RLS policy on that table is `CREATE POLICY service_role_manage_allowlist ON public.super_admin_allowlist USING (true) WITH CHECK (true)` **with no `TO` clause** (`000_baseline.sql:26669`), which in Postgres applies to **PUBLIC (anon + authenticated)**. The sibling `idempotency_keys` policy correctly scopes `auth.role() = 'service_role'` (`000_baseline.sql:26659`); the allowlist does not. If PostgREST exposes this table to the anon/authenticated client, anyone can `INSERT` themselves as super-admin and walk straight through the otherwise-solid `requireSuperAdmin` gate. This is the FND-005 finding, confirmed live in the baseline. (Table-exposure is **UNVERIFIED** from code; the policy itself is the defect.)

- **Client-writable role still feeds the auth context (AUTH-004, S2).** `getSupabaseBearerAuthContext` falls back to `user.user_metadata?.role` when `app_metadata.role` is absent (`auth.ts:182`), and `/auth/signup` writes `role: 'seller'` into `user_metadata` (`auth.ts:1289`). `user_metadata` is mutable by the user via `supabase.auth.updateUser`. The blast radius is bounded — ops/super-admin require the DB allowlist, not the context role, and store access requires DB ownership — but `store-context.ts:160` does pass `auth.user.role` into per-store permission computation and **defaults to `['owner']`** when role is empty, so a tampered/absent role can shape the permission set within a store the user already owns.

- **A parallel legacy Supabase-auth surface bypasses the hardened path (AUTH-010/011, S2).** The public `/auth/signin`, `/auth/signup`, `/auth/signin/otp`, `/auth/password/reset` routes (`auth.ts:1281–1413`) issue raw Supabase JWT+refresh tokens with no merchant-session rotation/reuse-detection, no CSRF, and only the coarse router-level `authRateLimit` (20/5min). They coexist with the custom rotating-session machinery, giving the platform two session regimes with different security properties — the classic "two parallel systems" pattern this codebase exhibits elsewhere.

**Composite authentication verdict: ~2.7/5 — a well-built token/session kernel and genuinely strong RBAC wiring, fatally undercut by one uncommitted S0 (switch takeover) and one live S0/S1 (allowlist RLS), with a shared-secret architecture and a parallel legacy auth surface that both raise the blast radius of any single failure.**

The number is low not because the cryptography is weak — it isn't — but because the two highest-impact issues are the kind that turn a B+ identity layer into a full-account-compromise: an unauthenticated takeover that is live on every deploy branch, and a self-service path to platform super-admin.

---

## 2. Token / JWT Architecture Analysis

### 2.1 Where tokens are signed and verified

There are **four distinct token families**, all HMAC-SHA256, plus one disabled asymmetric (ES256) path:

| Token family | Format | Signed at | Verified at | Secret | alg pinned? |
|---|---|---|---|---|---|
| **Merchant session** (`lb_session`) | **Opaque DB-backed token** (not a JWT) | `auth.ts:/custom/sessions/create` → DB | `merchant-session.ts:67` RPC `validate_and_rotate_merchant_session` | n/a (server session row) | n/a (opaque) |
| **`lb_accounts` multi-account cookie** | 3-segment JWT (`jose` SignJWT) | `cookies.ts:177` `encryptAccounts` | `cookies.ts:188` `jwtVerify` | `AUTH_SECRET` (`cookies.ts:13`) | HS256 via `jose` (pins implicitly) |
| **Customer (storefront) session** | 3-segment JWT, hand-rolled | `index.ts:766` `createCustomerSessionToken` | `index.ts:797` / `customer-session.ts:83` | `CUSTOMER_SESSION_SECRET` | **YES — `header.alg !== 'HS256'` rejected** |
| **Platform-console session / magic link / app authz code / federation** | **2-segment `payload.signature`** (no JWT header) | `index.ts:1213` `signLetbuyyJsonPayload` | `index.ts:1219` `verifyLetbuyyJsonPayload` | platform: `PLATFORM_CONSOLE_SESSION_SECRET`‖`AUTH_SECRET`; internal: `INTERNAL_API_SECRET` | n/a (no alg field) |
| **Internal SSO headers** (app↔gateway) | HMAC over a canonical string + timestamp + JTI | `auth-core` `createLetbuyyInternalSessionHeaders` | `internal-auth.ts:72` | `INTERNAL_API_SECRET`‖`LETBUYY_INTERNAL_API_SECRET` | n/a (raw HMAC) |
| **OIDC IdP JWKS (ES256)** | — | **disabled** | — | placeholder | serves `disabled-x-coordinate` (`oidc-disabled.ts:11`) |

The crucial architectural fact: **the high-value tokens (platform/console/app/federation) deliberately omit a JWT header.** `signLetbuyyJsonPayload` emits `${base64url(payload)}.${base64url(hmac)}` (`index.ts:1213–1217`). On verify, `verifyLetbuyyJsonPayload` requires exactly two dot-segments (`index.ts:1238`), recomputes the HMAC over the payload segment with the configured secret, and timing-safe-compares (`index.ts:1245–1248`). There is no attacker-controlled `alg` to set to `none` or `RS256`. **Algorithm confusion is structurally impossible on this path.** (The prior "alg=none / algorithm-confusion" hypothesis is therefore **NOT EXPLOITABLE** here.)

The one real JWT (customer session) is the only place an `alg` header exists, and it is pinned: `if (header.alg !== 'HS256') return { ... 'algorithm is unsupported' }` (`index.ts:797`, mirrored at `customer-session.ts:83`). The `lb_accounts` cookie uses `jose`, which validates the signature against the supplied key and the embedded `HS256` header; `jose`'s `jwtVerify` does not honor `alg:none` unless explicitly allowed, and no `algorithms`-widening option is passed (`cookies.ts:188`).

### 2.2 HS256 means the verification key is the forgery key

Every family above is symmetric HMAC. There is **no RS256/ES256 in live use** (the only asymmetric path, the OIDC IdP, is disabled and serves placeholder coordinates). Consequence: **possession of the signing secret = ability to mint valid tokens.** This is the structural reason the shared-secret issue (§2.3) is severe rather than cosmetic. With an asymmetric design, a leaked *public* verification key would be harmless; here, the verifier and the forger hold the same bytes.

### 2.3 Shared-secret blast radius (`AUTH_SECRET`)

`grep` of `AUTH_SECRET`/`JWT_SECRET`/`SESSION_SECRET` across `apps/ services/ packages/` (node_modules/tests excluded) returns these signing/verification call sites:

```
apps/identity-platform/src/lib/auth/cookies.ts:13     value = process.env.AUTH_SECRET   → signs lb_accounts PII cookie (HS256)
apps/platform-console/src/lib/console-session.ts:24   PLATFORM_CONSOLE_SESSION_SECRET || AUTH_SECRET  → signs console sessions + magic links
services/api-gateway/src/routes/checkout.ts:86        CHECKOUT_SIGNING_SECRET || AUTH_SECRET || STORE_ACCESS_SIGNING_KEY  → checkout authorization
services/api-gateway/src/routes/storefront/cart-routes.ts:306  CHECKOUT_SIGNING_SECRET || AUTH_SECRET || STORE_ACCESS_SIGNING_KEY  → cart/checkout signing
services/api-gateway/src/routes/media.ts:60           MEDIA_UPLOAD_SIGNING_SECRET || AUTH_SECRET  → media upload tickets
services/api-gateway/src/routes/export.ts:174         INTERNAL_API_SECRET || CUSTOMER_SESSION_SECRET || AUTH_SECRET  → data export auth
services/api-gateway/src/routes/internal-console.ts:439 secret = AUTH_SECRET                → internal console auth
services/webhook-service/src/index.ts:543             INTERNAL_API_SECRET || AUTH_SECRET → webhook internal auth
```

**Finding (AUTH-002, S1).** `AUTH_SECRET` is a universal fallback across **identity, billing/checkout, media, export, internal-console, and webhooks**. The separation is *configuration-dependent*: each site uses a purpose-specific secret **if it is set**, falling back to `AUTH_SECRET` otherwise. In any environment where the per-domain secrets are not all provisioned (a common reality), one `AUTH_SECRET` signs everything. Because all of it is HS256:

- A leak of `AUTH_SECRET` lets an attacker **forge a valid `platform-console` session** (`signLetbuyyJsonPayload` with `{type:'platform_session', mfaVerified:true, exp:...}`), bypassing the console login + MFA entirely (`console-session.ts:42–55`).
- The same secret signs **checkout authorization** (`checkout.ts:86`) and **media-upload tickets** (`media.ts:60`) — money-movement and storage-write surfaces.
- The identity `lb_accounts` cookie is *also* signed with it. Note this cookie is labeled "encrypted" in the source (`cookies.ts` comments) but `SignJWT` only **signs** — the payload (emails, names, avatars of every account on the device) is **base64 plaintext readable** by anyone who obtains the cookie. (AUTH-014, S3 — information disclosure / mislabeled "encryption".)

The internal SSO secret (`INTERNAL_API_SECRET`/`LETBUYY_INTERNAL_API_SECRET`) is correctly **separate** in `auth-core` (`index.ts:461` — no `AUTH_SECRET` fallback), which is the right call given that whoever holds it can forge *any* user/store identity to the gateway (§5). But two consumers (`export.ts:174`, `webhook-service:543`) re-introduce the `AUTH_SECRET` fallback for the internal secret, partially collapsing that separation.

**Recommendation:** make every per-domain secret **mandatory** (fail-closed when unset, exactly as `getConsoleSessionSecret` already does at `console-session.ts:35–37` for production), remove all `|| AUTH_SECRET` fallbacks on money/identity-bearing paths, and migrate the platform/app token kernel to **asymmetric (ES256) signing with the already-scaffolded `keys.ts` JWKS** so that verification keys are not forgery keys.

### 2.4 Are claims validated or trusted?

- **Internal SSO identity headers** (`X-LetBuyy-Internal-User-ID/Email/Store-ID`): the `userId`/`email`/`storeId` are **bound into the signed payload** (`internalIdentitySigningPayload(userId, email, storeId, ts, jti)`, `internal-auth.ts:143–149`) and verified against `INTERNAL_API_SECRET`, with timestamp-freshness and a JTI replay cache. So a network attacker cannot tamper the claims — but the secret-holder controls them entirely (by design; this is server-to-server). `storeId` is also format-validated as a UUID (`auth.ts:91`).
- **Supabase bearer**: role is read `app_metadata?.role ?? user_metadata?.role` (`auth.ts:182`). `app_metadata` is server-controlled; `user_metadata` is **client-writable**. This is the AUTH-004 issue — claims are *partially trusted*.
- **Merchant session**: claims are not in the token at all (opaque); identity is re-resolved from the DB on every request (`auth.ts:139–143`).

The constitution's "validated JWT claims drive per-transaction tenant GUC" is **partially realized**: the *tenant* claim path (internal SSO storeId + `verifySiteOwnership`) is validated; the *role* claim path leaks a client-writable fallback.

---

## 3. Session & Cookie Register

| Cookie | Name | httpOnly | Secure | SameSite | Domain | Max-Age | Storage model | Evidence |
|---|---|---|---|---|---|---|---|---|
| Merchant session | `lb_session` | **yes** | yes | **lax** | `.letbuyy.store` (env `COOKIE_DOMAIN`) | 30d | **server DB session row** (rotating, idle-timed, reuse-detected) | `cookies.ts:83–87,58–67`; `index.ts:128`; `merchant-session.ts:38–39` |
| Multi-account list | `lb_accounts` | yes | yes | lax | `.letbuyy.store` | 365d | **signed JWT (HS256), plaintext payload** | `cookies.ts:209–225,177` |
| CSRF | `letbuyy_csrf` (legacy `lb_csrf`) | **NO (httpOnly:false)** | yes | **strict** | `.letbuyy.store` | 1h | double-submit value | `cookies.ts:140–148` |
| Device | `lb_device` | yes | yes | lax | `.letbuyy.store` | 90d | device id | `cookies.ts:157–164` |
| Password-set intent | `lb_password_set_intent` | yes | yes | **strict** | `.letbuyy.store` | 15m | intent id | `cookies.ts:115–122` |
| Platform-console session | `LETBUYY_PLATFORM_SESSION_COOKIE` | (policy) | yes | (policy) | (policy) | 8h | 2-seg signed token | `console-session.ts:13–14`; `index.ts:133` |
| Customer (storefront) session | `lb_customer_session` | yes | yes | **lax** | **HOST-ONLY (no domain)** | (TTL) | 3-seg JWT | `index.ts:826–829,849–852` |

**Observations & findings:**

- **Two-realm isolation is correctly designed (positive).** Platform cookies are parent-domain-scoped (`.letbuyy.store`) for SSO across accounts/admin/apps/themes/developer/console; storefront customer cookies are **host-only** (`hostOnly:true`, no `domain` attribute — `index.ts:826,849`). The two realms never share a cookie, which is the stated tenant-isolation guarantee (`cookies.ts:39–48`). A merchant session **cannot** be replayed as a storefront customer session and vice-versa — different cookie names, different secrets, different realms.

- **AUTH-005 (S2): CSRF is a JS-readable double-submit token whose only real defense is `SameSite=strict`.** `setCsrfCookie` sets `httpOnly:false` "Must be readable client-side for CSRF headers" (`cookies.ts:144`); `validateCsrf` compares the cookie to the `X-CSRF-Token` header (`csrf.ts:32–36`). The security model (documented at `csrf.ts:5–9`) is sound *only while* `SameSite=strict` holds and no XSS exists — any XSS on a platform subdomain reads the token and forges requests; and because the cookie is parent-domain-scoped, **an XSS on the weakest platform subdomain (e.g. developer-portal, theme-marketplace) yields a CSRF token valid against the strongest (admin, console)**. The double-submit pattern adds little over `SameSite=strict` alone here.

- **AUTH-006 (S2): parent-domain session cookie = cross-app blast radius.** `lb_session` at `.letbuyy.store` is sent to *every* platform subdomain. This is intended SSO, but it means a session-fixation or token-theft on any one platform app (including lower-trust ones like developer-portal/theme-marketplace) is immediately valid against admin and platform-console. The merchant-session rotation/reuse-detection (`merchant-session.ts`) mitigates *theft-then-replay-after-rotation*, but not *use-before-rotation* within the 10-minute window.

- **Session invalidation is real (positive).** Logout calls `destroySession(token)` server-side then clears the cookie (`logout/route.ts:41,44`); password reset calls `destroyAllUserSessions(user.id)` (`reset-password/route.ts:86`). A stolen *merchant-session* token dies on logout/reset because validation hits the DB RPC every request. **However** the raw Supabase tokens issued by the legacy `/auth/signin` path (§9) are stateless JWTs valid until expiry with refresh — `signout` calls `supabase.auth.signOut()` (`auth.ts:1393`) but a leaked access token remains valid for its ~1h lifetime regardless. Two regimes, two revocation stories.

- **TTL asymmetry (AUTH-015, S3).** `lb_accounts` lives **365 days** (`cookies.ts:223`) and `lb_device` **90 days** (`cookies.ts:162`) while the session itself is 30d cookie / 8h idle. The year-long PII-bearing accounts cookie is a long-lived information-disclosure and quick-switch-target artifact (see §4).

---

## 4. `/api/auth/switch` — DEFINITIVE VERDICT

**This is the central finding of the audit, and it is resolved with git evidence.**

### 4.1 What the endpoint does on every deployable branch (the vulnerable version)

`git show HEAD:apps/identity-platform/src/app/api/auth/switch/route.ts` (identical on `main`, `develop`, `origin/main`, `origin/develop`, `stepup/main`, `stepup/wave-4-session-security`):

```ts
export async function POST(request: NextRequest) {
    // CSRF validation
    if (!validateCsrf(request)) { return ... 403 }
    const { email } = await request.json()
    if (!email) { return ... 400 }
    const normalizedEmail = email.toLowerCase().trim()

    // Destroy current session
    const currentToken = await getSessionCookie()
    if (currentToken) { await destroySession(currentToken) }

    // Find the target user
    const userResponse = await identityApiRequest('/auth/custom/users/by-email', {
        method: 'POST', body: JSON.stringify({ email: normalizedEmail }),
    })
    ... const user = userPayload?.data
    if (!user || !user.email_verified) { return ... 404 }

    // Create new session for target account
    const { deviceId } = await getOrCreateDevice(user.id, fingerprint, userAgent)
    const sessionToken = await createSession(user.id, deviceId)   // <-- session minted for ANY verified email
    await setSessionCookie(sessionToken)
    ...
}
```

There is **no check that the caller is authenticated, no check that the caller owns the target account, and no check that the target email was ever proven on this device.** The doc-comment on this version even *claims* "The email must be in the encrypted accounts cookie" — a check the code never performs. The only gate is `validateCsrf`, which is satisfiable by any same-origin page (the CSRF cookie is JS-readable, `cookies.ts:144`). **Result: an unauthenticated attacker who loads the accounts app and posts `{email: "victim@merchant.com"}` to `/api/auth/switch` receives a valid `lb_session` for the victim, provided the victim's email is verified.** This is full account-takeover of any verified merchant/staff account.

### 4.2 What the working-tree (uncommitted) version does (the fix)

The working tree adds, in order (`switch/route.ts:30–84`): rate-limit (`checkRateLimit('switch', ip)`, line 35) → CSRF → **require a valid current session** (`validateSession(currentToken)`; 401 if absent, lines 56–63) → **require the target be present in the signed httpOnly `lb_accounts` cookie** (`getAccounts().some(a => a.email === normalizedEmail)`; 403 otherwise, lines 69–81). Only then does it switch. This is the correct interim behavior (switch only between accounts already proven on this device, while already authenticated).

### 4.3 Deploy-state proof — the contradiction, settled

```
$ git diff HEAD -- apps/identity-platform/src/app/api/auth/switch/route.ts
  → shows the ENTIRE fix as an unstaged diff (adds validateSession, getAccounts, checkRateLimit, SEC-C1 blocks)

$ git diff --cached -- apps/identity-platform/src/app/api/auth/switch/route.ts
  → EMPTY  (the fix is NOT staged)

$ git log --oneline -- apps/identity-platform/src/app/api/auth/switch/route.ts
  92022068 feat(identity): use shared api client transport
  a5b1719b refactor(apps): normalize actor runtime roots
  → neither commit is the security fix; the last committed change is a transport refactor

$ for b in main develop origin/main origin/develop stepup/main stepup/wave-4-session-security; do
    git show $b:.../switch/route.ts | grep -nE "isProvenAccount|validateSession|SEC-C1"
  done
  → NO MATCHES on any branch (all carry "// Destroy current session" / "// Find the target user")
```

**Verdict:**
- **Vulnerable on:** `HEAD`, `main`, `develop`, `origin/main`, `origin/develop`, `stepup/main`, `stepup/wave-4-session-security` — i.e. **every branch, including all remotes and the integration branch.**
- **Fixed on:** the **local working tree only**, as an **uncommitted, unstaged** edit.
- **Deployed:** **NO.** Whatever branch CI deploys, it deploys the vulnerable version. The fix would vanish on any `git stash`, `git checkout`, or clean checkout.

**Phase 1 was correct** (the fix is working-tree-only; HEAD + deploy branches are vulnerable). **Phase 2/3's "FIXED on working tree" was also literally correct but dangerously incomplete** — they inspected the working tree and saw the patched file, without checking that it had never been committed. The contradiction dissolves: *both* observed the same file in two different git states. **This must be committed and deployed before anything else in this report.** **AUTH-001, S0.**

---

## 5. Privilege-Escalation Register

Every route/sink that writes `role`, `permissions`, `is_admin`/super-admin status, or `store_id`/`site_id` ownership, and whether it is gated:

| # | Sink | What it writes | Gate | Verdict | Evidence |
|---|---|---|---|---|---|
| E-1 | `super_admin_allowlist` (INSERT via PostgREST) | super-admin membership | **RLS `USING(true) WITH CHECK(true)`, no `TO` clause → PUBLIC** | **OPEN — anon/authenticated can self-insert (FND-005)** | `000_baseline.sql:26669` |
| E-2 | `/auth/signup` | `user_metadata.role='seller'` + `user_profiles.role='seller'` | open (public signup) | role hard-coded `seller`; not directly escalatable, but seeds the user_metadata channel | `auth.ts:1289,1303` |
| E-3 | Supabase `auth.updateUser({data:{role}})` (direct to Supabase) | `user_metadata.role` | client-controlled by definition | **feeds auth-context fallback (AUTH-004)** | `auth.ts:182` reads it |
| E-4 | `/api/auth/switch` (HEAD version) | mints session for arbitrary account | CSRF only | **OPEN — account takeover (AUTH-001)** | `switch/route.ts` HEAD |
| E-5 | `/auth/password/update` | password only (`{password}`) | Bearer required | **safe** — no role/store mass-assignment | `auth.ts:1426–1432` |
| E-6 | `/custom/users/set-password` | `password_hash` only | internal `accounts` sig + (userId∧email) match + email_verified | **safe** | `auth.ts:962–1020` |
| E-7 | `store-context` permission computation | reads `auth.user.role`, **defaults `['owner']`** | per-request `verifySiteOwnership` | **PARTIAL** — role tamper shapes scopes *within an owned store* | `store-context.ts:160,95` |
| E-8 | ops/admin/risk/T&S/app-store-moderation | privileged ops actions | `requireRoleCategory('ops') + requireSuperAdmin` (DB-backed) | **strong** — but ultimately depends on E-1 | `admin.ts:10`, `operations.ts:55`, `app-store.ts:753` |
| E-9 | `internalIdentitySigningPayload` (internal SSO) | `userId/email/storeId` claims | `INTERNAL_API_SECRET` HMAC + freshness + JTI | **strong vs network**, total for secret-holder | `internal-auth.ts:128–151` |
| E-10 | platform-console impersonation | act-as-merchant session | console session + reason + read-only default + recorded/expiring | **governed** (not silent god-mode) | `merchants/[id]/page.tsx:48–86` |

**Key conclusions:**

1. **The escalation chain that matters is E-1 → E-8.** The ops RBAC is genuinely well-built (DB-backed scopes, dual-control on payouts per Phase 3), but `requireSuperAdmin` trusts the `super_admin_allowlist` table, and that table's baseline RLS is open to PUBLIC writes. A self-insert there is a single-step jump from "any authenticated user" to "platform super-admin." This is why AUTH-003 is rated S0/S1 despite the strong middleware. (Whether anon/authenticated PostgREST actually exposes the table is **UNVERIFIED** from code, but the policy is unambiguously wrong and the *only* gate.)

2. **JWT-role escalation (the prior hypothesis) is real but bounded (AUTH-004, S2), not unbounded.** Because ops/super-admin require the DB allowlist (not the context role), a `user_metadata.role` tamper cannot reach the ops surface. Its real effect is via `store-context.ts:160`'s `auth.user.role ? [auth.user.role] : ['owner']` — within a store the user already owns (DB-checked), a manipulated role array changes which `employee_permissions` scopes resolve. The `['owner']` default is itself a smell: an authenticated user with no role claim is treated as owner of their own store.

3. **No mass-assignment of `role`/`store_id`/`is_admin` on user-update routes.** The two password-write paths (E-5, E-6) write only the password. There is no generic "update profile" route in the gateway auth surface that accepts `role`/`store_id` in the body. (Good.)

---

## 6. Cross-Tenant-via-Auth Analysis

**Question: can an authenticated merchant reach another store's admin by changing a path/param?**

**Answer: No, for any route protected by `storeContext()` — membership is re-checked per request, not cached at login.** The middleware resolves the store id from `param || header || query` (`store-context.ts:74–78`) and then calls:

```ts
const customUser = await resolveCustomUser(db, auth.user);
if (!customUser || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
    return ... 404 'Store not found or access denied'
}
```
(`store-context.ts:94–107`)

`verifySiteOwnership` (`auth-user.ts:40–67`) is a real DB check: the `sites` row for `storeId` must have `custom_user_id = caller` **OR** `user_id = caller`, and if a `sessionStoreId` is present it must equal `storeId` (`auth-user.ts:46–48`). Ownership is keyed to DB ownership columns, **not** to the (tamperable) role claim. So path/param tampering (`/stores/<other-store>/...`, `X-Store-ID: <other-store>`, `?store_id=<other-store>`) yields **404**, and the check runs **on every request**.

**Caveats and residual risks:**

- **AUTH-007 (S2): the entire cross-tenant guarantee depends on every store-scoped route actually mounting `storeContext()`.** The gateway connects as **`service_role`, which bypasses Postgres RLS** (documented platform-wide; see Phase 7 DB audit §1 and `services/api-gateway` Supabase admin client usage at `store-context.ts:71`, `auth-user.ts` `db`). That means RLS is **not** a backstop — `storeContext`/`verifySiteOwnership` is the *sole* tenant gate on those paths. Any store-scoped route that forgets the middleware, or queries `getSupabaseAdmin(c)` directly with a body-supplied `store_id`, is cross-tenant-exposed. A full route-by-route census is out of scope here, but the *architecture* makes a single missing middleware a tenant breach (cross-link Phase 3 route-tenancy).

- **AUTH-008 (S3): `verifySiteOwnership` interpolates `customUserId` into a PostgREST `.or()` string** (`auth-user.ts:55`: `` `custom_user_id.eq.${customUserId},user_id.eq.${customUserId}` ``). `customUserId` originates from a DB UUID lookup (`resolveCustomUser`), not raw user input, so injection is low-risk today, but string-built PostgREST filters are fragile — if a future caller ever passes a less-sanitized id, this becomes a filter-injection. Prefer parameterized `.or` builders or explicit `.in`.

- **`auth.user.storeId`** (from internal SSO header) is bound to the signed payload, so a network attacker can't forge a cross-store `storeId`; only the internal-secret holder can.

---

## 7. Buyer / OTP Audit

The constitution mandates **passwordless buyer OTP**. Two OTP surfaces exist:

**(a) Merchant/account OTP (the custom path, `/custom/tokens/*`).**

- **Entropy/length:** `randomOtp()` = 6 digits in `[100000, 999999]` from `crypto.getRandomValues` (CSPRNG) (`auth.ts:209–213`). Space = 900,000. **AUTH-016 (S3):** `100000 + (bytes[0] % 900000)` introduces slight modulo bias and excludes `000000–099999` (no leading-zero codes), shrinking effective space marginally; cryptographically minor but imperfect.
- **Expiry:** OTP TTL = `AUTH_OTP_EXPIRY_MS` (`auth.ts:1190`); generic tokens use `AUTH_TOKEN_EXPIRY_MS[type]`. Expiry is enforced on validate (`auth.ts:1271`).
- **Single-use & invalidation:** issuing a new OTP marks prior unused ones `used` (`auth.ts:1187`); validation marks the token `used` (`auth.ts:1275`). **No reuse.** Good.
- **Brute-force / lockout (AUTH-009, S2):** the **validate endpoint itself has no per-OTP attempt counter or lockout.** `/custom/tokens/validate` (`auth.ts:1233`) simply looks up `(token,type[,email])` and checks `used`/`expires_at`. The only brake is the upstream `verify_otp` IP rate limit (5 / 15 min / IP, `rate-limit.ts:43`). Against a 6-digit code with a multi-minute expiry, an attacker rotating IPs (botnet/proxy) faces 900k/5-per-window odds but **no account-level lockout** — the code is not invalidated after N wrong guesses for that email. Tighten with a per-(email,token) failed-attempt counter that burns the OTP after ~5 misses.
- **Delivery in logs/response:** OTP is returned in the API response **only** on `local_schema_missing` dev paths flagged `devOnly:true` (`auth.ts:1222–1225`); the production path returns `{token, expires_at}` to the *internal caller* (identity-platform), not the browser. No evidence of OTP logged to console on the prod path. Acceptable.

**(b) Buyer/storefront OTP (Supabase-native, `/signin/otp` + `/signin/otp/verify`).**

- `supabase.auth.signInWithOtp` / `verifyOtp` (`auth.ts:1343,1358`). Entropy, expiry, and lockout are **delegated to Supabase GoTrue** (UNVERIFIED at the LetBuyy layer — depends on Supabase project config). The LetBuyy wrapper adds only the coarse router-level `authRateLimit` (20/5min). There is no LetBuyy-side per-email OTP throttle on this path beyond that.

**Enumeration (AUTH-013, S2):** `/api/auth/lookup` returns `{exists, hasPassword, emailVerified}` for **any** email (`lookup/route.ts:56–60`), and the underlying `/custom/users/by-email` leaks `email_verified`/`full_name`/`avatar_url`/`has_password` (`auth.ts:457–465`). This is a deliberate email-first-UX oracle, rate-limited at 10/15min/IP, but it lets an attacker (a) confirm which emails are LetBuyy merchants and (b) learn whether each uses password vs OTP — useful for targeted phishing/credential-stuffing and for the AUTH-001 takeover (which needs a *verified* email). Login itself correctly returns generic `Invalid email or password` (`login/route.ts:87`).

---

## 8. Merchant / Staff Login + Password-Reset Audit

**Password hashing (positive).** `bcryptjs`, **cost 12** (`merchant-password.ts:3`), `bcrypt.compare` on verify with a null-guard (`merchant-password.ts:9–11`). Not plaintext, not weak. Strong-password validation via Zod on signup and reset (`PasswordUpdateSchema`; `auth.ts` comments at 1279, 1416; `reset-password/route.ts:43`).

**Login flow (positive).** `/api/auth/login` stacks: rate-limit (`login`, 5/15min) → CSRF → **Turnstile (fail-closed)** → `authenticate` (bcrypt) → **MFA (TOTP) if enrolled** → device fingerprint → **new-device email alert** (`login/route.ts:22–110`; MFA at `auth.ts:529–535`, `enforceMerchantMfaIfEnrolled` at `auth.ts:139–201`). Credential-stuffing is meaningfully impeded (rate limit + Turnstile + generic errors). MFA secret is AES-GCM-encrypted at rest with `TOTP_ENCRYPTION_KEY`, which fails-closed to `MFA_UNAVAILABLE` if unset (`auth.ts:173–181`).

**Credential responses are uniform.** `/custom/users/authenticate` returns the same `INVALID_CREDENTIALS` for unknown user and wrong password (`auth.ts:517,522`); only `email_verified=false` yields a distinct `EMAIL_NOT_VERIFIED` (`auth.ts:525–527`) — a minor pre-auth state oracle but gated behind a correct password.

**Password reset (positive, custom path).** `/api/auth/reset-password` (`reset-password/route.ts`): rate-limited → CSRF → strength-checked → **single-use** reset token validated (`validateToken('password_reset')`, which marks it `used`) → password set via internal `set-password` → **`destroyAllUserSessions` (force re-login everywhere)** → fresh session → **password-changed email alert** (`reset-password/route.ts:23–104`). Reset token is **32 bytes hex (128-bit) from CSPRNG** (`auth.ts:1189` `randomHex(32)`), expiring per `AUTH_TOKEN_EXPIRY_MS`. Token entropy, single-use, expiry, and session-invalidation-on-reset are all correct.

**Set-password / intent flow (positive).** The `lb_password_set_intent` cookie is `SameSite=strict`, 15-min TTL (`cookies.ts:115–122`), and `/custom/users/set-password` requires the internal `accounts` signature + matching `(userId,email)` + `email_verified` before writing the hash (`auth.ts:962–1012`).

**Findings:**
- **AUTH-009 (S2)** OTP brute-force lockout gap (carried from §7).
- **AUTH-010 (S2): legacy `/auth/password/reset` (Supabase-native) coexists** (`auth.ts:1399–1413`) and uses `supabase.auth.resetPasswordForEmail` — a *different* reset pipeline than the custom one, with Supabase-controlled token properties and **no `destroyAllUserSessions`**. Two reset flows with different guarantees.
- No account-lockout-after-N-failures on password login beyond IP rate limiting (AUTH-012, S3) — acceptable given Turnstile + rate-limit, but a per-account exponential backoff would harden against distributed stuffing.

---

## 9. Mobile Auth Audit (`apps/mobile/merchant-app`, Flutter)

**Token storage (mostly correct).** The session token, session user, and expiry are stored in **`FlutterSecureStorage`** (Keychain/Keystore-backed) — `store_auth_service.dart:106,119,134,341,494,506` (`_secureStorage.read(key: _sessionTokenKey)` etc.). The only `SharedPreferences` (plaintext) usage stores `store_user_email` — a convenience pre-fill, low sensitivity (`login_screen.dart:122,158,177`; `otp_screen.dart:62`). **No session token or password is written to `SharedPreferences`.** The earlier audit concern about plaintext token storage does **not** hold against this tree. (AUTH-017, S3: even the email pre-fill is arguably PII-on-disk, but minor.)

**Turnstile (now enforced, supersedes prior "login blocked by placeholder" memory).** Login and signup require a Turnstile token before submit: `_resolveTurnstileToken()` returns null → "Please complete the security check" and the flow aborts (`login_screen.dart:146–149`). Server-side, both identity-platform (`turnstile.ts:7–34`) and `mobile-bff` (`index.ts:111` `verifyMobileTurnstileToken`, sitelist URL at `index.ts:24`) verify the token and **fail closed** when the secret is unset. The mobile login path is therefore *gated, not blocked* — provided a real `TURNSTILE_SECRET_KEY` and site key are configured (UNVERIFIED — deployment-config dependent).

**mobile-bff is a clean signing proxy (positive).** It extracts the `lb_session` token (cookie/Bearer), signs internal SSO headers via `createLetbuyyInternalSessionHeaders(token, secret)` (`mobile-bff/src/index.ts:213–229`), and forwards to the gateway. It stores no tokens and rejects requests when the internal secret is unconfigured ("Mobile session service is temporarily unavailable", `index.ts:217–221`). Public auth endpoints pass through without a session except `/v1/auth/custom/session` (`index.ts:185–187`).

**Gaps:**
- **AUTH-018 (S3): no certificate pinning** found in the Flutter client (no `SecurityContext`/pinning config in the auth service); the app relies on platform TLS. For a money-adjacent merchant app, cert pinning is the expected control. (UNVERIFIED beyond the auth service files read; a pinning layer could live elsewhere.)
- **Token-in-logs:** auth handlers log `error.toString()` and `debugPrint` on failures (`login_screen.dart:126`, `otp_screen.dart:75`) — no token interpolation observed, but `debugPrint` of raw exception strings can surface backend error bodies; ensure release builds strip `debugPrint`.

---

## 10. OAuth2 / PKCE / OIDC Readiness

**App-marketplace OAuth2 + PKCE is REAL and correctly built (positive).** The third-party app authorization flow (`services/api-gateway/src/routes/app-store/`):

- **PKCE-S256 enforced, `plain` rejected:** `normalizeAppOAuthPkceChallenge` requires `code_challenge_method === 'S256'` and rejects otherwise (`shared.ts:274–276`); challenge must match `^[A-Za-z0-9._~-]{43,128}$` (`shared.ts:270,279`).
- **Real verifier check:** `appOAuthPkceS256Challenge(verifier)` computes the SHA-256 base64url of the verifier and `verifyAppOAuthPkceVerifier` compares it to the stored challenge (`shared.ts:284,298`), invoked at token exchange (`billing-oauth-routes.ts:1353–1358`).
- **redirect_uri allowlisting:** `normalizeAppOAuthRedirectUri(body.redirect_uri, app.oauth_redirect_uris)` validates against the app's **registered** redirect URIs (`billing-oauth-routes.ts:1046`); developers register them via `developer-routes.ts:1174,1210`.
- **Code↔client↔redirect binding:** the authorization code is a signed `app_authorization_code` token (`auth-core` `createAppAuthorizationCode`, `index.ts:1029`) carrying `clientId`/`redirectUri`/`scopes`; exchange rejects on mismatch (`INVALID_GRANT`, `billing-oauth-routes.ts:1319–1320`). Authorization codes are single-use-by-jti (federation/redeem pattern, `index.ts:914–960`).
- **state CSRF:** `state` is carried in the authz code payload (`index.ts:1048`). **AUTH-019 (S3):** confirm the *consent UI* round-trips and binds `state` to the user session (UNVERIFIED from the route layer alone).
- App-OAuth endpoints have their own per-client+IP rate limit (`appOAuthRateLimit`, 12/min, `rateLimit.ts:1139`; mounted `index.ts:677–680`).

**OIDC identity-provider is a 501/404 skeleton (matches prior memory).** Every `/oauth2/*` and `.well-known/*` route in identity-platform delegates to `oidcSkeletonResponse` (`.well-known/openid-configuration/route.ts`, `oauth2/authorize|token|userinfo|callback|consent|logout/route.ts`, `jwks/route.ts`). When the `FEATURE_IDENTITY_PROVIDER` flag is off it returns **404 `IDENTITY_PROVIDER_DISABLED`** (`oidc-disabled.ts:22–37`); when on it returns a discovery skeleton with **501** for unimplemented endpoints (`oidc-disabled.ts:98`). The advertised JWKS is **placeholder** — `x:'disabled-x-coordinate', y:'disabled-y-coordinate'` (`oidc-disabled.ts:11–12`). **AUTH-020 (S3): the platform advertises an `ES256` JWKS it cannot actually sign with.** The constitution's OAuth2/PKCE-for-the-IdP is therefore **NOT realized** as a user-facing identity provider; only the *consumer* OAuth (apps installing into stores) is real. The `keys.ts` ES256/JWKS scaffolding and `mock-key-service.ts` exist but are not wired to live token issuance.

---

## 11. Rate-Limit Reality

**The prior "in-memory / no-op on Workers (resets per isolate)" hypothesis is largely SUPERSEDED.** The gateway limiter (`services/api-gateway/src/middleware/rateLimit.ts`) is a real tiered, fail-closed system:

- **Primary: Upstash Redis** via REST, using an **atomic Lua `INCR`+`PEXPIRE` fixed-window script** (`rateLimit.ts:170–187`, batch at `:189`) and a leaky-bucket Lua for query-cost (`:644`). Shared across isolates (durable).
- **Fallback: Cloudflare KV** for fixed-window guards when Redis is unconfigured (`rateLimit.ts:309–343`, selected at `:860`). KV is cross-isolate.
- **In-memory `Map`: local/dev ONLY** (`isLocalRuntime`, `rateLimit.ts:53–56`, used only at `:887` after the production branch returns unavailable).
- **Fail-closed in production:** when neither Redis nor KV can service a check, production returns **`503 RATE_LIMIT_UNAVAILABLE`** rather than allowing traffic (`rateLimit.ts:882–884` for fixed-window; `:939–941` for query-cost; customer-auth at `:458–471`). `warnRateLimitFailClosed` logs the event (`:786`).

The identity-platform limiter **delegates to the gateway** (`rate-limit.ts:97` POSTs `/auth/custom/rate-limit/check`) and **fails closed** (`allowed:false, retryAfter:60`) on gateway error in production (`rate-limit.ts:104–111`); it short-circuits `allowed:true` only in `NODE_ENV==='development'` unless `LETBUYY_REMOTE_RATE_LIMIT==='true'` (`rate-limit.ts:93–95`). So the auth endpoints (lookup/login/signup/magic/reset/verify_otp/switch) are throttled by the durable gateway store, not a per-isolate map.

**Residual rate-limit findings:**
- **AUTH-021 (S3): the internal-auth JTI replay cache is an in-memory `Map`** (`internal-auth.ts:45` `consumedInternalJtis`). On Cloudflare Workers this is **per-isolate**, so internal SSO signature replay protection resets across isolates and is best-effort, not global. A replayed internal header within the 5-minute freshness window could succeed on a different isolate. Given the secret is server-held, the practical risk is low, but the replay guard is weaker than it reads.
- **AUTH-022 (S3): the legacy public `/auth/signin|signup|otp|password/*` routes get only the coarse router-level `authRateLimit` (20/5min)** (`index.ts:662–670`), not the tighter per-endpoint limits the custom path enjoys (login 5/15min, etc.). The Supabase-native OTP/reset throttling is delegated to Supabase (UNVERIFIED).
- KV write-quota awareness is built in (`RATE_LIMIT_KV_FALLBACK` gate for high-volume query-cost, `rateLimit.ts:73–77`) — a thoughtful free-tier safeguard, but it means query-cost limiting silently degrades to fail-closed when Redis is absent and the KV flag is off (`:939`).

---

## 12. Attack Walkthroughs

### Walkthrough A — Unauthenticated merchant/staff account takeover via `/api/auth/switch` (AUTH-001, S0; LIVE on all branches)

1. Attacker enumerates a target via `/api/auth/lookup` (AUTH-013): `POST {email:"owner@bigstore.com"}` → `{exists:true, hasPassword:true, emailVerified:true}`. (Confirms the email is verified — the takeover's only precondition.)
2. Attacker loads the accounts app (`accounts.letbuyy.store`) in a browser to obtain a valid `letbuyy_csrf` cookie + reads it via JS (it's `httpOnly:false`, `cookies.ts:144`), placing it in the `X-CSRF-Token` header.
3. `POST /api/auth/switch` with body `{email:"owner@bigstore.com"}` and the matching CSRF header. The HEAD/deployed handler: skips any auth check, calls `/auth/custom/users/by-email`, sees `email_verified=true`, calls `createSession(user.id)`, and `setSessionCookie` (`switch/route.ts` HEAD, §4.1).
4. The response sets `lb_session` for the victim and returns `redirectTo` = the victim's admin dashboard. **Attacker is now the victim** across all platform subdomains (parent-domain cookie). Full store admin, billing, payouts UI, staff management.
   **Stopped by:** committing+deploying the working-tree fix (requires a valid current session AND the target in the device's signed `lb_accounts` cookie).

### Walkthrough B — Any authenticated user → platform super-admin via allowlist RLS (AUTH-003/FND-005, S0/S1; live in baseline)

1. Attacker signs up normally (`/auth/signup`) and obtains a Supabase session (role `seller`).
2. Using the anon/authenticated Supabase client, attacker issues `INSERT INTO super_admin_allowlist (email, user_id) VALUES ('attacker@x.com', <their uid>)` through PostgREST. The policy `service_role_manage_allowlist USING(true) WITH CHECK(true)` has **no `TO` clause** → applies to PUBLIC → the INSERT is permitted (`000_baseline.sql:26669`).
3. Attacker now satisfies `requireSuperAdmin`. Every ops route — risk decisions, payout release, Trust & Safety enforcement, app moderation, merchant impersonation — becomes reachable (`admin.ts:10`, `operations.ts:55`, `app-store.ts:753`).
   **Stopped by:** rewriting the policy to `TO service_role USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role')` (as the sibling `idempotency_keys` policy already does), and confirming PostgREST does not expose the table to anon/authenticated. **UNVERIFIED:** whether the table is reachable via the public PostgREST schema — if it is not exposed, this drops to S2 (defense-in-depth), but the policy is still wrong.

### Walkthrough C — Single `AUTH_SECRET` leak → forged platform-console session (AUTH-002, S1)

1. Assume an environment where `PLATFORM_CONSOLE_SESSION_SECRET` is unset, so console sessions are signed with `AUTH_SECRET` (`console-session.ts:24`). `AUTH_SECRET` leaks (e.g. via a logged env dump, a compromised lower-trust app sharing the secret, or the AUTH-014 plaintext-cookie analysis revealing reuse).
2. Attacker forges a console session token offline: `signLetbuyyJsonPayload({type:'platform_session', email:'ops@letbuyy.com', userId:null, mfaVerified:true, issuedAt, exp})` with `AUTH_SECRET` (`index.ts:962–981`). Because the format is `payload.HMAC` and verification just recomputes the HMAC (`index.ts:1245`), the forged token verifies.
3. Attacker sets the `LETBUYY_PLATFORM_SESSION_COOKIE` and is an MFA-verified console operator — **the console login and MFA are bypassed entirely** (`readConsoleSession` accepts it, `console-session.ts:52–55`).
   Same secret would also forge checkout-authorization (`checkout.ts:86`) and media-upload tickets (`media.ts:60`).
   **Stopped by:** mandatory per-domain secrets (no `||AUTH_SECRET`), and migrating to ES256 so the verification key isn't the forgery key.

### Walkthrough D — In-store privilege shaping via client-writable role (AUTH-004, S2)

1. Merchant authenticates via the legacy Supabase path and obtains a bearer token. They call `supabase.auth.updateUser({ data: { role: 'owner' } })` directly against Supabase, setting `user_metadata.role='owner'` (the gateway never blocks this; it's a Supabase client call).
2. On the next gateway request, `getSupabaseBearerAuthContext` reads `app_metadata?.role ?? user_metadata?.role` → `'owner'` (`auth.ts:182`).
3. For a store the merchant **already owns** (so `verifySiteOwnership` passes), `storeContext` passes `['owner']` into `resolveTenantAccessProfile` (`store-context.ts:160`), maximizing the resolved `employee_permissions` scope set within that store — potentially granting scopes the merchant's *assigned* role should not have (e.g. if they were meant to be a limited staff member on their own multi-owner store).
   **Bounded by:** cannot cross to another store (DB ownership), cannot reach ops/super-admin (DB allowlist). **Stopped by:** never reading `user_metadata.role` for authorization — derive role exclusively from `app_metadata`/DB, and remove the `['owner']` default (fail to least-privilege).

### Walkthrough E — Cross-app CSRF/XSS pivot via parent-domain cookies (AUTH-005/006, S2)

1. Attacker finds a reflected/stored XSS on the lowest-trust platform subdomain (e.g. `developer.letbuyy.store` or `themes.letbuyy.store`).
2. Because `letbuyy_csrf` is `httpOnly:false` and scoped to `.letbuyy.store` (`cookies.ts:144,58`), the XSS reads the CSRF token. Because `lb_session` is scoped to `.letbuyy.store` (`cookies.ts:83`), the browser will send it to `admin.letbuyy.store`/`console...` too.
3. The XSS issues same-site authenticated requests (with the stolen CSRF header) against the *highest-trust* app — the SameSite=strict + double-submit model provides no isolation between sibling subdomains.
   **Stopped by:** per-app cookie scoping where feasible, moving CSRF to an `httpOnly` + Origin/Referer-checked or signed-token model, and strict subdomain CSP/isolation.

---

## 13. Prior-Forensics Re-Verification Summary

| Prior claim (source) | Status on current working tree | Evidence |
|---|---|---|
| `/api/auth/switch` account-takeover (IDENTITY_PLATFORM_AUDIT; Phase 1 branch-lag) | **OPEN on all branches; fix WORKING-TREE-ONLY, uncommitted** | §4; `git diff HEAD`, `git log`, branch `git show` |
| Phase 2/3: "switch FIXED on working tree" | **Literally true but incomplete** — patched file never committed/deployed | §4.3 |
| OIDC is a 501 skeleton | **CONFIRMED** (404 when flag off, 501 stubs, placeholder JWKS) | `oidc-disabled.ts:11,22,98` |
| Shared `AUTH_SECRET` = forgery surface (FOUNDATION_FORENSICS) | **CONFIRMED & broader than identity** — 7 trust domains, HS256 | §2.3 |
| JWT-role escalation | **PARTIAL** — `user_metadata.role` fallback real but bounded by DB allowlist/ownership | §5 E-3/E-7; `auth.ts:182`, `store-context.ts:160` |
| platform-console god-mode | **NOT silent god-mode** — governed, read-only-default, recorded impersonation | `merchants/[id]/page.tsx:48–86` |
| FND-005 `super_admin_allowlist` anon-insert | **CONFIRMED in baseline** (policy applies to PUBLIC) | `000_baseline.sql:26669` |
| RBAC scope-fine (requirePermission + dual-control) on ops | **CONFIRMED** — `requireRoleCategory('ops')+requireSuperAdmin`, DB-backed `employee_permissions` | `admin.ts:10`, `operations.ts:55`, `rbac.ts:283–336` |
| Rate-limit in-memory/no-op on Workers | **SUPERSEDED** — durable Redis→KV, fail-closed in prod; in-memory is dev-only | §11; `rateLimit.ts:853–896` |
| Mobile token in plaintext SharedPreferences | **NOT CONFIRMED** — tokens in FlutterSecureStorage; only email in prefs | §9; `store_auth_service.dart:106,134` |
| Mobile login blocked by Turnstile placeholder | **SUPERSEDED** — Turnstile enforced & fail-closed; login gated not blocked | §9; `turnstile.ts:13–16`, `login_screen.dart:146` |
| Password hashing weak/plaintext | **FALSE** — bcrypt cost 12 | `merchant-password.ts:3` |

---

## 14. Findings Register

Severity: **S0** = critical, exploitable now / full compromise · **S1** = high · **S2** = medium · **S3** = low / hardening. Fix complexity: **S**=small, **M**=medium, **L**=large.

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| AUTH-001 | **S0** | Account switch | `/api/auth/switch` mints a session for any verified account; takeover fix is uncommitted | Auth/ownership checks exist only in working tree; HEAD + all branches mint session after CSRF-only gate | `switch/route.ts` (HEAD §4.1); `git diff HEAD`; `git log`; branch `git show` | Unauthenticated full takeover of any verified merchant/staff account on every deploy branch | S | Commit + deploy the working-tree fix (validateSession + lb_accounts membership + rate-limit); add a regression test asserting 401 with no session |
| AUTH-003 | **S0/S1** | Escalation / RLS | `super_admin_allowlist` RLS applies to PUBLIC (self-insert → super-admin) | Policy `USING(true) WITH CHECK(true)` with no `TO` clause | `000_baseline.sql:26669` (cf. `:26659`) | Any authenticated user can become platform super-admin, defeating the entire ops RBAC | S | `TO service_role USING (auth.role()='service_role') WITH CHECK (same)`; verify PostgREST does not expose the table to anon/authenticated |
| AUTH-002 | **S1** | Token kernel | `AUTH_SECRET` is the shared fallback signing key across 7 trust domains (all HS256) | Universal `||AUTH_SECRET` fallbacks; symmetric algo = verify key is forgery key | `cookies.ts:13`; `console-session.ts:24`; `checkout.ts:86`; `media.ts:60`; `export.ts:174`; `internal-console.ts:439`; `webhook-service/src/index.ts:543` | One secret leak forges console sessions, checkout grants, media tickets, identity cookies | M | Make per-domain secrets mandatory (fail-closed); remove `||AUTH_SECRET`; migrate platform/app tokens to ES256 (keys.ts JWKS) |
| AUTH-004 | S2 | Escalation | Client-writable `user_metadata.role` feeds auth context; `['owner']` default | `app_metadata?.role ?? user_metadata?.role` fallback; owner-default in store context | `auth.ts:182,299`; `store-context.ts:160` | In-store permission shaping; least-privilege violated by owner default | S | Read role only from `app_metadata`/DB; drop the `user_metadata` fallback and the `['owner']` default |
| AUTH-005 | S2 | CSRF | JS-readable double-submit CSRF token; defense reduces to SameSite=strict | `setCsrfCookie httpOnly:false` for client header use | `cookies.ts:144`; `csrf.ts:32` | Any platform-subdomain XSS forges authenticated requests cross-app | M | Move to httpOnly CSRF with Origin/Referer check, or signed per-session token; tighten subdomain CSP |
| AUTH-006 | S2 | Sessions | Parent-domain `lb_session` enables cross-app reuse from weakest subdomain | `.letbuyy.store` cookie domain for SSO | `cookies.ts:58,83` | Theft/fixation on low-trust app valid against admin/console | M | Scope cookies per-app where possible; isolate high-trust apps; shorten rotation window |
| AUTH-007 | S2 | Cross-tenant | Tenant isolation depends solely on `storeContext`/`verifySiteOwnership` (gateway is service_role → RLS bypassed) | Service-role DB client bypasses RLS; middleware is the only gate | `store-context.ts:71,94–107`; `auth-user.ts:40–67` | A single store-scoped route missing the middleware = cross-tenant breach | M | Census every store-scoped route for `storeContext`; add a default-deny tenant guard; stop using service_role on tenant read paths |
| AUTH-009 | S2 | OTP | No per-OTP attempt counter / lockout on validate (only IP rate limit) | `tokens/validate` has no failed-attempt burn | `auth.ts:1233–1276`; `rate-limit.ts:43` | Distributed brute-force of a 6-digit OTP within expiry | S | Burn the OTP after ~5 failed validations per (email,token); shorten OTP TTL |
| AUTH-010 | S2 | Reset | Two password-reset pipelines (custom vs Supabase-native) with different guarantees | Legacy `/auth/password/reset` coexists; no `destroyAllUserSessions` | `auth.ts:1399–1413` vs `reset-password/route.ts:86` | Inconsistent session-invalidation-on-reset; larger attack surface | M | Retire the legacy Supabase reset; route all resets through the custom single-use+session-kill flow |
| AUTH-011 | S2 | Legacy surface | Public Supabase `/auth/signin|signup|otp` issue stateless JWTs with no rotation/CSRF | Parallel legacy auth regime | `auth.ts:1281–1380` | Stolen access token valid till expiry; weaker than custom session | M | Deprecate/guard the legacy public auth routes; unify on the rotating merchant-session model |
| AUTH-013 | S2 | Enumeration | `/api/auth/lookup` confirms account existence + password-vs-OTP for any email | Email-first UX oracle | `lookup/route.ts:56–60`; `auth.ts:457–465` | Targeted phishing/stuffing; precondition discovery for AUTH-001 | M | Return uniform response + email a code regardless; or require a soft challenge before disclosing |
| AUTH-008 | S3 | Cross-tenant | PostgREST `.or()` filter built by string-interpolating `customUserId` | String-built filter, not parameterized | `auth-user.ts:55` | Filter-injection if a less-sanitized id ever flows in | S | Use builder/`.in` or validate UUID at the boundary |
| AUTH-012 | S3 | Login | No per-account lockout/backoff on password login (only IP rate limit + Turnstile) | Lockout not implemented | `login/route.ts:22`; `auth.ts:469–523` | Distributed credential stuffing across IPs | M | Per-account exponential backoff / temporary lock after N failures |
| AUTH-014 | S3 | Disclosure | `lb_accounts` cookie is signed-not-encrypted; payload (emails/names) is plaintext | `SignJWT` mislabeled "encrypted" in comments | `cookies.ts:176–181` | Cookie theft discloses all accounts' PII on the device | S | Use JWE (encrypt) or store only opaque ids; correct the comments |
| AUTH-015 | S3 | Sessions | 365-day accounts cookie / 90-day device cookie vastly outlive the session | Long max-ages for convenience | `cookies.ts:223,162` | Long-lived PII + quick-switch target artifact | S | Cap accounts cookie to ~30–90d; re-prove on switch |
| AUTH-016 | S3 | OTP | OTP has modulo bias and excludes leading-zero codes | `100000 + (bytes[0] % 900000)` | `auth.ts:209–213` | Marginally reduced OTP space | S | Rejection-sample a uniform `[0,999999]` and zero-pad to 6 digits |
| AUTH-017 | S3 | Mobile | Merchant email stored in plaintext `SharedPreferences` | Convenience pre-fill | `login_screen.dart:123,158`; `otp_screen.dart:62` | Minor PII-on-disk | S | Store in secure storage or omit |
| AUTH-018 | S3 | Mobile | No TLS certificate pinning in the Flutter auth client | Relies on platform TLS | `store_auth_service.dart` (no pinning) | MITM resistance below bar for a money app | M | Add cert/public-key pinning for gateway + bff hosts |
| AUTH-019 | S3 | OAuth | Confirm consent UI binds `state` to the user session | `state` carried in code; UI binding unverified | `index.ts:1048`; `billing-oauth-routes.ts` | CSRF on the app-install consent step | S | Bind+verify `state` to the console/admin session in the consent handler |
| AUTH-020 | S3 | OIDC | Platform advertises an ES256 JWKS it cannot sign with (placeholder keys) | Disabled IdP serves placeholder coordinates | `oidc-disabled.ts:11–12` | Integrator confusion; future foot-gun | S | Return 404 for JWKS while disabled; wire keys.ts before advertising |
| AUTH-021 | S3 | Replay | Internal-SSO JTI replay cache is per-isolate in-memory `Map` (Workers) | `consumedInternalJtis = new Map()` | `internal-auth.ts:45` | Replay guard resets across isolates within the 5-min window | M | Back the JTI cache with KV/Redis (durable, cross-isolate) |
| AUTH-022 | S3 | Rate-limit | Legacy public `/auth/*` routes get only coarse 20/5min limit | Router-level `authRateLimit` only | `index.ts:662–670` | Weaker throttling than the custom path | S | Apply per-endpoint limits (login 5/15min, etc.) to legacy routes or retire them |
| AUTH-023 | S3 | MFA | TOTP availability fails to `MFA_UNAVAILABLE` if `TOTP_ENCRYPTION_KEY` unset | Hard dependency on env secret | `auth.ts:173–181` | Enrolled users locked out if secret missing (correct fail-closed, but availability risk) | S | Alert/monitor on `MFA_UNAVAILABLE`; treat secret as required-at-boot |
| AUTH-024 | S3 | Sessions | Merchant-session rotation window (10 min) allows pre-rotation replay of a stolen token | Rotation interval | `merchant-session.ts:39` | Stolen token usable until next rotation | S | Bind session to device fingerprint on every validate; shorten interval for sensitive ops |
| AUTH-025 | S3 | Logging | `debugPrint`/`console.error` may surface backend error bodies on auth failures | Raw exception strings logged | `login_screen.dart:126`; `otp_screen.dart:75`; `auth.ts:245–252` | Info leak in client/server logs | S | Strip `debugPrint` in release; redact error bodies server-side |

**Counts:** **2 × S0** (AUTH-001; AUTH-003 rated S0/S1) · **2 × S1** (AUTH-003 lower bound; AUTH-002) · **8 × S2** · **15 × S3**. Total **26 findings** (AUTH-001…AUTH-025, with AUTH-003 spanning S0/S1).

---

## 15. Remediation Priority

1. **AUTH-001 — commit & deploy the `/api/auth/switch` fix.** One commit. Highest impact in the report. Add the missing-session regression test.
2. **AUTH-003 — fix the `super_admin_allowlist` RLS policy** and verify PostgREST exposure. One migration.
3. **AUTH-002 — make per-domain secrets mandatory, remove `||AUTH_SECRET`, plan ES256 migration** so verify keys ≠ forgery keys.
4. **AUTH-004 / AUTH-007 — stop reading `user_metadata.role`; census store-scoped routes for `storeContext`** (defense against the service-role RLS bypass).
5. **AUTH-005 / AUTH-006 — harden CSRF and reconsider parent-domain cookie scope** for high-trust apps.
6. **AUTH-009 / AUTH-010 / AUTH-011 / AUTH-013 — OTP lockout, retire the legacy Supabase auth/reset surface, soften the enumeration oracle.**
7. The S3 set is hardening; AUTH-014 (mislabeled "encrypted" cookie), AUTH-018 (cert pinning), and AUTH-021 (durable JTI cache) are the highest-value among them.

---

*End of Phase 6 — Authentication Forensic Audit. All findings are code-evidenced against the working tree at audit date; items dependent on live runtime, deployed env-var values, or PostgREST schema exposure are marked UNVERIFIED inline.*

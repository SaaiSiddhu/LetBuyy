# SECURITY FORENSICS REPORT
### Phase 6 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY
### Ranked: CRITICAL · HIGH · MEDIUM · LOW — every item evidenced to file:line

> Scope: identity-platform routes + gateway middleware/auth + auth-core + console + mobile. No code modified. Severity reflects exploitability × blast radius for an India fintech-adjacent commerce platform aspiring to be the ecosystem root-of-trust.

---

## CRITICAL

### C-1 — Unauthenticated account takeover via `/api/auth/switch` (NET-NEW)
**`apps/identity-platform/src/app/api/auth/switch/route.ts:15-71`.** The route takes an email **from the request body** and mints a full `lb_session` for that user if the user exists and is `email_verified` — with **no proof the caller controls that account**:
```ts
const { email } = await request.json()                      // :22  attacker-supplied
const currentToken = await getSessionCookie()               // :31  (undefined if attacker has no session)
if (currentToken) await destroySession(currentToken)        // :32-34
const userResponse = await identityApiRequest('/auth/custom/users/by-email', { … email … })  // :37-40
if (!user || !user.email_verified) return 404               // :52
const sessionToken = await createSession(user.id, deviceId) // :61
await setSessionCookie(sessionToken)                         // :64  ← attacker now holds victim's session
```
The doc-comment claims *"The email must be in the encrypted accounts cookie"* (`:12`) but **no such check exists** — `getAccounts()` is called **only** in `accounts/route.ts`, and the `multiAccount` feature flag (`features.ts:17`) gates nothing. The sole guard is `validateCsrf` (`:18`), which an attacker satisfies trivially on their own same-origin request (the `letbuyy_csrf` cookie is JS-readable by design, `cookies.ts:139`). There is **no Turnstile and no rate-limit** on this route.
**Impact:** any party can obtain a valid merchant session for **any email-verified user** (every merchant/staff account) without credentials — full account & store takeover, cross-tenant. **Exploitability: trivial. This single bug disqualifies the platform from being a root-of-trust until fixed.**

### C-2 — Forgeable platform-console super-admin session (dev-literal secret, `NODE_ENV`-only gate)
**`apps/platform-console/src/lib/console-session.ts:23-31`.**
```ts
const secret = process.env.PLATFORM_CONSOLE_SESSION_SECRET || process.env.AUTH_SECRET || ''
if (process.env.NODE_ENV === 'production') return isSafeSecret(secret) ? secret : null
return secret || 'dev-only-console-session-secret'           // :30  public literal
```
The fallback literal is used whenever `NODE_ENV !== 'production'`. The gate checks **only `NODE_ENV`** — unlike the sibling `console-auth-server.ts:138-142` which checks `NODE_ENV`/`APP_ENV`/`VERCEL_ENV`. On any reachable deploy where `NODE_ENV` is unset/`development` (common preview/staging misconfig) the ops console signs and verifies `lb_console_session` with a **public string**, so an attacker can forge a console cookie with `mfaVerified:true`. **Impact:** forged ops/super-admin session ⇒ platform-wide control. Conditional on env misconfig, but the condition is a single unset variable.

### C-3 — Default mock KMS ⇒ data-at-rest "encryption" uses a checked-in literal
**`services/api-gateway/src/lib/crypto.ts:144-158, 180`.** `resolveKmsProviderFromEnv` defaults `LETBUYY_KMS_MODE` to **`'mock'`** (`:180`); the mock provider wraps every field-level envelope with the literal **`'letbuyy-local-mock-kms-envelope-secret'`** (`:146`). Live mode throws `KmsHumanRequiredError` (`:160-173`) — i.e. real KMS is unimplemented. **Impact:** unless someone sets `LETBUYY_KMS_MODE=live` (which then fails), all "encrypted at rest" PII / payment configuration is wrapped with a public, in-repo string — effectively plaintext to anyone with the codebase and the ciphertext.

---

## HIGH

### H-1 — `service_role` (BYPASSRLS) is the default DB connection; RLS path is dead code
`packages/infrastructure/supabase-adapter/index.ts:34-39` connects with `SUPABASE_SERVICE_ROLE_KEY`; `services/api-gateway/src/lib/supabase.ts:10` comments it *"service role — bypasses RLS."* The RLS-respecting `getSupabaseUser` (`:23-25`) has **zero callers**. Tenant isolation therefore rests entirely on per-route app predicates with **no database safety net** (Phase 7). One forgotten `verifySiteOwnership` = full cross-tenant IDOR.

### H-2 — Static shared-token super-admin principal in the gateway
`services/api-gateway/src/middleware/auth.ts:217-231`: any request bearing `PLATFORM_CONSOLE_API_TOKEN` is assigned a hardcoded principal `id:'00000000-0000-4000-8000-000000000000', role:'super_admin'`. A single shared secret confers a full super-admin read identity; no per-user attribution, no rotation story.

### H-3 — Forgeable `lb_accounts` cookie via dev-literal signing key
`apps/identity-platform/src/lib/auth/cookies.ts:11-19` falls back to `'dev-only-insecure-auth-secret-set-AUTH_SECRET-in-prod'` under a **`NODE_ENV`-only** gate (vs the 4-variable gate in `dev-auth-bypass.ts:13-18`). On a non-`production` `NODE_ENV` deploy the PII-bearing accounts cookie is forgeable/decodable (Phase 4 D1).

### H-4 — Secret reuse: `AUTH_SECRET` signs three trust domains
`AUTH_SECRET` is the fallback signer for the console session (`console-session.ts:24`), the accounts cookie (`cookies.ts:12`), and internal service-to-service HMAC (`packages/auth-core/src/index.ts:451`). One leak compromises all three; one rotation silently re-keys all three.

### H-5 — Mock OIDC/JWKS is one flag away from real relying parties
`apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts:4-16,76-88` serves a **literal-string JWKS** (`x:'mock-x-coordinate'`) and a `mock:true` discovery doc behind `FEATURE_IDENTITY_PROVIDER`/`FEATURE_NEW_KEY_SERVICE`. Enabling these publishes an issuer that cannot mint verifiable tokens (Phase 2). Flags must be treated as production-forbidden.

### H-6 — Gateway Turnstile dev-bypass needs no feature flag
`services/api-gateway/src/middleware/security.ts:199-205, 222-224`: `dev-bypass-token` is accepted whenever `ENVIRONMENT|APP_ENV|NODE_ENV ∈ {local,development}` — **no `LETBUYY_ENABLE_DEV_AUTH_BYPASS` required** (unlike identity's strict gate). A stray `APP_ENV=development` disables bot protection at the gateway (Phase 5 §3).

### H-7 — Cookie-domain drift `.letbuyy.store` vs canonical `.letbuyy.com`
`cookies.ts:53-54` + `config/urls.ts:1-2` hard-code `.letbuyy.store`. At the `letbuyy.com` cutover, session/SSO cookies scope to the wrong apex unless every env sets `COOKIE_DOMAIN`; the literal is also duplicated in merchant-control-plane (Phase 10 C3). Silent SSO/logout break + session-handling fragility.

---

## MEDIUM

| ID | Finding | Evidence | Impact |
|---|---|---|---|
| M-1 | **User-enumeration oracle** — `/api/auth/lookup` returns `{exists, hasPassword, emailVerified}`, IP-rate-limited only, no Turnstile/CSRF | `lookup/route.ts:56-60` | account enumeration (note: reset/magic correctly do NOT leak — `send-reset/route.ts:68`) |
| M-2 | **`lb_accounts` "encrypted" is signed-not-encrypted PII, 365 d** | `cookies.ts:171-176` | email/name/avatar readable via cookie/XSS; DPDP minimisation |
| M-3 | **Non-constant-time CSRF compare** in identity | `csrf.ts:14` (`cookieToken === headerToken`) vs gateway's `timingSafeEqualText` | timing side-channel (low value; tokens random) |
| M-4 | **Magic-link / verify token in URL via GET** | `verify/route.ts:16,26-28` | token leak via Referer/proxy/logs; single-use mitigates |
| M-5 | **`/api/auth/switch` has no rate-limit/Turnstile** | `switch/route.ts` | amplifies C-1; brute-forceable |
| M-6 | **Login rate-limit keyed by IP only** despite "IP + email" comment | `login/route.ts:22` | shared-NAT throttling / credential-stuffing per-account not limited |
| M-7 | **Supabase legacy signup auto-confirms email & trusts client `name` for role** | gw `routes/auth.ts:1214-1241` (`email_confirm:true`) | parallel path bypasses verification; privilege via client field |
| M-8 | **In-memory auth fallback maps in prod-shaped gateway code** | gw `routes/auth.ts:82-85,925,1058` | users/hashes/sessions in process memory if schema-missing path hit |
| M-9 | **No default-deny middleware** in identity app | `find src -name middleware.ts` → none | every protection is opt-in per handler |
| M-10 | **No clickjacking defense in code** (no `frame-ancestors`/`X-Frame-Options` set by app) | no middleware/headers in identity routes | login UI framable unless edge sets headers (unverified) |

---

## LOW

| ID | Finding | Evidence |
|---|---|---|
| L-1 | Dual CSRF cookie names (`letbuyy_csrf`/`lb_csrf`) accepted | `csrf.ts:22` |
| L-2 | No `__Host-`/`__Secure-` cookie prefixes | `cookies.ts:56-62` |
| L-3 | Device cookie set, no revocation UI | `cookies.ts:152-159` |
| L-4 | Weak password policy (min 8, one upper, one digit; no length≥12 / breach check) | `apps/identity-platform/src/lib/auth/password.ts:13-17` |
| L-5 | base64url reimplemented in ~10 files, `timingSafeEqual` in ~28 — crypto-primitive sprawl | Phase 10 §3 |
| L-6 | Redirect targets server-derived (low open-redirect risk), but `return_to` validation logic is duplicated and app-specific | `lookup` `isValidReturnTo` (Phase 10 C12) |

---

## Standard-category coverage (explicit)

- **Broken access control / tenant escape:** C-1 (switch ATO), H-1 (BYPASSRLS + dead RLS), H-2 (shared super-admin). **The dominant security theme.**
- **JWT forgery:** H-3 (accounts cookie dev key), C-2 (console session dev key). All first-party JWTs are HS256/symmetric.
- **Secret/credential leakage:** C-2, C-3, H-3 — three checked-in literal secrets (`dev-only-console-session-secret`, `letbuyy-local-mock-kms-envelope-secret`, `dev-only-insecure-auth-secret…`).
- **Session replay/fixation:** Phase 3 — opaque token, no reuse detection; fixation risk low (mint-after-auth).
- **Refresh-token theft:** N/A on merchant path (no refresh); declared-only in `session-core`.
- **CSRF:** present on state-changing identity routes (double-submit), non-constant-time (M-3); absent-by-design on logout (idempotent) and lookup.
- **XSS:** React auto-escaping on UI; no reflected sink found in JSON API routes; `letbuyy_csrf` + `lb_accounts` are JS-readable, amplifying any future XSS.
- **Open redirect / clickjacking:** M-10 + L-6 — low/medium, partly mitigated by server-derived redirects.

## Top remediation priorities (analysis-only)
1. Fix **C-1** (require an authenticated, possession-proven principal for `/switch`; actually check accounts-cookie membership or kill the route).
2. Remove the three checked-in secret literals and unify prod-detection (**C-2, C-3, H-3, H-6**).
3. Add a database safety net / stop defaulting to `service_role` for tenant-scoped reads (**H-1**).
4. Keep OIDC flags production-forbidden until Phase 2 §5 is built (**H-5**).

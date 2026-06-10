# COOKIE GOVERNANCE REPORT
### Phase 4 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## 0. Verdict

Cookie *hygiene* is mostly sane — `httpOnly`/`secure`/`sameSite` are set deliberately and the platform-vs-customer realm split is real and well-reasoned (`apps/identity-platform/src/lib/auth/cookies.ts:33-54`). But three governance defects undercut it: (1) the `lb_accounts` cookie's signing key **falls back to a public dev literal under a `NODE_ENV`-only gate**, making it forgeable on any deploy where `NODE_ENV` isn't `production`; (2) the cookie domain still **hard-defaults to `.letbuyy.store`** while the canonical apex is `letbuyy.com`, a silent SSO-break at cutover; and (3) `lb_accounts` is labelled "encrypted" but is a **signed-not-encrypted JWT** carrying users' email/name/avatar for **365 days**, readable by anyone with the cookie or an XSS foothold.

---

## 1. Full cookie inventory

| Cookie | Owner | Purpose | httpOnly | secure | sameSite | domain | maxAge | Evidence |
|---|---|---|:--:|:--:|:--:|---|---|---|
| `lb_session` | identity/gateway | merchant/staff session (opaque) | ✅ | ✅ | lax | `.letbuyy.store` (prod) / none (dev) | **30 d** | `cookies.ts:76-83` |
| `letbuyy_csrf` | identity | CSRF double-submit | ❌ (by design) | ✅ | **strict** | as above | 1 h | `cookies.ts:135-143` |
| `lb_accounts` | identity | multi-account list (≤10), **PII** | ✅ | ✅ | lax | as above | **365 d** | `cookies.ts:99-106, 204-219` |
| `lb_device` | identity | device id | ✅ | ✅ | lax | as above | 90 d | `cookies.ts:152-159` |
| `lb_password_set_intent` | identity | post-OTP password-set intent | ✅ | ✅ | **strict** | as above | 15 m | `cookies.ts:110-117` |
| `lb_customer_session` | storefront (`auth-core`) | buyer session (host-only) | ✅ | ✅ | lax | **host-only (none)** | 7 d | `packages/auth-core/src/index.ts:693-764` |
| `lb_console_session` | platform-console | ops session (+MFA flag) | ✅ | ✅ | (set) | console apex | 8 h | `apps/platform-console/src/lib/console-session.ts:13` |
| `lb_csrf` | legacy alt | accepted as CSRF fallback | ❌ | ✅ | — | — | — | `cookies.ts`/`csrf.ts:22` |
| `lb_session` / `lb_session_user` / `lb_session_expires_at` | mobile | secure-storage keys (NOT HTTP cookies) | n/a | n/a | n/a | device keystore | mirrors session | `store_auth_service.dart:105-109` |

Shared base options (`cookies.ts:56-62`): `{ httpOnly:true, secure:true, path:'/', domain?:COOKIE_DOMAIN }` — individual setters override `httpOnly`/`sameSite`/`maxAge`.

---

## 2. Realm model (the part that is right)

Two cookie realms, deliberately non-overlapping (`cookies.ts:33-54`):
- **Platform realm** — `lb_session` et al. carry a **parent-domain** attribute (`.letbuyy.store`) so one login at `accounts.*` is valid across `admin/apps/themes/developer/console` → this *is* the current SSO mechanism.
- **Customer realm** — `lb_customer_session` is **host-only** (no `domain`), so a storefront cookie never leaks to the platform apex. The code comment explicitly forbids ever setting a parent domain on a storefront cookie (`cookies.ts:43`). This is the one genuinely strong isolation guarantee in the system (cross-ref Phase 7).

---

## 3. Defects

### D1 — Forgeable `lb_accounts` via dev-literal signing key (HIGH)
```ts
// cookies.ts:11-19  (getSigningKey, used by encryptAccounts/decryptAccounts)
const value = process.env.AUTH_SECRET?.trim() || ''
if (value.length < 16) {
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET … weak key')
  return new TextEncoder().encode('dev-only-insecure-auth-secret-set-AUTH_SECRET-in-prod')   // line 17
}
```
The fallback gate is **`NODE_ENV === 'production'` only** — unlike `dev-auth-bypass.ts:13-18`, which checks `NODE_ENV`/`APP_ENV`/`VERCEL_ENV`/`NEXT_PUBLIC_ENV`. On any internet-reachable deploy where `NODE_ENV` is unset/`development` (a common Vercel preview/staging misconfig) the `lb_accounts` cookie is signed/verified with a **public literal**, so an attacker can forge an accounts list. Impact is bounded (the accounts cookie is a convenience list, not the session) but it is PII-bearing and feeds the account-picker UI.

### D2 — Cookie-domain drift `.letbuyy.store` vs canonical `.letbuyy.com` (HIGH, latent)
```ts
// cookies.ts:53-54
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim()
  || (process.env.NODE_ENV === 'production' ? '.letbuyy.store' : undefined)
```
The hard-coded prod default is `.letbuyy.store`, and `src/lib/config/urls.ts:1-2` likewise hard-codes `https://accounts.letbuyy.store` / `https://admin.letbuyy.store`. Per the canonical-domain migration (to `letbuyy.com`), at cutover the session cookie will be **scoped to a domain the apps are no longer served from** unless `COOKIE_DOMAIN` is set in every environment — silently breaking SSO and logout. The same literal is independently duplicated in `apps/merchant-control-plane/.../auth/logout/route.ts` (Phase 10 C3), so the cutover must be coordinated across apps.

### D3 — `lb_accounts` is "encrypted" in name only; PII for 365 days (MEDIUM)
```ts
// cookies.ts:171-176
async function encryptAccounts(accounts) {
  return new SignJWT({ accounts }).setProtectedHeader({ alg:'HS256' }).setExpirationTime('365d').sign(getSigningKey())
}
```
`SignJWT` **signs**, it does not encrypt — the payload (`email`, `name`, `avatar`, `lastLogin` for up to 10 accounts, `cookies.ts:67-72, 204-211`) is base64-decodable by anyone holding the cookie or via XSS. The misleading `encrypt/decrypt` naming invites future misuse. A 365-day PII cookie is also a data-minimisation/DPDP concern.

### D4 — Dual CSRF cookie names (LOW)
`letbuyy_csrf` is set (`cookies.ts:137`) but `lb_csrf` is also accepted on read (`csrf.ts:22`; gateway `security.ts:268-269`). Two valid names widen the surface and complicate rotation; legacy `lb_csrf` should be retired.

### D5 — No `__Host-`/`__Secure-` prefixes (LOW)
All cookies are `secure:true` + `path:/`, but none use the `__Host-`/`__Secure-` name prefixes that would let the browser enforce those invariants. For an SSOT identity cookie this is cheap hardening left on the table.

---

## 4. Conflicts / duplicates / orphans

- **Duplicate:** `letbuyy_csrf` vs `lb_csrf` (D4); `COOKIE_DOMAIN` literal duplicated across identity + merchant-control-plane (Phase 10).
- **Conflict (latent):** `.letbuyy.store` cookie domain vs `letbuyy.com` canonical (D2).
- **Orphan risk:** `lb_device` (90 d) is set on every login (`login/route.ts:86`) but device-trust is only consumed for the new-device email; no UI to revoke devices observed.
- **Cross-realm safety:** confirmed clean — no platform cookie is host-only and no customer cookie carries a parent domain.

---

## 5. Recommendations (analysis-only)
Unify the prod-detection helper so the `lb_accounts` signer uses the same 4-variable gate as `dev-auth-bypass.ts` (closes D1); drive `COOKIE_DOMAIN` from a single shared config and remove the `.letbuyy.store` literal everywhere before cutover (D2); either truly encrypt `lb_accounts` (JWE) or stop calling it encrypted and shorten its TTL + minimise its PII (D3); retire `lb_csrf` (D4); adopt `__Host-`/`__Secure-` prefixes for the session and CSRF cookies (D5).

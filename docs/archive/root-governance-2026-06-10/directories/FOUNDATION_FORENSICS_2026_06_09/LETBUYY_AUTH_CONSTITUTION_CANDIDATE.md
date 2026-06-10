# LETBUYY AUTH CONSTITUTION — CANDIDATE

**Status:** CANDIDATE · **Date:** 2026-06-09 · **Scope:** authentication, authorization, sessions, cookies, identity store, MFA, tokens, consent. Subordinate to the Master Constitution; binding on `apps/identity-platform`, `services/api-gateway` (auth/identity-foundation/middleware), `packages/auth-core`, and the Flutter merchant app.

Grounded in `LETBUYY_IDENTITY_FORENSICS.md` and `LETBUYY_AUTH_SCORECARD.md`. Current verified state: real opaque-DB sessions + working BFF + bcrypt-12 + AES-GCM TOTP + mature ops-RBAC, **capped by** a service-role tenant boundary, dormant "V2" identity, unenforced MFA, two parallel merchant auth systems, and a 501 OIDC skeleton.

---

## Article I — One identity runtime

1. **There is exactly one merchant authentication path.** Today two coexist — Supabase GoTrue JWT *and* the custom `users_custom` + opaque-session system — and the gateway accepts both (`routes/auth.ts:1244-1268` vs `:411-480`). One MUST be chosen as canonical; the other MUST be removed, not left as a fallback. Dual-acceptance of credentials is prohibited.
2. **Dormant identity is deleted or shipped.** The `identity-foundation/` V2 stack (in-memory `Map`/`Set` sessions, refresh-rotation, ReBAC, OIDC) is wired to nothing reachable (`session-services.ts:29-95`). It MUST be either wired into the real path within one quarter or deleted. It MUST NOT be cited as the platform's identity capability while dormant.

## Article II — Tenant isolation is enforced below the handler

1. **RLS must be real or explicitly waived in writing.** The authenticated data path runs as `service_role` (`lib/supabase.ts`: `getSupabaseUser` = 0 call-sites, `getSupabaseAdmin` = 98), so all 685 RLS policies are inert. Either (a) route reads through the RLS-respecting user client, or (b) introduce a tenant-aware data-access layer that *refuses* unscoped tenant queries. A handler-by-handler `store_id` filter is no longer an acceptable sole boundary.
2. **`requireRole` MUST NOT trust a client-supplied JWT role claim** (`rbac.ts` / `middleware/auth.ts:216-231`). Authority derives from a server-side membership/role lookup, never from a token field the caller can influence.
3. **No static god-tokens.** `PLATFORM_CONSOLE_API_TOKEN` minting a synthetic `super_admin` with a fake audit UUID is prohibited (`middleware/auth.ts:216-231`). Console/ops access uses real per-principal identities with real audit subjects.

## Article III — Sessions & refresh

1. **Sessions are server-revocable.** The opaque-DB session model (real today) is FROZEN as canonical. Logout/revocation MUST remain server-side and effective.
2. **Sessions have an idle timeout and rotation.** The current 30-day absolute cookie with no idle expiry and no rotation (`auth-core:127`, `cookies.ts:86`; `last_active` tracked but unused) MUST gain idle timeout + periodic rotation before GA.
3. **If refresh tokens are offered, rotation + reuse-detection is mandatory.** The `RefreshChain`/`reuseDetectedAt` model exists in types only; shipping refresh tokens without implementing reuse-detection is prohibited.

## Article IV — Cookies

1. **All auth cookies are `httpOnly` + `secure`.** (Met today.) The CSRF cookie is the sole intentional non-httpOnly double-submit token.
2. **The accounts cookie is encrypted, not merely signed, OR carries no PII.** `lb_accounts` is an HS256-*signed* JWT mislabeled "encrypted"; it stores up to 10 accounts' email/name for 365 days readable in the payload (`cookies.ts:176-225`). Either encrypt (JWE) or stop storing PII in it.
3. **Weak signing keys are refused in any production-like runtime.** The SEC-H3 guard (`cookies.ts:12-25`) is FROZEN — do not weaken the gate back to `NODE_ENV`-only.
4. **One signing key per purpose.** Crypto-key reuse across cookie/session/token purposes is prohibited (finding F10).

## Article V — MFA

1. **MFA, once enrolled, is enforced at login.** Today `authenticate` ignores `merchant_2fa_factors` (`routes/auth.ts:411-480`) — enrolled merchants are not actually challenged. This MUST be enforced before GA.
2. **No shared admin MFA secret.** A single `PLATFORM_CONSOLE_TOTP_SECRET` for all admins (`admin-mfa-scaffold.ts:8`) is prohibited; TOTP secrets are per-principal.

## Article VI — Third-party identity (OIDC/OAuth)

1. **Do not advertise an OpenID Provider that returns 501.** The `oidc-disabled.ts` mock-discovery + mock-JWKS + 501 token endpoint MUST NOT be exposed as a federation capability. Until a real OP exists (or a vendor is adopted), OIDC is officially **not a feature**.
2. **App-platform auth is a deliberate, separate project** — not an emergent property of the merchant login flow.

## Article VII — Mobile

1. **The Flutter app MUST be able to authenticate against production** without build-time Turnstile/host-sentinel blockers that hard-fail login (finding F15). Client secrets MUST NOT be embedded in the app bundle.

---

## FROZEN (protect)
Opaque server-revocable sessions; bcrypt-12 password hashing; RFC-6238 AES-GCM TOTP construction; SEC-H3 weak-key refusal; cross-realm cookie isolation; the `/api/auth/switch` device-proof fix (`switch/route.ts:30-104`); mature ops-RBAC (break-glass/SoD/dual-control/step-up).

## CONDEMNED (fix before GA)
Service-role-only tenant boundary; two parallel merchant auth systems; unenforced MFA; shared admin TOTP; static `super_admin` god-token; 30-day no-idle no-rotation sessions; PII in a signed-not-encrypted cookie; OIDC 501 skeleton presented as a platform.

## Auth maturity (from scorecard)
**Identity 34/100 · Auth-portion of Security 41/100.** Good primitives, dangerous boundary. The single biggest risk: *isolation is correct-by-convention, so the first unscoped `:id` handler is a silent cross-tenant breach with no DB backstop.*

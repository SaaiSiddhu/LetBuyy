# LetBuyy Auth Scorecard — "Who Owns X Today"

**Date:** 2026-06-09 · **Method:** code-grounded (runtime wiring only) · **Companion:** `LETBUYY_IDENTITY_FORENSICS.md`

Grades: **A** = production-grade · **B** = solid, minor gaps · **C** = works but materially incomplete · **D** = present but broken/unenforced · **F** = absent or theater.

---

## Capability ownership table

| Concern | Owner module (what actually runs) | Mechanism | Grade | Evidence (file:line) | Gap |
|---|---|---|---|---|---|
| **Authentication (merchant)** | `apps/identity-platform` BFF → gateway `routes/auth.ts` (custom path) | Email+password (bcrypt-12) → opaque DB session token; BFF↔gateway over HMAC | **C** | `routes/auth.ts:411-480,1035-1078`; `lib/merchant-password.ts:1-12`; BFF `lib/auth/session.ts:7-32` | A *second* parallel GoTrue JWT auth (`auth.ts:1244-1268`) coexists; gateway accepts both → duplicate identity, two user tables |
| **Authentication (customer)** | `apps/storefront-runtime/src/lib/session.ts` | Signed JWT, host-only cookie, store-scoped, federation-token redemption | **B** | `storefront-runtime/src/lib/session.ts:49-102`; gateway verify `middleware/customer-session.ts:56-68` | Separate from platform realm (good); JWT so not server-revocable mid-life |
| **Authentication (admin/ops, token path)** | `middleware/auth.ts` + `middleware/rbac.ts` | Static shared `PLATFORM_CONSOLE_API_TOKEN` → synthetic `super_admin` | **D** | `middleware/auth.ts:216-231`; `rbac.ts:330-333,451-454,546-549` | One shared secret = full ops read; no per-operator identity; audit attributed to fake UUID |
| **Authorization (internal/ops)** | `middleware/rbac.ts` | Allowlist + employee roles + break-glass (TTL/used_at) + SoD + dual-control + step-up | **B** | `rbac.ts:185-326,449-491,544-563`; `lib/security-controls.ts`; `routes/security.ts` | Genuinely real; undercut by the console-token bypass above (F7) |
| **Authorization (merchant)** | `lib/tenant-context.ts` + `lib/auth-user.ts` | App-code `verifySiteOwnership` / `store_id` scoping; coarse roles (`owner`/`store:owner`) | **C** | `tenant-context.ts:176-249`; `auth-user.ts:40-67`; sampled `products.ts:981`, `orders.ts:970` | Role-coarse; `requireRole` trusts JWT-carried role (`rbac.ts:416-443`); no fine-grained per-resource model in run path |
| **Authorization engine (ReBAC/RBAC/ABAC)** | `identity-foundation/permission-engine.ts` | "Shadow" `PermissionDecision` (rbac/abac/legacy_alias/default_deny) | **F** | `permission-engine.ts:17-47`; wired only via `repository-implementations.ts:71` | Dormant; never called by any route/middleware |
| **Sessions (merchant)** | gateway `sessions` table (custom path) | Opaque `randomHex(32)`, `expires_at` only, `last_active` written | **C** | `routes/auth.ts:1035-1078,266-348`; `middleware/auth.ts:130-183` | 30-day absolute (`auth-core:127`), **no idle timeout**, no rotation; `last_active` never used to expire |
| **Sessions (V2 design)** | `identity-foundation/session-services.ts` | `createDormantSessionService` — in-memory `Map`, idle/revoke logic | **F** | `session-services.ts:29-75` | Volatile per-isolate Map; "Dormant"; not on request path |
| **Cookies (platform)** | `apps/identity-platform/src/lib/auth/cookies.ts` | httpOnly+secure; parent-domain `.letbuyy.store` SSO; sameSite lax/strict | **B** | `cookies.ts:62-67,81-148` | Parent-domain SSO = broad XSS blast radius across subapps (F12) |
| **Cookies (`lb_accounts` multi-account)** | `cookies.ts` `encryptAccounts`/`decryptAccounts` | **HS256-SIGNED JWT** (mislabeled "encrypt"); 10 accts PII, 365d | **C** | `cookies.ts:176-225` | Signed ≠ encrypted; PII (email/name) readable in JWT body; httpOnly only mitigation |
| **Cookie signing-key safety** | `cookies.ts:getSigningKey` | Refuses `AUTH_SECRET` <16 chars in prod-like runtimes (SEC-H3) | **A** | `cookies.ts:12-25` | None — correct fail-closed |
| **Identity store** | Supabase (`users_custom`, `user_profiles`, `sessions`, `merchant_2fa_factors`, …) | Postgres tables via **SERVICE-ROLE** client | **D** | `lib/supabase.ts:12-18`; `supabase-adapter:34-39` | RLS bypassed (685 policies inert, F1); two user tables; no unified principal |
| **MFA (merchant TOTP)** | `routes/two-factor.ts` + `lib/totp.ts` | RFC-6238 TOTP, AES-GCM seed, SHA-256 recovery codes | **D** | `two-factor.ts:176-302`; `totp.ts:89-107` | Correctly built but **never enforced at login** (`auth.ts:411-480` ignores factors) → second factor decorative |
| **MFA (admin/operator)** | `identity-foundation/admin-mfa-scaffold.ts` | Single shared `PLATFORM_CONSOLE_TOTP_SECRET`; per-user TOTP dormant | **F** | `admin-mfa-scaffold.ts:8`; `realm-registry.ts:50` (required-but-dormant) | No per-operator MFA identity |
| **Passkeys / WebAuthn** | — | `factor_type:'passkey'` enum exists; no ceremony, no attestation, no verify | **F** | type only at `two-factor.ts:31`; no WebAuthn code anywhere | Declared, unimplemented |
| **Consent / DSR** | `routes/security.ts` + `lib/internal-compliance.ts` | Manual data-subject-request create/update; step-up gated | **C** | `routes/security.ts:1-50+`; `internal-compliance.ts` | DSR plumbing exists; no granular consent-record/preference system on the auth path |
| **Refresh tokens (rotation + reuse-detect)** | `identity-foundation/session-services.ts` | `createDormantRefreshTokenService` — in-memory `Set`, `shadow:` hashes | **F** | `session-services.ts:77-95` | Dormant only; the live 30-day opaque token has no rotation/reuse-detection |
| **OAuth / OIDC provider** | `apps/identity-platform/.well-known/*`, `/oauth2/*`, `/jwks` | Discovery doc `mock:true`; token/authorize **501**; JWKS hardcoded fake | **F** | `lib/identity-foundation/oidc-disabled.ts:4-16,76-103`; `oauth2/token/route.ts` | No functioning OP; advertised endpoints 501/fake |
| **Logout / revocation** | gateway `routes/auth.ts` (custom path) | Real DB delete by token / by user_id; BFF + mobile call it | **B** | `routes/auth.ts:1080-1106`; BFF `lib/auth/session.ts:72-87`; mobile `store_auth_service.dart:316-332` | Solid for opaque path; the parallel GoTrue JWT logout (`auth.ts:1316-1329`) is a separate code path (consistency risk) |
| **Internal service-to-service trust** | `lib/internal-auth.ts` + `lib/internal-secret.ts` | HMAC-SHA256 (`app.<app>.<ts>` / session-headers), timestamp freshness, timing-safe, multi-secret | **B** | `internal-auth.ts:32-77`; `internal-secret.ts:11-15`; BFF signer `lib/api/client.ts:117-151` | Real; but the same secret is reused for TOTP/cookie crypto (F10) |
| **Mobile auth client** | `apps/mobile/merchant-app/lib/services/store_auth_service.dart` | BFF login + CSRF + mandatory Turnstile; httpOnly `lb_session` in secure storage | **C** | `store_auth_service.dart:160-197,364-385,405-430` | Login impossible without build-time Turnstile token (F15); brittle `set-cookie` regex (F16) |

---

## Realm separation matrix (run path)

| | Customer | Merchant/staff | Admin/ops |
|---|---|---|---|
| Cookie | host-only `LETBUYY_CUSTOMER_SESSION_COOKIE` | parent-domain `lb_session` (+ GoTrue Bearer) | `PLATFORM_CONSOLE_API_TOKEN` (token path) |
| Secret | `CUSTOMER_SESSION_SECRET` | `INTERNAL_API_SECRET`/`AUTH_SECRET` | shared console token |
| Session | signed JWT (store-scoped) | opaque DB token **+** GoTrue JWT (commingled) | none (static token) |
| Separated from others? | **Yes** (diff secret, host-only) | partially (vs customer: yes; *within* merchant: 3 commingled mechs) | shared-secret, no per-user identity |

Cross-realm isolation (customer vs platform): **real, B.** Intra-merchant credential unification: **absent, see F4.**

---

## One-line grades

- Authentication **C** · Authorization (ops **B** / merchant **C**) · Sessions **C** · Cookies **B** · Identity store **D** · MFA **D** · Passkeys **F** · Consent **C** · Refresh tokens **F** · OIDC **F** · Logout/revocation **B** · Internal S2S trust **B** · Mobile **C**.

**Composite identity maturity ≈ 34/100; auth-security ≈ 41/100** (see forensics §12). The recurring failure mode: *real legacy primitives that work, fronted by a large dormant "V2" layer that does not, over a database whose RLS is bypassed.*

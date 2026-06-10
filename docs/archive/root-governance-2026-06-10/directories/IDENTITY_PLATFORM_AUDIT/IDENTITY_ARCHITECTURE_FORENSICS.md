# IDENTITY ARCHITECTURE FORENSICS
### Phase 1 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY · evidence-based
### Scope: full ecosystem auth surface (independent re-derivation; prior reports ignored)

> **Method.** Every claim below is grounded in source read first-hand during this audit. Paths are repo-relative to `/Users/saai_sidd/Git/Letbuyy_Store`. No code was modified, executed, or patched. Where a runtime behaviour is asserted it is traced to the exact file:line that produces it.

---

## 0. Verdict up front

There is **no single identity system**. There are **seven concurrent auth mechanisms** sharing an overlapping set of `AUTH_SECRET`-derived secrets, plus a **fully dead "v2 identity foundation"** (six interface-only packages + a flag-gated in-memory scaffold) that the contract's SSO/OIDC ambition is implicitly betting on. The production login surface (`apps/identity-platform`) is a **thin Next.js orchestrator** that proxies every stateful operation to `services/api-gateway` over HMAC-signed internal calls. The flows that exist (password login, OTP signup, magic link, reset, multi-account) are **real and individually coherent**, but ownership is **smeared across four apps and one gateway**, there is **no middleware-level enforcement** anywhere in the identity app, and one orchestration route (`/api/auth/switch`) contains an **unauthenticated account-takeover bug** (Phase 6, C-1).

**Can this become LetBuyy's single source of truth without a rewrite?** Not as-is. The *shell* and *flows* are salvageable; the *authority layer* (OIDC provider, key service, session/refresh service, consent ledger) **does not exist as running code** and must be built, while the seven-system sprawl must be collapsed. This is a **partial rebuild of the authority layer**, not a greenfield rewrite — see §6.

---

## 1. Ownership map — who actually owns each identity concern

| Concern | Owner in production | Mechanism | Authoritative file:line | Verdict |
|---|---|---|---|---|
| **Authentication (merchant/staff)** | `api-gateway` `/auth/custom/*`, orchestrated by identity-platform routes | password (bcrypt 12) + opaque session | gw `services/api-gateway/src/routes/auth.ts:411-480` (authenticate), id `apps/identity-platform/src/app/api/auth/login/route.ts:49-87` | REAL |
| **Authentication (customer/buyer)** | `auth-core` host-only provider | HS256 JWT `lb_customer_session` | `packages/auth-core/src/index.ts:693-764` | REAL (cleanly separated) |
| **Authentication (ops/platform)** | `platform-console` | 2-part HMAC token `lb_console_session` (+MFA flag) | `apps/platform-console/src/lib/console-session.ts:13-31` | REAL |
| **Sessions** | `api-gateway` `sessions` table | opaque `randomHex(32)`, 30-day, DB lookup | gw `routes/auth.ts:1035-1078` (mint), id `src/lib/auth/session.ts:7-32` | REAL, primitive |
| **Access tokens (API)** | none for humans; Supabase JWT on legacy path | `supabase.auth.signInWithPassword` | gw `routes/auth.ts:1244-1268` | LEGACY/parallel |
| **Refresh tokens / rotation / reuse-detection** | **nobody** | declared only as interfaces | `packages/session-core/src/index.ts:17-49` (interface) | **DEAD/STUB** |
| **MFA** | ops plane only (TOTP) | base32 HOTP-SHA1 | `apps/platform-console/src/lib/console-auth-server.ts:98-171` | REAL (ops only); **absent for merchants** |
| **Passkeys / WebAuthn** | **nobody** | flag exists, no implementation | `apps/identity-platform/src/lib/config/features.ts:14` (`FEATURE_PASSKEY`, no consumers) | **ABSENT** |
| **Consent** | **nobody** (OIDC consent route 501s) | — | `apps/identity-platform/src/app/oauth2/consent/route.ts:1-5` → 501 | **ABSENT** |
| **Logout** | identity-platform + 2 other apps (duplicated) | delete session row, clear cookie | `apps/identity-platform/src/app/api/auth/logout/route.ts:34-53` | REAL, duplicated ×3 |
| **Password reset** | identity-platform | single-use token → set-password → kill all sessions | `apps/identity-platform/src/app/api/auth/reset-password/route.ts:43-92` | REAL (good) |
| **Signup / email verify** | identity-platform | OTP (6-digit) → verify → password-set-intent | `apps/identity-platform/src/app/api/auth/signup/route.ts:35-138`; `verify-otp/route.ts:43-78` | REAL |
| **Magic links** | identity-platform | single-use `magic_link` token via GET | `apps/identity-platform/src/app/api/auth/send-magic/route.ts:84-90`; `verify/route.ts:63-122` | REAL |
| **OAuth / OIDC provider (SSO)** | **nobody** | every endpoint is a skeleton wrapper | `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts:50-104` | **501 SKELETON** |
| **OAuth (marketplace app-install)** | `app-marketplace` + gateway | real PKCE S256, gateway-issued bearer | `apps/app-marketplace/src/app/api/apps/[id]/install/route.ts:22-101` | REAL (but app-install, not human SSO) |
| **Service-to-service** | `auth-core` / `internal-auth` | HMAC-SHA256, 5-min window | `packages/auth-core/src/index.ts:602-691`; gw `src/lib/internal-auth.ts` | REAL |
| **Tenant scoping** | per-route app predicates over a `service_role` (BYPASSRLS) connection | `verifySiteOwnership` | gw `src/lib/auth-user.ts:40-67`; `packages/infrastructure/supabase-adapter/index.ts:34-39` | REAL but no safety net (Phase 7) |

**Reading:** the only concern with a clean, single, well-architected owner is **customer/buyer auth**. Every "platform" concern that SSO depends on (refresh, MFA-for-merchants, passkeys, consent, OIDC) is either absent or dead.

---

## 2. The seven auth systems (concurrent, overlapping secrets)

| # | System | Token format | Secret | Lifetime | Mint site |
|---|---|---|---|---|---|
| 1 | Merchant/staff web session | opaque 64-hex row token, cookie `lb_session` | DB lookup (token opaque) | 30 d | gw `routes/auth.ts:1047` |
| 2 | Customer/buyer session | HS256 JWT `lb_customer_session` (host-only) | `CUSTOMER_SESSION_SECRET` | 7 d | `auth-core/src/index.ts:708-711` |
| 3 | Platform-console session | 2-part `payload.hmac` `lb_console_session` | `PLATFORM_CONSOLE_SESSION_SECRET` ‖ `AUTH_SECRET` | 8 h | `auth-core` `signLetbuyyJsonPayload` |
| 4 | Multi-account list | HS256 JWT `lb_accounts` (10 accounts) | `AUTH_SECRET` (or dev literal) | 365 d | `apps/identity-platform/src/lib/auth/cookies.ts:171-176` |
| 5 | App-marketplace OAuth | gateway bearer + auth code (PKCE S256) | gateway secret family | 15-min code | `apps/app-marketplace/.../install/route.ts` |
| 6 | Internal service-to-service | HMAC-signed canonical headers | `INTERNAL_API_SECRET` ‖ `AUTH_SECRET` ‖ `WORKER_INTERNAL_API_SECRET` | 5-min freshness | `auth-core/src/index.ts:602-691` |
| 7 | Supabase-native (legacy, live) | Supabase GoTrue JWT (access+refresh) | Supabase | Supabase | gw `routes/auth.ts:1244-1268` |

Plus the **8th, dead** "v2 identity foundation": `session-core` / `token-core` / `permission-core` / `identity-core` / `audit-core` / `organization-core` (all interface-only) + `services/api-gateway/src/identity-foundation/*` (in-memory dormant factories, **zero runtime callers**, flag-gated off). Evidence: `packages/session-core/src/index.ts:17-49`; gw `identity-foundation/session-services.ts:29-114` (`createDormant*`); registry dormant by default `identity-foundation/auth-verifier-registry.ts:48-53`.

**Secret-reuse hazard.** `AUTH_SECRET` is the fallback signer for systems #3, #4, and #6 simultaneously: console session (`console-session.ts:24`), accounts cookie (`cookies.ts:12`), and internal HMAC (`auth-core/src/index.ts:451`). A single `AUTH_SECRET` rotation silently re-keys three trust domains; a single leak compromises all three.

---

## 3. Auth flow forensics (identity-platform orchestration → gateway)

The identity app holds **no database**. Every route is a stateless orchestrator that calls the gateway via `identityApiRequest` (`src/lib/api/client.ts`) with HMAC internal-session headers. Flows verified first-hand:

- **Lookup** `POST /api/auth/lookup` → returns `{exists, hasPassword, emailVerified}` (`lookup/route.ts:56-60`). **Enumeration oracle** — contrast with reset/magic which deliberately do not reveal existence.
- **Login** `POST /api/auth/login` → rate-limit (IP only, despite "IP + email" comment, `login/route.ts:22`) → CSRF → Turnstile → `/auth/custom/users/authenticate` → device → `createSession` → `setSessionCookie` + `addAccount` → store-count redirect (`login/route.ts:17-127`).
- **Signup** `POST /api/auth/signup` → rate-limit → CSRF → Turnstile → ensure user (unverified) → 6-digit OTP email (`signup/route.ts:35-138`). `verify-otp` → mark verified → create **password-set-intent** (sameSite=strict cookie) (`verify-otp/route.ts:54-78`) → `set-password` consumes intent server-side (`set-password/route.ts:46-96`). Good intent design.
- **Magic link** `send-magic` → single-use `magic_link` token (`send-magic/route.ts:84`); `GET /api/auth/verify?token=…&type=magic_link` mints a session (`verify/route.ts:92-99`). Token-in-URL via GET (referer/log-leak surface).
- **Reset** `send-reset` (no enumeration leak, `send-reset/route.ts:68-69`) → `reset-password` validates single-use token, sets password, **destroys all sessions**, mints fresh one (`reset-password/route.ts:49-92`). Strong.
- **Switch** `POST /api/auth/switch` → CSRF → look up *any* email from body → mint session if `email_verified` (`switch/route.ts:22-64`). **No ownership/possession check** — see Phase 6 C-1.
- **Logout** `POST /api/auth/logout` → destroy session, clear cookie, CORS-allowlisted (`logout/route.ts:34-69`). No CSRF (idempotent — acceptable).

**Structural observation:** there is **no `middleware.ts`** in `apps/identity-platform` (`find src -name middleware.ts` → none). Route protection, session attachment, and tenant context are therefore **opt-in per handler**. Nothing fails closed by default.

---

## 4. Session / cookie / JWT / token flows

- **Session flow:** opaque token minted by gateway (`routes/auth.ts:1035-1078`), stored HTTP-only in `lb_session` (`cookies.ts:76-83`, 30-day), validated by gateway DB lookup (`routes/auth.ts:266-348`), destroyed on logout (row delete). **No rotation, no idle timeout, no reuse detection, no integrity binding** (it is a bare random string).
- **Cookie flow:** five identity cookies (`session`, `csrf`, `accounts`, `device`, `passwordSetIntent`) all built from one `BASE_OPTIONS` (`cookies.ts:56-62`); parent-domain `.letbuyy.store` for platform-SSO realm vs host-only for customer realm. Full inventory in Phase 4.
- **JWT flow:** the only first-party JWTs are HS256 — customer session (`auth-core`) and the `lb_accounts` cookie (`cookies.ts:172-176`). All symmetric. **No asymmetric (RS/ES) signing anywhere in production**; the only EC key material is the literal-string `MOCK_JWKS` (`oidc-disabled.ts:4-16`).
- **Token flow (email):** OTP / email-verify / magic-link / password-reset are single-use DB tokens minted+validated by gateway (`src/lib/auth/tokens.ts`), correctly invalidated on use.

---

## 5. Current state vs target state

| Dimension | Current state (evidenced) | Target state (for SSOT/SSO) | Gap |
|---|---|---|---|
| Authority model | 7 parallel systems, no central issuer | 1 OIDC provider issuing tokens all clients verify | **Large** |
| Token signing | symmetric HS256 + opaque | asymmetric (ES256/RS256) + rotating JWKS | **Large** |
| Refresh/rotation | none (interface only) | rotation + reuse detection + revocation | **Large** |
| MFA | ops only | step-up MFA available to all realms | **Large** |
| Consent | 501 | consent ledger + UI (DPDP-aware) | **Large** |
| Enforcement | per-route, opt-in, no middleware | default-deny middleware + tenant context | **Medium** |
| Sessions | opaque, 30d, no idle timeout | bound, rotated, idle+absolute timeouts | **Medium** |
| Flows (login/signup/reset/magic) | real, coherent | reuse as-is | **Small** |
| Customer/merchant separation | clean | reuse as-is | **None** |

---

## 6. Violations, risks, recommendations

**Violations (architecture):**
1. **No single source of truth** — seven systems, three sharing `AUTH_SECRET` (§2).
2. **Authority layer is dead scaffolding** — `session-core`/`token-core`/`permission-core` etc. are interfaces with zero runtime callers (`packages/session-core/src/index.ts:17-49`; gw `identity-foundation/session-services.ts`).
3. **No default-deny enforcement** — no `middleware.ts`; protection is per-handler.
4. **Aspirational comments diverge from code** — `switch/route.ts:12` claims an accounts-cookie check that does not exist (becomes a security bug, Phase 6).
5. **OIDC surface advertises capabilities it cannot honour** — discovery lists `authorization_code`/`refresh_token`/`S256` while every endpoint 501s (`oidc-disabled.ts:50-104`).

**Risks:** secret-reuse blast radius (one leak ⇒ 3 domains); silent SSO breakage at the `.letbuyy.store`→`.letbuyy.com` cutover (cookie domain drift, Phase 4); the temptation to "flip a flag" and expose the mock OIDC/JWKS to real clients.

**Recommendations (analysis-only — not implemented):**
- Treat the "v2 identity foundation" as a **decision, not a default**: either fund it to completion (real key service, refresh rotation, consent) or **delete it** so the codebase stops implying capability it lacks.
- Collapse systems #1/#3/#4/#6 onto one issuer with **distinct, non-`AUTH_SECRET`-derived** keys per realm.
- Introduce a **default-deny middleware** in the identity app and a tenant-context guard in the gateway before exposing any SSO client.
- Do **not** enable `FEATURE_IDENTITY_PROVIDER`/`FEATURE_NEW_KEY_SERVICE` until the mock JWKS and 501 endpoints are replaced (Phase 2).

> Cross-references: OIDC depth → Phase 2; sessions → Phase 3; cookies → Phase 4; Turnstile → Phase 5; the account-takeover and secret findings → Phase 6; tenant model → Phase 7; SSO client readiness → Phase 12; consolidated scores/verdict → Phase 14.

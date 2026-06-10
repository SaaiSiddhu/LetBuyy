# LETBUYY — AUTH & IDENTITY AUTOPSY
### Phase 7 of the Foundation Autopsy · 2026-06-09 · evidence-only
### Questions: who owns identity/sessions/MFA/logout — and does authn + authz + tenant-scoping actually hold in prod?

---

## 0. Verdict up front

The **buyer-auth boundary and the ops-RBAC engine are real and decent**. Almost everything the contract leans on for *platform* trust is dead code, a skeleton, an unimplemented stub, or manual-only: the JWT-claims→tenant-GUC bridge is dead, OAuth2/PKCE is a 501 skeleton with a mock JWKS, the `session-core`/`permission-core` packages are empty interfaces, DPDP consent ledger is absent and DSR is a manual ticket tracker. Combined with an **S0 forgeable staff-console session secret** and a **mock-default KMS literal**, this is **not production-ready** for an India fintech-adjacent commerce platform.

---

## 1. There is no "auth system." There are six (plus a seventh).

| # | System / owner | Mechanism | Secret | Key files |
|---|---|---|---|---|
| 1 | Merchant/staff web session | opaque `randomHex(32)` row token, cookie `lb_session` | (token opaque; internal calls HMAC `INTERNAL_API_SECRET`) | mint `routes/auth.ts:1035-1078`; cookie `apps/identity-platform/.../auth/cookies.ts:76-97`; validate `routes/auth.ts:266-348` |
| 2 | Customer/buyer session | HS256 JWT `lb_customer_session`, host-only cookie | `CUSTOMER_SESSION_SECRET` | `packages/auth-core/src/index.ts:693-764`; middleware `customer-session.ts` |
| 3 | Platform-console (ops) session | signed JSON token `lb_console_session` (`mfaVerified` flag) | `PLATFORM_CONSOLE_SESSION_SECRET` ‖ `AUTH_SECRET` | `apps/platform-console/src/lib/console-session.ts` |
| 4 | "Accounts" multi-account cookie | jose `SignJWT` HS256 `lb_accounts` | `AUTH_SECRET` | `apps/identity-platform/.../auth/cookies.ts:11-20,171-188` |
| 5 | App-platform OAuth (marketplace apps → API) | HS256 JWT access tokens + auth codes | `AUTH_SECRET` family | `auth-core/src/index.ts:1013-1095`; `middleware/app-auth.ts` |
| 6 | Internal service-to-service | HMAC-SHA256 signed headers, 5-min window | `INTERNAL_API_SECRET`/`WORKER_INTERNAL_API_SECRET` | `lib/internal-auth.ts`; `auth-core/src/index.ts:602-691` |
| 7 | Supabase-native (still live) | `supabase.auth.*`, returns Supabase access/refresh tokens | Supabase | `routes/auth.ts:1212-1372`; `middleware/auth.ts:185-214` |

The gateway runs a **verifier registry that tries four auth methods in sequence per request** (`middleware/auth.ts:216-247`). **`packages/session-core` (~53 LOC) and `packages/permission-core` (~45 LOC) are interface-only stubs** — the advertised refresh-token rotation / reuse detection / revocation service **does not exist as running code**. **OAuth2/PKCE — a contract deliverable — does not exist**: every OIDC endpoint returns a 501/404 skeleton (`apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts:50-104`), JWKS is `MOCK_JWKS` with literal `'mock-x-coordinate'`, and grep for `code_verifier|code_challenge|pkce` returns nothing.

**Separation verdict:** buyer vs merchant is **cleanly separated** (different cookie, secret, realm, middleware — the one genuinely well-architected boundary). Merchant/staff/ops/apps are a **thicket** of four token formats plus a live Supabase path under overlapping `AUTH_SECRET`-derived secrets.

---

## 2. Ranked findings

### S0
- **S0-1 — Forgeable staff-console session via hardcoded secret fallback.** `apps/platform-console/src/lib/console-session.ts:23-31`:
  ```ts
  return secret || 'dev-only-console-session-secret';   // returned whenever NODE_ENV !== 'production'
  ```
  The prod branch correctly returns `null` on a weak secret — **but the gate is `NODE_ENV === 'production'` only**, ignoring `VERCEL_ENV`/`APP_ENV` (unlike the dev-bypass helper, which checks all four). On any internet-reachable deploy where `NODE_ENV` is unset or `development` (a common Vercel preview/staging misconfig), the ops-console signs/verifies sessions with the **public literal**, and anyone can forge an `lb_console_session` cookie with `mfaVerified:true`. Verified against source.
- **S0-2 — Mock-default KMS literal = secrets-at-rest are effectively plaintext.** `services/api-gateway/src/lib/crypto.ts`: `resolveKmsProviderFromEnv` defaults `LETBUYY_KMS_MODE` to `'mock'` (`:41`); the mock provider wraps every field-level encryption with the literal `'letbuyy-local-mock-kms-envelope-secret'` (`:7`). Live mode throws `KmsHumanRequiredError` (`:27`) — i.e. live KMS is unimplemented. Unless someone sets `LETBUYY_KMS_MODE=live` (which then fails), all "encrypted at rest" PII/payment-config is wrapped with a public string in git.

### S1
- **S1-1 — The claims→GUC tenant bridge is dead; tenant scoping is opt-in route discipline with no safety net.** Confirmed from the auth side: the gateway connects as `SUPABASE_SERVICE_ROLE_KEY` (BYPASSRLS, `infrastructure/supabase-adapter/index.ts:35`), and `tenantGucSetLocalStatement` (`tenant-core/src/index.ts:590`) is only ever *re-exported*, never executed — no `set_config`/`SET LOCAL`/`.rpc()` runs on a live connection. What actually enforces "a merchant only touches their own store" is **per-handler ownership predicates** (`verifySiteOwnership`, `lib/auth-user.ts:40-67`), applied route-by-route, NOT by middleware. In the routes sampled (products, orders, customers, analytics, employees) the check is present and correct — so there is no demonstrated active hole today — but with **60+ route files each hand-rolling the check and zero defense-in-depth behind it, one forgotten call is a full cross-tenant IDOR.**
- **S1-2 — Merchant opaque session has no integrity binding, no rotation, no reuse detection.** Bare `randomHex(32)` (`auth.ts:1047`), DB-lookup validation, 30-day lifetime, no idle timeout, logout = row delete. The `session-core` interfaces for rotation/revocation are unimplemented.
- **S1-3 — RBAC is split-brain.** The **ops/internal plane genuinely enforces stored `employee_permissions` scopes + break-glass + dual-control** (`middleware/rbac.ts:273-361`, `operations.ts:771,861`) — the strongest part of the system. The **merchant plane does NOT enforce per-staff scopes** — it's owner-or-nothing (`employee.ts` gates only on `verifySiteOwnership`), and the similarly-named merchant `requirePermission` (`middleware/permission.ts:112-141`) is **plan gating** (free/starter/business), not RBAC.

### S2
- **S2-1 — Gateway Turnstile dev-bypass is weaker than identity's.** `middleware/security.ts:222-224` accepts `'dev-bypass-token'` if any of `ENVIRONMENT|APP_ENV|NODE_ENV` ∈ {local,development} — **no feature flag required**. A stray `APP_ENV=development` disables bot protection on the gateway.
- **S2-2 — `letbuyy.store` hardcoded as prod cookie domain** (`cookies.ts:53-54`) while canonical is `letbuyy.com` and gateway helpers default to `.com` → SSO cookie-domain mismatch.

---

## 3. Mobile login — CHANGED from the prior audit (no longer structurally blocked)

Contrary to the earlier mobile-audit memory: the Flutter `StoreAuthService` is now a **real HTTP client** to `https://accounts.letbuyy.com` (CSRF fetch → `/api/auth/login|signup|verify-otp` → extract `lb_session` → validate `/api/auth/session`); the **PlatformBlocked allowlists are now EMPTY** (`merchant_feature_definitions.dart:79`, `platform_blocked_service.dart:26`) — the ~10 host-sentinel domains are gone; **Turnstile is real** and rejects `SKIP_NEEDS_HUMAN_` tokens (`store_auth_service.dart:364-375`). **The blocker is now operational, not structural:** prod login works *iff* the build is given a real `TURNSTILE_SITE_KEY` (`dart-define`); otherwise it defaults to `SKIP_NEEDS_HUMAN_…`, the challenge shows "Verification temporarily unavailable," and login **fails closed**. OTP is real; PKCE is absent (mobile uses cookie-session, not OAuth2).

---

## 4. DPDP / DSR (contract deliverables)

- **Consent ledger: ABSENT** as a first-class identity feature. The only consent persistence is WhatsApp opt-in (`routes/whatsapp.ts:637-650`, with a `dpdp_purpose` column) — not a DPDP consent ledger.
- **DSR: PARTIAL** — a manual staff ticket tracker (`data_subject_requests` table + `apps/platform-console/.../compliance/page.tsx` + `lib/internal-compliance.ts`), with sensitive-action types `customer.dsr.export|erase`. There is **no automated export bundler or actual erasure execution** — it logs and tracks; the real work is left to manual operators.

---

## 5. Positives (verified, not assumed)

- **`DEV_AUTH_BYPASS` is genuinely gated to local** — every read is triple-conditioned (NOT-prod across 4 vars + `NODE_ENV==='development'` + explicit flag), with a dedicated validator (`scripts/validators/dev-auth-bypass-validator.mjs`). A prod misconfig **cannot** enable the identity bypass.
- The shared dev secret lives only in `scripts/dev/setup-local-env.mjs` and is **gitignored at runtime** (no committed secret).
- **Merchant TOTP 2FA is real** (AES-GCM encrypted secret, refuses `SKIP_NEEDS_HUMAN_` keys, `routes/two-factor.ts:55-57`).
- **Cookie flags correct** (`httpOnly:true, secure:true, sameSite:'lax'`; CSRF `sameSite:'strict'`, real double-submit verified by the Flutter client echoing the token).

---

## Verdict

**Authn: partially, with a forgeable-staff-session landmine** (S0-1) and an unimplemented OAuth2/PKCE deliverable. **Authz: split-brain** — real scope enforcement on the ops plane, owner-only on the merchant plane. **Tenant-scoping: holds today only by hand-discipline with no DB safety net** — the promised RLS/GUC isolation is non-functional (gateway is BYPASSRLS service_role; the GUC is never set), so isolation is one forgotten `.eq('site_id', …)` away from a cross-tenant breach. Fix order: (1) close the console-session secret gate and unify it on the 4-var prod check; (2) make KMS fail-closed instead of defaulting to a mock literal; (3) put tenant scoping into enforced middleware (or actually wire RLS + the GUC); (4) implement or delete the OAuth2/PKCE and `session-core`/`permission-core` stubs so the contract matches reality.

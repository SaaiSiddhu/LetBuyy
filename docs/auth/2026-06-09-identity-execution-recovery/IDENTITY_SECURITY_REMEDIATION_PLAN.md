# IDENTITY SECURITY REMEDIATION PLAN
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY · architecture FROZEN
### Every item: file:line evidence · impact · risk · remediation · effort. Ranked Critical → Low.

> Re-verified against current source this pass. All three Criticals confirmed still live. **Positive note (re-verified):** `src/proxy.ts:59-61` sets `X-Frame-Options: DENY` + `X-Content-Type-Options: nosniff` + `Referrer-Policy` — clickjacking is **not** an open finding (the earlier audit's M-10 is retracted). The proxy is real Next-16 middleware but **passes `/api/*` through** (`proxy.ts:28-30`), which is why the API-route findings below stand.

---

## CRITICAL — remediate in Wave 0, before anything else

### SEC-C1 · Unauthenticated account takeover via `/api/auth/switch`
- **Evidence:** `src/app/api/auth/switch/route.ts:22` reads `email` from the request body; `:52` checks only `email_verified`; `:61` mints a session (`createSession`) and `:64` sets `lb_session` — **no possession proof**. Comment `:12` claims an accounts-cookie check that does not exist; `getAccounts()` is called only in `accounts/route.ts`; `proxy.ts:28-30` skips `/api/`.
- **Attack path:** load any accounts page → middleware mints JS-readable `letbuyy_csrf` (`proxy.ts:50`) → replay it as cookie+`X-CSRF-Token` with body `{email: victim}` → receive victim's `lb_session`. No credentials, no rate-limit, no Turnstile.
- **Impact / risk:** takeover of **any email-verified merchant/staff account**; full store/tenant compromise. **Exploitability: trivial.**
- **Remediation:** require an authenticated current session **and** verify target ∈ signed `lb_accounts`; add rate-limit + Turnstile; or disable `/switch` until multi-account is real. Add a regression test that fails if reintroduced. **Effort: S.**

### SEC-C2 · Forgeable ops super-admin session (checked-in dev secret)
- **Evidence:** `apps/platform-console/src/lib/console-session.ts:30` returns literal `'dev-only-console-session-secret'` whenever `NODE_ENV !== 'production'` (`:26`); gate is `NODE_ENV`-only (sibling `console-auth-server.ts:138-142` checks `NODE_ENV`+`APP_ENV`+`VERCEL_ENV`).
- **Impact / risk:** on any reachable deploy with `NODE_ENV` unset/`development`, an attacker forges `lb_console_session` with `mfaVerified:true` → platform-wide ops control.
- **Remediation:** delete the literal; fail-closed on unsafe secret; unify the 3-var prod gate. **Effort: S.**

### SEC-C3 · Default mock KMS ⇒ data-at-rest wrapped with a checked-in literal
- **Evidence:** `services/api-gateway/src/lib/crypto.ts:180` defaults `LETBUYY_KMS_MODE` to `'mock'`; `:146` mock provider secret = literal `'letbuyy-local-mock-kms-envelope-secret'`; live mode throws (unimplemented).
- **Impact / risk:** all "encrypted at rest" PII/payment-config is effectively plaintext to anyone with repo + ciphertext.
- **Remediation:** provision real KMS (HR-KMS-LIVE); make non-mock mandatory in prod (throw if `mock` when `APP_ENV=production`); rotate data wrapped with the literal. **Effort: M** (depends on KMS provisioning).

---

## HIGH — Wave 0/1

| ID | Finding | Evidence | Impact | Remediation | Effort |
|---|---|---|---|---|:--:|
| SEC-H1 | `service_role`/BYPASSRLS default; dead RLS net | `packages/infrastructure/supabase-adapter/index.ts:35`; `services/api-gateway/src/lib/supabase.ts:10`; dead GUC `tenant-core/src/index.ts:590-629` | one missing per-route check = cross-tenant IDOR; SSO multiplies blast radius | query-guard now; wire RLS 2nd layer (Wave 1, pulled forward) | M |
| SEC-H2 | Static shared-token super-admin principal | `services/api-gateway/src/middleware/auth.ts:224-226` (`role:'super_admin'`) | single shared token = full ops read identity | scope/rotate `PLATFORM_CONSOLE_API_TOKEN`; per-principal attribution | S |
| SEC-H3 | Forgeable `lb_accounts` (dev signing key, `NODE_ENV`-only) | `src/lib/auth/cookies.ts:11-19` | PII cookie forgeable on non-prod `NODE_ENV` deploy | unify 4-var gate; or move list server-side | S |
| SEC-H4 | `AUTH_SECRET` reused across 3 trust domains | `console-session.ts:24`; `cookies.ts:12`; `auth-core/src/index.ts:451` | one leak compromises console+accounts+internal HMAC | per-realm asymmetric keys (Wave 5); retire shared HMAC (Wave 8) | L |
| SEC-H5 | Mock OIDC/JWKS one flag from real RPs | `src/lib/identity-foundation/oidc-disabled.ts:4-16,76-88` | enabling flags publishes an unusable issuer | keep flags prod-forbidden until real key service (Wave 5 gate) | S (gate) |
| SEC-H6 | Gateway Turnstile bypass needs no flag | `services/api-gateway/src/middleware/security.ts:199-205,222-224` | `APP_ENV=development` disables bot protection at gateway | converge on strict flag-gated verifier (Wave 1) | M |
| SEC-H7 | `/switch` + `/lookup` lack rate-limit/Turnstile; `/lookup` enumerates | `switch/route.ts` (CSRF-only); `lookup/route.ts:56-60` | brute-force/enumeration | add throttle+bot-check; non-enumerating lookup | S |

---

## MEDIUM — Wave 1/4

| ID | Finding | Evidence | Remediation |
|---|---|---|---|
| SEC-M1 | `lb_accounts` "encrypted" = signed (not encrypted) PII, 365d | `src/lib/auth/cookies.ts:171-176` | JWE or shorten TTL + minimize PII |
| SEC-M2 | Non-constant-time CSRF compare | `src/lib/auth/csrf.ts:14` (`===`) | use `timingSafeEqual`; one CSRF module |
| SEC-M3 | Magic-link/verify token in URL via GET | `src/app/api/auth/verify/route.ts:16,26-28` | single-use (ok) + short TTL + referrer-policy already set; consider POST-confirm |
| SEC-M4 | Login rate-limit keyed by IP only (comment says IP+email) | `src/app/api/auth/login/route.ts:22` | add per-account dimension |
| SEC-M5 | Supabase legacy signup auto-confirms email + trusts client role | gw `routes/auth.ts:1214-1241` | delete legacy path (Wave 7) |
| SEC-M6 | `verification_tokens` stored plaintext | migration `000_baseline`; target hashes them | hash at rest (Wave 4; corpus TOKEN_STRATEGY §5) |
| SEC-M7 | In-memory auth fallback maps reachable in prod-shaped code | gw `routes/auth.ts:82-85` | remove local-Map path |
| SEC-M8 | No merchant MFA; no account-recovery/lockout flow | `FEATURE_PASSKEY` unused; corpus G-6 | build recovery before MFA enforce (Wave 4/5) |

---

## LOW — opportunistic

| ID | Finding | Evidence |
|---|---|---|
| SEC-L1 | Dual CSRF cookie names accepted | `csrf.ts:22` |
| SEC-L2 | No `__Host-`/`__Secure-` cookie prefixes | `cookies.ts:56-62` |
| SEC-L3 | Weak password policy (8 / 1 upper / 1 digit; no length≥12/breach check) | `src/lib/auth/password.ts:13-17` |
| SEC-L4 | Opaque session: no idle timeout, no rotation, no reuse detection | `cookies.ts:81` (30d); validate path writes `last_active`, never enforces |
| SEC-L5 | Device cookie no revocation surface | `cookies.ts:152-159` |

---

## Remediation sequencing (maps to waves)
- **Wave 0 (this week):** SEC-C1, SEC-C2, SEC-C3, SEC-H2, SEC-H3, SEC-H7 — all small/medium, mostly independent of the architecture build.
- **Wave 1:** SEC-H1 (RLS net), SEC-H6 (Turnstile convergence), SEC-M2/M4/M7, SEC-L1.
- **Wave 4 (hardening):** SEC-M1/M6/M8, SEC-L2/L3/L4, refresh rotation + reuse detection.
- **Wave 5:** SEC-H5 lifts when real key service replaces mock; SEC-H4 begins (per-realm keys).
- **Wave 7/8:** SEC-M5 (delete legacy Supabase), SEC-H4 completes (retire shared HMAC), service_role decomposition.

> Governance hook: each Critical + SEC-H6 must land with a **CI gate that fails if reintroduced** (`IDENTITY_GOVERNANCE_MODEL §4.1`) — secret-literal grep, single-Turnstile-verifier import assertion, `/switch` regression test.

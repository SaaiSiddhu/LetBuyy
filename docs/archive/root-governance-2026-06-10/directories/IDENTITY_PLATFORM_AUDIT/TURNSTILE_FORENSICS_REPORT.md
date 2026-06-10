# TURNSTILE FORENSICS REPORT
### Phase 5 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## 0. Verdict

Turnstile is **genuinely enforced and fails closed** on the four credential-issuing identity endpoints (login, signup, send-magic, send-reset), and the identity-platform dev-bypass is **tightly gated** (requires non-prod **and** `NODE_ENV=development` **and** an explicit flag). Two real problems remain: (1) **coverage gaps** — the bot check is **absent on `/api/auth/switch` (the account-takeover path) and `/api/auth/lookup` (the enumeration oracle)**; and (2) **validator divergence** — the gateway runs a *second*, **looser** Turnstile verifier whose dev-bypass needs no feature flag, so the effective bypass posture depends on which surface a request hits and which env vars that surface sees. The server-side verify also checks only `success`, not `hostname`/`action`/timestamp, so a token is **not bound to the action it was issued for**.

---

## 1. The identity-platform verifier (strong)

```ts
// apps/identity-platform/src/lib/turnstile.ts:7-34
export async function verifyTurnstileToken(token, ip) {
  if (token === 'dev-bypass-token') return canUseIdentityDevAuthBypass(process.env)   // strict gate
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) { console.warn('… failed closed'); return false }                    // fail-closed
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { … })
  const data = await response.json()
  return data.success === true                                                          // only success checked
}
```
- **Server-side:** ✅ real call to Cloudflare siteverify with the secret.
- **Fail-closed:** ✅ missing secret ⇒ `false` (`:13-16`).
- **Dev bypass gate (strict):** `canUseIdentityDevAuthBypass` = `!isProductionIdentityRuntime` **and** `NODE_ENV==='development'` **and** `LETBUYY_ENABLE_DEV_AUTH_BYPASS==='true'`, where `isProductionIdentityRuntime` checks `NODE_ENV`/`APP_ENV`/`VERCEL_ENV`/`NEXT_PUBLIC_ENV` (`dev-auth-bypass.ts:13-23`). Hard to trip accidentally.

---

## 2. Enforcement coverage map

| Endpoint | Turnstile? | CSRF? | Rate-limit? | Evidence |
|---|:--:|:--:|:--:|---|
| `POST /api/auth/login` | ✅ | ✅ | ✅ | `login/route.ts:31,42` |
| `POST /api/auth/signup` | ✅ | ✅ | ✅ | `signup/route.ts:49,60` |
| `POST /api/auth/send-magic` | ✅ | ✅ | ✅ | `send-magic/route.ts:28,39` |
| `POST /api/auth/send-reset` | ✅ | ✅ | ✅ | `send-reset/route.ts:28,39` |
| `POST /api/auth/verify-otp` | ❌ | ✅ | ✅ | `verify-otp/route.ts:29` (no Turnstile; OTP-gated) |
| `POST /api/auth/reset-password` | ❌ | ✅ | ✅ | `reset-password/route.ts:32` (token-gated) |
| `POST /api/auth/set-password` | ❌ | ✅ | ✅ | `set-password/route.ts:36` (intent-gated) |
| `POST /api/auth/switch` | ❌ | ✅ | ❌ | `switch/route.ts:18` — **no Turnstile, no rate-limit** |
| `POST /api/auth/lookup` | ❌ | ❌ | ✅ | `lookup/route.ts:15` — **no Turnstile, no CSRF** |
| `GET /api/auth/verify` | ❌ | n/a (GET link) | ✅ | `verify/route.ts:21` |
| `oauth2/*` | n/a | n/a | n/a | all 501 (Phase 2) |

**Two gaps that matter:**
- **`/api/auth/switch`** — the unauthenticated account-takeover path (Phase 6 C-1) has **neither Turnstile nor rate-limit**, only CSRF (which an attacker satisfies same-origin). Bots can hammer it.
- **`/api/auth/lookup`** — the user-enumeration oracle has **no Turnstile and no CSRF**, only IP rate-limiting (10/15 min, `rate-limit.ts:19`). Distributed enumeration is feasible.

---

## 3. Validator divergence (gateway vs identity)

The gateway implements an **independent** Turnstile verifier with a **looser** bypass:
```ts
// services/api-gateway/src/middleware/security.ts:219-249
if (token === 'dev-bypass-token') return isLocalTurnstileRuntime(env)   // :222-224
// isLocalTurnstileRuntime (:199-205): ENVIRONMENT|APP_ENV|NODE_ENV ∈ {local,development} — NO feature flag required
```
Differences from identity's verifier: (a) **no `LETBUYY_ENABLE_DEV_AUTH_BYPASS` flag** required; (b) gated on three env names where a stray `APP_ENV=development` alone disables bot protection; (c) request body encoded as `URLSearchParams` vs identity's JSON. Two validators with two bypass predicates = the effective posture depends on which runtime (Next vs Worker) and which env the request traverses. This is a drift hazard (Phase 10 C1).

---

## 4. Replay / expiry / ownership / binding

- **Replay:** Cloudflare consumes a token on first `siteverify`, so cross-request replay is mostly mitigated *by Cloudflare* — but the code passes **no `idempotency_key`** and does not record token use itself, so it relies entirely on the provider.
- **Expiry / freshness:** the code does **not** inspect `challenge_ts` age. A token captured and used within Cloudflare's validity window is accepted.
- **Hostname / action binding:** the response's `hostname`, `action`, and `cdata` are **never checked** (`turnstile.ts:30` returns on `success` alone). If `TURNSTILE_SECRET_KEY` is shared across surfaces, a token solved on one page/action is valid for another — there is no action binding.
- **Token ownership:** not bound to the session or email; any solved token works for any caller.

---

## 5. Flag interaction (can it be turned off?)

`FEATURE_TURNSTILE` (`features.ts:20`) gates the **client widget rendering**, not the server check — the protected routes always call `verifyTurnstileToken(turnstileToken || '')`. So if the flag is off, the widget isn't shown, the token is empty, `siteverify` returns `success:false`, and the route **fails closed (403)** rather than allowing the request. Net effect: Turnstile is effectively **mandatory** on the four covered routes and cannot be silently disabled from the client — a good property. The only bypass is `dev-bypass-token` under the strict gate.

---

## 6. Mobile

The Flutter client **hard-blocks** auth when the Turnstile token is empty or a `SKIP_NEEDS_HUMAN_…` placeholder (`apps/mobile/merchant-app/lib/services/store_auth_service.dart:364-375`), and the default build config ships exactly that placeholder (`config/app_config.dart:36-45`) — so default mobile builds **fail closed** (login broken until a real site key is provided). Secure by default, operationally fragile.

---

## 7. Recommendations (analysis-only)
Add Turnstile + rate-limit to `/api/auth/switch` and Turnstile to `/api/auth/lookup`; verify `hostname` and `action` (and reject stale `challenge_ts`) in `verifyTurnstileToken`; converge the gateway and identity verifiers onto one shared implementation with one bypass predicate (the strict, flag-gated one); pass an `idempotency_key` so replay protection does not rely solely on Cloudflare.

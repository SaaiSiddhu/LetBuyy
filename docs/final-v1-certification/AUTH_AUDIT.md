# Phase D — Authentication & Authorization Audit

**HEAD `587dc988`. Asymmetric sole-issuer model — PRESERVED.**

| Surface | Status | Evidence |
|---|---|---|
| **Merchant JWT** | ES256/EdDSA only | `identity-issued-session.ts:36–69` issues; `identity-session-verifier.ts:42–109` verifies vs JWKS, **hard-rejects non-asymmetric alg twice** (`:57–59`, `:95–97`), no symmetric path |
| **Customer auth** | HS256, separate realm | `auth-core/customer-session.ts:28–103`, `CUSTOMER_SESSION_SECRET`, 30-min TTL, timing-safe compare; issuers never crossed |
| **Step-up auth** | real HMAC-SHA256 | `security-controls.ts:126–243`; binds action+actor+site, 10-min window, **rejects `SKIP_NEEDS_HUMAN_`/`replace-with` placeholders + <32-char**; wired `payouts.ts:576`, `payments.ts:492` |
| **OAuth / OIDC / PKCE** | inert (501 skeleton) | `oidc-disabled.ts:99–176` returns 501/404 behind `FEATURE_IDENTITY_PROVIDER` (off). **No live OAuth/PKCE in V1** — not a gap, out of scope |
| **Session handling** | opaque DB session + rotation | `validate_and_rotate_merchant_session` (`merchant-session.ts:62–96`); ES256 verified at *creation* (`auth.ts:1128`), per-request = internal-HMAC + DB lookup |
| **Cookie security** | httpOnly + CSRF | customer/merchant sessions httpOnly; CSRF token issued on register (`customer-registration.ts`); identity flows gated by CSRF (`signup/route.ts:60`) |
| **CSRF** | enforced on identity mutations | signup/switch/create-store check CSRF |
| **Refresh flow** | session rotation on validate | rotation inside `validate_and_rotate_merchant_session` |
| **Anonymous access** | fail-closed | RLS `REVOKE ... FROM anon` (mig 163:202–214); Turnstile fails closed without secret (`security.ts:226`) |
| **Privilege escalation** | `/auth/switch` takeover FIXED | `auth/switch/route.ts:30–137` requires valid current session + target email ∈ signed `lb_accounts` cookie (`:69–81`); d3 test proves HS256-forged token rejected |

## Caveats (not breaks)
1. **[Medium]** Per-request merchant trust root is the shared `INTERNAL_API_SECRET` (ES256 not re-verified per request). `internal-auth.ts:40–52` `INTERNAL_AUTH_LEGACY_ACCEPT` defaults **ON** → all ~10 runtimes sharing the secret can mint accepted internal headers until per-caller keyring is provisioned (`HR-SECRET-ROTATION`).
2. **[Medium]** Merchant teams RBAC: `site_memberships` roles/permissions computed (`tenant-context.ts:92–183`) but **never enforced** — `buildOwnedTenantContext:192–195` throws for any non-owner before permissions are read. Effectively owner-only.

## Production blockers (fail-closed, need provisioning)
`LETBUYY_IDENTITY_PRIVATE_JWK` (`identity-issued-session.ts:42–44` throws if absent), `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `STEP_UP_SIGNING_SECRET`, `CUSTOMER_SESSION_SECRET` — all `SKIP_NEEDS_HUMAN_*` placeholders today. Signup/login are hard-blocked in prod until provisioned (safe-closed).

**Verdict: auth design is sound and the headline takeover is fixed. The residual risk is operational (shared internal secret) and a dormant RBAC layer, not a broken issuer model.**

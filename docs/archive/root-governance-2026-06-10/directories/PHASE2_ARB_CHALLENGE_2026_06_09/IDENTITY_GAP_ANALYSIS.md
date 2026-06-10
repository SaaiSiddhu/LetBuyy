# LetBuyy ARB CHALLENGE — Identity & Auth Gap Analysis (Phase 2)

**Date:** 2026-06-09
**Role:** Principal Security Architect + Principal Identity Architect (ARB challenge panel)
**Decision context:** ₹10-crore / 2-year build-or-buy. READ-ONLY codebase review.
**Challenged priors:** `LETBUYY_MASTER_FORENSICS_AND_FOUNDATION_VERDICT.md`; `FOUNDATION_FORENSICS_2026_06_09/LETBUYY_IDENTITY_FORENSICS.md` (Identity 34/100, Auth-Security 41/100).
**Method:** Trust only code/imports/runtime wiring. `docs/auth/*` treated as claims to disprove. Every claim carries `path:line`.

---

## 0. TL;DR — what the prior verdict got right, what it MISSED

The prior identity forensics is **substantially correct** on the structural facts (service-role → RLS inert; dormant V2; two auth paths; MFA-not-enforced; shared admin TOTP; static console super-admin token). I **confirm** those.

What it **MISSED or under-weighted** — and what this challenge adds:

1. **It scored the internal HMAC header trust as a flat "strength" (F19)** without analysing the *forgery attack chain*. The HMAC is cryptographically sound, but it is **the sole barrier to full identity impersonation on a publicly-reachable gateway**, and it is signed with a **shared, multi-purpose secret** (`AUTH_SECRET`) whose rotation is still an open TODO. That combination is a **CRITICAL identity-forgery exposure**, not a strength.
2. **It did not test maker-checker on the money path.** Dual-control machinery is real (`rbac.ts:203`) but **payout release does NOT use it** (`payouts.ts:464`). The Freeze mandate is **unmet for payouts** — self-approval is possible.
3. **It audited only platform CSRF.** The **customer storefront mutation routes have zero CSRF tokens** and rely solely on `SameSite=Lax` (`customer/profile/route.ts`, etc.).
4. Several NEW findings below (CSRF bypass for internal header, secret-reuse blast radius enumerated, account-enumeration oracle on the reset/intent flow, internal-header replay window).

I also **REFUTE two prior items in the platform's favour**: the fail-open internal-payment route is now **fail-closed**; the subscription-verify "replay any signature" comment is now **mitigated by a real capture check**.

**Corrected Security score: 36/100** (prior 38/41). Slightly *lower* because the forgery chain + payout self-approval are more consequential than the prior framing, partially offset by the two genuine fixes.

---

## 1. THE CRUX — Internal HMAC Header Trust & Forgery Verdict

### 1.1 How identity is asserted, signed, and verified

The gateway accepts identity from front-end apps via two HMAC-signed header families, tried for **any request without a `Bearer` token** inside `authMiddleware`:

- **Identity headers** (`X-LetBuyy-Internal-User-ID / -Email / -Store-ID / -Timestamp / -Signature`) → `getInternalAuthContext` (`services/api-gateway/src/middleware/auth.ts:96-128`). Signed payload = `` `${userId}.${email}.${storeId||''}.${timestamp}` `` (`auth.ts:115`), verified by `verifySignedPayload` (`auth.ts:116`).
- **Session headers** (`X-LetBuyy-Internal-Session-Token / -Timestamp / -Signature`) → `getInternalSessionAuthContext` (`auth.ts:130-183`); the signed token is then looked up in the `sessions` table.

Signing/verification primitives (`packages/auth-core/src/index.ts`):
- `verifyLetbuyySignedPayload` (`:592-600`) → HMAC-SHA256 (`hmacSha256Bytes :1106-1116`) + `timingSafeEqualHex` (`:577-586`). **Timing-safe: YES.**
- Freshness: `isFreshLetbuyyInternalTimestamp` (`:562-570`) accepts `|now − ts| ≤ LETBUYY_INTERNAL_AUTH_MAX_AGE_MS` = **5 min** (`:132`). **±5 min → a 10-minute acceptance window.**

### 1.2 The secret that signs it — REUSED

`getLetbuyyInternalAuthSecret(env)` = **`INTERNAL_API_SECRET || AUTH_SECRET`** (`packages/auth-core/src/index.ts:447-452`). The gateway additionally accepts `WORKER_INTERNAL_API_SECRET` (`services/api-gateway/src/lib/internal-auth.ts:17-24`, multi-secret rotation set).

Apps sign with the **same** resolution:
- `apps/identity-platform/src/lib/api/client.ts:117-131` — `getLetbuyyInternalAuthSecret({ INTERNAL_API_SECRET, AUTH_SECRET })` → `createLetbuyyInternalSessionHeaders`.
- `apps/merchant-control-plane/src/lib/api/client.ts:63-67` — identical.

**`AUTH_SECRET` is not single-purpose.** The same value also:
- signs the `lb_accounts` multi-account cookie — `apps/identity-platform/src/lib/auth/cookies.ts:13` (`process.env.AUTH_SECRET`);
- AES-GCM-encrypts merchant TOTP seeds — `routes/two-factor.ts:54-58` (prior F10);
- is the app-platform OAuth token secret — `app-store.ts:110-115` (`appPlatformTokenSecret = INTERNAL_API_SECRET || AUTH_SECRET`, per FORENSIC_REPORT/06-apps-ecosystem.md:152).

So **one secret simultaneously**: (a) forges any internal identity header, (b) forges `lb_accounts`, (c) decrypts every TOTP seed, (d) mints app access tokens. This is the **single highest-value secret in the system** and the prior report rated its reuse only MEDIUM (F10). Its rotation is an **open, unchecked TODO** (`tasks/todo.md`: "Rotate auth secret (`AUTH_SECRET`)" — unchecked).

### 1.3 Gateway is PUBLICLY reachable — CORS is not a forgery barrier

- Production route: `{ pattern = "api.letbuyy.store", custom_domain = true }`, `workers_dev = false` (`services/api-gateway/wrangler.toml:212-215`). DNS-resolvable on the open internet.
- **No mTLS, no Cloudflare Access, no IP allowlist, no shared-network gate** anywhere on the request path (grep across `index.ts` + middleware: only `CF-Connecting-IP` for rate-limit keying; the only "internal subrequest" header is the GraphQL REST shim, unrelated to auth).
- **CORS** (`index.ts:608-625`) reflects origin **only from an allowlist** (`resolveCredentialedCorsOrigin`, `lib/cors.ts:93-106`) with `credentials:true` — correct, **no `*`-with-credentials**. And `allowHeaders` does **not** list `X-LetBuyy-Internal-*` (`index.ts:614`), so a *browser* cannot send forged internal headers cross-origin.

**But CORS is a browser control. A non-browser attacker (curl/script) bypasses it entirely.** The gateway will read forged `X-LetBuyy-Internal-*` headers from any client that can reach `api.letbuyy.store`. **The ONLY thing standing between an arbitrary internet client and full merchant/admin impersonation is knowledge of the HMAC secret.**

### 1.4 FORGERY VERDICT

| Question | Answer | Evidence |
|---|---|---|
| Can a **customer/storefront** request forge these? | **No** — browser is CORS-bound and never holds the secret. | `index.ts:614` (header not allow-listed); secret is server-only. |
| Can a **3rd-party app** forge these? | **No** via the public API (apps get scoped JWTs, not the internal secret). | `auth-core` app-token path `:1013-1095`. |
| Can **anyone who obtains `AUTH_SECRET`/`INTERNAL_API_SECRET`** forge them? | **YES — total compromise.** Forge `X-LetBuyy-Internal-User-ID = <any merchant/admin UUID>` + email + valid HMAC → gateway accepts as that principal on every authenticated route, **CSRF is auto-bypassed** (§3.1), and **payouts can be self-released** (§2). | `auth.ts:96-128`; `security.ts:263-266`; `payouts.ts:487-496`. |
| Is the secret hard to obtain? | **Weaker than it should be.** It is reused across ≥4 cryptographic purposes (§1.2), present in every front-end app's runtime env (`identity-platform`, `merchant-control-plane`, `mobile-bff`, gateway, webhook-service, queue-workers), and **flagged for rotation but not yet rotated** (`tasks/todo.md`). Any single leak (a log, a misconfigured preview env, an SSR error, a compromised CI var) = platform-wide identity forgery with no second factor and audit attributed to the impersonated user. |
| Replay protection? | **Weak.** Identity headers have **no nonce/jti** — only a ±5-min timestamp (`auth-core:562-570`, `:132`). A captured valid identity header **replays for ~10 minutes**. Session headers replay-bind to a DB token (better). | `auth.ts:96-128` vs `:130-183`. |

**Net: identity CAN be forged, conditional on possession of the shared HMAC secret — which is over-shared, multi-purpose, internet-reachable in effect, and not yet rotated.** This is the correct severity framing the prior report omitted: **the internal HMAC is not a "strength," it is a single shared bearer secret protecting the entire identity plane of a publicly-exposed gateway.** **Severity: CRITICAL** (conditional, but the condition is one secret-leak away and the secret is deliberately reused).

---

## 2. Maker-Checker on Payouts — MANDATE UNMET

**The Freeze mandated dual-control on payouts. It is NOT enforced.**

- `POST /payouts/:id/settle` (`services/api-gateway/src/routes/payouts.ts:464-581`) gates release on **`verifySensitiveActionStepUp`** only (`:487-496`).
- `verifySensitiveActionStepUp` (`services/api-gateway/src/lib/security-controls.ts:27-83`) takes **only** `{ action, actorId, token, verifiedAt }`. It validates a step-up token's plausibility + a 10-minute freshness window. **There is no second-approver parameter, no comparison that approver ≠ maker, no approval record.** The `actorId` is `tenant.userId` — the **same merchant** who created the payout (`payouts.ts:489, 376`).
- **The same actor creates the statement (`POST /` :313) and releases it (`POST /:id/settle`).** Self-approval of money movement is possible with one step-up re-auth.

**This is a precise, sharp gap because the dual-control capability EXISTS and is real elsewhere:**
- `middleware/rbac.ts:203-207` — `requiresDualControl.has(targetAction) && (!secondaryApproverId || secondaryApproverId === actorId)` → `DUAL_CONTROL_REQUIRED` (409). True four-eyes with self-approval rejection.
- Used by ops runtime commands (`routes/operations.ts:790-813`) and developer-review approvals (`routes/operations/developers.ts:190-326`).

**The platform built four-eyes for ops/developer actions but did not wire it to merchant payout release.** Money movement — the highest-risk action — is the one path without it. **Severity: HIGH.** (Step-up + idempotency + ledger posting are present and good; the missing control is specifically the second human.)

---

## 3. Realm Migration (Phase F) — GO / NO-GO

**Verdict: conditional NO-GO on the merchant realm as-is; the customer realm is already migration-ready.** A clean Merchant/Customer/Admin realm split is achievable but requires un-commingling the merchant realm first.

### 3.1 Ownership table — who owns each primitive, where, and at what maturity

| Concern | Owner module | Cookie / token | Secret | Maturity |
|---|---|---|---|---|
| **Customer session** | `packages/auth-core` (`createCustomerSessionToken :693`, `verifyCustomerSession`) + `apps/storefront-runtime/src/lib/session.ts` | `lb_customer_session` JWT, **host-only**, `SameSite=Lax` (`session.ts:62,113`) | `CUSTOMER_SESSION_SECRET` (distinct) | **Real & isolated** — migration-ready |
| **Customer federation** (cross-store SSO handoff) | `auth-core :806-902` | signed JWT, `jti`, single-use via `consume()` store | `CUSTOMER_SESSION_SECRET` | **Real** (replay-protected) |
| **Merchant session** | `routes/auth.ts:1035-1106` (opaque DB `sessions`) + BFF | `lb_session` opaque, **parent-domain `.letbuyy.store`** (`identity-platform/.../cookies.ts:58-67`) | `INTERNAL_API_SECRET`/`AUTH_SECRET` (HMAC on header transport) | **Real but commingled** (3 mechanisms) |
| **Merchant GoTrue JWT** (parallel) | `routes/auth.ts:1244-1268`; `middleware/auth.ts:185-214` | Supabase `access_token`/`refresh_token` | Supabase JWT secret | **Real, duplicate path** (F4) |
| **Internal SSO header transport** | `middleware/auth.ts:96-183`; `auth-core:602-691` | `X-LetBuyy-Internal-*` | `INTERNAL_API_SECRET`/`AUTH_SECRET` (**reused**) | **Real** (HMAC) but **shared-secret** |
| **Admin/platform session** | `auth-core:904-937`; console token path | `lb_console_session`; static `PLATFORM_CONSOLE_API_TOKEN` for ops | shared console token / `AUTH_SECRET` | **Coarse** — shared token mints `super_admin` (`auth.ts:216-231`) |
| **Refresh / rotation / reuse-detect** | `identity-foundation/session-services.ts:77-95` | — | — | **DORMANT** (in-memory `Set`) — no real refresh anywhere |
| **Logout / revoke** | `routes/auth.ts:1080-1106` (destroy / destroy-all = real DB deletes) | — | — | **Real** (merchant opaque only; GoTrue logout is separate) |
| **Consent** | `identity-foundation/oauth-skeleton.ts` | — | — | **SKELETON** (no endpoints) |
| **MFA (merchant TOTP)** | `routes/two-factor.ts` | factor table | `AUTH_SECRET` (seed encryption — reused) | **Real but not enforced at login** (F5) |
| **MFA (admin)** | `identity-foundation/admin-mfa-scaffold.ts:8` | — | `PLATFORM_CONSOLE_TOTP_SECRET` (single shared) | **Shared secret** (F6) |
| **Passkey / WebAuthn** | (none on request path) | — | — | **Non-existent at runtime** |
| **OIDC / OAuth (federated login)** | `apps/identity-platform/.../oidc-disabled.ts` | mock JWKS | — | **501 skeleton** (F8) |

### 3.2 Top-5 migration BLOCKERS

1. **Shared-secret blast radius (Phase-F killer).** Separating realms means giving each realm its **own** signing secret. Today `AUTH_SECRET`/`INTERNAL_API_SECRET` is one value behind the merchant cookie, the internal-header HMAC, app-platform OAuth, TOTP encryption, and `lb_accounts`. You cannot rotate or split it per-realm without coordinated changes across **6 runtimes** (gateway, identity-platform, merchant-control-plane, mobile-bff, webhook-service, queue-workers) that all resolve it the same way (`auth-core:447-452`). *Blocker because* a realm split with a shared secret is cosmetic.
2. **Merchant realm is internally commingled (3 credentials, 1 middleware).** `authMiddleware` (`auth.ts:257-317`) accepts opaque-DB session **OR** GoTrue JWT **OR** internal-HMAC header **OR** static console token, interchangeably, for the same routes. Splitting "Merchant" cleanly first requires collapsing the GoTrue duplicate path (F4) and deciding which credential is canonical.
3. **Parent-domain merchant cookie (`.letbuyy.store`).** `lb_session` is set on the parent domain shared by accounts/merchant/apps/themes/console (`identity-platform/.../cookies.ts:58-67`). Any admin/console subdomain in a separate realm still receives this cookie unless the cookie domain is narrowed — an XSS in any platform subapp drives authenticated cross-app requests (prior F12). Realm isolation requires host-only or per-realm cookie domains.
4. **Static `PLATFORM_CONSOLE_API_TOKEN` as the admin "realm."** The admin realm today is partly **a shared bearer token that mints `super_admin`** and short-circuits ops authz (`auth.ts:216-231`; `rbac.ts:330-333,451-454,546-549`). There is no per-operator admin identity to migrate into an Admin realm — it must be **built**, not moved.
5. **No real refresh/rotation to carry over.** A realm model usually assumes refresh-token chains with reuse detection. Here that is **dormant in-memory** (`session-services.ts:77-95`) and the live merchant token is a **30-day opaque bearer with no idle timeout / no rotation** (prior F9, `auth-core:127`). Migration cannot "preserve" a refresh model that does not run.

**What does NOT block:** the **customer realm is already separated** — distinct `CUSTOMER_SESSION_SECRET`, host-only cookie, store-scoped JWT, single-use federation tokens. That half of Phase F is genuinely ready (confirms prior §8 strength).

---

## 4. NEW Security Findings (the master MISSED these)

| # | CLAIM | EVIDENCE (file:line) | SEVERITY |
|---|---|---|---|
| N1 | **Internal-header identity forgery on a public gateway** — forging `X-LetBuyy-Internal-*` with the shared HMAC secret impersonates any merchant/admin on every authed route; gateway is internet-reachable with no mTLS/IP-gate. | `middleware/auth.ts:96-128`; `wrangler.toml:212-215`; secret = `auth-core:447-452` | **CRITICAL** (conditional on secret leak) |
| N2 | **Single secret, ≥4 purposes** — `AUTH_SECRET` signs internal-header HMAC + `lb_accounts` + app-OAuth tokens + encrypts TOTP seeds; one leak compromises all; rotation is an open TODO. | `auth-core:447-452`; `identity-platform/.../cookies.ts:13`; `app-store.ts:110-115`; `two-factor.ts:54-58`; `tasks/todo.md` | **HIGH** |
| N3 | **Payout self-approval (no maker-checker)** — release uses single-actor step-up only; real dual-control exists but isn't wired to money movement. | `payouts.ts:464-496`; `security-controls.ts:27-83` vs `rbac.ts:203-207` | **HIGH** |
| N4 | **Internal-header replay window** — identity headers have no nonce/jti; a captured valid header replays for ~10 min (±5-min skew). | `auth.ts:96-128`; `auth-core:562-570`, `:132` | **MEDIUM** |
| N5 | **CSRF auto-bypassed for the internal-header path** — any request carrying `X-LetBuyy-Internal-Signature` skips CSRF; compounds N1 (a forged header is also CSRF-exempt). | `middleware/security.ts:263-266` | **MEDIUM** |
| N6 | **Customer storefront has NO CSRF tokens** — customer mutation routes (`profile`, `addresses`, `set-password`, `login`) rely solely on `SameSite=Lax`; no double-submit/origin check. Prior audit only covered platform CSRF. | `apps/storefront-runtime/src/app/api/customer/profile/route.ts:1-36` (no CSRF); cookie `SameSite=Lax` `session.ts:113` | **MEDIUM** |
| N7 | **Account-enumeration oracle on reset/intent flow** — `password-set-intents/create|consume` and related return distinguishable `User not found` (404) vs success, leaking which emails are registered (login itself is correctly generic). | `routes/auth.ts:779,809,818,922,941` vs generic `:435,440,459,464` | **MEDIUM** |
| N8 | **Admin realm = static shared bearer** — `PLATFORM_CONSOLE_API_TOKEN` mints synthetic `super_admin`, audit attributed to a fake UUID, no MFA, no per-operator identity. (Confirms F7; re-raised as a realm-migration blocker.) | `middleware/auth.ts:216-231`; `rbac.ts:330-333,451-454,546-549` | **HIGH** |
| N9 | **`lb_session` parent-domain SSO blast radius** — merchant cookie on `.letbuyy.store` shared across all platform subapps; XSS anywhere → authed requests everywhere. (Confirms F12; matters for Phase F.) | `identity-platform/src/lib/auth/cookies.ts:58-67` | **MEDIUM** |
| N10 | **No idle timeout + 30-day opaque bearer + no rotation** on merchant session; `last_active` written but never compared. (Confirms F9; relevant to realm/refresh design.) | `auth-core:127`; `routes/auth.ts:171-174`; idle logic only in dormant `session-services.ts:62` | **MEDIUM** |

### 4.1 Findings I REFUTE / downgrade (in the platform's favour)

- **REFUTE the fail-open internal-payment route** (FORENSIC_REPORT N-1 / 16-critical-findings-summary.md:54): the prior `if (!secret && ENVIRONMENT !== 'production') return true` bypass is **gone**. Current `internal-payment-routes.ts:73-74` delegates to `isInternalApiSecretRequest`, which is **fail-closed** (`lib/internal-secret.ts:11-15`, `if (!secret) return false`). **This money-movement auth bypass is FIXED.**
- **REFUTE the "replay any Razorpay signature to self-activate any plan" comment** (`payments.ts:1093-1097`): the code now performs a **real server-side capture verification** — `fetchRazorpayPayment` + `status==='captured'` + `amount ≥ plan price` + order binding (`payments.ts:1101-1118`). The self-documented vuln is **mitigated**; the scary comment is stale narration, not a live hole.
- **DOWNGRADE "secrets committed in `all.env`"** (implied by `tasks/todo.md` purge tasks): in **this** working tree `all.env` is **absent, untracked, and not in `git log --all`**, and `.gitignore:90-91` now blocks `*.env`/`all.env`. The live git-exposure could not be reproduced here; I therefore frame the secret risk as **reuse + unrotated**, not "currently in git." (If history on the canonical remote differs, that elevates N2 to CRITICAL.)
- **CONFIRM strengths the prior report credited and I verified independently:** timing-safe HMAC/compares (`auth-core:577-600`), customer-realm secret/cookie isolation (`session.ts`), customer-auth rate limiting (per-identity 5 / per-IP 30 / 15-min, fail-closed in prod — `rateLimit.ts:419-470`; `customer-engagement-routes.ts:452,529,702,1050`), real ops dual-control & break-glass (`rbac.ts:203-326`), Flutter bundle clean of committed secrets (all via `String.fromEnvironment`, `app_config.dart:33-78`), `/api/auth/switch` takeover fixed (`switch/route.ts` CSRF + proven-account, F17).

---

## 5. Scoring

**Corrected Auth-portion of Security score: 36 / 100** (prior 41; master composite 38).

Rationale for the small *downward* move despite two genuine fixes:
- **+** Fail-closed internal-payment routes and the real Razorpay capture check remove two prior CRITH/HIGH money-bypass items.
- **−** The internal-HMAC trust, re-framed correctly, is a **CRITICAL single-shared-secret identity-forgery surface on a public gateway** (N1+N2) — the prior report scored its mechanism as a *strength*, which over-credited it.
- **−** **Payout self-approval** (N3) is a HIGH money-integrity gap the prior report did not test (it credited dual-control generically without checking the payout path).
- **−** Customer-realm CSRF gap (N6) and the reset-flow enumeration oracle (N7) are net-new MEDIUMs.
- The dominant structural cap remains **service-role-everywhere → RLS inert + correct-by-convention tenant isolation** (prior F1/F2, independently re-confirmed: `lib/supabase.ts:12-18`; `getSupabaseUser` still 0 call-sites). That single fact keeps the score well below 60 regardless of the HMAC nuance.

**The number should move up materially only when:** (a) the authenticated path stops using service-role / RLS becomes load-bearing; (b) `AUTH_SECRET`/`INTERNAL_API_SECRET` is split per-purpose, rotated, and the internal header is gated by mTLS or CF-Access (so forgery requires more than one leaked secret); (c) payout release is wired to the existing dual-control engine; (d) the GoTrue/custom duplication collapses.

*(End of report.)*

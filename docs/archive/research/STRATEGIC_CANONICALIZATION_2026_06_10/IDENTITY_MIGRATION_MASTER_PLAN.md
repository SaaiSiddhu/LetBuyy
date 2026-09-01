# LETBUYY IDENTITY MIGRATION MASTER PLAN

> **Program:** Strategic Canonicalization 2026-06-10 · **Domain:** Identity / Auth / Sessions / Tokens / Consent / SSO
> **Author:** Shopify Identity Architect, LetBuyy Architecture Review Board (ABR)
> **Date:** 2026-06-10
> **Status:** Canonical identity roadmap. Binds to `_ANCHOR_DECISIONS_SPINE.md` **A1** (identity / auth / sessions / consent). Where this document and any other deliverable disagree on an identity call, **this document and A1 win**.

---

## 0. Methodology

**Decision rule (inherited from the program spine, A0):** the canonical winner is the implementation that should still exist at **10,000 India merchants** — not the oldest, most-complete, or easiest. LetBuyy has **zero production merchants and zero legacy password/Multipass corpus**, so we move directly to the intended architecture and preserve nothing for its own sake. This is the "leapfrog" mandate: born passwordless + OIDC-ready, no Multipass to deprecate (SHOPIFY_ALIGNMENT_REPORT.md §5; L-2).

**Evidence base (authoritative, in precedence order):**
1. `_ANCHOR_DECISIONS_SPINE.md` **A1** — the load-bearing identity calls. Honored verbatim.
2. `FORENSIC_MASTER_2026_06_10/AUTH_FORENSIC_AUDIT.md` — Phase 6, code-only working-tree audit, **AUTH-001…AUTH-025** each anchored to `path:line`. This is the single most-current and most-rigorous identity evidence document; where the June-09 `IDENTITY_PLATFORM_AUDIT/` set disagrees with it on a fact (e.g. merchant-session rotation), **the June-10 audit supersedes** and the delta is noted as "hardened between audits."
3. `FORENSIC_MASTER_2026_06_10/FOUNDATION_AUDIT.md` — RBAC scope-fineness (positive), `super_admin_allowlist` FND-005.
4. `STRATEGIC_CANONICALIZATION_2026_06_10/SHOPIFY_ALIGNMENT_REPORT.md` §5 — passwordless + Customer-Account-API + OIDC + leapfrog-vs-Multipass framing.
5. `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §3 + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` — the frozen constitution (identity-platform owns buyer OTP + merchant/staff login + OAuth2/PKCE + claims→GUC; passwordless buyer OTP; DPDP consent ledger; layered tenant isolation).
6. `FORENSIC_MASTER_2026_06_10/LETBUYY_MASTER_EXECUTION_PLAN.md` — Phase A/B sequencing; ISSUE-001 (switch), ISSUE-003 (allowlist), ISSUE-027 (AUTH_SECRET split + ES256). My Waves 0–8 are a finer-grained projection of those phases for the identity slice.
7. `IDENTITY_PLATFORM_AUDIT/` (June-09, 14 docs) — concern-level ownership map, OIDC readiness (6/100), session/cookie forensics, SSO readiness; used for depth, superseded where (2) is more current.

**Classification legend (verbatim from A1):** **CANONICAL** (the winner — build/finish it) · **TRANSITIONAL** (real today, kept only until the winner lands) · **LEGACY** (superseded; freeze, then delete after migration) · **DEAD** (no value or actively dangerous; SAFE_DELETE / remove now) · **FROZEN** (rejected-for-envelope but keep an empty seam; reconsider at a named trigger).

**Wave model (A0 cross-cutting sequencing law):** Wave 0 = clean working tree + deploy pipeline (the meta-blocker; nothing ships otherwise). Wave 1 = live security S0/S1 (switch, allowlist, AUTH_SECRET split start). Wave 2 = token-signing cutover to asymmetric + collapse the legacy Supabase `/auth` surface. Wave 3 = unify sessions/cookies/CSRF/logout under one issuer service. Wave 4 = RBAC default-deny + claims→GUC hardening (joins A2 tenancy). Waves 5–6 = consent ledger (DPDP) + merchant MFA. Waves 7–8 = OIDC provider + WebAuthn passkeys (deferred-canonical, demand-gated). **Every wave item ties to a FORENSIC ISSUE-ID / AUTH-ID.**

**UNVERIFIED markers** are preserved from the source audits and never silently upgraded to fact (e.g. PostgREST table exposure for `super_admin_allowlist`, deployed env-var values, Flutter cert-pinning beyond the files read).

---

## 1. Executive Verdict — the single-issuer + token-key call (5 sentences)

LetBuyy has built a **competent, individually-coherent auth surface — bcrypt-12 passwords, CSPRNG single-use OTP, rotating reuse-detecting server sessions, real app-OAuth2-S256-PKCE, fail-closed Turnstile and rate-limiting — but smeared across four parallel implementations under a single shared HS256 `AUTH_SECRET` that makes the verification key the forgery key across seven trust domains, and gated behind an OIDC provider that is a 501 skeleton serving a literal-string JWKS.** The canonical decision, honoring A1, is that **`apps/identity-platform` becomes the SOLE identity issuer for all three realms (merchant/staff, buyer/customer, platform-operator)** — owning OTP, login, sessions, cookies, refresh rotation, consent, and the OIDC provider — and the gateway `routes/auth.ts` session-minting, the gateway "identity-foundation" shadow stack, and the legacy Supabase `/auth/*` surface are all **collapsed into it and deleted**. The token architecture **migrates off the single shared-`AUTH_SECRET` HS256 to identity-platform as the sole asymmetric signer (RS256/EdDSA — the program standardizes on EdDSA/Ed25519, with ES256 as the documented fallback the existing `keys.ts` scaffolding assumes), and every other service becomes verify-only with the published public key**, per-audience claims, so a leaked verification key is harmless. The two live S0s — the **`/api/auth/switch` unauthenticated account-takeover whose fix is uncommitted on every deployable branch** (AUTH-001) and the **`super_admin_allowlist` RLS policy open to PUBLIC writes** (AUTH-003 / FND-005) — are Wave-0/1 release-blocking gates that must ship before anything else in identity, while **OIDC completion and WebAuthn passkeys are canonical-but-deferred** to later waves, demand-gated on SSO / headless-merchant need. Net: the hard parts are mostly built; the work is to **commit one fix, re-key one secret family onto asymmetric signatures via a dual-verify cutover, delete three redundant auth implementations, and defer the two greenfield capabilities (OIDC IdP, passkeys) honestly** — a focused authority-layer consolidation, not a rewrite.

---

## 2. Realm Map — owner · session · cookie · token (target state)

The three realms and their canonical identity binding at 10k-merchant target state. The **two-realm cookie isolation already designed** (platform parent-domain vs customer host-only — `cookies.ts:33-54`) is a genuine strength and is **preserved and hardened**, not redesigned.

| Realm | Canonical owner | Session model (target) | Cookie (name · scope · attrs) | Token / signing (target) | Notes |
|---|---|---|---|---|---|
| **Merchant / Staff** | `identity-platform` (sole issuer) → gateway as **verify-only** | Server-side DB session, **rotating + idle-timeout + reuse-detecting** (already live via `validate_and_rotate_merchant_session`), device-bound | `lb_session` · **`.letbuyy.com`** (was `.letbuyy.store`) · `__Host-`/`__Secure-` where parent-domain allows · httpOnly · Secure · SameSite=Lax · 30d→capped | Opaque DB token for the session itself; **all signed handoffs (internal SSO, console, checkout grant) re-signed with the identity-platform asymmetric key**, per-audience `aud` | Parent-domain cookie = intended first-party SSO across admin/apps/themes/developer/console. Blast-radius hardened in Wave 3 (per-app scoping for high-trust apps + httpOnly CSRF). |
| **Customer / Buyer** | `identity-platform` issuer + `auth-core` host-only provider (the **one cleanly-separated owner today**) | Stateless signed session token; **passwordless OTP only** (email/SMS); no password, no reset, no Multipass | `lb_customer_session` · **HOST-ONLY (no `domain`)** · httpOnly · Secure · SameSite=Lax · 7d | Was HS256 (`alg` pinned); **migrates to the identity-platform asymmetric key, `aud=storefront`** | **Leapfrog asset:** born passwordless. The host-only scope is the strongest isolation guarantee in the system — a merchant session can never replay as a buyer session and vice-versa. Never set a parent domain here (`cookies.ts:43`). |
| **Platform / Operator (ops)** | `identity-platform` issuer; `platform-console` consumes a **step-up + MFA** session | Stateless signed session (`exp`-bounded, 8h) + **mandatory TOTP MFA**; impersonation governed (read-only default, reason-logged, expiring) | `lb_console_session` (a.k.a. `LETBUYY_PLATFORM_SESSION_COOKIE`) · console apex · httpOnly · Secure · SameSite per policy · 8h | Was 2-segment `payload.hmac` under `PLATFORM_CONSOLE_SESSION_SECRET ‖ AUTH_SECRET`; **migrates to the asymmetric key, `aud=ops-console`; the `|| AUTH_SECRET` fallback is removed (fail-closed)** | Ops RBAC is genuinely well-built (DB-backed `employee_permissions` scopes + dual-control). Its ceiling rests on the `super_admin_allowlist` table whose RLS is the S0 (AUTH-003). Distinct realm from `lb_session` by design — correct. |

**Realm invariants (target, enforced):**
1. **One issuer.** Every token in every realm is minted by `identity-platform` and signed with the identity-platform private key. No other service mints; all others verify with the public key.
2. **Per-audience claims.** Each realm's token carries a distinct `aud` (`merchant`, `storefront`, `ops-console`, plus `internal`, `app-install`, `media`, `checkout`, `webhook`). A token for one audience never validates for another (audience-pinned on verify).
3. **No cross-realm cookie bleed.** Platform cookies are parent-domain; customer cookies are host-only; never the reverse (`cookies.ts:39-48`). Confirmed clean today (COOKIE_GOVERNANCE_REPORT §4); kept as an enforced test.
4. **Validated claims → tenant GUC.** The merchant/internal-SSO `storeId` claim is validated (`verifySiteOwnership`) and drives the per-transaction `SET LOCAL app.site_id` GUC (the A2 tenancy backstop). The claims→GUC bridge becomes REAL (today the *role* claim path leaks a client-writable fallback — AUTH-004).

---

## 3. Ownership Decision Table (the central A1 calls)

Each identity concern → its canonical owner, current owner, classification, and the controlling forensic ID. Every row resolves to **`identity-platform` as the single issuer**, per A1.

| # | Concern | Current owner (de-facto) | Canonical owner (target) | Classification of current | Controlling evidence |
|---|---|---|---|---|---|
| C-AUTH | **Current → future auth state** | 4 parallel impls: `identity-platform` lib + gateway `routes/auth.ts` (1,441 ln) + gateway "identity-foundation" shadow stack + legacy Supabase `/auth/*` | **`identity-platform` (sole issuer)**; gateway = verify-only enforcement | identity-platform lib = **CANONICAL (finish)**; gateway auth-mint = **LEGACY**; shadow stack = **DEAD**; Supabase `/auth/*` = **LEGACY** | A1; AUTH_FORENSIC_AUDIT §1, §8; IDENTITY_ARCHITECTURE_FORENSICS §2 |
| C-OIDC | **OIDC provider ownership** | nobody — every `oauth2/*` + `.well-known/*` route → `oidcSkeletonResponse` (404 flag-off / 501 stubs / placeholder JWKS) | **`identity-platform`** | **CANONICAL but DEFERRED** (build at SSO/headless demand) | A1; AUTH-020; OIDC_READINESS_REPORT (6/100); SHOPIFY §5 PARITY-GAP |
| C-SESS | **Session ownership** | 5 live impls + 1 dead v2 across 3 realms (gateway `sessions` table is authoritative for merchant) | **`identity-platform`** single session service (one revocable authority over all 3 realms) | merchant/customer/ops sessions = **CANONICAL (consolidate)**; v2 `session-services.ts` + `session-core` ifaces = **DEAD** | A1; SESSION_FORENSICS_REPORT; AUTH §3 |
| C-COOK | **Cookie ownership** | `identity-platform` `cookies.ts` (platform realm) + `auth-core` (customer realm) | **`identity-platform`** (single cookie authority; `auth-core` host-only provider stays as the customer seam) | **CANONICAL (harden)** — realm split is correct; domain-drift + dev-key + dual-CSRF-name are defects | A1; COOKIE_GOVERNANCE_REPORT D1–D5; AUTH §3 |
| C-TOK | **Token ownership / signing** | shared `AUTH_SECRET` HS256 fallback across 7 trust domains; verify-key = forgery-key | **`identity-platform` sole asymmetric signer (EdDSA/Ed25519; ES256 fallback)**; all services verify-only | **TRANSITIONAL → re-key** (HS256-shared = LEGACY signing scheme) | A1; **AUTH-002**; ISSUE-027; SHOPIFY §5 (SHOP-008) |
| C-CONS | **Consent ownership (DPDP)** | nobody — OIDC consent route 501s; no consent ledger | **`identity-platform`** consent ledger (DPDP) + gateway DSR export/erasure | **ABSENT → CANONICAL (build, P1)** | A1; V1 §3 (DPDP consent ledger + DSR); IDENTITY_ARCHITECTURE_FORENSICS §1 |
| C-PASS | **Passkey / WebAuthn ownership** | nobody — `FEATURE_PASSKEY` flag exists, **zero consumers** | **`identity-platform`** WebAuthn (passkeys) | **CANONICAL but DEFERRED** (demand-gated, after MFA) | A1; `features.ts:14` (`FEATURE_PASSKEY`, no impl); SHOPIFY §5 (passkeys not native, defer) |
| C-LOGOUT | **Logout ownership** | `identity-platform` + 2 other apps (duplicated ×3); merchant logout kills DB session | **`identity-platform`** single logout (front-channel + back-channel for OIDC at Wave 7) | merchant logout = **CANONICAL**; duplicated copies = **LEGACY (de-dup)** | A1; IDENTITY_ARCHITECTURE_FORENSICS §1; AUTH §3 |
| C-REFRESH | **Refresh / rotation ownership** | **nobody for humans** — declared only as `session-core` interfaces; merchant "refresh" re-validates the same opaque token; Supabase path has real refresh (legacy) | **`identity-platform`** refresh rotation + reuse-detection (real, replacing the interface stubs) | **DEAD/STUB → CANONICAL (build with OIDC/session service)** | A1; `session-core/src/index.ts:17-49`; SESSION_FORENSICS §4 |
| R-MERCH | **Merchant/staff realm** | gateway `/auth/custom/*` orchestrated by identity-platform; opaque rotating session | **`identity-platform`** | **CANONICAL** | A1; AUTH §1 |
| R-CUST | **Customer/buyer realm** | `auth-core` host-only — the cleanest owner today | **`identity-platform`** issuer + `auth-core` provider; **passwordless OTP, host-scoped cookies** | **CANONICAL (the model to keep)** | A1; AUTH §3; V1 §3 |
| R-OPS | **Admin/platform-operator realm** | `platform-console` 2-part HMAC + MFA; DB-backed ops RBAC | **`identity-platform`** issuer; console = step-up+MFA consumer | **CANONICAL (RBAC is a strength)** | A1; FOUNDATION_AUDIT RBAC matrix; AUTH §5 |

---

## 4. The Four-Implementations Collapse Plan

A1 names **four parallel auth implementations**. This is the "two parallel systems" pattern at its sharpest. The collapse target is **one issuer (`identity-platform`) + one enforcement layer (gateway verify-only)**.

### 4.1 The four implementations — inventory and verdict

| # | Implementation | What it is today | Evidence | Verdict | Collapse action |
|---|---|---|---|---|---|
| **I-1** | **`identity-platform` lib** (Next.js orchestrator: `login/`, `signup/`, `verify-otp/`, `send-magic/`, `reset-password/`, `switch/`, `logout/`, `cookies.ts`, `session.ts`) | The production login surface; a stateless orchestrator proxying every stateful op to the gateway over HMAC internal calls. Flows are real and coherent. | AUTH §1; IDENTITY_ARCHITECTURE_FORENSICS §3 | **CANONICAL** | This is the **survivor**. All issuance, session, cookie, OTP, reset, OAuth, OIDC ownership consolidates here. Add a `middleware.ts` (default-deny — there is none today, `find src -name middleware.ts` → none). |
| **I-2** | **Gateway `routes/auth.ts`** session-minting (`/auth/custom/*`, 1,441 ln) | Authoritative session mint/validate/destroy, `authenticate` (bcrypt), token issue/validate, the actual DB writes identity-platform orchestrates. | AUTH §2.1, §3; A1 | **TRANSITIONAL → LEGACY (session-mint)** | Keep the **DB-RPC primitives** (`validate_and_rotate_merchant_session`, token tables) as the issuer's storage layer; **move the mint/policy decisions into identity-platform**; the gateway becomes the **verify-only enforcement layer** (validate token signature with public key, set tenant GUC). Delete the gateway's *independent* session-mint authority once identity-platform owns it. |
| **I-3** | **Gateway "identity-foundation" shadow stack** (`services/api-gateway/src/identity-foundation/*`: `session-services.ts` `createDormant*`, `auth-verifier-registry.ts`, the 6 `*-core` interface packages: `session-core`/`token-core`/`permission-core`/`identity-core`/`audit-core`/`organization-core`) | A flag-gated, in-memory "v2" with **zero runtime callers**; the dead one implements the rotation the live ones (used to) lack — a trap for a future engineer who wires the wrong one. | IDENTITY_ARCHITECTURE_FORENSICS §2 (8th, dead); SESSION_FORENSICS §3; OIDC_READINESS §4 | **DEAD** | **SAFE_DELETE** the in-memory dormant factories and the registry. For the `*-core` packages: **delete the ones with no canonical role** (`organization-core`, `audit-core` as stubs); **the contracts that the OIDC/session build genuinely needs** (`session-core` refresh/reuse types, `token-core`) are either rewritten as the real implementation in Wave 7 or kept as typed contracts — **decide per-package at Wave 7, default DELETE.** Do not let dead scaffolding "imply capability it lacks." |
| **I-4** | **Legacy Supabase `/auth/*` surface** (`/auth/signin`, `/auth/signup`, `/auth/signin/otp`, `/auth/password/reset` — gateway `auth.ts:1281-1413`) | Public routes issuing **raw Supabase GoTrue JWT+refresh** with no merchant-session rotation/reuse, no CSRF, only coarse `authRateLimit` (20/5min); a second reset pipeline with no `destroyAllUserSessions`; the channel that seeds the client-writable `user_metadata.role`. | AUTH-010, AUTH-011, AUTH-022; §8 | **LEGACY → DELETE after migration** | **Deprecate then delete.** Route all sign-in/sign-up/OTP/reset through the hardened identity-platform custom path (one session regime, one revocation story). Removing this also closes the `user_metadata.role` escalation channel (AUTH-004) and the second reset pipeline (AUTH-010). |

### 4.2 Collapse sequence (how I-2/I-3/I-4 fold into I-1)

```
                         ┌─────────────────────────────────────┐
   TODAY (4 systems)     │   identity-platform (I-1) = ISSUER   │  ← survivor; gains middleware.ts,
                         │   OTP · login · session · cookie ·  │    consent, OIDC, passkeys, refresh
                         │   refresh · consent · OIDC · OAuth   │
                         └───────────────┬─────────────────────┘
   gateway auth-mint (I-2) ──collapse──► │  becomes VERIFY-ONLY enforcement
   identity-foundation (I-3) ──DELETE──► ✗  (dead; SAFE_DELETE)
   legacy Supabase /auth (I-4) ─delete─► ✗  (LEGACY; deprecate → delete)
```

**Order (maps to waves):**
1. **Wave 1:** Fix the I-1 S0 (`/api/auth/switch`) and the table-RLS S0 that backs ops RBAC. (Stop the bleed before consolidating.)
2. **Wave 2:** Re-sign I-1/I-2/I-3-adjacent tokens with the asymmetric key (token-signing migration, §6); **deprecate I-4** (legacy Supabase `/auth/*`) — flag it off for new traffic, keep a read-path for in-flight Supabase sessions until they expire, then delete.
3. **Wave 3:** Consolidate sessions/cookies/logout under I-1; **delete I-3** (shadow stack) so it can't be mis-wired; reduce I-2 to verify-only.
4. **Wave 4:** Default-deny middleware in I-1 + claims→GUC hardening (role only from `app_metadata`/DB; drop the `user_metadata` fallback and `['owner']` default).
5. **Waves 7–8:** The real OIDC provider and WebAuthn are built **inside I-1** (the issuer), reusing the `keys.ts` JWKS that Wave 2 already made real.

**Gateway "legacy `/auth` surface" collapse specifics (A1 explicit):** the gateway exposes both the hardened custom path (`/auth/custom/*`) and the legacy Supabase path (`/auth/*`). The custom path's DB primitives are kept (they are the issuer's storage); the Supabase path is deleted. The `authRateLimit` (20/5min) that only the legacy routes use is removed with them; the per-endpoint limits (login 5/15min, etc.) become the only limiter.

---

## 5. Token-Signing Migration — shared HS256 → asymmetric sole-signer (the cross-service contract change)

This is the **single highest-leverage architectural change** in identity and the **only one that is a cross-service contract change**, so it gets a dedicated dual-verify cutover. It is **ISSUE-027 / AUTH-002 / SHOP-008**.

### 5.1 Current state (the defect)

There are **four HMAC-SHA256 token families** plus one disabled ES256 path (AUTH §2.1). **Algorithm confusion is already designed out** (high-value tokens omit a JWT header — `index.ts:1213`; the one real JWT pins `alg==='HS256'` — `index.ts:797`, `customer-session.ts:83`; timing-safe compare — `index.ts:1278`). The defect is **not** algorithm confusion — it is that **everything is symmetric**, and `AUTH_SECRET` is the universal fallback signer across **seven trust domains**:

```
apps/identity-platform/src/lib/auth/cookies.ts:13              AUTH_SECRET → lb_accounts PII cookie
apps/platform-console/src/lib/console-session.ts:24            PLATFORM_CONSOLE_SESSION_SECRET || AUTH_SECRET → console sessions + magic links
services/api-gateway/src/routes/checkout.ts:86                 CHECKOUT_SIGNING_SECRET || AUTH_SECRET || STORE_ACCESS_SIGNING_KEY → checkout authorization
services/api-gateway/src/routes/storefront/cart-routes.ts:306  CHECKOUT_SIGNING_SECRET || AUTH_SECRET || STORE_ACCESS_SIGNING_KEY → cart/checkout signing
services/api-gateway/src/routes/media.ts:60                    MEDIA_UPLOAD_SIGNING_SECRET || AUTH_SECRET → media upload tickets
services/api-gateway/src/routes/export.ts:174                  INTERNAL_API_SECRET || CUSTOMER_SESSION_SECRET || AUTH_SECRET → data-export auth
services/api-gateway/src/routes/internal-console.ts:439        AUTH_SECRET → internal console auth
services/webhook-service/src/index.ts:543                      INTERNAL_API_SECRET || AUTH_SECRET → webhook internal auth
```

Because all of it is HS256, **the verification key is the forgery key**. One `AUTH_SECRET` leak forges console sessions (MFA-bypassed), checkout grants, media tickets, and identity cookies (AUTH §2.3; Walkthrough C). With an asymmetric design, a leaked *public* (verification) key is harmless.

### 5.2 Strategic state (the target)

- **`identity-platform` holds the sole private signing key** (in the gateway's KMS envelope; the existing `keys.ts` ES256/JWKS scaffolding and `mock-key-service.ts` are wired to a real key service). Program standard: **EdDSA (Ed25519)** for new signatures; **ES256** is the documented fallback the existing scaffolding assumes (either is asymmetric and satisfies A1 — pick one at Wave 2 ARB and pin it). **RS256 acceptable only if a verifier library forces it.**
- **All other services are verify-only**, fetching the public key from the identity-platform JWKS endpoint (cached, with rotation support).
- **Per-audience claims:** each token carries `aud` (`merchant`/`storefront`/`ops-console`/`internal`/`app-install`/`media`/`checkout`/`webhook`); verifiers pin both `alg` (the chosen asymmetric alg, never `none`, never HS256 once cutover completes) **and** `aud`.
- **Every per-domain secret becomes mandatory / fail-closed when unset** (exactly as `getConsoleSessionSecret` already does at `console-session.ts:35-37` for production). **All `|| AUTH_SECRET` fallbacks removed.** `AUTH_SECRET` is decommissioned as a signer (it may survive only as a non-signing config value, or be deleted).
- **The internal SSO secret** (`INTERNAL_API_SECRET`) stays correctly separate in `auth-core` (`index.ts:461` — no `AUTH_SECRET` fallback); the two consumers that re-introduced the fallback (`export.ts:174`, `webhook-service:543`) are fixed.

### 5.3 Dual-verify cutover (accept old + new, then drop old) — the contract-safe sequence

A token-signing change across `identity-platform` + `api-gateway` + `webhook-service` + `platform-console` + `auth-core` cannot be a flag-flip — in-flight tokens signed with the old scheme must keep verifying until they expire. **Five phases:**

| Phase | Signer behavior | Verifier behavior | Exit condition |
|---|---|---|---|
| **D0 — Key provision** | Generate the Ed25519 (or ES256) keypair in KMS; publish the public key at the JWKS endpoint (real, not `MOCK_JWKS`). No tokens signed with it yet. | Verifiers **fetch + cache** the JWKS but do not yet require it. | JWKS reachable from all services; key in KMS; `MOCK_JWKS` literal removed (AUTH-020 closed — stop advertising a key you can't sign with). |
| **D1 — Dual-issue (new primary, old accepted)** | Issuer signs **new** tokens with the **asymmetric key** (`kid` in header for the JWT family; a version byte for the 2-segment family). Per-domain secrets made mandatory. | Verifiers **accept either**: asymmetric-by-`kid` **or** legacy-HS256 (during this window only). `aud` pinned. | All issuers cut to asymmetric primary; legacy HS256 issuance **stops**. |
| **D2 — Old-token drain** | Issuer signs asymmetric only. | Verifiers still accept legacy HS256 **for the max legacy TTL** (longest = `lb_accounts` 365d → **cap it to ≤30–90d first**, AUTH-015, so the drain window is weeks not a year; merchant session 30d; console 8h; customer 7d). | The longest-lived legacy token has expired (post-`lb_accounts` cap: ≤90d). Telemetry shows **zero** legacy-HS256 verifications. |
| **D3 — Drop old (algorithm pinning)** | Asymmetric only. | Verifiers **reject HS256 entirely** — pin to the asymmetric alg + `kid` + `aud`. `AUTH_SECRET` removed from all signer code paths. | Static check + grep confirms no `AUTH_SECRET` signer and no HS256-accept path remains. |
| **D4 — Rotation proof** | Rotate the signing key once (new `kid`); old `kid` stays in JWKS until its tokens drain. | Verifiers pick key by `kid` from JWKS. | A key rotation completes end-to-end with zero auth errors (proves the JWKS-rotation machinery, which OIDC at Wave 7 also needs). |

**Sequencing note (A1):** the `lb_accounts` TTL cap (AUTH-015) is a **prerequisite** to D2 — without it the drain window is 365 days. The `AUTH_SECRET` split (mandatory per-domain secrets, remove fallbacks) is **Wave-1 start / Wave-2 complete** and is what makes D1 safe; the *asymmetric* cutover (D1→D3) is **Wave 2**; D4 rotation proof sits at the Wave 2/Wave 7 boundary.

### 5.4 Token-migration rollback

- **D0–D1 rollback:** trivially safe — verifiers still accept legacy HS256, so reverting the issuer to HS256-primary is a config change with no token invalidation. **No user impact.**
- **D2 rollback:** safe — re-enable legacy-HS256 issuance; the dual-verify window is still open. Any tokens already issued asymmetric continue to verify (verifiers still accept both in D2).
- **D3 rollback (the dangerous one):** once verifiers **reject** HS256, reverting the *issuer* to HS256 **invalidates every live session at once** (verifiers won't accept the old alg). **Rollback for D3 = re-widen the verifier to accept HS256 again (revert the pin), NOT revert the issuer.** This is why D3 must be gated on **zero** legacy verifications in telemetry, and why the verifier-pin and issuer-alg are deployed as **separate, independently-revertible** changes. **Rollback drill is mandatory before D3 (see §7 Rollback validation).**
- **Key-compromise rollback (any phase):** if the private key leaks, rotate `kid` (D4 machinery), revoke the old `kid` from JWKS, and force re-auth. This is *better* than the HS256 world, where a leaked secret cannot be "rotated away" from already-issued tokens without invalidating all of them.

---

## 6. Per-Decision Detail Blocks (all 13 fields)

> Fields per decision: **Current State · Strategic State · Reasoning · Migration Plan · Validation Plan · Deletion Plan · Rollback Plan · Risk Level · Complexity (XS/S/M/L) · Timeline (Wave) · Owner · Dependencies · Success Criteria.** Classification stated in the header.

### D-01 — `/api/auth/switch` account-takeover fix (AUTH-001, S0) — **DEAD (the vuln) → CANONICAL (the fix)**

- **Current State:** Every deployable branch (`HEAD`, `main`, `develop`, `origin/main`, `origin/develop`, `stepup/main`, `stepup/wave-4-session-security`) mints a full `lb_session` for **any** `email_verified` account named in the request body, gated only by a JS-readable CSRF token. The fix exists **only as an uncommitted, unstaged working-tree edit** (`git diff HEAD` shows the whole fix; `git diff --cached` is empty; `git log` shows the last change was a transport refactor). Unauthenticated full account-takeover of any verified merchant/staff account, live now. (`switch/route.ts` HEAD; AUTH §4.)
- **Strategic State:** The working-tree fix is committed + deployed: rate-limit → CSRF → **require a valid current session** (`validateSession`) → **require the target be in the signed httpOnly `lb_accounts` cookie** (`getAccounts().some(...)`). Switch only between accounts already proven on this device, while already authenticated.
- **Reasoning:** This is the single most important fix in the entire identity surface (AUTH §1; SHOP-001 P0). No "we match Shopify's identity model" claim is defensible while this ships (SHOPIFY §5). It is one commit.
- **Migration Plan:** (1) Clean the working tree (ISSUE-171) so the fix can be committed without loss. (2) Commit the working-tree diff. (3) Add the regression test (below) in the same PR. (4) Deploy via the now-fixed pipeline (depends on Wave 0). (5) Confirm the deployed bundle carries the fix.
- **Validation Plan:** **Unit** — `validateSession(null)` → 401; target-not-in-`lb_accounts` → 403. **Integration** — POST `/api/auth/switch` with no session cookie → 401; with a session but an email not in the device's `lb_accounts` → 403; with a session + in-cookie email → 200 + new `lb_session`. **Security** — replay the historical exploit (unauth + CSRF-only + arbitrary verified email) → must be **rejected**; enumeration precondition via `/api/auth/lookup` no longer sufficient. **E2E** — multi-account switch in the accounts app still works for legitimately-added accounts. **Regression** — assert 401 with no session (the test AUTH-001's remediation names explicitly).
- **Deletion Plan:** The vulnerable code path is **deleted** by the commit (it *is* the deletion). No separate teardown.
- **Rollback Plan:** Revert the commit. Because the change only *adds* checks, reverting restores the (vulnerable) prior behavior — so rollback is a **security regression** and must require ARB sign-off; prefer fix-forward. Keep the regression test even on rollback.
- **Risk Level:** **Critical (S0).** Complexity: **S.** Timeline: **Wave 1** (gated only by Wave 0 deploy pipeline). Owner: **Platform/Security squad.**
- **Dependencies:** Wave 0 (clean tree + deploy pipeline; the meta-blocker — `main` ~30 commits behind).
- **Success Criteria:** Deployed branch rejects unauthenticated switch (401); regression test green in CI; the historical exploit walkthrough (AUTH §12-A) fails at step 3.

### D-02 — `super_admin_allowlist` RLS PUBLIC-write fix (AUTH-003 / FND-005, S0/S1) — **DEAD (the policy) → CANONICAL (scoped policy)**

- **Current State:** `CREATE POLICY service_role_manage_allowlist ON public.super_admin_allowlist USING (true) WITH CHECK (true)` **with no `TO` clause** → applies to **PUBLIC (anon + authenticated)** (`000_baseline.sql:26669`). The sibling `idempotency_keys` policy correctly scopes `auth.role()='service_role'` (`:26659`). If PostgREST exposes the table to anon/authenticated, anyone can `INSERT` themselves as super-admin and walk through the otherwise-solid `requireSuperAdmin` gate (DB-backed against this table). The entire ops RBAC ceiling rests on this one policy. **UNVERIFIED:** whether PostgREST actually exposes the table (if not, this drops to S2 defense-in-depth, but the policy is unambiguously wrong).
- **Strategic State:** Policy rewritten to `TO service_role USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role')`; `REVOKE INSERT/UPDATE/DELETE ... FROM anon, authenticated`; an INSERT-audit trigger on the table; PostgREST exposure confirmed closed with an anon-key probe (`\dp public.super_admin_allowlist`).
- **Reasoning:** This is the escalation chain that matters: **E-1 → E-8** (any authenticated user → platform super-admin). The middleware is well-built; this single policy is the hole (AUTH §5). One migration (SHOP-002 P0).
- **Migration Plan:** New migration replacing the policy (mirroring `idempotency_keys`); REVOKE statements; audit trigger; CI policy-lint forbidding `USING(true)` without a `TO` role or a tenant predicate (prevents recurrence across the 6 sibling leaks, FND-001…008). Land **together** with the other anon-table fixes (A2 wave).
- **Validation Plan:** **Security** — with an anon key, attempt `INSERT INTO super_admin_allowlist` via PostgREST → must be **denied** (replay AUTH §12-B / FOUNDATION_AUDIT Attack #2). **Integration** — service_role still manages the table; ops routes still resolve `requireSuperAdmin` for legitimately-listed operators. **Regression** — policy-lint fails CI if any future policy reintroduces `USING(true)` to PUBLIC. **Deletion validation** — confirm the old policy no longer exists (`pg_policies`).
- **Deletion Plan:** The old PUBLIC policy is dropped by the migration.
- **Rollback Plan:** Migration is reversible (restore prior policy) but doing so re-opens the S0 — ARB-gated, fix-forward preferred. The audit trigger and policy-lint stay regardless.
- **Risk Level:** **Critical (S0/S1).** Complexity: **S.** Timeline: **Wave 1.** Owner: **Platform/Security + DB.**
- **Dependencies:** Wave 0 (deploy + CI migration-replay hardening, ISSUE-044, so the migration ships and can't be skipped).
- **Success Criteria:** Anon INSERT denied; policy-lint live; PostgREST exposure verified; Attack #2 fails.

### D-03 — Token-signing migration: shared HS256 → asymmetric sole-signer (AUTH-002 / ISSUE-027, S1) — **TRANSITIONAL (HS256-shared) → CANONICAL (asymmetric)**

- **Current State / Strategic State / Reasoning / Migration / Rollback:** Fully specified in **§5** (dual-verify cutover D0–D4). Summary: 7-domain `AUTH_SECRET` HS256 fallback → identity-platform sole Ed25519/ES256 signer + verify-only services + per-audience claims + mandatory per-domain secrets.
- **Validation Plan:** **Unit** — sign/verify round-trip with the asymmetric key; reject HS256 after D3; reject wrong-`aud`. **Contract (token claims across services)** — a token minted by identity-platform verifies in `api-gateway`, `webhook-service`, `platform-console` with the published public key; a token with `aud=storefront` is **rejected** by an `aud=ops-console` verifier; consumer-fixture tests pin claim shape per audience. **Integration** — console session / checkout grant / media ticket / internal SSO each verify under the new key. **Security** — attempt to forge a console session with a *leaked public key* → must **fail** (the whole point); algorithm-pinning test: a token with `alg:none` or `alg:HS256` (post-D3) → rejected; key-rotation: old `kid` revoked → old tokens rejected. **Performance** — asymmetric verify latency budget measured at the gateway hot path (Ed25519 verify is fast; confirm no p99 regression vs HMAC). **Regression** — every existing auth E2E passes through D1's dual-verify window. **Rollback validation** — see §5.4 (D3 rollback = re-widen verifier, drill mandatory).
- **Deletion Plan:** Remove every `|| AUTH_SECRET` signer fallback (8 sites in §5.1); remove the `MOCK_JWKS` literal (`oidc-disabled.ts:4-16`); decommission `AUTH_SECRET` as a signer after D3.
- **Risk Level:** **High (S1) — but a cross-service contract change, so high *operational* risk.** Complexity: **L.** Timeline: **Wave 1 (secret-mandatory start) → Wave 2 (asymmetric D1–D3) → Wave 2/7 (D4 rotation).** Owner: **Platform/Security + each service owner (gateway, webhook, console).**
- **Dependencies:** Real key service / KMS envelope (the gateway's mock-KMS C-3 must become real — cross-ref SECURITY); `keys.ts` JWKS wired; D-04 (`lb_accounts` TTL cap) before D2.
- **Success Criteria:** Zero legacy-HS256 verifications in telemetry before D3; HS256 rejected after D3; one full key rotation with zero auth errors; no `AUTH_SECRET` signer remains.

### D-04 — `lb_accounts` cookie: TTL cap + true encryption (AUTH-014/015, S3) — **TRANSITIONAL → CANONICAL (hardened)**

- **Current State:** `lb_accounts` is a **signed-not-encrypted** JWT (`SignJWT` only signs) whose payload (emails/names/avatars of up to 10 accounts) is **base64-plaintext readable** by anyone with the cookie, living **365 days** (`cookies.ts:176-181,223`). Labeled "encrypted" in comments (misleading). Also forgeable via a dev-literal signing key under a `NODE_ENV`-only gate on non-prod deploys (COOKIE_GOVERNANCE D1).
- **Strategic State:** Cap TTL to ≤30–90d; switch to **JWE (encrypt)** or store only opaque account ids; correct the "encrypted" comments; unify the prod-detection gate to the 4-variable check `dev-auth-bypass.ts` uses (closes the dev-literal forgery on previews).
- **Reasoning:** It is a **prerequisite to the token-migration drain (§5.3 D2)** — a 365d cookie makes the asymmetric cutover a year-long window. Also a DPDP data-minimization concern.
- **Migration Plan:** Cap TTL (config); re-issue on next login; move to JWE keyed by the asymmetric key family or to opaque ids; fix the gate.
- **Validation Plan:** **Unit** — payload no longer base64-decodable to PII (JWE) or contains only ids. **Security** — cookie theft no longer discloses other accounts' PII; forged accounts-list on a non-prod deploy rejected. **Regression** — account-picker UI still lists accounts. **Deletion validation** — no code reads a 365d max-age.
- **Deletion Plan:** Remove the dev-literal fallback; remove the 365d constant.
- **Rollback Plan:** Revert to the prior cookie format (verifiers accept both during one release). Low blast radius (convenience cookie, not the session).
- **Risk Level:** Low (S3) **but gating** for D-03 D2. Complexity: **S.** Timeline: **Wave 2 (before D2).** Owner: **Identity.**
- **Dependencies:** None hard; pairs with D-03.
- **Success Criteria:** TTL ≤90d; PII not plaintext-readable; dev-literal closed.

### D-05 — Collapse legacy Supabase `/auth/*` surface (AUTH-010/011/022, S2) — **LEGACY → DELETE**

- **Current State:** Public `/auth/signin|signup|signin/otp|password/reset` (`auth.ts:1281-1413`) issue raw Supabase JWT+refresh with no rotation/reuse/CSRF, only `authRateLimit` 20/5min; a **second** reset pipeline with **no `destroyAllUserSessions`** (AUTH-010); the channel that writes `user_metadata.role='seller'` (feeding AUTH-004). Two session regimes, two revocation stories.
- **Strategic State:** All sign-in/sign-up/OTP/reset flow through the hardened identity-platform custom path. The legacy routes are deprecated then deleted. One session regime, one revocation story.
- **Reasoning:** The "two parallel systems" pattern; deleting it also closes AUTH-004 (client-writable role channel) and AUTH-010 (orphan reset pipeline). A1 names it LEGACY-delete.
- **Migration Plan:** (1) Flag the legacy routes off for **new** traffic (return 410/redirect to the custom path). (2) Keep Supabase token **verification** alive until in-flight Supabase sessions expire (their ~1h access-token TTL + refresh). (3) Migrate any client still calling them. (4) Delete the routes + the `authRateLimit` that only they used.
- **Validation Plan:** **Integration** — legacy endpoints return 410/redirect; the custom path handles all flows. **Security** — no path writes `user_metadata.role`; one reset pipeline only (single-use + `destroyAllUserSessions`). **E2E** — login/signup/OTP/reset across realms via the custom path. **Contract** — no consumer (mobile-bff, web apps) depends on a Supabase-native token after cutover. **Deletion validation** — grep shows the legacy route handlers removed.
- **Deletion Plan:** Remove `auth.ts:1281-1413` handlers + the legacy `authRateLimit` mount (`index.ts:662-670`) after the drain.
- **Rollback Plan:** Re-enable the flag (routes return during a release) while still inside the verification-drain window. After deletion, rollback = revert the deletion PR (ARB-gated).
- **Risk Level:** Medium (S2). Complexity: **M.** Timeline: **Wave 2 (deprecate) → Wave 3 (delete).** Owner: **Identity + Fulfillment/Identity squad.**
- **Dependencies:** D-03 (so the surviving path is the asymmetric one); mobile-bff confirmed not to need Supabase-native tokens.
- **Success Criteria:** Legacy routes gone; one reset pipeline; `user_metadata.role` no longer authoritative anywhere.

### D-06 — Unify sessions under one session service (SESSION_FORENSICS; AUTH §3) — **CANONICAL (consolidate) + DEAD (v2 stack)**

- **Current State:** 5 live session impls under 3 realms + 1 dead v2. The merchant session is — **per the June-10 audit (superseding the June-09 SESSION_FORENSICS)** — **rotating, idle-timed, reuse-detecting** via `validate_and_rotate_merchant_session` (`merchant-session.ts:38-39`, statuses `revoked`/`reuse_detected`); logout/reset actually kill tokens (`logout/route.ts:41`, `reset-password/route.ts:86`). *(The June-09 doc described a bare 30d opaque token with no rotation; the gap was hardened between audits — note the delta, honor June-10.)* Refresh rotation/reuse for the *generic* case is still interface-only (`session-core`). The dead v2 (`identity-foundation/session-services.ts`) implements rotation the live ones now also have — a mis-wire trap.
- **Strategic State:** One session service in `identity-platform` owns all three realms with a single revocation authority; refresh rotation + reuse-detection are real (built with OIDC at Wave 7); the dead v2 is deleted.
- **Reasoning:** SSO needs a single revocable session authority, not 5 parallel realms (SSO_READINESS §2.3). The dead stack must go so it can't be mis-wired (SESSION_FORENSICS §5).
- **Migration Plan:** Promote the merchant session machinery to the canonical session service; bring console + customer session minting under the same module (keeping their distinct realms/cookies/TTLs); add idle + absolute timeouts where missing; back the internal-SSO JTI replay cache with KV/Redis (AUTH-021, today a per-isolate `Map`).
- **Validation Plan:** **Unit** — rotation on interval; reuse-detection flips status; idle + absolute timeout enforced. **Integration** — logout/reset kill the session across realms. **E2E** — login/logout/refresh/switch across merchant/customer/ops. **Security** — stolen token dies on rotation/logout; replayed internal JTI rejected cross-isolate (post-KV). **Deletion validation** — v2 stack gone.
- **Deletion Plan:** **SAFE_DELETE** `identity-foundation/session-services.ts` `createDormant*` + `auth-verifier-registry.ts`; resolve `session-core` (rewrite-as-real at Wave 7 or delete).
- **Rollback Plan:** Session-service consolidation is behind a flag per realm; revert per realm. Deleting v2 has no runtime callers → zero rollback risk.
- **Risk Level:** Medium. Complexity: **M.** Timeline: **Wave 3 (consolidate) + Wave 7 (refresh-real).** Owner: **Identity.**
- **Dependencies:** D-03 (one signing key), D-05 (legacy session regime gone).
- **Success Criteria:** One session service; v2 deleted; durable JTI cache; refresh rotation real by Wave 7.

### D-07 — Cookie + CSRF hardening (AUTH-005/006/014/015; COOKIE_GOVERNANCE D2/D4/D5) — **CANONICAL (harden)**

- **Current State:** Realm split is correct and strong (positive). But: parent-domain `lb_session` means an XSS on the weakest platform subdomain (developer-portal/theme-marketplace) yields a CSRF token + session valid against admin/console (AUTH §12-E); CSRF is a **JS-readable** double-submit token whose only real defense is `SameSite=strict` (`cookies.ts:144`); cookie domain hard-defaults to `.letbuyy.store` while canonical is `letbuyy.com` (a silent SSO/logout break at cutover — D2); dual CSRF names (`letbuyy_csrf`/`lb_csrf`); no `__Host-`/`__Secure-` prefixes.
- **Strategic State:** Per-app cookie scoping for high-trust apps (console isolated); CSRF moved to an `httpOnly` + Origin/Referer-checked or signed-per-session model; `COOKIE_DOMAIN` driven from one shared config and migrated to `.letbuyy.com` (coordinated with the domain canonicalization, A0); legacy `lb_csrf` retired; `__Host-`/`__Secure-` adopted where parent-domain allows.
- **Reasoning:** The double-submit pattern adds little over `SameSite=strict` alone here, and parent-domain cookies turn the weakest subdomain's XSS into an admin/console compromise. The domain literal is a latent SSO-break tied to the `letbuyy.store→letbuyy.com` migration.
- **Migration Plan:** Centralize cookie config; flip `COOKIE_DOMAIN` at the domain cutover (coordinate with merchant-control-plane's duplicated logout literal — COOKIE_GOVERNANCE D2); isolate console cookies; rework CSRF.
- **Validation Plan:** **Security** — XSS on a low-trust subdomain can no longer forge against console (per-app scope + httpOnly CSRF); Origin/Referer enforced. **E2E** — SSO + logout still work post domain-flip. **Cross-realm test** — no platform cookie host-only, no customer cookie parent-domain (assert clean, COOKIE_GOVERNANCE §4). **Regression** — single CSRF name accepted.
- **Deletion Plan:** Retire `lb_csrf`; remove the `.letbuyy.store` literal everywhere.
- **Rollback Plan:** Cookie-domain flip is the riskiest (SSO break) — stage behind `COOKIE_DOMAIN` env in every environment; rollback = restore the env value. CSRF rework behind a flag.
- **Risk Level:** Medium. Complexity: **M.** Timeline: **Wave 3** (domain piece coordinated with A0 domain cutover). Owner: **Identity.**
- **Dependencies:** A0 domain canonicalization (`letbuyy.com`).
- **Success Criteria:** Console cookies isolated; httpOnly CSRF; one CSRF name; domain-flip ships without SSO/logout breakage.

### D-08 — RBAC default-deny + claims→GUC honesty (AUTH-004/007; FND-026) — **CANONICAL (harden); joins A2**

- **Current State:** Ops RBAC is **scope-fine and well-built** (positive): `requireRoleCategory('ops') + requireSuperAdmin` + per-route `requirePermission(scope)`, DB-backed `employee_permissions`, dual-control on `payout.release`/`refund.approve`/`merchant.suspend` (FOUNDATION_AUDIT RBAC matrix; the code comment "never trust role claims carried on the JWT" at `rbac.ts:460-464`). **Gaps:** (1) `getSupabaseBearerAuthContext` reads `app_metadata?.role ?? user_metadata?.role` and `user_metadata` is **client-writable** (AUTH-004); `store-context.ts:160` defaults to `['owner']` when role is empty. (2) No **default-deny middleware** — if a future ops route omits `requirePermission`, it fails open (FND-026). (3) Tenant isolation rides solely on `storeContext`/`verifySiteOwnership` because the gateway is `service_role` (RLS bypassed) — a single missing middleware = cross-tenant breach (AUTH-007).
- **Strategic State:** Role derived **only** from `app_metadata`/DB (drop the `user_metadata` fallback and the `['owner']` default — fail to least-privilege); a **default-deny middleware** so a route missing its permission check fails closed; the **claims→GUC bridge becomes REAL** — validated JWT claims drive the per-transaction `SET LOCAL app.site_id` (the A2 backstop), so RLS stops being decorative.
- **Reasoning:** A1 requires the claims→GUC bridge to be real and feed tenant isolation. The `user_metadata.role` channel is the bounded-but-real escalation (AUTH §5 E-3/E-7). Default-deny is the structural fix for "a single forgotten middleware = breach."
- **Migration Plan:** Remove the `user_metadata` fallback + owner-default; add default-deny middleware (ops routes deny unless an explicit permission is asserted); census every store-scoped route for `storeContext` (AUTH-007); wire claims→GUC (joins A2's off-`service_role` / `SET LOCAL` work).
- **Validation Plan:** **Security** — tampered `user_metadata.role` has **no** authz effect (Walkthrough D fails); a route without `requirePermission` denies by default; cross-tenant param/header/query tamper → 404 (already true for guarded routes — assert it holds). **Unit** — role resolves from `app_metadata`/DB only. **Integration** — claims→GUC sets the right `app.site_id`; unset GUC ⇒ zero rows. **Regression** — legitimate owners/staff retain correct scopes.
- **Deletion Plan:** Delete the `user_metadata` role read and the `['owner']` default.
- **Rollback Plan:** Middleware + claims→GUC behind a flag (default-deny can be staged route-class by route-class). Rollback = disable the flag (re-opens the gap — ARB-gated).
- **Risk Level:** High (S2 + tenancy). Complexity: **M.** Timeline: **Wave 4** (interlocks with A2 tenancy waves). Owner: **Fulfillment/Identity + Platform.**
- **Dependencies:** A2 (off-`service_role` connection + `SET LOCAL` GUC); D-05 (legacy `user_metadata` channel gone).
- **Success Criteria:** Role never sourced from client-writable metadata; default-deny live; claims→GUC drives RLS; route census complete.

### D-09 — Buyer passwordless OTP + enumeration/brute-force hardening (AUTH-009/013/016, S2/S3) — **CANONICAL (the model to keep, harden)**

- **Current State:** Buyer OTP is **passwordless** and the model to keep (V1 §3; SHOPIFY §5 ALIGN). The custom OTP is CSPRNG 6-digit, single-use, expiring (`auth.ts:209-213,1187,1275`). **Gaps:** the validate endpoint has **no per-OTP attempt counter/lockout** — only the upstream IP rate limit (AUTH-009); `/api/auth/lookup` confirms account existence + password-vs-OTP for any email (enumeration oracle, AUTH-013, and the precondition for the AUTH-001 takeover); slight modulo bias + no leading-zero codes (AUTH-016). The buyer Supabase-native OTP path (`/signin/otp`) delegates entropy/expiry/lockout to GoTrue (UNVERIFIED at the LetBuyy layer) — folded out by D-05.
- **Strategic State:** Per-(email,token) failed-attempt counter that **burns the OTP after ~5 misses**; shorter OTP TTL; `/lookup` softened (uniform response, or email a code regardless, or a soft challenge before disclosing); OTP sampled uniformly `[0,999999]` + zero-padded. Host-scoped cookies retained (R-CUST). Single buyer OTP path (the custom one) after D-05.
- **Reasoning:** Passwordless is the aligned, leapfrog model; the gaps are the residual hardening that turns it production-grade. `/lookup` is load-bearing for the takeover's precondition, so it is tightened in the same program as D-01.
- **Migration Plan:** Add the attempt counter (burn-on-N); fix the sampler; soften `/lookup`; ensure the only OTP path post-D-05 is the custom one.
- **Validation Plan:** **Security** — 6 wrong OTP guesses burn the code (enumeration/brute-force test); `/lookup` no longer a clean existence+method oracle; algorithm: leading-zero codes now possible. **Unit** — sampler uniform. **E2E** — buyer login via OTP across the storefront. **Regression** — legitimate OTP still single-use + expiring.
- **Deletion Plan:** Supabase-native buyer OTP path removed with D-05.
- **Rollback Plan:** Counter + sampler behind flags; revert restores prior (weaker) behavior — ARB-gated for the `/lookup` softening (UX trade-off).
- **Risk Level:** Medium. Complexity: **S.** Timeline: **Wave 2–3.** Owner: **Identity.**
- **Dependencies:** D-05 (single OTP path).
- **Success Criteria:** OTP burns after N; `/lookup` softened; uniform sampler; one buyer OTP path.

### D-10 — Consent ledger (DPDP) + DSR export/erasure (V1 §3; C-CONS) — **ABSENT → CANONICAL (build, P1)**

- **Current State:** **Nobody owns consent.** The OIDC consent route 501s (`oauth2/consent/route.ts`); there is no consent ledger and no DSR (data-subject-request) export/erasure path. V1 §3 mandates a DPDP consent ledger + DSR; the WhatsApp opt-in consent ledger (R8) is the same primitive.
- **Strategic State:** `identity-platform` owns a consent ledger (append-only, DPDP-aware) governing WhatsApp/marketing/analytics consent, plus a gateway DSR export + erasure path. Reused by both the WhatsApp lifecycle (V1 §11) and the future OIDC consent step (Wave 7).
- **Reasoning:** DPDP is a legal go-live requirement for India (R8, S1). A1 puts consent ownership in identity-platform. Building it now (P1) means OIDC's consent endpoint (Wave 7) has a ledger to write to rather than inventing one.
- **Migration Plan:** Schema (`consents` table per V1 §9 data-domains); write API in identity-platform; DSR export (assemble a subject's data) + erasure (tombstone/anonymize) in the gateway; wire WhatsApp opt-in to it.
- **Validation Plan:** **Integration** — consent recorded/withdrawn; a withdrawn consent blocks the corresponding send. **E2E** — DSR export returns the subject's data; erasure removes/anonymizes it. **Security** — consent records are append-only/tamper-evident; only the subject (or authorized ops) can trigger a DSR. **Contract** — WhatsApp send checks the ledger before dispatch.
- **Deletion Plan:** N/A (greenfield build); the 501 consent route is replaced by the real one at Wave 7.
- **Rollback Plan:** Behind a flag; consent ledger can be disabled (but then WhatsApp sends must hard-stop — fail-closed, not open).
- **Risk Level:** High (legal/S1). Complexity: **M.** Timeline: **Waves 5–6 (P1).** Owner: **Identity + Notifications.**
- **Dependencies:** None hard; precedes OIDC consent (Wave 7) and WhatsApp lifecycle (D4 in the master plan).
- **Success Criteria:** Consent ledger live; DSR export + erasure pass; WhatsApp gated on consent.

### D-11 — Merchant MFA (TOTP) parity (AUTH §8; H10) — **CANONICAL (extend)**

- **Current State:** MFA (TOTP) exists for **ops only** (`platform-console` HOTP-SHA1; the login flow enforces merchant MFA *if enrolled* — `auth.ts:529-535`, `enforceMerchantMfaIfEnrolled`, secret AES-GCM-encrypted with `TOTP_ENCRYPTION_KEY`, fail-closed if unset). But merchant MFA **enrollment** is not a first-class, broadly-available flow (H10 "no merchant MFA" as a default posture; June-09). The TOTP availability fails to `MFA_UNAVAILABLE` if the key is unset (AUTH-023 — correct fail-closed, but an availability risk).
- **Strategic State:** Step-up TOTP MFA available to **all realms**, with first-class merchant enrollment; `TOTP_ENCRYPTION_KEY` treated as required-at-boot with monitoring on `MFA_UNAVAILABLE`. Sets the stage for WebAuthn (D-12) as the stronger second factor.
- **Reasoning:** A money-adjacent merchant surface should offer MFA; the enforcement plumbing already exists (`enforceMerchantMfaIfEnrolled`), so this is mostly an enrollment + availability-hardening task, not net-new crypto.
- **Migration Plan:** Build merchant TOTP enrollment UI + recovery codes; monitor `MFA_UNAVAILABLE`; make `TOTP_ENCRYPTION_KEY` boot-required.
- **Validation Plan:** **Integration** — enroll → login requires TOTP → recovery code path. **Security** — secret encrypted at rest; fail-closed when key unset (alert fires). **E2E** — merchant MFA across web + mobile.
- **Deletion Plan:** N/A.
- **Rollback Plan:** Enrollment behind a flag; enforcement already gated on enrollment, so rollback = disable enrollment (existing enrollees keep working or are migrated).
- **Risk Level:** Medium. Complexity: **M.** Timeline: **Wave 6.** Owner: **Identity.**
- **Dependencies:** D-03 (key service / KMS for the MFA secret too).
- **Success Criteria:** Merchant TOTP enrollment GA; `MFA_UNAVAILABLE` monitored; recovery codes.

### D-12 — WebAuthn / passkeys (C-PASS) — **ABSENT → CANONICAL but DEFERRED**

- **Current State:** **Nobody.** `FEATURE_PASSKEY` flag exists with **zero consumers** (`features.ts:14`); no WebAuthn implementation anywhere. Shopify's own customer accounts do **not** natively support passkeys (SHOPIFY §5) — so this is genuinely ahead-of-need.
- **Strategic State:** `identity-platform` owns WebAuthn (passkeys) as a step-up / passwordless-strong second factor for merchants and ops, built on the same issuer + asymmetric-key infrastructure. **Deferred** until the asymmetric token kernel (D-03), session service (D-06), and MFA (D-11) land, and until merchant demand justifies it.
- **Reasoning:** A1 lists passkeys as canonical-deferred. Passkeys ride on the same primitives (attestation/assertion verification, asymmetric keys) the OIDC build establishes; building them before the issuer is consolidated would fork crypto. Demand-gate it (matches Shopify's "advanced auth via external IdP / not native" posture).
- **Migration Plan:** WebAuthn registration + assertion ceremonies in identity-platform; bind credentials to the user; offer as MFA-strong / passwordless-strong; flip `FEATURE_PASSKEY` on per cohort.
- **Validation Plan:** **Security** — assertion replay rejected (challenge single-use); credential bound to user + RP id; algorithm-pinning on attestation. **E2E** — register passkey → login with passkey across web (+ mobile platform authenticator). **Integration** — passkey as a step-up for payout/refund.
- **Deletion Plan:** N/A (greenfield; the dormant flag becomes real).
- **Rollback Plan:** `FEATURE_PASSKEY` off (it is off today) — zero risk to disable.
- **Risk Level:** Low (deferred). Complexity: **L.** Timeline: **Wave 8 (deferred-canonical).** Owner: **Identity.**
- **Dependencies:** D-03 (asymmetric kernel), D-06 (session service), D-11 (MFA), demand trigger.
- **Success Criteria:** Passkey register/login GA for a pilot cohort; replay/binding tests green.

### D-13 — OIDC provider completion (C-OIDC; AUTH-020) — **ABSENT/501 → CANONICAL but DEFERRED**

- **Current State:** A **501 skeleton.** All six `oauth2/*` routes + the two `.well-known` docs + `/jwks` are one-line wrappers around `oidcSkeletonResponse` → **404 flag-off (default), `mock:true` discovery, literal-string `MOCK_JWKS`, 501 for every functional endpoint** (authorize/token/userinfo/consent/logout/callback). **0/16** OIDC-provider capabilities functional (OIDC_READINESS). PKCE is real **only** for app-marketplace install (machine-to-machine), not human SSO. The platform advertises an ES256 JWKS it cannot sign with (AUTH-020) — a foot-gun: enabling the flags would publish an unusable issuer to real relying parties.
- **Strategic State:** A **real OIDC provider in `identity-platform`** — rotating JWKS (real keys, from the Wave-2 key service), client registry, authorize (PKCE/state/nonce/consent), token (code→`id_token`/`access_token`, audience/scope), refresh rotation + reuse-detection, revocation + introspection, back/front-channel logout. **Built only when SSO / headless-merchant / partner-app demand exists** (A1; SHOPIFY §5 "defer honestly"; V1 notes "OIDC readiness").
- **Reasoning:** This is the **PARITY-GAP** vs Shopify's Customer Account API (which *is* an OIDC IdP). For the 100→10k envelope it is acceptable to defer, but it must be labeled a **gap, not a feature**, and the skeleton JWKS must **not** be advertised. The consumer-OAuth (app-install) PKCE is already real and is the pattern to reuse.
- **Migration Plan:** (Wave 7) Build on the now-real key service (D-03 made JWKS real and proved rotation in D4): client registry → authorize+consent (writes to the D-10 consent ledger) → token endpoint → userinfo → refresh rotation (D-06) → revocation/introspection → back-channel logout. Keep `FEATURE_IDENTITY_PROVIDER` **off** and serve **404** (not placeholder JWKS) until each piece is real.
- **Validation Plan:** **Contract** — discovery doc matches implemented endpoints; a relying party completes authorize→token→userinfo with PKCE+state+nonce. **Security** — `state`/`nonce` bound + verified (closes AUTH-019); code single-use; token audience/scope enforced; revocation actually revokes; algorithm-pinning on `id_token`. **E2E** — a sample RP (CLI device-code + a web RP) logs in via the IdP; back-channel logout propagates. **Performance** — JWKS cache + rotation under load.
- **Deletion Plan:** Replace `oidcSkeletonResponse` + `MOCK_JWKS` with the real implementation; the 501 stubs become real handlers.
- **Rollback Plan:** `FEATURE_IDENTITY_PROVIDER` off → 404 (the safe default). Each endpoint ships behind the flag; rollback = flag off + serve 404 (never placeholder JWKS).
- **Risk Level:** Medium (deferred; foot-gun if half-enabled). Complexity: **L.** Timeline: **Wave 7 (deferred-canonical, demand-gated).** Owner: **Identity.**
- **Dependencies:** D-03 (real asymmetric key service + JWKS rotation), D-06 (refresh/session service), D-10 (consent ledger). **Hard gate:** do not advertise discovery/JWKS until real.
- **Success Criteria:** A real RP authenticates end-to-end; revocation/introspection work; no placeholder JWKS ever served; flag stays off until each endpoint is real.

### D-14 — Mobile auth hardening (AUTH-017/018/025) — **CANONICAL (the best surface, harden)**

- **Current State:** The Flutter merchant app is the best-finished surface (3.1/5); tokens live in `FlutterSecureStorage` (Keychain/Keystore — **not** plaintext; the prior "plaintext SharedPreferences" concern does **not** hold — AUTH §9); Turnstile is enforced + fail-closed (login gated, not blocked — supersedes the old "login blocked" memory); mobile-bff is a clean signing proxy. **Gaps:** no TLS **certificate pinning** (AUTH-018; UNVERIFIED beyond files read); only the email pre-fill is in plaintext `SharedPreferences` (AUTH-017, minor); `debugPrint` may surface backend error bodies (AUTH-025).
- **Strategic State:** Cert/public-key pinning for the gateway + bff hosts; email pre-fill moved to secure storage or omitted; `debugPrint` stripped in release builds.
- **Reasoning:** Cert pinning is the expected control for a money-adjacent app; the rest is low-risk hygiene. The mobile session inherits the asymmetric-token + session-service changes automatically (it reuses `lb_session`).
- **Migration Plan:** Add pinning layer; move/omit the email pre-fill; release-build `debugPrint` strip.
- **Validation Plan:** **Security** — MITM with a rogue cert fails (pinning); no token in logs; release build has no `debugPrint`. **E2E** — login/OTP on prod with real Turnstile keys (UNVERIFIED config dependency). **Regression** — secure-storage token flow unchanged.
- **Deletion Plan:** Remove the email-in-prefs write.
- **Rollback Plan:** Pinning behind a remote-config kill-switch (so a cert rotation gone wrong doesn't brick the app).
- **Risk Level:** Medium. Complexity: **M.** Timeline: **Wave 4–6** (with the broader mobile hardening). Owner: **Mobile + Identity.**
- **Dependencies:** Real Turnstile keys configured (deployment, UNVERIFIED); D-03 (mobile verifies the asymmetric token via bff/gateway).
- **Success Criteria:** Pinning live with a kill-switch; no token/PII in logs; prod login confirmed.

---

## 7. Test & Validation Plan (per-migration matrix)

Every migration above carries its own test block; this section states the **standard test classes** the program applies to each, so nothing ships without them.

| Test class | What it must prove (identity-wide) | Applied especially to |
|---|---|---|
| **Unit** | Each signer/verifier/guard behaves per spec in isolation (alg, `aud`, scope resolution, OTP sampler, session rotation). | D-01, D-03, D-08, D-09 |
| **Integration** | Cross-module flows hold (identity-platform ↔ gateway ↔ webhook ↔ console; consent ↔ WhatsApp; MFA enrollment ↔ login). | D-03, D-05, D-06, D-10, D-11 |
| **Contract (token claims across services)** | A token minted by the issuer verifies in every consumer with the **public** key; wrong-`aud` is rejected; claim shape is pinned per audience; consumer fixtures fail if the issuer changes a claim incompatibly. | **D-03** (primary), D-05, D-13 |
| **E2E (login/logout/refresh/switch/reset across realms)** | A real user can log in, log out, refresh, switch accounts, and reset — in **each** realm (merchant/customer/ops) — through the consolidated path. | D-01, D-05, D-06, D-09, D-13 |
| **Security (forgery / replay / escalation / enumeration / algorithm-pinning)** | Forge-with-public-key **fails**; replayed OTP/JTI/auth-code **rejected**; client-writable role has **no** authz effect; `/lookup` is not a clean oracle; `alg:none`/HS256-post-D3 **rejected**; anon `super_admin_allowlist` INSERT **denied**; the AUTH §12 walkthroughs A–E all **fail**. | **All** — this is the gate |
| **Performance** | Asymmetric verify adds no p99 regression at the gateway hot path; JWKS cache + rotation hold under load; session validate (DB RPC) within budget. | D-03, D-06, D-13 |
| **Regression** | Every pre-existing auth E2E passes through each wave (esp. the dual-verify window D1–D2). | All |
| **Rollback validation** | Each migration's documented rollback is **drilled** in staging — esp. **D3 of the token cutover** (rollback = re-widen verifier, NOT revert issuer; prove a wrong rollback would have invalidated all sessions, and that the right one doesn't). | **D-03 (mandatory drill)**, D-02, D-05, D-07 |
| **Deletion validation** | After each LEGACY/DEAD removal, grep/CI confirms the code path is gone and nothing imports it (legacy `/auth/*` handlers; v2 shadow stack; `AUTH_SECRET` signer; `MOCK_JWKS`; `lb_csrf`; `user_metadata.role` read). | D-05, D-06, D-03, D-07, D-08 |

**Standing CI gates added by this program:**
- **Policy-lint:** fail CI on any RLS policy that is `USING(true)` to PUBLIC without a `TO` role or tenant predicate (recurrence guard for AUTH-003 + the 6 sibling leaks).
- **Signer-lint:** fail CI on any new `|| AUTH_SECRET` signer fallback or any HS256 sign path after D3.
- **Cross-realm cookie test:** fail CI if any platform cookie is host-only or any customer cookie carries a parent domain.
- **Switch regression:** assert 401 on unauthenticated `/api/auth/switch` (the AUTH-001 sentinel).
- **Middleware presence:** assert `identity-platform` has a default-deny `middleware.ts` (today: none).

---

## 8. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Wave |
|---|---|---|---|---|---|---|
| IR-1 | **The switch fix is lost** (working-tree-only) before it's committed — a `git stash`/clean checkout deletes it. | High | Critical | Clean tree (ISSUE-171) + commit **first thing** in Wave 1; regression test pins it. | Platform/Security | 0→1 |
| IR-2 | **Nothing deploys** — `main` ~30 commits behind; even committed fixes don't ship. | High | Critical | Wave 0 fixes the pipeline/branch lag (A0 meta-blocker) before any identity work claims "done." | Platform | 0 |
| IR-3 | **D3 token-cutover rollback done wrong** — reverting the *issuer* (not the verifier) invalidates every live session at once. | Medium | Critical | Issuer-alg and verifier-pin are **separately revertible**; mandatory rollback drill; D3 gated on zero legacy verifications. | Platform/Security + service owners | 2 |
| IR-4 | **`super_admin_allowlist` is live-exposed** via PostgREST (UNVERIFIED) — anon → super-admin today. | Medium (policy is certainly wrong; exposure UNVERIFIED) | Critical | Anon-key probe (`\dp public.super_admin_allowlist`) **before** S0 sign-off; fix the policy regardless; audit trigger. | Platform/Security + DB | 1 |
| IR-5 | **Cookie-domain flip breaks SSO/logout** at the `letbuyy.store→letbuyy.com` cutover (literal duplicated across apps). | Medium | High | Drive `COOKIE_DOMAIN` from one config; set it in **every** env; coordinate with A0 domain cutover + merchant-control-plane logout literal. | Identity | 3 |
| IR-6 | **Someone flips `FEATURE_IDENTITY_PROVIDER` early** and publishes the placeholder/mock JWKS to real RPs. | Medium | High | Treat both OIDC flags as **production-forbidden** until D-13 endpoints are real; serve **404** (not placeholder JWKS) while disabled; remove `MOCK_JWKS` in D0. | Identity | 1→7 |
| IR-7 | **Key compromise** of the new private signer. | Low | Critical | KMS-held key; `kid` rotation (D4) proven; revoke `kid` from JWKS + force re-auth. (Strictly **better** than the HS256 world.) | Platform/Security | 2+ |
| IR-8 | **Legacy `/auth/*` deletion strands a client** still issuing Supabase-native tokens. | Medium | Medium | Deprecate (410/redirect) → verification-drain window → delete; confirm mobile-bff + web apps migrated (contract tests). | Identity | 2→3 |
| IR-9 | **Default-deny middleware breaks a legitimate route** that relied on implicit-allow. | Medium | Medium | Stage route-class by route-class behind a flag; census first (AUTH-007); regression suite per class. | Fulfillment/Identity | 4 |
| IR-10 | **Consent ledger disabled → WhatsApp sends without consent** (DPDP breach). | Low | High (legal) | Consent check is **fail-closed**: ledger off ⇒ sends hard-stop, never open. | Identity + Notifications | 5–6 |
| IR-11 | **Mobile cert-pinning rotation bricks the app.** | Low | High | Pin behind a remote-config kill-switch; backup pin set. | Mobile | 4–6 |
| IR-12 | **June-09 vs June-10 audit drift** mis-scopes session work (June-09 said no rotation; June-10 says rotation exists). | Low | Medium | Honor June-10 (more current); treat session consolidation as "unify + add refresh," not "build rotation from zero." | Identity | 3 |
| IR-13 | **The 4-impl collapse re-introduces a regression** by deleting a path still in use. | Medium | High | Deletion-validation CI (grep + import check) per removal; drain windows before delete; flags. | Identity | 2→4 |

**UNVERIFIED items carried into go-live sign-off (do not treat as fact):**
- PostgREST exposure of `super_admin_allowlist` to anon/authenticated (the policy is wrong regardless; exposure determines S0-vs-S2). Confirm with an anon-key probe.
- Deployed env-var values: whether per-domain secrets are actually all provisioned in prod (determines today's real `AUTH_SECRET` blast radius), and whether real Turnstile keys are configured (determines mobile/web login on prod).
- Flutter TLS cert-pinning beyond the auth-service files read (a pinning layer could live elsewhere).
- Supabase-native OTP/reset entropy/expiry/lockout (delegated to GoTrue; UNVERIFIED at the LetBuyy layer) — mooted once D-05 removes the legacy path.

---

## Identity Canonicalization Findings / Actions

> IDs IDN-001…N. **Classification:** CANONICAL / TRANSITIONAL / LEGACY / DEAD / FROZEN. **Wave:** 0–8. **Risk:** S0/S1/S2/S3 (severity of the *current* defect, or "—/strategic" for build-forward items). **Evidence:** `path:line` or the controlling forensic ID.

| ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line) |
|---|---|---|---|---|---|---|
| IDN-001 | `/api/auth/switch` (vulnerable handler) | Commit + deploy the working-tree fix (require valid session + `lb_accounts` membership + rate-limit); add 401-no-session regression test | DEAD (vuln) → CANONICAL (fix) | 1 | **S0** | `apps/identity-platform/src/app/api/auth/switch/route.ts` (HEAD); `git diff HEAD`; AUTH-001 |
| IDN-002 | `super_admin_allowlist` RLS policy | Rewrite `TO service_role ... auth.role()='service_role'`; REVOKE anon/authenticated; audit trigger; verify PostgREST exposure | DEAD (policy) → CANONICAL (scoped) | 1 | **S0/S1** | `database/.../000_baseline.sql:26669` (cf. `:26659`); AUTH-003 / FND-005 |
| IDN-003 | Token kernel signing (7-domain `AUTH_SECRET` HS256) | Migrate to identity-platform sole asymmetric signer (EdDSA/Ed25519; ES256 fallback) + verify-only services + per-`aud` claims; dual-verify cutover D0–D4 | TRANSITIONAL → CANONICAL | 1→2 | **S1** | `cookies.ts:13`; `console-session.ts:24`; `checkout.ts:86`; `media.ts:60`; `export.ts:174`; `internal-console.ts:439`; `webhook-service/src/index.ts:543`; AUTH-002 / ISSUE-027 |
| IDN-004 | Per-domain secrets + `|| AUTH_SECRET` fallbacks | Make every per-domain secret mandatory/fail-closed; remove all `|| AUTH_SECRET`; decommission `AUTH_SECRET` as a signer | TRANSITIONAL → CANONICAL | 1→2 | S1 | §5.1 census; `console-session.ts:35-37` (the fail-closed pattern to copy); AUTH-002 |
| IDN-005 | `identity-platform` lib (orchestrator) | The surviving issuer; add default-deny `middleware.ts`; own all issuance/session/cookie/OTP/OAuth/OIDC/consent | CANONICAL | 1→7 | — | `apps/identity-platform/src/app/api/auth/*`; A1; IDENTITY_ARCHITECTURE_FORENSICS §3 |
| IDN-006 | Gateway `routes/auth.ts` session-mint (I-2) | Keep DB-RPC primitives as the issuer's storage; move mint/policy into identity-platform; reduce gateway to **verify-only** enforcement | TRANSITIONAL → LEGACY (mint) | 2→3 | S2 | `services/api-gateway/src/routes/auth.ts` (1,441 ln); AUTH §2.1, §3 |
| IDN-007 | Gateway "identity-foundation" shadow stack (I-3) | **SAFE_DELETE** the in-memory dormant factories + registry; resolve `*-core` packages per-package at Wave 7 (default DELETE) | DEAD | 3 (delete) / 7 (`*-core` decision) | — | `services/api-gateway/src/identity-foundation/session-services.ts:29-114`; `auth-verifier-registry.ts:48-53`; `packages/session-core/src/index.ts:17-49` |
| IDN-008 | Legacy Supabase `/auth/*` surface (I-4) | Deprecate (410/redirect) → verification-drain → delete; removes the `user_metadata.role` channel + the orphan reset pipeline | LEGACY → DELETE | 2 (deprecate) → 3 (delete) | S2 | `services/api-gateway/src/routes/auth.ts:1281-1413`; AUTH-010/011/022 |
| IDN-009 | Session service (5 live + dead v2) | Consolidate all 3 realms under one revocable session authority in identity-platform; build real refresh rotation/reuse; delete v2 | CANONICAL (consolidate) + DEAD (v2) | 3 (consolidate) → 7 (refresh-real) | S2 | `merchant-session.ts:38-39`; `session-core/src/index.ts:17-49`; SESSION_FORENSICS |
| IDN-010 | `lb_session` cookie (parent-domain) | Keep for first-party SSO; isolate high-trust apps (console); `__Host-`/`__Secure-` where allowed; reduce blast radius | CANONICAL (harden) | 3 | S2 | `cookies.ts:58,83`; AUTH-006 |
| IDN-011 | CSRF token (JS-readable double-submit) | Move to httpOnly + Origin/Referer-checked or signed-per-session; retire dual name `lb_csrf` | CANONICAL (harden) | 3 | S2 | `cookies.ts:144`; `csrf.ts:22,32`; AUTH-005 |
| IDN-012 | Cookie domain `.letbuyy.store` literal | Drive `COOKIE_DOMAIN` from one config; migrate to `.letbuyy.com` at A0 cutover; remove the duplicated literal | TRANSITIONAL → CANONICAL | 3 | S2 (latent) | `cookies.ts:53-54`; COOKIE_GOVERNANCE D2 |
| IDN-013 | `lb_accounts` cookie (signed-not-encrypted, 365d) | Cap TTL ≤90d (prereq for token-drain D2); JWE-encrypt or store opaque ids; fix dev-literal gate + "encrypted" comments | TRANSITIONAL → CANONICAL | 2 | S3 | `cookies.ts:176-181,223`; AUTH-014/015; COOKIE_GOVERNANCE D1/D3 |
| IDN-014 | RBAC role source (`user_metadata.role` + `['owner']` default) | Derive role only from `app_metadata`/DB; drop the fallback + owner-default (fail to least-privilege) | CANONICAL (harden) | 4 | S2 | `auth.ts:182`; `store-context.ts:160`; AUTH-004 |
| IDN-015 | Default-deny middleware (absent) | Add default-deny so a route missing `requirePermission` fails closed; census store-scoped routes for `storeContext` | CANONICAL (build) | 4 | S2 | `find src -name middleware.ts` → none; FND-026; AUTH-007 |
| IDN-016 | Claims→GUC bridge | Make it REAL — validated JWT claims drive per-transaction `SET LOCAL app.site_id` (the A2 backstop); RLS stops being decorative | CANONICAL (build) | 4 | S1 (tenancy) | A1; V1 §3/§6; AUTH §2.4; cross-ref A2 |
| IDN-017 | Ops RBAC engine (scope-fine + dual-control) | Keep as-is (a genuine strength); its ceiling rests on IDN-002 | CANONICAL | — | — (positive) | `middleware/rbac.ts:269-352,460-464,181-208`; FOUNDATION_AUDIT RBAC matrix |
| IDN-018 | Buyer OTP (custom, passwordless) | Keep the model (leapfrog); add per-(email,token) attempt counter (burn-on-N); fix sampler bias | CANONICAL (harden) | 2–3 | S2/S3 | `auth.ts:209-213,1233-1276`; AUTH-009/016 |
| IDN-019 | `/api/auth/lookup` enumeration oracle | Soften (uniform response / soft challenge); it is the AUTH-001 takeover precondition | CANONICAL (harden) | 2 | S2 | `lookup/route.ts:56-60`; `auth.ts:457-465`; AUTH-013 |
| IDN-020 | Internal-SSO JTI replay cache (in-memory Map) | Back with KV/Redis (durable, cross-isolate) | CANONICAL (harden) | 3 | S3 | `internal-auth.ts:45`; AUTH-021 |
| IDN-021 | Consent ledger + DSR export/erasure | Build in identity-platform (DPDP); fail-closed; reused by WhatsApp + OIDC consent | ABSENT → CANONICAL | 5–6 | S1 (legal) | `oauth2/consent/route.ts` (501); V1 §3; A1 |
| IDN-022 | Merchant MFA (TOTP) | Extend MFA to merchants (first-class enrollment + recovery codes); `TOTP_ENCRYPTION_KEY` boot-required + monitored | CANONICAL (extend) | 6 | S2/S3 | `auth.ts:173-181,529-535`; AUTH-023; H10 |
| IDN-023 | Refresh / rotation (interface-only) | Build real refresh rotation + reuse-detection (with the session service + OIDC) | DEAD/STUB → CANONICAL | 7 | S2 | `packages/session-core/src/index.ts:17-49`; SESSION_FORENSICS §4 |
| IDN-024 | OIDC provider (501 skeleton, mock JWKS) | Build real IdP (JWKS rotation, client registry, authorize/token/userinfo/consent/logout, revocation/introspection); flag stays off + 404 until real; never serve placeholder JWKS | ABSENT/501 → CANONICAL but DEFERRED | 7 | S3 (foot-gun) | `oidc-disabled.ts:11,50-103`; AUTH-020; OIDC_READINESS (6/100) |
| IDN-025 | OAuth `state`/`nonce` binding (consent UI) | Bind + verify `state`/`nonce` to the session in the consent handler (closes the consent-step CSRF) | CANONICAL (harden, with OIDC) | 7 | S3 | `index.ts:1048`; `billing-oauth-routes.ts`; AUTH-019 |
| IDN-026 | App-marketplace OAuth2-S256-PKCE | Keep as-is (genuinely good; the consumer-OAuth pattern identity reuses); also the seam A9 keeps frozen | CANONICAL | — | — (positive) | `app-store/shared.ts:274-298`; `billing-oauth-routes.ts:1319-1358`; AUTH §10 |
| IDN-027 | WebAuthn / passkeys (`FEATURE_PASSKEY`, no consumers) | Build on the issuer + asymmetric kernel; demand-gated; flip the dormant flag per cohort | ABSENT → CANONICAL but DEFERRED | 8 | — (strategic) | `apps/identity-platform/src/lib/config/features.ts:14`; A1; SHOPIFY §5 |
| IDN-028 | Mobile auth (Flutter) | Add cert/public-key pinning (kill-switch) + move/omit email pre-fill + strip release `debugPrint`; inherits asymmetric token automatically | CANONICAL (harden) | 4–6 | S3 | `store_auth_service.dart` (no pinning); `login_screen.dart:123`; AUTH-017/018/025 |
| IDN-029 | `MOCK_JWKS` literal | Remove in token-cutover D0 (stop advertising an unsignable key); serve 404 for JWKS while OIDC disabled | DEAD | 1→2 | S3 | `oidc-disabled.ts:4-16,11-12`; AUTH-020 |
| IDN-030 | Customer/buyer realm (`auth-core` host-only) | Keep — the cleanest owner today and the model for the other realms; host-scoped cookies, passwordless | CANONICAL | — | — (positive) | `packages/auth-core/src/index.ts:693-764`; `cookies.ts:43`; AUTH §3 |

**Classification counts (30 actions):** **CANONICAL** (incl. "harden"/"extend"/"build", and the positives kept as-is): **20** — IDN-005, 010, 011, 014, 015, 016, 017, 018, 019, 020, 021(build), 022, 025, 026, 028, 030, plus the build-forward CANONICAL-but-DEFERRED 024/027 counted here as canonical-destination. **TRANSITIONAL→CANONICAL / TRANSITIONAL:** **4** — IDN-003, 004, 012, 013. **LEGACY:** **2** — IDN-006 (mint), IDN-008. **DEAD:** **5** — IDN-001 (vuln), IDN-002 (policy), IDN-007, IDN-023(stub→build), IDN-029. **FROZEN:** **0** in identity proper (the app-marketplace/developer-portal *seams* are FROZEN under A9, not identity). *(Several rows span states — vuln/policy "DEAD→CANONICAL", stub "DEAD/STUB→CANONICAL" — counted by their current-state classification for the DEAD tally and by their destination for the CANONICAL tally; net distinct actions = 30.)*

**Deferred-canonical (explicitly later waves, demand-gated):** IDN-024 (OIDC, Wave 7), IDN-023/025 (refresh + state/nonce, Wave 7), IDN-027 (passkeys, Wave 8). **Wave-0/1 security gate (must ship first):** IDN-001, IDN-002, IDN-003/004 (start), IDN-029.

---

*End of Identity Migration Master Plan. Every decision is anchored to `_ANCHOR_DECISIONS_SPINE.md` A1 and to code-evidenced findings in `FORENSIC_MASTER_2026_06_10/AUTH_FORENSIC_AUDIT.md` (AUTH-001…025), `FOUNDATION_AUDIT.md`, and the June-09 `IDENTITY_PLATFORM_AUDIT/` set (superseded where the June-10 audit is more current). Items dependent on live runtime, deployed env-var values, or PostgREST schema exposure are marked UNVERIFIED and must be confirmed before S0 sign-off.*

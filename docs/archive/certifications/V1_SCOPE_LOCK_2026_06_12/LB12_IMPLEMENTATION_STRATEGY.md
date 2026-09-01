# LB-12 — Shopper Registration: Implementation Strategy

**Date:** 2026-06-13 · **Mode:** research/blueprint · all claims cite file:line.

## TL;DR

A never-ordered shopper cannot create an account (the `not_found` state dead-ends, `account-bottom-sheet.tsx:372-413`), and the `set_password` "Create Account" button is broken (calls `setPassword` without a resetToken → rejected at `customer-auth-context.tsx:145` and `set-password/route.ts:35`). Fix: **one new public `POST /storefront/customer/register`** (Turnstile + rate-limit + not-exists precondition → safe token-less first password → mint customer session), a storefront proxy that **re-mints the session locally** (mandatory), a context `register()` action, and a register CTA in `not_found`. **Customer-only; reuses the existing HS256 issuer; touches zero merchant/identity-platform code.**

## Existing flows (documented, file:line)

- **Identity vs password split:** `store_customers` = identity row (`password_hash` nullable); `customer_credentials` = password store. `hasPassword` is driven by `customer_credentials` (`customer-engagement-routes.ts:681-686`), NOT `store_customers.password_hash`.
- **Create:** `findOrCreateCustomer` / `POST /customer/find-or-create` (`customer-engagement-routes.ts:327-393`) — **internal-signed** (`:328`); inserts `store_customers` `{status:'active', password_hash:null}` (`:374-385`); logs `{source:'checkout'}`. Storefront proxy `api/customer/auto-create/route.ts:6-29` (post-checkout, best-effort).
- **Status:** `GET /customer/status` (`:658-693`) → `{exists,hasPassword,status}`. Proxy `api/customer/check/route.ts`.
- **Login:** `POST /customer/login` (`:695-788`) — **public**; order rate-limit (`:702`)→Turnstile (`:709`)→DB (`:712`)→bcrypt (`:739`); enumeration-safe uniform `{customer:null}`; mints session via `issueCustomerSession` (`:767-773`). **Proxy re-mints locally** via `createSession()` (`login/route.ts:47-52`).
- **Session mint:** `issueCustomerSession` (`packages/auth-core/src/customer-session.ts:28-59`) — HS256 (`:52`), secret `CUSTOMER_SESSION_SECRET`, claims `{store_id,customer_id,iat,exp}` (IDs only), TTL 30 min, cookie `lb_customer_session`. **The richer storefront token** `createCustomerSessionToken` (`auth-core/src/index.ts:751-770`) — HS256, claims `{sub,storeId,email,name}`, TTL 7 days, same cookie — is what `getSession()` reads (verified by `isCustomerSessionPayload` requiring `sub`+`storeId`+`email`, `index.ts:1298-1310`). **The gateway's IDs-only token FAILS that predicate** → the proxy MUST re-mint (this is why login re-mints, and register must too).
- **Password set/reset:** `POST /customer/password` (`:395-443`, internal-signed, unused by UI); `request-reset` (`:445-519`, public); `confirm-reset` (`:521-630`, public, **hard-requires reset token** `:523-525`, sets `store_customers.password_hash` `:578` + mints session `:609-615`).

## The bug (exact)

`account-bottom-sheet.tsx:366` "Create Account" → `handleSetPassword` (`:115-136`) → `setPassword(email,password,storeId)` with **no resetToken** (`:128`). Rejected client-side (`customer-auth-context.tsx:145-147`: `if (!resetToken) return {success:false, error:'Reset link is required…'}`) and server-side (`set-password/route.ts:35-40`: 400 unless `resetToken`). The `set_password` state is dead; the `not_found` state has no register path at all.

## Designed V1 registration flow (design only)

**Decision: Option (a) — one new explicit `register` endpoint** (atomic create + first-password + session). Rejected Option (b) (find-or-create then set-initial-password) — same token-less password surface but extra round-trip + transient credential-less window.

### Gateway — `POST /storefront/customer/register` (new, in `customer-engagement-routes.ts`, placed right after `/customer/login` `:788`)
**Public** (browser-driven), NOT internal-signed. Body `{store_id,email,password,full_name?,phone?,turnstile_token?}`. Logic (all helpers already in the file):
1. Validate `store_id,email,password` (8–128, reuse `:536-538`).
2. `enforceCustomerAuthRateLimit(operation:'customer-register')` **first** (mirror `:702-707`).
3. `requireValidTurnstile(c, body)` (`:709-710`) — **primary anti-abuse gate, replaces the reset-token.**
4. **Not-exists precondition:** look up `store_customers(store_id,email)`; if it exists → uniform `{customer:null}` / `409`, do nothing. *This is what makes a token-less first password safe — register can only set the FIRST password on a BRAND-NEW row; it can never overwrite an existing credential (that still requires email-reset) and can't claim a checkout-created password-less row (those stay on reset).*
5. Insert `store_customers` (reuse `:374-385`) with `password_hash = await bcrypt.hash(password,10)`, activity `{source:'register'}`.
6. Upsert `customer_credentials` (reuse `:424-435`, `onConflict:'store_id,email_or_phone'`).
7. `issueCustomerSession({storeId,customerId}, c.env.CUSTOMER_SESSION_SECRET)` + cookies — identical to login `:767-786`; guard missing secret (`:754-765`).
8. Return `{customer: publicCustomerProfile(created)}`.

API-client: add `registerCustomer` near `verifyCustomerPassword` (`packages/typescript/api-client/src/index.ts:4590-4591`).

### Storefront proxy — `POST /api/customer/register` (new file, model on `login/route.ts`)
`apps/storefront-runtime/src/app/api/customer/register/route.ts`: call `registerCustomer` (data only), then **re-mint locally** via `createSession({id,storeId,email,fullName})` (`session.ts:49`) — mandatory (gateway token unreadable by `getSession()`). Forward `turnstile_token`; preserve `LetbuyyApiError` 403/429/503 passthrough (`login/route.ts:63-79`).

### UI
- **Context** (`customer-auth-context.tsx`): add `register(email,password,storeId,turnstileToken?,fullName?)` mirroring `login` (`:108-136`) → POST `/api/customer/register` → `setCustomer` + `syncLocalWishlist()`; expose on context (`:205-214`).
- **`not_found` state** (`account-bottom-sheet.tsx:372-413`): replace the dead-end with a register form (password + confirm + `TurnstileWidget` reuse `:266`) + "Create Account" → new `handleRegister` (model on `handleSetPassword`). Keep "Try a different email".
- **Fix `set_password` CTA:** repoint to trigger `request_reset` (the storefront set-password route already supports `action:'request_reset'`, `set-password/route.ts:14-33`) → "We've emailed you a link to set your password" (this branch is for checkout-created rows that legitimately need the token). If H6 email is deferred, hide `set_password` instead. Do not leave it calling the token-less `setPassword`.

### Email verification — V1 stance
**Optional, not required.** Account is immediately usable (session minted), consistent with checkout-create + reset which also don't verify email ownership. Anti-abuse = **H7 Turnstile** (`requireValidTurnstile`, `storefront.ts:158-174`; provider `security.ts:219-248`; fails closed in prod without `TURNSTILE_SECRET_KEY` `:226`) + rate-limit + not-exists precondition. An optional "verify your email" nudge depends on **H6 Resend** (`isConfiguredResetEmailProvider`, `:254-257` — no-ops on placeholder key). Ship register without mandatory verification in V1.

## Issuer-model preservation (argument)

Zero merchant/identity-platform code touched; zero new issuers. Merchant sessions stay ES256 via identity-platform (not imported anywhere here). Customer sessions stay HS256 via `auth-core` + `CUSTOMER_SESSION_SECRET` — register **reuses the unchanged** `issueCustomerSession` (gateway) and `createSession()`/`createHostOnlyShopperIdentityProvider` (storefront, `index.ts:841-862`). Same cookie `lb_customer_session`, same secret, same verifier. The re-mint mirrors login byte-for-byte. Writes only `store_customers` + `customer_credentials`, `store_id`-scoped throughout. No merchant overlap, no duplication.

## ⚠️ Ratchet note (new route)

Adding `apps/storefront-runtime/src/app/api/customer/register/route.ts` is a **new app-API route** → bumps the `domain-boundary-validator.mjs:209` count **127 → 128**. Must be updated in lockstep (same pattern B4/B5 used): `domain-boundary-validator.mjs` count, `tests/federation/app-api-route-ownership.test.mjs`, `docs/governance/app-api-route-ownership.md` entry. (The new *gateway* route is not an app-API route and doesn't count.)

## Tests

- **`services/api-gateway/src/__tests__/customer-engagement.security.test.ts`** — register rejects when `store_customers` already exists (no-overwrite); missing fields → `VALIDATION`; public but Turnstile/rate-limit gated. Reuse `createCustomerEngagementApp()` (`:29-40`).
- **`tests/contracts/storefront-customer-engagement-routes.test.ts`** — add `{method:'post',path:'/customer/register'}` to `expectedRoutes` (`:18-44`) after `/customer/login` (route-order contract `:56-74`).
- **`tests/contracts/storefront-login-abuse-controls.test.ts`** — register ordering (rate-limit→Turnstile→DB→bcrypt) mirroring `:21-43`; proxy forwards `turnstile_token` + preserves 403/429/503 (`:55-67`).
- **`packages/auth-core/test/auth-core.test.ts`** — no new auth-core code; extend only if a register-specific option is added.

## Rollout / rollback

- **Rollout:** gateway route + api-client + storefront proxy + context + UI, with the route-count ratchet updated in the same PR. Validate gate + the 3 contract/security tests. Live signup needs H7 Turnstile (and H6 only for optional verify).
- **Rollback:** revert the PR (incl. ratchet count back to 127); `not_found` returns to dead-end. No schema/state.

**Effort: ~1–2 days. Risk: med (auth surface — keep the not-exists precondition + Turnstile). Commit: 1 (separate, includes the ratchet bump).**

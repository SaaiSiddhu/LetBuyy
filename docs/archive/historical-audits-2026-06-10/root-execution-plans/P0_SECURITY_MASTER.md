# P0_SECURITY_MASTER — Customer Authorization, Identity, and Release Safety

Parent: `LETBUYY_MASTER_EXECUTION_PLAN.md`
Scope: every Critical/High security finding that blocks the 100-merchant beta. Documentation only — no production code is modified here.
Guiding principle: **enforce customer identity at the gateway, once.** Today the gateway trusts client-supplied `customer_id`/`email` and the Next app is the only thing (sometimes) standing between an attacker and a shopper's account. That is inverted.

---

## P0-A — Customer Session Primitive (foundational; everything else depends on it)

### Problem
There is no authenticated customer session. `verifyStoreCustomer()` (`services/api-gateway/src/routes/storefront.ts:1058`) only checks row existence by `id`+`store_id`, and customer-account routes accept `store_id`+`email` directly. Findings collapsed here: SEC-1, SEC-2, SEC-3, SEC-7, MISSED-1, MISSED-2.

### Target design
A signed, short-lived customer session token (HMAC or JWT signed with a gateway secret), bound to `{ store_id, customer_id, iat, exp }`, delivered as an HttpOnly, Secure, SameSite=Lax cookie scoped to the storefront subdomain, plus a CSRF companion. The gateway validates and **derives `customer_id` from the token**, never from the request body/query.

### Implementation tasks

1. **New package contract** `packages/auth-core/src/customer-session.ts` (new file):
   - `issueCustomerSession({ storeId, customerId }, secret): { token, expiresAt }`
   - `verifyCustomerSession(token, secret): { storeId, customerId } | null`
   - Use Web Crypto (`crypto.subtle`) HMAC-SHA-256; 30-minute TTL, sliding refresh on activity.
   - Export from `packages/auth-core/src/index.ts`.

2. **New gateway middleware** `services/api-gateway/src/middleware/customer-session.ts` (new file):
   - `requireCustomerSession`: reads the session cookie, verifies it, sets `c.set('customer', { storeId, customerId })`, returns `401 CUSTOMER_SESSION_REQUIRED` otherwise.
   - `optionalCustomerSession` for routes that have both guest and authenticated modes.

3. **Rewrite `verifyStoreCustomer`** (`storefront.ts:1058`) to read `c.get('customer')` and compare against the path/store — it must never accept a body `customer_id`. All callers (`storefront.ts:3255,3341,3371,3398,3457,3596,3624,3674,3720`) consume `c.get('customer').customerId`.

4. **Login issues the session** (`storefront.ts:3018` `POST /customer/login`):
   - Stop returning the full row; return `{ customer: { id, email, full_name } }` only — never `password_hash`.
   - On success, `Set-Cookie` the session + CSRF cookie.
   - Add `bcrypt.compare` only after a per-`(store_id,email)` attempt check (see P0-D).

5. **Password set becomes token-bound** (`storefront.ts:2934` `POST /customer/password`):
   - Delete the email-addressable mutation path.
   - Replace with `POST /customer/password/request-reset` (sends a signed, single-use, 15-min reset token to the customer's email via the notification path) and `POST /customer/password/confirm` (consumes the token; binds to `store_id`+`customer_id` from the token, not the body).
   - Store `reset_token_hash` + `expires_at` + `used_at` in `customer_credentials` (table already exists).

6. **Order history requires session** (`storefront.ts:3271` `GET /customer/orders`): derive `customer_id` from `c.get('customer')`; ignore query `email`. Remove `/:subdomain/orders/contact` (`storefront.ts:3293`) public order dump; replace with a guest "track order" that requires `order_number` + email/phone **and** returns a single order only, heavily rate-limited (P0-D), non-oracular.

7. **Enumeration endpoints** (`storefront.ts:2966` `/customer/by-email`, `:2990` `/customer/status`):
   - Remove from the public router. If the storefront app needs them for checkout UX, move behind the internal-signature guard (the same `X-LetBuyy-Internal-Signature` already used by internal payment routes) so only the storefront server — not browsers — can call them, and return uniform shapes.

8. **GraphQL second path** (`graphql/storefront.ts:496-521`): the `customer` and `order` resolvers must require and pass through the customer session; once the underlying REST routes enforce P0-A, the `app.fetch` delegate inherits enforcement — add an explicit test that an unauthenticated GraphQL `customer` query returns `CUSTOMER_SESSION_REQUIRED`.

### File-by-file change list
| File | Change |
|---|---|
| `packages/auth-core/src/customer-session.ts` | NEW — issue/verify primitives |
| `packages/auth-core/src/index.ts` | export new module |
| `services/api-gateway/src/middleware/customer-session.ts` | NEW — require/optional middleware |
| `services/api-gateway/src/routes/storefront.ts` | rewrite `verifyStoreCustomer`; gate login/orders/addresses/profile/wishlist; tokenize password; remove by-email/status from public; remove contact-order dump |
| `services/api-gateway/src/graphql/storefront.ts` | enforce session on `customer`/`order` resolvers |
| `apps/storefront-runtime/src/app/.../account/*` + `src/lib/api/client.ts` | send/receive session cookie; call internal-guarded lookups server-side only |
| `database/supabase/migrations/077_customer_reset_tokens.sql` | NEW — add `reset_token_hash`, `reset_expires_at`, `reset_used_at` to `customer_credentials` if absent |

### Migration plan
- `077_customer_reset_tokens.sql`: additive columns only (no data migration). Idempotent `ADD COLUMN IF NOT EXISTS`.
- Add gateway secret `CUSTOMER_SESSION_SECRET` to Worker secrets **before** deploy (see P0-E).

### Rollback plan
- The session middleware is additive; rollback = redeploy the prior Worker revision and revert `077`. Because reset columns are additive and nullable, the old code ignores them. Keep the legacy routes behind a `CUSTOMER_LEGACY_AUTH=off` flag for one release so rollback is a flag flip, not a redeploy, during the cutover window.

### Testing strategy
- Unit: `customer-session` issue/verify, expiry, tamper rejection.
- Integration (gateway): unauthenticated calls to orders/addresses/profile/wishlist/password → 401; cross-customer `customer_id` in body is ignored; GraphQL `customer` without session → error.
- Red-team regression: reproduce the kill chain (by-email → login → address overwrite) and assert it now fails at each step.

### Acceptance criteria
- No public route can read or mutate a `store_customers`, `customer_addresses`, `customer_wishlists`, or `orders` row using only `store_id`+`email`.
- `password_hash` never appears in any API response (grep gate in CI).
- Both REST and GraphQL customer/order access require a valid session.

**Fix complexity:** L. **Risk of change:** High (customer-session contract touches storefront web + mobile).

---

## P0-B — Identity Set-Password Must Bind to Server-Side OTP (SEC-6)

### Problem
`apps/identity-platform/src/app/api/auth/set-password/route.ts:34` trusts body `userId`+`email`; the OTP cookie set by `verify/route.ts` is never checked.

### Tasks
1. In `verify/route.ts`, on successful OTP, create a server-side `password_set_intent` (id, user_id, email, expires_at, used_at) and set its id in an HttpOnly cookie.
2. In `set-password/route.ts`, read the intent id from the cookie, load it server-side, verify `not used`, `not expired`, and that it matches the OTP-verified user; ignore body `userId`/`email`.
3. Mark the intent `used_at` atomically on success.

### Files
`apps/identity-platform/src/app/api/auth/verify/route.ts`, `apps/identity-platform/src/app/api/auth/set-password/route.ts`, plus a small `auth_password_set_intents` table (migration `078`).

### Migration / Rollback / Testing / Acceptance
- Migration `078_password_set_intents.sql` (new table, additive).
- Rollback: revert routes + drop table; old flow returns (accept the temporary risk only if rollback is forced).
- Test: set-password with a forged body `userId` and no/expired intent → 403; valid OTP→intent→set-password succeeds once and not twice.
- Acceptance: password set is impossible without a fresh, unused, server-stored intent bound to the OTP-verified user.

**Fix complexity:** M. **Risk of change:** Med.

---

## P0-C — CSRF Coverage and Cookie-Name Contract (SEC-8, SEC-9)

### Tasks
1. **Unify the CSRF cookie name.** Choose `letbuyy_csrf` (gateway's expectation, `security.ts:261`). Update identity (`apps/identity-platform/src/lib/auth/cookies.ts:11`, `proxy.ts:43,50`, `lib/auth/csrf.ts:6,22`, `lib/csrf-client.ts:11`) and mobile (`store_auth_service.dart:86`) from `lb_csrf` → `letbuyy_csrf`. Do this in one atomic change across all consumers.
2. **Cover public storefront mutations.** Add a lightweight origin+token CSRF (or Turnstile, see P0-D) to `POST /storefront/reviews` (`storefront.ts:3487`), `POST /:subdomain/contact` (`:3795`), and all customer mutations now behind P0-A.
3. Resolve the internal-secret dual-naming (MISSED-4): standardize on `INTERNAL_API_SECRET`, remove `LETBUYY_INTERNAL_API_SECRET` from `production-deploy.yml:132-133` once no consumer reads it.

### Migration / Rollback / Testing / Acceptance
- No DB migration. Cookie rename is coordinated and flag-guarded: accept both names for one release (`security.ts` reads `letbuyy_csrf` then falls back to `lb_csrf`), then drop the fallback.
- Rollback: re-enable the dual-read fallback.
- Test: identity→gateway cookie-auth mutation passes CSRF; public review/contact without token → 403.
- Acceptance: one CSRF cookie name across all runtimes; no public browser-originated mutation bypasses CSRF/Turnstile.

**Fix complexity:** S. **Risk of change:** Med (cross-runtime coordination).

---

## P0-D — Abuse Controls: Customer-Auth Rate Limit + Turnstile (SEC-7, plus contact/review spam)

### Tasks
1. Add a dedicated `customerAuthRateLimit` (per `store_id`+email and per IP) applied to `/customer/login`, `/customer/password/*`, and guest order tracking. Model on `authRateLimit` in `services/api-gateway/src/middleware/rateLimit.ts`. Use a Durable Object or atomic Redis bucket to avoid the KV read+write cost (ties to P1).
2. Add Turnstile verification to public writes: `/customer/login`, `/:subdomain/contact` (`storefront.ts:3795`), `/storefront/reviews` (`storefront.ts:3487`). Reuse the identity Turnstile pattern (`apps/identity-platform/src/lib/turnstile.ts`).

### Testing / Acceptance
- 6 failed logins for one `(store,email)` within the window → throttled, non-oracular response.
- Contact/review without a valid Turnstile token → rejected.
- Acceptance: no unthrottled credential or content-spam path on the public storefront.

**Fix complexity:** M. **Risk of change:** Med.

---

## P0-E — Release-Pipeline Safety (INFRA-1, INFRA-2, INFRA-4) — security-relevant because it can ship the kill chain or the WS11-13 stack untested

### Tasks
1. **Fail, don't skip.** In `.github/workflows/production-deploy.yml`, for release branches make missing `HAS_SUPABASE_CREDS`/`HAS_CLOUDFLARE_CREDS`/`HAS_VERCEL_CREDS` (`:19-21`) a hard failure, not a skipped step. Add `if: always()` gating + an explicit "all required jobs succeeded (not skipped)" final check before `smoke-test-production` (`:250`).
2. **Secrets before traffic.** Reorder so `wrangler secret put` (`:127-141`, `:158`) runs **before** `wrangler deploy` (`:118`, `:149`), or use `wrangler versions upload` + `wrangler versions deploy` to stage the revision and cut over only after secrets exist. Add `CUSTOMER_SESSION_SECRET` to the required-secrets set.
3. **Migration safety.** Before `supabase db push --include-all` (`:85`): emit `supabase db diff` output as a build artifact, take a logical backup/restore point, and require a manual approval environment for production migrations.
4. **Gate WS11-13.** Until the GraphQL/extension/Liquid/checkout-function stack (MISSED-12) is proven in staging, mount it behind a `FEATURE_GRAPHQL`/`FEATURE_EXTENSIONS` flag defaulting OFF in production (`services/api-gateway/src/index.ts:185-203`).

### Rollback / Testing / Acceptance
- Pipeline changes are reversible via PR revert.
- Test on a release branch with one credential intentionally unset → workflow fails (not green).
- Acceptance: a production run cannot report success while migrations/worker/app deploys were skipped; no Worker revision serves before its secrets exist; WS11-13 is OFF in prod until staging-proven.

**Fix complexity:** M. **Risk of change:** Med.

---

## P0 Sequenced Checklist (for the beta gate)

1. P0-A customer session primitive + gateway enforcement (REST + GraphQL).
2. P0-B identity set-password OTP binding.
3. P0-C CSRF unification + public-mutation coverage.
4. P0-D customer-auth rate limit + Turnstile.
5. P0-E pipeline fail-closed + secret ordering + WS11-13 flag-off.
6. Red-team regression of the full kill chain passes.
7. Smoke suite (identity login, storefront product read, checkout create, webhook bad-signature reject, queue health) is green in staging.

**Beta is gated on 1–7 all complete.**

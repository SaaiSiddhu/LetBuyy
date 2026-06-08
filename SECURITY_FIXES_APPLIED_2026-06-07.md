# LetBuyy — Security & Foundation Fixes Applied (2026-06-07)

Companion to `PRODUCTION_READINESS_DEEP_AUDIT_2026-06-07.md`. Every code change below was applied to the working tree and verified (`tsc` per package, migration-safety + structural validators, 184/188 contract tests — the 4 non-passes are environmental, see bottom). **Changes are uncommitted** so you can review the diff before landing.

---

## ✅ Fixed in code (verified)

### Critical — payment forgery (P0-1)
- **Fail-closed order binding** in all four verify paths — a verify now hard-requires the order to already carry the server-created provider order id (null = reject), killing cross-order signature replay:
  - `services/api-gateway/src/routes/payments.ts` (protected Razorpay verify)
  - `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts` (Razorpay, Cashfree, PayPal verifies)
- **Subscription verify now does a real server-side capture check** — `payments.ts /subscription/verify` calls the new `fetchRazorpayPayment()` and requires `status==='captured'`, `amount >= plan price`, and order-id binding before activating a plan. Closes the "free Enterprise plan via a ₹1 signature" hole. New helper: `packages/infrastructure/razorpay-adapter/index.ts` → `fetchRazorpayPayment()`.
- **Global anti-replay index** — migration `107` adds a unique index on `payment_transactions (gateway, provider_payment_id)` so one captured payment id can confirm at most one order globally (defense-in-depth behind the binding).

### Critical — anon-readable credential tables (P0-2)
`database/supabase/migrations/107_security_rls_hardening_and_payment_uniqueness.sql`:
- Re-scoped the `customer_credentials` / `sessions` / `verification_tokens` / `users_custom` / `devices` policies to `TO service_role` (they were `USING(true)` for everyone → password hashes & session/reset tokens were readable with the public anon key).
- Enabled RLS + owner policies on `contacts` and `projects` (were RLS-off → fully cross-tenant).
- Locked `employee_permissions` writes to `service_role` (it's a global role→permission catalog; the real risk was unauthenticated writes/privilege-escalation, so reads stay open to avoid breaking policy subqueries).
- Scoped the `notifications` / `theme_reviews` / `notification_preferences` "own-row" policies to `user_id = auth.uid()` (were `USING(true)` → any user could edit any user's rows). `notifications` insert locked to `service_role`.

### Critical / high — config & auth hardening
- **AUTH_SECRET** no longer falls back to `''` — `apps/identity-platform/src/lib/auth/cookies.ts` now uses `getSigningKey()` which throws in production on a missing/short key (fail closed) and uses a clearly-marked dev key otherwise. (`platform-console/console-session.ts` already failed closed via `isSafeSecret` — left as-is.)
- **Rate limiter no longer 503s everything** — `services/api-gateway/src/middleware/rateLimit.ts` falls back to the `CACHE` KV namespace when Upstash is absent and **fails open** (allows traffic, logs once) only if both backends are unavailable, instead of fail-closed.
- **mobile-bff placeholder secret removed** — `services/mobile-bff/wrangler.toml` no longer ships `INTERNAL_API_SECRET = "SKIP_NEEDS_HUMAN_..."`; replaced with `wrangler secret put` instructions. New CI gate `scripts/validators/committed-secret-placeholder-validator.mjs` (wired into `.github/workflows/ci.yml` as the **secret-hygiene** job) fails the build if any `*_SECRET`/`*_TOKEN` is committed as a plaintext var.
- **Timing-safe internal auth** — `internal-store-access.ts` and `internal-custom-domain-reconcile.ts` now use `timingSafeEqualText()` instead of `===` on `INTERNAL_API_SECRET`.

### High — RBAC, frontend resilience, domain config
- **RBAC** (`services/api-gateway/src/middleware/auth.ts`, `middleware/rbac.ts`, `routes/app-store/developer-tooling-routes.ts`): role claims are no longer trusted for category gating — the metadata short-circuit is removed so `requireRoleCategory` is **DB-authoritative**; role source prefers server-controlled `app_metadata`; `loadPartner` now requires `status='approved'`.
- **Frontend resilience** (`apps/merchant-control-plane`, `apps/storefront-runtime`): merchant session helpers distinguish 401/403 (real logout) from 5xx/network (rethrow → error boundary) so a backend blip no longer logs valid merchants out; added `error.tsx` + `global-error.tsx` + `not-found.tsx` to both apps; storefront `proxy.ts` degrades gracefully instead of throwing 500 on missing env.
- **Domain made configurable** (`packages/shared-types/src/brand.ts`, `packages/typescript/api-client`, `packages/tenant-core`, `services/api-gateway/src/lib/cors.ts`, storefront resolver unified in `apps/storefront-runtime/src/lib/api/base-url.ts`): the hardcoded `letbuyy.store` values now read env overrides with `.store` as the **unchanged default** — the `.com` cutover becomes a one-env-flip. No default was flipped (flipping early breaks live SSO/checkout).

**Verification run:** `tsc --noEmit` clean for api-gateway, identity-platform, storefront-runtime, merchant-control-plane; `auth-core`/`infrastructure`/`billing-core` `tsc -b` build clean (exercises the razorpay-adapter change); migration-safety, import, dependency-graph, circular-import, and the new secret-hygiene validators all pass.

---

## ⚠️ You must do these (operator-only — I can't run them from here)

1. **Provision the real secrets** (the code now fails closed without them):
   - `cd services/mobile-bff && wrangler secret put INTERNAL_API_SECRET` for default **and** `--env staging` **and** `--env production`.
   - Ensure `AUTH_SECRET` (≥16 chars) is set for `identity-platform` and `platform-console` in every environment.
   - Set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (subscription verify now needs KEY_ID too).
   - Upstash is now optional (KV fallback), but set `UPSTASH_REDIS_REST_URL`/`_TOKEN` if you want hard rate limiting.
2. **Apply migration 107** to the database (your supabase migration runner / `db push`). If the `payment_transactions` table already has duplicate `provider_payment_id` rows (from the exploit window or test data), **dedupe them first** or the unique index build will fail.
3. **Rotate credentials** if this database's anon key has ever been internet-exposed — until migration 107 lands, credential/session/reset-token tables were readable with that key.
4. **Domain cutover (when DNS is ready):** set `LETBUYY_PLATFORM_DOMAIN` / `COOKIE_DOMAIN` / the API base-URL env to `.com`, then update the 6 `custom_domain` route patterns in the `services/*/wrangler.toml` files + DNS. (The env plumbing is done; the wrangler route patterns + DNS are inherently manual.)

---

## ⏸️ Deferred (consciously not done — rationale)

- **~150 cosmetic `letbuyy.store` literals** in UI copy and mobile `dart-defines` — non-security; the load-bearing config (brand/CORS/API base/cookies/tenant) is now env-driven, which is what matters for the cutover. Sweep these during the `.com` migration.
- **93 circular import cycles** (76 in the api-gateway `index.ts` barrel) — they work today; a barrel refactor of the worker entrypoint is high-risk and deserves its own focused PR + a `madge --circular` CI gate. Left as a tracked follow-up.
- **Wiring the real api-gateway integration test** (`src/__tests__/security.test.ts`) into CI — blocked on a pre-existing tsx/hono `createMiddleware` ESM-interop issue in the test runner (the test never loaded; that's why it was orphaned). Needs a runner-config fix, not a code fix.
- **Feature build-outs** (the empty `notification-service`, `POST/DELETE /v1/push/device-tokens`, mobile payouts/KYC/2FA/returns stubs) — these are net-new features, not foundation fixes, and were out of scope for hardening the existing surface.

---

## Note on the contract test run
`184/188` contract tests pass. The 4 that don't are **not** caused by these changes: 3 are `Cannot find module '@letbuyy/*'` because this workspace had no `pnpm install` symlinks in `node_modules` (CI runs `pnpm install` first), and 1 (`future platform .com target is not hardcoded`) is the **pre-existing** `apps/theme-marketplace` `.com` changeset that was already staged before this work began.

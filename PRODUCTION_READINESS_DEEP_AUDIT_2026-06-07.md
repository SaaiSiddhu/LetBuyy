# LetBuyy — Deep Production-Readiness Audit (V2, code-verified)
**Date:** 2026-06-07 · **Scope:** whole monorepo — apps, services, packages, mobile, DB, governance, CI
**Method:** static read + **real verification** (ran `tsc`, `madge --circular`, grepped/opened the exact files/lines below). Every P0 here was confirmed against source, not inferred.

This supersedes `PRODUCTION_READINESS_AUDIT_2026-06-07.md` (V1). V1's config blockers still stand; **V2 adds three CRITICAL security exploits V1 missed** and corrects two V1 claims.

---

## TL;DR — the foundation problem is worse than "governance theater"

V1 said the real issue was an inverted pyramid of confidence: 167 green validators wrapped around config blockers. That's true — but the deeper dig found the green checkmarks are also hiding **live, exploitable security holes**:

1. **Payments are forgeable.** Razorpay verification checks an HMAC of `order_id|payment_id` and *nothing else* — not the amount, not capture status, not that the payment belongs to this order. A single valid signature triple (from any ₹1 payment) marks arbitrary orders paid and self-upgrades subscriptions to any plan, replayable across every store. **Shoppers get free goods; merchants get free Enterprise plans.**
2. **Customer password hashes and session tokens are readable with the public anon key.** The RLS policies on `customer_credentials`, `sessions`, `verification_tokens`, `users_custom`, `devices` say `USING (true)` but were never scoped `TO service_role`, so they evaluate true for the `anon`/`authenticated` roles too. **Cross-tenant credential + session-token + password-reset-token exfiltration → account takeover.**
3. The **config blockers from V1** (BFF dead on a committed placeholder secret, rate-limiter 503s everything, empty AUTH_SECRET fallback, half-done domain migration) are all still present.

**The unifying root cause:** the verification system measures *documentation consistency*, not *behavior*. ~8 of 167 validators do real program analysis; the rest string-match markdown/JSON "evidence" files (43 of which literally declare `mode: "...not-live-evidence"`). The suite that's supposed to catch exactly these bugs **cannot** — it never compiles, runs, or queries anything.

**Verdict on "production-ready next week":** Not as-is. But the list is finite and most items are fixes, not rewrites. The **two security exploits (P0-1, P0-2) must be fixed before ANY public traffic** — they're ~1–2 days combined. A realistic target: **closed/soft launch in a week** if you burn down P0 + the security-critical P1s; a confident open launch needs the P1s closed and the missing notification/search surfaces decided.

---

## What I actually verified (so you can trust the severity)

| Claim | How verified | Result |
|---|---|---|
| Backend compiles | `cd services/api-gateway && tsc --noEmit` | **exit 0 — clean** |
| Payment HMAC ignores amount | read `packages/infrastructure/razorpay-adapter/index.ts:284-319` | confirmed: `amount` echoed, never compared |
| Order-binding skipped when payment_id null | read `routes/storefront/checkout-payment-routes.ts:579` + `routes/payments.ts:699` | confirmed `if (order.payment_id && …)` |
| No global uniqueness on payment id | grep unique indexes in migrations | confirmed: only per-`site_id` uniques exist |
| Credential/session RLS not role-scoped | read `000_baseline.sql:23921-23956` | confirmed `USING (true)` w/o `TO service_role`; only 8 `TO service_role` clauses in entire baseline |
| 93 circular import cycles | `madge --circular` | confirmed (repo's own validator reports 0 — it's blind to intra-package cycles) |
| ~8/167 validators real | classified a sample of `scripts/validators/*` | confirmed; 43 self-declared not-live manifests |

**Two V1 corrections:** (a) V1 P1-3 said `webhook-service` compares the internal secret with `!==`; on re-read it uses `timingSafeEqual` correctly. The real non-timing-safe compares are in api-gateway: `routes/internal-store-access.ts:18` and `routes/internal-custom-domain-reconcile.ts:22` (`directSecret === c.env.INTERNAL_API_SECRET`), both mounted *before* auth. (b) "service-role used in ~500 places" = ~500 calls to the single `getSupabaseAdmin` client (`lib/supabase.ts:16`); the user-scoped `getSupabaseUser` exists but is used by **zero** routes.

---

## P0 — CRITICAL (block all public traffic)

### P0-1 · Payment & subscription signature verification is forgeable
**Free goods + free plan upgrades, replayable cross-store.** Chain:
- `packages/infrastructure/razorpay-adapter/index.ts:303-304` — `verify()` = `hmacSha256Hex(keySecret, \`${orderId}|${paymentId}\`)` then `timingSafeEqual`. The `amount` arg (line 285) is normalized and returned but **never compared**; no server-side call to Razorpay to confirm capture/amount/ownership.
- `routes/storefront/checkout-payment-routes.ts:579` and `routes/payments.ts:699` — order↔provider binding is `if (order.payment_id && order.payment_id !== body.razorpay_order_id)`, a **no-op when `payment_id` is null**, which it is for every freshly created order (the orders INSERT in `create_order_with_inventory_reservations` omits `payment_id`).
- `checkout-payment-routes.ts:587-590` — storefront verify uses the **platform-wide** `RAZORPAY_KEY_SECRET` (keyId defaults to `'storefront'`), so one signature is valid for every store.
- No global unique index on `provider_payment_id` / `orders.payment_id` (only per-`site_id` uniques at `000_baseline.sql:17860,17874`) → the **same payment id confirms unlimited orders across unlimited stores**.
- `routes/payments.ts:456-530` — `/subscription/verify` verifies `razorpayBillingSignaturePayload({orderId, subscriptionId, paymentId})`; per `billing-core/src/index.ts:959-971`, with no `subscriptionId` the payload reduces to `order_id|payment_id` — **identical to an order signature** — then activates the plan with a server-computed `amountPaid` that is recorded but **never charged**. → any valid ₹1 triple = free Enterprise plan.

**Fix:** (a) require `order.payment_id` present AND equal to `razorpay_order_id` (null = hard fail); (b) server-side `GET /payments/{id}` from Razorpay and assert `status==='captured'`, `order_id` matches, `amount===order.total*100`; (c) add a **global** unique index on `payment_transactions.provider_payment_id` (and/or `orders.payment_id`); (d) apply the same order/amount binding to subscription verify. Mirror the check in `webhook-service` (it already does sig-verify; add amount/ownership).

### P0-2 · Credential, session & token tables are anon/authenticated-readable (cross-tenant)
`000_baseline.sql:23921,23928,23935,23942,23956` — policies named "Service role full access"/"Service role manages customer credentials" on `devices`, `sessions`, `users_custom`, `verification_tokens`, `customer_credentials` are `USING (true) WITH CHECK (true)` **without `TO service_role`**. A Postgres policy with no role qualifier applies to **every** role, so the `anon` and `authenticated` PostgREST roles (the public anon key + any logged-in user) can:
- read **every store's** customer password hashes (`customer_credentials = (store_id, email_or_phone, password_hash)`),
- read/forge `sessions` (token table → session hijack),
- read `verification_tokens` (`password_reset`/`magic_link`/`email_verify` → account takeover),
- read/write `users_custom` (all platform users).

This is provably a defect, not intent: later migrations use the correct form (`103_…:156` `FOR ALL TO service_role`; `081_…:82` `USING (auth.role()='service_role')`). The baseline policies are the un-migrated legacy idiom and nothing re-scopes them. (Customer_credentials also has a correct store-owner policy at `:24067`, but the permissive one still grants everyone.)

**Fix:** add `TO service_role` (or `USING (auth.role()='service_role')`) to these five policies, or drop the permissive policy and keep only the owner-scoped one. **Validate by querying each table as the `anon` role** — don't trust the migration text. Treat as a credential-rotation event if this DB has ever been internet-exposed.

### P0-3 · Mobile BFF is dead in every environment (committed placeholder secret)
`services/mobile-bff/wrangler.toml:30,60,100` ships `INTERNAL_API_SECRET = "SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET"` for default/staging/production; `src/index.ts:139-145` returns **HTTP 500** for any secret with that prefix → the **entire mobile app** (`/v1/stores|products|orders|payments`) is non-functional on a vanilla deploy. **Fix:** `wrangler secret put INTERNAL_API_SECRET`, delete the literal from `[vars]`, add a CI check failing on any `SKIP_NEEDS_HUMAN` in committed config.

### P0-4 · Rate limiter is fail-closed → 503 on every request without Upstash
`middleware/rateLimit.ts` returns `unavailable` (→ 503) in production when Upstash Redis+KV are both absent (`:454,984,1064`); it's mounted on `api.use('/*')` (`index.ts:523`), and the secret-setup script treats Upstash as **optional**. One missing env var ⇒ the whole API (auth, storefront, checkout) 503s. **Fix:** fall back to the always-present KV `CACHE`, or add a deploy gate refusing prod without `UPSTASH_REDIS_REST_URL/_TOKEN`.

### P0-5 · `AUTH_SECRET` falls back to empty string → forgeable sessions
`apps/identity-platform/src/lib/auth/cookies.ts:5` (`process.env.AUTH_SECRET || ''`) and `apps/platform-console/src/lib/console-session.ts:24`. A missing secret signs JWTs with an empty key — sessions look valid but are forgeable. **Fix:** assert non-empty signing secrets at boot; never `|| ''` for a key.

### P0-6 · Domain migration is half-done — `letbuyy.store` hardcoded across runtime paths
Canonical is `letbuyy.com`, but **153 `letbuyy.store` string literals** live in `.ts/.tsx/.dart/.toml` where env vars can't reach them. Highest-impact, env-unoverridable:
- `packages/shared-types/src/brand.ts:26,92` — `DEFAULT_PLATFORM_DOMAIN`/`contactEmail` = the single source of truth for all structured data / OG tags.
- `packages/typescript/api-client/src/index.ts:162` — `https://api.letbuyy.store/v1` is the **silent fallback every frontend uses when API env is unset**.
- `services/api-gateway/src/lib/cors.ts:5-18` — credential origin + 11-origin allowlist all `.store`; `routes/auth.ts:910` reset redirect `accounts.letbuyy.store`; `routes/payments.ts:756-757` Stripe success/cancel.
- `apps/identity-platform/.../cookies.ts:40` + `config/env/production.env.example:52` — `COOKIE_DOMAIN=.letbuyy.store` ⇒ **cross-app SSO silently breaks after DNS cutover** (cookies scoped to wrong apex).
- `apps/identity-platform/src/lib/email/resend.ts` — `noreply@letbuyy.store` ⇒ reset/verify emails from wrong domain.
- Mobile: `app_config.dart:11,17,23,29` + `dart-defines/production.json:2-5` + `packages/dart/.../store_model.dart:139` (every store URL `${subdomain}.letbuyy.store`).
- Cloudflare `custom_domain` route patterns in `services/*/wrangler.toml` (`api.`/`bff.`/`webhooks.letbuyy.store`) — TOML literals, **not env-driven at all**; cutover needs editing each toml + DNS.

**Fix:** make `brand.ts`/`cors.ts`/`tenant-core`/`api-client`/Dart constants read config instead of hardcoding; flip the `# CUTOVER` env defaults to `.com`; edit the 6 wrangler route patterns + DNS as a coordinated flip. Add a validator scanning **Dart + TOML** for `letbuyy.store` (none exists today).

---

## P1 — High (close before relying on it / open launch)

- **P1-1 · RBAC trusts client-writable `user_metadata`.** `middleware/auth.ts:220` sources roles from `user.user_metadata.role/roles`; `middleware/rbac.ts:114-127` `requireRoleCategory` short-circuits on that metadata **before** the DB allowlist. Supabase users can self-set `user_metadata` via `auth.updateUser`. `ops` is backstopped by a real `requireSuperAdmin` DB check (safe), but **partner** tooling (`developer-tooling-routes.ts:140,321,399…`) is gated by category only, and `loadPartner` doesn't check `status='approved'` → a pending/rejected developer can spoof `role:'partner'` and use partner tooling. **Fix:** derive roles from server-only `app_metadata`/a roles table; resolve `requireRoleCategory` from persistence first; add `status='approved'` to `loadPartner`.
- **P1-2 · Three tenant tables have NO RLS at all.** `contacts`, `projects`, `employee_permissions` — no `ENABLE ROW LEVEL SECURITY`, no policy anywhere (only indexes/triggers; tables carry `site_id`). With default anon grants they're fully cross-tenant readable/writable (CRM, portfolio, RBAC rows). **Fix:** enable RLS + `site_id` owner + service-role policies.
- **P1-3 · "Own-row" policies that match every row.** `notifications` view/update/delete (`:24155,24176,24183`), `theme_reviews` (`:24162`), `notification_preferences` (`:24169`) are `USING (true)` → any authenticated user reads/edits/deletes **any** user's notifications & reviews. **Fix:** scope to `user_id = auth.uid()`.
- **P1-4 · Tenant isolation is a manual invariant, not enforced.** ~500 calls to the RLS-bypassing `getSupabaseAdmin`; `getSupabaseUser` used by 0 routes; isolation rests on ~208 hand-written `verifySiteOwnership` calls. One forgotten check = cross-tenant leak. **Fix:** a typed query wrapper that requires a verified `storeId`; a test asserting every tenant-scoped query is preceded by an ownership check.
- **P1-5 · 93 circular import cycles; the validator is structurally blind.** `madge --circular` = 93 (76 in the api-gateway `index.ts` barrel entrypoint, 11 orchestration, 4 merchant-control-plane, 2 theme-engine). `scripts/validators/circular-import-validator.mjs` collapses files to package roots and skips same-root edges, so it reports 0. Barrel↔member cycles are the classic source of TDZ `Cannot access 'X' before initialization` crashes under refactor/import-order changes. **Fix:** extract shared helpers (AppError, app factory, middleware) out of `index.ts` into `core/app.ts`; gate CI on `madge --circular`.
- **P1-6 · Cross-app env var drift (silent `.store` regression risk).** Same logical value under many names: **API base URL = 8 names** (`NEXT_PUBLIC_API_URL`, `…_API_BASE_URL`, `LETBUYY_API_URL`, `LETBUYY_API_BASE_URL`, `API_URL`, `API_BASE_URL`, `PLATFORM_CONSOLE_API_BASE_URL`, `WORKER_API_BASE_URL`) — and `NEXT_PUBLIC_API_URL` includes `/v1` in one template, omits it in another; **internal secret = 3 names**; **root domain = 3 names**. Worse, *within* storefront-runtime the API client (`lib/api/client.ts:34`) reads only 2 of the names while `proxy.ts`/`storefront-access.ts` read 4 — set the "wrong" declared name and the client silently falls back to `https://api.letbuyy.store/v1`. **Fix:** one canonical name each + a shared `resolveLetbuyyApiBaseUrl()` helper.
- **P1-7 · Non-timing-safe secret compare on pre-auth internal routes.** `routes/internal-store-access.ts:18`, `routes/internal-custom-domain-reconcile.ts:22` use `===` on `INTERNAL_API_SECRET` (mounted before `authMiddleware`; the reconcile route has no HMAC fallback). **Fix:** use the existing `timingSafeEqualText`. Also add a strict per-IP limiter on `/internal/*` (`index.ts:565`) regardless of auth outcome.
- **P1-8 · Transient backend error logs valid merchants out / fakes 404.** `apps/merchant-control-plane/src/lib/auth/session.ts:23,62,88` `catch { return null/[] }` around a no-timeout/no-retry `fetch` that throws on any non-2xx — a gateway 503/blip ⇒ redirect to login or `notFound()` for a valid merchant. **Fix:** treat only 401/403 as unauth; rethrow 5xx/network into `error.tsx`; add timeout + bounded retry.
- **P1-9 · No `error.tsx`/`not-found.tsx` on the two critical apps.** Only developer-portal has them; merchant-control-plane and storefront-runtime have none (8/9 App Router apps lack `error.tsx`) → bare Next.js error pages leak framework info, no recovery UI. **Fix:** add `error.tsx`/`global-error.tsx`/`not-found.tsx`.
- **P1-10 · Missing notification surfaces silently drop.** `notification-service` is an empty stub; employee-invite email (`routes/employee.ts:287`, `admin.ts:283`), contact-form notify (`routes/contacts.ts:48`), and `order.paid` have no consumer → merchants get no invite emails, no order alerts. Mobile push also dead: `push_service.dart:71,81` throw because `POST/DELETE /v1/push/device-tokens` doesn't exist (the `device_tokens` table does). **Fix:** ship via Resend now or gate+document per flow; implement the push token routes.
- **P1-11 · Edge middleware / secret getters throw on missing env.** `storefront-runtime/src/middleware.ts:39,45,50` and `lib/session.ts:33` throw inside the request path → 500 on every storefront request if config is absent. **Fix:** validate in `instrumentation.ts`; degrade gracefully.

---

## P2 — Medium (quality / hardening)

- **Public `POST /contacts` has no schema validation** (`routes/contacts.ts:8-49`, manual `if` only, no Zod/length caps).
- **XSS logged, not blocked** (`middleware/security.ts:113-124` warns but passes content through; no ingestion sanitization).
- **Legacy inventory adjust is a non-atomic read-modify-write** (`execution/payment-execution.adapter.ts:97-131`) → oversell on the legacy-JSON path (primary checkout path is correctly `FOR UPDATE`-locked — verified).
- **`export.ts:397,456` `while(true)` keyset loops** terminate but have no absolute max-batch safety cap.
- **Empty services wired into deploy topology** (`config/runtime/deployment-topology.json` gives `checkout-runtime` etc. health-check names + dependency edges) → false-green/false-fail health automation, ops chasing non-existent services. Mark `"status":"placeholder"` and exclude from health.
- **Partitioning migrations `079–083` are inert shadows** — build `*_partitioned` tables but never cut over (`081_…:2` "does not swap live tables"); the scaling problem they target is still unsolved.
- **Non-idempotent migrations** (`076,093,095-098` bare `CREATE TABLE` without `IF NOT EXISTS`) despite the "replayable" claim.
- **~10 mobile features + 6 services hard-stub** via `SkipNeedsBackendException` (Payouts, Wallet, Commission, KYC, Returns, 2FA, Business Details, Localization, Metafields, App-Bridge runtime) — backend-contract gaps surfaced as mobile dead-ends; Turnstile + Razorpay key are `SKIP_NEEDS_HUMAN` placeholders so mobile login & checkout are off until configured.
- **User-visible stubs:** merchant `ats-score` "Coming Soon"; platform-ops portal ships 6/7 modules as "blocked"; platform-console `marketplace-governance` "backend missing". Hide from nav until built.

---

## The meta-issue: the verification system measures the wrong thing

This is *why* P0-1 and P0-2 survived "167 green":
- **~8 of ~167 validators do real analysis** (import graph / topology / circular / migration-safety lint). The rest: **~74** read `config/runtime/*.json` "evidence" and assert keys exist (**43 of those JSON files self-declare** `mode:"governance-contract-not-live-evidence"` / `"…not-production-certification"`), and **~85** grep product source for required/forbidden substrings. **Zero validators compile TS, run a build, execute a handler, or query a DB.**
- **`pnpm test` mostly re-runs the validators.** `test:behavioral` = `node --test tests/*/*.test.mjs`, which spawn validators and assert exit 0; `tests/` is organized 1:1 against validator names. `test:contracts` is mixed but skewed to `assert.match(readFileSync(routeFile), /regex/)` — e.g. `__tests__/payments.test.ts:45` asserts code *ordering* via `indexOf`, never calling a handler.
- **The one real gateway integration test is orphaned.** `services/api-gateway/src/__tests__/security.test.ts` mounts middleware on a real Hono app and asserts 403/429/200 — but `api-gateway/package.json:10` points `test` at the shared `tests/contracts` dir, so `src/__tests__/` **never runs**.
- **CI** (`.github/workflows/ci.yml`) does run real `tsc`/Next build/`flutter` — but only on files **changed since `HEAD^1`**; the `governance` job (theater) and the `test:behavioral` half are unconditional and stay green even if the product is broken.

**What CI should gate on instead:** whole-repo `turbo typecheck` + real `turbo build` (+ `wrangler deploy --dry-run` for workers, not `tsc --noEmit`); wire up `src/__tests__/` and add an order→pay→confirm handler test with a stub provider; RLS/tenant-isolation tests against an ephemeral Postgres/PGlite (querying as `anon`); keep the ~8 real topology validators, demote the ~159 evidence/certification validators to non-gating "human-review". **Stop using the 167-count as the readiness bar.**

---

## What's actually healthy (don't spend the week here)
Backend typechecks clean (verified) · money is fixed-point `numeric` everywhere (no float bug — verified) · **primary** checkout inventory + coupon/gift-card redemption are `FOR UPDATE`-race-safe (verified) · idempotency adapter is correct · webhook-service Razorpay sig **is** timing-safe · customer-session JWT has no empty-key fallback · 296 tables RLS-enabled / 464 policies (breadth is there; the gaps above are specific) · no real secrets committed · `.gitignore` correct · dev-auth-bypass correctly gated to non-prod · deprecated app aliases fully removed · queue-workers retries are capped with DLQ + circuit breaker.

---

## Revised 1-week burn-down
1. **Day 1 — stop the exploits (P0-1, P0-2).** Add amount+capture+ownership verification and a global payment-id unique index; re-scope the 5 credential/session/token RLS policies to `service_role` and verify as the anon role. Rotate secrets if the DB was ever exposed.
2. **Day 2 — deploy blockers (P0-3,4,5).** Real BFF secret; rate-limiter KV fallback / deploy gate; assert non-empty `AUTH_SECRET`. CI gate: no `SKIP_NEEDS_HUMAN`, no `letbuyy.store` literal in shipped code (incl. Dart/TOML).
3. **Day 3 — domain cutover (P0-6) + security P1s.** Config-drive `brand.ts`/`cors.ts`/`api-client`/Dart; flip env defaults + wrangler routes + DNS; P1-1 metadata RBAC, P1-3 own-row policies, P1-2 enable RLS on the 3 tables, P1-7 timing-safe + internal limiter.
4. **Day 4 — reliability.** P1-8 session error handling, P1-9 error pages, P1-11 middleware env, P1-5 the circular-dep barrel refactor (at least the api-gateway entrypoint), P1-6 collapse env aliases.
5. **Day 5 — decisions + real gates.** P1-10 notifications/push (ship or gate), P2 topology placeholders; split CI into real gates vs non-gating evidence; run a **staging smoke test** of signup → create store → add product → checkout → pay → order — treat *that*, not the validator count, as the readiness bar.

# LetBuyy — Production-Readiness Master Plan

**Date:** 2026-06-07
**Method:** Direct code reading + static analysis of the live runtime (api-gateway, all apps, all wrangler configs, 36 SQL migrations), real `tsc` / `madge` / test runs, and four focused deep-dive passes. Governance markdown (`CODEX_*.md`, `FORENSIC_REPORT/`) and `.mjs` validators were treated as **non-evidence** and deliberately excluded — see §1.
**Scope:** Everything that must be true before real customers and real money touch this system.

---

## 0. Verdict & the one strategic call

**The code foundation is real and far stronger than the repo's governance theater suggests.** The backend (`services/api-gateway`, ~48k LOC) type-checks clean under `strict`, payments are correctly signature-verified with idempotency and ownership guards, money is exact (no floats), and RLS is enabled on 234/234 baseline tables. A merchant could run the core happy path — catalog, cart, multi-provider checkout, inventory, orders, media, search — today.

**It is not production-*safe* as shipped.** There are a handful of genuine blockers (one always-on cross-tenant PII leak, a nullable tenant key on `orders`, no order-confirmation email, and a large set of un-done *deploy* steps), plus a domain migration that is half-finished and dangerous to flip under time pressure.

**Can it be production-ready next week? Yes — for a controlled launch — if you do two things:**

1. **Fix the ~6 P0 issues in §2** (3–4 focused dev-days).
2. **Launch on `letbuyy.store` and DEFER the `.com` cutover.** This is the single highest-leverage decision in this document. The `.store → .com` migration is the riskiest, least-finished work (139 hard-coded literals, CORS host mismatch, cookie-domain flip, **a mobile app that bakes the domain in at build time and needs an app-store resubmit**). None of it is required to serve customers — `.store` is the working default today. Treat `.com` as a planned week-2+ project using the runbook that already exists in `docs/seo/`. Pulling the cutover off the critical path removes 4–5 blockers from your week.

> If marketing *requires* `.com` at launch, add ~3 days and follow §6 precisely — but I'd advise against it for a next-week date.

---

## 1. How to read this — do NOT trust the green checkmarks

Your CI shows **"169 governance validators passed."** That banner is the most misleading artifact in the repo. Verified facts:

- **0 of 173 validators do any AST/semantic analysis.** ~72% are `string.includes()` matches against `.md` / JSON "evidence" files.
- **56 validators pass *because* the system declares itself not-live** — they assert the literal string `governance-contract-not-live-evidence` / `productionCertification: false`.
- The CI `governance` job **runs without `pnpm install`** — it never builds or executes app code. Green = "the expected files and phrases exist," not "the software works."
- The validator that certifies **"0 circular imports" is wrong** — `madge` finds **89 real cycles** in api-gateway alone; the validator is structurally blind to intra-package cycles.

**Implication:** you currently have almost no automated safety net. Your real tests exist but are orphaned (§4). Use *this* document, not the validator count, as your go/no-go.

---

## 2. P0 — Blockers (must fix before any real traffic)

| # | Severity | Issue | Evidence | Impact | Fix |
|---|----------|-------|----------|--------|-----|
| P0-1 | **Critical** | `POST /storefront/customer/find-or-create` is public, unauthenticated, returns full customer PII and silently inserts records | `routes/storefront/customer-engagement-routes.ts:327-390`; not in `requireCustomerSession` list (`storefront.ts:68-74`); missing `requireStorefrontInternal` (unlike its siblings `/by-email`, `/status`) | Anyone can POST `{store_id,email}` and read `{full_name, phone, email, status}` for any customer of any store (cross-tenant PII enumeration), or spam-inject `store_customers` rows | Gate with `requireStorefrontInternal` (server-to-server) or a customer session, exactly like the sibling lookups |
| P0-2 | **Critical (latent)** | Customer-session bypass when `CUSTOMER_LEGACY_AUTH` is enabled — trusts body `customer_id`/`store_id` with no identity check | `customer-engagement-routes.ts:110-129` + `middleware/customer-session.ts:32-35`. **Off by default** (flag unset everywhere), so not live today | If the flag is ever set to `1/true/on`, every `/storefront/customer/*` route becomes a cross-tenant read/write (order history, saved addresses, profile overwrite) for all stores | **Delete the legacy bypass entirely.** A latent full-breach footgun behind a single env var is not worth keeping |
| P0-3 | **High (integrity)** | `orders.store_id` **and** `orders.site_id` are both **nullable**; two redundant tenant columns that must be kept in sync | `database/supabase/migrations/000_baseline.sql:10112` (`store_id uuid`), `:10139` (`site_id uuid`) — no `NOT NULL`, while `subtotal`/`total` are `NOT NULL` | A NULL tenant key on the most critical table escapes every tenant-scoped query and RLS predicate. App sets it today, so it's latent — but it's one bad insert from a cross-tenant leak | Backfill, add `NOT NULL` on the canonical column, and pick ONE tenant column (drop/deprecate the other) |
| P0-4 | **High** | No transactional order-confirmation / receipt email | Resend infra exists (`packages/infrastructure/resend-adapter`, used at `auth.ts:310`, `customer-engagement-routes.ts:277`) but is **never wired to order placement**; `order_placed` only writes `customer_activity_log` (`customer-engagement-routes.ts:959`) | Customers get no receipt after paying — a credibility/trust breaker for a real store and a support-ticket flood | Hook an order-confirmation email into the post-payment path (already have the adapter + the `order.paid` event) |
| P0-5 | **Blocker (ops)** | The security fixes are in the **repo** but not **deployed**. Migration `107` not applied; Worker secrets not set | `107_security_rls_hardening_and_payment_uniqueness.sql` present but un-applied; no real secrets in any `wrangler.toml` (correct — they must be `wrangler secret put`) | RLS hardening + payment-uniqueness index are inert until applied; gateway 500s / fails closed without secrets | Apply migration 107 (dedupe duplicate `provider_payment_id` first if any), `wrangler secret put` all secrets — see §7 checklist |
| P0-6 | **Process** | No real automated safety net: your 7 genuine backend tests are orphaned and CI only checks changed packages | `services/api-gateway/src/__tests__/*` (security, payments, tenant-isolation) run via **no** wired command; CI uses `--filter=...[HEAD^1]` on typecheck/test/build | A regression in any untouched package or the security suite ships silently. You can't safely change code under deadline pressure | Wire `src/__tests__/*` into `api-gateway`'s `test` script + a CI job; add a full-repo `tsc` gate (not `HEAD^1`) |

---

## 3. P1 — High (fix in week 1, or accept with explicit mitigation)

| # | Severity | Issue | Evidence | Impact / Fix |
|---|----------|-------|----------|--------------|
| P1-1 | High | `DELETE /upload/*` has no object-ownership check | `routes/upload.ts:142-162` — deletes `R2_BUCKET.delete(key)` with no `owner_id` match. Currently neutered by a `/v1` path-prefix bug that mangles the key | One fix away from "any seller deletes any seller's product images." Fix: derive key from a validated param, verify `customMetadata.owner_id === auth.user.id` before delete |
| P1-2 | High | `optionalAuth` reads role from client-writable `user_metadata` | `middleware/auth.ts:275-276` (vs hardened `authMiddleware:220-225`) | No live exploit (privileged gates re-derive from DB), but any future `requireRole` under an `optionalAuth` route = privilege escalation. Fix: prefer `app_metadata`, or DB-only |
| P1-3 | High | **No security headers / no real CSP on most apps** | Only `merchant-control-plane` has a sane header baseline; `identity-platform` (the auth app) has **no CSP/HSTS**; `app-marketplace`, `developer-portal`, `marketing-site`, `platform-console`, `platform-operations-portal` ship **zero** security headers; the only CSP (storefront) is `frame-ancestors`-only | XSS/clickjacking exposure on auth + admin surfaces. Fix: a shared security-headers config across all apps; add a real CSP (`default-src`/`script-src`/`connect-src`) |
| P1-4 | High | No GDPR erasure / data-export path | Zero erasure/anonymize/export routes in schema or gateway; only per-address delete (`routes/customers.ts:429`). PII is abundant (`store_customers`, `customer_credentials`, `orders.customer_email/phone`) | Legal blocker **if launching to EU**. If launch is India/non-EU first, this is P2. Fix: a `delete-customer` RPC + data-export endpoint |
| P1-5 | High | Dual-model JSONB↔relational drift | `orders.items jsonb` vs `order_items` table (author-acknowledged in `085_orders_items_reconcile.sql:1-2`); `products.variants` vs `product_variants` (`086`) | Two sources of truth for line items/variants; needs a running reconciliation job or they silently diverge. Fix: pick the relational model as canonical, make JSONB a derived/read cache, schedule the reconcile job |
| P1-6 | High | Money representation split + width mismatch | Storefront `orders.total numeric(10,2)` (`:10117`); platform billing uses `integer` minor units (`app_billing_charges.amount_minor`, `:8254`); `carts.grand_total numeric(12,2)` is **wider** than `orders.total numeric(10,2)` | A cart can hold a value that overflows when copied to the order; cross-cutting financial reporting must bridge two money types. Fix: widen `orders.total` to match carts; document the two money domains |
| P1-7 | Med→High | Cross-store coupon enumeration; unscoped notification writes; `/contacts` 500 | `coupons.ts:218` (no ownership check on `/validate`), `notifications.ts:114-205` (unverified `store_id`, unauth-shaped log inserts), `contacts.ts:54` (mounted public → `auth` undefined → 500) | Info leak + log spam + a broken route. Fix: ownership checks; move `/contacts` behind `authMiddleware` |

**Cutover-only P1s (only relevant if you launch on `.com` now — otherwise defer with §0):**

- **CORS host mismatch breaks browser checkout.** Allowlist names `storefront`/`merchant` (`lib/cors.ts:23-34`) but the storefront is actually served at `store.letbuyy.store`, `<sub>.letbuyy.store`, and custom domains, which make browser calls to `api.letbuyy.store` (`browser-client.ts:44`). Custom domains can't be statically allowlisted → route storefront API calls **same-origin** via a Next rewrite instead.
- **The "one env flip" has no flip-points staged.** `LETBUYY_PLATFORM_DOMAIN`, `NEXT_PUBLIC_PLATFORM_DOMAIN`, a `.com` `COOKIE_DOMAIN`, and `CORS_CREDENTIAL_ORIGINS` are set in **zero** committed config — at cutover CORS, SSO cookies, and tenant root all silently stay on `.store`.
- **Hard-coded `.store` in auth/money paths:** password reset (`customer-engagement-routes.ts:246`, `auth.ts:910`), Stripe callbacks (`payments.ts:787-788`).
- **Mobile bakes `.store` at build time** (`apps/mobile/merchant-app/lib/config/app_config.dart`) → needs a rebuild with `--dart-define` **and an app-store resubmission** before any cutover.

---

## 4. P2 — Medium (fast-follow, weeks 2–4)

- **89 real circular dependencies** in api-gateway + 15 in packages (`madge`), concentrated in `packages/orchestration` and `packages/theme-engine` barrel files. Tolerated by `tsc` today but a real ESM init-order/TDZ hazard under bundling. Compiled `dist/*.d.ts` is also committed into `theme-engine`.
- **~17 foreign keys lack explicit `ON DELETE`** (e.g. `app_reviews_store_id_fkey`, `:20842`) → can block site deletion or orphan rows. **`orders.site_id` FK is unindexed** (`:17727` indexes only `store_id`).
- **`order_items` has no tenant column** (tenant only via parent `order_id`) while sibling `order_line_adjustments` has `site_id NOT NULL` — inconsistent; RLS must JOIN.
- **Password hash stored twice** — `store_customers.password_hash` (`:12179`) and the dedicated `customer_credentials.password_hash` (`:8891`). Pick one source of truth.
- **Mixed migration idempotency** — `076, 093, 095, 096, 097, 098` use bare `CREATE TABLE` (fail on re-run); baseline is a non-idempotent `pg_dump`.
- **Search is trigram-only** (`084_trigram_search_indexes.sql`) — no full-text ranking, facets, or synonyms. Fine for launch; revisit if catalog scale grows.
- **Push notifications dead until configured** — `queue-workers/wrangler.toml` ships `FCM_*`/`APNS_* = "SKIP_NEEDS_HUMAN_*"` placeholders (code is real; config is not).
- **Governance honesty** — eventually replace the string-match validators with real AST checks, or stop reporting the count as readiness.

---

## 5. What's genuinely solid (don't re-litigate these)

- **Payments are correctly hardened.** Signature verify is timing-safe; the subscription path does a **live Razorpay capture + amount + order-binding check** (`payments.ts:515-532`); the order path fails closed on `payment_id` binding (`:730`); migration 107 adds a global unique on `(gateway, provider_payment_id)`. Server-side pricing — client sends only product IDs + qty.
- **Tenant isolation on admin/merchant routes is consistently enforced** via `verifySiteOwnership` / ownership adapters on orders, products, customers, inventory, coupons, stores, employees, analytics. The holes are confined to the customer-facing storefront surface (§2/§3).
- **Internal routes fail closed** with timing-safe secret comparison.
- **Idempotency is correct** — atomic `INSERT … ON CONFLICT (site_id, scope, key)` with request-hash binding (not check-then-write); inventory mutations go through atomic Postgres RPCs.
- **Exact money** — integer minor units / `numeric`, never float, in all payment paths. **No SQL injection** — parameterized throughout.
- **RLS enabled on 234/234 baseline tables** (356 policies); UUID PKs (no sequential hotspots); soft-delete on 182/234 tables; no destructive migration ops.
- **Backend + 4 real Workers + core packages type-check clean under `strict`.**

---

## 6. Known limitations — descope explicitly or accept as documented risk

These are NOT achievable-and-complete in a week. Decide for each: descope, or accept as a known launch limitation.

1. **`.com` migration** — defer (see §0). Launch on `.store`.
2. **The 6 "reserved" microservices** (checkout-runtime, search-service, media-service, notification-service, event-bus, analytics-pipeline) are empty manifest stubs. **This is fine** — every capability is really implemented inside api-gateway. Just stop presenting them as architecture; they're placeholders.
3. **Shopper mobile app** (`apps/mobile/shopper-app`) — reserved/unbuilt. Push-notification dispatch code exists but has no consumer app.
4. **Search relevance / faceting** — trigram only. Acceptable at launch scale.
5. **GDPR tooling** — build before EU; acceptable to defer for an India-first launch.

---

## 7. The realistic one-week plan

Assumes 1–2 focused engineers, launch on **`.store`**, `.com` deferred.

**Day 1 — Security P0s (code)**
- Fix P0-1 (`find-or-create` gating) and P0-2 (delete the `CUSTOMER_LEGACY_AUTH` bypass).
- Fix P1-1 (`upload` delete ownership + the `/v1` key bug) and P1-7 (`/contacts`, coupon/notification scoping) while you're in those files.
- Write/expand tests for each as you go.

**Day 2 — Data integrity + safety net**
- P0-3: backfill + `NOT NULL` on the canonical `orders` tenant column; new migration `108`.
- P0-6: wire `services/api-gateway/src/__tests__/*` into the test command + a CI job; add a full-repo `tsc` gate.
- P1-2 (`optionalAuth` role precedence).

**Day 3 — Launch-essential UX + headers**
- P0-4: order-confirmation email on the `order.paid` path.
- P1-3: shared security-headers + CSP across all apps (prioritize `identity-platform` and admin surfaces).

**Day 4 — Deploy dry-run (staging)**
- P0-5: apply migrations (incl. 107, 108) to staging Supabase; `wrangler secret put` all secrets (see checklist); set `queue-workers` FCM/APNS real values (or accept push as off).
- Deploy all Workers + apps to staging on `.store`. Run the now-wired security/tenant-isolation tests against it. Manual smoke: signup → create store → add product → checkout (Razorpay live-test) → order email arrives → refund.

**Day 5 — Production deploy + monitoring**
- Repeat Day-4 deploy to production `.store`.
- Confirm rate-limiter has Upstash Redis (or accept the documented in-memory/KV fallback); confirm error monitoring/alerting is actually receiving events.
- Soft launch to a small cohort.

**Buffer (weekend / day 6–7):** money-width fix (P1-6), dual-model reconcile job (P1-5), FK indexes (`orders.site_id`). Begin the `.com` migration as a separate tracked project.

### Deploy / ops checklist (the manual steps that aren't code)

- [ ] Dedupe any duplicate `provider_payment_id` rows, then **apply migration 107 + 108** to prod Supabase.
- [ ] `wrangler secret put` for every Worker env: `INTERNAL_API_SECRET`, `AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `RAZORPAY_KEY_ID`/`_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, Upstash Redis URL/token (api-gateway, mobile-bff, webhook-service, queue-workers).
- [ ] Rotate the Supabase anon key **if it was ever exposed** before migration 107 (pre-fix, credential/session tables were anon-readable).
- [ ] Set `queue-workers` FCM/APNS config (or formally accept push as off for launch).
- [ ] Confirm rate-limiter backing store (Upstash) is provisioned; otherwise it runs fail-open.
- [ ] Verify Cloudflare R2 bucket + `ASSET_PUBLIC_BASE_URL` are set for media.
- [ ] Smoke-test the full purchase + refund flow against production before opening traffic.

---

## 8. Appendix — issue index by file

- `routes/storefront/customer-engagement-routes.ts` — P0-1 (`:327`), P0-2 (`:110-129`), P0-4 (`:959`), cutover `.store` (`:246`)
- `middleware/customer-session.ts` — P0-2 (`:32-35`)
- `database/supabase/migrations/000_baseline.sql` — P0-3 (`:10112`, `:10139`), money width (`:10117`), dual-model, FK gaps
- `database/supabase/migrations/107_*.sql` — P0-5 (apply to prod)
- `routes/upload.ts` — P1-1 (`:142-162`)
- `middleware/auth.ts` — P1-2 (`:275-276`)
- `lib/cors.ts` / `browser-client.ts` — cutover CORS (`:23-34` / `:44`)
- `routes/payments.ts` — solid (`:515-532`, `:730`); cutover `.store` callbacks (`:787-788`)
- `routes/auth.ts` — cutover `.store` reset (`:910`)
- `services/api-gateway/src/__tests__/*` — P0-6 (orphaned)
- `packages/orchestration`, `packages/theme-engine` — P2 circular deps

---
*This plan supersedes the validator count as the production go/no-go. Green validators ≠ ready; this checklist = ready.*

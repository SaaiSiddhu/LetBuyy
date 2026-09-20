# LETBUYY MASTER EXECUTION PLAN — Final Source-of-Truth Architecture Review

Generated: 2026-06-05
Reviewer role: Acting Principal Architect (Shopify) / Staff Engineer (Cloudflare + Supabase) / Security Lead / Performance Lead / CTO due-diligence.
Repository: `/Users/saai_sidd/Git/Letbuyy_Store`
Inputs verified against: `docs/LETBUYY_DEEP_AUDIT_REPORT.md`, `docs/LETBUYY_CTO_WAR_ROOM_REPORT.md`, and the live working tree at commit `ff49520a`.

Mandate: This document does not implement fixes. It verifies every prior finding, marks each verdict, adds missed findings, and is the canonical input to the P0–P4 master plans and `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`.

---

## 0. How To Read This Document

Every issue carries the full required envelope:

- **Severity** — Critical / High / Medium / Low.
- **Verdict** — VERIFIED / PARTIALLY VERIFIED / FALSE POSITIVE / NEEDS MANUAL VALIDATION.
- **Exact files / functions / code path** — repository-relative with line anchors confirmed in the current tree.
- **Business impact** and **Technical impact**.
- **Fix complexity** (S/M/L/XL) and **Risk of change** (Low/Med/High).

A verdict of FALSE POSITIVE means the prior reports were wrong or stale, and the issue should be **closed, not worked**. This review challenges the prior reports rather than trusting them; six prior findings are downgraded or reversed, and eleven net-new findings (`MISSED-*`) were added, three of them Critical/High.

---

## 1. Executive Summary

LetBuyy is a genuinely substantial, governance-heavy, multi-runtime commerce platform: a Hono Cloudflare API gateway (`services/api-gateway`), dedicated webhook and queue Workers, eight-plus Next.js runtimes, Flutter apps, ~24 domain packages, and a ~27,700-line Supabase baseline. The architecture spine is real and, in places, better than the prior reports credit. Since those reports were written (2026-06-04), **41 commits** landed a GraphQL Admin + Storefront gateway, a REST-shim parity layer, a WASM checkout-function runtime, an extension host/registry, theme app blocks, and a **fully implemented LiquidJS renderer**. Neither prior report reviewed any of this code.

The headline conclusion of both prior reports stands and is reaffirmed: **do not launch.** But the *reason* is sharper than they stated. The launch blocker is not "Liquid is missing" (it isn't) or "operations routes are unguarded" (they are RBAC-guarded). The blocker is a **single, end-to-end-exploitable customer-account authorization collapse** that is broader than either report found, plus release-pipeline hygiene that can silently ship untested code.

The most important correction in this review: the prior reports treated the public customer endpoints as a set of independent read-only leaks. In fact they **chain into a complete unauthenticated account-takeover-and-mutation kill chain**, and the same data is reachable through a **second** door (Storefront GraphQL) that the reports never saw. `verifyStoreCustomer()` — the function the codebase relies on to gate "session-proxied" customer mutations — performs no authentication at all; it only checks that a row exists. An attacker who knows a store's subdomain can enumerate a customer by email, read that customer's UUID, then read and **write** that customer's addresses, profile, and wishlist, and set their password.

Second-order risk is operational economics: a verified web of OLTP write-amplification (per-request request logs, 3 DB writes per queue message, a minute cron that always enqueues a completion event, two-to-three rate-limit round-trips per request, and a brand-new GraphQL fan-out that re-enters the full middleware stack per field) will inflate Supabase and Cloudflare cost well before merchant revenue justifies it. A paid Hyperdrive binding sits completely unused while every query goes over PostgREST HTTP.

Net readiness verdict: **NO-GO for launch. GO for a tightly-scoped 100-merchant private beta after the P0 security cluster and release-pipeline gates are closed.** The platform is closer to a safe 100-merchant beta than the breadth of the codebase suggests, because most of the remaining surface area is roadmap, not blocker. It is materially **not** ready for 10,000 merchants and not in the same universe as 100,000.

### Revised Readiness Scorecard

| Dimension | Deep Audit | War Room | This Review | Rationale for delta |
|---|---:|---:|---:|---|
| Architecture | 72 | — | **70** | Strong boundaries; new GraphQL/extension layers add surface area that is undeployed and unproven. |
| Security | 48 | 57 (overall) | **40** | Lowered: the customer-auth collapse is broader (IDOR writes + GraphQL second path) than reported. |
| Cost efficiency | — | — | **42** | New GraphQL fan-out and unused Hyperdrive compound the known write-amplification. |
| Performance | — | — | **48** | Confirmed; no edge cache on REST storefront, hot-row view counter race, GraphQL N+1. |
| Scalability | 45 | — | **44** | Confirmed; partitioning still absent, but hot-table `created_at` indexes *do* exist (report sub-claim corrected). |
| Reliability | 52 | — | **52** | Idempotency/webhook foundations solid; release pipeline can skip critical jobs silently. |
| Product depth | 54 | — | **58** | Raised: Liquid renderer now real; checkout-function sandbox genuinely safe. |
| Overall | 56 | 57 | **48** | Security reweighting dominates. |

---

## 2. Launch Readiness

### 2.1 Decision: NO-GO (today). Conditional GO for 100-merchant private beta.

The seven War-Room launch conditions remain the correct gate, **amended** by this review:

| # | Launch condition | Status in current tree | Amendment from this review |
|---|---|---|---|
| 1 | Customer account routes are safe | **FAILING** | Scope widened: must also fix `verifyStoreCustomer` IDOR (writes) and the Storefront GraphQL `customer`/`order` resolvers. Read-only fixes alone are insufficient. |
| 2 | Governance validation green | **NEEDS VALIDATION** | Corrected: no generated artifacts are committed to git; the validator only fails on a locally-built tree. This is a CI-hygiene gate, not a code defect. |
| 3 | Production deploy cannot silently skip release-critical work | **FAILING** | Confirmed: job chain uses plain `needs:` with no `if: always()`; skipped steps report success. |
| 4 | Checkout/payment/webhook smoke tests pass | **MISSING** | Confirmed; provider replay + signature-rejection tests do not exist as launch gates. |
| 5 | Public storefront reads cached | **FAILING (REST)** | Nuance: GraphQL storefront sets `Cache-Control` headers, but the live REST storefront path has no Cache API and no cache headers. |
| 6 | Per-request OLTP logging sampled/moved | **FAILING** | Confirmed unsampled; compounded by GraphQL fan-out generating 10+ log rows per query. |
| 7 | Operator runbooks exist | **MISSING** | Confirmed; no payment/queue/webhook/migration incident runbooks in `docs/`. |

New condition added by this review:

| 8 | **The undeployed WS11–WS13 stack (GraphQL, extensions, Liquid, checkout functions) is either deployed-and-proven in staging or feature-flagged OFF for launch.** | **FAILING** | This code is wired into the production gateway (`index.ts`) but has never run in a deployed environment. It must not reach production untested. |

### 2.2 Scale verdict (challenged and reaffirmed)

| Scale | Prior verdict | This review | First wall |
|---|---|---|---|
| 100 merchants | Yes after P0 | **Yes, after P0 security + release gates** | Customer-auth kill chain; release pipeline. |
| 1,000 merchants | Likely with hardening | **Plausible** with caching, log sampling, queue budgets, analytics rollups | Supabase write amplification; uncached REST storefront. |
| 10,000 merchants | Not ready | **Not ready** | PostgREST-over-HTTP for all reads (Hyperdrive unused), no partitioning/retention, GraphQL fan-out, OLTP analytics. |
| 100,000 merchants | No | **No** | Single-primary Supabase model; no sharding, no edge-first storefront, no multi-region proof. |

---

## 3. Security

The security picture is **worse than reported in scope but narrower in count** — several reported issues are already mitigated in code. Below, every prior security finding receives a verdict, followed by net-new findings.

### 3.1 Verified Critical — the customer-account kill chain

#### SEC-1 — Public, sessionless customer password mutation (VERIFIED, Critical)

- **Files / function:** `services/api-gateway/src/routes/storefront.ts:2934` `POST /customer/password`.
- **Code path:** mounted at `services/api-gateway/src/index.ts:187` (`api.route('/storefront', storefrontRouter)`) **before** `authMiddleware` at `index.ts:193`. Handler calls `getSupabaseAdmin(c)` (service-role, RLS-bypassing), validates only `store_id` + `email` + `password`, then `UPDATE store_customers SET password_hash WHERE store_id=… AND email=…`.
- **Business impact:** Account takeover of any shopper given store + email. Trust-destroying for a commerce platform.
- **Technical impact:** Writes credential state with no token, no session, no rate limit beyond the global 20 req/s/IP query-cost limiter.
- **Fix complexity:** M. **Risk of change:** Med (touches storefront customer-auth contract and the Next storefront app that calls it).

#### SEC-2 — Public customer order history + contact lookup (VERIFIED, Critical)

- **Files / functions:** `storefront.ts:3271` `GET /customer/orders`; `storefront.ts:3293` `GET /:subdomain/orders/contact`.
- **Code path:** both public; `/customer/orders` selects `orders(id, order_number, status, total, created_at, items)` by `store_id` + `customer_email` via service-role client; `/orders/contact` selects `orders(*)` by `customer_email` or `customer_phone`.
- **Business impact:** Mass disclosure of order PII (totals, line items, contact) by email/phone enumeration.
- **Technical impact:** Service-role read bypasses RLS entirely; `limit(50)` / unbounded contact query.
- **Fix complexity:** M. **Risk of change:** Med.

#### SEC-3 — Customer enumeration oracle (VERIFIED, Critical→High)

- **Files / functions:** `storefront.ts:2966` `GET /customer/by-email`; `storefront.ts:2990` `GET /customer/status`.
- **Code path:** public; `by-email` returns the full `store_customers` row; `status` returns `{exists, hasPassword, status}`.
- **Business impact:** Confirms which emails are customers of a store and whether they have a password — fuels phishing/credential stuffing and feeds SEC-1/MISSED-1.
- **Technical impact:** `by-email` leaks the customer UUID and `password_hash` presence directly.
- **Fix complexity:** S. **Risk of change:** Med (storefront app relies on these for guest/login UX).

#### SEC-6 — Identity set-password trusts client `userId`/`email` (VERIFIED, Critical)

- **Files / function:** `apps/identity-platform/src/app/api/auth/set-password/route.ts:34` reads `{ password, userId, email }` from the request body and forwards to the backend set-password call (`:51-58`). No server-side OTP transaction or session cookie is required; guards are IP rate-limit (`:21`) + same-origin CSRF (`:30`) only.
- **Business impact:** Merchant account takeover if an attacker supplies a known `user_id`+`email`.
- **Technical impact:** The "after OTP" comment is not enforced; the OTP step (`verify/route.ts`) sets a cookie this route never checks.
- **Fix complexity:** M. **Risk of change:** Med (identity OTP flow).

### 3.2 Net-new Critical/High — missed by both reports

#### MISSED-1 — `verifyStoreCustomer()` is a toothless existence check → unauthenticated IDOR writes (VERIFIED, Critical) — the single most important finding in this review

- **Files / function:** `services/api-gateway/src/routes/storefront.ts:1058` `verifyStoreCustomer(c, storeId, customerId)`.
- **Exact code:** `select('id').eq('id', customerId).eq('store_id', storeId).single()` → `return Boolean(data)`. It authenticates **nothing**; `customerId` is supplied by the caller.
- **Code path / blast radius:** every "session-proxied" customer route trusts this gate: wishlist add/remove/sync (`storefront.ts:3255,3341,3371,3398`), profile update `PATCH /customer/profile` (`:3457`), and address CRUD `GET/POST/PATCH/DELETE /customer/addresses*` (`:3596,3624,3674,3720`). The exploit is closed end-to-end: SEC-3 `/customer/by-email` returns the victim's `customer_id` from `store_id`+`email`, which then satisfies `verifyStoreCustomer`.
- **Business impact:** Any unauthenticated actor can **read and overwrite** another shopper's saved addresses, profile, and wishlist for any store. This is strictly worse than the prior reports' read-only framing.
- **Technical impact:** Broken object-level authorization across the entire customer-account surface; service-role client means RLS offers no backstop.
- **Fix complexity:** L (requires a real signed customer-session primitive). **Risk of change:** High (changes the customer-session contract consumed by the storefront app and mobile).

#### MISSED-2 — Storefront GraphQL is a second unauthenticated path to the same customer/order data (VERIFIED, High)

- **Files / functions:** `services/api-gateway/src/graphql/storefront.ts:496-505` (`customer` resolver) delegates to `/storefront/customer/by-email`; `:508-521` (`order` resolver) delegates to `/storefront/customer/orders`. Mounted public at `index.ts:185-187` (`/storefront/graphql`, `/graphql/storefront`).
- **Code path:** the resolver's `restDelegate` is `app.fetch(request, c.env)` (`index.ts:171`), which re-enters the pipeline and lands on the same sessionless REST routes (SEC-2/SEC-3).
- **Business impact:** Fixing only the REST routes' callers (e.g., in the Next app) would leave this door open. The fix must live at the gateway route, not the app.
- **Technical impact:** Confirms the gateway — not the app — is the correct enforcement point.
- **Fix complexity:** S once SEC-2/SEC-3 are fixed at the route. **Risk of change:** Low.

#### SEC-7 — Customer login: no brute-force limiter + returns `password_hash` (VERIFIED, High)

- **Files / function:** `storefront.ts:3018` `POST /customer/login`. Public; does `bcrypt.compare`; the only limiter is the global `queryCostRateLimit` (`index.ts:168`, ~20 req/s/IP). `authRateLimit` (20/5min) is applied only to `/auth/*` (`index.ts:175-182`). On success it returns `customer: data` from `select('*')`, including `password_hash`.
- **Business impact:** Shopper-account brute force; hash disclosure enables offline cracking.
- **Fix complexity:** M. **Risk of change:** Med.

#### SEC-8 — CSRF protection mounted after public storefront mutations (VERIFIED, High)

- **Files:** `index.ts:193-194` (`authMiddleware`, `csrfProtection`) mount **after** the public storefront/themes/app-store routers (`:185-190`). Public mutations `POST /storefront/reviews` (`storefront.ts:3487`), `POST /:subdomain/contact` (`storefront.ts:3795`), and all `POST/PATCH/DELETE /customer/*` are uncovered. `csrfProtection` also bypasses on `Authorization: Bearer` and `X-LetBuyy-Internal-Signature` (`security.ts:251-259`).
- **Fix complexity:** M. **Risk of change:** Med.

#### SEC-9 — CSRF cookie-name contract is broken: `lb_csrf` vs `letbuyy_csrf` (VERIFIED, High)

- **Files:** identity issues/reads `lb_csrf` (`apps/identity-platform/src/lib/auth/cookies.ts:11`, `proxy.ts:43,50`, `lib/auth/csrf.ts:6,22`, mobile `store_auth_service.dart:86`); gateway reads `letbuyy_csrf` (`services/api-gateway/src/middleware/security.ts:261`, enforced `:264`). Root cause is a broader naming drift: CI even writes the internal secret under **both** `INTERNAL_API_SECRET` and `LETBUYY_INTERNAL_API_SECRET` (`production-deploy.yml:132-133`, MISSED-4).
- **Business impact:** Cross-app cookie-auth mutations from identity to gateway fail CSRF unless they fall through the Bearer/internal-signature bypass — meaning CSRF is effectively *off* for token traffic and *broken* for cookie traffic.
- **Fix complexity:** S. **Risk of change:** Med (must be coordinated across identity, gateway, mobile).

### 3.3 Verified Medium/Low

| ID | Finding | Verdict | Evidence | Sev | Fix / Risk |
|---|---|---|---|---|---|
| SEC-10 | CORS reflects any single-label `*.letbuyy.store` with `credentials:true` | VERIFIED | `index.ts:146,153` | Medium | S / Low |
| SEC-11 | `inputValidation` logs dangerous payloads but does not block; `sanitizeObject` exported-but-unused | VERIFIED | `security.ts:192-218` | Low-Med | M / Med |
| SEC-12 | Theme package upload has no signing/provenance; `private_install` mode skips review | PARTIALLY VERIFIED | `themes.ts:466,493` | Medium | M / Low |
| SEC-13 | `getSupabaseAdmin` has no `server-only`/`window` guard (runtime throw is an accidental net) | PARTIALLY VERIFIED | `packages/typescript/utils/src/supabase.ts:34-46` | Medium | S / Low |
| MISSED-3 | `AUTH_ERROR` not in sanitizer allowlist → raw Supabase auth messages leak on employee login/create | VERIFIED (missed) | `routes/employee.ts:60,126`; allowlist `security.ts:98-102` | Low | S / Low |
| MISSED-5 | GraphQL "cost" is a regex token-count heuristic, not AST depth/complexity; `query` up to 500k chars | VERIFIED (missed) | `graphql/cost.ts:82-107`; `graphql/storefront.ts:28` | Medium | M / Low |

### 3.4 FALSE POSITIVES — close these, do not work them

| Prior ID | Claim | Verdict | Why it is wrong |
|---|---|---|---|
| War-Room #9 / SEC-5 | Routes leak raw `error.message` via `DB_ERROR` | **FALSE POSITIVE** | `errorResponseSanitizer` (mounted globally `index.ts:116`, logic `security.ts:98-128`) overwrites the message for `DB_ERROR`/`INTERNAL_ERROR`/`PAYMENT_PROVIDER_ERROR` before the response leaves the worker. Residual leak is only `AUTH_ERROR` (MISSED-3), a different, narrower issue. |
| Deep-Audit SEC-7 / War-Room #11 | Operations routes are powerful with weak/absent auth | **FALSE POSITIVE (downgrade to hardening)** | `routes/operations.ts:56` applies `requireRoleCategory('ops')` + `requireSuperAdmin` (DB-backed `super_admin_allowlist`, `middleware/rbac.ts:30-53,103-141,194+`). Real residual gap is **no gateway-level MFA/step-up** — a hardening item, not "unguarded." |
| War-Room #12-13 / SEC-9,15 | App bridge fetch + OAuth need redirect/scope/SSRF tests before they're safe | **FALSE POSITIVE (already hardened)** | `packages/app-engine/src/index.ts:1326,1348` enforce scope-allowlist and HTTPS exact-match redirect URIs; `routes/app-store.ts:1234-1290` bridge is SSRF-hardened (rejects absolute URLs/`..`/`//`, forces gateway-origin + token store_id, read-only scope allowlist, token-hash recheck). Tests are still desirable, but the controls exist. |
| Both reports | Checkout client-total manipulation risk | **FALSE POSITIVE (architecture correct)** | Totals computed server-side in `create_checkout_order`; checkout functions are advisory only (`packages/app-engine/src/index.ts:377+` can set coupon/method/validation errors, not totals). |

### 3.5 Confirmed-solid (do not "fix")

- **WASM checkout-extension runtime** `services/api-gateway/src/extensions/app-functions-runtime.ts`: WASM-only, SHA-256 module pin verified before compile (`:137-152`), instantiated with an **empty import object** (`:203`) so guest code gets no host/network/syscalls, bounded 1–5s timeout, 64KB output cap, fail-closed (`:325-378`). This is a real sandbox.
- **Liquid renderer** is implemented (see PROD section) — not a security gap.

---

## 4. Cost

All cost findings are write-amplification or redundant-round-trip in nature. The first bottleneck is **Supabase OLTP**, not Cloudflare request pricing — both prior reports got this right, and this review strengthens it with the GraphQL fan-out multiplier they missed.

| ID | Finding | Verdict | Files / functions / path | Sev | Business impact | Technical impact | Fix / Risk |
|---|---|---|---|---|---|---|---|
| COST-1 | `worker_request_logs` insert on **every** request, unsampled | VERIFIED | `middleware/observability.ts:97-127` (in `waitUntil`) → `execution/observability-execution.adapter.ts:51-71` | High | Supabase storage+IOPS scale with all traffic, including anonymous storefront hits | One row/request; off critical path but unbounded | M / Low |
| COST-2 | Cron `*/1 * * * *` in all environments | VERIFIED | `services/api-gateway/wrangler.toml:20,90,181` | Medium | Background spend with zero merchants | 43,200 invocations/env/month before traffic | S / Low |
| COST-3 | Scheduled dispatch **always** enqueues completion event and **always** drains DB queues | VERIFIED | `index.ts:305-323` (`eventQueue?.enqueue(...)`, `queue.consumeQueues(...,50)`) | Medium | Idle system still does queue work | Completion event → CF queue ops → queue-worker invocation → DB writes | S / Low |
| COST-4 | `head_sampling_rate = 1` + `invocation_logs = true` on both Workers | VERIFIED | `api-gateway/wrangler.toml:10-17,80-87,171-178`; `queue-workers/wrangler.toml:10-17,99-107,196-201` | Medium | 100% log retention cost | No sampling | S / Low |
| COST-5 | Queue worker does **3** DB writes per message (not 2) | VERIFIED (worse than reported) | `queue-workers/src/index.ts:62` upsert + `:86` metric + `:107` lag metric | High | DB write volume tracks queue throughput ×3 | `distributed_queue_messages` + 2× `runtime_telemetry_metrics` | M / Med |
| COST-6 | One CF queue message drains 3 DB queues | VERIFIED | `platform-queue-consumer.ts:165` (`['analytics-events','search-indexing','payment-events']`), `:184-196,233` | High | Fan-out multiplies claim RPCs | 3 `claim_platform_queue_jobs` RPC round-trips/message | M / Med |
| COST-7 | Queue retries 6–10 + concurrency to 25 | VERIFIED | `queue-workers/wrangler.toml:217-267` | Medium | Retry storms multiply ops during incidents | Poison messages amplify writes | S / Low |
| COST-8 | **Two** rate limiters per authenticated request, each KV/Redis read+write | VERIFIED (worse than reported) | `index.ts:168` (`queryCostRateLimit`) + `:195` (`rateLimit({max:300})`); KV `rateLimit.ts:203-207,328-333`; Redis `:369-404` | High | KV write cost on every API call (KV writes ~$5/M) | 2×(read+write) per request; 3× for Admin GraphQL (MISSED) | M / Med |
| MISSED-6 | GraphQL resolver fan-out re-enters full middleware per field → 10+ `worker_request_logs` + 20+ KV ops per query | VERIFIED (missed) | `graphql/admin.ts:555-564` (up to 10 connection fields) via `app.fetch` delegate `index.ts:171`; no internal-subrequest bypass in `observability.ts` | High | A single GraphQL query can 10× the per-request cost | Each sub-request logs + double rate-limits | M / Med |
| MISSED-7 | Bulk operations double-processed (queue **and** `waitUntil`), no consumer handler | VERIFIED (missed) | `graphql/bulk.ts:513` enqueue + `:520` `waitUntil(processGraphQLBulkOperation)`; no `graphql-bulk` handler in `queue-workers/src` | High | Redundant queue writes that do no useful work; per-row full GraphQL request | `executeBulkMutation:349-375` loops a full HTTP request per input row | L / Med |
| MISSED-8 | Bulk op state = read-modify-write JSON in R2 + full actor-index rewrite per transition | VERIFIED (missed) | `graphql/bulk.ts:174-203` | Medium | Multiple R2 GET+PUT per op; last-writer-wins races | Index rewrite capped at 50 | M / Low |
| MISSED-9 | Admin GraphQL adds a **third** rate-limit round-trip | VERIFIED (missed) | `graphql/admin.ts:660`, `graphql/storefront.ts:589` (in addition to `index.ts:168,195`) | Medium | 3× KV/Redis ops before any field resolves | — | S / Low |
| COST-13 | Hyperdrive binding paid-for but **completely unused** | VERIFIED | `api-gateway/wrangler.toml:139-141,230-232`; `HYPERDRIVE` never referenced in `services/api-gateway/src`; all DB via PostgREST (`packages/infrastructure/supabase-adapter/index.ts:59-79`) | High | Paying for an idle pooled-connection product while suffering per-query HTTP overhead | Migrating reads to Hyperdrive/pooled SQL is the single biggest latency+cost lever | L / High |

---

## 5. Performance

| ID | Finding | Verdict | Files / functions | Sev | Technical impact | Fix / Risk |
|---|---|---|---|---|---|---|
| PERF-1 | No Cache API anywhere; REST storefront uncached | VERIFIED | zero `caches.default` in `services/api-gateway/src`; `storefront.ts:548` `loadPublishedStore`, `:636` `loadCurrentThemeRelease`, `:827` `queryPublicProducts` | High | Every storefront read hits Supabase PostgREST. Nuance: GraphQL storefront sets `Cache-Control` (`graphql/storefront.ts:270-277`) but the live REST path does not. | L / Med |
| PERF-2 | Leading-wildcard `ilike '%term%'` (non-SARGable) | VERIFIED | `products.ts:155`, `orders.ts:268`, `app-store.ts:723`, `themes.ts:142`, `storefront.ts:847,1323`, `internal-console.ts:105` | Medium | Sequential scans as data grows | M / Low |
| PERF-3 | `select('*', { count: 'exact' })` on list endpoints | VERIFIED | `products.ts:148`, `orders.ts:257` (`*,order_items(*)`), `media.ts:39` (+ admin/stores/blog/coupons/inventory) | Medium | Full COUNT per list page | M / Low |
| PERF-4 | Analytics aggregates in worker memory from raw orders; orders route has **no date filter** | VERIFIED | `analytics.ts:29,39` (dashboard), `:60,74-86` (revenue), `:114,123-125` (all orders) | High | Unbounded row pulls into worker memory | L / Med |
| PERF-5 | Product `view_count` read-modify-write hot row with a race | VERIFIED (race is new detail) | `execution/product-execution.adapter.ts:228-234` `recordStorefrontView`, called `storefront.ts:2701` | High | Hot-row write on the busiest path; non-atomic increment loses writes under concurrency | M / Med |
| PERF-6 | Export `select('*')` with no limit, CSV built in worker memory | VERIFIED | `export.ts:113-119,176-184`; sync `createProduct` loop `:252-264` | High | OOM / CPU-limit risk on large catalogs | M / Med |
| PERF-7 | `replaceProductVariants` delete+reinsert + per-variant inventory RPC (N+1) | VERIFIED | `product-execution.adapter.ts:331-379`; `replaceProductOptions:314-328` | Medium | N+1 writes per product save | M / Med |
| MISSED-10 | GraphQL N+1: serial REST sub-requests per selected field | VERIFIED (missed) | `graphql/admin.ts:555-564` | High | Latency + cost scale with field count | M / Med |
| MISSED-11 | Bulk mutation issues a full GraphQL HTTP request per input row | VERIFIED (missed) | `graphql/bulk.ts:349-375` | High | K rows ≈ K full request cycles in one invocation; CPU/subrequest-limit risk | L / Med |
| PERF-8 | Theme editor boots via 3 separate fetches | VERIFIED | editor `page.tsx:671,696,697` | Medium | Multiple round-trips on editor load | S / Low |
| PERF-9 | Checkout critical path runs GST invoice + usage + events synchronously | VERIFIED | `storefront.ts:1566`; `order-execution.adapter.ts:142,210` | Medium | Checkout latency coupled to non-essential work | M / Med |

---

## 6. Scalability

| ID | Finding | Verdict | Files / path | Sev | Technical impact | Fix / Risk |
|---|---|---|---|---|---|---|
| SCALE-1 | Hot OLTP tables have **no partitioning and no retention/purge** | VERIFIED (with correction) | `database/supabase/migrations/000_baseline.sql`: zero `PARTITION BY`; `worker_request_logs:13112`, `runtime_telemetry_metrics:11592`, `outbox_events:1215`, `platform_queue_jobs:1291`, `webhook_deliveries:1361`; no DELETE/purge job anywhere | High | Unbounded growth on the commerce primary | L / Med |
| — | Sub-claim "these tables lack `created_at` indexes" | **FALSE POSITIVE** | Each has a composite `(…, created_at)` index (`idx_worker_request_logs_site_created:19009`, `idx_runtime_telemetry_metrics_created:18218`, `idx_outbox_events_status_available:17644`, `idx_platform_queue_jobs_claim:17805`, `idx_webhook_deliveries_claim:18939`) | — | Don't add indexes that already exist | — |
| SCALE-2 | All DB access is PostgREST-over-HTTP; Hyperdrive idle | VERIFIED | `packages/infrastructure/supabase-adapter/index.ts:2,59-79`; `HYPERDRIVE` unused | High | Per-query HTTP overhead caps read throughput; the scaling lever is sitting unused | L / High |
| SCALE-3 | Dual JSONB + relational sources of truth (orders, products) | VERIFIED | `000_baseline.sql`: `orders.items jsonb:10119` + `order_items:10003`; `products.variants jsonb:10583` + `product_variants:10501`; RPC writes both | Medium | Read paths can diverge; reporting/fulfillment drift | L / High |
| SCALE-4 | Analytics + public search run on OLTP, not projections/index | VERIFIED | `analytics.ts:*`; `ilike` search paths | Medium | Read pressure on commerce primary | L / Med |
| MISSED-12 | Entire WS11–WS13 stack (GraphQL, extensions, WASM checkout fns, Liquid) is built, wired into `index.ts`, locally test-green, but **never deployed/proven** | VERIFIED (missed) | `CODEX_WS11/12/13_STATUS.md` ("AWAITING HUMAN DEPLOYED STAGING PROOF"); code in `services/api-gateway/src/graphql/*`, `extensions/*` | High | Production pipeline (INFRA-1) could ship ~4,000 lines of environment-unproven code | — / High |
| MISSED-13 | `stores` is a **VIEW** over `sites`, not a table | VERIFIED (missed) | `000_baseline.sql:11950` (`CREATE TABLE sites`), `:12240` (`CREATE VIEW stores`) | Low-Med | Writes to `stores` hit a non-updatable-by-default view unless INSTEAD-OF triggers exist | S / Low |

---

## 7. Infrastructure

| ID | Finding | Verdict | Files | Sev | Impact | Fix / Risk |
|---|---|---|---|---|---|---|
| INFRA-1 | Production deploy can silently skip migrations/worker/app jobs; plain `needs:` + no `if: always()` means skipped steps look green | VERIFIED | `.github/workflows/production-deploy.yml:19-21,84,90,117,174,217,245,250` | High | A "green" deploy can ship code with migrations/deploys skipped; smoke runs against an un-updated prod | M / Med |
| INFRA-2 | Worker secrets set **after** `wrangler deploy` (revision/secret race) | VERIFIED | `production-deploy.yml:118` deploy vs `:127-141` secrets; webhook `:149/:158` | Med-High | New revision serves with missing/stale secrets on first deploy | S / Low |
| INFRA-3 | `apps/developer-portal` absent from deploy matrix but **declared in production topology** | VERIFIED | matrix `production-deploy.yml:184-200`; topology `config/runtime/production-topology.json:441`, `deployment-topology.json:158` | Medium (High as drift) | Documented production runtime never deploys; topology vs pipeline disagree | S / Low |
| INFRA-4 | `supabase db push --include-all` with no diff/backup/rollback | VERIFIED | `production-deploy.yml:85` | High | Force-applies all pending migrations to prod with no restore point | M / Med |
| INFRA-5 | Six reserved service roots are manifest-only stubs | VERIFIED (by design) | `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}` (no `src/`) | Low | Operators may overestimate maturity | S / Low |
| INFRA-6 | Governance fails on stale artifacts | PARTIALLY VERIFIED | `scripts/validators/stale-artifact-validator.mjs`; `.gitignore:102-124` | Low-Med | **Corrected:** nothing is committed to git; validator only fails a locally-built tree (untracked `.next`/`dist`/`.wrangler`). CI hygiene, not a code defect. | S / Low |
| MISSED-4 | Internal secret written under two names (`INTERNAL_API_SECRET` + `LETBUYY_INTERNAL_API_SECRET`) | VERIFIED (missed) | `production-deploy.yml:132-133` | Low | Root-cause smell behind the `lb_`/`letbuyy_` naming drift (SEC-9) | S / Low |

---

## 8. Product

| ID | Finding | Verdict | Files | Sev | Note |
|---|---|---|---|---|---|
| PROD-1 | Customer-account system is unsafe for launch | VERIFIED | SEC-1/2/3/7, MISSED-1/2 | Critical | The product-blocking cluster. |
| PROD-2 | "Liquid renderer is unsupported" | **FALSE POSITIVE** | `packages/theme-engine/src/theme-renderer.ts:1` imports `liquidjs`; `LiquidRenderer` class `:104-211` returns `status:'rendered'`; `CODEX_WS11_STATUS.md` 20/20 theme tests | — | **Both prior reports are stale here.** `status:'unsupported'` is only a no-bundle/missing-template fallback (`:112,126`). |
| MISSED-14 | Storefront GraphQL `cart` query returned `null` (known stub) | VERIFIED (missed), remediated to loud unsupported | `graphql/storefront.ts:524`; `CODEX_WS12_STATUS.md`; P4-2 | Medium | Current behavior returns `CART_NOT_SUPPORTED` until governed server-side cart persistence exists. |
| PROD-3 | Theme editor page selector hardcoded to "Home page" (fake dropdown) | VERIFIED | merchant editor `page.tsx:1131-1132` | Low-Med | No multi-template editing. |
| PROD-5 | Split API ownership: 115 app-local `route.ts` alongside the gateway | VERIFIED | `apps/*/src/app/api` (merchant 62, storefront 21, identity 18, app-mkt 8, console 4, theme-mkt 2) | Medium | Business logic split between edge and Next BFFs. |
| PROD-6 | Shopify depth gaps: markets, multi-currency, full tax engine, subscriptions, gift-card UI, abandoned cart, POS, metafields/metaobjects | VERIFIED | — | Roadmap | Not launch blockers for an India-first 100-merchant MVP. |

---

## 9. Technical Debt

| ID | Finding | Verdict | Files | Sev |
|---|---|---|---|---|
| DEBT-1 | Compatibility fallbacks mask migration drift (missing `deleted_at`/audit cols, missing `order_items`) | VERIFIED | `products.ts:41-58`, `orders.ts:52-65`, `theme-execution.adapter.ts:105-146` | Medium |
| DEBT-2 | `console.error`/`console.warn` in production source (39 occurrences) | VERIFIED | `services/api-gateway/src` (15), `apps/identity-platform/src` (24) | Low |
| DEBT-3 | `as any` casts on idempotency replay return path | VERIFIED | `orders.ts:355,403,464,510,555`; `inventory.ts:355,401,469,536`; `storefront.ts:1714,1891,2001,2129,2248,2364,2470,2579` | Low |
| DEBT-4 | Dual JSONB/relational models (= SCALE-3) | VERIFIED | as above | Medium |
| DEBT-5 | Reserved service roots can be mistaken for deployable (= INFRA-5) | VERIFIED | as above | Low |

---

## 10. Verification Ledger (every prior finding, one row each)

| Source | Prior finding | Verdict |
|---|---|---|
| Deep-Audit SEC-1 / War-Room #1 | Public customer password mutation | **VERIFIED (Critical)** |
| Deep-Audit SEC-2 / War-Room #2,3 | Public customer order/contact history | **VERIFIED (Critical)** |
| Deep-Audit SEC-3 / War-Room #4,5 | Customer enumeration by-email/status | **VERIFIED (Critical→High)** |
| War-Room #8 | Identity set-password trusts userId/email | **VERIFIED (Critical)** |
| War-Room #6 | Customer login no brute-force limiter | **VERIFIED (High)** |
| Deep-Audit SEC-4 | CSRF not covering public storefront mutations | **VERIFIED (High)** |
| Deep-Audit SEC-11 / War-Room #25 | CSRF cookie-name mismatch | **VERIFIED (High)** |
| War-Room #10 | CORS credentialed wildcard | **VERIFIED (Medium)** |
| Deep-Audit SEC-5 / War-Room #9 | inputValidation logs but does not block | **VERIFIED (Low-Med)** |
| Deep-Audit SEC-6 / War-Room #—  | Raw `DB_ERROR` message leak | **FALSE POSITIVE** (sanitizer scrubs it) |
| Deep-Audit SEC-7 / War-Room #11 | Operations routes unguarded | **FALSE POSITIVE** (RBAC present; residual = no MFA) |
| Deep-Audit SEC-9/15 / War-Room #12,13 | App bridge/OAuth unsafe | **FALSE POSITIVE** (SSRF + redirect/scope hardened) |
| Deep-Audit SEC-8 | Service-role client importable by client bundle | **PARTIALLY VERIFIED** (no guard; runtime throw) |
| Deep-Audit SEC-9 / War-Room #14 | Theme package no provenance | **PARTIALLY VERIFIED** |
| Both | Checkout client-total manipulation | **FALSE POSITIVE** (server-side recompute) |
| Both | Webhook verification missing | **FALSE POSITIVE / stale** (Razorpay/Stripe/PayPal/Cashfree verified in `webhook-service`) |
| Deep-Audit Perf #1 / War-Room #24 | Per-request request-log write | **VERIFIED (High)** |
| War-Room #22 | Cron every minute | **VERIFIED (Medium)** |
| War-Room #23 | Always-enqueue completion event | **VERIFIED (Medium)** |
| War-Room #20,21 | Full log sampling | **VERIFIED (Medium)** |
| War-Room #26 | Queue worker per-message DB writes | **VERIFIED (High; 3 not 2)** |
| War-Room #27,28 | Queue fan-out + concurrency | **VERIFIED (High)** |
| War-Room #56,57 | KV/Redis rate-limit read+write | **VERIFIED (High; 2× limiters)** |
| War-Room #29-38 / Perf table | Uncached storefront reads | **VERIFIED (High; REST only)** |
| War-Room #33,34,87 | Exact-count list endpoints | **VERIFIED (Medium)** |
| War-Room #35,36,42-44 | OLTP analytics | **VERIFIED (High)** |
| Perf #7 | Product view-count hot row | **VERIFIED (High; race)** |
| War-Room #45,46 | Sync CSV export | **VERIFIED (High)** |
| War-Room #63 / Deep-Audit | No partition/retention on hot tables | **VERIFIED (High)** — but "no created_at index" sub-claim **FALSE POSITIVE** |
| Deep-Audit Perf #42 | Hyperdrive unused | **VERIFIED (High)** |
| War-Room #17,18,19 | Deploy skip / secret race / dev-portal gap | **VERIFIED (High / Med-High / Medium)** |
| War-Room #67 | db push no diff/backup | **VERIFIED (High)** |
| Both | Reserved service roots source-light | **VERIFIED (Low; by design)** |
| Both | Governance fails on artifacts | **PARTIALLY VERIFIED** (nothing committed; local-build only) |
| War-Room #44,45 / DEBT | Dual JSONB/relational models | **VERIFIED (Medium)** |
| War-Room #41 / Deep-Audit | Liquid renderer unsupported | **FALSE POSITIVE** (now implemented, WS11) |
| War-Room #40 | Theme editor home-page only | **VERIFIED (Low-Med)** |
| War-Room #43 | Split API ownership | **VERIFIED (Medium)** |
| War-Room #75,77 | `any` casts / console logs | **VERIFIED (Low)** |

**Net-new (missed by both):** MISSED-1 (Critical IDOR), MISSED-2 (High GraphQL 2nd path), MISSED-3 (AUTH_ERROR leak), MISSED-4 (secret dual-naming), MISSED-5 (GraphQL cost heuristic), MISSED-6 (GraphQL log fan-out), MISSED-7 (bulk double-process), MISSED-8 (bulk R2 RMW), MISSED-9 (3rd rate-limit), MISSED-10 (GraphQL N+1), MISSED-11 (bulk per-row request), MISSED-12 (undeployed WS11-13 stack), MISSED-13 (`stores` view), MISSED-14 (GraphQL `cart` null).

---

## 11. Priority Routing → Master Plans

| Priority | Theme | Document |
|---|---|---|
| P0 | Security — customer-auth kill chain, set-password, CSRF, release gates that protect security | `P0_SECURITY_MASTER.md` |
| P1 | Cost — write amplification, GraphQL fan-out, Hyperdrive, log sampling | `P1_COST_MASTER.md` |
| P2 | Performance — edge cache, hot-row counter, N+1, exact counts, exports | `P2_PERFORMANCE_MASTER.md` |
| P3 | Scalability — partitioning/retention, pooled SQL, projections, dual-model consolidation, deploy WS11-13 safely | `P3_SCALABILITY_MASTER.md` |
| P4 | Product — multi-template themes, GraphQL cart, API-ownership consolidation, Shopify-depth roadmap | `P4_PRODUCT_MASTER.md` |
| ALL | Ordered, dependency-aware execution for Codex | `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` |

---

## 12. Final Architect Position

Both prior reports reached the right top-line answer — do not launch — for partly the wrong reasons. This review's corrections matter for where engineering time goes:

1. **Stop** work framed around "implement Liquid," "guard operations routes," "fix DB_ERROR leaks," and "harden the app bridge." Those are done or were never broken.
2. **Start** with the customer-authorization collapse as a *single* design problem: introduce one signed customer-session primitive, enforce it at the **gateway** (not the Next app), and route every customer read/write — REST and GraphQL — through it. `verifyStoreCustomer` must authenticate, not merely confirm existence.
3. **Gate** the release pipeline so it cannot ship the substantial, environment-unproven WS11–WS13 code untested, and cannot report green while skipping migrations or deploys.
4. **Then** attack economics: the GraphQL fan-out, the unused Hyperdrive, and per-request OLTP logging are the three levers that most change the cost curve before 1,000 merchants.

The platform's core commerce loop — signup → store → product → theme → storefront → cart → checkout → payment → order → customer — is architecturally sound and, with the P0 cluster closed, safe for a controlled 100-merchant India-first beta. It is not Shopify, and it should not be marketed as such until the depth roadmap in P4 is real. The disciplined boundary model remains LetBuyy's most valuable asset; the job now is to make the runtime as honest as the architecture.

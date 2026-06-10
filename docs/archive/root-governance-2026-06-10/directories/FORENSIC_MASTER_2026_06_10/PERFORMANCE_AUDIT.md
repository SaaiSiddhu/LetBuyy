# PHASE 11 — PERFORMANCE AUDIT

**Repo:** `Letbuyy_Store` | **Audit date:** 2026-06-10
**Auditor:** Principal performance engineer, code-only working-tree analysis (no profiler, no live traffic)
**Scope:** `services/api-gateway`, `services/mobile-bff`, `services/queue-workers`, `packages/infrastructure/{supabase-adapter,pooled-sql-adapter}`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/mobile/merchant-app`, `services/*/wrangler.toml`
**Cross-links:** Phase 7 `DATABASE_FORENSIC_AUDIT.md` (Missing-Index Register §7, slow-query feeders), Phase 1 `REPO_TOPOLOGY_AUDIT.md` / `ACTIVE_DEPLOYMENT_TOPOLOGY.md`, Phase 5 `CHECKOUT_FORENSIC_AUDIT.md` (stale-reservation sweeper not scheduled)

---

## 0. Methodology & Scale-Envelope Framing

This audit reads source and configuration; it runs no profiler and replays no traffic. Latency and query-count figures are **estimates derived from counting the DB round-trips, external `fetch()`s, and loop iterations visible in the code**. Where a claim can only be settled by runtime measurement (real p95, real connection counts under load, real bundle bytes after tree-shaking), it is marked **UNVERIFIED**.

**The envelope is the V1 envelope, not Shopify's.** V1 targets 100 → 1,000 → 10,000 merchants and ~30,000 orders/month (≈1,000 orders/day, ≈40/hour at flat load, call it a few hundred/hour at peak). At that scale, raw row counts are *trivial for Postgres* — a single store's product table is hundreds to low-thousands of rows, the platform-wide `orders` table at a year of operation is ~360k rows. **I therefore do NOT flag**: lack of partitioning, lack of read replicas, lack of sharding, OFFSET pagination on a 500-row product list, or a `COUNT(*)` over a few-hundred-row tenant slice. **I DO flag**:

1. Anything that hurts **buyer-facing storefront latency now** (conversion-critical, every page view, every visitor — the storefront is the only path with real concurrency).
2. **Per-request fan-out / N+1** that multiplies a single user action into many serial network round-trips — this hurts at 100 merchants just as much as 10,000, because it is a *per-action* tax, not a *data-volume* tax.
3. Things that **degrade as the platform fills toward 10k merchants / 360k+ orders**: unbounded table growth (reservations never swept), full-table scans on cross-tenant relay queries, leading-wildcard `LIKE` that can never index, live aggregates that should be rollups.
4. **Worker-tier serial processing** that caps throughput and lengthens the analytics/notification pipeline tail.

**Architectural fact that dominates this entire audit:** the primary data path is **`@supabase/supabase-js` over PostgREST/HTTPS**, not a raw Postgres connection (`packages/infrastructure/supabase-adapter/index.ts:34-49` — `createClient(url, key)`). Every `db.from(...)` / `db.rpc(...)` is an **HTTP request** to the Supabase PostgREST endpoint, with TLS + PostgREST planning overhead on top of the SQL. So a "round-trip" here is not a 1ms intra-datacenter Postgres query — it is an **edge-Worker → PostgREST HTTPS call**, realistically 20–120ms each depending on region/cold path. **This makes round-trip *count* — not row count — the dominant performance variable on this platform.** Hyperdrive (TCP pooling) is configured but, as shown in §9, only helps the one route family that uses the raw-SQL adapter.

---

## 1. Executive Verdict

**Performance posture: better than the rest of this codebase, with two structural taxes that bite at the envelope.** The storefront read path is genuinely well-engineered for a buyer-facing surface — it is server-rendered (Next.js ISR, `revalidate=30/60`), wrapped in a real Cloudflare Cache-API + KV-versioned cache layer at the Worker (`lib/storefront-cache.ts`), backed by a Next.js Data Cache, and its list/detail handlers **batch** variant and order-item hydration with `.in(...)` rather than looping (`storefront.ts:491`). There is no client-side waterfall on the buyer's first paint, and images are configured for AVIF/WebP with sane device sizes. For the V1 envelope, the storefront will be fast **on cache hit**.

The two taxes:

**(A) The PostgREST round-trip tax × the missing composite-endpoint tier.** Because every query is an HTTPS call, and because `mobile-bff` is a **305-line pass-through proxy** (`services/mobile-bff/src/index.ts:302` — `app.all('/v1/*', proxyToGateway)`) with **zero composite/fan-in endpoints**, the dashboard fan-out the BFF was meant to collapse is fully present. The **mobile** merchant dashboard issues **~7 sequential network round-trips** to render one home screen (`analytics_service.dart:357-409` makes 5 sequential analytics calls alone — *not* `Future.wait`-batched), and the **web** dashboard issues ~6–8 (`merchant-control-plane/.../dashboard/page.tsx:107-108,129-200`). Each round-trip is BFF/SSR → gateway → PostgREST → Postgres. This is the single worst latency pattern in the product, and it is *exactly* what `mobile-bff` exists on the topology map to fix.

**(B) Worker-tier serial processing + a 15-minute pull drain + an unscheduled sweeper.** The platform-queue consumer processes claimed jobs in a **serial `for` loop** (`platform-queue-consumer.ts:380`), and an `order.created` analytics job fans out into a **per-rollup and per-line-item RPC loop** (`:486-499,513-535`) — 15–30 serial PostgREST writes to process one order's analytics. The pull-based drain runs on a **15-minute** cron (`api-gateway/wrangler.toml` `env.production.triggers` `*/15`, downgraded from `*/1` to save free-tier invocations), and the queue-workers maintenance cron runs **every 6 hours** (`queue-workers/wrangler.toml:20` `17 */6 * * *`). The stale-inventory-reservation sweeper (`expire_inventory_reservations`, migration `141:304`) **exists but is wired to no schedule** — confirming Phase 5 — so `inventory_reservations` grows unbounded and every checkout's reservation logic scans an ever-larger table.

Nothing here is an outage at 100 merchants. (A) is a *now* problem for perceived latency (multi-second dashboard loads on mobile networks). (B) is a *fills-up* problem (analytics/notification lag measured in minutes; reservation-table bloat measured in months). Net: the storefront is the strong point; the merchant/operator control surfaces and the async pipeline carry the debt.

**Composite performance verdict: 3.0/5** — strong cacheable storefront, undermined by a missing composite-endpoint tier (dashboard fan-out) and serial worker processing on a slow drain cadence.

---

## 2. N+1 / Round-Trip Fan-Out Register

> "Round-trip" = one Worker→PostgREST HTTPS call (≈20–120ms) **or** one app→BFF→gateway hop (≈50–400ms over mobile). Counts are per single user action.

| ID | Endpoint / action | Round-trips (est.) | Pattern | Evidence (file:line) |
|---|---|---|---|---|
| **PERF-001** | **Mobile merchant dashboard home** | **~7 sequential** | `_loadStore` awaits `ensureSelectedStore()` → `getStoreAnalytics()` → `fetchPayoutSummary()` **sequentially**, and `getStoreAnalytics` itself fires **5 sequential** analytics calls (`dashboard`, `orders`, `revenue`, top-products, `trafficSources`) — none in `Future.wait`. Each traverses BFF pass-through → gateway → PostgREST. | `apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart:50-98`; `apps/mobile/merchant-app/lib/services/analytics_service.dart:357-409 (366,367,368,369,376)` |
| **PERF-002** | **Web merchant dashboard home (SSR)** | **~6–8** (2 sequential groups) | `loadSetupStatus` (2 calls, `Promise.all`) then **sequentially** `loadDashboardHomeData` (4 calls, `Promise.all`), preceded by `getSessionUser` + `getStoreForUser`. Two groups are serial (`:107` then `:108`); each leaf call is a full gateway request with its own auth + DB. | `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:79,83,107-108,129-132,182-200` |
| **PERF-003** | **`mobile-bff` provides NO composite endpoints** (root cause of 001/002) | n/a | The BFF only signs a session header and proxies 1:1 (`app.all('/v1/*', proxyToGateway)`). It does not exist as a fan-in tier, so the N calls above are not collapsed for mobile. Topology says BFF should kill dashboard N+1; it is a stub. | `services/mobile-bff/src/index.ts:237-303 (302)` |
| **PERF-004** | **Checkout: store re-resolved on every step** | +1 per step (×3) | `loadPublishedStore` is called fresh in **each** public checkout/payment route — order create (`:248`), razorpay order (`:421`), razorpay verify (`:541`), plus capture/COD/etc (`:663,783,908,1013,1115`). A 3-step checkout (create→pay→verify) re-runs the store-resolution waterfall 3×; cache mitigates only on the GET-cached routes, **not** these POSTs. | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:248,421,541,663,783,908,1013,1115` |
| **PERF-005** | **Analytics worker: per-rollup RPC loop** | **N rollups, serial** | `processAnalyticsJob` upserts the event then loops `planAnalyticsRollupIncrements(...)` calling `await this.incrementRollup(rollup)` **once per rollup dimension** (daily/source/device/etc.). Each `incrementRollup` is a separate `increment_analytics_rollup` RPC (`:988`). | `services/queue-workers/src/platform-queue-consumer.ts:486-495,988` |
| **PERF-006** | **Analytics worker: per-line-item rollup loop on `order.created`** | **+1 read + M items serial** | For `order.created` it reads `order_items` (1 query, `:514`) then loops `planOrderItemAnalyticsRollupIncrements(...)` → `await incrementRollup` **per line item** (`:523`). A 10-line order ⇒ ~10 more serial RPCs on top of PERF-005. One order event ⇒ **15–30 serial PostgREST writes**. | `services/queue-workers/src/platform-queue-consumer.ts:513-535` |
| **PERF-007** | **Platform-queue jobs processed serially per batch** | up to 25 serial cycles | `consumeQueue` claims ≤25 jobs (`PLATFORM_QUEUE_CLAIM_LIMIT` default 25, `:209`) and processes them in a **serial `for` loop** (`:380`), each job doing process + `completeJob` RPC (+ fail/quarantine). No `Promise.all` / bounded concurrency. | `services/queue-workers/src/platform-queue-consumer.ts:209,367-407` |
| **PERF-008** | **Queue `queue()` handler runs 7 processors serially per batch** | 7 serial stages | Each Cloudflare-queue batch runs `persistQueueBatch` → `recordQueueBatchMetric` → platform drain → `dispatchEmailDeliveries` → risk → review → support → compliance → executive-analytics → incident — **all sequential `await`** (`:450-479`). A slow stage stalls the whole batch and delays `ack()`. | `services/queue-workers/src/index.ts:450-481` |
| **PERF-009** | **Email dispatch loops `sendResendEmail` serially** | N emails serial | `dispatchEmailDeliveries` iterates deliveries and `await sendResendEmail(...)` **inside the loop** (`:372,390`). A batch with K confirmation emails ⇒ K sequential external HTTPS calls before the batch can ack; one slow/timeout blocks all. | `services/queue-workers/src/index.ts:371-411` |
| **PERF-010** | **GST invoice post-commit: 2 serial lookups** | +2 (deferred) | `generateAndPersistGstInvoice` reads `orders` then `sites` sequentially (`:224-242`) before computing the invoice, plus a persist. Correctly deferred to `waitUntil` when `CHECKOUT_POSTCOMMIT_DEFERRAL=on`, so it is off the buyer's critical path — but it is 3 extra PostgREST calls per order in the background. | `services/api-gateway/src/execution/order-execution.adapter.ts:223-300` |
| **PERF-011** | **Store-resolution PostgREST fallback waterfall** | up to **5 serial** on miss | When pooled-SQL is off/empty, `loadSiteByHandle` tries up to **5** `.single()` selects in sequence with progressively looser column sets (`STOREFRONT_SITE_RELEASE_SELECT` → compat → site → compat → no-deleted-filter). On a published store the first usually wins; on schema-shape mismatch it walks all 5. | `services/api-gateway/src/routes/storefront.ts:783-829` |

**N+1 headline.** The classic "fetch list then per-row detail" N+1 is **largely absent** — the storefront list path batches variants (`storefront.ts:491-528`) and order-items (`:530-568`) with `.in(...)`, and order creation is a **single `create_checkout_order` RPC** (`order-execution.adapter.ts:151`), not per-item Worker queries. The N+1 that actually exists here is **fan-out N+1 at the application/BFF tier** (PERF-001/002/003) and **serial loop N+1 in the worker analytics pipeline** (PERF-005/006). The worst single N+1 is **PERF-001** (mobile dashboard, ~7 serial network round-trips) because it is buyer-of-the-product-facing, on mobile latency, and is precisely the thing the (stubbed) BFF was chartered to eliminate.

---

## 3. Missing-Index-on-Hot-Path Register (cross-linked to Phase 7 §7)

Cross-referencing Phase 7's Missing-Index Register against the **actual** WHERE/JOIN/ORDER BY columns on the hot endpoints found above:

| ID | Hot query (file:line) | Predicate / sort | Index present? | Phase 7 link | Sev |
|---|---|---|---|---|---|
| **PERF-012** | Storefront product list — pooled SQL (`storefront.ts:715-720`) | `WHERE store_id=$1 AND is_active=true AND deleted_at IS NULL [AND category=… AND name ILIKE %…%] ORDER BY display_order` | **Needs verification of `products(store_id, is_active, display_order)` composite.** Phase 7 confirms tenant+status indexes exist on new-kernel tables but flags that legacy `products` indexing is not enumerated. `ORDER BY display_order` without a matching composite ⇒ sort step. | Phase 7 §7.1 (legacy product indexing not in the FORCE/index set); §13 products usage | S2 (UNVERIFIED) |
| **PERF-013** | Storefront product list — `name ILIKE '%search%'` (`storefront.ts:700-702`; merchant `products.ts:480`; customers `customers.ts:508`) | leading-wildcard `ILIKE '%x%'` | **Un-indexable by btree.** No `pg_trgm` GIN seen for these. Full scan of the tenant slice on every text search. Bounded per-tenant now; degrades as catalogs/customers grow. | not in Phase 7 (Phase 7 covers FK/unique indexes, not LIKE) — **new finding** | S2 |
| **PERF-014** | Storefront search via `search_documents` (`storefront.ts:597-619`) | `.textSearch('search_vector', …, websearch)` + `count: 'exact'` | Requires a **GIN on `search_vector`**. Phase 7 §6 lists `search_documents` as live (written by the search-indexing worker, `platform-queue-consumer.ts:938-977`) but its GIN is not enumerated. `count:'exact'` adds a COUNT per paginated search. | Phase 7 §6.1 search_documents present; GIN UNVERIFIED | S2 (UNVERIFIED) |
| **PERF-015** | Storefront store lookup (`storefront.ts:643,655`) | `WHERE (subdomain=$1 OR store_name=$1) AND status='published' AND deleted_at IS NULL` | The `OR` on two columns defeats a single composite index; needs an index on **each** of `subdomain` and `store_name` (partial `WHERE status='published'`). On **every** storefront request that misses cache. | Phase 7 lists `sites` but not subdomain/store_name index coverage | S2 (UNVERIFIED) |
| **PERF-016** | Merchant orders list (`orders.ts:568-590`) | `WHERE store_id IN (…) [filters] ORDER BY created_at` + optional `count:'exact'` | Needs `orders(store_id, created_at)`. Phase 7 confirms `orders` carries CHECKs and tenant columns but **no FK to sites** (CI-1/DB-015) and enumerates money-join gaps, not this list index. | Phase 7 CI-1, DB-029 (money joins), §13 | S2 (UNVERIFIED) |
| **PERF-017** | Analytics overview live counts (`analytics.ts:282-284`) | `products` and `customers` `count:'exact', head:true` per dashboard load | Two live `COUNT(*)`; the **`customers` table does not exist in the migration chain** (Phase 7 DB-001 / CI-8) — this count either errors or hits out-of-band schema. | **Phase 7 DB-001, CI-8 (directly)** | S1 |
| **PERF-018** | Money/settlement joins reached by payout/commission dashboards (`payouts.ts`, `commission.ts`) | join on `settlement_id` / `payout_statement_id` | **Missing** per Phase 7 MI-1/MI-3/MI-4/MI-5/MI-8/DB-029 (composite tenant+FK indexes absent). Low volume now; seq-scans at 10k-merchant settlement volume. | **Phase 7 MI-1,3,4,5,8; DB-029 (directly)** | S2 |

**Index headline.** Phase 7's index register is dominated by **money-join FK gaps** (settlement/payout/commission), which are correct findings but cold-ish paths at the envelope (settlements run on a cadence, not per page view). The **hotter** index risks for *this* audit are on the storefront read path — `sites(subdomain|store_name)` (every uncached storefront hit, PERF-015), `products(store_id,is_active,display_order)` (every product list, PERF-012), and the leading-wildcard `ILIKE` searches (PERF-013) — and these are **not** in Phase 7's register because Phase 7 scoped to FK/unique indexes. Most are **UNVERIFIED** from migrations alone because the legacy `products`/`sites` index set lives inside the 28k-line `000_baseline.sql` pg_dump and was not enumerated; they should be `EXPLAIN`-checked against the live DB.

---

## 4. Slow-Query-Shape Register

| ID | Shape | Where | Why it matters at the envelope | Sev |
|---|---|---|---|---|
| **PERF-019** | **`SELECT *` on the wide `products` table** | product-detail fallback when relational reads off: `.select('*')` (`public-routes.ts:824`); pooled `PRODUCT_SELECT_FULL` returns the full column list | `products` is a wide JSONB-carrying table (variants/images/metadata embedded per DUP-7). `SELECT *` ships the JSONB blobs over PostgREST for every product detail. Cache mitigates, but the producer on a MISS pays it. | S3 |
| **PERF-020** | **`count: 'exact'` per request** | orders (`orders.ts:569`), products (`products.ts:473`), drafts (`orders.ts:644`), analytics overview (`analytics.ts:283-284`), search (`storefront.ts:609`) | Each `count:'exact'` is a second aggregate pass. Per-tenant slices are small now; the analytics-overview `products`+`customers` exact counts (PERF-017) run on **every** dashboard load and one targets a non-existent table. Prefer `count:'planned'`/`estimated` or cache the count. | S2 |
| **PERF-021** | **OFFSET pagination** (`.range(offset,…)` and `LIMIT/OFFSET`) | orders (`orders.ts:590`), products (`products.ts:492`), pooled product query (`storefront.ts:705-720`), drafts (`orders.ts:648`) | OFFSET re-scans skipped rows. Fine for page 1–5 of a tenant list (the cursor path `limit+1` exists for orders, `orders.ts:589`). Deep pages on a large catalog degrade; envelope keeps this low. The storefront product list uses OFFSET (`:705`) even though it is buyer-facing and paginatable. | S3 |
| **PERF-022** | **`COUNT(*) OVER()` windowed total on every paginated storefront product page** | pooled product query: `, count(*) over() as __total_count` (`storefront.ts:711`) | Window count computes the full filtered set size on each page request, even when the consumer only needs the page. Buyer-facing; on cache MISS it runs. | S3 |
| **PERF-023** | **Live aggregates that should be rollups — partially fixed** | dashboards read `analytics_rollups_daily` (`analytics.ts:84,127`) ✅, BUT overview still does live `count:'exact'` on `products`/`customers` (`:282-284`) | The V1 "analytics = MV/rollups" intent is **honored on the read side** (good — dashboards sum pre-aggregated daily rollups). The residue is the two live entity counts in the overview. | S3 |
| **PERF-024** | **JSON column filtering** | `search_documents.attributes @> {category}` via `.contains('attributes', …)` (`storefront.ts:617-619`) | `@>` on JSONB needs a GIN on `attributes` to avoid scanning. Unverified GIN. | S3 (UNVERIFIED) |
| **PERF-025** | **Unbounded-ish reads guarded by caps** | storefront `loadRollups(…, 2000)` (`analytics.ts:195,248`), `by-ids` capped at 100 (`public-routes.ts:782`), products limit capped at 100 (`:751`) | Caps exist (good defensive hygiene) — 2000-row rollup window, 100-id batches. Not unbounded; noted as the *correct* pattern for contrast. | — |

**Slow-shape headline.** No floats, no unbounded full-table SELECTs, sensible caps everywhere, and analytics reads are rollup-backed. The real residue is **`count:'exact'` sprinkled on list endpoints** (PERF-020) and **leading-wildcard search** (PERF-013) — both bounded at the envelope but worth fixing before 10k merchants, plus the **`customers` live count that targets a missing table** (PERF-017), which is a correctness-flavored perf finding.

---

## 5. Worker-Bottleneck Analysis (`services/queue-workers`)

**Two execution modes.** (a) **Push:** the Cloudflare-Queues `queue()` handler fires on enqueue and processes a `MessageBatch`. (b) **Pull:** the `platform_queue_jobs` table is drained via `claim_platform_queue_jobs` RPC, invoked both inside the push `queue()` handler (`index.ts:455`) and on a cron in the **api-gateway** Worker (`wrangler.toml env.production.triggers` = `*/15`).

**Batch/claim sizes.** Pull claim limit defaults to **25** (`PLATFORM_QUEUE_CLAIM_LIMIT`, `platform-queue-consumer.ts:209`); drain budget per batch defaults to **25** (`:215`). Lock is 120s (`:414`).

**Serial processing (the bottleneck).**
- The push handler runs **7+ processors strictly sequentially** per batch (`index.ts:450-479`) — persist, metric, drain, email, risk, review, support, compliance, executive-analytics, incident — each `await`-ed in turn. Throughput of the whole batch is the **sum** of every stage's latency; a single slow stage (e.g. PERF-009 email) extends time-to-`ack` for the entire batch.
- Within the drain, claimed jobs are processed in a **serial `for` loop** (`:380`). No bounded-concurrency `Promise.all`. 25 jobs × (process + complete RPC) serial.
- The analytics job itself is the worst offender — **per-rollup loop** (PERF-005) and **per-line-item loop** (PERF-006): one `order.created` ⇒ 15–30 serial PostgREST writes (event upsert + N dimension rollups + order_items read + M item rollups + notification side-effect).

**Does one slow tenant block others?** **Yes, within a batch.** Jobs are claimed and processed FIFO with no per-tenant fairness or isolation. A tenant emitting a burst of heavy `order.created` events (each 15–30 serial writes) monopolizes the serial loop and delays every other tenant's job in that claim window. At the envelope this is mostly latency tail, not starvation, but there is no fairness mechanism.

**Polling / drain cadence.**
- api-gateway pull-drain cron: **`*/15` (every 15 minutes)** in production — and the inline comment records it was reduced from `*/1` "to save free-tier invocations." So table-resident jobs that are not also pushed onto a Cloudflare Queue can wait **up to 15 minutes**. Analytics rollups, notification side-effects, and search re-indexing inherit this lag on the pull path.
- queue-workers maintenance cron: **`17 */6 * * *` (every 6 hours)** (`queue-workers/wrangler.toml:20,126,240`) — runs `triggerCustomDomainReconciler`, `runExecutiveAnalyticsRollup`, `runIncidentPostmortemReminders`, `runComplianceAuditExportDryRun` (`index.ts:505-555`). Custom-domain verification and the nightly executive rollup therefore reconcile only **4×/day**.

**Unbounded backlog scan / growth.**
- **Stale-reservation sweeper is NOT scheduled** (confirms Phase 5). `expire_inventory_reservations(...)` exists (`migration 141:304`) but no cron, no queue job, and no route invokes it (grep across repo finds it only in migration + docs). **Perf implication:** `inventory_reservations` accumulates abandoned-checkout rows forever. Every checkout's reservation create/commit/release (`migration 141:175,240`) and any "available stock" computation that subtracts open reservations scans a monotonically growing table. At 30k orders/mo with a typical 60–80% cart-abandon rate, that is ~50k–100k dead reservation rows **per month** with no reaper — a slow-motion full-scan amplifier and a correctness drift (overstated reserved stock).
- The push `queue()` handler retries the **entire batch** on any error (`index.ts:496` — `for (delivery) message.retry()`), with no per-message ack/retry granularity. One poison message in a batch of N forces re-delivery and **re-processing of all N** — duplicate analytics increments and duplicate emails are only prevented by downstream idempotency keys (present on the queue row, `:140`, and on email `idempotencyKey`-less Resend calls — emails are **not** idempotent at the Resend layer, so a batch retry can **double-send** confirmation emails).

**Worker verdict:** functionally correct, idempotency-aware on the DB side, but **serial-everywhere** with a **slow pull cadence** and a **missing reaper**. Fine at 100 merchants; the analytics/notification tail and reservation bloat become visible marching toward 10k.

---

## 6. Caching Analysis — Storefront Read Path (the big one)

**Is there storefront caching? YES — and it is real, layered, and broadly applied.** Three tiers stack on the buyer path:

**Tier 1 — Next.js ISR + Data Cache (storefront-runtime).** The store page (`app/store/[subdomain]/page.tsx:11`) and product page (`.../product/[productId]/page.tsx:11`) are **Server Components with `export const revalidate = 60` / `30`** — server-rendered HTML, regenerated at most every 30–60s. Their data fetches go through the native `fetch` with `next: { revalidate, tags }` (`product-service.ts:71-76` via `storefrontReadInit`), so the **Next.js Data Cache** dedupes the `generateMetadata` + page fetches within a request and caches across requests with tag-based revalidation.

**Tier 2 — Worker Cache API + KV version key (api-gateway).** `lib/storefront-cache.ts` implements `cachedJson(...)` over **`caches.default`** with `Cache-Control: public, max-age=60, stale-while-revalidate=300` (`:12-13,24-26`) and a **KV-backed version key per store handle** (`storefrontCacheVersion` reads `env.CACHE`, `:74-81`) folded into the cache key (`:92-101`). This is wired across **13 public storefront endpoints** — bootstrap, products, products-by-ids, product-detail, categories, navigation, pages, policies, policy, page, blog, blog-detail (`public-routes.ts:576,753,787,813,906,931,961,991,1026,1067,1115,1141`). On a hit, the Worker never touches PostgREST at all.

**Tier 3 — invalidation.** `bumpStorefrontCacheVersion(handles[])` writes a fresh version string into KV per handle (`storefront-cache.ts:83-90`); because the version is part of every cache key, a bump **logically invalidates** all cached entries for that store without enumerating keys. `purgeStorefrontCache(keys[])` also deletes specific Cache-API entries (`:132-136`). `Cache-Tag` headers are emitted (`:45`) for CDN tag-purge.

**Gaps / caveats (the honest part):**
- **Cache is keyed by `env.CACHE` (KV) for the version; if `CACHE` is unbound the version is `'0'` (`:75`) — caching still works but loses per-store invalidation granularity** (everything shares version `'0'`, so a bump can't target one store). KV `CACHE` **is** bound in staging+production (`wrangler.toml:177-178,294-295`), so this is fine in those envs; in any env missing the binding, invalidation silently degrades.
- **TTL is only 60s** with 300s SWR. For a near-static product catalog at the envelope this is conservative (more PostgREST MISS traffic than necessary); could be minutes-to-hours with tag-purge on product edits. Not a bug — a tuning opportunity.
- **POST checkout/payment routes are not cached** (correctly) but **re-resolve the store on each step** (PERF-004/011) — so the *write* path has no store-lookup memoization across a single checkout's 3 calls.
- **The cache producer still pays the full cost on MISS / SWR-refresh**, including the windowed `COUNT(*) OVER()` (PERF-022) and store-resolution waterfall (PERF-011).

**Hyperdrive ↔ cache interaction:** see §9 — Hyperdrive only accelerates the **pooled-SQL** producer (storefront.ts), not the PostgREST producers behind most cached endpoints.

**Caching verdict: strong (4/5).** This is the most mature subsystem in the audit. The buyer's first paint is server-rendered and double-cached. The only real improvements are TTL tuning and ensuring the KV `CACHE` binding is present in every deployed env so invalidation stays per-store.

---

## 7. Bundle / Render Analysis (per app)

| App | Render strategy | Assessment | Evidence |
|---|---|---|---|
| **storefront-runtime** (buyer-facing — conversion-critical) | **SSR + ISR** (`revalidate=30/60`), server components for store/product pages; **51 of 80 tsx are client components** (`'use client'`) | Initial paint is **server-rendered HTML, not a client waterfall** — the critical concern (buyer hitting API on every load) is **avoided**. Client components are for interactivity (cart, gallery, account) layered onto SSR'd shells via `StorefrontCompositionEngine`. Images configured for **AVIF/WebP, deviceSizes, 24h cache** (`next.config` images block). JSON-LD inlined for SEO. **This is the right architecture.** Risk: 51 client components is a lot of hydration JS; the theme-engine/composition-engine ships to the client. **Actual KB UNVERIFIED** (no build output inspected). | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:11`; `.../product/[productId]/page.tsx:11`; `next.config.*` images |
| **merchant-control-plane** | SSR shells + client dashboards; data via `createMerchantApiClient` (per-leaf gateway calls) | Dashboard SSR fans out 6–8 leaf API calls (PERF-002). No `images` block enumerated in next.config (merchant UI is less image-heavy, lower priority). The fan-out, not the bundle, is the cost here. | `apps/merchant-control-plane/.../dashboard/page.tsx:106-200` |
| **mobile/merchant-app** (Flutter) | Native; see §8 | Dashboard fan-out (PERF-001) is the dominant cost. | — |
| Other Next apps (identity, app-marketplace, developer-portal, platform-console, platform-operations-portal, theme-marketplace, marketing-site) | Mixed SSR/CSR (internal/operator surfaces) | Low concurrency (staff/operator tools), not conversion-critical; not deeply profiled this pass. **UNVERIFIED** bundle sizes. | — |

**Barrel-import / heavy-dep scan:** the data path pulls `@supabase/supabase-js` (PostgREST client) and `postgres` (pooled) into the Worker; both are server-side, not shipped to buyers. The storefront client imports `@letbuyy/ui`, `@letbuyy/theme-engine`, `@letbuyy/runtime-composition`, `@letbuyy/commerce-core` — **whether these tree-shake or pull whole barrels into the client bundle is UNVERIFIED** without a bundle analyzer run. Flag for a `@next/bundle-analyzer` pass on storefront-runtime specifically (it is the only buyer-facing bundle).

**Render verdict:** the one app that *must* be fast (storefront) is built correctly (SSR/ISR, optimized images, no first-paint API waterfall). The merchant/mobile surfaces trade latency for the missing composite-endpoint tier.

---

## 8. Memory-Leak Register

| ID | Surface | Risk | Evidence | Verdict |
|---|---|---|---|---|
| **PERF-026** | `pooled-sql-adapter` module-scope `Map` of postgres clients | `const pooledClients = new Map<string, PooledSqlClient>()` at module scope (`:22`) retains `postgres()` clients (each up to `max:5` sockets) across requests, keyed by connection+option string. On Workers, module scope is per-isolate and persists between requests. | `packages/infrastructure/pooled-sql-adapter/index.ts:22,51-58` | **Bounded, not unbounded** — key cardinality is tiny (one connection string × a couple option combos), so the Map holds ~1–2 entries per isolate. The concern is **connection multiplication** (5 sockets × isolates), not memory growth. See §9. |
| **PERF-027** | api-gateway module-scope collections | All module-scope `Set`/`Map` in the gateway are **immutable constant allowlists** (`MUTATION_METHODS`, `REPLAY_SECRET_KEYS`, `DEBUG_ERROR_FIELDS`, `PUBLIC_SUFFIX_LIKE_DOMAINS`) — frozen at load, never grow per request. | `middleware/idempotency.ts:10`; `lib/replayable-secret-redaction.ts:4`; `lib/public-errors.ts:68`; `routes/custom-domains.ts:29` | **No leak.** Correct pattern (constants, not request-scoped caches). |
| **PERF-028** | Flutter controllers/streams (mobile) | Risk of undisposed `AnimationController`/`StreamController`/`ScrollController`/`TextEditingController`. Cross-link Phase 10. | 47 files reference such controllers; **47 files reference `dispose()`** — 1:1 ratio suggests disposal is generally present. | **Likely OK at file level** (count parity), but **per-controller disposal is UNVERIFIED** — count parity is not proof each controller is disposed. The dashboard `home_screen.dart` uses revenue-chart/timeline widgets with animation; confirm their `dispose()`. Defer detail to Phase 10. |
| **PERF-029** | Worker per-batch accumulation | `queue()` builds `deliveries[]` per batch and discards after `ack()`; no cross-batch retention. | `services/queue-workers/src/index.ts:447,481` | **No leak** — batch-scoped, GC'd. |

**Memory verdict:** no unbounded module-scope request-growing cache anywhere in the Workers (the usual Workers footgun is **absent**). The only module-scope mutable state is the pooled-SQL client Map, which is bounded and is really a *connection* concern (§9), not a memory leak. Flutter disposal looks present by file-count parity but is not individually verified.

---

## 9. Connection / Pooling Analysis

**Two connection regimes coexist (mirroring the DB "two systems" theme):**

1. **PostgREST/HTTPS (the dominant path).** `@supabase/supabase-js` `createClient` (`supabase-adapter/index.ts:34`) talks to Supabase's PostgREST over HTTPS. There is **no Postgres TCP connection from the Worker** on this path — connection pooling at the DB is Supabase/Supavisor's problem, and the Worker just makes stateless HTTPS calls. **Hyperdrive does nothing for this path.** A fresh `createClient` is constructed per call via `getSupabaseAdmin(c)` (`lib/supabase.ts:13-19`) wrapping `createSupabaseServiceClient` — cheap (no socket), but it does mean **no client reuse** and every request re-instantiates the wrapper. Not a pool-exhaustion risk (HTTP), but it forgoes any keep-alive client reuse.

2. **Raw Postgres via `postgres()` + Hyperdrive (storefront pooled-SQL only).** `getPooledSql` (`pooled-sql-adapter/index.ts:36-60`) builds a `postgres(connectionString, { max:5, idle_timeout:20, connect_timeout:5, prepare:false })` client and **caches it in a module-scope Map** (`:22,48-58`). The connection string is `env.HYPERDRIVE?.connectionString || DATABASE_URL || SUPABASE_DB_URL` (`:28-29`) — so **Hyperdrive, when bound, fronts these raw connections** (pooling/caching at the edge). Used **only** in `storefront.ts` (store lookup, theme release, public product query — `:640,650,665,684`), gated by `STOREFRONT_POOLED_SQL` (default `on`, `wrangler.toml:38`).

**Hyperdrive: configured, and actually used — but narrowly.** `[[env.staging.hyperdrive]]` and `[[env.production.hyperdrive]]` both define `binding = "HYPERDRIVE"` (`wrangler.toml:186-187,303-304`), and the binding is consumed (`index.ts:98`, `pooled-sql-adapter:10,29`). So it is **not a dead binding** — but it accelerates only the **pooled-SQL storefront read** family. The ~90% of routes on PostgREST get **zero Hyperdrive benefit**. This is a reasonable V1 choice (the hottest read — storefront store/product — gets the pooled fast path; everything else rides PostgREST), but it means "Hyperdrive pooling in front of Postgres is specified" is only **half-true in practice**: it fronts the storefront raw-SQL queries, not the platform.

**Connection-exhaustion risk (PERF-026 revisited).** Each isolate that touches pooled-SQL opens up to **5** Postgres connections (`max:5`). Cloudflare may spin up many isolates under load. Without Hyperdrive this would be `5 × isolates` direct Postgres connections — a genuine exhaustion path at scale. **With Hyperdrive in front (as configured), Hyperdrive multiplexes these down to a bounded server-side pool**, which is exactly why the binding matters. So the configuration is *correct*; the residual risk is only if a deploy runs pooled-SQL **without** Hyperdrive (e.g. local/dev with `DATABASE_URL` direct) at high isolate count. The `idle_timeout:20` and `prepare:false` (required for transaction-pooled Hyperdrive) are set correctly.

**Pooling verdict:** the design is sane — PostgREST for the breadth (stateless, no pool to exhaust), pooled-SQL+Hyperdrive for the hottest storefront reads. The honest caveat is that Hyperdrive's benefit is confined to one route family, and the raw-`postgres()` `max:5` path is only safe **because** Hyperdrive fronts it.

---

## 10. Critical-Path Latency Budgets

Round-trip costs assumed (UNVERIFIED, order-of-magnitude): PostgREST HTTPS call **≈30–100ms**; pooled-SQL via Hyperdrive **≈10–40ms**; app→BFF→gateway hop over mobile **≈80–300ms**; Resend email **≈100–300ms**.

### 10.1 Storefront product page (buyer, cache MISS) — the conversion-critical path

| Step | Call | Path | Est. |
|---|---|---|---|
| 1 | Next.js SSR render begins (`product/[productId]/page.tsx:36`) | — | — |
| 2 | `getProductById` → Worker `GET /storefront/:sub/products/:slug` | Worker (Tier-2 cache MISS) → producer | |
| 2a | inside producer: `loadPublishedStore` (pooled-SQL store lookup, `storefront.ts:740`) | Hyperdrive→PG | ~10–40ms |
| 2b | product `.select(...).eq(store_id).or(slug,id)` (`public-routes.ts:822-828`) | PostgREST | ~30–100ms |
| 2c | `hydratePublicProductVariants` batched `.in(product_id)` (`storefront.ts:501`) | PostgREST | ~30–100ms |
| 3 | `getStoreBySubdomain` (deduped with metadata via Data Cache) | Worker (cached) | ~0–40ms |
| **Total (MISS)** | | | **≈80–280ms** server-side, then HTML to browser |
| **Total (HIT)** | Tier-1 ISR or Tier-2 Worker cache serves HTML/JSON | edge | **≈5–30ms** |

**Critical path = the store-resolution + product fetch + variant hydrate triad on MISS** (3 serial DB round-trips), fully absorbed by ISR/Cache-API on HIT. **This is healthy.** The biggest lever is keeping hit-rate high (raise TTL beyond 60s with tag-purge on edits). No external (payment/3rd-party) calls on this read path. Verdict: **good** — buyer-facing latency is cache-dominated, not query-dominated.

### 10.2 Checkout-confirm (buyer, `POST /storefront/:sub/orders`) — the money path

Sequential critical path (`checkout-payment-routes.ts:244-407`):

| # | Step | Path | Est. |
|---|---|---|---|
| 1 | `loadPublishedStore` (PERF-004) | pooled-SQL or PostgREST waterfall | ~10–100ms |
| 2 | `createPublicStorefrontTenantContext` (`:258`) | (context; may read) | ~0–60ms |
| 3 | `idempotency.begin` — DB write (`:260`) | PostgREST | ~30–100ms |
| 4 | `evaluateCheckoutAppFunctions` (if `FEATURE_EXTENSIONS`, `:285`) — loads registered functions + executes | PostgREST + compute | ~30–150ms |
| 5 | `service.createOrder` → **single `create_checkout_order` RPC** (`order-execution.adapter.ts:151`), preceded by `assertOrderQuota` (`:147`) | PostgREST ×2 (quota + RPC) | ~60–200ms |
| 6 | `emitStorefrontOrderCreatedEvent` — outbox write (`:368`) | PostgREST | ~30–100ms |
| 7 | `idempotency.complete` — DB write (`:399`) | PostgREST | ~30–100ms |
| **Deferred (waitUntil, off critical path when `CHECKOUT_POSTCOMMIT_DEFERRAL=on`)** | usage meter + GST invoice 2-lookup+persist (PERF-010); analytics event enqueue | background | — |
| **Buyer-perceived total** | **~6–7 serial DB round-trips** | | **≈250–800ms** |

**Critical path = the 6–7 serial PostgREST writes around a single well-designed order RPC.** The heavy commerce logic (stock reservation, totals, GST, insert) is correctly **one** stored-proc round-trip (step 5), not N Worker queries — that is the right call. The latency comes from the **idempotency begin/complete + tenant + outbox + quota** scaffolding, each a separate HTTPS write. The deferral flag correctly moves invoice/usage/analytics to `waitUntil` so the buyer doesn't wait on them. **The single biggest checkout latency lever is collapsing steps 3/6/7 (idempotency + outbox) into the `create_checkout_order` transaction** so they ride one round-trip instead of three. Razorpay verify (`:541`) repeats step 1 (store re-resolve) plus signature verify + capture + ledger post — another ~4–6 round-trips on the *next* user action.

**Verdict:** acceptable at the envelope (sub-second), but the round-trip count is inflated by per-call HTTPS scaffolding that a single transactional RPC could absorb.

---

## 11. Mobile-Performance Notes

- **PERF-001 (dashboard fan-out) is the headline** — ~7 serial round-trips, 5 of them sequential analytics calls (`analytics_service.dart:366-376`) that *should* be one `Future.wait` at minimum, and ideally one composite BFF endpoint. On a 4G connection (150–300ms RTT each), this is a **1–2.5s** blocking dashboard load before first meaningful paint, partially masked by `skeleton_loader` (`home_screen.dart:21`).
- **BFF stub (PERF-003)** removes the natural place to fix this. A single `GET /v1/mobile/dashboard` returning {store, analytics-summary, orders-breakdown, recent-activity, payout-summary} would cut ~7 round-trips → 1.
- **Over-fetch:** `getStoreAnalytics` pulls dashboard + orders + revenue + top-products + traffic-sources for the home screen even though the home likely renders a subset; revenue/traffic could be lazy-loaded on the analytics tab. (`analytics_service.dart:357-409`).
- **Good patterns present:** several services do use `Future.wait` (money `:153,158`, shipping-tax `:28`, app-marketplace `:421`, ai-studio `:388`) — the dashboard path is the outlier that doesn't.
- **List virtualization / image loading / jank:** not deeply profiled this pass (**UNVERIFIED**); the orders/products/customers screens use `Future.wait` for their loads (`orders_screen.dart`, `products_screen.dart`, `customers_screen.dart` all appear in the `Future.wait` grep), which is the right batching for list headers. Confirm `ListView.builder` virtualization and cached network images in Phase 10.

---

## 12. Cross-Reference Summary (Phase 1 / 5 / 7)

- **Phase 1 (topology):** `mobile-bff` is on the map as the composite/fan-in tier to kill dashboard N+1. **This audit confirms it is a 305-line pass-through stub** (`mobile-bff/src/index.ts:302`) — so the N+1 it was meant to fix (PERF-001) is fully live. Direct corroboration of the Phase 1 "bff is a stub" finding, now with the *performance consequence* quantified.
- **Phase 5 (checkout):** stale-reservation sweeper not scheduled. **Confirmed** — `expire_inventory_reservations` exists (`migration 141:304`) but no cron/route invokes it. Perf consequence: unbounded `inventory_reservations` growth (PERF-007 / §5).
- **Phase 7 (database):** money-join index gaps (MI-1/3/4/5/8, DB-029) are real but cold-path; the *hot* index risks (storefront `sites(subdomain|store_name)`, `products(store_id,is_active,display_order)`, leading-wildcard search) are **not** in Phase 7's FK/unique-scoped register and are flagged here (PERF-012/013/015), mostly UNVERIFIED pending `EXPLAIN`. The `customers`-table-missing finding (DB-001/CI-8) surfaces here as a live per-dashboard `COUNT(*)` on a non-existent table (PERF-017).

---

## Findings Register

Severity: **S0** = user-facing broken / outage-risk at the envelope; **S1** = major; **S2** = meaningful; **S3** = hygiene.

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| PERF-001 | S1 | N+1 / Mobile | Mobile dashboard = ~7 serial network round-trips | Sequential awaits + 5 un-batched analytics calls + no composite endpoint | `apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart:50-98`; `.../services/analytics_service.dart:357-409` | 1–2.5s blocking dashboard load on mobile; worst buyer-of-product-facing latency | M | `Future.wait` the 5 analytics calls now; long-term add a composite BFF dashboard endpoint |
| PERF-002 | S1 | N+1 / Web | Web dashboard SSR fan-out 6–8 leaf API calls | Per-widget gateway calls; two serial `Promise.all` groups | `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:107-108,129-200` | Multi-hundred-ms dashboard TTFB; each leaf re-auths + re-queries | M | One `GET /merchant/dashboard/home` composite endpoint returning all blocks |
| PERF-003 | S1 | Architecture | `mobile-bff` provides no composite/fan-in endpoints (pass-through stub) | BFF only signs session + proxies 1:1 | `services/mobile-bff/src/index.ts:237-303` | The N+1 the BFF exists to kill (PERF-001) is fully live | L | Implement composite endpoints in BFF (dashboard, order-detail bundle) that fan-in server-side |
| PERF-004 | S2 | N+1 / Checkout | Store re-resolved on every checkout/payment POST step | Each public payment route calls `loadPublishedStore` fresh | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:248,421,541,663,783,908,1013,1115` | +1 (up to +5 on waterfall) round-trip per checkout step | S | Pass resolved `store_id` forward / memoize per request via signed token |
| PERF-005 | S2 | Worker N+1 | Analytics job loops `incrementRollup` once per rollup dimension | Per-increment RPC instead of one batched call | `services/queue-workers/src/platform-queue-consumer.ts:486-495,988` | N serial PostgREST writes per event | M | Add `increment_analytics_rollups(jsonb[])` RPC; post all dimensions in one call |
| PERF-006 | S2 | Worker N+1 | `order.created` loops rollup RPC per line item | Per-item RPC after reading `order_items` | `services/queue-workers/src/platform-queue-consumer.ts:513-535` | 15–30 serial writes for one order's analytics | M | Batch item rollups into the same set-based RPC as PERF-005 |
| PERF-007 | S1 | Worker / Growth | Stale-reservation sweeper exists but is never scheduled | `expire_inventory_reservations` wired to no cron (confirms Phase 5) | `database/supabase/migrations/141_executable_inventory_reservations.sql:304`; `services/queue-workers/src/index.ts:505-555` (absent) | `inventory_reservations` grows ~50–100k dead rows/mo; scans grow; reserved-stock overstated | S | Schedule `expire_inventory_reservations` on the queue-workers cron (or a dedicated 5-min trigger) |
| PERF-008 | S2 | Worker | Queue `queue()` runs 7+ processors strictly serially | Sequential `await` per stage | `services/queue-workers/src/index.ts:450-481` | Batch ack latency = sum of all stages; slow stage stalls all | M | Parallelize independent processors (`Promise.allSettled`) or split into per-queue workers |
| PERF-009 | S2 | Worker | Email dispatch sends Resend calls serially in a loop; not idempotent | `await sendResendEmail` inside `for` | `services/queue-workers/src/index.ts:371-411` | K emails = K serial HTTPS; batch-retry can double-send | S | Batch/parallelize sends; add Resend idempotency key keyed on order+template |
| PERF-010 | S3 | Checkout | GST invoice post-commit does 2 serial lookups + persist | Sequential orders→sites reads | `services/api-gateway/src/execution/order-execution.adapter.ts:223-300` | 3 extra background round-trips/order (deferred, off critical path) | S | Fetch order+site in one RPC or `Promise.all`; or compute inside `create_checkout_order` |
| PERF-011 | S2 | Storefront | Store-resolution PostgREST fallback walks up to 5 serial selects | Progressive column-shape fallback (two-systems schema) | `services/api-gateway/src/routes/storefront.ts:783-829` | Up to 5 serial round-trips on schema-shape miss | M | Normalize `sites` columns; collapse to one select; keep pooled-SQL fast path primary |
| PERF-012 | S2 | Index (hot) | Storefront product list filter/sort index unverified | `WHERE store_id,is_active ORDER BY display_order` on legacy `products` | `services/api-gateway/src/routes/storefront.ts:715-720` | Sort/scan on every product-list MISS | S | Add/verify `products(store_id, is_active, display_order) WHERE deleted_at IS NULL`; `EXPLAIN` |
| PERF-013 | S2 | Index (hot) | Leading-wildcard `ILIKE '%x%'` search (un-indexable) | `name ILIKE '%search%'` storefront + merchant + customers | `storefront.ts:700-702`; `products.ts:480`; `customers.ts:508` | Full tenant-slice scan per text search; degrades with catalog growth | M | `pg_trgm` GIN on searched columns, or route all search through `search_documents` FTS |
| PERF-014 | S2 | Index (hot) | `search_documents.search_vector` GIN + `count:'exact'` unverified | FTS without confirmed GIN; exact count per search | `services/api-gateway/src/routes/storefront.ts:597-619` | Seq-scan FTS + extra count pass on storefront search | S | Verify GIN on `search_vector` and GIN on `attributes`; drop `count:'exact'` for estimated |
| PERF-015 | S2 | Index (hot) | `sites(subdomain OR store_name)` lookup index unverified | OR-on-two-columns on every uncached storefront hit | `services/api-gateway/src/routes/storefront.ts:643,655` | Scan on every storefront cache MISS (highest-frequency lookup) | S | Partial indexes on `subdomain` and `store_name` `WHERE status='published' AND deleted_at IS NULL` |
| PERF-016 | S2 | Index (hot) | Merchant orders list index unverified | `WHERE store_id IN ORDER BY created_at` | `services/api-gateway/src/routes/orders.ts:568-590` | List/sort scan as order volume grows | S | Verify `orders(store_id, created_at)`; `EXPLAIN` at 360k-row scale |
| PERF-017 | S1 | Slow query / Correctness | Dashboard overview does live `COUNT(*)` on `products` and missing `customers` table | Live counts; `customers` absent from migration chain (Phase 7 DB-001) | `services/api-gateway/src/routes/analytics.ts:282-284` | Per-load COUNTs; the `customers` count errors or hits out-of-band schema | S | Source counts from rollups; fix `customers`→`store_customers` per Phase 7 DB-001 |
| PERF-018 | S2 | Index (money) | Settlement/payout/commission join FKs unindexed | Tenant+status indexes exist; cross-entity FK indexes don't | Phase 7 MI-1,3,4,5,8; DB-029 | Seq-scans on payout/commission dashboards at 10k-merchant volume | S | Add composite `(site_id, settlement_id)` / `(site_id, payout_statement_id)` indexes |
| PERF-019 | S3 | Slow query | `SELECT *` on wide JSONB-bearing `products` on detail MISS | Fallback select-star when relational reads off | `services/api-gateway/src/routes/storefront/public-routes.ts:824` | Ships embedded JSONB per product detail MISS | S | Always select explicit column list; keep `PRODUCT_SELECT_FULL_RELATIONAL` |
| PERF-020 | S2 | Slow query | `count:'exact'` on multiple list endpoints | Exact total requested per page | `orders.ts:569`; `products.ts:473`; `orders.ts:644`; `storefront.ts:609,711` | Extra aggregate pass per list/search request | S | Use estimated/planned count or cache totals; reserve exact for page 1 |
| PERF-021 | S3 | Slow query | OFFSET pagination on lists incl. buyer-facing product list | `.range(offset,…)` / `LIMIT OFFSET` | `orders.ts:590`; `products.ts:492`; `storefront.ts:705-720` | Deep-page re-scan; minor at envelope | S | Extend the existing cursor pattern (`limit+1`) to products/storefront |
| PERF-022 | S3 | Slow query | `COUNT(*) OVER()` windowed total on every paginated storefront product page | Window count in the page query | `services/api-gateway/src/routes/storefront.ts:711` | Full filtered-set count per page on MISS | S | Compute total only when needed (page 1) or from a cached/estimated value |
| PERF-023 | S3 | Slow query | Residual live entity counts despite rollup-based dashboards | Overview counts not yet rolled up | `services/api-gateway/src/routes/analytics.ts:84,282-284` | Two live counts on every dashboard load | S | Move product/customer totals into the daily rollup |
| PERF-024 | S3 | Slow query | JSONB `@>` filter without confirmed GIN | `.contains('attributes', …)` on `search_documents` | `services/api-gateway/src/routes/storefront.ts:617-619` | Scan on category-filtered search | S | GIN on `attributes` |
| PERF-025 | S3 | Caching | Storefront cache TTL conservative (60s) for near-static catalog | Short TTL + SWR 300s | `services/api-gateway/src/lib/storefront-cache.ts:12-13` | More PostgREST MISS traffic than necessary | S | Raise TTL to minutes–hours; rely on `bumpStorefrontCacheVersion` tag-purge on edits |
| PERF-026 | S2 | Pooling | Pooled-SQL `max:5` raw Postgres connections per isolate; safe only behind Hyperdrive | Module-scope client cache opens 5 sockets/isolate | `packages/infrastructure/pooled-sql-adapter/index.ts:22,51-58`; `wrangler.toml:186-187,303-304` | Connection exhaustion if pooled-SQL runs without Hyperdrive at high isolate count | S | Ensure Hyperdrive bound wherever `STOREFRONT_POOLED_SQL=on`; never point pooled-SQL at direct `DATABASE_URL` in prod |
| PERF-027 | S2 | Pooling | Hyperdrive accelerates only the pooled-SQL storefront family; ~90% of routes ride PostgREST | Most data access uses `@supabase/supabase-js` HTTP | `packages/infrastructure/supabase-adapter/index.ts:34`; usages only in `storefront.ts:640-684` | "Hyperdrive pooling in front of Postgres" is half-realized; PostgREST round-trip tax dominates | L | Decide deliberately: expand pooled-SQL+Hyperdrive to other hot reads, or accept PostgREST and minimize round-trips |
| PERF-028 | S3 | Worker | 15-min pull-drain cron + 6-hour maintenance cron | Crons downgraded to save free-tier invocations | `services/api-gateway/wrangler.toml` (`env.production.triggers` `*/15`); `services/queue-workers/wrangler.toml:20` (`17 */6`) | Pull-path jobs lag up to 15 min; reconcile/rollup 4×/day | S | Restore tighter cron on production once off free-tier; keep push queue for latency-sensitive work |
| PERF-029 | S2 | Worker | Whole-batch retry on any error (no per-message granularity) | `for (delivery) message.retry()` on catch | `services/queue-workers/src/index.ts:495-503` | One poison message re-processes the whole batch; duplicate emails (PERF-009 not idempotent) | M | Ack good messages, retry only failed; add Resend idempotency |
| PERF-030 | S3 | Mobile | Dashboard over-fetches revenue/traffic for home screen | All analytics pulled eagerly | `apps/mobile/merchant-app/lib/services/analytics_service.dart:357-409` | Extra round-trips for data not on first screen | S | Lazy-load revenue/traffic on the analytics tab |
| PERF-031 | S3 | Bundle | Storefront client bundle size unverified (51 client components + theme-engine) | No bundle-analyzer run | `apps/storefront-runtime/src` (`'use client'` ×51) | Potential heavy hydration JS on buyer pages | S | Run `@next/bundle-analyzer`; code-split theme-engine; audit `@letbuyy/*` barrel imports |
| PERF-032 | S3 | Render | Merchant SSR groups run serially (`loadSetupStatus` then `loadDashboardHomeData`) | Two awaits instead of one `Promise.all` | `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:107-108` | Adds one group's latency in series | S | `Promise.all([loadSetupStatus, loadDashboardHomeData])` |

**32 findings: S0 ×0 · S1 ×5 · S2 ×15 · S3 ×12.**

> Note on S0: nothing is rated S0 because nothing is *broken or outage-risk at the V1 envelope* purely on performance grounds. The S1s are the fan-out trio (PERF-001/002/003) that make control-surface latency poor now, the unscheduled reaper (PERF-007) that quietly degrades over months, and the live-count-on-missing-table (PERF-017) which is correctness-adjacent. The closest thing to a future-S0 is PERF-007 + PERF-026: reservation-table bloat plus a pooled-SQL path that depends on Hyperdrive being bound to avoid connection exhaustion — both bite "later," not "now."

---

## Appendix — Performance Scorecard

| Dimension | Score | Basis |
|---|---|---|
| Storefront read path (buyer-facing) | 4.2/5 | SSR/ISR + Worker Cache-API + KV-versioned invalidation; batched hydration; optimized images. Loses points for 60s TTL and MISS-path waterfall. |
| Caching maturity | 4.0/5 | Real 3-tier cache with tag-purge; only gaps are TTL tuning + KV-binding dependency for per-store invalidation. |
| Checkout critical path | 3.3/5 | Heavy logic in one RPC (good); inflated by 6–7 serial HTTPS scaffolding writes; deferral flag well-used. |
| Dashboard / control-surface latency | 2.0/5 | 6–8 (web) / ~7 (mobile) serial round-trips; BFF composite tier is a stub. The product's weakest perf surface. |
| Worker / async pipeline | 2.5/5 | Idempotency-aware but serial-everywhere; per-event rollup RPC loops; 15-min/6-hour crons; whole-batch retry. |
| Indexing on hot paths | 3.0/5 | Money-join gaps known (Phase 7); storefront filter/search/lookup indexes UNVERIFIED; leading-wildcard search un-indexable. |
| Connection / pooling | 3.5/5 | Sane split (PostgREST breadth + pooled-SQL+Hyperdrive for hottest reads); Hyperdrive benefit narrow; `max:5` safe only behind Hyperdrive. |
| Memory safety (Workers) | 4.5/5 | No unbounded module-scope request-growing cache; constants only; pooled-SQL Map bounded. |
| **Composite** | **3.0/5** | Strong cacheable storefront; undermined by missing composite-endpoint tier and serial worker processing on a slow drain. |

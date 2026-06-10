# P2_PERFORMANCE_MASTER — Edge Caching, Hot Rows, N+1, and Heavy List Paths

Parent: `LETBUYY_MASTER_EXECUTION_PLAN.md`
Scope: verified performance bottlenecks on the merchant and storefront hot paths. Documentation only.
Strategic note: caching (P2-1) and pooled SQL (P1-2) are interdependent — cache first, then pooled SQL for cache misses. Both are prerequisites for the 1,000-merchant tier.

---

## P2-1 — Edge Cache for Public REST Storefront (PERF-1) — highest-leverage perf change

### Problem
No Cache API usage anywhere in `services/api-gateway/src`. Every storefront read hits Supabase PostgREST: `loadPublishedStore` (`storefront.ts:548`), `loadCurrentThemeRelease` (`:636`), `queryPublicProducts` (`:827`), pages/policies/navigation loaders (`:839,901,921`). The GraphQL storefront path sets `Cache-Control` headers (`graphql/storefront.ts:270-277`) but the live REST path does not.

### Target design
A **storefront bootstrap cache** keyed by `subdomain` (+ query params for product lists), using the Cloudflare Cache API (`caches.default`) with cache tags and stale-while-revalidate, plus `Cache-Control` response headers for the CDN/browser.

### Implementation tasks
1. Add `services/api-gateway/src/lib/storefront-cache.ts` (new): `cachedJson(c, key, ttl, swr, producer)` wrapping `caches.default`.
2. Wrap the read-only storefront loaders: store bootstrap (store + theme release + navigation + pages + policies + active app blocks composed into ONE payload), product list, product detail (`:2474,2491,2510`), collections, blog/policy pages.
3. Add **purge on write**: in product/theme/page execution adapters (`product-execution.adapter.ts`, `theme-execution.adapter.ts:1097` publish, CMS routes), purge the relevant cache keys/tags on update/publish/rollback.
4. Set `Cache-Control: public, max-age=…, stale-while-revalidate=…` on these REST responses.

### File-by-file
| File | Change |
|---|---|
| `services/api-gateway/src/lib/storefront-cache.ts` | NEW cache helper |
| `services/api-gateway/src/routes/storefront.ts` | wrap public read loaders; compose a single bootstrap payload |
| `services/api-gateway/src/execution/product-execution.adapter.ts` | purge product cache on mutate |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | purge store/theme cache on publish/rollback (`:1097`) |
| CMS/pages routes | purge page/nav/policy cache on update |

### Migration / Rollback / Testing / Acceptance
- No DB migration.
- Rollback: flag `STOREFRONT_CACHE=off` → bypass cache, direct DB.
- Test: warm/cold hit-rate measurement; assert publish purges within one request; assert no stale price after a product update.
- Acceptance: ≥80% cache hit on repeat storefront reads; product/theme/page publishes reflect within the purge window; storefront p95 drops materially.

**Complexity:** L. **Risk:** Med (correctness of purge-on-publish is the risk; test thoroughly).

---

## P2-2 — Product View Counter Hot-Row Race (PERF-5)

### Problem
`product-execution.adapter.ts:228-234` `recordStorefrontView` does a read-modify-write `UPDATE products SET view_count = nextViewCount` on every product page load (`storefront.ts:2701`) — a hot-row write with a lost-update race.

### Change
1. Stop synchronous per-view writes. Emit a `product.viewed` event to the analytics queue and aggregate counts in a rollup (ties to P3 projections), OR
2. Interim: use an atomic SQL increment RPC (`UPDATE … SET view_count = view_count + 1`) and only fire it on a sampled fraction of views, behind cache (P2-1) so cached hits don't touch the DB at all.

### Testing / Acceptance
- Concurrency test: 100 parallel views → count is correct (no lost updates) or eventually-consistent via rollup.
- Acceptance: product page render does not perform a synchronous hot-row write on cache hits.

**Complexity:** M. **Risk:** Med.

---

## P2-3 — GraphQL N+1 and Bulk Per-Row Requests (MISSED-10, MISSED-11)

### Change
1. Resolve sibling connection fields (`graphql/admin.ts:555-564`) via direct execution-adapter calls rather than serial `app.fetch` HTTP sub-requests; batch where the adapter supports it.
2. Bulk mutations (`graphql/bulk.ts:349-375`) must call execution adapters directly per row inside a bounded concurrency pool, not issue a full GraphQL HTTP request per row.

### Testing / Acceptance
- A 5-field Admin query issues ≤5 DB round-trips total (ideally batched), not 5 full middleware re-entries.
- A K-row bulk op does not create K HTTP request cycles.
- Acceptance: GraphQL latency scales with data, not with middleware overhead.

**Complexity:** M (queries) / L (bulk). **Risk:** Med.

---

## P2-4 — Exact-Count and `select('*')` List Endpoints (PERF-3)

### Change
Replace `select('*', { count: 'exact' })` with selected columns + keyset (cursor) pagination, dropping exact counts on default list loads (offer an opt-in `?withCount=1` or a cached approximate count):
- `products.ts:148`, `orders.ts:257` (also stop default `order_items(*)` expansion — detail-only), `media.ts:39`, and the broader set (admin/stores/blog/coupons/inventory).

### Testing / Acceptance
- List endpoints return in constant time regardless of table size; counts are opt-in or cached.
- Acceptance: no default list path runs a full `COUNT` over the filtered set.

**Complexity:** M. **Risk:** Med (pagination contract change — coordinate with app clients).

---

## P2-5 — `ilike '%term%'` Search (PERF-2)

### Change
Leading-wildcard search (`products.ts:155`, `orders.ts:268`, `app-store.ts:723`, `themes.ts:142`, `storefront.ts:847,1323`, `internal-console.ts:105`) forces sequential scans. Options in order of effort:
1. Add `pg_trgm` GIN indexes for the searched columns (fast win for merchant search).
2. Move public storefront search to the existing `search_documents`/search-queue path (ties to P3).

### Testing / Acceptance
- `EXPLAIN` shows index usage (trigram) for merchant search; storefront search no longer scans `products` directly.

**Complexity:** M. **Risk:** Low (trigram indexes are additive).

---

## P2-6 — Synchronous CSV Export (PERF-6)

### Change
`export.ts:113-119,176-184` `select('*')` with no limit, building CSV in worker memory, risks CPU/memory limits. Move to an async export job: enqueue → worker streams selected columns to R2 → return a signed download URL. Cap `import-products` (`:252-264`) batch size and process via queue.

### Testing / Acceptance
- Export of a 100k-row catalog completes via job without hitting worker limits; download served from R2.
- Acceptance: no unbounded in-memory `select('*')` export remains on the request path.

**Complexity:** M. **Risk:** Med.

---

## P2-7 — Variant Replace N+1 and Checkout Sync Work (PERF-7, PERF-9)

### Change
1. `product-execution.adapter.ts:331-379`: replace delete-all+reinsert + per-variant inventory RPC with a diff-based update and a single batched inventory call (ideally a transactional RPC `update_product_with_variants`).
2. Checkout (`storefront.ts:1566`, `order-execution.adapter.ts:142,210`): defer GST invoice generation and non-essential event emission off the synchronous checkout path (queue them) for non-COD where payment confirmation is async.

### Testing / Acceptance
- Product save with 50 variants performs O(1) batched writes, not O(n) RPCs.
- Checkout latency excludes invoice/usage where deferral is safe; invoice still generated reliably via queue.

**Complexity:** M (variants) / M (checkout). **Risk:** Med.

---

## P2-8 — Theme Editor Bootstrap (PERF-8)

### Change
Editor boots via 3 fetches (`editor/page.tsx:671,696,697`). Add a combined `GET /themes/:slug/editor/bootstrap` returning schema + editor state + releases in one payload; cache the schema.

### Acceptance
Editor first paint requires one network round-trip for its core data.

**Complexity:** S. **Risk:** Low.

---

## P2 Load-Test Gate (required before 1,000 merchants)
Run a production-like load test (use `load/` harness) for: storefront home, product list, product detail, customer login, checkout create. Record p50/p95/p99, DB CPU, cache hit-rate, Worker CPU-ms. Acceptance: storefront read p95 within target with ≥80% cache hit; checkout p95 within target with deferred non-essential work.

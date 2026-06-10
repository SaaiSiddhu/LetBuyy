# P3_SCALABILITY_MASTER — Partitioning, Pooled SQL, Projections, and Safe Rollout of WS11–WS13

Parent: `LETBUYY_MASTER_EXECUTION_PLAN.md`
Scope: the structural changes required to move from 1,000 → 10,000 merchants. Documentation only.
Honest framing: at 100 merchants none of this is required; at 1,000 a subset is; at 10,000 all of it is. Do not pre-build for 10k before the 100-merchant beta is safe.

---

## P3-1 — Hot-Table Partitioning + Retention (SCALE-1)

### Problem
Zero `PARTITION BY` in the 27,700-line baseline; no purge/retention job exists for `worker_request_logs` (`:13112`), `runtime_telemetry_metrics` (`:11592`), `outbox_events` (`:1215`), `platform_queue_jobs` (`:1291`), `webhook_deliveries` (`:1361`). **Correction to prior reports:** these tables DO have `(…, created_at)` indexes — do not add duplicates.

### Target design
Time-based range partitioning (monthly) on the append-heavy tables + automated retention (drop/detach old partitions). Pair with P1-1 (log sampling) and P1-7 (queue write batching) so the inflow shrinks before partitioning.

### Implementation tasks (migration-heavy — sequence carefully)
1. Migration `079_partition_worker_request_logs.sql`: convert to `PARTITION BY RANGE (created_at)` via the standard "create partitioned table → copy → swap" pattern; create monthly partitions + a default; add a `pg_cron`/scheduled job to create next-month partitions and drop partitions older than the retention window (e.g., 30–90 days).
2. Repeat per table: `080_partition_runtime_telemetry_metrics.sql`, `081_partition_outbox_events.sql` (retain only un-dispatched + recent), `082_partition_platform_queue_jobs.sql` (retain only non-terminal + recent), `083_partition_webhook_deliveries.sql`.
3. Add a `retention_policies` config table documenting each table's window.

### Migration plan
- Each partition migration is a **separate, reversible** step run in a maintenance window. Use create-new + backfill-copy + rename-swap so the live table is never locked for long. Validate row counts pre/post.
- `outbox_events`/`platform_queue_jobs` are operationally hot — drain them first, then migrate, to minimize copy volume.

### Rollback plan
- Keep the original table as `*_legacy` until the partitioned table is verified for one full retention cycle; rollback = rename-swap back. No data loss because copy is additive.

### Testing strategy
- Dry-run on a staging clone with production-scale synthetic data; measure swap lock duration; verify the retention job drops only out-of-window partitions; verify all existing `(…, created_at)` queries still use indexes via `EXPLAIN`.

### Acceptance criteria
- The five tables are range-partitioned; a scheduled job manages partition lifecycle; storage growth is bounded by the retention window; no query regressed.

**Complexity:** XL. **Risk:** High (online schema change on hot tables — staging-proven + windowed).

---

## P3-2 — Pooled SQL via Hyperdrive for Read Throughput (SCALE-2 / COST-13)

See P1-2 for the phased approach. At the 10k tier this graduates from "cost lever" to "throughput requirement": PostgREST-over-HTTP per query caps read concurrency. Sequence: cache (P2-1) → pooled reads (P1-2) → read replicas only after both, to avoid paying for replicas that caching would have made unnecessary.

### Acceptance
Hot reads run on pooled SQL; read replica decision is data-driven from post-cache load tests, not pre-emptive.

**Complexity:** L. **Risk:** High.

---

## P3-3 — Analytics & Search Off OLTP → Projections/Index (SCALE-4)

### Problem
Analytics aggregates raw `orders` in worker memory (`analytics.ts:29,60,114`), and public search uses `ilike` on `products`. Both put read pressure on the commerce primary.

### Target design
The repo already has projection (`packages/projection-runtime`) and search (`search-core`, `search_documents`, search queue) scaffolding. Use it:
1. Build daily/although-near-real-time rollups (revenue by site/date, top products, order-status counts) maintained by the analytics queue consumer; analytics routes read rollups, not raw orders.
2. Route public storefront search through `search_documents`/the search index, not OLTP `ilike`.

### Migration / Rollback / Testing / Acceptance
- Migrations add rollup tables (`084_analytics_rollups.sql`) + projection state.
- Rollback: analytics routes fall back to direct OLTP queries behind a flag.
- Test: rollup correctness vs direct query on a fixed dataset; search relevance + latency.
- Acceptance: dashboard endpoints do not scan raw `orders`; storefront search does not scan `products`.

**Complexity:** L. **Risk:** Med.

---

## P3-4 — Dual JSONB/Relational Consolidation (SCALE-3 / DEBT-4)

### Problem
`orders.items jsonb` (`:10119`) + `order_items` (`:10003`); `products.variants jsonb` (`:10583`) + `product_variants` (`:10501`). RPCs write both; reads can diverge.

### Target design
Make the **normalized tables authoritative**; treat JSONB as a derived/read cache or remove it.
1. Audit every read of `orders.items` / `products.variants` (grep) and migrate to the relational tables.
2. Add a generated/maintained JSONB-from-relational path only if a denormalized read is needed, with a trigger keeping it in sync — never two independently-written sources.
3. Migration to backfill any rows where JSONB and relational disagree (reconciliation report first).

### Migration / Rollback / Testing / Acceptance
- `085_orders_items_reconcile.sql`, `086_products_variants_reconcile.sql`: report divergences, then converge.
- Rollback: keep JSONB columns until all readers are migrated; rollback = repoint readers back.
- Test: invariant test asserting relational and JSONB agree for a sample; fulfillment/reporting read the relational source.
- Acceptance: a single source of truth per entity; readers no longer depend on JSONB.

**Complexity:** L. **Risk:** High (touches checkout, fulfillment, reporting).

---

## P3-5 — Queue Storm Controls (COST-7 / reliability)

### Change
`queue-workers/src/index.ts:177` retries on every exception; retries 6–10 with concurrency 25 (`wrangler.toml:217-267`). Add:
1. Deterministic-error quarantine: validation/permanent failures go straight to DLQ, not retried 10×.
2. Per-queue budgets + circuit breaker (open on sustained DB failure).
3. Separate "trigger" queues from "DB-drain" queues so one CF message can't fan into 3 DB-queue drains unbounded (`platform-queue-consumer.ts:165`).

### Acceptance
A poison message or DB outage cannot multiply into unbounded retries/writes; deterministic failures quarantine fast.

**Complexity:** L. **Risk:** Med.

---

## P3-6 — `stores` View vs `sites` Table (MISSED-13)

### Change
`stores` is a `CREATE VIEW … FROM sites` (`:12240`), not a table. Audit for any write targeting `stores`; ensure INSTEAD-OF triggers exist or route writes to `sites`. Document the `sites`-canonical / `stores`-view contract in `docs/governance/` so future code doesn't write to the view.

### Acceptance
No code writes to the `stores` view without an INSTEAD-OF trigger; the contract is documented.

**Complexity:** S. **Risk:** Low.

---

## P3-7 — Safe Rollout of the Undeployed WS11–WS13 Stack (MISSED-12) — scalability + readiness risk

### Problem
~4,000 lines of GraphQL (`services/api-gateway/src/graphql/*`), the WASM checkout-function runtime (`extensions/*`), theme app blocks, and the LiquidJS renderer are wired into the production gateway (`index.ts:185-203`) but per `CODEX_WS11/12/13_STATUS.md` have **never been deployed or proven in a real environment**. Combined with the pipeline that can skip jobs (INFRA-1), this can reach production untested.

### Rollout plan (sequenced)
1. **Flag OFF in production** until proven (see P0-E): `FEATURE_GRAPHQL`, `FEATURE_EXTENSIONS`, `FEATURE_LIQUID` default off in prod.
2. Deploy to **staging** with flags ON; run the existing test suites (`tests/api-graphql/*`, `tests/app-platform/*`, `tests/theme-engine/*`, `tests/federation/app-extensions-quality-gate`) **against the deployed environment**, not just locally.
3. Resolve the GraphQL `cart` stub (`graphql/storefront.ts:524`, MISSED-14) before enabling storefront GraphQL for cart-dependent clients.
4. Apply P1-3/P2-3 (fan-out + N+1 fixes) before enabling GraphQL under load.
5. Graduated production enablement (internal merchants → beta cohort → general) with cost/latency dashboards watching the fan-out multipliers.

### Acceptance
WS11–WS13 features are enabled in production only after deployed-staging proof, the `cart` stub is resolved, and the fan-out cost fixes are in place.

**Complexity:** L (rollout) . **Risk:** High if skipped, Low if gated.

---

## Scale-Tier Readiness Summary
| Capability | 100 | 1,000 | 10,000 |
|---|---|---|---|
| Customer-auth safe (P0) | required | required | required |
| Edge cache + log sampling (P1/P2) | recommended | required | required |
| Pooled SQL (P3-2) | no | recommended | required |
| Partitioning/retention (P3-1) | no | partial (logs/telemetry) | required (all) |
| Projections for analytics/search (P3-3) | no | recommended | required |
| Dual-model consolidation (P3-4) | no | recommended | required |
| Queue storm controls (P3-5) | recommended | required | required |
| WS11-13 proven/gated (P3-7) | required (gated off) | as needed | as needed |

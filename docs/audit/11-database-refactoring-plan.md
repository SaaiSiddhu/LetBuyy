# 11 — Database Refactoring Plan (Phase 9)

Scope: Supabase Postgres 17.6 (canonical, 233 tables, `database/supabase/migrations/000_baseline.sql` + live `073–078`) and Cloudflare D1 (operational lineage only — correct separation, keep). Migration root per AGENTS.md: `database/supabase/migrations/` exclusively. All changes below ship as numbered forward migrations `079+` with paired verification scripts (pattern EXISTS in `database/supabase/verification/`).

---

## 1. Findings Register

| ID | Finding | Evidence | Sev |
|---|---|---|---|
| DB-01 | `products.store_id` **nullable**, and **no FK** `products.store_id → sites(id)` (FK absent from baseline FK section); `orders.store_id` nullable too | `000_baseline.sql` L10572 (products), L10110 (orders), FK list ~L20438 | CRITICAL |
| DB-02 | Dual tenant columns `store_id` + `site_id` on products/orders (both nullable) — split-brain tenancy | same | HIGH |
| DB-03 | Dual draft systems: `theme_editor_drafts` (legacy, no RLS listed) ∥ `theme_instance_drafts` + `theme_draft_patches`; `theme_preview_sessions` carries both `draft_id` and `theme_instance_draft_id` (schema comment admits migration-in-progress) | baseline | HIGH |
| DB-04 | Stale duplicate schema file: `apps/identity-platform/src/lib/db/schema.sql` redefines `users_custom`, `sessions`, `devices`, `verification_tokens` with fewer columns and RLS `FOR ALL USING (true)` | file vs baseline L13015/11694/8962/13032 | HIGH (if ever applied) |
| DB-05 | Missing hot-path indexes: `orders(store_id,status,created_at DESC)`, `orders(customer_email)`, `products(store_id,status)`, unique `products(store_id,slug)`, index on `products(sku)`, `carts(store_id,customer_id,status)` | baseline index defs | HIGH |
| DB-06 | `carts.customer_id` has **no FK** to `store_customers` | baseline L8633 | MEDIUM |
| DB-07 | No down-migrations anywhere; `000_baseline.sql` non-idempotent (raw pg_dump) | migrations dir | MEDIUM |
| DB-08 | `themes` table hard-delete only (no `deleted_at`) — violates AGENTS.md new-table rule | baseline L12895 | LOW |
| DB-09 | Unused-by-code tables (writers not found): `theme_migrations`, `app_billing_charges`, `theme_assets`, `inventory_level_duplicate_snapshots`, `smart_collections` (verify) | grep across services/apps | MEDIUM |
| DB-10 | `sites.template_config` JSON still read as fallback though `theme_releases.template_snapshot` is authoritative — config drift risk | `store-service.ts` precedence chain | MEDIUM |
| DB-11 | Event-sourcing tables present (`distributed_event_store`, `outbox_events`, `projection_store`, …) but thinly written — keep, monitor growth, add retention | queue-workers/gateway code | INFO |
| DB-12 | RLS relies on service-role bypass for workers; storefront customer tables fine, but any future direct-client access path must re-verify policies before exposure | baseline RLS sections | INFO |

## 2. Tenancy Hardening (DB-01/02 — CRITICAL path)

Decision: **`site_id` is canonical** (AGENTS.md: "tables use `sites`"); `store_id` retained as generated alias only during transition.

```
079_tenancy_backfill.sql      UPDATE products SET site_id = COALESCE(site_id, store_id);
                              UPDATE orders   SET site_id = COALESCE(site_id, store_id);
                              -- + carts, coupons, customers-adjacent tables sharing the duality
                              CREATE INDEX CONCURRENTLY ... (validation queries; row counts logged)
080_tenancy_constraints.sql   ALTER products  ALTER site_id SET NOT NULL,
                                ADD CONSTRAINT products_site_id_fkey  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT;
                              ALTER orders    same (RESTRICT — orders must never cascade-delete);
                              NOT VALID → VALIDATE CONSTRAINT two-step to avoid long locks
081_tenancy_dedup.sql         drop legacy store_id columns AFTER code cutover (Phase 1 of roadmap gates this);
                              interim: store_id kept as GENERATED ALWAYS AS (site_id) STORED is NOT possible for FK-named col → instead a compatibility VIEW per hot table if any external consumer remains
```
Preconditions: grep-confirmed zero writers of `store_id` without `site_id` (gateway writes both today via schemas — verify per route in doc 15 §5); orphan scan `site_id IS NULL` must return 0 before 080.

## 3. Identity Schema Cleanup (DB-04)

Delete `apps/identity-platform/src/lib/db/schema.sql` (doc 05 D1-adjacent; first confirm no bootstrap script applies it — grep shows no runner). If a local-dev bootstrap is wanted, replace with `supabase db reset` against canonical migrations. Add CI guard: validator asserting no `.sql` DDL files exist under `apps/**` (cheap addition to existing migration-safety validator).

## 4. Theme Draft Convergence (DB-03)

```
082_theme_draft_convergence.sql
  -- backfill: for each theme_editor_drafts row without instance-draft counterpart,
  --           create theme_instance_drafts (draft_status='active', config copied, version preserved)
  -- repoint:  theme_preview_sessions.theme_instance_draft_id = mapped id WHERE draft_id IS NOT NULL
083_theme_draft_drop_legacy.sql   (after gateway editor routes write only instance drafts — Phase 4 gate)
  DROP TABLE theme_editor_drafts;
  ALTER theme_preview_sessions DROP COLUMN draft_id;
084_theme_editor_additions.sql    (doc 08 §2)
  ALTER theme_instance_drafts ADD locked_by uuid NULL, ADD locked_at timestamptz, ADD base_release_id uuid REFERENCES theme_releases(id);
  ALTER theme_releases ADD scheduled_at timestamptz NULL, ADD published_by uuid, ADD release_notes text, ADD diff_summary jsonb;
  ALTER theme_package_versions ADD validation_report jsonb, ADD forked_from_version_id uuid NULL;
```

## 5. Index & Constraint Pack (DB-05/06/08)

```
085_commerce_indexes.sql   CREATE INDEX CONCURRENTLY
  idx_orders_site_status_created   ON orders(site_id, status, created_at DESC) WHERE deleted_at IS NULL;
  idx_orders_customer_email        ON orders(site_id, lower(customer_email));
  idx_products_site_status         ON products(site_id, status) WHERE deleted_at IS NULL;
  uq_products_site_slug            UNIQUE ON products(site_id, slug) WHERE deleted_at IS NULL;
  idx_product_variants_sku         ON product_variants(site_id, sku);   -- sku lives on variants; verify column
  idx_carts_site_customer_status   ON carts(store_id, customer_id, status);
  ALTER carts ADD CONSTRAINT carts_customer_fkey FOREIGN KEY (customer_id) REFERENCES store_customers(id) ON DELETE SET NULL;
086_soft_delete_themes.sql  ALTER themes ADD deleted_at timestamptz NULL; update unique/list queries accordingly
```
Rollout: `CONCURRENTLY` (no table locks), staging first with `EXPLAIN ANALYZE` before/after on the 5 worst merchant-dashboard queries (capture via `pg_stat_statements`).

## 6. Audit & Versioning Conformance Sweep

AGENTS.md mandates `id, created_at, updated_at, deleted_at, audit cols, RLS` on new tables. Sweep script (read-only, add to verification/) reporting tables missing `deleted_at`/`updated_by`/`version`: known offenders — `carts` (no version/updated_by — acceptable for ephemeral, document exception), `store_themes` (no deleted_at/version), `themes` (fixed by 086). New marketplace/extension tables (docs 09 §6, 10 §2/5: `developer_accounts`, `marketplace_sales`, `developer_payout_batches`, `app_oauth_grants`, `site_app_embeds`) ship fully conformant from day one — template migration `090_marketplace_payments.sql`, `091_app_oauth.sql`, `092_app_embeds.sql`.

## 7. Migration System Upgrades (DB-07)

- Adopt paired `*_down.sql` for every migration ≥ 079 (kept beside forward; CI smoke applies up→down→up on shadow DB).
- Add `migration-safety-validator` (EXISTS) rules: forbid `ALTER ... SET NOT NULL` without prior backfill migration; forbid non-`CONCURRENTLY` index on tables > 1M rows list.
- Keep `000_baseline.sql` frozen; never edit — new reset point only at major (e.g., `100_baseline_v2.sql`) post-Phase-9.
- Verification scripts numbered with their migration (e.g., `verification/079_tenancy_backfill_check.sql`) and wired into CI staging job (currently not run by any workflow — add to `deploy-staging.yml`).

## 8. Data Retention & Growth (DB-11)

Add retention jobs (gateway cron EXISTS): `runtime_telemetry_*` 30d, `worker_request_logs` 14d, `distributed_queue_messages` completed 7d, `webhook_deliveries` 90d, `theme_draft_patches` compact > 500/draft into snapshot. `retention_class` already modeled in distributed-runtime envelopes (`hot|warm|archive|legal-hold`) — wire to partitioned tables only if volume demands (defer partitioning; document trigger threshold 50M rows).

## 9. Table Disposition Summary (DB-09 + doc 05 §7)

| Table | Disposition |
|---|---|
| `theme_editor_drafts` | DROP at 083 |
| `theme_migrations` | KEEP — wired by doc 09 §4 update flow |
| `theme_assets` | KEEP — wired by doc 07 §9 |
| `app_billing_charges` | KEEP — wired by doc 10 (app billing later phase) |
| `inventory_level_duplicate_snapshots` | confirm writer absent → DROP in 087 |
| `smart_collections` | product decision: implement rules engine or DROP — flag to roadmap Phase 5 |
| `sites.template_config` | demote to NULL-able legacy after Phase 7 (releases authoritative); drop column Phase 9 |

## 10. Execution Order & Gates

079→080 (tenancy, **before any new feature work** — roadmap Phase 1) → 082 (draft backfill, Phase 1) → 084/085/086 (Phase 1–2) → 083 (Phase 4 gate: editor on instance-drafts only) → 087–092 (feature phases) → 081 + template_config drop (Phase 9). Every step: staging soak ≥ 48h, row-count + orphan checks logged to `d1_migration_lineage`-style audit (table EXISTS on D1; mirror a `schema_migration_audit` row in Postgres).

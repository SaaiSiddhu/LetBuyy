# LETBUYY — DATABASE & TENANCY AUTOPSY
### Phase 6 of the Foundation Autopsy · 2026-06-09 · evidence-only
### Question: does tenant isolation actually hold, or is RLS theater?

---

## 0. Verdict up front

**Tenant isolation does NOT hold. RLS is theater for the application path.** Isolation is enforced solely by application-layer `.eq('site_id'/'store_id', …)` predicates, with the database providing **no backstop** for the API's own traffic. The schema shows two warring eras: a sprawling **baseline** (`000_baseline.sql`, ~940 KB) where RLS is permissive/`USING(true)`/role-based, and a newer **`executable_*` layer (139–159)** that does tenancy *right on paper* — fail-closed GUC, FORCE, append-only ledger triggers, minor-units. But the good layer is never reached by the app, is OR-defeated on the crown-jewel tables, and is keyed to a GUC the application never sets.

---

## 1. Three independent proofs that RLS is non-load-bearing

### Proof 1 — the gateway connects as `service_role`, which is `BYPASSRLS`
`services/api-gateway/src/lib/supabase.ts:10-14`: `getSupabaseAdminFromEnv → createSupabaseServiceClient`, commented *"service role — bypasses RLS."* The adapter sends `SUPABASE_SERVICE_ROLE_KEY` as `apikey`+`Bearer` (`packages/infrastructure/supabase-adapter/index.ts:35,67-68`). **Usage census: 113 files in api-gateway use `getSupabaseAdmin`; the RLS-respecting `getSupabaseUser` is essentially unused for data routes.** With `BYPASSRLS`, **policies are never evaluated** — FORCE, GUC, and `USING(true)` are all irrelevant to live traffic.

### Proof 2 — the developers documented it themselves
`107_security_rls_hardening_and_payment_uniqueness.sql:16-19` states verbatim: *"the api-gateway connects with the Supabase service_role key, which BYPASSES RLS. These policy changes therefore only affect direct anon/authenticated PostgREST access … and cannot break gateway code paths."* The same migration's header records a prior incident where **"customer password hashes, session tokens, and password-reset tokens were readable with the public anon key"** because policies named "Service role…" omitted `TO service_role` and defaulted to `USING(true)`.

### Proof 3 — even without service_role, the crown-jewel tables are OR-defeated
PostgreSQL combines permissive policies with **OR**. `orders` carries both `service_role_orders ON public.orders USING (true) WITH CHECK (true)` (`000_baseline.sql:26690`, **no `TO` clause → applies to all roles**) and the newer `orders_tenant_site_guc` (`147:184`). Migration 147 drops only *itself* before recreating (`:183`) — it **never drops the baseline `service_role_orders`**. Effective predicate: `(true) OR (COALESCE(site_id,store_id)=current_site_id())` ≡ **always TRUE**. The GUC policy is cosmetically present and functionally void. Same pattern on `products` (`:26718`).

**The tenant GUC is also never armed.** `current_site_id()` (`139:8`) reads `current_setting('app.site_id', true)` (fail-closed by design — unset ⇒ NULL ⇒ row filtered). But an exhaustive search across `services/`, `apps/`, `packages/` for `set_current_site_id` / `app.site_id` / `SET LOCAL` finds **zero runtime call sites** — the helper is dead, and PostgREST-over-HTTP couldn't persist a `SET LOCAL` across the pool anyway. So `current_site_id()` is always NULL for API traffic.

---

## 2. Core-table policy reality (verbatim from migrations)

| Table | Policy | Verdict |
|---|---|---|
| `orders` | `service_role_orders … USING (true) WITH CHECK (true)` (`000_baseline.sql:26690`, no `TO`) | **permissive allow-all** |
| `orders` | `orders_tenant_site_guc … USING (COALESCE(site_id,store_id)=current_site_id())` (`147:184`) | GUC-backed but **OR-defeated** |
| `products` | `service_role_products … USING (true)` (`:26718`, no `TO`) | **permissive allow-all** |
| `carts` | `service_all_carts … TO service_role USING (true)` (`:26508`) | service_role allow-all |
| `payments` | `payments_tenant_site_guc … USING (site_id=current_site_id())` (`142:207`, FORCEd) | GUC-backed (but unreached) |
| `ledger_entries` | **No RLS. No ENABLE. No FORCE.** (`139:125` defines the table, never enables RLS) | **RLS absent entirely** |
| `inventory_levels` | `service_all_inventory_levels … TO service_role USING (true)` (`:26543`) | service_role allow-all; never FORCE |

Global counts: **427 `ENABLE ROW LEVEL SECURITY` vs 47 `FORCE` (~11%)**; **zero of 685 `CREATE POLICY` statements reference `current_setting` directly.** The §7 mandate ("ENABLE+FORCE + tenant-GUC on EVERY tenant table") holds for ~40 `executable_*` tables and fails for the entire baseline surface — `products`, `order_items`, `inventory_levels`, `collections`, `discounts`, and `ledger_entries`.

---

## 3. Ranked findings

### S0 — cross-tenant exposure / isolation bypass
- **S0-1 — App runs as `BYPASSRLS` service_role for ~100% of data access.** RLS is non-load-bearing; tenant isolation rests entirely on hand-written predicates. (`lib/supabase.ts:13`; 113 admin-client files)
- **S0-2 — Tenant GUC `app.site_id` is never set on any live connection.** The entire `executable_*` GUC-policy layer is unreachable; `current_site_id()` is always NULL for API traffic.
- **S0-3 — `service_role_orders`/`service_role_products` are role-agnostic `USING(true)` allow-all policies** (`000_baseline.sql:26690,26718`) — the exact bug class migration 107 was created to fix, still live. Any anon/authenticated PostgREST access (if the anon key leaks or a public endpoint is added) returns **all tenants' orders and products.**
- **S0-4 — `orders_tenant_site_guc` is OR-defeated** by the undropped baseline permissive policy (`147:183-188`). The new FORCE+GUC on orders is illusory.

### S1 — integrity / financial
- **S1-1 — `ledger_entries` has NO RLS at all** (`139:125`). The most sensitive table — the append-only money ledger — is entirely ungated at the row level.
- **S1-2 — Two incompatible money representations.** Orders use `numeric(12,2)` major-units (`109_orders_money_width.sql`; baseline `:5129-5130`) while the ledger uses `amount_minor bigint` (`139:132`); gift-card balance is declared `amount_minor integer` (`000_baseline.sql:8254` — overflows above ~₹2.1 crore). Same system, three unit systems → reconciliation drift.
- **S1-3 — `orders.store_id`/`orders.site_id` are nullable `uuid` with NO foreign key to `sites`.** NOT NULL is enforced only by app-level BEFORE triggers (`108`,`130`), not declarative constraints; referential integrity to the tenant is absent (contrast `ledger_entries.site_id uuid NOT NULL REFERENCES public.sites(id)`, `139:128`).

### S2 — governance / drift / rebuild
- **S2-1 — Production schema has diverged from migrations** (commit `0e3aa4c7`). `routes/app-store/schema-drift.ts:29` `missingColumnFromError()` parses *"column … does not exist"* errors and **retries the query with the offending column stripped** (`orders.ts`/`products.ts`). This masks drift instead of failing loudly: (i) it silently degrades responses (e.g. dropping a `deleted_at` filter → **soft-deleted rows resurface**); (ii) a clean rebuild from migrations yields a schema the code no longer expects; (iii) the true prod schema is now undocumented and unversioned.
- **S2-2 — Rollback coverage ~21% (19/89), and every recent security-critical migration lacks one** — no `.rollback.sql` for **107 (RLS hardening), 108 & 130 (orders tenant-key), 110 (FK hygiene), 111 (credential migration)**. Rollbacks exist only for the `executable_*` batch.
- **S2-3 — Duplicate migration number `129`** (`129_internal_os_executive_analytics_rollups.sql` and `129_mobile_customer_segments.sql`) → ambiguous apply order on a clean rebuild.
- **S2-4 — `audit_logs` is append-only by convention only** — no reject-mutation trigger (unlike `ledger_entries`/`gst_invoices`); with service_role, audit history is editable.

---

## 4. Inventory: duplication, constraints, append-only

- **Duplicate tenant keys (TD-7 unresolved):** every order stores the same UUID twice — `orders.store_id` and `orders.site_id`, kept in lockstep by `sync_orders_tenant_keys` which *rejects divergence* (`130:28`). `order_items` was retrofitted with a duplicate `store_id` too (`110:23`). The normalization toward a single `site_id` froze mid-migration.
- **`users` vs `users_custom`:** both exist (`000_baseline.sql:13095`, `:13116`); `users_custom` is live, bare `users` appears abandoned. `store_customers.password_hash` was migrated into `customer_credentials` (`111`) but deliberately retained — a third credential-state duplication.
- **Unique indexes — good where it counts:** `provider_payment_id` global uniqueness exists (`idx_payment_transactions_provider_payment_global`, `107:134`); idempotency keys are well-covered in `executable_*` tables.
- **Append-only — DB-enforced and real** for `ledger_entries`/`ledger_transactions` (reject triggers `139:360-376`) and `gst_invoices` (`144:131-141`). `audit_logs` is convention-only (S2-4). Caveat: append-only protects against mutation, not against cross-tenant reads (`ledger_entries` has no RLS).
- **Destructive-migration scan: CLEAN** — no `DROP TABLE`/`TRUNCATE`/`DROP COLUMN`/`DISABLE RLS` in any migration. A genuine positive.

---

## Verdict

The `executable_*` layer (139–159) does tenancy *right on paper* — fail-closed GUC, FORCE, append-only ledger triggers, minor-units, idempotency keys. But that good layer is (1) never reached by the app, which runs as BYPASSRLS service_role; (2) OR-defeated on the crown-jewel `orders`/`products` tables by undropped permissive baseline policies; and (3) keyed to a GUC the application never sets. **The §7 "layered isolation" collapses to a single layer: app-code predicates.** Today, the only thing standing between tenant A and tenant B's orders, products, carts, inventory, and ledger is a developer remembering to type `.eq('site_id', …)` — and migration 107's own header is the receipt that they have already forgotten once and leaked password hashes. Fix order: (1) stop using service_role for tenant data paths *or* actually set the GUC per request and rely on FORCE RLS; (2) drop the permissive `service_role_*` `USING(true)` policies; (3) enable RLS on `ledger_entries`; (4) replace the schema-drift swallow with a fail-loud migration reconciliation; (5) restore forward+rollback discipline and fix the duplicate-129 collision.

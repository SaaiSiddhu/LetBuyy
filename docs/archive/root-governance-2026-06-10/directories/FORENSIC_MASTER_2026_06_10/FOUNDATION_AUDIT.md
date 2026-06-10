# PHASE 3 — FOUNDATION AUDIT: Tenant Isolation, RLS & RBAC

**Repository:** `/Users/saai_sidd/Git/Letbuyy_Store`
**Audit date:** 2026-06-10
**Auditor role:** Principal multi-tenancy & data-isolation forensic auditor
**Scope:** Tenant isolation, Postgres RLS, service-role usage, app-layer guard, GUC bridge, route/worker tenancy, RBAC, ownership integrity.
**Working tree:** Audited as-is (uncommitted changes present). Prior audits (`FOUNDATION_FORENSICS_2026_06_09/`, `FOUNDATION_AUTOPSY/`, `FOUNDATION_STEPUP_LEDGER.md`) treated as hypothesis lists and re-verified on the current tree; FIXED vs OPEN status marked explicitly.

## Methodology

Evidence-only. Every claim carries a `path:line` anchor and, where load-bearing, quoted SQL/TypeScript. Claims that could not be proven from source (e.g. live Postgres GRANT state set by Supabase's managed bootstrap outside these migrations) are explicitly labelled **UNVERIFIED** or carry a stated caveat. No code was modified. Inputs examined:

- 91 migrations in `database/supabase/migrations/` (`000_baseline.sql` … `161_foundation_session_security.sql`) + `database/supabase/rollback/`.
- Constitution baseline `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §2.6, §3, §7 (required: layered fail-closed isolation = app-layer `store_id`/`site_id` predicate guard **+** RLS `ENABLE`+`FORCE` + tenant-GUC policy on **every** tenant table; unset GUC ⇒ zero rows; per-transaction `SET LOCAL` from validated JWT claims).
- `services/api-gateway/` (96 route/lib files using the DB), `services/queue-workers/`, `services/webhook-service/`, `packages/tenant-core/`, `packages/infrastructure/supabase-adapter/`.
- `scripts/validate-governance.mjs` + `scripts/validators/tenant-isolation-validator.mjs` + `app-utils-service-role-edge-validator.mjs`.
- `tests/executable/*-postgres.test.mjs` cross-tenant tests.

---

## Executive Verdict — the five questions

| # | Question | Answer | One-line proof |
|---|----------|--------|----------------|
| 1 | **Can data leak between tenants?** | **YES (S0)** | `000_baseline.sql:26718` `CREATE POLICY service_role_products ON public.products USING (true) WITH CHECK (true)` has **no `TO service_role` clause** → defaults to `TO PUBLIC`; with RLS enabled this grants the **anon** PostgREST role unrestricted read/write to **all merchants'** products (same unfixed pattern on `orders`, `sites`, `store_customers`, `subscriptions`, `billing_history`). |
| 2 | **Can merchant A access merchant B's data?** | **YES (S0)** | The same `USING(true)`-to-PUBLIC policies ignore ownership entirely; an authenticated merchant A (or any anon caller) reading `/rest/v1/orders` sees B's rows. Also `000_baseline.sql:26725` `service_role_sites USING(true)` lets any caller read **every** store row and overwrite ownership columns (`user_id`/`custom_user_id`) → account takeover. |
| 3 | **Can routes bypass tenant checks?** | **PARTIALLY** | The gateway's first-party routes are disciplined: every sampled merchant route verifies ownership (`verifySiteOwnership`/`verifyStoreOwnership`/`resolveOwned*Store`) before using a client-supplied `store_id`, and the runtime guard (`tenant-scoped.ts:88-93`) rejects any unscoped query on a registered table. **But** the guard checks predicate *presence*, not tenant-value *correctness* (`tenant-scoped.ts:60-77`), and tables absent from the registry pass through unguarded (`tenant-scoped.ts:119`). No route was found trusting a forged `store_id` without an ownership check, so this is a latent class risk, not a confirmed live route bypass. |
| 4 | **Can workers (queue-workers) bypass tenant checks?** | **YES (by design, S1)** | `services/queue-workers/src/platform-queue-consumer.ts:316` `const db = createSupabaseServiceClient(env)` — a **raw, un-guarded** service client; tenant scope is taken from the **job payload** (`:456` `const siteId = job.site_id || envelope.site_id`), with no predicate enforcement, no GUC, and no CI coverage. A forged/buggy job payload writes cross-tenant rows. |
| 5 | **Can service-role usage bypass RLS protection?** | **YES (by design)** | `database/supabase/migrations/107_*.sql:17-19` states the gateway "connects with the Supabase service_role key, which **BYPASSES RLS**." RLS is therefore not a backstop for any gateway/worker/webhook query; the only real second layer (the GUC fail-closed policy) is never engaged on the service-role path (the GUC is never set — see GUC Bridge Analysis). |

**LEAK: YES.** Concrete path exists end-to-end (Attack Walkthrough #1). The constitution's *layered* fail-closed isolation is, in production, effectively **single-layer** (app-layer ownership checks only); the RLS layer is both (a) bypassed by service_role on the trusted path and (b) misconfigured (PUBLIC `USING(true)`) on the untrusted anon path for the core commerce tables.

---

## RLS Coverage Matrix

Counts derived from `database/supabase/migrations/`:

- `ENABLE ROW LEVEL SECURITY`: **392 distinct tables** (essentially every public table, incl. all 261 registered tenant tables — the 21 executable tables enabled via `format('ALTER TABLE public.%I ENABLE …')` dynamic loops in 139/151/152/153/160).
- `FORCE ROW LEVEL SECURITY`: **41 distinct tables**, exclusively the `executable_*` / `139–160` set.
- `CREATE POLICY`: **688** total. **284** reference `auth.uid()`; **78** reference `public.current_site_id()` (the GUC); **40** baseline policies are `USING(true)` with **no `TO` clause** (= `TO PUBLIC`).

Representative rows (grouped by policy generation; behaviour is the load-bearing column):

| Table(s) | ENABLE | FORCE | Policy predicate | Fail-mode for anon/authenticated | Status |
|---|---|---|---|---|---|
| `ledger_entries`, `ledger_transactions`, `ledger_accounts`, `settlements`, `payouts`, `payout_items`, `reserves`, `recon_breaks`, `compensation_actions`, `outbox_consumptions` | yes | **yes** | `site_id = public.current_site_id()` (GUC) — `139:399-403`, `151:272` | **Fail-closed**: unset GUC ⇒ 0 rows (tested, `tests/executable/money-ledger-postgres.test.mjs:257-264`) | OK (but layer unused in prod — see FND-008) |
| `orders`, `fulfillment_orders`, `returns`, `order_risk_assessments`, `cod_confirmation_requests` | yes | **yes** (`147:173-181`) | GUC `site_id = current_site_id()` **plus** legacy baseline `service_role_orders USING(true)` PUBLIC still present (`000:26690`) | **Open** via the surviving baseline PUBLIC policy (RLS is permissive-OR; the broad policy widens) | **OPEN (S0)** — FND-002 |
| `payments`, `payment_attempts`, `payment_transactions`, `payment_credentials`, `payment_tokens` | yes | **yes** (`142:182-188`) | GUC | Fail-closed | OK |
| `checkout_sessions`, `store_branding`, `carts`, `coupons`, `discount_allocations`, `gst_invoices`, `tax_*`, `shipping_*`, `email_*`, `notification_*`, `wa_*`, `whatsapp_messages`, `media_assets`, `consents`, identity-v2 (`principals`,`credentials`,`sessions_v2`,…) | yes | **yes** | GUC or `service_role`+owner (`153:660-691`, `159:660-691`) | Fail-closed / service-role-only | OK |
| `devices`, `sessions`, `users_custom`, `verification_tokens`, `customer_credentials`, `notifications`, `theme_reviews`, `notification_preferences`, `contacts`, `projects`, `employee_permissions` | yes | no | `TO service_role` + `user_id = auth.uid()` (re-scoped) | Default-deny for anon | **FIXED by 107** |
| `marketplace_apps`, `app_developers`, `app_categories`, `app_extensions`, `app_installations`, `app_reviews`, `app_webhooks`, `app_api_quotas` | yes | no | `TO service_role` + owner/public-read (`103:156-242`) | Default-deny for anon | **FIXED by 103** |
| **`products`, `product_variants`, `product_options`** | yes | **no** | `service_role_products USING(true)` **PUBLIC** (`000:26704-26718`) + narrower owner/public-active policies | **Open** — anon read+write all rows | **OPEN (S0)** — FND-001 |
| **`sites`** | yes | **no** | `service_role_sites USING(true)` **PUBLIC** (`000:26725`) | **Open** — anon read all stores + write ownership cols | **OPEN (S0)** — FND-003 |
| **`store_customers`, `customer_activity_log`, `customer_wishlists`** | yes | **no** | `service_all_* USING(true)` **PUBLIC** (`000:26515-26571`) | **Open** — anon read all customer PII | **OPEN (S0)** — FND-004 |
| **`subscriptions`, `billing_history`** | yes | **no** | `service_role_* USING(true)` **PUBLIC** (`000:26627-26739`) | **Open** — anon read/write billing | **OPEN (S0)** — FND-006 |
| **`super_admin_allowlist`** | yes | **no** | `service_role_manage_allowlist USING(true)` **PUBLIC** (`000:26669`) | **Open** — anon **INSERT** → self-grant super-admin | **OPEN (S0)** — FND-005 |
| **`theme_purchases`** | yes | no | `FOR SELECT USING(true)` PUBLIC + `FOR INSERT WITH CHECK(true)` PUBLIC (`000:24148,24190`) | **Open** — anon read purchase PII + forge purchases | **OPEN (S1)** — FND-007 |
| `collections`, `collection_products`, `gift_cards`, `pages`, `onboarding_attempts`, `store_surveys` | yes | no | `service_role_* USING(true)` PUBLIC (`000:26627-26732`) | **Open** for anon | **OPEN (S1)** — FND-001 cohort |
| `wishlists` | yes | no | `"Anyone can manage their wishlists via API" USING(true)` (read) `WITH CHECK(store_id IN owned)` (`000:23831`) | Read open to anon; writes constrained | **OPEN (S2)** — FND-025 |
| `themes`, `plans`, `employee_roles`, `skill_endorsements`, `smart_collections` | yes | no | `FOR SELECT USING(true)` PUBLIC (`000:24141,24266,24273`; `25854`,`25913`) | Public read (catalog) — mostly intended | Accepted (FND-019/020) |
| `inventory_levels`, `inventory_reservations`, `inventory_adjustments` | yes | **no** | `auth.uid()` via `product_id IN (owned products)` (`000:27213,27285`) | Default-deny for anon | OK-ish, no GUC (FND-021) |

> **GRANT precondition (load-bearing caveat).** The PUBLIC `USING(true)` leak is exploitable **iff** the `anon`/`authenticated` PostgREST roles hold table-level `SELECT/INSERT` GRANTs. No `GRANT … TO anon` and **no `REVOKE`** appears anywhere in the migrations — grants are provisioned by Supabase's managed bootstrap outside this repo. The 107 migration header is direct first-party evidence that anon **did** have such grants in this deployment: it states the credential tables "were readable with the public anon key." Because Supabase grants are schema-wide (`anon` gets privileges on all `public` tables by default), the same grants cover `products`/`orders`/`sites`. The exact live grant state is **UNVERIFIED** (cannot run the production DB), but the documented evidence + Supabase defaults + absence of any REVOKE make the leak live with high confidence.

---

## Service-Role Bypass Register

Service-role clients (which bypass RLS) and whether they are tenant-guarded:

| # | Caller | Construct | Tenant-guarded? | Tenant predicate? | Verdict |
|---|---|---|---|---|---|
| SR-1 | `services/api-gateway/src/lib/supabase.ts:13-15` `getSupabaseAdminFromEnv` | `createTenantGuardedSupabaseClient(createSupabaseServiceClient(env))` | **YES** (Proxy guard) | Enforced at runtime for registered tables | OK — this is the canonical path used by 96 files |
| SR-2 | `services/api-gateway/src/middleware/auth.ts:132` | raw `createSupabaseServiceClient(c.env)` | **NO** | reads `users_custom`/`sessions` by id (auth tables) | Acceptable (identity tables, scoped by id) but un-guarded — FND-015 |
| SR-3 | `services/api-gateway/src/routes/auth.ts:1284` | raw `createSupabaseServiceClient(c.env)` | **NO** | auth/session flow | Acceptable, un-guarded — FND-015 |
| SR-4 | `services/api-gateway/src/routes/employee.ts:117` | raw `createSupabaseServiceClient(c.env)` | **NO** | employee/identity | Acceptable, un-guarded — FND-015 |
| SR-5 | `services/queue-workers/src/platform-queue-consumer.ts:316` | raw `createSupabaseServiceClient(env)` | **NO** | scope from **job payload** `job.site_id` (`:456,:599,:723`); some inserts (`notification_logs :605`, `partner_payout_ledger_entries :778`, `search_documents :938`) carry payload site_id without an `.eq` filter | **Cross-tenant-capable** — FND-010 |
| SR-6 | `services/webhook-service/src/index.ts` (`selectSupabaseRows`/`patchSupabaseRows`, PostgREST + `SUPABASE_SERVICE_ROLE_KEY` `:37`) | raw fetch with service headers | **NO** | `findOrderByPaymentCandidates :319-323` queries `orders` **globally** by `payment_id`/`id`, **no `store_id`** | Cross-tenant-capable by design — FND-011 |

**Queries through service-role lacking a tenant predicate (concrete):**
- `services/webhook-service/src/index.ts:319` `selectRows("orders", { or: payment_id.eq.X / id.eq.X, limit 1 })` — no `store_id`. (Mitigated by HMAC verify + global unique `provider_payment_id` from `107:135-137`.)
- `services/queue-workers/src/platform-queue-consumer.ts:560` `db.from('notifications').insert({...})` and `:605 notification_logs` / `:765-855 partner_payout_ledger_entries` / `:938 search_documents` — writes keyed by payload `site_id`, not validated against a tenant context.

The gateway path (SR-1) is the only one statically defended; SR-5/SR-6 are **outside** the `tenant-isolation-validator` scan (which only reads `services/api-gateway/src/`).

---

## App-Layer Guard Analysis

The V1-required query-lint / tenant-predicate wrapper **exists** and is **runtime-enforced** (not merely advisory):

- `services/api-gateway/src/tenant/tenant-scoped.ts:112-124` `createTenantGuardedSupabaseClient` returns a `Proxy` over `.from(table)`. For tables in the registry, `guardQueryBuilder` (`:79-110`) intercepts `then`: **if no tenant predicate was observed it returns a rejected promise** — `:88-93` `` Promise.reject(new Error(`Tenant table ${table} requires a tenant/owner predicate before execution`)) ``. This is a genuine **app-layer fail-closed** for registered tables.
- The registry is generated and CI-drift-checked: `services/api-gateway/src/tenant/tenant-tables.registry.ts` (header: "GENERATED by … generate-tenant-table-registry.mjs"), **261 tenant tables** (192 `site_id`, 68 `store_id`, 1 null).

**Limits (why it is not sufficient on its own):**
1. **Presence, not correctness.** `markScopeFromCall` (`tenant-scoped.ts:52-77`) only checks that a scope *column* appears in a predicate; the *value* is whatever the caller passes. A route doing `.eq('store_id', clientSuppliedId)` **passes** the guard regardless of ownership — tenant safety still depends on a separate `verifySiteOwnership` call. (FND-012)
2. **Registry-only coverage.** `tenant-scoped.ts:119` `if (!entry) return builder;` — any table not in the registry is returned **unguarded**. (FND-013)
3. **Owner columns count as scope.** `scopeColumns` include `user_id`/`developer_id`/`partner_id` (`tenant-tables.registry.ts:4`), so `.eq('user_id', x)` is treated as "scoped" even on a table whose real boundary is `site_id`. (FND-023)
4. **Not wired into workers/webhook.** Only `getSupabaseAdminFromEnv` wraps the client; SR-5/SR-6 use the raw client.

**CI enforcement (`scripts/validators/tenant-isolation-validator.mjs`):**
- Asserts registry == schema-derived (`:29-32`).
- Asserts `getSupabaseAdminFromEnv` wraps with the guard (`:48-52`).
- Asserts no platform-console god-mode / JWT-role bypass (`:57-68`).
- Scans **only `services/api-gateway/src/`** (`:42-45`) for the regex `getSupabaseAdmin(...).from('table')` (`:70`) and flags inline-chained registered-table access (`:78-89`).

**Can a dev write an unscoped query that passes CI?** Yes, with nuance:
- Unscoped query on a **registered** table → passes CI but **throws at runtime** (fail-closed). Good.
- Scoped-but-client-trusted value with no ownership check → passes **both** CI and runtime, and leaks. The guard does not catch this.
- Query in **queue-workers / webhook-service** → entirely outside the validator; no guard, no check.
- `const db = getSupabaseAdmin(c); db.from('orders')…` (variable form) is **not** matched by the `:70` inline regex (only `getSupabaseAdmin(...).from()` is), so the static scan misses the common form — it relies on the runtime guard, not the static check. (FND-014)

---

## GUC Bridge Analysis

The tenant GUC machinery is **defined but never executed at runtime** ("aspirational bridge"):

- Definition: `139_executable_foundation_ledger_core.sql:8-23` — `current_site_id()` = `NULLIF(current_setting('app.site_id', true),'')::uuid`; `set_current_site_id(p_site_id)` = `set_config('app.site_id', p_site_id::text, true)`.
- Bridge helper: `packages/tenant-core/src/index.ts:552-595` exports `TENANT_SITE_GUC='app.site_id'` and `tenantGucSetLocalStatement(siteId)` → `{ sql: 'SELECT set_config($1,$2,true)', values:[…] }`.
- Re-export: `services/api-gateway/src/lib/tenant-context.ts:58-60` `tenantSetLocalStatement`.

**Nobody calls it on a live path.** Grep across `services/**/!(__tests__)` shows the only runtime references are the *definitions/exports* above; there is **no execution** of `set_config('app.site_id', …)` or `set_current_site_id(...)` by any gateway/worker route. The data path is `packages/infrastructure/supabase-adapter/index.ts:34-39` `createSupabaseServiceClient` → **stateless PostgREST over HTTP**; PostgREST opens a pooled connection per request and there is no transaction in which a `SET LOCAL` GUC could persist. The only places `set_current_site_id` is invoked are:
- Inside `SECURITY DEFINER` SQL functions for their own arg-validation (`151_*.sql:23`, `160_*.sql:305`, `post_ledger_transaction` `139:250-253` which raises if `current_site_id() <> p_site_id`).
- The `tests/executable/*-postgres.test.mjs` harness (which connects as a dedicated non-service role to exercise the policy).

**Consequence (derived from the policy SQL).** The GUC-based policies (`139:399-403` `USING (site_id = public.current_site_id())`) are evaluated only for roles that do **not** bypass RLS. Production connects as `service_role`, which **bypasses RLS entirely** (`107:17-19`), so these policies never run in production. Were they to run with the GUC unset, `current_site_id()` returns NULL and `site_id = NULL` is never true ⇒ **zero rows** (fail-closed) — this is exactly what `tests/executable/money-ledger-postgres.test.mjs:257-264` asserts for the `executable_app_user` role. **Net:** the fail-closed second layer is *implemented and unit-proven* but *not deployed in the layered form*; production runs single-layer. (FND-008, FND-016, FND-027)

---

## Route Tenancy Register (sampled)

Routers mount **without** a global `storeContext()`; each route resolves tenancy itself (`services/api-gateway/src/index.ts:712-768`). Store/site derivation sampled across 30+ handlers:

| Route file / handler | Tenant source | Forgeable? | Ownership verified? | Verdict |
|---|---|---|---|---|
| `middleware/store-context.ts:74-95` `storeContext()` | param/`X-Store-ID`/query | client input | **YES** `verifySiteOwnership` `:95` | Safe |
| `middleware/rbac.ts:492-533` `requireStoreOwner()` | param/query/body `store_id` | client input | **YES** `verifySiteOwnership` `:524` | Safe |
| `routes/products.ts` (list/create/update/barcode/collections/gift-cards) | `query.store_id` / `body.store_id` | client input | **YES** `verifyStoreOwnership` `:459,547,595,637,714,780,822,864,905` | Safe |
| `routes/orders.ts` (list/get/update/cod) | `tenant.siteId` (validated) + `query.store_id` | mixed | **YES** `verifySiteOwnership` `:557,970`; list keyed `tenant.siteId` `:645` | Safe |
| `routes/stores-localization.ts` (markets/locales/translations) | `param('id')` | client input | **YES** `resolveOwnedLocalizationStore` `:354,390,428,462,…` | Safe |
| `routes/metafields.ts` (defs/values) | `query/body.store_id` | client input | **YES** `resolveOwnedMetafieldStore` `:296,345,369,408` | Safe |
| `routes/storefront/cart-routes.ts` (cart get/mutate) | resolved `PublishedStoreRecord` (host/param) + cart token | server-resolved | N/A (public) — writes bound `store_id: store.id`, `.eq('store_id', store.id).eq('session_id', cartToken)` `:394,413` | Safe (public storefront) |
| `routes/storefront/public-routes.ts` (catalog) | `param('storeId')` `:311,362,379` | client input | N/A — public read of published store catalog by design | Safe (intended public) |
| `routes/operations/*` (support, incident-command, risk, trust-safety, marketplace-reviews, developers) | platform-operator (cross-tenant by role) | n/a | **`requireRoleCategory('ops')` + `requireSuperAdmin` at router `.use('*', …)`** + per-route `requirePermission('scope')` (`support.ts:31,338…`; `incident-command.ts:21,207…`) | Safe + fine-grained |
| `routes/internal/*` (console, billing, events, store-access, custom-domain-reconcile) | `internalPerimeter` (server-to-server, mounted `index.ts:691`) | n/a | perimeter HMAC | Safe (server boundary) |
| Auth flows `routes/auth.ts:1314-1428` | anon client `supabase.auth.*` | n/a | Supabase auth | Safe (auth schema, not tenant tables) |

**No sampled route trusts a client-supplied `store_id`/`site_id` without an ownership check.** The merchant surface is consistently defended at the app layer; this is the platform's actual (and only) live isolation layer. Central tenancy middleware exists (`storeContext`, `requireStoreOwner`) but is applied ad-hoc per route via helper calls, not as a single default-deny gate — discipline-dependent.

---

## Worker & Job Tenancy

- **queue-workers** (`platform-queue-consumer.ts`): jobs claimed globally by `queue_name` (`claimJobs :409`) across all tenants with the **raw service client** (`:316`). Tenant scope is read from the job envelope/payload (`:456` `job.site_id || envelope.site_id`; `:599,:723` `payload.site_id || job.site_id`). Outbox-sourced jobs are server-authoritative (enqueued by the gateway with a validated `site_id`), so the payload is not normally attacker-controlled — but there is **no defense-in-depth**: no guard, no GUC, no CI check. A bug or any path that lets a client influence an enqueued `site_id` yields a cross-tenant write. (FND-010)
- **webhook-service** (`index.ts`): inbound PSP webhooks resolve the order **globally** by `payment_id` (`:319`) — necessarily cross-tenant (the provider does not know the tenant). Safety rests on HMAC signature verification + the global unique `payment_transactions(gateway, provider_payment_id)` (`107:135-137`), **not** on tenancy. (FND-011)
- Neither worker can be reached by the front-end app package graph (enforced by `app-utils-service-role-edge-validator.mjs:87-102`), so the forge surface is internal only.

---

## RBAC Matrix

RBAC is **scope-fine, not binary-admin** — this contradicts the prior memo's "role-coarse" note and is a positive finding.

| Mechanism | Source of truth | Enforcement | Evidence |
|---|---|---|---|
| `requirePermission(scope…)` | DB: `employees`, `employee_permissions`, `employee_roles`, `super_admin_allowlist`, `break_glass_grants` | Per-route decorator; 403 on missing scope | `middleware/rbac.ts:324-352`, `loadEffectivePermissionScopes :269-322` |
| `requireRole` / `requireRoleCategory` | **Server-side persistence only** (never JWT) | Router/route | `rbac.ts:407-486`; comment `:460-464` "never trust role claims carried on the JWT" |
| `requireStoreOwner` | `sites` ownership | Route | `rbac.ts:492-533` |
| `requireSuperAdmin` | `super_admin_allowlist` | Route | `rbac.ts:539-553` |
| Segregation-of-duty / dual-control | runtime | `checkSegregationOfDuty` for `merchant.suspend`,`refund.approve`,`payout.release`,`ts.reinstate`,… | `rbac.ts:181-208` |
| Scope wildcards | `*`, `prefix:*` | `scopeMatches` | `rbac.ts:113-124` |

- Operations routers consistently apply `requireRoleCategory('ops'), requireSuperAdmin` at `.use('*', …)` **plus** granular `requirePermission('support:view'|'incident:command'|'review:decide'|…)` per handler (e.g. `operations/support.ts:31,338,432,566`; `operations/incident-command.ts:21,255,529`; `operations/marketplace-reviews.ts:37,494,684`).
- JWT-role escalation is explicitly closed: `auth.ts:178-184` prefers `app_metadata` over user-writable `user_metadata`; `tenant-isolation-validator.mjs:61-68` asserts the platform-console token god-mode and JWT-role bypass are gone (**FIXED** vs prior audits).
- **Gap:** enforcement is decorator-by-decorator; there is no default-deny middleware that fails closed if a future operations route omits `requirePermission`. Merchant role scopes are stored in `site_roles`/`site_role_permissions` and resolved (`tenant-context.ts:101-145`) but the gateway's merchant routes mostly gate on **ownership** (owner = full access) rather than per-scope, so staff-vs-owner granularity on the merchant side is coarser than on the ops side. (FND-026)

---

## Ownership Integrity

- **`store_id` vs `site_id` duality (TD-7) — UNRESOLVED.** Both columns coexist on the high-value tables (`tenant-tables.registry.ts`: `orders`, `products`, `payment_transactions`, `order_items`, `media_assets`, `outbox_events`, `app_installations`, `contacts`, `projects`, `coupons` all list `scopeColumns:[site_id, store_id]`, `tenantColumn:site_id`). Code keeps them equal by writing the resolved `siteId` into **both** (`orders.ts:645` `.eq('site_id', tenant.siteId)` vs `:883` `.eq('store_id', tenant.siteId)`; cart writes `store_id: store.id` then checkout sets `site_id` `:549`). FK target: both reference `sites.id`. Risk: the guard accepts **either** column as scoping (`tenant-scoped.ts:60-61`), so any legacy row where `store_id ≠ site_id` could evade a single-column filter. (FND-017)
- **`users` vs `users_custom` duplication.** Auth resolves the app user via `users_custom` (`auth-user.ts:20-38`); both tables carry RLS. Not normalized toward `sites`/`site_id` as TD-7 requires. (FND-017)
- **FK integrity.** Tenant columns reference `sites(id)` with `ON DELETE CASCADE` on the executable tables (e.g. `139:40,77,101,128`). No orphaned tenant column (table with a tenant column but no FK) was found in the executable set; baseline tables were not exhaustively FK-audited (**UNVERIFIED** for the full 261).
- **`super_admin_allowlist` integrity is the sharpest ownership defect** — it is anon-writable (FND-005), so the platform-operator boundary itself is forgeable from outside.

---

## Attack Walkthroughs

### Attack #1 — Anon cross-tenant read of all orders & customers (S0, CONFIRMED path)
1. Attacker obtains the **public** `SUPABASE_ANON_KEY` (shipped to every storefront/admin browser for `supabase.auth`).
2. `GET https://<project>.supabase.co/rest/v1/orders?select=*` with `apikey: <anon>`.
3. PostgREST runs as role `anon`. RLS on `orders` is enabled, but policy `service_role_orders` (`000_baseline.sql:26690`) is `USING (true)` with **no `TO` clause** ⇒ applies to `PUBLIC` ⇒ `anon` row-visibility predicate is `true`.
4. Every merchant's orders return (customer name/email/phone, totals, payment ids). Repeat for `/rest/v1/store_customers`, `/rest/v1/sites`, `/rest/v1/subscriptions`, `/rest/v1/products`.
**Precondition:** `anon` holds a `SELECT` GRANT on these tables — directly evidenced for sibling tables by `107:5-8` ("readable with the public anon key"); Supabase grants schema-wide by default; no `REVOKE` exists. **Code path:** PostgREST → RLS policy `service_role_orders` (PUBLIC `USING(true)`). **Table:** `public.orders`.

### Attack #2 — Anon privilege escalation to platform super-admin (S0)
1. Attacker signs up as a normal Supabase user, obtaining an authenticated session and their `auth.uid()`.
2. `POST /rest/v1/super_admin_allowlist` with `{ "user_id": "<their uid>", "is_active": true }` and `apikey: <anon>`.
3. Policy `service_role_manage_allowlist` (`000_baseline.sql:26669`) is `USING(true) WITH CHECK(true)` to PUBLIC ⇒ insert succeeds.
4. Attacker now calls any gateway ops route. `hasOpsAllowlistEntry` (`rbac.ts:215-233`) finds their row ⇒ `requireSuperAdmin`/`requireRoleCategory('ops')` pass ⇒ full platform-operator powers (impersonation, payout review, T&S). **Code path:** PostgREST insert → `rbac.ts:215-233` allowlist check. **Table:** `public.super_admin_allowlist`.

### Attack #3 — Account / store takeover via `sites` write (S0)
1. With the anon key, `PATCH /rest/v1/sites?id=eq.<victimStoreId>` body `{ "user_id": "<attacker uid>", "custom_user_id": "<attacker uid>" }`.
2. Policy `service_role_sites` (`000_baseline.sql:26725`) `USING(true) WITH CHECK(true)` PUBLIC ⇒ update succeeds.
3. Attacker now "owns" the victim store: subsequent gateway calls pass `verifySiteOwnership` (`auth-user.ts:40-67`, which checks `user_id`/`custom_user_id` against `auth.uid()`) for that store. **Code path:** PostgREST update → ownership check now satisfied. **Table:** `public.sites`.

### Attack #4 — Worker payload tenant forge (S1, conditional)
- If any path enqueues a `platform_queue_jobs` row with an attacker-influenced `site_id`, the consumer (`platform-queue-consumer.ts:316,456`) processes it as that tenant with the raw service client (no guard/GUC) — e.g. inserting `partner_payout_ledger_entries` (`:778`) under a foreign `site_id`. No client-reachable enqueue path was confirmed, so this is **latent**, not proven live.

### Non-attack (proof of absence) — Gateway route forge
- Attempting to read merchant B's products through the gateway by passing `store_id=<B>` to `GET /products` fails: `products.ts:459` `verifyStoreOwnership(db, query.store_id, …)` returns false for a non-owned store ⇒ 403. The runtime guard would additionally reject an unscoped variant (`tenant-scoped.ts:88-93`). The gateway app layer holds; the leak is exclusively the **direct-PostgREST/anon** surface and the privileged worker/webhook processes.

---

## Findings Register

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| FND-001 | **S0** | RLS | `products`/`product_variants`/`product_options` anon read+write | `service_role_*` policy omits `TO service_role` ⇒ `USING(true)` to PUBLIC; never re-scoped (103/107 missed it) | `000_baseline.sql:26704,26711,26718` | All tenants' catalog readable/writable with public anon key | S | Add `TO service_role`; add owner+public-active policies; CI policy-lint forbidding `USING(true)` without a role/predicate |
| FND-002 | **S0** | RLS | `orders` anon read+write (overrides FORCE/GUC) | Surviving baseline PUBLIC `service_role_orders` widens RLS (permissive-OR) despite 147 FORCE/GUC | `000_baseline.sql:26690`; `147:173` | Cross-tenant order + customer PII + payment-id exposure | S | Drop/replace `service_role_orders` with `TO service_role`; same lint |
| FND-003 | **S0** | RLS / Ownership | `sites` anon read + ownership-column write → store takeover | `service_role_sites USING(true)` PUBLIC | `000_baseline.sql:26725` | Account/store takeover (Attack #3) | S | `TO service_role`; restrict writes; audit `user_id`/`custom_user_id` mutation |
| FND-004 | **S0** | RLS | `store_customers`/`customer_activity_log`/`customer_wishlists` anon read | `service_all_* USING(true)` PUBLIC | `000_baseline.sql:26515,26522,26571` | Bulk customer PII exfiltration | S | `TO service_role` + owner policy |
| FND-005 | **S0** | RBAC / RLS | `super_admin_allowlist` anon INSERT → platform super-admin | `service_role_manage_allowlist USING(true) WITH CHECK(true)` PUBLIC | `000_baseline.sql:26669`; consumed `rbac.ts:215-233` | Full platform-operator escalation (Attack #2) | S | `TO service_role`; deny anon writes; add INSERT trigger audit |
| FND-006 | **S0** | RLS | `subscriptions`/`billing_history` anon read+write | `service_role_* USING(true)` PUBLIC | `000_baseline.sql:26627,26739` | Billing tamper / plan-gate bypass / revenue data leak | S | `TO service_role` + owner policy |
| FND-007 | S1 | RLS | `theme_purchases` anon read PII + forge purchase | `FOR SELECT USING(true)` + `FOR INSERT WITH CHECK(true)` PUBLIC; 107 fixed siblings, not this | `000_baseline.sql:24148,24190` | Purchase-history PII leak; forged entitlements | S | Re-scope to `user_id = auth.uid()` (mirror 107) |
| FND-008 | S1 | Architecture | Layered isolation degrades to single-layer in prod | Gateway connects as `service_role` (bypasses RLS); GUC second layer never engaged | `107:17-19`; `supabase-adapter/index.ts:34-39` | No DB backstop; any forgotten ownership check = leak | L | Introduce an RLS-respecting (non-service) connection for tenant-scoped reads + `SET LOCAL app.site_id`; or accept app-guard-only and harden it as the *sole* layer |
| FND-009 | S1 | RLS | `FORCE` only on 41 (executable) tables | `ENABLE`+`FORCE`+GUC applied only in 139–160; baseline core tables `ENABLE`-only | grep: 392 ENABLE vs 41 FORCE; baseline `products` has no FORCE (`000:26718`) | Table-owner/definer paths bypass; constitution "every tenant table" unmet | M | Apply `FORCE` + GUC policy template (`tenant-core` `tenantRlsPolicyTemplate`) to all 261 registry tables; backfill migration |
| FND-010 | S1 | Workers | queue-workers raw service client, tenant from job payload | `createSupabaseServiceClient` un-guarded; scope = `job.site_id` | `platform-queue-consumer.ts:316,456,560,778` | Forged/buggy job ⇒ cross-tenant write | M | Wrap worker client in guard; assert payload `site_id` against the row's FK; add worker to CI scan |
| FND-011 | S1 | Workers | webhook-service global order lookup by payment_id, no tenant scope | Inbound PSP webhook is tenant-agnostic | `webhook-service/src/index.ts:319-323` | Cross-tenant confirm if payment_id collides/forged | M | Bind by `(gateway, provider_payment_id)` unique + verify HMAC before any write (partially present `107:135`) |
| FND-012 | S1 | App-guard | Guard checks predicate presence, not tenant-value correctness | `markScopeFromCall` matches column name only | `tenant-scoped.ts:52-77` | Route trusting client `store_id` passes guard | S | Keep guard; mandate ownership check; add lint requiring `verify*Ownership` adjacency for client-sourced ids |
| FND-013 | S1 | App-guard | Non-registry tables bypass the guard entirely | `if (!entry) return builder` | `tenant-scoped.ts:119` | Any misclassified tenant table is unguarded | S | Default-deny unknown tables, or generate registry to include all `public` tables with explicit allowlist of true-globals |
| FND-014 | S1 | CI | Tenant validator scans only api-gateway; inline-only regex | Scope `:42-45`; regex `:70` matches only chained form | `tenant-isolation-validator.mjs:42-45,70` | Workers/webhook unchecked; variable-form misses | S | Extend scan to `services/queue-workers`, `services/webhook-service`; AST-based predicate check |
| FND-015 | S2 | Service-role | Three raw service clients in gateway bypass guard | Direct `createSupabaseServiceClient` for auth/identity | `auth.ts:132,1284`; `employee.ts:117` | Un-guarded (auth tables, id-scoped) — low but unmonitored | S | Route through a guarded/`identity`-scoped helper or annotate as audited exceptions |
| FND-016 | S2 | GUC | Claims→GUC bridge is dead code | `tenantGucSetLocalStatement` never executed; PostgREST is stateless | `tenant-core/src/index.ts:558-595`; no runtime caller | The promised "validated-JWT→GUC" binding does not exist | M | Execute `SET LOCAL` on a transactional (non-PostgREST) connection driven by JWT claims, or delete the dead bridge to avoid false assurance |
| FND-017 | S2 | Ownership | `store_id`/`site_id` duality + `users`/`users_custom` unresolved (TD-7) | Dual columns kept equal in code, not normalized | `tenant-tables.registry.ts` (dual scopeColumns); `orders.ts:645,883` | Legacy `store_id≠site_id` rows can evade single-column filters | L | Normalize to `site_id`/`sites`; drop `store_id`; collapse `users_custom` |
| FND-018 | S2 | Migrations | Rollback coverage 21/91 | Only executable set (139–161) ships rollbacks | `database/supabase/rollback/` (21 files); 000–138 absent | Constitution forward+rollback unmet for legacy bulk | M | Backfill rollbacks for security-relevant migrations (esp. 103/107/108–111) |
| FND-019 | S2 | RLS | Role/permission catalogs public-read | `anyone_read_roles`/`anyone_read_plans`/`employee_permissions read` PUBLIC | `000:24266,24273`; `107:120-122` | Anon enumerates roles→permissions (recon) | S | Restrict `employee_roles`/`employee_permissions` reads to authenticated staff |
| FND-020 | S3 | RLS | `skill_endorsements`/`smart_collections` broad public read | Portfolio/storefront features `USING(true)` to anon | `000:25854,25913` | Intended public, but unbounded | S | Confirm intent; add `published`/`is_active` predicate |
| FND-021 | S2 | RLS | Inventory tables no FORCE, no GUC | Baseline `auth.uid()` via `product_id` subquery only | `000:27213,27285` | Oversell isolation rests on app-guard alone | M | Add `store_id`+GUC policy + FORCE |
| FND-022 | S3 | RLS | `media`/`media_assets` baseline lacks FORCE | Mixed baseline/executable ownership | `tenant-tables.registry.ts` (media_assets dual) | Signed-upload scoping app-layer only | S | FORCE + GUC on media tables |
| FND-023 | S2 | App-guard | Owner columns treated as tenant scope | `scopeColumns` include `user_id`/`developer_id`/`partner_id` | `tenant-tables.registry.ts:4`; `tenant-scoped.ts:60` | `.eq('user_id',x)` deemed scoped on site-bounded tables | M | Separate "tenant predicate" from "owner predicate"; require tenant column for tenant tables |
| FND-024 | S3 | App-guard | Guard coverage == generator detection accuracy | Registry auto-derived; misdetection ⇒ silent gap | `tenant-tables.registry.ts:1-2` | A mis-tagged tenant table is unguarded | S | Add a fail-closed assertion: any `public` table not explicitly classified ⇒ guarded by default |
| FND-025 | S2 | RLS | `wishlists` anon read (write-constrained) | `"Anyone can manage … via API" USING(true)` read; CHECK constrains writes only | `000:23831` | Cross-tenant wishlist read | S | Add `store_id IN owned` to `USING` too |
| FND-026 | S3 | RBAC | No default-deny on ops; merchant side owner-coarse | Per-route decorator discipline; merchant gate = ownership | `rbac.ts:324-352`; ops routers `.use('*', requireSuperAdmin)` | Future route omitting `requirePermission` fails open; staff≠owner granularity weak on merchant side | M | Add a default-deny ops gate; enforce `site_role_permissions` scopes on merchant routes |
| FND-027 | S3 | GUC | `set_current_site_id` not SECURITY-bound; unused in prod | Confirms FND-008/016; grantable to app roles in tests | `139:16-23`; `tests/executable/*:GRANT EXECUTE … set_current_site_id` | False sense of a live GUC layer | S | Document as test-only or wire properly; remove from prod assumptions |

---

## Status vs Prior Audits

- **`/api/auth/switch` takeover, platform-console god-mode, JWT-role escalation** — **FIXED** on this tree (`tenant-isolation-validator.mjs:57-68`; `auth.ts:178-184`).
- **107 credential anon-leak** — **FIXED** for devices/sessions/users_custom/verification_tokens/customer_credentials/notifications/theme_reviews/notification_preferences/contacts/projects.
- **103 app-marketplace anon policies** — **FIXED**.
- **Prior "RLS service_role bypass"** — **CONFIRMED & STILL OPEN**, but the live exploit is broader than service_role: it is **anon-PostgREST** on the commerce-core tables the 103/107 sweeps missed (FND-001..007). The GUC "second layer" the ledger waves added is real and unit-tested yet **does not run in production** (FND-008).
- **Prior "RBAC role-coarse"** — **PARTIALLY SUPERSEDED**: the ops surface is genuinely scope-fine with dual-control; the merchant surface remains owner-coarse (FND-026).

## UNVERIFIED / caveats
- **Live `anon`/`authenticated` table GRANT state** for `products`/`orders`/`sites`/`super_admin_allowlist` etc. is set by Supabase's managed bootstrap **outside** this repo and could not be run-verified. Strongly evidenced as present (107 header + Supabase defaults + zero REVOKE), but the live deployment should be checked with `\dp public.orders` (psql) or a probe query using the anon key before assigning final S0 confirmation.
- Full FK-orphan audit across all 261 baseline tenant tables was not exhaustive (executable set verified clean).
- No client-reachable path was confirmed that lets an attacker forge a `platform_queue_jobs.site_id` (FND-010 remains latent).

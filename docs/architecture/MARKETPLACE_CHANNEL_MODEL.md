# Marketplace Channel Model (MKT-0, 2026-09-04)

> The data model the marketplace channel runs on, under D-0 = A (`.claude/skills/letbuyy/references/decisions.md` §2, owner-approved 2026-09-04). This document describes what migration `217_marketplace_channel_listings.sql` creates and the rules every later phase inherits. It is **not** evidence that any route, app screen, moderation queue or checkout path uses it — the wiring status table in §9 is the only place that claim is allowed to change, and it changes only when the owning phase merges. Not a substitute for `LETBUYY_CONSTITUTION.md`.

## 1. Why this exists (measured, not assumed)

- `database/supabase/migrations/163_d2_live_data_leak_rls.sql:33` scopes every `products` read to `public.current_site_id()`. That is correct, and it means a cross-merchant marketplace feed has **no read path at all** today.
- `services/api-gateway` has no cross-store product route. The Dart `api_constants.dart` entries for `/products/featured` and `/products/search` match nothing on the gateway.
- 0 of the 145 tracked migrations define a channel listing, a moderation state, or a platform-owned taxonomy. The seller app's `approvalStatus` / `pendingAttributes` flow (System A, Firestore `products`) has no canonical home.
- The storefront already exposes a bounded public column set (`PRODUCT_SELECT_FULL`, `services/api-gateway/src/routes/storefront.ts:353`) with the filters `is_active = true and deleted_at is null` (`storefront.ts:706`) and a "published store" defined as `sites.status = 'published' and deleted_at is null` (`loadPublishedStore`). The marketplace must never expose more than the storefront does.

## 2. Principles this model is built on

1. **One product source, channel-specific listings.** A product is site-owned and stays exactly as it is. A `channel_listings` row per `(product, channel)` carries listing state, visibility, marketplace category, pricing policy and compliance flags. Selling on the storefront but not the marketplace, or an operator rejecting a marketplace listing without touching the product, are both one row.
2. **Two category trees, deliberately.** `product_categories` (existing, site-scoped, merchandising) stays the merchant's own. `marketplace_categories` is platform-owned discovery taxonomy with no `site_id`. They never merge.
3. **Tenancy is enforced by the database.** Both new tenant tables get `ENABLE` + `FORCE ROW LEVEL SECURITY` and a policy on `site_id = public.current_site_id()` for `app_tenant` and `authenticated`, exactly as `164_d4_tenant_role_guc.sql` and `163` do. Unset GUC ⇒ zero rows and no mutation. `verifySiteOwnership` at the gateway remains defence in depth.
4. **Exactly one cross-tenant read, designed and named.** `marketplace_feed()` is the only place a request can see approved listings from many sites at once. It is `SECURITY DEFINER`, returns an explicit column allowlist, and is the only object `anon` may execute. The tables themselves stay closed to `anon`.
5. **Moderation is append-only and realm-fenced.** Every status change writes a `channel_listing_moderation_events` row in the same transaction. Merchant-realm transitions and operator-realm transitions are different edges of one state machine, and the `app_tenant` role can never take an operator edge.
6. **Idempotent, lock-before-check.** `transition_channel_listing` takes `pg_advisory_xact_lock(hashtextextended(site_id || ':' || idempotency_key, 0))` **before** looking for an existing event, the pattern `206_*.sql:114` proved load-bearing for checkout.
7. **Search stays in Postgres.** `ILIKE` inside the function today, `tsvector` if measured demand ever justifies it. `services/search-service` is RESERVED and stays empty (Constitution).
8. **No money, no fee.** Nothing here posts to the ledger. `commission_bps = 0` is untouched (D-1). Pricing policy on a listing is a merchant display choice (for example "marketplace price = storefront price"), never a charge.

## 3. Entities (migration 217)

### 3.1 `marketplace_categories` — platform taxonomy (not a tenant table)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique not null | URL and API handle |
| `name` | text not null | |
| `parent_id` | uuid null → `marketplace_categories(id)` | tree |
| `position` | integer default 0 | sibling order |
| `is_active` | boolean default true | the only visibility switch |
| `metadata` | jsonb default `'{}'` | |
| `created_at`, `updated_at` | timestamptz | |

RLS: `ENABLE` + `FORCE`. Read policy `marketplace_categories_public_read FOR SELECT TO anon, authenticated, app_tenant USING (is_active = true)` — the shape `196_theme_rls_tenant_hardening.sql:56` uses for the public theme catalog; never `USING (true)`. No merchant-realm write policy exists; taxonomy content is an operator concern owned by ADM-1, and **this migration seeds no rows** (content is a product decision, not a schema one).

### 3.2 `channel_listings` — tenant table

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `site_id` | uuid not null → `sites(id)` | **the tenant key** |
| `product_id` | uuid not null → `products(id)` | |
| `channel` | text not null, `CHECK IN ('storefront','marketplace','instant')` | `instant` reserved for Phase 2 |
| `status` | text not null default `'draft'`, `CHECK IN ('draft','pending_review','approved','rejected','paused','delisted')` | |
| `visibility` | text not null default `'public'`, `CHECK IN ('public','hidden')` | merchant-controlled |
| `marketplace_category_id` | uuid null → `marketplace_categories(id)` | required to submit to `marketplace` (enforced in the RPC) |
| `pricing_policy` | jsonb default `'{}'` | merchant display policy, never a charge |
| `compliance_flags` | jsonb default `'{}'` | operator-set flags, read by ADM-1 |
| `submitted_at`, `approved_at`, `reviewed_at` | timestamptz null | |
| `reviewed_by` | uuid null | operator principal id |
| `rejection_reason` | text null | |
| `version` | integer not null default 1 | bumped by every transition |
| `created_by`, `updated_by` | uuid null | |
| `created_at`, `updated_at` | timestamptz | |

Constraints and indexes: `UNIQUE (product_id, channel)`; `(site_id, channel, status)`; `(channel, status, approved_at DESC, id DESC)` for the feed's keyset; `(marketplace_category_id)`.

Triggers: `channel_listings_site_matches_product` (BEFORE INSERT OR UPDATE OF `product_id`, `site_id`) raises unless `site_id = COALESCE(products.site_id, products.store_id)` for that product — a listing can never point at another tenant's product even through a forged id. `channel_listings_status_via_rpc` (BEFORE UPDATE OF `status`) raises unless the transaction-local setting `app.channel_listing_transition` equals `'rpc'`, which only `transition_channel_listing` sets; a direct `UPDATE … SET status` therefore fails, so no status change can skip the event log.

RLS: `ENABLE` + `FORCE`. `channel_listings_tenant_guc FOR ALL TO app_tenant, authenticated USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())`. The codebase's `service_role_*` policy shape from `163` is mirrored for parity with `products`; the gateway rule that tenant data is read inside `withTenantTx` as `app_tenant`, never through a blanket `service_role` client, is unchanged (`AGENTS.md`, `no-blanket-service-role-validator`).

Creating a draft listing is a plain `INSERT` under RLS from a tenant transaction (MKT-1's route); status must start at `'draft'` (default) and moves only through the RPC.

### 3.3 `channel_listing_moderation_events` — append-only, tenant table

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `site_id` | uuid not null → `sites(id)` | tenant key |
| `listing_id` | uuid not null → `channel_listings(id)` | |
| `from_status`, `to_status` | text not null | |
| `actor_realm` | text not null, `CHECK IN ('merchant','operator')` | |
| `actor_id` | uuid null | principal id in that realm |
| `reason` | text null | |
| `idempotency_key` | text not null | `UNIQUE (site_id, idempotency_key)` |
| `created_at` | timestamptz | |

RLS: `ENABLE` + `FORCE`; `FOR SELECT` and `FOR INSERT` policies on `site_id = public.current_site_id()` for `app_tenant, authenticated`; **no** update or delete policy, and `REVOKE UPDATE, DELETE … FROM PUBLIC, anon, authenticated, service_role, app_tenant` exactly as `165_d5_canonical_money_paths.sql:463` does for the ledger. The `ALTER DEFAULT PRIVILEGES` grant from `164:28` would otherwise hand `app_tenant` full DML on every new table, so the revoke is load-bearing, not decorative.

## 4. The state machine

```
                merchant: submit                 operator: approve
   draft ───────────────────────► pending_review ───────────────────► approved
     ▲                                  │                               │  ▲
     │ merchant: edit-and-resubmit      │ operator: reject              │  │ merchant: resume
     └──────────────────────── rejected ◄┘            merchant: pause   ▼  │
                                                                     paused
   any non-terminal ──── merchant: delist ────► delisted (terminal)
   approved ──────────── operator: take down ─► delisted (terminal)
```

| edge | realm | preconditions checked inside the RPC |
|---|---|---|
| `draft → pending_review` | merchant | `channel = 'marketplace'` requires `marketplace_category_id`; product `is_active` and `deleted_at IS NULL`; listing site = product site |
| `rejected → draft` | merchant | none beyond ownership |
| `approved → paused`, `paused → approved` | merchant | the listing was approved before; no re-review on resume (re-review after product edits is MKT-1/ADM-1 policy, see §10) |
| `draft \| pending_review \| approved \| paused \| rejected → delisted` | merchant | none |
| `pending_review → approved \| rejected` | operator | `rejected` requires a reason |
| `approved → delisted` | operator | takedown; reason required |

Every other edge raises `invalid_transition`. Terminal: `delisted`.

## 5. Functions (all `SECURITY DEFINER`, `SET search_path = pg_catalog, public`, extension calls schema-qualified)

### 5.1 `transition_channel_listing(p_site_id, p_listing_id, p_to_status, p_actor_realm, p_actor_id, p_reason, p_idempotency_key)`

Returns `(listing_id, from_status, to_status, event_id, replayed boolean)`.

1. Validate arguments (realm and status against their CHECK lists; empty key rejected).
2. `PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 0));` — **before** any lookup.
3. If an event with `(site_id, idempotency_key)` exists, return it with `replayed = true` and change nothing.
4. **Realm fence.** `merchant`: `public.current_site_id()` must equal `p_site_id` (fail closed; an unset GUC raises). `operator`: the caller's role must not be `app_tenant` and the GUC must be unset — an operator never acts inside a tenant transaction, and the only role a merchant request can run as can never take an operator edge. Two things that look like the right test are not: role *membership* (`service_role` is a member of `app_tenant`, `164:21`) and `current_user` (inside a `SECURITY DEFINER` function it is the definer, measured as `postgres` while the caller sat in `SET LOCAL ROLE app_tenant`). The caller's `SET ROLE` is read through `current_setting('role', true)`, which the executable test proves reflects it. Operator identity itself is asserted by the gateway (ADM-1); the database fences the role, not the person.
5. `SELECT … FROM channel_listings WHERE id = p_listing_id AND site_id = p_site_id FOR UPDATE`; missing ⇒ `listing_not_found` (same message for wrong site — no cross-tenant existence oracle).
6. Check the edge in §4; run its preconditions.
7. `SELECT set_config('app.channel_listing_transition', 'rpc', true)`; update the listing (status, `version + 1`, the timestamp for that edge, `reviewed_by`, `rejection_reason`); insert the event; return.

Grants: `EXECUTE TO app_tenant, authenticated, service_role`; `REVOKE … FROM PUBLIC, anon`.

### 5.2 `marketplace_feed(p_category_slug, p_search, p_limit, p_after_approved_at, p_after_id)` — `STABLE`

The one cross-tenant read. Returns **only** these columns:

| from | columns | bound by |
|---|---|---|
| `channel_listings` | `listing_id`, `approved_at` | this document |
| `products` | `product_id`, `name`, `slug`, `images`, `price`, `compare_price` | ⊆ `PRODUCT_SELECT_FULL` (`storefront.ts:353`) — the contract test asserts this. `currency` is deliberately absent: `PRODUCT_SELECT_FULL` names it, but no migration ever added it to `products` (105 added it to `marketplace_apps`), and the storefront only survives by falling back to `PRODUCT_SELECT_COMPAT`/`MINIMAL` (`storefront.ts:1089-1091`). A `SECURITY DEFINER` SQL function is validated at creation, so it cannot reference a column that does not exist. INR is the platform currency. |
| `sites` | `site_id`, `store_name`, `subdomain` | what every storefront URL already reveals |
| `marketplace_categories` | `category_slug` | public taxonomy |

Filters, mirroring the storefront exactly: `cl.channel = 'marketplace' AND cl.status = 'approved' AND cl.visibility = 'public' AND p.is_active = true AND p.deleted_at IS NULL AND s.status = 'published' AND s.deleted_at IS NULL AND (p_category_slug IS NULL OR mc.slug = p_category_slug) AND (p_search IS NULL OR p.name ILIKE '%' || escaped(p_search) || '%')`. Order `approved_at DESC, id DESC`; keyset `(approved_at, id) < (p_after_approved_at, p_after_id)` when both are given; `p_limit` clamped to `1..100`. No `products.status = 'active'` filter — the storefront does not apply one and the marketplace must not invent a stricter or looser rule than the storefront.

Grants: `EXECUTE TO anon, authenticated, app_tenant`; `REVOKE … FROM PUBLIC`. Because the function is `SECURITY DEFINER`, RLS on the three tables stays `FORCE`d and `anon` still gets zero rows from a direct `SELECT` on any of them — the executable test proves both halves.

Why a function rather than a view or a `service_role` query in a route: the column set is server-authoritative and reviewable in one place; the function is edge-cacheable per `(category, search, cursor)` with the same `cachedJson` wrapper the storefront uses; and it is the single object a future validator can pin as "the only anon-executable function that joins tenant tables".

## 6. Tenancy and security proofs (executable, on a throwaway container)

`tests/executable/marketplace-channel-listings-postgres.test.mjs`, following `tenant-redteam-postgres.test.mjs`'s `SET ROLE app_tenant` + `set_config('app.site_id', …, true)` pattern and `notification-preferences-upsert-postgres.test.mjs`'s programmatic fixture extraction:

1. As `app_tenant` with the GUC unset: `SELECT` on both tenant tables returns 0 rows; `INSERT`, `UPDATE`, `DELETE` affect 0 rows.
2. As `app_tenant` with site A's GUC: site B's listing is invisible; inserting a listing for site A that points at site B's product raises (trigger).
3. Two sites, two approved marketplace listings, one rejected, one paused, one on an unpublished site, one on an inactive product: `marketplace_feed()` returns exactly the two, and the returned column names equal the allowlist in §5.2.
4. As `anon`: `marketplace_feed()` executes; `SELECT FROM channel_listings` yields 0 rows or permission denied.
5. `transition_channel_listing` with the same key twice: one row change, one event, second call `replayed = true`; an illegal edge raises and writes nothing; a merchant-realm call as `app_tenant` for an operator edge raises; a direct `UPDATE channel_listings SET status` raises (trigger).
6. Apply 217, apply its rollback: both tables, the trigger functions and both RPCs are absent; `products`, `sites` and their policies are byte-identical to before.

Each assertion group is first observed **failing** against a planted regression in a scratch copy (drop `FORCE`; widen the feed's column list; remove the `status = 'approved'` filter; drop the advisory lock; drop the status trigger) and the failure message is recorded under `~/.letbuyy/run/marketplace-merge/logs/`.

`tests/contracts/marketplace-channel-model-contract.test.ts`: parses migration 217's `marketplace_feed` `RETURNS TABLE` list and asserts the product-derived names ⊆ the `PRODUCT_SELECT_FULL` constant read from `storefront.ts`; asserts both tenant tables appear in `services/api-gateway/src/tenant/tenant-tables.registry.ts` with `tenantColumn: "site_id"`; asserts the migration contains `FORCE ROW LEVEL SECURITY` for both.

## 7. Registry and validators

`scripts/generators/generate-tenant-table-registry.mjs` derives tenant tables from any `site_id` / `store_id` column in `CREATE TABLE` or `ALTER TABLE … ADD COLUMN` across the migrations (`scripts/governance/tenant-registry-common.mjs:51`). `channel_listings` and `channel_listing_moderation_events` therefore enter the registry by running the generator; `marketplace_categories`, having no tenant column, correctly does not. The regenerated file is committed in this phase so `tenant-isolation-validator` stays green; it is never hand-edited. `sequential-migration-validator` requires 217 as the next number with no gap.

## 8. Rollback

`database/supabase/rollback/217_marketplace_channel_listings.rollback.sql` drops, in reverse dependency order, the two functions, the two triggers and their functions, the policies, the three tables and their indexes. It has no data precondition: if rows exist they are dropped with the tables, which is the correct meaning of "restore the 216 state" for a foundation that nothing is wired to yet. The executable test in §6.6 proves the round trip.

## 9. Wiring status — the only place a "done" claim may live

| capability | phase | status |
|---|---|---|
| Schema, RPCs, rollback, registry, tests (this document) | MKT-0 | MERGED into `develop` as `e8dfacb6` (2026-09-04) |
| Gateway routes: `/channel-listings` (list, create draft, get, patch, `POST /:id/transition` — merchant edges only, inside the tenant transaction) and `GET /storefront/marketplace/feed` + `/categories` calling `marketplace_feed` / the live taxonomy behind the storefront cache wrapper | CAP-MKT-1 | BUILT on `letbuyy/mkt1-marketplace-routes` (2026-09-04); closed at merge (`EXECUTION_LEDGER.md` PHASE-MKT-1). Not yet exercised over HTTP against a real database (D-DEV-DB-217). |
| `customer_app` marketplace home / category / search on `/v1/marketplace/feed` | CAP-CUS-1 | OPEN |
| Operator routes `/operations/marketplace-listings` (list, inspect, approve / reject / take-down as the operator realm, `review:view` / `review:decide`, audit row per decision) | CAP-ADM-1 | BUILT on `letbuyy/adm1-listing-moderation-routes` (2026-09-04); closed at merge (`EXECUTION_LEDGER.md` PHASE-ADM-1). Not yet exercised over HTTP against a real database (D-DEV-DB-217). |
| Operator routes `/operations/marketplace-categories` (list incl. inactive, create, update — rename/reparent/reposition/activate-deactivate; no `DELETE`, both FKs onto this table are `ON DELETE RESTRICT`) | CAP-ADM-2 (router half) | BUILT on `letbuyy/adm3-marketplace-categories-routes` (2026-09-05); closed at merge (`EXECUTION_LEDGER.md` PHASE-ADM-3). Not yet exercised over HTTP against a real database (D-DEV-DB-217). |
| `admin_web` moderation queue screen (both listings and categories) | CAP-ADM-2 (screen half) | OPEN — needs a console session and a database carrying 217 |
| `purchases` + child `orders` behind the D-3 single-merchant flag | CAP-CHK-1 | OPEN |
| Firestore `products.approvalStatus` / `sellers` → `channel_listings` / `sites` data migration | MIG-1 | OPEN |

Nothing in this table moves to "done" from inside MKT-0.

## 10. Open questions this model does not answer (recorded, not decided)

- **Re-review after product edits.** When an approved product's name, images or price change, does the listing drop back to `pending_review`? Today the model allows the merchant to keep selling; MKT-1/ADM-1 decide the policy and may add a `content_hash` comparison. Not a schema change.
- **Taxonomy content and depth.** No rows are seeded; the tree shape supports any depth. Product decision.
- **Operator identity in the database.** The realm fence stops `app_tenant` from taking operator edges; naming the operator (`actor_id`) is the gateway's responsibility until the operator realm has its own database role, which is an ADM-1 question.
- **D-FEAT-EXTRA** (decisions.md §6): the unnamed extra seller feature may need a listing attribute; unknown until named.

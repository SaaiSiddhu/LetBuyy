# Phase 6 — Tenancy Graph

**Multi-tenant isolation subgraph. Code centrality from `graph.json`; isolation guarantees from code+SQL audit.**

## The tenancy spine (by graph degree)
- **`getSupabaseAdmin()` — degree 170** (`services/api-gateway/src/lib/supabase.ts`): the service-role client factory, wrapped by `createTenantGuardedSupabaseClient` (deg on `supabase.ts` file node = 118). Every tenant DB access funnels here.
- **`resolveOwnedStoreId()` — degree 171** (`apps/merchant-control-plane/src/lib/stores/`): merchant store-scope resolver, depended on by the entire merchant control plane.
- **`createMerchantApiClient()` — degree 187**: binds every merchant call to the resolved store.
- Tenancy keyword subgraph: **342 code nodes, total degree 1,140** (site_id/tenant/rls/store_id) — the second most cross-cutting concern after payments.

## Tenant entities
| Entity | Graph representation | Isolation |
|---|---|---|
| Site / Store | `site_id`/`store_id` referenced across 342 nodes | RLS + GUC (SQL); `verifySiteOwnership` checks `sites.custom_user_id` |
| Merchant | `apps/merchant-control-plane` (1,293) + identity ES256 | owner-only; `site_memberships` RBAC computed-not-enforced |
| Customer | `packages/auth-core` HS256 realm | store-scoped customer sessions |
| Tenant context | `tenant-context.ts`, `tenant-scoped.ts`, `packages/tenant-core` (123) | Proxy rejects untenanted registry queries |

## Missing-check analysis (graph + audit)
- **Graph method:** find route/handler nodes that do **not** have a path to `verifySiteOwnership`/`resolveTenantContextForOwnedSite`. 
- **Audit result (authoritative, certification Phase C):** **0 genuine ownership gaps across 87 route files**; `verifySiteOwnership` present in 38 route files, the rest are public-by-design or resolve-then-verify. Two low notes only (notifications `actor_id`, `/storefront/directory` lists draft stores).
- **Potential leaks:** none confirmed at HEAD. The historical anon-leak/`USING(true)` issues are closed except 4 **frozen** marketplace tables (`mig 100:133–155`) with no PII/money and no anon write path.

## The graph's tenancy limitation
RLS — the enforcement floor — is **SQL and therefore absent** (2 DB nodes). The graph proves the *application* consistently routes through the tenant-guard primitives (high centrality, no orphaned guards), but the *database* enforcement layer (forced RLS, GUC, `app_tenant` role) is only in the migrations + validators. **Tenancy certification therefore requires both:** the graph (app routes through guards) + the migrations/validators (DB enforces). Neither alone is sufficient; together they show fail-closed isolation.

## Recommendation
Enable SQL indexing so RLS policies become nodes, then `graphify path "<tenant table>" "FORCE ROW LEVEL SECURITY"` can verify every tenant table has a forced policy from the graph — closing the one tenancy blind spot.

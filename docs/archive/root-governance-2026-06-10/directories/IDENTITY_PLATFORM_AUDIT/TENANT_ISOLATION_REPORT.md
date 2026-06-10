# TENANT ISOLATION REPORT
### Phase 7 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## 0. Verdict

Tenant isolation is **real today but has no safety net**. There is exactly **one enforcement layer**: per-route application predicates (`verifySiteOwnership` and `.eq('site_id', …)`) executed over a **`service_role` connection that bypasses Postgres RLS**. The advertised database-level guard — a JWT-claims→`set_config(app.site_id)` GUC bridge with RLS policies — exists only as **un-executed string-builders and test assertions** (dead code). The result: where the per-route check is present it is correct, but **a single forgotten check is an immediate full cross-tenant IDOR**, and the `/api/auth/switch` bug (Phase 6 C-1) is a tenant escape by construction. The one genuinely robust boundary is **buyer-vs-merchant**, enforced by separate cookie realms.

---

## 1. Tenant ownership model

| Tenant type | Owned by | Check | Evidence |
|---|---|---|---|
| Store / site | merchant user (`custom_user_id` or `user_id`) | `verifySiteOwnership(siteId, uid)` | `services/api-gateway/src/lib/auth-user.ts:40-67` |
| Organization | (app-layer; org-core is interface-only) | none enforced centrally | `packages/organization-core/src/index.ts` (stub) |
| Customer (buyer) | host-only session realm | cookie scope | `packages/auth-core/src/index.ts:693-764` |
| Staff/employee (merchant) | store owner; **owner-or-nothing** | `verifySiteOwnership` only | `services/api-gateway/.../employee.ts` (no per-scope RBAC) |
| Staff (ops/platform) | DB-backed scopes + break-glass | real RBAC | `services/api-gateway/src/middleware/rbac.ts:273-361` |

```ts
// services/api-gateway/src/lib/auth-user.ts:40-67  (the primary tenancy control)
const { data } = await db.from('sites')
  .select('id')
  .eq('id', siteId)
  .or(`custom_user_id.eq.${uid},user_id.eq.${uid}`)   // ownership predicate
  …
```

---

## 2. The missing safety net (dead RLS/GUC bridge)

- The gateway connects as **`service_role`** (BYPASSRLS): `packages/infrastructure/supabase-adapter/index.ts:34-39`; `services/api-gateway/src/lib/supabase.ts:10` ("service role — bypasses RLS").
- The RLS-respecting client `getSupabaseUser` (`lib/supabase.ts:23-25`) has **zero callers** — confirmed by grep. `getSupabaseAdmin` (BYPASSRLS) is used in ~99 gateway files.
- The tenant-GUC bridge is **never executed**: `tenantGucSetLocalStatement` (`packages/tenant-core/src/index.ts:590-595`) only *returns* a `SELECT set_config(...)` string; `requireSiteIdPredicate`/`tenantRlsPolicyTemplate` (`:597-629`) build strings/throw. The re-exports in `services/api-gateway/src/lib/tenant-context.ts:58-64` are referenced **only** by `__tests__/tenant-isolation.test.ts:27-28`, which asserts the source *contains* the function — not that it runs. No `set_config('app.site_id', …)` or `SET LOCAL` executes on a live connection anywhere.

**Conclusion:** there is no defense-in-depth. The database will happily return any tenant's rows; only the application predicate stands between tenants.

---

## 3. Tenant boundaries — where they hold and where they don't

**Hold (verified):**
- **Buyer ↔ merchant**: different cookie (`lb_customer_session` host-only vs `lb_session` parent-domain), different secret, different realm, different middleware — the strongest boundary in the system (`cookies.ts:33-54`).
- **Ops RBAC**: the platform plane enforces stored `employee_permissions` scopes + segregation-of-duty + dual-control (`rbac.ts:185-212, 273-361`).

**Do not hold / at risk:**
- **C-1 tenant escape**: `/api/auth/switch` mints a session for any verified email (`switch/route.ts:61-64`) — a direct cross-tenant/account escape (Phase 6).
- **Merchant staff RBAC**: owner-or-nothing; the merchant `requirePermission` is **plan-gating, not access control** (`services/api-gateway/src/middleware/permission.ts:1-4, 29-78`). A store's staff model cannot express least-privilege.
- **One-missing-check IDOR**: ~60+ route files each hand-roll `verifySiteOwnership`/`site_id` filters with no backstop; the sampled routes are correct, but the architecture guarantees that the *first* omission is a full cross-tenant read/write.

---

## 4. Risk register (tenant)

| Risk | Likelihood | Impact | Driver |
|---|---|---|---|
| Cross-tenant IDOR from a single missing predicate | Medium (grows with every new route) | Critical | H-1 / no RLS net |
| Account/tenant takeover via `/switch` | High (trivial) | Critical | C-1 |
| Privilege over-grant in merchant staff | Medium | High | no per-scope RBAC |
| Org-level isolation undefined | Medium | Medium | org-core stub |

---

## 5. Recommendations (analysis-only)
Make the database a second line of defense: either run tenant-scoped reads through an RLS-respecting role with the GUC bridge actually executed (`SET LOCAL app.site_id` per transaction) — i.e. wire the dead `tenant-core` statements into the live connection — or introduce a mandatory query-builder wrapper that refuses unscoped tenant queries. Replace merchant owner-or-nothing with real per-staff scopes (the ops `rbac.ts` engine is the model). And fix C-1, which is a tenant escape regardless of the data layer. Do not expose SSO to additional clients until a safety net exists, because SSO multiplies the number of services that can forget the check.

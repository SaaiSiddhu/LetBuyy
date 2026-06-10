# PERMISSION ARCHITECTURE (enhancement)
### 2026-06-09 · ANALYSIS-ONLY · enhancement-delta over `docs/auth/2026-06-08-identity-platform-transformation/PERMISSION_MODEL.md`

> **Relationship to the corpus.** `PERMISSION_MODEL.md` already defines the ReBAC→RBAC→ABAC split, the naming convention, the representative catalog, the unified role catalog, inheritance/deny-override, delegation, temporary access, impersonation, token claims, and the step-up map. **Strong; not rebuilt.** This document designs the six things it names-but-doesn't-design or omits: the four **registries** (Permission/Role/Scope/Policy) with governance, the **ReBAC caching + invalidation + check-API SLO** (the hot path — the single biggest scale gap), the **plan→ABAC entitlement contract**, the **customer-realm authorization plane + B2B buyer roles**, the **dev/sandbox isolation axis**, and **field/row-level scoping** + delegation∘impersonation composition.

---

## 1. The four registries (NEW — closes catalog-governance gap M-4)

| Registry | Holds | Owner | Versioning | Who may write |
|---|---|---|---|---|
| **Permission Registry** | `<resource>.<action>[.<qualifier>]` atoms + metadata (realm, scope-axis, sensitivity/aal) | Commerce (catalog) | semver; **append-only** atoms; renames go through alias map | platform engineers via PR + governance gate (`IDENTITY_GOVERNANCE_MODEL §5`) |
| **Role Registry** | system roles (`is_system`) + per-org custom roles | Commerce (system) / Identity-assignment (custom) | per-role version; custom roles namespaced by `org_id` | platform (system); org Admin (custom, bounded) |
| **Scope Registry** | scope axes `org\|brand\|store\|team\|sandbox\|company\|platform` + how each maps to a claim | Identity | additive only | platform |
| **Policy Registry** | ABAC policies (conditions → effect) | Commerce (resource) / Identity (risk) | versioned, testable | platform; per-org overrides bounded |

**Governance rule:** a permission atom may be **deprecated but never deleted** (deletion breaks tokens/roles in flight); renames emit a permanent alias so old tokens resolve. Custom-role creation is rate-limited and lint-checked against the registry to prevent sprawl across 100k merchants.

---

## 2. Decision algorithm (reaffirm corpus, then make it operable)
Keep the corpus's 5-step resolution (expand roles → additive grants → deny-overrides → ABAC → ALLOW/DENY/STEP_UP, `PERMISSION_MODEL §6`) and **deny-overrides precedence**. The corpus stops there; §4–§6 below make it run at scale.

---

## 3. (reserved — see §1 registries; role lifecycle)
Custom-role lifecycle: `draft → active → deprecated → retired`; retiring a role re-resolves affected memberships to a fallback role and audits each change. Catalog migrations ship behind the alias map with a shadow-compare window (`PERMISSION_MODEL §13`).

---

## 4. ReBAC caching, invalidation & check-API SLO (NEW — closes G-A, the hot path)
The corpus says only "check-API cached with short TTL + event invalidation." At 100k-merchant QPS that is the difference between a working platform and an outage. Design:

**Decision cache**
- **Key:** `(principal_id, resource, action, scope_id)` → `ALLOW|DENY|STEP_UP` + `decided_at` + `policy_version` + `perms_digest`.
- **Two tiers:** in-process LRU (per gateway node, ms TTL ~5s for hot keys) → shared Redis (TTL ~60s) → authoritative resolve.
- **Negative caching** for DENY (same TTL) to blunt probing; **STEP_UP not cached** (must re-evaluate `acr`).

**Invalidation (event-driven, precise)**
| Event | Invalidates |
|---|---|
| membership add/remove/role-change | all keys for that `(principal_id)` (cheap: principal-prefixed) |
| org role-catalog edit | all keys for `(org_id)` scope (versioned: bump `org.policy_version` → lazy invalidation, no mass purge) |
| delegation grant/revoke | keys for the grantee principals × grantor scope |
| plan/entitlement change | keys whose decision depended on an ABAC plan condition (tag decisions with `depends_on:[plan]`) |
| permission registry version bump | global lazy invalidation via `policy_version` compare (no purge storm) |

**`perms_digest` lifecycle:** the token carries a digest of the principal's effective grants; if the gateway's cached `policy_version` > the token's digest era, the decision re-resolves (closes the stale-claims hole). This is the mechanism that lets claims be a *cache* not the *authority* (`TARGET §5`) without a per-request introspection call.

**Materialization threshold (resolves the deferred Zanzibar index):** below ~10M membership edges, resolve-on-demand + cache suffices. Above it, **materialize a reverse index** `store_id → [principal_id, effective_role]` (the "who can access this store" query) updated by the same invalidation events. Trigger: p99 check-API latency > 15ms **or** edge count > 10M, whichever first.

**SLO:** check-API p99 ≤ **15ms** cached / ≤ **50ms** cold; cache hit-rate ≥ 95%; invalidation propagation ≤ 2s. These are release gates (`IDENTITY_GOVERNANCE_MODEL §6`).

---

## 5. Dev/sandbox isolation axis (NEW — closes scale-Q5)
The corpus's Developer store-role even includes `theme.*` on live stores. Add a **`prod_scope` dimension** orthogonal to permissions: every membership carries `prod_scope ∈ {prod, sandbox, both}`. A Developer-role membership defaults to `sandbox`; touching a `prod=true` Store requires a `both`/`prod` membership granted by an Admin. The Sandbox entity (`IDENTITY_DOMAIN_MODEL §1`) is the safe surface for 3P devs and Developer staff. Enforced as an ABAC condition (`resource.prod == true ⇒ require prod_scope`).

---

## 6. Plan → ABAC entitlement contract (NEW — closes G-B)
ABAC's "plan" condition (`PERMISSION_MODEL §6`) has no source today. Define the contract:
- Commerce/billing publishes a **signed entitlement snapshot** per org: `{org_id, plan, features[], limits{}, valid_until, sig}`.
- Identity caches it and exposes it to the PEP either as an `ent` token claim (small orgs) or via the check-API (`depends_on:[plan]` tagged).
- **Mid-session downgrade:** an entitlement change emits an invalidation (see §4); the next decision re-resolves and may flip ALLOW→DENY (e.g. losing access to a Plus-only capability) within one access-token TTL — *without* forcing re-login.
- Precedence: a deny from plan-gating is an ABAC deny and is subject to deny-overrides (cannot be overridden by a role grant).

---

## 7. Customer-realm authorization plane + B2B buyer roles (NEW — closes G-C)
`PERMISSION_MODEL` is entirely merchant/staff. Millions of customers + B2B buyers need their own (small, separate) plane:
- **Consumer customers:** a minimal scope set on their own resources — `customer:self.{profile,orders,addresses,payment_methods}` + per-store `store:{id}:shop`. No roles; scope is implicit from realm + `store_id` claim. Isolation: a customer token's `aud` is the storefront/checkout API, never the commerce-admin API (realm separation, `REALM_ARCHITECTURE`).
- **B2B customer-company (pairs with `ORGANIZATION_ARCHITECTURE §6`):** buyer roles {Company Admin, Buyer, Approver, Viewer} over `company:{id}` scope — `order.place`, `order.approve` (threshold via ABAC), `catalog.view_contract_pricing`, `member.manage` (admin only). Resolved by the *same* check-API/cache as merchant authz but in the customer realm with company scope. This makes wholesale/B2B expressible without a second authorization engine.

---

## 8. Field/row-level scoping + composition (NEW)
- **Row/attribute scoping:** add optional `qualifier` conditions resolved by Commerce at the resource (e.g. `order.read.own` → only orders where `created_by = principal`; `inventory.manage.location:{id}`). Identity asserts the grant; Commerce applies the row filter — preserving the boundary.
- **Delegation ∘ impersonation:** define composition explicitly — an operator **may** impersonate a direct member but **may not** impersonate *through* a delegation (no `act_as` over `acting_via`); both appear in the audit double-attribution (`AUDIT_ARCHITECTURE §2`). This closes the undefined interaction the corpus left open.

---

## 9. Future marketplace & enterprise permission models (NEW)
- **Marketplace:** vendor orgs under a marketplace parent-org (`ORG §1`, depth-2); vendor permissions scoped to `vendor_org_id`; the marketplace operator gets a delegated, permission-filtered grant over vendor stores (reusing §4 agency mechanics) — never raw membership.
- **Enterprise:** custom org roles (`ORG §5`) + SSO group mapping + org-mandated MFA/step-up (`PERMISSION_MODEL §12` aal map) + per-org ABAC policy overrides (bounded by platform policy). All expressible on the registries in §1 — no new engine.

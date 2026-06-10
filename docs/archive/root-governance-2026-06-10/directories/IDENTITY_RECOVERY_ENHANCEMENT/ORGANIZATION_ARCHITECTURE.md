# ORGANIZATION ARCHITECTURE (enhancement)
### 2026-06-09 · ANALYSIS-ONLY · enhancement-delta over `docs/auth/2026-06-08-identity-platform-transformation/ORGANIZATION_ARCHITECTURE.md`

> **Relationship to the corpus.** The corpus doc already defines the five concepts (Principal/Org/Store/Team/Membership), org/store lifecycle state machines, the seven business models, the delegation edge, and inheritance/deny-override. **Strong; not rebuilt.** This document designs the five things it leaves thin or absent at Shopify scale: **agency fan-out + sub-delegation, Brand as a first-class entity, enterprise custom org roles, billing delegation, and the multi-org principal / B2B customer-company** model. It also resolves the hard merge cases and the parent-org depth rule.

---

## 1. Hierarchy (enhanced)

```
Organization (billing/ownership boundary; parent_org_id depth ≤ 2)
├── Brand (NEW: first-class; e.g. "Nike", "Converse" under one enterprise org)
│     └── Store (= sites.id)
├── Team (access grouping; may span brands within the org)
├── Sandbox (NEW: dev/test resource; prod=false)
└── Delegations (out-edges to grantee orgs: agencies/partners)
```
**Parent-org depth rule (closes the unbounded-depth gap):** `parent_org_id` is allowed **at most 2 levels** (marketplace → vendor; enterprise → subsidiary). Deeper nesting is modeled with Brands, not org chains — this bounds grant/policy/billing propagation to a known depth and keeps the membership-resolution algorithm O(1) in org-depth.

---

## 2. Brand as a first-class entity (NEW — closes scale-Q4)
The corpus folds "brand" into "teams by brand/region," conflating an **org-structure** concept with an **access-grouping** concept. They are different:
- **Brand** = a sub-grouping of *stores* under one org for catalog/theme/reporting identity. `brand_id`, `org_id`, `name`, `default` (one per org).
- **Team** = a grouping of *people* for access. A team may be granted a role *scoped to a brand* (`membership(team, scope=brand, brand_id)`).
- **Why it matters:** an enterprise wants "the Nike team can manage all Nike stores" — that is a team granted a brand-scoped role, which is impossible if brand isn't a scope axis. Add `brand` to the scope enum (`org|brand|store|team|sandbox`).

---

## 3. Agency at fan-out scale (NEW — closes scale-Q3)
The corpus delegation edge (`delegation(grantor_org, grantee_org, scope, role, expires_at)`) works for a handful of client stores but breaks for an agency managing hundreds:

1. **Permission-filtered delegation.** Add `delegations.permission_filter[]` (allowlist) so "agency may `theme.*` and `product.*` but never `payout.*`/`customer.pii.read`" is expressible at the *delegation* level, independent of the granted role. (Corpus only had `role_slugs[]`.)
2. **Sub-delegation (bounded).** Allow `delegation.parent_delegation_id` so an agency can re-delegate a **subset** of its grant to a freelancer — capped at **1 level** of sub-delegation, and the sub-grant's `permission_filter` must be ⊆ the parent's (monotonic narrowing, never widening). Audited as a chain.
3. **>25-store representation.** The bounded-claims cap (~25 stores in the token) is fine for merchants but wrong for agency operators. **Agency sessions never carry a `sites` claim** — they carry `acting_via=<delegation_id>` + `grantee_org`, and store access resolves through the check-API exclusively (which §4 of `PERMISSION_ARCHITECTURE.md` makes cacheable). This decouples agency scale from token size.
4. **Revocation.** Revoking a delegation instantly revokes all agency-operator access to the grantor's stores (no per-membership cleanup), and cascades to sub-delegations.

---

## 4. Billing delegation (NEW — closes scale-Q6)
The corpus has `billing.*` permissions and `organizations.billing_ref` but **no delegation of billing**. Design:
- **Billing is an org-scoped capability** owned by Commerce/billing (see `IDENTITY_OWNERSHIP_MATRIX.md`), but *who may act on it* is an Identity membership/delegation decision.
- A **`billing` delegation scope**: `delegation(grantor_org, grantee=accountant_principal_or_org, scope=billing, permission_filter=[invoice.read, invoice.pay, payment_method.manage])` — lets an external accountant pay invoices **without** org-admin access.
- **Plan/entitlement contract** (so ABAC can gate on plan): Commerce publishes a signed `entitlement` snapshot (`org_id, plan, limits, features[]`) that Identity caches and folds into the token as an `ent` claim or resolves via the check-API. This is the missing source for the ABAC "plan" condition (`PERMISSION_MODEL §6`). Detailed in `PERMISSION_ARCHITECTURE.md §6`.

---

## 5. Enterprise custom org roles + SSO group mapping (NEW — closes scale-Q4/Q8)
- The corpus has only two org roles (Owner, Admin). Enterprises need **custom org roles** ("Regional Director can manage stores in brands X/Y but not billing"). Add `org_custom_roles(org_id, slug, permission_set[], scope_constraints)` — owned by Identity-assignment over the Commerce permission registry, governed per `PERMISSION_ARCHITECTURE.md §3`.
- **SSO group → role mapping**: `scim_group_mappings` (from `IDENTITY_DOMAIN_MODEL §5`) maps an enterprise IdP group to an org role/team membership, applied on JIT provision and re-evaluated on each SSO login (so a group removal in the enterprise IdP deprovisions access here).

---

## 6. Multi-org principal, org-switcher, and B2B customer-company (NEW)
- **Multi-org principal (CLARIFY):** one merchant-realm Principal may hold memberships in N unrelated orgs (a consultant working for several merchants). The corpus never states the resolution: define `principal.default_org_id` + a **last-active-org** session attribute; the org-switcher (UI in `IDENTITY_UI_ARCHITECTURE.md`) re-mints the access token with the selected `org` claim (no re-login, refresh-rotation only).
- **B2B customer-company (NEW — customer realm):** for wholesale/B2B, a **Company** is the customer-realm analogue of an Org: `company(id, name)`, `company_members(customer_principal, company_id, buyer_role)` with buyer roles {Admin, Buyer, Approver, Viewer}. Enables "company admin invites buyers; buyers place orders against company terms; approver signs off above a threshold." This is the customer-side of the org graph the corpus omits entirely; its authz plane is in `PERMISSION_ARCHITECTURE.md §7`.

---

## 7. Hard cases resolved (merge/transfer at scale)
The corpus's "highest-wins + audit" merge rule is under-specified. Resolutions:
- **Colliding store_ids on merge:** impossible (store_ids are global ULIDs) — but colliding *delegations* pointing at a merged-away org are **re-pointed to the surviving org** and flagged for review.
- **Privilege collision (Owner in A, Staff in B):** highest-wins **does not silently elevate** — a merge that would grant a principal Owner over previously-unowned stores requires **explicit confirmation** by a surviving-org Owner (a merge-review step), preventing privilege-escalation-by-merge.
- **Team-name collisions:** auto-suffixed; never merged by name.
- **Ownership transfer (`ORG §7`):** keep the two-phase audited flow; add that a transfer **revokes all delegations** on the transferred store (an agency loses access when its client's store changes hands) unless re-confirmed.

---

## 8. Scalability notes (additive to `ORG §11`)
Shard by `org_id`; Brand/Sandbox low-cardinality; delegation chains capped at depth 2 (delegation→sub-delegation) so resolution is bounded; the agency "no `sites` claim" rule keeps token size O(1) regardless of delegated-store count; B2B company membership reuses the same bidirectional-index pattern as org membership.

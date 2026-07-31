# 05 — TEAMS / RBAC AUDIT

**HEAD `cd5905be` · code-verified.** There is no separate "Teams app." Roles/permissions exist in two distinct places — and they are at very different maturity.

| Surface | Status | Evidence |
|---|---|---|
| **Platform staff RBAC** (internal) | **implemented (production-quality)** | 25+ scopes, 4 tiers, break-glass grants, access reviews, SoD checks (`rbac.ts`); mig 113 `internal_os_rbac_spine`; gates the platform-console |
| Internal team management / invites | **implemented** | staff lifecycle within the console |
| **Merchant-side staff/roles** | **inert (V1.1)** | `site_memberships` / `site_roles` / `site_role_permissions` tables exist and are populated, BUT no route gates check them — every sensitive merchant route uses owner-only `verifySiteOwnership`; tenant scoping via `tenant-context.ts` |
| Merchant invite flow | **partial/broken** | invite API enqueues an email, but the **acceptance page is missing** and role enforcement is inert → no second merchant user can actually be added |
| Identity → permissions | **implemented (platform); not wired (merchant)** | platform scopes enforced; merchant `resolveTenantAccessProfile` not wired to route gates |

**Verdict:** **V1 = owner-only merchants + full platform-staff RBAC.** The merchant teams feature is scaffolded (tables + invite enqueue) but **not functional** (no acceptance page, no route gates) — correctly deferred to V1.1. Do not present merchant staff/users as a V1 capability; mark it "coming soon" or hide it.

# 9. Permission System Report

## The Designed Model (four layers)

1. **Actor types** — `packages/auth-core/src/index.ts:43`:
   `'shopper' | 'customer' | 'merchant' | 'partner' | 'platform-employee' | 'platform-operator' | 'service'`
   plus a resource-action `Permission` interface (`resource`, `action: read|create|update|delete|manage`, `scope: own|site|platform`).
2. **Role categories** — `services/api-gateway/src/middleware/rbac.ts:103-141`: `requireRoleCategory('store'|'organization'|'partner'|'ops')`; `ops` backed by `super_admin_allowlist` lookup (`rbac.ts:30-53`) + `requireSuperAdmin`.
3. **Employee RBAC** — `employee_roles`, `employee_permissions` (seeded permission strings like `tickets.respond`, `sellers.verify`, `disputes.manage`), `employees.permissions jsonb`.
4. **Site-scoped RBAC (merchant staff)** — `site_memberships.role_slugs[]/permissions[]`, `site_roles`, `site_role_permissions` with `effect allow|deny` (`000_baseline.sql:11885-11943`).

## The Enforced Model (what actually gates requests)

| Check | Enforced? | Where |
|---|---|---|
| Super-admin allowlist (`ops` category) | YES | All `/admin/*`, `/operations/*`, marketplace decisions |
| Console email allowlist + TOTP MFA | YES | platform-console only (env `PLATFORM_CONSOLE_ALLOWED_EMAILS`) |
| Active-employee check | YES (existence only) | `employee.ts` verifies `employees.status='active'` — then ignores role/permissions |
| `employee_permissions` strings | **NO** | Never read by any middleware or route |
| `employee_roles.permissions` jsonb | **NO** | Never read |
| Resource-action `Permission` interface | **NO** | Type-level contract only |
| Site roles for merchant staff | PARTIAL | Membership/ownership checks in merchant routes; fine-grained `site_role_permissions` allow/deny not systematically evaluated |
| Tenant isolation (`site_id` scoping) | YES | Pervasive in gateway routes (governance rule, `AGENTS.md`) |

**Net effect: platform-side authorization is binary.** You are a super-admin (everything) or you are not (nothing internal). Every role the seeds anticipate collapses into "must be founder."

## Role-by-Role Permission Reality

| Role | Designed permissions | Actual access path today |
|---|---|---|
| Founder | implicit all | `super_admin_allowlist` row + console env allowlist + TOTP |
| Admin (platform) | `employees.role='admin'` | No distinct power — needs super-admin anyway |
| Employee (generic) | role enum + jsonb perms | Can log in (`/employees/auth/login`); can reach only `/employees/*` routes (tickets=501, analytics) |
| Support | tickets.view/respond, users.read, stores.read | Nothing — target systems missing; can't reach `/admin` or `/operations` |
| Moderator | (none seeded) | Role doesn't exist |
| Reviewer (app/theme) | (none seeded) | Must be super-admin (`operations.ts` middleware) |
| Finance | (none seeded) | Role doesn't exist; ledgers reachable only via super-admin/SQL |
| Developer Relations | (none seeded) | Role doesn't exist |
| Merchant staff | manager/editor/viewer/fulfillment via `site_memberships` | Functional in merchant-control-plane (invite UI at `/settings/users`) |

## Structural Findings

1. **Two admin sources of truth:** env-var allowlist (console UI) vs `super_admin_allowlist` table (API middleware). An admin can exist in one and not the other; 2FA fields in the table are independent of the console's TOTP secret env.
2. **Dual-purpose `employees` table** mixes platform staff and merchant staff (nullable `store_id`), with one shared role enum spanning both worlds — permission reasoning across populations is unsound by construction.
3. **No deny-capability, no scoping on platform side:** seeded permission strings are flat; only the (unused) merchant `site_role_permissions` has allow/deny effects.
4. **No approval/elevation:** no time-boxed elevation, no two-person rule (sole exception: replay authorization endpoint), no reason capture on privileged actions.
5. **Audit attribution is coarse:** `audit_logs.actor_type` supports `employee`, but console writes hardcode `super_admin`; sub-role attribution impossible.
6. **Ops portal bypass:** the employee surface performs no employee check at all (merchant session accepted) — the permission system's weakest point is the front door of the employee tool (`apps/platform-operations-portal/src/lib/api/client.ts`, login page TODO).

## Conclusion
LetBuyy has a permission **schema** worthy of a Shopify-scale company and a permission **system** of a single-founder prototype: one real privilege tier (super-admin), one well-locked door (console), one unlocked door (ops portal), and three layers of designed-but-dormant RBAC.

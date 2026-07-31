# 06 — Staff Management

**Staff: ~53% → ~66%.** The enforcement engine (Phase 4.5) is now applied across 5 domains (see `07-rbac.md`) and employee mutations are audit-logged.

## Done (verified)
- **Enforcement mechanism** — `staff-permission.ts`: pure `evaluateStaffPermission` (9/9 unit tests), `assertStaffPermission`/`requireStaffPermission`, authoritative owner-bypass, `MERCHANT_STAFF_RBAC_MODE` (dryrun default), fail-open.
- **Enforcement wired** — products/orders/coupons/customers/shipping write routes (Phase 4.75).
- **Employee `audit_logs`** — `employee.created`/`.invited`/`.updated`/`.removed` (best-effort, never fails the mutation).
- **`products:read` permission label** in `STAFF_PERMISSIONS`.

## Remaining (needs a running stack / careful UI)
- **Invite-acceptance page** — gateway `POST /employees/auth/accept-invite` (`{ token, password }`, public) has no merchant-app landing page. Spec: top-level `apps/merchant-control-plane/src/app/accept-invite/page.tsx` reading `?token=`, prompting password, POSTing via a thin server proxy, then redirecting to login. **Not shipped** — a public-auth flow that can't be flow-verified here; shipping it blind risks dead UI.
- **Role/permission management UI** (assign roles, edit grants per staff) — the catalog (`roles.ts`, 6 roles + 11 keys) + gateway CRUD exist; a richer in-app editor beyond the current users page remains.
- **Enable `enforce`** after live dry-run-log verification.

**Verdict:** management + enforcement engine + audit trail are real; the invite landing page + the enforce flip are the gating items, both requiring a live stack.

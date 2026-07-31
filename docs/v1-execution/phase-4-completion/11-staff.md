# 11 — Staff & Permissions / RBAC

**Readiness: ~52%.** Management is real + production-quality; **enforcement is the gap.**

## Real (not a stub)
Staff settings UI (`settings/users`), 6-role catalog + 11 permission keys (`roles.ts`), Next proxy (GET/POST/PATCH/DELETE), gateway `employee.ts` (~621 lines): invite (email + 7-day token), invite acceptance (creates Supabase auth user), **plan-based seat limits (server-authoritative)**, employee login, `verifySiteOwnership` on all write paths.

## Gaps (documented — NOT applied blind; security-sensitive + needs live verification)
- **HIGH (security): staff permission keys are NEVER enforced on merchant-facing routes.** `requirePermission()` is *plan/billing*-tier gating, not the calling staff user's role. A `viewer` could `POST /v1/products`. Fix = a `requireStaffPermission` middleware reading `employees.permissions.granted`, wired on product/order/customer/coupon/settings writes. **Deliberately not applied here** — wrong wiring would 403 legitimate staff or break merchant ops; needs the auth stack to verify. Recommend a dedicated, tested change.
- **HIGH: no invite-acceptance page** in the merchant app (gateway `accept-invite` exists; the email link has no frontend to land on).
- MEDIUM: no audit-log writes on employee CRUD.
- LOW: `products:read` used by the viewer role but missing from the `STAFF_PERMISSIONS` label catalog → renders the raw key.

**Verdict:** the management surface is real, but RBAC's functional core (runtime enforcement) is absent. This is the lowest-readiness domain and a genuine security gap — flagged for a focused, verified change, not a blind edit.

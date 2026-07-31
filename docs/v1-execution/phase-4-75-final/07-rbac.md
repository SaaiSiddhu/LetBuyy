# 07 — RBAC Enforcement (Phase 4.75 headline)

**The verifiable headline of this phase.** Staff-permission enforcement, built as a mechanism in Phase 4.5 (products only), is now **wired across 5 write domains** — all compile + contract + regression verified, shipped dry-run-safe.

## Now enforced (16 write handlers)
| Domain | Routes wired | Permission key |
|---|---|---|
| Products | POST / · PATCH /:id · POST /bulk · DELETE /:id | `products:write` |
| Orders | PATCH /:id (status) · POST /:id/fulfill · POST /:id/refund · POST /:id/refund/complete | `orders:write` |
| Coupons | POST / · PATCH /:id · DELETE /:id | `marketing:write` |
| Customers | POST / (create) · PATCH /:email | `customers:write` |
| Shipping | POST /shipping · PATCH /shipping/:id · DELETE /shipping/:id | `shipping:write` |

Each call is one line — `await assertStaffPermission(c, <siteId>, <userId>, '<key>')` — placed immediately after the route's existing ownership check, reusing the siteId/userId it already resolved. Owners bypass authoritatively (`verifySiteOwnership`); non-owner staff are gated on `employees.permissions.granted`.

## Safe rollout (unchanged from 4.5)
`MERCHANT_STAFF_RBAC_MODE` ∈ {off, dryrun, **enforce**}, **default dryrun** — logs `staff_rbac_decision` but never blocks; fail-open on error. So all 16 wirings are **behavior-neutral in production today** and become enforcing the moment an operator flips the flag after verifying the dry-run logs.

## Verification
gateway `tsc --noEmit` **EXIT 0** (all 16 wirings across 5 files) · launch suite **180/180** (incl. the cross-domain RBAC contract test) · gateway unit suite **313/316** (the 3 fails are pre-existing + unrelated — AI route, analytics migration, storefront payment route; **0 new**) · the pure decision logic remains **9/9** (`staff-permission.test.ts`).

## Remaining (documented, dry-run-safe to extend)
- **Secondary writes**, same one-line pattern: orders (drafts, line-items), customers (DELETE/:email, addresses, segments, email, merge), shipping (zones, taxes), coupons (none left), plus settings/inventory/domains/marketing/analytics write routes.
- **Enable enforcement** — flip to `enforce` only after dry-run logs confirm owners pass + the right staff are gated against a real staff session. **The gap is not fully closed until this flip.**
- **Invite-acceptance page** (`/employees/auth/accept-invite` has no merchant-app landing) — public-auth flow, not shipped (can't flow-verify); spec in `06-staff.md`.

**Net:** enforcement coverage went from 1 domain (products) to 5 high-value domains spanning the money-sensitive order paths — real, verified, lockout-proof.

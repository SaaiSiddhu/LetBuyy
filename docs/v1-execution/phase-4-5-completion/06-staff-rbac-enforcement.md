# 06 — Staff RBAC Enforcement (the highest-severity security gap)

**Staff: ~53% → ~63%.** The enforcement *mechanism* is built, unit-tested, wired on the canonical routes, and shipped under a safe-rollout flag. Full route coverage + enabling enforcement + the invite page require live verification.

## The gap (confirmed)
`requirePermission` (permission.ts) gates on the store's **billing plan**, which always includes `products:write`/`orders:write` — so it never gates on the calling **staff** member's role. Staff roles persist as `employees.permissions = { granted: string[] }` but were **never enforced**: a viewer-role staff member could call any write route.

## Built + verified this phase
**`services/api-gateway/src/middleware/staff-permission.ts` (NEW):**
- `evaluateStaffPermission({ isOwner, granted, requiredKey })` — **pure decision logic**, exhaustively unit-tested (owner bypass · viewer blocked from write · viewer allowed its read · manager allowed · `*` super-grant · `prefix:*` wildcard · empty grants denied). **9/9** in `src/__tests__/staff-permission.test.ts`.
- `assertStaffPermission(c, siteId, userId, key)` (in-handler) + `requireStaffPermission(key)` (middleware).
- **Authoritative owner bypass** — `verifySiteOwnership` against `sites`; owners (the vast majority of callers) are never blocked.
- **Safe rollout** — env `MERCHANT_STAFF_RBAC_MODE` ∈ {off, dryrun, **enforce**}, **default `dryrun`**: it evaluates + logs the decision (`staff_rbac_decision`) but never blocks, so behavior is unchanged until logs confirm correctness and an operator flips to `enforce`.
- **Fail-open** on missing context / lookup error — this is defense-in-depth atop the existing ownership/membership checks, so it can never lock a merchant out.

**Wired (verified):** all four **products** write routes (POST/PATCH/bulk/DELETE → `products:write`) — the audit's named example ("a viewer can POST /v1/products"). Contract-tested (`lb-merchant-admin`: middleware shape + ≥4 wired product writes).

**`employees` audit logs (NEW):** `employee.created` / `.invited` / `.updated` / `.removed` → `audit_logs` (mirrors the rbac.ts shape; best-effort, never fails the mutation).

**Roles label:** `products:read` label added to `STAFF_PERMISSIONS` (Phase 4.5).

## Verification
gateway `tsc --noEmit` EXIT 0 · gateway unit suite 313/316 (3 **pre-existing**, unrelated; 9 new staff-permission tests pass) · launch 179/179 · anti-fabrication + session-security + canonical-ledger PASS.

## Remaining (needs a live auth stack)
1. **Enable enforcement** — flip `MERCHANT_STAFF_RBAC_MODE=enforce` only after dry-run logs confirm owners pass + the right staff are gated, against a real staff session. **The gap is not fully closed until this is enabled.**
2. **Broaden wiring** — apply `assertStaffPermission` to orders (status/fulfill/refund → `orders:write`), customers (`customers:write`), coupons (`marketing:write`), settings (`settings:write`), shipping (`shipping:write`), returns (`returns:write`). Same one-line in-handler pattern; dry-run keeps it safe to add incrementally.
3. **Invite-acceptance page** — gateway `POST /employees/auth/accept-invite` (`{ token, password }`, public) has no merchant-app landing page. Spec: a top-level `apps/merchant-control-plane/src/app/accept-invite/page.tsx` reading `?token=`, prompting for a password, POSTing via a thin server-side proxy to the gateway endpoint, then redirecting to login. Not shipped here — it is a public-auth flow that cannot be flow-verified in this environment, and shipping it blind risks dead UI.

**Net:** the enforcement engine + its correctness proof exist and are safe in production today (dry-run); closing the gap fully is now an operational step (verify logs → enable → broaden), not unsolved code.

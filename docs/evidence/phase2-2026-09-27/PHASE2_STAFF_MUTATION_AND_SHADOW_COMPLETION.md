# Phase 2 — staff-mutation and shadow-runtime blockers, closed

**Date:** 2026-09-28
**Branch:** `letbuyy/phase2-shared-buyer-identity`
**HEAD at close:** `ce13b6c85630aa1b2c5b27e06a562292fa8a716e`
**Execution mode:** SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
**Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO**

This document closes the "CLOSE PHASE 2 STAFF-MUTATION AND SHADOW-RUNTIME BLOCKERS" mandate. It
supersedes nothing wholesale — it corrects one specific prior claim (below) and adds evidence for work
this mandate required that prior evidence did not cover. `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md`,
`D03_TARGET_DATA_SHADOW_ACCEPTANCE.md`, `AUTH_HARDENING_AND_D03_COMPLETION.md` and `PHASE2_DECISIONS.md`
remain the historical record of the work that led here and are not rewritten; where this document
narrows or corrects a claim in one of them, that is stated explicitly, in place, below.

## Correction to a prior claim

`real-http-shadow-rehearsal.postgres.test.ts`'s "PERMISSION DOWNGRADE" and "OWNER TRANSITION" scenarios
carried a comment asserting "only the owner can currently complete a real product mutation through this
router" — **true when that comment was written, false by the time that same file's own earlier "Allowed
reversible mutation: full staff" scenario landed** (a real `STAFF_FULL` PATCH already succeeded there).
The comment has been corrected in place (this pass) to say precisely that: it demonstrates a
*different* independence property (the owner's `isOwner` bypass path, structurally separate from
staff's `resolveGrants` path), not the *only* one available. The rehearsal proving the identical
independence pattern for a **real, non-owner staff member** — created through the real `POST /employees`
path, authenticated with real signed HMAC headers, never a context bypass — is the new file described
below. No historical evidence is deleted; the correction is a comment fix plus new, additive coverage.

---

## 1. Real staff product mutation — `real-staff-product-journey.postgres.test.ts`

New, persisted, real-Postgres test. Against the local Supabase Postgres instance, mounts the REAL
`authMiddleware` (never a `c.set('auth', ...)` bypass) and the REAL `routes/employee.ts` +
`routes/products.ts` routers. Every actor authenticates with a freshly signed HMAC identity assertion
via `createLetbuyyInternalIdentityHeaders` (`@letbuyy/auth-core`) — the exact mechanism a real
merchant/staff client uses (Phase N3 closed ART-05: identity-platform is the sole issuer; every other
runtime verifies). Each HTTP call mints its own signature (a new jti + timestamp); `verifyInternalIdentityPayload`'s
replay cache means the identical signed assertion could not be reused across requests even if the test
wanted to — "the same session" below means the same identity (userId/email/secret), re-signed per call.

**Setup, real not synthetic:** a real owner and a real staff member, each with a real `users_custom`
row (the staff member's marked `email_verified: true`, the real precondition — discovered this pass
while investigating `routes/employee.ts` — for `POST /employees` to auto-link `user_id` and activate
immediately instead of leaving the row `user_id`-less and `'invited'`); two real `sites` rows (a second
store owned by an unrelated synthetic owner, for the cross-store scenarios); one real product seeded
directly in the second store.

**The ten-step scenario, run for real, against the running gateway:**

1. **Owner creates staff with the intended permission** — real `POST /employees`
   (`{email, store_id, role: 'manager', permissions: {granted: ['products:read','products:write']}}`).
   Asserted: `201`, `user_id` auto-linked to the pre-verified account, `status: 'active'` (not
   `'invited'`), `permissions.granted` round-trips exactly.
2. **Staff signs in independently** — a fresh, real, HMAC-signed identity assertion for the staff
   user, carrying no `storeId` (matching the real merchant/staff-web session shape documented in
   `staff-paths-fail-closed.test.ts`: "a user, and no store of its own" — every scoping decision below
   is therefore made by the *resource's own store*, exactly as a live request is evaluated, not by a
   claimed session store).
3. **Staff creates a disposable product** — real `POST /products`. `201`.
4. **Staff reads and edits it** — real `GET /products/:id` (`200`), then real `PATCH /products/:id`
   (`200`, name updated). The PATCH's shadow log (captured, not merely allowed to print) shows a real
   `staff_permission_target_shadow_comparison` line with `outcome: 'MATCH'`, `target_allowed: true` —
   the real target role, built by this pass's own `staff-role-backfill.ts` from this real employee row
   (§2 below), independently agrees with the real legacy decision.
5. **Staff performs the approved deletion** — real `DELETE /products/:id`. `200`, `deleted: true`.
6. **Staff attempts a forbidden operation** — real `POST /products/collections`. Collection management
   has **no staff path at all** in `routes/products.ts` (`verifyStoreOwnership` only, regardless of
   `products:write`) — a genuine, structural "forbidden operation," not a contrived one. `403 FORBIDDEN`.
7. **Staff attempts a cross-store mutation**, twice: a caller-supplied `store_id` naming the other store
   on create (`403 STAFF_PERMISSION_REQUIRED` — proving a caller-supplied store id cannot redirect a
   mutation), and a PATCH against a real product that already belongs to the other store (`403
   STAFF_PERMISSION_REQUIRED` — the product's *own* store is what gets checked, and this staff member
   holds no grant there).
8. **Owner revokes/downgrades staff** — real `PATCH /employees/:id`
   (`{permissions: {granted: ['products:read']}}`, a genuine downgrade, not a blunt removal). `200`,
   `permissions.granted` now `['products:read']` only.
9. **The same existing staff identity immediately loses the withdrawn authority** — a fresh signed
   assertion for the *same* staff user: `POST /products` now `403 STAFF_PERMISSION_REQUIRED` (write is
   gone), while `GET /products?store_id=...` still `200`s (read is retained) — proving this is a live,
   precise, per-request re-evaluation of the real `employees.permissions` row, not a cached decision and
   not a blanket lockout.
10. **Owner remains unaffected** — a fresh signed assertion for the owner completes a real `POST
    /products`, `201`, entirely unaffected by their own staff member's downgrade.

**Cleanup verified, not assumed:** the `finally` block deletes every row this test created, in the same
FK-safe order `real-http-shadow-rehearsal.postgres.test.ts` established (inventory_adjustments →
inventory_levels → product_variants → product_options → products → employees → store_memberships →
site_role_permissions → site_roles → principals → sites → users_custom), and a dedicated block afterward
re-queries every affected table and **asserts zero rows remain** — this is a hard assertion failure, not
a best-effort log line, if cleanup left anything behind. Independently re-verified twice more from
outside the test process, by direct `psql` queries against the running container, after separate runs:
`sites`/`users_custom`/`employees`/`products`/`site_roles` all `0`.

**Result:** `ok 1` — passes end to end.

---

## 2. Real target-role backfill for a real staff member — `staff-role-backfill.ts`, exercised for real

`staff-role-backfill.ts` (this pass) gives arbitrary staff — not just the site owner — a deterministic,
site-scoped, permission-set-derived target role: `deriveStaffRoleSlug()` hashes the *sorted canonical
action set* (never a display name, never insertion order) into a stable `staff-<16hex>` slug;
`ensureStaffRole()` finds-or-creates that role and self-reconciles its `site_role_permissions` rows on
every call; `executeStaffMembershipRoleAssignment()` translates a real employee's `permissions.granted`
through the same `LEGACY_PERMISSION_ALIASES` table the shadow comparators use and assigns the matching
role to their real, active `store_memberships` row — wholesale replacement, never merged, so every run
converges to exactly what the current grants mean.

`staff-role-backfill.test.ts` (fake-PostgREST, 16 tests, committed earlier this pass) already covered
determinism, unmapped-grant handling, platform-permission exclusion, idempotency, site isolation, shared
roles, downgrade reconciliation, empty-grant handling, revoked-membership isolation and
missing-prerequisite blocking in isolation. What was still missing, and what this pass's mandate named
precisely, was proof against a **real employee row**, not a synthetic `LegacyStaffGrantRow` — closed by
weaving the real backfill directly into §1's real staff journey:

- After the real `POST /employees` call (§1 step 1), `executeMerchantPrincipalBackfill` and
  `executeStoreMembershipBackfill` create the real `principals`/`store_memberships` rows for this real
  staff member, then `executeStaffMembershipRoleAssignment` is called with the **real** `employeeId` and
  **real** `granted` array from that real response — `outcome: 'inserted'`, `unmappedGrants: []` (both
  `products:read` and `products:write` have canonical aliases).

### The decisive independence proof, on a real staff member (not the owner)

A dedicated scratch product inside the same real staff journey:

1. **Baseline** — real staff PATCH, shadow log `MATCH`.
2. **Target-only change** — `ensureStaffRole(db, SITE_A, ['product.read'])` builds a real, deliberately
   lesser role (read-only), then a raw SQL `UPDATE store_memberships SET role_ids = ...` points this
   staff member's real membership at it — **the legacy `employees.permissions` row is untouched.**
3. Real staff PATCH again: **`200`, unaffected** — the real, authoritative decision stays
   legacy-governed regardless of the target-only change (this is the property Section 11 names: "change
   target only, observe divergence, real auth unchanged"). The shadow log shows
   `outcome: 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES'`, `target_allowed: false` — the divergence is
   **observed, never enforced.**
4. **Reconcile** — `executeStaffMembershipRoleAssignment` re-run with the *same, unchanged* legacy
   grant: `outcome: 'updated'`, `role_ids` restored to match.
5. Real staff PATCH again: **`200`**, shadow log **`MATCH`** again, `target_allowed: true` — "matching
   returns."

This is the identical pattern `real-http-shadow-rehearsal.postgres.test.ts` already proved for the
*owner's* `isOwner` bypass path; this is the same proof for a real staff member's `resolveGrants` path,
using this pass's own new backfill code, against a real employee created through the real product flow —
the specific combination the mandate asked for and the specific gap the corrected claim (above) names.

---

## 3. Bounded shadow evaluation — belt-and-suspenders, measured

Unchanged from the state recorded in `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md` and
re-verified green this pass (`staff-permission-shadow.test.ts`, 35 tests, part of the 100%-passing
gateway suite, §5 below): `withShadowComparisonTimeout` (`Promise.race` against a shared `setTimeout`,
800ms) is the **unconditional** guarantee — it fires even against a `db` that does not implement
`abortSignal` — and `AbortController`, wired through `target-shadow-comparison.ts`'s new
`abortSignal()`/`withAbortSignal()` support (confirmed against the real, installed
`@supabase/postgrest-js@2.95.3` — `PostgrestBuilder.abortSignal()` genuinely passes the signal into the
underlying `fetch()`), is the **optimization**: real cancellation when the callee cooperates, silently a
no-op when it does not, never the sole guarantee. The test matrix (never-resolving dependency, abort and
cooperation, late rejection with no unhandled-rejection, multiple concurrent requests, a broken
`console.warn` inside the logging path) is unchanged from the prior pass's evidence and was re-run clean
this pass, not re-derived. `logDecision` (the REAL, authoritative decision's own audit log — called
*before* any shadow work starts) and the shadow loggers are each wrapped in their own `try`/`catch`, so a
broken logger can never turn a permitted request into a `503` — the specific, real, previously-unknown
bug (`staff-permission-shadow.test.ts`'s "LOGGING FAILURE" case) that motivated this exact guard, found
and fixed earlier this pass.

---

## 4. Database test configuration — explicit validated discovery, not a hardcoded name

New: `services/api-gateway/src/__tests__/local-postgres-support.ts`. Every `*.postgres.test.ts` file
previously duplicated its own copy of "find the local Supabase container and shell out to `psql`," and
every copy fell back to the same hardcoded, machine-specific container name if
`LETBUYY_LOCAL_SUPABASE_CONTAINER` was unset — the exact string that had already gone stale and broken
this suite once earlier in this same pass (the "9 test files" container-rename fix that preceded this
document). Centralized and hardened:

- `readLocalSupabaseConfig()` — unchanged logic, now shared: requires `.dev.vars`'s own `SUPABASE_URL`
  to resolve to `localhost`/`127.0.0.1`/`::1`; anything else (a hosted or unrelated endpoint) is refused.
- `resolveLocalSupabaseContainer()` — **no hardcoded fallback.** An explicit
  `LETBUYY_LOCAL_SUPABASE_CONTAINER` is trusted outright; otherwise the container is positively
  identified by the Supabase CLI's own `supabase_db_<project-id>` naming convention, and only when
  **exactly one** running container matches — zero or an ambiguous multiple is refused (`null`), which
  every caller treats as a clean `t.skip`, never a silent guess or a misleading failure.

Applied to the four `.postgres.test.ts` files this phase's own verification actually depends on
(`backfill-and-target-shadow`, `real-http-shadow-rehearsal`, `real-staff-product-journey`,
`verification-token-redemption`). **Deliberately not** applied to five other, pre-existing, already-passing,
non-D03 test files that duplicate a *differently shaped* copy of the same hardcoded string
(`merchant-tenant-predicate.test.ts` and similar, a plain `const CONTAINER = ... || 'supabase_db_letbuyy-newmac-20260926'`,
used with different `psql`/`docker exec` flags) — out of this phase's named scope, and rewriting them
risked an unrelated regression this mandate does not ask for. No secret is logged by anything in this
file: `SUPABASE_SERVICE_ROLE_KEY` is read and returned for the caller's own use, never printed; nothing
in it performs or authorizes any Docker cleanup beyond a single read-only `docker exec <container> true`
reachability probe.

Re-run after the consolidation: all four files' real-Postgres suites (5 tests total) still pass;
independently re-queried the database afterward, zero leftover rows.

---

## 5. Security regressions — spot-checked, not assumed still green

Every area Section 13 named, located precisely and confirmed passing within this pass's full
`test:unit:gateway` run (1324 tests; see §6):

| Area | Test(s) |
|---|---|
| Atomic OTP (single-use, storage-failure-fails-closed) | `verification-token-redemption.test.ts` — "a storage failure at the atomic consume step fails closed", "sequential replay ... refused"; real-Postgres counterpart `verification-token-redemption.postgres.test.ts` (concurrent + sequential, both re-run this pass, §4) |
| Console magic-link single-use | `console-magic-link-consume.test.ts` — "the identical jti consumed a second time is refused as ALREADY_CONSUMED ... (replay)" |
| Founding-route auth | `founding.test.ts` — public founding routes mount before auth middleware, merchant/internal founding routes exist, price-lock guard applied at every charge site |
| Operator realm separation | `require-platform-operator.test.ts`, `operator-moderation-auth-chain.test.ts`, `operator-scoped-admin-client-contract.test.ts`; cross-realm token rejection (`IRT-2b`/`IRT-2d`: an operator/admin-web token rejected by the merchant verifier and vice versa) |
| Privacy ticket isolation / idempotency / truthful statuses | `buyer-privacy-routes.test.ts` — "another buyer cannot read a ticket they do not own, and cannot tell it exists" |
| Buyer ownership | `buyer-address-routes.test.ts`, `buyer-order-routes.test.ts` ("cross-buyer isolation: buyer B's own order never appears in buyer A's list, and vice versa"), `buyer-store-link.test.ts`, `buyer-return-routes.test.ts` |
| Firebase retirement (`apps/reserved/operator-mobile` stays empty) | `no-reserved-service-activation-validator.mjs` — governance gate, **PASS**, 0 findings (§6) |
| Payment-unavailable behavior | `ad-credit-purchase-routes.test.ts` (`PAYMENT_UNAVAILABLE` when Razorpay is not configured); `checkout-payment-rail-retirement.test.ts` (retired provider paths absent from the mounted router tree) |

None of these files were touched by this pass. All pass.

---

## 6. Full gate — precisely accounted, not asserted

Run against HEAD `ce13b6c8` (after the fixes recorded in §7):

| Lane | Command | Result |
|---|---|---|
| Gateway unit suite | `pnpm run test:unit:gateway` | **1324 tests: 1323 pass, 0 fail, 1 todo** — the 1 todo is `LB-BIL-002 (open): one payment cannot also activate a second store the same merchant owns`, a pre-existing, explicitly-`# TODO`-annotated, unrelated (billing/multi-store) open item, not new and not D03's |
| Full monorepo typecheck | `pnpm run typecheck` (turbo, 81 packages) | **81/81 successful, 0 failed** |
| Governance validator gate | `pnpm run validate:governance:gate` | **114/114 PASS, 0 FAIL, 0 BLOCKED, 0 SKIP** (1 `NOT_APPLICABLE`: `foundation-stepup-report-validator.mjs`, explicitly outside the gate lane's own selection) |
| Root test suite | `pnpm run test` (`tests/*/*.test.mjs` + `test:contracts`) | run 1 (fixture not started): **266/2084 failed, exit 1.** Run 2 (fixture started, `lb-merchant-admin.test.mjs` fixed): **25/2090 failed, 2050 pass, 15 skip, exit 1 — not green.** |

### The root suite's failures, precisely categorized

This mandate is explicit that "matching failure names or zero file overlap is not enough" — every
category below was verified by reading the actual failure, not inferred from a file name. Two full runs
were made: the first surfaced the scale of the missing-fixture problem, the second (after starting the
fixture and fixing the one genuine regression found in the first) is the number that stands.

**Resolved between run 1 and run 2 (241 failures):**

1. **~225 failures, `tests/executable/*-postgres.test.mjs` and neighbors — environment-sensitive, now
   resolved.** These require a *separate*, dedicated ephemeral Postgres fixture
   (`letbuyy-executable-pg`, started via `node scripts/governance/foundation-ephemeral-postgres.mjs
   start`) — a different container from the local Supabase dev stack this phase's own `.postgres.test.ts`
   files use. It was not running at the start of run 1. Starting it before run 2 turned essentially all
   of these green (verified first against a sample —`ad-budget-release-postgres.test.mjs`,
   `buyer-authorization-codes-postgres.test.mjs` — before the full re-run). This was a pre-existing
   fixture-startup condition, not caused by anything this phase changed — nothing in this phase's own
   6-file diff (§7) touches `tests/executable/*` or the ephemeral-pg fixture script.
2. **1 failure, genuinely caused by this mandate's own earlier work — found and fixed.**
   `tests/launch/lb-merchant-admin.test.mjs`'s "Staff RBAC: the guard fails closed ..." structural pin
   regex-matched `staff-permission.ts`'s raw source for `export function evaluateStaffPermission` and
   `reason: 'owner'`. Commit `95467608` (this same D03 mandate, an earlier session window — "target-data-backed
   shadow comparator, circular import removed") relocated the actual `evaluateStaffPermission` definition
   into a new, dependency-free `lib/staff-permission-decision.ts` (`staff-permission.ts` now only
   re-exports it), so both regexes stopped matching. The underlying behavior was never affected — proven
   separately, unchanged, by `staff-paths-fail-closed.test.ts` (part of the 100%-clean gateway suite,
   §5/§6). Fixed this pass (commit `ce13b6c8`) by pointing the two stale assertions at the file the
   shape actually lives in now; re-ran the file alone, 15/15 pass (was 14/15).

**Remaining in run 2 (25 failures, 2090 total — the number this document stands behind):**

> **Corrections (2026-09-29, `PHASE2_TEST_BASELINE_RECONCILIATION.md` §2):** (a) "2090 total" counted only the first half
> of the root script — `&&` skipped `test:contracts` (320 tests) once that half failed — so it was never the root suite's
> total; (b) item 3's cause below is wrong; (c) item 4's attribution method is replaced. A note follows each item.

3. **4 failures, `tests/executable/*-postgres.test.mjs` — environment-sensitive, a different and more
   specific cause than run 1's.** `checkout-order-concurrency-postgres.test.mjs`,
   `gift-card-issue-idempotency-postgres.test.mjs`, `late-capture-after-release-postgres.test.mjs`,
   `money-rpc-idempotency-sweep-postgres.test.mjs` — each failed at the file/hook level, traced (by
   re-running a neighboring file after starting the fixture) to `duplicate key value violates unique
   constraint "pg_authid_rolname_index" ... Key (rolname)=(app_tenant) already exists`: cluster-global
   Postgres ROLE state left over inside the shared `letbuyy-executable-pg` fixture from an earlier run of
   this same container (roles are cluster-wide, not per-database, so `DROP DATABASE` between runs does
   not clear them). Confirmed pre-existing fixture-hygiene state, not this phase's own — nothing in this
   phase's 6-file diff touches these files or the fixture script. Resolving it would mean recreating
   shared test infrastructure, outside this mandate's authorization ("no broad Docker cleanup").

   > **Correction (2026-09-29, `PHASE2_TEST_BASELINE_RECONCILIATION.md` §2 C-1, §4):** the cause stated above is wrong. These
   > four suites fail at file level because each carries a deliberate guard that refuses to run unless
   > `LETBUYY_EXECUTABLE_PG_CONTAINER` names a dedicated throwaway container, and the old root script supplied none. The
   > role-collision error is a real, reproducible hazard when two suites share a cluster at the same time, but it is not
   > what failed these four. They now run, and pass (5, 5, 12 and 4 tests), in owned clusters.
4. **~21 failures, pre-existing, unrelated domains — confirmed by reading each failure message and by a
   `git diff --name-status c1717e80..HEAD` (this pass's own 6-file diff, §7) containing none of them.**
   Re-verified 3 of these in complete isolation (`node --test` on just those 3 files, outside the full
   2090-test run) and they reproduce identically standalone — ruling out full-suite ordering/interference
   as the explanation; they are genuinely red on this branch. By domain: `design-system-consolidation.test.mjs`
   (`ENOENT: apps/merchant-web/package.json` — a path stale since the APPID-P1 app-layout rename, an
   unrelated, already-completed phase); `rest-shim-parity.test.mjs` (storefront REST/GraphQL response
   shape parity); `app-api-route-ownership.test.mjs` / `app-billing-payout.test.mjs` (app-platform route
   ownership and payout provider-fabrication checks); `production-deploy-workflow.test.mjs` (production
   Vercel topology — CLAUDE.md already records the Vercel project IDs as placeholder strings pending
   DEPLOY-1, an already-known, already-open condition); `first-party-liquid-portability.test.mjs` (Liquid
   theme block portability); `production-parity.test.mjs` / `remaining-scaffolds.test.mjs` (gateway
   auth-verifier registry *order* snapshot — `middleware/auth.ts` itself has **zero diff** against
   `develop` on this branch, confirmed by `git diff --stat develop...HEAD`, last real change commit
   `92769175`, an earlier, unrelated Phase N3 session); `lb-experience-flow.test.mjs` (Experience
   Picker/editor UI, 3 tests, isolation-confirmed); `lb-phase5-commerce.test.mjs` (invite-acceptance proxy
   shape); `lb11-giftcards.test.mjs` / `lb12-registration.test.mjs` / `lb6-collections.test.mjs`
   (a hardcoded "188 routes" lockstep count, isolation-confirmed — this branch's actual route count has
   drifted from that figure for reasons unrelated to D03: this phase added zero routes, only changed
   authorization logic inside three already-existing product handlers); `lb13-security-trio.test.mjs`
   (`assertProviderPaymentNotReplayed` call-signature drift, payment-replay domain);
   `dual-model-consolidation.test.mjs` / `storefront-cache.test.mjs` (isolation-confirmed — a 'blog'
   storefront route's cache-key/cache-tag wiring, unrelated to staff/product-mutation) /
   `variant-checkout-deferral.test.mjs` (storefront performance domain). None of these files, or the
   files they check, appear in this phase's 6-file diff (§7).

   > **Correction (2026-09-29, `PHASE2_TEST_BASELINE_RECONCILIATION.md` §2 C-3, §6.2):** "not in this phase's diff" is not
   > attribution. The failures are exactly 21 tests in 17 files; each was run at the pre-Phase-2 base `130b669d` in a clean
   > export and fails there with the same error; each is repaired; none was a product defect.

**Conclusion:** the root gate is genuinely not green (25 failures), and this document does not claim
otherwise. Every one of the 25 is accounted for by name and by verified cause; zero touch a file this
phase changed; the only failure this phase's own work was responsible for (item 2 above) is fixed.

> **Superseded (2026-09-29):** with the corrections above, the root gate at `e21dc2d9` is green — 2445 tests, 0 failures,
> 15 named `[HUMAN-REQUIRED]` skips (`PHASE2_TEST_BASELINE_RECONCILIATION.md` §11).

---

## 7. This pass's new/changed files

`git diff --name-status c1717e80..ce13b6c8` (this window's own commits: `33b3ffa2`, `c53c15ff`, `ce13b6c8`):

```
M	services/api-gateway/src/__tests__/backfill-and-target-shadow.postgres.test.ts
A	services/api-gateway/src/__tests__/local-postgres-support.ts
M	services/api-gateway/src/__tests__/real-http-shadow-rehearsal.postgres.test.ts
A	services/api-gateway/src/__tests__/real-staff-product-journey.postgres.test.ts
M	services/api-gateway/src/__tests__/verification-token-redemption.postgres.test.ts
M	tests/launch/lb-merchant-admin.test.mjs
```

Every path above is either a new test/support file this mandate's own verification work required, or a
narrowly-scoped fix: one stale comment in a sibling rehearsal file (the correction above) and one stale
structural test pin (§6 item 2), both made stale by `staff-permission.ts`'s shadow-logic relocation from
an earlier window of this same continuous D03 effort (commit `95467608`), not by anything in this
window. `staff-permission.ts` and `identity-foundation/staff-role-backfill.ts` are read and exercised by
this window's new tests but not themselves edited here. Nothing outside
`services/api-gateway/src/__tests__/` and `tests/launch/lb-merchant-admin.test.mjs` was touched.

---

## 8. Remaining, explicitly not closed

> **Update (2026-09-29):** the third bullet (role contamination) is corrected and the fifth (the ~21 failures) is resolved —
> see `PHASE2_TEST_BASELINE_RECONCILIATION.md` §2 and §6. The other bullets stand.

- **Authoritative identity cutover** — not attempted, not authorized this pass.
- **Sustained, production-shaped shadow-observation window** — genuinely new work beyond this pass's
  bounded scope, as recorded previously; not attempted.
- **The `letbuyy-executable-pg` fixture's cluster-global role contamination** (§6 item 3: 4 remaining
  `tests/executable/*-postgres.test.mjs` failures) — a real, reproducible condition, precisely
  diagnosed, deliberately not remediated here: out of D03's scope, and fixing it safely (a clean
  recreate of shared test infrastructure) is outside what this pass is authorized to do without the
  owner's word.
- **The five non-D03 test files duplicating the older, differently-shaped hardcoded container-name
  pattern** (§4) — deliberately left alone, named precisely rather than silently ignored.
- **The ~21 pre-existing, unrelated-domain root-suite failures** (§6 item 4) — named precisely,
  3 reproduced in isolation to rule out full-suite ordering effects; none are this mandate's to fix.
- Every item `PHASE2_DECISIONS.md` already records as `BLOCKED` on an open owner decision remains
  exactly that: D04 operator bootstrap/recovery, D04.9 moderation/impersonation callers, D05 export
  execution/retention/deletion. Not re-asked here.

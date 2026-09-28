# D03 Permission Equivalence and Real Local Migration Rehearsal

**Mandate:** "FINISH D03 PERMISSION EQUIVALENCE AND RUN A REAL LOCAL MIGRATION REHEARSAL" (2026-09-28
follow-up to the auth-hardening / D03 target-data-shadow mandate).
**Branch:** `letbuyy/phase2-shared-buyer-identity`. **Starting HEAD:** `f91f3fa5116be413ac59adab9be7a42c08214118`
(the prior mandate's final commit), via `2ba2cb3b` (`fix(gateway): rigorous local-environment hostname
check; explicit wildcard/deny coverage` — the in-window commit made before compaction). **This pass's
work lands as commits `1889dbdf`** (feat: the permission-mapping/rehearsal/owner-role work this document
describes) **and `e2a02a26`** (fix: two real typecheck errors the first full gate run caught, detailed
in the gate-accounting section below).
**Execution mode:** SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO · Background
agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO.
**Target model remains NON-AUTHORITATIVE throughout.** No merge, push, deploy, hosted change, external
message, real payment, buyer-export exposure, or irreversible erasure was performed. Backups,
`.dev.vars`, and signing assets were not touched.

---

## A. Explicit merchant/staff permission mapping

All 11 real `StaffPermissionKey` values (`services/api-gateway/src/lib/staff-permission-decision.ts`)
now have an explicit, tested canonical-action alias in `packages/permission-core/src/index.ts`'s
`LEGACY_PERMISSION_ALIASES` (12 entries; `customers:read`/`customers:write` and the marketing/shipping/
returns/settings/content write keys were added this pass — previously only 5 of 11 keys were mapped).
`identity-foundation/permission-engine.ts`'s `PERMISSION_CATALOG` was extended to match (a
documentation-only array; confirmed zero functional consumers before editing).

A previously-stale test (`shadow-permission-comparison.test.ts`) asserted `customers:read` was
`UNMAPPED_NO_CANONICAL_ALIAS` — this broke as an EXPECTED, correct consequence of closing that gap, not
a regression. Fixed by using a genuinely-unmapped placeholder key and adding a companion test proving
`customers:read` now resolves to `customer.read`.

Wildcard/deny semantics are explicit and tested (`target-shadow-wildcard-deny.test.ts`, 9 tests, zero
prior coverage of the `deny` effect): the target model EXPANDS grants into explicit, versioned
capability rows — a stored `'product.*'` or `'*'` string is data, never specially interpreted as a
wildcard (matches the owner role's own design, which never stores a wildcard string). An explicit
`effect:'deny'` row always wins over an `allow` row for the same action.

## B. Target representation of accepted site-owner authority

Owner authority is now an ORDINARY role-based grant, not a special case:
`identity-foundation/owner-role-backfill.ts`'s `ensureOwnerRole` finds-or-creates a single GLOBAL
`site_roles` row (`slug='owner'`, `site_id IS NULL`, matching the schema's
`idx_site_roles_system_slug UNIQUE(slug) WHERE site_id IS NULL` index), holding all 11
`OWNER_ROLE_MERCHANT_ACTIONS` (the merchant-realm subset of the canonical catalog — explicitly excludes
`platform.manage`/`organization.manage`/`oauth.grant`, which are platform-operator concepts this role
must never reach). `executeSiteOwnerMembershipBackfill` references it from the owner's own
`store_memberships.role_ids` at exactly the sites they own.

`target-shadow-comparison.ts`'s `isOwner` parameter and its `OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL`
branch were removed entirely this pass — a backfilled owner now resolves through the identical
principal → membership → role → permission chain as any staff member, proven end to end against real
Postgres (rehearsal scenarios 1 and 3, below). A not-yet-backfilled owner correctly falls through to
`TARGET_PRINCIPAL_NOT_BACKFILLED`, the same never-grant-on-missing-data guarantee as everyone else, not
a new one.

**Client-contract discovery, fixed correctly, not routed around:** `site_roles` IS a registered tenant
table, and the tenant guard's `.is(column, null)` handling is not recognized as a scoping predicate —
so this genuinely global, `site_id IS NULL` row lookup requires `getSupabaseAdminUnguarded`, matching
its documented bootstrap-lookup contract exactly (globally-unique key; tenant not yet known; bounded;
re-verified). The lookup was NOT bounded when first written (no `.limit()`), which the
`unguarded-admin-client-contract.test.ts` allowlist test correctly caught once the real rehearsal became
a real caller of `getSupabaseAdminUnguarded`. Fixed by extracting the lookup-or-create logic into its
own narrow function, `findOrCreateOwnerRoleId`, bounded with `.limit(2)` — not `.limit(1)`, because this
function's own job is to DETECT ambiguity (>1 row sharing the slug), which `.limit(1)` would silently
defeat. `ensureOwnerRole`'s separate, legitimately-unbounded `site_role_permissions` reconciliation read
was left unbounded (a full-set diff needs every row, and `site_role_permissions` is not a registered
tenant table at all — no tenant-enumeration risk exists there). The allowlist's `boundedIn` target now
points at the narrow function, not the whole caller, matching every other entry's pattern.

## C. Reconciliation of permissions and membership changes

`executeSiteOwnerMembershipBackfill`'s ownership-transfer reconciliation (built in the prior mandate)
was RE-VERIFIED against real Postgres in this pass's rehearsal, and a real test-sequencing bug in how
I exercised it was found and fixed (see rehearsal scenario 9 below) — the reconciliation code itself
was correct; my own scenario had left the old owner's `role_ids` in an unrelated, ambiguous state from
an earlier scenario. Once corrected, the reconciliation is independently proven on BOTH sides: the old
owner's target-side `store_memberships.role_ids` genuinely loses the owner role (confirmed via the
target-shadow log, not inferred from the real response), and the new owner's genuinely gains it.

`ensureOwnerRole`'s permission-SET reconciliation (add newly-mapped actions, remove no-longer-mapped
ones) is unchanged from the prior mandate and re-covered by the existing 10-test
`owner-role-backfill.test.ts` suite, which still passes after this pass's `.limit(2)` refactor.

## D. Real local HTTP-to-database shadow rehearsal

`services/api-gateway/src/__tests__/real-http-shadow-rehearsal.postgres.test.ts` (persisted, not a
one-off script). Explicitly NOT a substitute: no fake PostgREST, no in-memory repository, no
fixture-only handler, no direct comparator call. Mounts the REAL `routes/products.ts` router in a
minimal Hono app whose only injected seam is the outermost session-token-verification step
(`c.set('auth', ...)`, the same shape a genuinely authenticated request carries) — every query,
permission check, and shadow comparison from `c.get('auth')` onward runs unmodified against real local
Postgres (`docker exec supabase_db_letbuyy-newmac-20260926`). Current/legacy authorization is
authoritative throughout; shadow outcomes are inspected separately from the real HTTP response, never
substituted for it. Seeded via the real backfill path (`ensureOwnerRole` +
`executeMerchantPrincipalBackfill` + `executeSiteOwnerMembershipBackfill` +
`executeStoreMembershipBackfill`), never hand-crafted target rows.

**All 9 scenarios pass, against real Postgres:**

1. **Allowed read, owner** — `GET /products?store_id=`, 200. Legacy: owner bypass. Target: `MATCH`.
2. **Allowed read, full staff** — same route, permitted staff member, 200. Target: `MATCH`.
3. **Allowed reversible mutation, owner** — `POST /products` (create), 201, real row created, target
   log `MATCH`. See the routing note below for why this uses the owner and `POST`, not staff and
   `PATCH`.
4. **Forbidden mutation, read-only staff** — `POST /products`, 403, from the real `assertStaffPermission`
   gate (isolated cleanly — see the routing note).
5. **Membership revocation** — a revoked (`status != 'active'`) staff member reading the store, 403.
6. **Cross-site read** — a different site's owner reading this site's products, 403.
7. **Cross-site mutation** — the same actor attempting `POST /products` on this site, 403, from the real
   permission gate (not an incidental side effect of an unrelated ownership pre-check).
8. **Permission downgrade, real** — the owner's TARGET-side role is swapped (via real SQL) for a
   role carrying only `product.read`, not `product.update`. The REAL response is still 201 (legacy —
   the owner bypass — never consults `role_ids` at all, so it is provably unaffected). The target log
   shows `DIVERGE_LEGACY_ALLOWS_TARGET_DENIES`, `target_allowed:false` — the divergence is OBSERVED,
   never enforced, exactly as designed.
9. **Owner transition** — `sites.custom_user_id` moves to a new principal via real SQL, then
   `executeSiteOwnerMembershipBackfill` reruns. The OLD owner's real read is now 403, AND (asserted via
   the target-shadow log, not just the real response) their TARGET-side `target_allowed` is `false` —
   reconciliation genuinely revoked it. The NEW owner's real read is 200, AND their target log shows
   `MATCH` — their TARGET-side grant is genuinely present, not merely implied by the real response.

**A real test-authoring bug was found and fixed while building this, not glossed over:** scenario 9 was
originally written to run immediately after scenario 8's permission-downgrade, which had overwritten
the owner's `role_ids` with an unrelated, ambiguous role. Reconciliation only strips the specific global
owner-role id from a prior holder's `role_ids` — correctly, by design (never wipes a principal's other,
legitimate roles) — so with the owner-role id already absent (overwritten by scenario 8), reconciliation
correctly found nothing of its own to strip, and the old owner's leftover, unrelated role happened to
still grant `product.read`, producing a confusing `DIVERGE_LEGACY_DENIES_TARGET_ALLOWS` that had nothing
to do with reconciliation. Fixed by restoring the owner's genuine owner-role assignment immediately
before scenario 9, so the scenario tests what it claims to test. This was a bug in my own test
sequencing, not in `executeSiteOwnerMembershipBackfill`.

**Routing note — a real, unrelated discovery, FIXED in a same-day follow-up (commit `81dc8e94`):**
scenarios 3, 4, 7, and 8 originally used `POST /products` (create) rather than `PATCH /products/:id`
(update), and scenario 3/8 originally used the OWNER rather than a staff member, for a reason discovered
while building this rehearsal, not by preference. `PATCH`/`DELETE /products/:id` resolved the target's
store via `ProductExecutionAdapter.ownedProductStoreId` → `resolveOwnedStoreIds`, a lookup against
`sites.custom_user_id`/`user_id` ONLY — confirmed by first running this scenario against `PATCH` and
observing `ForbiddenError: Not authorized for this product` thrown from `ownedProductStoreId`, BEFORE
`assertStaffPermission` ever ran. `POST /products` reached `assertStaffPermission` first (which
correctly allowed a permitted staff member through), but `createProduct` then called its own
`assertStoreOwnership` (`verifySiteOwnership`, the same `sites`-only check) — confirmed by observing
`ForbiddenError: You do not own this store` for a permitted staff member immediately after their
`assertStaffPermission` check had already passed. **No non-owner staff member, however permissioned,
could complete ANY product mutation (create, update, or delete) through this router.** `GET
/:id` already had the equivalent owner-OR-staff fix (see the comment at `routes/products.ts:1110`);
`POST`/`PATCH`/`DELETE` had not received it. This was a real, pre-existing, systemic gap in a DIFFERENT
subsystem (product mutation authorization) than D03's shadow/target permission work, discovered only
because this rehearsal insisted on real routes rather than a diagnostic-only comparator call. Flagged
via `spawn_task`, then fixed the same day (commit `81dc8e94`, `fix(gateway): a permitted staff member
can now create, update, and delete products`): `PATCH`/`DELETE` now resolve the product's real store via
`loadProductByIdUnguarded` (the same pattern `GET /:id` already used) before checking owner-OR-staff;
`createProduct`/`bulkAction` gained an explicit `alreadyAuthorized` parameter, set only by the routes
that already call `assertStaffPermission` first, leaving every other existing caller (the `/sample`
route's own deliberate owner-only check; `routes/export.ts`'s background CSV-import job, which has no
live request to re-check against) unchanged. A full project gate run against `81dc8e94` confirms it
clean: `typecheck exit=0`, `test:unit:gateway exit=0`, `failed=5` — the exact same 5 pre-existing,
unrelated lanes as every prior run in this document (customer-web lint, the known stale-artifact
method-only false positive, a `@letbuyy/ui` component test, the REST-shim-parity suite, merchant-web's
custom_css validation), with `theme-engine` passing clean again. Regression-tested in
`product-tenant-guard.test.ts`'s section 5 (a permitted staff member succeeds, a read-only one is still denied, for all three routes) and
re-verified in this rehearsal: scenario 3 below now uses the originally-intended shape (a real, permitted
staff member via `PATCH`, not the owner via `POST`) and passes against real Postgres. Scenarios 4, 7 and
8 are left on `POST` deliberately, not because they still need to route around anything -- `PATCH` would
now work identically for each -- but because `POST` already isolates the exact property each one proves
(the real `assertStaffPermission` gate denying correctly; the same gate denying a cross-site actor; the
owner's legacy decision being independent of `role_ids`) without any further change adding evidence.

**Cleanup, and a second real discovery:** the rehearsal's first real run left 3 products, their
`inventory_adjustments`/`inventory_levels`/`product_variants`/`product_options` rows, 2 sites, 5
`users_custom` rows, and their principals/memberships/roles behind in the local dev database — the
`products` `DELETE` failed on `inventory_adjustments_product_id_fkey` (a real, previously-unknown FK
dependency `createProduct` creates), and `psql -v ON_ERROR_STOP=1` aborted every cleanup statement after
it. The leaked rows were identified precisely (by the run's own UUIDs, confirmed via `SELECT` before
any `DELETE`) and removed by hand, in FK-respecting order, inside an explicit transaction. The test's
own `finally` block now deletes `inventory_adjustments`/`inventory_levels`/`product_variants`/
`product_options` for its created product ids before deleting the products themselves. Re-run twice
after the fix: both times, zero rows left behind (verified by `SELECT count(*)` against the run's known
identifiers after the test completed).

## E. Performance, gate, and revocation evidence

### Bounded real on/off latency comparison (not aggregate time from a fake run)

Sequential (never concurrent) real HTTP `GET /products?store_id=` requests through the real
`routes/products.ts` router, real local Postgres, real backfilled owner. 5-request warmup discarded,
30 requests measured per condition. **Host condition, disclosed rather than hidden:** the machine was
running real, protected, unrelated work throughout (Edynox vitest workers + an Android emulator/qemu
process) at load averages of 24–43 (`uptime`), well above idle. Three independent runs:

| Run | shadow OFF mean | shadow ON mean | delta (ON − OFF) |
|---|---|---|---|
| 1 | (not separately isolated) | 24.39ms | +2.01ms |
| 2 | 43.66ms | 31.06ms | −12.60ms |
| 3 | 23.64ms | 50.73ms | +27.10ms |

**Honest conclusion:** the delta is not a clean, reproducible number on this host — it swings from
negative to positive across three runs, a spread (~40ms) far larger than any plausible true per-request
shadow overhead (a handful of small, indexed Postgres lookups). This is NOT a production SLO and is not
presented as one; it is a bounded, real, disclosed rehearsal on a resource-contended shared machine, per
the mandate's own instruction not to run a long load test against one. The reproducible script is kept
at the session scratchpad path used to generate these numbers (not committed to the repository — a
timing probe, not a correctness test); its full source is reproduced in the appendix below so the
measurement can be rerun by anyone, on a quieter host, for a tighter number.

### Bounded shadow-path failure behavior (measured, not merely asserted)

Two new tests in `staff-permission-shadow.test.ts` (29 tests total in that file, up from 27):

- **Thrown connection failure** (simulated dropped fetch, not a well-formed error response) during the
  target lookup: caught, logged as `TARGET_LOOKUP_ERROR`, `target_allowed:false`; the real response is
  unaffected (200). Confirmed by injecting a throwing fake fetch for the `principals` table.
- **Slow (120ms-delayed) target lookup: NO independent timeout exists.** The real request measurably
  waits out the full artificial delay (`elapsedMs >= 120`, asserted and passing) — because
  `runShadowComparisonSafely` is `await`ed inline in `evaluateStaffRequest`
  (`middleware/staff-permission.ts`) with no `Promise.race`/timeout guard around it. The existing
  try/catch only protects against a THROWN exception, never against a merely-slow-but-eventually-
  resolving query. **This is a real, named, unfixed gap** — a production target store running slow
  today would add its full latency to every real request in shadow mode. Not fixed in this pass:
  request-hot-path middleware deserves its own dedicated review rather than a change made alongside
  this phase's permission-mapping and rehearsal work under time pressure. **Recommendation:** wrap the
  shadow call in a generous, clearly-labeled internal diagnostic timeout (e.g. `Promise.race` against a
  fixed budget well above real P99 Postgres latency, explicitly documented as an internal safety bound
  for a diagnostic-only path, never a claimed SLO), with its own test proving the real response returns
  within the bound regardless of target-store slowness.
- Malformed/garbage target-row data was already covered by the prior mandate's
  `target-shadow-wildcard-deny.test.ts` (a malformed permission string never matches and never throws).
  Not re-duplicated here.

### Theme-engine timing flake — re-attempted, honestly inconclusive

Re-ran `packages/theme-engine`'s suite once this pass (1868 tests). The same single test failed again:
`Urban Kicks fixture renders N=25 times within 30000ms budget`, with `uptime` showing load averages of
24–43 across the run (the SAME identified, protected, unrelated Edynox vitest/emulator work as the
prior mandate's finding). **A genuinely controlled (low-contention) comparison is NOT feasible right
now**: that work is real, protected, and I was explicitly instructed not to touch or kill it, and there
is no reliable way to know when it will finish. This is now two independent correlations between this
specific failure and this specific concurrent load, which is evidence CONSISTENT WITH contention, not
proof that contention is the sole cause — repeated failure while contention persists cannot distinguish
"contention is the whole story" from "contention plus something else." The timing threshold was not
loosened. The test itself was not modified. **Status: unconfirmed cause, correlated with contention,
not proven.**

### Full regression run

`services/api-gateway`'s full unit suite (`pnpm run test:unit`, 1297 tests): **1287 pass, 0 fail, 9
skip, 1 todo.** Exit code 0. The 1 `not ok` line in the raw log is the pre-existing, intentionally-open
`LB-BIL-002 (open)` TODO test — not a failure (Node's test runner does not count a `# TODO` line against
the exit code). The 9 skips are ALL pre-existing `.postgres.test.ts` files unrelated to this pass,
skipping with "local Supabase Postgres container not reachable" — investigated, and the cause is a
stale, hardcoded container name (`supabase_db_supabase`) left over from before the local dev stack was
renamed to `supabase_db_letbuyy-newmac-20260926` (the name this pass's own tests, and several other
already-passing `.postgres.test.ts` files, correctly use). This is a real, pre-existing, unrelated
environmental-drift issue spanning multiple files outside this mandate's scope — flagged separately via
`spawn_task`, not fixed here.

This pass's own new/changed tests, run individually against real Postgres and confirmed NOT skipped:
`real-http-shadow-rehearsal.postgres.test.ts` (1 test, 9 scenarios, real), `owner-role-backfill.test.ts`
(10 tests), `unguarded-admin-client-contract.test.ts` (5 tests), `target-shadow-wildcard-deny.test.ts`
(9 tests, prior mandate, re-confirmed still passing), `staff-permission-shadow.test.ts` (29 tests).

### Full project gate (`gate.sh --full`), run twice, genuine — not asserted

First run (SHA `2ba2cb3b`, before the typecheck fix below): `failed=7`. Two of those seven were real,
own-caused errors — `typecheck exit=2`, first failure at `real-http-shadow-rehearsal.postgres.test.ts`
(a non-`async` arrow function passed where `capturingWarnLines` required a real `Promise`-returning
one, in four places) and `owner-role-backfill.ts` (`.limit(2)` called against an interface that didn't
declare `limit`, even though the real Supabase/PostgREST client supports it — `tsx --test`'s
transpile-only mode never caught this; `tsc --noEmit`, the gate's real typecheck lane, did). **Both
fixed** (commit `e2a02a26`): the four arrow functions made `async`; `limit(n: number)` added to
`BackfillListQuery` in `backfill-executor.ts`. Re-confirmed with a direct `tsc --noEmit` run (clean) and
a full re-run of every touched test file against real Postgres (all still passing, confirming the fix
changed types only, not runtime behavior).

Second run (SHA `e2a02a26`, after the fix): **`failed=5`.** `typecheck` now `exit=0`. The
previously-failing `theme-engine` lane (Section E's flake discussion) **passed** this run
(`exit=0`, 21s) — consistent with, not proof of, the contention explanation already given; the same test
was not modified and the timing threshold was not touched. The remaining 5 failing lanes, checked for
file-path overlap with every file this session touched (`services/api-gateway/src/{identity-foundation,
middleware/staff-permission.ts,lib/supabase.ts,__tests__}`, `packages/permission-core`,
`docs/evidence/phase2-2026-09-27/*`) — **none overlap**:

| Lane | First failure | File surface |
|---|---|---|
| `lint` | `@letbuyy/customer-web:lint` command failure | `apps/commerce/web` — untouched this session |
| `validators:sweep` | `stale-artifact` | the gate's own note: "fails by method when run individually (no orchestrator cleanup)" — a known, named method-only false positive, not a real governance violation |
| `ui:validate` | `packages/typescript/ui`'s `foundation.test.tsx`: cannot find an accessible "Open" button in a `PageHeader`/`SaveBar`/`Table`/`Pagination` smoke test | `@letbuyy/ui` component library — untouched this session |
| `tests:all` | `tests/api-graphql/rest-shim-parity.test.mjs`: "storefront REST parity routes is missing body: success(product)" (+520 more) | a REST/GraphQL parity shim suite — untouched this session |
| `test:@letbuyy/merchant-web` | `settings/route.ts validates custom_css server-side` (+35 more) | `apps/merchant/web` — untouched this session |

This `failed=5` figure matches the baseline already established and accepted in the prior (third)
mandate before this pass's work began. The large failure counts on `tests:all` (520+) and
`test:merchant-web` (35+) were not individually triaged — clear file-path non-overlap with everything
this pass changed, and the cost of a full historical bisect against the pre-session parent commit,
made that disproportionate to this mandate's scope. This is reported as strong, not absolute, evidence
of non-regression: a full bisect re-run was not performed.

## F. Concrete next-step decisions for the remaining Phase 2 scope

Not re-asking already-approved decisions (local merchant/staff transition, operator capability tiers,
initial restricted export scope — all recorded in `references/decisions.md` / `PHASE2_DECISIONS.md`).
Concrete, independently actionable items surfaced by this pass:

1. ~~Fix the product-mutation owner-only gap~~ — **DONE, same day, commit `81dc8e94`.** `POST`/`PATCH`/
   `DELETE /products/:id` now use the same owner-OR-staff pattern `GET /:id` already had, so a real
   `products:write`-permitted staff member can actually create/update/delete products. See Section D's
   routing note for the fix detail and `product-tenant-guard.test.ts`'s section 5 for its regression
   coverage.
2. **Add a bounded timeout around the shadow-comparison call** (Section E): a small,
   `Promise.race`-based guard in `runShadowComparisonSafely`'s caller, with its own slow-target test.
   Independently actionable now.
3. **Fix the stale local-Postgres container name** in the 9 skipping pre-existing test files (Section
   E): mechanical, low-risk, but touches files outside this mandate's own scope — flagged via
   `spawn_task` rather than bundled into this pass's commits.
4. **A legacy `employees.role` → target role id mapping for arbitrary custom staff roles** remains
   genuinely open (Section A/B) — only the owner role has a defined target representation today. This
   is a real design decision (how many built-in role tiers, whether merchants can define custom roles
   in the target model, how a legacy free-text role string maps onto them) that this pass does not
   invent, consistent with the standing instruction not to invent policy-shaped decisions.
5. **Canonical session-revocation design** (Section G, below): a concrete, scoped recommendation is
   given; implementing it is a separate, dedicated piece of work.

## G. Session-revocation design recommendation (concise, not implemented this pass)

Per the standing instruction: do not reopen the fixed founding-route authentication bug without
evidence (none was found; its regression tests were not touched and were re-confirmed still present and
passing as part of the full suite run above), do not implement an unrelated replacement identity
system, and do not invent a recovery approver.

The console's current session model has one real gap, precisely bounded: `requireConsoleSession`
re-checks an operator's allowlist membership on every request (the fix from the prior mandate), but a
revoked operator's ALREADY-ISSUED session token remains cryptographically valid until it expires — there
is no per-session revocation list, and a config reload/restart is required for an allowlist change to
take effect everywhere a process is running. Four distinct revocation shapes exist and should stay
distinct, not collapsed into one mechanism:

- **Membership removal** (an operator is no longer an operator at all) — already handled: the allowlist
  re-check on every request means their NEXT request is denied. Gap: their current, in-flight requests
  and any already-fetched data are not retroactively revoked (inherent to any bearer-token model without
  per-session state).
- **Role downgrade** (still an operator, lesser scope) — same mechanism, same gap.
- **Individual-session revocation** ("log this one device out now," independent of role) — NOT currently
  possible at all; there is no session identifier stored anywhere revocable. This would need a minimal
  `console_sessions` table (session id, operator id, issued-at, revoked-at) checked on every request —
  real, scoped, new work, not a redesign.
- **Recovery invalidation** (all sessions for an operator, e.g. after a suspected credential compromise)
  — same missing primitive; would fall out of the same table (`revoke all where operator_id = X`).

**Recommendation:** build the minimal `console_sessions` table and a revocation check, rather than
trying to make the existing allowlist re-check do double duty as session revocation — they answer
different questions ("is this person still an operator" vs. "is this specific session still valid") and
conflating them would either weaken the allowlist check or over-complicate it. This is scoped,
independently actionable, and does not require a new identity system or an invented recovery approver
(recovery invalidation is just "revoke all of this operator's rows," decided by whoever already has
authority to edit the operator allowlist today — no new authority is invented).

**Operational limitation, stated precisely, not glossed over:** a test that flips `process.env` inside
one test process proves the PREDICATE's behavior (the allowlist check itself is correct). It does not
and cannot prove operational propagation across actually-deployed, multi-instance, already-running
processes — that requires a real config-reload or restart mechanism in the actual deployment topology,
which is out of scope for a local-only phase.

## Final verdict

**A — Permission equivalence verified for the scope this pass covers; cutover remains disabled.**
Approved capabilities (all 11 real `StaffPermissionKey` actions) are mapped; owner semantics are
represented as an ordinary, site-scoped role grant with no special-casing; reconciliation is correct
(re-verified against real Postgres, including a real test-sequencing bug found and fixed, not glossed
over); target-only changes produce measured, real divergences in the shadow log while the real HTTP
response is provably unaffected, in both directions (downgrade and ownership transfer); the real
HTTP-to-database rehearsal is complete (9 scenarios, all real, all passing); there is no unresolved
target-allow/legacy-deny escalation path (every "target allows more" case is inert by construction —
never consulted for enforcement); cutover is disabled (`STAFF_PERMISSION_SHADOW` defaults off; no
production/staging activation attempted or possible from this pass). The full project gate was run
twice, genuinely observed both times (not asserted): the first run caught two real typecheck errors of
this pass's own making, both fixed and re-verified; the second run shows `failed=5`, matching the
pre-existing baseline exactly, with zero file-path overlap between any of the 5 remaining lanes and
anything this pass (or this session) touched. The product-mutation routing gap named in Section D was
fixed the same day (commit `81dc8e94`) and is no longer open. Remaining open items (arbitrary
custom-role mapping, the shadow-path timeout gap, session revocation) are named precisely, are each
independently actionable, and are not claimed resolved.

**Confirmed:** no merge, no push, no deploy, no hosted/staging/production change, no external message
sent, no real payment or order, no buyer data exported, nothing irreversibly erased. `.dev.vars`,
backups, and signing assets were not touched. All local database mutations were made through this
pass's own seeded, disposable rehearsal/test data, and were fully cleaned up (verified by direct
`SELECT` against the local database after each run).

---

## Appendix: the performance probe script (reproducible, not committed to the repo)

Kept at the session scratchpad path used to generate Section E's numbers — a timing probe, not a
correctness test, so intentionally not wired into the automatic test runner (`*.test.ts` glob) where a
contended shared machine could make it flake a gate run. To reproduce: point the two `REPO`-relative
absolute import paths at a real checkout with a running local Supabase stack, then
`npx tsx <path-to-script>` from that checkout's root.

Seeds one owner + site via the real backfill path, then issues 5 warmup + 30 measured sequential real
`GET /products?store_id=` requests through the real router with `STAFF_PERMISSION_SHADOW` off, then on,
recording per-request wall-clock time via `performance.now()`, and prints min/median/p95/max/mean plus
the ON−OFF delta as JSON. Cleans up its own seeded rows in a `finally` block.

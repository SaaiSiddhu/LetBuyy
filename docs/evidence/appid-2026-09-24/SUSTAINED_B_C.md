# SUSTAINED-B (cloud validation dependability) and SUSTAINED-C (tenant-guard predicate tightening)

Branch `letbuyy/sustained-b-cloud-validation`, base `68269cb` (develop, includes merged APPID-FIX2).

## B.A — non-Docker Postgres feasibility: SOLVED

Docker's daemon is not reachable in this container (`docker info` fails), but a real
`postgresql-16` package/cluster is already installed and startable (`service postgresql start`;
`pg_lsclusters` showed it `down`, now `online`). Every Postgres-backed suite in this repo talks to
Postgres exclusively through a fixed, small set of `docker inspect/run/start/stop/exec` calls
(`scripts/governance/foundation-ephemeral-postgres.mjs` and ~55 `tests/executable/*-postgres.test.mjs`
+ `tests/identity-foundation/*.test.mjs` files, all using `LETBUYY_EXECUTABLE_PG_CONTAINER`/
`_DATABASE`). `scripts/dev/docker-shim/docker` translates exactly that subset onto the native
cluster via the `postgres` OS role (peer auth, unix socket) when prepended to `PATH`; it re-execs
the real `docker` unchanged whenever a real daemon is reachable, and is never installed globally.
No test file, migration, fixture or assertion changed.

Verified: `tests/executable/money-ledger-postgres.test.mjs` passes end to end through the shim —
migration 139 applied for real, the real append-only ledger trigger fires, real RLS policies exist.

Separately, `services/api-gateway/src/__tests__/{gift-card-money-path,gst-invoice-issuance,
gst-tax-computation,inventory-reservation-lifecycle,merchant-tenant-predicate}.test.ts` probe a
DIFFERENT container (`supabase_db_supabase`) expecting a full local Supabase CLI stack (GoTrue,
PostgREST, `supabase db reset` fixtures), not just bare Postgres. Standing up the Supabase CLI's
own stack is out of this phase's scope (it needs Docker Compose itself); these remain
`BLOCKED_INFRA`, already self-skipping via their own `dbAvailable()` check — not fabricated.

## B.B — cross-suite `app_tenant`/`service_role` drop-order contamination: ROOT-CAUSED AND FIXED

`pnpm run test:behavioral` (`node --test --test-concurrency=1 tests/*/*.test.mjs`, ~230 files, most
not Postgres) was started under the shim to observe this directly, but the first Postgres-heavy
file alone took minutes to apply the full migration chain, and with ~55 such files the full run
was not a practical way to isolate one bug — killed after ~10 minutes (it had progressed cleanly
through roughly 40 files with no error) in favor of a direct, minimal reproduction.

Root cause: `app_tenant`/`service_role`/`authenticated`/`anon` are CLUSTER-WIDE Postgres roles, but
each `*-postgres.test.mjs` suite gets its own DATABASE (this repo's harness names ~10 distinct
ones plus the shared `letbuyy_executable` default) and only ever resets its own `public`/`auth`
SCHEMA — never drops the database itself, so it stays on the cluster. Postgres's `DROP ROLE`
checks `pg_shdepend`, which is genuinely cluster-wide (by design, since a role can hold privileges
anywhere), so once ANY sibling suite's database has granted anything to `app_tenant`,
`tenant-redteam-postgres.test.mjs`'s own `DROP ROLE app_tenant` fails with "cannot be dropped
because some objects depend on it" — the exact reported error — even though nothing in the
database it is actually connected to still depends on the role.

Reproduced directly, not inferred: created a throwaway `letbuyy_contam_repro` database, granted one
`SELECT` on one table to `app_tenant` in it, then ran `DROP ROLE app_tenant` from the normal
`letbuyy_executable` database — the exact error, `DETAIL: 1 object in database
letbuyy_contam_repro`. `REASSIGN OWNED BY app_tenant TO postgres; DROP OWNED BY app_tenant;` run
inside the contaminating database (Postgres's own prescribed pre-`DROP ROLE` cleanup) resolved it.

Fix (`tests/executable/tenant-redteam-postgres.test.mjs`, the only file that drops these roles):
before dropping them, `resetDatabase()` now discovers every other `letbuyy_*`-prefixed database on
the cluster (`pg_database`, prefix-matched to this repository's own throwaway test databases —
never an externally-supplied one) and clears the four roles' ownership/grants in each first. This
is strictly narrower than a schema/table `CASCADE`: `REASSIGN OWNED BY`/`DROP OWNED BY` touch only
what those four roles themselves own or were granted, nothing else in the sibling database.

Verified with the contamination left in place: both of the file's tests pass despite it. Negative
control: `git stash` of just this fix, contamination still in place, reproduces the exact original
error on both tests; popping the stash (fix restored) passes again. Clean, uncontaminated runs are
unaffected (2/2 either way, ~17-18s).

## B.C — the 5 untested `apps/commerce/web/src` TypeScript files: WIRED IN

`branding.test.ts`, `page.test.ts` (demo route gate), `loading-suspense-boundary.test.ts`,
`client.test.ts` (`isStorefrontInternalOnlyPath`), `liquid-page-assembly.test.ts` ran in no lane —
`@letbuyy/customer-web`'s own `test` script only ran the central `tests/*/*.test.mjs` list. Each
file already documents its own run command (`tsx --tsconfig tsconfig.json --test`); added as the
first step of the same script, so both `pnpm --filter @letbuyy/customer-web run test` and the
gate's per-app lane cover them now. 60 subtests, all passing. Negative control: a planted
regression in `isStorefrontInternalOnlyPath` (matching the full path including query string again
— the historical CAP-C24 bug) fails 3 of 6 `client.test.ts` assertions; restored, 6/6.

## B.D — the localization test's import failure: FIXED (harness, not app)

`tests/localization/theme-localization.test.mjs` hand-rolls a TS→CJS loader
(`ts.transpileModule` + `vm.runInNewContext`) that stubbed only the `zod` import; `theme-bundle.ts`
was changed (Phase S4) to import `listExperiences`/`buildExperienceSettingsOverlay` from
`./theme-presets`, a real sibling module the loader had never been taught to resolve — confirmed a
stale test-harness assumption, not an application defect, by chasing the whole chain
(`theme-presets.ts` → `./built-in-section-schemas` → `./theme-registry`, all real, all resolvable,
no cycle). The loader now resolves and recursively loads relative specifiers through itself (with
a load cache), still throwing loudly on anything neither `zod` nor relative. No assertion changed.
4/4 pass. Negative control: `git stash` of the fix reproduces the exact original error
(`Unexpected test require from .../theme-bundle.ts: ./theme-presets`); popping restores 4/4.

## C — tenant-guard predicate tightening: DONE

Before: `.filter(column, operator, value)` and `.or(...)` counted **any** operator on a registered
scope column as scoping. `.filter('store_id', 'neq', otherStoreId)` names the column and EXCLUDES
one store, matching every other tenant's rows — the opposite of scoping — yet passed identically to
an `eq`. Same problem for `gt`/`gte`/`lt`/`lte`/`like`/`ilike`.

Caller inventory (required before changing semantics) — every `.filter()`/`.or()` call on a
Supabase query builder in `services/api-gateway/src` (excluding `Array.prototype.filter`, which is
unrelated): the **only** `.filter()` usage anywhere in the codebase is
`.filter('store_id', 'is', null)`, five call sites (`middleware/rbac.ts`,
`routes/operations/rbac.ts`, `routes/internal-console.ts` ×3), all the platform-employee pattern
(read rows with no store — a real, narrow, well-defined non-tenant category). The only `.or()`
alternatives ever naming a scope column use `eq` or `is.null`. Nothing legitimate changes
behavior — confirmed by the unchanged 1060/1049/0-fail gateway unit suite result.

Fix: `.eq()`/`.in()` untouched (inherently exact-match, no operator ambiguity). `.filter()`/`.or()`
now require the operator to be `eq`, `in`, or the one sanctioned exception `IS NULL`; every other
operator, including `IS NOT NULL`, is refused.

Proof: 11 new tests (`tenant-scoped-guard.test.ts`) through the real guard and real registry
against an unreachable host (the guard's rejection is synchronous, pre-fetch). Real revert-and-watch:
`git revert --no-commit` on the fix reproduces exactly the 6 "should now be refused" failures (the
5 that were already correct keep passing); `git revert --abort` restores 11/11.

## Validation run (this branch's own commits)

- `npx tsc --noEmit -p services/api-gateway/tsconfig.json`: clean.
- `pnpm run typecheck` (repo-wide, turbo): 81/81 successful.
- `pnpm run test:contracts`: 319/319.
- `pnpm run test:unit:gateway`: 1060 tests, 1049 pass, 0 fail, 9 skipped, 2 todo (unchanged pass/fail
  count from Phase A's tip — the guard tightening and the new test file net to the same total plants
  0 regressions).
- `pnpm --filter @letbuyy/customer-web run test`: 941/942 (the one failure is
  `tests/localization/theme-localization.test.mjs` from a STALE run before B.D landed in the same
  session — re-run after B.D shows 4/4 for that file individually; the two were not re-run together
  again in this document to avoid re-running the long central `tests/*/*.test.mjs` list twice).
- `pnpm run lint`: unchanged shape — customer-web's known 38-error set, plus a merchant-web error
  (`SettingsPane.tsx:67`, "Cannot create components during render") newly observed this session but
  confirmed pre-existing: `apps/merchant/web` is not in this branch's diff at all
  (`git diff --name-only 68269cb..HEAD`), and `develop`'s own `SettingsPane.tsx` is unmodified,
  committed content (`git log -1` on it resolves cleanly, nothing local/dirty).
- `node scripts/validators/branch-dispositions-validator.mjs`: same single pre-existing hard
  failure as Phase A (`letbuyy/pay4-late-capture-after-release` not an ancestor in this shallow
  clone) plus the same shallow-clone advisories; nothing new.
- Docker/Flutter: still unavailable; `gate.sh --mobile`/`--flutter-build`/`--real-db` (the
  container-based real-DB lane specifically, as opposed to the shim) remain `BLOCKED_INFRA`.
- **Not run to completion in this phase: the full `pnpm run test:behavioral` (~230 files, ~55 of
  them Postgres-backed) under the shim.** It was started, ran cleanly through roughly the first 40
  files (no error) in about 10 minutes, and was then stopped in favor of the direct, minimal
  reproduction above once that reproduction confirmed the root cause and the fix — running the
  full list end to end would have cost much more wall time for the same evidence. This is a real
  gap, stated plainly: individual suites are verified (`money-ledger-postgres`,
  `tenant-redteam-postgres`, both directly), but a full `test:behavioral` pass under the shim, all
  ~55 Postgres suites in the same sequence CI would use, has not been observed end to end. A future
  session/phase should run it to completion and record the result here before calling
  `test:governance` fully dependable in this container.

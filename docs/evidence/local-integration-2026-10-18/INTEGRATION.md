# Local develop integration — 18 October 2026

Execution mode: SINGLE AGENT. Subagents and delegated implementation: NO.

The owner explicitly requested merging completed work into `develop` and running
the latest LetBuyy locally. That authorization applies to local integration and
runtime bring-up. The existing programme and nine phase chats remain paused;
their unfinished changes are preserved in their existing checkouts.

## Source lineage

- Develop before: `130b669d86720c436385e4c6a604da4b57000276`.
- Phase 2 committed baseline: `0862687a5008d604d0df23357b2eb511293139fa`.
- Assembled integration47 snapshot: `4609c944`. This commits the maintained
  candidate previously identified by the coordinator's safe-source manifest.
- Merge into develop: `74f3e568d17530e26b1c983f97e7c06ffd638167`.
- Contract/test registration correction: `79db774d`.
- The merge has no conflicts and no retired application path resurrections.
- Generated Swift packages, local runtime reports containing private details,
  environment files, signing material and session-runtime caches were excluded.
  Existing worktrees, unpublished history and unrelated local files are retained.

This is a local development integration. It is not acceptance of all N1–N9
requirements, and unfinished worker proposals have not been relabelled complete.
Nothing was pushed or deployed.

## Running applications

| Surface | Local URL |
| --- | --- |
| Snaz storefront with restored products | http://localhost:9000/store/snaz |
| Store finder | http://localhost:9000 |
| Merchant web | http://localhost:9001 |
| Canonical identity | http://localhost:9002 |
| Marketing | http://localhost:9006 |
| Operator console | http://localhost:9007 |
| Design-system Storybook | http://localhost:9009 |
| API gateway | http://localhost:9010 |
| Mobile BFF | http://localhost:9011 |
| Webhook Worker | http://localhost:9012 |
| Queue Worker | http://localhost:9013 |
| Separate development Supabase API | http://localhost:56321 |

All application processes run from the primary `LetBuyy` checkout on `develop`.
The five storefront account-entry links now use the existing
`NEXT_PUBLIC_ACCOUNTS_URL` configuration, keeping local navigation on port9002.

The local identity signing key exists only in the identity app's ignored
configuration. Consumers receive its public verification keys. Existing local
server secrets are not committed. Authentication bypasses were not enabled.

From the primary checkout, restart application processes with:

```sh
CI=true NEXT_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false pnpm dev:all
```

Stop the existing application supervisors before starting a second copy; their
ports must be free. Do not kill unrelated processes by port or broad pattern.
The local Docker containers have an `unless-stopped` restart policy. Start the
named development DB, REST, Auth and Kong containers if they were explicitly
stopped. Their names begin `letbuyy-develop-20261018-`. Existing Supabase storage
and local captured email still use the original running local services.

## Database preservation and upgrade

The restored database recorded migrations only through260. Its schema also
already included the262 privacy index and263 magic-link consumption table.
A protected logical dump was saved outside Git before any upgrade attempt.
The restored `postgres` database and its original roles were not upgraded.

A separate PostgreSQL container on loopback port56322 holds database
`letbuyy_develop_20261018`, restored from that dump. Every available migration
after260 through363 was applied there under the canonical `postgres` owner.
The existing263 table was reconciled after checking its shape, primary key and
RLS. Existing effective service-role access on six trust tables was preserved
as direct grants before319 revoked inherited client authority. Native migration
guards were retained. The new isolated cluster provides the migration owner
permissions needed for catalog locking; the shared restored cluster's owner
permissions remain unchanged.

The resulting development database records283 migration versions, maximum363,
and retains19 stores. Unfinished allocations347–348,350–351,354–355 and359–361
are absent from the assembled source; no placeholder migrations were invented.
This copy is a working development database, not a provider/release migration
certificate. New local application writes belong to this copy.

## Verification and remaining failures

| Check | Observed result |
| --- | --- |
| Locked dependency installation on develop | PASS |
| Root typecheck after installation | 81 successful tasks, 0 cached, exit0 |
| Contracts after adapting product inputs and registering merchant tests | 338 pass,0 fail,0 skip |
| Gateway unit lane on the assembled snapshot | 1540 pass,17 fail,0 skip,1557 total |
| Full governance gate in a disposable clone | 109 pass,5 fail,0 skip,1 not applicable |
| Five maintained app pages and four Worker health endpoints | HTTP200 |
| Marketplace feed and exact Snaz lookup after Worker restart | HTTP200 |
| Identity lookup with a synthetic `.invalid` address | HTTP200; no account creation/message |
| Browser | Snaz products rendered; merchant entry reached local identity lookup |

The initial Phase2 typecheck attempt failed because that checkout's dependency
links were incomplete. The installed develop checkout's full fresh typecheck
subsequently passed; these observations are distinct.

The17 gateway failures concern changed product mutation inputs/entitlements,
theme ownership mock/source expectations and the mobile AI draft contract.
They are recorded without weakening production guards or asserting that all
failure attribution has been independently established.

The initial run recorded five failing governance validators. These are historical
results; the migration-safety finding is resolved in the follow-up below:

- Migration safety flags `TRUNCATE` tokens in permission/guard declarations313,
  319 and357; it does not establish that those migrations delete rows.
- Sequential migration validation reports the unfinished allocations above.
- Environment scanning flags secret-shaped fixture assignments.
- Payment-rail validation flags the settlement route's Cashfree comparison.
- Provider-mode validation flags billing and local shipping honesty evidence.

Runtime limits: public aggregate directory listing remains intentionally
unavailable under the existing tenant guard; exact store lookup works.
The copied marketplace has no currently eligible listings after the approval
migrations, so a successful feed can be empty. Initial runtime telemetry inserts
reported a local table-permission error; the backend-grant repair below
supersedes that observation for the two named logging tables.
No Android device or emulator was attached, and no native APK was built or
installed. External providers, real payments and hosted delivery were not
verified or activated.

Full raw logs, the source manifest, pending phase version inventory, protected
backup and local backend preparation scripts are outside Git under workspace
`Verification/LetBuyy-Develop-Local-2026-10-18/`. They may contain local private
configuration and must not be published wholesale.

Next action for this request: use the running local storefront/merchant app.
Remaining phase engineering belongs to the paused programme's existing goals
and requires an explicit continuation; this merge does not close those goals.

## Merchant store-list repair — 18 October 2026

Requested outcome: fix the repeated `STORE_LIST_UNAVAILABLE` error at merchant
entry. Working checkout: primary `LetBuyy`, branch `develop`, source HEAD
`a23958feee14ef70ce3ffb4018809feec30d5beb`, with the repair as an uncommitted
working-tree change. Single agent; unrelated Swift packages remain untouched.

The development database log at 18:57 IST records `permission denied for table
employees` inside `list_merchant_accessible_sites_v1`. That private invoker
function checks active staff membership while listing an owner's stores too.
The gateway correctly sanitized the error as HTTP503, and the merchant server
render exhausted its retries. The same logs showed missing insert privileges
for `runtime_telemetry_metrics` and `worker_request_logs`. React DevTools and HMR
messages were ordinary development notices.

The live read recovered during diagnosis, before this migration was applied;
current effective access depended on inherited `app_tenant` privileges.
Migration364 makes the three required privileges direct and explicit:
`SELECT` on `employees`, and `INSERT` on the two named logging tables, for the
existing backend `service_role` only. It journals only newly introduced direct
grants in the existing private privilege journal. Reapply is idempotent;
rollback preserves prior grants. It changes no role membership, client grant,
RLS policy, staff authorization, money fence or store row.

Migration364 was applied transactionally, including its migration-ledger entry,
to `letbuyy_develop_20261018` in `letbuyy-develop-20261018-db`. The original
restored database and other projects were not modified. The local copy now
records maximum migration364.

The merchant error screen now requests a new document on **Try again**, so
session/store reads execute again after recovery. The redundant application
`console.error` effect was removed; framework/server error reporting remains.
The package test command now supplies the existing TypeScript loader to its
second test stage, fixing the observed theme-document module-resolution failure.

Fresh verification:

| Command / boundary | Result |
| --- | --- |
| `pnpm --filter @letbuyy/merchant-web run typecheck` | PASS, exit0 |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | PASS, exit0 |
| `pnpm --filter @letbuyy/merchant-web run test` | PASS, exit0; stages78/78 and788/788; no failures/skips/TODOs |
| Owned runner, `merchant-store-discovery-grants.postgres.test.ts` and `merchant-staff-lifecycle.postgres.test.ts`, `--jobs 1 --no-reap` | PASS, exit0;21/21; no failures/cancels/skips/TODOs; owned resources cleaned |
| New database regression controls | Removing employee read and inherited tenant access reproduces503; applying364 returns only the actor's store; rollback restores exact prior ACL and503; preexisting direct grants survive rollback; unrelated public table grants and RLS flags stay unchanged |
| Tenant-isolation, package-ownership and dependency-manifest validators | PASS, exit0 |
| `git diff --check` | PASS, exit0 |
| Live gateway with existing local identities | HTTP200 for store lists; account data/credentials not copied to evidence |
| Existing signed-in Chrome session | Store picker and Snaz dashboard render; zero captured errors on the verified tab after recovery |

At this merchant-repair checkpoint, the migration-safety validator still exited1
on the three previously recorded `TRUNCATE`-token findings in313,319 and357,
with no364 finding. The subsequent migration-validator verification below
supersedes that result. This merchant repair did not claim a clean full
governance gate or close the paused programme. No push or hosted deployment
occurred.

Sanitized test output, owned-run receipt and browser screenshot are under
workspace `Verification/LetBuyy-Admin-Repair-2026-10-18/`, including
`final-owned-result.json`, `merchant-tests-final.log` and `admin-dashboard.png`.
Next action for this bug: continue using the running local merchant dashboard.

## Migration-validator findings313,319 and357 — resolved 18 October 2026

The owner requested fixing the three remaining migration-safety findings.
On recovery, primary `develop` had advanced to
`8800ee34dfcc7646e246d5781c755f1e27b55128`. Its integrated commit `ce4d1e66`
already contained the validator correction: closed privilege metadata reads,
`TG_OP` comparisons and protective `BEFORE TRUNCATE` trigger declarations are
recognized separately from destructive SQL. Fresh execution confirmed that all
three findings were cleared before this follow-up's edits.

This follow-up adds explicit regressions for the exact313,319 and357 source
files. In a temporary Git fixture, the actual validator accepts all three
unchanged files, rejects an injected destructive command in each by filename,
and passes again after each exact source restore. The three controls cover
direct `TRUNCATE TABLE`, dynamic SQL in a DO block and a statement inside a
dollar-quoted PL/pgSQL function. Existing checks still cover unsafe untracked
migrations and dynamic array/concatenation forms. The fixture verifies maintained
source hashes and Git status are unchanged, then removes its own temporary copy.
No SQL is executed by these tests.

Fresh commands on the final test source:

- `node scripts/validators/migration-safety-validator.mjs`: PASS, exit0.
- `node --test tests/migrations/migration-safety.test.mjs`: PASS, exit0;
  9 tests,9 pass,0 fail/cancel/skip/TODO.
- `git diff --check`: PASS, exit0.

Only the focused regression suite and this evidence record changed in this
follow-up. The three migration files retain their security guards. This closes
the three named findings; it is not a new full-governance or release verdict.

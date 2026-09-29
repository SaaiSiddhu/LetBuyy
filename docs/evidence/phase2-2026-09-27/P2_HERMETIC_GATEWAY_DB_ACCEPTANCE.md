# P2-HERMETIC-GATEWAY-DB — gateway database tests isolated and executed

**Branch** `letbuyy/phase2-shared-buyer-identity` · **initial SHA** `eb5404071e6ab1a9dc94c11a6edec89f1b9e8370` · **final SHA** `7e10134f1480344b5687dbb7410835d878452a6d` (the last source commit, the tree every number below was measured on; only documents-only commits follow it) · **date** 2026-09-29 · **agent** single agent (no subagents, no delegation, no parallel sessions)

**Verdict: A — GATEWAY DATABASE TESTS ISOLATED AND EXECUTED.** The nine gateway suites that used to discover the developer's restored Supabase
stack and write to it now run only inside database infrastructure the executable-suite runner creates for them. All nine ran, 14 tests, 0
skipped, twice in a row, and two runs at once were isolated from each other. The restored stack was read (a before/after census) and never written. The existing
synthetic rows in it are untouched; §15 is a proposal, not an action.

## 1. What this changes, in seven lines

1. The nine suites moved to `services/api-gateway/src/__tests__/owned-db/` and reach a database **only** through `requireOwnedDatabase()`, which
   asks a separate fail-closed guard to prove — from labels the runner wrote, not from any name — that the cluster, database, REST sidecar, volume
   and network are this run's. No proof, no statement: the suite throws. There is no fallback, no `.dev.vars` lookup and no skip.
2. Each suite gets its own database, cloned from a per-cluster template that holds the faithful Supabase bootstrap, every migration and the REST
   layer's roles, and a **real PostgREST** in front of it (behind a small `/rest/v1` proxy, because the Supabase client always calls that prefix).
   Nothing is mocked.
3. Each suite builds its own synthetic tenant (random ids, `.invalid` addresses). No suite refers to `snaz`, an owner, a catalog row, a location or
   a GST invoice that exists anywhere else. GST, ledger and inventory triggers stay active; nothing is deleted by hand — disposal of the database
   is the cleanup.
4. The gateway's unit lane (`test:unit`) can no longer reach a database at all, and is named and documented as **not** full gateway acceptance.
   `test:db` is the isolated lane; `test` is the acceptance (unit, then database, then contracts).
5. Cleanup is reliable and verified: after every path tried (pass, fail, skip, empty suite, setup failure, SIGTERM, SIGKILL) docker, asked by the
   run's own label, holds nothing; a SIGKILLed run's orphans are reaped by the next run, and only those.
6. Mutation checks found and fixed a real weakness while doing this: the COD-exclusion assertion in the inventory suite passed with the exclusion
   removed (§10).
7. `reports:read` was inspected and deliberately **not** aliased; a test now pins why (§12).

## 2. What was wrong (measured, not asserted)

`services/api-gateway/src/__tests__/local-postgres-support.ts` (now deleted) resolved "the local Supabase Postgres" by hardcoded, later
discovered, `supabase_db_*` container name and `.dev.vars`, so any `pnpm test:unit` with the stack up wrote to it. The nine files matched the unit
glob (`*.test.ts`). The residue of that (a read-only census, 2026-09-29, before this task's changes) is in §15. The earlier task's workaround was
to point `LETBUYY_LOCAL_SUPABASE_CONTAINER` at a container that does not exist, so that 14 tests skipped; that is the pattern this task replaces,
not extends. `local-postgres-support.ts` is in git history; nothing here rewrites that history or claims the old tests were ever isolated.

## 3. Architecture and ownership checks

```
run-executable-suites.mjs  (one runner process; owns everything below; run id = 12 random hex chars)
  per cluster (--jobs, default 2)
    network  letbuyy-exec-<run>-N-net   \
    volume   letbuyy-exec-<run>-N-data   } labeled: fixture, owner pid, run id, role
    postgres letbuyy-exec-<pid>-<..>-N  /  postgres:16-alpine, 1 GiB / 2 cpu / 512 pids, no published port
      template db  letbuyy_tpl_gateway      (bootstrap + every migration + REST roles; sealed, ALLOW_CONNECTIONS false; built once per cluster)
  per suite
    database letbuyy_exec_<suite>            CREATE DATABASE ... TEMPLATE; marked  letbuyy.fixture_run_id = <run>
    postgrest letbuyy-exec-<run>-rest-N      supabase/postgrest:v16.2, 256 MiB / 1 cpu / 256 pids, read-only, 127.0.0.1:<allocated> only
    proxy    http://127.0.0.1:<port>         in the runner process; forwards /rest/v1/* to the sidecar, 404 for the rest
    guard    owned-fixture-guard.mjs         run BEFORE the suite starts, and again by the suite as its first act
    suite    tsx --test <file>               own process group; env sanitised of every inherited database setting
```

### 3.1 What the guard proves (`scripts/governance/owned-fixture-guard.mjs`)

| # | Check | Refusal code |
|---|---|---|
| 1 | environment names a run, the runner's pid, two containers, a database, one REST url and a key, all well-formed; url is exactly `http://127.0.0.1:<port>` | `ENV_MISSING` `ENV_MALFORMED` `HOSTED_URL` `NOT_OWNED_NAME` `RESTORED_STACK` |
| 2 | the runner pid is alive **and is the runner** (a stale environment, or a reused pid, fails) | `STALE_RUNNER` |
| 3 | each container has the fixture label, **this** run's id, the right role and the runner's pid; is the expected image; is running; not privileged; not on the host network; no bind mount; the cluster publishes no port; the sidecar publishes exactly the announced port on 127.0.0.1; the cluster's only mount is a labeled volume; both sit on one labeled network | `LABEL_MISSING` `RUN_ID_MISMATCH` `OWNER_PID_MISMATCH` `ROLE_MISMATCH` `IMAGE_MISMATCH` `NOT_RUNNING` `PRIVILEGED` `NETWORK_NOT_OWNED` `MOUNT_NOT_OWNED` `PORT_PUBLISHED` `REST_PORT_MISMATCH` `RESTORED_STACK` |
| 4 | the database itself carries the run's marker (one read-only `SELECT`, in a container whose labels were just verified) | `DB_MARKER` |
| 5 | the REST url, asked through PostgREST for the same marker, answers with this run's id; the listener on that port is the runner | `REST_MARKER` |

Ownership is **not** inferred from a name, from `localhost`, or from a caller-supplied container name: the restored stack is refused by name,
by Supabase labels and by Supabase images, independently, and nothing is executed in any container until its labels have been verified.

### 3.2 The negative cases the mandate names, each proven three ways

Each is asserted by error code and by the docker calls recorded before the refusal; the announcement-level refusals (the restored stack, an empty environment, a
hosted url, the runner's `--container`) are asserted again through real processes with a recording `docker` first on `PATH`. `tests/governance/owned-fixture-guard.test.mjs` (13 tests) and `gateway-db-lifecycle.test.mjs`:

| Case | Refused as | Docker calls before the refusal |
|---|---|---|
| restored stack name supplied (`supabase_db_letbuyy-newmac-20260926`, `supabase_rest_…`, `supabase_kong_…`) | `RESTORED_STACK` | **none** |
| unrelated container (`edynox-local-db`, `letbuyy-executable-pg`, `postgres`, …) | `NOT_OWNED_NAME` | **none** |
| missing ownership label / no run id | `LABEL_MISSING` | `inspect` only, never `exec` |
| incorrect run id (container, volume, network or sidecar of another run) | `RUN_ID_MISMATCH` | `inspect` only |
| hosted url (`https://….supabase.co`, any non-loopback host); loopback that is not exactly the sidecar | `HOSTED_URL` / `ENV_MALFORMED`; `REST_MARKER` for a port whose answer or listener is not this run's | **none** / `inspect` + one `SELECT` |
| owned fixture unavailable (container gone, not running, wrong image, no port) | `CONTAINER_MISSING` `NOT_RUNNING` `IMAGE_MISMATCH` `REST_PORT_MISMATCH` | `inspect` only |
| stale configuration from an earlier run (dead pid; pid reused by another program) | `STALE_RUNNER` | **none** |
| `requireOwnedDatabase()` with no announcement, and with the restored stack's name | throws `ENV_MISSING` / `RESTORED_STACK` | **none** (recording docker log empty) |
| runner `--container supabase_db_…` / `letbuyy-executable-pg` / `edynox-local-db` / `postgres` | exit 70, `refusing --container` | **none** (recording docker log empty) |

### 3.3 The suite-side door and the watchdog (`owned-db/owned-db-support.ts`)

`requireOwnedDatabase()` runs the guard as a separate process, returns handles bound to the **verified** description (never raw environment
values), and arms a watchdog: if the runner's pid disappears the suite ends itself with exit 97, so a SIGKILLed runner cannot leave a suite writing
to infrastructure nobody is going to remove (proved in §7: the orphaned suite ended within 20 s).

### 3.4 REST wiring

The gateway's Supabase client always calls `<SUPABASE_URL>/rest/v1/<table>`. On a Supabase stack Kong supplies that prefix; a bare PostgREST has none,
and production code must not change to suit a test, so `owned-rest-proxy.mjs` (in the runner's process, loopback only, one upstream port, never logging
a credential) supplies it. PostgREST runs with `PGRST_DB_URI` (per-suite random password for a dedicated `authenticator` role) and
`PGRST_JWT_SECRET` (per-suite random) **passed by name** so neither is on an argument list, `PGRST_DB_SCHEMAS=public,letbuyy_fixture`, anon role
`anon`, the same extra search path as the local stack. The service key is a per-suite HS256 JWT. It connects to `pg` (the cluster's alias on the run's
own network) and to nothing else. Readiness is real: the runner polls `letbuyy_fixture.run_id()` through the proxy until PostgREST answers with the run id.

### 3.5 Environment sanitising, image policy, sandbox shim

* The suite process gets its own endpoints and nothing else: every inherited `SUPABASE_*`, `DATABASE_URL`, `POSTGRES_*`, libpq `PG*`,
  `INTERNAL_API_SECRET`, and any earlier `LETBUYY_EXECUTABLE_*` / `LETBUYY_OWNED_*` value is removed first.
* **Images are never pulled on a workstation** (`requireImagePresent`; every `docker run` carries `--pull never`). `LETBUYY_EXECUTABLE_PULL=missing`
  opts in; `CI=true` opts in by itself (a hosted runner starts empty), so CI does not regress.
* With **no real Docker daemon** (the cloud-sandbox shim `scripts/dev/docker-shim`, which models only Postgres `run`/`exec`/`inspect`) the runner
  keeps the pre-existing flow for Postgres suites, asks the shim for nothing it cannot do, and reports a gateway database suite **red with the
  reason** — never skipped, never faked. Pinned by `executable-runner-lifecycle.test.mjs` with a recording fake docker.

## 4. Fixtures

Every id is random per run. `seedSyntheticTenant` builds the least the RPCs require (each column and rate read from the migrations and the checkout
route): a published store with a valid GSTIN and state code, a default inventory location (`inventory_levels.location_id` is NOT NULL) and the two GST
rates the checkout route resolves by HSN precedence. `seedSyntheticOrder` places a real order through the real `create_checkout_order` RPC. Nothing
here removes a row, disables a trigger or relaxes a constraint; `gateway-db-lane.test.mjs` forbids `DELETE`, `TRUNCATE`, `DISABLE TRIGGER` and
`session_replication_role` in the fixture, and a lifecycle test asserts the protection triggers are present in a fresh clone.

**Reset semantics.** Suites do not share a database. The template is pristine and sealed; each suite's database is a fresh clone dropped when the suite
ends, so there is no truncate order to get wrong and a second suite in the same cluster provably starts empty (lifecycle test: suite A writes a site,
suite B in the same cluster sees `count(sites) = 0` and the full schema). **Roles are cluster-global**, so suites in a cluster run one at a time and
parallelism means more clusters; the template's `authenticator` role and the fixture schema are created once per cluster, before any clone.

## 5. The nine suites: before, after, and what each proof exercises

| Suite (now under `owned-db/`) | Tests | Were skipped before | Auth boundary exercised | Database access |
|---|---|---|---|---|
| `verification-token-redemption.postgres` | 2 | 2 | **internal signed identity** (real HMAC `X-LetBuyy-Internal-*`, app `accounts`) + real route | psql + PostgREST (service role); real row locking, 6 concurrent redemptions |
| `backfill-and-target-shadow.postgres` | 1 | 1 | none (real backfill executors and shadow comparator called directly) | psql + PostgREST (service role, tenant-guarded client) |
| `real-http-shadow-rehearsal.postgres` | 1 | 1 | **injected auth context** (`c.set('auth', …)`; no HMAC verification — the stated honesty boundary, unchanged) + real `routes/products.ts` | psql + PostgREST (service role) |
| `real-staff-product-journey.postgres` | 1 | 1 | **internal signed identity**, real `authMiddleware`, a fresh signed assertion per request + real `routes/employee.ts` and `routes/products.ts` | psql + PostgREST (service role) |
| `gift-card-money-path` | 3 | 3 | none — RPCs as the superuser | psql (+ separate-process concurrency) |
| `gst-invoice-issuance` | 1 | 1 | none — RPCs as the superuser | psql (+ concurrency) |
| `gst-tax-computation` | 1 | 1 | none — RPC as the superuser | psql |
| `inventory-reservation-lifecycle` | 1 | 1 | none — RPCs as the superuser | psql |
| `merchant-tenant-predicate` | 3 | 3 | none — the real **tenant guard** over a real PostgREST | psql seed + PostgREST (service role) |
| **total** | **14** | **14** | | |

The gateway reaches the database as the **service role** through PostgREST (BYPASSRLS), so none of these is a row-level-security proof: what they prove is
the tenant guard, the RPCs, constraints and triggers, the routes, and (two suites) real signed identity. That was true before and is now written in each
file's header. The **10** source-only tests that lived in four of these files (they read migrations and route source and need no database) stayed in the
unit lane, in their original files, unchanged; only the 14 database tests moved.

## 6. Executed results

Final run through `pnpm --filter @letbuyy/api-gateway run test:db` and an immediate repeat (`--json-out`), 2026-09-29, image `postgres:16-alpine`, REST
image `public.ecr.aws/supabase/postgrest:v16.2`, `--jobs 2` (default):

| Suite | Discovered | Pass | Fail | Skip | TODO | Database (clone of template) | Suite time | REST requests through the real PostgREST |
|---|---|---|---|---|---|---|---|---|
| backfill-and-target-shadow.postgres | 1 | 1 | 0 | 0 | 0 | `letbuyy_exec_…backfill_and_target_shadow_postgres` | 23.0 s | 30 |
| gift-card-money-path | 3 | 3 | 0 | 0 | 0 | `letbuyy_exec_gift_card_money_path` | 25.0 s | 3 |
| gst-invoice-issuance | 1 | 1 | 0 | 0 | 0 | `letbuyy_exec_gst_invoice_issuance` | 4.1 s | 3 |
| gst-tax-computation | 1 | 1 | 0 | 0 | 0 | `letbuyy_exec_gst_tax_computation` | 3.7 s | 3 |
| inventory-reservation-lifecycle | 1 | 1 | 0 | 0 | 0 | `letbuyy_exec_…inventory_reservation_lifecycle` | 3.6 s | 3 |
| merchant-tenant-predicate | 3 | 3 | 0 | 0 | 0 | `letbuyy_exec_merchant_tenant_predicate` | 3.8 s | 10 |
| real-http-shadow-rehearsal.postgres | 1 | 1 | 0 | 0 | 0 | `letbuyy_exec_…real_http_shadow_rehearsal_postgres` | 4.4 s | 118 |
| real-staff-product-journey.postgres | 1 | 1 | 0 | 0 | 0 | `letbuyy_exec_…real_staff_product_journey_postgres` | 4.5 s | 184 |
| verification-token-redemption.postgres | 2 | 2 | 0 | 0 | 0 | `letbuyy_exec_…verification_token_redemption_postgres` | 3.0 s | 18 |
| **9 suites** | **14** | **14** | **0** | **0** | **0** | | wall **41.2 s** (template 18.8 s per cluster, in parallel; provisioning 1.3–2.0 s per suite) | |

Every result records `ownership: verified before start`, REST container removed, database dropped. The suites that go through REST show hundreds of
forwarded requests (the shadow rehearsal 118, the staff journey 184): the gateway really talked to PostgREST. (`upstreamErrors: 1–2` per suite are the
runner's own readiness polls before PostgREST accepted connections.)

**Accounting of the 14 previously skipped tests (they did not vanish; they run).** The gateway lane before this task was 1331 tests: 1316 pass,
**14 skipped**, 1 todo. Those 14 are exactly the database tests of the nine suites: 9 in the five T12–T16 suites (`gift-card-money-path` 3,
`gst-invoice-issuance` 1, `gst-tax-computation` 1, `inventory-reservation-lifecycle` 1, `merchant-tenant-predicate` 3) plus 5 in the four
`*.postgres.test.ts` suites (2 + 1 + 1 + 1). They now run in the isolated lane: **14 executed, 14 passed, 0 skipped.**

| Lane | Before | After | Why it changed |
|---|---|---|---|
| gateway unit (`test:unit`) | 1331 tests · 1316 pass · **14 skipped** · 1 todo | **1320 tests · 1319 pass · 0 skipped · 1 todo** | −14 (moved to the isolated lane) +3 (the `reports:read` decision test). The one TODO is `LB-BIL-002`, open product work, unrelated |
| gateway isolated database (`test:db`) | did not exist (the 14 sat in the unit lane, skipped) | **14 tests · 14 pass · 0 skipped · 0 todo** | |
| gateway acceptance (`test`) | unit + contracts | unit + isolated database + contracts | `test` now includes the database lane |

## 7. Repeatability, concurrency, failure and interruption

All against a real Docker daemon; every cleanup claim is asked of docker by the run's label, never read from the runner's report of itself.
`tests/governance/gateway-db-lifecycle.test.mjs` (6 tests, 150 s) and `executable-runner-lifecycle.test.mjs` (13 tests):

| Scenario | Result |
|---|---|
| clean run | 9 suites, 14 pass, 0 skipped; nothing labeled left |
| **immediate repeat** | identical: 9 suites, 14 pass, 0 skipped, 0 left; runs 41.2 s and 39.9 s |
| **two runs at once** (real suite each) | both green; different run ids, clusters and REST ports; neither reaped the other; three runs later the machine holds exactly what it held before |
| **deliberately failing test** | red (`fail=1`); exit code = number of red suites |
| **skipping suite** | red (`may not skip`), never green |
| **empty suite** | red (`no tests executed`) — found by the lifecycle test failing first: Node reports a file that registers no test as one passing "test" named after the file, so a count of zero never happens; the runner now requires a test with a name of its own |
| **pristine clone** | suite B in the same cluster sees `count(sites) = 0` after suite A wrote one, with the full schema and protection triggers |
| **setup failure: image missing** | exit 70 naming the image; **nothing** created (not a network, not a volume) |
| **setup failure: cluster name taken** | exit 70; the network and volume this run had created are removed; the container it did not create survives |
| **SIGTERM mid-suite** | exit 143; the suite's whole process group gone; no container, network or volume of the run left |
| **SIGKILL** | the run's 2 containers, network and volume are left (SIGKILL cannot be handled); the suite ends **itself** within 20 s (watchdog); `--reap-only` removes exactly those four; a live-owned labeled network/volume and unlabeled ones are untouched |
| no real Docker daemon (sandbox shim) | Postgres suites keep their flow; gateway suites red with the reason; the shim is asked for nothing it cannot do |

Process safety: no busy loops or CPU-load experiments; test processes lead their own process group so an interrupted run signals the tree; after a
suite the group is checked for stragglers and stopped; every wait is bounded; every removal is verified (`inspect` after `rm`); exit 70 = infrastructure
could not start, 71 = cleanup could not be completed (with the exact resource names and a `--reap-only` recovery hint). Nothing here uses a name
pattern as its sole authority: a resource is removable only if it carries the fixture label **and** a dead owner pid **and** is older than the grace period.

## 8. Resource limits and measured use

Bounded by construction (`--jobs 2` by default; `LETBUYY_EXECUTABLE_PG_JOBS` / `--jobs` to change): each cluster ≤ 1 GiB, 2 cpus, 512 pids; each REST
sidecar ≤ 256 MiB, 1 cpu, 256 pids, read-only filesystem; no port published except the sidecar's, on 127.0.0.1. Measured (`docker stats`, 4 s cadence,
two full lane runs): a cluster peaked at **141 MiB**, 72 % of one core, 12 pids; a sidecar at 22 MiB, 26 pids; at most **3 fixture containers** were
alive at once, **298 MiB** summed. Template build 18.8 s per cluster (31 s in the first, loaded, run).

## 9. The restored development stack: not touched

Read-only census (`default_transaction_read_only=on`, counts and timestamps only, no record contents) of `supabase_db_letbuyy-newmac-20260926`:
before this task's work (2026-09-29 10:35 UTC), in the middle (11:14 UTC), after the last database run (11:58 UTC) and once more after everything else, the documents commit included (12:09 UTC).

**Result: all four captures are identical** (compared with the capture timestamp removed): 21 tables' row counts, the 3 marker counts, the 6 newest-row
timestamps, and the server's own cumulative insert/update/delete counters for 21 tables (`pg_stat_user_tables`, stats never reset). The DB container has not
restarted (started 2026-09-26). The whole session was read-only (`transaction_read_only = on`, printed by the script itself).

| Table | rows | ins / upd / del (cumulative) |
|---|---|---|
| checkout_sessions | 83 | 83 / 0 / 0 |
| employees | 1 | 99 / 10 / 98 |
| gift_card_accounts | 40 | 48 / 10 / 0 |
| gift_card_ledger_entries | 90 | 90 / 0 / 0 |
| gift_card_redemptions | 30 | 30 / 10 / 0 |
| gst_invoices | 20 | 20 / 0 / 0 |
| inventory_levels | 102 | 159 / 248 / 57 |
| inventory_locations | 2 | 35 / 0 / 33 |
| inventory_reservations | 83 | 113 / 248 / 0 |
| order_items | 97 | 128 / 0 / 1 |
| order_tax_lines | 80 | 80 / 0 / 0 |
| orders | 97 | 130 / 227 / 3 |
| principals | 0 | 305 / 0 / 305 |
| products | 117 | 229 / 289 / 95 |
| site_role_permissions | 11 | 142 / 0 / 131 |
| site_roles | 1 | 125 / 0 / 124 |
| sites | 19 | 125 / 52 / 104 |
| store_memberships | 0 | 212 / 234 / 212 |
| tax_rates | 2 | 2 / 0 / 0 |
| users_custom | 2 | 177 / 2 / 176 |
| verification_tokens | 1 | 62 / 69 / 61 |

Marker counts (`T12`-`T16` products / `t16-autotest-*` sites / their orders): 115, 14, 14. Newest rows: gift_card_accounts 2026-09-29T06:07:43Z; gst_invoices 2026-09-29T06:07:36Z; orders 2026-09-29T06:07:44Z; products 2026-09-29T06:07:43Z; sites 2026-09-29T06:07:40Z; verification_tokens 2026-09-28T13:07:45Z.

(Captured 2026-09-29 10:35:27Z, 11:14:18Z, 11:58:18Z and 12:09:15Z; the scripts that produce them are in the appendix.)

The strongest guarantee is the enforced connection boundary, not the census (a changed count would not by itself be this task's write — the stack
is live): no suite, runner or test-support file can name the restored stack (the guard refuses it by name, labels and image before a statement is sent;
the runner refuses its name before any docker command); the lane's files contain no `supabase_db_`, `.dev.vars` or `LETBUYY_LOCAL_SUPABASE_CONTAINER` outside comments
(pinned by `gateway-db-lane.test.mjs`). The census additionally compares the server's own cumulative per-table write counters (`n_tup_ins/upd/del`),
which a write from any actor would move.

**Docker hygiene finding (not deleted).** The runs before this task leaked **anonymous** volumes: `postgres:16-alpine` declares a volume at its data
directory, and a container removed without `-v` leaves it dangling and unlabeled. At the start of this window Docker held 386 volumes of which 379 were
dangling; none can be attributed to a run, so none was removed (no broad Docker cleanup). The runner now uses a **named, labeled** volume mounted at that
path (so no anonymous one is created), removes with `rm -f -v`, and verifies the removal; a final query by the run's own label must find nothing.
Now (2026-09-29, end of task): 403 volumes, 397 dangling, **0 labeled by the fixture**. The growth of 18 dangling since the start matches six runs of the
*pre-existing* `executable-runner-lifecycle.test.mjs` at three leaked volumes per run (three sleeper containers per run, each removed with `docker rm -f` and no `-v`, leaving the
image's anonymous volume behind; the last of the six was measured directly, +3): that leak is fixed in this task (`rm -f -v`; measured before and after, 3 leaked per run became 0) and the gateway lifecycle tests were written
with `-v` from the start (0 over a full run). The 397 anonymous volumes are **not removed**: they carry no label, so none can be positively attributed to a run, and
pruning them would be exactly the broad cleanup the task forbids. The leaked sleeper volumes are empty by construction; the rest belong to other containers and other
projects (`edynox-*` runs beside this stack). Owner call: prune dangling volumes deliberately, once, when nothing else is mid-run.

## 10. Mutation checks (revert-and-watch)

Each mutation was applied to one file, the relevant test run and watched **fail**, and the file restored byte-for-byte from a backup (verified equal).
Where a mutation survived, that was a finding.

| # | Mutation | Test that went red |
|---|---|---|
| MG1–MG9 | guard: drop the run-id comparison; drop the restored-stack name refusal; accept any container name; skip the DB marker check; accept any http(s) url; drop the stale-runner refusal; drop the bind-mount refusal; drop the published-port refusal; skip the volume-label check; accept any REST answer | the matching case in `owned-fixture-guard.test.mjs` (12 of 12 red) |
| MR1 | runner accepts any `--container` name | `the runner refuses a cluster name it does not allocate…` |
| MS1 | suite-side door returns instead of throwing when the guard refuses | `a gateway suite cannot obtain a database except through the guard…` |
| ML1–ML9 | a lane suite names a Supabase dev container; a lane suite skips; a unit-lane test runs processes; the unit glob descends into `owned-db`; a docker run may pull; the catalog looks in the wrong directory; the wrapper stops reporting the gateway group; pulling always allowed; the retired helper returns | the matching case in `gateway-db-lane.test.mjs` (9 of 9 red) |
| MP1, MP2 | no-daemon flow starts a cluster the real way; gateway suites not refused with no daemon | the two no-daemon tests |
| MK2–MK4 | runner stops treating a skipping gateway suite as red; leaves volumes behind; suite-side door stops watching its runner | lifecycle tests 1, 4 and 5 (each ~1 min, real Docker) |
| S1 | `verification-token-redemption`: the `used = false` WHERE guard dropped from the consume `UPDATE` | the 6-way concurrency test (1 pass, 1 fail: sequential still passes, as it should) |
| S2 | `backfill-and-target-shadow`: the idempotent-skip branch disabled | red |
| S3 | `real-http-shadow-rehearsal`: staff `status = 'active'` no longer required | red (revoked staff would be let in) |
| S4 | `real-staff-product-journey`: the signed identity never verifies | red — proves the suite really runs the real `authMiddleware` |
| S5 | `gift-card-money-path`: `digest()` unqualified again (the T15 defect) | red, 3 of 3 |
| S6 | `gst-invoice-issuance`: invoice numbering never advances | red |
| S7 | `gst-tax-computation`: place of supply no longer stored | red |
| **S8** | `inventory-reservation-lifecycle`: COD reservations released too (`o.payment_method <> 'cod'` removed from migration 211) | **first run: stayed GREEN** — a surviving mutant. The suite backdated only the razorpay reservation, so the COD reservation was spared by the grace window whatever the filter said, and the COD exclusion was never tested (the original test had the same gap). **Fixed:** the COD reservation is now aged too; the suite passes unmutated and the mutant is red. |
| S9 | `merchant-tenant-predicate`: the tenant guard no longer refuses an unscoped query | red |
| MV1 | an alias for `reports:read` appears | `store-staff-permission-vocabulary` tests 1 and 2 |

Two further strengthenings, made while migrating rather than left as-is: `merchant-tenant-predicate`'s title promised "cross-tenant sees nothing" but no
assertion said so (the original had the same gap); it now seeds a second tenant with an order, shows with an unguarded control that both tenants' lines
sit side by side in the database, and asserts the guarded, store-scoped query returns none of the other tenant's rows in either direction.

## 11. Security coverage preserved (and where it lives)

| Proof | Where | Boundary |
|---|---|---|
| OTP / magic-link single use | `owned-db/verification-token-redemption.postgres` (real row locking) + unit `verification-token-redemption.test.ts` + `tests/identity-foundation/buyer-email-challenges-postgres`, `buyer-authorization-codes-postgres` (owned clusters, unchanged) | internal signed identity + route + DB |
| buyer ownership | `tests/identity-foundation/buyer-verified-ownership-postgres` (unchanged) | DB constraints |
| staff creation, product mutation, cross-store denial | `owned-db/real-staff-product-journey.postgres` (real `POST /employees`, real signed identity per request); `real-http-shadow-rehearsal.postgres` | signed identity / injected context + route + DB |
| same-session permission withdrawal | `real-staff-product-journey` §7–8: same identity, re-signed per request; write refused 403 after the downgrade, read still 200 | signed identity + route |
| target-role backfill; target-only divergence; reconciliation | `real-staff-product-journey` §2/§6, `real-http-shadow-rehearsal`, `backfill-and-target-shadow` | DB + comparator |
| shadow timeout / cancellation | unit `staff-permission-shadow.test.ts` (unchanged; not a DB proof) | middleware |
| privacy request concurrency | unit `buyer-privacy-routes.test.ts` (unchanged): a modelled race plus a structural check of migration 262's partial unique index. **No real-database concurrency test exists** — pre-existing; the isolated lane now makes one cheap (§17) | route |
| support-ticket isolation | unit `employee-tickets-tenant-scope.test.ts`, `buyer-support-routes.test.ts` (unchanged) | route |

No signed-authentication test was replaced by injected trusted context: the two suites that use signed identity still do; the one that injects context did so
before, states it in its header, and its sibling covers the real path.

## 12. `reports:read`

Inspected and **not aliased**, on evidence. It is one of the 12 keys a store owner may grant staff (`LETBUYY_STORE_STAFF_PERMISSIONS`, the keys the
merchant app offers; label "View analytics & reports"; carried by 5 of 6 preset roles), and the only one of the 12 with no canonical alias (11 of 12 map).
It is **unused**: the gateway's `StaffPermissionKey` does not contain it, no route names it, and the analytics routes are owner-only. It is **ambiguous**:
no catalog names a merchant-staff report/analytics action (`analytics.read` exists only as a platform-employee seed permission; `analytics:read` is an
OAuth-style API scope on the GraphQL schema — a third vocabulary), so `report.read` vs `analytics.read` is a product decision, together with whether staff
analytics access should exist at all. An alias would have named a permission nothing enforces. `store-staff-permission-vocabulary.test.ts` (3 tests, unit
lane) pins the state; the decision changes that file in one change with the route. No role was broadened and no permission granted.

## 13. Verification

Everything below was run on the committed tree (or, where marked, in a fresh disposable clone of it). Nothing was run against the primary checkout; nothing
was pushed, merged or deployed.

| Check | Command | Result |
|---|---|---|
| **Root suite** | `node scripts/governance/test-behavioral.mjs --with-contracts --report ...` (the root `test` script), 12 m 07 s | **PASS: 2527 tests, 2512 pass, 0 fail, 0 cancelled, 15 skipped, 0 todo** |
| groups | | pure + live 176 suites / 1886 tests (1871 pass, **15 skip**, all `[HUMAN-REQUIRED]`); postgres (owned clusters) 59 suites / 305 tests, 305 pass, **0 skip**; **gateway database (owned) 9 suites / 14 tests, 14 pass, 0 skip**; contracts 322 / 322 |
| Gateway unit lane | `pnpm --filter @letbuyy/api-gateway run test:unit` | 1320 tests, 1319 pass, 0 fail, 0 cancelled, **0 skipped**, 1 todo (`LB-BIL-002`, open, unrelated) |
| Gateway isolated database lane | `pnpm --filter @letbuyy/api-gateway run test:db` | 9 suites, **14 tests, 14 pass, 0 skipped**, wall 39.9 s; immediate repeat 41.2 s, identical; two concurrent runs both green |
| Both lanes from a **clean clone** | fresh `git clone --local` + `pnpm install --frozen-lockfile`, no `.dev.vars`, no local state | unit 1320 / 0 skipped; database 9 suites / 14 tests / 0 skipped: the lane needs nothing but the repository, Docker and two images |
| Runner and lane tests | `owned-fixture-guard` 13, `gateway-db-lane` 11, `executable-runner-lifecycle` 13 (2 new shim tests), `gateway-db-lifecycle` 6 (150 s, real Docker) | 43 / 43 |
| Typecheck | `pnpm run typecheck` (turbo); `pnpm --filter @letbuyy/api-gateway run typecheck` | 81 / 81 successful; gateway exit 0 |
| Lint | `pnpm run lint` (turbo) | exit 0, **0 errors** (the run replayed cached results for the five lint tasks: this task changed no file those tasks lint, so the cache hit is the correct answer, not a shortcut) |
| Governance | `node scripts/validate-governance.mjs --lane=gate`, real lane, in a fresh disposable clone of `7e10134f` and again of the final commit `882cb819` (the lane deletes generated directories; never run in the worktree); the default invocation is identical | **PASS=114 FAIL=0 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1** (115 discovered on disk), both times |
| `tests/governance` + `tests/ci` on the final commit | `node --test --test-concurrency=1 tests/governance/*.test.mjs tests/ci/*.test.mjs` in the fresh clone of `882cb819`, 191 s | **334 tests, 334 pass, 0 skipped**: the Docker lifecycle tests executed, they were not skipped |
| **Network census of the default lane** | the gateway unit lane with a preload that records every socket `connect()` and would **block** the restored stack's ports (5432, 54320-54329) | 174 attempts: 165 are tsx's own IPC pipe, 9 are the tenant-guard tests' deliberate negative controls at `*.invalid.test:443` (an unresolvable reserved name), **0 to any loopback database or REST port, 0 blocked**. The default lane never connects to the restored stack. |

**Root count reconciliation** (the earlier task's root run: 2481 tests, 2466 pass, 15 skipped): **+46 tests, +46 passes, +-0 skips**: the ownership-guard tests +13, the lane
pins +11, the gateway lifecycle tests +6, the two no-daemon lifecycle tests +2, and the gateway database group +14 (the 14 formerly skipped tests, now executed). The 15 skips are
the same fifteen `[HUMAN-REQUIRED]` markers; no skip was added or hidden. Contracts (322) and the 59 Postgres suites are unchanged. The gateway unit lane was never part of the root
count; it moved 1331 to 1320 (section 6).

## 14. Remaining skips, TODOs, HUMAN-REQUIRED

* **Root suite: 15 skipped, all `[HUMAN-REQUIRED]`**: HR-KMS-LIVE, HR-TURNSTILE-LIVE, HR-PA-SPLIT-LIVE, HR-MERCHANT-PSP-LIVE, HR-GST-IRP-LIVE, HR-CARRIER-LIVE, HR-DNS-CHECKOUT,
  HR-WHATSAPP-LIVE, HR-DLT-TRAI-LIVE, HR-ESP-LIVE, HR-AUTOPAY-LIVE, HR-LEGAL-DPDP-PA, HR-WAREHOUSE-LIVE, HR-AI-MODEL-LIVE, HR-PROD-MIGRATE-DEPLOY. Each needs a credential, a provider
  contract, a legal sign-off or a deployment only a human can give. None is a code defect and none was added by this task. 0 suite-level skips; 0 todo.
* **Gateway unit lane: 0 skipped; 1 TODO**: `LB-BIL-002 (open)`, one payment cannot also activate a second store the same merchant owns. Open product work, unrelated, unchanged.
* **Gateway isolated database lane: 0 skipped, 0 todo**, and by construction it cannot report either: a skipped, todo or empty gateway suite is red.
* **Limits of what this proves (not defects, stated so they are not mistaken for coverage):** the gateway reaches the database as the service role, so this lane does not
  prove row-level-security policies; `real-http-shadow-rehearsal` injects an auth context (its sibling `real-staff-product-journey` runs the real signed identity); privacy-request
  concurrency has no real-database test (section 11); the lane needs Docker and two images present locally (CI pulls them; a workstation does not); the cloud-sandbox shim cannot host it
  (gateway suites are red there, with the reason); 397 dangling anonymous Docker volumes remain, deliberately (section 9); and the CI behaviour (pulling the two images when `CI=true`) is designed and
  unit-tested (the image-policy test) but has not been observed on a hosted runner from here.

## 15. Existing synthetic data in the restored stack — PROPOSAL ONLY (unexecuted)

**Nothing below has been done.** No row was deleted, no trigger disabled, no restore or reset run. Q3 of the earlier decision package stays open; this is the
evidence for answering it.

### 15.1 What is there (read-only census, counts only, 2026-09-29)

Attribution is by markers the fixtures left (`T12`–`T16` SKU/name prefixes, `t16-autotest-*` subdomains, `*@example.invalid` emails), by foreign keys to
those rows, and — where nothing marks a row — by the time window only. Confidence is stated per row.

| Table | Rows attributable | Basis | Confidence |
|---|---|---|---|
| `products` | 115 of 117 | SKU/name marker | **high** |
| `sites` | 14 of 19 | `t16-autotest-*` subdomain | **high** (the other 5 are the dev store `snaz`, a second dev tenant and sites the census did not classify; 3 of the 5 were created in the window, 2 before it) |
| `orders` | 96 of 97 | marker email, or lines on a marked product | **high** |
| `order_items` | 96 | FK to those orders | **high** |
| `inventory_levels` / `inventory_reservations` / `inventory_adjustments` / `inventory_events` | 101 / 82 / 93 / 93 | FK to marked products / orders | **high** |
| `order_tax_lines` / `order_shipping_lines` / `payment_transactions` / `checkout_sessions` | 80 / 82 / 82 / 82 | FK to those orders | **high** |
| `gst_invoices` | 20 | FK to those orders | **high** — **immutable** (§15.3) |
| `gift_card_accounts` / `gift_card_ledger_entries` / `gift_card_redemptions` | 40 / 90 / 30 | no marker; created 2026-09-28 10:30 → 2026-09-29 06:07 UTC, exactly the window of the `gift-card-money-path` runs, and no other flow uses gift cards | **medium** |
| `purchases`, `audit_activity_events` | 83, 83 | same count as the checkout sessions, same window, no FK to a marked parent | **medium** |
| `audit_logs`, `outbox_events`, `idempotency_keys` | 92 of 341, 290 of 349, 5 | created in the window by the RPCs' side effects, but mixed with the running stack's own activity | **low** |
| `runtime_telemetry_metrics*`, `worker_request_logs*` | 602 and 436 rows in the window | the running local stack's own logging | **not attributable — legitimate** |
| `buyer_accounts` 1, `devices` 1, `sessions` 1, `media`/`media_assets` 1, `auth_password_set_intents` 1, `users_custom` 1, `carts` 3, `employees` 1, `verification_tokens` 1 | in the window | the S26 / local sign-in work and one leftover employee; not created by these suites (which deleted theirs) or not separable | **not attributable — probably legitimate local activity mixed in** |

Log-like tables without a foreign key to a marked parent were enumerated only by "rows created since the first synthetic product (2026-09-28 08:18 UTC)"; the
inspection step in §15.4 should add any table it finds before anything is decided.

### 15.2 Dependencies (single-column FKs into the marked parents; delete rule: `c` cascade, `n` set null, `a` no action)

`sites` → products, orders (×2), order_items (all `c`); `products` → inventory_levels, inventory_events, inventory_reservations (`c`), order_items (`n`),
**inventory_adjustments (`a` — blocks deleting a product while adjustments exist)**; `orders` → order_items, order_shipping_lines, order_tax_lines,
payment_transactions, gst_invoices, gift_card_redemptions (`c`), checkout_sessions, inventory_events, inventory_reservations, gift_card_ledger_entries (`n`);
`gift_card_accounts` → ledger entries and redemptions (`c`).

### 15.3 Immutable and protected records

`gst_invoices_reject_delete` and `gst_invoices_reject_update` (20 invoices) make an invoice unremovable, and `gst_invoices.order_id` cascades from `orders`, so
**deleting any of the 20 orders that carry an invoice — or the store or product above them — fires the trigger and fails.** `trg_orders_checkout_immutable`
guards order fields; the gift-card ledger is append-only by the money rules (no DB trigger, but a `DELETE` would be a money-rule violation, and totals are a
ledger projection). A selective cleanup therefore cannot be done by plain `DELETE`, and this task will not disable protections.

### 15.4 Options, ranked

| # | Option | Risk | Recommendation |
|---|---|---|---|
| 1 | **Leave the rows.** They are identifiable and no longer growing; the isolated lane means nothing new is added | none; the stack stays cluttered (~100 synthetic products, 20 invoices, 40 gift cards) | **recommended until the owner wants the stack clean** |
| 2 | **Rebuild the local stack** into a **new** database/volume from migrations + `scripts/dev/seed-snaz-fixture.mjs`, keeping the current one archived (take a `pg_dump` of its current state first) | discards local activity in the new stack unless re-created; the archive keeps it | recommended **if** a clean stack is wanted: it needs no trigger bypass |
| 3 | Selective cleanup by a reviewed SQL script | needs the GST triggers disabled (not authorized, and the wrong tool), gift-card ledger edits, and would still leave `low`-confidence collateral (audit/outbox) | **not recommended** |
| 4 | Restore `~/Projects/LetBuyy-Workspace/DatabaseBackups/active-postgres.dump` | see below | **not recommended without accounting for newer data** |

**The backup.** `DatabaseBackups/` holds a logical dump of the *old* Mac's active database taken **2026-09-26 12:11 local (06:41 UTC)**, with its roles SQL,
plus stopped-pgdata archives of three other containers. Measured against it: **117 of 117 products, 97 of 97 orders, 17 of 19 sites and 1 of 2
`users_custom` rows were created after it.** Restoring it would remove all synthetic data and *all* commerce data with it — the dev store `snaz` (re-creatable
with the seed script), the sign-in/device/session/media rows from the S26 work, and every other local change since 2026-09-26 — and reset the write counters.
It is a restore of the wrong moment. Its contents were not read (metadata only).

**A non-destructive inspection option, available now:** the three read-only scripts used for this section (row counts and write counters per table;
foreign-key lineage of the marked parents with delete rules; protective triggers; rows created since a date) run in a session with
`default_transaction_read_only=on` and print counts only. They are reproduced in the appendix. A `pg_dump --data-only` of just the marked rows can be taken
on request as a review artifact (it is synthetic data, but it is still a copy of the owner's database, so it is not made unasked).

## 16. Earlier statements this supersedes

The three documents that described the auto-discovery behaviour now carry a dated note pointing here: `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` (a pointer at the top, and
notes at §6.4, §7.1, the skip table of §9, Q2 and §10.3), `PHASE2_TEST_BASELINE_RECONCILIATION.md` (the "Correction (2026-09-29)" paragraph in §17) and
`PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` (§4); the project memory note was updated as well. The original text stays where it is: it was true of that moment and is history.

## 17. Open decisions and the next task

Still open, unchanged by this task: **Q3** (§15), Q1, Q4 and the Phase 2 decisions Q5–Q10 of the earlier package, and the `reports:read` canonical name (§12).
**Precise next task:** either (a) *P2-PRIVACY-CONCURRENCY-DB* — add the missing real-database concurrency proof for buyer privacy-request intake (migration 262's
partial unique index under genuine concurrency) as a tenth suite in the isolated lane, which is now a small addition; or (b) whichever of Q3's options the owner
chooses, as its own bounded task with a fresh read-only census first.

## 18. A process incident during this task (disclosed; no effect found)

While assembling this document, a shell command used an **unquoted heredoc** (`python3 - <<PY`) whose text contained Markdown code spans. The shell executes
every backticked word in an unquoted heredoc *before* the interpreter starts. The substitutions ran in the order they appeared: a few harmless failures
(`command not found`, a `docker rm -f` with no operand, an `rm -f -v` with no operand), then a backticked `docker volume prune`, which stopped at its own
interactive confirmation prompt with no input available. The next backticked words in the text were the root `test` script, the gateway `test:db`, and
`validate-governance --lane=gate` (which **deletes generated directories**), and the shell's directory at that moment was the *primary* checkout.

I noticed the command had hung, read the process list, and killed the parent shell first (so that nothing further in the expansion could run) and the blocked
`docker volume prune` second, before any confirmation could be given. Verified afterwards: Docker's volume counts were unchanged (403 total, 397 dangling, before
and after), the set of running containers was unchanged, the primary checkout's `git status` and its `node_modules` were unchanged, this worktree was unchanged,
and no test, install or governance process from the expansion was running (the only `turbo run dev` processes are the developer's own, three days old, and were not touched).
Nothing was pruned, deleted or run against the primary checkout. Everything after the incident was written with quoted heredoc delimiters or script files.
The lesson is recorded in the project memory (quoted delimiters; never backticks in an unquoted heredoc).

## Appendix — the read-only inspection scripts

Run each as `docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' <db container> psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 < script.sql`. The session is
read-only: any write attempt errors. They print counts and timestamps, never record contents.

**A. Row counts, synthetic-marker counts, newest rows, cumulative write counters** (the before / mid / after census)

```sql
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SELECT 'meta|txn_read_only|' || current_setting('transaction_read_only');
SELECT 'meta|captured_at_utc|' || to_char(now() AT TIME ZONE 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"');
-- Row counts of the tables the nine suites used to write to (counts only, never contents).
SELECT 'rows|' || t || '|' || n FROM (
  SELECT 'sites' t, count(*) n FROM public.sites UNION ALL
  SELECT 'products', count(*) FROM public.products UNION ALL
  SELECT 'inventory_levels', count(*) FROM public.inventory_levels UNION ALL
  SELECT 'inventory_reservations', count(*) FROM public.inventory_reservations UNION ALL
  SELECT 'inventory_locations', count(*) FROM public.inventory_locations UNION ALL
  SELECT 'orders', count(*) FROM public.orders UNION ALL
  SELECT 'order_items', count(*) FROM public.order_items UNION ALL
  SELECT 'order_tax_lines', count(*) FROM public.order_tax_lines UNION ALL
  SELECT 'gst_invoices', count(*) FROM public.gst_invoices UNION ALL
  SELECT 'gift_card_accounts', count(*) FROM public.gift_card_accounts UNION ALL
  SELECT 'gift_card_ledger_entries', count(*) FROM public.gift_card_ledger_entries UNION ALL
  SELECT 'gift_card_redemptions', count(*) FROM public.gift_card_redemptions UNION ALL
  SELECT 'checkout_sessions', count(*) FROM public.checkout_sessions UNION ALL
  SELECT 'tax_rates', count(*) FROM public.tax_rates UNION ALL
  SELECT 'users_custom', count(*) FROM public.users_custom UNION ALL
  SELECT 'employees', count(*) FROM public.employees UNION ALL
  SELECT 'principals', count(*) FROM public.principals UNION ALL
  SELECT 'store_memberships', count(*) FROM public.store_memberships UNION ALL
  SELECT 'site_roles', count(*) FROM public.site_roles UNION ALL
  SELECT 'site_role_permissions', count(*) FROM public.site_role_permissions UNION ALL
  SELECT 'verification_tokens', count(*) FROM public.verification_tokens
) x ORDER BY t;
-- The same synthetic markers as the earlier census (T12-T16 fixtures), counts only.
SELECT 'marker|products_T1x|' || count(*) FROM public.products WHERE sku ~ '^T1[2-6]-' OR name ~ '^T1[2-6] ';
SELECT 'marker|sites_t16|' || count(*) FROM public.sites WHERE subdomain LIKE 't16-autotest-%';
SELECT 'marker|orders_t16|' || count(*) FROM public.orders WHERE customer_email LIKE 't16-autotest-%@example.invalid';
-- Newest row per table (a timestamp, no content): a write during this task would move these.
SELECT 'newest|' || t || '|' || coalesce(to_char(m AT TIME ZONE 'utc','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'-') FROM (
  SELECT 'products' t, max(created_at) m FROM public.products UNION ALL
  SELECT 'orders', max(created_at) FROM public.orders UNION ALL
  SELECT 'sites', max(created_at) FROM public.sites UNION ALL
  SELECT 'gift_card_accounts', max(created_at) FROM public.gift_card_accounts UNION ALL
  SELECT 'gst_invoices', max(created_at) FROM public.gst_invoices UNION ALL
  SELECT 'verification_tokens', max(created_at) FROM public.verification_tokens
) y ORDER BY t;
-- Cumulative write counters the server itself keeps for those tables (inserts/updates/deletes since stats reset).
SELECT 'stat|' || relname || '|ins=' || n_tup_ins || ',upd=' || n_tup_upd || ',del=' || n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname IN ('sites','products','inventory_levels','inventory_reservations','inventory_locations','orders','order_items','order_tax_lines','gst_invoices','gift_card_accounts','gift_card_ledger_entries','gift_card_redemptions','checkout_sessions','tax_rates','users_custom','employees','principals','store_memberships','site_roles','site_role_permissions','verification_tokens')
ORDER BY relname;
SELECT 'meta|stats_reset|' || coalesce(to_char(stats_reset AT TIME ZONE 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'never') FROM pg_stat_database WHERE datname = 'postgres';
```

**B. Lineage of the marked parents through single-column foreign keys, protective triggers, rows created since the backup**

```sql
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SELECT 'meta|txn_read_only|' || current_setting('transaction_read_only');

-- Parent sets, by the markers the earlier census used, as SQL text so that nothing has to be created (the session is read-only).
-- Counts only; no record contents are ever selected.
WITH sets(name, sql) AS (VALUES
  ('sites',  'SELECT id FROM public.sites WHERE subdomain LIKE ''t16-autotest-%'''),
  ('products', 'SELECT id FROM public.products WHERE sku ~ ''^T1[2-6]-'' OR name ~ ''^T1[2-6] '''),
  ('orders', 'SELECT id FROM public.orders WHERE customer_email LIKE ''t16-autotest-%@example.invalid'' UNION SELECT order_id FROM public.order_items WHERE product_id IN (SELECT id FROM public.products WHERE sku ~ ''^T1[2-6]-'' OR name ~ ''^T1[2-6] '')'),
  ('gift_card_accounts', 'SELECT id FROM public.gift_card_accounts WHERE created_at >= timestamptz ''2026-09-28 10:30:00+00''')
)
SELECT 'set|' || name || '|' || (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM (' || sql || ') s', false, true, '')))[1]::text FROM sets ORDER BY name;

-- Every single-column foreign key that points at one of the parents: how many child rows reference the synthetic set, and the
-- delete rule (a=no action, r=restrict, c=cascade, n=set null, d=set default).
WITH sets(name, sql) AS (VALUES
  ('sites',  'SELECT id FROM public.sites WHERE subdomain LIKE ''t16-autotest-%'''),
  ('products', 'SELECT id FROM public.products WHERE sku ~ ''^T1[2-6]-'' OR name ~ ''^T1[2-6] '''),
  ('orders', 'SELECT id FROM public.orders WHERE customer_email LIKE ''t16-autotest-%@example.invalid'' UNION SELECT order_id FROM public.order_items WHERE product_id IN (SELECT id FROM public.products WHERE sku ~ ''^T1[2-6]-'' OR name ~ ''^T1[2-6] '')'),
  ('gift_card_accounts', 'SELECT id FROM public.gift_card_accounts WHERE created_at >= timestamptz ''2026-09-28 10:30:00+00''')
), fks AS (
  SELECT c.conrelid::regclass::text AS child, a.attname AS col, cl.relname AS parent, c.confdeltype AS del
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  JOIN pg_class cl ON cl.oid = c.confrelid
  WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND c.connamespace = 'public'::regnamespace
    AND cl.relname IN ('sites', 'products', 'orders', 'gift_card_accounts') AND cl.relnamespace = 'public'::regnamespace
), counted AS (
  SELECT f.child, f.col, f.parent, f.del,
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %s WHERE %I IN (%s)', f.child, f.col, s.sql), false, true, '')))[1]::text::int AS n
  FROM fks f JOIN sets s ON s.name = f.parent
)
SELECT 'lineage|' || child || '.' || col || ' -> ' || parent || '|del=' || del::text || '|rows=' || n FROM counted WHERE n > 0 ORDER BY parent, child, col;

-- Protective triggers on the tables the suites wrote to: their names and whether they are enabled (O = enabled).
SELECT 'trigger|' || c.relname || '|' || t.tgname || '|enabled=' || t.tgenabled::text
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('gst_invoices', 'orders', 'order_items', 'order_tax_lines', 'gift_card_accounts', 'gift_card_ledger_entries', 'gift_card_redemptions',
                    'inventory_levels', 'inventory_reservations', 'checkout_sessions', 'payment_transactions', 'products', 'sites')
ORDER BY c.relname, t.tgname;

-- Rows created after the 2026-09-26 backup in a few tables the suites did not write (counts only): legitimate local activity a restore would lose.
SELECT 'since_backup|users_custom|' || count(*) FILTER (WHERE created_at >= timestamptz '2026-09-26 06:41:00+00') || '/' || count(*) FROM public.users_custom;
SELECT 'since_backup|sites|' || count(*) FILTER (WHERE created_at >= timestamptz '2026-09-26 06:41:00+00') || '/' || count(*) FROM public.sites;
SELECT 'since_backup|products|' || count(*) FILTER (WHERE created_at >= timestamptz '2026-09-26 06:41:00+00') || '/' || count(*) FROM public.products;
SELECT 'since_backup|orders|' || count(*) FILTER (WHERE created_at >= timestamptz '2026-09-26 06:41:00+00') || '/' || count(*) FROM public.orders;
```

**C. Which tables received rows since the first synthetic fixture (log-like tables without a foreign key show up here)**

```sql
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
SELECT 'meta|txn_read_only|' || current_setting('transaction_read_only');
-- Every public table with a created_at column: how many rows were created since the first synthetic product (2026-09-28 08:18 UTC),
-- and how many in total. Counts only. This shows which tables the fixture runs (and anything else) touched in the window.
WITH cols AS (
  SELECT c.table_name FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
  WHERE c.table_schema = 'public' AND c.column_name = 'created_at' AND c.data_type IN ('timestamp with time zone', 'timestamp without time zone')
), counted AS (
  SELECT table_name,
         (xpath('/row/w/text()', query_to_xml(format('SELECT count(*) FILTER (WHERE created_at >= timestamptz ''2026-09-28 08:18:00+00'') AS w FROM public.%I', table_name), false, true, '')))[1]::text::int AS in_window,
         (xpath('/row/t/text()', query_to_xml(format('SELECT count(*) AS t FROM public.%I', table_name), false, true, '')))[1]::text::int AS total
  FROM cols
)
SELECT 'window|' || table_name || '|' || in_window || '|' || total FROM counted WHERE in_window > 0 ORDER BY in_window DESC, table_name;
```

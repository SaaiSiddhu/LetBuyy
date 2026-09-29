# Governance Scripts

Reusable governance orchestration scripts belong here. Keep root-level scripts limited to stable entrypoints that humans and CI call directly.

Temporary analysis scripts must not be committed here; place them under `.analysis/`, `.tmp/`, `.codex/`, or `temp/` and delete them after use.

## Owned database infrastructure for tests

`run-executable-suites.mjs` runs the database-backed suites in clusters it creates and removes itself (`executable-pg-fixture.mjs`): a labeled Postgres container on its own labeled network with its own labeled data volume, memory / cpu / pid limits and no published port. Two kinds of suite run in them:

- `postgres`: `tests/**/*.test.mjs` suites that name `LETBUYY_EXECUTABLE_PG_CONTAINER` (classification: `test-suite-catalog.mjs`); they build the schema they need in an empty per-suite database.
- `gateway-db`: `services/api-gateway/src/__tests__/owned-db/*.test.ts`. For each one the runner clones a database from a per-cluster template (`owned-database-provision.mjs`: the faithful Supabase bootstrap, every migration, the REST roles), starts a real PostgREST beside it, fronts it with the `/rest/v1` proxy the Supabase client expects (`owned-rest-proxy.mjs`), announces all of it through environment variables, and proves the announcement true (`owned-fixture-guard.mjs`) before it starts the suite. The suite repeats that proof as its first act; a suite that skips or runs nothing is red.

Cleanup is by disposal and is verified: the suite's REST container and database go when the suite ends, the run's clusters, networks and volumes when the run ends, on a signal, or after an infrastructure failure, and a final query by the run's own label must find nothing (exit 70: infrastructure could not start; 71: cleanup could not be completed). A run killed with SIGKILL leaves labeled resources that the next run reaps: only containers, networks and volumes carrying `com.letbuyy.executable-fixture`, whose owner pid is dead and that are older than the grace period. Nothing else is ever removed.

Commands: `pnpm run test:executable` (everything), `pnpm run test:db:gateway` (the gateway lane), `node scripts/governance/run-executable-suites.mjs --list`, `--reap-only`. Images are never pulled implicitly on a workstation; set `LETBUYY_EXECUTABLE_PULL=missing` to let the runner pull the two it names (CI does that by itself).

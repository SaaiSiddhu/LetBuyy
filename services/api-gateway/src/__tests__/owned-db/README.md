# Gateway database suites (the owned database lane)

Every `*.test.ts` here needs a real database, and gets one that the executable-suite runner created for it alone.

```bash
pnpm --filter @letbuyy/api-gateway run test:db          # the whole lane
node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/gst-tax-computation.test.ts
```

Running one with `tsx --test` directly fails, on purpose: without the runner's announcement `requireOwnedDatabase()` throws before a statement is sent. There is no fallback to a local Supabase stack, no `.dev.vars` lookup and no skip.

## What a suite gets

For each suite the runner clones a database from a per-cluster template (the faithful Supabase bootstrap, every migration, the REST roles), starts a real PostgREST beside it, fronts it with the `/rest/v1` proxy the Supabase client expects, proves the whole thing is its own (labels, run id, image, mounts, network, a marker inside the database and one read back through REST) and only then starts the suite. Nothing is mocked: the gateway talks to a real PostgREST over real Postgres, as the service role, exactly as it does in production.

```ts
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();          // throws unless the runner provisioned and the guard verified it
const tenant = newSyntheticTenant('mytag');    // random ids, `.invalid` addresses, nothing shared with any other run
before(() => seedSyntheticTenant(owned.psql, tenant, { gst: true, taxRates: true }));
// owned.restEnv() -> { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } for a gateway Env or a Supabase client
// owned.psql / psqlAsync / psqlExpectError / script  -> statements as the superuser, in this suite's own database
```

## Rules

- Build everything the suite needs from nothing: no store, owner, catalog row, location or invoice that already exists anywhere. `seedSyntheticTenant` is the recipe; a new ingredient goes there.
- Never `DELETE` or `UPDATE` an immutable record to tidy up (GST invoices, the gift-card ledger and order fields are protected by triggers and money rules, and the suites keep those protections active). The database is thrown away with the suite; that is the cleanup.
- Do not skip, do not mark `todo`. The runner fails a suite that skips or runs no test.
- Say, in the file header, which boundary each proof exercises: internal signed identity, an injected auth context, the gateway route, database constraints and triggers, or (never, here) row-level security. The gateway reaches the database as the service role through PostgREST, which bypasses RLS, so this lane proves the tenant guard, RPCs, constraints and triggers, not RLS policies.
- Source-only checks that need no database stay in the unit lane, in `../`.

## Reset semantics

Suites do not share a database. The cluster's template is pristine and sealed (`ALLOW_CONNECTIONS false`); each suite's database is a fresh clone, dropped when the suite ends, so "reset" is disposal and there is no truncate order to get wrong. Postgres roles are cluster-global, so suites in one cluster run one at a time; parallelism (`--jobs`) means more clusters.

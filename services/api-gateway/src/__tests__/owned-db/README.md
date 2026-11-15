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

## Driving the real worker (`gateway-harness.ts`)

A suite that proves a route, not just an RPC, calls the worker's own `fetch` (the default export of `src/index.ts`) instead of mounting a router of its own: the request then passes the real global middleware, the real route registration and mount order, the real session and role middleware and the production dependency wiring, against the owned PostgREST and Postgres.

```ts
import { Gateway, gatewayEnv, newIdentityKeys, buyerHeaders, signedIdentityHeaders, tapRest, newBarrier, seedBuyerAccount } from './gateway-harness';

const keys = await newIdentityKeys();                       // an ES256 key; its JWKS is what the gateway is told to trust
const gateway = new Gateway(gatewayEnv(owned, keys));       // Env = the owned REST endpoint + the identity configuration
await gateway.request('/v1/storefront/buyer/privacy-requests', { headers: await buyerHeaders(keys, buyer.id) });   // a buyer session
await gateway.request('/v1/employees/tickets', { headers: await signedIdentityHeaders(userId, email) });          // merchant staff / platform staff
```

- Credentials are the real thing, signed by the keys the suite generates: a buyer session (ES256, verified against the configured JWKS, issuer, audience, realm, token use, expiry, replay id and session epoch, then checked against `buyer_accounts`) or the HMAC-signed internal identity merchant and platform staff present. `SessionOverrides` bends one claim at a time for the refusal tests.
- Every request carries a client address of its own (`CF-Connecting-IP`), as Cloudflare presents one per caller, because the gateway's global query-cost limiter keeps a bucket per address and a suite must not exhaust a bucket no production caller shares. Pass an address explicitly to test the limiter itself.
- `tapRest` is the only seam, and it sits on the single HTTP hop between the gateway and the owned PostgREST. Use it to hold concurrent writes until all of them have arrived (`newBarrier`: the conflict path is reached every run, not by luck) or to inject one named fault (a failed readback, a lost response, a collision on an unrelated column); everything downstream of an injected fault stays real. A suite says, where it uses the tap, exactly which of the two it is doing. The governance test pins that no suite replaces `fetch` by hand and that the staff-side suite taps nothing.

## Rules

- Build everything the suite needs from nothing: no store, owner, catalog row, location or invoice that already exists anywhere. `seedSyntheticTenant` is the recipe; a new ingredient goes there.
- Never `DELETE` or `UPDATE` an immutable record to tidy up (GST invoices, the gift-card ledger and order fields are protected by triggers and money rules, and the suites keep those protections active). The database is thrown away with the suite; that is the cleanup.
- Do not skip, do not mark `todo`. The runner fails a suite that skips or runs no test.
- Say, in the file header, which boundary each proof exercises: internal signed identity, an injected auth context, the gateway route, database constraints and triggers, or (never, here) row-level security. The gateway reaches the database as the service role through PostgREST, which bypasses RLS, so this lane proves the tenant guard, RPCs, constraints and triggers, not RLS policies.
- Source-only checks that need no database stay in the unit lane, in `../`.

## Reset semantics

Suites do not share a database. The cluster's template is pristine and sealed (`ALLOW_CONNECTIONS false`); each suite's database is a fresh clone, dropped when the suite ends, so "reset" is disposal and there is no truncate order to get wrong. Postgres roles are cluster-global, so suites in one cluster run one at a time; parallelism (`--jobs`) means more clusters.


Historical migration cohorts are explicit in HISTORICAL_GATEWAY_MIGRATION_CEILINGS
in scripts/governance/test-suite-catalog.mjs. Those suites test a named
predecessor, including its refusal and reverse/reapply paths, against a separate
sealed template at that exact ceiling. Their result records the applied source
hashes and ceiling. They execute fully and cannot silently use the current
schema. The remaining current-stack suites continue through every migration;
an explicit --through-migration still selects a requested qualification cohort.

The 435/436 birth-profile and retained-data cutover cohorts remain separate from
`merchant-current-retained-recovery.postgres.test.ts`, which uses the complete
current schema. That counterpart drives real collection/transfer commands,
checks original receipt replay and tenant denial, and proves that rejected
historical reversals preserve every current table's rows and role authority.

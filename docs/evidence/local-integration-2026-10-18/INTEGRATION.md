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

Five governance validators remain red:

- Migration safety flags `TRUNCATE` tokens in permission/guard declarations313,
  319 and357; it does not establish that those migrations delete rows.
- Sequential migration validation reports the unfinished allocations above.
- Environment scanning flags secret-shaped fixture assignments.
- Payment-rail validation flags the settlement route's Cashfree comparison.
- Provider-mode validation flags billing and local shipping honesty evidence.

Runtime limits: public aggregate directory listing remains intentionally
unavailable under the existing tenant guard; exact store lookup works.
The copied marketplace has no currently eligible listings after the approval
migrations, so a successful feed can be empty. Runtime telemetry inserts report
a local table-permission error; core health/read requests still complete.
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

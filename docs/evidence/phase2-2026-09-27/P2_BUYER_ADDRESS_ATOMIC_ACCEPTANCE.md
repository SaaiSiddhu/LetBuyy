# P2 canonical buyer default-address integrity — local acceptance

3 October 2026. Exact source candidate `70baef806b1baf17e14f65b9f8e7e873815f4d52`. This bounded correction follows storefront audience acceptance at `26660485`; the eleven-phase goal and wider Phase 2 remain active.

## Defects reproduced and corrected

The existing writer cleared defaults before a separate save request. Real-worker red run `d2b9fec73477` passed the five audience scenarios and failed all three new transactional controls: an invalid new default left zero defaults, a foreign address update returned 404 after clearing the caller's own default, and three concurrent creates left three defaults. Migration 266 and its paired rollback replace create/update with one canonical backend RPC. It locks the buyer row, verifies an update target belongs to that buyer before changing anything, switches the default and saves in one transaction. Constraint failure rolls back the switch. The database's partial unique index also rejects multiple defaults. Fields are allowlisted inside the function; caller-supplied identities and timestamps cannot be populated. The function is SECURITY INVOKER with pinned search_path, executable only by the existing backend service role. No new table, principal or session model.

## Verification

| Check | Observed result |
| --- | --- |
| Final owned database run `464f4b0cc087` | 18/18 passes in two suites: 10 real-worker/permissions/rollback scenarios and 8 original profile/address SQL regressions; zero fail/cancel/skip/TODO |
| Default creation/update failure | Original default retained; unsafe update rolled back; sanitized error |
| Ownership | Foreign target 404 makes no partial change to either buyer |
| Concurrency | Three synchronized creations all succeed, leave three saved addresses and exactly one default |
| Permissions/constraint | anon/authenticated/app_tenant denied; service_role allowed; SECURITY INVOKER confirmed; duplicate default rejected by index |
| Paired rollback and reapply | Function/index removed and restored; full address-row JSON unchanged before/after |
| Gateway unit/typecheck | 1324 passes plus one existing TODO, zero failures/skips; compile passed |
| Exact governance | 114/114 required validators pass in task-owned disposable clone; zero fail/blocked/skip; one report-only not-applicable |
| Fixture cleanup | No failures or remaining owned containers/networks/volumes |

The migration intentionally aborts if pre-existing duplicate defaults prevent index creation; it never picks a customer's preference or deletes data. No restored or hosted database was migrated. Coordinate gateway rollback with function rollback. Service-role route tests do not prove tenant RLS. No browser navigation, cloud deployment, real email/provider operation, independent review or whole Phase 2 closure is claimed.

Primary design evidence checked 3 October: [PostgreSQL 16 row locks](https://www.postgresql.org/docs/16/explicit-locking.html) supports serializing competing writes until transaction end; [CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html) supports explicit execution privileges and function configuration. Existing LetBuyy ownership and API contracts determine the behavior; documentation alone is not verification.

## Next dependency-ready work

A caller census found no non-test commerce consumer of `/api/buyer/profile` or `/api/buyer/addresses`: normal account pages, Liquid customer drops/islands and React fallback still use legacy `/api/customer` and HS256 sessions. Connect those existing surfaces to canonical identity; preserve Liquid as renderer. First trace all reads/actions, then implement a store-bound verified-link order read before routing canonical accounts into account/order views. Never substitute a canonical email into legacy order history. Pending D04/D05 decisions remain isolated from this work. No legacy issuer or verifier has been retired yet.

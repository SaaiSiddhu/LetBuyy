# Migration reconciliation and recovery boundaries

Date: 2026-11-09. Operational implementation record; this document does not amend repository governance or authorize a hosted database change.

The integration source now contains 373 forward migrations: baseline 000 and the uninterrupted 073–444 sequence. All 307 migrations from 138 onward have a paired recovery file. Existing forward files through 440 remain byte-for-byte unchanged from the preserved integration checkpoint.

## New KYC identities

The newer KYC worktree reused identifiers already occupied by the canonical history. Its four additional migrations are new source entries:

| Preserved donor | Integrated identity | Capability |
|---|---|---|
| 429 pending retention | 441 | Stale pending attempts and version-aware deletion receipts |
| 430 store closure | 442 | Atomic revocation of private evidence references on closure |
| 431 deletion deadline | 443 | Immutable deletion request time and overdue monitoring |
| 432 exact legal hold | 444 | Receipt-specific holds, explicit release and Console permission checks |

The donor's older 428 theme catalog remains preserved. Canonical catalog migration 432 remains authoritative. Active test and registry references use the actual reconciled basenames. Historical SQL diagnostics retain their original identifiers where source was already preserved by the November 2 reconciliation; tests pin those exact historical labels separately from filenames.

The isolated LetBuyy CLI context was recovered at `/Volumes/Developer Tools/Config/letbuyy-cli/activate.zsh`. The default Supabase login belongs to other projects and must not be used for LetBuyy. Read-only inspection verified both configured Mumbai projects on PostgreSQL 17.6. No hosted SQL or history row was mutated.

## Actual hosted history and preserved aliases

| Environment | Bound project | Recorded entries | Current schema point | Exact pending canonical source |
|---|---|---:|---|---|
| Staging | `yhhhjeaprrpjglriazad` | 343 | Through the two historical 414/415 aliases | 416–444, 29 files |
| Production | `qtrzgnnqnvboifoqntfi` | 341 | Through 413 | 414–444, 31 files |

Both journals retain five timestamp versions for source 176/177/178/183/186. Their SQL token sequences match canonical source, preserving literals and recursively examining function bodies. Every other recorded payload and managed execution receipt was verified. Baseline 000 is an existing schema, not an unapplied migration to replay.

Staging executed warehouse commands as `414_atomic_warehouse_commands.sql`, then gift-card integrity as `415_gift_card_issue_replay_integrity.sql`. Canonical source has the opposite filename assignment. The gift-card SQL is byte-identical. The warehouse source is exactly preserved at `15fca500a08ee8c1c3c4d37a376f8fd81ee97403`; only its provenance migration identity changed from 414 to 415 during earlier source consolidation. All other source bytes, the deployed execution payload and its receipt were verified. Do not replay either implementation on staging, relabel either provider history row, or rewrite the existing warehouse provenance.

`config/supabase/history-aliases.json` binds these finite identities and hashes to the exact staging project. It grants no execution authority and does not create an applied entry. Canonical 415 DOWN is inapplicable to the staging alias: its truthful history guard must refuse the different recorded payload. Use reviewed forward recovery or separately qualify the original historical pair at its exact schema point. Production uses the canonical 414/415 identities normally.

`managed-hosted-history-upgrade.postgres.test.ts` reproduces both existing history/order profiles with synthetic records on the actual Supabase PostgreSQL 17 image and non-superuser `postgres`. It verifies exact pending execution receipts, preservation of original timestamp/alias rows and warehouse provenance, refusal of replay and mismatched DOWN, and retained warehouse acknowledgement replay/tenant denial after upgrade. This is a local managed-role rehearsal, not a claim that either hosted environment was upgraded.

## Recovery files for earlier gaps

Eight missing pairs now support a guarded pre-use reverse at their own schema point:

| Migration | Refusal boundary |
|---|---|
| 138 metafields | Any retained definition or value, including soft-deleted records |
| 140 COD reconciliation | Any COD receipt or remittance credit |
| 157 product metadata | Any metadata differing from the empty default |
| 182 store timezone | Any saved non-default timezone |
| 187 appearance settings | Any settings differing from the empty default |
| 194 demo requests | Any retained lead |
| 261 privacy topic | Any retained privacy request |
| 262 privacy uniqueness | Any open privacy request |

Their table locks and statements have bounded timeouts. They use ordinary dependency checks without cascading removal. They are recovery operations for a qualified predecessor application with intake stopped, not cleanup commands to run on the current schema.

Six other pairs deliberately fail closed:

| Migration | Required recovery approach |
|---|---|
| 170 checkout shipping/GST | Reviewed forward correction or a verified complete pre-migration restore; never replay baseline checkout over the current function |
| 175 authentication search path | Forward correction preserving session rotation and replay controls |
| 179 outbox shadow column | Keep source/shadow compatibility and recover forward |
| 183 pricing catalog | Approved forward catalog correction, or actual preimage backup; never invent prior prices or remove pricing history |
| 184 subscription coupons | Preserve coupon definitions and redemption history; recover additively |
| 186 plan availability | Approved forward availability correction; never reopen unavailable plans during an incident |

These files do not report a successful inverse. The execution request explicitly allows tested backup restoration and forward recovery where a safe reverse does not exist. Do not mark their forward migrations unapplied after a refusal.

## Complete restoration signatures

Rollback files 434, 435, 436, 437, 438 and 440 now bind all 22 restored function signatures before mutation. Checks include input names/types, scalar return type, execution mode, overload cardinality and prohibited public execution of definer functions. Existing provenance, catalog locks, quiescence and retained-data guards remain in place.

The finite source recognizer accepts only the reviewed prepared-writer refusal and pinned search paths before the typed guard. New scalar return kinds must match direct restoration declarations. Existing literal restorations keep their prior bounded grammar. Negative controls reject altered predicates, argument arrays, result types, search paths and injected calls.

## Historical and current tests

The 435 authority/cutover and 436 retained-transfer tests use exact historical schemas. The 438 reverse/reapply test uses its supported 438–440 sequence before newer KYC functions change its full-catalog witness. These cohorts are explicit in `scripts/governance/test-suite-catalog.mjs` and run without skips.

`merchant-current-retained-recovery.postgres.test.ts` uses the full current schema. It drives real collection saves, later edits, original receipt replay, cross-tenant refusal, transfer shipment/partial receipt, and variant retirement/readback. It verifies that rejected historical reversals preserve every current public table's row counts/hashes and role authority. The current shipment, browser and native qualification suites retain the full migration chain.

The tenant registry is regenerated from actual migration source and currently contains 327 tenant-owned tables. A green migration suite remains separate from whole-application, hosted, provider and signed-device acceptance.

## Restoration method

A plain logical restore is not an accepted recovery method for this schema today: catalog custody witnesses bind original object identities, and a fresh logical restore changes those identities. The regression suite proves that refusal with the guards enabled.

A physical `pg_basebackup` rehearsal restores the complete owned cluster into a separate, labeled, bounded container. It verifies all user-table row hashes/counts, schema, owners, ACLs, RLS, constraints, function bodies and a guarded materialized-view refresh. No security guard is disabled. PostgreSQL 16 and the declared PostgreSQL 17 major have both been exercised.

The pre-existing protected run-555 physical snapshot was also restored into a separate internal-network copy and surveyed only inside read-only transactions. Its original snapshot hash and setup were unchanged. That historical synthetic fixture has no provider migration journal and is not evidence of current hosted history or production PITR availability.

For a hosted release, first bind the correct project/environment, inspect exact applied history and retained state, verify a fresh backup/PITR checkpoint and restoration, then prepare the managed migration artifact from a clean pinned commit. Use the repository's trusted-admin maintenance model and atomic history journaling with a freshly observed history digest. Never mark SQL applied without execution or use the legacy loose `db push` wrapper.

## Evidence and remaining gates

Private receipts, logs, migration hashes and preservation archives are retained outside cleanup targets under `/Users/saai_mithra/LetBuyy-Recovery/2026-11-09/mission-211355/`.

This record establishes source reconciliation, verified actual history mapping and local recovery procedures. Fresh hosted backup/PITR availability, restoration and retained-state preflight remain release gates; the November 9 read-only API reported PITR disabled and no entries in its backup list for either project. Do not infer a usable recovery checkpoint from that result or from a local physical-copy rehearsal. AWS Mumbai/Cashfree sandbox provisioning and mobile release signing remain unavailable per the owner. KYC provider intake stays disabled outside the synthetic test path. Whole-candidate qualification, exact-SHA CI, staging acceptance and production activation remain distinct later gates.

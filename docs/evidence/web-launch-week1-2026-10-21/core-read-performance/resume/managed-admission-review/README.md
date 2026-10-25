> Historical review of the rejected event-trigger prototype. The replacement native-lock mechanism and the confirmed provider support submission are recorded in `../../../github-sync/supabase-compatibility-2026-10-22/README.md`. Hosted installation remains pending.

# Independent managed release admission review — 2026-10-22

Status: **REVIEW_BLOCKED** for the candidate captured in `probe-results.json`.
This is independent review evidence for the existing release preflight, not a
replacement release authority or a claim that migration 360 was applied.

The Merchant Performance chat owns shared SQL changes and cloud deployments.
Storefront Performance produced this isolated review after the owner authorized
coordination between the two chats. No existing database, connection, role,
credential or cloud deployment was changed by this probe.

The probe used the existing `public.ecr.aws/supabase/postgres:17.6.1.156` image
with a fresh synthetic database, no network or published ports, no data volume,
and an explicitly labeled container. Its managed branch used `postgres` with
`NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS`, schema CREATE, and ADMIN
membership on a synthetic target role. These are explicit controls rather than a
complete reproduction of hosted Supabase extensions and privilege inheritance.
The probe removed only its owned container and verified successful cleanup.

| Check | Observed result |
| --- | --- |
| Ordinary DDL without a maintenance lease | Succeeds (positive control) |
| Committed pinned guard plus a session lease | Passes the exact candidate fence (positive control) |
| Foreign ordinary table DDL during the lease | Rejected by the guard |
| Foreign owner connection disables the event trigger | Succeeds during the lease |
| Ordinary DDL after that disable | Succeeds during the lease |
| Foreign connection changes an administered role to LOGIN | Succeeds during the lease |
| Transaction-scoped lock presented as a session lease | Accepted by the exact reused fence |
| Newly created, uncommitted guard presented to the fence | Accepted by its non-superuser branch; foreign DDL also succeeds |

The last two checks execute **only the exact fence block**. Migration 360 has an
earlier fresh-transaction check that should reject an already assigned XID, so
the uncommitted-guard result is not evidence of a complete migration-360 bypass.
Other consumers, including rollback 347, do not have that initial check. Each
forward and rollback path needs its own admission proof. A transaction lock can
protect one transaction, but its catalog representation alone does not prove
that the deployer holds a session lease across migration commits.

PostgreSQL explicitly excludes shared-object DDL (including roles) and event
trigger DDL from event trigger coverage. Consequently, an event trigger and an
advisory lease do not by themselves replace the original catalog lock coverage.
See the [PostgreSQL 17 event-trigger documentation](https://www.postgresql.org/docs/17/event-trigger-definition.html)
and [advisory-lock semantics](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS).

`admission-under-review.sql` and `fence-under-review.sql` preserve the actual
candidate examined. `probe-results.json` records hashes, positive controls,
negative results and cleanup. `probe.py` reads the current checkout's admission
and migration 360, captures their hashes, and returns nonzero when it reproduces
the unsafe admissions. It is a review reproducer, not a production deploy tool.
Run it only with Docker access in an environment where its fixed, owned probe
container name is unused. It does not certify full 347/360 upgrades, retained
financial data, downgrade refusal, or actual hosted-role behavior.

Release admission remains unproven until the implementation addresses these
gaps or a human architecture decision explicitly defines a narrower, enforceable
maintenance boundary. Existing catalog, role, retained-data and rollback safety
checks must remain effective; a successful migration replay alone does not prove
concurrency safety.

## Supautils ownership and native-lock follow-up

`ownership-probe.py` and `ownership-results.json` complete a second synthetic
probe with the image's Supautils policy explicitly included and direct
`postgres` login (`session_user=current_user=postgres`, superuser off, no ability
to SET ROLE supabase_admin). `hosted-supautils-settings.json` records the matching
read-only policy settings on both hosted projects. This is a privilege-mechanism
probe, not a populated database upgrade or hosted mutation.

| Mechanism | Verified limitation |
| --- | --- |
| Transfer event trigger to supabase_admin | Permitted, then postgres cannot disable/drop it; function remains owned by postgres |
| Transfer guard function to supabase_admin | Rejected: postgres cannot SET ROLE supabase_admin |
| Transfer event trigger back from admin to postgres | Rejected by native requirement that the new owner be superuser; managed rollback cannot assume it can recover ownership |
| Protected event with ordinary O enable state | A foreign postgres connection can use permitted session_replication_role=replica and execute table DDL during the exclusive lease |
| ENABLE ALWAYS before protected ownership transfer | Permitted and blocks replica table DDL, but CREATE EXTENSION hstore and CREATE PUBLICATION still succeed during the lease |
| event_triggers=false | Correctly rejected for managed postgres |
| Function and event both owned by bootstrap admin | Managed function replacement/ownership and event disable/drop/ownership are rejected; ordinary managed SQL cannot establish both ownerships |
| Catalog table locks and FOR SHARE row locks | Rejected for pg_proc and pg_roles |
| ALTER ROLE role_name with no options | Supported; blocks attributes changing, but not membership grants |
| COMMENT ON ROLE | Blocks grants of the role, but not changes to its attributes |
| Both native role operations in one transaction | Blocks attribute changes and grants of that parent role, but a grant of another parent to the locked member still succeeds |
| No-op ALTER FUNCTION SECURITY INVOKER | Blocks existing function replacement/drop; does not establish a fence over new overloads or other catalogs |
| COMMENT ON EVENT TRIGGER | Blocks dropping that event, but does not block disabling it |

The extension and publication operations above ran inside rolled-back synthetic
transactions. `CREATE EXTENSION hstore` is an explicit negative control: this
probe does not propose enabling any production extension. Supautils documents
that delegated privileged operations can skip non-superuser-owned event-trigger
functions; its [official source and documentation](https://github.com/supabase/supautils)
explain why event ownership alone does not establish function execution coverage.

The combined role-lock failure is specifically relevant to the unreserved
app_tenant role: native tuple locking on the member does not prevent another
parent role being granted to it. Supautils does reject ALTER of reserved anon,
which the probe also verified. These outcomes must not be conflated.

All probe containers were removed. `hosted-read-only-state.json` independently
confirms production retained 1 site, 5 orders and 1 product, the same five recorded
migration versions, and no canonical ledger, tax guard or managed release guard
at the recorded observation. Counts are preservation checks, not a substitute
for full row/constraint parity or financial reconciliation.

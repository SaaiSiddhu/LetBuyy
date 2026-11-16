# Supabase Scripts

Supabase setup utilities live here when they operate on Supabase environment configuration or migration execution.

Scripts must not print service-role keys, database passwords, access tokens, or connection strings. Production execution requires explicit environment selection and placeholder checks before any provider command runs.

The owner approved the `trusted-admin-maintenance-v1` migration model on 26 October 2026. It excludes independent privileged administrator/provider DDL operationally during the release. It does **not** claim native system-catalog exclusion. Runtime tenant isolation and business/financial invariants remain required.

`prepare-managed-migrations.mjs` prepares a versioned execution artifact from a clean, pinned commit. It preserves historical SQL files. Only complete, recognized catalog-admission blocks and the finite provider-role admission checks in 361/388/393 are adapted; the manifest records source, executed, adapter and batch SHA256 values. Post-352 migrations also receive application-table admission and a pre-commit postcondition. Unknown original admission code is refused. No source-defined business function is rewritten. Use a direct PostgreSQL session as `postgres`, or the exact short-lived CLI login with `SET ROLE postgres`; application logins are refused. Do not use a provider HTTP query pool whose connection close/reset behavior is unknown.

Pass a complete `--revision`, `--from`/`--through` inclusive range (or `--names` with a JSON array of exact basenames), `--direction up|down`, a new `--out` directory outside the checkout, and `--ack-trusted-admin-maintenance`. Preparation makes no database connection. The `artifact.sql` must execute on **one backend**: its session advisory lease spans the original per-migration commits. A client must close the connection on error; do not retry an uncertain commit without inspecting migration history and retained state.

Hosted execution still requires verified recovery backups, a fresh retained-data restore rehearsal, complete ownership/grant/source checks, staging acceptance, exact migration-history reconciliation and the approved maintenance window. A prepared artifact or a synthetic test is not production acceptance. Application roles cannot assume the migrator; existing Supabase administrative roles are trusted. The one temporary `cli_login_postgres` identity is accepted only with its exact short-lived, NOINHERIT, provider-issued SET-only membership profile.

Owner/ARB decision16November2026 admits an additional Free recovery route **only
for the native418 sign-in release**: authenticated encrypted same-snapshot logical
data/catalog preservation and an isolated, matching Supabase PostgreSQL17 restore.
The exact typed source/restored identity mapping must preserve definitions,
owners, ACLs, RLS, dependencies, business rows and historical journals; only the
enumerated technical OID references and three proved technical fields in the
single360 custody row may be mapped under the qualified verifier. Original
encrypted manifests and guards remain authoritative. Unknown/changed objects,
weakened witnesses and altered business receipts must refuse. This preserves the
trusted-administrator boundary above; it claims no native system-catalog exclusion.

Both actual backups passed native418 upgrade, replay refusal, pre-use DOWN/reapply
and retained-row/history/permission checks under recipe
`qualification-recipe-20261115T140824Z-native418-source-freeze`. Forward418 is
`0626be3f53dbbf562a3abc37c6dcabe65a167028b8850539dd1d2f47a8030846`; DOWN418 is
`cc0b48bd30cb8c3612d7e26513474dbfbd6d87571b18ccaa800ce325b26ce3d2`.
Bind the final source/adapter/executed hashes to that proof or requalify changed
inputs. Fresh hosted history/permission checks, checkpoint freshness, exact-source
CI and staging acceptance remain mandatory. Physical recovery remains an optional
stronger method. This admission does not certify arbitrary historical DOWNs or
Storage binaries, generalize to another migration, permit destructive DOWN after
use, or waive any release gate. See
`docs/implementation/merchant-native418-free-recovery-admission.md` for the human
decision and bounded proof. All other recovery requirements remain in force.

For execution, supply `--history-sha256` with a fresh database result of the exported `MANAGED_HISTORY_DIGEST_SQL`. This selects atomic history journaling. Existing provider entries are preserved; each source version must be absent for an upgrade. The new row stores the actual adapted payload and a clearly identified source/executed receipt, in the same transaction as its DDL. The manifest separately hashes the journaled transport. An uncertain response requires history readback and preparation of the remaining exact names. Never mark unexecuted SQL as applied. A down artifact requires the exact matching forward payload/receipt before deleting only that history row; any mismatch refuses. Without this flag, output is rehearsal SQL only and must not be used as a hosted history-writing release.

The November 9 read-only history survey found staging's already executed warehouse/gift-card 414/415 identities reversed relative to canonical filenames. `config/supabase/history-aliases.json` records the exact project, payload/source hashes and preserved warehouse provenance identity. Verify every original body/receipt and select only the exact remaining basenames; never replay, relabel or fabricate rows to normalize the journal. Canonical warehouse DOWN must refuse that different staging execution identity. `tests/owned-db/managed-hosted-history-upgrade.postgres.test.ts` exercises both the production-413 and staging-alias upgrade profiles under the non-superuser managed role, preserving existing journals, provenance and retained acknowledgements. The full operational mapping and recovery limits are in `docs/implementation/recovery-integration-2026-11-09/MIGRATION_RECONCILIATION.md`.

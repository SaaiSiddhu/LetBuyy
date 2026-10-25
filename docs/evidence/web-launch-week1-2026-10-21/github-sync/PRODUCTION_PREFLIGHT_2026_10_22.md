> Update: the owner authorized the focused compatibility repair. Local native-lock, financial and populated recovery checks now pass. Hosted release still requires a provider administrator to install the reviewed helper. See [current evidence](supabase-compatibility-2026-10-22/README.md). The preflight below records the original discovery.

# Production release preflight — 22 October 2026

The owner authorized deployment of all current work, explicitly deferred GitHub Actions because account billing cannot be resolved now, and approved the encrypted recovery backup. The CI exception does not establish a passed CI run. No additional release approval is requested.

**Release is blocked by the hosted financial migration privilege model. No hosted migration, Worker/Vercel deployment or branch promotion has occurred.** CLI linking created only a private inspection context; backup initialized the CLI login role. Existing production records were preserved.

## Verified targets and recovery

GitHub: `SaaiSiddhu/LetBuyy`; Cloudflare: `Letbuyy Store`; Vercel: `letbuyy-store-s-projects`. Supabase staging `yhhhjeaprrpjglriazad` and production `qtrzgnnqnvboifoqntfi` are healthy in Mumbai on PostgreSQL 17.6. Four existing Vercel production IDs and both Supabase references are recorded in the non-secret configuration. The console and staging Vercel IDs remain unresolved. Existing Vercel Git links/root paths refer to the earlier `Letbuyy_Store` layout; they have not been changed remotely.

Both hosted databases have 236 public tables, 104 public routines, five recorded historical migrations, and no `app_tenant` role. The five recorded migration bodies match the current 176/177/178/183/186 SQL tokens, ignoring only comments, whitespace and statement terminators. Their original timestamp versions must not be blindly treated as the current numeric migration ledger. The bootstrap `000` cannot be replayed against existing objects.

A native production custom archive was streamed directly through encryption into `/Volumes/Developer Tools/Backups/LetBuyy/2026-10-21/production-full.pgdump.enc`. SHA-256: `72131dd9f20c302e416ab68846ed6c26b12ea7a42042829882d2c846277e8d70`. The separate recovery key remains in private CLI configuration. Archive creation and encryption exited zero; restoration into a **network-disabled** owned PostgreSQL 17.6 database succeeded, including ownership, constraints and history. Counts matched: one site, one custom-auth user, five orders, one product, 18 outbox rows and five migration rows. This is local restore evidence; off-machine recovery and platform-object/key recovery are not certified. The earlier CLI text-data export failed restoration and is explicitly marked unusable in the private manifest. No recovery data or secret values are committed.

## Reproduced blocker

The ordinary managed Supabase `postgres` role is **not a superuser**. The normal SQL API confirms that role and its missing `SET` privilege for `letbuyy.subscription_checkout_version`.

1. Migration 347 creates functions with a custom `SET letbuyy.subscription_checkout_version` clause. It fails under the real role model with `permission denied to set parameter`. Setting a session value first does not satisfy function-creation privilege. The owned role cannot grant this permission to itself.
2. Migration 360 explicitly requires `postgres.rolsuper`, locks provider-owned catalogs including `pg_authid`, and relies on additional custom function settings. A narrow grant for 347 alone would not make the release compatible. This is source-confirmed; no hosted 347/360 execution was attempted.
3. The first rehearsal stopped on an already-applied 176 policy. A fresh rehearsal skipped only the five proven identical migrations. The 311 policy guard exposed the local image's extra `auth` search path; using the canonical `public,extensions` deployment search path preserved and passed that guard. The populated rehearsal then stopped safely at 347.

Do not make `postgres` a superuser, update catalogs directly, remove the financial guards, or mark unapplied migrations complete. Changing the admission model of this financial cutover requires a human architecture decision under `PRIME-R1`; a green suite running as a local superuser does not resolve it.

## Concrete decision needed

Authorize a focused Supabase compatibility repair of the financial migration admission and rollback model. Keep the existing financial writers, retained receipts, quote/tax conservation, least-privilege application roles, and fail-closed unknown-state behavior. Determine a supported migration-role mechanism or replace only the unsupported admission mechanism with a reviewed equivalent. Prove it under the **non-superuser managed role** on the actual PostgreSQL 17 provider image, including downgrade refusal, DDL races, unknown roles/ACLs, concurrent/prepared writers and retained-data conservation. Add no parallel billing system.

Once that repair is approved and verified: rehearse the full upgrade from the encrypted recovery copy; reconcile actual history without fabricated applied entries; stage compatible schema and runtime changes; complete signed-in hosted checks; then promote and release production with the owner's recorded GitHub CI exception. Hosted payment execution, real customer notifications and recovery-data use as synthetic test fixtures remain excluded.

## Completed release checks and limits

The exact `e710c884` release clone passes all 81 workspace typecheck tasks without cache and the real governance gate (114 passed, zero failed, one not applicable). Earlier current-source checks passed 1,916 theme tests, 1,628 gateway units, 340 contracts, 23 real theme-RLS checks, 21 auth tests, ten session-verifier tests, ten merchant production-browser journeys, five operational SQL cases and the complete native merchant-to-buyer storefront journey. Reconciliation passes all 11 tests with its required prepared2 profile. The prior wrong-profile failure and preview-selector failure are retained separately. Storefront lint has zero errors and 837 warnings; a wrongly named filter invocation performed no check and is not counted.

A concurrent Storefront Performance chat is committing its own work in this checkout. Its latest lifecycle-test repair follows the above frozen gate revision; it needs its own final evidence. Single-branch-clone governance emitted missing-ref advisories, so it does not prove the actual develop/staging/main promotion relationships. Hosted theme/media acceptance and the broader merchant performance audit remain open.

Machine-readable facts: [production-preflight-2026-10-22.json](production-preflight-2026-10-22.json). Raw private execution logs and immutable attempt receipts are retained under `/private/tmp/letbuyy-resume-20261021/`; that directory is not durable cloud evidence.

# CI repair and machine continuation

Owner request: check remaining GitHub CI, fix failures and prepare `develop`
for continuation on another machine. Single agent. This is source/CI work;
the nine paused product phases retain their existing acceptance boundaries.

## Repair scope

- Fresh-checkout TypeScript, lint, canonical UI and Flutter fixtures; unsigned
  Android/iOS build prerequisites, including the current iOS 15 minimum.
- Owned browser and Dart prerequisites, the immutable official PostgREST
  mirror, bounded workspace concurrency and full-workspace CI coverage.
- One Supabase-faithful bootstrap in owned provisioning tooling, with unchanged
  compatibility imports for root suites; no runtime import of root test code.
- Real source extraction for LCIS test artifacts and canonical frozen-app
  detection. Generated graphs and runtime build directories stay untracked.
- Current guarded database fixtures, exact historical SQL-only recovery
  controls, portable temporary evidence and bounded prepared-transaction proof.
- Preserve effective backend T&S access when fencing inherited tenant grants
  in migrations313/319; journal added named grants and restore exact semantic ACLs
  on clean rollback. No new tenant mutation access or grant option.
- Recognize the exact modern Supabase journal ACL predecessor in migration360,
  then revoke and journal every non-read privilege as before. Unknown profiles,
  owners, grantors and grant options remain refusals.
- Reject product creation when persisted entitlement authority is unavailable.
- Propagate exhausted public product-query failures as sanitized errors; the
  storefront retry reloads the server read and recovers at the same URL.
- Generate operational LCIS artifacts from source, compare reports to current
  artifact inventories and use portable source paths. Graph query caches preserve
  ranking, case handling and result limits within the immutable engine snapshot.
- Keep background autovacuum out of newly owned migration fixtures, whose
  migrations require quiescence. Ordinary writer/prepared-transaction refusal
  controls remain real. The two exhaustive catalog suites have a bounded
  30-minute deadline; an explicit runner timeout still takes precedence.
- Read the complete product catalog profile in one bounded 64 MiB psql result,
  preserving every JSON field while avoiding repeated per-chunk catalog scans.
- Give the scheduled branch-lag monitor an explicit read-only context. It
  compares fetched `origin/main` with `origin/staging` even when the default
  checkout is `develop`. Production retains its main-only checkout guard and
  HEAD comparison; it cannot select the monitor context. Eleven isolated Git
  regressions cover real lag, missing refs and attempted context downgrades.
  A live fetched-ref check passed with both release refs unchanged.

No migration was applied to the restored or hosted database. SQL behavior is
checked only in disposable owned PostgreSQL. Existing security, money,
retention, tenant and provider controls remain acceptance requirements.

## Continuation prerequisites

Use `develop` from the verified remote. Install workspace dependencies with
`pnpm install --frozen-lockfile`. Run `flutter pub get` in
`apps/marketplace/mobile` and `dart pub get` in `packages/dart/api_client`.
Browser acceptance needs `pnpm exec playwright install --with-deps chromium`.
The root behavioral and gateway acceptance commands explicitly enable exactly
two prepared-transaction slots only in their newly owned test containers.

Full LCIS workspace tests additionally need Python 3.12, `graphifyy==0.8.39`
and `pnpm run test:prepare:lcis`. This extracts real source; no model/provider
credentials are required. Private continuity material, credentials, signing
assets and live local data are separate from a Git clone; see CONSOLIDATION.md.

## Verification and final receipt

Local verification includes all 85 typecheck tasks, all 93 non-Gateway workspace
test tasks, 1,605 Gateway units, all nine lint tasks, 114 governance validators,
unsigned Android/iOS builds, Flutter analysis/tests and the native R2 proof.
The repaired owned suites include product edits90/90, collections19/19,
collection browser5/5, customer/session browser12/12, staff browser1/1,
onboarding browser1/1, theme35/35, reviews45/45 and modern grants6/6.
These are separate suite receipts; intermediate failed and interrupted runs are
retained as diagnostics and are not represented as aggregate success.

The final handoff receipt records the pushed `develop` SHA and completed GitHub
run URLs. It is kept outside this source document so recording CI success cannot
create another untested Git commit. A local pass alone does not establish that
the final remote CI run passed. Product-phase/provider/release acceptance remains
separate from this source and CI handoff.

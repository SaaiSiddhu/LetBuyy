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

## Verification status

Repair verification is in progress on `letbuyy/ci-machine-readiness`.
This document does not yet claim a successful final GitHub run or push.
The final exact-head CI receipt will supersede this paragraph before handoff.

# reference/apps/store-operations AGENTS.md

Purpose: Local operating rules for `reference/apps/store-operations`. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- Follow the root `AGENTS.md` and the Constitution before making architecture, money, identity, tenancy, or governance changes.
- **REFERENCE class** (Constitution §16, Amendment 3, 2026-09-24): preserved donor source, not an application. Never built, deployed, installed as a pnpm or pub workspace member, or imported by anything outside `reference/` (`reference-isolation-validator`); still secret-scanned with no path exemption. Until 2026-09-24 this tree sat at `apps/phase_2/*`, the Amendment 1 tier, which no longer exists. Capabilities leave only by re-implementation in the recipient named in `README.md`, under its Transfer gates.
- **Not production-ready.** See `README.md`: unassigned owner, `D0_DEPENDENT` backend target. Never represent as shippable.
- Authorizes no new backend service — any backend work routes through the D-0-selected canonical backend, never a bespoke store-ops-only backend.

## Forbidden Imports

- No imports from other app roots, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 4) by cross-repository copy from System B (`Ecommerce/LetBuyy/Agrimore/apps/store_ops_app`) — see `README.md` for full provenance.
- 2026-09-03 (Phase N, Stage 4): its `packages/agrimore_*` dependencies were recovered from the Phase M bundle, renamed to `packages/dart/quickcommerce_*`, and this app's own imports repointed at them — see `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`. Dart pub workspace membership itself is decided in that journal's Stage 5, not assumed here.

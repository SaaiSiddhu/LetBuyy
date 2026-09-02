# apps/phase_2/store_ops_app AGENTS.md

Purpose: Local operating rules for `apps/phase_2/store_ops_app`. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- Follow the root `AGENTS.md` and the Constitution before making architecture, money, identity, tenancy, or governance changes.
- `apps/phase_2/*` is not ACTIVE, not RESERVED, not FROZEN — a structural tier for product capabilities outside the six-app core (Constitution amendment, 2026-09-02). Not subject to the RESERVED-must-stay-empty rule.
- **Not production-ready.** See `README.md`: unassigned owner, `D0_DEPENDENT` backend target. Never represent as shippable.
- Authorizes no new backend service — any backend work routes through the D-0-selected canonical backend, never a bespoke store-ops-only backend.

## Forbidden Imports

- No imports from other app roots, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 4) by cross-repository copy from System B (`Ecommerce/LetBuyy/Agrimore/apps/store_ops_app`) — see `README.md` for full provenance.
- 2026-09-03 (Phase N, Stage 4): its `packages/agrimore_*` dependencies were recovered from the Phase M bundle, renamed to `packages/dart/quickcommerce_*`, and this app's own imports repointed at them — see `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`. Dart pub workspace membership itself is decided in that journal's Stage 5, not assumed here.

# packages / dart / quickcommerce_core AGENTS.md

Purpose: Local operating rules for `packages/dart/quickcommerce_core`. This file is hand-authored, subordinate to the root `AGENTS.md`, and exists only to state boundary-specific ownership.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this package inside its declared source boundary: `packages/dart/quickcommerce_core`.
- Prefer completing the canonical owner over adding a parallel implementation.
- Recovered from System B's `packages/agrimore_core` as a transitive dependency of `quickcommerce_domain` (not one of the two `apps/phase_2/*` apps' six directly-declared dependencies); active Agrimore branding was removed on import — see `README.md` and `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md` Stage 1/4.
- **BLOCKED from Dart pub workspace membership** (Stage 5): its `hive_generator` dev-dependency conflicts with another workspace member's `test` constraint under the workspace's unified dependency solve. Left as a plain (non-member) path dependency of `quickcommerce_domain`, which still resolves correctly.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- Reserved roots must stay manifest-only. Frozen roots are source-kept and de-deployed unless the Constitution and ARB explicitly activate them; do not add production deploy targets, public launch copy, or live marketplace/portal operation by default.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- Established 2026-09-03 (Phase N, Stage 4) by cross-repository copy from System B (`Ecommerce/LetBuyy/Agrimore/packages/agrimore_core`) — see `README.md` for full provenance.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.

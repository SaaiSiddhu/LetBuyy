# packages / dart / marketplace_models AGENTS.md

Purpose: Local operating rules for `packages/dart/marketplace_models`. This file is hand-authored, subordinate to the root `AGENTS.md`, and exists only to state boundary-specific ownership.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this package inside its declared source boundary: `packages/dart/marketplace_models`.
- Prefer completing the canonical owner over adding a parallel implementation.
- Namespaced from System A's `packages/models` (`letbuyy_models`), kept deliberately distinct from this repository's own `packages/dart/models` (also `letbuyy_models`) — a genuinely different domain scope, not just a different implementation; see `README.md` and `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md` Stage 2/3. Do not merge the two without an evidence-driven unification decision.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- Reserved roots must stay manifest-only. Frozen roots are source-kept and de-deployed unless the Constitution and ARB explicitly activate them; do not add production deploy targets, public launch copy, or live marketplace/portal operation by default.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- Established 2026-09-03 (Phase N, Stage 3) by cross-repository copy from System A (`Ecommerce/LetBuyy/packages/models`) — see `README.md` for full provenance.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.

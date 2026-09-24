# apps / customer_app AGENTS.md

Purpose: Local operating rules for `apps/customer_app`. This file is hand-authored, subordinate to the root `AGENTS.md`, and exists only to state boundary-specific ownership.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this runtime inside its declared source boundary: `apps/customer_app`.
- This is the shipped Play Store customer app (`com.letbuyy.letbuyy`) — never change `applicationId`, signing config, deep-link intent filters, or Firebase app identity without an explicit, separate decision; see `README.md`'s provenance section.
- Prefer completing the canonical owner over adding a parallel implementation.

## Forbidden Imports

- No imports from other app roots, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- Reserved roots must stay manifest-only. Frozen roots are source-kept and de-deployed unless the Constitution and ARB explicitly activate them; do not add production deploy targets, public launch copy, or live marketplace/portal operation by default.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- Established 2026-09-02 (Phase M, Stage 3) by cross-repository copy from System A (`Ecommerce/LetBuyy/apps/marketplace`) — see `README.md` for full provenance.
- Its shared Dart package dependencies (`letbuyy_core`/`letbuyy_models`/`letbuyy_services`/`letbuyy_ui_kit`, path-referencing System A's own `packages/*`) are not yet consolidated into this repository and this app is not yet a Dart pub workspace member — see the root `pubspec.yaml` comment.

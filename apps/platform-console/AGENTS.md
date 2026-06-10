# apps / platform console AGENTS.md

Purpose: Local operating rules for `apps/platform-console`. This file is hand-authored, subordinate to the root `AGENTS.md`, and exists only to state boundary-specific ownership.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this runtime inside its declared source boundary: `apps/platform-console`.
- Prefer completing the canonical owner over adding a parallel implementation.

## Forbidden Imports

- No imports from other app roots, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- Reserved and frozen roots must stay manifest-only unless the Constitution and ARB explicitly activate them.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- The previous scan-generated repository-intelligence content was removed because generated drift is not law.
- Do not rerun or restore `scripts/generate-repository-intelligence.mjs` output into this file.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.

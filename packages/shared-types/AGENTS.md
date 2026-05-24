# Shared Types Package Governance

Purpose: Incubating canonical package for cross-runtime TypeScript contracts and API/domain types.

Boundary: `packages/shared-types`.

Status: Incubating. Existing contracts remain in `packages/typescript/api-types` until migration.

Rules:

- No runtime side effects.
- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Public contract changes require version-aware rollout notes.
## Dependency Rules

- Dependencies must follow repository package layering and be validated before runtime adoption.
- Shared packages may depend only on approved package contracts, never on app or service source.

## Forbidden Imports

- No imports from apps/*, services/*, legacy/*, infrastructure/*, generated output, or runtime-local environment files.

## Runtime Authority

- This package does not deploy independently and must not own runtime routes, worker bindings, app environment files, or generated artifacts.
- Runtime manifests define which apps or services may consume this package.

## Migration Notes

- Keep this package as an ownership boundary until extracted logic has stable public exports and tests.
- Promote reusable business logic here only with dependency graph validation and updated repository intelligence.

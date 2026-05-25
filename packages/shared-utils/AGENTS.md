# Shared Utils Package Governance

Purpose: Incubating canonical package for cross-runtime pure utilities that do not own business decisions.

Boundary: `packages/shared-utils`.

Status: Incubating. Existing utilities remain in `packages/typescript/utils` until migration.

Rules:

- No app routing, service env, or legacy imports.
- Utilities must be deterministic and typed.
- Business decisions belong in domain core packages, not generic utilities.
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

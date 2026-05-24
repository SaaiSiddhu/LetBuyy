# Mobile Models Package Governance

Purpose: Incubating Dart package boundary for mobile commerce, seller, order, cart, analytics, return, and notification models.

Boundary: `packages/mobile-models`.

Status: Incubating. Existing Dart models remain at `packages/dart/models` until migration.

Rules:

- Models must preserve tenant and actor boundaries.
- Keep serialization explicit and backward compatible.
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

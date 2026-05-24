# Mobile Services Package Governance

Purpose: Incubating Dart package boundary for mobile data, payment, analytics, order, auth, storage, and notification service clients.

Boundary: `packages/mobile-services`.

Status: Incubating. Existing Dart services remain at `packages/dart/services` until migration.

Rules:

- Do not store auth tokens in insecure local storage.
- Service clients must use platform API contracts and tenant context.
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

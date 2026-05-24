# Notification Core Package Governance

Purpose: Incubating domain package for notification templates, preference contracts, delivery states, channels, and event-to-message mapping.

Boundary: `packages/notification-core`.

Status: Incubating. Extract shared contracts before delivery runtime work.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Respect unsubscribe and notification preference semantics.
- Do not include provider secrets in package code.
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

# Search Core Package Governance

Purpose: Incubating domain package for search indexing contracts, query filters, ranking metadata, and tenant-aware search document shapes.

Boundary: `packages/search-core`.

Status: Incubating. Extract typed contracts before service runtime indexing logic.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Search documents must include tenant scope.
- Private merchant data must not enter public storefront indexes.
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

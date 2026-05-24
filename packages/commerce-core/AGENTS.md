# Commerce Core Package Governance

Purpose: Incubating domain package for catalog, products, inventory ownership, orders, returns, fulfillment, customer commerce state, and tenant-safe commerce invariants.

Boundary: `packages/commerce-core`.

Status: Incubating. Extract only business logic with tests and stable public exports.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Public exports must be declared through `src/index.ts` when source is introduced.
- Every merchant-owned data shape must preserve `site_id` semantics.
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

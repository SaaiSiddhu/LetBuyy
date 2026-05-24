# CMS Core Package Governance

Purpose: Incubating domain package for pages, blogs, portfolios, resumes, forms, navigation, media references, and content publishing rules.

Boundary: `packages/cms-core`.

Status: Incubating. Extract content contracts without coupling to app routing.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Published content must remain tenant-scoped.
- Preview and production content states must remain explicit.
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

# UI System Package Governance

Purpose: Incubating canonical design-system package for web UI primitives, tokens, accessibility states, data tables, forms, and app-neutral interaction patterns.

Boundary: `packages/ui-system`.

Status: Incubating. Existing web UI package remains at `packages/typescript/ui` until exports are migrated.

Rules:

- No imports from app routes or service runtimes.
- Components must support light and dark themes, focus, hover, active, disabled, loading, empty, and error states where applicable.
- Use Lucide React for web icons.
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

# Permission Core Package

Purpose: Permission catalog, role/scope/resource naming, and shadow authorization decision contracts.

Canonical source boundary: `packages/permission-core`.

## Ownership Rules

- Relationship and permission contracts only; enforcement stays dormant until explicitly enabled later.
- Use `resource.action` names and keep legacy aliases explicit.
- Do not import apps, services, infrastructure, provider SDKs, runtime env, or database clients.

## Dependency Rules

- Dependencies must flow from runtimes into this package, never from this package back into runtime source.
- Package-to-package dependencies must follow `scripts/validators/dependency-graph-validator.mjs`.
- Permission aliases must be explicit and additive so legacy authorization remains comparable.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, runtime env helpers, or database clients.

## Runtime Authority

- This package does not deploy independently and must not own live route guards, middleware, database access, or environment files.
- Runtime authorization remains legacy-authoritative until a future approved cutover enables a new engine.

## Migration Notes

- Shadow permission comparisons may consume these contracts, but must always return the legacy decision while flags are off or shadow-only.
- New canonical permission names must preserve legacy alias mappings for parity evidence.

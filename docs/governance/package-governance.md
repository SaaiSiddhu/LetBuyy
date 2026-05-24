# Package Governance

## Ownership Requirements

Every package must define:

- Package purpose.
- Owning actor or domain.
- Allowed inbound dependencies.
- Allowed outbound dependencies.
- Public exports.
- Forbidden imports.
- Runtime Authority.
- Dependency Rules.
- Migration Notes.
- Tenant and security constraints when applicable.

## Manifest Requirements

TypeScript packages require:

- `package.json`
- `src/index.ts`
- `AGENTS.md`
- `typecheck` script when TypeScript is present

Dart packages require:

- `pubspec.yaml`
- `lib/`
- `AGENTS.md`
- analyzer configuration through the root Flutter workspace

Package `AGENTS.md` files are validated for purpose, ownership rules, forbidden imports, runtime authority, and migration notes.

## Layering

- TypeScript API contracts belong in `packages/typescript/api-types`.
- TypeScript reusable UI belongs in `packages/typescript/ui`.
- TypeScript utilities belong in `packages/typescript/utils`.
- Dart foundation helpers belong in `packages/dart/core` and must not depend on other internal Dart packages.
- Dart models belong in `packages/dart/models`.
- Dart services may depend on core and models, but not UI kit.
- Dart UI kit may depend on core and models.
- Domain package directories under `packages/*-core`, `packages/*-engine`, and shared/mobile package roots reserve ownership until extracted source is introduced.

## Stability Levels

- Stable: package may be imported by multiple runtimes.
- Incubating: package exists to receive extracted logic; imports require review.
- Compatibility: package preserves existing import names or transition paths.
- Deprecated: package must not receive new behavior and must be moved under `legacy/` if runtime-owned.

## Domain Extraction

Apps may contain UI composition, app-boundary proxy logic, and route-level protocol adaptation. Reusable business behavior must be extracted into the domain package that owns the decision.

## Enforcement

- `package-ownership-validator.mjs` enforces manifests, AGENTS files, public export boundaries, and package governance memory.
- `dependency-graph-validator.mjs` enforces package layering and circular dependency prevention.
- `import-validator.mjs` blocks package imports from apps, services, legacy, and infrastructure.

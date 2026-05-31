# Package Governance

## Extracted Domain Packages

The following packages are active canonical contract boundaries and must keep public exports in `src/index.ts`:

- `@letbuyy/shared-types`
- `@letbuyy/tenant-core`
- `@letbuyy/commerce-core`
- `@letbuyy/checkout-core`
- `@letbuyy/auth-core`
- `@letbuyy/theme-engine`
- `@letbuyy/cms-core`
- `@letbuyy/event-core`
- `@letbuyy/notification-core`
- `@letbuyy/search-core`
- `@letbuyy/billing-core`

`@letbuyy/api-types` is an aggregate compatibility package. It must re-export domain contracts and must not become a second source of schemas, DTOs, or theme registry data.

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

- TypeScript API/domain contracts belong in their owning domain package; `packages/typescript/api-types` is an aggregate compatibility export.
- TypeScript API transport belongs in `packages/typescript/api-client`; it must consume `@letbuyy/shared-types` and call `services/api-gateway` instead of importing service or database code.
- TypeScript reusable UI belongs in `packages/typescript/ui`.
- TypeScript utilities belong in `packages/typescript/utils`.
- Dart foundation helpers belong in `packages/dart/core` and must not depend on other internal Dart packages.
- Dart models belong in `packages/dart/models`.
- Dart services may depend on core and models, but not UI kit.
- Dart UI kit may depend on core and models.
- Domain package directories under `packages/*-core`, `packages/theme-engine`, and `packages/shared-types` are active contract authorities once they contain `package.json` and `src/index.ts`.

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

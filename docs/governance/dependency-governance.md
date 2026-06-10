# Dependency Governance

## Direction

Allowed dependency direction:

```text
apps -> services by HTTP/API contract
apps -> packages
mobile apps -> Dart packages
services -> packages
services -> database by configured client
packages -> packages with explicit domain direction
database -> none
infrastructure -> runtime config paths only
legacy -> none
```

Forbidden dependency direction:

```text
apps -> apps
packages -> apps
packages -> services
services -> apps
active runtime -> docs/archive/firebase-legacy
database migrations -> generated app artifacts
package circular dependency
core/services Dart package -> ui_kit
```

## Package Contract Rules

- The pnpm workspace must run with `node-linker=isolated`, `shamefully-hoist=false`, `strict-peer-dependencies=true`, and `auto-install-peers=false`.
- The pnpm lifecycle must also keep `frozen-lockfile=true` and `shared-workspace-lockfile=true`; active workspaces may not carry nested lockfiles or local `node_modules` authority.
- Root toolchain dependencies are pinned exactly. Internal workspace dependencies must use `workspace:*` so package ownership is explicit and local linking cannot silently fall back to registry packages.
- Hidden transitive dependency access is forbidden. Every app, service, and package must declare every package it imports in its own `package.json`; `undeclared-import-validator.mjs` is a named hard gate for this rule.
- Workspace packages must expose intentional public APIs through explicit `exports`. Cross-package imports must use package exports, not relative paths into another package root.
- Circular runtime/package references are forbidden and are hard-failed by `circular-import-validator.mjs`.
- Shared packages expose typed contracts through `src/index.ts`.
- Cross-domain package imports require a stable contract and must not import implementation-only files.
- `@letbuyy/api-types` is an aggregate compatibility package. New domain source must go to the owning package first.
- Domain package direction currently allows:
  - `checkout-core -> commerce-core/shared-types`
  - `payments -> shared-types`
  - `infrastructure -> payments` only for provider adapters implementing provider-neutral payment contracts; provider SDKs stay in `packages/infrastructure`
  - `tenant-core -> shared-types/theme-engine`
  - `notification-core -> event-core/shared-types`
  - `billing-core -> event-core/shared-types`
  - all other extracted core packages -> `shared-types` only unless the dependency graph validator is updated with a documented reason.
- UI packages must not depend on data clients, secrets, provider SDKs, or worker internals.
- Payment and checkout packages must make server-side recalculation and idempotency explicit.
- Tenant packages must make tenant context explicit and auditable.
- Dart package layering is `core -> models -> services/ui_kit` from foundation upward. `core` must not depend on other internal Dart packages, and `services` must not depend on `ui_kit`.
- Runtime manifests define each app/service allowed dependency posture; package manifests must not contradict them.

## Validation

Dependency validation is enforced by `scripts/validate-governance.mjs`, especially `scripts/validators/workspace-lifecycle-validator.mjs`, `scripts/validators/import-validator.mjs`, `scripts/validators/dependency-manifest-validator.mjs`, `scripts/validators/undeclared-import-validator.mjs`, `scripts/validators/dependency-graph-validator.mjs`, `scripts/validators/circular-import-validator.mjs`, `scripts/validators/package-export-validator.mjs`, `scripts/validators/domain-boundary-validator.mjs`, and `scripts/validators/package-ownership-validator.mjs`. The validators scan tracked source files, package manifests, governance files, runtime manifests, lockfiles, CI workflows, Turborepo tasks, and known runtime roots for undeclared imports, topology, import-boundary, package-layer, circular-dependency, public-export, domain contract, deterministic workspace lifecycle, and ownership violations.

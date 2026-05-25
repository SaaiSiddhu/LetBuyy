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
active runtime -> legacy/firebase
database migrations -> generated app artifacts
package circular dependency
core/services Dart package -> ui_kit
```

## Package Contract Rules

- Shared packages expose typed contracts through `src/index.ts`.
- Cross-domain package imports require a stable contract and must not import implementation-only files.
- `@letbuyy/api-types` is an aggregate compatibility package. New domain source must go to the owning package first.
- Domain package direction currently allows:
  - `checkout-core -> commerce-core/shared-types`
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

Dependency validation is enforced by `scripts/validate-governance.mjs`, especially `scripts/validators/import-validator.mjs`, `scripts/validators/dependency-graph-validator.mjs`, `scripts/validators/domain-boundary-validator.mjs`, and `scripts/validators/package-ownership-validator.mjs`. The validators scan tracked source files, package manifests, governance files, runtime manifests, and known runtime roots for topology, import-boundary, package-layer, circular-dependency, domain contract, and ownership violations.

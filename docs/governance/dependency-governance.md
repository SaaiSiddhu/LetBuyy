# Dependency Governance

## Direction

Allowed dependency direction:

```text
apps -> services by HTTP/API contract
apps -> packages
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
```

## Package Contract Rules

- Shared packages expose typed contracts through `src/index.ts`.
- Cross-domain package imports require a stable contract and must not import implementation-only files.
- UI packages must not depend on data clients, secrets, provider SDKs, or worker internals.
- Payment and checkout packages must make server-side recalculation and idempotency explicit.
- Tenant packages must make tenant context explicit and auditable.

## Validation

Dependency validation is enforced by `scripts/validate-architecture.mjs`. The validator scans tracked source files, package manifests, governance files, and known runtime roots for topology and import-boundary violations.


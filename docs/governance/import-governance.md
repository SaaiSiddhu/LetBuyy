# Import Governance

## Dependency Direction

Approved direction:

```text
apps -> packages
apps -> services by HTTP/API contract only
services -> packages
services -> database/provider bindings through service-owned clients
packages -> packages through public exports
database -> no runtime imports
infrastructure -> no UI/runtime imports
legacy -> isolated historical code only
```

Forbidden direction:

```text
apps -> apps
services -> apps
packages -> apps
packages -> services
active runtime -> legacy/*
active runtime -> infrastructure/*
generated artifact -> source/runtime import
```

## App Rules

- Apps may import their own `@/` alias and shared packages.
- Apps must not import sibling apps, app internals, app components, or app route handlers.
- App-local API routes are app-boundary adapters. Durable business decisions belong in services or packages before reuse.

## Package Rules

- Shared packages must expose public contracts through their package boundary.
- Shared packages must not import app routes, service internals, runtime env handlers, generated code, or legacy code.
- Domain packages may import other packages only when the target package owns a stable contract.

## Service Rules

- Services own protocol enforcement, auth, tenant context, idempotency, provider adapters, and orchestration.
- Services must not import UI apps.
- Services may share types and pure helpers from packages.

## Enforcement

`scripts/validators/import-validator.mjs` scans tracked source imports and fails on app-to-app imports, package-to-runtime imports, service-to-app imports, legacy imports from active code, and infrastructure imports from active runtime code.


# Runtime Boundary Composition Governance

Runtime composition is the assembly of domain contracts, service calls, rendering, and deployment-specific adapters inside an app or service boundary. It is not a standalone `runtime-composition` package or service.

## Apps

Apps compose domain packages, UI, route state, package-owned facades, and service API calls. Apps do not import other apps, service source, provider SDKs, or infrastructure adapters. Apps do not create reusable domain authority.

## Services

Services compose domain packages, worker bindings, provider adapters, and persistence. Services do not import apps or other service source trees.

## Packages

Packages expose reusable contracts, package-owned facades, or pure utilities. Packages do not import apps, services, legacy systems, generated output, or runtime env files. Provider-facing execution belongs in services or `packages/infrastructure`; app-facing packages must not hide provider SDK access behind a deleted composition layer.

## Composition Flow

```text
apps -> domain/UI/API-client packages
apps -> services by HTTP/API contract
services -> packages and infrastructure adapters
packages -> packages by approved dependency direction
```

## Enforcement

`import-validator`, `dependency-graph-validator`, and `domain-boundary-validator` enforce the runtime composition boundary in CI.

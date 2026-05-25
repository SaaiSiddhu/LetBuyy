# Runtime Composition Governance

Runtime composition is the assembly of domain contracts, service calls, rendering, and deployment-specific adapters inside an app or service boundary.

## Apps

Apps compose domain packages, UI, route state, runtime-composition adapters, and service API calls. Apps do not import other apps, service source, provider SDKs, or infrastructure adapters. Apps do not create reusable domain authority.

## Services

Services compose domain packages, worker bindings, provider adapters, and persistence. Services do not import apps or other service source trees.

## Packages

Packages expose reusable contracts or pure utilities. Packages do not import apps, services, legacy systems, generated output, or runtime env files. Runtime-composition is the only app-facing package allowed to delegate into infrastructure adapters, and only to hide provider details from app runtimes.

## Composition Flow

```text
apps -> runtime-composition and domain packages
apps -> services by HTTP/API contract
runtime-composition -> application-services, domain packages, infrastructure adapters
services -> packages and infrastructure adapters
packages -> packages by approved dependency direction
```

## Enforcement

`import-validator`, `dependency-graph-validator`, and `domain-boundary-validator` enforce the runtime composition boundary in CI.

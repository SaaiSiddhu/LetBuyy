# Runtime Composition Governance

Runtime composition is the assembly of domain contracts, service calls, rendering, and deployment-specific adapters inside an app or service boundary.

## Apps

Apps compose domain packages, UI, route state, and service API calls. Apps do not import other apps or service source. Apps do not create reusable domain authority.

## Services

Services compose domain packages, worker bindings, provider adapters, and persistence. Services do not import apps or other service source trees.

## Packages

Packages expose reusable contracts or pure utilities. Packages do not import apps, services, infrastructure, legacy systems, generated output, or runtime env files.

## Composition Flow

```text
apps -> packages
apps -> services by HTTP/API contract
services -> packages
packages -> packages by approved dependency direction
```

## Enforcement

`import-validator`, `dependency-graph-validator`, and `domain-boundary-validator` enforce the runtime composition boundary in CI.

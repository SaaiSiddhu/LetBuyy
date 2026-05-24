# Runtime Composition Package Governance

Purpose: Query-layer and response-composition contracts for storefront, merchant, analytics, and mobile runtimes.

## Ownership Rules

- Own read orchestration, aggregation inputs, projection assembly contracts, cache policy contracts, and runtime response shaping.
- Keep UI rendering, HTTP route handlers, provider SDKs, and mutation workflows out of this package.
- Runtime composition may consume application-service and domain contracts, but it must not import app or service source.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, generated output, or provider SDKs.
- Infrastructure access must stay provider-neutral and go through declared `@letbuyy/infrastructure/*` adapter contracts only when a runtime-composition adapter requires provider-backed read composition.

## Runtime Authority

- This package does not deploy independently.
- Apps use it to keep pages and API boundaries thin while preserving runtime-specific presentation authority.

## Migration Notes

- Move storefront and merchant read aggregation into this package before adding new repeated page-level query logic.
- Cache keys must include tenant scope and projection version.

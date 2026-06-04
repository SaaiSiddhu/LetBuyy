# Runtime Boundaries

## App Boundaries

- `apps/storefront-runtime`: shopper-facing public store runtime and customer account flow.
- `apps/merchant-control-plane`: merchant operational UI and app-boundary API proxies.
- `apps/identity-platform`: merchant identity, onboarding, store selection, password and OTP flows.
- `apps/app-marketplace`: partner extension marketplace.
- `apps/developer-portal`: developer documentation, API reference, SDK quick-starts, and partner dashboard shell.
- `apps/theme-marketplace`: partner theme marketplace.
- `apps/marketing-site`: public marketing and pricing.
- `apps/platform-console`: platform super admin.
- `apps/platform-operations-portal`: employee support and operations.
- `apps/mobile/merchant-app`: Flutter merchant builder and store management.
- `apps/mobile/operator-app`: Flutter operator companion scaffold.
- `apps/mobile/shopper-app`: reserved shopper mobile runtime.

## Service Boundaries

- `services/api-gateway`: versioned Hono API, auth middleware, tenant context, service orchestration.
- `services/webhook-service`: payment/provider webhook callback runtime.
- `services/checkout-runtime`: reserved checkout execution runtime.
- `services/queue-workers`: reserved queue and outbox consumers.
- `services/notification-service`: reserved notification delivery runtime.
- `services/search-service`: reserved search indexing/query runtime.
- `services/media-service`: reserved media processing runtime.
- `services/analytics-pipeline`: reserved analytics projection runtime.
- `services/event-bus`: reserved event delivery/runtime contracts.

## Boundary Enforcement

- No service may import from `apps/`.
- No app may import another app.
- No active runtime may import from `legacy/`.
- No package may import a runtime.
- Cross-runtime work must go through HTTP contracts, event contracts, or package contracts.
- Deprecated app aliases may not be recreated as placeholders or compatibility roots.
- `apps/storefront-runtime/consumer-storefront` may not be used as a nested runtime or theme authority.
- Platform console and platform operations portal are separate runtimes: console is super-admin governance, while operations portal is employee workflow execution.
- Runtime manifests are required at every app/service root and are the machine-readable boundary contract.
- Mobile package dependencies must follow `core -> models -> services/ui_kit`; mobile apps must not import other mobile apps.

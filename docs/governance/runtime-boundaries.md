# Runtime Boundaries

## App Boundaries

- `apps/customer_web`: shopper-facing public store runtime and customer account flow.
- `apps/merchant_web`: merchant operational UI and app-boundary API proxies.
- `apps/identity-platform`: merchant identity, onboarding, store selection, password and OTP flows.
- `apps/app-marketplace`: partner extension marketplace.
- `apps/developer-portal`: developer documentation, API reference, SDK quick-starts, and partner dashboard shell.
- `apps/theme-marketplace`: partner theme marketplace.
- `apps/marketing-site`: public marketing and pricing.
- `apps/admin_web`: platform super admin.
- `apps/platform-operations-portal`: employee support and operations.
- `apps/merchant_app`: Flutter merchant builder and store management.
- `apps/customer_app`: Flutter buyer-facing marketplace app; shipped Play Store production identity `com.letbuyy.letbuyy`.
- `apps/admin_app`: Flutter platform-operator app; not production-signed (debug-keystore release config).

## Reserved Mobile Roots

These roots are reserved but not implemented. Each contains only `AGENTS.md` and `runtime.manifest.json`; none owns active runtime behavior, deployment topology, production topology, app-store release artifacts, package manifests, tests, or source until a human-approved mobile scope adds real gateway-wired functionality and governance approval.

- `apps/mobile/shopper-app`: reserved shopper mobile runtime.
- `apps/mobile/operator-app`: reserved operator companion runtime.

## Service Boundaries

- `services/api-gateway`: versioned Hono API, auth middleware, tenant context, service orchestration.
- `services/mobile-bff`: Cloudflare worker bridge that accepts mobile merchant `lb_session` credentials, signs gateway internal session headers, and proxies allow-listed `/v1` mobile traffic without owning business logic.
- `services/webhook-service`: payment/provider webhook callback runtime.
- `services/queue-workers`: implemented Cloudflare Queue worker runtime for event, notification, search, analytics, outbox, and dead-letter consumers declared in `services/queue-workers/wrangler.toml`.

## Reserved Service Roots

These roots are canonical but not implemented. Each contains only `AGENTS.md` and `runtime.manifest.json`; none owns active runtime behavior until source, package/deployment config, tests, and governance approval are added.

- `services/checkout-runtime`: reserved checkout execution extraction; current active owner is `services/api-gateway`, with async consumers in `services/queue-workers` where configured.
- `services/notification-service`: reserved notification delivery extraction; current active owners are `services/api-gateway` and `services/queue-workers`.
- `services/search-service`: reserved search indexing/query extraction; current active owners are `services/api-gateway` and `services/queue-workers`.
- `services/media-service`: reserved media processing extraction; current active owner is `services/api-gateway`.
- `services/analytics-pipeline`: reserved analytics projection extraction; current active owners are `services/api-gateway` and `services/queue-workers`.
- `services/event-bus`: reserved event delivery/runtime extraction; current active event execution uses package-owned contracts through `services/api-gateway` and `services/queue-workers`.

## Boundary Enforcement

- No service may import from `apps/`.
- No app may import another app.
- No active runtime may import from `legacy/`.
- No package may import a runtime.
- Cross-runtime work must go through HTTP contracts, event contracts, or package contracts.
- Deprecated app aliases may not be recreated as placeholders or compatibility roots.
- `apps/customer_web/consumer-storefront` may not be used as a nested runtime or theme authority.
- Platform console and platform operations portal are separate runtimes: console is super-admin governance, while operations portal is employee workflow execution.
- Runtime manifests are required at every app/service root and are the machine-readable boundary contract.
- Mobile package dependencies must follow `core -> models -> services/ui_kit`; mobile apps must not import other mobile apps.

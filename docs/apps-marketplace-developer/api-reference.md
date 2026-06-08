# LetBuyy Apps API Reference

This is the repository scaffold for marketplace app APIs. Public hosting and final docs-site navigation remain human-approved.

## Merchant-Installed App API

- App-token routes live under the gateway app API surface.
- Requests require an active installation, a valid app token hash, and the granted scope for the route.
- Usage event ingestion records per-app/install quota accounting and usage metrics.
- Quota responses include `X-App-Quota-*` headers when quota data is available.

## Marketplace Developer API

- Developer app creation, versioning, pricing plans, webhook CRUD, analytics, sandbox requests, demo sessions, and collaborator codes are exposed through the app-store gateway and typed API client.
- Marketplace BFF routes in `apps/app-marketplace` call the API client; page components do not own business logic.
- Mutations validate inbound payloads with shared Zod schemas and preserve single-writer table ownership in app-store routes.

## OAuth Install API

- OAuth install is the canonical merchant install path.
- Authorization requires PKCE S256 and token exchange persists only token hashes.
- Direct-token install remains a compatibility path and is not documented as the public install path.

## Webhook API

- Developers can register webhook endpoints from Partner Console.
- Install, uninstall, billing, compliance, and lifecycle events enqueue durable delivery rows when a persisted subscription exists.
- Retry and dead-letter handling are operated through queue/webhook service runbooks.

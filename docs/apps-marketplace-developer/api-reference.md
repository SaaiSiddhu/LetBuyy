# LetBuyy Apps API Reference (Frozen Seam)

This is the repository scaffold for retained marketplace app APIs. Public hosting, third-party app launch, and final docs-site navigation remain human-approved.

## Merchant-Installed App API

- App-token routes live under the gateway app API surface for approved private/sandbox flows.
- Requests require an active installation, a valid app token hash, and the granted scope for the route.
- Usage event ingestion records per-app/install quota accounting and usage metrics.
- Quota responses include `X-App-Quota-*` headers when quota data is available.

## Marketplace Developer API

- Developer app creation, versioning, pricing metadata, webhook CRUD, analytics, sandbox requests, demo sessions, and collaborator codes are exposed through the app-store gateway and typed API client.
- Marketplace BFF routes in `apps/app-marketplace` call the API client; page components do not own business logic.
- Mutations validate inbound payloads with shared Zod schemas and preserve single-writer table ownership in app-store routes.

## OAuth Install API

- OAuth install is the retained canonical install contract for any approved future app activation.
- Authorization requires PKCE S256 and token exchange persists only token hashes.
- Direct-token install remains a compatibility path and is not documented as the public install path.

## Webhook API

- Developers can register webhook endpoints in the retained scaffold.
- Install, uninstall, billing, compliance, and lifecycle events enqueue durable delivery rows when a persisted subscription exists.
- Retry and dead-letter handling are operated through queue/webhook service runbooks.

# API Client AGENTS.md

Purpose: Shared typed Commerce API client for apps and other runtimes that need to call `services/api-gateway` without importing service code.

Canonical source boundary: `packages/typescript/api-client`.

## Ownership Rules

- Own framework-free HTTP transport, request option types, error normalization, and typed resource helpers for the LetBuyy Commerce API.
- Return domain data using `@letbuyy/shared-types`; do not define duplicate Product, Order, Customer, Store, Payment, Page, Coupon, or Theme contracts here.
- Keep request payload types lightweight and local to client transport. Domain behavior and validation stay in domain packages and the gateway.
- Do not add provider SDKs, database clients, app routing, React components, or environment loaders to this package.

## Dependency Rules

- This package may depend on `@letbuyy/shared-types` only unless a governance-reviewed extraction requires another pure package.
- Apps may consume this package to call the gateway. The package must never import from `apps/*`, `services/*`, `legacy/*`, repository `infrastructure/*`, or generated output.
- Runtime-specific base URLs, auth tokens, cookies, and fetch implementations are injected by callers.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, `.next`, `dist`, `.turbo`, or runtime-local `node_modules`.
- No `@supabase/*`, Razorpay, Stripe, PayPal, Cloudflare binding, or worker-specific imports.
- No local domain DTO forks that duplicate `@letbuyy/shared-types`.

## Runtime Authority

- This package does not deploy independently and owns no API routes, workers, runtime manifests, secrets, or database access.
- `services/api-gateway` remains the sole backend authority; this package is only a typed client of that backend.

## Migration Notes

- When app-local API handlers are collapsed, apps should import this package instead of importing gateway internals or provider/database clients.
- Add resource helpers only when they map to existing gateway routes. New backend behavior belongs in the gateway and domain packages first.
- Package changes require typecheck, dependency governance validation, and mission ledger evidence.

# P4-4 API Ownership Consolidation

This document records app-local API route authority for the P4 product remediation gate. It is enforced by `scripts/validators/domain-boundary-validator.mjs`.

## Route Classes

- `gateway-proxy`: a Next route may translate browser/session/query shape and call the canonical `/v1` Hono gateway through `@letbuyy/api-client` or a local API-client wrapper. It must not perform database writes, provider mutations, price/payment/inventory calculations, or domain state transitions.
- `app-local-auth`: identity-platform auth routes may own account UI/session flow and call the auth gateway boundary. They remain the canonical merchant identity UI surface.
- `app-local-operator-auth`: platform-console auth routes may own operator login/MFA UI flow. Operations RBAC still belongs to gateway/console service boundaries.
- `app-local-session`: a route may create, read, or clear browser cookies for the app-local UI session only.
- `blocked-local-safety`: a route intentionally rejects unsafe local behavior, such as storefront seed/theme install mutation endpoints.

## Current Classification

- `apps/merchant-control-plane/src/app/api/**`: `gateway-proxy`, except `api/auth/logout`, which is `app-local-session`.
- `apps/storefront-runtime/src/app/api/customer/session` and `api/customer/logout`: `app-local-session`.
- `apps/storefront-runtime/src/app/api/seed` and `api/themes/install`: `blocked-local-safety`.
- Other `apps/storefront-runtime/src/app/api/**`: `gateway-proxy`.
- `apps/identity-platform/src/app/api/auth/**`: `app-local-auth`.
- `apps/identity-platform/src/app/api/email/**`: `gateway-proxy`.
- `apps/app-marketplace/src/app/api/**`: `gateway-proxy`.
- `apps/theme-marketplace/src/app/api/**`: `gateway-proxy`.
- `apps/platform-console/src/app/api/console-auth/**`: `app-local-operator-auth`.

## Enforcement

App-local API routes and their app-local `src/lib` support files must not import Supabase clients, service-role helpers, Prisma/Drizzle clients, raw SQL helpers, payment signature SDK logic, or direct commerce mutation logic. Commerce, checkout, customer, payment, theme, and marketplace behavior must live in the Hono gateway and package contracts.

The only remaining classified legacy presentation adapter is the storefront order lookup trio:

- `apps/storefront-runtime/src/app/api/orders/check/route.ts`
- `apps/storefront-runtime/src/app/api/orders/login/route.ts`
- `apps/storefront-runtime/src/app/api/orders/set-password/route.ts`

These routes may import `@/lib/order-service` only while the storefront order-history UI expects the current camelCase presentation model. They must still call the worker through the typed storefront API client and must not access the database directly.

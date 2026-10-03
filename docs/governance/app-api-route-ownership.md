# P4-4 API Ownership Consolidation

This document records app-local API route authority for the P4 product remediation gate. It is enforced by `scripts/validators/domain-boundary-validator.mjs`.

## Route Classes

- `gateway-proxy`: a Next route may translate browser/session/query shape and call the canonical `/v1` Hono gateway through `@letbuyy/api-client` or a local API-client wrapper. It must not perform database writes, provider mutations, price/payment/inventory calculations, or domain state transitions.
- `app-local-auth`: identity-platform auth routes may own account UI/session flow and call the auth gateway boundary. They remain the canonical merchant identity UI surface.
- `app-local-operator-auth`: admin-web auth routes may own operator login/MFA UI flow. Operations RBAC still belongs to gateway/console service boundaries.
- `app-local-session`: a route may create, read, or clear browser cookies for the app-local UI session only.
- `blocked-local-safety`: a route intentionally rejects unsafe local behavior, such as storefront seed/theme install mutation endpoints.

## Current Classification

- `apps/merchant/web/src/app/api/**`: `gateway-proxy`, except `api/auth/logout`, which is `app-local-session`.
- `apps/commerce/web/src/app/api/customer/session` and `api/customer/logout`: `app-local-session`.
- `apps/commerce/web/src/app/api/seed` and `api/themes/install`: `blocked-local-safety`.
- Other `apps/commerce/web/src/app/api/**`: `gateway-proxy`.
- `apps/platform/identity/src/app/api/auth/**`: `app-local-auth`.
- `apps/platform/identity/src/app/api/email/**`: `gateway-proxy`.
- `apps/frozen/app-store/src/app/api/**`: `gateway-proxy`.
- `apps/frozen/theme-store/src/app/api/**`: `gateway-proxy`.
- `apps/internal/console/src/app/api/console-auth/**`: `app-local-operator-auth`.

## Inventory Changes

> **Where the count lives now (2026-09-29).** The route ratchet and the classification rules moved into
> `scripts/validators/app-api-route-inventory.mjs`; `domain-boundary-validator.mjs` enforces them and the
> tests call into that module, so no test carries its own copy of the number. The list below stops at 129
> (2026-06-13). Every later change (BUYER-4, APPID-P4a, APPID-SEC2, APPID-P4b, APPID-P4c, SUSTAINED-K, up
> to the current count) is recorded in the change-log comments beside `APP_API_ROUTE_RATCHET` in that
> module, which is the authority. Bumping the ratchet remains the deliberate, reviewed maintenance action.

- 2026-06-12 (V1-LAUNCH-B2): inventory 115 → 123. Eight `gateway-proxy` routes added under `apps/merchant/web/src/app/api/stores/[store]/` for the LB-3/LB-4 money flows: `security/step-up`, `security/two-factor` (+ `enroll`, `verify`, `disable`), `orders/[orderId]/refund`, `payouts`, `payouts/[payoutId]/settle`. All translate the merchant session and call the canonical `/v1` gateway (step-up challenges, 2FA, payment refund, payout settle); none performs database writes or provider mutations locally.
- 2026-06-12 (V1-LAUNCH-LB6): inventory 123 → 124. One `gateway-proxy` route added: `apps/merchant/web/src/app/api/stores/[store]/collections/[collectionId]/products/route.ts`. Supports GET (list assigned products) and PUT (replace assignment set) for collection-product management; proxies to the canonical `/v1/products/collections/:id/products` gateway endpoints via `createMerchantApiClient().products.collections.listProducts/replaceProducts`; no database writes or domain mutations locally.

- 2026-06-12 (V1-LAUNCH-B5): inventory 124 → 127. Three `gateway-proxy` routes added for LB-7 shipping: `apps/commerce/web/src/app/api/shipping/rates` (public rate quote pass-through for buyer checkout), `apps/merchant/web/src/app/api/stores/[store]/shipping/rates` (POST create), and `.../shipping/rates/[rateId]` (DELETE). All call the canonical `/v1` gateway; no local writes.
- 2026-06-13 (V1-LAUNCH-LB12): inventory 127 → 128. One `gateway-proxy` route added: `apps/commerce/web/src/app/api/customer/register/route.ts` (LB-12 shopper registration). POST proxies to the canonical `/v1/storefront/customer/register` gateway endpoint via `createStorefrontApiClient().storefront.registerCustomer`, then re-mints the HS256 customer session locally (`createSession`) — mirrors `/customer/login`. No database writes or provider mutations locally; no identity-platform/ES256 involvement.
- 2026-06-13 (V1-LAUNCH-LB11): inventory 128 → 129. One `gateway-proxy` route added: `apps/merchant/web/src/app/api/stores/[store]/gift-cards/[id]/route.ts` (LB-11 gift card lifecycle). GET (audit trail) proxies to `/v1/products/gift-cards/:id/transactions` and PATCH (fraud hold/disable/reactivate) to `/v1/products/gift-cards/:id/status` via `createMerchantApiClient().products.giftCards.transactions/setStatus`. All gift-card balance mutations route through canonical `gift_card_accounts` RPCs in the gateway; no database writes or provider mutations locally.

## Enforcement

2026-10-03, P2-STOREFRONT-BUYER-ORDERS: inventory and lint baseline 204 → 205. `apps/commerce/web/src/app/api/buyer/orders/route.ts` is a gateway-proxy for `/v1/storefront/buyer/storefront-orders`. It resolves the host, forwards the existing site-bound identity token and only cursor/limit inputs; the gateway owns account state, signed site, verified buyer/order links and pagination. It performs no database, local commerce or email-based ownership operation. Normal UI connection and legacy retirement remain separate acceptance work.

App-local API routes and their app-local `src/lib` support files must not import Supabase clients, service-role helpers, Prisma/Drizzle clients, raw SQL helpers, payment signature SDK logic, or direct commerce mutation logic. Commerce, checkout, customer, payment, theme, and marketplace behavior must live in the Hono gateway and package contracts.

- 2026-09-29 (Phase 2 local quality, ESLint baseline reconciliation): inventory unchanged at 204; `config/eslint/boundary-baseline.json` 200 → 204. Four `gateway-proxy` routes were counted in the inventory but had never been added to the lint-side baseline, because the inventory's change log said that allowlist was "for app-local-* classes only". It is not: `letbuyy-boundaries/no-new-next-api-route` reports every app API route file absent from the baseline. Each was reviewed, not just registered:
  - `apps/commerce/web/src/app/api/buyer/profile`, `.../buyer/addresses`, `.../buyer/addresses/[id]` (SUSTAINED-K D1/D2, under the D-ONE-BUYER founder decision of 2026-09-24): thin proxies to `/v1/storefront/buyer/{profile,addresses[/:id]}`. They exist because the buyer session is a host-only `__Host-` cookie on the store origin that a browser cannot present to the gateway's origin, so the token is read server-side and forwarded as one header. No database access, no commerce decision; ownership is the gateway's `buyer_account_id` predicate. Unauthenticated or malformed sessions are refused before any gateway call.
  - `apps/commerce/web/src/app/api/store/[subdomain]/search-suggest` (T5/W3, CAP-C28; the standing exception CAP-C76 named): a public read over the gateway's tenant-safe products route. It resolves no tenant itself (the route segment is the only input), holds no data, inherits the gateway's rate limiting, and only projects the result to six public suggestion fields, including a storefront URL the gateway has no business knowing. The alternative CAP-C76 names as remedy (a), moving the behaviour into the gateway and deleting the route, would also change how the browser reaches storefront search (directly against the gateway origin, or through another proxy); that choice stays open, and the standing exception is now filed instead of unfiled.
  All four now have route tests (normal, unauthenticated, upstream-unauthorised, forwarding, error mapping, header non-leakage; 22 + 9 tests, each property revert-and-watched). While writing them, the three buyer routes were found to relay a gateway error *message* on any failure, including 5xx, after already generalising the *status*; that is fixed (client-error messages still pass through; a 5xx body never does). `tests/federation/app-api-route-ownership.test.mjs` now pins that the baseline and the inventory list exactly the same routes, in both directions.

The only remaining classified legacy presentation adapter is the storefront order lookup trio:

- `apps/commerce/web/src/app/api/orders/check/route.ts`
- `apps/commerce/web/src/app/api/orders/login/route.ts`
- `apps/commerce/web/src/app/api/orders/set-password/route.ts`

These routes may import `@/lib/order-service` only while the storefront order-history UI expects the current camelCase presentation model. They must still call the worker through the typed storefront API client and must not access the database directly.

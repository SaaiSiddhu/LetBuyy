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

App-local API routes and their app-local `src/lib` support files must not import Supabase clients, service-role helpers, Prisma/Drizzle clients, raw SQL helpers, payment signature SDK logic, or direct commerce mutation logic. Commerce, checkout, customer, payment, theme, and marketplace behavior must live in the Hono gateway and package contracts.

The only remaining classified legacy presentation adapter is the storefront order lookup trio:

- `apps/commerce/web/src/app/api/orders/check/route.ts`
- `apps/commerce/web/src/app/api/orders/login/route.ts`
- `apps/commerce/web/src/app/api/orders/set-password/route.ts`

These routes may import `@/lib/order-service` only while the storefront order-history UI expects the current camelCase presentation model. They must still call the worker through the typed storefront API client and must not access the database directly.

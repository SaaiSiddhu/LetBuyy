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

2026-10-04, P2-STOREFRONT-BUYER-WISHLIST: inventory and lint baseline 205 → 206. `apps/commerce/web/src/app/api/buyer/wishlist/route.ts` is a thin gateway proxy for a buyer's store-specific wishlist. It forwards only a host-bound storefront session and product fields; the gateway resolves the explicit verified `buyer_store_customers` link, checks the linked store-customer is active at the signed site, and owns all wishlist reads/writes. It does not infer a relationship from the buyer UUID or email.

App-local API routes and their app-local `src/lib` support files must not import Supabase clients, service-role helpers, Prisma/Drizzle clients, raw SQL helpers, payment signature SDK logic, or direct commerce mutation logic. Commerce, checkout, customer, payment, theme, and marketplace behavior must live in the Hono gateway and package contracts.

- 2026-09-29 (Phase 2 local quality, ESLint baseline reconciliation): inventory unchanged at 204; `config/eslint/boundary-baseline.json` 200 → 204. Four `gateway-proxy` routes were counted in the inventory but had never been added to the lint-side baseline, because the inventory's change log said that allowlist was "for app-local-* classes only". It is not: `letbuyy-boundaries/no-new-next-api-route` reports every app API route file absent from the baseline. Each was reviewed, not just registered:
  - `apps/commerce/web/src/app/api/buyer/profile`, `.../buyer/addresses`, `.../buyer/addresses/[id]` (SUSTAINED-K D1/D2, under the D-ONE-BUYER founder decision of 2026-09-24): thin proxies to `/v1/storefront/buyer/{profile,addresses[/:id]}`. They exist because the buyer session is a host-only `__Host-` cookie on the store origin that a browser cannot present to the gateway's origin, so the token is read server-side and forwarded as one header. No database access, no commerce decision; ownership is the gateway's `buyer_account_id` predicate. Unauthenticated or malformed sessions are refused before any gateway call.
  - `apps/commerce/web/src/app/api/store/[subdomain]/search-suggest` (T5/W3, CAP-C28; the standing exception CAP-C76 named): a public read over the gateway's tenant-safe products route. It resolves no tenant itself (the route segment is the only input), holds no data, inherits the gateway's rate limiting, and only projects the result to six public suggestion fields, including a storefront URL the gateway has no business knowing. The alternative CAP-C76 names as remedy (a), moving the behaviour into the gateway and deleting the route, would also change how the browser reaches storefront search (directly against the gateway origin, or through another proxy); that choice stays open, and the standing exception is now filed instead of unfiled.
  All four now have route tests (normal, unauthenticated, upstream-unauthorised, forwarding, error mapping, header non-leakage; 22 + 9 tests, each property revert-and-watched). While writing them, the three buyer routes were found to relay a gateway error *message* on any failure, including 5xx, after already generalising the *status*; that is fixed (client-error messages still pass through; a 5xx body never does). `tests/federation/app-api-route-ownership.test.mjs` now pins that the baseline and the inventory list exactly the same routes, in both directions.

### 15 October 2026 N1.6 protected-approval form transport

The inventory and ESLint baseline advance together to 214 with
`apps/internal/console/src/app/api/approvals/[operation]/route.ts`, classified
by the existing Console `gateway-proxy` rule. Its finite request/request-money/decision/execute
operations validate same-origin forms, the real durable Console session and
shared transport schemas, then forward to canonical Gateway approvals. It has
no database access, token issuance, independent consent store or business-effect
writer. The Gateway resolves live permissions; its existing PostgreSQL owner
binds consent and commits effect/audit/receipt atomically. Native HTTP 303 form
responses use the existing auth-form transport pattern. A thin client form can
negotiate JSON from the same route to retain its input/request key across a
lost post-commit reply. Both transports pass the same Origin/session/schema
gates; normal two-operator browser execution and both replays are verified in
the current N1.6 evidence. No app-local domain owner is introduced.

The dynamic operation is an explicit four-value dispatch, not an arbitrary
proxy target. Missing/cross-origin POSTs fail before any service credential is
used; same-site sibling merchants cannot manufacture operator consent. Provider
delivery, hosted operation and complete N1.6 acceptance remain separately gated.

### 14 October 2026 N1.1 reconciliation details

Inventory and ESLint baseline move together from 206 to 213. These seven
existing candidate routes were reviewed as `gateway-proxy` adapters:

- `apps/commerce/web/src/app/api/buyer/loyalty/route.ts`
- `apps/commerce/web/src/app/api/buyer/loyalty/history/route.ts`
- `apps/commerce/web/src/app/api/buyer/support/tickets/route.ts`
- `apps/commerce/web/src/app/api/buyer/support/tickets/[ticketId]/messages/route.ts`
- `apps/commerce/web/src/app/api/checkout-handoff/route.ts`
- `apps/commerce/web/src/app/api/checkout/[cartId]/[step]/route.ts`
- `apps/merchant/web/src/app/api/stores/[store]/marketplace-listings/[productId]/route.ts`

Buyer routes resolve the host-bound session and project Gateway responses;
loyalty uses the verified store-customer link and support keeps private/internal
messages at the Gateway. Checkout forwards the canonical signed cart capability
and validated step, with same-origin and safe-output checks. Merchant listing
resubmission resolves the owned store and delegates the existing review RPC path
through the Gateway. None writes a database, verifies a payment-provider
signature or issues an identity token locally. This is classification of the
candidate, not provider, hosted or release acceptance.

The former storefront order lookup trio remains on disk as explicit 410
responses in this candidate:

- `apps/commerce/web/src/app/api/orders/check/route.ts`
- `apps/commerce/web/src/app/api/orders/login/route.ts`
- `apps/commerce/web/src/app/api/orders/set-password/route.ts`

The obsolete `order-service` import exception is removed. Every app API route
must now avoid it; supported private order reads use the canonical buyer
transport. No hosted retirement was performed by this reconciliation.

The runtime ownership scan excludes explicit `.test`/`.spec` files, whose
negative response-leakage fixtures deliberately mention forbidden fields.
Handlers and support modules stay scanned. A planted runtime credential field
still makes the actual validator fail, and an otherwise identical test fixture
does not become an app-local credential owner. The auto-create assertion now
follows its route-to-handler delegation and retains the persisted, site-scoped
order-contact checks.


15 October2026 N1.6 money extension:the same dynamic proxy now validates the shared money-review intent and forwards it to the existing Gateway approval owner. Execution re-reads the retained approved intent and calls the canonical money-resolution endpoint. The app owns no financial mutation, permission policy or approval evidence. The route count stays214. Money review leaves mismatches open, and projection outages are displayed as unavailable; the actual Gateway/database owns the refresh/audit/receipt transaction.

N1.6 (2026-10-15): The existing `apps/internal/console/src/app/api/approvals/[operation]/route.ts` thin Gateway proxy now has six finite operations: request, request-money, request-trust, enforce-trust, decision and execute. Trust execution re-reads the canonical approval, forwards its bound case/reason/notes and never grants authority from form actor IDs. Strict same-origin and durable MFA checks precede every operation. Route inventory remains 214.


N1.7 (2026-10-15): adds `apps/platform/identity/src/app/api/buyer/privacy/[operation]/route.ts`, classified gateway-proxy before the broad buyer-auth rule. Its finite account/request/prepare/export/download operations forward the captured canonical buyer credential with fresh signed Identity app headers. Origin/CSRF and expected-account mismatch checks belong to transport. Password comparison, proof/attempt state, coherent restricted data, encryption, single-use release and mandatory audit stay in Gateway/PostgreSQL; this app neither mints another credential nor accesses a database. Exact-text forwarding uses the existing API client so downloaded JSON bytes are preserved. Route count215 and lint baseline name the same addition. Erasure/retention and provider/hosted acceptance remain separate.

### N1.3 operator issuer consolidation — 2026-10-16

`apps/platform/identity/src/app/api/operator/console/route.ts` is the private first-party operator authentication endpoint (`app-local-operator-auth`). Identity alone signs purpose/audience-bound asymmetric magic and session credentials and matches configured factors. Console routes are form/proxy adapters; no Console/Gateway human signing secret remains in that path. Gateway owns atomic one-use exchange, durable MFA counters/attempts and live session/permission checks; existing approved reset and independent super-admin policy are preserved. This does not activate deferred general OIDC discovery. Approved provider/inbox proof remains pending.


### N1.5 merchant loyalty settings — 2026-10-16

`apps/merchant/web/src/app/api/stores/[store]/loyalty/route.ts` is a thin `gateway-proxy`, increasing the reviewed inventory and matching lint baseline from216 to217. It resolves the signed-in merchant and store, refuses stale captured-account forms and cross-origin mutations, and forwards GET/PUT through the shared API client with the exact version and stable retry key. Gateway334 retains live ownership, point-value policy, concurrency, private aggregate reads, audit and atomic receipts. No local database access, balance, provider action or issuer is added. The shared merchant-origin guard now also backs the existing staff compatibility wrapper.


### N5 private reel review transport — 2026-10-18

`apps/merchant/web/src/app/api/stores/[store]/reels/route.ts` and `apps/merchant/web/src/app/api/stores/[store]/reels/[reelId]/route.ts` are thin `gateway-proxy` routes, taking the reviewed inventory and matching lint baseline from217 to219. They resolve the current signed-in merchant and owned store, reject stale captured-account forms and cross-origin mutations, bound the request bytes and forward the CMS-owned command through the shared SDK. Gateway345 owns live scope, canonical media/listing/variant resolution, immutable revisions, assigned reviewer/CAS checks and the atomic receipt/audit/outbox transaction. The app has no database writer, ready-receipt authority, public feed, upload, playback or provider action. Provider custody, actual inspection/rights policy and phase acceptance remain separate.

The main coordinator reviewed and granted these scoped registry edits on 18 October 2026 under N5-PERSIST-ROUTE-OWNERS. This records transport ownership review only; package, provider and release acceptance remain open.


### Private reel intake proxies — 2026-10-18 complete local integration

The three merchant routes under `stores/[store]/reels/uploads` (collection, `[intentId]`, and `[intentId]/content`) are reviewed `gateway-proxy` transports, increasing the inventory and lint baseline from 219 to 222. They resolve the current merchant and owned store, bind the captured actor, enforce mutation origin and stable request keys, bound metadata and streamed bytes, and forward through the shared API client. Gateway359 owns reservation, current authority, retry/version checks and custody receipts; the infrastructure adapter owns private provider bytes. The app does not issue credentials, write a database, grant readiness, expose a public object URL or perform live provider activation.

### 21 October 2026 merchant and Console support transport

Inventory and lint baseline advance together from 222 to 224 for exactly two
`gateway-proxy` routes: Merchant `api/v1/stores/[store]/support/[[...segments]]`
and Console `api/v1/support/[[...segments]]`. Both admit finite ticket, message
and recovery paths only. Merchant resolves its current owner/session and store;
Console requires its current MFA session. Both check same-origin mutations and
forward the original request key. Gateway owns live authorization, public/private
projection, validation and atomic support commands; existing canonical tables
and receipts hold the records. Neither proxy imports a database client, mints an
identity, sends notifications or performs a domain transition locally.

The owned browser exercises both normal sign-ins and the same ticket through
these boundaries. Database cases cover changed ownership, foreign stores,
read-only operators, private-note exclusion, duplicate/recovery behavior and
audit failure rollback. See `reports/MERCHANT_OPERATIONS_PRIORITIES_2026-10-21.md`
for exact results and remaining native/release limits.

### 22 October 2026 — Console billing record summary (225 routes)

`apps/internal/console/src/app/api/v1/billing/[siteId]/[invoiceId]/route.ts` is a `gateway-proxy`. It requires the existing real Console session/MFA, passes exact site/invoice IDs to the canonical billing investigation handler, and formats its authorized minimal response as an injection-safe CSV. The monolith owns scope, permission, query and mandatory audit. This is a record summary, not a second invoice/payment engine. The inventory ratchet and lint baseline each add this one reviewed route.

### 22 October 2026 — Merchant account inbox (227 routes)

Two `gateway-proxy` routes add the existing merchant-cookie inbox transport and MFA Console message-authoring transport: `apps/merchant/web/src/app/api/v1/inbox/[[...segments]]/route.ts` and `apps/internal/console/src/app/api/v1/merchant-messages/[[...segments]]/route.ts`. Both admit a finite path/method set and enforce same-origin mutations. Account ownership, admin authority, audience snapshots, publication, audit/receipts and read status remain in Gateway/PostgreSQL. No external channel is dispatched. The route inventory and lint baseline add these same two routes.

# P2-CUSTOMER-SESSION-RETIREMENT — refreshed scope and local transition gates

2026-10-03. Source inspection at `88b173dea8d3bb719b6bce992e56c3a2cfb2f277`, branch `letbuyy/phase2-shared-buyer-identity`. One agent. This work package belongs to the active eleven-phase mandate. Inventory/research are observed; transition acceptance remains open. No hosted cutover or legacy identity/data deletion is authorized by this record.

## Current source inventory

| Path | Observed behavior | Transition consequence |
| --- | --- | --- |
| Commerce `src/lib/session.ts` | Signs customer cookies through `createHostOnlyShopperIdentityProvider(...).issueSessionToken` with `CUSTOMER_SESSION_SECRET`; verifies the legacy cookie | Commerce is a signer; changing only the gateway leaves an issuer active |
| Commerce `app/api/customer/{login,register,set-password}/route.ts` | Gateway validates credentials and returns a customer profile; commerce calls its own `createSession` | Connect all three callers to canonical issuance |
| Gateway storefront registration and customer engagement routes | Registration, password-reset completion and login call `issueCustomerSession`; passwords live in `customer_credentials` and `store_customers` | Include every auth entry and credential compatibility path |
| Gateway `middleware/customer-session.ts` | Verifies two HS256 formats; store/customer IDs come from signed claims; this function does not resolve a storefront host | Supersedes the old host-resolution claim |
| Gateway `verifyStoreCustomer` and customer data routes | Compare verified IDs with request-selected IDs before scoped queries | Preserve checks. Host-only cookie delivery does not confine a compromised shared signing key to one store: forging both signed IDs defeats that claimed bound. This is source analysis, not an observed compromise |
| Identity `createIdentityIssuedStorefrontSessionToken` | Existing asymmetric storefront token: buyer realm, distinct audience, site, buyer ID, epoch and unique token ID | Reuse it; no additional issuer, runtime or password silo |
| Gateway `requireStorefrontBuyerSession` | Verifies asymmetric token, requested site, live buyer account/epoch; account-read error denies access | Reuse canonical verification/revocation; preserve distinct platform-buyer/storefront rules |
| Commerce `api/buyer-auth/{start,callback,session,logout}` and `lib/buyer-auth/flow.ts` | Existing PKCE/callback flow and separate host-only buyer cookie | Reuse the normal interface and callback allowlist with site binding/CSRF |
| `buyer_store_customers`, migration 255, `/buyer/link-store-customer` | Explicit verified-buyer/store relationship and conflict handling; historical orders use separate verified links | Never confuse buyer/store-customer IDs, silently merge by email, or grant historical orders from login |

The September F2.1 map is dated evidence, not a complete current inventory. Its host-resolution and one-store compromise-bound claims are superseded. The console's separate symmetric envelope remains open.

Additional consumer trace: the legacy cookie feeds twelve customer BFF route files, React customer-auth state, `account-liquid.ts`, `customer-drop.ts` and review submission. The Liquid account/drop helpers already compare `session.storeId` with the selected store; preserve those checks. `createSessionFromFederationToken` is exported from the commerce session library but has no call site in commerce source; distinguish that unused compatibility helper from a live login flow. Existing `identity-redteam.test.ts` IRT-3/W3(a) already demonstrates chosen store/customer claims can be signed when the customer secret is known; no newly observed compromise is implied.

One migration trap is explicit: legacy `/customer/orders` filters `orders.customer_email` after a store-customer check, while canonical `/buyer/orders` reads `buyer_order_links` for the verified buyer. A canonical storefront token must not be translated into the legacy email lookup and thereby bypass the separately required historical-order claim. Connect canonical storefront order access to the verified-link path with the token's site restriction. Registration/reset concurrency, email ownership and disabled-account behavior also need real-database checks before retaining any legacy compatibility path.

## Local acceptance and retirement

**First bounded implementation: storefront profile/address audience wiring.** Commerce `api/buyer/profile` and both address proxy files read the site-bound token from `__Host-lb_store_buyer` but forward it in `X-LetBuyy-Buyer-Session` to endpoints guarded by the platform-buyer-only `requireBuyerSession`. Identity's token route really issues `storefront_session` for the storefront client. A 3 October probe invoking the actual issuer and both actual verifier functions with a fresh synthetic in-memory key returned `storefrontVerifierAccepted: true` and `platformBuyerVerifierAccepted: false`, exit 0. No token/key, database or cloud access was emitted/used. This is function-boundary plus source-wiring proof; actual worker HTTP and browser reproduction must still be persisted before closure.

Repair only the shared buyer's own profile/address callers and explicit acceptance boundary. Keep platform-only order/claim/revocation routes strict; never make `requireBuyerSession` accept every storefront token as a blanket fix. Require the correct site-bound token header, authoritative host/site match, fresh account/epoch and current ownership for every address operation. Test valid platform and storefront access, wrong audience/header/site, two-buyer isolation, disabled/revoked accounts, account-read failure, malformed cookies and fresh retry authentication. The wider legacy signer retirement remains open afterward.

Constitution ART-05/ART-06 and canonical registry rows 3–6 already name identity-platform as issuer. Existing approved buyer/storefront contracts are the target. Local compatibility engineering proceeds; hosted activation, observation and irreversible retirement retain separate gates.

| Step | Required closure evidence | Status |
| --- | --- | --- |
| Full caller inventory | Every customer signer, cookie reader, BFF, federation/reset/profile consumer and customer route classified | STARTED; remaining consumers require tracing |
| Canonical sign-in | Existing buyer start/callback/session/logout and site-bound audience; no app/gateway replacement token minting | PARTIAL — normal account surfaces use the canonical flow; live browser/identity-provider journey remains unverified |
| Explicit merchant relationship | Correct store-customer ID from verified relationship; conflicts/disabled/unmapped cases denied; order links separate | PARTIAL — explicit same-origin PKCE linking now reaches the existing verified transaction locally; real database/browser evidence remains |
| Connect customer journeys | Profile, addresses, wishlist, loyalty, reviews and checkout association; real worker/database and normal UI prove two-store/two-buyer isolation and revocation | PARTIAL — profile, addresses, orders, store-customer linking, historical-order claim, and a linked store wishlist are connected locally; loyalty/reviews/checkout association, live browser sign-in, and full multi-store journey evidence remain |
| Compatible verifier transition | Separate rules per format; explicit legacy compatibility mode; no cross-realm downgrade | OPEN |
| Stop local legacy issuance | All active app/gateway customer signers retired with compatible auth/federation paths; negative controls detect reintroduction | OPEN |
| Drain and rollback | Every consumer/instance counted without raw tokens; approved observation window reaches zero legacy acceptance; verifier rollback rehearsed without restoring distributed signing | OPEN; no duration or hosted change inferred |
| Production readiness | Real KMS/verifier, callback/domain coverage, delivery, exact deployed candidate and owner release authorization | NOT VERIFIED / NOT DEPLOYED |

## Follow-on — explicit storefront buyer/store-customer linking (4 October 2026)

The storefront's existing site-bound buyer session can now call the existing verified buyer-to-store-customer link operation for its signed site. The gateway still permits the platform buyer audience under its existing cross-store contract; when the storefront audience is used, middleware checks the query site's signed claim and the route independently checks the body site against that same signed context. The account settings surfaces expose a deliberate POST action; the PKCE flow records this intent in the host-only flow cookie and accepts it only from a same-origin browser request. After code exchange, the callback rechecks host/site binding, invokes the existing link RPC with the storefront token, retains the new session even on link failure, and returns a fixed outcome code. Historical-order claim remains a distinct user-triggered operation.

| Local evidence | Result |
| --- | --- |
| Gateway buyer relationship and claim suite | 21/21 passed, including signed-site link/claim restrictions, platform audience compatibility, merchant/forged tokens, unverified email, and conflict privacy |
| Buyer storefront API proxy suite | 45/45 passed, including host-scoped historical claims, same-origin writes, sanitized outcomes and safe form redirects |
| Canonical Liquid order renderer | 5/5 passed, including rendered claim form/status and verified-order history privacy |
| PKCE/link flow tests | 5/5 passed, including same-origin start-route enforcement and a mocked callback through code exchange, host/site check, gateway link call, outcome redirect and session-cookie issue |
| Liquid/theme SSR/runtime contracts | 48/48 passed across hydration parity, renderer/runtime and storefront SSR contract suites |
| Targeted commerce web ESLint | Passed with zero errors; existing theme-token/color warnings remain |
| Diff whitespace check | Passed |
| TypeScript package checks | Commerce web passed with temporary workspace dependency links from the sibling checkout. Gateway check remains non-clean due unrelated workspace diagnostics (`@letbuyy/payments`/`@letbuyy/api-client` resolution and existing crypto `BufferSource`/CacheStorage types); no diagnostics point at the changed buyer account route. |
| Live browser/identity redirect | Not run; this remains a local contract proof, not an observed PKCE session or database journey |

The explicit link and historical-order claim use existing migration 255 transactions. Linking does not trigger the separate claim. The account UI can initiate each action; these local contracts do not assert a live database journey. This does not retire the legacy customer-session issuers or close Phase 2. The eleven-phase LetBuyy goal remains active.

## Follow-on — buyer wishlist through verified store relationship (4 October 2026)

The canonical buyer account can now read or mutate the store's existing wishlist only after an explicit verified buyer/store-customer link for that signed site. The API resolves customer ownership from the relationship rather than request data. Unlinked buyers receive a deliberate connect path; disabled/deleted linked store accounts receive a distinct unavailable state. See [buyer store wishlist acceptance](P2_BUYER_STORE_WISHLIST_ACCEPTANCE.md) for exact gateway, owned-Postgres, proxy, package and governance results and their limits. This completes the wishlist item in the local connected-journey list; loyalty, reviews and checkout association remain open, as do live browser verification and full multi-store evidence.

## Source refresh — canonical registration entry and current legacy issuers (4 October 2026)

The Liquid login and registration sections for both default fixtures now offer the existing first-party buyer PKCE flow. The registration page now says “Create or sign in with LetBuyy”; its per-store password form is retained as a transition bridge. [Canonical buyer registration entry acceptance](P2_CANONICAL_BUYER_REGISTRATION_ENTRY_ACCEPTANCE.md) records rendered-template and full theme-engine verification. This is a sign-in entrypoint, not proof of a completed browser identity flow or customer migration.

The current source has six HS256 *issuance callsites* across two cooperating runtimes: gateway `issueCustomerSession` in customer registration, password login and password-reset completion; commerce `createSession` in customer login, register and set-password completion. The commerce helper signs with `CUSTOMER_SESSION_SECRET`; it is not retired by moving only the gateway. The gateway middleware tries the 30-minute `{store_id, customer_id}` verifier, then the legacy seven-day `{sub, storeId, email, name}` verifier, both using `CUSTOMER_SESSION_SECRET`. This is source tracing; it is not a claim that six independent cryptographic keys or six deployments exist.

The commerce legacy session feeds the account Liquid/customer drop, customer profile, address, order, wishlist, session, review, and customer-auth UI paths. The gateway mounts legacy verification on customer wishlist, orders, activity, profile and addresses, and the storefront review resolver also calls the customer verifier. The normal buyer account already has separate site-bound profile/address/order/wishlist paths, but loyalty, reviews and checkout association remain open. The new registration CTA improves discovery of canonical sign-up; no issuer or verifier has been turned off.

Next transition work is to complete the route-by-route consumer matrix, adapt remaining store-scoped journeys through existing verified buyer/store links, and add observable, privacy-safe legacy-use evidence before proposing a bounded local dual-verifier transition. Preserve distinct buyer/store-customer IDs, signed-site checks, order claims and rollback behavior. Do not set a retirement window or infer hosted authority from this local work.

A service credential proves a service, not its claimed customer ID. Canonical issuance must follow verified buyer flow and live relationship checks. Browser, token, gateway, database and rollout evidence remain distinct.

Primary research checked 2026-10-03: [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), sections 3.1 and 3.8–3.12, supports JWT algorithm/issuer/subject/audience and distinct validation constraints. [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) supports authorization-code/PKCE and redirect constraints. Neither chooses business policy or certifies LetBuyy code.

D04 bootstrap/assignment/recovery authority, MFA enrollment, high-risk second approval and sender ownership remain unanswered. D05 export release, retention, deletion and legal-hold policy remain unanswered. Continue dependency-ready work; ask when a missing decision is necessary for the concrete implementation. No approval, customer inventory, credential, observation duration or cloud access is invented.

## 4 October continuation — privacy-safe legacy-session usage telemetry

The gateway verifier now records a `letbuyy.identity.store_customer_session.accepted`
Analytics Engine point whenever either accepted HS256 format authenticates a request.
The point contains only the format label (`gateway_hs256_v1` or
`shopper_hs256_legacy`), a bounded route class (orders, addresses, profile, wishlist,
engagement, GraphQL or other), environment labels, and a count of one. Its index is
constant across tenants. It does not include a token, email, customer ID, store ID,
subdomain, raw URL/path, request ID or trace ID. A telemetry write failure is best-effort
and cannot alter the authentication result.

| Check | Result |
|---|---|
| `node --import tsx --test services/api-gateway/src/__tests__/customer-session-telemetry.test.ts services/api-gateway/src/__tests__/customer-engagement.security.test.ts` | 5/5 pass; exercises both accepted token formats, identifier omission, and missing/throwing telemetry bindings |
| `pnpm --filter @letbuyy/api-gateway typecheck` | exit 0 |
| `git diff --check` | pass |

The gateway Wrangler source declares `RUNTIME_TELEMETRY` for staging and production;
this turn did not inspect live bindings or query a deployed dataset. No traffic counts,
drain observation, browser run or retirement window are claimed. This is local
instrumentation that makes future format/route usage measurable after authorized
deployment; it does not remove either HS256 issuer/verifier.

Next local work remains the route-by-route consumer inventory and adapting remaining
store-scoped journeys through the existing explicit buyer/store-customer relationship.
Use these aggregate measurements later to assess local dual-verifier retirement gates;
hosted observation and irreversible retirement retain separate authorization and
acceptance evidence.

## 4 October correction — authenticated checkout ownership implemented locally

The `/api/orders` route now forwards the canonical buyer token from its HttpOnly host-only cookie
only when the cookie's site wrapper matches the server-verified cart. The gateway verifies the
signature, storefront audience, signed site, active account and session epoch before checking
idempotency; the request body cannot select a buyer. A service-role-only transactional RPC wrapper
calls the existing `create_checkout_order` and writes one `authenticated_checkout` ownership link.
The wrapper rechecks account status/epoch under a row lock and will not attach a previous guest or
other-buyer's idempotent order. Guest checkout still uses the existing order RPC. See
[`P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md`](P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md).

Commerce and gateway typechecks pass; the gateway unit suite reports 1343 pass, zero fail and one
existing TODO; the commerce orders BFF suite passes 4/4. The owned-Postgres suite is authored but
could not start because no Docker daemon answers `docker info`; migration 267 has not been applied.
This is implemented local source, not database accepted or deployed. After the owned suite passes,
connect the normal account orders surface to these links and separately continue the legacy issuer
transition. Full Phase 2 and the eleven-phase goal remain open.

## 4 October update — authenticated checkout owned-database acceptance

The previous entry's owned-database blocker is resolved: Docker access was available through the
runner's permitted boundary. The real-worker suite now passes five scenarios, including guest versus
signed ownership, stable replay, wrong-site/revoked/disabled denial, forged body buyer selection,
revocation racing the transactional RPC, backend-only function grants, and rollback/reapply parity.
The complete gateway DB lane passes 119/119 across 19 suites. See
[`P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md`](P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md)
and its runner artifact. Migration 267 was exercised only on the disposable test database; no local
restored or hosted database was changed.

Correction to the earlier queued follow-on: the React and Liquid order surfaces already consume only
the signed-site `buyer_order_links` list/detail paths, as recorded in
`P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md`; the missing Phase 2 piece was the checkout writer. That
writer is now locally accepted. Next identity work is the route-by-route legacy issuer/consumer
matrix and reversible transition criteria. Aggregate gateway telemetry is source-instrumented but
has not been observed in a deployed dataset; do not disable legacy signers/verifiers or invent a
drain period. D04/D05 and hosted/live browser acceptance remain separate open dependencies. Phase 2
and the eleven-phase goal remain active.

## 3 October implementation checkpoint

The first audience connection is locally accepted at `26660485`; see [acceptance](P2_STOREFRONT_BUYER_DATA_ACCEPTANCE.md). Five real-worker database scenarios and 32 Next proxy tests now pass; exact source governance 114/114 passes. Browser navigation and whole legacy retirement remain open. Next active correction: atomic canonical default-address mutation, with red tests being added before changing the existing two-request writer.

Atomic default-address correction is locally accepted at `70baef80`; [evidence](P2_BUYER_ADDRESS_ATOMIC_ACCEPTANCE.md) records 18/18 database tests, rollback/reapply parity and exact governance 114/114. Next active work: normal account surface/caller inventory and canonical store-bound linked-order read; no normal commerce caller currently consumes the repaired buyer profile/address BFFs. Preserve Liquid and verified order ownership when connecting those surfaces.

Canonical storefront order listing and complete cursor pagination are locally accepted at `dfa1e83f`; [evidence](P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md) records eight real-worker/helper regression passes, 36 proxy tests and exact governance 114/114. Normal account integration remains active: order detail/hydration and verified merchant relationships must be connected before replacing legacy assumptions in the existing Liquid/React surfaces.

## 4 October correction — hosted checkout buyer ownership

The later hosted-checkout work described in [hosted checkout acceptance](P2_HOSTED_CHECKOUT_ACCEPTANCE.md)
supersedes this historical checkout gap: the storefront same-origin BFF passes the HttpOnly buyer
session to the gateway server-to-server; the gateway verifies site and live session authority, binds
the hosted checkout session, and the COD order transaction records buyer ownership atomically. No
bearer is included in the checkout URL. Guest COD remains supported. Migration 268 binding,
active-session rollback refusal and terminal rollback/reapply passed in the focused real-worker
owned-Postgres suite, 4/4, with fixture cleanup verified. See the
[sanitized database run](P2_HOSTED_CHECKOUT_BUYER_DATABASE_RUN.json).

This does not verify browser PKCE, a deployed cross-origin flow, provider-order creation or payment,
online-payment recovery, hosted coupons, production migration, or launch. The broad legacy
issuer/consumer matrix, deployed telemetry observation, staff/operator and privacy requirements
remain. Phase 2 and the eleven-phase goal stay open.

## 4 October continuation — legacy account connection entry

The normal legacy store-customer Account Settings page now exposes the existing explicit
`link_store_customer` PKCE flow. It returns to the current settings path, where the canonical buyer
account can show the existing link outcome. The copy states that the buyer must use the same
verified email and that this connection does not claim historical orders. This closes the missing
entrypoint for a customer who starts only with a legacy store session; it does not authenticate the
legacy account through the buyer identity system, change either HS256 issuer/verifier, or prove a
browser/identity/database journey.

| Check | Result |
|---|---|
| `pnpm --filter @letbuyy/customer-web typecheck` | exit 0 |
| `node --conditions react-server --import tsx --test src/app/api/buyer-auth/start.test.ts src/app/api/buyer-auth/callback.test.ts` from `apps/commerce/web` | 2/2 pass: explicit same-origin link start and callback host/site/link contract |
| Targeted ESLint on `settings-client.tsx` | exit 0; 47 existing design-token warnings in this file, no errors |
| `git diff --check` | pass |

The remaining transition work is still the route-by-route legacy consumer matrix and locally
reversible transition criteria. After entrypoint work, test canonical buyer linkage and the legacy
customer route behavior in owned database/browser journeys, including same-email mismatch,
unverified email, existing conflicting link, wrong store, inactive customer and separate historical
order claim. Observe deployed aggregate telemetry before proposing any legacy verifier drain; no
hosted usage counts or retirement period are available from this source change.

## 4 October source refresh — issuer and consumer matrix

This map is from the current checkout source, not the earlier count alone. There are two HS256
payload formats using `CUSTOMER_SESSION_SECRET`, both setting the same customer-session cookie:

| Issuer | Current source path | Token shape / TTL | Current use |
|---|---|---|---|
| Storefront gateway registration | `routes/storefront/customer-registration.ts` (`/storefront/customer/register`) | `{store_id, customer_id}`; 30 minutes | Sets HttpOnly customer cookie and CSRF cookie after password registration |
| Storefront gateway password login | `routes/storefront/customer-engagement-routes.ts` (`/storefront/customer/login`) | `{store_id, customer_id}`; 30 minutes | Sets HttpOnly customer cookie and CSRF cookie |
| Storefront gateway password reset completion | same route module (`/storefront/customer/password/confirm-reset`) | `{store_id, customer_id}`; 30 minutes | Consumes reset credential, then sets customer and CSRF cookies |
| Commerce login, registration, set-password completion | `apps/commerce/web/src/lib/session.ts`, called from `/api/customer/login`, `/register`, and `/set-password` | `{sub, storeId, email, name}`; seven-day default | `createHostOnlyShopperIdentityProvider` issues a host-only cookie; despite its provider name this remains the legacy HS256 verifier format |

The gateway verifier tries the short `{store_id,customer_id}` form first and then the commerce
`{sub,storeId,...}` form. It accepts both with the same secret. Its aggregate accepted-format metric
is best-effort and source-only until deployed telemetry is observed. Rotation or signer retirement
cannot be inferred from local instrumentation.

| Consumer surface | Current signed-session dependency | Transition state / invariant |
|---|---|---|
| Gateway wishlist, orders, activity, profile, addresses | `routes/storefront.ts` mounts `requireCustomerSession`; commerce API client forwards the host-only cookie as `X-LetBuyy-Customer-Session` | Still legacy. Store and customer must be checked per route. Gateway middleware authenticates signature/expiry only; it is not a live account or relationship check by itself. |
| Storefront GraphQL `customer` and `order` fields | `graphql/storefront.ts` calls `verifyGatewayCustomerSession`, then delegates order reads using signed store/customer context | Still legacy and uses the same dual-format verifier. Keep query variables/body from selecting another customer. |
| Storefront product reviews | optional customer middleware on `/reviews`; handler validates the signed store and active `store_customers` row before attaching verified identity | Legacy session remains accepted; the buyer review BFF is the canonical path. Existing negative/positive evidence is in `P2_BUYER_REVIEWS_ACCEPTANCE.md`. |
| Liquid customer/account drop and legacy customer React context | `customer-drop.ts` and `customer-auth-context.tsx`; account drop requires signed session store match and uses its email for store-specific profile/order hydration | Transitional store-customer experience; cannot be replaced by a buyer ID without an explicit verified relationship. |
| Legacy commerce BFFs for wishlist/profile/addresses/orders | `/api/customer/{wishlist,profile,addresses,orders}` read the legacy cookie via `getSession`/`requireSession`, then call corresponding gateway customer routes | Still legacy. Normal account surfaces now have canonical buyer alternatives in matching `buyer-*` routes; legacy fallback preserves unlinked store customers. |
| Buyer profile, address, order, wishlist, loyalty, and review APIs | `/api/buyer/*`, `buyer-*` gateway routes, signed site-bound buyer session | Canonical buyer path, separate token, issuer, audience and authorization. Do not feed buyer tokens into the HS256 verifier or treat a buyer as a store customer without a verified relationship. |
| Hosted checkout buyer handoff | same-origin `/api/checkout-handoff` reads canonical buyer cookie and forwards server-to-server; gateway binds checkout session | Canonical buyer identity is now locally bound for COD order ownership. It does not depend on the legacy customer cookie. |

The live gap is no longer a raw callsite count. It is the set of transitional store-customer
consumers above plus the three gateway and three commerce issuance entrypoints. Next implementation
must inventory the exact route and user journey per remaining consumer, determine whether the action
has a safe canonical buyer equivalent or must remain a store-customer feature, and test linked,
unlinked, wrong-store, inactive-customer, revoked-session and guest behavior before switching that
consumer. Do not disable either issuer or verifier until deployed aggregate evidence, a bounded
rollback plan, and a product decision for still-unlinked store customers exist. No issuer or
consumer was changed in this source-mapping update.

## 4 October correction — canonical reviews connected

The legacy review consumer now has a canonical BFF route backed by the signed storefront buyer
session and explicit verified buyer/store-customer link. The transitional review route's badge is
database-derived from the signed per-store customer session; its request `is_verified` field is
ignored. [Buyer reviews acceptance](P2_BUYER_REVIEWS_ACCEPTANCE.md) records the owned-database,
proxy, route and typecheck results. Reviews may be removed from the current canonical consumer gap
list. Legacy issuance and verification still accept existing account journeys, and no hosted
telemetry, rollout or retirement is claimed. Loyalty, checkout association and live browser evidence
remain open; do not close the wider transition on this route-level result.

## 4 October correction — canonical rewards connected and checkout gap confirmed

The canonical rewards account consumer is now locally connected and accepted in [buyer rewards acceptance](P2_BUYER_LOYALTY_ACCEPTANCE.md). The earlier source inventory/table remains historical. The next concrete buyer journey is authenticated checkout ownership: `/api/orders` currently forwards only checkout contact/order fields; the gateway route has no canonical storefront-session handling; the order adapter does not pass the checkout RPC's optional buyer identity; and migration 255 reserves `authenticated_checkout` for this missing signed-session writer. Preserve guest checkout, derive buyer/site solely from the verified session, create the explicit ownership edge atomically with the checkout order, and prove replay and isolation in the owned Postgres worker lane. This is a Phase 2 integration gap, separate from the later Phase 8 payment-provider programme.

## 4 October correction — canonical rewards connected

The account now reads this store's balance and recent points activity from the append-only ledger through the canonical signed buyer session. [Buyer rewards acceptance](P2_BUYER_LOYALTY_ACCEPTANCE.md) records route, proxy, rendered navigation, package checks and real-worker owned-Postgres evidence. Loyalty may be removed from the local canonical account-consumer gap list.

Source trace for the next checkout work corrected on 4 October: the checkout-origin page verifies a cart-bound signed handoff, but its shared `CheckoutClient` still creates orders through `/api/orders`, which does not carry or revalidate that handoff and does not call the gateway's signed checkout-session state machine. The current normal checkout therefore bypasses the intended canonical finalization route. That route must be repaired together with buyer-session continuity across the hosted origin; order ownership must be created atomically and idempotently. Migration 255 reserves `authenticated_checkout` for this writer. Guest checkout, provider verification, failed-payment recovery, and buyer/store isolation require positive and negative owned-worker/Postgres journeys before this gap can close. Do not claim checkout merely because the page rendered after verifying its initial link.

## 4 October correction — canonical wishlist identity precedence

Tracing the successful account-link callback showed that both the canonical buyer cookie and the
legacy store-customer cookie remain present. `WishlistProvider` previously selected the legacy
session first whenever both existed, so a linked browser continued reading and writing its legacy
wishlist after explicit connection. The provider now chooses the signed canonical buyer session
first. It uses the legacy store-customer path only when no buyer session exists. When both sessions
exist but the explicit store relationship is absent, the page shows the connect state and does not
fall back to the unrelated legacy list; writes remain blocked until the buyer/store link is
confirmed. This preserves guest and legacy-only behavior and prevents the dual-cookie state from
silently selecting a different principal.

| Check | Result |
|---|---|
| Customer-web typecheck | Exit 0 |
| `wishlist-identity.test.ts` plus `buyer-proxy-routes.test.ts` | 64/64 passed, including buyer-over-legacy precedence and buyer wishlist link projection |
| Gateway `buyer-store-link.test.ts` | 21/21 passed, including verified session ownership, same-site scope, unverified email, conflict and separate order-claim guards |
| Targeted ESLint on changed wishlist files | Exit 0; 9 existing design-token warnings in `wishlist-client.tsx`, no errors |
| `git diff --check` | Pass |

The existing wishlist owned-Postgres acceptance remains the database evidence for link-bound reads
and writes; this source change did not rerun it or change the database. No live browser or deployed
identity round trip was performed. The next F2.1 work remains the rest of the consumer matrix and
the reversible, evidence-gated HS256 retirement plan; neither signer nor verifier has been disabled.

## 4 October correction — account menu reflects canonical session

The React account bottom sheet could display the legacy store-customer name while account surfaces
used the canonical buyer session. Its single “Sign Out” action also cleared only the legacy cookie,
leaving the buyer session active. When both sessions exist, the menu now displays the canonical
buyer email and labels the two session-specific sign-out actions separately. Signing out of one
realm leaves the other session explicitly visible and independently controllable; no privilege or
session revocation is implied across realms.

| Check | Result |
|---|---|
| Customer-web typecheck | Exit 0 |
| Wishlist identity + buyer proxy regression | 64/64 passed |
| Gateway buyer/store link and historical-order claim guards | 21/21 passed |
| Targeted ESLint on account and wishlist surfaces | Exit 0; 63 existing design-token warnings in the account bottom sheet, no errors |
| `git diff --check` | Pass |

These are local source and contract results. No interactive browser test of simultaneous cookies,
provider redirect, or logout was performed. F2.1 still needs the remaining customer-session
consumer inventory, real browser/database journeys for account linking, deployed aggregate telemetry,
and a reversible verifier retirement plan; hosted signers and verifiers remain active.

## 4 October correction — canonical buyer review form

The storefront product-review form now checks the same host-bound buyer session used by the
existing canonical review endpoint. It no longer asks canonical buyers to enter a guest name, shows
the signed-in buyer email, and, when the server returns `STORE_ACCOUNT_NOT_LINKED`, directs the
buyer to that store's Account Settings link flow. A buyer session continues to take precedence on
the server; legacy-only customers retain the existing per-store review path. An unavailable buyer
session check fails back to the legacy/guest form presentation without changing server authority.

| Check | Result |
|---|---|
| Customer-web typecheck | Exit 0 |
| Buyer proxy + wishlist identity suite | 64/64 passed, including canonical review BFF positive and unlinked denial behavior |
| Gateway buyer review route suite | 4/4 passed, including verified site/link, inactive account, Turnstile and wrong-site denial |
| Targeted ESLint on `product-reviews.tsx` | Exit 0; 36 existing design-system warnings, no errors |

No browser interaction, hosted callback or additional owned-Postgres journey was run for this form
presentation change. Existing buyer-review database acceptance still covers the gateway ownership
and persistence path. Live identity/DB acceptance and the rest of the F2.1 issuer-consumer retirement
work remain open.

## 4 October correction — settings logout is realm-explicit

The buyer settings view now labels canonical buyer sign-out separately from per-store customer
sign-out and exposes the latter only when that legacy session is active. The shared legacy logout
action now clears client authentication only after `/api/customer/logout` returns success; network
or non-2xx failures remain visible to the caller and do not falsely present a successful sign-out.
The account bottom sheet reports that failure instead of changing to its signed-out state. The two
cookies remain independent: clearing one never claims to revoke the other realm's session.

| Check | Result |
|---|---|
| Customer-web typecheck | Exit 0 |
| `customer-auth-context.test.ts` | 2/2 passed for successful POST and non-2xx failure handling |
| Buyer proxy regression | 61/61 passed |
| Targeted ESLint on settings/account session UI | Exit 0; 110 existing design-system warnings across the selected files, no errors |
| `git diff --check` | Pass |

This is local transport/UI contract evidence; no browser session or production cookie test was run.

## 4 October correction — gateway HS256 issuance counters

The gateway's three successful per-store session minting paths now emit a separate aggregate
`letbuyy.identity.store_customer_session.issued` point after token creation succeeds: registration,
password login and password-reset completion. The bounded fields are the fixed format
`gateway_hs256_v1` and one of those three operation classes. The point contains no token, buyer,
store, email, or request-path value. Missing or failing telemetry remains best-effort and cannot
change the authentication response. The existing accepted-session counter remains unchanged.

This gives a future authorized deployment a way to distinguish ongoing gateway issuance from
remaining accepted-token use. It does **not** count Commerce's local re-signing in
`apps/commerce/web/src/lib/session.ts`, storefront theme credentials, or other runtimes, and it is
not evidence that any hosted telemetry has been observed. It does not authorize disabling either
signer or verifier; the canonical buyer migration and route-by-route consumer evidence remain the
retirement gates.

| Check | Result |
|---|---|
| API gateway typecheck | Exit 0 |
| `node --import tsx --test services/api-gateway/src/__tests__/customer-session-telemetry.test.ts` | 4/4 passed: accepted-format aggregation, telemetry failure isolation, and fixed-operation issuance aggregation/failure isolation |
| Targeted ESLint | Not available for this workspace: no gateway ESLint config; direct invocation exits 2 before linting |
| `git diff --check` | Pass |

No DB, browser, cloud, deployed telemetry, or provider test was performed. Next F2.1 task: finish
the active caller/issuer matrix across Commerce and Liquid, instrument only runtimes with an approved
telemetry binding, then use a human-authorized deployment and observation window to decide whether
the reversible legacy-verifier retirement gate can pass.

## 4 October correction — per-store account creation retired

The product decision in Constitution Amendment 3 makes `buyer_accounts` the one buyer principal;
per-store customer rows are relationships, not separate sign-in accounts. The remaining storefront
registration UI contradicted that decision by creating `customer_credentials` and minting an HS256
store-customer session. New registration now enters the existing identity-platform PKCE flow from
Liquid templates and the React account sheet. Return navigation goes to the current store account.
The identity-platform-issued buyer session is then read by the existing buyer account surfaces.

The stale Commerce `/api/customer/register` endpoint redirects old HTML form posts into that PKCE
flow and returns `410 CANONICAL_BUYER_ACCOUNT_REQUIRED` for JSON callers. The gateway's direct
`/storefront/customer/register` endpoint also returns 410 without reading or writing account data;
the TypeScript API client no longer exposes a callable registration method. Existing per-store
password sign-in remains available solely for customers who need to reach Account Settings and
link a store relationship using the verified buyer email. No customer login or password-reset
issuer/verifier was disabled, and existing customer credentials/sessions were not migrated.

This supersedes the earlier source count above: gateway registration and Commerce registration
were two of the six legacy issuance callsites, and both are now removed. Four remain: gateway
password login/reset completion and Commerce password login/set-password completion. The issued
telemetry counter now covers only the two gateway paths that still mint; it never covers Commerce's
local signer. Existing per-store credentials and active sessions are unchanged.

| Check | Result |
|---|---|
| API gateway, Commerce web, theme-engine and shared API-client typechecks | Exit 0 |
| Gateway registration transition + session telemetry tests | 5/5 passed |
| Commerce registration, PKCE start and callback tests | 4/4 passed; confirmed canonical redirect, current-store return path, host check, verified link and explicit same-origin link start |
| Theme auth and generated example tests | 22/22 passed across canonical registration, retained legacy login, sanitized rendering and both generated bundles/manifests |
| Customer auth logout regression | 2/2 passed |
| Targeted Commerce ESLint | Exit 0; 0 errors, 75 existing design-token warnings across selected files |
| `git diff --check` | Pass |

These are local source and rendered-template/API contract results. No interactive browser login,
identity provider, database, deployment or hosted telemetry journey was run. This stops issuance of
new per-store login credentials through the storefront registration path; it does not retire legacy
login for existing customers or establish that all other HS256 consumers have migrated. Continue
with the full Commerce/Liquid session-consumer matrix, then prove the canonical login/link/order and
logout journeys against the running local worker and owned database before defining verifier
retirement evidence.

## 4 October verification follow-up — registration perimeter

Added an acceptance case to the existing owned-database suite for the real Gateway worker's
`POST /v1/storefront/customer/register` mount. It asserts the retirement response, sanitized body,
no PostgREST requests to either legacy customer table, and no matching rows in either table. The
isolated registration route test passed, and the API Gateway TypeScript check passed. The
owned-database suite was not executed: the prescribed runner stopped before test discovery because
no real Docker daemon is available in this environment. Therefore this new worker/database case is
pending execution; its assertions are not reported as passing. `git diff --check` passed.

No local browser or identity-provider flow, owned database mutation, hosted test, deployment or
legacy-session retirement was performed in this follow-up.

## 4 October correction — public customer-account enumeration retired

The current Commerce source exposed `GET /api/customer/check?email=...&storeId=...` without a
buyer or customer session. The BFF forwarded those caller-selected values using its server-side
storefront credential to `GET /storefront/customer/status`, which returned whether the address had
a store-customer row, an active password credential and the row status. The account sheet used that
result to choose its next screen. This was a confirmed source-level unauthenticated account-state
disclosure; no live hosted exploit or database query was performed.

The account sheet now offers canonical LetBuyy sign-in directly and lets a customer explicitly
choose the transitional store-only password flow. It no longer queries account existence. The
Commerce compatibility route returns `410` with `Cache-Control: no-store` and no account fields;
the Gateway status route, API-client method/type, and dead Commerce helper have been removed. The
older password-login path remains available for customers who need to establish the verified store
relationship, while new and shared buyer sign-in continues through the existing PKCE flow.

| Check | Result |
|---|---|
| Commerce check/register/logout unit group | 5/5 passed; includes the 410/no-store/no-account-fields contract |
| Gateway customer engagement security group | 7/7 passed through `node --import tsx`; includes unsigned denial, invalid-input denial, matching-order CRM creation from persisted contact fields, wrong-store denial, removed status and generic find-or-create routes, and existing session controls |
| Root customer-session security contracts (`customer-session-gateway` + `storefront-customer-engagement-routes`) | 12/12 passed; removed status path is absent from route/client inventories |
| Root Liquid storefront contract file | 17/17 passed; includes the account-sheet no-enumeration and canonical/legacy-choice contract |
| Commerce and API-client TypeScript checks | Passed |
| Gateway TypeScript check | Passed |
| Commerce post-checkout auto-create proxy test | 2/2 passed; trims only order/store identifiers and drops attacker-supplied contact fields |
| Gateway customer engagement route test | 7/7 passed with mocked PostgREST responses through the Hono route harness; production route mount and live database remain unverified |
| `git diff --check` | Passed |

The evidence proves local route/component contracts and the mounted Gateway route's absence in its
route harness, not a deployed response or abuse-rate measurement. The post-checkout customer
bootstrap is now order-bound: the browser sends an order ID and store scope, and the signed Gateway
route reads the persisted order with both predicates before using its stored contact fields. It
does not accept browser-supplied email, name or phone, and returns no customer PII. Focused source
contracts cover this boundary. The TSX CLI cannot create its Unix-domain IPC socket in the sandbox;
Node's built-in runner with the `tsx` import hook successfully executes both storefront and
Gateway route tests. No live database, deployment or hosted telemetry was observed. Continue the issuer/consumer matrix and
define reversible verifier rollout gates. No legacy signer was disabled.

## 4 October route-by-route consumer refresh — customer identity surface

| Active surface | Current identity behavior | Transition classification |
|---|---|---|
| `/api/customer/login` → Gateway password login | Existing store-only credentials; Commerce signs the seven-day legacy HS256 cookie after Gateway returns the customer profile | Transitional issuer; retain only as an explicit bridge for existing customers to connect a verified buyer account |
| `/api/customer/set-password` → Gateway reset confirmation | One-time reset token is checked by Gateway; Commerce then signs the same legacy cookie | Transitional issuer; reset-token acceptance remains independent of buyer identity |
| `/api/customer/register` → PKCE compatibility | HTML requests redirect to buyer PKCE; JSON returns 410; Gateway registration is 410 | New per-store registration retired |
| `/api/customer/logout` and `/api/customer/session` | Clear or verify only the legacy customer cookie | Store-customer-only session controls; they do not revoke the buyer session |
| `/api/customer/{addresses,orders,profile,wishlist}` and `/wishlist/sync` | Require the legacy cookie and forward it through internal-signed Gateway calls | Legacy-only BFFs; normal shared-buyer journeys use the corresponding site-bound buyer APIs where implemented |
| Gateway `/customer/by-email` → Commerce `customer-drop.ts` | Internal-signed read follows `getSession()` and requires the token's `storeId` to equal the resolved storefront before using its email | Legacy Liquid customer profile hydration; keep session/site checks and do not expose this lookup as a public email probe |
| `/api/customer/check` → Gateway `/customer/status` | Was an unauthenticated public email/store existence/password-state proxy | Retired in this correction; route returns 410 without data and the Gateway/API-client surface is removed |
| `/api/customer/auto-create` → Gateway `/customer/from-order` | Guest checkout sends order ID and store scope; Gateway requires its internal signature, reads the order under both tenant and order predicates, and derives CRM contact fields from that record | No client-controlled contact fields or customer PII response; generic find-or-create endpoint removed. Source contracts pass; hosted abuse-rate behavior remains unobserved |
| `/api/customer/{login,register,set-password}` plus Gateway registration/login/reset | Current source has two remaining Gateway and two Commerce HS256 issuance sites; registration in both layers is already retired | Legacy issuance remains for existing store-only password login/reset, pending a product-compatible replacement and observed transition gate |
| Liquid `customer` drop, React `CustomerAuthProvider`, GraphQL customer/order fields | Store/customer IDs stay in the legacy realm; GraphQL and scoped readers validate the signed session | Transitional store relationship; never convert an unlinked email match into buyer order ownership |

This matrix is a source trace at the current Phase 2 worktree, not a live browser or traffic census.
The outstanding issuer transition still requires deployed aggregate use observations, explicit
handling for customers who have not linked, and a reversible verifier plan. The auto-create source
path is now constrained to a matching persisted order and store; runtime database behavior still
requires the owned Gateway DB lane, and hosted abuse rates require an authorized hosted observation.

## 4 October correction — legacy session snapshot is not cacheable

The same consumer census found that `GET /api/customer/session` returns a signed-in store
customer's identifier, email and name but did not set a response cache directive. The route now
sets `Cache-Control: no-store` for authenticated, signed-out and verifier-failure responses. The
new route tests pass 3/3, the Commerce typecheck passes, and `git diff --check` passes. This is local
response behavior only; browser/CDN cache behavior was not exercised. It does not change the
legacy-login compatibility policy or the outstanding issuer-retirement gates.

## 4 October correction — logout CSRF is scoped to the exact storefront origin

`POST /api/customer/logout` previously allowed any origin under the configured storefront root.
An attacker-controlled sibling storefront could submit a same-site form to another store and clear
that store's host-only legacy session. The check now requires exact scheme-and-host equality against
the forwarded request authority; sibling stores, the identity-platform origin, and scheme changes
are denied. Same-origin older clients without an `Origin` header retain the existing compatibility
path. Logout origin and route tests pass 7/7, the combined logout/session checks pass 10/10, the Commerce
typecheck passes, and `git diff --check` passes. No browser CSRF attempt or hosted cookie behavior
was exercised. Buyer-session logout and legacy-password issuer retirement remain separate work.

## 4 October correction — canonical buyer addresses in storefront checkout

Normal storefront checkout previously requested saved addresses only from the legacy per-store
customer endpoint. It now verifies `/api/buyer-auth/session` first, selects `/api/buyer/addresses`
for a signed-in canonical buyer, and uses `/api/customer/addresses` only for verified signed-out
buyer state. A failed verification or address request is surfaced, allows manual entry, and never
downgrades into the other realm. The separate checkout origin still does not fetch addresses: it
cannot read the storefront's host-bound session and the signed cart URL does not carry address PII.
The four focused loader tests, Commerce typecheck and `git diff --check` pass; see
[checkout buyer-address acceptance](P2_CHECKOUT_BUYER_ADDRESS_ACCEPTANCE.md). No live browser or
hosted identity flow was exercised.

## 4 October correction — buyer logout exact-origin guard

The buyer mutation guard previously treated a same-host `Origin` as same-origin even when its
scheme differed from the active request. It now compares the serialized origin with the framework
request's exact scheme, host and port, while rejecting Fetch Metadata marked cross-site or
same-site. This protects buyer link-flow creation, logout and mutating buyer-data BFFs. Buyer logout
returns `no-store` on denial, JSON success and redirect, and does not clear its cookie on denial.
The focused flow/link/logout tests pass 7/7; Commerce typecheck and `git diff --check` pass. See
[buyer logout CSRF acceptance](P2_BUYER_LOGOUT_CSRF_ACCEPTANCE.md). No browser or hosted probe was run.

## 4 October correction — legacy reset destination and session tenant binding

The Gateway previously accepted an arbitrary caller-provided `reset_url`, then embedded the
one-time token in that destination. It now accepts the URL only when the requested host resolves
to the same store as the reset target; otherwise it uses the configured fallback. Commerce now
checks that a legacy session's signed store ID matches the host-resolved store at issuance and every
session read, failing closed on mismatch or resolver failure. Four URL-policy tests and 13 Commerce
focused session/origin/checkout tests pass; Commerce and Gateway typechecks pass. The wider Gateway
route suite could not start because the sandbox denied TSX's Unix socket. No reset email, browser
cookie or hosted session was exercised. See
[legacy customer scope acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October correction — reset initiation now has a working storefront journey

The inventory above identified `/api/customer/set-password` as a remaining legacy issuer but did
not establish that its customer-facing change-password form could reach reset confirmation. Source
inspection found the settings form submitted no email, store ID or reset token, and no storefront
reset page existed. The form now requests a store-scoped email link; the new reset page verifies its
store marker against the route-resolved tenant and completes through the host-bound BFF. The reset
completion still issues a transitional store-customer session, so it does not retire the legacy
issuer or substitute for a canonical-buyer link. See the focused correction and limits in
[`P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md`](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October continuation — clear legacy cookie after confirmed buyer/store link

On a successful explicit PKCE buyer/store link, the Commerce callback now expires the current
browser's `lb_customer_session` cookie after the Gateway confirms the relationship. A conflict
keeps the legacy cookie, as do ordinary buyer sign-in and unsuccessful/unverified link outcomes.
The callback/start/logout tests pass 7/7, Commerce TypeScript and targeted callback lint pass, and
`git diff --check` passes. This only clears the cookie delivered by this browser: the HS256
credential is stateless and other unexpired copies remain accepted. No deployed usage observation,
cross-device revocation, provider/database link, or browser run is established. Continue with the
remaining legacy-consumer matrix and identify any additional path whose canonical equivalent has
not yet been connected.

## 4 October correction — connect legacy customers from the sign-in entry

The verified store-customer linking POST was exposed from account settings only, so a legacy
customer without a current store session could not start the connection journey on the sign-in
page. The Liquid login template now offers a separate PKCE link action; callback still requires the
canonical verified buyer session, the signed current storefront, and the existing same-verified-
email relationship contract. Rendering exposed that the sanitizer strips `name="action"`, so the
form uses `intent`; the BFF accepts that field while retaining compatibility for existing `action`
callers. The rendered Liquid and generated-example tests pass 14/14, buyer-auth start/callback tests
3/3, SSR contracts 14/14, the full Theme Engine suite 1,874/1,874, both TypeScript checks, targeted
ESLint and `git diff --check`. No real
browser or provider/database link journey was exercised. See
[`P2_LEGACY_ACCOUNT_LINK_ENTRY_ACCEPTANCE.md`](P2_LEGACY_ACCOUNT_LINK_ENTRY_ACCEPTANCE.md).

## 4 October correction — active HS256 issuer count

The earlier “six issuance callsites” source note is stale: it counted registration paths that the
current tree has since retired. Current source has four active request-path HS256 signing callsites:
Gateway password login and reset completion, plus Commerce BFF password login and reset completion.
The Commerce registration route is now a canonical-buyer redirect/410 compatibility handler, and
Gateway registration returns 410; neither issues a customer session. The exported
`createSessionFromFederationToken` Commerce helper has no source callsite and is dormant, not a
fifth active request path. Both Gateway verifier formats remain accepted, and no issuer or verifier
was disabled by this correction. Next identity work remains the route-by-route transition, with
direct LetBuyy linking now available from the Liquid sign-in page. The source count is not a
deployed inventory or observation result.

## 4 October correction — login tenant binding precedes password verification

The legacy Commerce login BFF used to send a caller-supplied `storeId` to Gateway before the later
host-scoped session signer rejected a customer record from a different store. The host resolver now
must match the submitted tenant before Gateway authentication runs. Focused login/session-scope
tests pass 5/5; Commerce typecheck, focused lint and `git diff --check` pass. This is local source
and controlled-fetch evidence, not a live storefront/Gateway test. See
[`P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md`](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October continuation — bounded password-reset host bootstrap and acceptance refresh

The first fresh full Gateway unit run exposed an unguarded service-role client inside the large
customer-engagement route module. Host-to-site lookup is a valid bounded bootstrap because the
tenant is unknown until the submitted destination host resolves; the resolver uses unique host
predicates and `.maybeSingle()`, and the resulting site ID is still compared with the reset
customer's store. The bootstrap now lives in the single-purpose
`services/api-gateway/src/lib/customer-reset-store-by-host.ts` helper, with its exact bounded
resolver represented in the unguarded-client allowlist. Reset destination policy and fallback
behavior did not change.

The same acceptance refresh found that the Commerce test command omitted seven owned tests and
placed three `server-only` customer route tests in its non-React-Server group. The package script
now lists every current app-owned test, and the server route tests run under the intended React
Server condition. The buyer-auth cookie cleanup after a verified store link now retains
`Secure=true` in every environment, matching the `__Host-` cookie invariant; the root buyer-auth
contract now supplies the request URL required by the current exact-origin guard and scans route
directories without treating sibling `.test.ts` files as route folders.

| Check | Result |
|---|---|
| Gateway owned database lane | 20 suites; 125/125 pass; 0 fail/cancel/skip/TODO; run `3139ceed5874`; disposable databases only |
| Gateway unit lane | 1,357 tests; 1,356 pass, 0 fail, 1 existing TODO (`LB-BIL-002`, subscription single-activation invariant) |
| Commerce workspace suite | 1,138 tests across its three scripted groups: 88 + 103 + 947 pass; 0 fail/skip/TODO |
| Root TypeScript contracts | `pnpm run test:contracts`: 322/322 pass |
| Type checks | API Gateway and customer-web typechecks pass |
| Workspace test inventory contract | 6/6 pass; confirms every app-owned test path is named and literal |
| Diff check | `git diff --check` passes for changed implementation/evidence |

The initially attempted raw Node contract invocation omitted the repository's TypeScript workspace
alias resolver and is excluded; the declared `pnpm run test:contracts` command is the accepted
result. A direct ESLint invocation could not find a root ESLint 9 flat config; no lint pass is
claimed. These are local source and disposable-database results, not a browser, identity-provider,
hosted telemetry, deployment or legacy-session retirement result. Keep the remaining unlinked
store-customer flows and deployed issuer-use observation in the open matrix above.

## 4 October continuation — load the legacy account profile before editing

The React store-customer settings page previously initialized phone to an empty string and
marketing consent to false, then submitted both with every name edit. Saving a name could
therefore erase an existing phone number and withdraw saved marketing consent. The Gateway now
serves a no-store profile read scoped to the signed customer-session's customer and store, and the
Commerce BFF exposes only the expected profile fields. Settings loads that source profile before
enabling edits; a failed read leaves saving disabled and offers a retry. The existing PATCH path
continues to accept partial updates and now marks responses no-store.

| Check | Result |
|---|---|
| Gateway owned-database lane | `pnpm --filter @letbuyy/api-gateway run test:db`; 21 suites, 127/127 pass, 0 fail/skip/TODO; disposable run `f84cb83fef05` |
| Gateway unit lane | `pnpm --filter @letbuyy/api-gateway run test:unit`; 1,358 tests, 1,357 pass, 0 fail, 1 existing TODO (`LB-BIL-002`) |
| Commerce workspace lane | `pnpm --filter @letbuyy/customer-web test`; 1,141 tests across the three scripted groups (88 + 106 + 947), all pass |
| Shared TypeScript contracts | `pnpm run test:contracts`; 322/322 pass |
| Typechecks | Gateway and customer-web typechecks pass |
| Change hygiene | `git diff --check` passes |

The new owned-database route test drives the real Gateway worker and disposable Postgres. It
verifies the active customer profile and rejects unsigned, unknown, disabled and cross-store
sessions. The BFF tests verify no-store responses, allowlisted fields and fail-closed session
behavior. This remains local implementation and owned-database evidence: the real browser,
external identity provider, hosted traffic/issuer observation, deployment and Phase 2 retirement
criteria remain unverified. Current checkout: `LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`, HEAD
`0862687a5008d604d0df23357b2eb511293139fa`. The pre-existing 189-entry working tree was preserved;
no unrelated changes were staged or reverted. Continue the Phase 2 route-by-route legacy-consumer
matrix and hosted issuer observation before any verifier retirement.

## 4 October correction — enforce active legacy customer state on account reads

The remaining legacy route matrix exposed a revocation gap. Gateway HS256 signature verification
does not consult account state, and the shared `getVerifiedStoreCustomer` lookup accepted any
matching row regardless of `status` or `deleted_at`. Before the fix, a still-valid signed cookie
continued to read wishlist data after the customer was disabled; the profile route also returned
soft-deleted active rows. Both defects were reproduced through the real worker in the isolated
owned-Postgres suite (run `edd3d625e1d1`, 2 existing cases passed and both new denial cases failed).

The shared legacy account resolver now requires the exact signed customer and store, `status =
'active'`, and `deleted_at IS NULL`. That resolver protects wishlist, address and order reads and
mutations; the direct profile read applies the same live-row predicates. Retesting through the real
worker proves active customers retain access to all three account surfaces, and the same cookie
loses access immediately after account disablement. Soft-deleted rows are denied from both profile
and wishlist.

| Check | Result |
|---|---|
| Owned-worker customer-session suite | `node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/storefront-customer-profile.postgres.test.ts`; 4/4 pass, 0 fail/skip/TODO; disposable run `3aff662db973` |
| Focused Gateway security tests | `node --import tsx --test services/api-gateway/src/__tests__/customer-engagement.security.test.ts`; 8/8 pass, including exact active and non-deleted profile predicates |
| API Gateway typecheck | `pnpm --filter @letbuyy/api-gateway run typecheck`; exit 0 |
| Diff check | `git diff --check`; pass |

This enforces current account disable/delete state at the legacy route boundary; it does not revoke
the signed HS256 token cryptographically, invalidate other session copies, or replace the canonical
buyer issuer. Continue tracing every legacy consumer, including GraphQL and optional review paths,
and keep telemetry/hosted drain gates open until observed after authorized deployment.

**Acceptance refresh (4 October):** the full Gateway unit lane is 1,358 tests (1,357 passed,
zero failed, one pre-existing `LB-BIL-002` TODO). The full disposable owned-Postgres lane passes
21 suites / 129 tests, with zero failures, skips or TODOs; run `ef67e13ee569`. This supersedes the
earlier 127-test baseline above. It includes the operator-mutation and support-queue suites, all
canonical buyer account suites, and the extended legacy-customer suite. No real database or hosted
environment was changed.

The next local identity item is the remaining direct consumer inventory, especially the legacy
Storefront GraphQL customer field and compatibility-only sessions. Order detail continues through
the active store-customer lookup; GraphQL's customer identity field still derives its ID from a
signed claim. Review's optional customer path has its own active/non-deleted lookup. Retain both
HS256 verifiers while checking these paths and their legitimate unlinked-customer use; hosted
aggregate telemetry, owner rollout authorization and a rollback plan remain prerequisites to any
retirement.

## 4 October continuation — live-check Storefront GraphQL customer identity

The GraphQL `customer` field was the remaining direct identity consumer found in the code path
review: it returned the customer and store IDs from a valid HS256 claim without checking whether
that store-customer row remained active. It now requires a same-ID/same-store database row with
`status = 'active'` and `deleted_at IS NULL`. Lookup failures return a generic account-unavailable
GraphQL error; the database diagnostic is not exposed. The `order` field continues through the
legacy orders route, which now shares the same live-row checks.

The real-worker owned-Postgres suite exercises the valid GraphQL customer result, disabled and
soft-deleted denial, and a fault-injected database lookup failure. It passes 5/5 (run
`d7a164aaed32`); Gateway unit tests pass 1,357 with the existing `LB-BIL-002` TODO, and the Gateway
typecheck passes. The complete owned-Postgres lane passed 129/129 before this GraphQL-only
extension (`ef67e13ee569`); the focused owned suite above is the fresh integration proof for the
new GraphQL branch.

This closes live account-state enforcement for the traced legacy profile, wishlist, address,
order, and GraphQL customer surfaces. The HS256 cookie remains cryptographically valid until its
expiry, and optional review verification remains handler-specific. Next: finish the compatibility
consumer/caller inventory (including any non-Commerce callers), then keep the local reversible
transition and hosted telemetry/rollback gates distinct from any signer retirement.

## 4 October continuation — atomic legacy password-reset redemption

The final reset-consumption race is now closed locally. The owned-worker test
first reproduced two successes from simultaneous confirmations against the
old split-write path (`0ac0c98ebf7e`). Migration 269 and its paired rollback
make password replacement and one-time credential consumption atomic; the
function is executable only by `service_role`, and deleted customers cannot
request a new token. The current focused real-worker suite passes 3/3, including
one-winner concurrency, fault-injected rollback/retry and privilege checks
(`e37d0b917b46`). The full disposable database lane passed 132/132 before the
new privilege assertion was added; Gateway unit tests passed 1,357 with the
existing one TODO, typecheck and migration validation passed, and root shared
contracts passed 322/322. Details are in [legacy customer scope
acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

The reset endpoint still issues the transitional HS256 customer session after
successful redemption. Real email/browser/provider delivery and hosted behavior
remain unverified, and this work does not authorize session-verifier retirement
or migration outside disposable test databases.

## 4 October continuation — source census and malformed cookie failure

The local source census confirms the legacy cookie is still consumed by Gateway's
required account routes, optional review identity and GraphQL customer/order fields;
Commerce's server-side session helper also validates storefront scope and forwards
the cookie to Gateway. Gateway accepts both its newer HS256 session and the
transitional Commerce shopper format. This establishes active local consumers, not
hosted usage counts, so both verifiers remain enabled.

The census found malformed percent-encoding in the customer cookie could throw from
`decodeURIComponent` and turn a missing/invalid credential into HTTP 500. Gateway
middleware regression first failed as expected (4 pass, 1 fail), then passed 5/5
with invalid-cookie denial and a valid explicit-session-header positive control.
Gateway typecheck and `git diff --check` passed. The corresponding owned-worker test
is present in the real profile route suite, but runner preflight could not find a
Docker daemon, so route/database verification remains pending. Keep the legacy
verifier and hosted cutover gate open.

## 4 October correction — LCIS identity posture source truth

The LCIS security posture had stale descriptions that treated the store-customer
HS256 compatibility sessions as an identity-platform-issued constitutional issuer,
and called step-up and queue-envelope HMAC signatures user-token issuers. The
operations report repeated a generated “two-issuer HS256 + ES256” finding from an
old security artifact. Current source and ART-05/R-14 instead establish
identity-platform as the canonical asymmetric session issuer for merchant, buyer,
and storefront realms, while Gateway and Commerce still contain a separate
store-customer HS256 bridge.

The LCIS posture descriptions now distinguish the canonical identity platform from
that transitional bridge, identify step-up and queue-envelope as signatures, and
cite current source/governance in the operations finding rather than asserting that
the stale generated artifact proves the architecture. This is an analytics/reporting
correction only: no issuer or verifier was removed, hosted key state is not asserted,
and the route-by-route compatibility census and hosted telemetry/drain/rollback gates
remain open.

| Check | Result |
|---|---|
| `node --import tsx --test packages/lcis-security/test/identity.test.ts` | 81/81 pass |
| Focused LCIS operations identity finding test | 1/1 pass |
| Full LCIS operations suite | 6 unrelated artifact-backed failures; this checkout lacks required `graphify-out` security/governance artifacts |
| LCIS package typechecks | Not clean: project-reference declaration outputs and `@types/node` are missing in this checkout; diagnostics include existing unrelated package/test errors |

Next: complete the remaining caller matrix against live source, then evaluate the
local reversible dual-verifier transition independently from any hosted rollout.

## 4 October continuation — repository caller census and key separation

A fresh production-source search found active issuance in Gateway registration,
password login and reset completion, plus Commerce's legacy login/register/set-password
helper. Gateway middleware accepts both HS256 payload formats. Commerce's account,
profile, address, order, wishlist and review paths forward or consume the host-only
cookie; Gateway's mounted customer routes, optional review identity and GraphQL
customer/order fields remain consumers. The scan found no active runtime
`CUSTOMER_SESSION_SECRET` issuer/verifier in marketplace, merchant, internal console,
mobile BFF, queue workers, webhook service, or published API clients. Dormant
identity-foundation shadow/mock references are not runtime consumers.

The census also found Gateway CSV-export download links falling back to
`CUSTOMER_SESSION_SECRET` when `INTERNAL_API_SECRET` was absent. Export download
signatures now fail closed unless the dedicated `INTERNAL_API_SECRET` is present;
customer-session material cannot sign export links. The Gateway still uses
`CUSTOMER_SESSION_SECRET` for legacy session verification/issuance and reset-token
hashing, so this key is not yet removable. No issuer/verifier was retired and no
hosted traffic is inferred.

| Check | Result |
|---|---|
| LCIS identity posture tests | 81/81 pass after correcting the canonical family label to `identity-platform` and representing `EdDSA (ES256 fallback)` accurately |
| Focused LCIS operations posture regression | 1/1 pass |
| Export-signing-secret regression tests | 2/2 pass; `pnpm --filter @letbuyy/api-gateway typecheck` passes |
| Legacy usage telemetry | Instrumented locally; hosted counts and drain window unavailable |

Next transition task: document each Gateway/Commerce route's normal caller and
verified replacement, then prove the legacy customer flows still required for
unlinked accounts before proposing any local dual-verifier change. Hosted usage,
rollback rehearsal and release approval remain separate gates.

## 4 October endpoint-level caller matrix — F2.1 transition boundary

Source review on branch `letbuyy/phase2-shared-buyer-identity`, HEAD
`0862687a5008d604d0df23357b2eb511293139fa`, traced the Commerce route handlers,
normal storefront UI callers, Gateway mounts and canonical buyer APIs. The matrix
distinguishes a code path being reachable from a normal interface actually calling it.

| Commerce route / Gateway path | Normal caller in current source | Canonical buyer counterpart | Retirement disposition |
|---|---|---|---|
| `/api/customer/login` → `/storefront/customer/login` | React and no-JS storefront login; legacy `CustomerAuthProvider` | `/api/buyer-auth/start` PKCE sign-in; then explicit store link from account/sign-in UI | Keep as the existing-store-password bridge for unlinked customers; retire only after replacement/recovery and observed hosted use are accepted |
| `/api/customer/set-password` → `/storefront/customer/password/request-reset` or `/confirm-reset` | Storefront settings, legacy login and the store-scoped reset form | Buyer sign-in/recovery is separate; a verified store link is available after canonical sign-in | Keep reset/re-entry for unlinked store accounts; the successful reset still issues a legacy session |
| `/api/customer/register` → `/storefront/customer/register` | Stale Liquid registration form only | `/api/buyer-auth/start` | Commerce redirects HTML to PKCE and returns 410 for JSON; Gateway registration returns 410; neither is a remaining issuer |
| `/api/customer/session`, `/api/customer/logout` | Legacy `CustomerAuthProvider` and the `lb-logout` legacy-account branch | `/api/buyer-auth/session`, `/api/buyer-auth/logout` | Separate session realms; buyer pages use buyer logout; clearing a store cookie does not revoke buyer or other stateless legacy copies |
| `/api/customer/profile` → `/storefront/customer/profile` | Store-customer settings/profile Liquid island when in legacy mode | `/api/buyer/profile` | Keep legacy fallback for unlinked customers; linked buyer UI uses site-bound buyer profile backed by the verified store relationship |
| `/api/customer/addresses` → `/storefront/customer/addresses` | Legacy address page/island and signed-out-buyer checkout fallback | `/api/buyer/addresses` and item routes | Keep only for legacy account mode; buyer mode selects canonical API and does not downgrade on buyer verification failure |
| `/api/customer/orders` → `/storefront/customer/orders` | No non-test UI caller of the Commerce BFF was found. The Gateway route is called by server-only `customer-drop.ts` on legacy Liquid customer-order and order-detail routes. TypeScript and Dart REST API clients expose `customerOrders` methods, though no app call site was found. The GraphQL `order` field delegates to this route. | `/api/buyer/orders` and its order-detail route | The Commerce BFF is a local deprecation candidate, not proven unused by deployed or SDK consumers. Keep the Gateway endpoint for Liquid and unlinked accounts until replacement and hosted/other-client usage are established. |
| `/api/customer/wishlist` → `/storefront/customer/wishlist` | Legacy wishlist context and Liquid customer branch | `/api/buyer/wishlist` | Keep legacy mode for unlinked customers; linked buyer path resolves the existing store wishlist through the verified relationship |
| `/api/customer/wishlist/sync` → `/storefront/customer/wishlist/sync` | Legacy `CustomerAuthProvider` after legacy sign-in | Buyer wishlist flow uses `/api/buyer/wishlist` and the shared linked store list | Legacy-only migration helper; do not use it as buyer ownership proof |
| `/api/customer/auto-create` → `/storefront/customer/from-order` | Guest checkout after an order succeeds | Not an identity-session route; it uses a server-signed request and derives contact data from the persisted order | Retain independently of HS256; no bearer/session identity is minted from this guest CRM action |
| `/api/customer/check` → `/storefront/customer/status` | No supported UI caller; retired existence/password-state probe | PKCE start is the public sign-in entry | Commerce returns 410 and Gateway surface is removed; do not restore email enumeration |
| Gateway `/storefront/customer/orders`, `/addresses`, `/wishlist`, `/profile`, `/activity` | Commerce legacy BFFs forward the host-only cookie; Liquid customer drops call some routes directly. The GraphQL `customer` and `order` fields verify a legacy cookie and the `order` field delegates to `/storefront/customer/orders`. TypeScript/Dart REST SDK methods are exposed, but app call sites are not present in this checkout. | Site-bound `/storefront/buyer/*` routes use the canonical buyer token and verified store relationship | Keep dual-format verification for now; enforce active store-customer state and signed store on every legacy read/write. Local SDK availability is not proof of hosted use. |
| Gateway `/storefront/graphql`, `/graphql/storefront` | No in-repo UI call site found. TypeScript/Dart SDKs expose the supported storefront GraphQL operations; the stale `customerOrders` operation has been removed because the current resolver does not implement it. Mounted only behind `FEATURE_GRAPHQL` (staging config `true`, production config `false`). | No buyer-session GraphQL equivalent found; buyer orders are REST (`/storefront/buyer/orders`) | Keep current production gate. Store-customer order lists remain on the authenticated REST contract; no live flag state or hosted traffic was queried. |
| Gateway optional `/storefront/reviews` customer identity | Legacy cookie may attach verified store-customer identity; anonymous review remains separate | Buyer review BFF is canonical for linked buyers | Retain the optional bridge until linked/unlinked behavior and external use are accepted; this route is not a reason to accept body-supplied customer identity |

This source matrix closes the local endpoint/caller inventory for currently found
Commerce/Gateway consumers, including the Commerce orders BFF's lack of a UI call
site in this checkout and its separate Gateway, Liquid and SDK compatibility surface.
The GraphQL routes are mounted behind `FEATURE_GRAPHQL`: this checkout sets the flag
true for staging and false for production. The repository documents no known GraphQL
consumer. The unsupported `customerOrders` operation was removed from the TS/Dart
GraphQL SDKs and the parity inventory; the typed REST customer-orders methods remain.
This avoids extending the per-store HS256 bridge or the deferred headless surface just
to satisfy an operation with no in-repo callers. `customer` and `order` fields remain
legacy-session GraphQL paths; no buyer-session GraphQL equivalent was found. Do not
infer zero traffic from the local caller scan or production config. The legacy key
also remains used for password-reset-token HMAC; Gateway export-link signing no longer
falls back to it. No local verifier was disabled. Next: evaluate Commerce BFF
retirement only with SDK and hosted usage evidence, then continue local buyer-equivalent
integration while preserving existing-account recovery. A dual-verifier/rollback
proposal must use the aggregate telemetry already instrumented and remain a local
design until hosted observation is separately authorized.

## 4 October continuation — remove unsupported store-customer GraphQL SDK operation

The TS and Dart GraphQL SDKs exposed `customerOrders(storeId,email,orderId)` even though
the Gateway Storefront GraphQL resolver had no such field. It also placed caller-supplied
email beside a legacy customer-session contract. The field was not called by any app in
this checkout, the GraphQL routes remain behind `FEATURE_GRAPHQL` (staging config on,
production config off), and the canonical customer-order REST clients remain available.
The unsupported operation and its stale REST-shim parity entry were removed; no Gateway
resolver, customer-session verifier or feature flag was changed. This follows the
constitutional boundary against extending the transitional store-customer authority
or implementing the deferred headless tier. Repository parity test: 4/4 passed;
TypeScript API-client typecheck passed. Dart analyzer reported no issues and formatter
confirmed the file is formatted, but both commands exited nonzero while trying to clean
`/Users/saai_mithra/.dart-tool/dart-flutter-telemetry.log` outside the writable workspace.
The Dart test wrapper also could not update Flutter's SDK cache; the direct bundled-Dart
test stayed silent and was interrupted after repeated polls, so Dart runtime tests remain
unverified. No hosted flag state or external SDK usage was queried.

## 4 October continuation — reversible per-format verifier control

The Gateway's transitional verifier now has an optional `CUSTOMER_SESSION_COMPATIBILITY`
policy: `both`, `gateway_hs256_v1`, `shopper_hs256_legacy`, or `disabled`. An unset
binding preserves today's dual-format behavior; an unknown runtime value fails closed.
The policy gates only the Gateway verifier. It does not change Commerce/Gateway
issuance, password-reset token hashing, Wrangler configuration or any running environment.
Do not select a single format until the corresponding issuer and unlinked-account recovery
path have a tested transition plan. No verifier was disabled and no hosted telemetry was read.

| Check | Result |
|---|---|
| Pure format-policy tests | 3/3 pass: dual default, each single-format mode, disabled and invalid policy |
| `tests/auth/customer-session-gateway.test.mjs` | 7/7 pass; retargeted the stale reset assertion from an old inline update to the current atomic reset RPC/migration |
| API Gateway TypeScript typecheck | Exit 0 |
| `git diff --check` | Pass |
| Hono customer-session middleware suite | 7/7 pass using a native Node ESM test entry and temporary extension resolver; exercises the real middleware in a Hono app harness, not the complete production worker route tree |
| Broader Gateway route suite | Not run through the official TSX runner in this host; Node's strip-only loader cannot compile the unrelated route tree's TypeScript parameter properties |

This is a locally reversible verifier control, not a cutover. Next, exercise it through the
complete Gateway worker and owned-database lanes; then pair each accepted format with the real
active issuer, store-only recovery, route denials and owned-database journeys before considering
any non-default environment value. Hosted telemetry/drain, rollback rehearsal and release
approval remain separate gates.

## 4 October continuation — production-worker compatibility policy acceptance added

Extended `owned-db/storefront-customer-profile.postgres.test.ts` with a production-worker matrix
for the dual-format default, explicit dual-format mode, each single-format mode, disabled mode,
and an invalid value. Each format is tested against the real profile route and active synthetic
customer, with rejected formats required to return the normal 401 session error. The suite uses
the existing owned Postgres + PostgREST harness; it does not access restored or hosted data.

| Check | Result |
|---|---|
| API Gateway TypeScript typecheck | Exit 0; includes the added owned-worker test |
| `git diff --check` | Exit 0 |
| Official Gateway unit runner | Could not start: `tsx` IPC socket listen returned `EPERM` |
| Official owned-DB lane | 23 suites failed preflight, 0 tests executed; the runner reported no real Docker daemon (`docker info` denied access to the local Docker socket) |
| Production-worker compatibility matrix | Authored, not executed; must run via `pnpm --filter @letbuyy/api-gateway run test:db` when Docker is available |

No compatibility mode was changed in runtime configuration. No issuer was retired, hosted traffic
was not queried and no database migration or restored/hosted database was touched. The next
verification step is to rerun this suite through the owned-DB lane on a host with its required
Docker daemon, then reconcile that real-worker result with deployed usage evidence before any
format cutover.

## 4 October correction — owned production-worker matrix completed

The previously blocked matrix has now run through the repository's disposable owned-database
runner on source HEAD `0862687a5008d604d0df23357b2eb511293139fa`:

`node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/storefront-customer-profile.postgres.test.ts --kind gateway-db --jobs 1`

Result: **1 suite, 7/7 passed, 0 failures, skips, cancellations or TODOs**. This adds real-worker and
owned-Postgres proof for the dual-format default, explicit dual mode, both single-format modes,
disabled mode, and invalid-policy fail-closed behavior against the signed customer profile route.
The runner reported the owned suite fixture and clean completion. It does not prove a browser sign-in,
legacy-cookie usage counts in hosted traffic, a zero-use drain window, issuer retirement, hosted
configuration, or release readiness. Runtime policy remains at its default; no issuer/verifier was
disabled and no restored or hosted database was accessed.

## 4 October continuation — verify the active Gateway session issuer through the worker

The compatibility matrix above proved that helper-created tokens of both known formats are accepted
or denied according to policy. It did not prove that the active Gateway password-login route's real
issuer output was consumable by the ordinary account API. The owned production-worker suite now
seeds an isolated store customer and bcrypt credential, signs in through
`POST /storefront/customer/login`, extracts the actual HttpOnly session cookie, reads the same
customer through `/storefront/customer/profile`, and attempts to reuse that credential against a
different storefront wishlist. The login/profile path succeeds and the cross-store request returns
403.

| Check | Result |
|---|---|
| Owned production-worker/Postgres `storefront-customer-profile.postgres.test.ts` | **8/8 passed**, no skips; includes the real Gateway password-login issuance path, normal profile read and cross-store denial. |
| Gateway TypeScript typecheck | Passed. |
| `git diff --check` | Passed. |

The integration test uses a generated synthetic password hash and the repository's explicit local
Turnstile bypass in an `ENVIRONMENT=local` worker binding. A first fixture attempt used
`ENVIRONMENT=test`, which correctly rejected that bypass; the test was corrected without relaxing
the production Turnstile verifier. This establishes only the Gateway issuer, verifier and scoped
consumer in the owned local lane. It does not establish Commerce's shopper-format issuer through a
browser, hosted account usage, a zero-use drain, identity-platform migration, or permission to
disable either compatibility verifier. No issuer/verifier configuration was changed.

Next transition task: exercise the Commerce shopper-format session issuance and its normal storefront
consumer as one route journey, then map both concrete issuer outputs to the reversible Gateway
acceptance policy and their unlinked-account recovery behavior. Keep both formats and the default
dual-verifier policy until that local integration and separately authorized hosted observations are
complete.

## 4 October continuation — bind the Commerce shopper session issuer and verifier to storefront scope

The Commerce login and password-reset flows call `createSession`, while the storefront account
reads call `getSession`. Those entry points now share explicit `issueStorefrontCustomerSession` and
`verifyStorefrontCustomerSession` boundaries. Issuance resolves the request host to a store and
requires it to match the customer store before writing the cookie; verification checks the signed
shopper token and repeats that host-to-store binding. The established host-only cookie name, token
format, HttpOnly/Secure/SameSite/path/TTL policy remain the same.

| Check | Result |
|---|---|
| Commerce session issue/verify contract plus customer-login origin denial tests | **6/6 passed**. |
| Customer-web typecheck and full package test command | Passed; included root contract suites at **947/947**. |
| `package.json` parse and `git diff --check` | Passed. |

These local tests cover the shared issue/verify functions used by the production entry points,
including same-store acceptance, sibling-store refusal, unresolved/resolver-failure refusal before
cookie write, exact cookie attributes and missing-secret denial. They do not yet run a positive
Next.js BFF/browser login followed by a real storefront account read, nor do they establish hosted
issuer usage, a zero-use drain, or readiness to retire either format. The default dual-verifier
policy and both issuers remain unchanged.

Next: run the real Next.js sign-in and account-read journey in a browser or production-like local
environment, then complete legacy-account recovery/handoff coverage before proposing any verifier
transition. Hosted use remains a separate observation gate.

## 4 October continuation — complete the Next.js to Gateway shopper-session journey

The previous helper-level acceptance is now backed by a real local Next.js request path and the
real Gateway worker. `apps/commerce/web/scripts/customer-session-runtime-smoke.mjs` starts Next.js,
performs a synthetic password login, captures the cookie written by the production `createSession`
call, reads `/api/customer/session`, and reads `/api/customer/profile`. In the owned-database lane,
its HTTP adapter forwards requests into the Gateway worker's actual `fetch`; the worker resolves
both synthetic storefront hosts, authenticates against the seeded store-customer credential, checks
the Commerce shopper-format cookie under the default dual verifier, and reads the owned Postgres
profile. The same journey checks cross-origin and wrong-store login denials, sibling-store session
denial, and bad-password refusal without a cookie.

| Check | Result |
|---|---|
| Owned Gateway worker + disposable Postgres `storefront-customer-profile.postgres.test.ts` | **10/10 passed**, no skips; includes the full Next login/session/profile journey and direct Commerce-provider-to-Gateway profile acceptance. |
| Commerce customer-web typecheck | Passed. |
| Gateway typecheck | Passed. |
| Focused Commerce session/login/profile route tests | **12/12 passed**. |
| Standalone controlled-Gateway Next runtime smoke | **9 checks passed**, including resolver-outage fail-closed behavior. |
| `node --check`, package manifest parse and `git diff --check` | Passed. |

The owned lane uses generated synthetic customer credentials, an explicit local-only Turnstile
bypass under `ENVIRONMENT=local`, and an ephemeral loopback adapter. That adapter calls the actual
Gateway worker in-process; it is not a deployed Cloudflare Worker, browser/device test, hosted
traffic observation or proof of zero legacy-cookie use. The direct worker checks establish that
Commerce's exact host-only shopper provider format is accepted by the existing Gateway verifier
and remains constrained to the signed customer/store. Both compatibility formats and the default
dual-verifier policy remain enabled; no issuer or verifier configuration changed. The shared
response helpers were moved out of Next `route.ts` modules after the generated Next route types
correctly rejected non-handler exports; package typecheck now passes.

The Gateway's verified existing-account relationship operation is now also exercised through the
real worker and owned Postgres. A verified signed buyer session upgrades a matching legacy edge;
unverified identity, cross-store scope, and another buyer's existing link are refused; two concurrent
first-time attempts converge to one audited relationship. See the
[existing-account link acceptance](P2_LEGACY_ACCOUNT_LINK_ENTRY_ACCEPTANCE.md).

Next Phase 2 task: connect that real link transaction to the canonical PKCE callback and actual
identity-platform issuer/sign-in path, then reconcile remaining legacy issuer callers with transition
telemetry and hosted-use gates. Preserve the accepted transitional bridge while those checks run;
hosted observation and any verifier cutover remain separate gates.

## 4 October continuation — Identity PKCE journey prepared; owned runtime not available

The owned Next/Gateway integration fixture now has a conditional path that starts the actual local
Identity and Commerce Next.js apps, carries the store's PKCE verifier through authorization-code
issuance and redemption, receives the Identity-issued ES256 site-bound session, calls the existing
Gateway store-link route, and reads the resulting storefront buyer session. Its initial signed-in
buyer state is explicitly seeded; it does not claim to test password/OTP/email login. The existing
standalone test-session smoke and component suites still exercise their separate boundaries.

This combined identity-to-database path was **not run** in this continuation: the executable owned-
Postgres runner stopped before provisioning, reporting that no Docker daemon answered `docker info`.
No hosted database or service was substituted. The new conditional path therefore remains a test
harness change awaiting owned-runtime execution, not accepted end-to-end evidence.

| Verification | Result |
|---|---|
| Commerce typecheck | Passed. |
| Gateway typecheck | Passed. |
| Commerce package tests | **947/947 passed**, including the root storefront contracts. |
| Identity package tests | **38/38 app tests** and **6/6 root contracts** passed. |
| Standalone controlled-Gateway Next session smoke | **9 checks passed**; this run did not enable the optional Identity exchange. |
| Owned Gateway/Postgres test for the combined PKCE journey | Not run; no Docker daemon. |
| Browser, Identity login/OTP, hosted redirect, cloud database, provider or deployment | Not run. |

Next: rerun `storefront-customer-profile.postgres.test.ts` through the official owned-database
runner once the local Docker daemon is available, inspect any runtime failures, and record exact
Identity authorize/redeem, cookie-switch and link results. Keep the existing reversible session
bridge and all hosted-use/revocation gates in place until that evidence and the remaining recovery
work are complete.

## 4 October continuation — actual Identity and Commerce apps through controlled Gateway

The new standalone mode `pnpm --filter @letbuyy/customer-web test:session-runtime:oauth-double`
now runs both local Next.js applications. It starts an explicit same-origin store-link flow, lets
the actual Identity authorize route issue a code, redeems it through the actual Identity token
route, verifies the ES256 store-scoped token, runs the Commerce callback, checks the legacy cookie
switch, reads the canonical buyer session, rejects sibling-store reuse, and rejects code replay.
It also exercises the existing login/profile smoke and resolver-outage denial. The buyer session
used to enter Identity is synthetic and seeded by the harness, not a password/OTP login.

| Verification | Result |
|---|---|
| Local Commerce + Identity Next.js apps with the controlled Gateway contract | **10/10 checks passed**. |
| Storefront session signature/issuer/audience/site and one-time code replay | Passed in the integration smoke. |
| Actual Gateway link transaction + owned Postgres | Not run; Docker Desktop cannot start in this environment. |
| Browser, buyer credential/OTP, hosted, provider or deployment | Not run. |

This strengthens local app-to-app PKCE and issuer evidence only. The Gateway double models code
storage/redemption and the link/read contract; it does not prove the production worker, database
transaction, audit row or concurrent linking. `/Applications/Docker.app` exists without its
executable, and `docker info` still fails, so no hosted or restored database was substituted.
The existing owned-worker link suite remains the authority for the separate database boundary;
the combined owned run is still required before claiming the complete journey.

## 4 October correction — real Identity PKCE link through owned Gateway and Postgres

The previously authored combined Identity/Commerce owned-database path has now run successfully.
The test starts the actual Identity and Commerce Next.js apps, performs the real authorize and
authorization-code redemption routes using a test-seeded signed-in buyer and PKCE verifier, receives
the Identity-issued site-bound ES256 storefront session, links the explicitly verified matching
store customer through the real Gateway worker and owned Postgres transaction, and reads the
resulting canonical storefront buyer session. It also verifies the legacy customer login/profile
path, wrong-origin and wrong-store refusal, sibling-store buyer-session denial, and one-time code
replay refusal.

| Check | Result |
|---|---|
| `storefront-customer-profile.postgres.test.ts` via the official owned Gateway database runner | **10/10 passed**, zero failures, skips or TODOs; isolated run `5f5c20226777`; sanitized runner report: [owned database run](P2_CUSTOMER_SESSION_OWNED_DATABASE_RUN.json) |
| API Gateway typecheck | Passed |
| Commerce customer-web typecheck | Passed |
| Identity-platform typecheck | Passed |
| `node --check` on the session runtime smoke and `git diff --check` | Passed |
| Owned test cleanup | Verified: no remaining run containers, networks or volumes |

The first attempts exposed two fixture mismatches and one stale assertion: the owned Gateway was
configured with the fixture issuer instead of the local Identity issuer; changing that issuer also
required the seeded platform buyer token to use it. The account-email update correctly invalidated
the fixture's prior email verification under migration 255, so the synthetic buyer is now explicitly
marked verified with a verification timestamp. Finally, the smoke's actual `local Identity Next.js
dev server` label is asserted as written. These are test-fixture/harness corrections; the integrated
flow then passed without changing production identity or session behavior.

For this run only, the checkout had no `apps/platform/identity/node_modules` link, although the
workspace's existing Commerce installation contained the same declared Next.js version. A temporary
ignored symlink to that existing dependency directory enabled the run and was removed afterward;
no dependency manifest or lockfile changed. A fresh workspace install should restore the normal
package-specific links.

This proves a local app-to-worker-to-owned-database PKCE/link journey for a synthetic buyer whose
initial buyer session is seeded; it does not exercise password, email, OTP or browser login. It also
does not prove hosted custom-domain redirects, deployed traffic, provider/email delivery, telemetry
drain or a verifier cutover. Both legacy HS256 formats and the default dual-format bridge remain
enabled. Next: finish the route-by-route local consumer/issuer matrix and make a rollback-ready
local verifier-transition rehearsal; retain deployed verifiers until hosted usage telemetry,
authorized rollout and rollback evidence exist.

## 4 October correction — route-by-route local consumer matrix reconciled

The endpoint-level F2.1 matrix above has been checked against current Commerce routes and callers,
Gateway mounts/middleware, Identity link/session flows, and the storefront buyer APIs. The local
inventory distinguishes: four active HS256 request-path customer-session signers (two Gateway,
two Commerce); retired registration/status entrypoints and the unused federation helper; active
legacy account routes/cookies and their React/Liquid consumers; optional legacy review identity and
gated GraphQL customer/order compatibility; server-signed guest auto-create (not a customer-session
issuer); and canonical buyer equivalents that require an explicit buyer/store-customer relation.
The GraphQL production flag is off in repository configuration and no in-repo UI caller was found;
neither fact proves zero hosted use. Legacy order history remains separately claim-gated.

The recent owned runtime run adds the missing local Identity PKCE/link and database boundary; the
earlier owned suite covers the active Gateway-issued customer session and scoped account consumer.
No remaining local consumer was found that can safely be disabled without changing unlinked
store-customer recovery or another defined transitional feature. Current local verifier mode remains
dual-format; tests exercise default, explicit dual, each single-format policy, disabled and
fail-closed invalid values. This is a reversible test control, not authorization to change runtime
configuration. Preserve deployed verifiers until privacy-safe hosted usage evidence, a bounded
rollback plan and the required product decision exist.

Next Phase 2 work returns to the remaining operator/privacy/identity acceptance and owner decisions
in `PHASE2_DECISIONS.md`; no further HS256 signer/verifier retirement is justified by local source
counts alone.

## 4 October continuation — controlled-double Chromium identity journey

The optional repeatable controlled-double browser mode is available as
`pnpm --filter @letbuyy/customer-web test:session-runtime:browser`. Headless Chromium opens the real
Identity authorize page, displays the signed-in account/store consent, submits the Continue action,
redeems the one-time PKCE code through the real Identity token route, follows the Commerce callback,
observes the HttpOnly site-bound buyer cookie, verifies the canonical buyer session and refuses the
buyer cookie on a sibling store. The same run retains the existing Next BFF login/profile and negative
controls. The record below supersedes this early HTTP-double boundary with an owned-worker/database
browser run.

| Check | Result |
|---|---|
| Local Commerce and Identity Next.js apps plus controlled Gateway HTTP double | Passed; 11 browser/runtime checks reported, including the Chromium consent/callback journey. |
| Identity authorize UI and Continue action | Browser-visible consent and click completed; the authorize response carried the callback into the local Commerce app. |
| Wrong site and one-time code replay | Denied; sibling store returned no buyer session and a reused code was rejected. |
| Starting buyer authentication | Seeded synthetic buyer session. Password, OTP, email delivery and browser credential entry were not exercised. |
| Gateway link/data boundary | Controlled local HTTP contract double, not the production Gateway worker or owned Postgres. |
| Hosted custom-domain, production traffic, provider and deployment | Not run. |

For this run only, `apps/platform/identity/node_modules` was temporarily linked to the existing
Commerce dependency tree because its ignored package-local link was absent. The symlink was removed
after the run; no manifest, lockfile, hosted setting or data store changed.

## 4 October correction — owned-database browser identity journey

The browser journey now runs through both real local Next.js apps, the production Gateway worker,
PostgREST and the runner-owned disposable PostgreSQL database. Chromium starts from the published
synthetic storefront, follows the host-only Commerce PKCE handoff to Identity, shows the signed-in
buyer/store consent screen, submits Continue, and follows the one-time authorization-code exchange
back to Commerce. The Identity client-info and `/me` reads, code issue/redeem, explicit
buyer/store-customer link transaction, and final site-bound buyer-session read all reach the actual
Gateway worker and owned database. The browser verifies the canonical session cookie and confirms
the buyer has no session on a sibling synthetic store. The same test also completes the existing
legacy Commerce login/profile flow and its cross-store denial.

| Check | Result |
|---|---|
| Owned Gateway/Postgres `storefront-customer-profile.postgres.test.ts` | **10/10 passed**, zero failures, skips or TODOs; isolated runner `6759c51a7d9f`; [sanitized owned-run record](P2_CUSTOMER_BROWSER_OWNED_DATABASE_RUN.json). |
| Browser path | Headless Chromium passed the actual Identity consent click, code redemption, Commerce callback, host-only buyer cookie, canonical session read, and sibling-store denial. |
| Gateway and database boundary | Actual production worker through the suite's loopback adapter, actual PostgREST and a runner-owned disposable Postgres 16 database; runner exited 0 after verifying cleanup. |
| Starting buyer authentication | The buyer account/session is synthetic and seeded for the test. The browser does not enter a password, OTP, or email code; external email delivery is not tested. |
| Hosted, provider and release | Not run. No hosted setting, restored database, provider, production login, or deployment was used. |

The browser covers canonical sign-in and the existing-account link transaction in the same owned test
run; the explicit buyer/store link POST is exercised by the integration smoke before the Chromium
sign-in journey. This is local end-to-end identity evidence, not full Phase 2 acceptance. The
temporary Identity dependency symlink was removed. Next: continue the remaining Phase 2
operator/privacy/identity decision-dependent work and legacy issuer evidence gates; do not retire
either HS256 issuer or verifier from this local result.

## 4 October continuation — reversible verifier-policy rehearsal added

The Gateway middleware test now exercises a policy transition as a sequence with already-valid
tokens: dual-format baseline accepts both Gateway and legacy shopper sessions; strict
`gateway_hs256_v1` accepts the Gateway session and denies the legacy session; restoring `both`
allows both still-valid sessions again. This is a local test override only. The configured runtime
default remains dual-format and no issuer, deployment setting or hosted verifier was changed.

| Check | Result |
|---|---|
| Focused compatibility and telemetry tests | **11/11 passed**, including the transition/rollback sequence and privacy-safe aggregate telemetry. |
| API Gateway typecheck | Passed. |
| Owned Gateway/Postgres session suite | **11/11 passed**, including the transition/rollback sequence against the production worker and disposable Postgres. A temporary link to the existing Commerce Next.js 16.1.6 dependencies supplied the missing Identity package link; it was removed after the run. |
| Hosted usage telemetry, rollout, rollback in a deployed environment | Not available and not attempted. |

This verifies that the local middleware can reverse a hypothetical verifier restriction without
invalidating unexpired legacy sessions when dual mode is restored. The owned runner created and
removed its labeled disposable Postgres resources. This is local integration evidence, not evidence
of zero hosted legacy use, a production rollback, or approval to change the deployed policy.

## 4 October continuation — real Identity credential login before browser PKCE

The owned runtime test now begins with the Identity platform's actual local
`POST /api/buyer/login` route instead of a pre-seeded signed-in buyer session. It uses a synthetic
buyer account and password hash in the disposable test database. A wrong password receives the
generic `401 Invalid email or password.` response and no session cookie. The valid password returns
the normal HttpOnly buyer session cookie; the test then carries that authenticated buyer into the
headless Chromium Identity consent page, one-time PKCE exchange, Commerce callback, canonical
site-bound session check, and sibling-store refusal. The local test binding bypasses Turnstile only
for this ephemeral run. Credential submission to the login endpoint is exercised over local HTTP;
Chromium covers the following consent and callback journey. No external email, OTP, hosted domain,
production account or provider is involved.

| Check | Result |
|---|---|
| Owned Gateway/Postgres `storefront-customer-profile.postgres.test.ts` | **11/11 passed**, 0 failures, skips or TODOs; runner `ef0aee99e7b6`; [sanitized run record](P2_CUSTOMER_SESSION_CREDENTIAL_OWNED_DATABASE_RUN.json). |
| Negative credential control | Wrong password denied with the generic response and no session cookie. |
| Positive credential/browser journey | Valid synthetic password accepted; actual Identity cookie then completes Chromium consent, PKCE, callback, site-bound session read and sibling-store denial. |
| Type and syntax checks | Identity typecheck passed; API Gateway typecheck passed; `node --check` passed for the Commerce runtime smoke script. |
| Scope | Local source and disposable owned database only; no hosted changes or legacy issuer/verifier retirement. |

The runner's labeled disposable resources were cleaned up. The temporary Identity dependency link to
the already-installed matching Commerce Next.js dependency tree was removed after verification.
This adds credential-route and browser handoff evidence; it does not prove browser-typed credentials,
email/OTP delivery, hosted use, a legacy-format drain, or full Phase 2 closure. Continue the remaining
operator/privacy/identity acceptance and owner decisions before moving the programme's active phase.

## 4 October correction — credential login entered in Chromium

The preceding owned-database journey's valid password was posted to Identity by the local test client.
The browser now starts signed out and enters that same synthetic buyer's email and password into the
actual Identity authorize form before continuing. Chromium observes the authenticated continuation,
clicks the named-store consent action, redeems the one-time PKCE code through Identity, returns to the
Commerce callback, reads the host-bound buyer session, and confirms that session is refused by a
sibling storefront. The wrong-password/no-cookie assertion remains an actual Identity login-endpoint
check in the same run; the browser positive path proves user-form input and navigation. Turnstile is
bypassed only by the explicit local development test binding; no CAPTCHA vendor proof is implied.

| Check | Result |
|---|---|
| Owned Gateway/Postgres `storefront-customer-profile.postgres.test.ts` | **11/11 passed**, 0 failures, skips or TODOs; superseded by runner `6ec21ebba100`; [sanitized run record](P2_CUSTOMER_SESSION_CREDENTIAL_BROWSER_OWNED_DATABASE_RUN.json). |
| Browser credential entry | Signed-out Chromium fills the Identity form with the valid synthetic account and reaches the authenticated continuation page. |
| Browser handoff | Named-store consent, one-time PKCE, Commerce callback, site-bound session read and sibling-store refusal pass. |
| Negative credential control | Wrong password returns the generic denial and issues no cookie through the real login endpoint. |
| Scope | Local browser, actual local Identity and Commerce apps, production Gateway worker, and runner-owned disposable Postgres; no hosted, email/OTP delivery, release or legacy cutover. |

The run used the already-installed Commerce Next.js dependencies through a temporary Identity package
link, removed after completion. This supersedes the previous test-client-only positive credential
step; both runs remain local synthetic-account evidence, not hosted or external-delivery acceptance.

## 4 October correction — proxied same-origin validation and current browser evidence

Commerce's same-origin check now accounts for the public request origin carried by the trusted
`x-forwarded-host`/`x-forwarded-proto` headers when Next's internal request URL has been rewritten.
It still requires exact Origin equality, permits only `same-origin` Fetch Metadata when present, and
fails closed on malformed or comma-ambiguous forwarded authority. Cross-site, sibling-host, scheme,
port and forwarded-host mismatch negatives remain denied. The owned runtime fixture now sends an
Origin that matches its synthetic storefront host instead of describing a localhost-origin request
as a store-origin request.

| Check | Result |
|---|---|
| Focused Commerce buyer-flow, link-start and legacy-login tests | **9/9 passed**, including rewritten internal URL with matching forwarded public origin and cross-host/scheme negatives. |
| Commerce typecheck | Passed. |
| Runtime smoke syntax and `git diff --check` | Passed. |
| Owned Gateway/Postgres session suite | **11/11 passed**, run `6ec21ebba100`; browser signs in through Identity, grants named-store consent, completes PKCE and refuses sibling-store session use. |
| Store-link path | The explicit link transaction, PKCE callback, replay denial and cookie handoff pass through the real local Gateway and owned database using the smoke's local HTTP client. The additional Chromium attempt from React Account Settings did not reach the route: Chrome reported `form-action 'self'` on that document. The document, target origin and sole CSP header matched, and a separate synthetic `.localhost` CSP control passed; the discrepancy remains unresolved. No CSP policy was broadened. |

The temporary Identity dependency symlink was removed after the owned run. **Next Phase 2 task:** isolate
why Chromium blocks the Account Settings native same-origin form in this local app context, fix it
without weakening `form-action`, then prove the explicit existing-account link from the normal page
through its callback, verified-email rule, cookie transition, and sibling-store denial in the owned
browser/worker/database lane. Until then, count route/database link coverage and browser sign-in
separately; do not claim the Account Settings browser journey as accepted. Legacy HS256 signers,
hosted telemetry/drain and the full Phase 2 decision gates remain open.

## 4 October follow-up — Account Settings link verified in Chromium

The native form submission discrepancy remains unexplained, so the React Account Settings entry
now submits the same explicit `intent=link_store_customer` POST with same-origin `fetch` and
`Accept: application/json`. The response returns the authorize URL while setting the same HttpOnly,
host-only PKCE flow cookie. The client navigates only to the Identity authorize path. This uses the
existing `connect-src 'self'` allowance and leaves `form-action 'self'` unchanged; the API continues
to enforce same-origin Origin/Fetch Metadata checks. Both legacy-customer and canonical-buyer
settings variants use this entry, and the hidden field no longer uses the DOM-clobbering `action`
name.

The owned Chromium journey now starts from an unlinked synthetic legacy customer in the normal
Account Settings page, signs into the real local Identity app, grants named-store consent, completes
the Commerce PKCE callback, verifies the successful link status, confirms the legacy customer cookie
was cleared and canonical buyer cookie installed, and refuses that cookie on a sibling store. The
direct owned-worker link transaction/replay checks now run afterward, so the browser covers the first
link rather than only an idempotent repeat. This is local synthetic evidence; hosted delivery,
production operation and legacy verifier retirement remain open.

| Check | Result |
|---|---|
| Focused buyer flow, link start and legacy login tests | **10/10 passed**. |
| Commerce customer-web typecheck | Passed. |
| Runtime smoke syntax and diff check | Passed. |
| Owned Gateway/Postgres suite | **11/11 passed**, run `1ab57802f691`; explicit first-link Account Settings browser journey and direct owned-worker link checks both pass. |
| CSP | `form-action 'self'` was not broadened. Chromium browser journey uses same-origin fetch under `connect-src 'self'`; the original native-form enforcement discrepancy remains undiagnosed. |

The temporary Identity dependency symlink was removed after the run. **Next Phase 2 task:** continue
the recorded identity/session transition work (issuer inventory and safe retirement evidence), while
preserving both active legacy formats and the dual-verifier default until hosted usage and recovery
acceptance are established. This completes the local Account Settings link journey only; it does not
close Phase 2 or advance the eleven-phase programme to an accepted phase boundary.

## 4 October correction — operator overview tenant-guard failures resolved locally

The earlier local production-worker observations of tenant-guard 500 responses on outbox,
risk and Trust & Safety overview reads are now superseded for these four read routes. Their
cross-site data access uses the bounded operator-read client only after the existing active
super-admin and route-permission checks. The owned-database suite now passes through the
production Gateway worker and verifies seeded results for outbox, dead letters, risk overview
and Trust & Safety overview; a non-allowlisted authenticated user receives 403 on each route.
Risk and Trust & Safety reads also persist their sensitive-read audit records.

| Check | Result |
|---|---|
| Owned Gateway/Postgres operator overview suite | **1/1 passed**, 0 failures/skips/TODOs; runner `8bd2e30c3a08`; [sanitized record](P2_OPERATOR_OVERVIEW_TENANT_GUARD_DATABASE_RUN.json). |
| Tenant-guard reproduction | Earlier runner `399cab96d17b` records the three failing tables (`outbox_events`, `risk_scores`, `ts_cases`) before the bounded repair. |
| Gateway typecheck and `git diff --check` | Passed at source HEAD `0862687a5008d604d0df23357b2eb511293139fa`. |
| Scope limits | Service-role PostgREST does not prove runtime-role RLS; data and identities are synthetic; no browser, hosted environment or deployment was used. |

This resolves the recorded local route failures only. It does not establish an RLS backstop,
broader operator-tier acceptance, hosted behavior or full Phase 2 closure. Continue with the
remaining operator/privacy/identity decisions and local issuer-transition evidence; retain both
legacy HS256 formats until hosted usage and recovery acceptance are established.

## 4 October correction — browser-verifies realm-specific logout and cookie scope

The owned Chromium journey now exercises both storefront logout routes while the buyer has both
the transitional store-customer cookie and the canonical site-bound buyer cookie. Logging out of
the store-customer realm clears only `lb_customer_session`; the legacy `/api/customer/session`
reports signed out while `/api/buyer-auth/session` still resolves the buyer. The test then restores
only its synthetic legacy cookie and signs out of the buyer realm: `__Host-lb_store_buyer` is
cleared, the legacy cookie remains, the legacy session endpoint still authenticates it, and the
buyer-session endpoint reports signed out. Both actions use same-origin browser `fetch` against the
real local Commerce app; the positive buyer-session recheck traverses the real Gateway and
owned database, while the signed-out check verifies the cleared-cookie branch.

This run also corrected a stale browser assertion that checked Identity's `lb_buyer_session` cookie
instead of the actual storefront cookie `__Host-lb_store_buyer`. The earlier assertion could pass
without proving that the callback installed its site-bound cookie; the account-link assertion now
checks the actual name too. The first test attempt after adding logout checks failed on that cookie
name mismatch. After correcting the assertions, the same owned suite passed.

| Check | Result |
|---|---|
| Owned Gateway/Postgres browser suite | **11/11 passed**, 0 failures/skips/TODOs; runner `a5539a2a5b1b`; [sanitized run record](P2_REALM_EXPLICIT_LOGOUT_DATABASE_RUN.json). |
| Existing legacy logout unit suite | **7/7 passed**, including cross-origin rejection before cookie clearing. |
| Buyer logout route tests | Passed in the Commerce customer-web test set. |
| Script syntax and cleanup | `node --check` passed; owned Postgres, PostgREST, containers, networks and volumes were removed by the runner. |
| Scope | Synthetic accounts and local apps only; no hosted deployment, email/OTP provider, or production cookie was used. |

This verifies only the two local browser logout boundaries and cookie separation. It does not retire
the store-customer issuer/verifier, prove deployed telemetry, or close Phase 2. Continue the remaining
operator/privacy/identity gates and preserve both HS256 formats until their distinct retirement
conditions have evidence.

## 4 October correction — password reset through the storefront browser

The owned Chromium journey now opens the real Commerce reset page with a synthetic, one-use token
whose HMAC is seeded directly into the runner-owned database; no email is sent. The browser verifies
that the query string is removed after the page captures the token, fills and submits both password
fields, observes the success state, and receives `lb_customer_session`. The signed-in session endpoint
returns the expected customer/store, the profile BFF reads the customer through the actual Gateway,
and submitting the consumed token again returns the sanitized invalid-or-expired response. The reset
page, Commerce route, Gateway worker, PostgREST and disposable PostgreSQL all participate.

The journey exposed one BFF error-mapping defect: the Gateway's expected `INVALID_RESET_TOKEN` 400
was being collapsed to a generic 500, although the reset form already had a dedicated invalid-link
state. Commerce now preserves that typed rejection as a sanitized 400; other failures retain the
generic temporary-unavailable response. The normal profile response intentionally omits customer ID,
so the browser checks identity through the session endpoint and checks email through the profile.

| Check | Result |
|---|---|
| Focused Commerce login/logout/session/profile/password-reset tests | **19/19 passed**. |
| Commerce web typecheck | Passed after keeping test helpers outside App Router route modules. |
| Password-reset error mapping regression | **3/3** password-reset route tests passed, including exact invalid-token classification. |
| Runtime smoke syntax and `git diff --check` | Passed. |
| Owned Gateway/Postgres Chromium suite | **11/11 passed**, no failures/skips/TODOs; final-source run `6b2165cd4c7f`; [sanitized run record](P2_CUSTOMER_PASSWORD_RESET_BROWSER_OWNED_DATABASE_RUN.json). |
| Scope | Synthetic customer and token; local apps and disposable database only; no email, hosted environment or production cookie used. |

This verifies the local browser reset/replay journey only. It does not retire any active customer
issuer/verifier, prove deployed telemetry, or close Phase 2. Preserve both HS256 formats until their
distinct usage, drain and recovery conditions have evidence.

## 4 October correction — legacy contact-based order access retired

The old storefront `/store/{subdomain}/orders` page and its `/api/orders/check`,
`/api/orders/login` and `/api/orders/set-password` routes formed an alternate order-ownership
path. Source tracing showed that a caller could create the per-store order password after
submitting an email/phone with matching order history, then retrieve orders by that contact; the
check endpoint also disclosed whether matching orders and a password existed. This did not prove
control of the contact or create a canonical `buyer_order_links` ownership edge.

The old page now redirects to `/store/{subdomain}/account/orders`, whose accepted flow reads only
signed-buyer/site-bound links and exposes historical order claim as a separate verified-email
action. The three legacy APIs now return non-cacheable `410` responses without parsing or forwarding
submitted identity/password data. The Commerce order service no longer exposes contact-based order
lookup or password helpers, and the dead legacy order client was removed. The checkout-creation
`POST /api/orders` route is unchanged.

| Check | Result |
|---|---|
| Legacy endpoint regression | **1/1 passed**; lookup, login and set-password each return the same generic `410` response with `Cache-Control: no-store`. |
| Commerce web TypeScript | Passed. |
| Focused ESLint | Passed for the changed order page, routes, test and service. |
| `git diff --check` | Passed. |
| Scope | Local source/tests only. The canonical linked-order and explicit claim journeys have prior local acceptance; this change did not rerun the owned Gateway/Postgres or browser suite. No hosted cutover or Phase 2 closure is claimed. |

This closes the source-level contact-password bypass in the legacy Commerce entry points; it does
not prove whether older external clients call Gateway order-credential operations directly. Keep
the Gateway compatibility inventory and hosted traffic/drain checks in the remaining Phase 2
issuer-transition work. The next dependency-ready task remains the documented identity/session
transition evidence; do not retire the separate legacy HS256 customer-session formats without
hosted use and recovery acceptance.

## 5 October source correction — registration no longer issues a legacy session

Refreshed against the current Phase 2 worktree on branch `letbuyy/phase2-shared-buyer-identity`,
HEAD `0862687a5008d604d0df23357b2eb511293139fa`; this is a source observation and does not certify
uncommitted changes for release. The 4 October source-refresh paragraph above listed three Commerce
session-creation callers and is superseded for registration only. Current `/api/customer/register`
is a compatibility bridge: HTML form submissions start the canonical buyer PKCE flow, and JSON
requests return 410 `CANONICAL_BUYER_ACCOUNT_REQUIRED`. Gateway `/storefront/customer/register` also
returns 410. Neither path creates a store-customer password account or emits an HS256 cookie.

The active source now has two HS256 issuer families with four live issuance entrypoints, plus one
unused exported bridge:

| Issuer | Active entrypoint | Result | Transition status |
|---|---|---|---|
| Gateway | `/storefront/customer/login` | 30-minute `{store_id, customer_id}` HS256 cookie and CSRF cookie | Active legacy store-customer login; direct Gateway caller |
| Gateway | `/storefront/customer/password/confirm-reset` | 30-minute `{store_id, customer_id}` HS256 cookie and CSRF cookie | Active legacy reset completion; direct Gateway caller |
| Commerce | `/api/customer/login` | Seven-day `{sub, storeId, email, name}` host-only HS256 cookie after Gateway credential verification | Active legacy store-customer login; browser-facing Commerce BFF |
| Commerce | `/api/customer/set-password` reset completion | Seven-day host-only HS256 cookie after Gateway reset confirmation | Active legacy reset completion; browser-facing Commerce BFF |
| Commerce helper | `createSessionFromFederationToken` in `lib/session.ts` | Would issue the seven-day legacy cookie if called | Exported but has no current Commerce callsite; do not count as live issuance |

The existing `/api/customer/session` endpoint and Liquid `customer` drop/account hydration remain
legacy-cookie consumers. So do `/api/customer/profile` GET/PATCH, `/api/customer/addresses` GET/POST/
PUT/DELETE, `/api/customer/orders` GET, `/api/customer/wishlist` GET/POST/DELETE, and
`/api/customer/wishlist/sync` POST. These are separate from the existing canonical `/api/buyer/*`
routes. Storefront Gateway retains the scoped legacy `/customer/wishlist` GET/POST/DELETE and sync
POST, `/customer/orders` GET, `/customer/activity` POST, `/customer/profile` GET/PATCH, and
`/customer/addresses` GET/POST/PATCH/DELETE. `/reviews` POST accepts the legacy customer cookie
optionally and resolves verification against the active store-customer relationship; the canonical
`/api/buyer/reviews` path remains separate. Storefront GraphQL `customer` and `order` fields call the
same dual-format Gateway verifier. Internal password, order-credential and guest-order materializer
routes are not browser-session issuers; keep their service/order-specific authority separate.

The `/customer/orders` legacy read still resolves a verified store customer and filters by the
customer email for that store. Canonical buyer order history instead uses verified
`buyer_order_links`; never map one identity to the other by email. Canonical profile, addresses,
orders, wishlist, loyalty and reviews paths exist, but unlinked legacy store customers still depend
on their current compatibility flows. The two HS256 formats remain accepted by the Gateway verifier
and local telemetry remains undeployed. The asked seven-day versus thirty-minute user-visible
session duration choice is still pending; no signer, verifier, cookie lifetime or hosted policy was
changed by this inventory refresh.

Next bounded Phase 2 work: preserve this issuer/consumer census and build a reversible, tested
consumer-by-consumer migration proposal that keeps unlinked customer behavior explicit. The
session-lifetime choice must be resolved before changing issuance behavior; deployed telemetry and
owner release gates remain separate.

## 5 October continuation — legacy registration intent reaches canonical Identity

The Commerce HTML registration compatibility route now forwards `screen=register` to buyer-auth
start. Buyer-auth start accepts only that literal presentation hint and passes it to the Identity
authorize URL; an arbitrary screen value is ignored. The hint is absent from the flow cookie and
does not change the PKCE, state, redirect, session or account-creation authority. JSON registration
remains fail-closed with 410.

The owned local Commerce/Identity/Gateway/Postgres Chromium journey verifies the HTML POST redirect,
store-prefixed return path and actual “Create your LetBuyy account” Identity heading before it
continues through the existing sign-in flow. The runner passes **11/11** and cleans all disposable
resources; [the run evidence](P2_CANONICAL_BUYER_REGISTRATION_BROWSER_RUN_2026-10-05.json) records
the exact boundary. Focused Commerce start, registration and PKCE tests pass **11/11**. Commerce
typecheck initially exposed a test helper exported from the App Router route module; it now lives
in a route-adjacent handler module, its two regression tests pass, and Commerce typecheck passes.

This is an accepted local entrypoint journey, not account creation, verification email, session
retirement or hosted adoption. The seven-day versus thirty-minute lifetime question remains
unanswered; both active legacy login/reset token formats and the dual verifier remain unchanged.

## 5 October continuation — reversible per-consumer transition proposal

The next local transition is staged so unlinked store customers retain their
working account path:

1. Keep the Gateway's dual-format verifier default while collecting only its
   existing aggregate accepted-format and route-class telemetry. The new owned
   worker matrix must first pass in the owned Postgres lane.
2. After the owner chooses the session lifetime, route Commerce login and reset
   completion through one Gateway session issuer. Preserve Commerce's same-origin
   checks, resolved storefront binding and host-only cookie boundary. Leave both
   verifier formats accepted during this source and deployment transition; do
   not infer that issuing the Gateway format alone retires legacy tokens.
3. Move linked buyer account surfaces to the canonical buyer BFFs only when the
   signed buyer session and explicit site-scoped store link are present. Keep
   store-password login/recovery and the legacy profile, address, order and
   wishlist behavior for customers who have no verified link. Never create a
   link from matching email alone, and never fall back to legacy authority when
   canonical buyer verification fails.
4. Keep direct Gateway, Liquid, GraphQL and SDK consumers until their external
   usage is measured or they have supported replacements. Retain optional legacy
   review identity for compatibility; body-supplied customer IDs remain untrusted.
5. Consider strict Gateway-format-only verification only after deployed
   aggregate telemetry shows no legacy-format use through the complete selected
   lifetime/drain window, the unlinked recovery path is accepted, and a rollback
   setting has been rehearsed. Restoring `both` must revive any still-valid
   legacy token. Do not delete the legacy verifier or account data as part of
   this staged switch.

Only step 1's existing source controls and compatibility matrix are currently
implemented locally; step 2 still depends on the unanswered lifetime choice,
and steps 3–5 have not been newly accepted by this proposal. The deployed
telemetry window and external-consumer inventory are unavailable here. This
proposal grants no hosted setting change, issuer retirement or cutover approval.

## 5 October continuation — verifier rehearsal spans four legacy consumers

The owned-worker compatibility rehearsal now exercises the same six verifier
policies against profile, wishlist, addresses and orders for both signed HS256
formats. Accepted formats must reach each consumer; gateway-only, legacy-only,
disabled and invalid modes must reject the other format before the consumer
handler runs. The profile response also confirms the expected synthetic customer.
This makes the local rehearsal cover the main Gateway account-data consumers,
not just profile.

Fresh local checks: Commerce login/reset/session/logout/registration and buyer
link suites passed **28/28**; Gateway compatibility and aggregate telemetry suites
passed **11/11**; Gateway TypeScript passed; `git diff --check` passed. The owned
Postgres runner was attempted for `storefront-customer-profile.postgres.test.ts`
but could not start because this host has no responding Docker daemon (0 tests,
0 pass, 0 fail). The expanded real-worker matrix is therefore authored but not
accepted against Postgres yet. No issuer, verifier policy, cookie lifetime,
hosted setting or account behavior changed. The seven-day versus thirty-minute
choice and hosted telemetry/release gates remain open.

## 5 October continuation — guard the active legacy issuer census

The root session-security contract now walks the Commerce customer API and
Gateway storefront route source trees and pins the active legacy session writers
to the refreshed census: Commerce login and password-reset completion issue the
seven-day storefront cookie; Gateway login and reset completion issue the
30-minute Gateway format. A new writer fails the root contract until the F2.1
inventory and transition evidence are deliberately reviewed. The guard changes
no login, reset, cookie, verifier or compatibility behavior.

Fresh verification on 5 October 2026:

- `node --test tests/auth/session-verifier.test.mjs` — **10/10 passed**, including
  the new issuer-census guard.
- `node --import tsx --test services/api-gateway/src/__tests__/customer-session-compatibility.test.ts services/api-gateway/src/__tests__/customer-session-telemetry.test.ts`
  — **11/11 passed**.
- `docker info --format '{{.ServerVersion}}'` — unavailable: permission denied
  on the configured local Docker socket. The four-consumer real-worker/Postgres
  rehearsal remains authored but has no database execution result in this
  environment.

The seven-day versus thirty-minute owner choice remains unresolved and has
already been raised; no lifetime or signer change was made. Deployed telemetry,
external-consumer inventory, hosted drain and rollback evidence remain separate
requirements before verifier retirement. Phase 2 and the eleven-phase goal stay
active.

## 5 October continuation — owned customer-session profile journey passes

The current `storefront-customer-profile.postgres` owned suite now passes **12/12**
with zero failures, skips, cancellations or TODOs (run `3ac96d8fef6c`). The
production Gateway worker and runner-owned PostgreSQL/PostgREST exercised the
four legacy account-data consumers under the six verifier policies, a signed
Commerce shopper cookie, the real Next login and registration-entry journey,
and atomic buyer-support intake rollback. The browser-backed test initially
failed because the Identity package's `node_modules` link for its already-locked
`tailwindcss@4.1.18` dependency was missing. A temporary link to that exact
workspace package was verified before startup and removed at exit; no manifest
or lockfile changed. Two earlier diagnostic attempts are excluded from the
passing result. The sanitized [run record](P2_CUSTOMER_SESSION_PROFILE_OWNED_DATABASE_RUN_2026-10-05.json)
confirms owned-resource cleanup.

This improves local session-consumer acceptance but does not resolve the
seven-day versus thirty-minute lifetime choice, deployed usage/zero-use drain,
unlinked-customer recovery approval, hosted rollback evidence or authorization
to retire either issuer/verifier. Phase 2, F2.1 and the eleven-phase goal remain
active; preserve the current dual-format policy until the owner decision and
separate rollout gates are resolved.

## 7 October owned-session-consumer revalidation

The four-consumer verifier rehearsal and its adjacent ownership/session
regressions were rerun through the real Gateway worker with runner-owned
Postgres 16/PostgREST. `storefront-customer-profile.postgres.test.ts` passes
**12/12**, with zero failures, skips, cancellations or TODOs (`f229408e551b`).
It exercises profile/wishlist/address/order behavior under six verifier
policies for both signed formats, dual-format rollback, the active Gateway
password-login issuer, the real Commerce Next login/session/profile path,
cross-store denials and atomic buyer-intake rollback. The runner exited 0 after
its run-id-scoped cleanup check; no restored or hosted database was used.
This supersedes the earlier 5 October statement that this owned matrix had no
database execution result. The seven-day versus thirty-minute lifetime choice,
deployed telemetry and consumer drain, unlinked-customer recovery, hosted
rollback and any issuer/verifier cutover remain unresolved. No lifetime,
issuer, policy or hosted setting changed. See the [sanitized revalidation
record](P2_SESSION_CONSUMER_REVALIDATION_2026-10-07.json).

## 8 October architecture correction — identity-platform remains the sole issuer

The 5 October reversible-transition proposal above says to route Commerce login
and reset completion through a Gateway session issuer. That proposed issuer is
inconsistent with the current higher-authority Constitution ART-05 and Canonical
Systems identity entry: `identity-platform` is the sole asymmetric issuer, and
the Gateway is verify-only. Treat that sentence as superseded before any
implementation. A future, separately approved migration must use the existing
Identity buyer/storefront flow and keep the existing explicit buyer-to-store-
customer link as the authority boundary; it must not mint another HS256 token
or turn an unlinked store-customer credential into a buyer identity. Preserve
the compatibility path while the replacement and rollback are not accepted.

Current source records a 30-day platform-buyer token and a 7-day site-bound
storefront-buyer token, while the transitional legacy cookie issuers use
30-minute Gateway and 7-day Commerce formats. These are observed constants, not
an owner-approved timeout policy for migrating legacy customers. No signer,
verifier, lifetime, cookie, or hosted behavior changed in this correction.
OWASP's current session guidance requires server-enforced idle and absolute
expiration and says the values should reflect the application's risk and
usability; it does not select either existing duration for LetBuyy. The owner
choice and the separate hosted telemetry/drain and unlinked-customer recovery
gates therefore remain open.

## 8 October continuation — linked-buyer wishlist completes the local browser path

The owned `storefront-customer-profile.postgres` suite now exercises the
browser-visible wishlist path after account linking: synthetic buyer sign-in
and consent, verified buyer/store-customer link, product-detail save, buyer
BFF/Gateway mutation, and account-wishlist readback. Chromium and the real
Gateway worker use runner-owned Postgres/PostgREST; the final database
assertion binds the wishlist row to the store-customer resolved by the verified
buyer/site relationship. The suite passes **12/12** with clean disposable
resource cleanup. This closes the local browser wishlist gap only. It does
not establish hosted usage, verifier drain/retirement, broader multi-store
isolation, or Phase 2 completion. See the sanitized [browser run record](P2_BUYER_WISHLIST_BROWSER_RUN_2026-10-08.json).

## 8 October React order-view identity refresh

The linked React order list and order detail now consume the buyer-session
generation maintained by the existing storefront context. They reload after a
verified cross-tab session change and gate prior results until a read bound to
the new generation completes; stale page reads and historical-order claim
responses are ignored. Mounted tests verify buyer A→B isolation for the list
and detail plus an unavailable session check (**2/2**); the full Commerce web
suite, typecheck and focused lint pass. This is local jsdom with synthetic BFF
responses, not Chromium/Gateway/Postgres acceptance. It changes no issuer,
token, lifetime or hosted policy. See [the order-view evidence](P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md#follow-on--react-order-views-revalidate-after-buyer-switches-8-october-2026).

## 8 October continuation — bind profile edits to the loaded buyer

The canonical buyer settings form now submits the buyer ID from its verified
profile read as a comparison value. The Commerce PATCH BFF independently reads
the current buyer profile using the same captured signed, site-bound session
and checks that identity before forwarding the mutation. A mismatch returns
409 without a PATCH; an unavailable/malformed identity read fails closed with
503, while an invalid session remains 401. The BFF forwards only the allowed
`full_name`/`phone` fields; the caller-supplied ID never becomes authority and
is never forwarded to Gateway. This protects both the React settings form and
the Liquid settings island if a same-origin account switch leaves a stale form
or a shared host-only cookie changes before submission. React also ignores a
save result from an older buyer-session generation.

Focused local evidence on 8 October: the buyer proxy route suite passes
**63/63**, including verified positive write, stale-principal denial, failed
identity-preflight denial, missing expected-ID rejection and the forwarding
allowlist; the mounted React settings test passes **1/1** for same-email
canonical-ID refresh and stale response handling; the Liquid island suite
passes **3/3**, including loaded-ID submission. Commerce TypeScript passes;
scoped ESLint exits 0 with **61 UI-token warnings** and no errors;
`git diff --check` passes. These tests use a synthetic Gateway response and
jsdom; they do not prove a live Gateway/Postgres mutation, Chromium/browser
journey or hosted behavior. The broader buyer-consumer matrix, session policy,
hosted usage/drain, supported unlinked-customer recovery, and other Phase 2
acceptance requirements remain open.

## 8 October continuation — address writes compare the loaded buyer

The account-address UI now sends the canonical buyer ID from its verified
profile read on address create, edit, delete, and set-default requests. Each
Commerce BFF write compares that value with the current buyer returned by the
same captured signed, site-bound session before forwarding a mutation. A stale
principal is rejected with 409, a missing comparison value with 400, and an
unavailable or malformed identity preflight fails closed with 503. The
comparison header is not forwarded to Gateway; signed-token authorization and
Gateway ownership predicates remain authoritative. The mounted React test
changes the shared-cookie principal from buyer A to B before session
revalidation and confirms the stale A address form sends A's ID and receives a
conflict, then confirms revalidation clears A's address and draft.

Focused local evidence: buyer proxy route suite **65/65**, mounted address
page **1/1**, Commerce TypeScript typecheck, scoped ESLint **0 errors / 35
existing UI-token warnings**, and `git diff --check` pass. This uses synthetic
Gateway responses and jsdom; it is not a live Gateway/Postgres, Chromium or
hosted address mutation. Buyer-session policy, hosted-use/drain,
unlinked-customer recovery and the other Phase 2 gates remain open.

### 8 October continuation — owned browser/Postgres stale-address proof remains pending

Attempted the owned `storefront-customer-profile.postgres` suite against its
isolated Postgres 16 fixture, real Gateway worker, Commerce/Identity local
runtimes, and Chromium. An earlier owned run is recorded in
[`P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_2026-10-08.json`](P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_2026-10-08.json): 11/12 tests passed and the runner cleaned the Postgres/REST containers and network. The remaining browser test stopped at the earlier registration handoff (`page.waitForURL` timeout at `customer-session-runtime-smoke.mjs:561`), before the new stale-address mutation and Postgres no-row assertion ran. An earlier attempt did log a Commerce BFF `POST /api/buyer/addresses` response of 409 under the switched cookie, but the full suite did not pass and it does not establish the database assertion. Treat owned Chromium/Postgres acceptance as **pending**, not passed; rerun after the existing Identity registration/browser setup is stable. Focused route and mounted-React evidence above remains the accepted local evidence.

### 8 October continuation — owned stale-address retry remains blocked

The smoke test now awaits the Identity server redirect through `page.goto`
and checks its final HTTP response, rather than waiting separately for the
same navigation. Its two deliberately pending cross-tab `waitForResponse`
promises now capture rejection immediately so teardown cannot replace an
earlier browser assertion with an unhandled rejection. Node syntax check,
Commerce typecheck and `git diff --check` pass.

The isolated runner was retried with the real local Docker daemon. A no-link
attempt rendered Identity as HTTP 500 because this checkout lacks
`apps/platform/identity/node_modules/tailwindcss`. A retry with a temporary,
exactly-cleaned Tailwind link got farther but the owned browser test still did
not complete; the latest run timed out after 240 seconds, and a subsequent DB
test also hit `spawnSync docker ETIMEDOUT`. The run report
[`P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_UNHANDLED_FIX_2026-10-08.json`](P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_UNHANDLED_FIX_2026-10-08.json)
records 10/12 and confirms disposable Docker cleanup. The prior linked retry
report records 11/12 with the browser runtime ending on a closed-page
`waitForResponse`; that failure is no longer allowed to mask earlier test
errors. Neither retry reached an accepted stale-address POST plus database
no-row assertion. Treat the browser/Postgres evidence as **pending**. The
workspace Identity dependency setup and the long-running browser journey need
stabilization before another owned run; do not infer a product pass from the
focused route/jsdom checks.

## 10 October continuation — owned stale-address journey passes

The browser harness now provisions and exactly removes the missing temporary
Identity Tailwind link, waits for visible product/list states rather than
Chromium's flaky `networkidle` threshold, records bounded browser-stage traces,
and supplies a stale buyer-A profile only after the real profile BFF confirms
that the shared signed cookie belongs to buyer B. The stale address form then
submits buyer A's loaded ID to the actual Commerce BFF under buyer B's cookie.
The BFF returns 409 and the browser renders the conflict; the owned Postgres
assertion confirms no address row was inserted for either buyer. The run uses
owned Postgres 16/PostgREST, the real Gateway worker, local Commerce/Identity
runtimes, and Chromium. The focused executable suite passes **12/12**, with
disposable container/network/volume cleanup verified; see
[`P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_PASS4_2026-10-10.json`](P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_PASS4_2026-10-10.json).

This closes the local end-to-end stale-address browser/Postgres requirement
for create denial under a switched buyer cookie. It does not prove hosted
behavior, buyer-session policy, hosted-use/drain, unlinked-customer recovery,
or Phase 2/eleven-phase completion. Earlier 8 October reports remain in the
record as failed attempts; this 10 October report is the accepted successful
run.

## 10 October continuation — owned stale-profile write is refused after buyer switch

The same local Chromium/Gateway/Postgres journey now tests both profile and
address drafts after another tab changes the shared host-only cookie from buyer
A to buyer B. Before the profile form is presented, the real `/api/buyer/profile`
read confirms B; a browser adapter then deliberately restores A's previously
loaded profile snapshot. Saving A's stale draft reaches the real Commerce BFF
under B's cookie, returns 409, and renders the conflict in the page. The owned
Postgres assertion confirms neither buyer profile was changed. The existing
stale-address create check then runs in the same browser journey and confirms
no address row for either account.

The executable `storefront-customer-profile.postgres` suite passes **12/12**
with no failures, skips, cancellations or TODOs (`2794bd231162`); all runner-
owned containers, network and volumes were removed. The first sandboxed
attempt (`06f82191424b`) executed zero tests because it could not reach Docker;
it is preserved as an infrastructure attempt, not counted as a test failure.
The focused Commerce buyer proxy suite passes **65/65**, mounted BuyerSettings
passes **1/1**, Commerce typecheck, smoke-script syntax and diff checks pass.
See the [successful owned report](P2_BUYER_PROFILE_STALE_FORM_OWNED_RUN_PASS2_2026-10-10.json)
and [zero-test sandbox attempt](P2_BUYER_PROFILE_STALE_FORM_OWNED_RUN_2026-10-10.json).

Commands: `node scripts/governance/run-executable-suites.mjs --suite
services/api-gateway/src/__tests__/owned-db/storefront-customer-profile.postgres.test.ts
--kind gateway-db --jobs 1 --log-dir
/private/tmp/letbuyy-profile-stale-ownedpass2-20261010 --json-out
docs/evidence/phase2-2026-09-27/P2_BUYER_PROFILE_STALE_FORM_OWNED_RUN_PASS2_2026-10-10.json`
exited 0; `pnpm --filter @letbuyy/customer-web exec -- node --conditions
react-server --import tsx --test src/app/api/buyer/buyer-proxy-routes.test.ts`
exited 0 (65/65); the equivalent `pnpm --filter @letbuyy/customer-web exec
-- node --import tsx --test
src/components/storefront/settings-client.test.tsx` exited 0 (1/1);
`pnpm --filter @letbuyy/customer-web typecheck`, `node --check
apps/commerce/web/scripts/customer-session-runtime-smoke.mjs`, and
`git diff --check` exited 0. The sandboxed initial runner command exited 1
before test execution; report 06f82191424b records 0 tests and no resources.

This closes local stale-profile and stale-address-create denial for the tested
cross-tab buyer switch. It does not prove hosted behavior, the unresolved
seven-day versus thirty-minute policy, the complete legacy consumer migration,
hosted-use/drain, unlinked-customer recovery, or Phase 2/eleven-phase closure.

Next F2.1 transition work remains gated on the owner's pending seven-day versus
thirty-minute storefront-session choice. Keep both legacy formats accepted and
preserve current sign-in/reset behavior until that choice is recorded; hosted
telemetry, drain and cutover still require separate evidence and authorization.

## 10 October continuation — owned stale-review cross-tab journey passes

The review form now sends its loaded buyer ID as a compare-only header; the Commerce BFF rechecks the canonical profile using the current signed, site-bound session before review mutation. The owned Chromium journey loads a private draft as buyer A, switches the shared cookie to buyer B in a sibling Identity tab, and submits the still-mounted A form before focus revalidation. The BFF returns and renders 409 before the Gateway writer; the owned Postgres assertion confirms there is no review for either buyer. The `storefront-customer-profile.postgres` suite passes **12/12** and runner cleanup is empty. See [`P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json`](P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json) and the detailed [review acceptance record](P2_BUYER_REVIEWS_ACCEPTANCE.md#10-october-owned-browserpostgres-follow-up--stale-review-is-refused-before-revalidation). Focused BFF tests pass 67/67, mounted review identity 1/1, typecheck, syntax and diff checks pass; the Gateway review-writer database suite separately passes 4/4. This local result does not resolve the session-lifetime decision or prove hosted use/drain, issuer retirement, Phase 2 closure, or the full programme.

## 10 October continuation — stale review drafts are bound to the loaded buyer

The review form sends its verified buyer ID as a comparison-only header. The
Commerce review BFF checks that ID against a fresh profile read made with the
captured signed storefront session and resolved site before any canonical
review mutation. A cross-tab buyer change returns 409 with a review-specific
reload message; missing buyer metadata returns 400 and an unavailable identity
preflight returns 503. The value is never used as Gateway authority or included
in the review payload.

Focused evidence: buyer proxy routes **67/67**, mounted review identity
regression **1/1**, Commerce typecheck and `git diff --check` pass. The separate
Gateway owned-Postgres review writer suite is **4/4** (`e72cf325c9b4`); cleanup
is empty. The successful [owned run report](P2_BUYER_REVIEW_IDENTITY_OWNED_RUN_PASS_2026-10-10.json)
and initial zero-test [Docker preflight record](P2_BUYER_REVIEW_IDENTITY_OWNED_RUN_2026-10-10.json)
are preserved. This closes only the local stale-review BFF boundary and mounted
draft reset; it is not Chromium coverage of the new guard, hosted acceptance,
session policy, hosted-use/drain, or Phase 2 completion. The seven-day versus
thirty-minute owner decision remains pending; preserve both legacy formats and
current sign-in/reset behavior meanwhile.

The review form sends its loaded buyer ID as a compare-only header; the Commerce BFF rechecks the canonical profile using the current signed, site-bound session before review mutation. The owned Chromium journey loads a private draft as buyer A, switches the shared cookie to buyer B in a sibling Identity tab, and submits the still-mounted A form before focus revalidation. The BFF returns and renders 409 before the Gateway writer; the owned Postgres assertion confirms there is no review for either buyer. The `storefront-customer-profile.postgres` suite passes **12/12** and runner cleanup is empty. See [`P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json`](P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json) and the detailed [review acceptance record](P2_BUYER_REVIEWS_ACCEPTANCE.md#10-october-owned-browserpostgres-follow-up--stale-review-is-refused-before-revalidation). Focused BFF tests pass 67/67, mounted review identity 1/1, typecheck, syntax and diff checks pass; the Gateway review-writer database suite separately passes 4/4. This local result does not resolve the session-lifetime decision or prove hosted use/drain, issuer retirement, Phase 2 closure, or the full programme.

**10 October owned stale-order cross-tab acceptance:** the focused suite seeds a buyer-A-linked synthetic order, verifies buyer A's actual BFF list/detail, then has a sibling Chromium tab sign in as buyer B. It rehydrates the captured buyer-A responses to exercise already-rendered client data, verifies those rows are hidden during held session revalidation, and observes the real buyer-B list return empty and detail return 404 through Commerce, Gateway and owned Postgres. SQL confirms the link remains with A and B has no link. The successful focused executable run passes **12/12**, with zero skips/cancellations/TODOs and empty cleanup; see [`P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-10.json`](P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-10.json) and the [buyer-orders acceptance record](P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md#10-october-continuation--owned-cross-tab-order-visibility-journey-passes). The initial Docker-preflight attempt and intermediate harness retries are preserved as separate reports. The mounted React test remains distinct 2/2 jsdom coverage. This is local evidence only: no hosted result, session-policy decision, or Phase 2/eleven-phase closure is implied.

## 10 October continuation — support-page cross-tab failure journey is prepared; owned runtime blocked before tests

The existing owned `storefront-customer-profile.postgres` Chromium smoke now keeps buyer A's real support page mounted through a sibling Identity sign-in as buyer B. It holds a conversation response fetched through the actual Commerce support BFF and Gateway, then checks that tickets, messages, and a reply draft disappear while buyer-session revalidation is held; the delayed buyer-A response is released before the new session and must not repopulate the page. Buyer B must receive an empty support list, and the owned Postgres assertion checks that the original ticket remains linked only to buyer A. The harness changes pass `node --check`, the mounted support/provider test passes **1/1**, the support BFF route contract passes **6/6**, Commerce typecheck passes, and diff check passes.

The owned integration runner was invoked once for the existing suite and stopped at Docker preflight before any suite tests ran: `runId 61f61c2aa6ec`, **0 tests**. The sanitized [run report](P2_BUYER_SUPPORT_CROSS_TAB_OWNED_RUN_2026-10-10.json) records that no real Docker daemon answered `docker info`, with no resources started and no cleanup failures or remaining containers, networks, or volumes. This is an infrastructure block, not a product pass or test failure. Rerun this same owned suite when the local Docker daemon is available; do not create a parallel fixture. The earlier support UI/BFF result remains local synthetic evidence only. Session lifetime, hosted use/drain, F2.1 retirement and the remaining Phase 2 and eleven-phase criteria remain open.

## 13 October continuation — owned support cross-tab journey passes

The prior 10 October zero-test Docker-preflight status is superseded by the
successful retry below; its preflight report remains preserved as history. In
the owned Chromium/Postgres/Gateway suite, buyer A's real support ticket and
conversation are loaded through Commerce, then a sibling Identity tab switches
the shared session to buyer B. The test holds the actual buyer-A conversation
response at the browser commit boundary, verifies A's ticket, message, and reply
draft stay hidden during revalidation, releases the real response after the
switch, and verifies it cannot repopulate the page. Buyer B's real support list
is empty, and the database assertion confirms the ticket remains linked only to
A. The `storefront-customer-profile.postgres` suite passes **12/12** with zero
skips, cancellations, or TODOs; test container, network, and volume cleanup is
empty. See the [successful run report](P2_BUYER_SUPPORT_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-13.json).
The runtime harness passes `node --check`, and scoped `git diff --check` passes.
This is local owned integration evidence for this failure journey only; it does
not establish hosted behavior, resolve the seven-day versus thirty-minute
session policy, or close Phase 2 or the eleven-phase programme.

## 13 October continuation — Liquid settings uses the sanitizer-safe link intent

The runtime-composed Liquid buyer settings island posted
`name="action"` to the account-link start route, despite that route's explicit
contract and the Liquid sign-in form using the sanitizer-safe
`name="intent"`. The settings island now emits `intent=link_store_customer`,
retains the same native same-origin POST, and still returns to that store's
settings path. A jsdom island regression verifies the generated form method,
same-origin action, intent, return path, and absence of the clobber-prone
`action` field. The route's same-origin/security and intent contract tests pass
**5/5**; the Liquid settings island suite passes **5/5**; whitespace validation
passes. This is local component/route-contract evidence, not a newly exercised
Chromium or hosted Liquid-account journey. The seven-day versus thirty-minute
session policy, legacy-consumer retirement and remaining Phase 2 requirements
remain open.

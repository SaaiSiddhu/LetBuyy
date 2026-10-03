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
| Canonical sign-in | Existing buyer start/callback/session/logout and site-bound audience; no app/gateway replacement token minting | OPEN |
| Explicit merchant relationship | Correct store-customer ID from verified relationship; conflicts/disabled/unmapped cases denied; order links separate | OPEN |
| Connect customer journeys | Profile, addresses, wishlist, loyalty, reviews and checkout association; real worker/database and normal UI prove two-store/two-buyer isolation and revocation | OPEN |
| Compatible verifier transition | Separate rules per format; explicit legacy compatibility mode; no cross-realm downgrade | OPEN |
| Stop local legacy issuance | All active app/gateway customer signers retired with compatible auth/federation paths; negative controls detect reintroduction | OPEN |
| Drain and rollback | Every consumer/instance counted without raw tokens; approved observation window reaches zero legacy acceptance; verifier rollback rehearsed without restoring distributed signing | OPEN; no duration or hosted change inferred |
| Production readiness | Real KMS/verifier, callback/domain coverage, delivery, exact deployed candidate and owner release authorization | NOT VERIFIED / NOT DEPLOYED |

A service credential proves a service, not its claimed customer ID. Canonical issuance must follow verified buyer flow and live relationship checks. Browser, token, gateway, database and rollout evidence remain distinct.

Primary research checked 2026-10-03: [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), sections 3.1 and 3.8–3.12, supports JWT algorithm/issuer/subject/audience and distinct validation constraints. [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) supports authorization-code/PKCE and redirect constraints. Neither chooses business policy or certifies LetBuyy code.

D04 bootstrap/assignment/recovery authority, MFA enrollment, high-risk second approval and sender ownership remain unanswered. D05 export release, retention, deletion and legal-hold policy remain unanswered. Continue dependency-ready work; ask when a missing decision is necessary for the concrete implementation. No approval, customer inventory, credential, observation duration or cloud access is invented.

## 3 October implementation checkpoint

The first audience connection is locally accepted at `26660485`; see [acceptance](P2_STOREFRONT_BUYER_DATA_ACCEPTANCE.md). Five real-worker database scenarios and 32 Next proxy tests now pass; exact source governance 114/114 passes. Browser navigation and whole legacy retirement remain open. Next active correction: atomic canonical default-address mutation, with red tests being added before changing the existing two-request writer.

Atomic default-address correction is locally accepted at `70baef80`; [evidence](P2_BUYER_ADDRESS_ATOMIC_ACCEPTANCE.md) records 18/18 database tests, rollback/reapply parity and exact governance 114/114. Next active work: normal account surface/caller inventory and canonical store-bound linked-order read; no normal commerce caller currently consumes the repaired buyer profile/address BFFs. Preserve Liquid and verified order ownership when connecting those surfaces.

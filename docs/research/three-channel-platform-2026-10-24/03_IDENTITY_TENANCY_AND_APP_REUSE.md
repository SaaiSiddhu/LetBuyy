# Shared identity tenancy and application reuse

## Same login and separately scoped authority

The user-facing target is one LetBuyy account that can enter every approved app. Technically, a person may have verified links to distinct buyer and workforce principals under the same issuer. A common account experience does not require one unrestricted token, merging buyer data into merchant tables or sharing refresh credentials between app binaries.

Current source already has distinct merchant, buyer and storefront audiences in [identity-issued sessions](/Volumes/Projects/LetBuyy/apps/platform/identity/src/lib/auth/identity-issued-session.ts:1). Migration 223 protects the global buyer account and cross-store links from tenant reads. The current [principal repository](/Volumes/Projects/LetBuyy/services/api-gateway/src/identity-foundation/principal-repository.ts:1) is explicitly a shadow/future-cutover path; its presence does not prove complete cross-realm account unification. The [account switch route](/Volumes/Projects/LetBuyy/apps/platform/identity/src/app/api/auth/switch/route.ts:1) also documents limits on full multi-account linking. Complete the existing canonical foundation instead of creating a third account system.

### Recommended sign-in journey

1. App begins authorization with its registered client, state, approved callback and PKCE verifier.
2. Existing issuer authenticates the person or reuses an applicable issuer session.
3. Issuer creates a client/audience-scoped session and returns verified subject information.
4. Server lists only that person's current business memberships or buyer capabilities.
5. Person selects an authorized business/location where necessary.
6. Every API command rechecks applicable live permission; the client selection is not authority.

Cross-realm linking requires proof of both applicable identities or an approved canonical enrollment flow. Matching an email, phone, GST number or display name is insufficient. The existing buyer/merchant realm barrier remains intact while linked account UX is completed. [Native OAuth best practice](https://www.rfc-editor.org/rfc/rfc8252), [PKCE](https://www.rfc-editor.org/rfc/rfc7636), [OAuth security](https://www.rfc-editor.org/rfc/rfc9700).

## Dedicated apps without duplicate systems

| Source | Current source class | Target use | Required adaptation |
| --- | --- | --- | --- |
| apps/merchant/mobile and apps/merchant/web | Existing Merchant clients | Primary Storefront management | Preserve core ownership; expose channel enablement and shared stock context |
| reference/apps/marketplace-seller | Inert preserved Seller donor | Dedicated Marketplace Seller app source candidate | Reuse sound screens; replace Firebase auth/Firestore, fee assumptions and mock bank behavior with canonical contracts |
| reference/apps/store-operations | Inert Store Ops donor | Dedicated Partner Ops app | Promote source with history; replace empty token/API assumptions and incomplete handover |
| apps/deferred/delivery/mobile | Deferred Delivery source | Dedicated Delivery app | Canonical membership/API, assignment/custody, proof, cash and device tracking |
| apps/marketplace/mobile | Existing customer application | Marketplace and Quick modes | Preserve identity/package; implement mode context, native prepaid and Quick workflows |
| apps/marketplace/web | New proposed frontend | Customer Marketplace and Quick web | Shared TS UI/types/API and canonical buyer/checkout authorities; new responsive presentation and web sessions |
| apps/quick/store-ops/web | New proposed frontend | Location-scoped Store Ops web | Reuse shared UI/API and Merchant patterns through package exports; new browser workflows and recovery |
| apps/internal/console | Existing console | Seller review, partner admission, dispatch and recovery | Extend current permissioned workspaces |
| apps/commerce/web | Existing buyer web | Independent merchant storefronts | Preserve Liquid and canonical checkout boundaries |
| apps/platform/identity | Existing issuer | All app sign-in | Approved clients, callbacks, verified links and scoped session lifecycle |

The Seller donor contains unique onboarding, dashboard, listing, order, KYC and statement UX. Its local rules record 171 Dart files at import, with 167 unique files. This is an asset inventory, not shippability. Current [approval service](/Volumes/Projects/LetBuyy/reference/apps/marketplace-seller/lib/services/product_approval_service.dart:1) writes Firestore; [bank service](/Volumes/Projects/LetBuyy/reference/apps/marketplace-seller/lib/services/bank_account_service.dart:1) includes mock lookup; [commission card](/Volumes/Projects/LetBuyy/reference/apps/marketplace-seller/lib/screens/dashboard/widgets/commission_breakdown_card.dart:1) reads donor commission data. Preserve useful UX, not those authorities.

Store Ops and Delivery source preservation was verified in the prior inventory: 22 and 24 Dart app/test files respectively match the original import after branding normalization; the app move retained 56 and 58 identical file blobs. No blank operational-app rewrite is required. Source promotion still needs an approved destination, workspace/identity registry updates, permissions and real end-to-end acceptance.

## Permission matrix

| Actor | Core permitted scope | Explicit denial |
| --- | --- | --- |
| Buyer | Own profile, addresses, carts, orders and support | Merchant catalog writes, other buyer orders |
| Merchant owner | Owned business/site and delegated channel management | Another legal business owned by a different tenant |
| Seller catalog staff | Authorized Marketplace catalog/listing work | Bank changes and self-approval |
| Node manager | Assigned location operations and granted stock | Other locations or unrelated owners' stock |
| Picker/packer | Current task and necessary item/packing data | Seller finance and unrestricted customer search |
| Cashier | Assigned cash handover and reconciliation | Arbitrary ledger editing |
| Rider | Current assignment, required contact and proof | Former or unassigned deliveries |
| Reviewer/operator | Current platform membership and approved review/support capability | Self-granted super-admin access |

For the initial franchise model, seller-owned goods at the seller's own location fit existing tenant stock ownership. A shared supermarket holding another merchant's goods is a different custody relationship. Do not widen the supermarket's site GUC to view every owner's data. Introduce explicit agreement-scoped access only when that model is admitted, with same-seller location tests and cross-owner custody tests.

Use transaction-local GUC/RLS and actual non-superuser tests. A service-role fixture may test application guards but cannot prove database row isolation. Test the positive control first. Preserve buyer-link privacy: merchant-facing customer records must not expose a stable platform-wide identifier that enables cross-store tracking.

## Admission work before implementation

Update the existing topology/ownership/recipient records for the dedicated Seller and Store Ops products; do not silently reactivate reference roots. Record the latest owner direction as superseding older absorption prose. Use public shared-package exports for reused UI and contracts; apps must not import other apps. Keep one catalog, inventory writer, payment verifier, ledger and issuer throughout the transition.

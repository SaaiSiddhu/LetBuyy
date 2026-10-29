# Domain and store-context parity — source and owned-database evidence

Date: 30 October 2026. Branch: `codex/merchant-mobile-parity`. Source checkpoint: `75984e1efe15b476ea5d6d587b6da7103ce34699`, based on `55975acd0da3fd39bcff56168e19b05ff598bc43`. These are bounded local/owned-fixture results, not authenticated native, hosted DNS/TLS, or production acceptance.

## Traced behavior

| IDs / actor | Web and backend contract | Native implementation | Data / provider authority | Status and remaining gate |
|---|---|---|---|---|
| 13 / Merchant | Store discovery/membership from Gateway; current actor through sole identity issuer. | `StoreContext.requestContextKey` includes a monotonic selection generation. A→B→A cannot revive an earlier request. Selection preference writes are ordered; logout waits for pending writes before removing the selection. | Backend membership/tenant authorization remains authoritative. Preferences only retain a selected ID. | Real Dart transport regression rejects an old A response after A→B→A. Native owner/staff/session-revocation acceptance remains open. |
| 52 / Merchant link presentation | Constitution Amendment 4 and `packages/tenant-core/src/index.ts` define the storefront root and exact checkout helpers. | `StoreModel.generateStoreUrl`, `publicUrl`, `previewUrl`, and domain snapshot now use the shared Dart storefront root (`STORE_ROOT_DOMAIN`, default `letbuyy.store`). Custom public links require active domain and observed TLS. | URL presentation does not grant publication, ownership, or checkout access. | Local model/widget clipboard checks. Hosted wildcard/new-store routing acceptance is still separate (53–54). |
| 57–58 / store owner | Web `settings/domains/page.tsx` → `domainsClient.list/connect/verify/setPrimary/remove/history/setRedirect` → same-origin web proxies → Gateway `/v1/custom/domains`, `/domains/verify`, `/domains/:domain/primary`, `/domains/:domain`, `/domains/:domain/history`. | `DomainSettingsScreen` + `ConnectedDomainsSection` → `DomainService` → shared Dart `CustomDomainsApi` → BFF `/v1/custom` allowlist. Shared Dart registry/connection/history contracts mirror the existing TS contracts. | `requireOwnedSite`, `DomainRequestSchema`, `site_domains`, `sites`, `set_primary_site_domain`, domain verification records; provider DNS/project/TLS evidence. | Local connect/alias/promotion/removal/history/redirect readback and modal privacy tests. Redirect choices are same-store verified hosts or the current primary. Hosted web↔native synchronization and current staff-denial UI remain open. |
| 59 / backend maintenance | Gateway exact-host verification and the existing signed maintenance/reconciliation path. | Registry refresh and explicit verify actions display persisted states; mobile does not replace the scheduler. | Server leases, site/parent binding, provider proof, finite alias drain and provider absence readback. | Owned branded-domain suite covers address/parent changes, fallback and drain cases. Nonzero hosted maintenance/provider acceptance remains open. |
| 60–62 / Merchant observes, buyer uses | Web `CheckoutDomainCard` → `domainsClient.checkout/prepareCheckout` → Gateway GET/POST `/v1/custom/checkout-domain`; `CheckoutDomainSetupSchema`; `getStoreCheckoutDomainSetup`, `prepareStoreCheckoutDomain`, `checkoutOriginForStore`. | Native secure-checkout card uses the same read/prepare endpoints and shared Dart `CheckoutDomainSetup`. It shows exact hostname, HTTPS state, currently selected origin, fallback and server-supplied CNAME/TXT records. Prepare uses a stable site-scoped key and captured request context. | `requireOwnedSite`; current `sites` primary parent; `site_domains` purpose=checkout, current parent reference, provider assignment, fresh HTTPS application proof. No client hostname derivation or arbitrary-host activation. | Local malformed/cross-site/stale-context/failure/retry/readiness tests and owned Gateway/Postgres domain suites. Normal signed cart→branded checkout and actual native/hosted acceptance remain open. |
| 63 / Merchant observes | Web `DomainDetailView`/`CustomerVerificationNotice`; Gateway domain health/verify projects `DomainCustomerVerificationSchema`; `customDomainCustomerVerification` delegates to the existing hostname-management coordinator. | `DomainHealthSnapshot` preserves typed customer-verification state; primary domain health displays ready/pending/unavailable/configuration/capacity states. TLS alone never creates a ready value. | Existing server/coordinator/Turnstile management; native client has no site-key management authority. | Local status roundtrip and no-invented-readiness test. Real registration and buyer challenge acceptance remain open. |

## Concrete defects corrected

- Default native storefront/share/preview/settings links used the retired `.letbuyy.com` storefront root.
- Mobile had no secure-checkout address/readiness/DNS view corresponding to Merchant web.
- A successful alias connection could overwrite the mobile primary-domain projection even though the Gateway kept the existing primary.
- Same-store access under a replacement actor and A→B→A selection cycles needed stronger context retirement.
- Domain status errors could expose exception text. UI failures now use fixed, recoverable messages.
- A removal acknowledgement alone could be mistaken for removal. The registry confirms absence through a subsequent read; verification pending states remain pending.

The first-pass fail-closed live registrar guard remains active. Live domain purchasing still needs verified canonical server payment proof before registrar contact.

## Evidence

- `apps/merchant/mobile/test/checkout_domain_parity_test.dart`: real Dart request preparation with controlled HTTP responses plus native widget journeys; not provider/hosted proof.
- `apps/merchant/mobile/test/storefront_link_contract_test.dart`: shared storefront root, preview and custom-domain/TLS selection.
- `apps/merchant/mobile/test/store_session_boundary_test.dart`: account isolation, unknown-store rejection, old-response retirement, A→B→A transport, selection/logout persistence ordering.
- Shared Dart API client transport/context tests: 12/12 passed.
- Owned Gateway/Postgres `store-branded-checkout-domains.postgres.test.ts`: 8/8 passed.
- Owned Gateway/Postgres `custom-domain-owned-zones.postgres.test.ts`: 2/2 passed.
- Owned runner `18910d8675cc` reported no remaining owned containers, networks or volumes. Report: `/private/tmp/letbuyy-mobile-domain-db.json`.

Current full Flutter suite is 411/411 and the actual disposable-clone governance gate passes all 114 required validators. `QUALIFICATION.json` records the source and simulator bundle/Dart payload identities.

Remaining acceptance: complete 122-item tracing, actual authenticated native interaction, both-direction web/mobile readback, physical-device/accessibility measurements, real DNS/TLS/provider evidence, signed builds, staging and release readback. Android signing prerequisites are absent in this worktree/environment. No domain purchase, deployment or production account operation occurred in this continuation.

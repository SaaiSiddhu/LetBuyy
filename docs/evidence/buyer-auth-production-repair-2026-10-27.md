# Buyer authentication production repair — 27 October 2026

Phase: PHASE-BUYER-AUTH-PRODUCTION-REPAIR-20261027. Base develop 4ba59d697. The unrelated, incomplete branded-checkout implementation is preserved at local 9f9e83ba9, outside this release.

## Confirmed defects and repair

The reported Liquid customer form sent Turnstile `size: invisible`, a widget mode rather than a supported size. Both active Liquid initializers and the React initializer now use `flexible`; challenge containers remain visible for managed interaction. Token expiry/error still removes the token. Server verification and production bypass restrictions are unchanged.

Discovery links previously initiated PKCE on storefront.letbuyy.com, which is not a tenant callback. Customer/account GET pages now move to the exact resolved public store primary host after existing publication, preview, offline and password gates. Cached discovery authorization links independently resolve the store through the existing signed internal API before moving to its primary host; they create no discovery-host PKCE cookie. Storefront host-only state/PKCE cookies are minted only after that navigation. An outage refuses sign-in; no arbitrary callback allowlist is introduced. An account-link action remains a same-origin POST on the store host.

The production Cloudflare widget settings were confirmed: accounts.letbuyy.com and letbuyy.store are authorized. Its managed mode, existing hostname restrictions and keys remain intact. The corrected canonical buyer pages use the authorized tenant host. No credential was revealed, rotated or newly created.

## Local acceptance

- Focused routing/Turnstile behavior: 8 assertions/tests passed, including verified custom-primary routing and fail-closed access modes.
- Buyer identity, realm separation, storefront access and Liquid contracts: 53 tests passed.
- All selected Commerce buyer/customer authentication tests: 17 files, 49 tests passed.
- Governed owned-Postgres browser suite: 1 complete real Identity/PKCE registration and buyer-support isolation journey passed, including two distinct buyers. It starts at the discovery /store/<handle>/customers/login path and asserts the canonical tenant origin before authorization. Production code, real owned PostgREST/PG and normal host-only cookies are used. Official Turnstile test transport is a provider fixture, not production anti-bot acceptance.
- Commerce TypeScript check and production webpack build passed.

Private receipts: /private/tmp/letbuyy-storefront-recovery-20261027/buyer-auth-{focused,contracts,app-tests}.tap, buyer-auth-owned-browser.json, buyer-auth-typecheck.log and buyer-auth-commerce-build.log. Exact command/history logs are retained privately. Governance and hosted acceptance are recorded below once observed; local acceptance is not production sign-in proof.

## Boundaries

No database migration, identity issuer change, password reset, new credential, CAPTCHA bypass, payment/order, custom-domain claim or public store publication occurs in this repair. The existing root-alias storefront browsing and preview behavior remains; buyer account pages acquire a canonical host. Existing verified custom domains remain authoritative.

Razorpay, themed checkout and store-branded checkout are continuing work. The labelled production QA store has no active payment_credentials and production API lacks Razorpay key bindings. A provider payment cannot be truthfully declared operational until merchant credentials and the live canonical path are qualified. No financial transaction is authorized by this phase.

## Qualified release gates

Candidate 888d30109 passed the real gate lane: 114 validators executed, zero failures/skips. The first run caught production-domain literals in the new tests; the fixtures now use configured synthetic domains, and the literal guard remains unchanged.

The owned database release selection passed tenant red-team, money ledger, checkout, concurrent order creation, idempotency locks, buyer authorization codes, auth repair and authenticated checkout. Reconciliation traversal separately passed all 11 tests using the runner's explicit `--prepared-transactions 2` profile. Earlier attempts lacking that child profile failed the fixture-admission assertion and are retained, not counted as passes. No test assertion or production database setting was weakened.

Focused ESLint passed with existing unrelated design-system warnings. Source integration into develop is b2c25771b. Full managed staging Accounts/Merchant buyer sign-in remains a known deployment-configuration limitation; it is not claimed from local browser evidence.

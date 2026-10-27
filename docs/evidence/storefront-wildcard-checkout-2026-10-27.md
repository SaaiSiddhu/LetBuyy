# Production storefront wildcard and discovery repair — 27 October 2026

Phase: `PHASE-STOREFRONT-WILDCARD-CHECKOUT-20261027`. Base: deployed `584037b53`.
Owner decisions: tenant stores stay under `letbuyy.store`; Circuit is first/default;
the public directory belongs at `storefront.letbuyy.com`; retire only reviewed DNS.
This phase preserves existing merchant designs, tenant guards, RLS, private-store
access, signing/replay protection and the Workers Free plan. Single agent.

## Implemented contracts

- Empty Liquid catalog pagination has no fabricated page number or navigation.
  The actual compositor regression first reproduced `Page 1 of 0`, then passed.
- Paired migration398 adds one fixed, service-only public directory projection.
  Only nondeleted, published, public stores qualify. Cursor pages are capped at24;
  account/configuration fields cannot be selected. Counts describe this same
  population: public stores, eligible catalog themes, active products and delivered
  orders. Private/draft/offline stores and deleted records are excluded.
- The shared contract is validated by Gateway and SDK. An unavailable read is
  distinct from an empty directory; counts render immediately and tenant links use
  the configured root. Public eligibility is read afresh, without shared caching.
- The adjacent finder now reads exact public handles, keeps canonical subdomain
  precedence, returns an ordinary miss for unknown handles and avoids the rejected
  unscoped fuzzy scan. Query changes retire pending results and redirect timers;
  an outage is shown as unavailable. Real mounted UI and Gateway/PG controls cover it.
  A further negative control reproduced a private canonical handle falling through
  to another public store's legacy name. Resolution now decides canonical ownership
  before checking public eligibility, so private handles cannot be captured this way.
- Creation/publication checks the verified wildcard on the configured Commerce
  project, without adding individual Vercel domains. Wrong project, preview branch,
  environment, redirect, unverified ownership, DNS failure and missing credentials
  remain pending. Existing published receipt replay survives provider unavailability.
- Future SQL inserts default to Circuit, matching the existing API creation default.
  Existing Core/modern drafts and saved configurations are not overwritten.

## Current verified evidence

Private evidence: `/private/tmp/letbuyy-storefront-recovery-20261027/`.
Encrypted database recovery material remains under the previously approved
`/private/tmp/letbuyy-production-release-20261025/fresh-recovery-20261026/`.
No record contents, credentials, bearer URLs or encryption keys are recorded here.

- Actual owned Gateway/PostgREST/PG: directory eligibility, nonzero product/order
  counts, cursor/revocation, strict payload/query validation, service-only ACLs,
  rollback and new-store idempotency/wildcard controls pass. Public finder positive,
  hidden-store and unknown-store controls pass against the real owned database.
- Fresh production and staging exports are private/encrypted, with decryption hash
  verification. Each was restored into isolated network-disabled Supabase PG17.
  Managed CLI identity Up/Down/Up passed; all522 retained tables stayed byte-equivalent;
  original migration aliases/history survived; final rehearsed history is326.
  No Supabase catalog helper or disabled constraint/trigger was used.
- Commerce and Merchant production builds passed; Gateway1808 unit tests,
  shared contracts18 and cross-runtime contracts361 passed. Final UI/build/lint
  and real governance qualification are tracked separately before activation.
- A broad behavioral run found the newly required owned-lane inventory entry and
  two existing verification defects. Clean584 reproduces the collection missing-pool
  failure and exact import-string assertion. The fixture now removes actual pool
  connection sources; canonical tenant transactions intentionally ignore the optional
  storefront-read flag. Required import bindings remain asserted independently of
  additional bindings. No production pool/role behavior was changed.
  A resource-conservation lifecycle test overlapped newly created rehearsal fixtures;
  its isolated rerun must complete after other fixtures stop. This is not a green
  full-gate claim.

## Hosting and DNS changes already applied

- After explicit action-time approval, saved the exact wildcard ownership TXT and
  verified `*.letbuyy.store` on Commerce. Existing wildcard CNAME and ACME NS pair
  remain. A never-registered hostname has valid TLS and the application's unknown-store
 404; Snaz returns200 Liquid. Its individual alias remains pending final removal proof.
- Attached and verified `storefront.letbuyy.com`, saved its provider-recommended
  DNS-only CNAME and ownership TXT. TLS and provider configuration pass. The old
  deployed app still returns application404 there until the new origin configuration
  is built. Commerce and Merchant production public-origin values are saved with
  both new and old platform aliases; tenant root and private secrets are unchanged.
- Owner explicitly approved the reviewed28-record retirement list. Native Cloudflare
  removed8 `.com` and20 `.store` records. Independent before/after BIND exports match
  exactly those deletions plus the two new discovery records; other exported records
  are identical. Live apps, mail/SPF/DKIM, staging, CDN, wildcard, certificate delegation
  and unproven records were retained. Provider-managed records were not selected.
  Removing DNS does not itself delete Vercel projects or their saved domain aliases.

## Remaining activation and acceptance

Final real governance gate; source integration `develop → staging → main` without
force push; managed staging migration and actual staged HTTP/compiled acceptance;
production migration/API and qualified web builds; real new production store with
Circuit, wildcard host and no individual Vercel registration; remove Snaz's individual
alias and recheck HTTPS; actual controlled checkout and natural production domain cron;
final Merchant/public-directory browser checks. No real payment, delivery, blanket
store publication or overwritten merchant design is authorized by this report.

The corrected read-only cron observer targets the verified deployed Queue name.
The previous observer incorrectly appended `-production` and returned Worker10007.
No unrelated financial/message sweepers were manually invoked. The domain cadence is
`17 */6 * * *`; the minute notification tick does not run this reconciler.

The first real gate was113/114: the required schema-derived registry lacked migration398 provenance. Regeneration adds that one source filename to sites and a generation timestamp; all317 tenant scope entries and columns are unchanged. Full validator rerun follows this correction.

## Production activation and independent acceptance — 27 October, 11:52 IST

Qualified source `b0a050644394c418e30cc236b8f98ce5602e4a0b` has exactly the
same Git tree as release `604d62d39f850230757d92fd24b51058007244b0`.
The release was pushed develop → staging → main, with fast-forward promotions
and no force push. All four production web apps are READY at release604.
All four production Workers match the qualified module hashes; every provider
binding and encrypted-secret inventory is preserved, including API's64-variable
Free limit. Production398 committed through one native TLS-verified backend;
history326, pre-existing history and merchant/catalog/version row hashes match.
The prior support-free encrypted PG17 Up/Down/Up rehearsals preserved all522 tables.

- Actual114 governance gate passed on finalb0. Actual SDK production directory,
  strict query validation,10-theme catalog/Circuit-first, public finder and unknown
  miss pass. The signed-in staging browser rendered its real1-store/10-theme
  directory, Circuit empty product list without Page1of0, and full empty cart.
  Vercel's CLI SSO302 was not treated as an application failure or bypassed.
- Production `storefront.letbuyy.com` returns200 with real recently launched public
  stores. A new labelled QA store was created through ordinary browser onboarding:
  `qa-wildcard-20261027`, Circuit default and14-day trial. Read-only database and
  provider controls confirm its persisted Circuit bundle and no individual Vercel
  domain404 while the production wildcard is verified. After the owner's explicit
  QA publication approval, it serves Circuit over anonymous HTTPS200. Its sole
  synthetic nonphysical1-INR product is visibly labelled Not for sale/No Fulfilment.
  No payment, order, delivery or external outreach was submitted.
- Removed only the explicitly requested `snaz.letbuyy.store` individual Vercel entry
  after positive wildcard proof. Exact entry now404, wildcard remains verified,
  and Snaz still returns200 Liquid through the wildcard. Neither zone has an
  explicit Snaz DNS record. The unknown never-registered preflight host has valid
  HTTPS and application404, rather than a provider deployment404.
- Observed the actual production Queue cron `17 */6 * * *` at11:47 IST. The signed
  domain job completed with HTTP200/success, no deferred/provider-null results,
  invocation outcome ok. Checked0/changed0 reflects no queued custom domains;
  this is actual scheduled-call/authorization/reader proof, not a nonempty external
  custom-domain lifecycle claim. No unrelated job was manually triggered.
- Actual production buyer cart reached the separate secure checkout origin with
  the1-INR server cart/summary. Address entry was inspected; payment/confirmation
  and real-provider settlement are not claimed. The owner then requested verified
  per-store checkout addresses, approved in the separate bounded host proposal.

## Broader test accounting and observed label refinements

The broader owned run executed249 suites/2050 assertions:2045passed,5failed,
with no leaked resources. The corrected collection missing-pool control separately
passed. The two transport/Turnstile-timing browser failures passed in an isolated
rerun (MFA1 and published-storefront recovery4; zero skips). Lifecycle7 also passes
in isolation. The historical admitted389-catalog test fails its pinned old catalog
hash equally on clean584; its frozen admission was not rewritten to force green.
The old native Core-default canary expects Core although the owner's current new-store
default is Circuit; live onboarding independently proves Circuit. This is not a
claim that every broad historical gate is green. Money, tenant red-team, checkout
and current theme owned controls ran in their canonical owned lanes; raw standalone
DB tests without their fixture fail by method and were not called product failures.

The final browser sweep found three hardcoded Merchant store-address labels and an
Identity onboarding hint advertising retired names. The labels now use the existing
configured-root helper, and onboarding shows the actual Circuit default rather than
an unused industry recommendation. Merchant272+818+289 and Identity51+6 package
test groups pass (groups are not a unique platform total); affected typechecks and
focused lint pass, with existing warnings. Both affected production builds pass.
These four presentation-only files are retained for qualified integration; the
hosted604 verification above does not imply those later label bytes are live.
All34 screenshots rewritten by the broad tests were copied privately and the exact
tracked historical files restored. No user edit was discarded.

Private receipts: `migration398-production-result.json`,
`workers-production-b0-deployment.json`, `vercel-production-builds.json`,
`production-b0-http-acceptance.json`, `production-wildcard-https-v2.json`,
`production-qa-created.json`, `snaz-individual-domain-removal.json`,
`production-domain-cron-observation-v6.json`, `browser-retries-final-result.json`,
and `lifecycle-isolated-final.log` under the private phase evidence directory.


## Payment qualification follow-up

The preserved payment candidate was aligned locally with the released auth baseline at168919126. Razorpay now receives the same sanitized published checkout primary/logo instead of a fixed purple/generic missing image; relative logos resolve only against the verified storefront and unsafe/absent assets are omitted. All ten catalog palettes/explicit overrides are tested. Focused branding16/16, corrected package typecheck, production Commerce build, Gateway1813/1813 and362 contracts passed. Lint has no errors and the touched-file warning count decreases73 to71. Four fresh owned checkout suites pass41/41, covering browser COD/online, canonical capture/ledger idempotency, authenticated/guest cart ownership and contact re-entry, with clean owned cleanup. These are isolated fixtures, not real provider payments or production order submission.

The actual114 gate initially failed two controls: direct sites-root read proof and literal key-shaped synthetic fixtures. No failure was waived. Provider fixture identifiers are now generated ephemerally rather than committed literals; the four targeted credential/CSV tests pass. Automatic approval review refused a static tenancy-gate change until the owner approved the exact private payment-root-site-read-review.json proposal and patch: “Approve the narrow correction and tests”. The checker now recognizes only an exact eq(id) read of the root sites row, matching the existing runtime guard. Unfiltered/IN-list root reads, root primary-id-only writes and child-table primary-id-only reads remain denied. Five scope tests pass, including every denial; runtime guards, RLS and grants are unchanged. The final whole gate and cross-tenant regression remain separate pending checkpoints. No credential has been installed on a production merchant by these tests.


The final combined source at7f539034d preserves the releasedfd1095fe7 customer/account repair. Gateway1813/1813, contracts362/362, all Merchant package groups274+818+291 and the four final owned checkout suites41/41 pass. Actual tenant red-team RT1–RT9 passes2/2 in a fresh owned PostgreSQL cluster; cleanup reports no remaining containers/networks/volumes. Both Commerce and Merchant production builds passed at9b70d08ae; the only subsequent runtime-equivalent change corrects a test loader to execute the real bounded retry helper.

The repeated114 gate reached113pass/1fail: the secret scanner correctly identified the one now-obsolete exact-value exception for the regenerated checkout-browser provider fixture. That exception is removed, reducing the registry; no new exception or bypass was added. All8 secret-scan behavioral tests and the real environment validator pass. A final clean-clone whole gate remains required before staging. No production payment key, provider order or payment was changed.
## Coupon receipt follow-up (27 October, implementation in qualification)

The owner reports two coupon orders without code/saving/final receipt details. A read-only query of only the exact QA store's money/coupon fields proves both orders were stored without a coupon and with zero discount. Customer/contact/order identifiers were not recorded. The hosted Apply UI only changed browser state; neither hosted payment delivery request submitted the selected code, and the order command only read the original signed cart code. Historical receipts are preserved; no coupon/discount or charge is invented for past orders.

The repair completes the already-existing checkout_sessions.discount_codes field through the same signed handoff, idempotent delivery operation and compare-and-swap. The backend's existing promotion RPC validates the selected code against the signed subtotal, verified shipping and saved contact; a reviewed-savings mismatch stops before payment/order effects. An explicit empty selection removes a coupon, while untouched older clients retain the signed cart choice. The canonical order writer remains the price, eligibility, redemption and ledger authority. Percentage quote rounding retains the explicit /100 divisor and rounds to paise; six arithmetic cases and core21 checks pass. The first ambiguous patch was stopped by automatic review with no changes; the clearer formula and backend validation were then applied after those controls passed.

Read-only buyer list/detail/BFF and Merchant receipts now carry saved coupon and money fields. A pure rendering projection updates only exact shipped account source definitions across all ten first-party Liquid themes; frozen factories, persisted releases/identity/checksum/settings and customized templates remain unchanged. All ten actual Liquid renders, inert hostile coupon text and source preservation pass16 tests; buyer money5/BFF4, Merchant mounted receipt4 and Gateway focused17 pass, with Gateway/Commerce type checks clean. Owned browser persistence, final broader gates, staging and production remain pending.

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


Combined candidatecf6729b5d passes all50 owned assertions across checkout browser4, buyer ownership20, contact re-entry7, authenticated checkout10 and private storefront orders9. The final8de5 browser rerun also passes50/50 and explicitly changes a real coupon rule between review and delivery: checkout409s before any payment intent/order, then reapplication creates exactly one order with the newly acknowledged saving. Both runs have zero resource cleanup failures/remaining resources. Gateway1814 units pass; an unintended broader database stage from the package-level test command was gracefully interrupted (exit130), not represented as green or as a product regression; final acceptance uses the bounded owned runner. No production write occurred.

The broader Commerce package lane initially caught a server-only auth test launched under client Node conditions; its entry is moved into the existing react-server conditions stage, with the server-only guard preserved. The complete repeated lane passes189+173+1607+184+25 checks. The original subtotal-field guard also correctly caught missing coupon fields in the surviving compatibility reader; both existing SELECT branches are completed and Gateway units pass. Native production Merchant Customers was independently observed showing2 rows with search/order columns and no loading error, on deployedfd1095fe7.

Display estimate rounding now uses integer paise and basis points, agreeing with PostgreSQL half-paise rounding (20.10 at5%=1.01);1134 standalone arithmetic controls and the expanded core21 suite pass. The backend promotion/order/ledger functions remain unchanged. Final builds, actual114, final contract/money controls, hosted staging and production acceptance still gate the combined release. The two original production orders remain coupon-free/undiscounted, reflecting their actual saved receipts.


### Coupon/payment candidate a83 and observed Shop-all route repair

The combined coupon/payment source a83b5483a passes the actual114/114 governance gate, Gateway1814 units and strict typechecking, contracts362, Merchant274+818+292 and Commerce189+173+1607+184+25. Both production web builds pass atd1e85 with identical app/package source througha83. Owned coupon/order/buyer journeys pass50 controls; the final helper extraction reruns the real checkout browser4/4, with thea83 Worker modules byte-identical to that owned build. Discount/checkout/concurrency/ledger/identity9, reconciliation11 and RT1-RT9 tenant2 pass in separate disposable clusters with no resources left. Initial route-size and type-only provider-import gate failures remain recorded and were corrected without changing an invariant or adding an exemption.

The staging API5a3ae187-7a51-47f8-b89c-4bc2d8aa0c7b matches the tested module hashes, preserves all63 bindings/secret names and passes14 real positive/replay/denial/catalog probes. A local Node transport failure is retained separately; verified standard HTTPS using the SDK client agent completed the probes without an edge-policy change. The corrected Commerce previewdpl_6m5NVjC627TJM1q1m43Cej5x364D has verified GitHub/develop context and actual staging counts1store/10themes. Generic preview-host internal store URLs correctly404; on the existing staging alias, Products renders through Liquid, but /collections/all reproduced500. Exact API400/VALIDATION plus bounded runtime logs prove the known all alias was sent to the UUID-only named-collection endpoint.

The source repair delegates only that literal all route and metadata to the existing canonical Shop adapter, preserving typed multivalue filters and private preview authority. Other malformed collection identifiers return not-found before an API request and never fall back to the whole catalog. All23 focused real-adapter/SDK/binder/Liquid/private-preview checks pass. Final Commerce build, updated114, corrected hosted staging route and production acceptance remain pending for this expanded candidate. Existing production still servesfd1095fe7; no historical order, provider credential, payment, order or fulfilment was changed by this work.


### Owner-approved coupon/payment integration — 27 October 2026

The owner explicitly approved qualified source `da8689b6fd0b54d376533e0180d2e0431ff859cc` through develop → staging → main and API/Commerce/Merchant activation, including the provided test CSV only in the named QA store’s encrypted payment settings. The normal develop merge is `722347a632fcbf05663d755e22c873d08a53cdce`; the runtime tree equals the qualified candidate. Actual114 governance, owned money/tenant/browser controls and19 hosted staging checks are recorded in the private `coupon-payment-production-release-review.json`. Full hosted staging sign-in remains unconfigured and actual sandbox completion/new coupon receipt require the owner after release; this exact limitation was accepted. No migration, historical receipt rewrite, global/live provider keys or agent payment/order/fulfilment is authorized. Branded checkout400 remains separate. Current production activation and live receipt verification remain pending at this checkpoint.


### Coupon/payment production activation — 27 October 2026

The owner-approved runtime `da8689b6f` was merged normally as `722347a63` with bookkeeping `adee1f40d`, then pushed develop → staging → main with fast-forward environment promotions. The integrated clone passed all114 actual governance validators after correcting stale local develop metadata in that disposable clone; the initial113/1 result is preserved. GitHub CI40547913553 and staging40547917680 refused all job steps because account billing/spending-limit admission failed. This is attributed infrastructure failure, never a green hosted CI claim.

Production API `37e77d49-8220-4bbf-8038-2527ba1f265c` matches the qualified module hashes; all64 variables/bindings and existing secrets are preserved. The prior API modules/settings are encrypted and hashed for recovery. Production API14/14 and storefront HTTPS8/8 passed, including discovery, both public stores, Shop-all Liquid200, cart, Accounts and unknown-host404. Accounts `dpl_5VpBRdoujBFan4thLMZE7pS9BwAU`, Merchant `dpl_9cnsfhmCqSSjTrRfWkGsBbgWVdDx`, Commerce `dpl_GTSLfRx8MdvRPECwp8xsqJRvQZQW` and Marketing `dpl_EyGUBiyszqyyighphqMcb4w1f6Jd` are READY. Accounts/Admin/Discovery/Checkout and the existing store wildcard point to those production deployments. The three retired portals remain paused. Bounded20-minute Commerce/Merchant level:error queries returned0 records, no excluded intervals.

Native Chrome imported the supplied CSV only in the named QA store through the released Merchant file picker and normal Connect Razorpay API. The saved UI reports Verified, Sandbox, seller account, online enabled, masked ID and cleared secret input. No live/global key was installed. A fresh verified Accounts continuation returned to the buyer account and its one linked existing receipt. The normal saved-cart recovery and supported increase control produced2 units/subtotal₹2; the released hosted checkout shows an explicit simulated-payment banner and validates existing OFF50 for₹1 saving/₹1 quoted total before delivery. The owner has been asked to enter delivery/payment details privately and complete the sandbox step. No payment/order/fulfilment was submitted by the agent, and no new saved coupon receipt is certified yet.

The two existing orders retain their actual saved no-coupon/zero-discount totals. No historical coupon is invented, current rules are not used to rewrite placed totals, and the unlinked older order remains unlinked. The public Liquid header still labels its generic link Log in while the account route proves the valid buyer session; this presentation refinement is recorded separately. Branded checkout-host migration400 and associated unfinished source remain unshipped and outside this release. Worktrees/private local environments remain preserved while acceptance and the independent branded-host phase are in flight. Private sanitized receipts are in `coupon-payment-production-release-result.json`, `coupon-production-native-checkout-acceptance.json`, `coupon-production-qa-test-key-installation.json`, `coupon-production-active-aliases.json` and related API/web/error-scan records.


## Owner receipt acceptance and current checkout/theme follow-through (28 October)

The owner's new QA order10002 is the saved-coupon positive control: subtotal INR2,
OFF50 discount INR1 and final INR1. A read-only query of the exact QA store's saved
money/provider fields agrees with the owner's Merchant and buyer list/detail
screenshots. The payment is recorded as paid through Razorpay; delivery was
changed by the owner. The older10001 has no saved coupon and remains INR2.
Neither historical order identity nor money was rewritten, and no agent payment,
order or fulfilment occurred. This closes the new coupon receipt acceptance,
not the separate lifecycle-mail or branded-host requests.

The theme Add failure is reproduced from persisted billing authority. QA has no
paid subscription; the canonical resolver returns Free, whose default permits
one installed theme. Published Circuit fills that slot and cannot be archived.
The source now uses that canonical resolver (including trials and site-specific
overrides) instead of a second subscriptions query, refuses malformed/outage
allowances and distinguishes an exact library-cap failure from other CAS
conflicts. Unit16 and real owned selected-version/catalog install10 pass.
The proposed exemption for the ten built-in free themes is a pending owner
business decision; no plan cap is changed and no live design is replaced.

The approved exact checkout-host implementation now joins the existing handoff,
internal signed resolver, proxy/page/BFF and domain maintenance paths. Version2
signatures bind origin/site/cart/buyer, while older adapters retain central-only
version1 handoffs during rolling deployment. Same-site verified parents, exact
provider assignment and HTTPS application MAC proof gate readiness. Previous
addresses stay uniquely reserved for an eleven-minute drain, then an exact
provider-alias removal must be positively read back before release. Parent
revocation denies immediately; deleted stores cannot enter the maintenance page.
Migration400 is paired and transactional; tenant SQL cannot forge readiness,
retirement or remove the hostname reservation. DOWN preserves ordinary domains
and archives checkout state without reactivating aliases.

Fresh owned PostgreSQL tests pass6 domain lifecycle/rollback controls and16
signed-job controls. The actual mounted job advances mixed domain candidates,
keeps one checkout setup per invocation and counts actual replay, PostgREST and
provider calls below the Free50-request envelope. Queue scheduling runs the
existing reconciler on every fifth minute; unrelated sweepers retain their
cadence. Merchant's actual readiness component passes3 loading/error/store-
switch controls. All these domain-provider responses are synthetic fixtures,
not a hosted DNS, certificate or custom-domain acceptance claim.

Queue production configuration has no RESEND_API_KEY, although the API has one.
Missing configuration used to silently acknowledge email deliveries. The source
now retries, retains one provider idempotency key and records completion only
after provider acceptance. The actual queue-handler fault/recovery test and
focused email/scheduler controls pass7; the complete Queue lane passes83. The
original sending-key location is requested privately; no new key, customer
replay, provider delivery or hosted Queue deployment is claimed. Completing
order-status event production, preferences and full lifecycle rendering remains
open, separately from this transport repair. Merchant checkout/general settings
propagation and persisted order-prefix behavior also remain open.

Current broader local results: Gateway1817, contracts362, all four touched
runtime typechecks, both web production builds and both governed Worker dry-run
builds pass. Literal production domains in new fixtures were replaced with
synthetic DNS names rather than weakening the domain-literal policy. The first
full Gateway attempt hit sandbox socket denial; only its verified owned process
tree was stopped, then the permitted native unit run passed.

The wider owned checkout run passes39 backend/domain controls but the four
normal browser journeys initially fail at the checkout address entry. A bounded
render diagnostic proves the local Next ingress supplies localhost in request.url
while retaining checkout.localhost in matching Host/forwarded headers. The exact
nonproduction, same-port local normalization repair passes all four actual browser
journeys on rerun, including coupon and provider-fixture capture; the same run
passes6 domain lifecycle and16 signed-job controls, with no resource residue.
Production public-host equality and all conflicting-forwarding denials remain.
The failing runs remain recorded. This is not yet a hosted release-qualified
candidate.
Migration400 has not been applied to a hosted database; no new source has been
merged/promoted/deployed. Fresh encrypted restore/staging, exact live host/TLS
checks, the current governance gate and the owner theme-allowance decision remain
required. Staging receives no production Commerce credential.

Private run receipts under the existing recovery directory:
`theme-checkout-current-owned-escalated.json`, `branded-job-security-run2.json`,
`branded-checkout-owned-regression.json`, `branded-checkout-origin-diagnostic.json`,
`branded-browser-local-origin-repair.json`, `branded-current-worker-builds.json`,
`branded-gateway-all-unit-escalated.log`, `branded-all-contracts-run2.log`,
`branded-queue-all-unit.log`, `mail-queue-full-transport-test.log`,
`qa10002-receipt-binding-facts.json`, `qa-theme-allowance-settings-facts.json`
and `order-mail-runtime-config-facts.json`.

### Local review corrections before hosted qualification

The first actual governance sweep reports112 pass/two fail: generated tenant
provenance omitted migration400 and the new Merchant proxy was absent from the
app-route inventory. The canonical generator adds only400 to site_domains source
provenance; table scope/roles/policies do not change. The exact thin owned-store
proxy is registered as gateway-proxy in inventory228 and the matching lint baseline.
Both actual validators and all6 inventory behavior tests now pass; no validator
exception is added. The sweep clone now also has the real develop/staging/main
refs, avoiding missing-ref advisories on branch disposition checks.

The new Merchant setup POST now uses the existing exact-origin/request-key guard
before resolving ownership, and forwards the browser's canonical X-Idempotency-Key
through the actual SDK. The Gateway accepts that canonical key as well as its
existing Idempotency-Key alias, rejecting malformed keys. Three actual BFF+SDK
transport controls pass (including foreign origin, forged Host, missing key and
foreign-store refusal), all3 readiness component controls pass, and a fresh real
Gateway/PostgreSQL positive setup through the SDK header passes with all6 domain
lifecycle controls. This corrects a local integration defect before deployment.
The complete Commerce package passes194/173/1607/184/27, all without skips;
these groups overlap other checks and are not a unique project test total.


Frozen source4b9a3642d passes the repeated real governance gate114/114 in a
fresh disposable clone with the real develop/staging/main refs. The single
declared advisory names an unrelated active branch absent from that clone;
no check is skipped or waived. Gateway1817 rerun, current Merchant production
build, actual BFF+SDK3, readiness3 and the final owned domain6 rerun pass.
The governed API/Queue dry-run receipt includes this exact source revision and
module hashes; Commerce's complete package/build results above retain identical
Commerce runtime source. Both source checkpoints are local only. Hosted400,
fresh restore/staging, exact live DNS/TLS and the pending ten-built-in allowance
decision still gate production; the sending key and full lifecycle/settings
follow-through remain open. No new production exposure or payment is implied.


## 28 October: included theme library policy (source qualified, not live)

The owner approved `theme-library-free-catalog-policy-proposal.json`: all ten canonical free first-party designs are included on every plan; custom uploads, blank designs and copies retain the canonical plan allowance. Adding/restoring a design must never publish it. Production remains on schema399 until the reviewed release is activated.

Migration401 adds one SQL eligibility owner, matching the ten fixed theme IDs and slugs, public/unowned/active/free zero-price catalog records and their exact package linkage. The existing row-locked selected-version installer uses that owner both to exempt included designs and to count custom slots. Blank/create and copy now call the same installer rather than inserting instances outside its lock. No catalog releases, saved designs, subscriptions, site visibility or live theme pointers are backfilled. The paired DOWN verifies the exact installer and reader profiles before reverting the allowance and retains all data. It uses the already approved managed maintenance admission when compiled for hosted deployment; it does not require the retired support helper.

The owned Free fixture publishes Circuit, adds all ten, proves the live snapshot remains identical, races two copies against one custom slot, verifies losing scaffolds are removed, rejects a further blank, restores a customized archived included theme at the custom cap, rejects altered catalog eligibility/foreign ownership/stale versions, explicitly switches to Threadline and back, restores a historical release through the canonical rollback route, and conserves every instance/draft/release across401 DOWN/UP. The two historical installer suites peel back dependent401 before their original387 replay/profile tests and restore401 afterward; their refusal assertions remain intact.

Evidence in `/private/tmp/letbuyy-storefront-recovery-20261027/`: `theme401-final-owned.json` (7/7), `theme401-historical.json` (10/10), `theme401-api-unit-final.log` (1818/1818), `theme401-merchant-ui.log` (18/18), `theme401-allowance-unit-final.log` (3/3). API and Merchant typechecks pass. Full release/governance/build and hosted rehearsal/activation still follow this source checkpoint.

Resend: the owner confirms the only original key is saved as a Cloudflare secret. It cannot be revealed. The existing API secret remains untouched; Queue has no sending key. Native Chrome reached the provider login page, and private LetBuyy provider sign-in is pending. No secret-extraction code, impersonated relay, new credential or historical customer-email replay was used.

Further qualification at runtime source `bc019f9b8`: full actual governance114/114 passed in the disposable clone (`theme401-governance.log`); Merchant production build passed (`theme401-merchant-build.log`); API/Queue governed staging **dry-run** bundles passed (`theme401-worker-builds.json`). Shared-types build followed by theme-engine typecheck passed; Merchant/API typechecks passed. The existing managed-Supabase fixture now also applies397–401 and rolls401 back/reapplies it as the real non-superuser CLI migrator:17/17 (`theme401-managed-owned.json`); managed compiler/journal unit checks15/15. No new credential or hosted application/database change was made by these tests. Fresh encrypted current-data restore rehearsals are in progress and remain a separate release gate.

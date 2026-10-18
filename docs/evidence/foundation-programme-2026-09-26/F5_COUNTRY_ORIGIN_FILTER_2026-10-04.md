# F5 country-of-origin filter implementation checkpoint

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`, HEAD `0862687a5008d604d0df23357b2eb511293139fa` before this work. The checkout contains extensive pre-existing dirty work; this change was kept unstaged and those changes were preserved.

## Requirement correction

The first February 2026 Legal Metrology amendment named 1 July 2026 as the commencement date for searchable/sortable country-of-origin filtering on imported-product listings. The later Second Amendment, G.S.R. 312(E), dated 27 April 2026, substitutes 1 July 2027. The official Ministry PDF was identified but returned HTTP 502 on direct retrieval during this update; re-check the Gazette clauses before legal sign-off. See [REEL_COMMERCE_RESEARCH.md](../../commerce-2026-09-26/REEL_COMMERCE_RESEARCH.md) for the source links and retrieval limit. This engineering checkpoint is not legal advice or compliance certification.

## Implemented

- Added `country_of_origin` to the existing anonymous product response allowlist and the storefront's canonical product select.
- Added a bounded `country_of_origin` query parameter to `GET /storefront/:subdomain/products`; the SQL and PostgREST paths compare trimmed, case-insensitive exact values. The indexed-search shortcut is bypassed when origin filtering is combined with search so origin filtering and page counts are not applied after truncation.
- Added a six-argument overload of the existing `marketplace_feed` RPC that returns the origin and filters it while preserving the five-argument function for existing callers. The new overload retains all existing approved/public/marketplace/published predicates and keyset ordering.
- Added the country query to the shared marketplace query schema, validation/parameter mapping and cache key. Existing public visibility remains enforced by the database function.

## Verification and limits

- `node --import tsx --test services/api-gateway/src/__tests__/channel-listings.test.ts services/api-gateway/src/__tests__/public-product-price-history.test.ts`: 20/20 passed.
- `pnpm run validate:migrations`: passed.
- `pnpm --filter @letbuyy/api-gateway typecheck`: invoked and completed without reported diagnostics in the tool session; rerun with the final combined phase checks if the owned DB environment becomes available.
- `git diff --check`: passed at checkpoint.
- The SQL function was not executed against Postgres. The owned Docker database runner is unavailable on this Mac, as separately observed in the current environment evidence. No hosted migration was applied.
- Merchant-entered origin remains free text, and no canonical country vocabulary exists yet. The marketplace mobile control was added in the follow-on below; the storefront/Liquid collection control remains open.
- Phase 5 and the eleven-phase goal remain open; this implementation slice is not an accepted phase outcome.

## Next work

1. Run the 272 migration and behavioral origin-filter tests in the owned Postgres environment; verify the older five-argument RPC and new six-argument overload resolve correctly through PostgREST.
2. Connect the filter to the storefront/Liquid collection control, preserving category/search/pagination behavior; add tests that prove origin filters cannot leak products across pages.
3. Decide and implement a canonical origin vocabulary/facet source for merchant entry and filtering, after inspecting existing product data and migration policy.
4. Recheck the official Gazette text before recording compliance acceptance.

## Follow-on — marketplace mobile browse connection (4 October 2026)

The marketplace origin capability is now connected to the shipped mobile shop flow. Migration 272 also adds `marketplace_origins()`, which derives sorted, case/whitespace-collapsed facet choices from currently public, approved marketplace offers. The gateway exposes `/storefront/marketplace/origins`; the shared Dart API client reads the facet and sends an optional `country_of_origin` with marketplace feed searches. The product model/cache carry the public origin, and the shop filter offers searchable sorted choices. Applying an origin filter reloads the canonical feed with the selected origin and existing category/search values; a newer request supersedes an older in-flight feed result.

Gateway typecheck passed. The focused gateway marketplace/public-projection tests pass 21/21, and `pnpm run validate:migrations` plus `git diff --check` pass. The Dart analyzer reported no issues, although its process exits with a permission error while trying to delete the Dart telemetry log outside this checkout. The focused Dart API-client suite passed 10/10 through the cached test runner. The Flutter wrapper cannot write its protected SDK cache. The owned Postgres migration was not executed because this shell cannot access the Docker socket. No production migration or hosted deployment was performed.

Still required: run the mobile widget/build checks in a writable supported SDK environment; run the migration and real filter behavior in the owned Postgres environment; connect and test the storefront/Liquid collection filter; and decide whether merchant origin values should be constrained to a canonical country vocabulary. Until then this is implemented locally but not database/device/compliance accepted.

## Follow-on — storefront and Liquid collection filter (4 October 2026)

The buyer storefront filter is now connected on all-products, search, and assigned-collection routes. The accessible GET form keeps the current route and carries existing search, category, and page values forward; clearing the origin retains those values. The typed API client and canonical product model carry the origin field. Storefront product, selected-product, and collection reads pass the filter to the existing tenant-scoped public-product query. The gateway trims origin input, rejects values longer than 100 characters, and applies exact case-insensitive filtering before returning results and counts.

Verification: `pnpm --filter @letbuyy/api-gateway typecheck` and `pnpm --filter @letbuyy/customer-web typecheck` pass; API-client and commerce-core typechecks pass. The focused web form test passes 2/2 through `pnpm --filter @letbuyy/customer-web test:origin-filter`. Combined gateway marketplace/product suites pass 30/30; the origin-filter test was rerun after pagination wiring and the cross-store denial assertion. `git diff --check` passes. The test script uses Node's `tsx` import hook because invoking the `tsx` CLI directly was denied temporary IPC-pipe creation in this sandbox.

Still unverified: migration 272 and its SQL/RPC behavior against the owned Postgres database, real browser rendering/navigation, Flutter widget/build checks, and Gazette/legal review. The Docker socket remains inaccessible, and no hosted migration or deployment occurred. The user-entered value remains free text pending a country vocabulary/data review. Phase 5 and the eleven-phase goal remain open.

Next: execute migration 272 and validate the listing, assigned-collection, marketplace, and pagination paths against the owned Postgres environment; then run browser/device checks in supported environments. Do not apply the migration to a hosted database as part of this local task.

## 4 October update — owned Postgres and production-worker acceptance

Added `owned-db/marketplace-origin-filter.postgres.test.ts` and ran it through
the repository's owned-database runner:

`node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/marketplace-origin-filter.postgres.test.ts --kind gateway-db --jobs 1`

Result: **1 suite, 3/3 passed**, with no failures, skips, cancellations or
TODOs. The test uses the real API Gateway worker, PostgREST and an isolated
disposable Postgres database. It proves that the original five-argument
`marketplace_feed` RPC remains callable, the new six-argument overload resolves
through the actual worker route, normalized exact origin filtering is applied
before keyset pagination, and `marketplace_origins()` exposes only deduplicated
facets from currently public, approved, active offers on published sites. It
also checks the intended public-role function grants and the absence of a
PUBLIC-wide EXECUTE grant. This lane runs through service-role/PostgREST and
does not claim an RLS policy test.

Additional verification: the focused Gateway marketplace and storefront product
suites pass **30/30**; Gateway typecheck, migration-safety validation and
`git diff --check` pass. The owned runner reports its disposable database,
PostgREST sidecar and container under its run ID; no restored or hosted database
was used and migration 272 was not applied outside the disposable test fixture.

The repository governance check initially failed because its explicit suite
inventory still named 18 suites while 25 were present. Updated
`tests/governance/gateway-db-lane.test.mjs` to pin the complete 25-suite set,
including six pre-existing additions and the new origin-filter suite. The lane
governance test now passes **12/12**, confirming the runner discovers all 25
and the origin test remains isolated in the owned database lane.

## 4 October regulatory source refresh — country-of-origin commencement

The Department of Consumer Affairs' official copy of G.S.R. 312(E), dated
27 April 2026, replaces rule 6(10A) with a searchable and sortable country-of-
origin filter requirement for imported-product listings commencing **1 July
2027**. The Department's Legal Metrology index also lists the Fourth Amendment
Rules, 2026, dated 21 September 2026. Its stated Gazette amendments concern
rule 6(4A) and omission of rule 6(8); based on those clauses, they do not alter
the country-filter commencement in rule 6(10A). This is source verification,
not legal advice or compliance sign-off. Sources: [official Department copy of
G.S.R. 312(E)](https://consumeraffairs.gov.in/public/upload/files/2026.4.27%20PCR%202nd%20COO%20from%201.7.2027_1777348487.pdf), [official e-Gazette record for G.S.R. 826(E), 21 September 2026](https://egazette.gov.in/WriteReadData/2026/276373.pdf), and the [Department's Legal Metrology index](https://consumeraffairs.gov.in/pages/legal-metrology-act).

Remaining F5 work is the supported Flutter widget/build and real browser/device
journeys, a data-backed decision on a canonical country vocabulary for product
entry/facets, and appropriate compliance review. The filter migration and its
database behavior are now locally verified only.

## 4 October owned Gateway and Chromium correction

The normal Commerce all-products page now has an owned-database browser
acceptance through the actual Gateway worker. While wiring that journey, the
PostgREST trace showed that the storefront product-list projection selected
columns absent from the canonical `products` table (`currency`, `quantity`,
`stock_quantity`, `avg_rating`, and `review_count`). The schema-compatible
public projections now use actual product columns and retain `country_of_origin`
in the compatibility path, so country filtering does not fall through to a
projection that cannot enforce the filter.

The existing `storefront-customer-profile.postgres.test.ts` suite passes **11/11**
through runner-owned Postgres 16, PostgREST, the real API Gateway worker, the
Commerce Next app, the Identity Next app, and headless Chromium (run
`b8de29152913`). The browser uses a synthetic buyer and proves the India product
is excluded by a Japan filter, returns after clearing, remains excluded when the
filter is reapplied, and the same normal list/detail/variant flow renders the
Gateway's product and variant reference-price values. The suite also completes
the synthetic email/password, consent, PKCE callback, store-scoped session and
sibling-store denial journey. Its disposable Postgres and proxy resources were
cleaned by the runner.

Gateway typecheck passed; the focused Gateway public-price/listing tests pass
23/23; the Commerce origin-form tests pass 2/2; `node --check` for the browser
smoke and `git diff --check` pass. No hosted database, real buyer, external
provider, or device was used. This verifies the normal Next-rendered Commerce
surface, not a separately published Liquid theme or a physical-device journey.

Still open: supported Flutter device/browser verification, a data-backed owner
decision on canonical country values for merchant entry and public facets, and
appropriate legal/compliance review. The project remains in active Phase 5 and
the eleven-phase goal; this is a local integration acceptance only.

## 5 October marketplace mobile category-search/origin composition

The filter drawer's apply callback previously chose `searchProducts` whenever
the shop search box contained text. On a category page this replaced the
category-scoped feed with a search-only request when origin filtering was
applied. The shop now retains the category and origin as server-side feed
constraints; its existing local text search continues to narrow those category
results. Unscoped search pages still send both search text and origin to the
canonical marketplace feed.

The focused Flutter test drives the real `ProductProvider` and `ApiClient`
through an intercepted HTTP transport. It verifies category + origin survive
the category-search journey and that unscoped search + origin retain their
server query. Both tests pass (**2/2**); targeted Flutter analysis reports no
issues and `git diff --check` passes. The first sandboxed Flutter attempt was
blocked because the test runner could not bind its localhost socket; the same
command succeeded with the reviewed test-run permission. This is local
synthetic-client evidence, not device, hosted or legal acceptance. The existing
provider's one-page limit remains, as do the separately recorded country
vocabulary decision and compliance review.

## 5 October marketplace mobile keyset pagination

The marketplace `ProductProvider` now follows the canonical feed's server-issued
`nextCursor`, retaining the category, search and country-of-origin constraints
that produced the page. It appends subsequent offers while deduplicating by
listing identity and ignores a late continuation after a newer feed/filter
request. Failed continuation requests keep the same cursor available; scrolling
does not silently retry after an error, and the visible retry action explicitly
retries that cursor. `MobileShopScreen` starts continuation near the end of its
scroll range and shows loading/failure feedback. The journey also exposed and
fixed a screen lifecycle leak: the periodic refresh timer is now cancelled on
dispose.

The provider/API-client tests pass **4/4**, covering category + origin, search +
origin, stable-cursor retry and stale-filter response rejection. The full shop
widget journey passes **1/1** using an intercepted HTTP transport: it loads 24
synthetic first-page offers, scrolls to trigger a 503 on the second request,
confirms scrolling does not retry automatically, activates the retry button,
checks the same cursor is sent again and verifies the next offer appears. The
first run caught the automatic retry edge case; after its correction the
focused journey passes. Targeted Flutter analysis reports no issues and
`git diff --check` passes. A second test process was not left running.

This is local synthetic API/widget verification, not physical-device, hosted or
compliance acceptance. The earlier statement that the provider has a one-page
limit is superseded for this mobile path. Remaining F5 work includes supported
device/browser acceptance where available, a data-backed owner decision on
canonical country vocabulary and appropriate compliance review; broader Phase
5 requirements remain open.

## 5 October Chrome and iOS simulator follow-up

Flutter device discovery reported a supported iPhone 17 simulator and Chrome
154. The focused shop journey also passes **1/1** with
`flutter test --no-pub -d chrome test/mobile_shop_pagination_test.dart`. This
executes the real `MobileShopScreen` and scroll/retry test in the Chrome browser
through Flutter's standard widget-test runner, using only the intercepted
synthetic API. It is browser-rendered local UI evidence, not a hosted backend or
production-browser session.

The corresponding iOS simulator integration attempt did not reach the test:
Flutter first auto-migrated five tracked Xcode project files, then CocoaPods
started cloning `https://github.com/CocoaPods/Specs.git` and remained there for
296 seconds without reaching compilation or test execution. The single run was
stopped. The project files had been clean before the attempt and were restored
to their prior committed contents; ignored CocoaPods output was left untouched.
Therefore simulator/device verification remains open. No app-store, hosted or
external service was contacted by the journey.

## 5 October country-vocabulary decision research

The implementation currently stores merchant-entered origin as trimmed free
text (maximum 100 characters) and builds public filter facets from observed
public offers. The repository's synthetic fixtures show values such as `India`
and `Japan`; no production merchant dataset was available to measure the real
value distribution, ambiguities, or migration impact. Those fixtures do not
justify silently choosing a canonical vocabulary.

Primary-source comparison:

- [ISO 3166 country codes](https://www.iso.org/iso-3166-country-codes.html)
  explains that codes avoid language-dependent country names; its general rule
  is not to assign official elements to geopolitical areas/countries that are
  not UN member states.
- The [UN Statistics Division M49 standard](https://unstats.un.org/unsd/methodology/m49/overview/)
  lists “countries or areas” with M49 numeric codes and ISO alpha-2/alpha-3
  cross-references. The [UN M49 overview](https://unstats.un.org/unsd/methodology/m49/?hl=en-GB)
  says geographic groupings are for statistical convenience and do not imply a
  political or territorial-affiliation position.

Engineering options are therefore (1) ISO 3166-1 alpha-2 codes as canonical
values with display names and a reviewed legacy-text mapping; (2) UN M49
country/area numeric codes with ISO cross-references, accepting that M49 is a
statistical classification rather than a retail-origin policy; or (3) retain
free text and normalized facets, accepting weaker standardization. A safe
backfill also depends on inspecting actual origin values and routing ambiguous
legacy labels for review. The owner must choose the product vocabulary and
legacy-data policy before enforcement or destructive conversion. Legal review
of the country-of-origin declaration/filter remains a separate acceptance.

## 5 October marketplace mobile origin-facet widget journey

The marketplace `FilterDrawer` now has a focused widget-level journey for the
existing origin-facet behavior. With synthetic facet values, the test searches
the sorted options, selects a returned value, checks the active-filter state,
and verifies Apply returns the selected `countryOfOrigin` without adding an
attribute filter. A second journey verifies an origin-facet service failure
shows its retry action and invokes the existing retry callback. A third journey
uses ArrowDown and the text-input Done action to select the highlighted option
and apply it. A raw Enter key event did not invoke the autocomplete submit
callback in the test harness, so the keyboard journey models the actual text
input submission action.

Verification in the local Flutter workspace:

- `flutter test --no-pub test/filter_drawer_origin_test.dart`: **3/3 passed**
  using the temporary SDK overlay and synthetic options/callbacks. The first
  sandbox attempt stopped before test execution because the child test runner
  could not bind its ephemeral localhost socket; the reviewed local-socket run
  reached the tests. Two fixture/assertion corrections were made before the
  first passing run (opening the end drawer in the harness and accounting for
  the autocomplete field plus selected chip both displaying the chosen value).
- `flutter test --no-pub -d chrome test/filter_drawer_origin_test.dart`:
  expanded suite **3/3 passed** in Flutter's supported Chrome test device,
  exercising the same real drawer widgets with synthetic options and callbacks.
- `flutter analyze --no-pub lib/screens/shop/widgets/filter_drawer.dart
  test/filter_drawer_origin_test.dart`: no issues.
- `git diff --check`: passed for tracked changes.

This tests the local widget with synthetic public-origin options; it does not
repeat Gateway/Postgres or browser acceptance, choose an origin vocabulary, or
establish physical-device, hosted or legal acceptance. Device verification,
the owner decision on canonical country values and legacy mapping, counsel
review, and the broader Phase 5 requirements remain open.

## 7 October pagination revalidation

The current Phase 5 worktree was revalidated without changing the existing
source or user-owned files. The provider pagination and scrolling/retry suites
pass together **5/5** (`product_provider_pagination_test.dart` 4/4;
`mobile_shop_pagination_test.dart` 1/1). The shop journey triggers a synthetic
503 on page two, confirms scrolling does not auto-retry, retries with the same
server cursor, and displays the returned item. Targeted Flutter analysis of
`mobile_shop_screen.dart` and both test files reports no issues; `git diff
--check` passes. Flutter ran through a disposable SDK/cache overlay under
`/private/tmp`; the installed SDK, manifests and lockfiles were not modified.

Fresh owned Gateway/Postgres pagination acceptance could not run: the owned
fixture runner stopped before creating a cluster because `docker info` found no
real Docker daemon (0 tests executed). It did not reach the database test, and
no hosted database or deployment was used. The existing 4 October owned
Postgres record remains the database evidence. Device verification, canonical
country vocabulary/legacy mapping, legal review and broader Phase 5 acceptance
remain open.

## 7 October fresh owned-database rerun

The earlier sandboxed Docker preflight was denied access to the local socket.
The same host's Docker 29.8 daemon is reachable for the owned test lane with
reviewed local socket access, so the authored suite was run without changing
its fixture ownership or scope. `marketplace-origin-filter.postgres.test.ts`
passes **3/3** under runner `797b61510e46`, using Postgres 16/PostgREST and the
real Gateway worker. It confirms the legacy five-argument RPC remains
callable; normalized exact origin filtering occurs before cursor pagination on
two pages; public facets exclude hidden, inactive, pending and unpublished
offers; and function grants are scoped as intended. The runner exited 0 after
its run-id-scoped cleanup check. This supersedes the 7 October pagination
revalidation's statement that a fresh owned database run could not start, for
this F5 origin-filter suite only. It does not re-run the mobile pagination UI
or test RLS. No restored or hosted database, production merchant data,
migration deployment or external transaction was used. The canonical country
vocabulary and legacy-text policy, legal review, device/browser acceptance and
broader Phase 5 remain open. See the [sanitized run record](F5_ORIGIN_FILTER_OWNED_RUN_2026-10-07.json).

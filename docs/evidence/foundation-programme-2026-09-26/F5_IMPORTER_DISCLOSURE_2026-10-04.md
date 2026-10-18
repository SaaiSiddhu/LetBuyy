# F5.3 seller-entered importer disclosure checkpoint

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`, HEAD `0862687a5008d604d0df23357b2eb511293139fa` before this slice. The checkout already contained extensive unrelated dirty work; all changes remain unstaged and preserved.

## Requirement and confidence

The Ministry of Consumer Affairs' [10 September 2026 PIB summary](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532) says the Consumer Protection (E-Commerce) (Amendment) Rules, 2026 require importer details and country of origin for imported goods and take effect on 1 January 2027. This is a primary government summary, not the Gazette text or legal advice. The exact field definition, applicable channel/category scope, transition treatment, and seller/platform responsibilities still need Gazette and counsel review. The source supports implementing a disclosure seam; it does not support activating category-specific publication blocks.

## Implemented locally

- Added nullable `products.importer_details` with a 1000-character database check and a paired rollback. The column documents that data is seller-entered and unverified.
- Added bounded create/update validation, create/update mapping, merchant form hydration and save wiring. The form warns the seller that the value is public and unverified.
- Added the field to the explicit public storefront product select and public projection; buyer product detail renders it only when present.
- Marketplace listing detail reads the disclosure only after the existing approved/public listing fence admits the listing. A read failure returns a sanitized failure; it does not bypass or weaken the listing fence. The Dart API/model/provider and marketplace detail screen carry and display the field.
- Added public projection, marketplace-route and owned-Postgres constraint regression coverage.

## Verification

- `node --conditions react-server --import tsx --test src/__tests__/marketplace-detail-routes.test.ts src/__tests__/public-product-price-history.test.ts` from `services/api-gateway`: **16/16 passed**.
- `pnpm --filter @letbuyy/api-gateway typecheck`: passed.
- `pnpm --filter @letbuyy/commerce-core typecheck`: passed.
- `pnpm --filter @letbuyy/customer-web typecheck`: passed.
- `pnpm run validate:migrations`: passed.
- `git diff --check`: passed after the implementation and evidence updates.
- Changed Dart sources reported “No issues found” using the direct Dart SDK analyzer; the process then exited nonzero because it could not delete `/Users/saai_mithra/.dart-tool/dart-flutter-telemetry.log`. The Flutter wrapper also cannot write its SDK cache. The focused Dart API-client test did not complete in this environment and is not counted as passed.
- Merchant web typecheck is unavailable: its app-local `node_modules` is absent, so `tsc` emitted missing `next`, `react`, and workspace-module diagnostics. Dependencies were not installed or lockfiles changed.
- The owned database runner selected the new Postgres suite but ran **0 tests** because no real Docker daemon answers `docker info`. The migration and CHECK constraint therefore have not been executed against Postgres. No hosted migration, device run or deployment occurred.

## Remaining work and next action

1. Run `product-importer-disclosure.postgres.test.ts` against the owned isolated database, then run merchant web and Dart API tests in a toolchain with writable dependency caches.
2. Recheck the Gazette clause and obtain legal/category applicability review before requiring the field or blocking marketplace publication.
3. Complete Phase 5's outstanding migration/parity, variant/inventory concurrency, and buyer journey acceptance. Phase 2 remains the active closure dependency; Phases 3–11 also remain open.

This checkpoint is an implemented local slice, not Phase 5.3 acceptance, legal certification, marketplace approval, or platform completion.

## 4 October correction — owned Postgres disclosure constraint accepted locally

The first owned-runner invocation exposed a defect in the test itself before it executed any test: its synthetic tenant tag exceeded `newSyntheticTenant`'s 20-character bound. The runner log confirms the suite did not reach a SQL statement. The fixture now uses the valid bounded tag `imp-disclosure`.

The final run through the real owned database runner passed **1/1 test**, with zero failures, skips, cancellations or TODOs (run `8f8f47f295d7`). It inserted seller-entered importer disclosure, accepted exactly 1,000 characters, and confirmed the database CHECK rejects 1,001 characters without leaving a product row. The migration and constraint are now verified against the runner's isolated Postgres 16 database; no restored or hosted database was touched. See [sanitized runner evidence](F5_PRODUCT_IMPORTER_DISCLOSURE_DATABASE_RUN.json).

This closes the local database-constraint step only. Dart API runtime tests, merchant-web dependency/typecheck, browser/device, exact category applicability and counsel review remain open. Do not require the field or block publication based only on this engineering seam; the next decision-dependent work is professional applicability review, while F5's variants/inventory and full buyer-journey requirements remain.

## 4 October browser-journey assertion added; runtime pending

The existing owned Gateway + Commerce Chromium journey now seeds seller-entered
`importer_details` on its synthetic imported product and asserts that the normal
product detail page displays the exact disclosure returned through the actual
Gateway product-detail request. It also asserts the detail request reached the
production worker adapter with HTTP 200. The fixture retains the deliberately
unverified wording and does not infer that the disclosure is legally sufficient.

Source checks pass: the runtime smoke script parses with `node --check`, the
Gateway typecheck passes, and focused Gateway public-projection/marketplace
detail tests pass **16/16**; Commerce reference-price mapping tests pass **2/2**;
`git diff --check` passes. The owned runner was invoked for
`storefront-customer-profile.postgres.test.ts` but exited before setup with
**0 tests** because `docker info` found no responding Docker daemon. Therefore
this new Chromium assertion has not run and is not acceptance evidence. Rerun
that named owned suite when the local owned Docker runtime is available; retain
merchant-web dependency, Dart runtime, physical-device and legal-applicability
gates separately.

## 4 October merchant-mobile and canonical-contract continuation

The normal merchant mobile product editor now hydrates, creates and edits the
optional country-of-origin and importer-details fields through the existing
product API service. Input bounds match the canonical API (100 and 1,000
characters); the UI explains that importer details are public seller-entered
text and are not verified by LetBuyy. Empty values remain optional and clear on
edit. No publication eligibility rule was added.

The shared `ProductSchema` previously stripped `importer_details`, despite the
create/update schemas and database supporting it. It now preserves the nullable,
trimmed 1,000-character value. `ProductContract` carries both disclosure fields,
and the Dart schema-conformance test pins parity with the TypeScript contract.

| Check | Result |
|---|---|
| Shared Types tests | **10/10 passed**, including optional/null behavior and 1,000/1,001-character bounds. |
| Shared Types and Commerce Core typechecks | Passed. |
| Merchant mobile `ProductContract` test | **1/1 passed.** |
| Merchant mobile shared-contract conformance | **2/2 passed.** |
| Merchant mobile product-service create test | **1/1 passed**, with trimming of both fields. |
| Merchant mobile editor widget journey | **1/1 passed** from product-card edit through changed field values to captured product API payload. |
| Flutter analysis | No issues in modified merchant editor/service/tests or shared Dart contract. |

These are local unit/widget and type-contract results, not a device journey or
real merchant login/API/Postgres acceptance. The separate Commerce Chromium
assertion for buyer display remains unrun because the owned database runner had
no Docker daemon (0 tests); merchant-web dependency/typecheck, Dart runtime,
physical-device, Gazette applicability and counsel review remain open. Rerun
`storefront-customer-profile.postgres.test.ts` when the owned Docker runtime is
available, then continue the remaining F5 catalog/inventory concurrency and
buyer-journey acceptance.

## 4 October regulatory-source cross-check

The Department of Consumer Affairs' [official Consumer Protection acts and rules index](https://consumeraffairs.gov.in/pages/consumer-protection-acts) lists the *Consumer Protection (E-Commerce) (Amendment) Rules, 2026*. Its linked official Gazette record is [G.S.R. 789(E), Gazette ID CG-DL-E-10092026-276125](https://egazette.gov.in/WriteReadData/2026/276125.pdf), dated 9 September 2026 and stated to commence on 1 January 2027. The official PDF endpoint was inaccessible to the web reader during this check. The clause text was cross-checked against a machine-readable [Gazette transcription](https://www.gazettetracker.com/g/CG-DL-E-10092026-276125), so these clause-level notes are a transcription cross-check, not direct PDF inspection or legal advice.

The amended Rule 4(6) applies where an e-commerce entity offers imported goods or services for sale. It requires the entity to mention the name and details of an importer from whom it purchased those goods/services, or who may be a seller on its platform; it also requires identification of goods and the full country-of-origin name for goods imported into India, referring to the Legal Metrology (Packaged Commodities) Rules, 2011. The importer-name/details obligation is already present in Rule 4(6) of the [official 2020 Rules PDF](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf); the 2026 text restates it alongside the origin requirement. The 2026 amendment is not the source of the importer-details duty itself.

The separate [Legal Metrology (Packaged Commodities) Second Amendment Rules, 2026, G.S.R. 312(E)](https://egazette.gov.in/WriteReadData/2026/272105.pdf) substitutes Rule 6(10A) and says an e-commerce entity offering an imported product must ensure its listing contains a searchable and sortable country-of-origin filter with effect from 1 July 2027. The searchable/sortable filter date is distinct from the Consumer Protection amendment's 1 January 2027 commencement. LetBuyy's [Phase 5 origin-filter record](F5_COUNTRY_ORIGIN_FILTER_2026-10-04.md) tracks the filter separately.

Engineering consequence: retain the nullable, seller-entered disclosure seam and keep country of origin distinct from importer information; do not infer that an unverified free-text field alone proves platform compliance. Before making it mandatory or blocking publication, counsel and the owner must determine the entity/channel/product scope, which party supplies and verifies the data, required importer particulars, exception handling, legacy listings and how imported services are represented. No publication block or category-specific legal rule was activated by this review.

## 4 October 2026 storefront product-detail disclosure continuation

The normal Commerce storefront product detail now displays both available
country-of-origin and importer details in an accessible labeled section. It
identifies both values as seller-provided and not independently verified by
LetBuyy. Whitespace-only values do not render. The existing public product
projection and Commerce mapper already carry these values; this change closes
the buyer-facing origin and provenance-copy gap rather than creating a second
product-data path.

The isolated React DOM test passes **1/1**, covering origin/importer labels,
trimmed values, the unverified disclosure and empty-value omission. Commerce
web typecheck passes. The owned Gateway/Postgres and real-browser assertion
remain unverified: the current Docker socket returns permission denied before
the runner can start. No legal applicability or sufficiency, counsel, device,
hosted or deployment acceptance is claimed.

## 5 October official Gazette confirmation

The official [G.S.R. 789(E) eGazette PDF](https://egazette.gov.in/WriteReadData/2026/276125.pdf)
was fetched directly and pages 5–7 visually verified on 5 October. This supersedes the 4 October
statement that the official PDF remained unreadable. Rule 4(6) requires, where an e-commerce entity
offers imported goods or services, the name/details of an importer from whom it purchased them or
who may be the seller on the platform; it also requires identification of goods and the full country
name for goods imported into India. Rule 6(5)(d) separately requires seller-provided country of
origin among relevant pre-purchase details. The source confirms the text only; applicability,
required evidence and responsibility remain for counsel and the owner. Existing seller-entered
fields are unverified and no publication gate is enabled.

## 4 October 2026 marketplace mobile disclosure continuation

The approved marketplace listing detail contract now returns
`country_of_origin` with the existing `importer_details`. The Gateway reads both
only after the listing visibility fence succeeds and fails closed if the
disclosure read errors. The canonical Dart API DTO and repository contract
preserve the origin value. The marketplace product screen renders available
origin/importer values with the same seller-provided, unverified disclosure;
blank values are omitted. The screen obtains origin through the canonical
marketplace repository because the bounded compatibility `ProductProvider`
does not currently map it from its detail DTO.

| Check | Result |
|---|---|
| Gateway marketplace-detail route tests | **12/12 passed**, including approved listing disclosures and hidden-listing refusal. |
| Gateway typecheck | Passed. |
| Dart API-client marketplace tests | **11/11 passed**, including `country_of_origin` parsing. |
| Marketplace app repository + disclosure widget tests | **6/6 passed**. |
| Targeted marketplace app Flutter analysis | No issues in the screen, disclosure widget and tests. |
| `git diff --check` | Passed. |

These tests prove the route contract, typed DTO and local UI component; there
was no owned Postgres or browser/device runtime acceptance in this continuation.
Marketplace publication eligibility and legal sufficiency remain separate
gates.

## 4 October 2026 origin normalization continuation

The merchant-web product editor now caps country-of-origin input at 100
characters and trims it before create/update submission. The canonical shared
`ProductSchema` and Commerce Core's `CreateProductSchema` and
`UpdateProductSchema` now trim origin as they already trimmed importer details,
so storefront search, origin filters and saved product values use the same
normalized text.

| Check | Result |
|---|---|
| Shared Types and Commerce Core contract tests | **3/3 passed across two package suites**, including create/update trimming, `ProductSchema` normalization and the 100/1,000-character bounds. |
| Shared Types typecheck | Passed. |
| Commerce Core typecheck | Passed. |
| Gateway product route tests | **7/7 passed.** |
| Gateway channel-listing and marketplace-detail contracts | **31/31 passed**, including normalized origin-filter parameters and public listing disclosures. |
| Gateway typecheck | Passed. |
| Merchant-web typecheck | Passed with `pnpm --filter @letbuyy/merchant-web typecheck`. Its node_modules link was temporarily pointed at the existing Commerce web dependency tree, whose Next 16.1.6, React 19.2.3 and Lucide 0.562.0 versions match the merchant-web manifest; the link was removed after the check. No package install, lockfile edit or network fetch occurred. |

No database, browser, device or legal applicability result is inferred from
these schema checks. The merchant-web source typechecks, but its standalone
dependency installation and the existing importer-disclosure browser/database
journey remain unverified.

## 4 October browser journey correction — buyer disclosure verified

The owned database/browser run is now complete. The first run exposed a fixture omission (`importer_details` was not supplied for the second synthetic product) and the follow-up run exposed a stale browser heading assertion. The fixture now explicitly stores `NULL` for that control product, and the browser assertion follows the actual section heading, “Origin and importer information,” while separately checking the “Importer details” field and exact seller-entered value.

The full `storefront-customer-profile.postgres.test.ts` suite passes **11/11**, with no failures, skips or TODOs (`25331169be81`). The runner verified ownership before start and cleaned its isolated PostgreSQL/PostgREST resources. The journey exercised the normal Commerce product list, detail and selected-variant rendering through the real Gateway and Postgres; the product detail displayed “Example Imports Pvt Ltd, Mumbai, Maharashtra” and the existing seller-provided/unverified wording. This is local synthetic browser/database evidence, not a physical-device, legal-applicability or hosted result. See the [sanitized run record](F5_IMPORTER_DISCLOSURE_BROWSER_OWNED_DATABASE_RUN.json).

## 7 October owned-browser revalidation — prior Docker block superseded

The owned `storefront-customer-profile.postgres.test.ts` suite was rerun on
7 October and passed **12/12**, with zero failures, skips, cancellations or
TODOs (runner `f229408e551b`; source HEAD
`0862687a5008d604d0df23357b2eb511293139fa`). Its Chromium journey seeds both
a seller-entered importer value and a control product with `NULL`, routes the
normal Commerce product-detail request through the actual Gateway worker and
owned PostgREST/Postgres, and asserts that the normal product detail displays
the exact importer value from that response together with the
seller-provided/unverified wording. It also asserts the detail request reaches
the Gateway adapter with HTTP 200. This fresh owned run supersedes the earlier
statements that this specific browser test was blocked before test start; it
does not supersede or resolve the separate merchant-web standalone dependency,
Dart runtime, physical-device, hosted, legal-applicability or
publication-policy gates. No schema, session policy, publication rule or
hosted resource was changed. See the [sanitized 7 October evidence](F5_IMPORTER_DISCLOSURE_BROWSER_REVALIDATION_2026-10-07.json).

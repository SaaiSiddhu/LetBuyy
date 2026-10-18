# F3 public reference-price storefront integration — 4 October 2026

## Outcome

Connected the existing API price-history evidence to the normal commerce web
storefront. Product cards, featured products and product details now show a
30-day reference only when the gateway reports complete coverage and a prior
low greater than the current price. Product and variant compare-at values
without that evidence are suppressed in the commerce web model, including the
legacy `compare_at_price` fallback.

## Source path

The API gateway's public product query hydrates `product_price_reference_window`
observations and applies `withPublicPriceObservation` before projecting the
response. The commerce web product mapper previously dropped the observation
fields and could use a seller-provided compare-at field directly. The new pure
mapping helper preserves complete evidence for the typed product model; product
and variant UI use only supported prior-period lows.

This addresses storefront integration for the 30-day prior-price rule described
in the [official Press Information Bureau summary of the Consumer Protection
(E-Commerce) Amendment Rules, 2026](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532).
The Gazette clause text, exceptions, applicability to each seller/channel, and
legal review remain open. This implementation is not a legal-compliance or
release certification.

## Verification

- Commerce price-history mapping tests: 2/2 passed.
- Gateway public price-history projection tests: 4/4 passed.
- Commerce web TypeScript typecheck: passed.
- `git diff --check`: passed.
- No database, browser, provider, or hosted cutover verification was performed
  in this slice. Owned PostgreSQL verification for the underlying observation
  migration remains unverified while the local Docker socket is unavailable.

## 4 October owned-database follow-up

The owned migration acceptance now passes **4/4** on the disposable Postgres 16 runner (`20acca71ae56`).
It verifies product and variant observation writes, incomplete versus complete rolling windows,
channel availability transitions, reassignment/deletion boundaries and database-role privileges.
The first actual Postgres run found that migration 270's table grant inherited `service_role` write
access from the Supabase bootstrap defaults. Migration 270 now revokes that default DML before
granting read-only access; the same suite proves the API-facing `anon`, `authenticated` and
`app_tenant` roles have no table access. The fixture now follows the revision-bound listing review
workflow rather than inserting pre-approved rows.

Gateway public projection tests pass 4/4, Commerce mapping tests pass 2/2, Gateway and customer-web
typechecks pass, migration-safety validation and whitespace checks pass. The owned database failure
was corrected and rerun successfully; no hosted schema or production data was touched. **Next:**
verify the actual storefront product list, variant selection and detail display against the live
local Gateway response in Chromium. Official Gazette applicability and counsel review remain open;
this remains an engineering slice, not compliance certification.

## Next work

Complete exact Gazette/legal applicability review and owned-database migration
acceptance, then verify a normal storefront product list, variant selection,
and detail page against the API response in a running local browser. Continue
the current Phase 2 issuer/verifier convergence work in parallel only when its
specific callers and tests are locally verifiable; hosted usage and cutover
remain dependent on actual hosted access and approval.

## Later 4 October correction — announcement-bound price and browser acceptance

The real Gateway/Postgres path exposed two defects that unit tests had missed:
the public product select named columns absent from the canonical `products`
table (`currency`, `avg_rating`, `review_count`), and the reference-window RPC
counted the new reduced price in the period used to derive its own prior price.
The amended Rules summary defines “prior price” as the lowest offer in the 30
days before the price-reduction announcement. Forward migration
`280_price_reference_preceding_announcement.sql` anchors history at the latest
price or availability transition and ignores subsequent unchanged snapshots;
the paired rollback restores migration 271's prior query. The storefront now
also builds variant selectors from the Gateway's public relational
`option1`/`option2`/`option3` fields.

Verification on owned Postgres 16 and the real local runtime:

- `product-price-observations.postgres`: **4/4**, run `71fab5b9a8bb`.
- `storefront-customer-profile.postgres`: **11/11**, run `1d5c952d3172`. The test
  drives Commerce and Identity Next.js, the actual Gateway worker, PostgREST and
  Chromium; it checks the product card at ₹120/reference ₹150, the default
  variant at ₹110/reference ₹150, and the Large variant at ₹160/reference ₹200
  against that Gateway detail payload. Its seller compare-at fixture is ₹999 and
  never reaches the storefront.
- Gateway focused storefront/public-price unit tests: **17/17**; Gateway and
  customer-web typechecks pass; migration-safety validator and `git diff
  --check` pass.
- The sequential migration validator could not certify repository ordering
  because migrations 267–280 are currently untracked in this user-owned
  checkout. They were preserved and not staged to silence the check.

The browser suite needed the test-only symlink to the existing Commerce
`node_modules` tree documented in the Phase 2 browser evidence; that exact
temporary link was removed after the run. All database writes stayed in the
runner-owned disposable clusters. Migration 280 is local and unapplied to any
hosted/shared database. The [official PIB summary](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=1&reg=48)
says the 2026 amendment takes effect 1 January 2027 and defines prior price as
the lowest price in the 30 days preceding the announcement. The Gazette PDF,
exceptions, entity/channel applicability and counsel review remain open; this
work is not a compliance or release certification.

**Status:** the owned database and Chromium acceptance for this F3 storefront
slice are complete. Phase 3 and the eleven-phase programme remain active. The
next F3 dependency is exact Gazette/counsel applicability review; hosted schema,
provider and release acceptance remain separate requirements.

## 5 October official Gazette confirmation

The official [G.S.R. 789(E) eGazette PDF](https://egazette.gov.in/WriteReadData/2026/276125.pdf)
was fetched and visually verified on 5 October; its Rule 4(13) defines prior price as the lowest
price of a good/service during the 30 days prior to the announcement of a price reduction. This
confirms the date-window detail used by the local implementation and supersedes the 4 October
source-access limitation for this clause. It does not settle which LetBuyy entities, sellers or
channels are legally in scope, nor provide counsel review or release certification.

## 8 October correction — marketplace feed now requests marketplace-channel history

The normal cross-merchant marketplace feed called `product_price_reference_window` without its
channel argument. That RPC defaults to `storefront`, while marketplace listing-detail reads already
pass `marketplace`; where a product had different storefront and marketplace offers, feed cards
could therefore receive the wrong channel's prior-price reference. The feed now explicitly passes
`p_channel: 'marketplace'`. Its dependency contract and Hono route test assert that channel, and the
existing owned-Postgres observation suite separately proves channel-specific windows and transitions.

The focused Gateway route suite passes **19/19**, Gateway TypeScript typecheck passes, and
`git diff --check` passes. This change was not rerun through owned Postgres because the local Docker
daemon is unavailable; no hosted schema or data was changed. Exact Gazette/counsel applicability,
hosted schema, provider and release acceptance remain open. This is an engineering correction, not a
compliance certification.

## 8 October correction — marketplace mobile labels the verified reference price

The Flutter marketplace receives the feed/detail `compare_price` through the
canonical API client and maps it to `ProductModel.originalPrice`. The model now
retains the marketplace-listing distinction: when a current price is known and
the verified reference is higher, listing, detail, compact, related, cart,
wishlist, home/recently-viewed, and share surfaces identify it as the lowest
price in the prior 30 days. They
no longer describe that comparison as M.R.P. or a generic percent-off/limited-
time claim. Non-marketplace catalog products retain their existing M.R.P.
wording, and unknown current prices cannot produce a reference-price claim.
The local cart does not persist ProductModel's `priceKnown` bit, so zero-priced
cart rows conservatively suppress the comparison rather than claiming a
reference against the model's unknown-price default.

The focused mobile Gateway-fixture mapping suite passes **11/11**, the
marketplace-model cart/reference identity suite passes **4/4**, and scoped
Flutter analysis of the eleven changed display files reports no issues;
`git diff --check` passes. The mapping suite validates canonical feed mapping and
unknown-current-price behavior; the analyzer verifies UI integration but this
work did not run a device/Chromium visual acceptance journey. The official
Gazette clause and exact entity/channel applicability still require counsel
review; provider/hosted schema and release acceptance remain open. No hosted
system or migration was changed. This is a mobile disclosure correction, not a
legal or release certification.

## 8 October correction — marketplace card widget acceptance

Added focused Flutter regression coverage for the canonical marketplace
`ProductCard`. The mounted card renders a supported comparison as “30-day low”
and does not call it M.R.P.; an unknown current price suppresses the reference;
and non-marketplace catalog products retain the existing M.R.P. label. A
widget journey passes a synthetic Gateway feed through `ApiClient`,
`ProductProvider` and the mounted card, verifying the listing identity, known
current price and rendered reference meaning together. A product-detail widget
also verifies the full “Lowest price in prior 30 days” label. The focused suite
passes **5/5**. Its Gateway response is a test fixture, not a running Gateway or
device/browser acceptance. Android device discovery found no `adb` executable;
the local iOS CoreSimulator service was unavailable. Runtime/device acceptance
and release checks remain open. Gazette applicability/counsel, hosted
provider/schema and release acceptance also remain open. No hosted system,
migration, signing asset or release configuration changed.

## 8 October follow-up — cart reference-price disclosure

Extended the focused Flutter suite to mount the actual cart item card. A known,
positive-price marketplace row labels the comparison “30d low,” describes the
percentage as below the prior 30-day low and computes the savings against that
reference. A zero-priced marketplace cart row suppresses both the reference and
savings claims because the local cart does not persist `priceKnown`. The full
focused card/detail/cart suite passes **7/7**. This remains local widget and
synthetic Gateway-fixture evidence; no real Gateway, device, browser, hosted
system or release was exercised.

## 8 October follow-up — wishlist reference-price disclosure

Extended the focused Flutter suite to mount the actual `WishlistItemCard`.
The marketplace listing label is “30-day low,” the non-marketplace catalog
product keeps “M.R.P.,” and an unknown current listing price suppresses the
reference claim. The full focused widget suite passes **10/10**. This is local
mounted-widget evidence only; no real Gateway, device, browser, hosted system,
or release was exercised. Device/runtime acceptance remains blocked by the
previously recorded Android/iOS simulator availability; Docker-backed browser
and Postgres acceptance remains unavailable on this host. Gazette
applicability/counsel, hosted provider/schema and release acceptance remain
open.

## 8 October follow-up — compact product card disclosure

Mounted the actual `CompactProductCard` and verified the marketplace “30d low”
label for a known current price, along with suppression of the label for an
unknown current price. The combined focused card/detail/cart/wishlist/compact
widget suite passes **12/12**. This remains local widget evidence with a
synthetic Gateway fixture, not a real Gateway, device, browser, hosted system,
or release. Device/browser/Postgres, Gazette applicability/counsel, hosted
provider/schema and release acceptance remain open.

## 8 October follow-up — recently-viewed widget journey

Added a mounted `RecentlyViewedWidget` journey using a local product and mock
preferences. The widget displays the marketplace prior-30-day label. That
acceptance exposed two genuine display failures: a product with no images
crashed on `images.first`, and the price/reference row overflowed its compact
card width. The card now uses its existing image fallback for missing/blank
images, and the reference text yields available row width with ellipsis. The
focused suite passes **13/13**; scoped analysis of the widget and test reports
no issues, and `git diff --check` passes. Commands: `flutter test --no-pub
test/marketplace_reference_price_card_test.dart` (exit 0), `flutter analyze
--no-pub lib/screens/home/widgets/recently_viewed_widget.dart
test/marketplace_reference_price_card_test.dart` (exit 0), and `git diff
--check` (exit 0). One initial widget run failed on the missing-image crash;
the next run after that repair exposed the narrow-row overflow. Both regressions
are fixed and the final focused run is green. This is local-widget evidence,
not a live Gateway/device/browser/hosted/release journey. Device, browser and
Postgres acceptance, Gazette applicability/counsel, hosted provider/schema,
and release gates remain open.

## 8 October follow-up — AI shopping-chat reference-price identity

The AI shopping search already used the canonical marketplace feed, but its
product-map projection retained `compare_price` as `originalPrice` while
dropping the marketplace listing ID and known-current-price bit. Both AI chat
cards could then render that reference as an unqualified struck-through price
or generic percentage discount. The projection now preserves listing identity
and `priceKnown`; the card model and horizontal card require those canonical
fields before showing the reference and label it “30d low.” Tests also prove
the horizontal card hides the comparison when current-price coverage is
unknown.

The focused Flutter suite passes **16/16**, including a synthetic Gateway-feed
→ `ApiClient` → AI-search mapping → mounted chat-card journey; scoped analysis
of the two chat cards, AI-chat mapping and test reports no issues, and
`git diff --check` passes. Exact commands: `flutter test --no-pub
test/marketplace_reference_price_card_test.dart` (exit 0), `flutter analyze
--no-pub lib/screens/chat/widgets/product_card_widget.dart
lib/screens/chat/widgets/product_card_horizontal.dart
../../../packages/dart/marketplace_services/lib/src/ai_chat_service.dart
test/marketplace_reference_price_card_test.dart` (exit 0), and `git diff
--check` (exit 0). This is local test-fixture and widget evidence, not a live
Gateway, real conversation, browser/device, hosted or release journey. Device,
browser/Postgres, Gazette applicability/counsel, hosted provider/schema and
release gates remain open.

## 8 October follow-up — home deal cards disclose the comparison basis

`DealCardsSection` consumed the canonical marketplace feed's
`compare_price` (the lowest observed price in the preceding 30 days) to
compute a percentage, but labeled it “Up to X% Off.” The card now says “X%
below prior 30-day low,” keeping the calculation and its historical-price
reference explicit. The focused test checks the positive comparison and
rejects the old discount wording. `flutter test --no-pub
test/deal_cards_section_test.dart` passes **11/11**, scoped Flutter analysis
reports no issues, and `git diff --check` passes. The widget uses a fake
repository fixture, not a live Gateway, device, browser/Postgres, hosted, legal
or release journey. Gazette applicability/counsel, device/browser/Postgres,
hosted provider/schema and release acceptance remain open.

## 8 October follow-up — suggested and related marketplace cards

Mounted `SuggestedForYouSection` and `RelatedProductsSection` against a
synthetic canonical marketplace feed. Both now display the reference as
“30d low” and avoid generic percentage-off claims for marketplace listings;
existing M.R.P. wording remains limited to non-marketplace catalog items. The
suggested-card widget test exposed a compact price-row overflow after adding
the longer disclosure label. Its reference text now yields remaining width
and ellipsizes instead of overflowing. The combined focused Flutter suite
passes **18/18**, scoped analysis of the two cards and test reports no issues,
and `git diff --check` passes. Commands: `flutter test --no-pub
test/marketplace_reference_price_card_test.dart` and `flutter analyze --no-pub
lib/screens/home/widgets/suggested_for_you_section.dart
lib/screens/shop/widgets/related_products_section.dart
test/marketplace_reference_price_card_test.dart` (both exit 0), plus `git diff
--check` (exit 0). These are synthetic-feed local widget tests, not live
Gateway, device, browser/Postgres, hosted, legal or release acceptance. Device,
browser/Postgres, Gazette applicability/counsel, hosted provider/schema and
release gates remain open.

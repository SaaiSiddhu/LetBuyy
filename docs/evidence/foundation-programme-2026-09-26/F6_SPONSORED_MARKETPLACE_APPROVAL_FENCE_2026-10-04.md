# F6.4 sponsored marketplace approval fence — 4 October 2026

## Finding and change

Source inspection confirmed `marketplace_sponsored_products()` in migration 232
joined placements, active products and published sites but did not consult
`channel_listings`. A product rejected, pending review or hidden from the
marketplace could therefore occupy a paid marketplace slot while organic
discovery and direct marketplace detail denied it.

Migration 274 replaces the function body and joins the canonical listing row
for the same product/site with `channel = 'marketplace'`, `status = 'approved'`
and `visibility = 'public'`. The existing column allowlist, campaign budget
and time windows, active product/site fences, bid order, result cap and
service-role-only execute grant are retained. Migration rollback drops the
sponsored function, disabling the paid strip rather than restoring the
unapproved-product path.

## Verification

- Gateway sponsored-product route/source tests: **11/11 passed**, including the
new migration contract for the canonical approval and public-visibility join.
- Owned disposable Postgres sponsored-feed suite: **7/7 passed** against
  `postgres:16-alpine`, including approved/public eligibility, exclusion of
  pending/rejected/hidden listings, campaign bid ordering and budget behavior.
- Migration safety validator: passed.
- `git diff --check`: passed.
- The ordinary sandbox initially denied Docker socket access; the authorized
  elevated runner then completed the owned disposable database suite.
- No migration was applied to the restored/shared/hosted database. No campaign,
  spend, or live placement was changed.

This closes one F6.4 paid-read bypass and proves the revised SQL in the owned
Postgres suite. It does not prove every buyer surface, purchase-time eligibility,
or Phase 6 acceptance. Phase 6 and the eleven-phase goal remain open.

## 10 October cache-freshness correction

The marketplace feed, listing detail, and sponsored-product routes still passed
eligibility-sensitive responses through the shared cache helper. Listing status
could change after a response was cached, leaving a previously approved product
visible to later discovery/detail requests. Cloudflare's current Workers Cache
API documentation says `stale-while-revalidate` is unsupported for
`cache.put`/`cache.match`; the application also returned that directive to
clients. To avoid depending on cache propagation or an unmeasured revocation
window, these three canonical marketplace reads now bypass both the Worker
Cache API and downstream HTTP caches and re-evaluate the existing canonical
listing fences on each request. The sponsored route preserves the resulting
`no-store` headers after it adds per-response placement tokens.
This increases database reads on those three public paths; Phase 11 must
measure the effect, and any optimization must preserve the canonical
eligibility check rather than reintroducing stale approved responses.

Verification on 10 October: the affected source-route suites pass **44/44**
with `pnpm exec tsx --test` from the repository root; the full prescribed
`pnpm --filter @letbuyy/api-gateway run test:unit` lane passes **1,424/1,425**
(zero failures/skips, one TODO). The stale-cache regression installs a fake
cache containing an old approved listing, changes the canonical query result to
an empty eligible set, and verifies the next sponsored response is empty,
`no-store`, and performs no cache lookup. Detail and organic feed source
contracts require the same bypass. `pnpm --filter @letbuyy/api-gateway run
typecheck` and `git diff --check` pass. Cloudflare primary source: [Workers
Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
(accessed 10 October 2026).

An initial sandboxed `tsx` start was blocked before tests by local IPC `EPERM`.
An alternate filtered invocation from the Gateway package directory then had
one test-file initialization error (`createMiddleware is not a function`); the
repo-root filtered command above passes those same route suites, and the
repository-prescribed full unit command passes. The alternate invocation is
not counted as acceptance.

## 10 October read-surface cache regression follow-up

The cache-revocation regression now exercises all three eligibility-sensitive
public reads in the focused route suite. The feed test includes `search=alpha`
and proves a subsequent canonical empty result stays empty while a fake stale
approval remains available; the direct-link test changes the canonical detail
result from approved to absent and expects the route's indistinguishable 404.
Both tests run with the Worker Cache API enabled and assert `no-store`, bypass
state, zero cache lookups and zero cache writes. The existing sponsored test
does the same for the paid feed and verifies its per-response placement token.
The three route files pass **46/46**; Gateway typecheck and `git diff --check`
pass. This raises local route-level confidence but is not a database-backed,
Chromium or hosted Cloudflare revocation-time measurement. An owned runner
preflight still receives Docker socket permission denied; no fixture resources
were created by that check. Production exposure timing and Phase 11 database
read/performance measurement remain open, as do the remaining Phase 6 gates
and full eleven-phase acceptance.

This is local Gateway/unit evidence, not hosted Cloudflare or owned
Postgres/Chromium acceptance. Current local Docker API access is denied; the
owner has been asked to enable the authorized disposable runner. The complete
F6.4 surface matrix, F6.5 purchase and F6.6 takedown acceptance, the other Phase
6 requirements, and the eleven-phase programme remain open. No hosted cache,
database, migration, campaign, or live placement was modified.

## 10 October mobile cached-feed startup correction

The shipped mobile home previously hydrated marketplace product cards from
`ProductProvider.initializeFromCache()` before the approval-sensitive canonical
feed was fetched. The persisted snapshot could therefore show an old approved
listing after it had been revoked while the app was closed. When no product
snapshot existed, this startup path also did not request the canonical feed.
The app-level caller now starts a forced canonical feed read and leaves category
taxonomy hydration unchanged. This does not edit the bounded-compatibility
`marketplace_services` package or delete the stored product snapshot; it stops
the shipped home startup path from publishing that snapshot as current
marketplace discovery.

The focused mobile test file passes **4/4**: one source-contract test confirms
the shipped home uses forced loading instead of product-cache hydration; one
ProductProvider/ApiClient test seeds a stale SharedPreferences snapshot and
confirms the forced request returns only the fake transport's current feed;
and two existing fake-transport tests verify product/category refreshes really
re-fetch. This is local source and fake-transport evidence, not a Gateway,
Chromium/device, database-backed, or revocation-time test. The provider can
still hold in-memory feed results until a new canonical request completes, and
other discovery surfaces plus hosted propagation remain open. Phase 11 must
measure exposure and query cost; this correction does not close F6.4 or Phase
6.

## 10 October mobile shop revalidation

The mobile shop screen also opened with `ProductProvider.loadProducts()`'s
default deduplication behavior. If the provider already held an earlier feed,
returning from another surface did not ask the canonical marketplace feed for
current eligibility. Shop initialization now requests a forced canonical
reload. A mounted Flutter test preloads a previously approved synthetic item,
opens the shop, returns a second fake feed response with only the current item,
and verifies the provider and rendered shop replace the prior result. The
combined focused mobile suite passes **6/6** (the home/provider file passes
4/4; the shop pagination/revalidation file passes 2/2), scoped analysis and
`git diff --check` pass. The new test block was formatter-checked while the
pre-existing pagination fixture formatting was preserved. An initial test attempt
awaited the preloading request inside `testWidgets`' fake-async zone and did not
complete; moving that setup request to `tester.runAsync` made the test complete.
Only the final passing run counts as evidence.

This is a synthetic Gateway transport and mounted-widget result, not a real
Gateway/database, device, Chromium-browser, or hosted revocation-time test. The
shop still renders its in-memory list while the reload is pending; offline
stale-card expiry remains subject to the owner's unanswered visibility-bound
decision. Native kept-alive tab return, mobile search entry, and WebShop mount
now request revalidation. The MainScreen navigation path still lacks a mounted
integration test; search suggestions can remain in memory while its request is
pending, and the web-shop test does not exercise WebMainScreen navigation.
Other discovery surfaces need separate coverage. F6.4, Phase 6, and the eleven-
phase programme remain open.

## 10 October kept-alive mobile shop tab return

`MainScreen` retains all six destinations in an `IndexedStack`, so the shop's
initialization callback does not run again when a buyer leaves the Shop tab and
returns. The native tab-selection handler now forces `ProductProvider` to
reload the canonical marketplace feed on a subsequent Shop-tab selection; its
first selection relies on the shop's existing initial canonical request. The
focused home/provider and shop widget files pass **6/6**, and direct Dart
analysis reports no issues in `main_screen.dart` or the shop regression file.
The mounted shop test proves the forced request replaces the synthetic old
feed, but it does not mount `MainScreen` or exercise the actual tab transition.

This is local source analysis and fake-transport/widget evidence, not an
owned Gateway/database/device test. In-memory cards can remain visible while
the request is pending, and the offline stale-card expiry bound still needs the
owner's answer. Search suggestions and other mobile/web discovery surfaces,
hosted revocation timing, F6.4 and Phase 6 remain open.

## 10 October mobile search suggestion revalidation

Mobile search derives autocomplete names and keywords from the shared
`ProductProvider` feed. Opening the search screen now forces a canonical feed
reload before the user begins typing; voice-search queries continue directly
to Shop, whose own entry path revalidates. A mounted search-screen test seeds
an old synthetic listing in the provider, opens Search, and confirms a second
fake-transport response replaces it. The search, shop, and provider regression
files pass **7/7**. This is Gateway-client fake-transport/widget evidence only;
it does not test keystrokes during an in-flight or failed request, a live
Gateway/database, or hosted revocation timing. Cached suggestions may remain
visible while revalidation is pending. The owner's offline freshness bound,
remaining mobile/web discovery surfaces, F6.4, Phase 6, and the eleven-phase
programme remain open.

## 10 October web shop feed revalidation

`WebShopScreen` also used `loadProducts()` without `forceReload`, which skipped
the canonical request whenever the shared provider already held products. Its
mount now forces a marketplace-feed reload. A mounted widget test seeds a
previous synthetic listing, opens the normal web-shop route (including its
category sidebar), and confirms a second fake-transport feed replaces provider
state. The focused web/mobile discovery files pass **8/8**. The normal route
test exposed an existing Flutter ink/material assertion for sidebar
`RadioListTile`; each tile now has a transparent `Material` ancestor, and the
normal-route test passes without framework exceptions. This is local
fake-transport/widget evidence only, not a live Gateway/database/hosted test;
the test checks provider replacement rather than product-card pixels. The
web-shop screen shows a loading indicator during reload, but provider data can
remain available again after an offline failure, pending the owner's freshness
policy. WebMainScreen/browser navigation is not directly tested. The offline
bound, remaining discovery surfaces, F6.4, Phase 6, and the eleven-phase
programme remain open.

## 10 October web home feed revalidation

`WebHomeScreen` also read its product sections from `ProductProvider` while
calling `loadProducts()` without `forceReload`. Opening Home with an already
populated provider could therefore render an old approved feed without a new
canonical request. Home now forces the feed request. A mounted WebHome test
seeds a prior synthetic listing, opens the normal screen, and verifies the
fake current-feed response replaces provider state. The focused discovery
regression set passes **9/9**, and targeted Flutter analysis passes for the
changed discovery screens, footer, and test files. Mounting the normal screen
also exposed horizontal footer rows overflowing their constrained column;
the social and store-button groups now use wrapping layouts, and the mounted
test completes without framework errors. This remains local fake-transport
and widget evidence, not real Gateway/database, browser/device, or hosted
revocation-time acceptance. Home and the shop can retain previously loaded
in-memory content while refresh is pending or unavailable offline. The
owner's offline visibility-bound decision, a route inventory, WebMainScreen
navigation, real integration/revocation timing, F6.4, Phase 6, and the
eleven-phase programme remain open.

## 10 October seller-store feed revalidation

`SellerStoreScreen` derives public seller cards by filtering the shared
marketplace feed, but its initial call previously used `loadProducts()`'s
loaded-feed deduplication. It now forces the canonical feed before deriving
the seller page. A mounted test starts with one synthetic listing for the
seller, returns an empty current feed, and verifies the listing is removed and
the screen reports no seller rather than showing the stale card. The focused
provider/mobile-shop/mobile-search/web-shop/web-home/seller-store regression
set passes **10/10**; targeted analysis of the changed screen and test passes.
This only validates local fake-transport/widget behavior. The seller endpoint
still has no per-seller pagination/filter contract, so the screen filters the
first canonical feed page; the test does not verify seller listings beyond
that page. Old in-memory content may remain during a pending/offline reload;
the owner freshness decision, route inventory, real Gateway/database/device/
browser/hosted revocation timing, F6.4, Phase 6, and the eleven-phase
programme remain open.

## 10 October web-header suggestion revalidation

`WebHeader` builds autocomplete directly from the shared `ProductProvider`
feed, including on web layouts outside the marketplace home route. Search focus
now forces a canonical feed refresh and recomputes the current query's
suggestions when that request completes. The mounted test seeds an old item,
types a query, and verifies the current fake-feed suggestion replaces it. The
canonical feed fixture intentionally has no images: the route previously
threw on `product.images.first`, so the result row now shows a neutral image
placeholder when no image is provided. The focused provider, mobile shop and
search, web shop, web home, seller-store and header regressions pass **11/11**;
targeted analysis and formatting checks pass. This is local fake-transport and
widget evidence only. Suggestions can still reflect old in-memory content
while refresh is pending or fails offline; the owner freshness decision,
browser/hosted revocation timing, the complete route inventory, F6.4, Phase 6,
and the eleven-phase programme remain open.

## 10 October wishlist feed revalidation

Mobile, web, and desktop wishlist layouts resolve saved IDs against the shared
`ProductProvider` marketplace feed. Their initial load and pull-to-refresh
previously reloaded only the local wishlist provider (whose `loadWishlist()` is
a no-op after the Firebase removal), so a previously loaded listing could stay
visible without checking current marketplace eligibility. Both mobile and web
wishlist screens now force-refresh the canonical feed on entry and await that
feed on pull-to-refresh; desktop inherits the web screen. Two mounted widget
tests seed a stale saved listing, return an empty current feed, and verify the
feed request occurs and the revoked item disappears. A third mounted offline
journey verifies that the current provider keeps its last feed after the
request fails, so the old saved card remains visible pending a freshness
policy. The focused regression tests pass **3/3**, and targeted Flutter
analysis reports no issues. The local
wishlist itself remains device-scoped, and this test uses a fake Gateway
transport rather than a real Gateway/database/browser/device/hosted flow. The
wishlist derives cards only from the current first feed page; old in-memory
items can remain during a pending request or offline failure. The owner's
offline freshness bound, full route inventory, live revocation timing, F6.4,
Phase 6, and the eleven-phase programme remain open.

## 13 October mobile shop pull-to-refresh revalidation

The mobile shop's pull-to-refresh handler called `loadProducts()` without
`forceReload`, so ProductProvider's already-loaded guard skipped the canonical
marketplace request and could leave a now-ineligible card on screen. Pull to
refresh now forces that request. A regression first reproduced the defect
(feed request count remained one and the stale listing stayed); after the fix,
the focused `mobile_shop_pagination_test.dart` suite passes **3/3**, covering
shop entry, pull-to-refresh replacement of a stale item, and pagination/retry.
Targeted Dart analysis reports no issues and formatting checks pass. This is
local fake-Gateway-transport/widget evidence only, not owned Postgres, a device,
browser, or hosted revocation timing. Cached items may still remain visible
while requests are pending or offline; the owner's visibility-bound choice,
full discovery-surface inventory, F6.4, Phase 6 and the eleven-phase programme
remain open.

## 13 October F6.4 buyer read-surface inventory

This is a source audit of the mobile marketplace buyer app and its shared
Gateway-backed Dart services, not a claim that every path has mounted or hosted
acceptance. It separates canonical eligibility reads from screens that reuse
those results and notes where previously fetched content can outlive an
eligibility change in memory.

| Buyer surface / entry | Product source and revalidation | Evidence / remaining gap |
|---|---|---|
| Organic marketplace feed, category and keyword search | `GET /storefront/marketplace/feed`; Gateway query uses the canonical marketplace feed fence. `ProductProvider.loadProducts` and its search/pagination paths consume the feed. | Gateway cache-bypass tests and SQL/source contracts are in the F6.4 route evidence. Mobile and web screens below force a fresh first-page read on entry; pagination continues that approved result set. |
| Paid/sponsored product strip | Sponsored Gateway route calls `marketplace_sponsored_products`; migration 274 joins approved/public marketplace listings and route tests preserve `no-store`. | The 4 Oct disposable Postgres proof and 10 Oct route/cache regressions are recorded above. Hosted query-cost and revocation-time measurement remain open. |
| Direct product detail and shared/deep links | `ProductDetailsScreen` calls `ProductProvider.loadProductById`; that uses `ApiClient.marketplaceListing`, whose Gateway route returns an indistinguishable 404 for absent, unapproved, hidden, taken-down, inactive, deleted, or unpublished-store listings. AI `getProductDetails` also uses this endpoint. | Gateway detail route tests cover absent/denied responses. The 13 October mounted product-detail tests now cover a denied deep link and a retryable transport failure. Product detail's similar-products section filters the shared feed, which is now force-refreshed after the directly linked product is confirmed. Previously loaded sibling cards can remain while that refresh is pending or unavailable offline. |
| Mobile home, featured/all-products and suggested sections | Home starts a forced canonical feed load; featured, all-products and suggested widgets derive cards from the shared provider list. | Existing mobile-home/provider refresh regression is recorded in the 10 Oct run. A card may remain from the old in-memory feed until a request completes or, under offline failure, indefinitely under current code. |
| Mobile Shop, filters and pagination | Shop entry, pull-to-refresh and subsequent Shop-tab selection force/reuse the canonical feed; filters and page continuations operate on that provider result. | The 13 Oct focused shop suite passes 3/3, and the mounted MainScreen Shop→Home→Shop fake-transport integration now proves tab-return revalidation. Stale cards can remain while revalidation is pending/offline. |
| Mobile Search autocomplete/results | Search entry forces a marketplace-feed read; suggestions and local results derive from provider listings, not a second authority. | A mounted fake-transport test now types while the entry refresh is held and verifies the current query's suggestions recompute when the fresh feed arrives. Old suggestions can remain pending/offline; no exposure age is accepted. |
| Web home and Web Shop | Both mount with a forced canonical feed read; their sections/filter controls reuse that result. | Existing mounted web-home and web-shop regressions are recorded. There is no browser or `WebMainScreen` navigation/revocation test; prior results are local fake-transport widget tests only. |
| Web-header autocomplete | Search focus forces feed revalidation and recomputes the active query after completion. | Existing mounted header regression is recorded. Old suggestions can remain during a pending or failed request. |
| Seller-store marketplace page | Seller cards are derived by filtering the shared canonical feed after a forced entry reload. | Existing mounted negative-path test removes a revoked synthetic result. This page only sees the current feed page because the API has no seller-specific pagination/filter contract. |
| Mobile/web wishlist | Wishlist IDs are device-local; cards resolve against the shared marketplace feed. Entry and pull-to-refresh reload the feed. | Existing mounted tests cover current-feed removal and offline retention. Saved IDs outside the first feed page are not independently resolved here; offline expiry awaits the owner. |
| AI shopping-chat product cards | `AIChatService.handleProductSearch` queries the canonical feed for each search; detail tool calls the canonical listing endpoint. Chat cards render response maps from `AIChatService.context`, which is in-memory for the running app and is not revalidated per build. | Source inspection confirms no Firestore search fallback and no durable remote chat history. A response can remain visible in the active chat after revocation; no card-level refresh test exists. The 14 October availability correction below prevents the feed's missing stock field from being turned into an in-stock/out-of-stock claim or purchase action. |
| Cart and checkout product display | Mobile cart/checkout look-aside reads call `fetchProductById`, which uses the canonical detail endpoint. | These are cached display snapshots; checkout-time authorization, price and stock proof belongs to F6.5. A display lookup is not purchase-time enforcement. |
| Recently viewed | Detail visits add a canonical `ProductModel` to local provider state; `loadRecentlyViewed`, when called, resolves saved IDs using canonical listing detail. | Source search found no app call to `loadRecentlyViewed` in this checkout; the UI can read current in-memory state. A dedicated route/revocation test is absent. |
| Visual search | The UI explicitly reports that visual search is unavailable; no product result route is constructed. | No active marketplace read surface in this build. |
| Merchant storefront product pages | `/store/[subdomain]/product/...` reads the merchant's storefront catalog, not the cross-merchant marketplace feed. | This is a distinct channel contract. Do not infer marketplace approval semantics for storefront-only listings; the marketplace route remains separately fenced. |

The inventory confirms canonical source use for active feed, search, detail, AI
query and sponsored paths, while identifying in-memory derivative cards and
missing route tests. It does **not** establish a bounded visibility guarantee:
the owner has not selected the maximum age for showing a cached approved card
while offline or a pending-request policy. No TTL or fail-closed behavior is
introduced by this audit. The mobile suite rerun was blocked before test startup
because the Flutter SDK attempted to write its engine stamp outside the
workspace sandbox; invoking the cached Flutter tool snapshot directly then
failed to acquire the SDK's external cache lock. No test body ran. Existing
dated fake-transport/widget results above remain the evidence for those
changes, not a fresh 13 October rerun. F6.4 and Phase 6 remain open pending the
policy, missing route tests, live database/browser/device integration, and
hosted revocation timing/cost evidence.


## 13 October direct marketplace detail denial UI

A directly opened/shared marketplace product link previously remained on
"Loading product..." after the canonical listing endpoint returned 404. The
screen now distinguishes an active load from a completed null result, clears a
stale provider error before retrying, and shows a generic unavailable state for
missing or denied listings. Transport failures use a separate generic
retryable state, and the unavailable state links back to marketplace browsing.
The detail endpoint remains the eligibility authority; the UI does not disclose
whether a listing was rejected, hidden, taken down, deleted, or never existed.

`test/product_details_unavailable_test.dart` passes **2/2** with a fake Dio
Gateway transport: a denied direct link resolves to the unavailable page with
no spinner, and a 503 shows retry before a subsequent 404 resolves to
unavailable. Targeted Flutter analysis reports no issues for the screen and
new test, and `git diff --check` passes. This is mounted Flutter/fake-transport
evidence, not an owned database, device, browser, or hosted revocation-timing
result. Similar-product cards still use the shared in-memory feed; stale-feed
during-pending/offline visibility, owner-selected freshness bounds, remaining
route coverage, F6.4, Phase 6, and eleven-phase acceptance remain open. The
previous inventory entry's statement that this focused test had not run is
superseded by this dated execution record; its offline-policy and integration
gaps remain current.


## 13 October product-detail related-feed revalidation

After the canonical detail lookup confirms a directly linked listing, the
screen now force-refreshes the shared marketplace feed used by its
similar-products section. A mounted widget regression preloads a synthetic
previously approved sibling, returns a current sibling from the fake Gateway
feed, and verifies the screen and provider replace the earlier item. The focused
`product_details_unavailable_test.dart` suite passes **3/3**, including denied
404, retryable 503, and successful detail plus sibling-feed revalidation;
targeted Flutter analysis and `git diff --check` pass.

The detail screen remains visible while its shared feed refreshes. Previously
loaded sibling cards may remain visible during a pending request or after an
offline failure; this change does not choose the owner's unresolved freshness
bound. Evidence is local mounted Flutter with fake Dio responses, not an owned
database, physical device, browser, or hosted revocation-timing measurement.
F6.4, Phase 6, and eleven-phase acceptance remain open.


## 13 October MainScreen mobile Shop-tab return integration

The earlier Shop regression covered the screen's initial feed load and
pull-to-refresh but left the enclosing kept-alive `MainScreen` transition
untested. The new mounted test uses the real `MainScreen` and its `IndexedStack`,
selects Shop, leaves for Home, changes the fake Gateway feed from a synthetic
previously approved listing to a current listing, and returns to Shop. It
asserts that a new feed request occurred, the provider now contains the current
listing, and the Shop navigation item is selected. This would fail if tab-return
revalidation were removed while the Shop widget remained mounted.

The run used checkout `LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD `0862687a`, plus the new
uncommitted test file; no production source was changed for this package. The
existing unrelated worktree edits were preserved.

The combined focused Flutter suites pass **7/7** across MainScreen tab return,
Shop entry/pull-to-refresh/pagination, and detail denial/retry/sibling refresh.
Targeted Flutter analysis reports no issues for `main_screen.dart` and the new
test; `git diff --check` passes. The harness runs on the local Linux VM with the
native non-web MainScreen branch and fake Dio responses; it is not Android
device, owned Gateway/Postgres, browser, or hosted revocation-timing evidence.
Previously rendered marketplace cards may still remain visible while a
revalidation is pending or offline. The owner's freshness-bound decision,
other read surfaces and route proofs, F6.4, Phase 6, and eleven-phase
acceptance remain open.


## 14 October mobile search suggestions after feed revalidation

The mobile search screen already forced a canonical marketplace-feed read on
entry, but it built autocomplete synchronously from the provider's then-current
list. If the buyer typed while that read was pending, the query could be
calculated against the stale list and never recomputed when the request
completed. The screen now refreshes keyword suggestions from the latest query
after the entry read completes, unless the screen has been disposed or the
buyer has submitted a search. It does not clear previously rendered suggestions
while the request is pending or choose a maximum offline age.

The run used checkout `LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD `0862687a`, with the
existing local search-entry force-refresh and this uncommitted follow-up. Other
worktree edits were preserved.

`test/mobile_search_revalidation_test.dart` passes **1/1** using a mounted
screen and fake Dio Gateway transport. The test preloads an old listing, holds
the entry refresh, types `currently` while it is pending, confirms no matching
suggestion is yet present, releases a response containing the current listing,
and verifies the suggestion appears without another keystroke. Targeted Flutter
analysis of `mobile_search_screen.dart` and this test reports no issues;
`git diff --check` passes. This is local Linux-VM/widget/fake-transport
evidence, not owned Gateway/Postgres, Android device, browser, or hosted
revocation-timing evidence. Cached suggestions can remain visible while a
request is pending or offline; other discovery surfaces, the owner's freshness
bound, F6.4, Phase 6, and eleven-phase acceptance remain open.


## 14 October AI shopping-chat inventory honesty

The canonical marketplace feed provides current listing price and approval but
does not provide stock quantity. `AIChatService.handleProductSearch` had
incorrectly inferred `inStock` from whether price was known while also placing
`stock: 0` in its response. The horizontal chat card consequently advertised
the listing as in stock, while the vertical card showed “OUT OF STOCK” and
disabled purchase actions. The service now marks stock as unknown; both cards
avoid claiming either inventory state, and the vertical card disables add/buy
actions until both price and stock are known. The horizontal card remains
navigable to canonical product detail so the buyer can check the listing.

The run used checkout `LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD `0862687a`, with unrelated
worktree edits preserved. The focused AI availability and marketplace
reference-price files pass **21/21**, including a fake-Dio canonical search,
unknown-stock vertical-card controls and horizontal-card navigation. Targeted
Flutter analysis reports no issues for the two card widgets and new test;
`git diff --check` passes. An initial focused rerun caught an 8-pixel compact
vertical-card overflow from a separate availability line; moving the neutral
“Stock unknown” cue into the existing price row fixed it, and the final suite
passes. This is local Linux-VM/fake-transport/widget evidence only, not device,
owned Postgres, browser, or hosted verification. Active AI messages remain
in-memory and are not revalidated when a product is revoked; the unresolved
owner visibility policy, F6.4, Phase 6 and the eleven-phase programme remain
open.


## 14 October mobile resume feed revalidation

`MainScreen` already refreshed cart and wishlist when the app resumed, while
the shared marketplace feed could remain at its pre-background snapshot. The
resume handler now force-revalidates `ProductProvider` through the canonical
feed as well. Its mounted fake-Dio integration test returns to Shop, then
simulates the legal Flutter pause/resume lifecycle sequence and verifies each
transition fetches and displays the new feed listing.

The run used checkout `LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD `0862687a`, with unrelated
worktree edits preserved. `test/main_screen_shop_revalidation_test.dart` passes
**1/1**, covering both Shop-tab return and background/resume revalidation.
Targeted Flutter analysis of `main_screen.dart` and the test reports no issues;
`git diff --check` passes. This remains local widget/fake-transport evidence,
not device, owned Gateway/Postgres, browser, or hosted revocation-timing
evidence. Previously loaded listings remain visible while revalidation is
pending or fails offline. No maximum stale-display age was chosen because the
owner's visibility policy remains unanswered; F6.4, Phase 6, and eleven-phase
acceptance remain open.

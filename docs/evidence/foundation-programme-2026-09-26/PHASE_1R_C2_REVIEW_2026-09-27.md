# Phase 1R C2 review — 27 September 2026

Source reviewed: ../LetBuyy-phase1r, branch letbuyy/phase1r-firebase-free-marketplace, clean HEAD bed78c36. Read the supplied report in full and inspected current implementations and changes since 9a66ebcf. This is source review, not a fresh test run or device certification. No emulator interaction, implementation edits, merge or deployment occurred.

## Verdict

Preserve the progress. Canonical product/category reads and address-sheet operations are implemented; legacy authentication and multiple inherited feature paths have been disconnected. Reels is deliberately deferred with a placeholder, not implemented as a working reel product. C2 is substantially advanced but needs targeted correctness repairs. C3 Firebase SDK/native retirement, C4 meaningful new regression coverage and C5 real Android verification remain outstanding.

The phase branch is clean. Primary develop remains a separate checkout at 6eb01d95 with previous uncommitted work; do not reset it or assume the phase changes are merged.

## Findings from current source

### 1. Product mapping still invents unavailable facts

packages/dart/marketplace_services/lib/src/providers/product_provider.dart maps a feed item to stock: 1, missing price to 0, and createdAt/updatedAt to DateTime.now(). Detail and variant mappings also coerce unknown stock to zero and unknown prices to zero.

These values are observable: product_card.dart checks stock == 0 for availability and action enabling; detail renders numeric price; provider sorts newest using createdAt. Listing approval is not evidence of stock quantity. Unknown price is not a free price. Unknown stock is not proven sold-out. Observation time is not product creation time.

Repair with an explicit nullable/availability-aware canonical presentation model or equally explicit capability fields; hide unsupported claims and prevent unsupported purchase actions. Preserve true zero prices/stock when actually supplied. Tests must cover missing versus zero values, actual stock and variant combinations. Do not solve this by requesting private merchant fields indiscriminately.

### 2. Legacy cache can defeat canonical revalidation

ProductProvider and CategoryProvider load the existing CacheService keys, populate lists, then call loadProducts()/loadCategories(). Those methods return early for nonempty lists unless forceReload is set. The intended background refresh is skipped. CacheService still uses cache_products_v2/cache_categories_v2, shared with the previous source. ProductProvider.refreshProducts() also calls loadProducts() without forcing refresh.

Consequences include retaining old Firebase-era IDs/data after an in-place app update and not reflecting current canonical changes. No real users exist, but the development installation and source correctness still matter.

Version/source-scope the relevant cache, invalidate only obsolete owned app cache, and actually revalidate. Do not clear all app data merely to mask the bug. Test upgrading with seeded legacy cache and refreshing a nonempty canonical result. Audit category selection and pagination: the provider currently requests one page with limit 100 and does not consume nextCursor; avoid representing a truncated result as an exhaustive catalog.

### 3. Address-sheet account transition remains unsafe

In address_selection_sheet.dart, _buildAddressList schedules _loadAddresses after the frame when token differs from _loadedForToken and loading is false, but continues rendering the old _addresses in that frame. A direct A-to-B session change can briefly display A's addresses under B.

If the token changes while a request is pending, _loadingAddresses remains true. The render path will not schedule B's request; when A's request completes, _stillCurrent fails and returns without clearing loading or starting B. The sheet can remain stuck. A mounted check is also needed before accessing context from deferred callbacks.

Use session-driven invalidation/request generations: render no previous-buyer records as soon as identity changes, reset account-scoped loading/error/mutation state, and start the current buyer's request independently of stale work. Preserve response guards. Add widget tests with controlled pending requests for A→B, A→logout→B, failure, token refresh and disposal before the post-frame callback. The existing reference pattern must be evaluated, not copied as proof.

### 4. Deferred Reels navigation needs a visible exit

ReelsFeedScreen is now a plain coming-soon view with no app bar or button. MainScreen still hides bottom navigation on the Reels tab. System back handling exists, so this is not proof of an inescapable screen, but an ordinary tab destination should retain a visible navigation route. Keep bottom navigation for the placeholder or provide an explicit Home/back action; test it. Full media/reel functionality remains Phase 7.

### 5. Firebase removal is still pending

App and shared services still declare firebase_core, firebase_auth, cloud_firestore, cloud_functions and firebase_storage. Current main.dart prose saying Firebase is removed entirely overstates the result. C3 must finish the actual active app dependency/native retirement, including shared model/serialization and barrel-export implications. Preserve unrelated app consumers, Maps, package ID and signing assets. A workspace lockfile may still contain Firebase for another app; prove absence from the marketplace artifact specifically.

### 6. Reported tests do not cover the new behavior adequately

The supplied report claims clean analysis and 57 tests passing. No test paths changed between 9a66ebcf and bed78c36 in the reviewed branch. Existing tests may still run useful coverage, but no new evidence demonstrates adapter semantics, cache source cutover, address transition behavior or startup/active-tab composition. Do not treat unchanged test totals as certification of all rewired consumers.

## Next bounded implementation task

Continue on the existing Phase 1R branch; do not start Phase 2 or redo the completed rewires.

1. Fix the four C2 issues above and add focused regression tests as each fix lands. Review actual API field contracts and test empty, error and missing-data states separately.
2. Complete C3: remove remaining active Firebase code/SDK/native dependencies. Trace each remaining consumer and use canonical replacements or explicit later-phase disconnection. Do not reinitialize Firebase, add more fail-silent safety wrappers or build all later commerce phases now.
3. Complete C4: boot/composition and active-route tests without Firebase; dependency/plugin checks; exact built APK verification. Record actual gate failures/skips instead of claiming blanket green status.
4. Complete C5 during a stable resource window: normal local canonical account creation/sign-in → browser consent/callback → profile/address CRUD/default → restart → logout/revocation → two-buyer switch. Test product/category/detail and visible navigation, including cache-upgrade and no-Firebase startup.
5. Tie frontend APK, backend source, configuration, schema and device to one evidence packet. Preserve durable logs/screenshots with secrets removed. Keep hosted association separate and undeployed.

Acceptance: no Firebase requirement in the active marketplace artifact; truthful product display; canonical cache revalidation; no stale-buyer address rendering; working normal account journey and active navigation. Reels, complete checkout, settlements and advertising remain explicitly unfinished later-phase capabilities.

No merge, deployment, production payments, hosted-project removal or backup deletion is authorized by this review. Keep old Mac/T7 backups. The next task is corrective C2 completion plus C3–C5, not another isolated prompt for each small issue.

# Dewdrop demo collection membership

`apps/commerce/web/src/lib/demo/dewdrop-demo.ts` now exports `DEWDROP_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]>`.

| Collection ID | Handle | Existing durable product IDs, in shelf order | Count |
| --- | --- | --- | --- |
| `7b669c70-8300-4000-8000-000000000001` | `cleanse` | `7b669c70-8100-4000-8000-000000000001` Cloud Rinse; `7b669c70-8100-4000-8000-000000000004` Palm Wash | 2 |
| `7b669c70-8300-4000-8000-000000000002` | `care` | `7b669c70-8100-4000-8000-000000000002` Daily Veil | 1 |
| `7b669c70-8300-4000-8000-000000000003` | `colour` | `7b669c70-8100-4000-8000-000000000003` Soft Colour | 1 |

Every key is an actual exported collection ID, every member is an existing Dewdrop product, all IDs are unique within a shelf, and the declared product counts match. No products, collections, merchant installation seeds or approved M1 artifacts were added or changed. The three actual collections are nonempty. The intentional-empty test uses an isolated cloned collection with `[]` and count 0.

Five owned tests in `collection-membership.test.ts` exercise the existing marketplace-owned `resolveCatalogDemoCollection` and route parser: exact membership/order/count; identical handle and ID routes; an explicit empty shelf; foreign collection/member rejection without partial or catalog fallback; missing entry/map remaining unavailable while other known shelves still work. `[]` is an intentional empty result; `null` is unavailable or invalid membership. The production map is never mutated by those negative tests.

The common dispatcher/helper remains unmodified. Marketplace must import this export and clone it into the existing `letbuyy-aura` source's `collectionProductIds`, then verify actual trusted catalog category navigation. Current tests inject the map into a synthetic owned fixture and test the actual shared resolver; they do not claim the dispatcher is already wired or that the hosted sample browser route is accepted.

Combined Dewdrop checks now pass 34 tests, four no-emit type checks and focused merchant lint. `verification.json` records command outcomes, source hashes and the read-only shared helper snapshot. No API/framework, DB, build, browser session or production operation was introduced.

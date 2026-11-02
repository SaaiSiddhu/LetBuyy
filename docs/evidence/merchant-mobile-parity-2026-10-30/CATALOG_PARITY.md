# Catalog parity — bounded read and context qualification

Source `2c59fae05def3014e2b7239e3c1a59e94bfd7e9f`, based on the dashboard/customer checkpoint `66543f2b69d52cc32906f874bfb0b5fe5a22d789`. This qualifies the catalog read changes below, not every product editor, inventory or CSV journey.

## Reachable path and authority

Owner or currently permitted staff → Products tab → `apps/merchant/mobile/lib/screens/products/products_screen.dart` → `ProductService` → shared `packages/dart/api_client/lib/src/api_client.dart:ProductsApi.list` → BFF/Gateway `/v1/products` → real auth, store context and `products:read` middleware → `services/api-gateway/src/routes/products.ts` → the site-scoped `products` query. Input authority remains `packages/commerce-core/src/index.ts:ListProductsQuery`. Product DTOs remain shared `ProductContract` in `packages/dart/models`; no app-local product authority, new runtime, table or migration was added.

The existing Merchant web caller is `[store]/products/page.tsx` → `/api/stores/[store]/products` → the same Gateway. Its current worktree source requests a bounded 100-row summary then searches/sorts locally. That source still needs complete server-query/page behavior and browser acceptance. The primary checkout's separate unpublished web work has not been overwritten or treated as accepted.

## Findings and repairs

- Native product search/order/status controls previously operated only on the first 20 rows, and called that page “Total.” Search and order now go to the server; Previous/Next browse matching pages. Counts explicitly describe this page. Selecting a new query clears old selections and retires late responses.
- Status semantics follow the server: active may include out-of-stock products. Draft and archived have explicit filters. Stock filters use the canonical optional `stock_filter` query (`out_of_stock` = product stock ≤0; `low_stock` = product stock 1–5). These catalog fields do not replace canonical inventory/reservation authority.
- The Gateway now acknowledges the applied stock filter in `meta.stock_filter`. Native refuses an unsupported/mismatched acknowledgment rather than showing an unfiltered result as filtered. Old clients can ignore this additive field. Deploying the updated Gateway before shipping the new client enables stock filters; rolling back the Gateway leaves the client with an explicit unavailable filter state, not silent wrong membership.
- The shared product cursor previously tested only the primary sort value, dropping remaining products with equal price/name/display order/created time. Cursor membership now includes the existing ordered ID tie-breaker in both directions. Malformed cursors fail with a sanitized validation response. Literal quotes, commas and parentheses in names have a real database regression.
- Product list failures now return sanitized `503 PRODUCTS_UNAVAILABLE`; they cannot become a successful empty catalog or expose raw database faults.
- Product cache identity includes actor (via `CacheService`), site, page/cursor/limit, search, status, sort/order and stock filter. Cached rows are revealed only after an eligible transport/server failure for that exact query, with an explicit offline label. Known authorization denial suppresses other cached queries until a current successful authorization. Denied/foreign responses never supply offline data.
- Per-request generations prevent older same-store searches/pages and A→B→A context work from replacing newer rows or writing stale cache. Getters hide retired context immediately. Full product detail keys bind the site and ID; list projections never overwrite a full detail/edit snapshot. Editor loads remain fresh and versioned.
- Bulk confirmation dialogs retire their old store content. Completed bulk actions reload the server view instead of hardcoding every selected row as saved. Export initiation, polling and share are fenced to their original view/store. None of these local checks is a real provider or production mutation receipt.

## Verification

- `flutter analyze --no-pub`: pass.
- Full `flutter test --no-pub --reporter expanded`: **449/449 pass**. `catalog_scope_boundary_test.dart` contains eleven service/actual-widget regressions: exact offline identity, page/query failures, 401/403/404 denial, foreign responses, same-store response races, context retirement, known-denial fencing, unsupported older server and actual native server page/search/filter/sort controls. The existing keyboard filter fixture now supplies the server's filtered response and asserts the real query, preserving its keyboard/semantics checks.
- Gateway typecheck: pass. Existing focused products/tenant/schema regressions: **19/19 pass**. These include structural checks; they are supplementary to the owned route journey.
- Real Gateway + disposable PostgreSQL/PostgREST suite `merchant-catalog-read.postgres.test.ts`: final run `cc86ad39d07f`, **5/5 pass**, zero skips/cancellations; runner cleanup verified. Earlier run `75e0673d9305` passed 4/4 before filter acknowledgment/quoted-name additions and is superseded for this scope.
- Database cases traverse every advertised sort in both directions with equal-value rows, assert complete nonduplicated membership; offset pages; matching status/stock filters; observed empty search; positive-control-first foreign-store refusal; malformed cursor refusal; injected private DB read fault; literal quoted-name cursor traversal. Fixtures are synthetic and owned by the repository runner. No hosted data was mutated.
- Full clone governance and a new APK are recorded separately when their processes finish. The signed-in Android screenshot at checkpoint `66543f2b...` predates these catalog changes and cannot prove them.

Logs: `/private/tmp/letbuyy-catalog-full-final.log`, `letbuyy-catalog-analysis-final.log`, `letbuyy-catalog-gateway-typecheck-final.log`, `letbuyy-catalog-gateway-unit.log`, `letbuyy-catalog-owned-db-final.json` and its suite log directory. `QUALIFICATION.json` retains compact durable counts and ownership cleanup.

## Open acceptance and next dependencies

Row 27 is **implemented + locally/database verified in this bounded scope**. It is not yet browser/device/provider/staging/deployed acceptance. Product creation, media, variants/options, category/collection membership and publication need their own web/native readback, staff/revocation, concurrent/lost-response and buyer effects. The pushed product form still needs full private presentation/context qualification independently of the main tab's store fence.

Row 28: the existing native `ImportProductsScreen` selects existing catalog products into a store selection. It is not CSV import. The canonical `ProductsApi.importCsv` already targets `/export/import-products`; the current server `createJob` generates a new random job ID on every submission. Complete server-owned logical job retry/effect-once behavior and truthful queued/partial/failure/readback before accepting a native CSV import flow. Do not build a second importer or use production records as test fixtures.

Reinspection at integrated source `9b5b89437` confirms the selection screen calls
`StoreService.updateSelectedProducts` → generic store PATCH with
`selected_product_ids`; that property is absent from canonical
`packages/tenant-core/src/index.ts:UpdateStoreSchema` and the Gateway store PATCH
allowlist. This is not a supported catalog-import command. It also fetches one
20-row product page while presenting a whole-catalog count, suppresses its read
error and shows invented progress percentages. Existing success UI is not a
persisted selection/import proof. The actual web CSV proxy is
`apps/merchant/web/src/app/api/stores/[store]/products/import/route.ts`; it uses
`ProductCsvImportSchema` and the same shared import API, without carrying a stable
original import key. In `services/api-gateway/src/routes/export.ts`, source CSV
and job identities are randomized separately, the job record is stored in R2,
and per-row product execution runs in `waitUntil`. Before wiring mobile CSV,
complete the canonical durable logical job identity, payload conflict, current
authority, interrupted/partial job reconciliation and readback. R2 alone must not
become a competing business-command authority. This inspection is source evidence,
not a new owned-database or hosted duplicate-import reproduction.

Web product query/page completeness, signed-in two-direction mutations, restricted staff/revocation, hosted compatibility, offline/reconnect recovery, accessible devices, release signing and rollout/rollback remain open. No row is fully accepted by these receipts.


## Final read/presentation continuation

Source `496e8d36a241ed4f3de5025b6ed6a5ca3f3cd99a`: catalog and comparison prices, including accessibility labels, retain two decimal places; long prices scale within their card and status/stock wraps on narrow cards. An unsupported stock filter has a directly reachable **Clear stock filter** recovery action, and error copy has a readable inset. Failed later pages retain Previous navigation; loading counts are hidden rather than reported as observed zero.

The owned journey reproduced another shared bug: a page beyond the remaining rows could be a PostgREST empty 200 (or PGRST103), and the API displayed total zero. The Gateway now uses a bounded same-filter count only on this recovery path, returns the actual empty page/count, and refuses failed or missing count evidence. Nonarray product data is unavailable, not an empty catalog.

Full Flutter **459/459**, thirteen catalog scope/widget tests, analysis and Gateway typecheck pass. Focused Gateway product/tenant/schema tests: **19/19**. Final owned run **`8c8f943da31a`: 7/7**, cleanup verified. Preliminary run `d87afbb5b086` retained a real failed zero-count regression (6/7); the final run proves its repair. Its failure was not relabelled as a pass. Final logs: `/private/tmp/letbuyy-catalog-presentation-full-final.log`, `letbuyy-catalog-presentation-analysis-final.log`, `letbuyy-catalog-gateway-unit-final.log`, `letbuyy-catalog-read-final7-qualified.json`.

Android checkpoint `2c59fae...` actually showed server product search and refused the older hosted Gateway's unacknowledged stock filter; `android-catalog-search-2c59.png` and `android-catalog-old-server-2c59.png` contain no product rows. The latter revealed the recovery/copy issue repaired above. Editor checkpoint `a9e2ac...` subsequently opened an existing product after a successful fresh read without saving. Newest APK/governance outcomes are attributed separately in the qualification record; none of these read-only observations accepts native writes or complete web parity.

Final APK at `496e8d36...`: 148,731,288 bytes, SHA-256 `6d44501ebe971d1edbf50f365130ae89396ef396799a3d80acd7df7719b8167d`, installed hash verified. The actual emulator announced a two-decimal product price, displayed the inset unsupported-filter message and **Clear stock filter**, and restored the real catalog after that action. `android-catalog-recovery-496e.png` contains no private product rows. The latest exact-source clone governance gate passed all 114 validators (zero fail/blocked/skip; one report-only not-applicable).

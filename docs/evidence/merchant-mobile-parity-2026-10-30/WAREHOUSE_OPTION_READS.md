# Warehouse location and supplier option reads

1 November 2026. Qualified source `58030c1c3a0f89e7f77380bfb910beac037e8440`, task branch only. No deployment or hosted database changes.

Locations and suppliers now use one shared paged contract across Gateway, TypeScript SDK, actual Next proxies and native API/service readers. Each read requires explicit current-owner scope, excludes deleted rows, supports bounded pages, active/inactive filtering, literal name search and stable ordering. Location ordering keeps defaults first. Exact counts are mandatory; a missing schema/count or malformed page is unavailable. A far page uses the same scoped count recovery without manufacturing zero.

Native location/supplier screens expose exact counts and Previous/Next recovery. Isolated active-option readers preserve the main collection's state and retire context changes. Web purchase-order/transfer forms use authorized active choices with Search/Load more. Loading another page does not reset notes, line entries or explicit location selections. Choices never confer a permission lease; each command rechecks current server authority.

## Local qualification

- Merchant Flutter: **675/675**, clean app analysis. This includes 34 new option/page/context checks; focused suites overlap the full count.
- Shared Dart models: **63/63**. Shared Dart API: **97 pass / 6 pre-existing skips**.
- Gateway unit/contracts: **2,006/2,006**. Shared TypeScript contracts: **18/18**. Mobile BFF: **24/24**.
- Composed web warehouse lifecycle/journal/actual Next-SDK proxies: **229/229**; neighboring error-recovery test **1/1**. Targeted lint and web/Gateway/SDK type checks pass.
- Owned SDK/Gateway/Postgres recovery plus paired rollback: **36/36**, run `8741f18edf45`. New reads exercise >1,000 records, exact/far pages, default/name/ID ordering, literal wildcard search, inactive/deleted exclusion, missing counts/schema, foreign tenant/staff/revoked-owner denial. Cleanup receipt has zero remaining owned containers/networks/volumes and no cleanup failures.
- Exact-source governance in disposable clone: **114 pass**, zero fail/blocked/skip; one not applicable.

Receipts: `/private/tmp/letbuyy-warehouse-options-{native-full,models-tests,dart-api,gateway-tests,shared-tests,bff,web-third,web-errors}.log`, `...-owned-db.json`, `...-governance.json`. Disposable receipt paths are supplemental; this record preserves counts and source identity.

## Remaining acceptance

Native creation still requires the forthcoming authorized product/location/supplier selectors and multi-line workflow. Location/supplier creation does not yet have durable original-key recovery. Main list search/status/sort controls and all-122 acceptance remain open. This source has not been installed on the emulator. Installed native verification source remains `8be82e4af`; the user unlocked the Mac, but computer control cannot select the non-bundle emulator window. Direct user sign-in was requested while independent source work continues. Frontend verification success is not server Siteverify/authenticated Merchant acceptance. No production mutations, promotion, release signing or publication occurred.

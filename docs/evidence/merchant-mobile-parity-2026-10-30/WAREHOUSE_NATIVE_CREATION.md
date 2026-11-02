# Native warehouse creation and variant recovery

1 November 2026. Native source `1dd5400bee4991b1036901811ef2ec84bfd046d5`; final integrated source `97edec1ea36254eeef79d1e09c1e62efcf0b105d`. Private task branch only. No push, deployment, hosted migration or business write.

## Implemented behavior

Both native raw-ID stock forms now use one shared presentation component and existing canonical DTOs/commands. Location and supplier choices are active, current-owner, bounded server reads with literal Search, page recovery and exact population counts. Product choices use an isolated online reader that does not replace the main catalog or consult private cache; counts are shown only when explicitly exact. Selecting or scanning a product obtains its current version and complete variant identities. Missing, foreign, deleted or duplicated variants fail closed. Product variants require an explicit choice; IDs are never entered manually.

The form supports multiple product/variant lines, quantities, INR unit costs, optional supplier, expected arrival and notes. A shared domain parser accepts whole paise and rejects malformed costs rather than substituting zero. Existing canonical command validation rejects invalid or duplicate lines. Review precedes dispatch; Back to draft retains entries. Current-scope guards cover both nested choices and review, and only one preparation/review is active. Barcode lookup is preserved. The existing encrypted warehouse journal and server receipt owner handle effects/recovery; no parallel mutation system was added.

## Reproduced backend defect and correction

Expanded owned two-variant acceptance at `1dd5400be` failed both new journeys: run `8cd46b4a0cd8`, **36 pass / 2 fail**, cleanup verified. The guarded variant lookup referenced `product_variants.deleted_at`, absent from the canonical schema. Versioned product updates physically replace/remove variant records. This source-only migration 414 has never been applied to hosted data or promoted; its draft lookup was corrected before release. The locked live product supplies tenant/ownership/deletion scope, and `FOR SHARE` still proves the current variant belongs to that product. No fictitious column or parallel variant lifecycle was introduced. The paired rollback continues to capture and verify actual function provenance.

Corrected source run `d92e2301d0f2`: **38/38**. Actual SDK → Gateway → owned Postgres proves two distinct variants, exact 37.33 INR PO subtotal/total, complete two-line receipt, stock conservation and identical create/receive replay with one effect. Foreign and missing variant positive-control denials preserve stock. The full earlier journal, preflight, page/detail, concurrency, permission and guarded rollback checks remain green. Separate role run `0fe15d83d81e`: **8/8**. Both cleanup receipts have no failures and zero remaining owned containers/networks/volumes.

## Qualification and artifacts

- Native full suite **694/694**, clean app analysis; 19 new creation/product-choice checks overlap that total. An early unbounded synthetic read-start test was stopped by its exact owned Flutter PID; the bounded read-start gate passes. No broad process cleanup occurred.
- Shared Dart models **64/64**, including whole-paise input. Gateway **2,006/2,006** and typecheck pass. Final SQL/test-only diff leaves native/shared Dart source unchanged from `1dd5400be`.
- Exact integrated-source disposable governance **114 pass**, zero fail/blocked/skip; one not applicable.
- The unchanged production web/SDK/read transport retains the preceding option checkpoint's 229 warehouse web + 1 error-recovery, 24 BFF, 18 shared TypeScript and 97 Dart API pass / 6 existing skips; no new hosted claim derives from those local receipts.
- Android debug APK built from native source `1dd5400be`: **219,833,893 bytes**, SHA-256 `fbd7896c7a64b47e433f2efa400d81d25b7c0e778669e6f6545efbb63da6f4af`. Production endpoint definitions; debug signing; not installed; no release candidate. The installed verification APK remains older source `8be82e4af`. Opening it exposed the sign-in form after Android Home; user direct sign-in is pending because CUA cannot select the non-bundle emulator. No credentials were placed in commands/logs or entered by the agent.

Receipts remain under `/private/tmp/letbuyy-warehouse-create-*`; source identities and outcomes are preserved here because temporary files may expire.

## Remaining gates

Main warehouse list controls and canonical metadata creation/readback were subsequently qualified in [the list checkpoint](WAREHOUSE_LIST_FILTERS.md). Durable location/supplier creation recovery and remaining feature audit/implementation are open. Actual authenticated emulator/owner/staff journeys, two-direction web/mobile writes/conflicts, hosted/provider/money/buyer acceptance, owner-approved Android emulator and iOS build/runtime checks, signed release artifacts, staging compatibility, rollback and production readback remain separate gates. All 122 inventory rows remain unaccepted as a whole. No deployment or production-readiness certification occurred.

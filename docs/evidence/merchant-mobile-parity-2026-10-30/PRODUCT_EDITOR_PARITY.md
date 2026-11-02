# Product editor privacy and context qualification

Source `a9e2ac797990f236f929f66c59a36d811b38635f`, following catalog checkpoint `2c59fae05def3014e2b7239e3c1a59e94bfd7e9f`.

## Reachable owner

Products card → `ProductFormScreen` → `ProductService.fetchProductForEdit` / `updateProduct` / `uploadProductImage` → shared Dart Products API or upload transport → current BFF/Gateway product/permission/mutation owner. Products and relational variant identity remain canonical shared contracts. This change adds no new auth, product writer, table, schema or runtime.

## Defects repaired

- A caller-supplied product snapshot was painted while a fresh edit read was loading or unavailable. The private editor is now revealed only after a successful fresh read. An initial read outage shows recovery without private fields; denial retires the editor.
- A pushed product form did not own the original StoreContext lifetime. Forms now bind the account/store generation and selected site at opening. Any change, including A→B→A, retires the old form. Fields and submission controls disappear; reopening from the selected store starts a new form.
- Image/specification dialogs and variant sheets hide retired private contents. Media picker, barcode, fresh-read, save and variant completion handlers reject retired results. A completion in a previous store cannot announce success or navigate the current store's workspace.
- Upload requests bind both explicit store and the context captured before asynchronous file preparation, using the existing transport's `expectedContextVersion`. An old upload result cannot be appended to a new draft.
- A current product write denial retires the private editor. Unknown create/save errors no longer expose raw exception text or imply success. This does not finish durable create retry or restart recovery; those remain explicit gates.

## Local qualification

`flutter analyze --no-pub` passes; full Flutter suite **457/457 passes**. `product_edit_concurrency_test.dart` and `product_media_scope_test.dart` contain fifteen focused tests, including existing real-form version conflict, lost response/retry and relational identity controls plus new fresh-read privacy, read/write denial, A→B→A, in-flight initial read, late save and upload context cases. Pending-read tests assert a real fixture read has started before retiring the store. The four existing form presentation/semantics tests now provide an explicit selected StoreContext, matching the production dependency.

The exact disposable-clone governance gate passes **114 validators**, zero fail/blocked/skip, one report-only NOT_APPLICABLE. This structural gate is supplementary to behavior evidence.

## Database owner qualification

The existing product summary, atomic edit and real staff suites ran against disposable owned Gateway/PostgreSQL/PostgREST fixtures at the same unchanged product mutation owner:

- Run `f4f40c591ca4`: product summary 5/5, real staff invitation/permission/product journey 1/1; atomic edit suite 89/90. The one failure was the mandatory prepared-transaction rollback test: the default owned fixture had `max_prepared_transactions=0`, while the test requires exactly 2. The failed run remains recorded, not converted into a pass. Cleanup verified no owned resources remained.
- Unchanged atomic edit/rollback suite rerun through the runner's supported `--prepared-transactions 2 --jobs 1`, run `037c14a5b75d`: **90/90 pass**, zero skips/cancellations and no remaining owned containers/networks/volumes. No test assertion or production database configuration was changed. This includes actual prepared-writer refusal and cleanup, rollback, live owner/staff authority, stale version, concurrent winner, effect-once receipts, relational identity and atomic outbox/audit effects.

These fixtures prove the existing server owner. They do not establish hosted old/new version parity, a real provider, browser/native write acceptance or production rollback authorization.

## Android observation

The checkpoint APK built with production origins and installed on task-owned `emulator-5580` (Android 15/API 35, arm64). File bytes **148,733,840**; SHA-256 **`b7986bba53d44aa053f9defbfeec4d8581bac66aafd2c6e3411319d01c9c1925`**, installed hash verified. Flutter engine is arm64; plugin native libraries additionally contain armeabi-v7a and x86_64. This is debug signing, not a release-signed artifact.

The authorized account opened the catalog and an existing product. `Edit Product` and nonempty current fields appeared after the successful fresh read; no field was changed or saved. No hosted store-switch/revocation, media upload, product mutation or cross-client write is accepted by this read-only observation. The source snapshot after this checkpoint contains newer catalog presentation/page-recovery work and requires its own test/artifact attribution.

Logs and receipts: `/private/tmp/letbuyy-product-form-full-final.log`, `letbuyy-product-form-analysis-final.log`, `letbuyy-product-form-scope-final.log`, `letbuyy-product-form-governance.json`, `letbuyy-product-owner-acceptance.json`, `letbuyy-product-atomic-prepared2-final.json`, `letbuyy-product-form-android-artifact.json`. `QUALIFICATION.json` records durable compact outcomes.

## Open gates

Durable create identity/restart/lost-response readback; complete governed web product fields, options, media, category/collection and publication behavior; browser/native two-direction writes; restricted-staff/revocation on actual devices; real media delivery and permissions; inventory effects; signed releases, staging and post-activation readback remain open. This qualifies a privacy repair, not all of rows 20–28 or all 122 features.

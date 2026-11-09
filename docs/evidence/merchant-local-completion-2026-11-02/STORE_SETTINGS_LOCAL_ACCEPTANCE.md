# Store and SEO settings local continuation

This is source/local evidence, not whole-feature or production acceptance. Original entries14 and118 remain open. Source remains owned WIP on baseline `ab32485092cae0ac19145abf7b5a101fa3ea338e`; migration reconciliation is a separate pending human decision.

## Reproduced defects and repair

The actual Store Details form kept an old private draft visible after A→B→A selection. A delayed save restored the old selection (`expected store-b; actual store-a`). `store-details-negative-v5.log` retains those behavioral negatives. It also showed no fresh detail request at editor admission.

The canonical Store service now has a fresh authorized reader, without an offline fallback or selection side effect. StoreContext refreshes only the currently selected member, verifies the whole request key before/after awaits, preserves picker order and never trusts caller-supplied metadata. A late denied read cannot clear a newer selection; a current401/403/404 retires access. Store mutation transport captures context before waiting and pins the target store.

Store Details reuses those methods and the existing MerchantStoreView guard. Late results cannot restore another store or report success there. Confirmed save refreshes selected metadata. Unconfirmed saves require a current read before another mutation. Refresh failure preserves draft values; system Back offers Keep editing. Logo operations recheck the same view after picker/upload and do not claim unsaved text was saved.

SEO had the same private-draft/late-success and cache-admission defects. It also submitted null for clears even though canonical UpdateStoreSchema accepts text. `seo-settings-negative-v1.log` retains all three failures. The existing SEO form now sends explicit empty text, uses the same current-store/fresh-read boundary, refreshes selected metadata, sanitizes errors and preserves drafts on failed reload.

The shared Dart StoreModel did not read sites.meta_title/meta_description at all. `store-metadata-negative-v2.log` records canonical title→null and cleared canonical value→stale alias failures; the old-cache positive control passed. Canonical key presence now wins, including explicit null/empty clears; old caches are read only when that key is absent.

## Current bounded checks

Private run directory: `/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8`.

- `store-seo-repair-v1.log`:25 tests pass:10 focused Store Details/SEO regressions plus15 existing store-session boundaries. These overlap the full mobile suite.
- `flutter-full-v13.log`:852 mobile tests pass, zero failures. This includes the final metadata parser.
- `dart-models-full-v1.log`:74 shared-model tests pass, including the three new metadata cases.
- `flutter-analysis-v8.log`:clean.
- `native-settings-v1` failed the stronger planned observation because the SDK transparently recovered a single dropped reply; empty cleanup. No unconfirmed-state observation was claimed.
- `native-settings-v2`/d2bb7b806972 passed the strengthened normal Android/web journey. [Exact source/APK, observations, limits and cleanup](STORE_SETTINGS_NATIVE_WEB_QUALIFICATION.json).
- Later overview stale-card/full-context repair passes two negative-to-positive regressions, full mobile856 and clean analysis. Later source is separate from the device artifact.

## Remaining boundaries

- Email/phone/website native editing now validates and preserves unrelated profile facts; name edits omit unedited profile/address objects. A negative synthetic fixture reproduced the original loss, and the device roundtrip proves retention. Full business-profile coverage, native public-contact controls, the compiled current-revision web/native journey and durable business-receipt/restart acceptance remain open.
- The pending migration/source reconciliation does not waive those source checks. No primary WIP has been copied.
- Buyer-rendered metadata, exact publication/host/canonical/indexability, staff permutations, wider navigation/restart cases and all other settings remain separate.
- No hosted configuration, provider interaction, private production data, real CAPTCHA, push, merge or release was used.

## Canonical revision protocol follow-up

An owned database negative (`store-profile-cas-negative-v1`, run6c8c269e7166) proved a stale profile revision was accepted and restored an already cleared contact. The existing `sites.version` column/trigger now supplies a compare-and-set predicate to the canonical Gateway writer. Versioned profile fields require an observed positive revision; a competing edit returns409 without an effect. No new schema, trigger or parallel writer was added. Dedicated tax-only compatibility is preserved.

`store-profile-cas-controls-v1`/a5ae491948e0 passes9 owned checks (profile CAS1 plus tax settings8), including concurrent same-revision writers, malformed revisions, foreign-owner refusal and retained tax-only support. Owned resource cleanup is empty. Generic HTTP caching remains distinct from a durable business receipt; profile restart/receipt acceptance is still open.

All four current web profile writers—General, Business details, Preferences and billing GSTIN—and native Store Details/SEO carry the captured revision. Web edits use existing actor/origin/request-key admission and verify same-store next-revision acknowledgements. Refused or unconfirmed saves retain drafts and expose explicit current-read recovery. Billing retains the revision at edit start across quiet refresh rather than silently rebasing the draft. Shared contracts do not invent a revision for old cache rows.

Current source-level regression results: Gateway unit-v4 2041 pass; Merchant web-full-v3 phases562,818,295 pass with zero failures/skips; focused profile lifecycle-v4 14 pass; Flutter-full-v17 857 pass, analysis-v12 clean; Dart models-full-v2 75 pass. These overlapping cohorts are not a summed acceptance total. The exact compiled browser/Android follow-up is running in native-settings-v3; no current artifact acceptance is inferred from source tests or the older v2 device observation.


## Exact compiled settings follow-up

`native-settings-v4`/76f585b6be48 passed normal Android↔web owner journeys and terminal assertions: all four web profile writers, stale-tab409/draft-retain/cancel/explicit-reload, BFF wrong-actor409/wrong-origin403, native scrolled committed-reply-loss read recovery, exact web metadata in native, and native SEO empty strings read back on web. Sites.version3→9 proves exactly six effects; the three lost native name replies used one key/body and one effect. Contact/trade/address remain; legal/GST facts match intended updates. Cleanup is empty. STORE_SETTINGS_NATIVE_WEB_V4_QUALIFICATION.json retains source c959c19ac3dcd5736570eae37278d6a04c20c6f1d93fb365110a3ef346df831a, installed APK and13 screenshots. Full native858 tests and clean analysis used matching app inputs.

A subsequent seven-case negative proved success for malformed/missing/wrong acknowledgement revisions and caller-mutated nested input before the first wait. The native service now freezes request JSON and requires exact next-integer revision before replacing private metadata;21 focused settings tests pass. This source is separate from the v4 artifact. The next owned warehouse artifact includes a strict profile-save positive control. Durable business receipts/restart acceptance, public rendering and remaining settings remain open.

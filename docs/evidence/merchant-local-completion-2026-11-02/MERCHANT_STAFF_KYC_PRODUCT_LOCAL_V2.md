# Merchant Staff, KYC and product recovery — qualified local checkpoint

6 November 2026. Current source: `merchant-recovery-source-v11`, SHA256 `85c6e28b0e4fa33b40a35cf8f09c4a3c354226802236c8fec04989fd0835abe4`, 8,467 inputs. Branch `codex/merchant-mobile-parity`; HEAD `ab32485092cae0ac19145abf7b5a101fa3ea338e`. Inherited work is preserved. No hosted application/schema change, production data, real invitation/email, provider operation, push, merge or release occurred.

The current uninstrumented Android/web journey passed on run `84dbe0869504`, followed by independent source, control, installed-byte, database and cleanup checks. This is bounded local acceptance. The earlier 90-second startup wait remains an unresolved reliability finding; neither this result nor the diagnostic run proves its cause fixed. Full 122-feature acceptance remains open.

## Repairs

The owner-only Staff endpoint and canonical shared query now paginate with exact counts and stable created-at/ID ordering. Soft-deleted rows are excluded. Missing schema/count acknowledgement produces sanitized unavailable state instead of empty success or a weaker query. Beyond-end PostgREST ranges become empty only after a successful identically scoped count. Unscoped owned-site discovery also reads every page. Both shared clients preserve their complete-list interface, capture the invocation context, and reject malformed/changed metadata, duplicate/foreign rows and a failed tail instead of publishing a partial roster. Existing mutation, invitation, role, namespace and original-command authorities remain in place.

The KYC upload form now uses the shared sheet and current-surface lifetime controls. Pending uploads cannot dismiss the originating form; a covered completion cannot pop another route or submit again. Changed account/store/service providers retire the old presentation. At 320dp and 2.4× text, the fixed notice formerly left an 82dp record viewport, the GST dropdown overflowed by 63px, and the reference label clipped. One scroll owner, the existing choice sheet and shared input with a concise persistent label and wrapping guidance resolve those demonstrated layout issues. The 2–4 alphanumeric-character rule and four-character input limit are retained. Storage/provider policy is unchanged.

A name-only product save now preserves untouched null category and exact specification metadata, including numeric, boolean, empty-string and null values. Explicit specification addition/removal still works, and unmanaged metadata stays intact. Version, original intent, idempotency and conflict handling retain their existing owners.

## Local verification

Counts below are separate, overlapping scopes and must not be added together as feature acceptance.

| Gate | Result | Source scope |
| --- | --- | --- |
| Complete Flutter suite | 1,602 pass; no failures/skips | Fresh current source |
| Gateway unit/structural checks | 2,087 pass | Fresh current source |
| Root contracts | 389 pass | Fresh current source |
| Flutter analysis | 0 issues | Fresh current source |
| Focused KYC/shared-field checks | 61 pass | Overlap the complete Flutter suite |
| Focused product checks | 26 pass | Retained metadata, optional fields and concurrency; overlap broader gates |
| TS / Dart Staff pagination contracts | 14 / 14 pass | Shared SDK scopes, plus 22 combined Dart transport/security checks |
| Merchant web tests and typing | 1,732 pass; typing passes | Relevant web/backend/shared inputs remain byte-identical to the recorded passing scope |
| Owned Staff database suites | 50 pass; no skips; cleanup empty | 11 read, 19 lifecycle, 16 invitation and 4 safe delivery-failure controls; unchanged relevant inputs |
| Sealed invitation browser | Pass; cleanup empty | Ordinary owner invitation, wrong-account recovery, verified synthetic consent, downgrade and removal; unchanged relevant inputs |
| Governance | 114 pass; 1 not applicable | 211 existing advisories remain |
| Android / iOS debug artifacts | Build and retained-byte/font readback pass | iOS is compile-only; no iOS runtime acceptance |
| Current Android/web journey | Pass, then independent readback | Uninstrumented current source and installed APK |

[Independent source/debug gates](verification-2026-11-05/merchant-recovery-v11-independent-gates-readback.json), [native readback](verification-2026-11-05/native64-independent-readback.json), [cold custody](native64-accepted-local-staff-product/MANIFEST.json), [final source/custody check](verification-2026-11-05/native64-final-source-and-custody-readback.json).

## What the current device journey proves

Ordinary native/browser password sign-in and automatic app return ran through actual local Accounts and Merchant production-mode runtimes, compiled Workerd Gateway/BFF and owned PostgreSQL. It proved:

- All 53 memberships across two real pages, including the staff store beyond page 50.
- A native owner roster of 53 records composed from two real employee pages; exact full-row roster hashes unchanged by the read.
- Native store-name save read on web, web save read back on native, and normal web/native store switching.
- Actual old app process absence, a different new process ID, and saved Beta selection after restart.
- A native manager product-name save visible on web, with null category, typed/empty/null metadata, price and stock preserved.
- An actual 4×4 decoded fixture thumbnail under the canonical generated CSP.
- A live owner downgrade causing a real native 403 and retirement of the obsolete editor; removal then eliminates Beta from the refreshed 52-membership population while owned Alpha remains available.
- Unchanged free/reserved/committed/on-hand inventory and exactly one product receipt, audit and outbox effect.

Installed APK SHA256: `fdf3cfcf138d6aea80c7f7f96ffcf3f62125a558d8c2a677a91c23edfec3609c`. Exact APK and all 377 iOS debug-bundle files are retained under the repository-ignored `artifacts/local-operational-proof/merchant-mobile/native64-84dbe0869504/`. No raw readiness credentials, secret environments, cookies, JWKs or whole private run directory were copied into evidence.

Safe screenshots and 42 allowlisted evidence files have verified hashes. The current web product/media and native downgrade-denial images were reviewed. The web name still clips visually in the table, although the full accessible link and durable product value are present; that separate presentation issue remains open. The exact task emulator was gracefully stopped after readback, preserving userdata. Its isolated ADB server was not reset; owned Docker resources and task mappings were independently checked and restored.

## Preserved failures and their meaning

Four older Gateway source-text checks were retargeted to current comparison/unavailable states, the shared recorded chart and completed CSV byte-sharing guarantees. Original files are retained; analytics/export production code was not changed. The existing copied KYC infrastructure contract lacked its inactive template/README; both were restored byte-identically from primary, with no deployment or activation. Fixture-only failures and lint corrections remain in their original terminals.

Native59 failed the thumbnail assertion. Actual Merchant diagnosis proved CSP blocked an undeclared HTTP fixture origin. Declaring the exact actual API through the existing `NEXT_PUBLIC_API_BASE_URL` produced HTTP 200, decoded 4×4 pixels and zero external browser requests, without changing CSP/security source. Native60 then exposed an unhandled ordinary retained-sign-in recovery action in the driver. Native61 observed the 90-second restart loading wait. Temporary assertion-stage traces in four files completed the entire diagnostic62 story, but did not reproduce or fix that wait. Exact preimages and the whole current source were restored. The current APK independently contains none of those trace markers, with the diagnostic APK as a positive marker control. Native63 caught an immediate PID query before Android finished process creation; the driver now observes process creation with a bounded read-only wait after one launch. The 90-second UI deadline and all business/security assertions remain unchanged. Only the complete uninstrumented native64 story is accepted here.

## Still open

KYC durable original-intent recovery after unknown responses/restart and strict overview/list-shape validation are not implemented in this checkpoint. [The read-only audit](KYC_UPLOAD_RECOVERY_AUDIT_V1.json) identifies the existing shared schemas, canonical actor/store providers, encrypted `SecurityCommandStore.replaceIntent` owner and existing server receipts; no parallel storage system is needed. The direct-storage unknown-version stage requires careful reconciliation rather than another blind upload. No real KYC upload, storage/scan/retention qualification or payout readiness is claimed.

Complete media creation/reordering/removal, other product scalars, native invitation consent/delivery, all role combinations, the earlier startup wait and the remaining mobile/feature journeys stay open. New Staff readers require the paginated server contract; Gateway/client promotion needs coordinated staging qualification. There is no hosted or signed release candidate.

The inventory still has 35 unreviewed source rows, 211 nonadditive surface rows and an unresolved unique-surface denominator. Keep all 122 IDs represented: 120/121 excluded, 122 paused, 51 frozen. Schema 414–437 is unchanged. No row gains complete production acceptance from these local results.

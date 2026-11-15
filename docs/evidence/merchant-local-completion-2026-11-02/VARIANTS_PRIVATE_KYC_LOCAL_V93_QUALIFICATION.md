# Source93 variants and private KYC local qualification

2026-11-08. Implementation and local verification only. **Bounded functional journeys passed on Android, iOS and web; the full 122 feature programme remains open with 0 whole features accepted.** iOS accessibility alignment remains an explicit failure boundary.

## Implemented

The existing product editor now preserves explicit zero stock, optionless variants, optional price intent, stable variant IDs and unaffected rows. All existing option values can be edited, with up to three canonical option axes. Existing option names remain product-owned. Invalid or nonfinite prices and invalid quantities are rejected instead of silently becoming inherited prices or zero. Creation forwards canonical `product_options` through the existing service and SDK.

Private KYC recovery restores and locks the original document type/reference and keeps the original transport and request key. The shared Dart KYC uploader derives PNG/JPEG/PDF MIME from the same bounded byte array sent on the wire, rather than trusting the native filename. Empty, unsupported and over 5 MiB input fails before HTTP. Server validation and provider rules remain unchanged. Unknown India object acknowledgements remain held.

Source91 to 93 changes are limited to the product form/service, KYC form/service, shared Dart KYC transport and three meaningful regression test files. No backend/schema/governance architecture was changed. This source contains 8,516 core inputs, SHA `fbde9fe512840dcdc0d84ace8143a461aafbdfdac65fd14b626f2187234c10d7`.

## Actual local runtime evidence

| Scope | Android 127 | iOS 128 |
|---|---|---|
| Normal synthetic owner sign-in; compiled Gateway/BFF, Accounts and Merchant web, owned Postgres | Passed | Passed |
| Malformed price displayed as invalid; database unchanged | Passed | Passed |
| Second option Blue→Green; price 130; explicit stock 0; IDs and unaffected row preserved | Passed | Passed |
| Web reads native edit, saves 140; native reads 140 | Passed | Passed |
| Private upload commits 201; successful reply deliberately lost | Passed | Passed |
| Actual app termination/relaunch; original type/reference locked; retained file explicitly selected | Passed | Passed |
| Same original key 200 replay; exactly one private object/document; public objects 0 | Passed | Passed |
| Actual multipart MIME matches bytes; wire SHA matches private object; anonymous application asset request denied | Passed | Passed |
| Web shows Settlement bank account, masked 1234 and No scan result yet; native saved-document readback | Passed | Passed |

Android report: [native127-final-local-readback.json](verification-2026-11-05/native127-final-local-readback.json), run `fd613ef5b3fc`. Installed APK equals the retained artifact. Its 3 UI phases passed first attempt.

iOS report: [native128-final-local-readback.json](verification-2026-11-05/native128-final-local-readback.json), run `ea0fcb839150`. All 401 installed files equal the retained normal signed debug app; the fixture proves 4,891 common runtime/core paths equal current source. Functional evidence spans retained XCTest phases and continuations. Auth and variants passed first attempt. Eight KYC control failures remain; they are not passing tests or erased attempts.

The iOS picker opened asynchronously after the opener snapshot. Its exact owned thumbnail reported nonhittable despite being visibly selectable. One test runtime used the previous control sequence despite an updated source hash; unique test selectors and runtime markers established later bodies. Resumed-sheet accessibility bounds placed the action below its actual painted position. Ordinary AX taps missed and sent no API request; one tap derived from the actual screenshot reached the original request and 200 replay. **This workaround proves functional recovery; it does not fix or accept iOS accessibility alignment.** The transient success toast was not observed. The persistent saved-document card was then brought onscreen and required, followed by actual web readback, without another upload. No provider approval or live-readiness state was fabricated.

Earlier Android 124 MIME failure, Android 126 web-card selector failure, iOS 125 variant-driver failure and iOS 125 preboot launcher failure remain in their individual reports. Android 126 also proved that the prior source 92 encrypted original KYC file/type/reference/key could survive the updated source 93 APK before replay. Only Android 127and iOS 128close this cohort's complete functional stories.

## Regression and owned database gates

- Flutter: 1,756 passed, 0 failed, 0 skipped. App analysis: 0 issues.
- Shared Dart API: 141 passed, 0 failed; 6 existing opt-in skips. Shared SDK analysis: 0 issues.
- Owned product database suite: 90 passed with two prepared-transaction slots. The initial 89 pass / 1 environment failure is retained rather than counted as another 89 passes.
- Owned private KYC database suite: 5 passed. Owned cleanup is empty.
- Actual isolated governance validators: 114 passed, 1 not applicable; original source and staged entries preserved.

Counts describe different and overlapping scopes and must not be summed. Terminals/logs are retained under `verification-2026-11-05/` with `variant-kyc-v93`, `dart-api-v93`, and `merchant-variant-kyc-v93-governance-v2` prefixes.

## Preservation and remaining work

[Final custody](verification-2026-11-05/source93-final-custody.json) verifies all 8,516 core input bytes and staged path/mode/blob entries match the baseline. Raw index bytes changed and were preserved; no raw-index restoration or staging occurred. All owned supervisors are terminal; containers/networks/volumes and local 54350–54353 listeners are retired. The exact iOS simulator is restored to Shutdown. The original Android AVD remains booted with the app stopped and no reverse mappings. Existing files and Photos remain intact. Host 9002 was never contacted, probed, bound or stopped. No hosted change, merge, push or release occurred.

Still open: iOS accessible action geometry and compiled-test identity; global product-owned option names/values and sparse matrix management; native creation/deletion, held-stock and conflict/revocation/store-switch matrices; buyer Liquid/cart outcomes; broader private KYC roles/native PDF/India object-acknowledgement boundaries and real provider scanning/approval. Current native photo recovery uses an owned R2 fixture, not deployed India S3 or physical-device verification.

All remaining per-feature Accounts, stores/sites, catalog, inventory, themes, domains, buyer outcomes, orders/checkout, shipping/tax, money, growth and settings criteria continue under the existing local scope. Keep 51 frozen, 120/121 outside Merchant and 122 paused. Source 91 camera/Files/MOV/WebM evidence remains historical at its exact source; source 93 does not automatically requalify every public media journey.

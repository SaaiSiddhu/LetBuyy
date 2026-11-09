# Native camera and file-selection recovery — source91 local evidence

Current source `5b655a37c2bcc1b2f6e79cea831340addb0329c8b4b60b4a1f4aff33bafdec6c` contains 8,513 core inputs. Both native runs and final custody passed with these inputs unchanged. This closes the bounded public-media camera/File interruption journeys described here. Full 122-feature acceptance remains open; no whole feature has been promoted to accepted.

## Behavior delivered

The existing encrypted SecurityCommandStore now records actor, store, purpose, kind and original operation before opening an OS picker. Selected bytes are copied into an owned application-private directory and verified by size/hash before reuse. Android startup retrieves the lost result under the recorded picker/type; unknown or mismatched results cannot become public Media. Recovery stays asynchronous to startup and requires visible review and explicit use or discard. Existing SDK/server upload commands retain their original idempotency keys. KYC reference/type/transport and original upload keys stay bound; private KYC cannot enter public Media. These KYC guarantees have local controller/widget regression evidence, not native private-provider acceptance.

The shared picker and existing Media, product-image, store-logo and theme-image consumers use this owner. The global recovery notice now lives inside each routed page's accessibility scope. Account transitions hide it. Product-image recovery opens Products; private KYC opens its original verification area. Unsaved product/theme editor drafts are not automatically restored or attached by the notice.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Full Merchant Flutter regression | 1,750 pass / 0 fail / 0 skipped |native-selection-v91-flutter-all.terminal.json|
| Flutter analysis | 0 issues |native-selection-v91-analysis.terminal.json|
| Actual embedded WebM JavaScript | 5 pass |native-selection-v91-webm-dom.terminal.json|
| Actual isolated governance validators | 114 pass / 1 not applicable |merchant-native-selection-v91-governance-v2.terminal.json|
| Android 120, run a2ebf353bb12 |7 UI phases, all first attempt; backend/UI exits 0|native120-final-local-readback.json|
| iOS 123, run 5251418aa52f |6 UI phases, all first attempt; backend/UI exits 0|native123-final-local-readback.json|
| Source, index, devices and cleanup |PASS|source91-final-custody.json|

Counts overlap and must not be added.

Android 15 / API 35:Merchant's background process was actually killed while the external emulated camera remained foreground, for both photo and video. The old PID was absent before returning the camera result, and a different Merchant PID resumed. Actual native controls opened Review selection→Saved file selection→Open original area→the original upload purpose→Use saved file. Backend gates proved0 uploads / 0 Media rows before photo use, and only the previously approved photo before video use. No recapture, session injection or route workaround was needed. JPEG, recorded MP4, MOV/H264 and WebM/VP8 produced 4 uploads / 4 Media rows / 4 R2 objects with byte hashes. Actual recording/MOV/WebM controls covered decode, positive progress, seek, mute, pause and background pause. Native captions appeared on web; web edits read back natively. Installed APK SHA`a30c3a8c5ea3194da04dcd24e66b78fe13e91cc1a51fc8624e903fb7d175b06b` equals the retained build.

iOS 26.5:normal synthetic sign-in and Safari downloads passed. The app terminated while the actual Files picker was open, relaunched, exposed accessible Review selection, and discarded explicitly. Backend proved0 uploads / 0 Media rows before fresh selection. Fresh MOV/WebM imports produced2 uploads / 2 Media rows / 2 R2 objects with exact fixture-byte hashes. MOV AVPlayer and WebM in-app WebKit rendered, advanced, paused, muted, sought and paused on background; native captions→web edit→native readback passed. All 401 installed app files equal the retained normal simulator build, including camera/microphone purpose descriptions. Decoded MOV/WebM screenshots were manually inspected.

## Failures retained

Source 89 Android 118 exposed a real accessibility defect:the banner painted outside Navigator but was absent from platform semantics. Its original failures and limited data/control continuation remain in native118-bounded-local-readback.json. An independent app-builder regression also failed before the routed repair. Source 90 retained two obsolete route-test wrapper assumptions and one formatting lint; source 91 preserves the capability assertions through the wrapper and passes all gates. Source 88's 10 old Files-test provider-integration failures remain failed.

iOS 121 failed before app launch because the harness device receipt was missing. iOS 122 passed normal auth but failed when its synthetic MOV input was absent. Both failures and cleanups remain in native121-failed-harness-precondition.json and native122-failed-harness-inputs.json. Fresh 123 added receipt/control/project and exact clip hash preflight, then passed every phase without retries. No successful commerce effect was reset or failure relabelled green.

## Restoration and open coverage

Both successful backend runners report empty remaining containers/networks/volumes. Ports 54350–54353 are free. Android remains initially Booted, Merchant stopped, temporary camera permission false, and original empty private ADB mappings restored. The exact iOS simulator is back to initial Shutdown. Existing app/data/Photos/Downloads and generated synthetic inputs are preserved. Mac host 9002 was never bound, contacted, probed or stopped; Android localhost 9002 was only its owned reverse to Mac 54351.

Remaining:product variants/options, publication/reordering and actual buyer Liquid outcomes; private KYC native interruption/server receipt/provider outcomes; current-role/revocation/store-switch matrices; and each remaining Accounts/store/theme/domain/order/shipping/tax/money/growth/settings criterion. Web Gallery video decoding is unaccepted. These runs do not establish every codec/OS, physical iOS capture, microphone delivery, private provider, hosted, signed-release or production readiness. Feature 51 is frozen, 120/121 are outside Merchant scope, and 122 is paused; those policies were not expanded.

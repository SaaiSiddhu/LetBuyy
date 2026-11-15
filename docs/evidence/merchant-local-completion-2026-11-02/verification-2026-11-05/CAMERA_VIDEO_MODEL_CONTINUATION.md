# Camera/video/model continuation

Evidence and implementation plan, not authority. User7November2026 explicitly continues local implementation/tests and iOS runtime verification. Existing worktree, one agent; no hosted/provider activation, messages, push/merge, new runtime/dependency or memory writes.

Admission: source73 `fea6117e135deda4002896d072904f1655ab872fe949caa7c33455fb0e6c3820`, 8498 core inputs, same HEAD/branch; source manifest matches before edits. Preserve unrelated WIP/index and previous receipts. Mac host9002 stays untouched.

Trace: MediaLibraryScreen -> MediaService -> canonical Dart Upload/Media client -> mounted Gateway upload/Media routes -> existing original allocation/conditional R2 put -> Media command transaction -> reopened library/web readback. No business/schema/provider-policy change. Public API permits image jpeg/png/webp/gif10MiB, video mp4/quicktime/webm100MiB, model gltf-binary/gltf+json50MiB. Retained assets of older/other types remain readable. Product attachment remains image-only.

Findings to reproduce/repair:

1. Native menu lacks GLB/GLTF import although the canonical API and native model-card reader exist. Reuse locked file_picker10.3.8 without loading whole files into memory; cancellation/permission failures/retired scope dispatch no effects.
2. Saved original-file retry is exposed for image/video only. Extend current recovery to permitted model types, preserving original filename/key/digest/metadata and rejecting changed content.
3. Unsupported/oversized selections currently hash and allocate encrypted intent before API rejection. Preflight permitted public types and exact byte limits before a new intent; never erase an existing pending command or truncate data.
4. Video dialog autoplays without playback controls or visible retry. Complete existing video_player presentation with play/pause, mute, failure/retry and app-background pause; late initialization cannot play under retired route/store/account.
5. Camera-unavailable feedback currently suggests only changing permission. Distinguish unavailable hardware from denied access, preserve silent native cancellation and offer photo-library recovery. iOS simulator cannot certify physical camera capture.

Acceptance: meaningful pre-fix failures, focused/full Flutter and analysis, canonical model/API type conformance, isolated actual governance with source/index custody, fresh owned Media SQL/Worker controls if server-input behavior is affected, current normal iOS simulator build/install/auth/OS picker/category/media/web readback, actual video decode/playback and GLB/GLTF import where simulator supports the OS picker. Retain unavailable/unexercised paths explicitly; screenshots/builds never close whole122features. Existing source73 web102 and Android101 evidence remains only for its exact inputs.

Broader programme:119applicable whole features open;120/121excluded;122paused;51frozen. Continue remaining ledger after this coherent cohort; no whole-feature promotion from a subset.

## Additional observed video delivery gap

The canonical public assets route previously returned the entire object for every Range request. Actual compiled Worker/R2 baseline a828bf6c58f6:2pass/11fail across13 parent/subtests; protected-object controls pass. Repaired run f126d1575898:13pass/0fail/0skip and clean owned teardown. Counts include the parent and must not be added to other suite counts. The endpoint now supports one byte range with exact206 lengths, suffix/open-ended/large bounds,416, strongIf-Range andHEAD/304 precedence. Current publication/type checks precede all length/status disclosures; conditional R2 reads keep partial bytes bound to the observed object revision. Invalid/multiple ranges retain supported complete delivery. No schema, provider, public/private classification or topology changed.

Implementation references: [R2 Worker get/range/conditional API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [HTTP range/conditional semantics](https://httpwg.org/specs/rfc9110.html#range.requests). These inform protocol handling, not an architectural amendment. The new owned provider suite is explicitly registered in the canonical test catalog and its pinned inventory test.

Video source choices complete the existing shared source-sheet owner: camera recording, video library and Files. Original-video reselection exposes existing files/library without offering a fresh recording. Existing image callers retain their two native actions. Files import supports accepted video formats unavailable in a phone photo library and lets the synthetic iOS test preserve all existing Photos assets.

## Current source84 qualification and iOS continuation

Source84: `5f78a66e349980b7538b8c5a894967984d34baf80072677cfc2f30283dbdea1c`,8502core inputs,15changed inputs versus73. Full Flutter1719PASS;analysis0;Gatewaytypes0;rootcontracts400;isolated actual governance114PASS/1NAwith original index/source custody;fresh owned Media SQL12PASS. Range13PASS has byte-equal Gateway inputs. Existing web73 suites660/818/295/13 retained by unchanged web inputs; no claim those suites alone verify the new native media flow.

iOS103/104 failed after normal Accounts return while locating Category. Actual104 capture proves the first `XCUIElement` ScrollView was the keyboard toolbar (height44), whereas the product form had height341. No product behavior was changed to fit the test.106 selects the unique observed product body above Update and retains exact native/web/SQL category assertions.105 media extension is prepared, not executed: Safari synthetic downloads to OS Files, model lost-response/restart/receipt recovery, video import/explicit AVPlayer range playback, camera-unavailable behavior and caption web/native sync. No physical camera or native3D/AR renderer acceptance.

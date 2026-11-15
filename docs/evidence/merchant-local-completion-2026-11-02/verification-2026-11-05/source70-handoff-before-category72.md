# Merchant local continuation — source70 / native95 media recovery PASS

Implementation and local synthetic tests/builds are explicitly resumed by the human. Existing worktree `codex/merchant-mobile-parity`, HEAD `ab32485092cae0ac19145abf7b5a101fa3ea338e`; inherited source/index preserved. No push, merge, hosted/provider activation or release. Host9002 is foreign and was never probed, bound or stopped.

Web upload/registration and native/web Media edit/delete recovery are now locally proven. The accepted current-source run is `123f4ecc5372` (native95). Read [the complete local readback](verification-2026-11-05/native95-final-local-readback.json). Whole122 acceptance remains open; no entire feature is promoted by this bounded result.

## Implementation

- Native uses the existing encrypted command store to retain immutable metadata/deletion intent and original keys across restart. Browser uses one actor/site journal for byte upload→Media registration, edits and logical deletion; recovery reconciles ambiguous effects before replay. Missing rows can recover committed deletion receipts. Exact SDK idempotency forwarding prevents an auto-generated key from replacing the original.
- Product/theme upload consumers, Gallery and the shared picker use canonical Media registration/readback rather than fabricated rows or swallowed registration failures. Tenant/actor/session/origin, current role and retired-page/store guards remain. Registry and storage ownership are preserved; removal from Media does not delete referenced bytes.
- Web and mobile both edit filename, alternative text, caption, folder and tags. Invalid edits retain the draft. Native displays the editable filename and retains original upload provenance. The native page scrolls at320dp/2.4xtext/keyboard, controllers survive reverse animation, and own Save does not flash a false store-access warning.
- Real browser integration reproduced two additional defects: a Wasm digest forbidden by production CSP, and a redundant upload URL query that made receipt fingerprints disagree. The existing worker now uses locked incremental pure-JS SHA with unchanged CSP; upload context remains in canonical form/header with no redundant query. The proposed CSP expansion was rejected by automatic review, removed and replaced with this compatible solution.

## Verification

Pinned source `merchant-media-recovery-source-v70`, SHA `227c67d04d52c7d0cad74e5709db40e4dd93ca7917d7317a1d29a7fe680ac508`,8496 inputs. All still byte-equal after tests/builds/teardown.

- Full Flutter1676PASS/0FAIL/0SKIP; analysis0issues. Web phases655/818/295/13 and typecheck pass with0event errors on source69;70 differs only in one Dart test assertion, with explicit unchanged-input reuse. Root contracts398PASS. Counts overlap; do not sum.
- Real Chromium SHA checks, including100MiB, pass under unchanged production CSP. Actual isolated governance114PASS/1NOT_APPLICABLE; original source/index unchanged.
- Fresh compiled Worker/PostgreSQL/PostgREST/R2 Media suite12PASS: real lost COMMIT acknowledgements, registry/outbox/receipt rollback, strict validation, concurrent effect-once, changed-key conflict, revoked owner, wrong tenant, missing GUC and stale receipt-reclaim controls. Fresh Android debug build and normal iOS simulator build pass. Current Android runtime remains untested; native78 is historical.
- Three actual native95 UI phases pass: normal synthetic Accounts sign-in/automatic return and OS photo/product save; all5web metadata fields read on iOS and native caption save; web product save/native Refresh readback. Real browser loses upload/edit/delete replies only after commit, reloads and recovers original keys. No new byte upload on receipt recovery; metadata replay leaves `updated_at` unchanged; absent-row delete recovers; picker has1remaining positive-control entry; both product images still decode4x4. Price100/stock4 retained,1active Media row/2public objects.
- All401 installed iOS files match the retained build; manifest SHA `df1d1602702d5a84ffebccdcce4d7883b085b035a53f58044fb532759b00350d`. Fresh Android APK SHA `a7baa383dc8774243cf91d229389e68bb6d5d6d7b96733e26529660ed2d9fe0f`. Actual native/browser metadata screenshots reviewed in `verification-2026-11-05/native95-reviewed-images`. These are local debug/simulator artifacts, not signed-release acceptance.

Failure history is retained: native92 failed the now-fixed upload fingerprint recovery; native93 stopped before credentials after an unconfirmed OS-consent tap; native94 passed normal auth/photo/product and browser recovery but its driver expected a standalone filename where the real native card exposed a composite accessibility label. Native95 corrects those observed driver checks without changing application source or injecting authentication.

## Resource state and next work

Every backend/UI/test/build process is terminal. Both owned database runs report no cleanup failures or remaining containers/networks/volumes. The exact task iOS simulator `B907B390-5B08-490F-BC6A-8900667B2D94` is Shutdown, with installed app, userdata and Photos retained. No photo import/reset/deletion was added. Private synthetic control/runtime evidence is retained at `/private/tmp/letbuyy-ios-ui-20261107-ol4jw8ha`.

1. Broader product/media camera permission/cancel, video/3D, variants/options/reorder, buyer Liquid output and current-role/revocation/store-switch runtime coverage remain open.
2. Product form still has hardcoded category choices; trace the existing canonical category reader and category-name write contract before completing that parity. Web currently accepts free category metadata.
3. Private KYC interrupted-object/provider acceptance and the historical90second startup root cause remain separate from successful local test-R2 intake and normal sign-in.
4. Complete the remaining feature-by-feature web/mobile/buyer journeys and reconcile the unique surface denominator.119 applicable whole features remain open;120/121excluded,122paused,51frozen. Physical/provider/inbox/hosted/signed-release/production acceptance is outside this local synthetic result.

---

# Historical source62 / iOS88 evidence below



Current branch `codex/merchant-mobile-parity`, HEAD `ab32485092cae0ac19145abf7b5a101fa3ea338e`; inherited source/index preserved. Qualified source62: `8e2b9f6b03ff9ea79a70dd6cd0c17f2af00bd10eafac03df6119d8ba08c4b5a4`,8487 inputs. All owned jobs are terminal. No push/merge/hosted/provider/production changes are part of this local phase.

## Implemented and proven

Product photo/camera/library actions reuse the canonical Media library, its encrypted original upload/create recovery, image-only selection and current actor/store fencing. Media domain contracts live in the existing shared Dart models package; the service compatibility export remains. Cancellation and late/foreign results cannot attach.

Normal local iOS Accounts now supports the actual synthetic credential/system-browser/callback journey. Explicit development HTTP loopback configuration controls local CSRF/session cookies and the one-use local verifier SDK/CSP. Hosted HTTPS defaults, production signing-key strength/classification and disabled dev-auth bypass remain enforced. Source59 qualification and input-preservation reports retain the exact security boundary.

The remaining first-save failure was real UI obstruction: queued floating feedback covered actions positioned inside the editor body. Shared `LetbuyyEditorScaffold` now owns its action footer through Scaffold's footer geometry and applies the keyboard inset once. Feedback sits above Save. No product/tenant/version/idempotency guard changed; no temporary tracing remains. The2 pre-fix regression cases failed; the repaired feedback/keyboard cases and product/draft/navigation tests pass.

## Current qualification

- 1,662 Flutter PASS/0 FAIL/0 SKIP; analysis0issues;15 focused checks are a subset. `verification-2026-11-05/editor-feedback-v62-pipeline.terminal.json`.
- Real governance gate only in a disposable copy:114 PASS/1 not applicable, no failure/skip; original8487 inputs and index unchanged. `merchant-editor-feedback-v62-governance-v1.terminal.json`.
- Source62 differs from59 only in the shared Dart editor and its new regression test. Source59's409 root contracts,73 Identity+6 repository checks,76 shared web UI tests and types/build have an explicit unchanged-input reuse boundary. Counts overlap; never sum them. `editor-feedback-v62-source-delta.json`.

## Current bounded iOS/web acceptance

Run `736d90079837`, exact task simulator `B907B390-5B08-490F-BC6A-8900667B2D94` (LetBuyy Merchant Local20261103br1jhgh8), normal simulator build, local compiled Gateway/BFF, real owned PostgreSQL/PostgREST and local R2. Native credential/product test, native web-readback test and backend suite all exit0. The401 installed files match the retained build; artifact-manifest SHA `f5b7ea372005e5456a21df3e2a3a854cd87152d6a97860309fbfc9ff7b9e0caa`.

Actual normal synthetic sign-in/automatic return, OS photo selection, exactly 1 byte-upload request201/1 Media creation201/1 product PATCH200,1 Media row/1 asset registry/1 public object, web 4×4 image decode, web product save and actual iOS Refresh/name readback passed. Final price 100 / stock 4 / image count 1 preserved. Update was tapped once while feedback was visibly above it; there was no snackbar-expiry wait or retry. Feedback frame `(0,680,402,80)` ends at760; Update `(16,776,370,48)` begins at776. This closes this specific first-save interaction failure.

Read `verification-2026-11-05/native88-final-local-readback.json` and `native88-control-custody.json`; actual admitted fixture/Swift/launcher retained unchanged. Reviewed screenshot: `native88-reviewed-images/ios-feedback-above-update.png`. Product-list screenshot proves the named readback only, not complete visual/accessibility acceptance. Web image decoding is a DOM assertion; its screenshot does not independently certify a buyer render.

All exact owned server/database/container/network/volume teardown completed without failure; every source62 input still matches after teardown. The exact task iOS simulator is now Shutdown with its installed app, userdata and Photos retained; see `native88-final-device-state.json` and `source62-final-custody.json`. Existing Photos assets were preserved; the one admitted synthetic4x4image was reused without another import. Synthetic credentials/private runtime files remain private. No UI or server process is left awaiting a marker.

## Remaining programme work

All 122 rows remain:119 applicable whole features open,120/121excluded,122paused,51frozen.211 nonadditive surface candidates/35 source-unreviewed/193 app-library files; unique surface denominator unresolved. New bounded proof is attached to1/20/21without accepting an entire feature.

1. Original-key web upload/registration recovery; durable native/web Media metadata/deletion recovery. Web upload currently swallows registration errors; do not report false success.
2. Broader product/media/camera permission/cancel/video/3D/variants/reorder and actual buyer Liquid rendering. Product form's hardcoded category choices also need parity with the existing canonical category read contract.
3. Remaining current-role/store-switch/revocation and every applicable web/mobile/buyer journey. Native78/source54 Android evidence stays historical; no fresh source62Android runtime claim.
4. Private KYC interrupted-object/provider review and the historical 90-second startup root cause are separate from normal test-R2 intake, ownedSQLfault proof and this iOS sign-in.
5. Real-provider/inbox/sandbox, physical-device, signed-release and hosted acceptance remain outside this local synthetic proof. No full-iOS/full122/production-ready certification.

Use `FEATURE_ACCEPTANCE.json`, `MOBILE_UI_CONTINUATION.json`, and `verification-2026-11-05/FINAL_LOCAL_CHECKPOINT.json` for current scope. Preserve all failed/retried83–87, temporary diagnostic60/removal, negative61 and earlier native reports; do not rewrite them as accepted. Native84 was functional with retried Update;88 is the current single-tap proof. `HANDOFF.pre-source62.md` retains earlier detail.

Work in this chat as one agent/current worktree. Mac host 9002 belongs another task; never bind/probe/stop it. Earlier Android AVD/ADB receipts need fresh ownership verification before control. Do not reset userdata, remove existing Photos, prune shared resources or rerun the destructive governance gate in this checkout. No memory writes, new agents/worktrees, push/merge/hosted activation or real messages are authorized by this local phase.

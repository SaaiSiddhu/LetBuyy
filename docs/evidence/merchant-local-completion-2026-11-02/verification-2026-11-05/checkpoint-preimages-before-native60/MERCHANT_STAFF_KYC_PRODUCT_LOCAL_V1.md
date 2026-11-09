# Merchant Staff, KYC and retained product recovery — local qualification

Current source `merchant-recovery-source-v11`,SHA256`85c6e28b0e4fa33b40a35cf8f09c4a3c354226802236c8fec04989fd0835abe4`,8,467inputs;HEAD`ab32485092cae0ac19145abf7b5a101fa3ea338e`. Inherited WIP retained. Local source/debug qualification passes; current native59 acceptance is running. No full-feature or release certificate.

## Staff list and invitations

Gateway's existing owner-only `/employees` validates the canonical query, paginates with exact counts and stable created-at/ID ordering, excludes soft-deleted rows and sanitizes unavailable schema/count state as503. Optional unscoped owned-site discovery is also paginated. A beyond-end PostgREST416 returns empty only after an independently successful count under identical owner/deletion predicates. Missing store/deleted columns never become empty success or a weaker query.

TS and Dart retain their complete-list interface, validate raw pagination/total/continuation/row acknowledgement and refuse foreign/duplicate rows or partial results from failed tails. Actor/store invocation context is captured before asynchronous continuation. Existing Staff mutation, role, invitation and original-key authorities are unchanged. Existing namespace assertion remains intact; list fixtures now provide truthful pagination metadata.

Negative populated owned-DB source `staff-list-negative-v1` has1PASS/8FAIL. v3 owned repair has49PASS/0FAIL/0SKIP. A later added52owned-site control initially lacked mandatory site_type; that fixture failure is preserved, corrected without assertion removal, and current v9 DB has50PASS:11read/19lifecycle/16invitation/4safe-delivery-failure controls,emptycleanup. TS14/Dart14 pagination tests and245mobileStaff/services checks pass in their exact recorded scopes; counts overlap broader suites.

The sealed actual local-provider invitation browser passes ordinary owner invitation, wrong-account recovery, verified synthetic staff consent, downgrade and removal. Runtime/SDK/server fixture inputs are unchanged from its v9 source. This is not inbox/provider delivery or native invitation acceptance. Older unsealed Staff browser is not admitted. No real invitation/email occurred.

## KYC form lifetime and readability

Corrected pending/covered-surface negative fixture has1populated successful controlPASS/4FAIL. Initial one-frame dismissal diagnostics were inadequate and are not accepted. The form now uses existing shared sheet lifetime controls, prevents pending dismissal, rejects changed service/store providers and retains covered acknowledgement without popping another route or issuing a duplicate command. Reference validation remains2–4alphanumeric characters and native maxLength4.

Real320dp/2.4x testing then reproduced an82dp list viewport because the fixed notice consumed the page and the floating action obstructed its center:2normalPASS/2largeFAIL. The unchanged notice/status/record logic now shares one scroll owner. That exposed a GST dropdown63pxoverflow; the existing shared choice/apply sheet replaces it. Original five document-type prefills/default assertions remain against the canonical field. The actual rendered reference label still clipped; the existing shared input with concise persistent `Reference` label and wrapping `Final2–4characters` guidance fixes that. The longer-label shared-input attempt remains failed evidence. Current61focusedKYC/shared-field tests pass,overlapping the full suite.

Current visual v5:4normal/large/light/dark cases pass,with top/actions PNGs. Normal dark and large light actions were inspected; full guidance wraps and actions remain reachable. The earlier missing-GST and missing lazy/action-scroll probes are harness failures,not app defects. Test inset/rendered images do not prove a real keyboard or spoken screen-reader journey.

KYC service/provider/storage policy is unchanged. Durable unknown-result/restart recovery and overview/list-shape validation remain open; see `KYC_UPLOAD_RECOVERY_AUDIT_V1.json`. No real document,external storage or scan/provider operation occurred. Intake remains test-only; no verification/payout readiness inferred.

## Product retained data and media

Name-only save formerly changed null category to empty string,dropped null/empty specifications and stringified numeric/boolean values. Negative:2controlsPASS/4FAIL. The existing form now omits untouched null category and preserves unchanged/unmanaged metadata against the latest acknowledged base while honoring explicit specification changes/removal. Focused26PASS:7retained metadata/6optional/13concurrency. Version/original intent/idempotency/conflict authorities unchanged.

Native59 adds exact database equality for null category and typed/empty/null specifications alongside unchanged stock,reservations,receipt,audit and outbox counts. The previous thumbnail fixture omitted its loopback image origin from the browser fence. Native59 admits only that exact owned origin and requires actual4x4image decode; no application security header or external-network policy is weakened. Prepared/running is not acceptance. Media creation,reorder,removal and other scalar fields remain open.

## Current gates and continuity

[Independent current readback](verification-2026-11-05/merchant-recovery-v11-independent-gates-readback.json):fresh1,602Flutter/2,087Gateway/389root contracts/analysis0;114governancePASS/1NA/211existingadvisories;Android and explicit shutdown-iOS-simulator debug artifacts with retained-byte/font verification. Web1,732+typing,owned Staff50 and sealed invitation-browser1 are reused only by exact relevant owner/fixture equality outside3KYCfrontend/test paths. Counts are nonadditive.

v5 four stale Gateway source-text checks were retargeted to actual comparison/availability/shared-chart/completed-CSV guarantees,with original files preserved; no analytics/export production edit. v6 then found the existing copied KYC contract's absent infrastructure template. Its exact inactive template/README were restored from primary; same test byte-identical. No AWS or other deployment. All earlier failed source/fixture/lint attempts remain preserved; do not relabel them current passes.

Native59 uses current normal Android/web login and compiled Workerd Gateway/BFF with owned PostgreSQL. Admission/control hashes: `verification-2026-11-05/native59-prepared-final.json`;PTY49736;private root `/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4`. Collect complete terminal,independent verifier,screenshots,installed APK/source hashes and exact cleanup before acceptance. Prior native58 retains only its own99ddsource/APK story. iOS is compile-only.

No schema/migration,money/provider/storage authority,hosted/private production,push/merge or release action occurred. All122IDs remain represented:120/121excluded,122paused,51frozen.35source rows remain unreviewed;unique surface denominator unresolved. Full applicable-feature and signed-release acceptance remain open.

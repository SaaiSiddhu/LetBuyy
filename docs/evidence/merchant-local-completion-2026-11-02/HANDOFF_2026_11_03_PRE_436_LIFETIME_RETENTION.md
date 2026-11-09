# Merchant local completion: current handoff

Continue implementing and verifying the feasible original119entries. Do not stop at a plan or claim all122accepted.

## Active work: approved shipment commitment

The human approved **“Commit when shipped (Recommended)”**. The concrete local-only plan is TRANSFER_RESERVATION_TIMING_DECISION.md. Do not re-ask.

Migration436and its paired DOWN now exist as **unqualified source candidates**:

- database/supabase/migrations/436_canonical_transfer_reservations.sql
- database/supabase/rollback/436_canonical_transfer_reservations.rollback.sql

The first six real stock regressions now pass: run **a56baacdd507**, runner0,6PASS,0FAIL/SKIP, empty owned cleanup. This is bounded Gateway/cart/database proof, not acceptance of the migration or a normal-device journey. AFTER that run the candidate gained stronger original/current function, grant, table, column, constraint, trigger and policy fingerprints; those changes are under qualification now.

**Active session51554** runs the owned suite merchant-transfer-ship-commit.postgres.test.ts. Read N/inventory436-lifecycle-v1.log, its suite log under the corresponding -logs directory, and terminal JSON. It tests shipment/replay/partial-final receiving, durable expiry isolation, raw-role refusals and private lifetime readback. The final reader is still incomplete: the old reservation DTO requires a finite expires_at, while new transfer holds use a strictly bound PGinfinity. Expect a named reader failure until that contract is completed; do not weaken validation to accept an unbound missing expiry. Collect the actual terminal before further SQL changes. No emulator/Next runtime is currently running for this cohort.

N = /private/tmp/letbuyy-merchant-local-20261102-br1jhgh8.

## What436currently changes

- Existing transfer create calls canonical reserve_inventory; ship calls canonical commit_inventory_reservation; receiving no longer subtracts source stock again.
- A unique reservation_id on existing transfer lines binds durable warehouse holds. A deferred constraint checks site/product/variant/source/quantity and transfer status. Infinity is permitted only with that real binding; ordinary finite TTL holds remain subject to the existing sweeper.
- Retained pending transfers are reconciled through the same kernel. Original IDs, received counters and warehouse acknowledgement JSON are preserved. Unexplained/oversubscribed stock refuses cutover.
- A generated free_quantity derives raw available minus reserved for correct filtering/order/count before pagination. The shared projector now exposes free available/sellable and raw on_hand, instead of counting the hold twice.
- Existing cache writers call one default/fallback cache helper, including reserve, commit, release/expiry, setters, PO/transfer, cancellation and restock. Absolute stock setter preserves the reserved subset.
- Raw DML on levels/reservations/transfers/lines is fenced for the four application roles; private canonical functions retain their existing execution owners/grants. SELECT, RLS and FORCE remain.
- DOWN conservatively refuses any retained inventory operations. Empty UP→DOWN→UP, populated refusal/equality, tampering, concurrency and native/catalog provenance qualification are still REQUIRED. Do not report rollback accepted yet.

Source hazards still to finish:

1. Complete canonical TS/Dart/API/SDK/web/native reservation lifetime/reference validation. Private readers must represent “held until shipment” or “committed at shipment”, not parse infinity as a date or silently accept unknown expiry.
2. Audit native adjustment acknowledgements: stored raw level snapshots must remain immutable and must not be published as current free quantities. Prefer current authorized readback; retain original keys/intents and old receipt bytes.
3. Add full variant/multiline/race/stop/permission/retained-data/rollback/negative-profile controls. Preserve original prepared transaction and native managed-catalog/provenance tests.
4. Audit all default-location changes, active cache writers, quantity filters, history and operational metrics. Do not invent a new allocator or SUM(alllocations) into product cache. Existing cart and166order kernel select active default then oldest level; cart additionally uses ID for ties.
5. Qualify current compiled runtimes and a fresh normal web↔Android journey. Intentional new partial-transfer expectation: stock committed at shipment has no remaining source reservation; transit comes from existing shipped/received counters. Final2+2stock and original receipt equality remain required.
6. Small native polish remains: PO status always success, transfer status always warning, arbitrary available/20bar. Use existing tokens in the next coherent Dart cohort.

The private builder scripts generated the initial candidate; root SQL includes later manual fixes/hardening. Do not rerun a stale builder over the current source. Preserved candidate failures: v1/62f8c6e94ef3record-alias bug; v2/ec157c6ae6dbmissing catalog-definition terminators. Both ran0behavioral tests and cleaned up. v3/a56baacdd507is the first six-case pass. No436hosted execution has occurred.

## Proven negative baseline and owned metadata

- Original6947c206da30:1positivePASS/3realFAIL. Transfer hold4in20exposed12to checkout; canonical reserve16also failed; customer hold18did not prevent transfer4.
- Expanded79e573418e6f:1positivePASS/5realFAIL. Actual inventory API showed24on hand for20with4held; another-location receipt2overwrote the default cache although actual default cart20still succeeded.
- Exact original fixture is N/transfer-cart-negative-v1.fixture.ts. Structured findings are TRANSFER_RESERVATION_COMBINED_NEGATIVE.json.
- Current14-function/table/grant metadata is N/inventory436-original-functions.json, copied from owned diagnostic7beecbbe580b, SHA7449804c0d48dc28bc151c57a073de88f00a64e828fba101eb93520a8ef88a92. This is metadata, never feature acceptance. Earlier diagnostic28713313955efailed on SQL whitespace; b2c573b695f0captured12functions successfully. All owned resources cleaned up.

## Last accepted warehouse source/artifacts

**v11run3acddf6ca92e** passed normal Accounts PKCE→Android and normal web metadata/PO/transfer journeys, lost reply/restart/exact retry, readable scoped names and bidirectional final readback. Final available2+2/reserved0/incoming0,11receipts, original partial receipt unchanged. Both native final screenshots were inspected.

- Source23b83f0f827178f495923b9cb9e07ddb48ff423179cdbdb34441461fb99cdad6 /7414, archived N/warehouse-labels-v2-qualified-source.
- Retained/installed debug APK1561ad8e7049012deb841054aabd934e498eb57c000fd2637fb1f86cc04bdfc6.
- Full Gateway2070, Flutter922, shared Dart109, web phases594/818/295/13, BFF28, clean types/analyze, disposable governancev13:114PASS/1N/A, noFAIL/BLOCKED/SKIP. These counts overlap; never sum them into features.
- WAREHOUSE_SCOPED_READ_LABEL_QUALIFICATION.json records exact scope. Node BFF/Gateway modules, real ownedPG/PostgREST and local production-mode Accounts/Merchant Next; no compiled Workerd phone claim. Current436source is newer and not covered by this acceptance.

Independent iOSv3compile passed with unchanged source088a2bb60dcd98c911dc4997c69fb3fab739d3dff73778c17fb2152d811923cb /7421. Archive N/ios-warehouse-compile-v3-qualified-source; retained debug arm64simulator app, adhoc/noTeam; manifest e6b59142063a690ad3000958e02c753a25a00b809889f161163eda3b42118b5e. See IOS_WAREHOUSE_COMPILE_V3_QUALIFICATION.json. No iOSUI/auth/backend journey. This predates436and cannot qualify future Dart/schema changes. v1failed for missing watch-companion target ID; v2compiled but failed source freeze because Xcode added a second identical Swift lock. Both preserved. Both locks74e7d6d4…are now pinned.

Earlier bounded collection/native/web/compiled Liquid, trial, staff, original membership and retained-data proofs remain in their structured reports. The complete pre436chronological handoff is HANDOFF_2026_11_03_PRE_436_LIFECYCLE_CHECKS.md; follow its report links, not its historical RUNNING prose.

## Scope, authority and settled decisions

Task attachment: /Users/saai_mithra/.codex/attachments/10ee6da3-1868-44f0-868d-242ff4fc310e/Pasted text.txt.

Local only: source, synthetic accounts/data, owned disposablePG/PostgREST, local Workers/Next, owned emulators and local builds/commits. No hosted access/config/schema/deploy, production login, private exports/backups/decryption, provider effects/messages, DNS, push/merge/release. Earlier hosted approvals are superseded. One agent only; no subagents/chats/goals. Original120/121excluded,122paused,51frozen. No pending human question.

Settled: preserve414warehouse/415gift/416CSV; reviewed primary417–432admitted; category433; saved Launch trial434; single collection authority435; shipment commitment436if legitimately unused. Primary was last checked at5614ffa7efcd93759c7bba63d1ea899d21253270/max432. Active branch codex/merchant-mobile-parity, HEADab32485092cae0ac19145abf7b5a101fa3ea338e, allWIPours. Primary is read-only. Never reset/merge/push or change old migrations to make a new gate green.

Installed letbuyy/cloudflare-supabase-architecture skills and Constitution/root/local AGENTS/canonical registry apply. React best-practices was read/applied. Governance cleanup runs ONLY in disposable clones.

## Tools and resources

Owned runner: node scripts/governance/run-executable-suites.mjs --jobs1 --no-reap --kind gateway-db --suite PATH --timeout SECONDS with unique log/result paths. Use spaced actual CLI arguments. Never --help (unsupported) or ambient/restored databases. Original prepared-writer suite needs --prepared-transactions2 and1200seconds. Do not mix legacy role-reset foundation with current Gateway suites.

Gateway units: pnpm --filter @letbuyy/api-gateway test:unit. Flutter commands run inside apps/merchant/mobile with --no-pub; SDK /Volumes/Developer Tools/SDKs/flutter/bin/flutter and scoped escalation. Root Dartworkspace locks are at repository root.

Android: root /private/tmp/letbuyy-merchant-emulator-b2xr88lq; AVDLetBuyy_Merchant_Parity; serialemulator-5580; PID58953; ADB15038; SDK /Volumes/Developer Tools/SDKs/android-sdk. Preserve app data, no pmclear. Mac host9002belongs to another task: never probe/use/stop/rebind it. Emulator-only reverse9002→owned54351is task-scoped. No camera permission granted.

Task iOS simulator: receipt N/ios-owned-simulator-v1.json; nameLetBuyy Merchant Local20261103br1jhgh8, initiallyShutdown. User's booted iPhone17Proand other simulators are untouched. No iOSUImethod has been exercised. Retain the owned target for later current-source qualification.

Snapshots: N/capture-code-snapshot-v2.py capture|verify NAME includes root Dartlocks+DOC01/03as well as code/config. Old helper/manifests remain unchanged. Native-device fixture already included root Dartlocks in its own closure. Capture before owned Next startup and verify after retirement; active markers are refused. Archive with N/archive-code-snapshot.py only after a truthful scoped pass. Do not call a diagnostic or failed run feature acceptance.

Governance: N/qualify-governance-capsule.py governance-category-capsule-vNEXT; unique disposable clone only. Latest completed v13. No heavy concurrent emulator/Gradle/database/gate jobs. Stop only proven owned resources.

Old shipping-tax browser fixture lacks the owned Turnstile provider profile/attachment: fix/admit its local fixture before running it. Do not let it contact real Cloudflare. Broader119work remains after the current inventory slice; FEATURE_ACCEPTANCE.json preserves all122IDs and known defects.

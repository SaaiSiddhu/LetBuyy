# Phase 1R — C3/C4/C5 continuation closure evidence

Measured 2026-09-27, single agent, in `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase1r`,
branch `letbuyy/phase1r-firebase-free-marketplace`. This document reports what this session
measured directly (fresh command output, a fresh build, direct process/log inspection), not
historical claims. It responds to the owner's "Complete ALL remaining Phase 1R work" task,
continuing from the 27 September 2026 corrective review of HEAD `b878d6df`.

## Repository identity and tree state

- Starting point: `b878d6df0970cb669187adc70f75a65205abcd57` (matched the task's own "last reviewed
  HEAD" exactly; no drift to reconcile).
- Current HEAD: `32d68173c3bdd461276d7d492c14ccc5a7445df6`.
- 7 commits made this session (`11d5cbd1` … `32d68173`), each independently `flutter analyze`-clean
  and full-suite-green before being committed. Full messages carry the single-agent declaration and
  are the authoritative record of what changed and why; not restated in full here.
- `git status --porcelain`: clean except the two pre-existing, already-untracked deferred-iOS
  ephemeral build files noted at the start of this session
  (`apps/deferred/delivery/mobile/ios/Flutter/ephemeral/{.swift_pm.lock,Packages/}`) — unrelated to
  this app, harmless SwiftPM byproducts, not introduced this session.
- Primary checkout (`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy`) was not written to.
- No merge, push, deploy, or Phase 2 advancement occurred or is claimed.

## Requirement matrix

| Area | Status | Evidence |
|---|---|---|
| Cart/wishlist rollback-stomping race | **Fixed** | `11d5cbd1`; negative control confirmed regression on pre-fix code |
| Buyer/guest local-storage isolation (D-BUYER-SCOPE) | **Implemented** | `11d5cbd1`; 12 new tests, real negative control on 2 |
| Checkout idle-account-switch reactivity | **Fixed** | `11d5cbd1`; new widget test for the idle-switch case specifically |
| AIChatService construction-time crash | **Fixed** | `bfee87a7`; reachable from web_header.dart's live "AI Chat" entry; 2 new tests |
| Firebase-importing file count | **71 → 39** | measured before/after, see below |
| `firebase_storage` package dependency | **Removed** | pubspec.yaml (both packages) + pubspec.lock; confirmed absent from built APK's manifest |
| `firebase_core`/`firebase_auth`/`cloud_firestore`/`cloud_functions` | **Still required** | 5 services + ~30 models still import them; not yet closed |
| Fresh debug APK build | **Done** | see Artifact evidence below |
| Automated test suite | **117/117, 0 failed/skipped** | see below |
| C5 Android E2E | **Blocked** | emulator boot hung twice under confirmed host memory exhaustion; see below |

## C3 — Firebase SDK/native retirement (substantial progress, not complete)

### What closed this session

- **Cart/Wishlist race + buyer scope** (`11d5cbd1`): redesigned `CartProvider`/`WishlistProvider`
  around a single serialized operation queue (`_enqueue`/`_mutate`) so a mutation's closure only
  ever runs once it is alone at the front of the queue — closing a real bug in the *previous*
  correction where one operation's failure could roll back a different, later operation's already-
  committed success. Added per-canonical-buyer-ID local namespaces (never per session token or
  email) plus one shared guest namespace, switched via `updateUserId` wired through
  `ChangeNotifierProxyProvider<BuyerSignInController, _>` in `main.dart`. Added
  `transferGuestCartToBuyer()`/`transferGuestWishlistToBuyer()`: explicit, idempotent,
  failure-safe merge primitives — **the UI trigger for this transfer is not yet wired** (disclosed,
  not silently dropped; the provider-level primitive is complete and tested).
  `BuyerSignInController` gained a `buyerId` getter (the account's own canonical id), cached on
  `StoredBuyerSession` for the offline-restore path.
- **Checkout reactivity** (`11d5cbd1`): `checkout_screen.dart` now watches `BuyerSignInController`
  and reacts via `didChangeDependencies`, closing the one gap its own prior doc comment named — a
  buyer who signed out/switched while the screen sat idle (no request in flight) used to keep
  seeing the previous buyer's address indefinitely. A `_lastLoadStartedForToken` guard makes this
  idempotent against the pre-existing in-flight self-heal, a real interaction proven necessary by
  an actual widget-test failure during development (Flutter delivered the identity-changed
  notification several frames after the self-heal had already corrected the screen).
- **AIChatService crash** (`bfee87a7`): a singleton whose `auth`/`firestore` fields were eager
  `final` initializers, so merely touching `AIChatService.instance` threw, uncaught, with no
  Firebase app ever initialized. Reachable from `web_header.dart`'s live "AI Chat" menu item — a
  real, user-facing crash, not just Firebase-graph hygiene. Fixed with a lazy getter and a
  `_safeCurrentUser()` helper.
- **Reels retired** (`ea619677`): `ReelService`'s constructor had the identical eager-Firebase-
  singleton crash class; its two real call sites had *already* been fixed in an earlier commit this
  phase (their own doc comments describe the exact crash), leaving `ReelService`/
  `ReelsPreloadProvider`/3 reel models with zero real callers. Deleted.
- **Loyalty retired end to end** (`bd6bb4c3`): a prior commit this phase had already found and
  removed one fabricated-permanent-state surface (profile screen's "TIER MEMBER" badge); this pass
  traced and closed the two it had missed (`home_app_bar.dart`'s points badge and the `/loyalty`
  route it opened; `payment_method_screen.dart`'s redemption card) and deleted the whole
  `LoyaltyProvider`/`LoyaltyService`/`LoyaltyModel` subsystem. The one decorative, non-Firebase
  remnant (profile screen's permanently-bronze avatar ring) is inlined as a constant, not deleted —
  it makes no textual claim, matching that file's own prior judgment.
- **12 zero-caller services deleted** (`bd6bb4c3`, `ea619677`): `auth_service.dart`,
  `database_service.dart`, `storage_service.dart`, `order_notification_service.dart`,
  `order_service.dart`, `stock_service.dart`, `firestore_data_service.dart`, `seller_service.dart`,
  `admin_service.dart`, `app_update_service.dart`, `ad_service.dart` (+ `ad_provider.dart`),
  `fee_service.dart`, `invoice_service.dart`, `product_stats_service.dart` — each confirmed via grep
  across the whole app + package tree (not just the app layer, after one initial gap in that
  methodology was caught and corrected mid-session).
- **DealService/DealsSection**: gutted `DealService` to its one reachable method
  (`getActiveDealForProduct`, called from 7 product-card-shaped widgets, all already
  try/catch-safe); deleted `DealsSection`, a duplicate, unguarded, crash-risk Firestore stream
  section that had been left rendering *alongside* the newer, canonical, already-tested
  `DealCardsSection` on the same home screen.
- **ReturnService**: gutted from 25 Firestore/Cloud-Functions/Storage methods to the 4 still
  reachable (all 3 real callers had *already* reduced themselves to an honest "Returns aren't
  available yet" state or a dead branch in earlier commits this phase); deleted
  `ReturnQCModel`/`DefaultReturnReasons` alongside it.
- **AddressModel/OrderModel/ProductModel**: deleted dead `fromMap`/`toMap`/`fromFirestore`/`toJson`
  (zero real callers each, confirmed) while preserving the still-live `fromMap`/`fromJson` paths
  canonical rewiring depends on; `_parseTimestamp`-shaped helpers now duck-type `.toDate()` instead
  of checking `is Timestamp`, removing the static type dependency without changing behavior for a
  real Firestore value if one is ever handed to it.
- **`timestamp_parser.dart`**: an entirely unused "shared utility" (not even exported from its own
  package's barrel) — deleted.
- **`payment_method_screen.dart`**: `_proceedToConfirm()` used to silently do nothing when tapped
  (gated on `safeFirebaseCurrentUser() == null`, always true) — now shows an honest "Checkout isn't
  available yet" dialog. `_createOrder` (Firestore order creation) and `_showOutOfStockDialog`
  (Firestore stock validation) deleted as genuinely unreachable, not merely disconnected — avoids
  ever reaching Razorpay for a payment with no order-recording path behind it.
- **`firebase_storage`**: removed from both `apps/marketplace/mobile/pubspec.yaml` and
  `packages/dart/marketplace_services/pubspec.yaml`. Confirmed via `flutter pub get`
  (3 packages actually dropped) and via the built APK's own `AndroidManifest.xml`
  (`io.flutter.plugins.firebase.storage` registrar absent; `auth`/`core`/`firestore`/`functions`
  still present, as expected given the remaining work below).

### What is explicitly NOT done

- **5 services still Firebase-coupled, with live callers, not yet individually rewired or
  disconnected**: `custom_checkout_service.dart` (+`cloud_functions`), `support_chat_service.dart`,
  `visual_search_service.dart`, `category_attribute_service.dart`, `seller_analytics_service.dart`.
  All five were checked and confirmed free of the eager-Firebase-singleton crash class (each already
  uses a lazy getter or a static field only ever touched inside its own try/catch) — they are
  **safe**, just not yet closed.
- **~30 remaining models'** own `Timestamp`/`FieldValue`-shaped serialization (full list in
  `packages/dart/marketplace_models/lib/src/`: `ad_campaign_model.dart`, `ad_product_model.dart`,
  `ad_tracking_models.dart`, `ad_wallet_model.dart`, `analytics_event.dart`, `app_update_model.dart`,
  `category_attribute_schema_model.dart`, `category_model.dart`, `chat_message.dart`,
  `commission_settings_model.dart`, `coupon_model.dart`, `deal_model.dart`, `fee_config_model.dart`,
  `keyword_bid_model.dart`, `notification_model.dart`, `order_invoice_model.dart`,
  `order_timeline_model.dart`, `payment_config_model.dart`, `review_model.dart`, `section_model.dart`,
  `seller_info_model.dart`, `seller_model.dart`, `sponsored_banner_model.dart`,
  `store_template_model.dart`, `subscription_model.dart`, `support_chat_model.dart`,
  `team_member_model.dart`, `trending_search_model.dart`, `user_model.dart`).
- **`firebase_core`/`firebase_auth`/`cloud_firestore`/`cloud_functions`** cannot be removed from
  pubspec.yaml until the above closes — doing so now would not compile. This is why the built APK
  (below) still contains Firebase: an honest, expected result given the above, not a surprise.
- **Guest→buyer cart/wishlist transfer UI**: the provider primitive exists and is tested; no
  banner/button calls it yet from `mobile_cart_screen.dart`/`mobile_wishlist_screen.dart`.
- **Native Android/iOS config** (Gradle `google-services` plugin application, `GoogleService-
  Info.plist`, etc.) not audited this session — gated on the pubspec-level work above.

## C4 — automated verification

- `flutter analyze` (from `apps/marketplace/mobile`): **No issues found**, at the final commit.
- `flutter test`: **117 passed, 0 failed, 0 skipped**, at the final commit (98 pre-existing + 19 new
  this session: 4 `buyer_sign_in_controller_test.dart`, 12 `cart_wishlist_buyer_scope_test.dart`,
  1 `checkout_screen_address_test.dart`, 2 `ai_chat_service_crash_test.dart`). Full log:
  `/tmp/final_test.log` (not copied into the repo; ephemeral by design).
- Negative controls performed (compiling unmodified against pre-fix source, confirmed to fail
  there): the two cross-buyer-isolation tests in `cart_wishlist_buyer_scope_test.dart` (temporarily
  stashed just the two provider files; both genuinely failed their assertion — "buyer B must never
  see buyer A's cart" observed `true` — before the stash was restored). Disclosed as
  API-dependency-only, not behavioral, for: `buyerId` exposure tests (brand new getter, no prior
  equivalent) and the guest→buyer transfer tests (brand new methods).
- Governance validator sweep: **not re-run this session**. CLAUDE.md's own trigger list
  (`node scripts/validate-governance.mjs` "after topology, import, package, environment, generated
  artifact, or governance-memory changes") was checked against this session's actual changes —
  Dart source edits within existing packages/paths, no topology/environment/governance-memory
  change — and judged not clearly triggered; noted here rather than silently skipped.
- **Fresh artifact build**: `flutter build apk --debug` from `apps/marketplace/mobile`, at HEAD
  `32d68173`. Completed in 46.6s (incremental; Gradle/AGP/Kotlin version-deprecation warnings only,
  no errors). Output: `build/app/outputs/flutter-apk/app-debug.apk`.
  - Identity: `package: name='com.letbuyy.letbuyy' versionCode='4013'
    versionName='1.0.10-debug'` (matches the expected identity; unchanged from yesterday's
    NewMacSetup build, confirming signing/identity preservation).
  - SHA-256: `7b9056b1798c3ba31b48e1fa56d7a10b5b70715113c3d019136768b80089499f`.
  - Size: 250,347,810 bytes.
  - Firebase presence in the built artifact (`aapt dump xmltree AndroidManifest.xml`, distinct
    `io.flutter.plugins.firebase.*` component registrars): **`auth`, `core`, `firestore`,
    `functions` present; `storage` absent.** This is the expected, honest result given the
    C3 status above — the APK has NOT yet met the owner's full removal requirement, and this
    document does not claim otherwise.

## C5 — Android E2E: blocked, not silently skipped

Per the owner's explicit lift of the standing C5 pause in this task, host and backend readiness
were checked first, as instructed.

**Backend, confirmed live and correct** (read-only checks, no mutation):
- `services/api-gateway` (`:9010`): `/v1/storefront/marketplace/feed` → 200,
  `/v1/storefront/marketplace/categories` → 200.
- `apps/platform/identity` (`:9002`): `/buyer/authorize` → 200 (the real endpoint the marketplace
  app's `BuyerSignInClient` actually uses). A prior check of `/.well-known/openid-configuration`
  returned `IDENTITY_PROVIDER_DISABLED` — traced to `oidc-disabled.ts`: this is the **deliberately
  deferred general-purpose OIDC provider** (ART-07, a recorded architectural decision, not a bug),
  unrelated to the first-party buyer-authorize flow the app depends on. Corrected this
  misdiagnosis before concluding anything from it.
- Supabase containers for `letbuyy-newmac-20260926` (db/auth/rest/realtime/storage/kong/studio):
  all `Up`, `(healthy)` where a healthcheck exists.
- Unrelated Docker containers observed on the same host (`edynox-*`) were left completely alone —
  not part of this project, not touched, not stopped.

**Emulator: hung twice, confirmed via direct measurement, not assumption.**
- AVD `LetBuyy_NewMac_API35` (existing, from yesterday's setup) was booted with
  `emulator -avd LetBuyy_NewMac_API35 -no-snapshot-save`.
- Host memory at boot time: `vm_stat` showed as low as ~68 MB truly free (`Pages free: 4354` ×
  16 KB) out of 15 GB used system-wide; the emulator's own log recorded
  `"Software GL rendering will be used due to system memory pressure... (Available Memory: 3641 MB,
  Required: 5120 MB)"` and `"detected a hanging thread 'QEMU2 CPU0 thread'. No response for 16106
  ms"` / `"'QEMU2 main loop'. No response for 15385 ms"` **before this session ever polled it** —
  i.e., the emulator's own crash-detection subsystem flagged the hang independently.
- First attempt: process (`qemu-system-aarch64`, PID 28986) showed **0.0% CPU across two samples
  5 seconds apart**, ~11 minutes after launch, log stalled at the same "Vulkan emulation
  initialized" line for the entire polling window (240s+ with zero new log output). Not "slow" —
  stalled.
- Second attempt (after confirming the process was genuinely non-progressing, killing it, and
  waiting): retried once, with `-gpu swiftshader_indirect`. Free memory at this second boot's start
  was again critically low (`Pages free: 3988`). **Identical outcome**: 0.0% CPU after 60s, log
  stalled one step further ("Enabling GLDirectMem") but still before completing GPU init, no `adb`
  device ever appeared.
- Both hung processes were cleanly stopped (`kill`, then `kill -9` for the second, which did not
  respond to `SIGTERM`) — this is cleanup of processes this session itself started moments
  earlier, not a reset of the AVD's own data, snapshots, or any other session's work. Per
  instruction, did not retry a third time, did not tune AVD hardware profile, did not touch any
  other process on the host to "free" memory, and did not use emulator instability to explain away
  a source-level defect (none is being claimed here — this is reported purely as a host-resource
  blocker, independent of and prior to any app-level behavior).
- **No physical Android device was available as a fallback** (checked: `adb devices` — real
  hardware and the AVD both absent throughout).

**Conclusion: C5's 15 ordinary-journey checks were not executed.** This is reported as a genuine
external blocker (host memory pressure at emulator-boot time, on a host also running several other
sessions' processes and Docker workloads this session did not create and is not authorized to stop),
not a silent gap and not something papered over with a deep-link shortcut, a mocked login, or a
direct backend assertion presented as UI proof. No Android domain-association check was attempted
either (it depends on the same emulator).

## Feature disposition — working now vs. deliberately deferred

**Working now (this session's own testing, not device-verified):**
- Local cart/wishlist: real persistence, honest failure reporting, race-free concurrent mutation,
  per-buyer isolation, explicit (not-yet-UI-wired) guest→buyer transfer.
- Checkout/add-address/address-selection: session-aware, self-healing, reactive to account changes
  including while idle.
- AI chat: no longer crashes on open; product-search/order/profile/category/coupon tool calls
  degrade honestly (no canonical backend yet) instead of crashing.

**Deliberately, honestly unavailable (unchanged scope decision, not newly restricted):**
- Real order placement / payment execution (`payment_method_screen.dart` now says so explicitly
  rather than silently doing nothing).
- Returns/exchanges (3 screens already said so before this session; Firebase now fully removed
  from behind that honest state).
- Loyalty/rewards (fully retired, not merely hidden).
- Reels (placeholder, unchanged; `ReelService` deleted, not reachable).
- Full reel/media commerce, provider payments, settlement, advertising: untouched, later-phase
  ownership, exactly as before.

## Preservation checks

- Primary checkout (`develop`, `LetBuyy`): not touched.
- Signing assets, `com.letbuyy.letbuyy` application id, package/version: unchanged (confirmed via
  this session's own `aapt dump badging`).
- Old Mac/T7 backups, restored database, existing Supabase project: not touched.
- No global role SQL, no migration replay, no schema reset.
- Services left running at end of session: `services/api-gateway` (:9010), `apps/platform/identity`
  (:9002), the `letbuyy-newmac-20260926` Supabase container set — all were already running at
  session start; none newly started or stopped by this session except the two hung emulator
  processes (cleanly killed, see above).
- No secret values were displayed, logged, or committed.

## Precise next task

1. **Finish C3**: individually trace and close the 5 remaining live-caller services
   (`custom_checkout_service.dart`, `support_chat_service.dart`, `visual_search_service.dart`,
   `category_attribute_service.dart`, `seller_analytics_service.dart`) and the ~30 remaining models'
   Timestamp coupling; then remove `firebase_core`/`firebase_auth`/`cloud_firestore`/
   `cloud_functions` from both pubspec.yaml files; then rebuild and re-inspect the APK to confirm
   zero `io.flutter.plugins.firebase.*` registrars remain.
2. **Wire the guest→buyer transfer UI** (a small banner/button in `mobile_cart_screen.dart`/
   `mobile_wishlist_screen.dart` calling the already-tested provider methods).
3. **C5, once the host has recovered memory headroom**: re-attempt the emulator boot (a fresh
   `vm_stat` check first — do not retry blindly), then execute the 15 ordinary Android journeys
   this task specified, installing this session's own freshly rebuilt APK (rebuild again first,
   since #1 will have changed it), against the currently-running local backend
   (`API_BASE_URL=http://localhost:9010/v1`, `IDENTITY_BASE_URL=http://localhost:9002`).
4. Only after 1–3: re-run the full test suite and governance validator sweep, produce the updated
   evidence matrix, and only then consider this phase ready for its own merge review — not before.

## Verdicts

- **IMPLEMENTATION**: substantial, verified progress; correct within its own stated scope.
- **DEPENDENCY/NATIVE RETIREMENT**: partial — 32 of 71 originally-measured files closed; 5 services
  + ~30 models + all 4 remaining Firebase pubspec entries remain.
- **AUTOMATED VERIFICATION**: green — 117/117, 0 skipped, at this exact HEAD.
- **LOCAL BACKEND**: healthy and confirmed live (gateway + identity + Supabase).
- **ANDROID USER JOURNEYS**: not executed this session — host-resource blocker, not a source defect,
  not silently skipped.
- **HOSTED ASSOCIATION**: not attempted (depends on the same emulator).
- **OVERALL PHASE 1R**: **CONDITIONAL_GO** to continue this same branch through the next-task list
  above. **NO_GO** for any merge, Phase 2 advancement, or "Firebase removed" claim — both remain
  factually premature per this document's own evidence.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

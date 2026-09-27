# Phase 1R — Corrective Review and Feature-Disposition Matrix

**Date:** 2026-09-26. **Branch:** `letbuyy/phase1r-firebase-free-marketplace`. **Worktree:** `../LetBuyy-phase1r`.
**At time of writing:** HEAD `f58ed41e` (after the two corrective fixes below; the reviewed state was `9a66ebcf`).
**Trigger:** an owner-supplied corrective review (pasted brief, 2026-09-26) of the R1.0–R1.5 work this branch had produced so far, read alongside this document's own re-verification of its specific claims.

This document is `CLAIMED_NOT_VERIFIED` where it restates the corrective review's own findings (I did not independently re-derive every sentence of it), and `VERIFIED_REPOSITORY_FACT` where marked ✅VERIFIED — those I re-checked myself against this exact worktree before writing them down, per the evidence rule (nothing remembered counts).

### Fresh gate, this exact HEAD (`f58ed41e`), `bash .claude/skills/letbuyy/scripts/gate.sh --mobile`

```
GATE TABLE  mode=mobile  branch=letbuyy/phase1r-firebase-free-marketplace  sha=f58ed41e  failed=3
typecheck                                | exit 0
lint                                     | exit 1  — customer-web, 41 pre-existing errors, zero files this phase touches (re-confirmed ambient)
governance:plan                          | exit 0
validators:sweep (113/114 pass)          | exit 1  — stale-artifact only (tests:governance below classifies this as method-only, not a genuine offender)
test:contracts                           | exit 1  — dev-auth-bypass-hardening.test.ts, confirmed ambient on develop tip in an earlier pass, zero files this phase touches
test:unit:gateway                        | exit 0  (1,106 total: 1,095 passed, 9 skipped, 2 todo)
tests:governance                         | exit 0  — confirms stale-artifact above is method-only
tests:ci                                 | exit 0
flutter:merchant-mobile:{analyze,test}   | exit 0, exit 0
flutter:marketplace-mobile:{analyze,test}| exit 0, exit 0
```

Identical failure set to every prior gate run on this branch back through R1.0 — nothing regressed, nothing newly ambient. The `environment` validator failure the reviewed state (`9a66ebcf`) would have shown is gone, fixed by §2 (item 2) below.

## 1. Corrected status — do not read prior phase-branch commit messages as closure claims

The prior session's commit messages (R1.0 through R1.5) describe real, individually-verified work. They do **not** amount to "R1.0–R1.4 closed, R1.5 nearly done." Corrected per-workstream status:

| Workstream | Prior implied status | Corrected status | Why |
|---|---|---|---|
| R1.0 (baseline reconciliation) | Done | **Done** — no correction | Merge commit, ledger, gate all independently re-checked; this one holds. |
| R1.1 (Firebase dependency map + disposition) | Done | **Was too permissive** | The map itself (which files touch Firebase) was accurate. The *disposition* — "REWIRE NOW / RETIRE LEGACY IMPLEMENTATION / LATER PHASE," with most of the app's product surface allowed to stay Firebase-backed as LATER PHASE — does not meet this phase's own exit bar (§5 below). Superseded by §3 of this document. |
| R1.2 (canonical auth) | Done | **Done for auth itself; incomplete for composition** | `BuyerSignInController` is the sole, unconditional sign-in — this holds. But `main.dart` still registers the legacy `AuthProvider` (Firebase-backed) alongside it, and ~12 screens still read `AuthProvider`/`auth_gate.dart`/`auth_bottom_sheet.dart` (§3). Two identity systems are active at once. |
| R1.3 (Firebase-free boot) | Done | **Partial** | `Firebase.initializeApp()` is genuinely gone from `main.dart` — re-verified ✅. FCM/Analytics boot hooks are genuinely gone — re-verified ✅. But "Firebase-free boot" was read as "boots without crashing," not "the active app never touches Firebase" — those are different claims, and only the first is true. |
| R1.4 (dependency removal) | Done | **Partial** | `firebase_messaging`/`firebase_analytics` are genuinely removed from both pubspecs, confirmed via `flutter pub get`'s own "no longer depended on" output — this holds. `firebase_core`, `firebase_auth`, `cloud_firestore`, `cloud_functions`, `firebase_storage` are all still declared, still real dependencies of still-active code, and `android/app/build.gradle` still applies `com.google.gms.google-services`. "Complete Firebase SDK/native removal" was never actually attempted — R1.4 only removed the two packages with zero remaining callers. |
| R1.5 (device verification) | "Guest launch verified, sign-in mid-flow" | **Incomplete, and the Reels finding was mis-scoped** | Home tab is genuinely clean on-device after three real fix-and-retest cycles — this holds (evidence: `screenshots/04-guest-launch-v3.png`, `screenshots/03-guest-launch-v2.png`, logcat excerpts in §4). The Reels tab error was reported as needing a live debugger; §4 shows a **static, no-device reproduction was available the whole time** and was missed. Sign-in flow reached the real identity-platform page and confirmed the "Create an account" link tappable, then the *host machine* — not the app — became unstable; no test account was created, no journey beyond that point was exercised. |

## 2. Two corrective fixes made during this review (already committed)

1. **`packages/dart/marketplace_services/lib/src/reel_service.dart`, lines 17–21** — ✅VERIFIED by direct read. `ReelService`'s constructor initializer list does `_firestore = firestore ?? FirebaseFirestore.instance` / `_storage = storage ?? FirebaseStorage.instance`. `_ReelsFeedScreenState` constructs it as a field default (`final ReelService _reelService = ReelService();`), which runs before `initState()`/`build()`. This throws synchronously the moment Firebase isn't initialized — **this is almost certainly the exact cause of the Reels-tab red screen** reported in the prior session's device testing, and it was reproducible from source alone, with no emulator needed. Not yet fixed (disposition is disconnection, not a patch — see §3, Reels).
2. **`config/governance/secret-scan-exceptions.json`** — ✅VERIFIED and **fixed, committed (`f58ed41e`)**. R1.3 deleted `apps/marketplace/mobile/lib/firebase_options.dart` but left its three secret-scan exception entries pointing at the now-untracked file. `environment-validator` failed with exactly this. Removed the three stale entries (the Android-key value they covered is still separately excepted via `google-services.json`, which still exists). Validator re-run confirms clean: `node scripts/validators/environment-validator.mjs` → "Environment validator passed (8815 tracked files scanned, 8 reviewed exceptions)."

## 3. Feature-disposition matrix (C2)

Every provider `main.dart` registers, its actual Firebase dependency (✅VERIFIED by reading each file, not assumed from name), its real screen-consumer count (✅VERIFIED via `grep -rl` against `apps/marketplace/mobile/lib`, main.dart excluded), and the disposition this phase now commits to.

**Three dispositions**, matching the corrective review's own vocabulary:
- **KEEP** — no Firebase dependency; no change needed.
- **REWIRE** — a canonical replacement already exists; point the provider (or its consumers directly) at it instead of Firestore.
- **DISCONNECT** — no canonical replacement exists yet (confirmed, not assumed — R1.1's own error was assuming this too broadly without checking); remove from `main.dart`'s active composition, and give every consumer screen an honest "not available yet" state instead of a silently-empty or crashing one. Source stays (a later phase's job), just not constructed by the active app.

| Provider / service | Firebase? | Screen consumers (excl. main.dart) | Disposition | Notes |
|---|---|---|---|---|
| `ThemeProvider` | No | — | KEEP | Unrelated to identity/data. |
| `UserProvider` | No ✅VERIFIED | — | KEEP | |
| `SearchProvider` | No ✅VERIFIED | — | KEEP | |
| `MarketplaceRepository` | No (canonical gateway) | 1 (`deal_cards_section.dart`) | KEEP | Already the target for REWIRE below. |
| `BuyerSignInController` / `BuyerAccountApi` / `BuyerAddressApi` | No (canonical) | profile_screen.dart, letbuyy_account_screen.dart | KEEP | R1.2's own work; correct. |
| `AuthProvider` (app-local) | Yes | 12: splash_screen, auth_screen, change_password_screen, edit_profile_screen, support_chat_screen, cart_screen (legacy), support_conversations_screen, my_returns_screen, return_request_screen, wishlist_screen, `widgets/auth_gate.dart`, `widgets/auth_bottom_sheet.dart` | **DISCONNECT** | This is the second, obsolete identity system the corrective review flagged. `auth_gate.dart`/`auth_bottom_sheet.dart` are shared gating widgets used elsewhere too — need their own pass, not just their 12 direct file-consumers. |
| `ProductProvider` | Yes (via `DatabaseService`) | 15: mobile/web home_screen, recently_viewed_widget, all_products_grid, suggested_for_you_section, web_header, web_shop_screen, product_details_screen, mobile_shop_screen, variant_selector, filter_drawer, related_products_section, mobile_search_screen, web/mobile wishlist_screen | **REWIRE** | `MarketplaceRepository.feed()`/`.listing()` already exist and already have one working consumer. This is core "browse the marketplace" — worth the rewire effort, unlike the DISCONNECT candidates below. |
| `CategoryProvider` | Yes (via `DatabaseService`) | 7: mobile/web home_screen, categories_grid, category_screen, web/mobile shop_screen, mobile_search_screen | **REWIRE** | `MarketplaceRepository.categories()` already exists. |
| `CartProvider` | Yes (via `AuthService`) | 17 (full list in §6) | **DISCONNECT** | No canonical cart/checkout exists anywhere in this repo yet — confirmed by grep, not assumed. Checkout/payment is explicitly a later phase's scope per this phase's own MAY WRITE boundary. |
| `WishlistProvider` | Yes (via `DatabaseService`) | 12 (full list in §6) | **DISCONNECT** | No canonical wishlist exists. |
| `OrderProvider` | Yes (via `DatabaseService`) | 6: payment_method_screen, profile_stats, order_history/details/tracking_screen, orders_screen | **DISCONNECT (with a named later-phase hook)** | `GET /storefront/buyer/orders` exists on the gateway (SUSTAINED-K) but has zero Flutter consumers anywhere — wiring a whole orders-list UI onto an unexercised route is its own bounded task, not a same-day rewire. Record it as the named hook for whichever later phase does this. |
| `AddressProvider` (old, per-store) | Yes (via `DatabaseService`) | 3: web_header, shop_app_bar, saved_addresses_screen | **DISCONNECT** | The canonical `BuyerAddressApi` (cross-store) already covers the buyer's own addresses via `letbuyy_account_screen.dart`. Two live "addresses" concepts is user-confusing; disconnect the old per-store screen's Firebase data layer rather than maintain both. |
| `CouponProvider` | Yes (via `DatabaseService`) | 7: product_details_screen, checkout_screen, payment_method_screen, mobile/web cart_screen, cart_summary, coupon_selection_screen | **DISCONNECT** | No canonical coupons/discounts path. |
| `ReviewProvider` | Yes (via `DatabaseService`) | 3: rate_your_purchases_section, review_card, reviews_section | **DISCONNECT** | No canonical reviews path. |
| `AppUpdateProvider` | Yes | 1: download_screen | **DISCONNECT** | Narrow, low-traffic surface; simplest disconnect in the set. |
| `SponsoredBannerProvider` | Yes | 1: sponsored_banner.dart | **DISCONNECT** | Ads/sponsorship — later phase, per Constitution's own ads-model note. |
| `MarketplaceAdProvider` (app-local) | Yes | 6: sponsored_products_section (already touched in R1.5), category_screen, mobile_shop_screen, sponsored_products_banner, compact_product_card, product_card | **DISCONNECT** | Same ads/sponsorship later-phase bucket as above. |
| `LoyaltyProvider` | Yes | 4: loyalty_screen, payment_method_screen, profile_screen (already safety-wrapped in R1.5), loyalty_card | **DISCONNECT** | No canonical loyalty ledger. The R1.5 `safeFirebaseUserId()` wrapper on this provider was the right *safety* fix but the wrong *architecture* fix per the corrective review — it should not be reachable at all, not reachable-but-safe. |
| `NotificationProvider` (app-local) | Yes | 1: notification_screen | **DISCONNECT** | |
| `AuthService` (shared) | Yes | Backs `CartProvider` (and, per the original R1.5 stack trace, several others) internally | **DISCONNECT alongside its dependents** | Not directly consumed by screens; removed once nothing routes through it. |
| `DatabaseService` (shared) | Yes | Backs Order/Address/Wishlist/Category/Cart/Product providers internally | **DISCONNECT alongside its dependents** | Same — the common Firestore chokepoint six providers share. |
| `ReelService` | Yes | `reels_feed_screen.dart` only | **DISCONNECT (whole tab)** | Per the corrective review directly: "A nonfunctional legacy reel feed is not worth preserving while full canonical reels belong to Phase 7." Remove the Reels tab from active navigation; keep the source under the same retained-for-later-phase convention as the rest of this table. |

**Not yet mapped, flagged as a gap in this same pass:** `screens/shop/shop_screen.dart` (no direct provider reference found — likely a router to `mobile_shop_screen.dart`/`web_shop_screen.dart`, which *are* mapped above; needs one more read to confirm nothing else hangs off it), and the seven newly-found eager-Firebase instances in §4 that sit in services not yet triaged individually (`seller_analytics_service.dart`, `firestore_data_service.dart`, `ai_chat_service.dart`, `product_stats_service.dart`, `order_notification_service.dart` ×2 fields) — these need the same DISCONNECT-or-REWIRE decision once their own consumers are mapped, not yet done as of this document.

## 4. Additional gaps this corrective pass found in the prior sweep

The prior session's "comprehensive" eager-Firebase-field sweep (R1.3, 26 files) used a regex requiring `final Firebase<Type> _name = Firebase<Type>.instance;` at the start of a line. Re-scanning with looser patterns during this review found real instances it missed, for three distinct, fixable reasons:

| File | Pattern that was missed | Why the original regex missed it |
|---|---|---|
| `reel_service.dart:20-21` | `firestore ?? FirebaseFirestore.instance` in a constructor **initializer list**, not a field declaration | The regex only matched field-level assignment, not constructor-parameter fallback |
| `seller_analytics_service.dart:10` | `static final FirebaseFirestore _firestore = ...` | Regex required the line to start with `final`; `static ` broke the anchor |
| `product_stats_service.dart:25` | same `static final` pattern | same |
| `order_notification_service.dart:7-8` | `static final FirebaseFirestore` **and** `static final FirebaseFunctions` | same; also a second file with an un-swept `FirebaseFunctions` field (the targeted `FirebaseFunctions` fix only covered 4 files, never re-swept broadly like Auth/Firestore/Storage were) |
| `firestore_data_service.dart:6-7` | `final _firestore = FirebaseFirestore.instance;` / `final _auth = ...` | No explicit type annotation (Dart type inference) — regex required the type name to literally appear |
| `ai_chat_service.dart:15-16` | `final auth = FirebaseAuth.instance;` / `final firestore = ...` | Same missing-type-annotation gap, plus no leading underscore on the field name (regex required `_[a-zA-Z]*`) |

None of these are fixed yet. Per §3's DISCONNECT-first strategy, most of these services likely belong to providers already marked DISCONNECT (patching their eager fields would be wasted effort if the provider chain above them is being removed from active composition anyway) — each needs its consumer confirmed before deciding whether it's worth a lazy-getter patch or simply goes away with its caller.

## 5. Exit bar for this corrective task (restated from the review, not softened)

> Zero Firebase runtime requirement in the active marketplace app, required canonical foundation journeys pass, active navigation has no legacy-construction failures, and evidence distinguishes local/device/hosted status.

Concretely, done means: `apps/marketplace/mobile/pubspec.yaml` and `packages/dart/marketplace_services/pubspec.yaml` declare no `firebase_*`/`cloud_firestore`/`cloud_functions` package; `android/app/build.gradle` applies no `com.google.gms.google-services`; `firebase_safety.dart` is deleted (nothing left to wrap); every provider in §3 is at KEEP or REWIRE in `main.dart`'s active registration; every DISCONNECT provider's former screens show an honest, intentional unavailable state (not a crash, not a silently-empty list that reads as "you have zero items"); a boot/composition test (§7) proves the real `MultiProvider` tree constructs with zero Firebase calls; and the full guest→sign-in→profile/address CRUD→restart→logout→two-buyer-switch journey passes on a real device against phase-branch-matched local services.

This document does not claim that bar is met. It is not met yet — §3's DISCONNECT column alone is ~14 providers across ~90 file-references (many overlapping), of which zero have been executed as of this writing.

## 6. Full consumer lists (for whoever executes §3)

<details>
<summary>CartProvider (17 files)</summary>

`main_screen.dart`, `web_home_screen.dart`, `product_details_screen.dart`, `widgets/product_card.dart`, `checkout_screen.dart`, `widgets/web_header.dart`, `chat/widgets/product_card_widget.dart`, `payment_method_screen.dart`, `web_cart_screen.dart`, `wishlist/widgets/wishlist_item_card.dart`, `orders/order_details_screen.dart`, `widgets/web_sidebar.dart`, `cart/coupon_selection_screen.dart`, `widgets/web_mobile_header.dart`, `wishlist/web_wishlist_screen.dart`, `wishlist/mobile_wishlist_screen.dart`, `cart/mobile_cart_screen.dart`
</details>

<details>
<summary>WishlistProvider (12 files)</summary>

`main_screen.dart`, `web_home_screen.dart`, `chat/widgets/product_card_widget.dart`, `widgets/web_header.dart`, `product_details_screen.dart`, `shop/widgets/product_info_section.dart`, `shop/widgets/compact_product_card.dart`, `shop/widgets/product_card.dart`, `profile/widgets/profile_stats.dart`, `wishlist/web_wishlist_screen.dart`, `widgets/web_sidebar.dart`, `wishlist/mobile_wishlist_screen.dart`
</details>

<details>
<summary>ProductProvider (15 files)</summary>

`mobile_home_screen.dart`, `web_home_screen.dart`, `widgets/recently_viewed_widget.dart`, `widgets/all_products_grid.dart`, `widgets/suggested_for_you_section.dart`, `widgets/web_header.dart`, `shop/web_shop_screen.dart`, `shop/product_details_screen.dart`, `shop/mobile_shop_screen.dart`, `shop/widgets/variant_selector.dart`, `shop/widgets/filter_drawer.dart`, `shop/widgets/related_products_section.dart`, `search/mobile_search_screen.dart`, `wishlist/web_wishlist_screen.dart`, `wishlist/mobile_wishlist_screen.dart`
</details>

<details>
<summary>AuthProvider (12 files)</summary>

`splash_screen.dart`, `auth/auth_screen.dart`, `profile/change_password_screen.dart`, `profile/edit_profile_screen.dart`, `support/support_chat_screen.dart`, `cart/cart_screen.dart` (legacy, distinct from `mobile_cart_screen.dart`), `support/support_conversations_screen.dart`, `returns/my_returns_screen.dart`, `returns/return_request_screen.dart`, `wishlist/wishlist_screen.dart`, `widgets/auth_gate.dart`, `widgets/auth_bottom_sheet.dart`
</details>

All other providers' consumer lists are in §3's table cells directly (short enough not to need collapsing).

## 7. What C4 (tests) needs to prove, not yet written

- A widget test that pumps the real `LetBuyyMarketplaceApp` (the actual `MultiProvider` tree from `main.dart`, not a test double) and asserts it builds without throwing — this is the boot/composition test the prior session never had; the existing 57 tests construct individual widgets in isolation, never the real app tree, which is exactly why the `ReelService`/`LoyaltyProvider` construction failures reached a device before they reached a test.
- A focused test constructing `ReelService()` directly and asserting it does *not* throw pre-fix / does throw post-understanding, then asserting the disconnected Reels tab renders its honest-unavailable state instead of attempting construction at all.
- Canonical-session tests: signed-in vs signed-out `BuyerSignInController` state reaching the right screens; cross-buyer stale-response protection (already covered for `letbuyy_account_screen.dart` per SUSTAINED-M-era tests — confirm it also holds for whatever profile_screen.dart still does after §3's AuthProvider disconnect).
- Error-vs-empty: for every DISCONNECT screen, a test that the "unavailable" state is distinguishable from "genuinely zero items" — the corrective review explicitly named this ("do not turn transport failures into successful empty data").

## 8. Resource/emulator note (correcting my own prior causal claim)

The prior session attributed three emulator reboots to host resource contention, citing `top`'s load average (15.99) and free-memory (115 MB) at that moment. The corrective review is right to flag that as an attributed-but-not-diagnosed cause: a single snapshot of load average and free physical memory is consistent with contention but doesn't rule out an emulator-internal fault (kernel panic inside the guest, a corrupted userdata partition after the first "Can't find service" episode, etc.), and a later read-only snapshot showed materially different numbers (45.25/38.79/32.29 load, 41% system-wide free) without resolving which process, if any, was responsible. No process was stopped, on my own initiative or the reviewer's, in either pass. Native testing stays paused per the user's explicit instruction until a controlled window; if resumed, capturing the emulator's own crash/kernel log (not just host-side `top`) before attempting another reboot would make the next attribution an actual diagnosis instead of a plausible correlation.

## 9. What this document is not

It is not a merge-readiness claim. Per the corrective review's own final-acceptance section, merge review under the owner's actual authority happens only after §5's bar is met. Nothing in R1.0–R1.5's commits is reverted or reset by this document — all prior work stays on the branch; §3 is the plan for what still has to change on top of it.

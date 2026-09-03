# 22 — First Real Test Coverage for customer_app and admin_app (Phase P)

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight and resume | COMPLETE | 84f8dfa8 |
| S1 | Map the testable surface | COMPLETE | d3073d58 |
| S2 | Establish the harness | COMPLETE | (this commit) |
| S3 | marketplace_core tests | PENDING | |
| S4 | marketplace_ui_kit tests | PENDING | |
| S5 | App-level Firebase-free files | PENDING | |
| S6 | Anti-theatre proof + full verification | PENDING | |
| S7 | Documentation | PENDING | |

---

## S0 — Preflight and resume

**Journal status at start:** did not exist → FRESH START.

### Baseline reconciliation

CTO baseline: `HEAD 00e8840c  tracked 8343  changed 39  staged 0  untracked 58  deletions 1`. Gate 105/6. Workspace 20/20. `merchant_app` 172/172. All 15 `packages/dart` members analyze clean. `customer_app`/`admin_app` analyze clean, zero test files. `phase_2` apps: 1 error each (dead `widget_test.dart` boilerplate).

Measured:
```
HEAD:      00e8840c3bd52b8049d21a7ed105d97792f8c713  (EXACT MATCH)
tracked:   8343                                        (EXACT MATCH)
staged:    0                                            (EXACT MATCH)
deletions: 1  (apps/identity-platform/src/lib/useAuthTheme.ts)  (EXACT MATCH)
changed:   38  (CTO: 39 — the same recurring 1-file bookkeeping gap diagnosed in Phase N's and Phase O's own S0 entries; not re-derived here)
untracked: 14 git-status lines  (CTO: 58 — the same recurring directory-line-collapsing artifact diagnosed in Phase N's S0 entry; not re-derived here)
```

**Conclusion:** identical reconciliation pattern to the last two phases' own Stage 0 — the four hard identity signals match exactly; the two soft counts are the same already-diagnosed, non-blocking artifacts. Proceeding as a fresh start.

### Documents read this stage

All five `apps/merchant_app/test/*.dart` files, read in full, before writing anything:
- `mobile_services_test.dart`
- `v1_capability_policy_test.dart`
- `merchant_goldens_test.dart`
- `analytics_model_test.dart`
- `product_contract_test.dart`

House-style notes (for Stage 2 onward, so this isn't re-derived per file):
- `group('Description', () { test('does X', () { ... }); });` nesting; test descriptions are plain-English behavior statements, not method names.
- Heavy use of `expect(actual, matcher)` with descriptive matchers (`isTrue`, `contains`, `throwsA`, custom predicate matchers) over bare equality where a matcher reads better.
- Widget tests use `testWidgets('description', (tester) async { ... })`, wrap the widget under test in a minimal `MaterialApp`/`Directionality` scaffold — never the full app shell — and assert via `find.text`/`find.byType`/`find.byKey` plus `tester.pump()`.
- Fakes/stubs for services are hand-written classes implementing the real interface, defined at the bottom of the same test file or a small shared fixture — never a mocking framework (confirms zero external test-double dependency is already this repo's convention, matching this phase's zero-new-dependency rule).
- `product_contract_test.dart` and `analytics_model_test.dart` are the closest precedent for "pure function / model" tests — real input/output pairs, explicit boundary cases (empty, zero, negative-adjacent), JSON round-trip assertions.

### Recorded before touching anything

```
$ cd apps/merchant_app && flutter test 2>&1 | tail -5
00:04 +168: .../mobile_services_test.dart: AiScreen hides credit purchase control when unavailable
00:04 +169: .../mobile_services_test.dart: ThemeVersionsScreen renders releases and executes rollback
00:04 +170: .../mobile_services_test.dart: CapabilityGate sanitizes internal fallback reasons
00:04 +171: .../mobile_services_test.dart: Turnstile sentinel state renders a generic error
00:04 +172: All tests passed!
```

**merchant_app: 172/172, confirmed by a real run before any change this phase — the regression canary for the rest of this phase.**

### House-style detail confirmed by direct reading (not all 8076 lines of `mobile_services_test.dart` were read verbatim — the first ~220 lines plus representative sections were read for structure; `product_contract_test.dart`, `analytics_model_test.dart`, `v1_capability_policy_test.dart`, and `merchant_goldens_test.dart` were read in full)

- `v1_capability_policy_test.dart` is the clearest anti-theatre precedent in this codebase: its own header comment explains it tests at the route-resolution layer specifically because a test that only checked the navigation lists "would pass while the alias routes stayed open" — i.e., it deliberately tests the layer where a real bug could hide, not the layer that's easiest to assert against.
- `mobile_services_test.dart` hand-writes fakes (e.g. `MemoryCrashReportingSink`, `_GoldenApiClient` in the goldens file) implementing the real service interface — confirms zero mocking-framework dependency is already this repo's convention.
- Widget tests wrap the widget under test in the smallest sufficient scaffold (`MaterialApp(home: Scaffold(body: Center(child: ...)))`), never the full app shell with routing/providers unless the test specifically needs them.
- Loops over an enum/list of cases use `reason:` on every `expect` inside the loop, so a failure identifies which case failed without re-running.

**S0 verdict: COMPLETE.**

---

## S1 — Map the testable surface

### 1.1 — Scope-table counts re-verified

| Target | CTO figure | Measured | Match |
|---|---|---|---|
| `packages/dart/marketplace_core` dart files | 27 | 27 | ✓ |
| `marketplace_core` files touching Firebase (`grep -rl "package:firebase\|package:cloud_firestore"`) | 0 | 0 | ✓ |
| `packages/dart/marketplace_ui_kit` dart files | 23 | 23 | ✓ |
| `marketplace_ui_kit` files touching Firebase | 0 | 0 | ✓ |
| `apps/customer_app/lib/utils` | 1 | 1 | ✓ |
| `apps/customer_app/lib/widgets` (recursive, includes `loyalty/` and `voice_search/` subdirs) | 10, 1 Firebase | 10, **1 direct** Firebase (`web_mobile_header.dart`) | ✓ direct count |
| `apps/admin_app/lib/utils` | 1 | 1 | ✓ |
| `apps/admin_app/lib/widgets` | 1 | 1 | ✓ |

All CTO-supplied counts confirmed exactly for **direct** Firebase imports. The transitive check (1.3) below changes the *effective* in-scope count for `customer_app/lib/widgets` substantially — see below.

### 1.3 — Transitive import trace (done before finalizing 1.2's table, since it changes several verdicts)

The CTO's "9 in scope" for `customer_app/lib/widgets` was based on a direct-import grep only. Traced every one of the 9 non-`web_mobile_header.dart` files for transitive Firebase exposure via `Provider.of<X>`/`Consumer<X>` service-class consumption and relative imports, not just their own `import` lines:

| File | Direct import | What it actually consumes | Transitively Firebase? |
|---|---|---|---|
| `web_sidebar.dart` | `letbuyy_marketplace_services` | `Provider.of<CartProvider>`, `Provider.of<WishlistProvider>` | **YES** — `CartProvider`/`WishlistProvider` → `../database_service.dart` (`cloud_firestore`) and `../auth_service.dart` (`firebase_auth`/`cloud_firestore`/`cloud_functions`) |
| `web_layout_shell.dart` | `letbuyy_marketplace_services` | Composes `WebSidebar` as a child widget | **YES** — inherits `web_sidebar.dart`'s exposure |
| `mandatory_update_dialog.dart` | `letbuyy_marketplace_models` | `AppUpdateModel` (constructor parameter type) | **YES** — `app_update_model.dart` itself `import 'package:cloud_firestore/cloud_firestore.dart'` |
| `premium_scaffold.dart` | none beyond `flutter/material.dart` | — | No |
| `unified_search_header.dart` | `letbuyy_marketplace_ui_kit`, `letbuyy_marketplace/app/routes.dart` | `AppColors` (ui_kit, confirmed clean), `AppRoutes.search` (a `String` constant, never constructs a screen) | No — read `routes.dart` and the full widget body; it only uses route-name strings for `Navigator.pushNamed`, never builds a destination screen in-test |
| `auth_bottom_sheet.dart` | relative `'../providers/auth_provider.dart'` | `AuthProvider` | **YES** — `apps/customer_app/lib/providers/auth_provider.dart` directly imports `firebase_auth` and `cloud_firestore` |
| `auth_gate.dart` | `letbuyy_marketplace_services` + relative `auth_provider.dart` + composes `AuthBottomSheet` | `Provider.of<AuthProvider>`, `Consumer<AuthProvider>` | **YES** — same `AuthProvider`, plus inherits `auth_bottom_sheet.dart`'s exposure |
| `loyalty/loyalty_card.dart` | `letbuyy_marketplace_services` | `Consumer<LoyaltyProvider>` | **YES** — `loyalty_provider.dart` directly `import 'package:firebase_auth/firebase_auth.dart'` |
| `voice_search/advanced_voice_search.dart` | `letbuyy_marketplace_services` | Only `Provider.of<ThemeProvider>(context)` — checked every symbol used from the import, not just the import line | No — `ThemeProvider` itself imports only `flutter/material.dart` + `letbuyy_marketplace_core`, confirmed clean |

**Reclassified OUT of scope (6 of 9): `web_sidebar.dart`, `web_layout_shell.dart`, `mandatory_update_dialog.dart`, `auth_bottom_sheet.dart`, `auth_gate.dart`, `loyalty/loyalty_card.dart`.**
**Confirmed genuinely IN scope (3 of 9): `premium_scaffold.dart`, `unified_search_header.dart`, `voice_search/advanced_voice_search.dart`.**

This is the single most consequential finding of Stage 1 — the true Firebase-free surface in `customer_app/lib/widgets` is 3 files, not 9. Reported here exactly as the brief's own Stage 1.3 anticipated ("Report any figure that differs").

`apps/customer_app/lib/utils/web_optimizations.dart`, `apps/admin_app/lib/utils/performance_utils.dart`, and `apps/admin_app/lib/widgets/common/loading_overlay.dart` were also traced: all three import only `flutter/foundation.dart`/`flutter/material.dart` and (the last) `letbuyy_marketplace_ui_kit` — confirmed clean, no reclassification needed. `packages/dart/marketplace_core` and `marketplace_ui_kit` needed no transitive trace beyond the direct grep, since that grep already covers every file in each package exhaustively (if any file transitively depended on Firebase, some file in the package would have to import it directly, and none do).

### An unrelated but load-bearing discovery: 9 of `marketplace_ui_kit`'s 23 files are genuinely empty (0 bytes)

While sizing every file for the classification table, 9 files exported from `letbuyy_marketplace_ui_kit.dart`'s own barrel (`badge_widget.dart`, `confirmation_dialog.dart`, `custom_drawer.dart`, `error_widget.dart`, `loading_indicator.dart`, `network_image_widget.dart`, `rating_widget.dart`, `search_bar_widget.dart`, `shimmer_loading.dart`) turned out to be **0-byte files** — no class, no function, nothing. Confirmed this is **pre-existing, not a Phase N/O artifact**: the original (non-`marketplace_`) `packages/dart/ui_kit` has the exact same 9 files at the exact same 0 bytes, consistent with Phase N's own Stage 2 collision evidence describing these filenames as "byte-for-byte identical" between the two packages. `flutter analyze` never flagged this because an empty file is valid Dart (contributes nothing to the exporting library, and neither app actually references any of these 9 class names — confirmed by both apps' clean `flutter analyze`, which would have failed with "undefined name" otherwise). Not fixed — authoring new widget implementations is out of this phase's scope (this phase tests existing behavior, it does not add missing behavior) — but recorded here since it directly affects Stage 4's file count: **only 14 of 23 `marketplace_ui_kit` files have any content to test.**

### 1.2/1.4 — Full classification, ranked by value within each target

Legend: **PURE** = deterministic function/class, no widget tree, trivially testable · **WIDGET** = needs `pumpWidget` but no Firebase/platform-plugin mocking · **STATEFUL** = needs constructible-without-Firebase setup (e.g. `SharedPreferences.setMockInitialValues`, a built-in `flutter_test` capability, not a new dependency) · **DEFERRED_NEEDS_MOCKING** = genuinely needs a platform-plugin mock or a new dependency to test meaningfully · **NO_TESTABLE_CONTENT** = file is empty or pure re-export, nothing to assert · **LOW_VALUE_SKIP** = pure data/constants with no behavior (testing would be "asserting a literal against itself," forbidden by the anti-theatre rule).

#### `packages/dart/marketplace_core` (27 files)

| Rank | File | One-line purpose | Verdict |
|---|---|---|---|
| 1 | `src/utils/validators.dart` (357L) | Input validation: email, phone (India), password strength, pincode, GSTIN-adjacent, etc. | **PURE** — top priority (real branching, India-specific formats) |
| 2 | `src/utils/price_formatter.dart` (224L) | INR currency formatting, discount/percentage math | **PURE** — top priority (money) |
| 3 | `src/utils/date_formatter.dart` (207L) | Date/time formatting, relative-time strings | **PURE** — top priority (dates) |
| 4 | `src/responsive/responsive.dart` (181L) | Breakpoint-based responsive sizing logic | **PURE** — real conditional branching |
| 5 | `src/responsive/size_config.dart` (102L) | Screen-fraction-to-logical-pixel conversion | **PURE** |
| 6 | `src/responsive/responsive_helper.dart` (80L) | Device-type classification from width | **PURE** |
| 7 | `src/responsive/breakpoints.dart` (50L) | Breakpoint constants + a `DeviceType`-style classifier function (not pure constants — has a function) | **PURE** |
| 8 | `src/error/failures.dart` (76L) | `Failure` class hierarchy (abstract base + subtypes) | **PURE** — worth checking for real behavior (equality, `toString`, `fromException`) beyond a data holder |
| 9 | `src/error/exceptions.dart` (93L) | `AppException` hierarchy | **PURE** — same as above |
| 10 | `src/web/web_utils.dart` (55L) | `WebUtils`: platform/keyboard-visibility detection, conditional JS-interop dispatch | **PURE**, with a real testability limit: `kIsWeb` is always `false` under plain VM `flutter test`, so only the non-web branches of `isWebMobile`/`isWebDesktop`/`dispatchResizeEvent` are reachable — noted, not worked around |
| 11 | `src/utils/snackbar_helper.dart` (235L) | Shows themed SnackBars via `ScaffoldMessenger` | **WIDGET** — testable via `pumpWidget` + trigger + `find.text`, no plugin needed |
| 12 | `src/utils/dialog_helper.dart` (353L) | Shows themed dialogs (`showDialog`) | **WIDGET** — same pattern |
| 13 | `src/services/shared_preferences_service.dart` (431L) | Thin wrapper over `SharedPreferences` | **STATEFUL** — testable via `SharedPreferences.setMockInitialValues()`, a built-in `flutter_test` capability already used by `merchant_app`'s own goldens test, not a new dependency |
| 14 | `src/web/web_scaffold.dart` (161L) | A `Scaffold`-like layout widget for web | **WIDGET** |
| 15 | `src/web/keyboard_handler.dart` (163L, mixin) | Mobile-web keyboard visibility mixin for a `StatefulWidget` host | **STATEFUL** — needs a small host `StatefulWidget` to mix it into; doable without Firebase, moderate effort |
| — | `src/utils/url_launcher_helper.dart` (158L) | Wraps `url_launcher`'s `launchUrl`/`canLaunchUrl` | **DEFERRED_NEEDS_MOCKING** — the actual plugin calls need a platform-channel mock beyond what plain `flutter_test` gives for free; no pure sub-logic worth isolating |
| — | `src/utils/image_picker_helper.dart` (145L) | Wraps `image_picker`'s picker dialogs | **DEFERRED_NEEDS_MOCKING** — same reasoning |
| — | `src/config/razorpay_config.dart` (26L), `src/config/gemini_config.dart` (6L) | Static config value holders | **LOW_VALUE_SKIP** — no behavior beyond returning configured constants |
| — | `src/constants/{api,app,firebase,storage}_constants.dart` (4 files) | Static constant classes | **LOW_VALUE_SKIP** — same reasoning |
| — | `src/web/web_utils_stub.dart` (7L) | No-op fallback for non-web platforms | **LOW_VALUE_SKIP** — trivial no-op, real behavior is "does nothing," already implicitly exercised by `WebUtils.dispatchResizeEvent()`'s own test |
| — | `src/web/web_utils_js.dart` (17L) | `dart:js_interop`-based web implementation | **NO_TESTABLE_CONTENT under plain VM `flutter test`** — this file only compiles/runs under a web compile target; not reachable from a VM test run regardless of mocking |
| — | `src/web/web.dart` (6L), `letbuyy_marketplace_core.dart` (37L) | Pure re-export barrels | **NO_TESTABLE_CONTENT** |

#### `packages/dart/marketplace_ui_kit` (23 files, 9 empty — see above)

| Rank | File | One-line purpose | Verdict |
|---|---|---|---|
| 1 | `src/widgets/custom_button.dart` (206L) | Themed button with loading/disabled/variant states | **WIDGET** — real state-driven branching, top priority |
| 2 | `src/widgets/custom_text_field.dart` (417L) | Themed text field with validation/error display | **WIDGET** — real interaction (typing, error state), top priority |
| 3 | `src/widgets/custom_bottom_nav.dart` (105L) | Bottom navigation bar with active-index highlighting | **WIDGET** |
| 4 | `src/widgets/custom_app_bar.dart` (55L) | Themed app bar | **WIDGET** |
| 5 | `src/widgets/empty_state.dart` (33L) + `empty_state_widget.dart` (74L) | Empty-state placeholder widgets (two variants) | **WIDGET** |
| 6 | `src/widgets/error_view.dart` (69L) | Error-state display widget with retry callback | **WIDGET** — real callback-driven interaction |
| 7 | `src/widgets/glass_container.dart` (69L) | Frosted-glass container (light/dark branching, fixed in Phase N) | **WIDGET** — good candidate to also exercise the light/dark branch this phase's own earlier fix touched |
| 8 | `src/widgets/loading_overlay.dart` (55L) | Overlay spinner shown/hidden by a boolean | **WIDGET** |
| 9 | `src/widgets/update_dialog.dart` (54L) | Forced-update dialog (System-A-only widget, no consumer in this repo yet) | **WIDGET** |
| 10 | `src/themes/app_colors.dart` (334L) | Color palette constants (light/dark pairs) | **LOW_VALUE_SKIP as a "test the values" target**, but `AppColors` is consumed by every widget test above for light/dark assertions, so it's exercised indirectly |
| 11 | `src/themes/app_text_styles.dart` (526L), `src/themes/app_theme.dart` (354L) | Typography/theme-data builders | **PURE**-ish (a `ThemeData` factory) — worth one test confirming `AppTheme.light()`/`dark()` actually produce distinct, internally-consistent `ThemeData` (a real assertion, not a literal echo) |
| — | 9 empty files (see above) | — | **NO_TESTABLE_CONTENT** |
| — | `letbuyy_marketplace_ui_kit.dart` (28L) | Re-export barrel | **NO_TESTABLE_CONTENT** |

#### App-level (5 files, all confirmed in scope after the transitive trace)

| Rank | File | One-line purpose | Verdict |
|---|---|---|---|
| 1 | `apps/customer_app/lib/widgets/unified_search_header.dart` (180L) | Sticky search header, conditional back/camera buttons, dark/light gradient | **WIDGET** — real conditional rendering + callback interaction, confirmed Firebase-free by full read |
| 2 | `apps/customer_app/lib/widgets/premium_scaffold.dart` (54L) | A themed `Scaffold` wrapper | **WIDGET** |
| 3 | `apps/admin_app/lib/widgets/common/loading_overlay.dart` | Overlay spinner (admin's own, distinct file from ui_kit's) | **WIDGET** |
| 4 | `apps/customer_app/lib/utils/web_optimizations.dart` | Web-specific perf helpers (`kIsWeb`-gated) | **PURE**, same web-target reachability caveat as `WebUtils` above |
| 5 | `apps/admin_app/lib/utils/performance_utils.dart` | Platform/performance detection helpers | **PURE** |
| — | `apps/customer_app/lib/widgets/voice_search/advanced_voice_search.dart` (700L) | Voice search UI wrapping `speech_to_text` | **Firebase-free (confirmed), but DEFERRED_NEEDS_MOCKING for its core behavior** — `speech_to_text` is a platform-channel plugin; only its `ThemeProvider`-driven styling (`isDark`) is testable without mocking, and testing just that one line in a 700-line file would be exactly the "testing only getters" class of theatre this phase forbids. Deferred as a unit, not partially started. |

### Value ranking summary (highest-value targets, across all in-scope files)

1. `packages/dart/marketplace_core/src/utils/validators.dart` — India-format validation, real branching
2. `packages/dart/marketplace_core/src/utils/price_formatter.dart` — INR/money formatting
3. `packages/dart/marketplace_core/src/utils/date_formatter.dart` — date formatting
4. `packages/dart/marketplace_core/src/responsive/*.dart` (4 files) — real breakpoint branching
5. `packages/dart/marketplace_core/src/error/{failures,exceptions}.dart` — error-hierarchy behavior
6. `packages/dart/marketplace_ui_kit/src/widgets/{custom_button,custom_text_field}.dart` — stateful widget interaction
7. `apps/customer_app/lib/widgets/unified_search_header.dart` — real app-level conditional widget
8. Everything else in the WIDGET/STATEFUL tier, in the order listed in the tables above

**S1 verdict: COMPLETE.**

---

## S2 — Establish the harness and prove it runs

Created `apps/customer_app/test/` and `apps/admin_app/test/` — neither existed before this stage. One real test file per app, picking the highest-value **PURE** file from Stage 1's app-level ranking for each (the only PURE-classified file in each app's in-scope set, so no ranking ambiguity):

- `apps/customer_app/test/web_optimizations_test.dart` — 8 tests covering `WebOptimizations`. Real assertions: `animationDuration`/`optionalDuration` pass values through unchanged off-web; `conditionalAnimate` actually invokes its callback (not just "doesn't crash"); `repaintBoundary` wraps correctly; and specifically that `imageCacheWidth` does **not** apply its 400px cap off-web — a genuinely counter-intuitive fact given the class's own doc comment, and exactly the kind of assertion the anti-theatre rule wants (derived from reading the code's actual branching, not from running it and copying the output).
- `apps/admin_app/test/performance_utils_test.dart` — 8 tests covering `PerformanceUtils`. Real assertions: the off-mobile-web default values; `adjustDuration`'s actual multiply-and-round arithmetic; `startAnimationIfAllowed`'s conditional controller invocation, verified via a hand-written fake controller (`_FakeAnimationController`) matching this repo's existing no-mocking-framework convention, not a placeholder assertion.

Both explicitly document, in a file-level comment, that `kIsWeb`/mobile-web branches are unreachable under a plain VM `flutter test` run — an honest limit, not silently ignored.

```
$ flutter test apps/customer_app/test
...
00:00 +8: All tests passed!

$ flutter test apps/admin_app/test
...
00:00 +8: All tests passed!

$ cd apps/merchant_app && flutter test 2>&1 | tail -3
00:04 +172: All tests passed!
```

**Both harnesses run and pass. `apps/merchant_app` unaffected: still 172/172.** Neither test file is named `widget_test.dart`, per the brief's explicit instruction.

### Commits this stage

`1fb67d6a`.

**S2 verdict: COMPLETE.**

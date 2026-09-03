# 22 — First Real Test Coverage for customer_app and admin_app (Phase P)

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight and resume | COMPLETE | (this commit) |
| S1 | Map the testable surface | PENDING | |
| S2 | Establish the harness | PENDING | |
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

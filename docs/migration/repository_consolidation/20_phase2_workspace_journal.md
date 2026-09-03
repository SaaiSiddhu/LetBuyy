# 20 — phase_2 + quickcommerce_core Workspace Resolution Journal (Phase O)

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight and resume | COMPLETE | 3cef650f |
| S1 | Confirm both conflicts | COMPLETE | (this commit) |
| S2 | Resolve flutter_secure_storage | PENDING | |
| S3 | Resolve quickcommerce_core | PENDING | |
| S4 | Workspace membership | PENDING | |
| S5 | Verification | PENDING | |
| S6 | Documentation | PENDING | |

---

## S0 — Preflight and resume

**Journal status at start:** did not exist → FRESH START.

### Baseline reconciliation

CTO baseline: `HEAD 91c54fd9  tracked 8341  changed 39  staged 0  untracked 60  deletions 1`. Governance gate 105/6. `merchant_app` 172/172. `customer_app`/`admin_app` analyze clean.

Measured:
```
HEAD:      91c54fd92e78f94e49655070d46236349143d928   (EXACT MATCH)
tracked:   8341                                         (EXACT MATCH)
staged:    0                                             (EXACT MATCH)
deletions: 1  (apps/identity-platform/src/lib/useAuthTheme.ts)  (EXACT MATCH)
changed:   38  (37 other-session files + 00b_topology_amendment_draft.md)  (CTO: 39 — same 1-file bookkeeping gap already diagnosed in Phase N's S0 entry, not re-litigated here)
untracked: 16 git-status lines (14 pre-existing + 2 phase_2 pubspec.lock left over, deliberately uncommitted, from Phase N)  (CTO: 60 — same directory-line-collapsing artifact already diagnosed in Phase N's S0 entry: 4 untracked directories expand to ~54 files recursively)
```

**Conclusion:** identical reconciliation pattern to Phase N's own Stage 0 — the four hard identity signals (HEAD/tracked/staged/deletions) match exactly; the two soft counts are explained by the same measurement-methodology causes already documented and accepted last phase. Proceeding as a fresh start.

### Documents read this stage

`18_dart_package_recovery_journal.md` (Stages 5–6, the exact incident record for both conflicts this phase must resolve) and `19_dart_package_recovery.md`.

### Recorded before touching anything

`apps/merchant_app/pubspec.lock` does not exist on disk (this repo's convention — apps don't track per-app lockfiles; confirmed in Phase N). `merchant_app` participates in the shared workspace, so its actual resolved dependency versions live in the root `pubspec.lock`, which IS tracked:

```
$ grep -n "flutter_secure_storage" apps/merchant_app/pubspec.yaml
58:  flutter_secure_storage: ^9.2.4

$ sed -n '811,818p' pubspec.lock
  flutter_secure_storage:
    dependency: transitive
    description:
      name: flutter_secure_storage
      sha256: "9cad52d75ebc511adfae3d447d5d13da15a55a92c9410e50f67335b6d21d16ea"
      url: "https://pub.dev"
    source: hosted
    version: "9.2.4"

$ cd apps/merchant_app && flutter test 2>&1 | tail -3
00:05 +170: .../mobile_services_test.dart: CapabilityGate sanitizes internal fallback reasons
00:05 +171: .../mobile_services_test.dart: Turnstile sentinel state renders a generic error
00:05 +172: All tests passed!
```

Current resolved `flutter_secure_storage` version in the shared workspace (which `apps/merchant_app` participates in): **9.2.4**, matching its own `^9.2.4` constraint exactly. Current `merchant_app` test count: **172/172**, confirmed by an actual run before any change this phase — not assumed from the CTO's baseline.

**S0 verdict: COMPLETE.**

---

## S1 — Confirm both conflicts myself

### 1.1 — Conflict 1 reproduced

Added `apps/phase_2/rider_app` to the root `workspace:` list (without `resolution: workspace` in its own pubspec, matching its actual current state):

```
$ flutter pub get
apps/phase_2/rider_app/pubspec.yaml is included in the workspace from ./pubspec.yaml,
but does not have `resolution: workspace`.
```

This reproduces the exact Phase M incident the brief cites (a member without `resolution: workspace` breaks the workspace) — a real, verified re-confirmation, not assumed. Added `resolution: workspace` to `rider_app/pubspec.yaml` and re-ran:

```
$ flutter pub get
Resolving dependencies...
Because rider_app depends on flutter_secure_storage ^10.0.0 and letbuyy_store depends
on flutter_secure_storage ^9.2.4, version solving failed.
Failed to update packages.
```

**Verbatim, matches the CTO's report exactly.** Reverted both files (root `workspace:` list, `rider_app/pubspec.yaml`'s `resolution:` key) and re-ran `flutter pub get` — resolves cleanly, `git diff --stat` on both files empty, confirming a clean revert.

### 1.2 — Conflict 2 reproduced

Same procedure with `packages/dart/quickcommerce_core` (which also currently has no `resolution:` key). Without it: identical "included in the workspace... but does not have `resolution: workspace`" error. With `resolution: workspace` added:

```
$ flutter pub get
Resolving dependencies...
Note: matcher is pinned to version 0.12.19 by flutter_test from the flutter SDK.
Note: test_api is pinned to version 0.7.11 by flutter_test from the flutter SDK.

Because test >=1.31.2 depends on analyzer >=13.0.0 <15.0.0 and test >=1.31.1 <1.31.2
depends on test_api 0.7.12, test >=1.31.1 requires analyzer >=13.0.0 <15.0.0 or
test_api 0.7.12.
And because test >=1.30.0 <1.31.0 depends on test_api 0.7.10 and no versions of test
match >1.31.0 <1.31.1, test >=1.30.0 <1.31.0-∞ or >1.31.0 requires analyzer
>=13.0.0 <15.0.0 or test_api 0.7.10 or 0.7.12.
And because test >=1.28.0 <1.30.0 depends on matcher >=0.12.16 <0.12.19 and
test >=1.25.13 <1.28.0 depends on matcher >=0.12.16 <0.12.18, test >=1.25.13 <1.31.0-∞
or >1.31.0 requires analyzer >=13.0.0 <15.0.0 or test_api 0.7.10 or 0.7.12 or
matcher >=0.12.16 <0.12.19.
And because test >=1.24.3 <1.25.13 depends on matcher >=0.12.16 <0.12.17 and every
version of flutter_test from sdk depends on matcher 0.12.19, if
test >=1.24.3 <1.31.0-∞ or >1.31.0 and flutter_test from sdk then
analyzer >=13.0.0 <15.0.0 or test_api 0.7.10 or 0.7.12.
And because letbuyy_store depends on flutter_test from sdk which depends on
test_api 0.7.11, test >=1.24.3 <1.31.0-∞ or >1.31.0 requires
analyzer >=13.0.0 <15.0.0.
And because test 1.31.0 depends on analyzer >=8.0.0 <13.0.0 and
hive_generator >=2.0.1 depends on analyzer >=4.6.0 <7.0.0, test >=1.24.3 is
incompatible with hive_generator >=2.0.1.
So, because quickcommerce_core depends on hive_generator ^2.0.1 and
letbuyy_api_client depends on test ^1.25.8, version solving failed.
Failed to update packages.
```

Verbatim, matches Phase N's Stage 5 finding. Reverted both files; `flutter pub get` resolves cleanly; `git diff --stat` empty on both.

### 1.3 — `store_ops_app`'s `flutter_secure_storage` usage: confirmed genuinely unused

```
$ grep -rn "FlutterSecureStorage" apps/phase_2/store_ops_app/{lib,test,integration_test}
(zero hits)
$ grep -rn "flutter_secure_storage" apps/phase_2/store_ops_app/{lib,test,integration_test}
(zero hits)
$ grep -n "flutter_secure_storage" apps/phase_2/store_ops_app/pubspec.yaml
27:  flutter_secure_storage: ^10.0.0
```

Declared, never imported, never used anywhere in this app's own source. Confirmed by direct search, not assumed from the CTO's report.

### `rider_app`'s and `merchant_app`'s actual call sites (needed for Stage 2's verification)

`rider_app` (2 files, matching the CTO's count): `apps/phase_2/rider_app/lib/src/core/providers/rider_providers.dart` (`const FlutterSecureStorage()`, bare constructor) and `apps/phase_2/rider_app/lib/src/core/session/rider_session_store.dart` (`.read(key:)`, `.write(key:, value:)`, `.delete(key:)`). `merchant_app` (1 real usage file, matching the CTO's count — a second file, `test/mobile_services_test.dart`, only mocks/references it in test setup): `apps/merchant_app/lib/services/store_auth_service.dart` — `const FlutterSecureStorage()` (bare), `.read(key:)`, `.write(key:, value:)`, `.delete(key:)`. **Neither app constructs `AndroidOptions`/`IOSOptions`/any platform-options class, and neither calls `.containsKey()`** (confirmed by grep — every `containsKey` hit in both apps is an unrelated `Map.containsKey`, not this package's method) — the smallest possible API surface: bare constructor + `read`/`write`/`delete` with only the `key`/`value` named params.

Compared this surface directly against both locally-cached package versions (`$HOME/.pub-cache/hosted/pub.dev/flutter_secure_storage-{9.2.4,10.3.1}/lib/flutter_secure_storage.dart`, read source, not documentation/memory): both versions declare an identical shape for the four members actually used — `const FlutterSecureStorage({iOptions = ..., aOptions = ..., ...all-default platform options})`, `Future<String?> read({required String key, ...optional platform-options})`, `Future<void> write({required String key, required String? value, ...optional platform-options})`, `Future<void> delete({required String key, ...optional platform-options})`. Since neither app passes any of the optional platform-options parameters, this specific call surface is source-compatible across both major versions — strong evidence (not proof; Stage 2.2 will confirm with a real `flutter analyze`) that downgrading `rider_app` to `^9.2.4` is safe.

### 1.4 — `quickcommerce_core`: no Hive codegen dependency exists

```
$ grep -rn "part '.*\.g\.dart'" packages/dart/quickcommerce_core/lib   -> zero hits
$ grep -rn "@HiveType\|@HiveField" packages/dart/quickcommerce_core/lib -> zero hits
$ find packages/dart/quickcommerce_core -name "*.g.dart"                -> zero hits
$ grep -rln "package:hive" packages/dart/quickcommerce_core/lib         -> zero hits
$ grep -rn "hive\|Hive" packages/dart/quickcommerce_core/lib            -> zero hits (even broader sweep)
```

**Confirmed: `hive` (the runtime package, declared in `dependencies:`) and `hive_generator`/`build_runner` (declared in `dev_dependencies:`) are entirely unused in this package's source — not merely code-generation that never ran, but the runtime API itself is never imported.** `hive_generator` is unambiguously dead weight, exactly matching Stage 3.1's "no annotations found" branch. (Whether `hive`/`build_runner` themselves are also worth removing is a broader cleanup than this conflict requires — not touched, since the solver error names only `hive_generator` as the direct cause.)

### 1.5 — `merchant_app` at 172/172 before any change

Already confirmed in S0 with a real run, re-confirmed implicitly by every revert-and-reresolve cycle above never touching `merchant_app`'s own files.

**S1 verdict: COMPLETE.**

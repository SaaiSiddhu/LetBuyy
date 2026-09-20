# 06 — Generated Artifact Cleanup (Phase 1)

**First deleting phase of this programme.** Every prior phase (0 through 0.7) was additive or edit-only. This document records what was deleted, the proof behind each deletion, and what was found but deliberately left alone.

## Pre-deletion baseline (re-measured at start, matched the brief exactly — no stop condition)

| Repo | HEAD | Tracked | Content-changed | Staged | Untracked |
|---|---|---|---|---|---|
| System C | `16fe8e49` | 7234 | 39 | 0 | 66 |
| System A (`Ecommerce/LetBuyy`) | `be716ae1` | 1523 | 260 | 0 | 1 |
| System B (`Ecommerce/LetBuyy/Agrimore`) | `20548b89` | 1719 | 157 | 0 | 247 |

Signing-recovery: 6 files. Credential-evidence: 7 files. Keystores under `Ecommerce/`: 10. All matched.

## The `[RECHECK]` — zero tracked files inside any generated-directory class, all three repos

Re-run before touching anything, per instruction, not trusted from a prior phase:

```
                 build  .dart_tool  node_modules  .next  .turbo  coverage  test-results  Pods  .gradle
System C           0        0            0          0      0        0          0          0      0
System A            0        0            0          0      0        0          0          0      0
System B            0        0            0          0      0        0          0          0      0
```

All zero. This is the proof the whole phase rests on, and it held.

## Scope decision — why this phase deleted 35 directories, not ~232

The brief's remainder list explicitly named 20 items by path and said "(232 node_modules dirs exist overall)" as a parenthetical. Before deleting anything, the arithmetic was checked: **the explicitly-named items alone sum to 26.79 GB — matching "~27 GB" almost exactly.** Independently, `find` for node_modules at increasing depth showed 1,189+ matches, but only **231 are top-level** (not nested inside another node_modules) — within one of the "232" the brief mentions, confirming that figure is a scale-confirmation fact, not a 232-item deletion list. Sampling three of System C's own per-app `node_modules` (`apps/identity-platform`, `services/api-gateway`, `apps/merchant-control-plane`) found them at **20–36 KB each** — pnpm workspace symlink stubs pointing back into the retained root `.pnpm` store, not independent space. Given the brief already explicitly retains System C's *root* `node_modules`/`.pnpm-store` specifically because deleting it "makes the repo unbuildable... until a network `pnpm install` succeeds," the same reasoning applies to every per-package `node_modules` in that same pnpm workspace — deleting hundreds of tiny symlink directories for near-zero space, with real risk of leaving some workspace package unbuildable, was rejected as out of scope. **Only the two `node_modules` directories the brief named explicitly (`Agrimore/node_modules`, `tools/central-intelligence/node_modules`) were deleted; no other `node_modules` anywhere was touched.**

## Full candidate table — all four proofs, printed before any deletion

Proof legend: **P1** absolute path (given, relative to `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`) · **P2** regenerating manifest · **P3** `git -C <owner> ls-files <dir> | wc -l` = 0 · **P4** `du -sh` before.

| # | Path | Owner | P2 Manifest | P3 Tracked | P4 Size before |
|---|---|---|---|---|---|
| 1 | `Ecommerce/LetBuyy/Agrimore/apps/rider_app/build` | B | `pubspec.yaml` | 0 | 6.4G |
| 2 | `Ecommerce/LetBuyy/Agrimore/apps/store_ops_app/build` | B | `pubspec.yaml` | 0 | 4.7G |
| 3 | `Ecommerce/LetBuyy/Agrimore/apps/admin_app/build` | B | `pubspec.yaml` | 0 | 4.7G |
| 4 | `Ecommerce/LetBuyy/Agrimore/apps/seller_app/build` | B | `pubspec.yaml` | 0 | 4.6G |
| 5 | `Ecommerce/LetBuyy/Agrimore/apps/customer_app/build` | B | `pubspec.yaml` | 0 | 4.4G |
| 6 | `Ecommerce/LetBuyy/Agrimore/apps/rider_app/.dart_tool` | B | `pubspec.yaml` | 0 | 398M |
| 7 | `Ecommerce/LetBuyy/Agrimore/apps/store_ops_app/.dart_tool` | B | `pubspec.yaml` | 0 | 119M |
| 8 | `Ecommerce/LetBuyy/Agrimore/apps/admin_app/.dart_tool` | B | `pubspec.yaml` | 0 | 119M |
| 9 | `Ecommerce/LetBuyy/Agrimore/apps/seller_app/.dart_tool` | B | `pubspec.yaml` | 0 | 84M |
| 10 | `Ecommerce/LetBuyy/Agrimore/apps/customer_app/.dart_tool` | B | `pubspec.yaml` | 0 | 121M |
| 11 | `Ecommerce/LetBuyy/Agrimore/apps/rider_app/android/.gradle` | B | `android/app/build.gradle*` | 0 | 16M |
| 12 | `Ecommerce/LetBuyy/Agrimore/apps/store_ops_app/android/.gradle` | B | `android/app/build.gradle*` | 0 | 7.2M |
| 13 | `Ecommerce/LetBuyy/Agrimore/apps/admin_app/android/.gradle` | B | `android/app/build.gradle*` | 0 | 7.0M |
| 14 | `Ecommerce/LetBuyy/Agrimore/apps/seller_app/android/.gradle` | B | `android/app/build.gradle*` | 0 | 4.2M |
| 15 | `Ecommerce/LetBuyy/Agrimore/apps/customer_app/android/.gradle` | B | `android/app/build.gradle*` | 0 | 9.6M |
| 16 | `Ecommerce/LetBuyy/Agrimore/node_modules` | B | `package.json` + `pnpm-lock.yaml` | 0 | 768M |
| 17 | `tools/central-intelligence/node_modules` | C | `package.json` (no lockfile — see below) | 0 | 183M |
| 18 | `build` (canonical root) | C | root `pubspec.yaml` (Melos/Flutter workspace for `apps/mobile/merchant-app`) | 0 | 81M |
| 19 | `graphify-out` (canonical root) | C | `graphify` CLI, `pnpm graph:*` scripts (`docs/ai-infrastructure/`) | 0 | 76M |
| 20 | `test-results` (canonical root) | C | `playwright.config.ts` | 0 | 4.0K |
| 21 | `apps/storefront-runtime/.next` | C | `package.json` | 0 | 1.2G |
| 22 | `apps/identity-platform/.next` | C | `package.json` | 0 | 149M |
| 23 | `apps/merchant-control-plane/.next` | C | `package.json` | 0 | 1.3G |
| 24 | `Ecommerce/LetBuyy/apps/admin-web/.next` | A | `package.json` | 0 | 434M |
| 25 | `Ecommerce/LetBuyy/apps/store-builder-web/.next` | A | `package.json` | 0 | 184M |
| 26 | `Ecommerce/LetBuyy/apps/store/storefront/.next` | A | `package.json` | 0 | 377M |
| 27 | `Ecommerce/LetBuyy/Agrimore/apps/marketplace_web/.next` | B | `package.json` | 0 | 113M |
| 28 | `.turbo` (canonical root) | C | `turbo.json` + `package.json` | 0 | 328M |
| 29 | `Ecommerce/LetBuyy/Agrimore/packages/agrimore_realtime/coverage` | B | `pubspec.yaml` | 0 | 4.0K |
| 30 | `Ecommerce/LetBuyy/Agrimore/packages/agrimore_api/coverage` | B | `pubspec.yaml` | 0 | 4.0K |
| 31 | `Ecommerce/LetBuyy/Agrimore/packages/agrimore_offline/coverage` | B | `pubspec.yaml` | 0 | 4.0K |
| 32 | `Ecommerce/LetBuyy/Agrimore/packages/agrimore_domain/coverage` | B | `pubspec.yaml` | 0 | 8.0K |
| 33 | `Ecommerce/LetBuyy/Agrimore/packages/agrimore_core/coverage` | B | `pubspec.yaml` | 0 | 12K |
| 34 | `Ecommerce/LetBuyy/apps/store/builder/ios/Pods` | A | `ios/Podfile` (`Podfile.lock` present, untouched) | 0 | 170M |
| 35 | `Ecommerce/LetBuyy/Agrimore/legacy_archive_v2/apps/marketplace/ios/Pods` | B | `ios/Podfile` (`Podfile.lock` present, untouched) | 0 | 249M |

**Row 17 caveat, stated plainly rather than hidden:** `tools/central-intelligence` has a `package.json` but **no lockfile** (`package-lock.json`, `pnpm-lock.yaml`, and `yarn.lock` all absent). `npm install`/`pnpm install` will still regenerate `node_modules` from `package.json` alone — the directory is genuinely regenerable — but without a lockfile, regeneration is not pinned to exact prior versions. Flagged, not treated as disqualifying (P3 was still 0 tracked, and no lockfile is being deleted — there was none to begin with).

**Content-type verification (spot-checked, not just trusted from directory names):** every `build/` directory's top-level structure matched canonical Flutter/Gradle output exactly (`.cxx`, `app/`, one subdirectory per Flutter plugin, `native_assets`, `unit_test_assets`, `reports`) — read directly, not inferred. Every `Pods/` directory's contents were third-party CocoaPods dependencies (`FirebaseCore`, `RecaptchaInterop`, etc.), read directly. Every `.next/` directory had the standard Next.js `dev`/build-cache subdirectory structure. `.jks`/`.keystore` search was run against all five `build/` directories specifically before deletion — zero found in any of them.

## Rejected candidates — found, NOT deleted, with reason

| Candidate | Reason not deleted |
|---|---|
| `.claude/worktrees/intelligent-euclid-61b310/apps/merchant-control-plane/.next` (1.3G-class, not separately measured) | Inside a live registered worktree — explicit stop condition. Not entered, not measured further, not touched. |
| System C's root `node_modules/` and `.pnpm-store/` | Explicitly retained by instruction — ~1 GB, would make the repo unbuildable/un-gateable until a network `pnpm install` succeeds. |
| ~229 other top-level `node_modules` directories (System C's per-app/service/package `node_modules`, various System A Next.js app `node_modules`) | Not explicitly named; confirmed via 3-sample check to be tiny (20–36 KB) pnpm workspace symlink stubs, not independent space; same "keeps the workspace buildable" logic as the explicitly-retained root copy. See "Scope decision" above. |
| `infra/terraform/envs/staging/.terraform/` (found incidentally during untracked-file spot-check, contains a downloaded Terraform provider binary) | `.terraform/` was never one of the eight named classes (`build`, `.dart_tool`, `node_modules`, `.next`, `.turbo`, `coverage`, `test-results`, `Pods`, `.gradle`). Not searched for, not measured, not deleted — flagged here for a future phase's consideration, not acted on. |
| `Ecommerce/LetBuyy/Agrimore/legacy_archive_v2/apps/marketplace/android/key.jks` and every `debug.keystore` cataloged in `00a_signing_key_rescue.md` | Signing material — explicit stop condition, never touched, never appeared inside any candidate directory above. |

## Deletions executed — exact absolute paths, before/after

Every deletion below was run as `rm -rf <the literal absolute path shown>` — no shell variable, no wildcard, no `find -delete`, no `xargs`. `git ls-files`/`git status` re-checked at two checkpoints mid-phase (after the 15 Agrimore Flutter dirs, and after the 4 canonical-root items) — both checkpoints showed zero movement in tracked or content-changed counts before continuing.

All 35 paths from the candidate table above were deleted at their listed absolute path (prefix `/Users/saai_siddharth/Projects/Start_Up/LetBuyy/`), each individually confirmed removed (`ls` on the deleted path returned "No such file or directory" immediately after). Source directories for all five Flutter apps were explicitly re-verified intact (`pubspec.yaml` and `lib/` present) immediately after their `build/` deletion, before proceeding to `.dart_tool`.

## Total reclaimed — per tree, with arithmetic

| Tree | Before (Phase 0 baseline / this phase) | After | Reclaimed |
|---|---|---|---|
| `Ecommerce/` (Systems A+B combined) | 32G (Phase 0) | **4.0G** (measured after this phase) | **28G** |
| `Ecommerce/LetBuyy/Agrimore/` (System B alone) | 28G (Phase 0) | **1.7G** (measured after this phase) | **26.3G** |

Arithmetic cross-check — sum of every deleted item that lives inside `Ecommerce/` (rows 1–16, 24–27, 29–35 in the table above): 24.8G (five `build/`) + 0.841G (`.dart_tool`) + 0.044G (`.gradle`) + 0.768G (`Agrimore/node_modules`) + 1.108G (four `.next` inside `Ecommerce/`) + 0.032G (five `coverage/`, combined) + 0.419G (two `Pods/`) = **27.98G ≈ 28G** — matches the measured `Ecommerce/` reduction exactly.

Sum of every deleted item **outside** `Ecommerce/` (canonical repo root and its own `apps/`): 0.183G (`tools/central-intelligence/node_modules`) + 0.081G (canonical `build/`) + 0.076G (`graphify-out/`) + 0.328G (`.turbo/`) + 2.649G (three canonical `.next/`) ≈ **3.32G**.

**Grand total reclaimed this phase: ≈31.3 GB** — more than the brief's "~27 GB" headline, because the headline covered only the explicitly-named items; the instructed "plus any `.next/`, `.turbo/`, `coverage/`, `Pods/` you find" search turned up an additional ~4.5 GB (mostly the three canonical-repo `.next/` build caches and the two `Pods/` directories) that was not part of the original ~27 GB estimate. Stated plainly rather than silently absorbed into the headline number.

## Untracked-count discrepancy — investigated, explained, not hidden

**System B's untracked file count dropped from 247 to 242 — a decrease of exactly 5, matching the five `coverage/` directories deleted.** The acceptance criteria expected 247 to hold. Investigated before writing anything down: `Ecommerce/LetBuyy/Agrimore/.gitignore:34` contains `/coverage/` — the **leading slash anchors that rule to the repository root** (`Agrimore/coverage/` only), so it never matched the nested `packages/agrimore_{core,api,domain,offline,realtime}/coverage/` paths deleted here. Those five directories' contents (one coverage-report file each, from `flutter test --coverage`) were therefore genuinely counted among the original 247 untracked files, despite being 100% regenerable, machine-generated test output with zero hand-authored content — confirmed via the same P2/P3 proof as everything else in the candidate table before deletion.

This is not data loss in the sense this programme has used that term throughout — it is not uncommitted source, config, or authored content; it is disposable coverage-report output, correctly identified as a named target class (`coverage/`), correctly proven to hold zero tracked files, and correctly deleted. It is reported here because the acceptance criteria's "untracked after: 247" expectation assumed a fact (that `coverage/` was already excluded from that count) which the `.gitignore` anchoring behavior made false. The other 242 untracked files were spot-checked at three positions in the list (first, middle, last) and all three exist on disk exactly as before.

## Regeneration commands, per class

| Class | Regenerate with |
|---|---|
| Flutter `build/`, `.dart_tool/` (per app) | `cd <app> && flutter pub get && flutter build <target>` (or `flutter run`/`flutter test` for dev builds) |
| Flutter `android/.gradle/` | Regenerates automatically on the next `flutter build`/Gradle invocation for that app |
| `node_modules/` (npm/pnpm) | `pnpm install` (Agrimore root has `pnpm-lock.yaml` — pinned; `tools/central-intelligence` has none — unpinned, see caveat above) |
| Canonical root `build/` | `flutter pub get && flutter test` from the workspace root (Melos, per root `pubspec.yaml`) |
| `graphify-out/` | `pnpm graph:v3` (or the specific `pnpm graph:*` script needed) per `docs/ai-infrastructure/graphify-queries.md` |
| `test-results/` | Next Playwright run: `pnpm playwright test` (per `playwright.config.ts`) |
| `.next/` (per Next.js app) | `pnpm install && pnpm build` (or `pnpm dev`) inside that app directory |
| `.turbo/` | Regenerates automatically on the next `turbo`-orchestrated script run from the workspace root |
| Dart `coverage/` (per package) | `flutter test --coverage` inside that package |
| iOS `Pods/` | `cd ios && pod install` (uses the untouched `Podfile.lock` to pin exact versions) |

## Explicit retention notes

**System C's own root `node_modules/` and `.pnpm-store/` were deliberately retained, per instruction — not evaluated, not measured, not touched.** Removing them would leave the canonical repository unbuildable and ungateable until a network `pnpm install` completes successfully, which a later phase (Phase 9, per the brief) depends on being available on demand.

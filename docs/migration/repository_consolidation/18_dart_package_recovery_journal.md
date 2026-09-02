# 18 — Dart Package Recovery and Namespace Consolidation Journal (Phase N)

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. This is one git root — no nested repositories (Phase M deleted them; see `16_deleted_files_manifest.md`).

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight and resume | COMPLETE | 091e979c |
| S1 | Recover packages from bundles | COMPLETE | 6d12bfc6 |
| S2 | Collision evidence and naming decision | COMPLETE | a0330b2d |
| S3 | Import/rename System A's four packages | COMPLETE | (this commit) |
| S4 | Import/rename System B's quick-commerce packages | PENDING | |
| S5 | Workspace membership and path repair | PENDING | |
| S6 | Make each app resolve/analyze/test | PENDING | |
| S7 | Full verification | PENDING | |
| S8 | Documentation and close-out | PENDING | |

## Decision log

(populated as decisions are made — see Stage 2 for the naming decision)

---

## S0 — Preflight and resume

**Journal status at start:** did not exist → this is a FRESH START (not a resume).

### Baseline measurement vs. CTO-supplied baseline

CTO baseline (given in the Phase N prompt, measured 2026-09-02 immediately before the prompt):
`HEAD 5c930d2d  tracked 8055  changed 39  staged 0  untracked 58  deletions 1`
Governance gate: 105 PASS / 6 FAIL. Branch: main +0 / this branch +40.

My measurement (2026-09-03, `git status --porcelain=v1` against `git rev-parse HEAD` / `git ls-files | wc -l`):

```
HEAD:       5c930d2d036bc6c53d68a6f9940de1f4fa2c97db   (EXACT MATCH)
tracked:    8055                                        (EXACT MATCH)
staged:     0                                            (EXACT MATCH)
deletions:  1  (apps/identity-platform/src/lib/useAuthTheme.ts)  (EXACT MATCH)
changed:    38                                            (CTO: 39 — off by 1)
untracked:  14 git-status lines                           (CTO: 58 — apparent large gap)
```

### Reconciling the two soft-count mismatches (not treated as a stop condition)

**`changed`: 38 vs. 39.** Listed all 38 modified paths directly: 12 in `apps/identity-platform`, 13 in `apps/merchant_web`, 5 in `packages/typescript`, 7 in `services/api-gateway`, plus `docs/migration/repository_consolidation/00b_topology_amendment_draft.md`. That is 37 "other-session" files + 1 (`00b`) = 38. `15_final_executive_summary.md`'s own close-out accounting (line 79) stated "38 pre-existing dirty files ... + 1 file, `00b`" = 39, i.e. it counted 38 *other-session* files, not 38 *total*. My direct count finds only 37 other-session files. This is a 1-file bookkeeping difference in a prior document, not a file that changed under me — every path I see modified is one already named and attributed to another session in Phase M's own accounting. Not investigating further (per the brief: never touch, never diff, these belong to other sessions) and not a stop condition.

**`untracked`: 14 git-status lines vs. 58.** `git status --porcelain` prints ONE line per untracked *directory*, not one line per file inside it. My 14 lines include 4 untracked directories (`.agents/`, `database/supabase/supabase/`, `docs/research/2026-08-16-architecture-truth-foundation-and-scale/`, `docs/research/2026-08-16-ui-feedback-status-audit/`) plus 10 individually-listed files. Recursively counting files inside those 4 directories: 2 + 7 + 34 + 11 = 54, plus the 10 individual files = 64 — much closer to 58 than 14 is, and in the right direction/order of magnitude to confirm this is a directory-collapsing artifact of the measurement method (line-count vs. recursive-file-count), exactly the class of false signal the Phase N brief itself pre-discloses under hazard (5), "untracked-count stability is weak evidence of safety." The residual 64-vs-58 gap is not reconciled further (would require the CTO's exact counting command, which is not recorded) but is far too small relative to the 44-line gap to indicate new/lost content given every other identity signal (HEAD, tracked, staged, deletions) matches exactly.

**Conclusion:** HEAD, tracked-file count, staged count, and deletion count all match exactly — the four hardest, least ambiguous identity signals. The two soft counts are explained by measurement methodology, not by content change. Treating this as a diagnosed, non-blocking discrepancy and proceeding as a fresh start, per the same reasoning class the owner endorsed for the Stage 0 baseline mismatch in Phase M (filemode-flip anomaly, "proceed, treat as diagnosed").

### Bundle verification

```
$ git bundle verify ~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle
The bundle records a complete history.   (6 refs, HEAD be716ae18b5f1e25e1266f963ab5c0907928db26)

$ git bundle verify ~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle
The bundle records a complete history.   (14 refs, HEAD 20548b8938e2baa9c85b1e8f4ecc1f701999e331)
```

Both HEADs match the CTO-supplied baselines (`be716ae`, `20548b8`) exactly. Both bundles are usable.

### Documents read this stage

`CLAUDE.md`, root `AGENTS.md` (405 lines), `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` §16 Amendment Log, `10_merge_execution_journal.md` (Phase M's own journal — stage table + S3/S5/S8 entries for merchant_web pathspec incident and package-deferral reasoning), `12_final_verification.md`, `17_remaining_migration_backlog.md`, `07_final_path_mapping.md`, `apps/merchant_app/pubspec.yaml`.

### `apps/merchant_app/pubspec.yaml` — confirmed as the one known-good example, WITH a confirmed live bug

`name: letbuyy_store`, `resolution: workspace`, currently 172/172 passing. But its four internal-package dependencies are declared as:
```
letbuyy_core:       path: ../../../packages/dart/core
letbuyy_api_client: path: ../../../packages/dart/api_client
letbuyy_models:     path: ../../../packages/dart/models
letbuyy_ui_kit:     path: ../../../packages/dart/ui_kit
```
`apps/merchant_app/` is two levels deep from repo root, so `../../../packages/dart/core` resolves to ONE LEVEL ABOVE the repository root — outside the repo entirely. Confirmed via direct path arithmetic, exactly as the Phase N brief describes. This currently "works" only because Dart pub workspace resolution is name-based (`resolution: workspace` + the root `pubspec.yaml`'s `workspace:` list), so the stale path is never actually walked. Scheduled to fix in Stage 5.1, verifying 172/172 is preserved afterward.

### Current `packages/dart/*` (unchanged from Phase M close)

| Package | `name:` | dart files |
|---|---|---|
| `packages/dart/core` | `letbuyy_core` | 23 |
| `packages/dart/models` | `letbuyy_models` | 15 |
| `packages/dart/ui_kit` | `letbuyy_ui_kit` | 23 |
| `packages/dart/api_client` | `letbuyy_api_client` | 4 |

### Current broken-app declarations (confirmed exactly as briefed)

- `apps/customer_app/pubspec.yaml`: `name: letbuyy_marketplace`, `resolution: workspace`, deps `letbuyy_core`/`letbuyy_models`/`letbuyy_services`/`letbuyy_ui_kit` all at `../../packages/{core,models,services,ui_kit}` — none exist on disk.
- `apps/admin_app/pubspec.yaml`: `name: letbuyy_admin`, `resolution: workspace`, same four missing deps.
- `apps/phase_2/rider_app/pubspec.yaml`: `name: rider_app`, **no `resolution:` key**, deps on 6 `agrimore_*` packages at `../../packages/agrimore_*` — none exist on disk.
- `apps/phase_2/store_ops_app/pubspec.yaml`: `name: store_ops_app`, **no `resolution:` key**, same 6 missing `agrimore_*` deps.

### Toolchain

`flutter 3.44.8` (Dart 3.12.2), `dart 3.12.2` — both available.

### Scratch directory

Created `~/letbuyy-pkg-recovery-scratch/` (outside the repository), empty, for Stage 1 bundle clones.

**S0 verdict: COMPLETE.**

---

## S1 — Recover the packages from the bundles

Bundles treated as read-only throughout; nothing under `~/LetBuyy-history-preservation-2026-08-29/` was modified.

### Clones

```
$ git clone ~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle ~/letbuyy-pkg-recovery-scratch/system-A
$ git -C ~/letbuyy-pkg-recovery-scratch/system-A rev-parse HEAD
be716ae18b5f1e25e1266f963ab5c0907928db26   (matches CTO baseline exactly)

$ git clone ~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle ~/letbuyy-pkg-recovery-scratch/system-B
$ git -C ~/letbuyy-pkg-recovery-scratch/system-B rev-parse HEAD
20548b8938e2baa9c85b1e8f4ecc1f701999e331   (matches CTO baseline exactly, branch foundation-rebuild)
```

Both clones are outside the repository (`~/letbuyy-pkg-recovery-scratch/`), never registered as a repo submodule/worktree, and their own `.git` directories will never be copied into the repository (Stage 3/4 will exclude them explicitly).

### System A — `packages/{core,models,services,ui_kit}` (the declared four; no others present under `packages/`)

| Package | `name:` | dart files | pubspec sha256 |
|---|---|---|---|
| `core` | `letbuyy_core` | 27 | `08bb251b1a546b4faf46cccfdf9e24523d180d2e6bde8ac08a243d9920c503ea` |
| `models` | `letbuyy_models` | 52 | `708d8e66d0fc611a9c9c4be092b074c01197204100d3a61ade294631e2bb8b2f` |
| `services` | `letbuyy_services` | 51 | `4fb7900a3e8ce29f4644f5c37cc97f65c75f76aa63bee3a7f658307096543055` |
| `ui_kit` | `letbuyy_ui_kit` | 23 | `9ecfafb974af3303f9cc0880aaaf69cfb7624c4ffa1b79b8fed60f1d8baa0878` |

Internal dependency edges (all `path:`-based except one, noted): `models → core`; `services → core, models`; `ui_kit → core, models`; **`core → ui_kit` via a bare version constraint (`letbuyy_ui_kit: any`, no `path:`)** — this is a genuine circular dependency (`core ↔ ui_kit`) already present in System A's own source, directly contradicting `core`'s own pubspec comment ("Core should NOT depend on other internal packages ... to avoid circular dependencies. It is the foundation layer."). This is inherited source, not introduced by this phase, and resolving the circularity would be an architectural change beyond renaming — **out of scope, carried forward as-is, flagged here and in the Stage 8 report.** Dart pub workspaces can resolve mutual workspace-member dependencies at the package-graph level (no `path:` required within a workspace — name-based resolution against `resolution: workspace` members), so this is not expected to block `pub get`; it may still surface as an analyzer/import cycle if `core`'s code actually imports `ui_kit` symbols, to be confirmed in Stage 6.

`services` also declares three bare `any`-constraint third-party deps with no version pin (`crypto: any`, `url_launcher: any` — duplicate of the pinned `url_launcher: ^6.3.1` above it, `video_player: any`, `package_info_plus: any` — duplicate of pinned `^8.1.2`-class entry in `core`, `path: any`) plus `letbuyy_ui_kit: any`. Pre-existing sloppiness in System A's own pubspec, not touched beyond the package-name rename (touching version constraints would be scope creep beyond "make it resolvable via rename").

`services` is unambiguously Firebase-coupled (`firebase_core`, `firebase_auth`, `cloud_firestore`, `cloud_functions`, `firebase_storage`, `firebase_messaging`, `firebase_analytics`, plus `razorpay_flutter`, `google_sign_in`) — confirms the brief's D0_BLOCKED framing; will get the bounded-compatibility header comment in Stage 3.7.

### System B — declared six, plus one transitive addition

Declared by both `phase_2` apps: `agrimore_api`, `agrimore_design_system`, `agrimore_domain`, `agrimore_observability`, `agrimore_offline`, `agrimore_realtime`. Walked every one of their pubspecs for `path:` dependencies:

- `agrimore_api → agrimore_domain, agrimore_observability`
- `agrimore_design_system → agrimore_domain`
- `agrimore_domain → agrimore_core` ← **not one of the declared six. Added to the closure.**
- `agrimore_observability → agrimore_domain`
- `agrimore_offline → agrimore_domain`
- `agrimore_realtime → agrimore_domain, agrimore_observability`

`agrimore_core`'s own pubspec has zero internal `path:` dependencies (only pub.dev packages: `equatable`, `intl`, `uuid`, `crypto`, `hive`) — the closure terminates here. **`agrimore_services`, `agrimore_testing`, `agrimore_ui` (present in System B's `packages/` but not referenced by any of the seven above) are confirmed NOT part of the closure and will NOT be imported.**

| Package | `name:` | dart files | pubspec sha256 |
|---|---|---|---|
| `agrimore_api` | `agrimore_api` | 6 | `a01f7124ec3291688d47b0b0b285de892cb8bd33eaffaaad70f0a9ef37858166` |
| `agrimore_core` **(closure addition)** | `agrimore_core` | 23 | `03e9d7ab4ac1c137ce1723e8f82186ca376184e19e1dc282a91f6cbdb07586e4` |
| `agrimore_design_system` | `agrimore_design_system` | 17 | `7edc1f324b2bcbb73df7744ef148c2e8732c42ed1ea2a841496920e5f8cc13f3` |
| `agrimore_domain` | `agrimore_domain` | 28 | `c3b74ebe6fdf34b84a9755ee886fa67f9362fc2fdf1857cd3c94d1844eaaad6f` |
| `agrimore_observability` | `agrimore_observability` | 4 | `e8a7c45692d3a7755b5d16c73e36841e4f408c9106b3d660fef466230bd4d6b3` |
| `agrimore_offline` | `agrimore_offline` | 4 | `23a94c4ba7cabb0f49f42bd7b6e0beffd47810d22d91489897ec31ffa8c53d28` |
| `agrimore_realtime` | `agrimore_realtime` | 3 | `dfaecc630959e4e52e98c162da60f9b3ba22816af755ed7128a7bdcbd9a307b8` |

**Total closure: 7 System B packages (6 declared + 1 transitive), 11 packages total this phase (4 + 7).**

### Exclusions confirmed

Neither clone's copy step (Stage 3/4) will include `.git`, `build/`, `.dart_tool/`, `node_modules/`, or `coverage/` — verified none of the 11 source package directories currently contain a checked-in `build/`/`.dart_tool/`/`coverage/` (both source repos' own `.gitignore` excludes these; only fresh local pub-get/build artifacts would create them, and neither clone has been built).

**S1 verdict: COMPLETE.**

---

## S2 — Collision evidence and the naming decision

This is the evidence a future unification phase needs — produced now, from a direct file-by-file and byte-level comparison, while both sides are in front of us. "C" = this repository's existing `packages/dart/{core,models,ui_kit}`. "A" = System A's `packages/{core,models,ui_kit}` (from the be716ae clone).

### `letbuyy_core`: C (23 dart files) vs. A (27 dart files)

Export surface (`lib/letbuyy_core.dart`) is 16 exports in C, 17 in A — identical except A additionally exports `src/constants/firebase_constants.dart`. File-level diff: **zero files unique to C; 4 files unique to A** (`firebase_constants.dart`, and A's `responsive/` is split across 3 files — `breakpoints.dart`, `responsive_helper.dart`, `size_config.dart` — where C's `responsive/` is one consolidated `responsive.dart`). Of the 19 filenames common to both, 11 are **byte-for-byte identical**; 8 differ (`letbuyy_core.dart`, `gemini_config.dart`, `razorpay_config.dart`, `api_constants.dart`, `app_constants.dart`, `dialog_helper.dart`, `snackbar_helper.dart`, `web_scaffold.dart`), all still resembling light edits of a shared ancestor, not independent rewrites. **Verdict: near-identical lineage — C looks like a refactor/consolidation of the same original `core`, minus Firebase-specific constants (consistent with C never having been Firebase-coupled) and with `responsive/` merged into one file.** Both assume no specific backend (pure Dart/Flutter utilities, constants, formatting, error types) — this package is close to backend-agnostic on both sides.

### `letbuyy_models`: C (15 dart files) vs. A (52 dart files)

Export surface: C's `letbuyy_models.dart` is 9 lines; A's is 109 lines (over 10x). File-level diff: **9 files unique to C** — all merchant-app/store-builder-scoped (`merchant_contracts.dart`, `shared_contracts.dart`, `src/merchant_app/{mobile_telemetry,order,store_auth_request,store,store_theme}_model.dart`, `src/merchant_app/theme_editor_models.dart`). **46 files unique to A** — a large marketplace/social-commerce domain model set with no C equivalent at all: ad campaigns/tracking/wallet, cart, category (with attribute schemas), chat messages, commission settings, coupons, deals, fee config, India-locations reference data, loyalty, notifications, order/order-item/order-invoice/order-status/order-timeline, payment settings, products, "reels" (short-video social-commerce models — `reel_model.dart`, `reel_comment_model.dart`), and more. Only **6 filenames are common** to both (`letbuyy_models.dart`, `payment_config_model.dart`, `section_defaults.dart`, `section_model.dart`, `store_template_model.dart`, `subscription_model.dart`) — of those, only `section_defaults.dart` (608 lines) is byte-identical; the other 5 are close in size but have diverged. **Verdict: genuinely different scope, not just different implementations of the same domain — A's `models` covers an entire marketplace/social-commerce catalog+order+loyalty+ads domain that C's `merchant_web`/`merchant_app`-scoped model set never needed.** A assumes Firestore-shaped data (imports `cloud_firestore` types in several models per its pubspec); C's models are backend-agnostic DTOs consumed by the Supabase/Cloudflare `api-gateway`.

### `letbuyy_ui_kit`: C (23 dart files) vs. A (23 dart files)

Export/file surface is the closest pair by far: **22 of 23 filenames common**, and of those, **19 are byte-for-byte identical** (every widget: badges, dialogs, app bar, bottom nav, buttons, drawer, text field, empty/error states, glass container, loading indicator/overlay, network image, rating, search bar, shimmer, plus `app_theme.dart`). Only 3 differ (`letbuyy_ui_kit.dart` export list, `app_colors.dart`, `app_text_styles.dart` — consistent with small palette/typography-token differences, not structural divergence). Each side has exactly one file the other lacks: C has `src/tokens/letbuyy_tokens.dart` (this repo's `--lb-*` design-token bridge, per `CLAUDE.md`'s design-system ratchet); A has `src/widgets/update_dialog.dart` (an app-update-prompt widget, irrelevant to a web-first token system). **Verdict: essentially a fork of the same package at a very recent common ancestor — the smallest-effort future-unification candidate of the three, by a wide margin.**

### Naming decision

Adopting the Phase N brief's proposed target names as-is — no deviation, no alternative considered as superior given the evidence above (the collision evidence argues for *keeping both* visible and comparable under clearly-scoped names, which is exactly what "marketplace_*"/"quickcommerce_*" achieves; there is no reason to rename C's originals, which keep their existing `letbuyy_core`/`letbuyy_models`/`letbuyy_ui_kit`/`letbuyy_api_client` names unchanged):

| Source | Old path | Old `name:` | New path | New `name:` |
|---|---|---|---|---|
| System A | `packages/core` | `letbuyy_core` | `packages/dart/marketplace_core` | `letbuyy_marketplace_core` |
| System A | `packages/models` | `letbuyy_models` | `packages/dart/marketplace_models` | `letbuyy_marketplace_models` |
| System A | `packages/services` | `letbuyy_services` | `packages/dart/marketplace_services` | `letbuyy_marketplace_services` |
| System A | `packages/ui_kit` | `letbuyy_ui_kit` | `packages/dart/marketplace_ui_kit` | `letbuyy_marketplace_ui_kit` |
| System B | `packages/agrimore_api` | `agrimore_api` | `packages/dart/quickcommerce_api` | `quickcommerce_api` |
| System B | `packages/agrimore_core` | `agrimore_core` | `packages/dart/quickcommerce_core` | `quickcommerce_core` |
| System B | `packages/agrimore_design_system` | `agrimore_design_system` | `packages/dart/quickcommerce_design_system` | `quickcommerce_design_system` |
| System B | `packages/agrimore_domain` | `agrimore_domain` | `packages/dart/quickcommerce_domain` | `quickcommerce_domain` |
| System B | `packages/agrimore_observability` | `agrimore_observability` | `packages/dart/quickcommerce_observability` | `quickcommerce_observability` |
| System B | `packages/agrimore_offline` | `agrimore_offline` | `packages/dart/quickcommerce_offline` | `quickcommerce_offline` |
| System B | `packages/agrimore_realtime` | `agrimore_realtime` | `packages/dart/quickcommerce_realtime` | `quickcommerce_realtime` |

### Collision check against everything already in the workspace

Existing `packages/dart/*` names: `letbuyy_core`, `letbuyy_models`, `letbuyy_ui_kit`, `letbuyy_api_client`. Existing app names in the root `workspace:` list: `letbuyy_store` (`apps/merchant_app`), `letbuyy_workspace` (root). None of the 11 new names (`letbuyy_marketplace_{core,models,services,ui_kit}`, `quickcommerce_{api,core,design_system,domain,observability,offline,realtime}`) collide with any existing name, with each other, or with `letbuyy_marketplace` (`apps/customer_app`'s own `name:`) or `letbuyy_admin` (`apps/admin_app`'s own `name:`) — checked directly by string comparison, no overlap.

**S2 verdict: COMPLETE.**

---

## S3 — Import and rename System A's four packages

### Copy

`rsync -a --exclude='.git' --exclude='build' --exclude='.dart_tool' --exclude='node_modules' --exclude='coverage'` from the scratch clone into `packages/dart/marketplace_{core,models,services,ui_kit}/`. Post-copy dart-file counts matched Stage 1's recorded counts exactly (27/52/51/23) and no excluded directory leaked through (checked directly).

### Rename mechanics (per package)

1. `name:` in `pubspec.yaml` — anchored `^name: letbuyy_X$` → `name: letbuyy_marketplace_X`.
2. Internal dependency keys/paths — anchored `^  letbuyy_X:$` → `  letbuyy_marketplace_X:`, and `^    path: ../X$` → `    path: ../marketplace_X` (4-space indent, distinguishing these from the *unrelated* 2-space-indented `path: any` third-party `path` pub package dependency in `marketplace_services`'s own pubspec — verified indentation byte-by-byte with `sed -n l` before writing the pattern, so the third-party dep was never touched).
3. `marketplace_core`'s bare `letbuyy_ui_kit: any` (no `path:`, the pre-existing `core ↔ ui_kit` circular reference noted in Stage 1) → `letbuyy_marketplace_ui_kit: any`.
4. Internal `package:letbuyy_X/` import URIs across each package's own `lib/` — anchored on the full URI prefix including the trailing slash, `sed 's|package:letbuyy_core/|package:letbuyy_marketplace_core/|g'` (and the models/ui_kit equivalents), never a bare substring match. Before: 10 (core) + 42 (models, aggregate across all 4 packages) + 0 (services — nothing self-referenced it) + 4 (ui_kit) occurrences; after: 0 old-name references remained, and the corresponding new-name counts matched exactly (10/42/4).
5. Renamed each package's top-level library file to match its new name: `letbuyy_core.dart`→`letbuyy_marketplace_core.dart` (and the models/services/ui_kit equivalents).

### A gap the first sed pass missed, caught before committing

Step 4's `package:letbuyy_core/` substitution rewrote the *package-name* portion of each import URI but not the *trailing filename* portion when a file imported the sibling package's own top-level entry point (e.g. `import 'package:letbuyy_core/letbuyy_core.dart';` became `import 'package:letbuyy_marketplace_core/letbuyy_core.dart';` — a URI pointing at a filename that no longer existed after step 5's rename). Found via a direct grep for `letbuyy_marketplace_X/letbuyy_X.dart` patterns across the four packages: 39 occurrences across `marketplace_core`, `marketplace_services`, and `marketplace_ui_kit`. Fixed with a second anchored pass (`letbuyy_marketplace_core/letbuyy_core.dart` → `letbuyy_marketplace_core/letbuyy_marketplace_core.dart`, etc.); a broad final grep for any remaining un-namespaced old top-level filename reference (across all four packages) returned zero. The same two-pass fix was applied to `apps/customer_app`/`apps/admin_app` in the next step, this time correctly on the first pass since the gap was already known.

### Provenance READMEs (Stage 3.4)

Authored `README.md` for all four packages, following the style of Phase M's `apps/customer_app/README.md` — source system/path/HEAD SHA, bundle filename + SHA-256, original package name, and (for `marketplace_core`/`marketplace_models`/`marketplace_ui_kit`) a pointer to the Stage 2 collision evidence so a future unification phase doesn't have to rediscover it.

### `letbuyy_marketplace_services` — bounded compatibility header (Stage 3.7)

Added a doc comment to `lib/letbuyy_marketplace_services.dart`'s `library;` directive stating: BOUNDED COMPATIBILITY PACKAGE, not the canonical service layer, Firebase-coupled, disposition D0_BLOCKED pending D-0, not to be extended or used as a template. Mirrored in the package's `README.md`.

### `apps/customer_app`/`apps/admin_app` pubspec + import rewrites (Stage 3.5/3.6)

Both apps sit at `apps/<app>/` (two levels deep from repo root) — verified by direct path arithmetic, not assumed. Updated both `pubspec.yaml`s' four dependency blocks from `../../packages/{core,models,services,ui_kit}` (nonexistent) to `../../packages/dart/marketplace_{core,models,services,ui_kit}` (the new location), with matching `letbuyy_marketplace_*` dependency keys. Rewrote every `package:letbuyy_{core,models,services,ui_kit}/` import in `lib/` (no `test/` or `tool/` directory exists in either app): **customer_app — 299 occurrences before, 299 after (0 old-name remaining); admin_app — 218 before, 218 after (0 old-name remaining).** The commit diff is exactly symmetric (533 insertions / 533 deletions across 238 files) — confirms pure line-for-line text substitution, no logic touched.

### Observed, not acted on

`packages/dart/marketplace_ui_kit/lib/src/themes/app_theme.dart.broken` — a stray `.broken`-suffixed file present in System A's own source at `be716ae` (not created by this phase, not a `.dart` file so excluded from all dart-file counts, not imported by anything). Copied over verbatim as inherited source; not deleted (outside the brief's exclusion list of `.git`/`build`/`.dart_tool`/`node_modules`/`coverage`, and deleting inherited-but-inert source content is not "renaming," so left alone rather than making an unrequested cleanup call).

### Commits this stage

`b2558ba1` (`marketplace_core`), `6fd28f7f` (`marketplace_models`), `bd698052` (`marketplace_services`), `5aa2407f` (`marketplace_ui_kit`), `889ca97b` (`customer_app`/`admin_app` rewrites). Each verified with `git diff --cached --name-status` before commit (all `create mode` for the four package commits — new content, not a rename within this repo's own history, so `A` not `R` is correct and expected; all `M` for the app-rewrite commit) — no pre-existing dirty file or unrelated path was swept into any of the five commits.

**S3 verdict: COMPLETE.**

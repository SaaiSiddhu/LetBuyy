# 00 — Current State (measured 2026-08-29)

Dated evidence document. Every number below was measured during this session; it is not carried forward from any prior audit. Re-measure before acting on it in a later phase.

## Workspace facts — confirmed vs. changed since the brief

| Fact given in the brief | Status | Measured value |
|---|---|---|
| `/Users/saai_siddharth/Projects/Ecommerce/` does not exist | **CONFIRMED** | `ls` returns "No such file or directory" |
| `Ecommerce/` = 32 GB | **CONFIRMED** | `du -sh` → `32G` |
| `Ecommerce/LetBuyy/Agrimore` = 28 GB | **CONFIRMED** | `du -sh` → `28G` |
| canonical `.git` = 3.6 GB | **CONFIRMED** | `du -sh` → `3.6G` |
| canonical `apps/` = 2.8 GB | **CONFIRMED** | `du -sh` → `2.8G` |
| 38 content-changed tracked files (System C) | **CONFIRMED** | `git diff --numstat \| awk '$1!=0\|\|$2!=0' \| wc -l` → 38 before my `.gitignore` edit, 39 after (see below) |
| 58 untracked files (System C) | **DRIFTED SLIGHTLY — not a stop condition** | `git status --porcelain --untracked-files=all \| grep -c '^??'` → **57**, not 58. Breakdown: `docs/research/` 46, `database/supabase/` 7 (both match the brief's hazard note exactly), `.agents/skills/` 2, two root-level `.zip` files 2. Net drift is 1 file, inside a checkout three sessions share concurrently. `git status --porcelain` (without `--untracked-files=all`) collapses whole untracked directories into one line each and reports only **13** — that is a counting-method artifact, not 13 real files; always expand with `--untracked-files=all` when a file-level count is needed. |
| 257 modified tracked files (System A) | **CONFIRMED** | `git -C Ecommerce/LetBuyy diff --numstat \| awk '$1!=0\|\|$2!=0' \| wc -l` → 257 |
| 153 modified + 247 untracked (System B) | **CONFIRMED** | numstat → 153; `--untracked-files=all` → 247 |

**Concurrency check, run twice (start and end of this session):** HEAD and content-changed counts for all three repositories were identical both times (System C content-changed count went from 38→39 only because of my own `.gitignore` line — see Step 1 below). No other session wrote to any of the three repositories during this run.

## Per-repository git identity

### System C — canonical (this repository)

| Field | Value |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/saai_siddharth/Projects/Start_Up/LetBuyy` |
| branch | `feature/claude-md-durable-architecture-memory` |
| HEAD (start) | `073676fc0203acbdc77a55f17bd609afd0d72390` |
| HEAD (end) | `073676fc0203acbdc77a55f17bd609afd0d72390` (unchanged — nothing committed) |
| remote | `origin` → `https://github.com/SaaiSiddhu/Letbuyy_Store.git` |
| tracked file count | 7,234 (`git ls-files \| wc -l`) |
| content-changed count (numstat) | 39 (38 pre-existing + `.gitignore`) |
| untracked count (expanded) | 57 |
| stash list | 2 entries: `stash@{0}` "On stepup/main: inf-ext", `stash@{1}` "On stream/letbuyy-ui-v2: branch-consolidation-local-artifacts" — **not created or touched by this session** |
| `git worktree list` | 6 entries — see below |

`git worktree list` (canonical):
```
/Users/saai_siddharth/Projects/Start_Up/LetBuyy                                                         073676fc [feature/claude-md-durable-architecture-memory]
/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/.claude/worktrees/intelligent-euclid-61b310  ad91eac0 (detached HEAD)
/Users/saai_siddharth/Projects/Start_Up/LetBuyy/.claude/worktrees/busy-tu-4d552d                        1fda6486 [claude/busy-tu-4d552d]
/Users/saai_siddharth/Projects/Start_Up/LetBuyy/.claude/worktrees/confident-booth-07b940                1fda6486 [claude/confident-booth-07b940]
/Users/saai_siddharth/Projects/Start_Up/LetBuyy/.claude/worktrees/eloquent-thompson-f07a86              2634343b [claude/great-mirzakhani-d631f1]
/Users/saai_siddharth/Projects/Start_Up/LetBuyy/.claude/worktrees/peaceful-kare-6e6187                  1fda6486 [claude/peaceful-kare-6e6187]
/Users/saai_siddharth/Projects/Start_Up/LetBuyy/.claude/worktrees/vigorous-albattani-89bbf6             1fda6486 [claude/agitated-northcutt-18a70f]
```
The second entry is a **linked worktree of this canonical repository**, physically located inside `Copy/Letbuyy_Store`. Verified: `.git/worktrees/intelligent-euclid-61b310/gitdir` in canonical points to `Copy/Letbuyy_Store/.claude/worktrees/intelligent-euclid-61b310/.git`, and that path's `.git` file contains `gitdir: /Users/saai_siddharth/Projects/Start_Up/LetBuyy/.git/worktrees/intelligent-euclid-61b310` — a real, live back-reference. **Not pruned. Do not prune it** — pruning would orphan a working tree another session may depend on.

### System A — `Ecommerce/LetBuyy` (Firebase-era, live Play Store app)

| Field | Value |
|---|---|
| toplevel | `/Users/saai_siddharth/Projects/Start_Up/LetBuyy/Ecommerce/LetBuyy` |
| branch | `main` |
| HEAD | `be716ae18b5f1e25e1266f963ab5c0907928db26` (unchanged) |
| remote | `origin` → `https://github.com/SiddhuSaai/letbuyy.git` |
| tracked file count | 1,523 |
| content-changed count (numstat) | 257 |
| untracked count (expanded) | 1 |
| stash list | empty |
| worktree list | single entry (itself only) |

**Anomaly found and worth carrying into Phase 1:** `git status --porcelain=v2` reports **1,523** changed entries — i.e. every single tracked file — not 257. `git diff --summary` explains it: **1,522 files show a pure mode change, `100644 → 100755`** (every tracked file became "executable"), unrelated to the 257 real content edits. This is almost certainly a bulk `chmod -R 755` or a sync/cloud-backup tool that stripped the original file-mode bits, not deliberate editing. It is why the brief specifies `git diff --numstat` rather than the raw status line count — the raw count would have overstated the real edit surface by ~6x.

### System B — `Ecommerce/LetBuyy/Agrimore` (quick-commerce donor)

| Field | Value |
|---|---|
| toplevel | `/Users/saai_siddharth/Projects/Start_Up/LetBuyy/Ecommerce/LetBuyy/Agrimore` |
| branch | `foundation-rebuild` |
| HEAD | `20548b8938e2baa9c85b1e8f4ecc1f701999e331` (unchanged) |
| remote | `origin` → `https://github.com/SiddhuSaai/Agrimore.git` |
| tracked file count | 1,719 |
| content-changed count (numstat) | 153 |
| untracked count (expanded) | 247 |
| stash list | empty |
| worktree list | single entry (itself only) |

Every one of System B's six `apps/*`, `packages/`, `workers/` and `supabase/` directories last received a **real commit on 2026-06-04** (two distinct SHAs: `dafb4fe9…` for the app trees, `32eb56bf…` for `marketplace_web`/`workers`/`supabase`). All of the 153 changed + 247 untracked files are uncommitted work sitting on top of that June 4 baseline — consistent with the `foundation-rebuild` branch name.

## Other full copies of System C on disk (inventoried, not touched)

| Path | Exists | Branch | HEAD | Remote |
|---|---|---|---|---|
| `Start_Up/Letbuyy_Store` | yes | `stepup/main` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `SaaiSiddhu/Letbuyy_Store.git` |
| `Start_Up/LetBuyy-pre-reconciliation-2026-08-23-667669d0` | yes | `stepup/main` | `667669d09fda470b72cf6b1c2b7949561b7501b4` | `SaaiSiddhu/Letbuyy_Store.git` |
| `Start_Up/Copy/Letbuyy_Store` | yes | `feature/claude-md-durable-architecture-memory` | `a8162179e41710f8b7d129fbc41c68cc3e246668` | `SaaiSiddhu/Letbuyy_Store.git` |

`Copy/Letbuyy_Store`'s own HEAD (`a8162179`) **is a direct ancestor of the canonical repository's current HEAD** (`git merge-base --is-ancestor a8162179… 073676fc…` succeeds) — it is a slightly-behind independent clone on the same branch line, not a diverged fork. It additionally hosts the linked worktree described above. None of the three copies were modified, deleted, or pruned.

Sizes (measured with targeted `du -sh`, not a full recursive walk, per the hazard note): `Letbuyy_Store` 16G, `LetBuyy-pre-reconciliation-2026-08-23-667669d0` 16G, `Copy/Letbuyy_Store` 12G.

## RESERVED and mobile-placeholder verification (Constitution compliance, measured)

All eight RESERVED roots were confirmed to contain **exactly two files each** — `runtime.manifest.json` and `AGENTS.md`, no source:

```
services/checkout-runtime, services/event-bus, services/notification-service,
services/analytics-pipeline, services/media-service, services/search-service,
apps/mobile/shopper-app, apps/mobile/operator-app
```

This matches the Constitution's "RESERVED roots stay empty" invariant exactly, as measured — not merely as documented.

## Governance validator count (measured via `--plan`, gate lane never executed)

```
discovered on disk    : 115 .mjs modules
  executable validators: 112
  library modules      : 2 (governance-common.mjs, phase-b-common.mjs)
  hook-only modules    : 1 (frozen-path-override-gate.mjs)
declared in lanes     : 112 (gate 111, report 1)
selected for this run : 111
```

CLAUDE.md's "107 validators" is stale. The hazard note's "117 files I counted" is also off — the real, measured number is **115 files on disk / 112 executable / 111 selected for the gate lane**. `--plan` only lists what *would* run; the destructive `--lane=gate` default was never invoked in this session.

## Step 1 result — `.gitignore` accident guard

`git -C . diff .gitignore` was run first and returned empty (no other session mid-edit). A single dated line, `/Ecommerce/`, was appended with a comment explaining scope and limits. `git check-ignore -v Ecommerce/` now resolves to `.gitignore:215:/Ecommerce/`, and `git status --porcelain | grep Ecommerce` returns nothing. Full diff:

```diff
+
+# 2026-08-29 repository consolidation Phase 0 — temporary migration staging for two
+# nested, separate git repositories (System A: Firebase LetBuyy marketplace; System B:
+# Agrimore donor nested inside it). ~32 GB, not submodules, will be removed after
+# consolidation. This line only prevents an accidental `git add -A`/`git add .` from
+# committing it — it does NOT protect against `git clean -fdx`, which remains banned.
+/Ecommerce/
```

**What this proves:** an accidental `git add -A` or `git add .` in the canonical repo can no longer stage `Ecommerce/`. **What it does not prove and does not protect against:** `git clean -fdx` would still delete `Ecommerce/` (and everything else untracked) instantly and irreversibly — that command remains banned in every phase. It also does not protect System A or System B's *own* `.gitignore` files, which are unrelated and untouched.

Final content-changed count: `git diff --numstat | awk '$1!=0||$2!=0' | wc -l` → **39** (38 pre-existing + `.gitignore`), matching acceptance criterion 8 exactly. `git status` shows zero deletions.

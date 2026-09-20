# 05 — Safety and Recovery Plan

## The problem this document must solve

System A holds 257 modified tracked files, uncommitted and unpushed. System B holds 153 modified tracked files plus 247 untracked files, uncommitted and unpushed. **A `git bundle` only captures reachable commits and refs — it captures nothing about the working tree.** If a future consolidation phase deletes either `.git` directory (or the `Ecommerce/` tree wholesale) before this uncommitted work is captured some other way, it is gone permanently — no bundle, no reflog, no remote copy will have it, because it was never committed anywhere.

## The method: patch + untracked-copy, proven non-destructively in this session

This phase is prohibited from committing anything, running `git add -A`/`git add .`, or mutating either nested repository. So instead of executing the real capture now, I designed the method and **proved it works** using a scratch copy in `/tmp` that never touched either repository's actual state. This is the method a future phase (with explicit permission to commit, or simply to write files outside git) should run before any deletion.

**For tracked, modified files:**
1. `git -C <repo> diff -- <path> > <path>.patch` — captures the exact unstaged edit as a standard unified diff, addressable against the current `HEAD` commit.
2. Recovery: `git show HEAD:<path>` to extract the base version, then `patch <base-copy> < <path>.patch`.

**For untracked files (new files git has never seen):**
1. `git status --porcelain --untracked-files=all` lists every untracked file individually (not collapsed by directory — see doc 00's finding about the two counting methods).
2. Copy each with a path-preserving tool (`cp --parents`, `rsync -a --files-from=`, or `tar -T <filelist>`) into a destination that mirrors the repo's relative structure.

### Proof — tracked-file recovery (executed this session, zero repo mutation)

Chosen file: `Ecommerce/LetBuyy/apps/marketplace/pubspec.yaml` (one of System A's 257 modified files, a small text change).

```
$ git diff -- apps/marketplace/pubspec.yaml > /tmp/recovery_proof/pubspec.patch
$ shasum -a 256 apps/marketplace/pubspec.yaml                     # the REAL, modified, uncommitted file
ad189f5c1b0216afd5c3d4b0759acb316163c944bbcf342f439fb444fc24a66f  apps/marketplace/pubspec.yaml

$ git show HEAD:apps/marketplace/pubspec.yaml > /tmp/recovery_proof/pubspec.base.yaml   # base, read-only, no checkout
$ cp /tmp/recovery_proof/pubspec.base.yaml /tmp/recovery_proof/pubspec.recovered.yaml
$ patch /tmp/recovery_proof/pubspec.recovered.yaml < /tmp/recovery_proof/pubspec.patch
patching file pubspec.recovered.yaml

$ shasum -a 256 /tmp/recovery_proof/pubspec.recovered.yaml         # base + patch, done entirely in /tmp
ad189f5c1b0216afd5c3d4b0759acb316163c944bbcf342f439fb444fc24a66f  pubspec.recovered.yaml

$ diff /tmp/recovery_proof/pubspec.recovered.yaml apps/marketplace/pubspec.yaml
IDENTICAL — recovery method PROVEN
```

The recovered file's SHA-256 matches the real, currently-uncommitted working-tree file **exactly**. No `git checkout`, `git restore`, `git reset`, or `git stash` was run against the real repository at any point — `git show` is read-only and `patch` operated only on the `/tmp` scratch copy.

### Proof — untracked-file recovery (executed this session, zero repo mutation)

Chosen file: `Agrimore/ais/ACIS_ACCESS_LAYER.md` (one of System B's 247 untracked files).

```
$ shasum -a 256 ais/ACIS_ACCESS_LAYER.md
c80c33071ad8173c41d5d0c765eedbbe7a3af54a5b62f8bd48f612465ee21682  ais/ACIS_ACCESS_LAYER.md

$ mkdir -p /tmp/recovery_proof_untracked/ais
$ cp -p ais/ACIS_ACCESS_LAYER.md /tmp/recovery_proof_untracked/ais/ACIS_ACCESS_LAYER.md
$ shasum -a 256 /tmp/recovery_proof_untracked/ais/ACIS_ACCESS_LAYER.md
c80c33071ad8173c41d5d0c765eedbbe7a3af54a5b62f8bd48f612465ee21682  ais/ACIS_ACCESS_LAYER.md
IDENTICAL — untracked-file preservation PROVEN
```

### The full method for a future phase (not executed here — requires commit permission)

1. In each of System A and System B: `git status --porcelain --untracked-files=all` to get the exact file list (57/247-style expansion, not the collapsed count).
2. `git diff > <system>-tracked-changes-2026-08-29.patch` (whole-repo patch, one file, applies cleanly against the recorded HEAD as long as HEAD doesn't move before it's applied).
3. Copy every untracked file, preserving relative paths, into a directory alongside the patch (e.g. `rsync -a --files-from=<(git status --porcelain --untracked-files=all | grep '^??' | sed 's/^?? //') . <dest>/untracked/`).
4. Store the patch + untracked-file copy + the recorded HEAD SHA (`be716ae1…` for System A, `20548b89…` for System B) together, outside the repo, ideally in at least two locations (local + one off-machine copy — this workstation is a single point of failure for all of this).
5. **Only then** is it safe for a later phase to delete a `.git` directory or the `Ecommerce/` tree. Recovery is: clone/checkout the repo at the recorded HEAD, apply the patch, copy the untracked files back into place, verify with `git status` that it reproduces the original dirty state (hash-spot-check a few files, as done above).

This method was chosen over `git bundle` (doesn't capture working-tree state at all), over `git stash` (explicitly banned in this phase; also fragile — a stash is just a set of commit objects reachable only through `.git/refs/stash`, so deleting `.git` destroys it exactly as thoroughly as it destroys the "real" commits), and over a raw full-tree `tar`/`rsync` of everything (works, but at 32 GB is far heavier than necessary — the patch + untracked-copy method captures the same information in low tens of MB, since it excludes everything `git diff` already considers unchanged).

## Razorpay live-secret finding — flagged here, not acted on

While confirming secret-pattern types in doc 03, a `grep` matching an adjacent line in `Ecommerce/LetBuyy/packages/core/lib/src/config/razorpay_config.dart` caused a **live Razorpay key secret** to appear once in this session's own tool output (not in any file I wrote — a transient command result). I did not repeat it anywhere afterward, including in every other document in this set, all of which reference this finding only by path, line number, and pattern type. The same live key ID (confirmed by hash comparison of the extracted key-ID strings, values never displayed) is hardcoded in four locations:

- `Ecommerce/LetBuyy/packages/core/lib/src/config/razorpay_config.dart:6-7` (keyId + keySecret)
- `Ecommerce/LetBuyy/packages/services/lib/src/custom_payment_service.dart:49` (keyId, inline in a request-options literal)
- `Ecommerce/LetBuyy/Agrimore/legacy_archive_v2/packages/agrimore_core/lib/config/razorpay_config.dart:6`
- `Ecommerce/LetBuyy/Agrimore/legacy_archive_v2/pre_v2_root_archive/legacy_archive/lib/config/razorpay_config.dart:6`

`isLiveMode => keyId.startsWith('rzp_live_')` in the same file confirms this is explicitly the **live** mode key, not a test key. **Rotating this credential is out of scope for this phase** (explicitly banned in PROHIBITIONS) — this is flagged for the owner's immediate, separate action outside this session. Two lower-severity hardcoded credentials were also found and are not repeated here: a Google Generative Language API key (`packages/core/lib/src/config/gemini_config.dart:3`) and a Firebase project API key used server-side (`functions/src/adminAuth.ts:10`).

## Other risks this phase's changes do and do not address

- The `.gitignore` line added in Step 1 (doc 00) prevents an accidental `git add -A`/`git add .` in the **canonical** repo from committing `Ecommerce/`. It does nothing for System A or System B's own `.gitignore` files, and it does nothing against `git clean -fdx` anywhere — that command remains banned in every phase, on every repository, until the uncommitted-work capture above has actually run.
- The three other full copies of System C on disk (`Letbuyy_Store`, `LetBuyy-pre-reconciliation-2026-08-23-359baec6`, `Copy/Letbuyy_Store`, totaling 44 GB) were inventoried and left untouched. `Copy/Letbuyy_Store` additionally hosts a linked worktree registered in the canonical repo's `.git/worktrees/` — deleting that directory tree without first running `git worktree remove`/`prune` from the canonical repo would leave a dangling worktree reference. Not fixed in this phase (out of scope — no worktree commands were run); flagged for whoever executes a future cleanup phase.

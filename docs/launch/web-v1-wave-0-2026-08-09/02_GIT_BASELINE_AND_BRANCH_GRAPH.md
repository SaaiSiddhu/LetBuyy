# 02 — Git Baseline and Branch Graph

**Status:** Evidence artifact (NOT governance authority). Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md` → canonical governance rewrite docs.

**Agent:** Agent B — Git and Working-Tree Forensics Auditor, Wave 0 Phase 1, read-only.

**Repo root:** `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`

**Timestamp used:** 2026-08-09 (literal date supplied by the task brief; no system clock call was made).

**Repo SHA at time of audit (HEAD):** `ee3711829d857e986014c5811bb94d86ebc3d343`

**Branch at time of audit:** `stepup/main`

**What was executed vs. inferred:** Every number in this document was produced by a real `git` command run against the live repository during this session (see command list below). Nothing here is copied from the readiness ZIP, LCIS/graph output, or prior audit reports without independent re-verification. Where a prior document's figure is quoted for comparison, it is explicitly labeled "historical claim" and checked against the freshly recomputed number.

**What remains unverified:** Whether `origin/main` / `origin/stepup/main` reflect the true current remote state depends on network reachability of `github.com` at the moment `git fetch` was run in this session (it succeeded — see below). No push, merge, or rewrite was performed. Commit *authorship intent* (why 106/17/291 commits exist un-merged) is not independently verified beyond what `EXECUTION_LEDGER.md`'s own last row states (subordinate, self-reported evidence, quoted for context only).

---

## 1. HEAD, branch, remotes

```
$ git rev-parse HEAD
ee3711829d857e986014c5811bb94d86ebc3d343

$ git branch --show-current
stepup/main

$ git remote -v
origin  https://github.com/SaaiSiddhu/Letbuyy_Store.git (fetch)
origin  https://github.com/SaaiSiddhu/Letbuyy_Store.git (push)
```
Exit code: 0 for all three commands.

`git branch -a` (exit 0) additionally shows:
- Local branches: `claude/elegant-jang-91fd3e`, `main`, `* stepup/main` (current)
- 11 local worktree-linked branches: `worktree-agent-<hash>` × 11 (all `+` — checked out in other worktrees, see §4)
- Remote-tracking: `remotes/origin/HEAD -> origin/main`, `remotes/origin/develop`, `remotes/origin/main`, `remotes/origin/stepup/main`

## 2. Fetch and ref resolution

A `git fetch origin main stepup/main develop` was run to refresh remote-tracking refs (read-only; updates `refs/remotes/*` only, no working-tree or local-branch mutation, no push). It completed successfully:

```
$ git fetch origin main stepup/main develop
From https://github.com/SaaiSiddhu/Letbuyy_Store
 * branch              main       -> FETCH_HEAD
 * branch              stepup/main -> FETCH_HEAD
 * branch              develop    -> FETCH_HEAD
```
Exit code: 0.

Resolved SHAs immediately after fetch:

| Ref | SHA |
|---|---|
| `HEAD` | `ee3711829d857e986014c5811bb94d86ebc3d343` |
| `stepup/main` (local) | `ee3711829d857e986014c5811bb94d86ebc3d343` |
| `main` (local) | `0b8a56e7a6ace926e57cfb4849f6be513159b22c` |
| `origin/main` | `41b6ea49c5da30a1409d4cc587d989d459288e45` |
| `origin/stepup/main` | `8d9dda77303c931651fd2f36c34d5d031459eeb8` |
| `origin/develop` | `41b6ea49c5da30a1409d4cc587d989d459288e45` (**identical to `origin/main`**) |
| `ee371182` (short SHA, as named in the brief) | `ee3711829d857e986014c5811bb94d86ebc3d343` — **identical to `HEAD`** |

Confirmed: `HEAD == stepup/main (local) == ee371182`. The brief's "commit ee371182" is simply the current tip of the checked-out branch, not a separate historical commit to diff against.

Confirmed: local `main` (`0b8a56e7`) is **not** identical to `origin/main` (`41b6ea49`) — the local `main` branch is itself stale relative to its own remote.

## 3. Merge-base and recomputed divergence (`git rev-list --left-right --count A...B`)

All six materially distinct ref pairs were computed directly (not inferred from prior reports):

| A (left) | B (right) | merge-base | A-only commits | B-only commits | Command |
|---|---|---|---|---|---|
| `HEAD` | `main` (local) | `0b8a56e7…` | **106** | 0 | `git rev-list --left-right --count HEAD...main` |
| `HEAD` | `origin/main` | `41b6ea49…` | **291** | 0 | `git rev-list --left-right --count HEAD...origin/main` |
| `HEAD` | `origin/stepup/main` | `8d9dda77…` | **17** | 0 | `git rev-list --left-right --count HEAD...origin/stepup/main` |
| `main` (local) | `origin/main` | `41b6ea49…` | 185 | 0 | `git rev-list --left-right --count main...origin/main` |
| `main` (local) | `origin/stepup/main` | `0b8a56e7…` | 0 | 89 | `git rev-list --left-right --count main...origin/stepup/main` |
| `origin/main` | `origin/stepup/main` | `41b6ea49…` | 0 | 274 | `git rev-list --left-right --count origin/main...origin/stepup/main` |

All six commands exited 0.

### Reconciliation against historical figures cited in the task brief

- **"~106 commits"** (HEAD vs local `main`): **recomputed exact value is 106.** Matches the historical figure exactly (not merely "~106" — it is precisely 106 at the moment of this audit).
- **"~291 commits"** (HEAD vs `origin/main`): **recomputed exact value is 291.** Matches exactly.
- No historical figure was supplied for HEAD vs `origin/stepup/main` (the actual push-relevant divergence): **HEAD is 17 commits ahead of its own remote-tracking branch, with 0 commits behind.** This means the current branch has **17 local, unpushed commits** relative to `origin/stepup/main` as of this audit. This is the single most launch-relevant number in this table (it, not the 291, is what would need pushing to update the remote branch of the same name) and it was not present in the brief's historical figures — noted as a **gap in the prior audit's framing**, not a conflict.
- `origin/develop` and `origin/main` are byte-identical SHAs (`41b6ea49…`), i.e. `develop` is not diverged from `main` on the remote at this time.

### Interpretation (structural only, not a merge recommendation)

`stepup/main` (HEAD) is a superset-forward branch relative to local `main` and `origin/main` (0 commits behind either), consistent with it being the active integration branch. It also carries 17 commits that exist only locally and have not reached `origin/stepup/main`, independent of and in addition to the 6,795/30 uncommitted working-tree changes documented in `03_WORKTREE_CHANGE_CLASSIFICATION.md`. Uncommitted-tree state and unpushed-commit state are two separate risks and are reported separately here to avoid conflating them.

## 4. Worktrees

```
$ git worktree list
```
Exit code: 0. Output (13 worktrees total):

| Path | HEAD SHA | Branch | Note |
|---|---|---|---|
| `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` | `ee371182` | `[stepup/main]` | **this audit's working tree** |
| `/private/tmp/claude-501/.../scratchpad/wt-main` | `41b6ea49` | detached HEAD | `prunable` |
| `/Users/saai_sidd/Git/Letbuyy_Store/.claude/worktrees/agent-a1bd13d85c3105715` | `41b6ea49` | `[worktree-agent-a1bd13d85c3105715]` | `prunable` |
| ...9 more `agent-*` worktrees, all identical pattern... | `41b6ea49` | `[worktree-agent-*]` | `prunable`, 11 total |

All 12 non-primary worktrees sit at `41b6ea49` (== `origin/main`) and are flagged `prunable` by git itself (their filesystem paths are gone or stale). None of them is this audit's working tree and none was touched. This is reported as an observation (housekeeping candidate — stale agent worktrees), not acted upon (read-only mandate).

## 5. Submodules and Git LFS

```
$ [ -f .gitmodules ] && cat .gitmodules || echo "NO .gitmodules file"
NO .gitmodules file
```

```
$ grep -n "filter=lfs" .gitattributes
no filter=lfs entries found
```

```
$ git lfs env
git: 'lfs' is not a git command.
```

**Finding: no submodules, no Git LFS usage, git-lfs is not even installed in this environment.** All 6,914 tracked paths are plain git blobs.

## 6. `git ls-files --stage` summary (not dumped in full — 6,914 entries)

```
$ git ls-files | wc -l
6914

$ git ls-files --stage | awk '{print $1}' | sort | uniq -c
6852 100644
  62 100755
```
Exit code 0 for both. I.e. in the **committed index/HEAD**, only 62 of 6,914 tracked files (0.9%) are executable-mode. This is the baseline against which the working-tree mode-flip described in `03_WORKTREE_CHANGE_CLASSIFICATION.md` and `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` (6,778 files flipped 100644→100755 in the uncommitted working tree, 98% of tracked files) is measured.

## 7. Repo scale for context

```
$ git rev-list --count HEAD
1215
```
1,215 commits reachable from HEAD. Exit code 0.

## 8. Conflicts / escalation items found in this section

1. **Local `main` is stale vs. `origin/main`** (185 commits behind, per §3). This branch should not be treated as an authoritative baseline for any comparison without re-fetching immediately before use.
2. **17 unpushed local commits on `stepup/main`** relative to its own remote-tracking branch — not called out in the task brief's historical figures. Recorded here as a gap, not resolved (per instructions, this agent does not resolve conflicts, only records them for escalation).
3. No conflict was found between repo-authority documents (Constitution / `AGENTS.md`) and the readiness ZIP for anything measured in this document — the ZIP was not consulted for any number in this file per the "recompute independently" instruction.

## Raw evidence

Full untruncated raw command output backing this document is persisted at:
`/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-b/`
- `git-status-porcelain-v2-full.txt` (6,825 lines)
- `git-diff-numstat-full.txt` (6,795 lines)
- `git-diff-cached-numstat-full.txt` (0 lines — confirmed empty, see §3 of `03_...md`)
- `git-diff-summary-full.txt`
- `git-diff-cached-summary-full.txt` (0 lines — confirmed empty)

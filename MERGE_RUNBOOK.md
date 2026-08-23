# MERGE RUNBOOK - local one-reality promotion and human remote seams

This runbook is current for the foundation stepup convergence. It replaces the old `develop`/UI-stream merge instructions and must not be used to resurrect archived Codex mission prompts.

## Current local reality

- Canonical branch: `stepup/main`.
- Local deploy branch: `main`.
- Required local invariant: `git rev-list --count main..stepup/main` returns `0`.
- Remote promotion remains human-controlled and is recorded in `SKIPPED_HUMAN_DECISIONS.md` as `SKIP-PROD-DEPLOY-PROMOTION` and `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE`.
- Launch readiness remains blocked by `CAPABILITY_BACKLOG.md`; convergence completion is not a production launch claim.
- 2026-08-23: integration work accumulated on `feature/claude-md-durable-architecture-memory` was promoted locally, fast-forward only, to `stepup/main` and then to `main` (both now `1edaea7158a293fd38af25a8430e110a3dc9d2ce`). `stepup/main` remains the canonical integration branch named by CI, staging deploy, the branch-lag monitor, and this validator's default — the feature branch was a temporary work surface, not a replacement for it.

## Non-negotiable guardrails

1. Do not run `git clean`, `git reset --hard`, blanket `git restore`, or any other command that discards the working tree.
1. Do not run `git branch -f`, `git reset --hard`, or `git push --force` against a branch that holds commits absent from the integration branch. Classify the relationship first (§Divergence); a ref overwrite across a divergence destroys pushed work.
2. Do not push `main` remotely until the human owner completes branch-protection and deploy approval.
3. Do not hand archived `*PROMPT*`, `*MISSION*`, `TERMINAL_*`, or blueprint files to an agent as live instructions. The live registry is `PROMPTS.md`.
4. Do not claim a human seam or capability gap is complete unless its row is removed or superseded by a real implementation plus validation.

## Local verification

Run these before any local branch alignment or remote promotion request:

```bash
git status --short
git rev-parse --short HEAD
git rev-list --left-right --count main...stepup/main
git rev-list --count main..stepup/main
node scripts/validate-governance.mjs --lane=gate
```

Expected:

- `git status --short` is empty.
- `git rev-list --left-right --count main...stepup/main` reports `0` on the **left** side. A non-zero left count means `main` holds commits absent from the integration branch: the branches have **diverged**, and no alignment may proceed until §Divergence resolves it.
- `git rev-list --count main..stepup/main` is `0`.
- The governance gate passes without survivability, multi-region, failover, or prompt-perimeter drift.

Note: `branch-lag-guard-validator` previously only asserted the lag invariant when it ran on `main`, or when `LETBUYY_ENFORCE_BRANCH_LAG=1`, or when `LETBUYY_PRODUCTION_BRANCH` was set — on any other local branch it fell through to a commit-count check that always passed. That fallthrough was fixed in Phase V0 (commit `2df03029`): on any other checked-out branch the validator now computes `productionBranch..HEAD` (`scripts/validators/branch-lag-guard-validator.mjs:117`), the same real fast-forward check the other code paths already performed. A green run of this validator is now genuine local-branch-lag evidence regardless of which branch is checked out. It still only measures local refs — it proves nothing about `origin` or about what is actually deployed; measure the commands above directly when that distinction matters.

## Divergence — classify before aligning

Never align branches before classifying the relationship. Run:

```bash
git merge-base --is-ancestor main stepup/main && echo FAST_FORWARD_POSSIBLE || echo DIVERGED
git rev-list --left-right --count main...stepup/main   # left = main-only commits
```

Then take exactly one of three paths.

### 1. True fast-forward — `main` is an ancestor, left count is `0`

`main` holds nothing the integration branch lacks. Align the local branch only:

```bash
git branch -f main stepup/main
git rev-list --count main..stepup/main   # expect 0
```

This is local-only. It is not a privileged production promotion.

### 2. Diverged — left count is non-zero

**`git branch -f` is forbidden here.** It would discard every `main`-only commit, including commits already pushed to `origin/main`, with no reflog entry on the integration branch and no review. The same applies to `git reset --hard`, `git push --force`, and any other ref overwrite.

Work on an isolated reconciliation branch, never on `main` or `stepup/main`:

```bash
git switch -c claude/integration-reconciliation-<date> stepup/main
MB=$(git merge-base main stepup/main)
git diff --name-only $MB main | sort -u > /tmp/main_paths.txt
git diff --name-only $MB stepup/main | sort -u > /tmp/int_paths.txt
comm -23 /tmp/main_paths.txt /tmp/int_paths.txt    # main-only paths
git diff --name-only main stepup/main              # paths still differing at the tips
```

Classify every `main`-only path and every still-differing path as one of:

- **already semantically integrated** — the integration branch passed through `main`'s exact content and evolved past it. Prove it per path: `main`'s blob for that path must appear somewhere in the integration branch's history for that path. Absence of a diff is not proof; presence of the blob in history is.
- **genuine content merge required** — `main` holds behaviour the integration branch never had, or lost. Port it deliberately on the reconciliation branch, as its own commit, before merging. Do not import unrelated content alongside it.
- **ambiguous** — stop and escalate to the human owner. Do not guess.

### 3. Already semantically integrated — proven, no content to import

When every `main` commit is proven subsumed, preserve the history without importing the stale tree:

```bash
T1=$(git rev-parse HEAD^{tree})            # record the validated tree first
git merge --no-ff -s ours main -F <message-file>
test "$(git rev-parse HEAD^{tree})" = "$T1" && echo TREE_PRESERVED || echo STOP
git merge-base --is-ancestor main HEAD && echo HISTORY_PRESERVED || echo STOP
```

Both parents become ancestors, so `main`'s commits are never lost, while the tree stays byte-identical to the validated integration tree. The merge message MUST record why each differing path was safe to leave alone.

`-s ours` is only ever legitimate **after** the per-path proof above. Using it to skip a conflict — rather than to record a proven-subsumed history — silently discards work and is forbidden.

Reconciliation is local. It does not advance `main` or `stepup/main`, and it does not restore the constitutional branch-lag invariant; the human promotion seam below still applies.

## Human remote promotion seam

The human operator performs the remote side:

1. Review `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, and `CAPABILITY_BACKLOG.md`.
2. Confirm backup artifacts recorded in `EXECUTION_LEDGER.md` are still readable.
3. Confirm branch protection rules and production deploy approval are in place.
4. Push the validated local branches to the protected remote in the branch-lag-safe order:

   ```bash
   git push origin refs/heads/stepup/main:refs/heads/stepup/main
   git push origin refs/heads/main:refs/heads/main
   ```

   `stepup/main` is pushed first because the production branch-lag guard resolves `origin/stepup/main`; pushing `main` first can leave the next guarded deploy blocked on a missing or stale integration ref.
5. Neutralize the stale `develop` remote pointer by deleting it or repointing it to the promoted commit, according to the branch-protection decision:

   ```bash
   git push origin --delete develop
   # or, if deletion is not allowed during the cutover window:
   git push origin refs/heads/main:refs/heads/develop
   ```

6. Verify the remote reality:

   ```bash
   git ls-remote origin refs/heads/main refs/heads/stepup/main refs/heads/develop
   ```

   `origin/main` and `origin/stepup/main` must resolve to the same promoted commit; `origin/develop` must be absent or intentionally equal to that commit.
7. Run the production deploy workflow and record the deployment result.

Until that happens, remote production is not promoted even when local `main` equals `stepup/main`.

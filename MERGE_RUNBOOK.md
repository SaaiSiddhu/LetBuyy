# MERGE RUNBOOK - local one-reality promotion and human remote seams

This runbook is current for the foundation stepup convergence. It replaces the old `develop`/UI-stream merge instructions and must not be used to resurrect archived Codex mission prompts.

## Current local reality

- Canonical branch: `stepup/main`.
- Local deploy branch: `main`.
- Required local invariant: `git rev-list --count main..stepup/main` returns `0`.
- Remote promotion remains human-controlled and is recorded in `SKIPPED_HUMAN_DECISIONS.md` as `SKIP-PROD-DEPLOY-PROMOTION` and `SKIP-D1-MERGE-RUNBOOK-DIRTY-TREE`.
- Launch readiness remains blocked by `CAPABILITY_BACKLOG.md`; convergence completion is not a production launch claim.

## Non-negotiable guardrails

1. Do not run `git clean`, `git reset --hard`, blanket `git restore`, or any other command that discards the working tree.
2. Do not push `main` remotely until the human owner completes branch-protection and deploy approval.
3. Do not hand archived `*PROMPT*`, `*MISSION*`, `TERMINAL_*`, or blueprint files to an agent as live instructions. The live registry is `PROMPTS.md`.
4. Do not claim a human seam or capability gap is complete unless its row is removed or superseded by a real implementation plus validation.

## Local verification

Run these before any local branch alignment or remote promotion request:

```bash
git status --short
git rev-parse --short HEAD
git rev-list --count main..stepup/main
node scripts/validate-governance.mjs --lane=gate
```

Expected:

- `git status --short` is empty.
- `git rev-list --count main..stepup/main` is `0`.
- The governance gate passes without survivability, multi-region, failover, or prompt-perimeter drift.

If `main` locally lags but `stepup/main` is validated, align only the local branch:

```bash
git branch -f main stepup/main
git rev-list --count main..stepup/main
```

This is local-only. It is not a privileged production promotion.

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

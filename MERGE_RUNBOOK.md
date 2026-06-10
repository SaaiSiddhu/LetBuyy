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
4. Push or merge the validated local `main` to the protected remote branch.
5. Run the production deploy workflow and record the deployment result.

Until that happens, remote production is not promoted even when local `main` equals `stepup/main`.

# Change Ledger

## Phase A

| Action | Winner | Loser | Evidence | Rollback |
|---|---|---|---|---|
| FINAL-A0-PROMPT-REGISTRATION | Canonical prompt registry with the final convergence prompt registered under `FINAL_TRUTH_AUDIT_2026_06_11/`. | Untracked prompt/plan bundle outside validator visibility. | Prompt perimeter and full governance gate passed after staging the bundle; `PROMPTS.md` keeps the hardcoded foundation-stepup prompt canonical and adds the final convergence prompt as canonical. | Revert the A0 commit; local snapshot tags `convergence-cabe148c` and `pre-promotion-origin-41b6ea49` preserve the pre-A0 audited and stale-origin anchors. |
| FINAL-A1-REPOSITORY-VERIFY | Post-A0 `main == stepup/main` convergence baseline. | Local one-commit branch lag created by committing A0 only on `stepup/main`. | `git merge-base --is-ancestor main stepup/main` passed before fast-forwarding local `main`; A1 then recorded `git rev-list --count main..stepup/main` = `0`. | Move local `main` back to `convergence-cabe148c` if abandoning A0, or revert the A0/A1 commits. No remote refs were changed. |

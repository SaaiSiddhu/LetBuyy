# Rollback Report

## Phase A

| Scope | Forward action | Rollback path | Status |
|---|---|---|---|
| A0 prompt registration | Added the final convergence prompt registry row and tracked the final-truth audit bundle. | Revert the A0 commit. | Ready. |
| A0 local snapshot tags | Created local annotated tags `convergence-cabe148c` and `pre-promotion-origin-41b6ea49`. | Tags are local-only; delete them only if the A0 snapshot is abandoned. | Ready. |
| A1 verification | No runtime/schema change. | No rollback required beyond reverting the evidence-only A1 commit. | Ready. |
| A2 runbook fix | Updated remote promotion instructions and recorded `SKIP-A2-REMOTE-BRANCH-CONVERGENCE`. | Revert the A2 commit. | Ready; Codex changed no remote refs. |
| A3 deploy gate wiring | Added governance-gate prerequisites, untracked migration rejection, production mobile-bff Turnstile secret wiring, and validator/test enforcement. | Revert the A3 commit. | Ready; Codex did not run deployment or mutate GitHub branch protection. |
| A4/A5 G4 human block | Recorded that production promotion, live smoke, and post-promotion audit are skipped-human/blocking seams. | No rollback required for remote work because none was performed. Revert this evidence row if superseded by real G4 evidence. | Ready. |

## Promotion Rollback Requirements

Phase A4 is not executed yet. Before any production promotion, the human operator must hold prior worker/app deployment IDs, an encrypted database backup, and the two snapshot tags. If login or capture smoke fails during the promotion window and cannot be fixed quickly, roll back code to the pinned prior artifacts, apply schema rollbacks `167` down to `160` in reverse order, and restore DNS to the previous records.

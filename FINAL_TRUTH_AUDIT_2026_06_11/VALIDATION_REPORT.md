# Validation Report

## Phase A

| Checkpoint | Command | Result | Notes |
|---|---|---|---|
| A0 prompt registration | `node scripts/validate-governance.mjs --lane=gate` | PASS | 92 validators passed after registering `FINAL_TRUTH_AUDIT_2026_06_11/LETBUYY_FINAL_CONVERGENCE_CODEX_EXECUTION_PROMPT.md` in `PROMPTS.md`. |
| A0 staged prompt perimeter | `node scripts/validate-governance.mjs --lane=gate` | PASS | 92 validators passed with the final-truth audit bundle staged; tracked-file count increased to 4385 and stale-artifact validator reported 0 untracked non-ignored files. |
| A1 clean tree | `git status --short` | PASS | Empty output before A1 verification commands. |
| A1 HEAD lineage | `git rev-parse --short HEAD`; `git merge-base --is-ancestor cabe148c HEAD` | PASS | HEAD was `c7f4e4a0`, a descendant of `cabe148c`. |
| A1 local branch lag | `git rev-list --count main..stepup/main` | PASS | Output `0`. |
| A1 governance gate | `node scripts/validate-governance.mjs --lane=gate` | PASS | 92 validators passed. |
| A1 install | `CI=true pnpm install --frozen-lockfile` | PASS | Initial sandboxed attempt failed with `ENOTFOUND registry.npmjs.org`; escalated retry completed using the frozen lockfile and reused cached packages. |
| A1 Phase-B validator fixtures | `node --test tests/governance/phase-b-validators.test.mjs` | PASS | 16/16 tests passed. |
| A1 whitespace | `git diff --check` | PASS | No whitespace or conflict-marker residue. |
| A2 branch-lag validator | `node scripts/validators/branch-lag-guard-validator.mjs` | PASS | Runbook remains compatible with the local branch-lag guard after adding the remote `stepup/main` then `main` push sequence. |
| A2 governance gate | `node scripts/validate-governance.mjs --lane=gate` | PASS | 92 validators passed after the runbook and skipped-human seam updates. |
| A2 whitespace | `git diff --check` | PASS | No whitespace or conflict-marker residue. |
| A3 production workflow test | `node --test tests/operations/production-deploy-workflow.test.mjs` | PASS | 7/7 tests passed; covers governance gate, migration ordering, untracked migration rejection, mobile-bff Turnstile secret, and required-job gate. |
| A3 branch-lag workflow test | `node --test tests/governance/branch-lag-guard.test.mjs` | PASS | 2/2 tests passed after retargeting release-preflight to depend on both branch-lag and governance-gate jobs. |
| A3 deployment safety validator | `node scripts/validators/deployment-safety-validator.mjs` | PASS | Enforces the deploy governance gate, untracked migration rejection, and mobile-bff Turnstile secret wiring. |
| A3 branch-lag validator | `node scripts/validators/branch-lag-guard-validator.mjs` | PASS | Validator accepts the multi-need release-preflight shape and remains wired into the gate. |
| A3 governance-gate mutation | Temporarily changed the production deploy gate command to `--lane=disabled-probe`; ran `node scripts/validators/deployment-safety-validator.mjs`; restored the command. | FAILS AS EXPECTED | Validator failed with `Production deploy workflow missing gated release fragment: node scripts/validate-governance.mjs --lane=gate`. |
| A3 untracked migration mutation | Temporarily added `database/supabase/migrations/999_probe.sql`; ran the workflow guard snippet; deleted the probe. | FAILS AS EXPECTED | Guard failed and printed the probe path before any `db push --include-all` could run. |
| A3 governance gate | `node scripts/validate-governance.mjs --lane=gate` | PASS | 92 validators passed after all A3 probes were reverted. |
| A3 whitespace/status | `git diff --check`; `git status --short` | PASS | No whitespace residue; status showed only intended A3 tracked files after probe deletion. |
| A4/A5 local stop check | `git status --short`; `git rev-parse --short HEAD`; `git rev-list --count main..stepup/main`; `git rev-parse --short origin/main`; `git rev-parse --short origin/develop`; `git rev-parse --verify --short origin/stepup/main` | BLOCKED AT HUMAN SEAM | Local status was clean, HEAD was `8de42903`, local lag was `0`, `origin/main` and `origin/develop` were `41b6ea49`, and `origin/stepup/main` was absent. G4 cannot be truthfully marked green locally. |
| A5 branch-lag monitor validator | `node scripts/validators/branch-lag-guard-validator.mjs` | PASS | Validator now requires the scheduled monitor workflow, manual dispatch, full-history checkout, and `main` vs `stepup/main` enforcement. |
| A5 branch-lag monitor test | `node --test tests/governance/branch-lag-guard.test.mjs` | PASS | 3/3 tests passed, including the scheduled monitor contract. |
| A5 branch-lag monitor mutation | Temporarily changed the monitor cron to `18 * * * *`; ran `node scripts/validators/branch-lag-guard-validator.mjs`; restored the cron. | FAILS AS EXPECTED | Validator failed with `Branch lag monitor workflow must run on a standing schedule and support manual dispatch`. |

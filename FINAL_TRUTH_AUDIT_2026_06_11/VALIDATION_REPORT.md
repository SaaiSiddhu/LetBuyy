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

# 19 — CI Repair and Branch Protection Evidence

**Evidence artifact, not governance authority.**

| Field | Value |
|---|---|
| Date | 2026-08-09 |
| Baseline SHA | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (`bf35062e`) |
| Branch changed | `codex/w0-ci-coverage` |
| Worktree | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-ci-coverage` |
| HEAD after this work | `43671d96dec0d3208f1d7e61261321976282f1e1` |
| Commits | `3a6831da`, `b3025df3`, `43671d96` (local only — **not pushed**, no PR, no deploy) |
| Original repo | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — **untouched** except this file and the raw-evidence files listed below |
| Authority consulted | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` ART-02 (l.151), ART-03 (l.159), R-18 (l.419); root `AGENTS.md` DEPLOY-R1 (l.330), TEST-R8 (l.212) |

## Scope note

Two standing decisions were honoured and **not** touched by this work:

- **Mobile.** `apps/mobile/merchant-app` is `HUMAN_DECISION_REQUIRED`. This document asserts no
  deferral. The `mobile-merchant` job in `ci.yml` and the Flutter steps inside `merge-safety-gate`
  were left exactly as they were, and `mobile-merchant-release.yml` was verified as
  `workflow_dispatch`-only. Nothing here mixes mobile into the Web V1 integration lane.
- **App Bridge.** Owned by the separate urgent task on `codex/emergency-appbridge-killswitch`.
  No App Bridge / app-store / marketplace file was read or modified here. Referenced below only
  as an open escalation.

---

## 1. What was EXECUTED vs INFERRED vs UNVERIFIED

### EXECUTED (commands run, exit codes observed)

| Command | Result |
|---|---|
| `node scripts/validators/workflow-trigger-coverage-validator.mjs` | exit **0** |
| `node --test --test-concurrency=1 tests/ci/*.test.mjs` | **7 pass / 0 fail** |
| js-yaml 4.1.1 parse of all 16 workflow files | **16 PASS, 0 syntax failures** |
| 7 seeded regressions against a scratchpad copy | **7/7 caught, each exit 1** |
| Aggregate-gate shell script, 6 simulated outcome sets | behaves correctly in all 6 |
| `node scripts/validators/{ci-simulation,tooling-governance,test-coverage-governance,meta-no-theater,whole-repo-end-state,branch-lag-guard,deployment-safety,deploy-matrix-topology,production-readiness,architecture,supply-chain,committed-secret-placeholder}-validator.mjs` | all exit **0** |
| `node scripts/validate-governance.mjs --lane=gate` | exit **1** (pre-existing, see §7) |

### INFERRED (read from workflow definitions, not observed on GitHub)

- Which branches each workflow will trigger on. Derived from the parsed `on:` blocks and GitHub's
  documented branch-filter glob semantics (`*` does not cross `/`, `**` does). No GitHub Actions
  run was triggered — nothing was pushed.

### UNVERIFIED (cannot be established from this repository)

- **GitHub branch protection itself remains UNVERIFIED.** Required status checks, required
  reviewers, push restrictions and bypass settings live on github.com, not in `.github/`. No file
  in this repository and no validator in the 109-validator gate can observe them. Confirming them
  needs repo-owner access to the GitHub repository settings. Every checkbox in
  `.github/BRANCH_STRATEGY.md` is now written as **unchecked** and explicitly labelled a
  human-owned seam, because ticking a box that nothing verifies is exactly the governance theatre
  ART-02 forbids.
- Whether `codex/web-v1-integration` exists on `origin`. It exists locally; `git branch -a` shows
  no remote tracking ref. The `ci.yml` trigger is inert until the branch is pushed.
- Whether any CI run actually passes. `ci.yml` will now execute on the integration branch, and the
  independently measured baseline is RED (see §7). This work makes failures **visible**; it does
  not fix them.

---

## 2. Before / after trigger tables

Source of truth: the parsed `on:` blocks. Full machine output in
`artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/19_yaml_syntax_validation.txt`.

### 2.1 `ci.yml` — the required-check lane

| Event | BEFORE (`bf35062e`) | AFTER (`43671d96`) |
|---|---|---|
| `pull_request.branches` | `develop`, `main` | `develop`, `main`, **`stepup/main`**, **`codex/web-v1-integration`** |
| `push.branches` | `develop`, `main` | `develop`, `main`, **`stepup/main`**, **`codex/web-v1-integration`** |

Nothing was removed. `develop` was deliberately retained — see §5.

### 2.2 Per-branch coverage

| Branch | `ci.yml` PR | `ci.yml` push | `architecture-governance.yml` | Auto-deploys? |
|---|---|---|---|---|
| `main` | before: yes · after: yes | before: yes · after: yes | push `main` (unchanged) | `production-deploy.yml` (push), `staging-runtime-deployment.yml` (push, path-scoped) — **unchanged** |
| `stepup/main` | before: **NO** · after: **yes** | before: **NO** · after: **yes** | PR only (path-scoped) | `deploy-staging.yml` (push) — **unchanged** |
| `codex/web-v1-integration` | before: **NO** · after: **yes** | before: **NO** · after: **yes** | push `codex/**` (already covered before) | **none, before and after** |
| other `codex/**` | PR only (path-scoped) | no (unchanged) | push `codex/**` (unchanged) | **none** |
| `develop` (retired) | yes (kept) | yes (kept) | PR only (path-scoped) | none |

The gap this closes: at `bf35062e`, `.github/BRANCH_STRATEGY.md` line 26 named
`ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance` as the required
checks for `stepup/main`, while `ci.yml` lines 3–11 triggered only on `develop` and `main`. The
Web V1 integration branch had **no** unscoped CI lane at all: only the *path-scoped*
`architecture-governance.yml` reached it, so a PR touching, say, only `.github/**`, `tests/**` or
`docs/**` matched none of its 25 path filters and ran nothing.

### 2.3 Deploy lanes — verified NOT reachable from the integration branch

| Workflow | Triggers (unchanged by this work) | Reachable from `codex/web-v1-integration`? |
|---|---|---|
| `production-deploy.yml` | push `main`; `workflow_dispatch` | **no** |
| `production-rollout.yml` | `workflow_dispatch` only | **no** |
| `live-production-certification.yml` | `workflow_dispatch` only | **no** |
| `deploy-staging.yml` | push `stepup/main`; `workflow_dispatch` | **no** |
| `staging-deploy.yml` | `workflow_dispatch` only (push disabled in-file) | **no** |
| `staging-runtime-deployment.yml` | push `main`, `release/**` (path-scoped); `workflow_dispatch` | **no** |
| `mobile-merchant-release.yml` | `workflow_dispatch` only | **no** |
| `hot-table-partition-maintenance.yml` | `schedule`; `workflow_dispatch` | **no** |

**No deploy workflow's triggers were modified.** Production still requires the approved release
path: a push to `main` or a manual dispatch, behind `production-deploy.yml`'s `branch-lag-guard`
job (AGENTS.md DEPLOY-R1, root `AGENTS.md:330`). The new validator now *asserts* all of the above,
so a future edit that points a deploy lane at `codex/**` fails the gate — proven by seeded
regression NEG-2.

---

## 3. The `architecture-governance.yml` fail-fast defect

### Before

```
- Validate governance          <- step 4, hard fail-fast
- Validate design system
  ... 11 more gate steps ...
- Run governance tests         <- never reached when step 4 failed
- Typecheck workspace          <- never reached when step 4 failed
- Generate SBOM
- Dependency audit
```

A single governance failure stopped the job. Typecheck and test results for that commit were
never produced, so the job reported one known-red thing while concealing an unknown number of
others. Given the independently measured baseline (`typecheck` exit 1, `test:behavioral`
33/1576 failing — §7), this workflow has been hiding real failures.

### After

Every one of the 17 gate steps now carries an `id:` and `continue-on-error: true`, so all of them
run and record an outcome. Setup steps (`Checkout`, `Setup Node`, `Install dependencies`) keep
hard fail-fast on purpose: nothing downstream can produce a meaningful result without them.

The job's pass/fail is then re-imposed — **not weakened** — by a final step:

```yaml
- name: Architecture governance gate result
  id: gate-aggregate
  if: always()
  env:
    OUTCOME_VALIDATE_GOVERNANCE: ${{ steps.validate-governance.outcome }}
    ...  # one entry per continue-on-error step, 17 total
  run: |
    ...
    if [ "${value:-missing}" != "success" ]; then failed=1; fi
    ...
    if [ "$failed" -ne 0 ]; then echo "::error::..."; exit 1; fi
```

`outcome` (not `conclusion`) is read, so `continue-on-error` does not launder a failure into a
success. Anything other than `success` — including `failure`, `cancelled`, `skipped`, and an
empty/missing outcome — fails the job.

**Net effect on strictness: strictly greater.** Any commit that failed this job before still fails
it now, and commits whose typecheck/test failures were previously masked now fail too.

A dedicated `Validate workflow trigger coverage` step was also added so the new check runs
independently of the `validate:governance` lane ordering (see the §7 hazard).

### Executed proof

`raw-evidence/19_aggregate_gate_logic_proof.txt` — the aggregate script was extracted verbatim
from the workflow and run under `/bin/bash` with a clean environment:

| Case | Simulated outcomes | Expected | Observed |
|---|---|---|---|
| A | all `success` | pass | **EXIT=0** |
| B | governance `failure` **and** typecheck `failure` (the historically hidden case) | fail, both reported | **EXIT=1**, both printed |
| C | only a late step `failure` | fail | **EXIT=1** |
| D | one outcome empty (step never ran) | fail | **EXIT=1** (`missing`) |
| E | one outcome `skipped` | fail | **EXIT=1** |
| F | no `OUTCOME_*` variables at all | (vacuous pass) | **EXIT=0** — see note |

Note on case F: if the `env:` block were deleted the aggregate would pass vacuously. That is a real
weakness of the shell script in isolation, and it is why the validator asserts that the aggregate
step references `steps.<id>.outcome` for **every** `continue-on-error` step. Seeded regression NEG-3
proves that removing the aggregate (or any of its 17 references) fails the gate.

---

## 4. New verification check

**Validator:** `scripts/validators/workflow-trigger-coverage-validator.mjs`
(gate lane index **74** of **109**; `pnpm run validate:workflow-triggers`;
also an explicit step in `architecture-governance.yml`).

**Test:** `tests/ci/workflow-trigger-coverage.test.mjs`, alongside the existing
`tests/ci/ci-simulation.test.mjs`, and added to `test-coverage-governance-validator.mjs`'s
`requiredTestFiles` so the check cannot be silently deleted.

It parses workflow YAML with a **self-contained reader** — the root workspace declares no YAML
parser and no validator in this repository imports one, so pulling in a transitive `js-yaml` would
have violated `undeclared-import-validator`. The reader's correctness was cross-checked against
real js-yaml (§6).

What it asserts:

1. All 16 workflow files parse, declare `jobs:`, and declare a recognised trigger.
2. `ci.yml` covers `main`, `develop`, `stepup/main`, `codex/web-v1-integration` on **both**
   `pull_request` and `push`, and still defines every required-check job named in
   `BRANCH_STRATEGY.md` (`typecheck`, `lint`, `build`, `unit-tests`, `governance`,
   `merge-safety-gate`, `secret-hygiene`).
3. `architecture-governance.yml` still runs on pushes to `main` and to `codex/**`.
4. No deploying workflow (the 8 in §2.3) is reachable by `push` or `pull_request` from
   `codex/web-v1-integration`, `codex/w0-ci-coverage`, or `codex/emergency-appbridge-killswitch`.
5. `production-deploy.yml` stays `push`-restricted to `main`, never runs on `pull_request`, and
   keeps its `branch-lag-guard` job. `production-rollout.yml` stays dispatch-only.
   `deploy-staging.yml` stays `push`-restricted to `stepup/main`.
6. `environment-lifecycle.yml` — which triggers on `pull_request` for **every** base branch — never
   gains a `push` trigger, and its provider-mutating `bootstrap-staging.mjs --execute` step stays
   gated behind the manual `inputs.deploy_staging`. (See §8 for the residual finding.)
7. `architecture-governance.yml` has ≥12 `continue-on-error` steps, each with an `id`, ending in a
   `gate-aggregate` step that is `if: always()`, is not itself `continue-on-error`, contains
   `exit 1`, and references every tolerant step's `.outcome`.
8. `BRANCH_STRATEGY.md` documents the integration lane and states that GitHub-side branch
   protection is not verifiable from the repository.

### Real run output

```
$ node scripts/validators/workflow-trigger-coverage-validator.mjs
Workflow trigger coverage validator passed (16 workflows parsed; 4 gated branches and 8 deploy lanes checked).
EXIT=0

$ node --test --test-concurrency=1 tests/ci/*.test.mjs
✔ CI workflows contain mandatory enterprise gates (38.448ms)
✔ governed execution paths do not use npm or npx (229.006ms)
✔ workflow trigger coverage validator passes (39.107ms)
✔ ci.yml gates the Web V1 integration branch on pull_request and push (0.229ms)
✔ no deploy workflow triggers from the Web V1 integration branch (0.301ms)
✔ architecture-governance.yml reports every gate step instead of fail-fasting (0.139ms)
✔ every workflow file parses and declares jobs (0.633ms)
ℹ tests 7   ℹ pass 7   ℹ fail 0
```

### Seeded-regression proof (the check is not theatre)

Full output: `raw-evidence/19_seeded_regression_proof.txt`. Each mutation was applied to a
**copy** under the scratchpad; the worktree was never mutated.

| # | Seeded regression | Caught | Message |
|---|---|---|---|
| 1 | drop `codex/web-v1-integration` from `ci.yml` | exit 1 | "ci.yml must gate pull requests targeting …" + push |
| 2 | add `codex/**` to `production-deploy.yml` push | exit 1 | "must not deploy automatically from …" ×3 + "push trigger must be restricted to main" |
| 3 | delete the `gate-aggregate` step | exit 1 | 20 findings incl. every missing `steps.<id>.outcome` |
| 4 | strip all `continue-on-error` (restore fail-fast) | exit 1 | "found 0 continue-on-error steps (expected >= 12)" |
| 5 | corrupt `ci.yml` with tab indentation | exit 1 | "YAML failed to parse … line 269: tab characters" |
| 6 | ungate `environment-lifecycle.yml`'s staging bootstrap | exit 1 | "must stay gated behind the manual deploy_staging input" |
| 7 | strip the integration lane + `UNVERIFIED` from `BRANCH_STRATEGY.md` | exit 1 | both honesty assertions fire |

Baseline re-checked as exit 0 before and after the whole sequence.

---

## 5. `BRANCH_STRATEGY.md` reconciliation — and why this direction

Three conflicts existed between the document and the workflows:

| # | Document claimed | Reality at `bf35062e` | Resolution |
|---|---|---|---|
| 1 | `ci.yml` checks are required for `stepup/main` (l.26) | `ci.yml` never triggered there | **Made CI match the document.** Added `stepup/main` (+ the integration branch) to `ci.yml`. |
| 2 | `develop` is retired; do not use it for required checks (l.9) | `ci.yml` still triggers on `develop` | **Kept the `ci.yml` triggers; corrected the document.** |
| 3 | `main` "must stay aligned with `stepup/main`" (l.5) | `main` is 106 behind `stepup/main`; `origin/main` 291 behind | **Corrected the document** to record the measured lag and name `branch-lag-guard` as the enforcing mechanism. |

**Justification against governance.** The instruction was to pick whichever direction does not
weaken gates.

- For #1, the two candidate fixes were "add the triggers" or "delete the required-check claim".
  Deleting the claim would leave the integration and staging branches ungated — the ART-03 /
  DEPLOY-R1 failure mode in miniature (a branch that cannot be gated cannot be shipped). Adding the
  triggers is the only non-weakening direction, and it is what makes ART-02 / R-18 true again: a
  green gate must actually mean "conforms".
- For #2, deleting `develop` from `ci.yml` would literally *remove* a check. `develop` does not
  currently exist, so the trigger is inert and costs nothing; if the branch were ever recreated the
  trigger keeps it gated by default. Retaining it and correcting the prose is the non-weakening
  direction. (`staging-deploy.yml`'s `develop` push trigger was already disabled in-file and was
  not touched.)
- For #3, no code change can make `main` aligned — that requires a merge, which is a human action
  and explicitly out of scope here (no push, no PR). The honest move is to state the measurement
  and point at the guard that already blocks a production deploy while the lag is non-zero.

The rewritten document also converts every GitHub branch-protection checkbox from `[x]` to `[ ]`
and heads that section **"UNVERIFIED from the repository"**. The previous `[x]` marks asserted a
configuration nothing in the repo had ever observed.

Measured 2026-08-09 in the worktree, local refs only (no fetch, no network):

```
git rev-list --count main..stepup/main           = 106
git rev-list --count origin/main..stepup/main    = 291
git rev-list --count origin/stepup/main..stepup/main = 17
```

---

## 6. YAML validation output

Two independent passes over all 16 workflow files **after** the edits.

**Pass 1 — real YAML parser (js-yaml 4.1.1).** Read-only, resolved from the original repo's
existing `node_modules` (`node_modules/.pnpm/js-yaml@4.1.1/…`); nothing was installed and the
original working tree was not modified.

```
PASS  architecture-governance.yml    push=[main|master|codex/**]      pull_request=[ALL-BRANCHES]
PASS  branch-lag-monitor.yml         push=[-]                         pull_request=[-]
PASS  ci.yml                         push=[develop|main|stepup/main|codex/web-v1-integration]
                                     pull_request=[develop|main|stepup/main|codex/web-v1-integration]
PASS  deploy-staging.yml             push=[stepup/main]               pull_request=[-]
PASS  environment-lifecycle.yml      push=[-]                         pull_request=[ALL-BRANCHES]
PASS  full-security-audit.yml        push=[-]                         pull_request=[-]
PASS  graph-intelligence.yml         push=[ALL-BRANCHES]              pull_request=[ALL-BRANCHES]
PASS  hot-table-partition-maintenance.yml push=[-]                    pull_request=[-]
PASS  lcis-pr-analysis.yml           push=[-]                         pull_request=[ALL-BRANCHES]
PASS  live-production-certification.yml   push=[-]                    pull_request=[-]
PASS  mobile-merchant-release.yml    push=[-]                         pull_request=[-]
PASS  production-deploy.yml          push=[main]                      pull_request=[-]
PASS  production-rollout.yml         push=[-]                         pull_request=[-]
PASS  security-review.yml            push=[-]                         pull_request=[ALL-BRANCHES]
PASS  staging-deploy.yml             push=[-]                         pull_request=[-]
PASS  staging-runtime-deployment.yml push=[main|release/**]           pull_request=[-]
---
files=16 syntax_failures=0 parser=js-yaml@4.1.1
```

**Pass 2 — the validator's own reader**, cross-checked against js-yaml on all 16 files before the
edits. `on:` and `jobs:` structures matched **exactly** on 11 files; the 5 differences were purely
scalar typing inside `workflow_dispatch.inputs` (`true` vs `"true"`), a region the validator never
inspects. Boolean/null coercion was subsequently added to the reader. No branch list, path list,
trigger key or job name differed on any file.

`ALL-BRANCHES` above means the trigger declares no `branches:` filter and therefore fires for every
branch — that is how `architecture-governance.yml`, `security-review.yml`, `lcis-pr-analysis.yml`
and `environment-lifecycle.yml` already covered integration-branch PRs, subject to their path
filters.

---

## 7. Pre-existing RED state — remeasured, not copied

Per the deliverable rule, no prior percentage or pass/fail claim is carried forward.

**Remeasured in this clean worktree at `bf35062e`:**

```
$ node scripts/validate-governance.mjs --lane=gate
Foundation anti-fabrication gate passed (1905 active source files scanned; 0 temporary entries tracked).
Tenant isolation validator failed:
- services/api-gateway/src/tenant/tenant-tables.registry.ts must match schema-derived tenant table
  registry; run scripts/generators/generate-tenant-table-registry.mjs
GATE_EXIT=1
```

**This differs from the Phase 1 finding and the difference matters.** Phase 1 recorded the gate
dying at validator **#6** (`validate-design-system.mjs`). In a *clean* checkout of `bf35062e` it
dies at validator **#2** (`tenant-isolation-validator.mjs`). The Phase 1 measurement was taken in
the original working tree, which carries ~~777~~ **99** **[CORRECTED 2026-08-09 — see `30_CORRECTIONS_AND_STASH_HAZARD.md` §1.1: the 678 "binary content changes" in the 777 figure are mode-only `100644→100755` flips on byte-identical blobs, 678/678 verified; they are not content changes. The argument in this paragraph is unaffected — a regenerated tenant-table registry is one of the 99 textual changes either way.]** real uncommitted content changes — including, evidently,
a regenerated tenant-table registry. **The committed baseline is worse than the working tree.** Both
numbers are honest measurements of different trees; neither should be quoted without saying which.

Either way the fail-fast at `scripts/validate-governance.mjs:201-203` means the remaining 107
validators — including the new one at index 74 — **do not run today**. Repairing that is the
validator-execution task's surface, not this one. Two mitigations were applied here so this work is
not dependent on it:

- `pnpm run validate:workflow-triggers` runs the new check standalone.
- `architecture-governance.yml` runs it as its own step, and (post-fix) that step's result is
  reported even when `validate:governance` fails.

**Consequence of the trigger repair that must be stated plainly:** independently measured at
baseline, `pnpm run lint` exits 1, `pnpm run typecheck` exits 1, `test:behavioral` fails 33/1576 and
`test:contracts` fails 13/200. Turning on `ci.yml` for `stepup/main` and `codex/web-v1-integration`
will therefore produce **red CI on those branches immediately**. That is the correct and intended
outcome — the failures already existed and were merely unobserved. Nothing here was weakened to make
CI go green.

**Ordering hazard, unresolved by design.** `scripts/validate-governance.mjs` invokes
`removeGeneratedArtifactDirectories()` (an `fs.rmSync` sweep of `node_modules`, `.next`, `dist`,
`build`, `coverage`, … under `apps/`, `packages/`, `services/`) immediately before
`stale-artifact-validator.mjs` at gate index **71**. The new validator sits at index **74**, i.e.
*after* that sweep. It is not affected today (the gate dies at #2), but whoever repairs the fail-fast
must handle the `rmSync` step before the full lane runs locally. Flagged, not touched.

---

## 8. Open findings and escalations

1. **GitHub branch protection is UNVERIFIED** and needs repo-owner access. Until someone confirms
   the required-status-check configuration on github.com, the `ci.yml` triggers added here make CI
   *run*, but nothing makes a merge *wait* for it. **This is the single biggest residual gap in
   this task's surface.** Recorded as unchecked boxes in `.github/BRANCH_STRATEGY.md`.
2. **`environment-lifecycle.yml` runs on pull requests to every base branch** (path-scoped, no
   `branches:` filter) and its `Seed staging data` and `Run staging E2E` steps are **not** gated
   behind an input — only the provider-mutating `bootstrap-staging.mjs --execute` step is. This is
   pre-existing behaviour, unchanged by this work, and it applies equally to PRs into `main` today.
   It touches staging, never production. The new validator pins the bootstrap gate so it cannot
   regress. **Recommend a human decision on whether staging seeding should run from integration-branch
   PRs at all** — changing its trigger would alter an existing gate's scope, which is beyond this
   task's mandate.
3. **`main` is 106 commits behind `stepup/main`** (291 behind on `origin`), and `origin/stepup/main`
   is 17 behind local. Documented in `BRANCH_STRATEGY.md`; the merge is a human action.
   ART-03 / DEPLOY-R1 keystone — still open.
4. **`codex/web-v1-integration` has no remote.** The triggers added here are inert until it is
   pushed. No push was performed.
5. **App Bridge** — open escalation, owned by `codex/emergency-appbridge-killswitch`. Untouched here.
6. **`apps/mobile/merchant-app`** — `HUMAN_DECISION_REQUIRED`. No deferral asserted; mobile jobs in
   `ci.yml` left unchanged and not routed into the Web V1 integration lane.

---

## 9. Files changed (all in the worktree, local commits only)

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | +8 lines: `stepup/main` and `codex/web-v1-integration` added to both trigger branch lists, plus a comment recording why `develop` stays |
| `.github/workflows/architecture-governance.yml` | +86 lines: `id:` + `continue-on-error:` on 17 gate steps, new `validate-workflow-triggers` step, new `gate-aggregate` step |
| `.github/BRANCH_STRATEGY.md` | rewritten to match the workflows; adds the trigger-coverage table, the "Known reality gaps" section, and the UNVERIFIED branch-protection section |
| `scripts/validators/workflow-trigger-coverage-validator.mjs` | **new**, 594 lines |
| `tests/ci/workflow-trigger-coverage.test.mjs` | **new**, 100 lines |
| `scripts/validate-governance.mjs` | +1 line: validator wired into the gate lane (108 → 109) |
| `package.json` | +1 line: `validate:workflow-triggers` script |
| `scripts/validators/README.md` | +1 line: documents the new validator |
| `scripts/validators/test-coverage-governance-validator.mjs` | +1 line: new test file made mandatory |

No secret-shaped value was added to any workflow. No generated artifact was committed.
Nothing was pushed, no PR was opened, no deploy was triggered, and no Supabase or provider command
was run from any directory.

## 10. Raw evidence

`/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/`

- `19_validator_run.txt` — validator output + exit code
- `19_tests_ci.txt` — full `node --test tests/ci/*.test.mjs` output
- `19_yaml_syntax_validation.txt` — js-yaml 4.1.1 parse of all 16 workflows
- `19_seeded_regression_proof.txt` — the 7 seeded regressions
- `19_aggregate_gate_logic_proof.txt` — the aggregate script and its 6 executed cases

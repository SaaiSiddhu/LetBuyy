# 09 — CI Branch Coverage Audit

**Status:** Evidence artifact — NOT governance authority. Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, and local `AGENTS.md` files.
**Agent:** Agent E — CI and Validator Truthfulness Auditor (Wave 0, Phase 1, read-only)
**Repo SHA at audit time:** `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (HEAD)
**Branch:** `stepup/main`
**Timestamp used:** 2026-08-09 (literal date supplied by the task; system date not queried)
**Working tree at audit time:** dirty (`git status --short` showed a large number of pre-existing `M` entries before this audit touched anything — not caused by this audit; this audit wrote only new files under `docs/launch/...` and `artifacts/local-operational-proof/...`)

## What was executed vs. inferred

- **Executed:** `git branch -a`, `git log`, `git merge-base --is-ancestor`, `rg --files .github/workflows`, `gh auth status`, `gh api .../permissions`, `gh api .../rulesets`, `gh api .../branches/{b}/protection` (x3), full read of every `.github/workflows/*.yml` `on:` block, full read of `ci.yml`, `deploy-staging.yml`, `architecture-governance.yml`, partial read of `security-review.yml` / `lcis-pr-analysis.yml`, and `.github/BRANCH_STRATEGY.md`.
- **Inferred (from static YAML, not from a live GitHub Actions run):** which workflows would actually fire for a given push/PR. GitHub Actions trigger semantics used: a `pull_request:`/`push:` block with no `branches:`/`branches-ignore:` key applies to **all** target branches; a block with `branches:` applies only to the listed branches. This is documented GitHub Actions behavior, not repo-specific guesswork.
- **Unverified:** actual GitHub branch protection / required-status-check configuration (see "Branch protection" section — the token available in this session cannot see it, so BRANCH_STRATEGY.md's protection claims are cross-checked but not confirmed or refuted from the GitHub side).

---

## 1. Workspace / branch topology (independently verified)

```
$ git branch --show-current          → stepup/main
$ git rev-parse HEAD                 → bf35062eda22f4d881efd61fb1d36c8fc83baed1
$ git log -1 origin/develop          → c2547049c0b5666661536d076046415714fb7d03 (2026-06-09)
$ git log -1 origin/main             → c2547049c0b5666661536d076046415714fb7d03 (2026-06-09)  [IDENTICAL to origin/develop]
$ git log -1 origin/stepup/main      → 7530572521952939cff017ce32b5d58adeec3bd7 (2026-08-01)
$ git merge-base --is-ancestor origin/develop origin/main → true (develop is an ancestor of / identical to main)
$ git log origin/main..origin/stepup/main --oneline | wc -l → 274
$ git log origin/stepup/main..origin/main --oneline | wc -l → 0
```

**Finding F-09-01 (high):** `origin/main` and `origin/develop` are pinned at the *same* commit (`c254704`, 2026-06-09) and are **274 commits behind** `origin/stepup/main` (last commit `7530572`, 2026-08-01). All real work for roughly two months has landed on `stepup/main`. `main` has 0 commits not on `stepup/main` — it has not diverged, it is simply stale.

No `codex/web-v1-integration` branch exists yet (`git branch -a` / `git ls-remote` show none). This is expected per the task brief — it is a later Wave 0 deliverable — and is recorded here only as current-state fact, not a defect.

## 2. Full workflow inventory — parsed `on:` triggers

Raw parsed trigger blocks for all 16 workflow files are persisted verbatim at
`artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-e/workflow-triggers-raw.txt`.

| Workflow file | `push` branches | `pull_request` branches | `pull_request` paths (scoped?) | `schedule` | `workflow_dispatch` |
|---|---|---|---|---|---|
| `architecture-governance.yml` | `main`, `master`, `codex/**` | **(none — all branches)** | yes, broad (`apps/**`, `services/**`, `packages/**`, `database/**`, `config/**`, `infrastructure/**`, `docs/governance/**`, `scripts/**` subpaths, `AGENTS.md`, `**/AGENTS.md`, `**/runtime.manifest.json`, `package.json`, `pnpm-workspace.yaml`, `.github/CODEOWNERS`, 4 specific workflow files) | — | — |
| `branch-lag-monitor.yml` | — | — | — | `17 * * * *` (hourly) | yes |
| `ci.yml` | `develop`, `main` | `develop`, `main` | no (all paths) | — | — |
| `deploy-staging.yml` | `stepup/main` | — | — | — | yes |
| `environment-lifecycle.yml` | — | **(none — all branches)** | yes, narrow (`config/runtime/environment-lifecycle.json`, `config/runtime/rollout-lifecycle.json`, `config/runtime/operational-certification-policy.json`, `scripts/staging/**`, `infrastructure/scripts/load/**`, `scripts/validators/operational-lifecycle-validator.mjs`, `package.json`, own workflow file) | — | yes (`deploy_staging` boolean input) |
| `full-security-audit.yml` | — | — | — | `30 4 * * 1` (Mon 04:30 UTC) | yes |
| `graph-intelligence.yml` | (paths only, all branches) | **(none — all branches)** | yes, narrow (`database/supabase/migrations/**`, `services/api-gateway/src/**`, `tools/graph-server/**` for push; first two for PR) | — | yes |
| `hot-table-partition-maintenance.yml` | — | — | — | `15 2 1 * *` (monthly) | yes (environment + execute inputs) |
| `lcis-pr-analysis.yml` | — | **(none — all branches)** | no (all paths) | — | — |
| `live-production-certification.yml` | — | — | — | — | yes only |
| `mobile-merchant-release.yml` | — | — | — | — | yes only |
| `production-deploy.yml` | `main` | — | — | — | yes |
| `production-rollout.yml` | — | — | — | — | yes only |
| `security-review.yml` | — | **(none — all branches)** | no (all paths) | — | — |
| `staging-deploy.yml` | — (push trigger explicitly disabled, see comment) | — | — | — | yes only |
| `staging-runtime-deployment.yml` | `main`, `release/**` | — | yes, narrow (`services/api-gateway/**`, `services/mobile-bff/**`, `services/queue-workers/**`, `services/webhook-service/**`, `infrastructure/cloudflare/**`, `infrastructure/scripts/**`, `config/runtime/**`, `scripts/validators/**`, own workflow file) | — | yes (execute boolean) |

## 3. What actually protects each branch today

### `main`
- `push` to `main`: `architecture-governance.yml` (path-scoped), `ci.yml` (unconditional), `production-deploy.yml` (deploy pipeline, includes its own `branch-lag-guard` + `governance-gate` jobs — see doc 10), `staging-runtime-deployment.yml` (path-scoped).
- `pull_request` **into** `main`: `ci.yml` (unconditional — typecheck/secret-hygiene/lint/unit-tests/merge-safety-gate/governance/mobile-merchant/build jobs), plus the three branch-agnostic PR workflows (`architecture-governance.yml` path-scoped, `lcis-pr-analysis.yml`, `security-review.yml`).
- Currently moot in practice: `main` has received no new commits since 2026-06-09 (see §1) while `stepup/main` has advanced 274 commits, so these gates have not exercised any of the last two months of work.

### `develop`
- Identical trigger coverage to `main` for `ci.yml` (both are listed together) and for `architecture-governance.yml`'s push trigger it is **not** listed (`architecture-governance.yml` push branches are `main`/`master`/`codex/**` only, not `develop`).
- **Finding F-09-02 (conflict — see §5):** `develop` still exists as a live GitHub-tracked branch (`origin/develop`, same SHA as `origin/main`) and `ci.yml` still actively lists it as a first-class protected branch, while `.github/BRANCH_STRATEGY.md` (§ "Rules" / "Retired `develop`") calls it "retired/stale... Do not target new PRs, staging deploys, or required checks here" and carries an open action item to remove it from active workflows.

### `stepup/main`
- `push` to `stepup/main`: **only** `deploy-staging.yml` (governance-gate job runs `node scripts/validate-governance.mjs --lane=gate`, then deploy jobs) and `architecture-governance.yml`'s **push** trigger does **not** include `stepup/main` (only `main`/`master`/`codex/**`), so a direct push to `stepup/main` gets exactly one governance check (the deploy-staging governance-gate) and no lint/typecheck/unit-test/build coverage from any push-triggered workflow.
- `pull_request` **into** `stepup/main`: `ci.yml` does **not** fire (its `pull_request.branches` list is `[develop, main]` only — `stepup/main` is absent). The three branch-agnostic PR workflows do fire when applicable: `architecture-governance.yml` (path-scoped, but its path list is broad enough to cover almost all real source changes — `apps/**`, `services/**`, `packages/**`, etc. — and its job *does* run `pnpm run validate:governance`, `validate:design-system`, `pnpm run test`, and `pnpm run typecheck`, see doc 10 §2), `lcis-pr-analysis.yml` (informational/advisory, posts a PR comment, does not gate merge), `security-review.yml` (explicitly self-documented as "ADDITIVE... advisory security signal", non-blocking).
- **Finding F-09-03 (high — the central branch-coverage gap):** the workflow literally named `ci.yml`, whose job names (`typecheck`, `lint`, `unit-tests`, `governance`, `build`, `merge-safety-gate`, `mobile-merchant`) match verbatim the "Required checks" list in `.github/BRANCH_STRATEGY.md` for `stepup/main` (`ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`), **never triggers for `stepup/main`** — not on push, not on pull_request. `stepup/main` is entirely absent from `ci.yml`'s trigger list (`.github/workflows/ci.yml:4-11`).
- Consequence independently confirmed by content diff, not just trigger inspection: `architecture-governance.yml`'s job (which *does* cover PRs into `stepup/main`) never runs the full ESLint pass (`pnpm run lint` / `turbo lint`) — it only runs `pnpm run lint:css` (stylelint) — and never runs `pnpm run build` (`turbo build`) at all. Both of those are jobs named explicitly in `ci.yml` and in `BRANCH_STRATEGY.md`'s required-check list, and neither exists in any workflow that fires for `stepup/main`. This matches — and independently confirms with a second source — the caveat already stated in this repo's own `CLAUDE.md`: "the gate does NOT cover app `next build`."

### Pull requests generally (any target branch)
- `lcis-pr-analysis.yml` and `security-review.yml` fire for every PR regardless of target branch (`types: [opened, synchronize, reopened]`, no `branches:` key). Both are explicitly advisory/non-blocking by their own workflow comments (`security-review.yml:7` calls itself "ADDITIVE... This job is advisory security signal"; `lcis-pr-analysis.yml:3-4` calls itself "Read-only LCIS analysis... LCIS never mutates the repo").
- `architecture-governance.yml`'s `pull_request` trigger also fires for every PR regardless of target branch, gated only by the path list in §2.

## 4. Branch protection — attempted independent verification (inconclusive)

```
$ gh auth status         → logged in as account "Papa-Escola" (NOT the repo owner "SaaiSiddhu")
$ gh api repos/SaaiSiddhu/Letbuyy_Store -q '.permissions'
  → {"admin":false,"maintain":false,"pull":true,"push":false,"triage":false}
$ gh api repos/SaaiSiddhu/Letbuyy_Store/rulesets
  → []
$ gh api repos/SaaiSiddhu/Letbuyy_Store/branches/main/protection            → 404 Not Found
$ gh api repos/SaaiSiddhu/Letbuyy_Store/branches/stepup%2Fmain/protection   → 404 Not Found
$ gh api repos/SaaiSiddhu/Letbuyy_Store/branches/develop/protection         → 404 Not Found
```
Full output: `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-e/github-branch-protection-check.log`

- The repository **rulesets** endpoint (readable with pull-only access, no special permission required) returned an empty array — this **does confirm** there are no repository-wide rulesets (the modern branch-protection mechanism) configured.
- The **classic** branch-protection endpoint returned 404 for all three branches. This is consistent with "no classic protection configured," but the authenticated token has `push:false` / `admin:false` on this repository (it is a different account than the repo owner), and GitHub's classic-protection read endpoint can also 404 for a token that lacks sufficient access even when protection *is* configured. **This audit cannot distinguish the two cases with the credentials available in this session — recorded as unverified, not as a confirmed absence.**
- **Finding F-09-04 (conflict, contingent on protection actually being configured as documented):** `.github/BRANCH_STRATEGY.md` states required checks for `stepup/main` are `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance` (i.e., the job names from `ci.yml`). Given F-09-03 above (`ci.yml` never triggers for `stepup/main`), **if** GitHub branch protection is actually configured exactly as the document describes, PRs into `stepup/main` would show those five checks as perpetually "Expected — waiting for status to be reported" and could never merge without an admin bypass — because the workflow that reports those checks never runs against that branch. This is a logical consequence of the trigger configuration verified in §3, independent of whether protection is actually turned on.
- `.github/BRANCH_STRATEGY.md` also states "Never push directly to `main` or `stepup/main`" and "Require a pull request before merging" for `stepup/main`. This audit did not attempt to enumerate whether the 274 commits on `stepup/main` beyond `main` arrived via merge commits (PRs) or direct pushes, since that would require the GitHub PR API (also inaccessible with the current token's permission level) or a full commit-graph merge-topology walk beyond this audit's time budget. **Recorded as unverified**, not confirmed either way.

## 5. Documented conflicts (per instructions: recorded, not resolved by this agent)

1. **`ci.yml` vs `.github/BRANCH_STRATEGY.md`:** the branch-strategy document's required-check list for `stepup/main` names checks that live in a workflow (`ci.yml`) which does not trigger for that branch at all (F-09-03, F-09-04).
2. **`ci.yml` vs `.github/BRANCH_STRATEGY.md`'s "Retired `develop`" section:** the document says `develop` should not have "required checks" targeting it and flags removing it as an open, human-owned action item; `ci.yml` still lists `develop` as a fully active, first-class protected branch alongside `main` (F-09-02).
3. **`.github/BRANCH_STRATEGY.md`'s description of `main`** ("production pointer... must stay aligned with `stepup/main` until the final remote promotion is completed") **vs. observed reality:** `main` is 274 commits behind `stepup/main`, i.e., not aligned (F-09-01). Whether this counts as a "conflict" or an accurately-labeled known gap depends on whether "must stay aligned" is read as a current invariant or an aspirational target; recorded here as a discrepancy for a human to adjudicate.
4. **`security-review.yml`'s own comment says "107-validator governance gate"** (`.github/workflows/security-review.yml:7`) while this audit's independent count of `scripts/validate-governance.mjs`'s `validators` array is **108** entries for the `gate` lane (109 total including the 1 `report`-lane-only validator). See doc 10 for the count methodology. This is a stale in-repo comment, not a functional defect, but it is exactly the kind of "prior count that should not be trusted" the task brief warned about — independently reproduced here.

## 6. Raw evidence index

- `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-e/workflow-triggers-raw.txt` — every workflow's parsed `on:` block, mechanically extracted.
- `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-e/github-branch-protection-check.log` — `gh` auth/permissions/rulesets/protection queries, full output.
- Direct file reads (not re-captured as separate logs, cited inline above with line numbers): `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/architecture-governance.yml`, `.github/workflows/security-review.yml`, `.github/workflows/lcis-pr-analysis.yml`, `.github/BRANCH_STRATEGY.md`.

## What remains unverified

- Real GitHub branch protection / required-status-check state (§4) — needs a token with admin or repo-owner access, or a manual check of the GitHub UI by a human with access.
- Whether the 274 commits on `stepup/main` ahead of `main` arrived via PR-and-merge (as `BRANCH_STRATEGY.md` mandates) or via direct push — needs GitHub PR API access or a merge-topology walk this audit did not perform.
- Whether `codex/web-v1-integration` will inherit `architecture-governance.yml`'s push coverage once created (it would, since its push-trigger path list includes `codex/**` — noted as a forward-looking observation, not verified against a real branch since none exists yet).

# LetBuyy Branch Strategy

Authority: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-02, ART-03) > root `AGENTS.md` (DEPLOY-R1, TEST-R8) > this document.

This document describes what the workflows in `.github/workflows/` actually do. Where a claim
here is not machine-checkable from the repository, it is marked **UNVERIFIED** and named as a
human-owned seam. `scripts/validators/workflow-trigger-coverage-validator.mjs` enforces the
in-repo half of this document on every governance run.

## Branches

- `main` - production pointer. Protected. No direct push. `production-deploy.yml` triggers only
  from `main` (push) or manual dispatch, behind the `branch-lag-guard` job.
- `stepup/main` - repository-side integration and staging branch for the converged reality.
  `deploy-staging.yml` deploys staging from a push to this branch, behind its governance gate.
- `codex/web-v1-integration` - the Web V1 integration branch. Gated, **never deploying**.
  No deploy workflow (`production-deploy.yml`, `production-rollout.yml`,
  `live-production-certification.yml`, `deploy-staging.yml`, `staging-deploy.yml`,
  `staging-runtime-deployment.yml`, `mobile-merchant-release.yml`) triggers from it.
- `codex/*` - short-lived agent/work branches off `stepup/main`. Merge back via PR.
  `architecture-governance.yml` runs on every push to `codex/**`.
- `feature/*` - short-lived. Branch off `stepup/main`. Merge back to `stepup/main` via PR.
- `hotfix/*` - branch off `main`. PR to `main` and then fast-forward `stepup/main` to the same commit.
- `develop` - retired/stale branch name. Do not target new PRs, staging deploys, or required
  checks here. Its `ci.yml` triggers are deliberately **retained** as a fail-safe: if `develop`
  is ever recreated it stays gated by default. Removing the triggers would weaken an existing
  gate, which ART-02 / R-18 forbid. `staging-deploy.yml` has its `develop` push trigger disabled.

## Rules

- Every PR to `stepup/main`, `codex/web-v1-integration`, or `main` must pass all CI gates before merge.
- PRs to `main` require all CI gates, E2E on staging, and one approver.
- Squash merge only on `main`. Merge commits are allowed on `stepup/main`.
- Never push directly to `main` or `stepup/main`.
- Production deploys only from `main` (push) or manual `workflow_dispatch`, and only after the
  `branch-lag-guard` job proves `main` is not behind `stepup/main` (AGENTS.md DEPLOY-R1).

## Workflow trigger coverage (source of truth: `.github/workflows/`)

| Branch | `ci.yml` (PR) | `ci.yml` (push) | `architecture-governance.yml` | Deploys? |
|---|---|---|---|---|
| `main` | yes | yes | yes (push `main`) | `production-deploy.yml` (push), `staging-runtime-deployment.yml` (push, path-scoped) |
| `stepup/main` | yes | yes | PR only (path-scoped) | `deploy-staging.yml` (push) |
| `codex/web-v1-integration` | yes | yes | yes (push `codex/**`) | **no** |
| other `codex/**` | PR only (path-scoped) | no | yes (push `codex/**`) | **no** |
| `develop` (retired) | yes | yes | PR only (path-scoped) | **no** |

`ci.yml` jobs: `typecheck`, `secret-hygiene`, `lint`, `unit-tests`, `merge-safety-gate`,
`governance`, `mobile-merchant`, `build`.

## Known reality gaps (do not paper over)

- **`main` is not aligned with `stepup/main`.** Measured 2026-08-09 at `ee371182`: `main` is
  106 commits behind `stepup/main` locally and `origin/main` is 291 behind. The alignment claim
  previously carried by this document was false. `production-deploy.yml`'s `branch-lag-guard`
  job is the enforcing mechanism (it fails the release when the lag is non-zero); the
  outstanding merge is a human-owned action, tracked as a launch blocker, not a documentation fix.
- **`origin/stepup/main` is 17 commits behind local `stepup/main`.** Nothing in CI can observe
  unpushed local commits.
- **The `develop` retirement is only half done.** `staging-deploy.yml` has its push trigger
  disabled; `ci.yml` deliberately keeps `develop` for the fail-safe reason above.

## GitHub Branch Protection Settings — **UNVERIFIED from the repository**

Branch protection lives on github.com, not in this repository. Nothing in `.github/` can prove
that these rules are configured, and no validator in this repository asserts them. Every box
below is a **human-owned seam requiring repo-owner access to confirm.** Configure manually in
the GitHub UI and record the confirmation in the launch evidence set.

### For `stepup/main`

- [ ] Require a pull request before merging.
- [ ] Require status checks to pass before merging.
- [ ] Required checks: `CI / Typecheck`, `CI / Lint`, `CI / Build`, `CI / Unit tests`,
      `CI / Governance`, `CI / Merge safety gate`, `CI / Secret hygiene`.
- [ ] Require branches to be up to date before merging.
- [ ] Do not allow bypassing the above settings.

### For `codex/web-v1-integration`

- [ ] Require a pull request before merging.
- [ ] Require status checks to pass before merging.
- [ ] Required checks: `CI / Typecheck`, `CI / Lint`, `CI / Build`, `CI / Unit tests`,
      `CI / Governance`, `CI / Merge safety gate`, `CI / Secret hygiene`,
      `Architecture Governance / validate-architecture`.
- [ ] Do not allow bypassing the above settings.

### For `main`

- [ ] Require a pull request before merging.
- [ ] Require at least one approving review.
- [ ] Require status checks to pass before merging.
- [ ] Required checks: the `stepup/main` set plus `staging-e2e / playwright`.
- [ ] Require branches to be up to date before merging.
- [ ] Restrict who can push to matching branches.
- [ ] Do not allow bypassing the above settings.

### Retired `develop`

- [ ] Remove active deploy, required-check, and PR targeting rules after the protected remote is
      promoted. This is a human-owned branch-protection seam; do not reintroduce `develop` as an
      active integration branch, and do not remove its `ci.yml` fail-safe triggers.

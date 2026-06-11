# LetBuyy Branch Strategy

## Branches

- `main` - production pointer. Protected. No direct push. Must stay aligned with `stepup/main` until the final remote promotion is completed.
- `stepup/main` - repository-side integration and staging branch for the converged reality.
- `feature/*` - short-lived. Branch off `stepup/main`. Merge back to `stepup/main` via PR.
- `hotfix/*` - branch off `main`. PR to `main` and then fast-forward `stepup/main` to the same commit.
- `develop` - retired/stale branch name. Do not target new PRs, staging deploys, or required checks here.

## Rules

- Every PR to `stepup/main` or `main` must pass all CI gates before merge.
- PRs to `main` require all CI gates, E2E on staging, and one approver.
- Squash merge only on `main`. Merge commits are allowed on `stepup/main`.
- Never push directly to `main` or `stepup/main`.

## GitHub Branch Protection Settings

Configure these manually in GitHub UI.

### For `stepup/main`

- [x] Require a pull request before merging.
- [x] Require status checks to pass before merging.
- [x] Required checks: `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`.
- [x] Require branches to be up to date before merging.
- [x] Do not allow bypassing the above settings.

### For `main`

- [x] Require a pull request before merging.
- [x] Require at least one approving review.
- [x] Require status checks to pass before merging.
- [x] Required checks: `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`, `staging-e2e / playwright`.
- [x] Require branches to be up to date before merging.
- [x] Restrict who can push to matching branches.
- [x] Do not allow bypassing the above settings.

### Retired `develop`

- [ ] Remove active deploy, required-check, and PR targeting rules after the protected remote is promoted. This is tracked as a human-owned branch-protection seam; do not reintroduce `develop` as an active integration branch.

# LetBuyy Branch Strategy

## Branches

- `main` - production. Protected. No direct push. PR from `develop` only.
- `develop` - staging. Protected. No direct push. PR from `feature/*` branches.
- `feature/*` - short-lived. Branch off `develop`. Merge back to `develop` via PR.
- `hotfix/*` - branch off `main`. PR to `main` and back-port PR to `develop`.

## Rules

- Every PR to `develop` or `main` must pass all CI gates before merge.
- PRs to `main` require all CI gates, E2E on staging, and one approver.
- Squash merge only on `main`. Merge commits are allowed on `develop`.
- Never push directly to `main` or `develop`.

## GitHub Branch Protection Settings

Configure these manually in GitHub UI.

### For `develop`

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

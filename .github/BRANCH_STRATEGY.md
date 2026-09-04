# LetBuyy Branch Strategy

Authority: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-02, ART-03) > root `AGENTS.md` (DEPLOY-R1, TEST-R8) > OWNER_DECISION D-BRANCH / D-DEPLOY (2026-09-04, recorded in `.claude/skills/letbuyy/references/decisions.md`) > this document.

This document describes what the workflows in `.github/workflows/` actually do. Where a claim
here is not machine-checkable from the repository, it is marked **UNVERIFIED** and named as a
human-owned seam. `scripts/validators/workflow-trigger-coverage-validator.mjs`,
`deployment-safety-validator.mjs`, `branch-lag-guard-validator.mjs` and
`branch-dispositions-validator.mjs` enforce the in-repo half of this document on every governance run.
The operating procedure (claims, merges, promotions, the loop) is `.claude/skills/letbuyy/SKILL.md`.

## Branches (OWNER_DECISION D-BRANCH, 2026-09-04)

- `main` - production pointer. Moves **only** by fast-forward promotion from `staging`
  (`git fetch . staging:main`), with the owner's word in the same message before any push. Never a
  merge commit, never a direct commit, never a hotfix commit. `production-deploy.yml` is
  **`workflow_dispatch` only** until a DEPLOY-1 phase retargets it with verified cloud targets
  (D-DEPLOY); when a push trigger returns it must be restricted to `main`, behind the
  `branch-lag-guard` job (`main` not behind `origin/staging`).
- `staging` - cloud pre-production. Moves only by fast-forward promotion from `develop`
  (`git fetch . develop:staging`), owner's word before any push. `deploy-staging.yml` is
  **`workflow_dispatch` only** until DEPLOY-1; it will then trigger on `staging`, behind its
  governance gate.
- `develop` - integration and local end-to-end. Receives `--no-ff` merges of phase branches,
  performed inside the `develop` worktree (`.claude/skills/letbuyy/references/merge.md`), plus ledger
  bookkeeping commits. Pushing `develop` is how cloud signal (`ci.yml`) is obtained before promotion.
- `letbuyy/<id>-<slug>` - one bounded phase. Its first commit is the claim row in
  `docs/active/BRANCH_DISPOSITIONS.md`; it merges only into `develop`; its worktree is removed after
  the merge. Never pushed.
- `stepup/main` - the former integration/staging branch, now a **preserved alias**
  (`LEGACY_INTEGRATED`): never advanced, never deleted. Its `ci.yml` triggers are retained as a
  fail-safe (ART-02 / R-18: removing a gate weakens it), exactly as `develop`'s were while it was retired.
- `feature/claude-md-durable-architecture-memory` - the primary checkout's frozen work surface,
  integrated into `develop` at `823aa5ee`. Commits landing on it afterwards are unintegrated until they
  travel through a phase branch.
- `codex/web-v1-integration`, `codex/*` - gated, **never deploying**; historical Web V1 lanes.
  `architecture-governance.yml` still runs on every push to `codex/**`.
- `hotfix/*` - no special path: a hotfix is a phase branch that merges into `develop` and is
  promoted `develop` → `staging` → `main`, faster.

Fast-forward-only promotion means **the SHA tested on `develop` is the SHA that reaches `staging`,
and the SHA soaked on `staging` is the SHA that reaches `main`.**

## Rules

- Every phase claims its row before its first implementation commit; every merge into `develop`
  runs the first-parent diff and the resurrection check; every promotion is a fast-forward or it is
  refused and the divergence is classified (`MERGE_RUNBOOK.md` §Divergence).
- Never push `staging` or `main` without the owner's word in the same message. Never deploy.
- Production deploys only from `main` (dispatch today; push to `main` only after DEPLOY-1), and only
  after the `branch-lag-guard` job proves `main` is not behind `staging` (AGENTS.md DEPLOY-R1 as
  amended by D-BRANCH).
- Never widen a workflow's `permissions:`; never add a deploy trigger to any branch other than
  `staging` (staging lanes) or `main` (production lanes); never reintroduce a `letbuyy.store` literal.

## Workflow trigger coverage (source of truth: `.github/workflows/`, measured 2026-09-04)

| Branch | `ci.yml` (PR) | `ci.yml` (push) | `architecture-governance.yml` | Deploys? |
|---|---|---|---|---|
| `main` | yes | yes | yes (push `main`) | `production-deploy.yml` **dispatch only**; `staging-runtime-deployment.yml` push is plan-only (path-scoped) |
| `staging` | yes | yes | PR only (path-scoped) | `deploy-staging.yml` **dispatch only** (push on `staging` after DEPLOY-1) |
| `develop` | yes | yes | PR only (path-scoped) | **no** |
| `stepup/main` (alias) | yes (fail-safe) | yes (fail-safe) | PR only (path-scoped) | **no** |
| `codex/web-v1-integration` | yes | yes | yes (push `codex/**`) | **no** |
| other `codex/**` | PR only (path-scoped) | no | yes (push `codex/**`) | **no** |
| `letbuyy/*` | no (never pushed) | no | no | **no** |

`ci.yml` jobs: `typecheck`, `secret-hygiene`, `lint` (includes `lint:css`), `unit-tests`,
`merge-safety-gate`, `governance` (the real governance lane), `mobile-merchant`, `build`.

## Known reality gaps (do not paper over)

- **The remote cannot be read from this machine** (2026-09-04): `gh` is logged in as an account
  without access and `git ls-remote` reports the repository as not found. Nothing in CI has been
  observed since 2026-08-15. See `.claude/skills/letbuyy/references/ci.md` §0.
- **`origin/develop` (2026-06-09), `origin/main` and `origin/stepup/main` (2026-08-15) are all
  ancestors of `823aa5ee`**; the owner's first push of `develop`, `staging`, `main` is a
  fast-forward on every ref. Push `develop`, then `staging`, then `main`.
- **Nothing is deployed.** `config/vercel/projects.json` holds placeholder project IDs; whether the
  Cloudflare / Vercel / Supabase secrets exist in GitHub is UNVERIFIED.
- **The governance lane is red** (six ambient failures at `823aa5ee`, attributed in `ci.md` §3), so a
  dispatched production deploy stops at its governance gate today.

## GitHub Branch Protection Settings — **UNVERIFIED from the repository**

Branch protection lives on github.com, not in this repository. Nothing in `.github/` can prove that
these rules are configured, and no validator in this repository asserts them. Every box below is a
**human-owned seam requiring repo-owner access to confirm.** Configure manually in the GitHub UI and
record the confirmation in the launch evidence set.

### For `develop`

- [ ] Require status checks to pass before merging: `CI / Typecheck`, `CI / Lint`, `CI / Build`,
      `CI / Unit tests`, `CI / Governance`, `CI / Merge safety gate`, `CI / Secret hygiene`.
- [ ] Restrict who can push (the owner; agents never push).

### For `staging`

- [ ] Allow fast-forward pushes only (no merge commits; "Require linear history").
- [ ] Require the `develop` status checks on the promoted SHA.
- [ ] Restrict who can push to the owner.

### For `main`

- [ ] Require linear history; no direct commits; no force pushes.
- [ ] Require the `staging` checks on the promoted SHA plus `staging-e2e / playwright` once DEPLOY-1
      exists.
- [ ] Restrict who can push to the owner; do not allow bypassing.

### Preserved `stepup/main`

- [ ] Lock the branch (no pushes) so the alias can never advance.

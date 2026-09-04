# Branch dispositions — the ONLY branch-disposition authority for this repository

Authority: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` > root `AGENTS.md` > this ledger.
Operating rules: `.claude/skills/letbuyy/references/merge.md` (rows, claims, worktree lifecycle) and
`references/promote.md` (the `## Promotions` table). Enforced by
`scripts/validators/branch-dispositions-validator.mjs` (gate lane).

## Claim protocol

1. **The row is the claim, and it is the branch's first commit.** Before any implementation commit,
   add a row with `Status = ACTIVE`, the base SHA, and a `Why` that names the files you expect to
   touch and the collision check you ran (`git worktree list` · `git branch --list 'letbuyy/*'` ·
   the `ACTIVE` rows below, read for topic overlap). A row on an unmerged branch is invisible from
   `develop`, so the collision check is mandatory, not optional.
2. **Never change another branch's `Status` cell.** Flag and ask.
3. **Commit ledger edits immediately and with a pathspec** (`git commit -- docs/active/BRANCH_DISPOSITIONS.md`).
   Several sessions share the primary checkout; a bare `git commit` sweeps other sessions' staged files.
4. On merge, the bookkeeping commit on `develop` sets `Status = MERGED_DEVELOP`, fills `SHA` with the
   branch tip, and `Merged into` with the merge commit. No placeholder may survive the merge.

## Status tokens

| Token | Meaning |
|---|---|
| `ACTIVE` | claimed, unmerged; the `SHA` cell is the base at claim time until the bookkeeping commit |
| `MERGED_DEVELOP` | contained in `develop`; `Merged into` = the merge commit |
| `ENVIRONMENT` | `develop`, `staging`, `main` themselves; moved only by merge (develop) or fast-forward promotion |
| `LEGACY_INTEGRATED` | fully contained in `develop` at adoption of the branch model; never advance, never delete |
| `PRESERVED_REFERENCE` | holds commits absent from `develop`; never merge without a new owner decision; never delete |
| `SUPERSEDED_BY:<branch>` | replaced by another branch; kept as history |
| `ARCHIVED_TAG:<tag>` | tagged and retired |

## Branch model (OWNER_DECISION 2026-09-04, D-BRANCH)

`letbuyy/<phase>` → `--no-ff` merge into `develop` (inside the develop worktree) → fast-forward-only
promotion `develop` → `staging` → `main`, each promotion with the owner's word in the same message.
`main` never receives a merge commit or a direct commit. `stepup/main` is a preserved alias of the
former integration branch and is never advanced again.

## Rows

| Branch | SHA | Status | Decided | Decided by | Why | Merged into |
|---|---|---|---|---|---|---|
| `develop` | `823aa5ee` | ENVIRONMENT | 2026-09-04 | owner (D-BRANCH) | Created at the working tip `823aa5ee` (former `feature/claude-md-durable-architecture-memory` head). Integration + local end-to-end. | N/A |
| `staging` | `823aa5ee` | ENVIRONMENT | 2026-09-04 | owner (D-BRANCH) | Created at `823aa5ee`. Cloud pre-production. Moves only by `promote staging`. | N/A |
| `main` | `823aa5ee` | ENVIRONMENT | 2026-09-04 | owner (D-BRANCH) | Fast-forwarded `1fda6486` → `823aa5ee` (`git fetch . <sha>:main`; reflog reads `fast-forward`). Production pointer; nothing is deployed anywhere as of this date. Moves only by `promote main`. | N/A |
| `letbuyy/gov3-letbuyy-skill-and-branch-model` | `55d71430` | MERGED_DEVELOP | 2026-09-04 | GOV-3 (this phase) | Build the single operating skill `.claude/skills/letbuyy/` (SKILL.md, references/, scripts/), this ledger, `branch-dispositions-validator.mjs` + its test, the `develop → staging → main` retarget of `branch-lag-guard-validator.mjs`, `deployment-safety-validator.mjs`, `workflow-trigger-coverage-validator.mjs`, `whole-repo-end-state-validator.mjs`, their tests, `.github/workflows/{ci,branch-lag-monitor,production-deploy,deploy-staging}.yml`, `config/vercel/projects.json`, `.gitignore`, `.github/BRANCH_STRATEGY.md`, `MERGE_RUNBOOK.md`, `AGENTS.md` (DEPLOY-R1/TEST-R8 branch literals only), `CLAUDE.md` (pointer + branch model), `scripts/validators/README.md`, `scripts/validate-governance.mjs` (wire one validator). Collision check at claim: `git worktree list` = primary + 6 `.claude/worktrees/*` (none on a `letbuyy/*` branch); `git branch --list 'letbuyy/*'` = empty; no `ACTIVE` row existed (ledger created by this phase). Worktree: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy-gov3`. | `4f19377c` (2026-09-04, inside LetBuyy-develop; first-parent diff 46 files, resurrection check 0) |
| `feature/claude-md-durable-architecture-memory` | `823aa5ee` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | The primary checkout's branch, shared by concurrent sessions, integrated into `develop` at `823aa5ee`. Any commit landing on it after `823aa5ee` is unintegrated until it is merged into `develop` through a phase branch. Do not advance `develop` from it directly. | `develop` @ `823aa5ee` |
| `stepup/main` | `08c6f872` | LEGACY_INTEGRATED | 2026-09-04 | owner (D-BRANCH) | Former integration/staging branch (MERGE_RUNBOOK, DEPLOY-R1). Its role is now `staging`. Preserved alias; never advanced; workflows, validators and tests retargeted to `staging` by GOV-3. | `develop` @ `823aa5ee` |
| `ci/zero-failure-wave-2026-08-15` | `1ed62b6d` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop` (`git branch --merged 823aa5ee`). | `develop` @ `823aa5ee` |
| `e2e/deployment-readiness-wave-2026-08-15` | `5824b25d` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`. | `develop` @ `823aa5ee` |
| `claude/affectionate-gould-b07735` | `3a04998d` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`. | `develop` @ `823aa5ee` |
| `claude/agitated-northcutt-18a70f` | `1fda6486` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`; checked out in `.claude/worktrees/vigorous-albattani-89bbf6`. | `develop` @ `823aa5ee` |
| `claude/busy-tu-4d552d` | `1fda6486` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`; checked out in `.claude/worktrees/busy-tu-4d552d`. | `develop` @ `823aa5ee` |
| `claude/confident-booth-07b940` | `1fda6486` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`; checked out in `.claude/worktrees/confident-booth-07b940`. | `develop` @ `823aa5ee` |
| `claude/eloquent-thompson-f07a86` | `5af69e0c` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`. | `develop` @ `823aa5ee` |
| `claude/great-mirzakhani-d631f1` | `2634343b` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`; checked out in `.claude/worktrees/eloquent-thompson-f07a86`. | `develop` @ `823aa5ee` |
| `claude/peaceful-kare-6e6187` | `1fda6486` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`; checked out in `.claude/worktrees/peaceful-kare-6e6187`. | `develop` @ `823aa5ee` |
| `claude/vigorous-albattani-89bbf6` | `5af69e0c` | LEGACY_INTEGRATED | 2026-09-04 | GOV-3 | Contained in `develop`. | `develop` @ `823aa5ee` |
| `claude/infallible-mendeleev-7db258` | `1b99f5db` | PRESERVED_REFERENCE | 2026-09-04 | GOV-3 | 1 commit absent from `develop` ("fix(ui): update stale Table row-open assertion in foundation test"). Owner decision needed before merging. | N/A |
| `claude/integration-reconciliation-2026-08-15` | `70e93994` | PRESERVED_REFERENCE | 2026-09-04 | GOV-3 | 1 commit absent from `develop` (governance-gate CI job history/context). Owner decision needed before merging. | N/A |
| `claude/intelligent-euclid-61b310` | `ad91eac0` | PRESERVED_REFERENCE | 2026-09-04 | GOV-3 | 1 commit absent from `develop` (dead settings components removal); checked out at `Projects/Start_Up/Copy/Letbuyy_Store/.claude/worktrees/intelligent-euclid-61b310` (outside this repository). Owner decision needed before merging. | N/A |
| `claude/production-governance-gate-ci-fix-2026-08-15` | `b4ca1845` | PRESERVED_REFERENCE | 2026-09-04 | GOV-3 | 2 commits absent from `develop` (governance-gate regression assertion scoping). Owner decision needed before merging. | N/A |
| `letbuyy/db-1-mig-208-210` | `27be4d3b` | MERGED_DEVELOP | 2026-09-04 | DB-1 (this phase) | Phase DB-1. Land the three orphaned migrations 208/209/210 (+ their three paired rollbacks) that exist only as uncommitted files in the primary checkout, unchanged since 2026-08-25, together with the api-gateway wiring migration 210 requires. Closes two live merchant defects on `develop`: POST /employees 500s on `employees_created_by_fkey` (`000_baseline.sql:21221` still points `employees.created_by`/`.user_id` at `auth.users(id)` while the gateway writes a `users_custom.id`), and PUT /notifications/preferences 500s twice over (same stale FK on `notification_preferences.user_id`, plus `routes/notifications.ts:248` emitting a bare `onConflict` column list against an EXPRESSION unique index PostgREST cannot match). Also closes `sequential-migration-validator` (gap 207 -> 211) and `tenant-isolation-validator` (the committed `tenant-tables.registry.ts:883,1339` already cites the 208_/209_ files; the derived-vs-committed diff is exactly those two sourceFiles entries, so the registry is NOT edited and the generator is NOT run). Files: `database/supabase/migrations/{208,209,210}_*.sql`, `database/supabase/rollback/{208,209,210}_*.rollback.sql`, `services/api-gateway/src/routes/notifications.ts`, `services/api-gateway/src/routes/employee.ts`, this ledger, `EXECUTION_LEDGER.md`. Collision check at claim (2026-09-04): `git worktree list` = 8 (primary + develop + 6 legacy, none on a `letbuyy/*` branch); `git branch --list 'letbuyy/*'` = only the merged `letbuyy/gov3-...`; zero ACTIVE rows in this ledger; the eight source files in the primary all still carry 2026-08-25 mtimes (no session mid-edit). NUMBERING COLLISION RECORDED: the sibling worktree `.claude/worktrees/vigorous-albattani-89bbf6` (`claude/agitated-northcutt-18a70f`) has its OWN 208-212 STAGED for different tables (device_tokens, storefront_pages, storefront_policies, dormant attribution columns, super_admin_allowlist); its 211/212 are already taken on `develop` by the inventory migrations, so that set must renumber to 217+ whichever way this phase goes. This phase fixes 208/209/210 to these three files permanently and does not touch that worktree. Worktree: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy-db-1`. | `c46abf9d` (2026-09-04, inside LetBuyy-develop; first-parent diff 9 files, all in scope; resurrection check 0; result tree identical to the branch tip) |

Remote-only refs at adoption (measured 2026-09-04, last fetch 2026-08-25; the remote could not be
read from this machine — see `references/ci.md`): `origin/main` `5af69e0c`, `origin/stepup/main`
`5af69e0c`, `origin/develop` `41b6ea49` (2026-06-09). All three are ancestors of `823aa5ee`, so the
owner's first push of `develop`/`staging`/`main` is a fast-forward on every ref.

## Promotions

| Date | Source SHA | Target | Pushed | Owner's word (quoted) | CI run |
|---|---|---|---|---|---|
| 2026-09-04 | `823aa5ee` | `staging` (created) | no | "Level all three to 823aa5ee" (D-BRANCH) | not readable from this machine |
| 2026-09-04 | `823aa5ee` | `main` (fast-forward from `1fda6486`) | no | "Level all three to 823aa5ee" (D-BRANCH) | not readable from this machine |

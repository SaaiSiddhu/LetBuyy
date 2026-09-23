# `merge` mode — integrate a VERIFIED phase into `develop`

`develop` is the only merge target for phase branches. `staging` and `main` never receive merge
commits (`promote.md`). As written (D-BRANCH, 2026-09-04), every merge happens **inside the worktree
that holds `develop`**, never by moving a ref from outside, never in the primary checkout.

> **OPEN — D-MERGE-LOCATION (`decisions.md` §6); measured 2026-09-23 (F-SKILLFACTS-3).** The rule was
> written when the primary checkout (`Projects/Start_Up/LetBuyy`) sat on the frozen `feature/…` branch
> with other sessions' uncommitted work, and `Projects/Start_Up/LetBuyy-develop` held `develop`. Since
> the 2026-09-20 consolidation the primary **is** on `develop`, clean, and `LetBuyy-develop` does not
> exist. Git now makes the rule impossible to follow. `git worktree add <dir> develop` fails with
> *already used by worktree*, and `git fetch . <sha>:develop` from any other worktree fails with
> *refusing to fetch into branch … checked out*. Both were reproduced in a scratch repository. **No merge
> into `develop` runs until the owner chooses where merges happen.** Do not work around it with
> `--update-head-ok`, `update-ref` or `branch -f`, all of which move the ref under a checkout that does
> not follow it. The procedure below is kept verbatim for when a `develop` worktree exists again, or
> until the owner replaces it.

## 1. Preconditions (all verified by command, none by memory)

1. Phase state is `VERIFIED` in `state.json`: gate table captured after the last commit; every
   attached lane reported `PASS` or `PASS_WITH_FINDINGS`; no `BLOCKING`.
2. The ledger row exists on the branch with `Status = ACTIVE` and a `Why` that matches what was built.
3. `git -C LetBuyy-develop status --porcelain | wc -l` = 0 and
   `git -C LetBuyy-develop ls-files --others --exclude-standard | wc -l` = 0.
4. `git -C LetBuyy-develop rev-parse --abbrev-ref HEAD` = `develop` and `git worktree list` shows
   exactly one `[develop]`.
5. Collision re-check: another `ACTIVE` row or branch with the same scope merged since the base?
   `git log --oneline <base>..develop` read in full.
6. If the phase added a migration: its rollback file exists, and
   `services/api-gateway/src/tenant/tenant-tables.registry.ts` was regenerated in the phase.

## 2. Procedure (`scripts/merge-develop.sh <branch>` does steps 1–7 and stops before commit)

```
1  D=…/LetBuyy-develop; PRE=$(git -C "$D" rev-parse HEAD)            # pin the pre-merge tip
2  BASE=$(git -C "$D" merge-base develop <branch>)
   comm -12 <(git -C "$D" diff --name-only "$BASE"..develop | sort) \
           <(git -C "$D" diff --name-only "$BASE"..<branch> | sort)  # overlap → affected suites must run on the RESULT
3  git -C "$D" merge --no-ff --no-commit <branch>                     # inspection window (resumable)
4  conflicts: resolve ONLY inside the phase's own files; for the ledgers (BRANCH_DISPOSITIONS,
   EXECUTION_LEDGER, SKIPPED_HUMAN_DECISIONS, CAPABILITY_BACKLOG) union rows and confirm no row was lost
5  [ "$(git -C "$D" rev-parse refs/heads/develop)" = "$PRE" ] || abort   # the ref did not move under you
6  git -C "$D" commit -m "Merge branch '<branch>' into develop"       # Merge* subjects are conventional-commit exempt
7  M=$(git -C "$D" rev-parse HEAD)
   git -C "$D" diff --name-status "$PRE" "$M"                          # must be ⊆ phase files (+ ledgers)
   resurrection check (below) must be 0
   git -C "$D" reflog show develop -1                                  # reads "commit (merge)"
8  overlap non-empty → run the affected suites at "$M" (installed worktree), record results
9  ledger bookkeeping commit on develop: BRANCH_DISPOSITIONS row ACTIVE → MERGED_DEVELOP, SHA cell =
   branch tip, "Merged into" = "$M"; EXECUTION_LEDGER.md PHASE row appended —
   `docs(repo): record <ID> merged into develop as <M>`
10 worktree disposition (§4); then, if run.md config allows, `git -C "$D" push origin develop` and record the CI run id
```

**Resurrection check** — the retired paths that a stale branch can bring back (all must count 0 in
`git ls-tree -r "$M" --name-only`): `apps/storefront-runtime/`, `apps/merchant-control-plane/`,
`apps/platform-console/`, `apps/mobile/merchant-app/`, `Ecommerce/`, `apps/admin/`, `apps/auth/`,
`apps/checkout/`, `apps/internal/`, `apps/merchant/`, `apps/storefront/`, `apps/analytics/`,
`apps/mobile/operator-team-app/`, `legacy_archive_v2/`, `apps/customer_web/consumer-storefront/`,
and any `*.jks` / `key.properties` / `.dev.vars` / `.env.local`.

A merge that fails any check is undone with `git -C "$D" merge --abort` (before commit) — never with
`reset --hard` after commit; after commit, re-merge on top with the correction and report both SHAs.

## 3. The ledger — `docs/active/BRANCH_DISPOSITIONS.md`

Seven columns: `Branch | SHA | Status | Decided | Decided by | Why | Merged into`. No hook reflows it
(no prettier in this repository). Rules that already bit someone:

- **The row is the claim; write it as the first commit.** Name the files you expect to touch.
- **Never change another branch's `Status` cell** — flag and ask.
- Status tokens: `ACTIVE` · `MERGED_DEVELOP` · `ENVIRONMENT` · `LEGACY_INTEGRATED` ·
  `PRESERVED_REFERENCE` · `SUPERSEDED_BY:<branch>` · `ARCHIVED_TAG:<tag>` (defined in the ledger).
- Promotions are recorded in the ledger's `## Promotions` table (date · source SHA · target · pushed ·
  owner's word quoted · CI run), not per row.
- `scripts/validators/branch-dispositions-validator.mjs` (gate lane) re-derives facts from git:
  `main ⊆ staging ⊆ develop`; every `MERGED_DEVELOP` row is an ancestor of `develop`; every `ACTIVE`
  row's SHA is an ancestor of its branch tip; `PRESERVED_REFERENCE` rows are not ancestors of
  `develop`; no duplicate rows; every local branch has a row (advisory). Refs missing in a shallow
  CI clone are skipped, not failed.
- `EXECUTION_LEDGER.md` is the phase-evidence ledger (8 columns: Action ID · What changed · Files ·
  Migrations · Tests added · Validators touched · Status · Commit). Append one `PHASE-<ID>` row per
  merged phase in the bookkeeping commit; never rewrite old rows.

## 4. Worktree lifecycle — the merge is not done until the desk is cleared

Four preconditions, then the porcelain command, in the same session that merged:
```
git merge-base --is-ancestor <branch> develop            # contained
git -C <wt> status --porcelain | wc -l                   # 0
git -C <wt> ls-files --others --exclude-standard | wc -l # 0 (untracked = STOP: archive outside the repo first, verify, then proceed)
git worktree remove <wt> && git worktree prune           # never rm -rf; refusing on dirty is a safety feature
```
`df -h` before and after (`du` lies under APFS). Never delete the merged branch ref. Never remove the
primary checkout, a `develop` worktree, any owner-owned legacy worktree, or any worktree holding an
in-flight phase. RE-MEASURED 2026-09-23: `LetBuyy-develop` and `.claude/worktrees/*` no longer exist.
A merge phase that leaves its worktree standing is `PARTIAL`.

## 5. Report

```
MERGE — <phase>
develop before: <PRE>  after: <M>   merge-base: <BASE>   overlap files: <n> (list)   suites run on the result: …
first-parent diff: <n> files, all within phase scope (or: exceptions listed)   resurrection check: 0
ledger: BRANCH_DISPOSITIONS row line <n> → MERGED_DEVELOP, EXECUTION_LEDGER row PHASE-<ID>, bookkeeping commit <sha>
validator: branch-dispositions-validator exit + advisories (listed)
worktree: <path> removed (preconditions 4/4) · df before/after   push develop: yes/no (+ CI run id)
```

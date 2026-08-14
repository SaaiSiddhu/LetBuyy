# 17 — Branch and Worktree Topology (Wave 0)

**Evidence artifact, not governance authority.**

- **Repo SHA (baseline / HEAD of `stepup/main`):** `ee3711829d857e986014c5811bb94d86ebc3d343` (`ee371182`, committed 2026-08-04 22:03:49 +0530)
- **Branch / worktree described:** all local branches and all git worktrees attached to the repository at `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` (primary worktree on `stepup/main`), plus the six Wave 0 isolated worktrees under `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees`.
- **Date:** 2026-08-09
- **Status of this document:** read-only audit. No branch was created, deleted, renamed, pushed, or pruned by this agent. No file outside `docs/launch/web-v1-wave-0-2026-08-09/` was written.

## Commands executed

```
git worktree list --porcelain
git branch -vv
ls -la /Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees
ls -la /Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/.git/worktrees
# per worktree W:
ls -a <W>/supabase ; ls -a <W>/supabase/.temp ; ls -a <W> | grep '^\.env'
git -C <W> status --porcelain ; git -C <W> rev-parse HEAD
git -C <W> merge-base HEAD ee3711829d857e986014c5811bb94d86ebc3d343
# original repo:
ls -a supabase/.temp ; git remote -v ; git status --porcelain | wc -l
git for-each-ref refs/heads/codex refs/remotes
git rev-list --count origin/stepup/main..HEAD ; ... origin/main..HEAD ; ... main..HEAD
grep -n -E 'main|staging|production|integration' .github/BRANCH_STRATEGY.md
```

EXECUTED: every fact in the tables below is direct command output observed in this session.
INFERRED: only the policy statement in "Required branch policy" (derived from `.github/BRANCH_STRATEGY.md` plus the human decisions carried into Wave 0) and the risk commentary, both marked as such.
UNVERIFIED: nothing was checked against the GitHub remote (no `git fetch`, no `git ls-remote`) — remote-side branch protection and the actual remote ref set as of 2026-08-09 are **UNVERIFIED**; the `refs/remotes/origin/*` values below are the last locally cached state only.

---

## 1. Wave 0 worktrees — verified

All six exist, all are attached to the same repository, all are at the approved baseline, and all have merge-base == baseline (i.e. zero divergence at audit time).

| Branch | Absolute worktree path | HEAD | merge-base with baseline | `git status --porcelain` count |
|---|---|---|---|---|
| `codex/web-v1-integration` | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee371182…` | 0 (clean) |
| `codex/w0-ci-coverage` | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-ci-coverage` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee371182…` | 0 (clean) |
| `codex/w0-validator-execution` | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-validator-execution` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee371182…` | 0 (clean) |
| `codex/w0-local-environment` | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-local-environment` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee371182…` | 0 (clean) |
| `codex/w0-v1-perimeter` | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-v1-perimeter` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee371182…` | 0 (clean) |
| `codex/emergency-appbridge-killswitch` | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/emergency-appbridge-killswitch` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee371182…` | **2 (in progress)** |

Deviation from the brief (the brief said all six were clean): `emergency-appbridge-killswitch` is **no longer clean** — it shows ` M packages/theme-engine/src/theme-cli.ts` and `?? tmp-appbridge-probe/`. That is the separate urgent App Bridge security task working as intended; per the human decision, this workflow does **not** touch it. Noted only. **`tmp-appbridge-probe/` is an untracked scratch directory and must not be committed** — flagged to that task's owner, not acted on here.

Admin metadata for all six exists under `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/.git/worktrees/<name>` (created 2026-08-09 10:10, killswitch 10:13). No worktree is marked `prunable`.

`git for-each-ref refs/heads/codex …` confirms **all six `codex/*` branches have `upstream=` empty** — no tracking branch, therefore none has ever been pushed.

## 2. Supabase isolation — hard safety requirement, re-verified independently

**PASS.** For each of the six worktrees, `<worktree>/supabase/` contains only `.branches` — there is **no `supabase/.temp` directory** in any of them (`ls` returned `No such file or directory` for all six), and **no `.env*` file** at any worktree root.

The production linkage lives **only** in the original checkout: `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/supabase/.temp/` exists and contains `project-ref`, `linked-project.json`, `pooler-url`, `start-secrets`, `postgres-version`, `gotrue-version`, `rest-version`, `storage-version`, `storage-migration`, `cli-latest`. Those files are gitignored, so `git worktree add` correctly did not copy them. **No file content or secret value from `.temp` was read, printed, or copied.** No Supabase command of any kind was run from anywhere.

Consequence: a Supabase CLI invocation from inside any Wave 0 worktree has **no linked project** and cannot reach the production project. That is the intended isolation and it holds at audit time. It is not permanent — anyone running `supabase link` inside a worktree would break it. **UNVERIFIED / residual risk:** nothing mechanically prevents that; the protection is procedural.

## 3. Local branch graph

```
ee371182  codex/web-v1-integration
          codex/w0-ci-coverage
          codex/w0-validator-execution
          codex/w0-local-environment
          codex/w0-v1-perimeter
          codex/emergency-appbridge-killswitch
          stepup/main            <- HEAD (primary worktree, dirty)
   |
   |  106 commits
   v
0b8a56e7  main, claude/elegant-jang-91fd3e
   |
   |  (185 more, per `main` upstream state)
   v
41b6ea49  origin/main, origin/develop, + 11 stale worktree-agent-* branches
```

Measured divergence (from the primary worktree):

| Measurement | Command | Result |
|---|---|---|
| HEAD ahead of `origin/stepup/main` | `git rev-list --count origin/stepup/main..HEAD` | **17** (17 unpushed local commits) |
| HEAD ahead of local `main` | `git rev-list --count main..HEAD` | **106** |
| HEAD ahead of `origin/main` | `git rev-list --count origin/main..HEAD` | **291** |
| local `main` vs `origin/main` | `git branch -vv` | `ahead 185`, at `0b8a56e7` |
| `origin/main` / `origin/develop` | cached ref | both `41b6ea49` |
| `origin/stepup/main` | cached ref | `8d9dda77` |

This confirms the Phase 1 figures (106 / 291 / 17) exactly. Remote: single `origin` = `https://github.com/SaaiSiddhu/Letbuyy_Store.git`.

Primary worktree dirtiness re-measured: **`git status --porcelain` = 6826 paths** on `stepup/main`. Preserved as-is; not staged, not committed, not cleaned.

## 4. The 12 pre-existing stale/prunable worktrees — DOCUMENTED, NOT PRUNED

`git worktree list --porcelain` reports 12 entries flagged `prunable  gitdir file points to non-existent location`. All 12 sit at **`41b6ea49c5da30a1409d4cc587d989d459288e45`** ("fix(identity): show turnstile on auth forms") and belong to a **different checkout path — `/Users/saai_sidd/Git/Letbuyy_Store`** (note: `saai_sidd`, not `saai_siddharth`), i.e. a prior machine/user path that no longer exists.

| # | Registered path | Ref |
|---|---|---|
| 1 | `/private/tmp/claude-501/-Users-saai-sidd-Git-Letbuyy-Store/5aac35ab-…/scratchpad/wt-main` | detached |
| 2 | `/Users/saai_sidd/Git/Letbuyy_Store/.claude/worktrees/agent-a1bd13d85c3105715` | `worktree-agent-a1bd13d85c3105715` |
| 3 | `…/agent-a34f88961b0bb8437` | `worktree-agent-a34f88961b0bb8437` |
| 4 | `…/agent-a362aa8b3da412966` | `worktree-agent-a362aa8b3da412966` |
| 5 | `…/agent-a555f02f94a126abf` | `worktree-agent-a555f02f94a126abf` |
| 6 | `…/agent-a7919395a833f174c` | `worktree-agent-a7919395a833f174c` |
| 7 | `…/agent-a7a543eab336034b2` | `worktree-agent-a7a543eab336034b2` |
| 8 | `…/agent-a955960610b80b188` | `worktree-agent-a955960610b80b188` |
| 9 | `…/agent-ad423cf35b53a2840` | `worktree-agent-ad423cf35b53a2840` |
| 10 | `…/agent-ae7596c1c7b6ab890` | `worktree-agent-ae7596c1c7b6ab890` |
| 11 | `…/agent-aedce04cdcb543bc7` | `worktree-agent-aedce04cdcb543bc7` |
| 12 | `…/agent-afa1b5df213f24ca9` | `worktree-agent-afa1b5df213f24ca9` |

Their admin dirs remain under `.git/worktrees/` dated 2026-08-03. **`git worktree prune` and `git worktree remove` were NOT run** (prohibited by the Wave 0 safety rules). They are inert: they hold refs at `41b6ea49`, which is already the `origin/main` commit, so they pin no unique work. Cleanup is a **human decision**, deferred out of Wave 0.

Note: `41b6ea49` is also where `origin/main` and `origin/develop` sit — consistent with the Phase 1 finding that both remote branches are frozen and ~274 commits behind.

## 5. Required branch policy (INFERRED from `.github/BRANCH_STRATEGY.md` + Wave 0 human decisions)

The mandated promotion path, in order, with no shortcuts:

```
feature branch
   -> verified PR (all gates green, evidence attached)
      -> codex/web-v1-integration
         -> staging certification
            -> release PR
               -> main
                  -> version tag / manual approval
                     -> production
```

**`codex/web-v1-integration` must NEVER deploy to production.** It is an integration and certification branch only. It has no production role, no production secrets, and no path to a production deploy target. Production is reached solely via `main` plus a version tag and explicit manual human approval. Any workflow, environment binding, or manual action that would deploy the integration branch to production is a policy violation and must be treated as a blocker, not a shortcut.

Supporting authority (`.github/BRANCH_STRATEGY.md`):
- `.github/BRANCH_STRATEGY.md:5` — `main` is the production pointer, protected, no direct push.
- `.github/BRANCH_STRATEGY.md:6` — `stepup/main` is the repository-side integration/staging branch.
- `.github/BRANCH_STRATEGY.md:13-16` — every PR to `stepup/main` or `main` must pass all CI gates; PRs to `main` additionally require staging E2E and one approver; squash-merge only on `main`; **never push directly to `main` or `stepup/main`**.
- `.github/BRANCH_STRATEGY.md:35` — required checks named as `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`, `staging-e2e / playwright`.
- `.github/BRANCH_STRATEGY.md:9` — `develop` is retired; do not target it.

**Conflict carried forward from Phase 1 (not resolved here):** `BRANCH_STRATEGY.md:35` names `ci / *` as required checks, but `ci.yml` does not trigger on push or pull_request for `stepup/main`. The documented policy and the actual automation disagree. That is `codex/w0-ci-coverage`'s surface; recorded here as an open escalation, not improvised away.

**Mobile (human decision, honored):** `apps/mobile/merchant-app` is **HUMAN_DECISION_REQUIRED** — not "MOBILE_V1_1", not "deferred". No branch in this topology asserts a mobile deferral. Mobile work must be preserved and must **not** be merged into `codex/web-v1-integration`; it needs its own branch line and an ARB decision before any V1/V1.1 split is claimed.

**App Bridge (human decision, honored):** `codex/emergency-appbridge-killswitch` is a separate urgent security task. This workflow does not touch App Bridge / app-store / marketplace code. Referenced here as an open escalation only.

## 6. Push / remote state

- **Nothing has been pushed.** All six `codex/*` branches have an empty upstream (`git for-each-ref … upstream=` blank for all six).
- **No remote branch was created.** The only cached remote refs are `origin/main`, `origin/develop`, `origin/stepup/main`.
- No PR was opened, no deploy triggered, no tag created.
- No destructive git operation was run: no `reset --hard`, `clean`, `stash`, `checkout --`, `restore`, `worktree remove/prune`, force push, or history rewrite.

## 7. Open items / UNVERIFIED

1. **Remote branch protection is UNVERIFIED** — no network call was made. GitHub-side required checks, approvals, and environment protection rules for `main` and `stepup/main` were not inspected.
2. **The `origin/*` SHAs above are cached**, not freshly fetched; the true remote state on 2026-08-09 is unknown.
3. **Supabase isolation is procedural, not enforced** — a `supabase link` inside a worktree would defeat it.
4. **12 stale worktrees remain registered** — deliberately not pruned; awaiting human cleanup approval.
5. **`emergency-appbridge-killswitch` carries an untracked `tmp-appbridge-probe/`** — must not be committed; owned by that task.
6. **CI policy vs CI reality conflict** (§5) — escalated, not improvised.

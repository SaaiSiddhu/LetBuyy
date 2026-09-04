# `worker` mode — implement one bounded phase

You execute exactly one phase contract (SKILL §2.2). No contract → write one first (`cto.md` §5) and
show it; a described problem without a request to change is `status`, not `worker`.

## 1. Preflight (all of it, every phase)

1. **Re-read the integration tip**: `git -C <develop-worktree> rev-parse --short develop` and compare
   with the contract's `base`. If it moved, rebase the plan, not the branch — note the delta.
2. **Collision check**: `git worktree list`, `git branch --list 'letbuyy/*'`, the ledger's `ACTIVE`
   rows, and `git -C <primary> status --short -- <file family>` (a sibling session may be mid-edit
   in the primary checkout). Overlap → STOP and report.
3. **Worktree is mandatory.** `git -C <root> worktree add <root>-<phase> -b letbuyy/<id>-<slug>
   refs/heads/develop` (never send its output to `/dev/null`; `git -C` for every command, never `cd`).
   Then in the worktree: `pnpm install --frozen-lockfile` (warm store ≈ 1 min; never
   `pnpm install --filter <x>`, it prunes the lockfile). Flutter phases: `flutter pub get` from the
   repo root (the pub workspace) — and `git status` afterwards, because Flutter tooling writes to
   tracked files (`hazards.md`).
4. **Identity**: `git -C <wt> log -1 --format='%an <%ae> | %cn <%ce>'` after the first commit —
   D-ID is open; the repo-local config is the current identity; no trailer.
5. **Claim row = first commit.** Add the row to `docs/active/BRANCH_DISPOSITIONS.md` (`merge.md` §3)
   with `Status = ACTIVE`, a `Why` naming the files you expect to touch and the collision check you
   ran, `Merged into` = `N/A — pending`. Commit as `docs(repo): claim phase <ID> — <slug>` with a
   pathspec. `git show --stat HEAD`.
6. **Baseline the gates on the untouched branch**: `bash .claude/skills/letbuyy/scripts/gate.sh --baseline`
   (records the ambient reds so the phase's delta is measurable — `hazards.md` lists the known six).
7. Read every file in the contract's `files to read` list **in full** — whole functions, whole
   configs, the whole migration chain for any RPC you touch (`grep -l 'FUNCTION public.<rpc>' database/supabase/migrations/*.sql`
   — the latest redefinition is the current one, never the baseline). Then read the callers.

## 2. Implementation discipline

- Touch only `may_write`. Anything else you discover goes into the report as a finding.
- **Canonical UI only** (`uiux.md`): compose from `@letbuyy/ui` / `packages/dart/ui_kit`, `--lb-*`
  tokens only, never a raw hex/px/inline style, never a forked primitive. A missing primitive = stop
  and report. Donor apps (`customer_app`, `admin_app`, `phase_2/*`) are HOLD: no re-skin.
- **Feedback compliance** (`feedback.md`) the moment anything renders a message — web or Flutter —
  and `ProviderModeBadge` on every money/fulfilment surface, bound to backend `provider_mode`.
- **Security invariants** (`security.md` §4) preserved by construction: tenant from a validated claim
  via `withTenantTx`; never a client-supplied `site_id`/`store_id`; fail closed; generic auth errors;
  no PII in logs; money in `bigint` minor units through the canonical RPCs; every externally
  retryable mutation idempotent; business mutation + outbox event in one transaction.
- **Migrations**: next sequential prefix (no gaps, no reuse — `sequential-migration-validator`),
  paired `database/supabase/rollback/<n>_<name>.rollback.sql` that restores the definition actually
  in force (not an older baseline), an RPC redefinition that differs from its predecessor by only the
  required lines (diff them, report the line count), `SECURITY DEFINER` with `SET search_path` and
  schema-qualified extension calls (`extensions.gen_random_bytes`, the pgcrypto trap), then
  `node scripts/generators/generate-tenant-table-registry.mjs` if a tenant table changed.
- **Never** edit generated output by hand · run repo-wide generators unprompted · bump a ratchet
  baseline (`validate-design-system --update`) or a date to clear a validator · delete a `SKIP-*`/
  `CAP-*` row (mark CLOSED in place) · add an app-local API route that writes the DB (routes are
  gateway proxies) · introduce a `letbuyy.store` literal · widen a workflow's `permissions:`.
- **Flutter**: read config from the file Gradle evaluates (Groovy wins when both exist); never touch
  `applicationId`/`namespace`/signing without the registry diff; contain secrets with
  `String.fromEnvironment` + `--dart-define`; the gate deletes `build/` — build APKs **after** the gate.
- Keep the ledger `Why` cell growing with findings, but commit ledger edits immediately with a
  pathspec — the registry files are the highest-collision files in the repository.

## 3. Testing discipline

- For each fix: reproduce **before** (the test fails or the probe shows the defect), fix, the same
  test passes after. Record both outputs. A test that never failed proves nothing.
- Suites run from their real scripts: `pnpm run typecheck` · `pnpm run lint` · `pnpm run test:contracts`
  · `pnpm run test:unit:gateway` · `pnpm --filter @letbuyy/<pkg> run test` · `node --test tests/<dir>/*.test.mjs`
  · `flutter test` from the app directory. Say which invocation produced a number.
- Real-database suites (`pnpm run test:governance`, `test:foundation:wave*`) start the ephemeral
  Postgres helper — prefer a uniquely named throwaway container with no host port, prove teardown,
  and report `LETBUYY_EXECUTABLE_PG_CONTAINER`/`_DATABASE` by name.
- Any `toEqual([])`/"0 offenders" sweep you add must be shown catching a planted offender.
- Env-gated suites: run with the env set; report skipped counts before/after.
- `scripts/gate.sh` after the **last** commit; keep the table. Compare with the baseline; every new
  red is yours until attributed (check whether the named file is in *your* diff at all).
- If the phase touches an app screen: boot the runtime **after** gates (they delete `.next`), open it
  in the browser preview at 360/414/768/1280, light and dark, and record what you saw. A 307 is not
  a render; a `next dev` finding is not a product defect until `next build && next start` reproduces it.
- If the phase touches Flutter: `flutter analyze` **and** `flutter test` **and** `flutter build apk --debug`
  + `aapt dump badging` — analyze stayed green for three phases while both apps were unbuildable.

## 4. Commits

- Small, typed commits: `type(scope): subject` ≤100 chars, types `feat|fix|chore|build|ci|docs|
  refactor|perf|test|revert`, scope = the runtime/package/domain. No hooks run today; behave as if
  they did. No `Co-Authored-By`. `git show --stat HEAD` after each.
- **Always `git commit -- <paths>`** and `git diff --cached --name-only` before it: the shared index
  has swept other sessions' files twice. Name both sides of a `git mv` in the pathspec.
- Never stage a file you did not change for this phase. `git status --porcelain` before `git add`.

## 5. Completion report (chat; exact paths, never pasted documents)

```
WORKER COMPLETION REPORT — <phase> (lineage A|B|C)
A. Execution mode (SINGLE AGENT · subagents NO · delegation NO · background NO · worktrees NO · workflows NO)
B. Starting branch/commit (and develop tip at start)      C. Final branch/commit · identity line
D. Pre-existing working-tree state and proof it was preserved (primary checkout counts before/after)
E. Files created   F. Files updated   G. Files deleted   H. Docs/registries created/updated (path · purpose)
I. Schema/migration changes (+ rollback, + registry regeneration)   J. Auth/identity changes
K. Tenant-isolation changes   L. Money/ledger changes   M. Infra/CI/workflow changes   N. Android/iOS identity check
O. Commands executed   P. Exit codes   Q. Passed   R. Failed   S. Skipped   T. Timed out
U. What each test actually proves   V. Remaining work   W. Blockers (classified)   X. Owner/founder decisions required
Y. Security caveats · secrets encountered (names only) · Gate recommendation (never GO on your own word)
Z. Worktree disposition — path · branch · `merge-base --is-ancestor <branch> develop` · porcelain count
   at removal · `git worktree remove` result · `prune` run · df -h before/after — or "N/A — no merge in scope";
   findings outside scope (path:line each) and explicit "I did not verify …" statements
```

A report that omits failures is worse than no report.

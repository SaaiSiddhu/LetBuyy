# Hazards and standing rules — read before gates, greps, merges, installs, Flutter builds

Every item here cost real time in this programme, most more than once (the memory files under
`~/.claude/projects/-Users-saai-siddharth-Projects-Start-Up-LetBuyy/memory/` hold the incidents).
Measured facts carry the commit they were measured at. **Not a substitute for measuring again.**

## Worktrees and checkouts

- **The primary checkout is not a workspace.** `Projects/Start_Up/LetBuyy` sits on the frozen
  `feature/claude-md-durable-architecture-memory` with 39 modified + 58 untracked files that belong to
  other sessions (identity-platform theming, merchant_web settings, `@letbuyy/ui`, gateway routes,
  **migrations 208–210 + rollbacks**, research docs, two ZIPs). Never build, merge, commit, run
  generators or the real gate there. Up to seven sessions have shared it in one day.
- **`LetBuyy-develop` owns `[develop]`** from GOV-3 on. Never leave it dirty; an uncommitted ledger
  edit in a shared worktree gets absorbed into someone else's commit.
- `.claude/worktrees/*` (6 registered on `claude/*` branches, one registered **outside** the
  repository at `Copy/Letbuyy_Store/…`, plus 11 unregistered `agent-*` dirs; 9.1 GB) are owner-owned
  legacy. They pollute repo-wide `grep`/`find` — exclude `.claude/worktrees`. Never prune or remove.
- `git worktree add` fails if the branch is checked out elsewhere — never send its output to
  `/dev/null`; use `git -C <dir>` for every command, never `cd` (a persisted `cd` sent a whole batch
  of commands to the wrong directory in this very phase).
- A fresh worktree lies in both directions until `pnpm install --frozen-lockfile` (≈5 s warm store):
  suites report `no tests` or fail at import. **Never `pnpm install --filter <x>`** — it prunes the
  lockfile globally. After a workspace rename, `--frozen-lockfile` fails until one real
  `pnpm install --no-frozen-lockfile` (with `--config.strict-peer-dependencies=false` if the wrangler
  peer mismatch fires) regenerates it — commit the lockfile in that phase.
- Worktree lifecycle has four steps; a merge phase that leaves its desk standing is `PARTIAL`. Never
  `rm -rf` a worktree; never delete merged branch refs; archive untracked content before removal;
  `df -h` before/after (`du` lies under APFS).

## Git, commits, branches

- **Always `git commit -- <paths>`.** A bare `git commit` after `git add <paths>` swept 7 files of
  another session's WIP (2026-08-24), and `git mv` staged 159 renames another session could have
  committed. `git diff --cached --name-only` immediately before; `git show --stat HEAD` immediately after.
- **A pathspec turns a rename into a duplicate** unless it names both sides of the move.
- Recovery from a swept commit: `git reset --soft HEAD~1`, `git reset HEAD -- <their paths>`,
  re-commit with a pathspec. Both are non-destructive. Nothing else with `reset`.
- **Move refs only with `git fetch . <sha>:<branch>`** (fast-forward-checked, working tree
  untouched). `git branch -f` has moved `main` unchecked before; it is banned.
- `Wn` workstream labels collide across sessions — attribute by SHA, timestamp and path.
- Before concluding work is "missing" from a branch, check whether the artifact ever existed
  (`git log --all -- <path>`); a "missing" ledger row was simply never written.
- No hooks are installed; the conventional-commit format is a discipline, not an enforcement.
  `scripts/git-hooks/pre-commit` (opt-in) runs the frozen-path gate, anti-fabrication, the
  design-system validator and both token parity checks — expect it in the owner's clone.
- Ancestry is not content: a branch predating a large deletion can resurrect hundreds of files
  through a conflict-free merge. `merge.md` §2's resurrection check is mandatory.
- The remote cannot be read from this machine (`ci.md` §0). `git fetch` will fail; do not report
  branch lag against `origin/*` as current — the refs are from 2026-08-25.

## The governance gate

- **`node scripts/validate-governance.mjs` (any lane except `--plan`) deletes** `node_modules`,
  `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`,
  `.symlinks` under `apps`, `packages`, `services` (`validator-orchestrator.mjs:458`,
  `validate-governance.mjs:302`). The **root** `node_modules` survives, which is why it looks harmless.
  No opt-out. Recovery: `pnpm install --frozen-lockfile`. `build/` is in the list: **run the gate
  before any Flutter build whose APK is the deliverable**, never after (Phase R lost 670 MB of APKs).
- `--lane=gate --plan` is safe (inventory + drift). Individual validators (`node scripts/validators/<name>.mjs`)
  are safe but skip the orchestrator's cleanup, so `stale-artifact-validator` fails with an offender
  list that is 100% generated directories — a method artifact; confirm the list before reporting it.
- **Count validators programmatically** (`gate.sh` extracts the `validators` array); a casual reading
  miscounted by one on the same day. Quote the printed count and the first failure by name.
- **Never carry an inherited failure list forward.** "These 6 are not yours" hid two self-inflicted
  reds once. Run the full sweep every time; attribute every red by checking whether the named file is
  in *your* diff.
- `validate-design-system.mjs` walks the **filesystem**, not the index: another session's mid-edit
  files can manufacture a ratchet regression that exists in no commit. Measure committed content via
  `git ls-tree` + `git show HEAD:<path>` before blaming a commit; **never `--update`** to clear a red
  (UI-R7/ART-20). Its current HARD failure ("identity-platform: dark-mode reachability target file is
  missing", `823aa5ee`) is a real missing file, not the ratchet.
- `tenant-isolation-validator` reds for the *next* session whenever a migration touches a tenant
  table and `services/api-gateway/src/tenant/tenant-tables.registry.ts` was not regenerated
  (`node scripts/generators/generate-tenant-table-registry.mjs`). Provenance-only drift, still a red gate.
- `sequential-migration-validator` reds on **untracked** migrations and on gaps; today's red is
  another session's uncommitted 208–210 in the primary checkout. In a clean worktree it passes.
- `domain-boundary-validator` hard-asserts the app-local API route count, and
  `tests/federation/app-api-route-ownership.test.mjs` asserts the validator's **source text** carries
  the same literal — adding any app route means editing both. `tooling-governance-validator`
  allowlists `scripts/<dir>` names. `whole-repo-end-state-validator` asserts ledger rows and the
  `.gitignore` shape. `prompt-perimeter-validator` matches basenames. `deployment-safety-validator`
  requires exactly one production deploy workflow.
- `environment-validator` flags Firebase Web API keys (public client identifiers) and Razorpay's
  published sample test key id — false positives with no exemption mechanism; the 39-character
  length does not distinguish a public key from a secret; what a Google key authenticates decides.
- Governance documents (Constitution, `AGENTS.md`, DOC 06) bind by **rule**; their counts, paths and
  branch facts have aged (`/Users/saai_sidd/Git/Letbuyy_Store`, "migration 162 next", "107-validator
  gate", "30-commit lag"). Quote rules; measure numbers.
- 200+ migrations sit on top of `000_baseline.sql`; the latest redefinition of an RPC is the current
  one — `grep -l 'FUNCTION public.<name>' database/supabase/migrations/*.sql | tail -1`.

## Tests and suites

- A gate never observed failing is not a gate: revert the fix and watch its test fail; plant an
  offender for any `toEqual([])` sweep.
- `flutter analyze` clean is **not** evidence an app builds (font_awesome 10.x stayed green for three
  phases while both apps were unbuildable); `dart format` is not `dart analyze` (it only parses).
  Prove compilation with `flutter build apk --debug` + `aapt dump badging`.
- `flutter build`, `flutter create`, `flutter pub upgrade` and Gradle write to **tracked** files
  (`gradle.properties` gained two Kotlin flags). `git status` and attribute after every invocation.
- Gradle evaluates `build.gradle` when both `build.gradle` and `build.gradle.kts` exist; read the file
  the build system evaluates. `android-identity-validator` now forbids the duplicate pair.
- `next dev` findings are not product defects until `next build && next start` reproduces them.
- The ephemeral-Postgres helper (`scripts/governance/foundation-ephemeral-postgres.mjs`, used by
  `test:governance`/`test:behavioral`/`test:foundation:wave*`) may touch a Postgres another session is
  using — name a unique throwaway container via `LETBUYY_EXECUTABLE_PG_CONTAINER`/`_DATABASE`, no
  host port, and prove teardown.
- `customer_app`/`admin_app` have 13/11 tests (Phase P), `merchant_app` 172 (the canary),
  `marketplace_core` 165, `marketplace_ui_kit` 54; both `phase_2` apps carry one dead `MyApp isn't a
  class` scaffold error, deliberately left. `merchant_app` has 80 pre-existing analyze infos/warnings.
- `packages/typescript/ui` is the only vitest package; everything else is `node --test`/`tsx --test`.
- The gate's real lane in CI runs on Node 20; locally Node 26 — a syntax that passes here can fail there.

## Secrets and mobile identity

- **Never display a secret to redact it.** Seven-plus values have reached agent output; every incident
  began with a read-then-redact. Use `grep -c`, line numbers, structural substitution anchored on the
  field name. Never diff a `key.properties` against anything; never run `keytool`.
- The Razorpay live pair and three Gemini keys are **dead** (owner deleted them at the providers,
  2026-09-02) but live on in published history on both remotes and in the bundles; recovering source
  from a bundle restores the **committed** state and silently drops uncommitted remediations —
  re-apply `String.fromEnvironment` containment after any bundle recovery.
- Three distinct release keystores exist (`~/LetBuyy-signing-recovery-2026-08-29/`); which one signs
  the Play listing is unproven — only the Play Console certificate fingerprint decides. None is
  tracked (0 hits for `*.jks|key.properties|*.keystore` in `git ls-files`); keep it that way.
- `com.letbuyy.letbuyy` is the one irreplaceable value in the repository
  (`config/governance/android-identity-registry.json`); `admin_app`'s `namespace` deliberately
  differs from its `applicationId` — do not "fix" it. iOS bundle identifiers are ungoverned.
- `services/compatibility/firebase_bridge/config/*.rules` are a **copy**; the live Firebase rules are
  unknown from here. A rules lockdown without its callable replacement breaks the shipped app.

## Toolchain and machine

- bash 3.2 (no `declare -A`, no `mapfile`); `grep` is `ugrep` (regex dialect differs; quote
  `'--include=*.ts'`); zsh aborts on an unmatched glob (`setopt nonomatch` or quote); no `timeout`
  binary; `psql` may not be on PATH. `pnpm` 10.6.2, Node 26.5.1 locally, Flutter 3.44.8 stable.
- Ports: web 9000/9001/9002/9006/9007, Workers 9010–9013 (+ inspectors 9110–9113), Storybook 9009,
  LCIS 3333/3334/3335. `pnpm run dev:store` boots merchant_web + identity + gateway.
- Installing toolchain on this shared machine can break a concurrent session — say so first.
- Never run repo-wide generators unprompted (`generate-design-tokens`, `generate-mobile-tokens`,
  `generate-tenant-table-registry`, `graph:*`); a phase names the exact command as a step.
- LCIS (`pnpm graph:ui` → :3333, `tools/central-intelligence` → :3334) is dev-time tooling: query
  it before scanning the repository, never treat its output as authority over the validators.

## Claim protocol reality

The ledger row is a lock, but **a row on an unmerged branch is invisible from `develop`** — four
duplicate phases happened in EDYNOX with both sessions following the protocol, and this repository
has had three sessions on one branch in one evening. Before scoping: `git worktree list` +
`git branch --list 'letbuyy/*'` + the ledger's `ACTIVE` rows + `git -C <primary> status --short` for
the file family, read for topic overlap.

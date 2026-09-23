# Hazards and standing rules — read before gates, greps, merges, installs, Flutter builds

Every item here cost real time in this programme, most more than once (the memory files under
`~/.claude/projects/-Users-saai-siddharth-Projects-Start-Up-LetBuyy/memory/` hold the incidents).
Measured facts carry the commit they were measured at. **Not a substitute for measuring again.**

## Worktrees and checkouts

- **The primary checkout is not a workspace.** RE-MEASURED 2026-09-23 (F-SKILLFACTS-3):
  `Projects/Start_Up/LetBuyy` is on `develop` at `1e6cc4c3`, clean. The picture this rule was written
  for ended with the 2026-09-20 consolidation: the frozen `feature/claude-md-durable-architecture-memory`
  with 39 modified + 58 untracked files of other sessions, migrations 208–210 among them, and up to
  seven sessions sharing it in one day. The rule stands until the owner changes it: never build, merge,
  commit, run generators or the real gate there. It is now also the only checkout that can hold
  `develop`. Merges into `develop` and their bookkeeping run there by the owner's D-MERGE-LOCATION
  answer (2026-09-23, `decisions.md` §2d); nothing else does.
- **The primary checkout owns `[develop]`** since 2026-09-20. `LetBuyy-develop`, which held it from
  GOV-3 until then, no longer exists, and git refuses a second worktree on `develop` while the primary
  holds it. The standing lesson survives the move: never leave a shared checkout dirty, because an
  uncommitted ledger edit gets absorbed into someone else's commit.
- `.claude/worktrees/*` — RE-MEASURED 2026-09-23: the directory no longer exists and no `claude/*` ref
  remains; nothing is registered outside the repository. For anything like it that reappears, the old
  rule still holds: owner-owned, excluded from repo-wide `grep`/`find`, never pruned or removed.
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
  missing", `a751a2ff`) is a real missing file, not the ratchet.
- `tenant-isolation-validator` reds for the *next* session whenever a migration touches a tenant
  table and `services/api-gateway/src/tenant/tenant-tables.registry.ts` was not regenerated
  (`node scripts/generators/generate-tenant-table-registry.mjs`). Provenance-only drift, still a red gate.
- `sequential-migration-validator` reds on **untracked** migrations and on gaps. As of 2026-09-04 the
  red was another session's uncommitted 208–210 in the primary checkout; those files are STILL untracked
  there (re-measured 2026-09-12), but in a clean worktree this validator PASSES — confirmed in the
  2026-09-12 sweep at `develop` = `6edbbf0e`, where the only two reds are `environment-validator` and
  `stale-artifact-validator`.
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
- `customer_app` has 13 tests (Phase P), `merchant_app` 172 (the canary),
  (`admin_app`'s 11 went with it when FB-1 retired the root on 2026-09-05),
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
  (`config/governance/android-identity-registry.json`). `namespace` may legitimately differ from
  `applicationId` — do not "fix" a divergence. iOS bundle identifiers are ungoverned.
  `com.letbuyy.admin` is now in that file's `retiredApps` section (FB-1, 2026-09-05) and the validator
  fails if any tracked Gradle script declares it: a retired identity is not a free name.
- `services/compatibility/firebase_bridge` was **deleted in FB-1** (2026-09-05). Its `config/*.rules`
  were only ever a copy — the live Firebase rules were always `UNKNOWN_LIVE_STATE` from here. Read
  two consequences honestly: (a) the security findings in `references/security.md` that were measured
  against that copy are no longer verifiable from the working tree, only from git history at the
  parent of `letbuyy/fb1-retire-firebase-admin-app`; and (b) they remain **live risks until the owner
  deletes the Firebase project itself** (FB-5) — deleting this repository's copy retires the bridge,
  not the exposure.

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

## Ambient reds on the committed tree — measured 2026-09-04 in a clean worktree at `a751a2ff` (GOV-3 gate rehearsal)

Attribute, never inherit. Re-measure with `gate.sh` on the branch you are on.

- **typecheck — CLOSED 2026-09-05 (F-INFRA-2, `4724fe6d`). The lane is GREEN: 81 successful / 81
  tasks, exit 0.** It was 29 × `TS2322` in `cashfree-adapter`, `paypal-adapter`, `stripe-adapter`
  (`PaymentProviderName` no longer admitted the retired rails); the adapters were `SAFE_DELETE`d
  under **D-16**. Do not inherit this red — if typecheck is red on your branch, it is **yours**.
- **The "Turbo: 31 successful / 49 tasks" that used to sit in the line above was the most important
  number on this page and was read as a statistic for months.** 18 tasks did not run: turbo cancels a
  failing task's dependents, so that single red was **suppressing the typecheck of 16 packages,
  `@letbuyy/api-gateway` among them** — which is how a function imported but defined in no commit
  left the canonical backend uncompilable on `develop` through every gate run (GW-1, `de769df5`).
  F-INFRA-1 (`8331728e`) added `--continue` to every root turbo lane so a failure can no longer
  cancel the rest, and `gate.sh` now prints `(+N more)` and `[NO OUTPUT: <packages>]`.
  **Whenever a lane reports `N successful / M total` with `M > N`, the gap is work that never ran —
  read it as coverage lost, never as a summary statistic.**
- **lint** — `@letbuyy/customer-web#lint`: 921 problems / 38 errors, first in
  `apps/customer_web/scripts/liquid-parity-harness.mjs` — identical to the Phase M baseline
  (`12_final_verification.md`). `identity-platform` 26, `admin-web` 114, `marketing-site` 326 warnings,
  0 errors → pass. The **dirty primary** additionally reports errors in `merchant_web`
  (`SettingsPane.tsx`) and `identity-platform` (`resend.ts`) — other sessions' uncommitted files.
- **A gate count is not a gate SET — compare failure NAMES (ROUTE-1 → ROUTE-2, 2026-09-05).** The
  gate table prints a count and the **first** failure line per lane. ROUTE-1 introduced a contract
  failure and, in the same run, a different contract failure did not reproduce — so `test:contracts`
  read `exit=1`, first line `custom-domain tables remain api-gateway single-writer owned` (ambient),
  count 8 before and 8 after. A one-in/one-out swap is **invisible** in that summary, and the
  regression merged. Attribute by diffing failure NAMES between the phase base and the tip
  (`grep '^✖' | sed 's/ ([0-9.]*ms)//' | sort -u`, then `comm`), never by comparing totals.
- **Never symlink another worktree's `node_modules`.** Doing it in the ROUTE-2 worktree made
  `liquid-commerce-embeds.test.ts` fail deterministically there while passing on `develop`, and
  briefly produced a false "this contract test is flaky" finding. Run `pnpm install
  --frozen-lockfile` in the phase worktree; workspace resolution is path-sensitive.
- **Re-run the tests your LATER change affects, not the one you just edited.** ROUTE-1's W1 ran the
  engagement contract test (green), then W2 moved a route band out of `public-routes.ts` and only the
  *public-routes* test was re-run — while the engagement test anchored on a marker W2 had removed.
- **validator sweep** (each run individually). **Two of these were CLOSED by phase FB-1 on
  2026-09-05** — measured side by side, the FB-1 worktree against `develop` at `ad490b84`:
  `foundation-antifabrication-gate` now **PASSES** (its only offender was the inert
  `firebase_bridge/src/commissionService.ts` hardcoded-payout literal, and the bridge is deleted), and
  `environment-validator`'s offender list dropped **14 → 7** (the six `admin_app` Firebase client-config
  files and `firebase_bridge/src/adminAuth.ts` are gone). What remains red there is
  `environment-validator` on 7 files: `customer_app`'s Firebase client config ×6 — public identifiers,
  and the target of FB-4 — plus `marketplace_services/custom_payment_service.dart`, Razorpay's
  published sample test key id. Still red for their own reasons: `sequential-migration-validator` (gap 207 → 211: another
  session's **untracked** 208–210) · `tenant-isolation-validator` (the generated registry already
  cites `208_…`/`209_…`, which are not tracked — same root cause; **do not regenerate**, that would
  strip the other session's pending entries) · `stale-artifact-validator` (method artifact when run
  individually; offender list 100% generated dirs) · `platform-domain-literal-validator` — GOV-3's
  own regression (a rule sentence quoting the retired domain literal), fixed in the same phase.
  **Green on the clean tree but red in the dirty primary:** `validate-design-system` (the primary's
  uncommitted deletion of `apps/identity-platform/src/lib/useAuthTheme.ts`; resolved 2026-09-23, when the deletion
  landed through F-IDUI-1 under D-AUTH-LIGHT), `raw-error-message-validator`,
  and the "untracked migration" variant of `sequential-migration`. `branch-lag-guard-validator` is
  green after the D-BRANCH retarget.
- **`pnpm run test:contracts`** — **CLOSED 2026-09-12.** Measured locally at `develop` = `6edbbf0e`:
  **277 tests, 277 pass, 0 fail**. This entry previously read *202 tests, 195 pass, 7 fail … Phase M
  rename fallout … Owner: CI-1* and listed each failure by name. All seven were opened one at a time
  and **every one was a stale assertion, not a regression** — F-RENAMESTALE-1 (the `apps/customer-web/src`
  dash form and the literal `"apps/mobile/merchant-app"`), F-ARCHIVEPATH-1 (theme-editor dead-shell and
  the TypeScript dead-source archive, both broken by commit `fd08b670` rewriting archive path STRINGS
  while renaming no archive file), F-CONTRACTSCOPE-1 (the retired `.store` target in a compatibility
  bridge, storefront reserved labels, the settings apps route twin). **Kept as history because the
  wording was the hazard:** "expected ambient failures, owner CI-1" is what let nine phases diff past
  them, and if this lane goes red again it is a NEW finding, not this one.
- **`pnpm run test:unit:gateway`** — **CLOSED 2026-09-12.** Measured locally at `develop` = `6edbbf0e`:
  **962 tests, 953 pass, 0 fail, 9 skipped**. This entry previously read *666 tests, 654 pass, 3 fail,
  the exact Phase M baseline set*. Two of that trio were repaired — F-WEBHOOKTEST-1 (`razorpay webhook
  verifies raw-body signatures…`, where the code was STRONGER than the test: the rejection had gained a
  second independent check and a ternary, which is what stopped the literal regex matching) and
  F-ARCHIVEPATH-1 (`storefront proxy rewrites resolved store hosts…`, where `resolveStorefrontHost`
  gained a third argument). The third, `razorpay payment verification validates signatures before
  confirming payment`, is **not in the current failure set** and was not separately investigated by
  those phases. The instruction that stood here — *each must be re-read against the route before it is
  called a defect or a stale check* — was correct and is why all of them turned out to be stale.

## Claim protocol reality

The ledger row is a lock, but **a row on an unmerged branch is invisible from `develop`** — four
duplicate phases happened in EDYNOX with both sessions following the protocol, and this repository
has had three sessions on one branch in one evening. Before scoping: `git worktree list` +
`git branch --list 'letbuyy/*'` + the ledger's `ACTIVE` rows + `git -C <primary> status --short` for
the file family, read for topic overlap.

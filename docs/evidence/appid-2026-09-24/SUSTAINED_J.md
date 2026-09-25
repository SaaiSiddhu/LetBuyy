# SUSTAINED-J — Phase 1: harness isolation and evidence-accounting closure

Owner directive: "COMPLETE TEST ISOLATION AND THE UNIFIED BUYER ACCOUNT", Phase 1 of 2. This
document covers Phase 1 only; Phase 2 (buyer profile/address foundation) is a separate phase branch
and evidence doc.

## Workstream 1 — reconciled the acceptance accounting

See `SUSTAINED_I_REGRESSION_TRIAGE.md`'s corrections (its own diff in this phase's commits): the
21-vs-27 arithmetic gap was `not ok 510` (branch-dispositions validator) being investigated and
confirmed pre-existing during SUSTAINED-I but never added to the evidence table, plus a Node
test-runner accounting nuance (the suite-level `hookFailed` line is visible in TAP output but not
counted in `# fail`). An exhaustive 28-row TAP-line enumeration table now exists for the final run.
`SUSTAINED_PROGRAMME_RECORD.md`'s D4/D6 mischaracterization ("NOT STARTED") is also corrected there.

## Workstream 2 — Postgres shim and role-cleanup: rigorous isolation proof

The prior "6-second lock wait" experiment showed the cleanup mechanism *can* block; it did not prove
scope, non-destructiveness under real concurrency, or recoverability. This phase adds five
independent, more decisive proofs, all run against the actual shim (`scripts/dev/docker-shim/docker`)
and the actual native `postgresql-16` cluster this container provides (Docker's daemon is not
present; `docker info` fails; the shim re-execs a real `docker` when one is reachable and only
engages otherwise — read in full for this phase).

### 2a. Shim mechanics, read from source, not inferred

`scripts/dev/docker-shim/docker`'s `exec` handler (the one path every suite actually uses) does
**not** distinguish container identity for `psql`/`pg_isready` calls — it runs every one against the
single native cluster regardless of the container name given. `inspect`/`inspect -f` *do* check a
per-container marker file (`$MARKER_DIR/$container.{exists,running}`), so container existence checks
work, but there is no real per-container process or data isolation in this environment — "container"
is a bookkeeping label, not an isolation boundary. This matters directly for workstream 3 below: the
safety a "dedicated, uniquely-named throwaway container" actually buys under this shim comes from
`run-executable-suites.mjs`'s own **per-suite unique database name** (`databaseNameFor()`) plus its
explicit `DROP DATABASE ... WITH (FORCE)` before and after each suite — not from container-level
isolation, which does not exist here. This was previously undocumented; recorded here because
workstream 3's fix depends on understanding it correctly.

### 2b. Scope proof — a non-`letbuyy_`-prefixed decoy is provably untouched (stronger than "unchanged")

Planted a decoy database `not_letbuyy_should_never_touch` with a table owned by `app_user` and a
grant to `service_role`. Ran `whatsapp-postgres.test.mjs` (which calls
`clearRoleDependenciesInSiblingDatabases(['app_user','service_role','authenticated'])`). Result: the
suite's own `DROP ROLE app_user` **failed** — `role "app_user" cannot be dropped ... 1 object in
database not_letbuyy_should_never_touch` — which is the *correct*, expected outcome and a stronger
proof than "the decoy survived": it demonstrates the scoping filter (`WHERE datname LIKE
'letbuyy\_%'`) genuinely excluded the decoy from cleanup, observable via the resulting failure, not
merely inferred from its state being unchanged. Removed the decoy; the identical suite then passed
cleanly (`pass=1, fail=0`).

### 2c. Non-destructiveness under an OWNED object — re-confirmed (carried from SUSTAINED-I, still holds)

`SUSTAINED_I_ROLE_CLEANUP_SAFETY.md` already proved this with a fresh empirical run: a table OWNED
(not merely granted) by a to-be-dropped role survives cleanup with its data intact, ownership only
reassigned to `postgres`. Not re-run this phase (no code changed in the cleanup function itself since
that proof); cited as still-valid evidence.

### 2d. Concurrency proof — two genuinely concurrent processes, not a synthetic lock

Launched two **real, independent `node --test` processes** at the same time against the same shared
cluster: `buyer-verified-ownership-postgres.test.mjs` (own database, 12 subtests, ~93s) and
`whatsapp-postgres.test.mjs` (shared database, calls the cleanup function, ~1s). Result:

- **Suite A (buyer-verified-ownership) completed all 12/12 subtests successfully** — its prerequisites
  were **not destroyed** by the concurrent cleanup pass touching its database.
- **Suite B (whatsapp) failed its own `DROP ROLE service_role`** — `6 objects in database
  letbuyy_p3_buyer_ownership` — because A, still running, re-created a role grant in its own database
  *after* B's one-time cleanup pass ran but *before* B's own `DROP ROLE` statement executed a few
  lines later in the same script (a genuine time-of-check-to-time-of-use race between two
  independent processes, not a bug in the cleanup's scoping).
- Re-running B alone (no concurrent A) passed cleanly, matching the earlier standalone result —
  confirming the failure was a **transient, self-recoverable interference**, not corruption or lost
  work.

**Honest scope of this finding**: `test:behavioral`'s own supported execution mode
(`node --test --test-concurrency=1 <files>`) never runs two suite *files* concurrently within one
invocation — this race can only occur between **two independent processes** (e.g., two Claude Code
sessions, or two worktrees, both running `test:behavioral`/`run-executable-suites.mjs` against the
same physical cluster at the same time). That scenario was already an acknowledged risk before this
phase (`run-executable-suites.mjs`'s own comment: "the shared `letbuyy-executable-pg` container
carries other sessions' in-progress state"). This phase's fix does not add or remove that risk; it
adds proof of exactly what does and does not happen when it occurs: **no destruction of another
process's prerequisites, only a transient, cleanly recoverable failure** for whichever side loses a
narrow race window. Solving true multi-process mutual exclusion (e.g., an advisory lock held for the
cleanup+reset sequence) is a larger change than this bounded phase's scope and is recorded as a
candidate for a future phase, not attempted here.

### 2e. Failure/interrupted-run recovery — identifiable and safely recoverable

Started `tax-postgres.test.mjs`, `SIGKILL`ed it mid-run (0.6s in, before completion). The shared
`letbuyy_executable` database was left in whatever partial state the kill caught it in (a named,
deterministic, identifiable resource — not a randomly-named orphan). Re-ran the same suite
immediately afterward with no manual intervention: **passed cleanly (`pass=1, fail=0`)** — its own
unconditional `DROP SCHEMA public CASCADE` + role recreate at the start of `resetDatabase()`
self-healed the partial state, exactly the intended design.

### 2f. Unsupported commands fail clearly

`docker ps` → `docker-shim: unsupported command 'ps' (only inspect/run/start/stop/exec are modeled)`,
exit 1. `docker exec -i letbuyy-executable-pg bash -c "..."` → `docker-shim: unsupported exec command
'bash' (only psql/pg_isready are modeled)`, exit 1. Both confirmed live this phase, not merely read
from source.

**Nothing in this phase changed `clearRoleDependenciesInSiblingDatabases` itself** — the mechanism
already merged in SUSTAINED-I is proven more rigorously here, not modified. No broad CASCADE was
added, no destructive-operation guard was weakened, no teardown error was silently swallowed (the
function's own `try/catch` only wraps its *pre-clean* pass with a `console.warn`; the suites' own
`DROP ROLE` statements that follow are never wrapped and surface as real, visible test failures when
a genuine problem exists — exactly what 2b and 2d demonstrate).

## Workstream 3 — the 4 destructive-guard suites now get their required dedicated environment

**Root cause, confirmed precisely**: `test:behavioral`'s previous one-line `package.json` script
(`node scripts/governance/foundation-ephemeral-postgres.mjs start && node --test
--test-concurrency=1 tests/*/*.test.mjs`) never set `LETBUYY_EXECUTABLE_PG_CONTAINER`, so any suite
whose own guard clause refuses the shared default container name threw at module load, every run,
regardless of any code change — a structural gap in the harness invocation, not a code defect in the
suites (their guard is correct and must not be weakened).

**Fix**: new `scripts/governance/test-behavioral.mjs` wraps the same overall command. It discovers
every `tests/*/*.test.mjs` file (byte-identical to the old glob — verified `find tests -name
"*.test.mjs"` = `ls tests/*/*.test.mjs` = 228 files, no nested subdirectories exist), separates the 4
destructive-guard suites (an explicit, reviewed allowlist, not a live grep of the guard string) from
the rest, and:

1. Starts the shared ephemeral Postgres fixture (unchanged).
2. Runs each of the 4 guard suites through `scripts/governance/run-executable-suites.mjs --filter
   <exact-filename>` — the tool already built for exactly this lifecycle (CAP-C66; used today by
   `pnpm run test:executable`), reused rather than reimplemented. Each invocation gets its own
   uniquely-named container + a per-suite unique database, created immediately before and dropped
   immediately after.
3. Runs the remaining 224 suites through the original bare `node --test --test-concurrency=1
   <files>` invocation, unchanged.
4. Exits non-zero if any step failed, composing exactly like the invocation it replaces.

`package.json`'s `test:behavioral` script now reads `"node scripts/governance/test-behavioral.mjs"`.
`.github/workflows/ci.yml` calls `pnpm run test:behavioral` by name in both places it appears and is
unaffected by the internal change; a real Docker daemon is available there, so `run-executable-suites
.mjs`'s calls to `docker` work natively rather than through the shim.

**Verified — the guard is preserved, not weakened**: ran each of the 4 through the new wrapper's own
mechanism.

- `checkout-order-concurrency-postgres.test.mjs`: **5/5 real assertions pass** (verified standalone
  with an explicit dedicated container/database env, matching what the wrapper sets).
- `late-capture-after-release-postgres.test.mjs`: pass (via `run-executable-suites.mjs --filter`).
- `money-rpc-idempotency-sweep-postgres.test.mjs`: pass (via `run-executable-suites.mjs --filter`).
- `gift-card-issue-idempotency-postgres.test.mjs`: **fails** — but not because of anything this
  workstream touched. See the next section.
- Running any of the 4 **without** the dedicated environment still throws the exact same guard error
  it always has — the guard itself is untouched, confirmed by reading the diff (`git diff` on all 4
  files touches nothing; only `package.json` and the new wrapper script changed).

## A genuine, previously-invisible, pre-existing defect this fix surfaced (out of scope for this phase)

`gift-card-issue-idempotency-postgres.test.mjs` is designed to first *reproduce* a historical
double-issuance defect (varying-code replay of one idempotency key, pre-migration-207), then prove
migration 207's advisory-lock fix resolves it. Given its required dedicated environment for the first
time in this session's history (it always refused to run before — this is the first execution of its
real assertions, ever, in this programme), its own reproduction step fails:
`expected the varying-code defect to duplicate accounts (>1), got 1` — the pre-207 code path did
**not** reproduce the defect this run; it deduplicated correctly anyway.

**Evidence this is genuinely pre-existing, not caused by any SUSTAINED phase**: both the test file and
migration 207 were last touched by `d705397` (2026-09-23), confirmed an ancestor of `41af1cd9` (the
pre-programme baseline) — no phase A through J touched either file. This is the first time in the
entire session this specific assertion has ever executed (previously always blocked by its own
guard), so it was structurally impossible for any earlier phase to have discovered it.

**Assessment against Phase 2 acceptance**: this is a gift-card/loyalty-domain finding, unrelated to
buyer profile/address/session work. **It does not block Phase 2.** Not investigated further this
phase (root-causing a money-domain historical-regression-reproduction test is exactly the kind of
"unrelated cosmetic failure" this phase's own instructions say not to spend the whole session on, and
fixing gift-card issuance logic would need its own ARB-scoped review given the Constitution's money
invariants) — recorded honestly as a first-observed, evidenced, out-of-scope finding for a future
bounded phase, not fixed, not hidden, not silently skipped.

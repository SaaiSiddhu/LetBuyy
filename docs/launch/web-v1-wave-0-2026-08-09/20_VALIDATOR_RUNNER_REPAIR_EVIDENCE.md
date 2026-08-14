# 20 — Validator Runner Repair Evidence

**Evidence artifact, not governance authority.**
This document records what was changed, what was executed, and what was observed. It does not amend the Constitution, `AGENTS.md`, or any canonical governance document. Where it disagrees with a prior Wave 0 evidence doc, both readings are shown and the difference is explained — nothing is silently overwritten.

| Field | Value |
|---|---|
| Baseline SHA | `ee3711829d857e986014c5811bb94d86ebc3d343` (human-approved Wave 0 baseline; `= ee371182`, tip of `stepup/main`) |
| Branch worked on | `codex/w0-validator-execution` |
| Worktree | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-validator-execution` (isolated, clean at baseline before work) |
| Commits produced (local only, not pushed) | `369f7918` `fix(governance): make silently non-blocking validator findings block`<br>`02b6374d` `feat(governance): run and report every validator instead of failing fast` |
| Date | 2026-08-09 |
| Node | `v26.5.1` |
| Original repository | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — **not modified**. Nothing was written to it outside `docs/launch/web-v1-wave-0-2026-08-09/` and `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/`. No Supabase, provider, deploy, push, reset, clean, stash, restore, or checkout operation was run anywhere. |

**Authority consulted:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (supreme) → root `AGENTS.md` **DOC-R5** (`AGENTS.md:306`, "MUST run `node scripts/validate-governance.mjs` after topology, import, package, environment, generated-artifact, or governance-memory changes") → `scripts/validators/README.md`. DOC-R5 is the rule this repair serves: a mandate to run the gate is worthless if the gate stops after two validators.

---

## 0. What was EXECUTED vs INFERRED vs UNVERIFIED

**EXECUTED** (commands run, exit codes observed, logs persisted):
- `node scripts/validate-governance.mjs --lane=gate` before the repair → exit **1**.
- `node scripts/validate-governance.mjs --lane=gate --validator-timeout-ms=180000 --report-json=…` after the repair → exit **1**, full 108-validator matrix captured.
- `node scripts/validate-governance.mjs --lane=report --report-json=…` after the repair → exit **0**.
- `node scripts/validate-governance.mjs --lane=gate --plan` → exit 0, inventory-only listing.
- `node --test tests/governance/validator-orchestration.test.mjs tests/governance/branch-lag-guard.test.mjs` → exit **0**, 30/30 pass.
- `node --test tests/governance/phase-b-validators.test.mjs tests/governance/whole-repo-end-state.test.mjs tests/governance/foundation-wave0.test.mjs tests/governance/phase-c-forced-decisions.test.mjs` → exit 0, 25/25 pass (regression check on the tests that read the runner source).
- `node --test tests/security/environment-honesty.test.mjs` → exit 0 (also reads the runner source).
- Individual validator runs of `pricing-catalog-validator.mjs` and `branch-lag-guard-validator.mjs` before and after the change.

**INFERRED** (reasoned from source or from evidence, not directly executed):
- That 23 of the 24 post-repair non-PASS results are pre-existing at the baseline rather than caused by this repair. Basis: only five source files were touched, three of them the runner/orchestrator/reporter and two of them the soft-fail validators; no failure message in the post-repair log references any touched file or the new module (`grep -n "validator-orchestrator\|scripts/governance" post-repair-gate.log` → 0 hits). This was **not** proven by re-running each validator against a pristine baseline checkout, because doing so would have required a second worktree or a destructive tree operation.
- That CI would produce the same matrix. CI was not run; see §8.

**UNVERIFIED** (explicitly not measured here):
- Behaviour of the repaired runner inside GitHub Actions.
- Behaviour of the generated-artifact cleanup against a tree that actually contains `node_modules` — this worktree has **zero** generated directories under `apps/`, `packages/`, `services/` (verified by `find`), so the cleanup executed as a genuine no-op (`0 removed, 0 refused, 0 errors`). The hardening is proven by unit tests against temporary fixtures, not by a live deletion.
- `pnpm run build`, `pnpm run lint`, `pnpm run typecheck`, the test suites, and the Flutter toolchain. Out of scope for this task; see doc 10 §3 for their separately measured state.

---

## 1. The defects being repaired

### D1 — Fail-fast made 106 of 108 validators unknown

`scripts/validate-governance.mjs:190-204` at the baseline:

```js
for (const validator of selectedValidators) {
  …
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);      // ← kills the whole run
  }
}
```

The first non-zero child status terminated the Node process. Every validator after that point was **never spawned** — not skipped, not attempted, not reported. The gate's own success line (`Governance ${lane} lane passed (${selectedValidators.length} validators).`) also reported the *declared* count, not the *executed* count, so a passing run advertised a number it had not necessarily earned.

Measured at the baseline in this clean worktree:

```
$ node scripts/validate-governance.mjs --lane=gate
Foundation anti-fabrication gate passed (1905 active source files scanned; 0 temporary entries tracked).
Tenant isolation validator failed:
- services/api-gateway/src/tenant/tenant-tables.registry.ts must match schema-derived tenant table registry; …
EXIT=1
```

**2 of 108 validators ran. 106 never executed.**

> **Discrepancy with doc 10 (Phase 1), recorded not reconciled away.** Doc 10 measured the fail-fast stop at validator **#6** (`validate-design-system.mjs`) with `tenant-isolation-validator` **passing**. This audit measures the stop at validator **#2** (`tenant-isolation-validator` failing). Both are correct for what they measured: doc 10 ran inside the **dirty** original working tree (6,825–6,826 modified paths), this audit ran inside a **clean** worktree at the same commit. The difference is direct evidence that the committed tree and the working tree disagree — the generated tenant-table registry, and several design-system inputs, differ between them. **The committed state is worse than the working tree suggested.** This is a real finding, not a measurement error, and it is why "never copy a prior readiness number" matters.

### D2 — Two validators could never block

`scripts/validators/governance-common.mjs` exposed `warn(condition, message)`, which pushed into a `warnings` array that `finish()` printed to stderr and then ignored — only `errors` triggered `process.exit(1)`. Exactly two validators used it:

- `branch-lag-guard-validator.mjs:98-104` — local-mode branch lag.
- `pricing-catalog-validator.mjs:105-108` — the "pricing component hardcodes the compare matrix" single-source heuristic.

Both therefore documented an invariant they could not enforce.

### D3 — An unexecuted `fs.rmSync` that would fire once the gate stopped failing fast

`scripts/validate-governance.mjs:170-193` at the baseline walked `apps/`, `packages/`, `services/` from **`process.cwd()`** and called `fs.rmSync(absPath, { recursive: true, force: true })` on any directory whose basename was in a 12-name generated-artifact list — including the extremely generic `build`, `dist`, and `coverage`. It ran immediately before `stale-artifact-validator.mjs`, gate index 71. Because the gate died at index 2 (or 6), **it had never executed.** Repairing the fail-fast would have made a never-tested recursive delete run for the first time. That is the sharpest edge in this task and is handled in §4.

### D4 — False-green patterns documented, not fixed (out of scope for this task)

Recorded in §7 so they are not lost.

---

## 2. What changed

Seven files, two commits, `+1529 / −64`:

```
 scripts/governance/validator-orchestrator.mjs     | 652 ++++++++++++  (new)
 scripts/validate-governance.mjs                   | 354 ++++++++--
 scripts/validators/branch-lag-guard-validator.mjs |  17 +-
 scripts/validators/governance-common.mjs          |  37 +-
 scripts/validators/pricing-catalog-validator.mjs  |   7 +-
 tests/governance/branch-lag-guard.test.mjs        |  34 +-
 tests/governance/validator-orchestration.test.mjs | 492 ++++++++++  (new)
```

`scripts/validate-governance.mjs` keeps the lane manifests as literal string arrays. That is deliberate: `tooling-governance-validator.mjs:57-58`, `whole-repo-end-state-validator.mjs:155-164`, `operational-lifecycle-validator.mjs:47-51`, `branch-lag-guard-validator.mjs:36-39`, `meta-no-theater-validator.mjs:27-40`, and `tests/security/environment-honesty.test.mjs:17` all regex the runner's source for validator names. Moving the manifests out of the file would have silently disarmed six existing checks. Orchestration — and only orchestration — moved to `scripts/governance/validator-orchestrator.mjs` (a directory `tooling-governance-validator.mjs:19` already sanctions).

### 2.1 Dynamic discovery — no hardcoded count anywhere

The runner enumerates `scripts/validators/*.mjs` on every run and reconciles it against the declared lanes. Measured live, printed in the run header:

```
discovered on disk    : 112 .mjs modules
  executable validators: 109
  library modules      : 2 (governance-common.mjs, phase-b-common.mjs)
  hook-only modules    : 1 (frozen-path-override-gate.mjs)
declared in lanes     : 109 (gate 108, report 1)
selected for this run : 108
```

**The current count is 108 gate-lane validators + 1 report-lane validator.** The "107" in `.github/workflows/security-review.yml:7` and in root `CLAUDE.md` is stale by one; that is a documentation fix outside this task's perimeter and is left as an open item (§8). The runner no longer restates any count — a test asserts the source contains no frozen `10[78] validators` string.

Drift is a **hard failure** in both directions:
- an executable `.mjs` on disk declared in no lane → failure;
- a lane entry with no file on disk → failure (and the entry is reported `BLOCKED`, never passed).

`governance-common.mjs` and `phase-b-common.mjs` are declared library modules; `frozen-path-override-gate.mjs` is declared hook-only (it is invoked from `scripts/git-hooks/pre-commit` and `commit-msg`). These declarations are explicit in the runner source, so "not a validator" is now a stated fact rather than an omission.

### 2.2 No fail-fast; typed, reasoned statuses

Every selected validator now runs. Results are typed:

| Status | Meaning | Counts toward green? |
|---|---|---|
| `PASS` | ran, exit 0 | yes |
| `FAIL` | ran, non-zero exit — invariant evaluated and violated | **no** |
| `BLOCKED` | could **not** run: module missing from disk, unresolvable import, spawn error, or per-validator timeout. The invariant was never evaluated. | **no** |
| `SKIP` | deliberately withheld, with a stated reason | **no** (a required SKIP is called out explicitly) |
| `NOT_APPLICABLE` | outside the selected lane, with a stated reason | yes (accounted for, never omitted) |

Every non-`PASS` status carries a reason string. Each validator's own exit code and full stdout/stderr are preserved and echoed.

`BLOCKED` vs `FAIL` is a real distinction, not cosmetic. Two validators in the current run die on `Cannot find package 'typescript'` — they never evaluated anything. Calling that "FAIL" would imply the invariant was checked and violated. Both are non-zero; only `BLOCKED` says *this check did not run*.

### 2.3 Exit policy — no representable false green

`computeGateOutcome()` returns non-zero when **any** of the following holds:

1. any validator `FAIL`ed;
2. any validator was `BLOCKED`;
3. any **required** validator was `SKIP`ped (manifest validators are required unless optionality is *explicitly declared* — there is no implicit optional tier);
4. the selected set is empty;
5. nothing actually executed;
6. the on-disk inventory drifted from the declared lanes;
7. the run happened outside the repository root that owns the script.

Failures are never downgraded to warnings and no error is swallowed. The exit code is the first failing validator's own exit code where one exists (clamped to 1–255), otherwise `1` — so a single-failure run still surfaces that validator's signal.

A preflight hook may withhold execution (`SKIP`/`BLOCKED`) but **cannot** assert success: any other status returned by a hook is coerced to `BLOCKED` with the reason *"only SKIP and BLOCKED may withhold execution"*. This closes the obvious future backdoor.

### 2.4 Machine-readable matrix

`--report-json=<path>` writes the full matrix (inventory, per-validator status/exit/duration/reason, advisories, aggregate problems). `--plan` prints the inventory without executing anything and prints `NO VALIDATORS EXECUTED` so it can never be mistaken for a gate result.

---

## 3. The two soft-fail validators

### 3.1 `branch-lag-guard-validator.mjs` — now blocking, and it FAILS today

`reporter.warn` → `reporter.assert` in the local (non-CI) mode. **No environment escape hatch was added**, deliberately: an opt-out would reintroduce exactly the silent non-blocking behaviour being removed. A test asserts the file contains neither `reporter.warn(` nor `reporter.advisory(`.

**Consequence, reported as a true result rather than hidden:**

```
Branch lag guard validator failed:
- Local working branch is 106 commit(s) ahead of main; main must be fast-forwarded
  (execute MERGE_RUNBOOK.md) before this branch can be treated as release-integrated
[103/108] FAIL  branch-lag-guard-validator.mjs (44ms) — validator exited 1
```

This is the real release-integration state of `stepup/main`: `main` is 106 commits behind locally and `origin/main` is 291 behind. Previously the gate printed that fact to stderr and exited 0 anyway.

**Operational consequence that a human must decide on (escalation, not a defect I can resolve):** with this change, the gate cannot go green on any branch that is ahead of `main` — which is every feature branch, by construction. Three futures exist and only one of them should be chosen by a human:
1. **Fast-forward `main`** (execute `MERGE_RUNBOOK.md`). This makes the check green *and* fixes the underlying 291-commit divergence. This is the outcome the check is designed to force.
2. **Re-scope the local-mode check** so it compares against the integration branch rather than `main`, keeping it blocking but semantically correct for feature branches.
3. **Declare it advisory** via the new `reporter.advisory()` channel — legitimate only if written down, because advisories are printed in the matrix under `DECLARED ADVISORIES`.
Doing nothing is not neutral: it leaves a gate that no branch can pass. **This decision is deferred to a human.**

### 3.2 `pricing-catalog-validator.mjs` — now blocking, currently zero offenders

The single-source heuristic (`≥ 8` inline `commerce_os:` keys in a pricing component ⇒ the compare matrix is hardcoded rather than read from `/api/plans`) moved from `warn` to `assert`. Measured: the validator reports **zero** offenders today and `PASS`es (gate index 86). So this changed the ceiling, not the current result.

**Residual risk, declared:** the check is a *heuristic*, and it is now hard-blocking. A legitimate future pricing component with many `commerce_os:` keys would be a false positive that blocks the gate. If that happens the correct fix is to sharpen the heuristic, **not** to revert it to `warn`.

### 3.3 New explicit advisory channel

`createReporter()` gains `advisory(condition, message)` for findings that are non-blocking **by declaration**. Each advisory is emitted with a machine marker (`##governance-advisory##`) which the runner parses and prints under `DECLARED ADVISORIES` in the matrix. `warn()` is retained only as a deprecated alias that *also* records an advisory, so a future caller cannot make a finding silent again. A test scans every validator on disk and fails if any non-comment line still calls `reporter.warn(`.

**Advisories in the current gate run: 0.** Nothing is hiding behind this channel today.

---

## 4. SAFETY-CRITICAL: the `fs.rmSync` audit

The recursive delete had **never executed** because the gate died at index 2. Making all validators run makes it fire. It was hardened before the first full run.

### 4.1 Hazards found in the baseline implementation

| # | Hazard | Baseline behaviour |
|---|---|---|
| H1 | **Anchored to `process.cwd()`, not the repo.** `walk(path.join(process.cwd(), dir))`. Running `node /path/to/repo/scripts/validate-governance.mjs` from any other directory would walk *that* directory's `apps/`, `packages/`, `services/` and recursively delete matching subdirectories. Nothing tied the deletion to the repository the script belongs to. | unconstrained |
| H2 | **Deletes git-tracked content.** No tracked-state check. Any committed directory named `dist`, `build`, `coverage`, `Pods`, … under `apps/`/`packages/`/`services/` would be destroyed, and the loss would look like an ordinary working-tree deletion. |unconstrained |
| H3 | **Generic names.** `build`, `dist`, `coverage` are ordinary source-directory names. | unconstrained |
| H4 | **Silent.** No log of what was deleted; no dry run. | silent |
| H5 | **No path-containment re-check.** Nothing asserted the resolved target was inside the repository. | absent |
| H6 | Symlinks were skipped only incidentally (`entry.isDirectory()` is false for symlinks) with no explicit intent, no test, and no refusal record. | incidental |

### 4.2 Guards now enforced

Implemented in `planGeneratedArtifactCleanup()` / `executeGeneratedArtifactCleanup()`, with the plan computed **before** anything is deleted:

1. **Repo-anchored, never cwd-anchored.** `repoRoot` is derived from the script's own location (`fileURLToPath(import.meta.url)` → `..`). If `process.cwd()` is not that root, the cleanup is **refused** and the run additionally reports a hard problem. **This is the guard that makes it impossible for a run in this worktree to touch the original dirty repository at `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`.**
2. **Symlinks are never followed and never deleted.** A symlink named `node_modules` is recorded as a refusal, not a target.
3. **Realpath containment.** Every candidate is `realpath`-resolved and must lie strictly inside the resolved repo root, otherwise refused.
4. **Start directories must be inside the root.** `../..`, `/`, and absolute escapes are refused.
5. **Minimum depth 2.** The repo root itself and any top-level directory can never be a target.
6. **Never deletes git-tracked directories.** A single `git ls-files -z` builds the tracked-directory set; any candidate containing tracked files is refused.
7. **Fails closed.** If tracked state cannot be read (not a git repo, git missing), the predicate returns `true` for everything — nothing is deleted.
8. **`.git` is never walked.**
9. **Guards re-asserted at execution time.** Containment and basename are re-checked immediately before each `rmSync`, so a forged or stale plan cannot widen the blast radius.
10. **Nothing is silent.** Every removal and every refusal is logged; counts appear in the run output.
11. **A cleanup error blocks its dependent validator.** If the cleanup errors or is refused, `stale-artifact-validator.mjs` is reported `BLOCKED` with that reason — it is never allowed to pass on a tree the cleanup could not prepare.

### 4.3 What actually happened on the first-ever execution

```
generated-artifact cleanup: 0 directory(ies) removed, 0 refused, 0 error(s)
[ 71/108] PASS  stale-artifact-validator.mjs (157ms)
```

This worktree has **no** `node_modules`/`dist`/`build`/… anywhere under `apps/`, `packages/`, `services/` (independently confirmed with `find … | wc -l` → `0`), so the first real execution was a verified no-op. The hardening is proven by unit tests against temporary fixtures (§5), not by a live deletion — stated plainly as a limit of this evidence.

---

## 5. Tests added

`tests/governance/validator-orchestration.test.mjs` (25 tests) and the reworked `tests/governance/branch-lag-guard.test.mjs` (5 tests). **30/30 pass, exit 0.**

Required proofs:

| Required proof | Test | Result |
|---|---|---|
| **(a)** a failure in validator 1 does not stop validators 2..N being reported | `(a) a failing validator does not stop the remaining validators…` — fixture `[fail(1), pass, fail(3), pass]`; asserts all four appear with the exact status sequence and that exit codes `1` and `3` are preserved individually | pass |
| **(b)** overall exit stays non-zero when any required validator fails | `(b) the overall outcome is non-zero…` — asserts `ok === false` and that the failing validator's own exit code (`7`) is what propagates; paired with `(b) an all-pass run is the only path to exit 0` | pass |
| **(c)** missing dependencies are reported BLOCKED, not passed | four tests: module missing from disk; spawn error; per-validator timeout; **unresolvable import** (a real fixture doing `import "definitely-not-installed-package"`). All assert `BLOCKED`, a `missing dependency` reason, and a non-zero aggregate | pass |
| **(d)** empty discovery cannot return green | three tests: empty validators directory; **missing** validators directory; an undeclared validator on disk (drift). All assert `ok === false` and a non-zero exit | pass |
| **(e)** a skipped REQUIRED validator cannot silently pass | `(e) a skipped REQUIRED validator cannot silently pass` (asserts `required === true` by default and a `SKIP of a REQUIRED validator` problem); `(e) a preflight hook cannot upgrade a validator to PASS`; `(e) SKIP and BLOCKED always carry an explicit reason` | pass |

Safety tests for the `rmSync`: targets only generated names inside the root while user source survives; refuses git-tracked directories; **never follows or deletes symlinks** (with a real symlink pointing at a file outside the root, which is asserted to survive); refuses a relative or non-existent root; refuses escaping start directories; refuses a forged widened plan at execution time; the tracked-path predicate **fails closed** when git state cannot be read.

Wiring tests: the real runner calls `discoverValidatorModules`/`reconcileValidatorInventory` and contains no frozen validator count; `--plan` prints `NO VALIDATORS EXECUTED`; an unknown lane exits non-zero; and no validator on disk still uses `reporter.warn(` outside comments.

Regression check on the six existing checks that read the runner's source: `phase-b-validators`, `whole-repo-end-state`, `foundation-wave0`, `phase-c-forced-decisions` (25/25 pass) and `tests/security/environment-honesty.test.mjs` (3/3 pass). In the full gate run, `tooling-governance-validator`, `meta-no-theater-validator`, `whole-repo-end-state-validator`, `architecture-validator`, and `operational-lifecycle-validator` all `PASS`, confirming the new module and the rewritten runner satisfy the repository's own tooling governance.

---

## 6. Post-repair execution result

Full per-validator matrix: **doc 10 §5** (updated in the same change set). Summary:

```
$ node scripts/validate-governance.mjs --lane=gate --validator-timeout-ms=180000
TOTALS: PASS=84 FAIL=22 BLOCKED=2 SKIP=0 NOT_APPLICABLE=1
EXIT=1
```

| | Before repair | After repair |
|---|---|---|
| Gate-lane validators executed | **2 of 108** | **108 of 108** |
| Validators in unknown state | **106** | **0** |
| PASS | 1 | 84 |
| FAIL | 1 | 22 |
| BLOCKED | — (concept did not exist) | 2 |
| SKIP | — | 0 |
| Declared advisories | — (2 findings were silently non-blocking) | 0 |
| Exit code | 1 | 1 |

Report lane: `--lane=report` → **exit 0**, 1 PASS, 108 `NOT_APPLICABLE` each with an explicit reason.

**Wave 0's bar is met:** Wave 0 does not require every validator to be green; it requires every applicable validator to **execute** or produce a truthful explicit blocker. 108/108 gate-lane validators now do exactly that — 106 have a real result they never had before. The gate is still correctly RED, and it is red for 24 stated, individually attributable reasons instead of one that hid 106 unknowns.

Of the 24 non-PASS results, **23 are pre-existing conditions unmasked by this repair** (see the INFERRED caveat in §0) and **1 (`branch-lag-guard-validator`) is newly blocking by design**, per §3.1.

---

## 7. False-green patterns DOCUMENTED, not fixed

These were in scope to document, not necessarily to repair. They remain open.

### F-20-01 — The design-system validator is source-regex-only with a self-service baseline reset

`scripts/validators/validate-design-system.mjs` measures drift by regexing source text and compares the counts against `scripts/validators/design-system-baseline.json`, a ratchet whose counts "may only decrease". But `--update` (`validate-design-system.mjs:42`, `:214-233`) **unconditionally rewrites the baseline from the current metrics and exits 0** — there is no guard preventing the ratchet from being *raised*, no approval, no record of who raised it, and no assertion that the new numbers are lower than the old. `package.json` even exposes it as a first-class script (`validate:design-system:update`). Anyone who hits a ratchet regression can turn the gate green in one command without changing a line of product code. The governance gate never passes `--update` itself, so this is a *human/agent* bypass, not an automated one — but it is a one-command bypass of a hard gate.

Being source-regex-only also means it measures *textual* drift, not rendered output: a token violation expressed through a variable, a template literal, or a CSS-in-JS helper is invisible to it.

Live evidence, gate index 6:
```
HARD invariants: 1 violation(s)
  - marketing-site: dark mode must be reachable through the canonical provider toggle
  - RATCHET regression: appCssRawHex rose to 98 (baseline 0)
  - RATCHET regression: appCssNakedRgbHsl rose to 849 (baseline 572)
  - RATCHET regression: appLocalLbTokenRedefs rose to 220 (baseline 112)
  - RATCHET regression: rawPxFontSize rose to 604 (baseline 533)
  - RATCHET regression: rawPxSpacing rose to 1568 (baseline 1365)
  - RATCHET regression: tsxInlineStyles rose to 673 (baseline 635)
  - RATCHET regression: tsxRawHex rose to 5 (baseline 0)
  - RATCHET regression: tsxArbitraryRadius rose to 387 (baseline 327)
  - RATCHET regression: tsxArbitraryShadow rose to 9 (baseline 8)
Improvements since baseline: tailwindPaletteClasses: 588 → 547
```
**1 hard invariant + 9 ratchet regressions.** Doc 10 recorded **2** hard invariants (it additionally saw `developer-portal`) and different ratchet magnitudes (`appCssRawHex` 156 vs 98, `appLocalLbTokenRedefs` 339 vs 220). Same reason as §1: doc 10 measured the dirty working tree, this measured the committed tree. Neither number should be reused without remeasuring in a stated tree state.

**Suggested (not implemented) fix:** make `--update` refuse to raise any metric, require a reviewed baseline diff, and record the authorising decision — leaving lowering the ratchet as the only self-service operation.

### F-20-02 — Two "validators" are 1-line delegation aliases

Full file contents:
```
scripts/validators/undeclared-import-validator.mjs : import "./dependency-manifest-validator.mjs";
scripts/validators/wrangler-env-validator.mjs      : import "./cloudflare-environment-validator.mjs";
```
They contain no independent logic. The post-repair matrix demonstrates the consequence directly — indices 17 and 18 produced **byte-identical** failure output in ~230 ms each:
```
[ 17/108] FAIL  dependency-manifest-validator.mjs (232ms)
[ 18/108] FAIL  undeclared-import-validator.mjs  (230ms)
```
The headline "108 validators" therefore overstates the number of *independent* checks by at least 2 (effective ≈ 106), and the duplicate pair doubles the work while conveying no extra information. Both are also in `criticalGateValidators`, so the "critical" list contains a check and its own alias. This is not a defect if the alias exists for CI required-check naming, but it must be stated rather than counted twice. **Not changed here** — renaming or removing either alias would alter CI required-check names and is a human decision.

### F-20-03 — The `passed` line used to report a count it had not earned

Baseline: `Governance ${lane} lane passed (${selectedValidators.length} validators).` printed the *declared* length. Now the success line reports the number that actually executed and passed alongside the number discovered on disk. Fixed in this change set; recorded because it is the same class of defect.

---

## 8. Open escalations and conflicts

| ID | Item | Status |
|---|---|---|
| E-20-01 | **Branch-lag guard now blocks every branch ahead of `main`.** Requires a human choice between fast-forwarding `main`, re-scoping the check to the integration branch, or explicitly declaring it advisory. See §3.1. | **HUMAN DECISION REQUIRED** |
| E-20-02 | **Stale validator count in documentation.** `.github/workflows/security-review.yml:7` and root `CLAUDE.md` say "107"; the measured gate-lane count is **108**. Outside this task's file perimeter. | open |
| E-20-03 | **Committed tree is worse than the dirty working tree.** `tenant-isolation-validator` passes in the dirty tree and fails at the committed baseline; design-system hard-invariant and ratchet numbers differ. Any Wave 0 readiness claim must state which tree it measured. | open |
| E-20-04 | **`typescript` is not resolvable**, so `cycle-budget-validator` and `route-ownership-validator` are `BLOCKED` — two governance invariants are unevaluated whenever dependencies are not installed. The gate silently tolerated this before (it never reached them). CI installs dependencies, so this is expected to be local-only, but it is **unverified in CI**. | open |
| E-20-05 | **CI does not run `ci.yml` for `stepup/main`** (doc 09). The repaired runner improves what a gate *reports*; it cannot make a gate *fire*. Unchanged by this task. | open |
| E-20-06 | **`services/lcis-api` and the `packages/lcis-*` family** appear across several of the 24 failures (`package-ownership`, `dependency-manifest`, `provider-isolation`, `typescript-governance`) and are absent from every governance topology document. | **HUMAN CLASSIFICATION REQUIRED** (unchanged from Phase 1) |
| E-20-07 | **Mobile:** `apps/mobile/merchant-app` is **HUMAN_DECISION_REQUIRED**, not "MOBILE_V1_1" and not "deferred". `mobile-token-validator` and `mobile-topology-honesty-validator` both `PASS` at this baseline. Doc 10 §3 contains the phrase "explicitly deferred to V1.1"; **that phrasing is superseded** — no ARB amendment authorising deferral exists, and the governance chain (Constitution ART-04, `AGENTS.md` ARCH-R1, `LETBUYY_CANONICAL_SYSTEMS.md` row 28) still calls it CANONICAL. Mobile work is preserved and was not touched or merged here. | **HUMAN DECISION REQUIRED** |
| E-20-08 | **App Bridge / app-store / marketplace** is handled by the separate urgent security task on `codex/emergency-appbridge-killswitch`. Not touched by this task. Referenced as an open escalation only. | open elsewhere |

No conflict between two currently authoritative documents was found in the surface this task touched.

---

## 9. Reproduction

From the worktree root (`/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-validator-execution`, branch `codex/w0-validator-execution`, Node `v26.5.1`):

```bash
node scripts/validate-governance.mjs --lane=gate --plan                 # inventory only, executes nothing
node scripts/validate-governance.mjs --lane=gate \
     --validator-timeout-ms=180000 --report-json=/tmp/gate.json         # full matrix, exit 1
node scripts/validate-governance.mjs --lane=report                      # exit 0
node --test tests/governance/validator-orchestration.test.mjs \
             tests/governance/branch-lag-guard.test.mjs                 # 30/30, exit 0
```

The runner refuses to treat a run as a gate result if `cwd` is not the repository root that owns the script.

## 10. Raw evidence index

Under `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/w0-validator-execution/`:

- `20_pre-repair-gate.log` — baseline run, exit 1, stops after 2 validators.
- `20_post-repair-gate.log` — full 108-validator run with per-validator output and the printed matrix.
- `20_post-repair-gate-matrix.json` — machine-readable matrix (inventory, statuses, exit codes, durations, reasons, advisories, aggregate problems).
- `20_post-repair-report-lane.log` / `20_post-repair-report-lane.json` — report lane, exit 0.
- `20_orchestration-tests.log` — 30/30 tests, exit 0.

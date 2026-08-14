# 11 — False-Green and Fail-Fast Findings

**Status:** Evidence artifact — NOT governance authority.
**Agent:** Agent E — CI and Validator Truthfulness Auditor (Wave 0, Phase 1, read-only)
**Repo SHA at audit time:** `ee3711829d857e986014c5811bb94d86ebc3d343` (HEAD, branch `stepup/main`)
**Timestamp used:** 2026-08-09
**Method:** every claim below is anchored to a file:line read directly from the repository during this session, or to a live command this audit executed. No claim is carried over from the readiness ZIP, prior audit reports, or LCIS output.

---

## 1. Fail-fast mechanism — exact code path

**Location:** `scripts/validate-governance.mjs:190-204`

```js
for (const validator of selectedValidators) {
  if (validator === "stale-artifact-validator.mjs") {
    removeGeneratedArtifactDirectories();
  }

  const script = path.posix.join("scripts/validators", validator);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Governance ${lane} lane passed (${selectedValidators.length} validators).`);
```

- Validators run **sequentially**, in the literal array order declared at `scripts/validate-governance.mjs:15-124` (gate lane) with `reportValidators` (`:126-128`) appended only for `--lane=report`/`--lane=all`.
- Each validator is a separate `spawnSync` child process. The moment any one returns a non-zero exit status, `process.exit(result.status ?? 1)` fires **immediately** — no `continue`, no aggregation, no "run the rest and report a combined summary" pass.
- This was independently confirmed by live execution (doc 10 §2): with 108 validators registered, exactly 6 executed before validator #6 (`validate-design-system.mjs`) failed and the process exited. Validators 7–108 (102 of them) were never spawned.
- **Consequence:** the sequence position of a validator in the hardcoded array — which has no documented relationship to severity, blast radius, or how often each check tends to fail — determines whether every *later* validator in the array gets to run at all in a given invocation. A single flaky or legitimately-in-progress check near the front of the array (in this case, `validate-design-system.mjs` at position 6, which tracks an actively-being-burned-down ratchet metric, not a one-time invariant) can mask the state of everything after it, including validators covering canonical-ledger integrity, tenant isolation edge cases, RLS coverage, and identity/session invariants that appear later in the array (e.g. `canonical-ledger-only-validator.mjs` at position ~95, `rls-force-coverage-validator.mjs` at position ~101, `identity-sole-issuer-validator.mjs` at position ~98 — none of these ran in this audit's live invocation).

### Comparison: the same repo's test runners do NOT fail-fast the same way
- `pnpm run test:behavioral` (`node --test tests/*/*.test.mjs`) ran **all** 1576 tests to completion before reporting 33 failures and exiting 1 (doc 10 §3). Node's built-in test runner aggregates and reports the full picture in one pass.
- `pnpm run test:contracts` (`tsx --test tests/contracts/*.test.ts`) likewise ran all 200 tests to completion (187 pass / 13 fail) before exiting 1.
- **Finding F-11-01 (design inconsistency, not a bug per se):** the two testing layers in this repo have opposite failure-reporting philosophies — the governance gate stops at the first red light and hides everything behind it, while the test suites run everything and report a full casualty count. A human (or CI dashboard) reading "governance failed" learns nothing about the other 102 validators' state in that run; a human reading "tests failed: 33/1576" learns the complete picture in one shot. This asymmetry is the direct cause of doc 10's "6 of 108 validators executed" finding, and it means the governance gate's failure count in any single CI run systematically **understates** the number of real violations whenever the first violation happens to sit early in the array.

### Second-order fail-fast: the CI workflow step layering
`architecture-governance.yml` (the workflow that actually covers PRs into `stepup/main` today, per doc 09 §3) runs steps in this order (`.github/workflows/architecture-governance.yml:38-98`):
1. `Validate governance` (`pnpm run validate:governance` — the exact 108-validator gate, fails at #6 as shown above)
2. `Validate design system` (redundant re-run of the same check already embedded at position 6 of step 1)
3. `Lint CSS`
4. `Validate design-token interchange`
5. `Validate mobile token parity`
6. ... (7 more `validate:*` steps)
7. `Run governance tests` (`pnpm run test`)
8. `Typecheck workspace` (`pnpm run typecheck`)
9. `Generate SBOM`
10. `Dependency audit`

GitHub Actions' default step semantics stop a job at the first failing step (no `continue-on-error: true` is set on any of these steps, confirmed by reading the full file). So step 1 failing (as it does at this SHA, per doc 10 §2) means steps 2–10 **never run in that CI job either** — including the `Typecheck workspace` and `Run governance tests` steps, which this audit independently confirmed **also currently fail** (doc 10 §3: typecheck exit 1, test:contracts exit 1) by running them directly outside the workflow. **Finding F-11-02:** this is a second, independent layer of fail-fast on top of the one inside `validate-governance.mjs` itself — a CI run of `architecture-governance.yml` against this exact SHA would report exactly one failing step ("Validate governance") and a human reading only the GitHub Actions UI would not learn that typecheck and contract tests are *also* currently broken, because those steps would show as never-run, not as failed.

---

## 2. False-green-prone validator patterns found

### 2a. Checks that convert real failures into non-blocking warnings

`scripts/validators/governance-common.mjs:415-443` defines the shared `createReporter(name)` helper used across most validators:

```js
assert(condition, message) {
  if (!condition) errors.push(message);
},
warn(condition, message) {
  if (!condition) warnings.push(message);
},
finish(summary) {
  if (warnings.length) { ... console.warn(...) ... }
  if (errors.length) {
    ... console.error(...)
    process.exit(1);
  }
  console.log(`${name} passed...`);
},
```

Only `errors` (populated via `.assert()`) can cause `process.exit(1)`. Anything routed through `.warn()` is printed but **never fails the validator, never fails the gate, and never blocks CI**, regardless of what the condition actually checks.

Live grep across all 108 registered validators found exactly **2 files** (3 call sites) using `reporter.warn(...)`:

- **`scripts/validators/branch-lag-guard-validator.mjs:95-99`** — when the validator is *not* running in the enforced/live-CI context (`enforceLag` false, i.e. every local run and most non-production-deploy CI contexts), it falls back to:
  ```js
  } else {
    try {
      const localLagCount = Number(git(["rev-list", "--count", `${productionBranch}..HEAD`]));
      reporter.warn(
        Number.isFinite(localLagCount) && localLagCount === 0,
        `Local working branch is ${localLagCount} commit(s) ahead of ${productionBranch}; CI enforces the live release-branch comparison`,
      );
    } catch {
      reporter.warn(false, "Local branch lag could not be inspected; CI enforces the live release-branch comparison");
    }
  }
  ```
  **Finding F-11-03:** in this non-enforced branch, both the "how far ahead of main" measurement and even the case where the git command itself throws (`catch { reporter.warn(false, ...) }`) are downgraded to warnings. Locally, and in any workflow context where `enforceLag` isn't explicitly turned on, this validator will print a warning and still exit 0 no matter how large the branch lag is or whether the underlying git command failed outright. This is the textbook "check that converts a failure to a warning" pattern the task brief asked this audit to look for. It is a defensible design choice (the doc-comment implies "CI enforces the live release-branch comparison" elsewhere) **but** doc 09 already independently established that `main` is 274 commits behind `stepup/main` — exactly the condition this validator exists to catch — and no workflow examined in doc 09 was found to run this validator with `enforceLag` true against `stepup/main`'s actual position relative to `main` (it appears wired into `production-deploy.yml`'s `branch-lag-guard` job, which only fires on push/dispatch to `main`, itself currently stale — see doc 09 §1, §3). The one context capable of catching the drift this audit found is not currently exercised.

- **`scripts/validators/pricing-catalog-validator.mjs:41-46`** — `commissionRowChecked` / label uniqueness bookkeeping inside a loop, `reporter.warn` used for a secondary consistency signal, not the primary correctness assertions (which do use `.assert()` in the same file). Lower severity than the branch-lag case — recorded for completeness, not flagged as high-risk.

All other 106 gate-lane validators either use `reporter.assert()` exclusively (hard failures) or implement their own bespoke pass/fail logic outside the shared reporter (not systematically auditable at scale within this session's time budget — see "What remains unverified" below).

### 2b. Source-regex-only checks (no AST, no execution)

**`scripts/validators/validate-design-system.mjs`** (263 lines, read in full) — the validator that is currently causing the entire gate to go red (doc 10 §2) — is a **pure text-scanning** validator: it `readFileSync`s every `.ts`/`.tsx`/`.css` file under `apps/**` (excluding `apps/marketing-site`, explicitly "exiled" per its own doc-comment at line 25-27) and regex-matches for raw hex colors, naked `rgb()`/`hsl()`, Tailwind palette utility classes, raw px font-size/spacing, inline `style=`, and arbitrary Tailwind radius/shadow classes. It does not parse an AST and does not execute any code.

**Finding F-11-04 (ratchet self-service bypass):** the same file supports `--update` (line 42: `const UPDATE = process.argv.includes('--update');`), which rewrites `scripts/validators/design-system-baseline.json` to whatever the current (possibly-regressed) metric values are, silently resetting the ratchet floor. Nothing in `validate-governance.mjs` or any CI workflow examined in this audit prevents a contributor from running `node scripts/validators/validate-design-system.mjs --update` locally, committing the updated `design-system-baseline.json`, and having the *next* gate run report "passed" even though the underlying drift (raw hex, raw px, inline styles, etc.) actually increased — because the ratchet compares against whatever baseline file is currently committed, and that file is self-updatable by the same tool that checks it. This is a structural false-green risk: the "ratchet only moves down" invariant depends entirely on human review discipline at PR time (someone must notice a `design-system-baseline.json` diff and question why the numbers went up), not on any mechanical guarantee in the validator itself. This audit did not find a separate validator or CI step that specifically diffs `design-system-baseline.json` changes against an append-only/decrease-only rule.

- Regex-based scanning is also inherently prone to both false negatives (e.g., a raw hex value built via string concatenation or a template literal the regex doesn't match) and false positives (a legitimate value inside a comment or a string that happens to look like a hex code). This audit did not find or construct a specific bypass case in the time available — recorded as a structural risk category, not a proven exploit.

### 2c. File-presence-only checks

Time-boxed scan (not exhaustive across all 108 validators): `mobile-token-validator.mjs` (9 lines) is a pure delegate — it `spawnSync`s `scripts/generators/generate-mobile-tokens.mjs --check` and forwards the exit code (`process.exit(result.status ?? 1)`), i.e., it has zero independent logic of its own; its correctness is entirely inherited from a generator script this audit did not separately read. `generated-artifact-validator.mjs` (29 lines) and `route-line-count-validator.mjs` (24 lines) are short enough to suggest narrow, mechanical checks (file existence / line-count thresholds) but this audit did not have time to fully read every short validator's logic to confirm whether each one performs a substantive check or a shallow presence/size check. **Recorded as unverified at the individual-validator level** — see "What remains unverified" below; flagging file length as a *heuristic* signal only, not a confirmed finding, for any validator not explicitly named above.

### 2d. Swallowed exceptions

A targeted `catch` scan across all 108 registered validator files, looking for `catch` blocks that do not `throw`/`process.exit(1)` within the following ~6 lines, found the same 2 files as §2a (`branch-lag-guard-validator.mjs`, `pricing-catalog-validator.mjs`) — both of which route the caught error into `reporter.warn()`/`reporter.assert(false, ...)` rather than silently discarding it (i.e., the exceptions are *caught and reported*, not *caught and ignored*). This audit found **no validator among the 108 that silently swallows an exception and continues as if nothing happened** (no bare `catch {}` with no reporting at all) in the files scanned. This is a narrower, more specific claim than "no false-green risk exists" — it means the *swallowed-exception* subcategory specifically was not found to be a live problem in this codebase, while the *warning-conversion* subcategory (§2a) and the *self-service-bypass* subcategory (§2b) were.

---

## 3. Aliasing / count-integrity findings (cross-referenced from doc 10)

- `undeclared-import-validator.mjs` and `wrangler-env-validator.mjs` are pure 1-line `import` re-exports of `dependency-manifest-validator.mjs` and `cloudflare-environment-validator.mjs` respectively (doc 10 §1, F-10-01). They will always pass/fail in lockstep with the validator they alias — not a false-green mechanism on their own, but relevant to any percentage/count claim of the form "N validators passed" being read as "N independent checks passed."
- The repo's own `security-review.yml:7` comment says "107-validator governance gate"; this audit's live count is 108 (gate lane). Stale-by-one in-repo documentation, not a functional defect (doc 09 §5, doc 10 §1).

---

## 4. Summary table

| Category | Found? | Where | Severity |
|---|---|---|---|
| Fail-fast stops the whole gate at the first failure, hiding all subsequent validators | **Yes, confirmed live** | `scripts/validate-governance.mjs:201-203`; live run stopped at 6/108 | High |
| Second-order fail-fast: CI job stops at first failing step, hiding later steps (typecheck, tests) that independently also fail | **Yes, confirmed live** | `.github/workflows/architecture-governance.yml` step order | High |
| Checks that convert failures to warnings (never block CI) | **Yes, 2 files** | `branch-lag-guard-validator.mjs:95-99`, `pricing-catalog-validator.mjs:41-46` | Medium (branch-lag case is higher-risk given doc 09's confirmed 274-commit drift) |
| Source-regex-only checks | **Yes, at least 1 major one (the one currently failing)** | `validate-design-system.mjs` | Medium — inherent to the approach, partially mitigated by ratchet baseline, but baseline is self-updatable (see next row) |
| Ratchet baseline self-service bypass | **Yes** | `validate-design-system.mjs:42` (`--update` flag) + `design-system-baseline.json`, no independent guard found | Medium-High |
| File-presence-only checks | **Partially assessed** | short validators flagged by line count only; not individually confirmed | Unverified |
| Swallowed exceptions (caught and silently discarded) | **Not found** in the files scanned | — | — |

## Raw evidence index

- `catch-without-exit-heuristic.txt` — mechanical scan output for the `catch` heuristic in §2d.
- All governance-gate and command-output logs referenced from doc 10 apply here too (same underlying runs).

## What remains unverified

- Full manual read of all 108 validators' internal logic for false-green patterns — this audit read `validate-governance.mjs`, `governance-common.mjs` in full, `validate-design-system.mjs` in full, and did targeted greps/heuristics (line-count, `catch`, `reporter.warn`) across the rest. A complete line-by-line audit of every validator was outside this session's time budget; the findings above are the ones this audit could concretely confirm with evidence, not an exhaustive list.
- Whether `branch-lag-guard-validator.mjs`'s `enforceLag`-true path is actually exercised anywhere against `stepup/main` (as opposed to only `main`) — this audit read the trigger conditions in `production-deploy.yml` (push/dispatch to `main` only) but did not fully trace every code path that sets `enforceLag`.
- Whether any validator outside the 2 identified in §2a has bespoke (non-`governance-common.mjs`) warning/downgrade logic that this audit's grep for `reporter.warn(` would have missed (a validator implementing its own ad hoc reporter would not match that pattern). Not ruled out.

# 10 — Validator Execution Matrix

> **UPDATED 2026-08-09 (Wave 0, Phase 2 — validator-runner truthfulness repair).**
> **Evidence artifact, not governance authority.**
> Sections **1–4 below are the original PRE-REPAIR matrix and are preserved verbatim for comparison.** They describe the fail-fast runner as it existed at baseline SHA `bf35062eda22f4d881efd61fb1d36c8fc83baed1`, measured inside the **dirty original working tree**.
> Sections **5–8 are new** and record the **POST-REPAIR full-execution matrix**, measured on branch `codex/w0-validator-execution` in a **clean isolated worktree** at the same SHA. All 108 gate-lane validators now execute.
> Two numbers in the pre-repair sections do **not** reproduce against the committed tree — see §6 "Reconciliation with the pre-repair matrix". Neither section's numbers may be reused without remeasuring and stating which tree state was measured.
> Full repair rationale, safety audit, and open escalations: **`20_VALIDATOR_RUNNER_REPAIR_EVIDENCE.md`**.

---

## PART A — PRE-REPAIR (original Phase 1 audit, preserved verbatim)

**Status:** Evidence artifact — NOT governance authority.
**Agent:** Agent E — CI and Validator Truthfulness Auditor (Wave 0, Phase 1, read-only)
**Repo SHA at audit time:** `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (HEAD, branch `stepup/main`)
**Timestamp used:** 2026-08-09
**Independently recomputed — no prior count trusted.** The task brief explicitly says not to trust prior "107/108" claims. This document recomputes the validator inventory from the current `scripts/validate-governance.mjs` source and from `scripts/validators/*.mjs` on disk, then actually runs the gate and records exactly what executed.

## 1. Validator inventory — recomputed, not assumed

Command:
```
node -e '... reads scripts/validate-governance.mjs, regex-extracts the validators[] and reportValidators[] arrays ...'
```
Result (captured live, not from any doc):
- `validators` (the `gate` lane, run by `pnpm run validate:governance` / `validate:governance:gate` and by CI's `governance` job): **108** entries.
- `reportValidators` (only added by `--lane=report` or `--lane=all`): **1** entry (`foundation-stepup-report-validator.mjs`).
- **`all` lane total: 109.**
- The in-repo comment at `.github/workflows/security-review.yml:7` says "107-validator governance gate" — this is **stale by one** against the actual current array length (108 in the gate lane). Recorded as a documentation-drift finding in doc 09 §5, not corrected here.

Cross-check against files on disk:
```
$ rg --files scripts/validators | wc -l   → 114 .mjs/.md files total, 112 .mjs files
```
- All 109 validators referenced by `validate-governance.mjs` exist on disk (0 missing).
- 3 `.mjs` files on disk are **not** referenced by `validate-governance.mjs` at all:
  - `scripts/validators/governance-common.mjs` — shared helper module (exports `createReporter`, path/dir constants, etc.), not a standalone validator. Correctly unreferenced.
  - `scripts/validators/phase-b-common.mjs` — shared helper module. Correctly unreferenced.
  - `scripts/validators/frozen-path-override-gate.mjs` — a **git hook** (invoked directly from `scripts/git-hooks/pre-commit` and `scripts/git-hooks/commit-msg`, confirmed by `rg` — see `scripts/git-hooks/pre-commit:11`), checking *staged* files at commit time. It is legitimately outside the CI governance gate's list because it operates on the git index, not on the working tree, and is enforced independently (also asserted by `scripts/validators/tooling-governance-validator.mjs:64,79`, which itself checks that the pre-commit hook wires it in). Correctly unreferenced by `validate-governance.mjs`, but worth naming so a future auditor doesn't assume it's a silently-dropped validator.

**Finding F-10-01:** two of the 108 gate-lane entries are pure delegation aliases with no independent logic of their own — their entire file body is a single `import` side-effect line:
- `scripts/validators/undeclared-import-validator.mjs` → `import "./dependency-manifest-validator.mjs";` (full file content, 1 line)
- `scripts/validators/wrangler-env-validator.mjs` → `import "./cloudflare-environment-validator.mjs";` (full file content, 1 line)

These are not defects — a validator name can legitimately alias another's check for CI-required-check naming reasons — but it means the "108 validators" figure overstates the number of *independent* checks by at least 2: `undeclared-import-validator.mjs` and `dependency-manifest-validator.mjs` will always pass/fail identically because they run the exact same code; same for `wrangler-env-validator.mjs` / `cloudflare-environment-validator.mjs`. Effective independent-check count is closer to **106**.

## 2. Live execution: `node scripts/validate-governance.mjs` (default lane = `gate`)

```
$ node scripts/validate-governance.mjs
```
Full raw output persisted at:
`artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-e/validate-governance-gate-lane.log`

**Exit code: 1. Runtime: well under 2 minutes (no timeout needed).**

Console output (verbatim):
```
Foundation anti-fabrication gate passed (1905 active source files scanned; 0 temporary entries tracked).
Tenant isolation validator passed (265 tenant tables registered; 0 direct service-role bypasses found).
Production safety validator passed (rate limiting, registrar, shared-env preflight, skips, and domain defaults checked).
Session security validator passed (internal secret isolation, replay JTI, session rotation, MFA, perimeter, and skips checked).
Operational lifecycle validator passed (19 SDLC lifecycle files, 2 environments, and rollout contracts checked).
── Design-system governance ──
HARD invariants: 2 violation(s)
✖ Design-system governance FAILED:
  - marketing-site: dark mode must be reachable through the canonical provider toggle
  - developer-portal: dark mode must be reachable through the canonical provider toggle
  - RATCHET regression: appCssRawHex rose to 156 (baseline 0)
  - RATCHET regression: appCssNakedRgbHsl rose to 822 (baseline 572)
  - RATCHET regression: appLocalLbTokenRedefs rose to 339 (baseline 112)
  - RATCHET regression: rawPxFontSize rose to 612 (baseline 533)
  - RATCHET regression: rawPxSpacing rose to 1584 (baseline 1365)
  - RATCHET regression: tsxInlineStyles rose to 673 (baseline 635)
  - RATCHET regression: tsxRawHex rose to 5 (baseline 0)
  - RATCHET regression: tsxArbitraryRadius rose to 388 (baseline 327)
  - RATCHET regression: tsxArbitraryShadow rose to 9 (baseline 8)
EXIT_CODE=1
```

### Position-by-position result

| # | Validator | Result | Notes |
|---|---|---|---|
| 1 | `foundation-antifabrication-gate.mjs` | ✅ PASS | ran |
| 2 | `tenant-isolation-validator.mjs` | ✅ PASS | ran |
| 3 | `production-safety-validator.mjs` | ✅ PASS | ran |
| 4 | `session-security-validator.mjs` | ✅ PASS | ran |
| 5 | `operational-lifecycle-validator.mjs` | ✅ PASS | ran |
| 6 | `validate-design-system.mjs` | ❌ **FAIL (exit 1)** | 2 hard-invariant violations (marketing-site + developer-portal dark-mode toggle) and 9 ratchet-metric regressions above their recorded baselines (see doc 11 for the ratchet-bypass risk analysis) |
| 7–108 | (102 remaining validators: `mobile-token-validator.mjs` through `whole-repo-end-state-validator.mjs`) | ⛔ **NEVER STARTED** | `scripts/validate-governance.mjs` exits the Node process the instant validator #6's child process returns non-zero (`scripts/validate-governance.mjs:201-203`, see doc 11 for the exact code path). None of the remaining 102 validators were spawned at all — not skipped, not attempted, not evaluated. |

**This is the single most important fact this audit produced:** as of this SHA, on this branch, **6 of 108 gate-lane validators ran; 102 never executed.** The governance gate is currently red, and the redness is caused by a check (`validate-design-system.mjs`) that sits 6th in an array whose ordering happens to have nothing to do with severity — it simply blocks everything listed after it in the array from ever being evaluated in the same run.

### Cross-checked against a second, independent trigger of the same command

`deploy-staging.yml`'s `governance-gate` job runs the literal command `node scripts/validate-governance.mjs --lane=gate` on every push to `stepup/main` (`.github/workflows/deploy-staging.yml:43-44`). Since this is the exact command this audit ran, and this audit's HEAD *is* the current tip of `stepup/main` locally, **the next real push to `stepup/main` at this SHA would fail the deploy-staging governance-gate job identically**, blocking the entire staging deploy pipeline (workers + apps + smoke tests never run — they are gated `needs: governance-gate`). This is a case where an existing gate is working as designed and would correctly stop a bad deploy — the gap identified in doc 09 is that this is the *only* gate that fires on `stepup/main` push, and no gate at all fires that runs lint/build.

## 3. Live execution of the other CI-referenced commands (all independently run, not assumed)

| Command | package.json script | Exit code | Runtime | Result summary | Raw log |
|---|---|---|---|---|---|
| `pnpm run lint` | `turbo lint --filter=!@letbuyy/app-marketplace --filter=!@letbuyy/theme-marketplace --filter=!@letbuyy/developer-portal --filter=!@letbuyy/platform-operations-portal` | **1** | ~6s (turbo fails fast on first task failure) | `@letbuyy/identity-platform#lint` failed: 1 ESLint **error** (`apps/identity-platform/src/components/...` — raw `<button>` instead of `@letbuyy/ui` `Button`, rule `@letbuyy/ui/no-raw-elements`) + 35 warnings across the run. Turbo reported "0 successful, 5 total" and stopped — the other 4 lint tasks in that batch never completed either (turbo's default `--continue` behavior did not run them once one task failed). | `pnpm-lint.log` |
| `pnpm run typecheck` | `turbo typecheck --filter=...` | **1** | ~3s (mostly turbo-cache hits) | `@letbuyy/platform-console#typecheck` failed: `TS2344` in `.next/types/app/(dashboard)/developers/page.ts` (Next.js 15 `PageProps.searchParams` must be a `Promise`, code has a non-Promise type). 69/73 tasks succeeded (67 via cache), 1 explicit failure stopped the run before all 73 finished cleanly. | `pnpm-typecheck.log` |
| `pnpm run test:behavioral` | `node --test --test-concurrency=1 tests/*/*.test.mjs` | **1** | tens of seconds | **1576 tests run to completion, 1528 pass, 33 fail.** Node's test runner does **not** fail-fast — it ran the entire suite and aggregated all failures before exiting 1. One example failure: `tests/typescript/typescript-governance.test.mjs` — multiple `packages/lcis-*` packages fail TypeScript-governance tsconfig requirements (composite build / declaration emit / dist isolation / workspace-tsconfig reference), asserted as `1 !== 0`. | `pnpm-test-behavioral.log` |
| `pnpm run test:contracts` | `tsx --test tests/contracts/*.test.ts` | **1** | tens of seconds | **200 tests, 187 pass, 13 fail.** Example failure: `tests/contracts/theme-editor-real-preview.test.ts` — expected the editor bridge protocol message type to match `/letbuyy:theme-editor:section-select/`, actual source text did not contain it. | `pnpm-test-contracts.log` |
| `node scripts/validate-governance.mjs` (`--lane=gate`, default) | `validate:governance` / `validate:governance:gate` | **1** | <10s | See §2 above. | `validate-governance-gate-lane.log` |

**Not executed in this audit (recorded as blocked/out-of-scope, not as failures):**
- `pnpm run build` (`turbo build`) — the task brief scopes this audit to "clearly read-only lint/validate/test commands... safe to run without touching remote services." A full `turbo build` across every app (Next.js `next build` for 5+ apps) was judged too expensive for this audit's time budget and is explicitly flagged in root `CLAUDE.md` as *not* covered by the governance gate ("run real `pnpm --filter <app> build`... the gate does NOT cover app `next build`"). This audit corroborates that gap exists (§4 of doc 09) but did not itself execute a full build. **Recorded as unverified**, not as a pass or fail.
- `pnpm run test:unit:gateway` (`pnpm --filter @letbuyy/api-gateway run test:unit`) — not run in this session due to time budget; `ci.yml`'s `merge-safety-gate` job runs it. Recorded as unverified.
- The full Flutter merchant-mobile toolchain (`flutter analyze` / `flutter test` / `flutter build apk` / `flutter build ios`) referenced by `ci.yml`'s `merge-safety-gate` and `mobile-merchant` jobs, and by `production-deploy.yml` — not attempted; requires the Flutter SDK and, per the FROZEN PRODUCT DECISION in this task's brief, the merchant mobile app is explicitly deferred to V1.1 and out of scope for a Web V1 launch judgment. Recorded as unverified/out-of-scope, not as pass or fail.
- Anything requiring live credentials/network (Cloudflare deploys, Vercel deploys, Supabase/Postgres migrations, `pnpm audit`, SBOM generation) — correctly out of scope per the read-only mandate; not attempted.

## 4. What this means for "is the gate green"

At SHA `bf35062e` on `stepup/main`, independently and freshly measured on 2026-08-09:
- **Governance gate (108 validators): RED** — fails at validator 6/108, 102 never run.
- **Lint: RED** — 1 real ESLint error (not just warnings).
- **Typecheck: RED** — 1 real `tsc` type error.
- **Behavioral tests: RED** — 33/1576 failing.
- **Contract tests: RED** — 13/200 failing.
- **Build: UNVERIFIED** (not run; independently corroborated as structurally uncovered by any CI gate per doc 09 §3).

None of this should be read as "the codebase is broken" in an absolute sense — these are pre-existing, already-tracked gaps (the design-system ratchet regressions are measured against a recorded baseline and the failing tests are a fixed, countable set, not a random flake storm). What this audit adds is: **these failures are currently invisible to the two CI paths that actually fire on `stepup/main`** (`architecture-governance.yml`, path-scoped, and `deploy-staging.yml`), because both of those paths run `validate-governance.mjs` (or an equivalent early step) before reaching typecheck/test steps, and both stop at the first failure — so a human watching only "did CI turn red" would currently see exactly one red check (governance) and would not learn about the lint, typecheck, or test failures from the same CI run without a further, separate diagnostic pass. See doc 11 for the structural fail-fast mechanism.

## Raw evidence index

- `validate-governance-gate-lane.log` — full stdout/exit code of the governance gate run.
- `pnpm-lint.log`, `pnpm-typecheck.log`, `pnpm-test-behavioral.log`, `pnpm-test-contracts.log` — full stdout/exit code of each command.
- `root-package-scripts.txt` — every `package.json` script in the repo root, `name -> command`, mechanically dumped for this audit (used to identify which scripts exist rather than assuming).

## What remains unverified

- `pnpm run build` (full monorepo build) — not run (see §3).
- `pnpm run test:unit:gateway`, Flutter toolchain steps — not run (see §3).
- Whether `--lane=report` / `--lane=all` behave identically up to validator #6 (they do, by construction — `reportValidators` is only appended after the shared `validators` array, so the fail-fast point is identical regardless of lane; verified by reading `scripts/validate-governance.mjs:152-153`, not by re-running the command a second time).

---

# PART B — POST-REPAIR FULL-EXECUTION MATRIX

**Evidence artifact, not governance authority.**

| Field | Value |
|---|---|
| Repo SHA | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (Wave 0 baseline) + 2 local commits `611ee20b`, `45958978` |
| Branch / worktree | `codex/w0-validator-execution` in `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-validator-execution` (clean isolated worktree — **not** the dirty original tree) |
| Date | 2026-08-09 |
| Node | `v26.5.1` |
| Command executed | `node scripts/validate-governance.mjs --lane=gate --validator-timeout-ms=180000 --report-json=…` |
| Observed exit code | **1** |
| Original repository | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — not modified. No Supabase, provider, deploy, or push command was run. |

## 5. Post-repair per-validator matrix (all 108 gate-lane validators EXECUTED)

**EXECUTED**, not inferred: every row below is a real spawn with a real observed exit code, taken from the machine-readable matrix at `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/w0-validator-execution/20_post-repair-gate-matrix.json`.

Statuses: `PASS` (ran, exit 0) · `FAIL` (ran, non-zero — invariant evaluated and violated) · `BLOCKED` (could **not** run — invariant never evaluated) · `SKIP` (withheld with a reason; none occurred) · `NOT_APPLICABLE` (outside the selected lane).

```
TOTALS: PASS=84  FAIL=22  BLOCKED=2  SKIP=0  NOT_APPLICABLE=1   → EXIT 1
```

| # | Validator | Status | Exit | ms | Reason (verbatim) |
|---|---|---|---|---|---|
| 1 | `foundation-antifabrication-gate.mjs` | PASS | 0 | 272 |  |
| 2 | `tenant-isolation-validator.mjs` | FAIL | 1 | 94 | validator exited 1 |
| 3 | `production-safety-validator.mjs` | PASS | 0 | 34 |  |
| 4 | `session-security-validator.mjs` | PASS | 0 | 35 |  |
| 5 | `operational-lifecycle-validator.mjs` | PASS | 0 | 40 |  |
| 6 | `validate-design-system.mjs` | FAIL | 1 | 338 | validator exited 1 |
| 7 | `mobile-token-validator.mjs` | PASS | 0 | 59 |  |
| 8 | `theme-governance-validator.mjs` | PASS | 0 | 31 |  |
| 9 | `beta-readiness-validator.mjs` | PASS | 0 | 35 |  |
| 10 | `architecture-validator.mjs` | PASS | 0 | 259 |  |
| 11 | `runtime-validator.mjs` | PASS | 0 | 63 |  |
| 12 | `runtime-manifest-validator.mjs` | PASS | 0 | 127 |  |
| 13 | `runtime-topology-validator.mjs` | PASS | 0 | 31 |  |
| 14 | `topology-drift-validator.mjs` | PASS | 0 | 30 |  |
| 15 | `package-ownership-validator.mjs` | FAIL | 1 | 66 | validator exited 1 |
| 16 | `import-validator.mjs` | PASS | 0 | 382 |  |
| 17 | `dependency-manifest-validator.mjs` | FAIL | 1 | 232 | validator exited 1 |
| 18 | `undeclared-import-validator.mjs` | FAIL | 1 | 230 | validator exited 1 (1-line alias of #17 — byte-identical output) |
| 19 | `dependency-graph-validator.mjs` | PASS | 0 | 254 |  |
| 20 | `circular-import-validator.mjs` | PASS | 0 | 251 |  |
| 21 | `cycle-budget-validator.mjs` | **BLOCKED** | 1 | 34 | missing dependency: `typescript` could not be resolved, so the validator never evaluated its invariant (exit 1) |
| 22 | `package-export-validator.mjs` | PASS | 0 | 271 |  |
| 23 | `provider-isolation-validator.mjs` | FAIL | 1 | 275 | validator exited 1 |
| 24 | `supply-chain-validator.mjs` | PASS | 0 | 113 |  |
| 25 | `typescript-governance-validator.mjs` | FAIL | 1 | 72 | validator exited 1 |
| 26 | `cloudflare-topology-validator.mjs` | PASS | 0 | 31 |  |
| 27 | `wrangler-env-validator.mjs` | PASS | 0 | 33 | (1-line alias of #28) |
| 28 | `cloudflare-environment-validator.mjs` | PASS | 0 | 32 |  |
| 29 | `cloudflare-binding-validator.mjs` | PASS | 0 | 35 |  |
| 30 | `env-isolation-validator.mjs` | PASS | 0 | 30 |  |
| 31 | `environment-honesty-validator.mjs` | PASS | 0 | 104 |  |
| 32 | `cookie-realm-validator.mjs` | PASS | 0 | 39 |  |
| 33 | `reserved-subdomain-single-source-validator.mjs` | PASS | 0 | 31 |  |
| 34 | `storefront-access-gate-validator.mjs` | PASS | 0 | 37 |  |
| 35 | `custom-domain-target-validator.mjs` | FAIL | 1 | 57 | validator exited 1 |
| 36 | `merchant-domains-settings-validator.mjs` | FAIL | 1 | 30 | validator exited 1 |
| 37 | `storefront-seo-access-validator.mjs` | PASS | 0 | 30 |  |
| 38 | `platform-domain-literal-validator.mjs` | FAIL | 1 | 147 | validator exited 1 |
| 39 | `route-ownership-validator.mjs` | **BLOCKED** | 1 | 30 | missing dependency: `typescript` could not be resolved, so the validator never evaluated its invariant (exit 1) |
| 40 | `legacy-site-type-validator.mjs` | FAIL | 1 | 65 | validator exited 1 |
| 41 | `app-utils-service-role-edge-validator.mjs` | PASS | 0 | 125 |  |
| 42 | `migration-safety-validator.mjs` | PASS | 0 | 123 |  |
| 43 | `sequential-migration-validator.mjs` | PASS | 0 | 117 |  |
| 44 | `deployment-safety-validator.mjs` | PASS | 0 | 62 |  |
| 45 | `secret-topology-validator.mjs` | PASS | 0 | 30 |  |
| 46 | `domain-boundary-validator.mjs` | FAIL | 1 | 89 | validator exited 1 |
| 47 | `single-writer-ownership-validator.mjs` | PASS | 0 | 123 |  |
| 48 | `fail-closed-internal-routes-validator.mjs` | PASS | 0 | 33 |  |
| 49 | `source-ledger-residue-validator.mjs` | PASS | 0 | 97 |  |
| 50 | `foundation-sql-policy-residue-validator.mjs` | PASS | 0 | 68 |  |
| 51 | `dead-residue-validator.mjs` | PASS | 0 | 32 |  |
| 52 | `repository-intelligence-validator.mjs` | PASS | 0 | 32 |  |
| 53 | `mobile-topology-honesty-validator.mjs` | PASS | 0 | 59 |  |
| 54 | `route-line-count-validator.mjs` | FAIL | 1 | 37 | validator exited 1 |
| 55 | `single-source-crypto-validator.mjs` | FAIL | 1 | 64 | validator exited 1 |
| 56 | `cms-slugify-validator.mjs` | FAIL | 1 | 76 | validator exited 1 |
| 57 | `inr-currency-format-validator.mjs` | PASS | 0 | 92 |  |
| 58 | `date-format-validator.mjs` | FAIL | 1 | 81 | validator exited 1 |
| 59 | `marketplace-single-source-validator.mjs` | PASS | 0 | 30 |  |
| 60 | `api-client-runtime-base-validator.mjs` | FAIL | 1 | 32 | validator exited 1 |
| 61 | `marketing-dead-twin-validator.mjs` | FAIL | 1 | 31 | validator exited 1 |
| 62 | `theme-editor-dead-shell-validator.mjs` | PASS | 0 | 70 |  |
| 63 | `typescript-dead-source-validator.mjs` | PASS | 0 | 106 |  |
| 64 | `dart-dead-source-validator.mjs` | PASS | 0 | 87 |  |
| 65 | `settings-apps-dead-twin-validator.mjs` | PASS | 0 | 77 |  |
| 66 | `raw-error-message-validator.mjs` | FAIL | 1 | 43 | validator exited 1 |
| 67 | `dev-auth-bypass-validator.mjs` | PASS | 0 | 29 |  |
| 68 | `no-noop-test-script-validator.mjs` | PASS | 0 | 30 |  |
| 69 | `environment-validator.mjs` | FAIL | 1 | 1475 | validator exited 1 |
| 70 | `generated-artifact-validator.mjs` | PASS | 0 | 66 |  |
| 71 | `stale-artifact-validator.mjs` | PASS | 0 | 157 | preceded by the hardened generated-artifact cleanup: **0 removed, 0 refused, 0 errors** |
| 72 | `tooling-governance-validator.mjs` | PASS | 0 | 31 |  |
| 73 | `ci-simulation-validator.mjs` | PASS | 0 | 32 |  |
| 74 | `committed-secret-placeholder-validator.mjs` | PASS | 0 | 49 |  |
| 75 | `d1-governance-validator.mjs` | PASS | 0 | 31 |  |
| 76 | `deployment-lineage-validator.mjs` | PASS | 0 | 30 |  |
| 77 | `durable-object-validator.mjs` | PASS | 0 | 29 |  |
| 78 | `manifest-lineage-validator.mjs` | PASS | 0 | 35 |  |
| 79 | `production-readiness-validator.mjs` | PASS | 0 | 47 |  |
| 80 | `provider-evidence-validator.mjs` | PASS | 0 | 29 |  |
| 81 | `queue-topology-validator.mjs` | PASS | 0 | 30 |  |
| 82 | `rollback-integrity-validator.mjs` | PASS | 0 | 33 |  |
| 83 | `test-coverage-governance-validator.mjs` | PASS | 0 | 30 |  |
| 84 | `workspace-lifecycle-validator.mjs` | PASS | 0 | 65 |  |
| 85 | `commission-bps-zero-validator.mjs` | PASS | 0 | 149 |  |
| 86 | `pricing-catalog-validator.mjs` | PASS | 0 | 102 | now hard-blocking (was silently non-blocking); 0 offenders today |
| 87 | `canonical-ledger-only-validator.mjs` | PASS | 0 | 112 |  |
| 88 | `no-self-custody-rail-validator.mjs` | PASS | 0 | 244 |  |
| 89 | `stepup-crypto-validator.mjs` | PASS | 0 | 155 |  |
| 90 | `identity-sole-issuer-validator.mjs` | PASS | 0 | 134 |  |
| 91 | `no-blanket-service-role-validator.mjs` | PASS | 0 | 122 |  |
| 92 | `no-public-using-true-validator.mjs` | PASS | 0 | 80 |  |
| 93 | `rls-force-coverage-validator.mjs` | PASS | 0 | 37 |  |
| 94 | `provider-mode-badge-validator.mjs` | PASS | 0 | 126 |  |
| 95 | `one-system-per-domain-validator.mjs` | PASS | 0 | 112 |  |
| 96 | `no-rejected-package-imports-validator.mjs` | PASS | 0 | 169 |  |
| 97 | `no-reserved-service-activation-validator.mjs` | PASS | 0 | 515 |  |
| 98 | `no-new-react-sections-validator.mjs` | PASS | 0 | 32 |  |
| 99 | `token-source-single-validator.mjs` | PASS | 0 | 124 |  |
| 100 | `shell-single-validator.mjs` | PASS | 0 | 161 |  |
| 101 | `meta-no-theater-validator.mjs` | PASS | 0 | 34 |  |
| 102 | `phase-c-forced-decisions-validator.mjs` | PASS | 0 | 36 |  |
| 103 | `branch-lag-guard-validator.mjs` | FAIL | 1 | 44 | validator exited 1 — **newly blocking by design** (was silently non-blocking) |
| 104 | `deploy-matrix-topology-validator.mjs` | PASS | 0 | 32 |  |
| 105 | `topology-json-antifabrication-validator.mjs` | PASS | 0 | 30 |  |
| 106 | `no-scan-generated-agents-validator.mjs` | PASS | 0 | 66 |  |
| 107 | `prompt-perimeter-validator.mjs` | FAIL | 1 | 79 | validator exited 1 |
| 108 | `whole-repo-end-state-validator.mjs` | PASS | 0 | 34 |  |
| — | `foundation-stepup-report-validator.mjs` | NOT_APPLICABLE | — | — | not part of the `--lane=gate` selection (runs in `--lane=report`, where it **PASSes**, exit 0) |

### 5.1 First failure line per failing validator (verbatim)

| Validator | First reported violation |
|---|---|
| `tenant-isolation-validator` | `services/api-gateway/src/tenant/tenant-tables.registry.ts must match schema-derived tenant table registry; run scripts/generators/generate-tenant-table-registry.mjs` |
| `validate-design-system` | `marketing-site: dark mode must be reachable through the canonical provider toggle` (1 hard invariant + 9 ratchet regressions) |
| `package-ownership-validator` | `Package manifest lacks ownership file: packages/lcis-adapters/AGENTS.md` |
| `dependency-manifest-validator` | `packages/lcis-live/test/security.test.ts imports something, but something is not declared in packages/lcis-live/package.json` |
| `undeclared-import-validator` | *(identical to the above — 1-line alias)* |
| `provider-isolation-validator` | `Provider API URL usage must use packages/infrastructure adapters: packages/lcis-adapters/src/analytics-engine/AnalyticsEngineAdapter.ts` |
| `typescript-governance-validator` | `Package tsconfig must emit declaration maps: packages/lcis-adapters/tsconfig.json` |
| `custom-domain-target-validator` | `merchant UI must read public target env` |
| `merchant-domains-settings-validator` | `domains settings page missing NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET` |
| `platform-domain-literal-validator` | `Functional letbuyy.store literals must be migrated to letbuyy.com: apps/identity-platform/src/app/api/auth/create-store/route.ts:133 …` |
| `legacy-site-type-validator` | `marketing create page must expose portfolio/resume only behind the public legacy flag` |
| `domain-boundary-validator` | `Extracted schema facade must not define domain contracts locally: services/api-gateway/src/schemas/theme.schema.ts` |
| `route-line-count-validator` | `services/api-gateway/src/routes/themes.ts has 1870 lines; route files must stay at or below 1500 lines` |
| `single-source-crypto-validator` | `api-gateway route modules must import shared crypto helpers instead of declaring local copies: services/api-gateway/src/routes/themes/theme-update-route.ts` |
| `cms-slugify-validator` | `merchant-control-plane must import slugifyCmsTitle instead of declaring local slugify helpers: apps/merchant-control-plane/src/app/[store]/products/smart-collections/page.tsx` |
| `date-format-validator` | `apps must import date display helpers from @letbuyy/ui/formatting instead of declaring local formatDate helpers: apps/marketing-site/src/components/contact/TicketLookup.tsx, …` |
| `api-client-runtime-base-validator` | `apps/marketing-site/src/app/create/page.tsx must use the shared API base URL resolver` |
| `marketing-dead-twin-validator` | `marketing homepage must keep using live Header component` |
| `raw-error-message-validator` | `services/api-gateway/src/routes/resource-search.ts returns raw error.message for SEARCH_ERROR; add the code to sanitizePublicErrorPayload or remove the raw message` |
| `environment-validator` | `Tracked files contain secret-like values and must be redacted or moved to the secret store: packages/theme-engine/test/dynamic-source-binding.test.ts, packages/theme-engine/test/theme-engine.test.ts` |
| `branch-lag-guard-validator` | `Local working branch is 106 commit(s) ahead of main; main must be fast-forwarded (execute MERGE_RUNBOOK.md) before this branch can be treated as release-integrated` |
| `prompt-perimeter-validator` | `Prompt-class files outside docs/archive must be registered in PROMPTS.md as canonical or executed: V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/… (3 files)` |

No secret **values** appear above; only file paths and environment-variable **names**.

### 5.2 Inventory (dynamically discovered, not asserted)

```
discovered on disk    : 112 .mjs modules
  executable validators: 109
  library modules      : 2 (governance-common.mjs, phase-b-common.mjs)
  hook-only modules    : 1 (frozen-path-override-gate.mjs)
declared in lanes     : 109 (gate 108, report 1)
selected for this run : 108
undeclared on disk    : 0
declared but missing  : 0
```

**Current gate-lane count is 108.** The "107" in `.github/workflows/security-review.yml:7` and root `CLAUDE.md` is stale by one (open item E-20-02 in doc 20). The runner no longer hardcodes any count.

## 6. Reconciliation with the pre-repair matrix (Part A)

Two of Part A's measurements do **not** reproduce here, and the difference is itself a finding:

| Item | Part A (dirty original working tree) | Part B (clean worktree, committed tree) |
|---|---|---|
| Fail-fast stop point | validator **#6** `validate-design-system.mjs`; `tenant-isolation-validator` **PASSED** | `tenant-isolation-validator` (#2) **FAILS** — the committed `tenant-tables.registry.ts` does not match the schema-derived registry |
| Design-system hard invariants | **2** (`marketing-site` + `developer-portal`) | **1** (`marketing-site` only) |
| `appCssRawHex` | 156 | 98 |
| `appLocalLbTokenRedefs` | 339 | 220 |
| `appCssNakedRgbHsl` | 822 | 849 |

Both readings are correct for the tree they measured. The implication is that **the committed tree and the dirty working tree disagree in ways that change gate outcomes**, and the committed tree is worse on tenant isolation. Any Wave 0 readiness statement must name the tree state it measured. Logged as escalation **E-20-03** in doc 20.

Part A's §1 conclusions that **do** reproduce exactly: the 1-line delegation aliases (`undeclared-import-validator.mjs`, `wrangler-env-validator.mjs`) — now demonstrated by byte-identical output at indices 17/18 — and the 3 non-validator `.mjs` modules on disk, which the repaired runner now classifies explicitly rather than leaving unexplained.

## 7. Before / after

| | Pre-repair | Post-repair |
|---|---|---|
| Gate-lane validators executed | **2 of 108** (this worktree) / 6 of 108 (dirty tree) | **108 of 108** |
| Validators in unknown state | **106** | **0** |
| PASS | 1 | 84 |
| FAIL | 1 | 22 |
| BLOCKED (could not run) | concept did not exist | 2 |
| SKIP | concept did not exist | 0 |
| Silently non-blocking findings | 2 validators (`branch-lag-guard`, `pricing-catalog`) | 0 — `reporter.warn` has no callers; a declared-advisory channel replaces it and prints every advisory |
| Declared advisories in this run | n/a | **0** |
| Discovery | hardcoded array only | dynamic disk enumeration + drift reconciliation (drift = hard failure) |
| Exit code | 1 | 1 |

**Wave 0's bar is met.** Wave 0 does not require every validator to be green — it requires every applicable validator to **execute** or produce a truthful explicit blocker. 108/108 now do. The gate is still correctly RED, but for 24 individually attributable reasons instead of one that concealed 106 unknowns.

## 8. What remains UNVERIFIED (Part B)

- Behaviour of the repaired runner inside GitHub Actions — not executed here.
- The hardened generated-artifact cleanup against a tree that actually contains `node_modules`. This worktree has **zero** generated directories under `apps/`/`packages/`/`services/`, so its first-ever execution was a verified no-op. The guards are proven by unit tests against temporary fixtures, not by a live deletion.
- Whether `cycle-budget-validator` and `route-ownership-validator` pass once `typescript` is installed. They are `BLOCKED`, meaning **unevaluated** — not passing and not failing. Two governance invariants remain unmeasured at this SHA.
- That all 22 `FAIL`s are pre-existing rather than caused by the repair. Strongly indicated (no failure message references any touched file or the new module) but **not** proven by re-running each validator against a pristine baseline checkout, which would have required a second worktree or a destructive tree operation. `branch-lag-guard-validator` is the one failure that **is** attributable to this change, by design.
- `pnpm run build`, `lint`, `typecheck`, and the test suites — unchanged scope; see Part A §3.

## Raw evidence index (Part B)

Under `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/w0-validator-execution/`:
`20_pre-repair-gate.log` · `20_post-repair-gate.log` · `20_post-repair-gate-matrix.json` · `20_post-repair-report-lane.log` · `20_post-repair-report-lane.json` · `20_orchestration-tests.log`

## Correction carried into Part A

Part A §3 describes the merchant mobile app as "explicitly deferred to V1.1". **That phrasing is superseded.** Per the human decision recorded for Wave 0, `apps/mobile/merchant-app` is **HUMAN_DECISION_REQUIRED** — not "MOBILE_V1_1" and not "deferred". The governance chain (Constitution ART-04, `AGENTS.md` ARCH-R1, `LETBUYY_CANONICAL_SYSTEMS.md` row 28) still calls it CANONICAL with no V1/V1.1 split, and no ARB amendment authorising deferral exists. Wave 0 asserts no deferral. Mobile work is preserved and was not touched or merged into any Web V1 integration branch by this task. (`mobile-token-validator` and `mobile-topology-honesty-validator` both PASS at this baseline — indices 7 and 53.)

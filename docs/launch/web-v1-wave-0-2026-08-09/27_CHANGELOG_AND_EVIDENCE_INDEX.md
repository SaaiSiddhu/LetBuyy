# 27 — Wave 0 Changelog and Evidence Index

> **Evidence artifact, not governance authority.**
> This is a record of what Wave 0 did and where the proof sits. It amends nothing. The authority chain
> is `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → nested `AGENTS.md` →
> `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`, and it outranks every line below.

| Field | Value |
|---|---|
| **Date** | 2026-08-09 |
| **Baseline SHA** | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (`bf35062e`), human-approved |
| **Original repository** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`, branch `stepup/main` — **production-linked**, read-only for this agent |
| **Integration head** | `codex/web-v1-integration` @ `8ec05e210e2282bbaa70fd39bbf61904cb9e21ab` |
| **Push state** | **NOTHING IS PUSHED.** `git branch -r \| grep -c codex/` → **0**. No PR. No deploy. |

---

## 1. What is EXECUTED here vs INHERITED

### 1.1 EXECUTED by this agent, read-only, 2026-08-09

| ID | Command | Observed |
|---|---|---|
| C1 | `git rev-parse --abbrev-ref HEAD` / `rev-parse HEAD` | `stepup/main` / `bf35062eda22f4d881efd61fb1d36c8fc83baed1` — before **and** after |
| C2 | `git status --porcelain=v1 \| wc -l` | **6826** — before and after |
| C3 | `git stash list \| wc -l` | **2** — before and after |
| C4 | `git log --oneline --no-decorate bf35062e..codex/web-v1-integration` | **23** commits (§2, verbatim) |
| C5 | `git log --oneline --no-decorate bf35062e..<each short-lived branch>` | §3, verbatim |
| C6 | `git diff --shortstat bf35062e <branch>` | §2/§3 diffstats |
| C7 | `git merge-base --is-ancestor codex/emergency-appbridge-killswitch codex/web-v1-integration` | non-zero → **NOT an ancestor** |
| C8 | `git rev-list --left-right --count HEAD...origin/stepup/main` | `17  0` |
| C9 | `git rev-list --left-right --count origin/main...origin/stepup/main` | `0  274` |
| C10 | `git rev-list --count main..codex/web-v1-integration` | **129** |
| C11 | `git rev-parse origin/main` | `c2547049c0b5666661536d076046415714fb7d03` |
| C12 | `git branch -r \| grep -c "codex/"` | **0** |
| C13 | `git worktree list` | 6 Wave 0 worktrees + the original (§3.6) |
| C14 | `find … raw-evidence -type f \| wc -l`, `du -sh` | **421 files / 17 MB** (§6) |
| C15 | `ls -la docs/launch/web-v1-wave-0-2026-08-09/` | 27 documents present before this agent wrote (§4) |

### 1.2 INHERITED — attributed, not re-run here

Every measurement in §5 (build/test/gate/validator numbers), §7 (per-document verdicts) and the
corrections in §8 comes from the named Wave 0 document and the agent that produced it. **This agent ran
no build, no lint, no test, no governance gate, no Supabase command, and no provider command.**

### 1.3 UNVERIFIED

- **File-level completeness of the evidence tree is asserted from `find`, not from a hash-verified
  manifest**, except under `raw-evidence/preservation/`, which carries its own `SHA256SUMS.tsv` and
  `MANIFEST.json` (index sha256 `ac6c0cb4114e3d6bd1edc34034095e3d16b1f670dfd405ac6fc8bbdf6cfd0a50`,
  per doc 16). This agent did **not** re-verify those hashes.
- **No evidence file's *contents* were re-executed.** A log recording exit 0 is treated here as a record
  that an earlier agent observed exit 0, not as independent proof.
- **Document `25_*` does not exist** in this package (§4.2). Whether that number was reserved for a
  deliverable that was never produced, or renumbered, is **not established**.

---

## 2. The integration branch — `codex/web-v1-integration` @ `8ec05e21`

Worktree: `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration`

| Measure | Value |
|---|---|
| Commits vs baseline | **23** |
| Diff vs baseline | **155 files changed, 51,757 insertions(+), 1,003 deletions(−)** |
| Structure | 11 fix-porting commits (`bf35062e` → `bac1779b`, **134 files, +48,434/−920**) then **4 `--no-ff` merges** of the short-lived branches |
| Merge conflicts | **zero** |
| Ahead of local `main` | **129** commits — which is why `branch-lag-guard-validator` fails it |
| Pushed? | **No.** No remote ref exists. |

### 2.1 All 23 commits, newest first (verbatim `git log --oneline`)

| SHA | Subject | Kind |
|---|---|---|
| `8ec05e21` | `merge(wave-0): freeze the Web V1 scope perimeter as an enforced ratchet` | merge (`--no-ff`) |
| `5fa68c70` | `merge(wave-0): run and report every validator instead of failing fast` | merge (`--no-ff`) |
| `f82b9372` | `merge(wave-0): CI trigger coverage for the Web V1 integration branch` | merge (`--no-ff`) |
| `87cc6327` | `merge(wave-0): local environment toolchain pin into the Web V1 integration branch` | merge (`--no-ff`) |
| `bac1779b` | `fix(ui,docs): remove the two validator regressions this port introduced` | port |
| `924584f6` | `fix(tests): reword the wave-3 comment so it stops carrying the banned domain literal` | port |
| `d2168aef` | `docs: add the merchant-system and theme-system discovery evidence packages` | port |
| `e0c8d39c` | `fix(tests): stop the wave-3 governance test demanding the banned domain literal; add the missing money fixture table` | port |
| `c331f929` | `fix(api-gateway): close cross-tenant handle resolution, write sites.published, fail closed on uniqueness` | port — **security** |
| `f8b04288` | `fix(storefront-runtime): fail closed on unresolved store access and gate /preview on its token` | port — **security** |
| `18453a97` | `feat(merchant-control-plane): navigation IA, honest activation checklist, client-bundle fix` | port |
| `fcf3ca1f` | `fix(identity-platform): derive storefront hosts from the canonical domain (DEPLOY-R3)` | port |
| `9f584157` | `fix(theme-engine): repair empty product/collection/search renders and align experience compositions` | port — **carries FBR-38** |
| `15dd4bea` | `fix(marketing,shared-types): export the contact contract and repair the contact page build` | port — **unblocks the gateway bundle** |
| `66be517f` | `feat(ui): sidebar active-state affordance, exact-match nav, hydration-safe theme toggle` | port |
| `eff77adc` | `feat(governance): freeze the Web V1 scope perimeter as an enforced ratchet` | from `codex/w0-v1-perimeter` |
| `45958978` | `feat(governance): run and report every validator instead of failing fast` | from `codex/w0-validator-execution` |
| `43671d96` | `ci(governance): add workflow trigger coverage validator and reconcile BRANCH_STRATEGY` | from `codex/w0-ci-coverage` |
| `611ee20b` | `fix(governance): make silently non-blocking validator findings block` | from `codex/w0-validator-execution` |
| `b3025df3` | `ci(governance): report every gate step instead of fail-fasting` | from `codex/w0-ci-coverage` |
| `3a6831da` | `ci(workflows): gate the Web V1 integration branch in ci.yml` | from `codex/w0-ci-coverage` |
| `2a48d56a` | `chore(local-env): gitignore the isolated local-stack scratch root` | from `codex/w0-local-environment` |
| `d926569e` | `chore(toolchain): pin repo-level Node to the CI web-runtime line` | from `codex/w0-local-environment` |

### 2.2 What the four highest-value ported commits actually changed

| Commit | Change | Why it matters |
|---|---|---|
| `15dd4bea` | added `export * from './contact';` at `packages/shared-types/src/index.ts:4` | Nine symbols imported by `services/api-gateway/src/routes/contact-public.ts` and `src/lib/contact-request-email.ts` did not exist on the barrel. At the baseline the gateway **failed to bundle with 17 esbuild errors** while `workerd` still bound `127.0.0.1:8787` and every request hung. **A one-line fix.** `apps/marketing-site` went `tsc` exit 2 (24 errors) → exit 0. |
| `c331f929` | cross-tenant handle resolution closed; `sites.published` written; fail-closed on uniqueness | `subdomain` and `store_name` are unique only within their own column, so one handle could resolve to two tenants and return an arbitrary one. **No executed test — FBR-39.** |
| `f8b04288` | storefront fails **closed** on unresolved store access; `/preview` gated on its token | `/preview` previously served a full render of **any** store — password-gated, preview-only, offline, or unpublished — to any anonymous caller. **No executed test — FBR-39.** Also makes `INTERNAL_API_SECRET` + `LETBUYY_API_BASE_URL` hard launch prerequisites (FBR-40). |
| `9f584157` | Liquid `renderLimit` **250 → 5,000** | Repairs 4 failing theme-engine tests (1,722 pass / 4 fail → **1,730 pass / 0 fail**; 27 → 0 *"template render limit exceeded"*). Root cause: LiquidJS `renderLimit` is a **wall-clock** budget, so concurrent sections starved each other. **A documented DoS control relaxed 20× — FBR-38, security sign-off required.** |

Also on the port: `tests/security/theme-tenant-isolation.test.mjs` was **withheld** (FBR-44 — it reports
0 tests / exit 0 without a database), `apps/merchant-control-plane/src/app/globals.css` was **withheld**
as `HUMAN_REVIEW` (FBR-12 — +17 app-local `--lb-*` redefinitions including `--lb-color-primary: #7C3AED`
raw hex), and `apps/merchant-control-plane/public/__g3.html` + 2 PNGs were **rejected** (FBR-45 — a
developer scratch harness would have been publicly served from the merchant admin origin). **Zero
`apps/mobile/` files and zero migrations entered the branch.**

---

## 3. The five other branches

All local. All in their own worktree under
`/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/`. **None pushed.**

### 3.1 `codex/w0-ci-coverage` @ `43671d96` — 3 commits, **9 files, +870/−18**

| SHA | Subject |
|---|---|
| `43671d96` | `ci(governance): add workflow trigger coverage validator and reconcile BRANCH_STRATEGY` |
| `b3025df3` | `ci(governance): report every gate step instead of fail-fasting` |
| `3a6831da` | `ci(workflows): gate the Web V1 integration branch in ci.yml` |

Closes FBR-22 and FBR-24. `ci.yml` now triggers on `stepup/main` **and** `codex/web-v1-integration` for
both `pull_request` and `push`; `develop` was **deliberately retained** (removing an existing check is
the weakening direction under ART-02 / R-18). `architecture-governance.yml` gained `id` +
`continue-on-error` on 17 gate steps plus a final `gate-aggregate` step (`if: always()`, reads
`.outcome` not `.conclusion`, itself **not** `continue-on-error`). New validator
`workflow-trigger-coverage-validator.mjs` (exit 0: *"16 workflows parsed; 4 gated branches and 8 deploy
lanes checked"*) + `tests/ci/workflow-trigger-coverage.test.mjs` (exit 0). **Zero deploy-workflow
triggers modified**; all 8 deploy lanes proven unreachable from any `codex/*` branch, with a seeded
regression (`NEG-2`) that catches adding `codex/**` to `production-deploy.yml`. Merged as `f82b9372`.

### 3.2 `codex/w0-validator-execution` @ `45958978` — 2 commits, **7 files, +1,529/−64**

| SHA | Subject |
|---|---|
| `45958978` | `feat(governance): run and report every validator instead of failing fast` |
| `611ee20b` | `fix(governance): make silently non-blocking validator findings block` |

Closes FBR-08 and FBR-13 — **the defining Wave 0 repair.** `scripts/validate-governance.mjs:201-203`
exited on the first non-zero status, so at the committed baseline the gate died at validator **#2**
(`tenant-isolation-validator`) and **106 of 108 gate-lane validators were in an unknown state — not
skipped, not attempted, not evaluated**, including `canonical-ledger-only-validator`,
`identity-sole-issuer-validator` and `rls-force-coverage-validator`. After the repair all validators
execute with typed statuses. `reporter.warn()` — which pushed findings into a list that `finish()`
printed and ignored — was present in exactly two validators; both now `assert`. `createReporter` gained
an explicit `advisory()` channel; `warn()` survives only as a deprecated alias; a test scans every
validator on disk for remaining `warn(` callers. **No environment escape hatch was added, deliberately.**
The `fs.rmSync` purge at `:179` was re-anchored to the repo root, refuses to run when `cwd != repoRoot`,
plans before deleting, refuses git-tracked paths, and **BLOCKS** `stale-artifact-validator` on refusal
rather than passing. Merged as `5fa68c70`.

### 3.3 `codex/w0-v1-perimeter` @ `eff77adc` — 1 commit, **6 files, +911**

`feat(governance): freeze the Web V1 scope perimeter as an enforced ratchet`

Adds `config/governance/web-v1-scope-registry.json` (**50 capabilities, 55 probes**;
`artifactClass: GOVERNANCE_CONFIG_NOT_AUTHORITY`, hard-asserted so it cannot be re-badged as authority),
`scripts/validators/web-v1-scope-perimeter-validator.mjs`, one line in `scripts/validate-governance.mjs`,
`docs/governance/web-v1-scope-perimeter-governance.md`, two `package.json` scripts, and a
`scripts/validators/README.md` note.

Classification: **19 `WEB_V1_REQUIRED` · 16 `WEB_V1_DEFERRED` · 13 `FORBIDDEN_FROZEN` · 2
`HUMAN_DECISION_REQUIRED`**. The **32-signal known-activation baseline** sits under a heading the
validator hard-asserts contains the literal `NOT A CLEAN STATE`. There is deliberately **no `--update`
flag** — absorbing a new activation requires a reviewable human edit. The ratchet can only shrink.

**Both human decisions enforced in code, not prose:** `mobile_merchant_app` and `services/lcis-api` are
`HUMAN_DECISION_REQUIRED`, and `invariants.forbiddenClassificationsFor.mobile_merchant_app` explicitly
**rejects** `WEB_V1_DEFERRED`, `MOBILE_V1_1` **and** `WEB_V1_REQUIRED`.

Two negative tests proved it fails: creating an empty `services/api-gateway/src/routes/sms.ts` → exit 1
(new activation), and adding a bogus baseline entry for the INACTIVE `cqrs::runtime_wiring` → exit 1
(stale baseline). Both fixtures were removed immediately; `git status --short` showed no residue.
Merged as `8ec05e21`.

### 3.4 `codex/w0-local-environment` @ `2a48d56a` — 2 commits, **4 files, +13/−1**

| SHA | Subject |
|---|---|
| `2a48d56a` | `chore(local-env): gitignore the isolated local-stack scratch root` |
| `d926569e` | `chore(toolchain): pin repo-level Node to the CI web-runtime line` |

Pins Node to the **20** line (`.nvmrc`, `.node-version`, root `engines.node >= 20.9.0`) matching
`ci.yml` / staging / production `NODE_VERSION`. Records rather than "fixes" FBR-52 (`local-stack-up.mjs`
demands ≥ 22). Merged as `87cc6327`.

### 3.5 `codex/emergency-appbridge-killswitch` @ `6c3e17df` — 2 commits, **14 files, +1,356, 0 deletions**

| SHA | Subject |
|---|---|
| `6c3e17df` | `fix(governance): close the three ungated app-platform seams the prefix gate missed` |
| `df4abd5d` | `fix(governance): fail-closed hard gate over the frozen app-platform seam` |

**Verified NOT an ancestor of `codex/web-v1-integration`** (C7) — a separate ARB-governed review path,
deliberately. Status **`GATED_WITH_RESIDUAL_RISK`**. 59 proving tests pass with a falsification pass
proving they detect an absent gate. **Zero deletions in 1,356 insertions is the arithmetic proof that
this gates rather than removes** — one environment variable re-opens everything. Neither Next.js app was
compiled (no `node_modules` in that worktree; the offline mandate excluded registry access), and **no
deployed environment-variable value was ever read, in any environment, by design.**

### 3.6 Worktree topology (C13)

| Worktree | Branch | Head |
|---|---|---|
| `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` | `stepup/main` | `bf35062e` |
| `…/letbuyy-w0-worktrees/web-v1-integration` | `codex/web-v1-integration` | `8ec05e21` |
| `…/letbuyy-w0-worktrees/w0-ci-coverage` | `codex/w0-ci-coverage` | `43671d96` |
| `…/letbuyy-w0-worktrees/w0-validator-execution` | `codex/w0-validator-execution` | `45958978` |
| `…/letbuyy-w0-worktrees/w0-v1-perimeter` | `codex/w0-v1-perimeter` | `eff77adc` |
| `…/letbuyy-w0-worktrees/w0-local-environment` | `codex/w0-local-environment` | `2a48d56a` |
| `…/letbuyy-w0-worktrees/emergency-appbridge-killswitch` | `codex/emergency-appbridge-killswitch` | `6c3e17df` |

`git worktree list` also reports 12 **prunable** entries under a different, unrelated repository path
(`/Users/saai_sidd/Git/Letbuyy_Store/…`) at `c2547049`. **No `git worktree prune` was run** — pruning is
a destructive operation and was excluded by the mandate.

---

## 4. The document set

Location: `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/`

### 4.1 Existing before this agent (27 documents, C15)

| # | Document | Purpose |
|---|---|---|
| 01 | `01_AUTHORITY_AND_ARCHITECTURE_BASELINE.md` | The authority chain and the architecture baseline at `bf35062e`. **Header mislabels a porcelain v2 count as v1** (cosmetic — doc 30 §1). |
| 02 | `02_GIT_BASELINE_AND_BRANCH_GRAPH.md` | Branch graph, remotes, lag counts at the baseline. |
| 03 | `03_WORKTREE_CHANGE_CLASSIFICATION.md` | First classification of the 6,826 dirty paths. **Its "777 real content changes" figure is REFUTED — the true figure is 99.** |
| 04 | `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` | Per-path content-vs-mode register, 15 groups A–O. **Its "36 binary changes in frozen `apps/theme-marketplace`" finding is RETRACTED**, and it **under-registered** `apps/merchant-control-plane/src/app/globals.css` (+271/−73), so its groups sum to 98, not 99. |
| 05 | `05_READINESS_ZIP_RECONCILIATION.md` | Reconciles the prior readiness ZIP against repo truth; secret-shaped file scan (paths only). |
| 06 | `06_LCIS_INDEPENDENT_VERIFICATION.md` | Independent check of LCIS claims. |
| 07 | `07_WEB_V1_SCOPE_REGISTER.md` | First scope register. **§5's "alternative PSPs cleanly deferred" is RETRACTED by FBR-30.** |
| 08 | `08_WEB_V1_PERIMETER_AND_EXCLUSIONS.md` | Perimeter + exclusions; the 7,292-line `wc -l` of `routes/app-store/*.ts`. |
| 09 | `09_CI_BRANCH_COVERAGE_AUDIT.md` | The CI trigger gap (F-09-02, F-09-04) and branch-protection unreadability. |
| 10 | `10_VALIDATOR_EXECUTION_MATRIX.md` | Phase 1 validator matrix + the four red lanes, measured on the **dirty** tree. Its *"deferred to V1.1"* phrasing is **explicitly superseded** by doc 20. |
| 11 | `11_FALSE_GREEN_AND_FAIL_FAST_FINDINGS.md` | The false-green catalogue: fail-fast, `--update`, `reporter.warn`, regex-only design-system checks. |
| 12 | `12_LOCAL_ENVIRONMENT_ISOLATION_PLAN.md` | The isolation design; raises the production Supabase link as its first critical finding. |
| 13 | `13_REPRODUCIBILITY_AND_TOOLCHAIN_BASELINE.md` | Toolchain pins. **§1 arithmetic is wrong: 6785+777+10+31 = 7603 ≠ its own stated 6826** — it conflates the raw porcelain `M` count (6,785) with the true zero-diff subset (6,018). |
| 14 | `14_INDEPENDENT_REVIEW_AND_FALSIFICATION.md` | Independent reproduction: lint byte-for-byte, governance gate byte-for-byte. |
| 15 | `15_BASELINE_DECISION_RECORD.md` | Why `bf35062e` is the baseline: every alternative branch is a strict ancestor; choosing one discards 17–291 commits for zero gain. |
| 16 | `16_DIRTY_WORKTREE_PRESERVATION_RECORD.md` | **Authoritative on the dirty tree.** 214 preserved files, 7.7 MB, round-trip proof: 99/99 reconstructed files **byte-identical**, 0 mismatches. |
| 17 | `17_BRANCH_AND_WORKTREE_TOPOLOGY.md` | Branch + worktree topology. |
| 18 | `18_REVIEWED_FIX_PORTING_REGISTER.md` | The 11-commit port, decision by decision, with escalations E-A/E-B/E-C. |
| 19 | `19_CI_REPAIR_AND_BRANCH_PROTECTION_EVIDENCE.md` | The CI repair evidence; converts every branch-protection checkbox from `[x]` to `[ ]` under an **UNVERIFIED** heading rather than assert it. |
| 20 | `20_VALIDATOR_RUNNER_REPAIR_EVIDENCE.md` | The runner repair; findings F-20-01 (`--update` bypass), F-20-02 (alias validators). |
| 21 | `21_WEB_V1_SCOPE_FREEZE_EVIDENCE.md` | The scope registry, its two negative tests, and escalations `ESC-STRIPE-LIVE`, `ESC-WASM-APPFUNCTIONS`, `ESC-GATE-FAILFAST`. |
| 22 | `22_LOCAL_STACK_EXECUTION_EVIDENCE.md` | The isolated stack boot; the gateway-bundle blocker; the gate dying at #2 on a clean tree. |
| 23 | `23_BUILD_AND_TEST_BASELINE.md` | The post-integration build/test/gate baseline — 37 invocations, every one logged. |
| 24 | `24_WAVE_0_FAILURE_AND_BLOCKER_REGISTER.md` | **The 52-entry blocker register.** Two independent severity axes. |
| 28 | `28_APPBRIDGE_URGENT_REACHABILITY_VERDICT.md` | The reachability adjudication: 19 of 83 routes execute for an unauthenticated caller in production shape. |
| 29 | `29_APPBRIDGE_KILLSWITCH_IMPLEMENTATION.md` | The kill-switch implementation, its 3 later seam fixes, and its own list of what it did **not** close. |
| 30 | `30_CORRECTIONS_AND_STASH_HAZARD.md` | The correction pass, plus **Hazard A (two stashes)** and **Hazard B (intent-to-add trap)**. |

### 4.2 Gap

**There is no `25_*` document in this package.** Stated as an observation, not a claim about intent.

### 4.3 Written by this agent

| # | Document | Purpose |
|---|---|---|
| 00 | `00_README_AND_AUTHORITY.md` | Package entry point: authority, reading order, baseline, headline verdict. |
| 26 | `26_WAVE_1_HANDOFF_AND_DEPENDENCY_ORDER.md` | The 16-workstream Wave 1 handoff, entry blockers, dependency order. |
| 27 | `27_CHANGELOG_AND_EVIDENCE_INDEX.md` | This file. |

### 4.4 Complete list of files this agent wrote

1. `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/26_WAVE_1_HANDOFF_AND_DEPENDENCY_ORDER.md`
2. `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/27_CHANGELOG_AND_EVIDENCE_INDEX.md`
3. `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/00_README_AND_AUTHORITY.md`

Nothing else, anywhere.

---

## 5. Changelog of measurements — what Wave 0 changed about what is *known*

Chronological by the phase that produced it. **Every number below was measured by the named document.**

### 5.1 The governance gate went from unmeasured to measured

| Property | Before Wave 0 | After Wave 0 (on `8ec05e21`) |
|---|---|---|
| Gate-lane validators | 108 declared | **110** (baseline 108 + `web-v1-scope-perimeter` + `workflow-trigger-coverage`) |
| Validators that actually executed | **2** on a clean checkout (gate died at `#2 tenant-isolation-validator`); 6 on the dirty tree (died at `#6 validate-design-system`) | **all 110** |
| Typed result | none — 106 of 108 in an **unknown** state | `PASS=90 FAIL=20 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1`, exit 1 |
| Report lane | — | exit **0** |
| Validators that structurally could not fail | **2** (`branch-lag-guard`, `pricing-catalog` — `reporter.warn()`) | **0** — `branch-lag-guard` now genuinely **FAILS** (129 ahead of `main`); `pricing-catalog` now genuinely **PASSES** |

**Concentration finding:** ≈4 of the 20 failures are caused entirely by `packages/lcis-*` and
`services/lcis-api` — `package-ownership` (21 manifests), `provider-isolation` (7 files, all
`packages/lcis-adapters/**`), `typescript-governance` (~110 findings, 100 % `lcis-*`), and half of
`dependency-manifest`/`undeclared-import`. **Classifying LCIS is a prerequisite for a green gate.**

**Newly reachable hazard:** the gate's `fs.rmSync` purge fires now that the gate no longer dies early —
it **removed 57 directories** in doc 23's run, including every workspace `node_modules` (9 apps, 41
packages, 5 services) and 3 package `dist/` outputs. Only gitignored output was touched; `git status`
after the session showed no tracked file removed. **Running the governance gate uninstalls the
workspace** — order every pipeline gate → reinstall → build → test.

### 5.2 Builds, lint and tests, measured for the first time

| Lane | Result |
|---|---|
| `merchant-control-plane` `next build --webpack` | **exit 0** |
| `storefront-runtime` `next build --webpack` | **exit 0** |
| `identity-platform` `next build --webpack` | **exit 0** |
| `marketing-site` `next build --webpack` | **exit 0** |
| `platform-console` `next build --webpack` | **exit 1** — `TS2344`, `src/app/(dashboard)/developers/page.tsx`; Next 16 requires `PageProps.searchParams` to be a `Promise` |
| `api-gateway` `build` (= `tsc --noEmit`) | exit 0 — **but it emits nothing and bundles nothing** |
| `api-gateway` independent esbuild bundle | **0 errors, 0 warnings**, 18.1 MB raw / ~2.57 MiB gzipped |
| `pnpm run typecheck` | **exit 0**, all 50 packages cache-miss (not a cached green) |
| Per-app lint (5 apps) | **all fail**; **200 errors / 1,430 warnings** total (`merchant-control-plane` 122 · `marketing-site` 70 · `storefront-runtime` 4 · `platform-console` 3 · `identity-platform` 1) |
| `lint:css` | **exit 2** — one auto-fixable `color-hex-length` error |
| `test:behavioral` (Postgres fixture **up**) | **11 fail / 1,608** |
| `test:behavioral` (fixture **down**) | 30 fail / 1,608 — the 19-suite delta is connection failure in `tests/executable/`, not logic |

**The most instructive result in the package:** `platform-console`'s build failure is invisible to all
110 validators, invisible to `turbo typecheck` (exit 0), and invisible to CI as configured. Root
`CLAUDE.md` warned that the gate does not cover `next build`. **That warning is now evidenced, not
merely asserted.**

### 5.3 The local stack went from theory to booted

Doc 22: the isolated Supabase stack **booted** — 8 services healthy, **124/124 migrations applied**
(versions 000..195), **438 tables**, 204 functions, **997 RLS policies**, all 6 canonical money RPCs
present, all business tables **0 rows**, DB at `127.0.0.1:15422` (**proven not the remote pooler**).
Isolation was proven by 5 independent guarantees **before any command ran**, and the Supabase CLI is
**not logged in anywhere on this machine** (`ls ~/.supabase/access-token` fails in both the real and the
isolated home). `supabase db reset` was **never** run.

One disclosed outbound call (FBR-51): `wrangler dev` attempted Cloudflare's public `Request.cf` metadata
fetch and **timed out**. Unauthenticated, no credential presented, no LetBuyy resource touched. **No
call to Supabase Cloud, Razorpay, Resend, Turnstile or any LetBuyy production provider occurred.**

### 5.4 The App Bridge surface went from asserted to adjudicated

Doc 28/29: **83 routes** enumerated at runtime from `appStoreRouter.routes` + `appApiRouter.routes`. In
a **production-shaped** environment (`FEATURE_EXTENSIONS = "false"`, `ENVIRONMENT`/`APP_ENV`/`NODE_ENV`
= `production`, env reconstructed **verbatim** from `services/api-gateway/wrangler.toml` at `bf35062e`),
**19 of 83 execute their handler for a caller with no credential of any kind**, nine returning
`200 {"success":true,…}`. `POST /v1/app-store/oauth/token` negotiates (`400 VALIDATION`, *"grant_type
must be authorization_code or refresh_token"*). `POST /v1/app-store/bridge/fetch` responds. **Only 2 of
83 (2.4 %)** are disabled by the one flag that exists. `GET /v1/storefront/{subdomain}` returns `200`
with `app_blocks` carrying a third-party `iframe_url` rendered as
`<iframe sandbox="allow-forms allow-popups allow-scripts allow-same-origin">` — `allow-scripts` +
`allow-same-origin` together is an **escapable sandbox** on the buyer-facing storefront.

### 5.5 The dirty tree went from 777 to 99

| Figure | Value | Superseded |
|---|---:|---|
| Dirty paths | **6,826** | 6,825 (timing) |
| **Real content changes** | **99** | ~~777~~ |
| — binary | **0** | ~~678~~ |
| Mode-only / zero-content | **6,696** (6,018 textual `0 0` + 678 identical-blob `100644→100755`) | — |
| Untracked | **31** | 30 (timing) |
| Real content changes under `apps/theme-marketplace/` | **0** | ~~36~~ |
| Stashes | **2** | — |
| Intent-to-add files armed | **10** (789 lines / 43,929 bytes) | — |

Decisive test: comparing the `git ls-files --stage` index blob against `git hash-object` of the on-disk
file for all 678 supposedly-binary changes → **678/678 IDENTICAL, 0 different**. Corroborated three
ways. `git diff --numstat` prints `-\t-` for **any** binary path, *including one whose only delta is the
permission bit* — that is the exact mechanism by which the earlier classification read 678 mode flips as
content deltas.

---

## 6. Evidence index

Root: `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/`

**421 files, 17 MB** (C14). Note: `.gitignore:74` already ignores `artifacts/local-operational-proof/`,
so **the evidence tree is itself uncommitted and machine-local** (FBR-33's residual risk).

### 6.1 Top-level

| Path | Files | Purpose |
|---|---:|---|
| `19_aggregate_gate_logic_proof.txt` | 1 | Proof that `architecture-governance.yml`'s new `gate-aggregate` step exits 1 on any non-success, **including skipped/missing**, by reading `.outcome` not `.conclusion` |
| `19_seeded_regression_proof.txt` | 1 | The `NEG-2` seeded regression: adding `codex/**` to `production-deploy.yml` is caught |
| `19_tests_ci.txt` | 1 | `tests/ci/workflow-trigger-coverage.test.mjs` run |
| `19_validator_run.txt` | 1 | `workflow-trigger-coverage-validator.mjs` — *"16 workflows parsed; 4 gated branches and 8 deploy lanes checked"* |
| `19_yaml_syntax_validation.txt` | 1 | YAML parse proof for every edited workflow |

### 6.2 `A/` — baseline topology (2 files)

`topology-and-git-facts-2026-08-09.txt` (branch graph, remotes, lag), `validate-governance-2026-08-09.txt`
(the pre-repair gate run). **Backs docs 01, 02.**

### 6.3 `D/` — scope and perimeter reconnaissance (13 files)

`app_bridge_evidence.txt`, `gateway_route_mounts.txt`, `gw_files.txt`, `feature_flag_search.txt` (the
`grep` that returns **0 matches** for any feature-flag mechanism in either web app), `frozen_apps_check.txt`,
`deferred_pages_head.txt`, and the per-app route/page inventories (`id_*`, `mcp_*`, `sf_*`).
**Backs docs 07, 08.**

### 6.4 `F/` — toolchain and link state (6 files)

`00_git_and_tool_versions.txt`, `01_supabase_link_state.txt` (**listed, not read** — no project ref,
pooler URL or version string copied), `02_port_map_and_federation_stack.txt`,
`03_env_template_keys.txt` (**names only**), `04_lockfile_vs_package_json_check.txt`,
`05_toolchain_pins.txt`. **Backs docs 12, 13.**

### 6.5 `W0-LOCAL-ENV/` — the isolated stack (6 files)

`01_isolation_proof.txt` (the 5 guarantees, proven **before** any command ran),
`02_toolchain_and_node_pin.txt`, `03_isolated_stack_boot_proof.txt` (124/124 migrations, 438 tables,
997 policies, `127.0.0.1:15422`), `04_gateway_boot_and_baseline_build_blocker.txt` (**the 17 esbuild
errors and the hung `workerd`**), `05_app_tier_boot.txt`, `06_nondestructive_teardown.txt`.
**Backs doc 22.**

### 6.6 `W0-V1-PERIMETER/` — the scope ratchet (6 files)

`01-perimeter-report.txt` (all 55 probe states, exit 0), `02-perimeter-enforce.txt` (exit 0),
`03-negative-test-new-activation.txt` (**exit 1** — the `sms.ts` fixture), `04-negative-test-stale-baseline.txt`
(**exit 1** — the bogus `cqrs::runtime_wiring` entry), `05-full-gate-run-clean-worktree.txt` (**exit 1
at position 2 of 109**), `06-design-system-clean-worktree.txt` (1 hard invariant + 9 ratchet regressions).
**Backs doc 21.** The two negative tests are the reason the ratchet can be believed: a check that has
never been shown to fail is not a check.

### 6.7 `agent-b/` — the raw dirty-tree diffs (5 files)

`git-status-porcelain-v2-full.txt`, `git-diff-numstat-full.txt`, `git-diff-summary-full.txt`,
`git-diff-cached-numstat-full.txt`, `git-diff-cached-summary-full.txt`. **Backs docs 03, 04** — and is
the raw material from which doc 16 **refuted** them.

### 6.8 `agent-c/` — readiness ZIP reconciliation (20 files)

`agent-c-command-log.txt`, `validate-governance-stdout-exit1.txt`, and
`extracted/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/` — the extracted prior readiness package.
**Backs doc 05.**

### 6.9 `agent-e/` — the four red lanes (9 files)

`pnpm-lint.log`, `pnpm-typecheck.log`, `pnpm-test-behavioral.log`, `pnpm-test-contracts.log`,
`validate-governance-gate-lane.log`, `workflow-triggers-raw.txt`,
`github-branch-protection-check.log` (**the token cannot read protection settings — this is FBR-23's
primary evidence**), `root-package-scripts.txt`, `catch-without-exit-heuristic.txt`.
**Backs docs 09, 10, 11.**

### 6.10 `appbridge-urgent/` — the App Bridge adjudication (71 files)

| Sub-path | Purpose |
|---|---|
| `lens1-gateway-mounts.md`, `lens2-ui-config-shapes.md`, `lens3-executable-proof.md` | Three independent lenses on the same question, so the verdict does not rest on one method |
| `probe-raw/` (11 files) | `enumerate.mts`, `probe2.mts`, `probe3-isolated.mts` + the per-environment JSON results: `production.json`, `production-noflag.json`, `staging.json`, `staging-extfalse.json`, `staging-noflag.json`, `local.json`, `isolated.json`, `matrix.md` — **this is where "19 of 83" comes from** |
| `reproduction-probes/` | `tmp-appbridge-probe`, `tmp-appbridge-mount-probe`, `tmp-probe-cfg-bypass` — reproduction harnesses |
| `killswitch-raw/` (10 files) | `commit-df4abd5d.patch`/`.stat`, `gateway-suite.log`, `behavioral.log`, `gov.log`, `tsc-gateway.log`, `ui-ks.log`, `ks-final.log`, **`ks-falsify.log`** (the falsification pass), `appbridge-existing.log` |
| `30_final_test_results.txt` | The 59 passing proving tests |
| `31_bypass_reproduction_and_closure.txt` | The three seams the prefix gate missed, reproduced and closed |
| `32_falsification_and_regression.txt` | **Proof that the tests fail when the gate is absent** |

**Backs docs 28, 29.**

### 6.11 `build-baseline/` — the 37-invocation command ledger (45 files)

`00_COMMAND_LEDGER.tsv` is the index. Every row has its own log, including the failures and the three
**invalid harness runs** that were kept rather than deleted (`11_lint_root_continue.log` —
`pnpm run lint -- --continue` forwards `--continue` to **eslint**, not turbo, and measured nothing).
Highlights: `03_governance_gate_full.log` (the 110-validator matrix),
`14_bundle_api_gateway_esbuild.log` (**0 errors**), `19_build_platform_console.log` (**exit 1**),
`24_test_behavioral.log` vs `26_test_behavioral_with_pg.log` (**30 vs 11** — the fixture delta),
`32_test_payment_postgres_isolated.log`, `35_lint_css.log` (exit 2).
**Backs doc 23.** A deleted failed attempt is exactly what this ledger exists to prevent.

### 6.12 `doc-corrections/` — the falsification pass (5 files)

`99-real-content-changed-paths.txt` (the true set), `678-binary-mode-only-paths.txt` (the refuted set),
`stash0-28-files.txt` + `stash0-numstat.txt` (**Hazard A**),
`verification-transcript-2026-08-09.txt`. **Backs doc 30.**

### 6.13 `g/` — independent re-runs (7 files)

`governance-gate-rerun.txt`, `identity-platform-lint-rerun.txt`, `git-counts-rerun.txt`,
`app-store-mount-rerun.txt`, `supabase-link-state-rerun.txt`, `secrets-scan-rerun.txt`,
`constitution-agents-citation-check.txt`. **Backs doc 14** — the second agent reproduced the lint result
and the governance-gate result **byte-for-byte**. `test:behavioral` and `test:contracts` were **not**
independently re-run and remain single-source.

### 6.14 `preservation/` — the uncommitted-work preservation area (214 files, 7.7 MB)

**The most safety-critical artifact in the package.**

| Path | Purpose |
|---|---|
| `MANIFEST.json` | The index; per doc 16 its sha256 is `ac6c0cb4114e3d6bd1edc34034095e3d16b1f670dfd405ac6fc8bbdf6cfd0a50` |
| `SHA256SUMS.tsv` | SHA-256 of every preserved artifact |
| `ROUNDTRIP_PROOF.tsv` | **The proof:** `git archive bf35062e \| tar -x` into a scratch dir (6,904 files) → `git apply --check` exit 0 → `git apply` exit 0 → SHA-256 of all 99 reconstructed files vs the live worktree → **99/99 BYTE-IDENTICAL, 0 mismatches** |
| `REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch` | **The patch to port with** (`f4f79390…`) |
| `REAL_CONTENT_CHANGES_99.binary.patch` | The mode-flip-inclusive variant |
| `BINARY_MODE_ONLY_PROOF.tsv` | The 678/678 identical-blob proof that refuted "777" |
| `BINARY_CHANGES.tsv`, `MODE_ONLY_NOISE.txt` | The mode-flip inventory |
| `DISPOSITION_REGISTER.tsv` | Per-path disposition (PORT / HUMAN_REVIEW / REJECT / PRESERVE_OUTSIDE_WEB_V1) |
| `patches/` (99 files) | One patch per real content change |
| `intent-to-add-raw/` (10 files) | **Hazard B**: migrations `196`, `197` and rollbacks `180`, `181`, `188`, `189`, `190`, `191`, `196`, `197`, verbatim, with byte counts and SHA-256 |
| `untracked-raw/` (96 files) | The untracked payload |

### 6.15 `w0-validator-execution/` — the runner repair (6 files)

`20_pre-repair-gate.log` (dies early), `20_post-repair-gate.log` + `20_post-repair-gate-matrix.json`
(**every validator, typed**), `20_post-repair-report-lane.log` + `.json`, `20_orchestration-tests.log`.
**Backs doc 20.** The pre/post pair is what makes the repair a measurement rather than a claim.

### 6.16 Not in the evidence tree, but named by it

`/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/letbuyy-merchant-app-v1-readiness-2026-08-09.zip`
— the prior readiness ZIP reconciled by doc 05. Also present:
`artifacts/local-operational-proof/theme-marketplace-ga/` (pre-dates Wave 0; not produced by it).

---

## 7. Cross-reference: document → evidence → blocker

| Document | Primary evidence | Principal blockers it produced |
|---|---|---|
| 01, 02 | `A/` | — |
| 03, 04 | `agent-b/` | FBR-35; **both partly refuted by doc 16 → FBR-36** |
| 05 | `agent-c/` | — |
| 07, 08 | `D/` | FBR-29, FBR-30 (`ESC-STRIPE-LIVE`), FBR-31 (`ESC-WASM-APPFUNCTIONS`) |
| 09 | `agent-e/github-branch-protection-check.log`, `workflow-triggers-raw.txt` | FBR-22, FBR-23, FBR-25 |
| 10, 11 | `agent-e/*.log` | FBR-08, FBR-10, FBR-11, FBR-13, FBR-14, FBR-15, FBR-16, FBR-17…FBR-20 |
| 12, 22 | `F/`, `W0-LOCAL-ENV/` | FBR-21, FBR-32, FBR-42, FBR-43, FBR-51, FBR-52 |
| 14 | `g/` | — (independent reproduction) |
| 15, 16 | `preservation/` | FBR-33, FBR-34, FBR-35, FBR-36, FBR-37 |
| 18 | port commits + `build-baseline/` | FBR-12, FBR-38, FBR-39, FBR-40, FBR-44, FBR-45, FBR-49, FBR-50 |
| 19 | `19_*.txt` | FBR-24 (repaired), FBR-23 (open) |
| 20 | `w0-validator-execution/` | FBR-08, FBR-13 (repaired); FBR-11, FBR-14, FBR-47, FBR-48 (open) |
| 21 | `W0-V1-PERIMETER/` | FBR-06, FBR-07, FBR-29, FBR-30, FBR-31 |
| 23 | `build-baseline/` | FBR-18 (`platform-console`), FBR-16 (the 57-directory purge), FBR-41 |
| 24 | all of the above | **the 52-entry register itself** |
| 28, 29 | `appbridge-urgent/` | FBR-01, FBR-02, FBR-03, FBR-04, FBR-05, FBR-46 |
| 30 | `doc-corrections/` | FBR-36 (retraction); **Hazard A** (stashes), **Hazard B** (intent-to-add) |

---

## 8. Corrections applied across the package — read these before citing any earlier figure

Wave 0 refuted itself four times, and the refutations are the most valuable output in the package.

1. **"777 real content changes (99 textual + 678 binary)" is REFUTED. The true figure is 99.** All 678
   "binary content changes" are **mode-only flips**: index blob == worktree blob, **678/678**, proven.
   `git diff --numstat` prints `-\t-` for any binary path, including one whose only delta is the
   permission bit. **Never re-cite 777.** Doc 16 is authoritative over docs 03/04 on this point.
2. **Doc 04's "36 binary changes inside the frozen `apps/theme-marketplace` surface" is RETRACTED** —
   those were mode flips. The real content-change count under `apps/theme-marketplace/` is **0**.
   (Separately, three of the 17 unpushed `stepup/main` commits *do* touch that frozen app — FBR-37 —
   which is a different, still-open finding.)
3. **Doc 04 under-registered a real change:**
   `apps/merchant-control-plane/src/app/globals.css` (**+271/−73**) appears in none of its 15 groups —
   A–O sum to **98**, not 99.
4. **Doc 13 §1 arithmetic is wrong:** its four bucket sizes (6,785 + 777 + 10 + 31 = **7,603**) do not
   sum to its own stated total of **6,826**. It conflates the raw porcelain `M` count (6,785) with the
   true zero-diff subset (6,018).
5. **Doc 01's header mislabels a porcelain v2 count as v1** (cosmetic).
6. **Doc 07 §5's "alternative PSPs cleanly deferred" is RETRACTED** — Stripe is wired into the live
   payment and checkout routers, gated only by an unset `STRIPE_SECRET_KEY` (FBR-30).
7. **Doc 10's *"deferred to V1.1"* phrasing for mobile is explicitly superseded by doc 20.** Wave 0
   asserts **no** mobile deferral; `apps/mobile/merchant-app` is CANONICAL in the governance chain
   (`LETBUYY_CANONICAL_SYSTEMS.md:99` row 28, `AGENTS.md:80`, Constitution ART-04) with no ARB amendment
   authorising a deferral, and the scope registry **rejects** `WEB_V1_DEFERRED`, `MOBILE_V1_1` and
   `WEB_V1_REQUIRED` for it in code.
8. **Two hazards discovered late and present in no earlier document** (doc 30):
   **Hazard A** — two stashes; `stash@{0}` (`f8a6c8c7…`) holds 28 files (+1,128/−1,203), a **third
   divergent body of uncommitted work**, unreachable from the baseline, including four **already-committed**
   migrations and three **deletion-only** `wrangler.toml` changes. **Document only — no stash command
   beyond `list`/`show`.**
   **Hazard B** — the intent-to-add trap is **still armed**: 10 SQL files hold empty blob `e69de29b` in
   the index while carrying 789 lines / 43,929 bytes on disk. A `git commit` with other paths staged
   **silently drops all ten and leaves the `A` entries intact**; `git checkout-index -a` writes 0-byte
   files. Migration `196` is *theme RLS tenant hardening*.

**The standing rule this establishes:** never copy a readiness percentage, a file count, or a pass/fail
number from an earlier document. Re-measure, and if the new number differs, publish both and say which
tree each was measured on.

---

## 9. Safety attestation

- **Read-only.** No file outside the three deliverables listed in §4.4 was created, edited or deleted.
- **No prohibited command was run, from any directory:** no `supabase` command of any kind, no
  `wrangler`, no provider or deploy command, no `git add`, `commit`, `push`, `stash` (beyond none at
  all), `clean`, `reset`, `checkout --`, `restore`, `chmod`, `worktree remove`, `worktree prune`,
  force-push or history rewrite. No PR was created. Nothing was deployed.
- **The production-linked original working tree is unchanged:**

| Property | Before | After |
|---|---|---|
| Branch | `stepup/main` | `stepup/main` |
| `HEAD` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
| `git status --porcelain=v1 \| wc -l` | **6826** | **6826** |
| `git stash list \| wc -l` | **2** | **2** |

- **No secret value appears anywhere.** Environment variable **names** only. **No `.env*` file was
  opened.** `supabase/.temp` was not read by this agent.

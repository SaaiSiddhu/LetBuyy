# 23 — Build and Test Baseline (measured, post-integration)

**Evidence artifact, not governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, then root `AGENTS.md`, then the relevant local `AGENTS.md`, then `LETBUYY_CANONICAL_SYSTEMS.md`. Where this document appears to conflict with those, the governance chain wins and the conflict is logged in §14.

| Field | Value |
|---|---|
| Date | **2026-08-09** |
| Repo SHA measured | **`8ec05e210e2282bbaa70fd39bbf61904cb9e21ab`** (branch HEAD at measurement) |
| Branch | `codex/web-v1-integration` (local commits only — **not pushed**) |
| Worktree | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration` |
| Wave 0 baseline for comparison | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (human-approved) |
| Toolchain observed | node **v26.5.1** · pnpm **10.6.2** · docker **29.6.2** |
| Raw evidence | `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/build-baseline/` (`00_COMMAND_LEDGER.tsv` + 37 per-command logs) |

**Mode: EXECUTED.** Every result below was produced by running the command and observing its exit code. Nothing was carried over from a prior document. Phase 1's numbers (`lint exit 1`, `typecheck exit 1`, `33/1576` behavioral, `13/200` contracts) were **re-measured, not copied** — see §11, where three of the four changed.

**Headline:** the branch is **not green**, but it is materially healthier than the baseline Phase 1 described, and for the first time the *whole* validator surface has actually run.
- **Every gate validator executed** for the first time (110/110, zero blocked): **90 PASS / 20 FAIL**. At the baseline the runner died at validator #2 or #6 and 102–108 validators were **unmeasured**, not passing.
- **Root `typecheck` is exit 0** across 50 packages — but `next build` for `platform-console` still fails on a type error `tsc --noEmit` cannot see (§8.3). This is the exact hazard root `CLAUDE.md` warns about, now demonstrated rather than asserted.
- **The doc-22 §5 gateway build blocker is resolved on this branch** — the worker now bundles with **0 errors** (§8.2).
- **Three new false-green mechanisms** were found while measuring (§12.1, §12.2, §12.6).

---

## 1. What is EXECUTED, INFERRED, and UNVERIFIED

**EXECUTED** — every row of the §3 ledger: 37 command invocations, each with a recorded working directory, start/end UTC timestamp, exit code, and log path. All counts in §4–§10 are read out of those logs.

**INFERRED** (stated as inference, never as a measurement):
- The classification of individual failures as "product defect" vs "harness/fixture defect" (§9.5, §10). The exit codes are measured; the attribution is reasoned from the error text and, where cheap, confirmed by a follow-up probe (e.g. §9.5.1 was confirmed by `docker exec … psql -c "select datname …"`).
- The Cloudflare Worker size assessment in §8.2 — the bundle byte counts are measured; whether wrangler's own bundle would land at the same size is inference, because wrangler was deliberately not invoked.

**UNVERIFIED** — listed exhaustively in §13. The largest items: nothing was measured on **Node 20** (the CI and repo pin); no app was booted; no money RPC was invoked; `apps/mobile/merchant-app` was not touched at all.

---

## 2. Environment classification and isolation

Every command in §3 carries the classification **`isolated local worktree`**. Concretely:

| Property | State | How it was assured |
|---|---|---|
| Repository under measurement | the isolated git worktree, **not** the production-linked original | all commands run with `cwd` = the worktree; the ledger records `workdir` per command |
| Supabase Cloud | **never contacted** | no `supabase` command of any kind was run in this workstream — no `db push/pull/reset/dump`, no `seed`, no `link`/`unlink`, no `migration up`, no provider or deploy command, from anywhere |
| Database used by tests | `postgres:16-alpine` in the local docker container `letbuyy-executable-pg`, **no published host port** (`5432/tcp`, unmapped), reached only via `docker exec` | `docker ps` output recorded; started and stopped with the repo's own `scripts/governance/foundation-ephemeral-postgres.mjs` (§9.5) |
| Docker image pull | **none required** — `postgres:16-alpine` was already present locally | `docker images postgres:16-alpine` before starting |
| Network | no command was invoked that requires the network. `pnpm install --frozen-lockfile` resolved entirely from the local store (`downloaded 0`). **`wrangler` was deliberately NOT run**, specifically to avoid the outbound `Request.cf` fetch disclosed in doc 22 §11.1 — the gateway bundle was produced with a direct local `esbuild` call instead (§8.2) | install log; §8.2 method note |
| Provider credentials | none present, none used. Builds ran with the same non-secret placeholders `ci.yml:255-257` uses (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder_anon_key`, `NEXT_PUBLIC_APP_URL=https://letbuyy.com`) | ledger + build logs |
| Secrets in evidence | none. No `.env*` file was read, and no secret **value** appears in any log or in this document — env var **names** only | this document; logs |
| Original repository | **untouched** except the two permitted output paths (this document, and `raw-evidence/build-baseline/`). No git state-changing command was run against it | §15 |

**Toolchain deviation, recorded not hidden:** the worktree pins Node **20** (`.nvmrc`, `.node-version`, added by commit `d926569e` and merged as `87cc6327`), and `ci.yml:21` pins `NODE_VERSION: "20"`. The only Node on this machine is **v26.5.1** (`/opt/homebrew/bin/node`; no nvm/fnm/volta/asdf install, no Node 20 available). Every result below is therefore **measured on Node 26, not on the CI/repo-pinned Node 20**. Root `engines.node` is `">=20.9.0"` — a floor — so Node 26 satisfies it and nothing refused to run. But **no claim in this document should be read as a Node 20 result**, and §12.6 turns out to be a case where the Node version may matter directly.

---

## 3. Command ledger (all 37 invocations, EXECUTED)

Working directory for every row: `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration`. Environment classification for every row: **isolated local worktree, no remote provider call**. Logs live at `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/build-baseline/<slug>.log`; the machine-readable ledger with full timestamps is `00_COMMAND_LEDGER.tsv`.

| # | Slug | Command | Start (UTC) | s | Exit | Result | Wave |
|---|---|---|---|---|---|---|---|
| 1 | `01_pnpm_install_frozen_lockfile` | `pnpm install --frozen-lockfile` | 06:39:48 | 3 | **0** | PASS | — |
| 2 | `02_governance_plan_gate` | `node scripts/validate-governance.mjs --lane=gate --plan` | 06:40:00 | 0 | **0** | PASS (inventory only, no validators run) | — |
| 3 | `03_governance_gate_full` | `node scripts/validate-governance.mjs --lane=gate` | 06:40:09 | 11 | **1** | FAIL — 90 PASS / 20 FAIL | W1 |
| 4 | `04_governance_report_lane` | `node scripts/validate-governance.mjs --lane=report` | 06:41:19 | 0 | **0** | PASS (1 validator) | — |
| 5 | `05_pnpm_install_after_governance_cleanup` | `pnpm install --frozen-lockfile` | 06:41:19 | 2 | **0** | PASS — repairs the wipe in §5.3 | **W0** |
| 6 | `06_validate_migrations` | `pnpm run validate:migrations` | 06:41:42 | 1 | **0** | PASS | — |
| 7 | `07_sequential_migration_validator` | `node scripts/validators/sequential-migration-validator.mjs` | 06:41:43 | 0 | **0** | PASS | — |
| 8 | `08_rollback_integrity_validator` | `node scripts/validators/rollback-integrity-validator.mjs` | 06:41:43 | 0 | **0** | PASS | — |
| 9 | `09_typecheck_root` | `pnpm run typecheck` | 06:41:56 | 28 | **0** | PASS — 50 packages, all cache-miss | — |
| 10 | `10_lint_root` | `pnpm run lint` | 06:42:55 | 5 | **1** | FAIL — turbo aborts at first failure | W1 |
| 11 | `11_lint_root_continue` | `pnpm run lint -- --continue` | 06:43:19 | 2 | **2** | **INVALID HARNESS RUN** — see §7.1 | — |
| 12a–e | `12_lint_app_<app>` | `pnpm --filter @letbuyy/<app> run lint` ×5 | 06:43:54 | 18 | **1** ×5 | FAIL ×5 — 200 errors total | W1 |
| 13 | `13_build_api_gateway` | `pnpm --filter @letbuyy/api-gateway run build` | 06:44:40 | 9 | **0** | PASS — but see §8.2 | — |
| 14 | `14_bundle_api_gateway_esbuild` | local `esbuild` bundle of `services/api-gateway/src/index.ts` | 06:46:15 | 1 | **0** | PASS — 0 errors (3 earlier attempts were harness errors, §8.2) | — |
| 15 | `15_build_merchant_control_plane` | `pnpm --filter @letbuyy/merchant-control-plane run build` | 06:46:27 | 40 | **0** | PASS | — |
| 16 | `16_build_storefront_runtime` | `pnpm --filter @letbuyy/storefront-runtime run build` | 06:47:15 | 21 | **0** | PASS | — |
| 17 | `17_build_identity_platform` | `pnpm --filter @letbuyy/identity-platform run build` | 06:47:36 | 12 | **0** | PASS | — |
| 18 | `18_build_root_all` | `pnpm run build` | 06:47:57 | 31 | **1** | FAIL — 75/81 tasks successful | W1 |
| 19 | `19_build_platform_console` | `pnpm --filter @letbuyy/platform-console run build` | 06:48:45 | 6 | **1** | FAIL — §8.3 | W1 |
| 20 | `20_build_marketing_site` | `pnpm --filter @letbuyy/marketing-site run build` | 06:48:51 | 11 | **0** | PASS | — |
| 21 | `21_build_mobile_bff` | `pnpm --filter @letbuyy/mobile-bff run build` | 06:49:02 | 2 | **0** | PASS (`tsc --noEmit`) | — |
| 22 | `22_build_webhook_service` | `pnpm --filter @letbuyy/webhook-service run build` | 06:49:04 | 2 | **0** | PASS (`tsc --noEmit`) | — |
| 23 | `23_build_queue_workers` | `pnpm --filter @letbuyy/queue-workers run build` | 06:49:06 | 1 | **0** | PASS (`tsc --noEmit`) | — |
| 24 | `24_test_behavioral` | `pnpm run test:behavioral` (no DB) | 06:49:42 | 15 | **1** | FAIL — 30/1608 | W1 |
| 25 | `25_ephemeral_postgres_start` | `node scripts/governance/foundation-ephemeral-postgres.mjs start` | 06:50:27 | 1 | **0** | PASS | — |
| 26 | `26_test_behavioral_with_pg` | `pnpm run test:behavioral` (DB up) | 06:50:38 | 36 | **1** | FAIL — **11/1608** | W1 |
| 27 | `27_test_contracts` | `pnpm run test:contracts` | 06:51:53 | 3 | **1** | FAIL — 12/200 | W1 |
| 28 | `28_test_unit_gateway` | `pnpm run test:unit:gateway` | 06:52:09 | 4 | **1** | FAIL — 3/551 | W1 |
| 29 | `29_test_security_suite` | `node --test tests/security/*.test.mjs` (3 files, explicit) | 06:52:26 | 1 | **0** | PASS — 4/4 | — |
| 30 | `30_test_auth_suite` | `node --test tests/auth/*.test.mjs` (7 files, explicit) | 06:52:27 | 1 | **0** | PASS — 33/33 | — |
| 31 | `31_test_executable_postgres_all` | `node --test tests/executable/*.test.mjs` | 06:52:39 | 22 | **1** | FAIL — 18 pass / 2 fail / 15 skip | W1 |
| 32 | `32_test_payment_postgres_isolated` | `node --test tests/executable/payment-postgres.test.mjs` | 06:53:35 | 1 | **1** | FAIL — reproduces in isolation, §9.5.2 | W1 |
| 33a–d | `33_test_app_<app>` | `pnpm --filter @letbuyy/<app> run test` ×4 | 06:54:21 | 7 | 0,0,0,**1** | 3 PASS, api-gateway FAIL | W1 |
| 34 | `34_turbo_test_workspaces` | `pnpm exec turbo test --continue` | 06:54:43 | 24 | **1** | FAIL — 86/102 tasks successful | W1/L |
| 35 | `35_lint_css` | `pnpm run lint:css` | 06:55:07 | 2 | **2** | FAIL — 1 error | W1 |
| 36 | `36_ephemeral_postgres_stop` | `node scripts/governance/foundation-ephemeral-postgres.mjs stop` | 06:56:11 | 1 | **0** | PASS — container `exited`, not removed | — |
| 37 | `37_node_test_missing_path_probe` | `node --test <real>.mjs <nonexistent>.mjs` | 06:56:46 | 0 | **0** | **PASS — and that is the defect**, §12.6 | **W0** |

Wave column: **W0** = belongs to Wave 0 (measurement/gate infrastructure, actionable now); **W1** = product defect, Wave 1 fixes; **L** = later wave / out of Web V1 scope; **—** = not a failure.

---

## 4. Dependency installation integrity — PASS

```
$ pnpm install --frozen-lockfile          # exit 0, 3s
```

- Exit **0**. `.npmrc` already sets `frozen-lockfile=true`, so this is also the default posture.
- **`pnpm-lock.yaml` was not modified.** `git status --porcelain pnpm-lock.yaml` → empty; `md5` = `0503fe8d64ef1ba33ad0fab4a01f74b7`, byte-identical to the value doc 22 §3 recorded at the baseline. The integration merges changed no dependency.
- Nothing was downloaded — the install resolved from the existing local pnpm store.
- Doc 13 §6 left "whether `pnpm install --frozen-lockfile` actually succeeds" as **unverified**. It is now **verified: it succeeds**, twice (rows 1 and 5).

---

## 5. Governance validators — the repaired runner, fully executed for the first time

### 5.1 Inventory (EXECUTED, `--plan`)

```
discovered on disk     : 114 .mjs modules
  executable validators: 111
  library modules      : 2  (governance-common.mjs, phase-b-common.mjs)
  hook-only modules    : 1  (frozen-path-override-gate.mjs)
declared in lanes      : 111 (gate 110, report 1)
selected for this run  : 110
```

The gate lane is **110** validators, not the "107" the repo comment claims and not the 108 Phase 1 counted. Verified by diffing the manifest against the baseline: exactly **+2**, both added by this branch's own merges — `web-v1-scope-perimeter-validator.mjs` and `workflow-trigger-coverage-validator.mjs`. Baseline `const validators = […]` block: 108 entries. Current: 110.

### 5.2 Result — 90 PASS / 20 FAIL / 0 BLOCKED / 0 SKIP

```
$ node scripts/validate-governance.mjs --lane=gate     # exit 1, 11s
TOTALS: PASS=90 FAIL=20 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1
```

**This is the load-bearing change.** Phase 1 (docs 10/11) recorded the gate dying at validator #6 with the other 102 never running; doc 22 §6 measured it dying even earlier, at **#2**, in a clean tree — leaving 106 of 108 unmeasured. On this branch **all 110 execute and every outcome is recorded**, so for the first time the FAIL set is a *measurement* rather than an unknown. Report lane: exit **0** (1 validator, `foundation-stepup-report-validator.mjs`).

The 20 failures, with the validator's own message (verbatim, truncated):

| # | Validator | Failure | Class |
|---|---|---|---|
| 6 | `validate-design-system.mjs` | 1 HARD invariant (`marketing-site: dark mode must be reachable through the canonical provider toggle`) + **9 ratchet regressions** (`appCssRawHex` 0→98, `appCssNakedRgbHsl` 572→849, `appLocalLbTokenRedefs` 112→220, `rawPxFontSize` 533→604, `rawPxSpacing` 1365→1568, `tsxInlineStyles` 635→673, `tsxRawHex` 0→5, `tsxArbitraryRadius` 327→388, `tsxArbitraryShadow` 8→9). One improvement: `tailwindPaletteClasses` 588→545 | design-system drift |
| 15 | `package-ownership-validator.mjs` | 21 manifests lack an ownership file — **19 `packages/lcis-*`, `services/lcis-api`, `tools/central-intelligence`** | LCIS |
| 17 | `dependency-manifest-validator.mjs` | 2: `packages/lcis-live/test/security.test.ts` "imports something"; `packages/theme-engine/src/theme-safe-update.ts` "imports `${fromVersion}`" — both are the **validator misparsing a dynamic/templated import**, not real undeclared deps | validator defect |
| 18 | `undeclared-import-validator.mjs` | identical output to #17 — it is a 1-line delegation alias, as Phase 1 recorded | validator defect (duplicate) |
| 23 | `provider-isolation-validator.mjs` | 7 files, **all `packages/lcis-adapters/**`** | LCIS |
| 25 | `typescript-governance-validator.mjs` | ~110 findings, **100% `packages/lcis-*`** (composite/declaration/dist/tsconfig.workspace references) | LCIS |
| 35 | `custom-domain-target-validator.mjs` | `merchant UI must read public target env` | product |
| 36 | `merchant-domains-settings-validator.mjs` | 14 required strings missing from the domains settings page | product |
| 39 | `route-ownership-validator.mjs` | `custom-domains.ts:GET:/domains:483` — tenant-table handler with no ownership/internal/session gate | **security-relevant** |
| 40 | `legacy-site-type-validator.mjs` | marketing create page exposes portfolio/resume outside the legacy flag | product |
| 46 | `domain-boundary-validator.mjs` | 3 unclassified app-local API routes; **route inventory drifted: "expected 129, found 188"**; provider signature verification in `apps/marketing-site/src/lib/resources/articles.ts` | **architecture drift** |
| 54 | `route-line-count-validator.mjs` | `services/api-gateway/src/routes/themes.ts` is 1870 lines (limit 1500) | product |
| 56 | `cms-slugify-validator.mjs` | local slugify in merchant smart-collections page | product |
| 58 | `date-format-validator.mjs` | 3 files declaring local date helpers | product |
| 60 | `api-client-runtime-base-validator.mjs` | `apps/marketing-site/src/app/create/page.tsx` bypasses the shared API base resolver | product |
| 61 | `marketing-dead-twin-validator.mjs` | 9 live homepage components no longer imported | product |
| 66 | `raw-error-message-validator.mjs` | `services/api-gateway/src/routes/resource-search.ts` returns raw `error.message` for `SEARCH_ERROR` | **security-relevant** |
| 69 | `environment-validator.mjs` | secret-like values in 2 **test fixtures** (`packages/theme-engine/test/*`) | likely fixture, needs review |
| 104 | `branch-lag-guard-validator.mjs` | `Local working branch is 129 commit(s) ahead of main` | branch topology |
| 108 | `prompt-perimeter-validator.mjs` | 3 unregistered prompt-class files under `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/` | governance hygiene |

**Concentration finding:** 4 of the 20 failures (#15, #23, #25, and half of #17/#18) are caused **entirely by `packages/lcis-*` and `services/lcis-api`** — the LCIS surface Phase 1 flagged as absent from every governance topology document and marked UNRESOLVED / human classification required. That escalation is not cosmetic: it is currently responsible for roughly **a fifth of the gate failures**, and the `typescript-governance-validator` failure alone accounts for ~110 findings. Classifying LCIS is now a prerequisite for a green gate. **Not resolved here** — it needs the human decision Phase 1 asked for.

**Both Phase-1 "soft-fail" validators are now hard.** Phase 1 recorded `branch-lag-guard-validator.mjs` and `pricing-catalog-validator.mjs` as using `reporter.warn()` and therefore unable to block. Both were repaired by this branch's validator-runner merge (`5fa68c70`); `git diff` vs the baseline shows +17 lines in branch-lag-guard and +7 in pricing-catalog, and both now use `reporter.assert`. Consequence: `branch-lag-guard` **now genuinely fails** (#104) where it previously could only warn, and `pricing-catalog` now genuinely **passes** (#87) rather than being unable to fail. Two former blind spots are closed.

### 5.3 HAZARD CONFIRMED — the gate wipes the workspace install (WAVE 0)

The `fs.rmSync` step Phase 1 flagged as "never runs today because the gate dies at 6" **now runs**, because the gate no longer dies. It fires immediately before `stale-artifact-validator.mjs` (#71) and, in this run, **removed 57 directories**:

```
generated-artifact cleanup: 57 directory(ies) removed, 0 refused, 0 error(s)
```

Those 57 include **every workspace `node_modules`** (9 apps, 41 packages, 5 services) and 3 package `dist/` outputs (`shared-types`, `theme-engine`, `typescript/ui`). Verified after the run: `apps/*/node_modules` and `packages/*/node_modules` were gone; `pnpm install --frozen-lockfile` (row 5, exit 0, 2s) restored them.

Assessment — the repaired runner handles this **well**, and the danger is narrower than feared:
- it is anchored to `repoRoot`, not `cwd`, and refuses to run at all if `cwd !== repoRoot` (`validate-governance.mjs:227-233`), so it cannot reach another checkout;
- it plans against a tracked-path predicate and prints every removal and every refusal;
- only gitignored generated output was touched — `git status` after the whole session shows no tracked file removed.

But the operational consequence is real and must be written into any runbook: **running the governance gate uninstalls the workspace.** Any pipeline that orders `validate:governance` before `build` or `test` will hit missing modules unless it reinstalls in between. This document's own ordering (gate first, then reinstall, then build/test) exists precisely because of it. **Wave 0 action: document it; do not "fix" it** — the cleanup is what makes `stale-artifact-validator` meaningful.

---

## 6. Type checking — PASS

```
$ pnpm run typecheck                       # turbo typecheck, 50 packages — exit 0, 28s
```

- Exit **0**. **All 50 packages were cache-miss (executed fresh)** — verified in the log; this is not a cached green.
- Scope excludes the 4 frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`, `platform-operations-portal`) per the root script's own filters.
- Phase 1 measured `typecheck` **exit 1** (TS2344 in `platform-console`) in the dirty original tree. On this branch `tsc --noEmit` is clean. **The error did not disappear — it moved:** it is still present and still fatal, but only `next build` surfaces it (§8.3). Treat "typecheck passes" as a *narrower* claim than it looks.

---

## 7. Lint

### 7.1 Root lint is a partial measurement — do not read it as "one app is broken"

```
$ pnpm run lint                            # exit 1, 5s — Tasks: 0 successful, 5 total
```

Turbo aborts on first failure without `--continue`, so this run reports only `@letbuyy/identity-platform#lint` and stops. Phase 1's "ESLint error in identity-platform" is the same artifact of the same abort — it was never the whole picture.

**Row 11 (`pnpm run lint -- --continue`) is an INVALID harness run and is recorded as such**: `pnpm run <script> -- <flag>` forwards the flag to **eslint**, not turbo, producing `Invalid option '--continue'` in all 5 packages and exit 2. It measured nothing. It is left in the ledger rather than deleted, because a deleted failed attempt is exactly the kind of thing this document exists to prevent.

### 7.2 Per-app lint (the real measurement) — all 5 lint-capable workspaces FAIL

Only 5 workspaces define a `lint` script. Each was run directly (`pnpm --filter … run lint`), so each result is independent:

| App | Exit | Problems | **Errors** | Warnings | Dominant error rules |
|---|---|---|---|---|---|
| `merchant-control-plane` | **1** | 217 | **122** | 95 | `letbuyy-boundaries/no-new-next-api-route` ×68, `@letbuyy/ui/no-raw-elements` ×46, `no-hardcoded-hex` ×6, `no-app-domain-type` ×2 |
| `marketing-site` | **1** | 399 | **70** | 329 | `no-raw-elements` ×36, `no-hardcoded-hex` ×17, `component/hook` ×16, `no-new-next-api-route` ×1 |
| `storefront-runtime` | **1** | 861 | **4** | 857 | `no-new-next-api-route` ×2, `no-raw-elements` ×2 |
| `platform-console` | **1** | 117 | **3** | 114 | `no-new-next-api-route` ×2, `no-raw-elements` ×1 |
| `identity-platform` | **1** | 36 | **1** | 35 | `no-raw-elements` ×1 |
| **Total** | **5×1** | **1,630** | **200** | **1,430** | |

The 68 `no-new-next-api-route` errors in `merchant-control-plane` are the lint-layer expression of the same drift `domain-boundary-validator` reports as "expected 129, found 188" app-local API routes (§5.2 #46). Two independent gates agree that app-local API routes have proliferated well past their governed inventory. Route-ownership lockstep (root `CLAUDE.md`: new app API routes are gateway proxies) is being violated at scale.

### 7.3 CSS lint — FAIL on one character

```
$ pnpm run lint:css                        # exit 2, 2s
✖ 1 problem (1 error, 0 warnings)   266:39  Expected "#FFFFFF" to be "#FFF"   color-hex-length
```

One auto-fixable stylelint error. `ci.yml:97` runs this in the `lint` job, so it is a genuine CI-blocking failure — of trivial size. **Not fixed here** (Wave 0 measures).

---

## 8. Builds — the real `next build`, run per app as the mandate requires

### 8.1 Per-runtime build matrix (EXECUTED, each with its own log)

| Runtime | `build` script | Exit | s | Verdict |
|---|---|---|---|---|
| `apps/merchant-control-plane` | `next build --webpack` | **0** | 40 | **PASS** — real Next.js production build |
| `apps/storefront-runtime` | `next build --webpack` | **0** | 21 | **PASS** — real Next.js production build |
| `apps/identity-platform` | `next build --webpack` | **0** | 12 | **PASS** — real Next.js production build |
| `apps/marketing-site` | `next build --webpack` | **0** | 11 | **PASS** |
| `apps/platform-console` | `next build --webpack` | **1** | 6 | **FAIL** — §8.3 |
| `services/api-gateway` | `tsc --noEmit` | **0** | 9 | PASS — **but this is not a build**, §8.2 |
| `services/mobile-bff` | `tsc --noEmit` | **0** | 2 | PASS (typecheck only) |
| `services/webhook-service` | `tsc --noEmit` | **0** | 2 | PASS (typecheck only) |
| `services/queue-workers` | `tsc --noEmit` | **0** | 1 | PASS (typecheck only) |
| Root aggregate `pnpm run build` | turbo | **1** | 31 | **FAIL** — 75/81 tasks successful, `@letbuyy/platform-console#build` failed |

**The three of four mandated apps that are Next.js apps all build.** The fourth mandated runtime, `api-gateway`, needs the qualification in §8.2.

### 8.2 `api-gateway` "build" is a typecheck — the bundle was verified separately

`services/api-gateway/package.json` defines `"build": "tsc --noEmit"`. **It emits nothing and bundles nothing.** This is exactly how doc 22 §5's blocker — nine symbols imported from `@letbuyy/shared-types` that the barrel never re-exported — reached the Wave 0 baseline: `tsc --noEmit` was satisfied while `wrangler dev`'s esbuild pass failed with 17 errors and served nothing. **A green `pnpm --filter @letbuyy/api-gateway build` is not evidence the Worker can be deployed.**

To measure the thing that actually matters without invoking wrangler (and thus without its outbound `Request.cf` fetch), `services/api-gateway/src/index.ts` was bundled with the repo's own local `esbuild` (`bundle`, `format=esm`, `platform=neutral`, workerd/worker/browser conditions, node builtins external as `nodejs_compat` provides them):

```
BUNDLE OK — warnings=0 errors=0
  .tmp/w0-build-baseline/gw-out/index.js   18.1mb
```

- **0 errors, 0 warnings. Zero unresolved `@letbuyy/*` specifiers.** **Doc 22 §5's blocker is resolved on this branch** — commit `15dd4bea` ("fix(marketing,shared-types): export the contact contract and repair the contact page build") added `export * from './contact';` at `packages/shared-types/src/index.ts:4`. The one-line fix doc 22 found only as an uncommitted working-tree change is now committed and merged.
- Doc 22 §6's second baseline defect is also closed: `tenant-isolation-validator.mjs` is **#2 PASS** here, because the tenant registry regeneration (59 insertions) that existed only in the original repo's working tree is committed on this branch (`git diff` vs baseline: `+59/-5` on `services/api-gateway/src/tenant/tenant-tables.registry.ts`).
- **Three earlier attempts at row 14 exited 1 and were harness errors, not repo defects** — first `esbuild` was unresolvable from the scratchpad, then from the worktree root, then 25 "Could not resolve 'crypto'/'path'/…" errors appeared because bare node builtins were not in the `external` list. They are in the ledger for honesty. Crucially, **even those failing runs contained zero `@letbuyy/*` resolution errors**, which independently corroborates the barrel fix.
- Bundle size, measured: **18,959,660 bytes raw / 2,690,959 bytes gzipped (~2.57 MiB)**. Under Cloudflare's 10 MiB paid Worker limit. **INFERRED, not verified:** wrangler's own bundle would differ — it polyfills rather than externalizes node builtins, so the real artifact is larger than 2.57 MiB. That `jsdom` and `liquidjs` appear in a Worker bundle at all is worth a Wave 1 look; it was not investigated here.

### 8.3 `platform-console` fails `next build` — the CLAUDE.md warning, demonstrated

```
$ pnpm --filter @letbuyy/platform-console run build      # exit 1
✓ Compiled successfully in 12.7s
  Running TypeScript ...
Failed to compile.
src/app/(dashboard)/developers/page.tsx
Type error: Type '{ searchParams: SearchParams; }' does not satisfy the constraint 'PageProps'.
  Types of property 'searchParams' are incompatible.
    Type 'SearchParams' is missing the following properties from type 'Promise<any>':
    then, catch, finally, [Symbol.toStringTag]
```

Next.js 16 makes `searchParams` a `Promise`; the page's local `SearchParams` type is synchronous. Reproduced standalone (row 19) and inside the root build (row 18).

**Why this is the most instructive result in the document.** This failure is invisible to:
1. the 110-validator governance gate — it passes all 110 for `platform-console`;
2. `pnpm run typecheck` / `turbo typecheck` — **exit 0** (§6), because the offending type is generated by Next's own build-time `PageProps` constraint in `.next/types/**`, which does not exist when plain `tsc --noEmit` runs;
3. CI as configured — `ci.yml` does not trigger for `stepup/main` at all (doc 09), and even where it does trigger it uses `--filter="...[HEAD^1]"`, so an untouched `platform-console` is skipped.

Root `CLAUDE.md` states the gate "does NOT cover app `next build`" and instructs running real per-app builds. **That instruction is now evidenced, not merely asserted.** Any future readiness claim built on "typecheck + governance are green" is unsound; only a real `next build` per app closes this hole.

---

## 9. Tests

### 9.1 Behavioral gate — and why the DB fixture changes the number by 19

| Run | DB fixture | tests | pass | **fail** | skip | Exit |
|---|---|---|---|---|---|---|
| `24_test_behavioral` | **down** | 1608 | 1563 | **30** | 15 | 1 |
| `26_test_behavioral_with_pg` | **up** | 1608 | 1582 | **11** | 15 | 1 |

`pnpm run test:behavioral` globs `tests/*/*.test.mjs`, which **includes `tests/executable/`** — the Postgres-backed suites. With no fixture running, 19 suites fail on connection, not on logic. **The honest behavioral number for this branch is 11 failures out of 1,608**, and any run of this command without the fixture up will overstate breakage by 19.

The 11 genuine failures, by file:

| File | Failing test |
|---|---|
| `tests/federation/marketing-site-auth-boundary.test.mjs` | ×2 — signup redirect shim; crawlable platform nav/sitemaps |
| `tests/federation/app-api-route-ownership.test.mjs` | domain boundary validator rejects app-local API ownership drift |
| `tests/federation/merchant-control-plane-rate-limit-resilience.test.mjs` | retries query-cost limited session reads |
| `tests/governance/foundation-wave5-design-governance.test.mjs` | Wave 5 design and mobile token gates |
| `tests/typescript/typescript-governance.test.mjs` | TypeScript package boundaries are composite and referenced |
| `tests/dependency/dependency-governance.test.mjs` | dependency manifests declare all imported packages |
| `tests/theme-engine/liquid-renderer-contract.test.mjs` | blocks render before sections / schema tags stripped |
| `tests/billing/subscription-checkout.test.mjs` | India-first tier defaults and free activation planning |
| `tests/executable/payment-postgres.test.mjs` | Task 004 payment sessions (§9.5.2) |
| `tests/executable/tenant-redteam-postgres.test.mjs` | CAP-C11 RT-1…RT-9 (§9.5.1) |

Four of these (design governance, TypeScript boundaries, dependency manifests, app-API ownership) are the **test-layer mirror** of gate validators #6, #25, #17/18 and #46 — the same defects asserted twice. Fixing the validator failures should clear these four.

### 9.2 Contract tests — 12 of 200 fail

```
$ pnpm run test:contracts    # exit 1 — tests 200, pass 188, fail 12
```

Failures cluster on **custom domains / merchant domain settings** (4), **theme editor & preview** (4), **marketing acquisition surfaces** (2), storefront login Turnstile forwarding (1), Liquid commerce embeds (1). Several are the same defects the gate reports (#35, #36, #60, #61) — again, double-asserted.

### 9.3 Gateway unit tests — 3 of 551 fail

```
$ pnpm run test:unit:gateway   # exit 1 — tests 551, pass 548, fail 3
```

`ai.test.ts` (merchant AI route mounted/allowlisted/provider-backed), `internal-os-executive-analytics.test.ts` (rollup tables RLS), `payments.test.ts` (storefront runtime no longer owns payment route handlers). Note `services/api-gateway`'s `test` script is `test:unit && contracts`, so the `&&` means **the contract half never ran** under row 33d — measured separately in §9.2.

### 9.4 Per-app and workspace-wide tests

Mandated four apps (`pnpm --filter … run test`):

| App | tests | pass | fail | Exit |
|---|---|---|---|---|
| `merchant-control-plane` | 771 | 771 | 0 | **0** |
| `storefront-runtime` | 945 | 945 | 0 | **0** |
| `identity-platform` | 15 + 6 | 21 | 0 | **0** |
| `api-gateway` | 551 | 548 | **3** | **1** |

Whole workspace (`turbo test --continue`): **86 of 102 tasks successful**, 16 failed. Non-LCIS failures: `api-gateway` (3), `marketing-site` (2), `theme-engine` (2 of 1,730 — a Liquid round-trip test and a *performance-budget* test, `N=25 renders within 30000ms`, which is machine-dependent), `@letbuyy/ui` (1 of 45, a `@testing-library` interaction test), `theme-marketplace` (1 of 23 — frozen app).

**The LCIS packages dominate the workspace failures and are environment-blocked, not broken.** `lcis-operations` 113 fail, `lcis-governance` 53, `lcis-cli` 23, `lcis-api` 19, `lcis-core` 17 (of 140), `lcis-live` 14, `lcis-engineering` 11, `lcis-execution` 7/7, `lcis-orchestration` 6, `lcis-mcp` 2, `lcis-adapters` 1. The recurring cause is explicit in the logs:

```
Error [ArtifactMissingError]: lcis-core: artifact not found: graph
  (expected at …/graphify-out/graph.json). Generate it first (e.g. `pnpm graph:db`, `pnpm graph:omega`).
```

`graphify-out/` is gitignored generated output. These suites require an artifact no build step produces. Classified **LATER WAVE / out of Web V1 scope** (LCIS is AI-infrastructure tooling, not a V1 web runtime) — but it compounds the §5.2 escalation: LCIS is simultaneously breaking 4 gate validators and ~266 workspace tests while being unclassified in the topology.

### 9.5 Database executable tests — real Postgres, fully local

Fixture: `node scripts/governance/foundation-ephemeral-postgres.mjs start` → container `letbuyy-executable-pg`, image `postgres:16-alpine` (already local, no pull), database `letbuyy_executable`, **no published host port** — reached only via `docker exec`. Stopped afterwards with the repo's `stop` verb: container `exited`, **not removed, volume preserved**. `supabase db reset` was never run, and no Supabase CLI command of any kind was invoked.

```
$ node --test --test-concurrency=1 tests/executable/*.test.mjs   # exit 1
tests 35 | pass 18 | fail 2 | skipped 15
```

**18 passing** — the substantive money/tenant surface executes against real Postgres, including: Task 001 reference slice (atomic/idempotent/balanced/traced/audited/fail-closed), F6 money kernel proofs, Wave 1 money ledger backfill+reconcile+payout claim, Wave 4 merchant session rotation & reuse rejection, Task 003 checkout, 005 order immutability, 006 inventory oversell prevention, 007 discounts, 008 GST invoice immutability, 009 shipping, 010 notifications, 011 email, 012 WhatsApp, 013 settlement PA/COD balanced ledger, 014 billing GMV-rake removal, 015 security DSR/consent/step-up, 016 commerce MV, and migration 107 closing anon-readable sensitive RLS.

**15 skipped — all `[HUMAN-REQUIRED]`, by design, not by failure.** HR-KMS-LIVE, HR-TURNSTILE-LIVE, HR-PA-SPLIT-LIVE, HR-MERCHANT-PSP-LIVE, HR-GST-IRP-LIVE, HR-CARRIER-LIVE, HR-DNS-CHECKOUT, HR-WHATSAPP-LIVE, HR-DLT-TRAI-LIVE, HR-ESP-LIVE, HR-AUTOPAY-LIVE, HR-LEGAL-DPDP-PA, HR-WAREHOUSE-LIVE, HR-AI-MODEL-LIVE, HR-PROD-MIGRATE-DEPLOY. Each names a live credential, provider approval, or legal sign-off that must precede the assertion. **These are BLOCKED-pending-human, and this workstream correctly did not attempt any of them.** They must never be counted as passing.

**2 failures — both harness/fixture defects, and they differ in kind:**

**9.5.1 `tenant-redteam-postgres.test.mjs` — cross-session state contamination (harness).**
```
ERROR: role "app_tenant" cannot be dropped because some objects depend on it
DETAIL: 17 objects in database verify_scratch
```
Confirmed by probe: `docker exec letbuyy-executable-pg psql -c "select datname from pg_database"` lists **`verify_scratch`** alongside `letbuyy_executable`. `docker inspect` shows the container was **created 2026-08-04**, i.e. it long predates this session. A leftover database from an earlier, unrelated run holds 17 objects that block the role drop. The fixture is a **long-lived shared container with no per-run isolation**, so any earlier run can poison a later one. This is not a product defect and not caused by this branch.

**9.5.2 `payment-postgres.test.mjs` — a genuine, deterministic fixture gap (product-side).**
```
ERROR: relation "public.store_customers" does not exist
```
Reproduced **in isolation** (row 32, exit 1) with a clean fixture, so it is not contamination. Traced: the test applies `database/supabase/migrations/139_executable_foundation_ledger_core.sql` then `142_executable_payment_sessions.sql`. Migration **142 line 28** declares `customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL`, but `store_customers` is created **neither by migration 139 (0 occurrences) nor by the test's inline DDL (0 occurrences)**. The test therefore **cannot pass against a clean fixture** — it is deterministically broken, and the 15-skip/18-pass framing above is the only reason it looks like a minor blemish. Wave 1 must either extend the harness's base schema or narrow migration 142's FK. **Not fixed here.**

### 9.6 Security and auth tests — PASS

| Suite | Files | tests | pass | fail | Exit |
|---|---|---|---|---|---|
| `tests/security/` | `environment-honesty`, `execution-mode`, `theme-tenant-isolation` | 4 | 4 | 0 | **0** |
| `tests/auth/` | `csrf-contract`, `customer-abuse-controls`, `customer-session-gateway`, `identity-password-intent`, `rbac-categories`, `session-verifier`, `sso-redirects` | 33 | 33 | 0 | **0** |
| `tests/executable/security-postgres`, `security-rls-hardening-postgres` | 2 | (in §9.5's 18 passes) | pass | 0 | — |

The dedicated security/auth test surface is **green**. That is a genuinely positive result and it should be stated plainly. It is also **narrow** — 37 tests. It does not cover the two security-relevant gate failures (§5.2 #39 ungated tenant-table handler, #66 raw `error.message` leak), which are caught only by validators.

---

## 10. Migration validation — PASS

| Command | Exit | Output |
|---|---|---|
| `pnpm run validate:migrations` (`migration-safety-validator.mjs`) | **0** | Supabase migration history checked for destructive replay hazards |
| `node scripts/validators/sequential-migration-validator.mjs` | **0** | no untracked files, no duplicate prefixes, no gaps after baseline |
| `node scripts/validators/rollback-integrity-validator.mjs` | **0** | 3 rollback manifests checked |

All three also pass inside the gate (#42, #43, #83). **UNVERIFIED:** these are *static* checks. Whether the full 124-file chain applies cleanly to a fresh database was **not** re-measured here — doc 22 §4.2 measured it (124/124 applied) at the baseline, on a different worktree, and that result is not re-asserted for `8ec05e21`. Applying migrations against any remote is forbidden and was not attempted.

---

## 11. Phase 1 vs this measurement — re-measured, not copied

| Metric | Phase 1 @ `bf35062e` (dirty original tree) | **This run @ `8ec05e21`** | Direction |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | UNVERIFIED (never run) | **exit 0**, lockfile md5 unchanged | now **verified** |
| Gate validators declared | 108 (comment says 107) | **110** (+`web-v1-scope-perimeter`, +`workflow-trigger-coverage`) | +2 |
| Gate validators that **execute** | dies at #6 (doc 22: #2 in a clean tree); 102–108 unmeasured | **110/110 execute** | **fixed** |
| Gate outcome | exit 1, unknown remainder | exit 1 — **90 PASS / 20 FAIL / 0 BLOCKED** | now **known** |
| Validators that could never block | 2 (`branch-lag-guard`, `pricing-catalog` used `reporter.warn`) | **0** — both now `reporter.assert`; branch-lag now genuinely FAILs, pricing-catalog genuinely PASSes | **fixed** |
| `typecheck` | exit **1** (TS2344, platform-console) | **exit 0**, 50 packages, fresh | improved — but see §8.3 |
| `lint` | exit 1 ("an ESLint error in identity-platform") | exit 1 — and the real figure is **all 5 lint apps fail, 200 errors / 1,430 warnings** | **worse than reported** |
| `lint:css` | not reported | exit 2 — 1 error | newly measured |
| `test:behavioral` | 33 fail / 1576 | **11 fail / 1,608** with the DB fixture up (30 without it) | improved |
| `test:contracts` | 13 fail / 200 | **12 fail / 200** | ~flat |
| Gateway unit tests | not reported | 3 fail / 551 | newly measured |
| Executable Postgres tests | not reported | 18 pass / **2 fail** / 15 human-required-skip | newly measured |
| api-gateway can bundle | **NO** — 17 esbuild errors (doc 22 §5) | **YES** — 0 errors (barrel fix committed as `15dd4bea`) | **fixed** |
| Real `next build` per app | UNVERIFIED (doc 13 §6) | 4 of 5 PASS; **`platform-console` FAILS** | newly measured |

Three of Phase 1's four RED numbers moved. One (`lint`) was **understated**, not overstated — the Phase 1 figure was an artifact of turbo aborting on the first failure.

---

## 12. Findings, ranked, with wave assignment

**12.1 — `platform-console` fails `next build` while typecheck and all 110 validators pass. (WAVE 1 to fix; WAVE 0 owns the process lesson.)** §8.3. The single most important structural finding: three independent green signals coexist with a hard build failure. Every readiness claim must be gated on a real per-app `next build`.

**12.2 — `services/api-gateway`'s `build` script is `tsc --noEmit` and bundles nothing. (WAVE 1.)** §8.2. This is the mechanism by which an unbundleable gateway reached the Wave 0 baseline. Recommend adding a real bundle step to the gateway's `build`. Its absence is a false-green generator independent of whatever the code does.

**12.3 — The repaired governance gate deletes all 57 workspace `node_modules`/`dist` directories mid-run. (WAVE 0 — document, do not remove.)** §5.3. Path-anchored, cwd-guarded, non-silent, tracked-path-refusing — the implementation is sound. But `validate:governance` must never be ordered before `build`/`test` without an intervening `pnpm install`.

**12.4 — `packages/lcis-*` + `services/lcis-api` cause 4 of 20 gate failures and ~266 workspace test failures while remaining unclassified in every topology document. (ESCALATION — human decision, carried forward from Phase 1.)** §5.2, §9.4. This is no longer only a documentation gap; it is a gate blocker. A green gate is unreachable until LCIS is classified and either brought under the package-ownership/tsconfig/provider-isolation rules or explicitly exempted by an ARB-approved amendment. **Not decided here.**

**12.5 — App-local API route drift is asserted by three independent gates.** `domain-boundary-validator` ("expected 129, found 188"), 71 `letbuyy-boundaries/no-new-next-api-route` ESLint errors, and `tests/federation/app-api-route-ownership.test.mjs`. Root `CLAUDE.md`'s route-ownership lockstep ("new app API routes are gateway proxies — never write the DB locally") is being violated at scale. **WAVE 1**, and it deserves a security read, not just a lint fix.

**12.6 — `node --test` silently ignores nonexistent test files and exits 0. (WAVE 0 — false-green mechanism.)** Discovered accidentally: an invocation listing `tests/security/csrf-enforcement.test.mjs` (which does not exist) alongside two real files exited **0**. Reproduced deliberately as row 37:
```
$ node --test tests/security/environment-honesty.test.mjs tests/security/DOES_NOT_EXIST.test.mjs
tests 3 | pass 3 | fail 0        # exit 0
```
This matters because many repo test scripts enumerate **explicit file paths** rather than globs — `apps/merchant-control-plane`'s `test` lists 17 files by name, `apps/storefront-runtime`'s lists 12, and the `test:foundation:wave*` scripts list files individually. **Renaming or deleting any of those files makes the suite silently shrink while still reporting success.** Measured on **Node v26.5.1 only**; whether Node 20 (the CI/repo pin) errors instead is **UNVERIFIED** and should be checked before this is treated as a CI-affecting defect.

**12.7 — Two security-relevant gate failures now visible for the first time. (WAVE 1, prioritize.)** `route-ownership-validator` #39: `custom-domains.ts:GET:/domains:483` is a tenant-table handler with **no ownership/internal/session gate**. `raw-error-message-validator` #66: `resource-search.ts` returns raw `error.message` to callers for `SEARCH_ERROR`. Both were invisible while the gate died at #2/#6. Neither was reachable through the passing `tests/security/` + `tests/auth/` suites — validators are the only thing catching them.

**12.8 — Design-system drift is large and still rising.** 9 ratchet metrics regressed against baseline (worst: `rawPxSpacing` 1365→1568, `appCssNakedRgbHsl` 572→849, `appLocalLbTokenRedefs` 112→220) plus 1 hard invariant. One metric improved. Phase 1 reported "2 hard invariants + 9 ratchet regressions"; this branch shows **1 hard + 9**, consistent with commit `bac1779b` having removed the two regressions the port introduced. **WAVE 1.**

**12.9 — `dependency-manifest-validator` and its alias produce false positives.** Both report `packages/lcis-live/test/security.test.ts imports something` and `theme-engine/src/theme-safe-update.ts imports ${fromVersion}` — the validator is treating a template literal and a placeholder word as package names. Two of the 20 gate failures are the **same** finding reported twice by a validator and its 1-line delegation alias. **WAVE 1 (validator fix).**

**12.10 — The executable Postgres fixture has no per-run isolation.** §9.5.1. A `verify_scratch` database created 2026-08-04 broke a tenant red-team test on 2026-08-09. **WAVE 1**: give the fixture a per-run database or drop stale databases on `start`.

**12.11 — `tests/executable/payment-postgres.test.mjs` is deterministically broken.** §9.5.2. Migration 142's FK to `public.store_customers` has no creator in the harness. **WAVE 1.**

**12.12 — `branch-lag-guard` reports the branch is 129 commits ahead of `main`.** Consistent with Phase 1's 106-ahead-of-main baseline plus this branch's integration merges. It is a real, now-blocking signal about branch topology, not a defect in the code. Resolution requires the `MERGE_RUNBOOK.md` fast-forward, which is a push operation and **explicitly out of scope** for this workstream.

---

## 13. UNVERIFIED / UNMEASURED — an unrun command is not a passing command

- **Nothing was measured on Node 20.** All 37 commands ran on Node v26.5.1 against a repo pinned to 20 and a CI pinned to 20 (`ci.yml:21`). Results may differ — §12.6 is a live candidate.
- **No application was booted.** No `next start`, no `wrangler dev`, no HTTP request against any runtime. "Builds" here means the build command exited 0.
- **`wrangler` was never invoked.** The §8.2 bundle is an independent esbuild reproduction, deliberately chosen to avoid wrangler's outbound fetch. Whether `wrangler` itself bundles and boots on this branch is **UNVERIFIED**.
- **No money RPC was executed.** The executable suites exercise migration/RLS/ledger *structure*; `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund` and the gift-card RPCs were not invoked end-to-end from a runtime.
- **The 15 `[HUMAN-REQUIRED]` executable assertions are BLOCKED, not passing** (§9.5). Each names a specific live credential/approval dependency.
- **The 124-migration chain was not applied to a fresh database in this run** (§10). Only static migration validators were executed.
- **`apps/mobile/merchant-app` was not built, analyzed, or tested.** No Flutter command was run. Its classification remains **HUMAN_DECISION_REQUIRED** per the standing human decision; nothing here asserts or implies any deferral, and no mobile code was read or modified.
- **App Bridge / app-marketplace / theme-marketplace / developer-portal code was not audited.** `theme-marketplace` and `app-marketplace` tests ran only as incidental members of `turbo test`; App Bridge belongs to the separate `codex/emergency-appbridge-killswitch` task and was not touched.
- **The 20 gate failures were not individually re-verified against a second, independent method.** They are the validators' own verdicts.
- **Whether the 200 ESLint errors are individually genuine** was not adjudicated; only counted and grouped by rule.
- **Coverage was not measured.** No coverage tooling was run; "1,608 tests" is a count, not a coverage claim.
- **`turbo test` used cached artifacts where turbo chose to** — the typecheck run was verified all-cache-miss, the `turbo test` run was not audited task-by-task for cache hits.
- **The `.next` build outputs were not inspected** for correctness beyond the build's own exit code.
- **Whether the gateway bundle fits Cloudflare's limits as wrangler would produce it** — §8.2, inference only.

---

## 14. Conflicts and escalations

1. **LCIS classification (§12.4)** — unchanged from Phase 1 and now materially worse: it blocks the gate. Requires the human/ARB classification Phase 1 requested. **Escalated, not resolved.**
2. **Node pin vs installed toolchain** — the repo now pins 20 (`.nvmrc`/`.node-version`), CI pins 20, and the only interpreter available is 26.5.1. Not a document-vs-document conflict, so it is recorded rather than adjudicated; but every number here inherits the caveat. Doc 22 §9.1's separate conflict (`local-stack-up.mjs` wanting Node ≥ 22) remains open and untouched.
3. **`branch-lag-guard` vs the no-push mandate (§12.12)** — the validator's own remediation instruction is to fast-forward `main` via `MERGE_RUNBOOK.md`. That is a push. This workstream cannot satisfy the validator without violating its mandate. **Recorded as a standing blocker requiring a human merge decision.**
4. **Root `CLAUDE.md` says the gate has "107 validators"; the manifest has 110** (108 at baseline). A documentation-vs-code drift, minor, but it is the third different number in circulation (107 / 108 / 110). **Wave 1 should correct the prose to match the manifest and add a validator asserting the count.**
5. **Mobile and App Bridge** — untouched, per the two standing human decisions. `apps/mobile/merchant-app` remains **HUMAN_DECISION_REQUIRED**; no mobile work was mixed into this branch. App Bridge is referenced only as an open escalation owned by `codex/emergency-appbridge-killswitch`.

---

## 15. Safety attestation

- **No Supabase command of any kind was run** — from any directory, at any point. No `db push/pull/reset/dump`, no `seed`, no `link`/`unlink`, no `migration up`, no provider or deploy command.
- **No remote was contacted.** No push, no PR, no deploy, no provider API call. `wrangler` was deliberately avoided (§2).
- **The original repository `/Users/…/Letbuyy_Store` was not modified** other than the two permitted output paths: this document, and `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/build-baseline/`. Its dirty working tree (6,826 paths) was neither cleaned, stashed, reset, checked out, restored, chmod-ed, committed, nor staged.
- **No prohibited git operation was run** anywhere: no `reset --hard`, no `clean`, no `stash`, no `checkout -- <path>`, no `restore`, no force push, no history rewrite, no `worktree remove/prune`, no bulk chmod, no bulk delete.
- **No commit was made on `codex/web-v1-integration` by this workstream.** HEAD is still `8ec05e210e2282bbaa70fd39bbf61904cb9e21ab`. This task measures; it does not change code.
- **Final worktree state:** one uncommitted path, `packages/theme-engine/src/theme-cli.ts`, mode `100644 → 100755`, zero content change. It was already present when this workstream began and is caused by `pnpm install` chmod-ing the package's declared `bin` target — exactly as doc 22 §10 documented. It was deliberately **left alone**, since correcting it would require a forbidden `git checkout --`.
- **Scratch files** were written only to `<worktree>/.tmp/w0-build-baseline/` (the esbuild harness and its output). Verified gitignored: `git check-ignore -v` → `.gitignore:132:.tmp/`. `git status` shows no untracked file.
- **The docker Postgres fixture** was started and stopped with the repository's own script. The container is `exited`, **not removed**; its volume is preserved; no `docker volume rm`, `docker rm`, or `docker system prune` was run. The 12 dormant `supabase_*_Letbuyy_Store` containers belonging to the production-linked repo were never listed for modification, started, stopped, or removed.
- **No secret value appears anywhere** in this document or in the 37 evidence logs. Build placeholders are the same non-secret literals `ci.yml` uses. No `.env*` file was read.

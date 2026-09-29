# Phase 2 — test-infrastructure repair and engineering acceptance cleanup

**Date:** 2026-09-29
**Branch:** `letbuyy/phase2-shared-buyer-identity`
**Starting HEAD:** `0e7e4178e8666e08eaf1bd1810e5b6aa961cc6f9`
**Final code HEAD (the tree the final numbers were measured on):** `e21dc2d9c8a0c358d9497819ac24965a631d0115`; the commit that adds this document is the only commit after it (§8)
**Pre-Phase-2 base used for every reproduction:** `130b669d` (the merge-base with `develop`), exported with `git archive` into a scratch directory; the primary checkout and this worktree were never used to reproduce a baseline.
**Execution mode:** SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
**Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO**

**Classification: B — LOCAL ENGINEERING REPAIRS COMPLETE — NAMED EXTERNAL/POLICY CHECKS BLOCKED.**

The local root baseline itself is green (0 failures, 0 cancelled). It is B and not A because named checks are blocked
outside this repository or on a decision that is not this task's to make: the 15 `[HUMAN-REQUIRED]` markers, the
DEPLOY-1 identifiers, and the live theme tenant-isolation proof, which cannot run from repository state alone (§11.4).

This document reports on the "PHASE 2 TEST-INFRASTRUCTURE REPAIR AND ENGINEERING ACCEPTANCE CLEANUP" mandate. It does not
claim Phase 2 is complete (§14). Where it contradicts a claim in an earlier evidence document, the correction is stated
in §2 and repeated in place in that document. Local apps and the S26 device journey were verified in an earlier
session; nothing here re-runs, restarts or reinstalls them.

## 1. What this establishes

1. **The four reported `app_tenant` failures were not role contamination.** Each suite throws at module load, on
   purpose, when it is not handed a dedicated throwaway container; the old root script never handed it one (§4).
2. **Every Postgres suite now runs in a cluster that this run created and will remove**, one suite at a time per
   cluster, with a real readiness probe, a stale-cluster reaper and signal cleanup (§5). The runner and wrapper never use,
   drop from or inspect `letbuyy-executable-pg`, the restored Supabase stack, or any container they did not create.
3. **The root `pnpm test` could skip a whole lane.** It was `node --test … && pnpm run test:contracts`: once the first
   half failed, the 320 contract tests never ran. It is now one wrapper that always runs every group and is green only
   when exit status, TAP summary, failures and cancellations all agree — a rule that matters because a nested
   `node --test` inherits `NODE_TEST_CONTEXT`, prints no summary and exits 0 on failing tests (found by the lifecycle
   test, §5, §10).
4. **25 failures at the start (TAP counts): 4 file-level infrastructure failures and 21 stale source-contract tests.** All 21 reproduce at the
   pre-Phase-2 base; none was caused by Phase 2; **none exposed a product defect**. Each is repaired so it keeps the
   invariant it was written for (§6, §9).
5. **This task introduced two regressions of its own, and the first full run caught both** (a new library module the
   governance inventory did not know about). They are fixed and are in the ledger as R-1 and R-2 (§6).
6. **Final numbers.** `pnpm run test` at `e21dc2d9` exits 0: **2445 tests, 2430 pass, 0 fail, 0 cancelled, 15 skipped, 0 todo** —
   pure + live 1837/1852, Postgres in owned clusters 273/273, contracts 320/320. The real governance gate, run in a
   disposable clone, passes 114/114; typecheck 81/81; gateway unit suite 1330/1331 with one pre-existing `# TODO` (§11).
7. **One proof does not run from repository state:** the live theme tenant-isolation suite (§11.4). Its RLS policies pass
   6/6 once two unstated environment assumptions are supplied in a throwaway cluster; that is a decision, not a repair.

## 2. Corrections to earlier claims

| # | Earlier claim | Where | Correction | Evidence |
|---|---|---|---|---|
| C-1 | "4 failures … traced to `duplicate key … pg_authid_rolname_index … (app_tenant)`: cluster-global Postgres ROLE state left over inside the shared `letbuyy-executable-pg` fixture … pre-existing fixture-hygiene state" | `PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` §6 item 3, §8 | **Wrong cause.** The four suites fail at file level in ~90 ms with exit 1 because their own guard refuses to run when `LETBUYY_EXECUTABLE_PG_CONTAINER` is unset or equals `letbuyy-executable-pg`. The `pg_authid_rolname_index` error is a genuine, reproducible hazard when two suites share a cluster at the same time (measured in §4), but it is not what failed these four. The correct diagnosis was already on record on 2026-09-24. | Guards at `checkout-order-concurrency-postgres.test.mjs:47`, `gift-card-issue-idempotency-postgres.test.mjs:32`, `late-capture-after-release-postgres.test.mjs:45`, `money-rpc-idempotency-sweep-postgres.test.mjs:38`; `docs/evidence/appid-2026-09-24/SUSTAINED_I_REGRESSION_TRIAGE.md` ("PRE_EXISTING — confirmed by unconditional guard clause"; it dates all four guards to the merge `d705397e`, which is imprecise — they were added in four separate commits between 2026-08-24 and 2026-09-23, §6.1 — but the conclusion stands); all four pass in owned clusters (§10) |
| C-2 | "25 failures, 2090 total — the number this document stands behind" | same, §6 | 2090 was **the first half of the root script only**. `&&` skipped `pnpm run test:contracts` (320 tests) once part one failed, so the earlier "total" was never the root suite's total. | `package.json` at `0e7e4178`: `node --test --test-concurrency=1 tests/*/*.test.mjs && pnpm run test:contracts`; the old log ends with the first half's TAP summary and `ELIFECYCLE`, and contains none of the contract test names; the new wrapper counts the lane (§11.1) |
| C-3 | "~21 failures, pre-existing, unrelated domains — confirmed by … a 6-file diff … containing none of them" | same, §6 item 4 | A diff that excludes a file is not attribution. Replaced by: each of the 21 tests, by exact name, was run in a clean export of the pre-Phase-2 base and fails there with the same error. "~21" is exactly 21 tests in 17 files. | §6, §7 |
| C-4 | (implicit) "15 skips" as the whole skip story | earlier full-run logs | The 15 are all `[HUMAN-REQUIRED]` markers. A **sixteenth** skip is invisible in Node's `# skipped` count: the live theme-isolation suite self-skips at *suite* level. The wrapper now prints it (§11, §15). | run output |

## 3. Starting state and dirty-state preservation

Branch `letbuyy/phase2-shared-buyer-identity`, HEAD `0e7e4178e8666e08eaf1bd1810e5b6aa961cc6f9` (a strict descendant of
`develop` `130b669d`). The working tree was not clean when this task began. Each category was classified before any
edit, none was reverted, stashed, cleaned or staged, and each was re-fingerprinted at the end with the *same command*
used to record it:

| Category | Paths | What it is | Owner | Handling | Fingerprint start → end |
|---|---|---|---|---|---|
| Flutter analyzer excludes | 9 × `analysis_options.yaml` (`apps/deferred/delivery/mobile`, `apps/merchant/mobile`, `packages/dart/{core,marketplace_core,marketplace_models,marketplace_services,marketplace_ui_kit,models,ui_kit}`) | each adds `analyzer: exclude: build/**` (the two apps also `android/**`, `ios/**`) | local-environment work that predates this task | untouched, never staged | `git diff` of the nine files, sha256 `b8af63ad4a51f786` (95 lines) → `b8af63ad4a51f786` |
| iOS ephemeral | `apps/deferred/delivery/mobile/ios/Flutter/ephemeral/{.swift_pm.lock,Packages/}` | untracked Flutter/SwiftPM generated files | Flutter tooling during local bring-up | untouched, never staged | tree hash `f47fcfa380a8404e` → `f47fcfa380a8404e` |
| Local-environment record | `docs/evidence/local-environment-2026-09-28/RUNBOOK.md` | untracked runbook from the local bring-up (may reference private configuration) | local-environment task | untouched, deliberately **not** committed | sha256 `1371b6c4b3eddd73` → `1371b6c4b3eddd73` |

Also untouched: `apps/marketplace/mobile/build/app/outputs/flutter-apk/app-debug.apk` (240,124,760 bytes, Sep 28 18:47),
every `node_modules`, every `.next`, and the Supabase and EDYNOX containers. The **real governance lane deletes
`node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build` and similar under `apps|packages|services`**, so it
was never run in this worktree (§11).

## 4. The four "app_tenant" failures — real cause first

**What failed.** `checkout-order-concurrency`, `gift-card-issue-idempotency`, `late-capture-after-release` and
`money-rpc-idempotency-sweep` (`tests/executable/*-postgres.test.mjs`), each as a file-level `not ok`, ~91 ms,
`exitCode: 1`, `error: 'test failed'`, no test registered. That shape is a module-load throw.

**Why.** Each suite is destructive (drops and recreates its database, replays every migration, one twice) and opens with
```
if (!containerName || containerName === 'letbuyy-executable-pg') { throw … 'Refusing to run without
LETBUYY_EXECUTABLE_PG_CONTAINER set to a dedicated, uniquely-named throwaway container' … }
```
The old root script (`node --test --test-concurrency=1 tests/*/*.test.mjs && …`) set no `LETBUYY_EXECUTABLE_PG_CONTAINER`;
unset, or pointing at the shared container, the guard fires. It is correct behaviour; the harness was wrong.

**What was true and is still hazardous** — cluster-global roles. Measured in scratch experiments (not committed):

| Experiment | Result |
|---|---|
| two concurrent sessions run the suites' `DO $$ IF NOT EXISTS … CREATE ROLE app_tenant` block, transaction committed immediately | **23/30** iterations raise the raw `pg_authid_rolname_index` unique violation (2 other errors) |
| same, transaction held open 0.4 s like a real migration | **30/30** |
| five role-touching suites (`security`, `settlement`, `whatsapp`, `notifications`, `tenant-redteam`) run concurrently in **one** cluster | **3/5 fail** — `role … cannot be dropped because some objects depend on it` |
| the same five suites in five owned clusters | **5/5 pass** (6 tests, 11.9 s) |

`DROP DATABASE` does not reset roles, `DROP ROLE` fails cluster-wide while any database holds a grant, and the
existence check and `CREATE ROLE` are not atomic. So the rule is: fresh cluster per run, one suite at a time per
cluster, parallelism by adding clusters — and the shared container is never touched.

## 5. Fixture isolation design

| Piece | File | Guarantees |
|---|---|---|
| Owned cluster lifecycle | `scripts/governance/executable-pg-fixture.mjs` | unique name (pid + time + random); label `com.letbuyy.executable-fixture` and an owner-pid label; **no published port**; readiness = TCP `pg_isready -h 127.0.0.1` **and** a real `select 1` (the image initialises through a temporary socket-only server, so the socket probe answers early: first work after "ready" failed in **10/14** fresh clusters with the socket probe vs **0/14** with the TCP probe); an exited container is reported with its last log lines instead of being waited out; reaper removes only labelled containers whose owner pid is dead and older than 120 s |
| Suite classification | `scripts/governance/test-suite-catalog.mjs` | every `tests/*/*.test.mjs` is exactly one of *pure*, *postgres* (derived from its source: it reads `process.env.LETBUYY_EXECUTABLE_PG_CONTAINER`, so a new suite cannot fall back to the shared container) or *live-external* (an explicit, reviewed list of one) |
| Green/red rule | `scripts/governance/tap-summary.mjs` | a group is red unless the process exit status, the presence of a TAP summary, `fail = 0` and `cancelled = 0` all agree; TODOs and skips are counted separately |
| Postgres runner | `scripts/governance/run-executable-suites.mjs` | N clusters (`--jobs`, default **2**), one suite at a time per cluster, one database per suite; strips `NODE_TEST_CONTEXT` from children (a nested `node --test` inherits it, prints no summary and exits 0 on failing tests — found by the lifecycle test); registers a cluster for cleanup only *after* its `docker run` succeeds, so a name collision can never remove someone else's container; SIGINT/SIGTERM kill children, remove the run's clusters and exit `128 + signo`; exit code is the failed-suite count capped at 125 (can never wrap to 0), 70 for an infrastructure error; without a real Docker daemon (`docker info` fails, e.g. the cloud shim) jobs are forced to 1 with a warning |
| Root wrapper | `scripts/governance/test-behavioral.mjs` | always runs every group (pure + live, Postgres, and with `--with-contracts` the contracts lane), prints one table plus every failing test, every skip and a note for suite-level skips; `pnpm test` = wrapper `--with-contracts`; CI's `pnpm run test:behavioral` = the same without contracts (CI already runs `test:contracts` as its own step) |
| Governance | `scripts/validators/test-coverage-governance-validator.mjs`, `tests/contracts/workspace-test-runner.test.ts` | pin that the root script is the wrapper with `--with-contracts` and that the wrapper keeps its non-negotiables |

**No secret is read, written or logged.** The cluster uses a fixed throwaway credential, publishes no port, and the
`docker()` helper echoes only the subcommand on failure. **Cleanup is limited to what this code created** (label + owner
pid). Not done, on purpose: the shared `letbuyy-executable-pg` container was not used, dropped from or removed (§15);
no role was dropped in any shared cluster; the restored Supabase volume was never addressed by the runner or the root
wrapper (the gate battery's gateway lane did reach the local Supabase stack — correction under §17).

## 6. Exact failure ledger

Classes: **INFRA** (fixture/harness), **STALE-PATH** (a path moved by D-APP-LAYOUT), **STALE-STRUCTURAL** (a
source-text pin no longer matches legitimately restructured code), **CHANGED-CONTRACT** (a reviewed product decision
changed what the test pins), **DEFECT** (product bug), **DEPLOY-CONFIG**, **UNRESOLVED**. "Base" = reproduced at
`130b669d`: `git archive 130b669d` into a scratch directory, then `node --test <file>` from its root
(`failureType: testCodeFailure`, same error) — except the INFRA rows, whose guard is unconditional. Wherever a repair could
pass vacuously it was also broken on purpose and watched to fail; the Status column says which mutation (§10).

### 6.1 Infrastructure — the four "app_tenant" rows

| ID | Test | Error at start | Affected contract | Cause | Baseline evidence | Repair | Status |
|---|---|---|---|---|---|---|---|
| I-1 | `tests/executable/checkout-order-concurrency-postgres.test.mjs` | file-level `not ok`, exit 1, `test failed` (guard, line 47) | concurrent `create_checkout_order` must not oversell (real, unmodified function on a fully migrated DB) | INFRA — guard refused: no owned container | guard added in `b126e51c` (2026-08-24, Phase R2 W1); present verbatim in the `130b669d` export; recorded as a guard in `SUSTAINED_I_REGRESSION_TRIAGE.md` | routed through an owned cluster by the wrapper/runner | **FIXED** — 5/5 in run #1 |
| I-2 | `…/gift-card-issue-idempotency-postgres.test.mjs` | same (line 32) | `issue_gift_card` double issuance with varying codes under one idempotency key (pre-fix at migration 206 reproduces, 207 fixes) | INFRA — same | guard added in `2ce1eb7c` (2026-08-25, Phase R5); present at base | same | **FIXED** — 5/5 |
| I-3 | `…/late-capture-after-release-postgres.test.mjs` | same (line 45) | a provider capture after stock release must not confirm a fulfillable order; every captured payment reaches the ledger once | INFRA — same | guard added in `9ab770d3` (2026-09-23, F-PAY4-1); present at base | same | **FIXED** — 12/12 |
| I-4 | `…/money-rpc-idempotency-sweep-postgres.test.mjs` | same (line 38) | idempotency of the canonical money RPCs under concurrency | INFRA — same | guard added in `372814ae` (2026-08-24, Phase R4 W1); present at base | same | **FIXED** — 4/4 |

### 6.2 Stale source-contract tests — 21 tests in 17 files

| ID | Test (file) | Error at start | Affected contract | Cause | Repair (invariant kept) | Status |
|---|---|---|---|---|---|---|
| S-01 | WS12 G6 migrated REST endpoints remain the external source of truth for parity reads (`api-graphql/rest-shim-parity`) | `storefront REST parity routes is missing body: success(product)` | REST product detail keeps the `success()` envelope that REST/GraphQL parity reads | CHANGED-CONTRACT — SEC-1: the body now passes `toPublicProduct` | pin follows the filter: `success(toPublicProduct(product as Record<string, unknown>))` | FIXED; mutation: removing the filter → red |
| S-02 | app-local API route ownership is validator-enforced (`federation/app-api-route-ownership`) | `did not match /appApiRoutes\.length === 189/` | every app-local route is classified; the count moves only by reviewed action | STALE-STRUCTURAL — the count was mirrored as a literal; the validator moved 189→204 across BUYER-4, APPID-P4a/P4b/P4c, SUSTAINED-K | one inventory module (`app-api-route-inventory.mjs`) holds classes, rules and the ratchet; tests call it | FIXED; 2 mutations (unreviewed route, unclassifiable route → red) |
| S-03 | domain boundary validator rejects app-local API ownership drift (same) | `did not match /189 app API route ownership records checked/` | same | STALE-STRUCTURAL | plus per-route checks (classified, known class, no duplicate) and a swap that keeps the count still fails | FIXED; same two mutations |
| S-04 | app billing approval does not fabricate provider success references (`federation/app-billing-payout`) | `did not match /status: 'active'[\s\S]*provider_status: 'verified'/` | an app charge is never marked provider-verified without the provider signature and the order's own link to *this* charge | CHANGED-CONTRACT — activation status now comes from `planAppBillingTrialWindow` (`active` or `trialing`) | ordered chain pin: signature invalid → order-notes reference mismatch → trial-window plan → `provider_status: 'verified'`, and exactly one writer of `'verified'` | FIXED; 2 mutations |
| S-05 | all seven web apps consume the shared design-system package (`federation/design-system-consolidation`) | `ENOENT … apps/merchant-web/package.json` | seven React web apps consume `@letbuyy/ui` | STALE-PATH (D-APP-LAYOUT) | the seven grouped roots in one list serving both tests | FIXED; 1 mutation |
| S-06 | gateway auth middleware keeps the legacy branch order snapshot (`identity-foundation/production-parity`) | `assert.ok(supabase > internalIdentity)` | verifier order internal-session → internal-identity; nothing slips in ahead | CHANGED-CONTRACT — Phase N3 (`92769175`) removed the Supabase bearer verifier | order of the survivors + "the retired verifier stays retired" + no Bearer branch; behaviour proved in `auth-middleware-fail-closed.test.ts` | FIXED; 1 mutation |
| S-07 | gateway verifier registry preserves legacy branch order and keeps OIDC dormant (`identity-foundation/remaining-scaffolds`) | `supabase-bearer must appear after the previous verifier` | registry order; OIDC off unless flagged | CHANGED-CONTRACT (same) | per-verifier `activeByDefault` (session & identity on, OIDC off), ascending `order:` numbers, retired stays retired | FIXED; 1 mutation |
| S-08 | A: the Experience Picker exists and renders experiences from the engine (`launch/lb-experience-flow`) | `did not match /listExperiences\(\)/` | a theme is only offered presets its bundle defines | CHANGED-CONTRACT — S4-FIX: the editor resolves bundle presets and passes them in | picker renders `ExperiencePresetItem[]` from props and must not read the registry | FIXED; 1 mutation |
| S-09 | B: the editor wires the picker behind an Experiences panel and an apply handler (same) | `did not match /buildExperienceSettingsOverlay/` | same | CHANGED-CONTRACT | editor wires `resolveExperiencePresetItems(presetsFromBaseConfig(baseConfig))` and `presets={presetItems}` | FIXED; 1 mutation (editor drops the `presets` prop) |
| S-10 | B: applying an experience merges the token overlay into themeSettings (same) | `did not match /buildExperienceSettingsOverlay\(experience\)/` | applying merges the preset's own values | CHANGED-CONTRACT | pins `...preset.values, experienceId: preset.id` and forbids recomputing from the registry | FIXED; 1 mutation |
| S-11 | 5C Invite acceptance … (`launch/lb-phase5-commerce`) | `did not match /\/api\/employees\/accept-invite/` | a public pre-auth route never presents a dead capability as working | CHANGED-CONTRACT — Phase N3 retired staff self-service invites | the proxy fails closed with 503, forwards nowhere, the page says so and calls nothing; **comments stripped first** (the old assertion passed by matching the removed path inside a comment) + new gateway behaviour test | FIXED; 2 mutations |
| S-12 | LB-11: route inventory lockstep is 188 … (`launch/lb11-giftcards`) | `did not match /appApiRoutes\.length === 188/` | gift-card proxies are inventoried plain gateway proxies | STALE-STRUCTURAL | asserts inventoried + `gateway-proxy` for both routes | FIXED; 1 mutation (merchant proxies reclassified) |
| S-13 | LB-12: route-count lockstep applied (188 routes) (`launch/lb12-registration`) | same | the register proxy is a plain gateway proxy | STALE-STRUCTURAL | same shape | FIXED; 1 mutation (commerce proxies reclassified) |
| S-14 | LB-13-B: … contains assertProviderPaymentNotReplayed (`launch/lb13-security-trio`) | `must be awaited with (db, { ... }) signature` | the replay guard is awaited on the verify path before the provider verifies and before confirmation | CHANGED-CONTRACT — `c96e443e` changed its first argument to the request context (it must use the unguarded client, and every call with the guarded one had been throwing) | pins `await assertProviderPaymentNotReplayed(c, {`, same shape as `payments.ts`, before `provider.verify(` and before `confirmPayment(`; **what it decides** is proved in `payment-replay-guard.test.ts` | FIXED; 2 + 2 mutations |
| S-15 | (P4-4) domain-boundary-validator expects 188 routes (`launch/lb6-collections`) | `must be updated to 188 routes` | collection-products proxy is a plain gateway proxy | STALE-STRUCTURAL | same shape | FIXED; same mutation as S-12 |
| S-16 | production app deployment matrices match production Vercel topology (`operations/production-deploy-workflow`) | deep-equal diff: `apps/marketplace/mobile`, `apps/merchant/mobile` expected but absent | Vercel-deployed matrix == the topology's Vercel runtimes | STALE-PATH — the filter excluded `apps/mobile/`; D-APP-LAYOUT moved the Flutter apps | topology's own `deploymentKind` (`vercel-next` / `mobile-app`), every active app runtime must declare one | FIXED; 1 mutation |
| S-17 | storefront product and order routes avoid JSONB reads when relational flags are on (`performance/dual-model-consolidation`) | `did not match /orderItemsRelationalReadsEnabled\(c\.env\) \? 'id, order_number, status, total, created_at' : …/` | flag on → never read the JSONB `items` column; flag off → the same columns plus `items` | CHANGED-CONTRACT — F-ORDERDETAIL-1 widened the column list | the two lists are compared to each other (differ only by `items` vs `store_id`), not to a literal | FIXED; 1 mutation |
| S-18 | public storefront REST reads are cached with request-normalized keys (`performance/storefront-cache`) | `missing storefrontRequestCacheKey(c, 'blog'` | public reads cached with normalised keys | STALE-STRUCTURAL — test harness: the route-source helper's hand list omitted `storefront-blog-routes.ts` | helper reads root + every module (§8) | FIXED; 1 mutation (helper stops reading unlisted modules) + the coverage test fails against the old five-file list |
| S-19 | cached storefront responses carry store-scoped tags … (same) | `missing 'storefront:blog'` | store-scoped purge tags | STALE-STRUCTURAL (same cause) | same | FIXED; same mutation as S-18 |
| S-20 | storefront checkout defers post-commit usage and GST work (`performance/variant-checkout-deferral`) | `did not match /async createOrder\(\s*input: … [\s\S]{0,200}tenant: TenantContext …/` | `createOrder(input, tenant, options = {})` with the deferral options bag | STALE-STRUCTURAL — the input type grew past a 200-character window | the three parameters pinned in order, `options` last | FIXED; 1 mutation |
| S-21 | converted Liquid theme keeps reusable and app block portability (`theme-engine/first-party-liquid-portability`) | `did not match /path: 'blocks\/category\.liquid'/` | reusable + app blocks stay portable | CHANGED-CONTRACT — `9c02d2ac` removed the fabricated category/product-card blocks on purpose | pins that they are gone and that `blocks/badge.liquid` stays merchant-editable | FIXED; 1 mutation |

### 6.3 Regressions introduced by this task, caught by the first full run

| ID | Test | Error | Cause | Fix | Status |
|---|---|---|---|---|---|
| R-1 | `governance runner keeps dependency validators in gate lane and exposes report lane` (`governance/foundation-wave0`) | `INVENTORY PROBLEM: Validator drift: scripts/validators/app-api-route-inventory.mjs exists on disk but is declared in no lane` | **this task**: the new inventory module has no entrypoint and was not declared a library | declared in `libraryModules` (`e21dc2d9`) | FIXED — 29/29 with it, 27/29 without |
| R-2 | `the real gate reports a truthful inventory in --plan mode` (`governance/validator-orchestration`) | same drift reported by `--plan` | same | same | FIXED |

## 7. Baseline comparison

| Stage | Commit | Failing tests (not Postgres) | Guard-refused Postgres suites | Contracts lane | Notes |
|---|---|---|---|---|---|
| Programme baseline (SUSTAINED-I) | `41af1cd9` | every one of the 21 appears in that document's PRE_EXISTING table; it lists two more (`auth/customer-session-gateway`, `governance/branch-dispositions`) that no longer fail at `130b669d` (not investigated why) | 4 (recorded as the guard) | not measured | `SUSTAINED_I_REGRESSION_TRIAGE.md` |
| **Pre-Phase-2 base** | `130b669d` | **21 tests / 17 files, each reproduced** by running its file in a clean `git archive` export | 4 (unconditional guard, not re-run) | not run at base | a full base root run was **not** performed; this claim covers the 25 failing tests, not every test at base |
| Phase 2 start | `0e7e4178` | 21 | 4 | never ran (`&&`) | earlier log: 2090 tests, 25 fail, 15 skip — first half only |
| This task, run #1 | `b1722544` | 2 (R-1, R-2: this task's own) | 0 | 320/320 | 2445 tests, 2428 pass, 2 fail, 15 skip |
| **This task, final** | `e21dc2d9` | **0** | **0** | 320/320 | 2445 tests, 2430 pass, 0 fail, 15 skip |

## 8. What changed

| Commit | Subject | Scope |
|---|---|---|
| `277666c5` | test(infra): owned, disposable clusters; root gate cannot read green when a part is red | fixture, catalog, TAP rule, runner, wrapper, `package.json` `test`, coverage validator, lifecycle test |
| `887c97b4` | test(governance): one route-inventory ratchet instead of a number copied into five tests | `app-api-route-inventory.mjs`, boundary validator, 4 tests, governance doc pointer |
| `d4807570` | test(contracts): repair the stale source-contract tests so each keeps the invariant it was written for | 12 test files + `tests/helpers/app-store-route-source.mjs` + its coverage test |
| `b1722544` | test(api-gateway): prove what the payment replay guard decides and what the retired invite route answers | 2 new behaviour tests (7 tests) |
| `e21dc2d9` | fix(governance): declare the route-inventory module as a library | 1 line (R-1, R-2) |
| this commit | docs(evidence): this document + dated in-place corrections | docs only: this file; `PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` (four notes); `PHASE2_DECISIONS.md` (the "Full local gate" row) |

`tests/helpers/app-store-route-source.mjs` used to keep hand lists and **skip any listed file that did not exist**. Now it
returns the root module, then the listed split-out modules in registration order (a contract test asserts that order),
then every other module in the directory, and **throws** on a listed module that is missing. The old lists lacked
`storefront-blog-routes.ts` and three app-store modules, so a marker that had moved into one of them read as a
regression and a "must not contain" check could not see it.

**No product source file was changed:** `git diff --name-status 0e7e4178..HEAD -- apps services packages` lists exactly two
added files, the two new gateway test files. Everything else is `tests/`, `scripts/`, the root `package.json` `test`
script and one governance doc.

## 9. Parity and source-defect candidates — investigated, not assumed stale

| Candidate | What was read | Conclusion |
|---|---|---|
| REST/GraphQL parity | `routes/storefront/public-routes.ts`; the parity test's other checks (GraphQL uses the shared REST-shim adapter) | **Stale pin.** The envelope is unchanged; SEC-1 filters the product through `toPublicProduct` at serialisation. GraphQL parity holds by construction (same adapter). Removing the filter now fails the test, so the repair also protects SEC-1. No defect. |
| App-platform route ownership | the validator against the tree; `classifyAppApiRoute` | 204 routes, all classified, no duplicates; the validator passes at 204 (the 2026-09-28 gate recorded 114/114, and §11.3 repeats it) — only five test mirrors of the number were stale. No defect. (Separate lint debt: §15.3.) |
| Payout / provider fabrication | `routes/app-store/billing-oauth-routes.ts` lines 529–585 | Signature verified, the order's notes must reference *this* charge, status comes from the plan, and exactly one path writes `provider_status: 'verified'`. Nothing fabricates provider success. No defect. |
| Storefront cache | `routes/storefront/storefront-blog-routes.ts` (the blog cache key and, at lines 56 and 115, the `storefront:blog` tag) | Both exist; the *test helper* could not see the module they moved to. Harness defect, fixed. No product defect. |
| Liquid portability | `packages/theme-engine/src/theme-bundle.ts`, `9c02d2ac` | The fabricated blocks were removed on purpose; the test now says so. No defect. |
| Payment replay | `lib/payment-route-support.ts`, the verify route, `c96e443e` | The guard takes the request context (unguarded client, global lookup by provider payment id, `limit(1)`), is awaited before the provider verifies and before confirmation, and refuses when its own lookup fails. **New behaviour tests prove the decision** (6 cases, against the real function with a fake PostgREST — not a database). No defect. |
| Checkout deferral | `execution/order-execution.adapter.ts` | `createOrder(input, tenant, options = {})` and the `deferPostCommit` path are intact; only the signature's text outgrew a fixed window. No defect. |

Real defects found were all in test infrastructure: the `&&` root script that hid the contracts lane; the nested-runner
`NODE_TEST_CONTEXT` false-green; the socket-only readiness probe; a runner that could remove a container whose name was
already taken; the helper's silent-skip lists; and this task's own undeclared library module.

## 10. Isolation and repeatability evidence

| Run | Shape | Result |
|---|---|---|
| 1 | clean, full, `--jobs 3` | 57 suites, 273/273 tests, 395.4 s, 3 clusters, none left behind |
| 2 | immediate repeat | 57 suites, 273/273, 414.2 s; per-suite results identical to run 1; 8 distinct container names across runs |
| 3 | a second, independent runner started mid-run (6-suite subset, `--jobs 2`) | 6 suites, 18/18, 73.9 s |
| final (run #2) | default `--jobs 2`, inside the root wrapper | 57 suites, 273/273 tests, 644.9 s, no cluster left behind; the four formerly-refused suites pass 5, 5, 12 and 4 tests |

`tests/governance/executable-runner-lifecycle.test.mjs` (10 tests) pins: every suite is in exactly one class and the live
list is the reviewed one; the class is derived from source; nothing in the runner, wrapper or fixture can reach the
shared container; the readiness probe; the green/red rule; TAP parsing; **a failing suite exits non-zero, is reported and
leaves no cluster behind**; a taken name is an infrastructure error and the other container survives; **SIGTERM removes
the run's clusters and exits 143**; a SIGKILLed run leaves exactly one labelled orphan and only that kind is reaped.

**Revert-and-watch: 29 mutations**, each breaking one invariant a repair protects and requiring the test to fail and then
pass with the file restored byte-for-byte — all 29 OK (24 in the first pass, 5 added after the ledger review because
five rows had none): SEC-1 filter removed; billing status literal restored; a second
`provider_status: 'verified'` writer; a web app dropping `LetbuyyThemeProvider`; supabase-bearer re-registered; OIDC
active by default; picker reading the registry again; apply recomputing from the registry; retired invite proxy and
gateway route answering 200; the guarded db handed to the replay guard; replay cross-order comparison inverted; failed
lookup no longer refusing; relational customer-orders select reading `items`; `createOrder` losing its options default;
a fabricated category block back in the Liquid fixture; a web app mislabelled `mobile-app`; an unreviewed and an
unclassifiable route; runner exit code ignoring failures; reaper treating every owner as alive; nested-runner env
inherited; cleanup removing a container it did not create; socket-only readiness probe; merchant-web and commerce-web proxies
reclassified away from `gateway-proxy` (three tests); the editor dropping the `presets` prop; the route-source helper
ignoring unlisted modules. After the second pass `git status` and the tracked-diff fingerprint were unchanged.

## 11. Final results

Terms: **files** = test files run; **tests** = the TAP `# tests` count; "wrapper exit" is the wrapper process's own exit
status. (For run #1 the harness reported the *background command* as exit 0 — that was my subshell; the wrapper's exit
was 1.)

### 11.1 Root suite — `pnpm run test` (the real root script)

**Run #1** — HEAD `b1722544`, 05:21:48Z–05:34:47Z (12 m 59 s), **wrapper exit 1**. This is the run that found R-1 and R-2;
it is not the acceptance run.

| group | files | tests | pass | fail | cancelled | skip | todo | status |
|---|---|---|---|---|---|---|---|---|
| pure + live | 174 | 1852 | 1835 | 2 | 0 | 15 | 0 | FAIL |
| postgres (owned clusters) | 57 | 273 | 273 | 0 | 0 | 0 | 0 | ok |
| contracts | 80 | 320 | 320 | 0 | 0 | 0 | 0 | ok |
| **total** | 311 | 2445 | 2428 | 2 | 0 | 15 | 0 | |

**Run #2 — the acceptance run.** HEAD `e21dc2d9` (unchanged from start to finish), 05:41:44Z–05:54:26Z (12 m 42 s),
**wrapper exit 0**, JSON report `healthy: true`, no owned container left behind:

| group | files | tests | pass | fail | cancelled | skip | todo | status |
|---|---|---|---|---|---|---|---|---|
| pure + live | 174 (173 pure + 1 live-external) | 1852 | 1837 | 0 | 0 | 15 | 0 | ok |
| postgres (owned clusters, `--jobs 2`, 644.9 s) | 57 | 273 | 273 | 0 | 0 | 0 | 0 | ok |
| contracts | 80 | 320 | 320 | 0 | 0 | 0 | 0 | ok |
| **total** | 311 | **2445** | **2430** | **0** | **0** | **15** | **0** | **PASS** |

Every group is green only because its exit status, TAP summary, failures and cancellations agree. The skips are
accounted for in §11.5.

### 11.2 The skill's safe battery — `gate.sh` (default mode) at `e21dc2d9`

Non-destructive: the per-validator sweep does no artefact cleanup, and `git status` was identical before and after.

| Lane | Result |
|---|---|
| typecheck (`turbo typecheck`) | exit 0 — **81/81** tasks |
| lint (`turbo lint`) | **exit 1 — red, pre-existing, not from this task** (below) |
| governance `--plan` | exit 0 — 120 modules on disk, 114 selected for the gate lane |
| validator sweep (each gate-lane validator run alone) | 113/114 — `stale-artifact` fails when run individually **by method** (it needs the orchestrator's cleanup); it passes in the real lane (§11.3) |
| `test:contracts` | exit 0 — 320/320 |
| `test:unit:gateway` | exit 0 — 1331 tests, 1330 pass, 0 fail, 1 todo (was 1324; +7 are the two new files). **Includes nine suites that ran against the local Supabase stack** — see the correction under §17 |
| `tests/governance` | exit 0 — 291/291 |
| `tests/ci` | exit 0 — 10/10 |

**Lint attribution.** 42 errors in two packages. `@letbuyy/customer-web` 41: 37 × `@letbuyy/ui/no-hardcoded-hex` (27 in
`checkout-origin/branding.test.ts`, 4 in `branding.ts`, 3 in `lib/theme-engine/liquid-page-assembly.test.ts`, 2 in
`checkout-origin/checkout/page.tsx`, 1 in `scripts/liquid-parity-harness.mjs` — CAP-C77's 37 sites) and 4 ×
`letbuyy-boundaries/no-new-next-api-route` (the four routes in §15.3). `@letbuyy/merchant-web` 1:
`components/settings/SettingsPane.tsx:67:38` "Cannot create components during render" (line authored `38af53e04`,
2026-09-20; the file is unchanged between `130b669d` and the start of this task). None of the paths this task changed is
under `apps/commerce/web` or `apps/merchant/web`, and the three SUSTAINED-K routes were added in `99e09dc9` (2026-09-25),
an ancestor of `130b669d`. Not repaired here: lint is outside this mandate and each item already has an owner in the
backlog.

> **Correction (2026-09-29): repaired.** All 42 errors were repaired by the follow-up task without a rule change, a disable
> comment, a baseline for the hex rule or a skipped package: the 37 hex sites, the four routes (reviewed, baselined,
> hardened and given tests) and the `SettingsPane` compiler error. The ledger, the invariant each site protected and the
> verification of each is `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §4. The text above stays as the record of the state
> at `e21dc2d9`.

### 11.3 Real governance gate lane — in a disposable clone

`git clone --local` of the committed tree at `e21dc2d9` into the session scratch directory (clean, uncommitted files not
carried over), `pnpm install --frozen-lockfile` (10 s), then `pnpm run validate:governance:gate` — the lane that deletes
generated directories, which is why it never ran in this worktree: **exit 0, PASS=114 FAIL=0 BLOCKED=0 SKIP=0
NOT_APPLICABLE=1** ("114 validators executed and passed; 115 discovered on disk"), 44 s. `stale-artifact-validator`
passes here. Advisories only: the branch-dispositions validator could not measure the environment chain because a clone
has no local `develop`/`staging`/`main` refs. The clone's only tracked-file change was a mode bit (0644 → 0755) on the
`theme-engine` `bin` entry, which is pnpm's bin linking (this worktree has the same mode and `core.fileMode=false`).

Both lanes were re-run at the evidence commit (this document and the two dated notes added), which changes documents
only: the safe battery is identical lane for lane (typecheck 81/81; the same 42 lint errors; sweep 113/114 with
`stale-artifact` by method; contracts 320/320; gateway 1330/1331 + 1 todo; `tests/governance` 291/291; `tests/ci`
10/10) and the real gate lane is again 114 pass, 0 fail, 0 blocked, 0 skipped, with `stale-artifact` passing. The
root suite itself was not re-run for a documents-only commit.

### 11.4 Live theme tenant-isolation suite — does not pass from repository state

`tests/security/theme-tenant-isolation.test.mjs` runs migration 196's real policies for two tenants in one transaction
that always rolls back. By default it self-skips at *suite* level — it looks for a container named
`supabase_db_Letbuyy_Store`, which is not the name of the current local stack — so in practice the proof runs nowhere
unless someone points it at a database by hand. It was therefore executed once, for evidence, against an **owned,
Supabase-faithful cluster with every migration applied** (bootstrap + 192 migrations, 34–37 s; never the restored
Supabase volume):

| Environment | Result |
|---|---|
| owned cluster, bootstrap + all migrations, nothing else | **`not ok`** — `before` hook fails with `ERROR: permission denied for table themes`; 6 tests cancelled |
| + `GRANT SELECT ON public.themes TO app_tenant` (throwaway cluster only) | 5/6 — the FORCE-RLS posture, GUC scoping and zero-rows-without-context checks pass; test 3's positive control fails: `site A owner must read site A's private theme: 0 !== 1` |
| + Supabase's own `auth.uid()` (reads the JWT claim GUCs) instead of the test bootstrap's stub | **6/6** |

So the policies behave as designed; the suite depends on two things the repository does not provide. (a) **A SELECT
grant to `app_tenant` on `public.themes`**: migration 164 grants `app_tenant` DML per tenant table and, through default
privileges, on *future* tables, so the baseline-created `themes` has none; migration 196's own header asserts that
`app_tenant` "has blanket DML grants", which no migration establishes (`has_table_privilege('app_tenant','public.themes','SELECT')`
is false after all 192 migrations). (b) **A real `auth.uid()`**: `tests/executable/supabase-faithful-bootstrap.mjs` stubs it
as `SELECT NULL::uuid`, so the owner-identity policy can never match.

**Deliberately not changed.** Which role should read `themes` in this proof, and whether `app_tenant` should be granted `themes` at
all, are security-test and tenant-role decisions (CLAUDE.md: no change to RLS code or the tenant-isolation model
without ARB). Adding the grant inside the fixture would have
made the suite green by supplying an assumption production does not have. The suite stays in the root run as a visible,
named skip (§11.5). To reproduce the table above: start a labelled throwaway `postgres:16-alpine` cluster, create a
database, apply `SUPABASE_FAITHFUL_BOOTSTRAP_SQL` and then every `database/supabase/migrations/*.sql` in numeric order
(dropping the PG17-only `SET transaction_timeout` line, as the executable suites do), and run the suite with
`LETBUYY_SUPABASE_PG_CONTAINER=<cluster>` and `LETBUYY_SUPABASE_PG_DATABASE=<database>`.

> **Superseded (2026-09-29): the suite now passes from repository state, in an owned cluster, and cannot self-skip.** The
> two dependencies this section found were resolved without adding the grant this section declined to add: (a) the
> disposable bootstrap's `auth.uid()` now derives the identity from the request claims, exactly as Supabase's does, and is
> verified on its own; (b) the suite reads `themes` through the roles that can carry an identity (`authenticated`, `anon`),
> keeps the tenant path (`app_tenant` + `app.site_id`) for the store-scoped theme tables it belongs to, and states the
> privilege precondition of a *policy* proof inside its own rolled-back transaction instead of assuming a production
> grant. The gateway reads `public.themes` only through `service_role` (28 call sites, none through a tenant role), and no
> migration grants `app_tenant` anything on it, so no grant is added; whether the privilege posture should be made
> explicit by a migration is a separate owner/ARB choice (`PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §10, Q1). The
> suite is classified `postgres` (owned cluster) and the `live-external` class is empty. Result, method and negative
> controls: `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §5. The text above stays as the record of what was believed.

### 11.5 Skip and TODO accounting

- **15 skipped, all `[HUMAN-REQUIRED]` markers** (none is a code defect and none was added by this task): HR-KMS-LIVE,
  HR-TURNSTILE-LIVE, HR-PA-SPLIT-LIVE, HR-MERCHANT-PSP-LIVE, HR-GST-IRP-LIVE, HR-CARRIER-LIVE, HR-DNS-CHECKOUT,
  HR-WHATSAPP-LIVE, HR-DLT-TRAI-LIVE, HR-ESP-LIVE, HR-AUTOPAY-LIVE, HR-LEGAL-DPDP-PA, HR-WAREHOUSE-LIVE, HR-AI-MODEL-LIVE,
  HR-PROD-MIGRATE-DEPLOY. Each names what must be provisioned or approved first.
- **1 suite-level skip**, invisible in Node's `# skipped`: the live theme-isolation suite (§11.4). The wrapper prints it.
  > **Correction (2026-09-29):** no longer true. The theme-isolation suite moved to an owned cluster and fails, never skips,
  > when it cannot reach a database; the `live-external` class is empty, so the root run has no suite-level skip.
- **0 TODO** in the root suite. The gateway unit suite carries one pre-existing `# TODO` (`LB-BIL-002 (open)`: one payment
  cannot also activate a second store the same merchant owns) — open product work unrelated to this task.

### 11.6 Reproduce

```bash
pnpm run test                      # everything: pure + live, owned-cluster Postgres, contracts
pnpm run test:behavioral           # the same without contracts (what CI's unit-tests job calls)
node scripts/governance/run-executable-suites.mjs --list
node scripts/governance/run-executable-suites.mjs --suite tests/executable/late-capture-after-release-postgres.test.mjs --jobs 1
node scripts/governance/run-executable-suites.mjs --reap-only      # remove labelled clusters whose owner is gone
```

## 12. Deployment and external-check tests — honest results kept

Nothing was deployed and no identifier was invented. `config/vercel/projects.json` project ids are secret **names**
(placeholders by design) and `production-deploy.yml` / `deploy-staging.yml` remain `workflow_dispatch`-only until a
DEPLOY-1 phase supplies verified cloud targets (D-DEPLOY). The deployment tests that run locally (workflow shape,
topology, matrices) pass; the only repair was the stale mobile-path filter (S-16). Every check that needs something
outside this repository stays in the root suite as a **named skip**, not moved out and not deleted — the fifteen
`[HUMAN-REQUIRED]` markers (KMS, Turnstile, PA split, merchant PSP, GST IRP, carriers, checkout DNS, WhatsApp, DLT/TRAI,
ESP, UPI AutoPay, RBI/DPDP legal sign-off, warehouse, AI model, production migrate/deploy) and the live theme-isolation
suite.

## 13. Remaining release and policy blockers

- **Decision needed (owner / ARB): the live theme tenant-isolation proof** (§11.4). Which role reads `themes`, and
  whether `app_tenant` should hold SELECT on it, is not this task's call. Until decided, migration 196's policies are
  proven only by a hand-provisioned database, and the default root run skips the suite.
  > **Superseded (2026-09-29):** resolved as a test/fixture defect (wrong role for an identity policy, an `auth.uid()` that could
  > never match, an access path mixed with another), with no grant added; the root run now executes the proof. What remains
  > is a privilege-posture choice, not a blocker: `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §10, Q1.
- **DEPLOY-1**: real Vercel/cloud project ids, domains and credentials (owner acts; D-DEPLOY). Not invented here.
- The 15 `[HUMAN-REQUIRED]` items (§11.5) — provider credentials, legal sign-off, DNS cutover, production migration.
- **D-ID**: commit identity and the `Co-Authored-By` policy remain an open owner decision.
- Constitution Amendment 3 is recorded unsigned (applied under the founder's instruction).
- Hosted database / feature-flag changes and any push, merge or promotion remain owner acts; none was attempted.

## 14. Original Phase 2 requirements still incomplete

This task did not touch them and does not claim them.

- **D03 — authoritative identity cutover** (not attempted, not authorized) and the sustained, production-shaped
  shadow-observation window.
- **D04 — operator bootstrap and recovery**, and **D04.9** the moderation/impersonation callers (blocked on an owner decision).
- **D05 — export release, retention and deletion** (blocked on an owner decision); irreversible erasure not implemented.
- **Privacy policy** (policy input required).
- ~~`site_memberships` / `site_roles` `SAFE_DELETE` (F2.5) and a real merchant-realm browser journey (§16).~~ **Superseded
  2026-09-29:** neither is an open requirement; see the correction under §16.

## 15. Observations (not fixed here, each with an owner)

1. **`letbuyy-executable-pg` remains.** It was created on 2026-09-28 (`Up 17 hours` at the start of this task) and is still
   the default of the older foundation-wave scripts. It was not used, dropped from or removed, and no role in it was
   dropped. To remove it, an owner command: `docker rm -f letbuyy-executable-pg`. (Its role and database listing is not
   repeated here because nothing in this task's evidence depends on it.)
2. **The live theme-isolation proof** — §11.4. It fails from repository state because of two unstated assumptions and
   needs a decision (§13). Its skip is visible in every wrapper run.
3. **CAP-C76 lint debt is now four routes, plus 38 other lint errors.** `config/eslint/boundary-baseline.json` lists 200 of
   the 204 inventoried routes; the four missing are `apps/commerce/web/src/app/api/store/[subdomain]/search-suggest/route.ts`
   (the filed CAP-C76 breach) and the three SUSTAINED-K buyer proxies (`buyer/profile`, `buyer/addresses`,
   `buyer/addresses/[id]`). SUSTAINED-K's changelog comment says the baseline only concerns `app-local-*` routes; the lint
   lane disagrees (§11.2). Attribution of all 42 lint errors is in §11.2.
4. **`docs/governance/app-api-route-ownership.md`** inventory log stops at 129 (2026-06-13); it now says where the
   authoritative history lives instead of being back-filled.
5. **CI compatibility.** `.github/workflows/ci.yml` calls `pnpm run test:behavioral` and, separately, `pnpm run test:contracts`;
   both keep working with no workflow edit. The owned-cluster path ran against a real local Docker daemon here; GitHub's
   runner was not exercised, and the `unit-tests` job does not run the contracts lane (unchanged).
6. **Registries to reconcile at merge, not edited here** (this task does not merge): `CAPABILITY_BACKLOG.md` CAP-C66 (the
   executable suites now run inside the root script in owned clusters — 57 suites, 273 tests, ~11 minutes at `--jobs 2`
   on a heavily loaded host; whether the per-phase gate should call them stays the owner's lane decision), the
   `EXECUTION_LEDGER.md` row, and `.claude/skills/letbuyy/references/hazards.md` lines 114-116, which still list
   `test:behavioral` among the scripts that may touch a shared Postgres (it no longer does; the other two still may).
7. **Local app stack.** The dev servers' last file activity is 2026-09-28 18:37–19:24, before this task began; no app or
   service was started or stopped in this task. `docs/evidence/local-environment-2026-09-28/RUNBOOK.md` has the restart
   commands. The 29 revert-and-watch mutations, the role-race, readiness and shared-cluster experiments, and the
   live-suite diagnostic were run from scripts kept in the session scratch directory and are not committed; each is
   described precisely enough above to repeat by hand.

## 16. Exact next task

> **SUPERSEDED 2026-09-29.** Neither item below is the next task. Item 1 must **not** be executed: `site_roles` and
> `site_role_permissions` are used by the current D03 implementation and are the accepted role catalog, and `site_memberships`
> is a live read path with a planned migration (`PHASE2_CLOSURE.md`, dated correction). Item 2 is removed from the immediate
> queue: its evidence exists in four distinct categories (database proof; internal signed-header API verification; browser
> login verification; owner-confirmed local runtime and S26 verification). The current next task is in
> `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §10. This section was written from the closure document without re-checking
> it against the D03 code that had landed since; that was the error. Kept for the record:

1. **`site_memberships` / `site_roles` `SAFE_DELETE`** (F2.5): drop both tables (new migration + paired rollback),
   simplify `lib/tenant-context.ts`'s `resolveTenantAccessProfile` to use its fallback parameters unconditionally, update
   the one read in `routes/app-store/developer-routes.ts`. Zero writers confirmed; independent of D03.
2. **A real merchant-realm browser journey**: sign in a real merchant owner and a real restricted staff account through
   `apps/merchant/web`'s actual login, exercise an allowed and a forbidden action, revoke mid-session, confirm the next
   request is denied.

## 17. Confirmations

No runtime bring-up, no S26 reinstall, no service restarted. No merge, no push, no remote PR, no deployment, no promotion.
No hosted database or feature-flag change. No real message, payment or order. No backup, restored data or signing
asset deleted or touched (`~/.letbuyy/preservation/primary-pre-integration-20260927-181701/` present). No role dropped in
a shared cluster; no broad Docker cleanup; every container removed by this work carried this work's label.

> **Correction (2026-09-29): "restored data … touched" was too broad for one lane.** The gate battery's `test:unit:gateway`
> lane (`tsx --test services/api-gateway/src/__tests__/*.test.ts`) also matches nine test files that discover the local
> Supabase stack and write synthetic fixture rows to it: `backfill-and-target-shadow`, `real-http-shadow-rehearsal`,
> `real-staff-product-journey` and `verification-token-redemption` (all `*.postgres.test.ts`, which delete what they insert)
> and `gift-card-money-path`, `gst-invoice-issuance`, `gst-tax-computation`, `inventory-reservation-lifecycle` and
> `merchant-tenant-predicate` (some append-only by design). They ran, and passed, in each battery of that task (0 skipped),
> which is what "0 skipped" in §11.2 hides. The owned-cluster runner and the root wrapper never address that stack; this
> lane did, and this document did not say so. No restored row was deleted or altered by design; what those runs left behind
> is measured, read-only, in `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §6.4, and later runs keep the lane off that stack
> by pointing `LETBUYY_LOCAL_SUPABASE_CONTAINER` at a container that does not exist, which makes all nine skip visibly.

# P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE — the owner's queue access decision (O1), implemented through the production worker, and the gateway's package acceptance command repaired

Branch `letbuyy/phase2-shared-buyer-identity` (unpushed, unmerged, not deployed). Date 2026-10-02.
Initial HEAD `1f4f496e8c1349520bfc427c4ec52c2fd37ac6e3`. Source commits:

- `6c40ca27359940d09e176ad7b2e557c3934cddf6`: the acceptance-command repair.
- `0dceffa4d7528f76c97fe1924d568ac9ea4802d0`: the O1 access change with its tests.
- `ac2e9f40ace78929f2f62f58c9b11cddfbdb5db6`: a governance validator that the repair broke. The real gate found it (§3).

The documents-only commit that follows carries this file and the dated notes, and is the branch tip (`git rev-parse HEAD`; the task's final report names it). §9 says which number was measured on which commit.

Execution mode: **SINGLE AGENT** · Subagents invoked: **NO** · Agent/Task delegation: **NO** · Background agents: **NO** · Parallel worktree agents: **NO** · Workflow orchestration: **NO**. (The root suite, the typecheck and lint, and the clone runs were waited on as background *shell commands*; they are processes, not agents.)

Three things are kept apart in this record: **the local implementation is complete**; **the policy is the owner's, decided 2026-10-02** (one narrow sub-question remains, §2); **the original Phase 2 acceptance is still open** (§12). Nothing here says Phase 2 is complete.

## 0. Verdict

**A — THE OWNER'S QUEUE ACCESS DECISION IS IMPLEMENTED AND PROVEN THROUGH THE PRODUCTION WORKER, AND THE GATEWAY'S PACKAGE ACCEPTANCE COMMAND IS GREEN.** Limited to this mandate.

* **Package acceptance (`pnpm --filter @letbuyy/api-gateway run test`) is green end to end**: exit 0 — unit, the owned database lane and all 322 contracts, in the worktree and in a fresh clone of the final source commit with no `.dev.vars` (§9). Its contract stage used to crash `storefront-buyer-auth.test.ts` on import. The cause is proven, not labelled (§3): the gateway's `tsconfig.json` maps `hono/factory` and `hono/cors` to hono's **declaration files**, and tsx applies the tsconfig of its working directory at runtime. The stage now runs the root's canonical contracts command from the root, as the unit and database stages already did; a lane pin refuses the old shape. The first form of the repair failed one governance validator, which checked for the old path as a substring. The real gate caught it in a clean clone, and `ac2e9f40` makes the validator check the stage itself.
* **O1 is implemented.** The production support queue — buyer privacy requests, the buyer-authored notes and the internal notes included — is open to an allowlisted super admin and to **active platform** employees of the **reviewer (viewer), operator and lead** tiers. The reviewer only reads. The operator replies, notes, creates, escalates, resolves and records satisfaction, but cannot assign or create macros. The lead and the super admin can do all of it. Merchant owners and staff never qualify, whatever their role string (§5).
* **Nothing else under `/operations` moved.** The change is one mount moved ahead of incident-command's wildcard gate, plus a tier option on the existing platform-operator gate. Incident-command keeps its ops + super-admin gate. All twelve sibling routes probed refuse every queue tier exactly as a stranger is refused, and still admit the super admin (§4, test G). Four of those routers have no gate of their own and rely on the inherited one; narrowing that gate would have opened them, so it was not narrowed.

## 1. State

| | |
|---|---|
| Machine, checkout | `Saai-Mithras-MacBook-Pro.local`, `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2` |
| Branch | `letbuyy/phase2-shared-buyer-identity` |
| Initial HEAD | `1f4f496e8c1349520bfc427c4ec52c2fd37ac6e3` (the last reviewed HEAD; no newer commits existed) |
| Worktrees | `LetBuyy` (`develop`, `130b669d`), `LetBuyy-agrimate-cleanup`, `LetBuyy-phase1r`, `LetBuyy-phase2` — unchanged, none touched but this one |
| Source commits | `6c40ca27…` — package script + lane pin; `0dceffa4…` — `index.ts` mount order, `rbac.ts` tier option, `support.ts` gate, and the tests that pinned the old boundary, in the same commit; `ac2e9f40…` — `test-coverage-governance-validator.mjs` checks the repaired stage instead of the old path |
| Documents-only commit | this file and the dated notes (§13) |
| Pre-existing dirty paths, preserved and never staged | nine `analysis_options.yaml` modifications; `apps/deferred/delivery/mobile/ios/Flutter/ephemeral/.swift_pm.lock` and `.../Packages/`; `docs/evidence/local-environment-2026-09-28/` — the same twelve before and after |
| Staging | explicit paths only; every staged diff reviewed before commit |

## 2. The owner's decision and its source

**Source:** the owner's message in this session on 2026-10-02 — the second block of that message, headed "OWNER DECISION — O1 APPROVED" — not an earlier assistant's recommendation. It reads, in substance:

> Enable reviewer, operator and lead access to the production operator support queue, including buyer privacy requests, buyer-authored notes and internal notes. Reviewer: read-only. Operator: existing operator action permissions. Lead: existing lead management and assignment permissions. Keep super-admin access working. Require active platform membership. Merchant owners/staff do not gain platform access through similarly named roles. … This approves local implementation and verification only. No deployment, push, merge, hosted changes or real operator provisioning.

**How it maps to the code.** The tiers are those of `INTERNAL_EMPLOYEE_ROLE_DEFAULT_TIERS` (packages/shared-types): `viewer` → reviewer; `support`, `staff`, `sales`, `marketing`, `fulfillment`, `editor` → operator; `manager`, `operations` → lead; `admin` → admin. `employees.role`'s CHECK allows exactly those ten roles. "Existing permissions" means the existing per-route `requirePermission` checks: `support:view` to read; `support:reply` to reply, note, create, escalate, resolve and record satisfaction; and `support:manage` to assign and create macros. Effective scopes come from the role's tier plus any explicit grant the model already supports (role permission rows, the employee's inline permissions, an active break-glass grant). This change does not alter that resolution.

**One narrow sub-question, not O1 itself.** A platform employee whose role is `admin` but who is **not** on the super-admin allowlist maps to the `admin` tier. D04's mapping left that tier unassigned ("no equivalent approved"), and O1 names reviewer, operator, lead and super admin. So the queue does **not** admit it: it gets `403 Platform operator tier not admitted`, the same refusal it had before O1. Admitting it would be granting privacy-note access to a category nobody approved. If the owner wants such employees treated as leads, that is a one-word change to `admittedTiers`, and the tests say exactly what it would open.

## 3. The package acceptance command: cause, proof, repair

**Reproduced** (`6c40ca27`'s parent, the state at task start). From `services/api-gateway`, `tsx --test ../../tests/contracts/storefront-buyer-auth.test.ts` gives 1 test, 0 pass, 1 fail: `TypeError: (0 , import_factory.createMiddleware) is not a function` at `middleware/buyer-session.ts:72`. The same file from the repository root passes 10/10.

**Cause.** `services/api-gateway/tsconfig.json` is a type-check configuration. Its `compilerOptions.paths` map `hono/factory` → `../../node_modules/.pnpm/node_modules/hono/dist/types/helper/factory/index.d.ts` and `hono/cors` → the matching `.d.ts` (and every other bare import, `*`, into pnpm's store). tsx applies the tsconfig of its working directory to **runtime** resolution, so from the package `require('hono/factory')` loads a declaration file, which compiles to an empty module. The repository root has no tsconfig.

**Proof, by experiment.** From the package directory, the same contract with `--tsconfig` pointing at the gateway tsconfig **minus those two entries** passes 10/10. With a tsconfig holding **only those two entries**, it reproduces the crash. The production bundler is not affected: wrangler 4.100.0's own esbuild (0.27.3), bundling `middleware/buyer-session.ts` with the gateway tsconfig, resolves `hono/factory` to `node_modules/hono/dist/helper/factory/index.js` exactly as it does without the tsconfig, and the bundle defines `createMiddleware` (scratch build, nothing deployed). The earlier record (`docs/evidence/appid-2026-09-24/SUSTAINED_K.md`, 2026-09-24) called this "a cwd-dependent … CJS/ESM interop shape" quirk; it is the `paths`, and that record carries a dated correction now.

**Repair** (`6c40ca27`). The package script's contract stage changed from `tsx --test ../../tests/contracts/*.test.ts` (run from the package) to `cd ../.. && tsx --test tests/contracts/*.test.ts`, the root's canonical `test:contracts` command run from the root — the shape the unit and database stages already had. Delegating with `pnpm -w run test:contracts` was tried first. It runs the same suite, but trips the workspace contract `workspace-test-runner.test.ts`, which requires each deployable workspace's `test` script to invoke a runner itself, and that contract was not loosened. Duplication is prevented by a pin instead.

**Regression pin** (`tests/governance/gateway-db-lane.test.mjs`). The acceptance must be exactly `pnpm run test:unit` → `pnpm run test:db` → `cd ../..` → the root's own `test:contracts` command. No gateway script may run tsx before `cd ../..`. The reason (the type-check `paths`) is written beside the check. NC5 restores the old script: the pin fails, and the old stage crashes on import again.

**The repair broke one validator, and the real gate caught it.** In a fresh clone of `0dceffa4`, the governance gate failed `test-coverage-governance-validator.mjs`. That validator required the gateway's `test` script to *contain the substring* `../../tests/contracts/*.test.ts`. The substring is exactly the broken form: it passed the crashing stage and failed the repaired one. The governance tests and the root suite do not run validators, so only the gate could see it. `ac2e9f40` makes the check say what it means: a stage `cd ../..` followed by exactly the root's `test:contracts` command, which the same validator already pins. `git grep` found no other dependency on the old path. Three temporary edits of `services/api-gateway/package.json`, each restored by sha256, each turn the corrected validator red (§7, NCV1–NCV3); the repaired script passes it.

**Not changed:** the gateway tsconfig (a type-checking concern outside this mandate; its `.d.ts` and `*` mappings remain a trap for anyone running tsx from the package, §8); production middleware; any contract file; any assertion. All 322 contracts still run.

## 4. The access change, and what it does not touch

**The finding it acts on** (P2-PRIVACY-CONCURRENCY-DB §9.3). `routes/operations/incident-command.ts:21` registers `router.use('*', requireRoleCategory('ops'), requireSuperAdmin)`. Mounted at `/operations`, that guards every `/operations` route registered after it, so the support router's own tier gate was never reached by anyone but a super admin.

**Inventory of `/operations`** (mount order as of `0dceffa4`, `src/index.ts`):

| Line | Router | Its own router-level gate | Per-route scopes | Depends on incident-command's gate? |
|---|---|---|---|---|
| 857 | `/operations/rbac` | ops + super admin | `rbac:view`… | no — mounted before it, own gate |
| 865 | `/operations/support` (**moved** from after `risk`) | `requirePlatformOperator({ admittedTiers: viewer, operator, lead })` | `support:view` / `reply` / `manage` | **no longer** — mounted before it (O1) |
| 866 | `/operations` incident-command | **the wildcard gate itself** (ops + super admin) | `incident:view` / `incident:command` | — |
| 867 | `/operations/risk` | ops + super admin | `risk:*` | also has its own |
| 868 | `/operations/trust-safety` | ops + super admin | `ts:*` | also has its own |
| 869 | `/operations/marketplace-reviews` | app-platform kill switch, then ops + super admin | `review:*` | also has its own |
| 870 | `/operations/marketplace-listings` | **none** | `review:view` / `review:decide` | **yes — only protection** |
| 871 | `/operations/buyer-links` | **none** | `support:view` / `support:manage` | **yes — only protection** |
| 872 | `/operations/marketplace-categories` | **none** | `review:view` / `review:decide` | **yes — only protection** |
| 873 | `/operations/marketplace-banners` | **none** | `review:view` / `review:decide` | **yes — only protection** |
| 874 | `/operations/developers` | kill switch, then ops + super admin | `developer:*` | also has its own |
| 875 | `/operations` general (outbox, jobs, runtime…) | ops + super admin | — | also has its own |

Every one of those per-route scopes except `rbac:view` is held by the viewer, operator or lead tier. So **narrowing the wildcard would have opened all four routers with no gate of their own** (buyer-links included, with `support:view`) and incident-command's own routes (`incident:view`), well beyond O1. The change therefore does not narrow it. It moves **only** the support mount ahead of it, and every other router keeps exactly its previous protection, inherited or local. A comment at the mount records that the order is an access decision. If support is moved back, the queue closes (NC1); if any other router is moved above the gate, it loses its inherited gate.

**The support gate** (`middleware/rbac.ts`). `requirePlatformOperator` gained `admittedTiers`:

- A super admin always passes, as before.
- Anyone else must be an active platform employee, by the existing lookup (`store_id IS NULL`, `status = 'active'`, not deleted — a merchant's staff row never qualifies).
- In addition, the default tier of that employee's role must be admitted. A role with no tier, or an unadmitted tier, gets `403 Platform operator tier not admitted` (fail closed).
- Without the option the gate is unchanged (unit-tested).
- `support.ts` uses it with `viewer, operator, lead`. Each route's `requirePermission` still decides the actions, and it runs before the route looks at the request.

## 5. The effective production access and permission matrix (measured through the worker)

| Caller | Queue reached | List & totals (privacy included) | Detail: buyer-authored note + internal notes | Overview, macros list | Reply · internal note (a privacy request's included) · create (never a privacy topic) · escalate · resolve · satisfaction | Assign · create macro |
|---|---|---|---|---|---|---|
| Allowlisted super admin | yes | yes | yes | yes | yes | yes |
| Platform lead (`manager`) | yes | yes | yes | yes | yes | yes |
| Platform operator (`support`) | yes | yes | yes | yes | yes | **no** — `403 PERMISSION_SCOPE_DENIED`, nothing written |
| Platform reviewer (`viewer`) | yes | yes | yes | yes | **no** — `403 PERMISSION_SCOPE_DENIED`, nothing written | **no** |
| Platform `admin` role, not allowlisted | **no** — `403 Platform operator tier not admitted` | — | — | — | — | — |
| Merchant owner; store staff as `admin`, `manager`, `support`, `viewer`; invited, disabled or soft-deleted platform employee; a user with no employee row | **no** — `403 Platform operator access required` | — | — | — | — | — |
| Buyer session; the super admin's id under a forged signature; no credential | **no** — `401` | — | — | — | — | — |

The roles exercised end to end are `viewer`, `support`, `manager` and `admin` (one per tier). The other role strings reach the same tiers through the same map, which the gate reads; they are not each exercised. Every read of a request leaves an audit row naming its reader (`support.ticket.view`, test A2).

**Authorization before validation.** Every refused caller sent malformed requests too (an unknown topic with `limit=0`, a malformed id, a body that is not JSON) and got the gate's answer, not a 400. Within the router, the reviewer's non-JSON reply gets `403 PERMISSION_SCOPE_DENIED`, not `400`.

**Same person, same session** (test A4). A console session sends a fresh signed internal identity per request; its replay id is single-use (`lib/internal-auth.ts` `consumeInternalJti`), so one identity cannot be replayed. Membership, role and allowlist are re-read on every request. Measured in order, with no new login:

1. An active operator reads and notes.
2. The row is disabled: the next request gets `403 Platform operator access required`.
3. It is re-activated: the next read is `200`.
4. The role becomes `viewer`: it still reads, but noting is `403 PERMISSION_SCOPE_DENIED`.
5. The role becomes `admin`: `403 Platform operator tier not admitted`.
6. The role becomes `manager`: it notes again.
7. The row is soft-deleted: `403`.
8. A super admin taken off the allowlist: `403`; put back: `200`.

Only the two allowed notes exist afterwards.

**Privacy boundaries kept** (unchanged code, re-proven by the suites): the dedicated buyer intake and its ownership checks; migration 262's uniqueness; filtering the queue by privacy without operator creation of privacy tickets; no fulfillment writer (the writer tripwires still pass); migration 264's atomic reply; internal notes hidden from buyer routes; merchant ticket queries excluding platform privacy requests (`privacy-support-visibility` test 1). No export, erasure, retention or legal-hold behaviour was added.

## 6. Tests

`operator-queue-correctness.postgres` (21 tests). **A** was rewritten for the O1 boundary. **A2** (read matrix), **A3** (action matrix; every refused action leaves the table counts unchanged), **A4** (same session) and **G** (incident-command and twelve sibling routes, `marketplace-reviews` and `developers` probed with the app-platform flag on to reach their own gates) are new. B–F and the migration-264 test are unchanged.

`privacy-support-visibility.postgres` (6 tests):
- The production-mount test no longer pins "tiers stopped by the ops gate". It now proves what each tier reads (the request, the buyer's note, the internal notes, the overview), that the reviewer's five actions are refused and change nothing, that the operator notes but cannot assign, and that the lead assigns without changing the request's kind, owner or metadata.
- The refusal test pins the support gate's own message.
- The router-level test only had its comment updated (its assertions are unchanged); it remains the isolated proof of the router's own logic.

`require-platform-operator` (unit, +3): the `admittedTiers` matrix (viewer, operator, lead and super admins admitted; the admin tier, an unknown role, an inactive employee and a merchant's staff refused, each with its own message), the unchanged no-option form, and a role change taking effect on the next call.

**Before and after.** The new tests were written first and run on the previous routing (`6c40ca27` plus the new test file; run `a2efb28ce009`): A, A2, A3 and A4 failed — every tier was stopped by `Insufficient role category. Required: ops` — and **G passed**, as it must, since it describes protection that may not move. On `0dceffa4` all 21 pass. A4's first form in that run reused one signed identity, which the gateway correctly refuses after its first use. It was rewritten to send a fresh identity per request, as the console does. NC1, which restores the previous mount order exactly, is the clean reproduction of the pre-O1 behaviour with the final tests: A, A2, A3, A4 and two visibility tests fail on the ops gate's answer.

## 7. Negative controls

One temporary edit each (each edit matched exactly once). The affected checks were run, each file was restored byte for byte from a copy and verified by sha256, and afterwards the worktree's only differences were the twelve preserved paths. NC1–NC5 ran on `0dceffa4`. NCV1–NCV3 ran on the content committed as `ac2e9f40`, just before the commit, against the corrected validator, which passed before and after them.

| | Edit | Red | Failure reason |
|---|---|---|---|
| NC1 wrong queue gate | `index.ts`: support mounted after incident-command again (the pre-O1 order) | A, A2, A3, A4; visibility refusal and production-mount tests | every tier and every store employee answered by `Insufficient role category. Required: ops` instead of the support gate |
| NC2 excluded tier admitted | `support.ts`: `admittedTiers` also lists `admin` | A, A4 | the admin-tier platform role read the privacy queue (`200`); its A4 step read `200` instead of `403 Platform operator tier not admitted` |
| NC3 a read implying an action | `support.ts`: the reply route requires `support:view` | A, A3, A4; visibility production-mount and router-level tests | the reviewer replied and noted (`200`); its malformed reply was parsed (`400`) instead of refused |
| NC4 incident-command protection removed | `incident-command.ts`: its `router.use('*', ops + super admin)` deleted | G | queue tiers read sibling routes (e.g. a lead read `buyer-links/conflicts`, `200`) where a stranger is refused |
| NC5 failing contract runner restored | `package.json`: the old contract stage | lane pin; the stage itself | the pin's exact-stage assertion failed, and the old stage, run from the package, crashed `storefront-buyer-auth` on import (`createMiddleware is not a function`) |
| NCV1 the old stage, against the corrected validator | `package.json`: the old contract stage | `test-coverage-governance-validator` (exit 1) | the contracts no longer run as `cd ../..` followed by the root's `test:contracts` command |
| NCV2 no contract stage | `package.json`: unit and database stages only | `test-coverage-governance-validator` (exit 1) | same |
| NCV3 another command at the root | `package.json`: `cd ../..` then one contract file | `test-coverage-governance-validator` (exit 1) | same: one file is not the root's contracts command |

The exact edits are in Appendix A.

## 8. What was observed but not changed (recorded, outside this mandate)

* **Three operator routes answer the super admin `500`** in the owned database: `/operations/outbox`, `/operations/risk/overview` and `/operations/trust-safety/overview`. The tenant query guard refuses their cross-site reads ("Tenant table outbox_events / risk_scores / ts_cases requires a tenant/owner predicate") — the class of defect the support routes had before Mandate 7's follow-up. G probes other routes on those routers (`runtime/control-commands`, `risk/rules`, `trust-safety/policies`), which return `200`.
* **Internal identity replay ids are single-use per isolate.** `consumeInternalJti` keeps them in an in-memory map (`lib/internal-auth.ts:79–100`). Across Cloudflare isolates, a captured signed identity could be presented again within its 5-minute window. Process memory as the replay authority is what the architecture memory warns against; not changed here.
* **The gateway tsconfig's runtime trap** (§3): `.d.ts` targets for `hono/factory` and `hono/cors`, and a `*` mapping into pnpm's store. Every governed lane now runs tsx from the root, but a developer running tsx from the package directory still meets it. Whether type-checking still needs those entries was not determined here.
* Follow-ups explicitly **not** included: idempotency for successful operator mutations; making assign, escalate, resolve, satisfaction and create atomic the way the reply is.

## 9. Verification

| Check | Commit | Result |
|---|---|---|
| Contract repro, gateway dir / root | `1f4f496e` | crash (1 test, 0 pass) / 10/10 |
| The repaired stage, from the package | `6c40ca27` (pre-commit content) | 322/322 |
| Package acceptance `pnpm --filter @letbuyy/api-gateway run test` | `6c40ca27` (run on its content just before the commit) | **exit 0**: unit 1325 (1324 pass, 1 TODO LB-BIL-002), owned lane 12 suites / 71 (run `d25926f790eb`), contracts 322/322 |
| Package acceptance | `0dceffa4` | **exit 0**: unit 1328 (1327 pass, 1 TODO), owned lane 12 suites / 75 (run `e69d976cfd6e`), contracts 322/322 |
| Affected owned suites, two consecutive runs | `0dceffa4` | 27/27 and 27/27 (runs `7134dde5ff87`, `d25b8dd776ab`) |
| Root `pnpm run test` | `0dceffa4` | **PASS, exit 0**: 2594 tests — 2579 pass, 0 fail, 0 cancelled, 15 `[HUMAN-REQUIRED]` skips, 0 TODO (pure + live 177 suites / 1892; postgres owned clusters 59 / 305; gateway database 12 / 75; contracts 322). Against the previous task's 2590, the +4 are A2, A3, A4 and G (`operator-queue-correctness` 17 → 21). The gateway unit lane is not part of this command; it runs in the package acceptance above |
| Monorepo typecheck | `0dceffa4` | 81/81 tasks, exit 0. 80 came from turbo's cache; the gateway, whose source changed, was type-checked afresh |
| Lint | `0dceffa4` | 5/5 tasks, 0 errors, exit 0. All five were replayed from cache because no linted app changed, and the gateway has no lint task. The warnings are pre-existing |
| Governance tests (`tests/governance/*.test.mjs`), fresh disposable clone (`git clone --local`, `pnpm install --frozen-lockfile`, no `.dev.vars`) | `0dceffa4` | 330/330 pass, 0 skipped, exit 0 |
| The real gate (`node scripts/validate-governance.mjs --lane=gate`), same clone | `0dceffa4` | **FAIL**, exit 1: `PASS=113 FAIL=1`, 1 not applicable. The failure is `test-coverage-governance-validator` (§3), fixed by `ac2e9f40` |
| Package acceptance in that clone, run **after** the gate | `0dceffa4` | **Not a valid observation.** Exit 1, contracts 321/322: `liquid-commerce-embeds` could not resolve `dompurify`. The gate lane's generated-artifact cleanup had just removed every workspace `node_modules` in that clone, and its log lists each one. Unit (1327 + 1 TODO) and the owned lane (12 / 75) passed. The run is counted in neither direction; the run below, straight after install, is the clean-clone result |
| The corrected validator alone, worktree | `ac2e9f40` (its content, just before the commit) | exit 0; NCV1–NCV3 each exit 1 |
| Package acceptance, fresh clone, straight after install | `ac2e9f40` | **exit 0**: unit 1328 (1327 pass, 1 TODO LB-BIL-002), owned lane 12 suites / 75 (run `81a9e6225ea4`), contracts 322/322. The install's only difference from the commit is the executable bit of `packages/theme-engine/src/theme-cli.ts` (mode only), as in the previous task's clones |
| Governance tests, same clone | `ac2e9f40` | 330/330 pass, 0 skipped, exit 0 |
| The real gate, same clone | `ac2e9f40` | **PASS**, exit 0: `PASS=114 FAIL=0`. One validator is not applicable: `foundation-stepup-report-validator`, which is not in the gate lane's selection. There are 154 declared advisories, among them the branch-dispositions validator noting that a detached clone has no local `develop` to check `MERGED_DEVELOP` rows against |
| The real gate at the documents-only tip | the tip | in the task's final report (this file cannot carry its own commit's result) |

`ac2e9f40` changes one validator file and nothing else. The root suite, the typecheck and lint neither run nor cover the validators: the root suite passed on `0dceffa4` while this validator failed. Their results on `0dceffa4` therefore stand for the final source. Package acceptance and the gate were re-run on `ac2e9f40`.

**How the clean clone is run.** Package acceptance must run before the gate in a given clone, because the gate lane deletes every workspace `node_modules`. The first clone did it the other way round, and that run is recorded above as invalid.

## 10. Resource cleanup and preserved work

**Docker.** Counted after the root suite, and again after the last clone run:

- Containers, networks and volumes labelled `com.letbuyy.executable-fixture`: 0 / 0 / 0.
- `letbuyy-exec-*` containers: 0.
- Test-runner processes: none.
- Volumes: 403 in total, 397 of them dangling. The previous task ended at 405 and 397.

The two in-use volumes that went away belong to no container this task created. The runner removes only its own labelled containers, with their anonymous volumes, and Supabase and EDYNOX stacks also run on this machine. Nothing was pruned.

**The restored development stack** (`supabase_db_letbuyy-newmac-20260926`). A read-only census was run after the root suite and again at the end (`default_transaction_read_only=on`, counts only). Both are identical to the captures of 2026-10-01 and 2026-10-02, capture time aside, so no test reached it.

**The worktree.** The twelve preserved paths are unchanged and nothing was staged from them:

- The nine `analysis_options.yaml` diffs are byte-identical to the 2026-09-29 capture (patch sha256 `b8af63ad…`).
- The six untracked files under the three untracked paths were hashed during this task and again before the documents commit.

**Scratch.** The esbuild probe bundle, the two tsconfig variants, the negative-control runners and every log are in the session scratchpad, outside the repository.

**Disposable clones.** Each was a separate `git clone --local` repository, not a registered worktree; that was checked before removal. Each was removed by its exact path:

- The `0dceffa4` clone (1.4 GB).
- The `ac2e9f40` clone (1.2 GB).
- The clone that runs the gate at the documents-only tip is removed the same way; the final report confirms it.

## 11. Edits made by script

Five test-file edits were applied with short Python scripts written through quoted heredocs, each asserting that its anchor matched exactly once:

- the replacement of test A by A–A4;
- the three G probe substitutions;
- the A4 identity change;
- the visibility suite's test 3 replacement;
- its refusal-message pin.

The dated notes of §13 were inserted the same way, by one script (`apply-notes.py` in the session scratchpad) that first ran against scratch copies of the five records. All other edits used the file tools.

## 12. Remaining Phase 2 requirements (open)

D03 authoritative identity cutover and the sustained shadow-observation window; D04.2–D04.9 — who assigns operator roles, bootstrap, recovery, MFA enrollment, high-risk dual control, console delivery, the moderation/impersonation callers — none provisioned or decided here, and no real operator was provisioned; D05 export release, requester verification, retention, deletion, legal hold, incident ownership (no export, no erasure, no fulfillment writer exists); the two F2.1 identity-authority deviations; hosted delivery and deployment; Q3 (the synthetic rows already in the restored stack); the O1 sub-question about the `admin` tier (§2); the observations of §8.

## 13. The requirement matrix and the dated notes

* `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md`:
  - a header note;
  - dated statuses on the F2.6 tiers row ("REACHABLE through the production worker", after its 2026-10-01 correction) and on the support-queue row;
  - a dated status on the F2.7 intake row's reference to O1;
  - a new row for the gateway package acceptance command;
  - a dated note in §9.
* `PHASE2_DECISIONS.md`: the owner's O1 decision recorded under D04 with its source, the implementation and the `admin`-tier sub-question; a dated status on the D04 tiers row of its requirement matrix.
* `P2_OPERATOR_QUEUE_CORRECTNESS_ACCEPTANCE.md`: a note under its header, then dated notes:
  - at §3, the super-admin-only boundary it measured;
  - at §9, the failing contract step;
  - at §14, O1 open and the contract step;
  - at §16, how its proposed next task was done.
* `P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md`: dated notes at §9.3 and §17 — O1 decided and implemented.
* `docs/evidence/appid-2026-09-24/SUSTAINED_K.md`: a dated correction of the root cause it gave for the contract crash.

**Reviewed and left unchanged:** `services/api-gateway/AGENTS.md`. Its test-lane lesson (a mock-router proof of access control is not enough) describes what happened and is still true. The new working rule, that mount order under `/operations` is an access decision, is written at the mount itself (`src/index.ts`).

The original text stays where it is, as the record of its moment. Every note was inserted by one script that refuses any edit that is not a pure insertion at an anchor matching exactly once.

## 14. Precise next task

**P2-OPERATOR-MUTATION-INTEGRITY** — the two follow-ups this mandate deliberately left out, now that more people can act on the queue:

1. An idempotency key for operator mutations (a retried successful reply, assign, escalate, resolve or create is applied twice today).
2. One-transaction writes for assign, escalate (with its Trust & Safety case), resolve (with its clocks and survey) and create (with its clocks and first message), on migration 264's pattern.

Both are proven the way this queue is: through the worker, against an owned database, with named faults. The `admin`-tier sub-question (§2) and Q3 stay owner items.

## Appendix A — the exact edits of the negative controls

Each control replaced the `search` text below with its `replace` text in `file` (each `search` matched exactly once), ran the checks named in §7, then restored the file from a byte copy and compared sha256.

**NC1** — `services/api-gateway/src/index.ts`. Wrong queue gate: the support router mounted after the incident-command router again (the order before O1).

search:
```
api.route('/operations/support', operationsSupportRouter);
api.route('/operations', operationsIncidentCommandRouter);
api.route('/operations/risk', operationsRiskRouter);
```
replace:
```
api.route('/operations', operationsIncidentCommandRouter);
api.route('/operations/risk', operationsRiskRouter);
api.route('/operations/support', operationsSupportRouter);
```

**NC2** — `services/api-gateway/src/routes/operations/support.ts`. An excluded tier accidentally admitted: the queue gate also admits the admin tier.

search:
```
requirePlatformOperator({ admittedTiers: ['viewer', 'operator', 'lead'] })
```
replace:
```
requirePlatformOperator({ admittedTiers: ['viewer', 'operator', 'lead', 'admin'] })
```

**NC3** — `services/api-gateway/src/routes/operations/support.ts`. A read permission implying a mutation: the reply route asks for support:view instead of support:reply.

search:
```
router.post('/tickets/:id/messages', requirePermission('support:reply'),
```
replace:
```
router.post('/tickets/:id/messages', requirePermission('support:view'),
```

**NC4** — `services/api-gateway/src/routes/operations/incident-command.ts`. Incident-command protection removed: its router-level ops + super-admin gate deleted.

search:
```
router.use('*', requireRoleCategory('ops'), requireSuperAdmin);
```
replace:
```
(removed)
```

**NC5** — `services/api-gateway/package.json`. The failing contract runner restored: the acceptance runs tsx for the contracts from the package directory again.

search:
```
"test": "pnpm run test:unit && pnpm run test:db && cd ../.. && tsx --test tests/contracts/*.test.ts"
```
replace:
```
"test": "pnpm run test:unit && pnpm run test:db && tsx --test ../../tests/contracts/*.test.ts"
```

NCV1–NCV3 each replaced the same `search` text in `services/api-gateway/package.json` and ran `node scripts/validators/test-coverage-governance-validator.mjs` (`validator-nc.py` in the session scratchpad):

search:
```
"test": "pnpm run test:unit && pnpm run test:db && cd ../.. && tsx --test tests/contracts/*.test.ts"
```

**NCV1** — The old contract stage, against the corrected validator. replace:
```
"test": "pnpm run test:unit && pnpm run test:db && tsx --test ../../tests/contracts/*.test.ts"
```

**NCV2** — No contract stage at all. replace:
```
"test": "pnpm run test:unit && pnpm run test:db"
```

**NCV3** — Another command at the root: one contract file instead of the root's contracts command. replace:
```
"test": "pnpm run test:unit && pnpm run test:db && cd ../.. && tsx --test tests/contracts/storefront-buyer-auth.test.ts"
```

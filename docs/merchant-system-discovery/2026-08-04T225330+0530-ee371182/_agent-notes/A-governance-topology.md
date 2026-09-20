# AGENT A — GOVERNANCE, TOPOLOGY, AND PRIOR-TRUTH AUDIT

**Mission:** LetBuyy Merchant System Discovery, Phase 1 (discovery only).
**Repo:** `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store`
**Branch:** `stepup/main` · **HEAD:** `bf35062e` · **Worktree:** DIRTY (6784 modified, 20 untracked — user-owned, untouched)
**Scope of my writes:** this file only. No other file was created, edited, or deleted. No git state-changing command was run.

> ### ⚠️ OBSERVATION-WINDOW WARNING — THE WORKTREE MUTATED DURING THIS RUN
> A **concurrent actor** (not me) wrote files into the repository while I was auditing it. Proven by `ls -lT` mtimes:
> - `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` — **Aug 4 23:05:18**
> - `database/supabase/rollback/196_theme_rls_tenant_hardening.rollback.sql` — **23:05:40**
> - `database/supabase/rollback/180_…`, `181_…`, `188_…`, `189_…`, `190_…`, `191_…` — **23:07:00 → 23:07:49**
>
> My mission window opened at **22:53:30**. My first migration/rollback census ran **before** 23:05 and returned 124 migrations / 40 rollbacks; a re-census at **23:21** returned **125 migrations / 47 rollbacks**. I have corrected every affected number below to the **23:21 re-census** and marked it. Every other count in this document was taken between ~22:55 and ~23:21 and should be treated as a **timestamped snapshot, not a stable fact**. Anyone re-running these commands may legitimately get different numbers.
>
> Consequence for the commander: **other agents' counts taken at different minutes may disagree with mine without either being wrong.** Reconcile by re-census at dossier time, not by argument.

---

## 0. HEADLINE (read this first)

1. **The deploy meta-blocker (ART-03 / DEPLOY-R1) has re-accumulated and is worse than any prior report.** Local `main` = `140a73db`; `stepup/main` = `bf35062e`; `git rev-list --count main..stepup/main` = **106**. `production-deploy.yml` triggers on push to `main`, so a production deploy today would ship a 106-commit-stale tree. MERGE_RUNBOOK.md:9 mandates this be `0`.
2. **The 108-validator governance gate is RED on the current worktree.** I ran every gate-lane validator individually: **83 PASS / 25 FAIL**. Every prior-truth document that claims "gate GREEN" is describing a different (earlier, clean) tree.
3. **CI does not run on the canonical integration branch.** `.github/workflows/ci.yml:4-11` triggers only on `develop` and `main`. `stepup/main` — the branch BRANCH_STRATEGY.md names as the integration branch and the branch every feature PR targets — gets **no** `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, or `ci / merge-safety-gate`.
4. **Topology is largely honest and enforced.** Production deploy matrix = exactly 4 Workers + 5 Vercel apps = the constitutional 8 + `platform-console`. All six reserved services and both reserved mobile roots are genuinely manifest-only (2 files each). All four frozen apps are excluded from build/lint/typecheck and from every deploy matrix.
5. **But there is an unclassified 11th service root and 20 unclassified packages:** `services/lcis-api` + `packages/lcis-*` (591 tracked files) exist outside `canonicalServiceRoots` / `reservedServiceRoots` / `frozenAppRoots` in `scripts/validators/governance-common.mjs`. They are the direct cause of the current `package-ownership-validator` gate failure.
6. **Documentation drift is severe and material.** Root `AGENTS.md` still states max migration = 161 (real max = **195** tracked, plus untracked **196**); prior-truth docs variously claim the gate is 105 / 106 / 107 / 123 validators (real = **108** gate-lane + 1 report-lane); `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md` records LB-8/LB-9/LB-11/LB-12 as missing/broken when all four are now implemented in source.
7. **`R-23` (every migration ships a paired rollback) is unenforced by any validator, and 12 migrations ≥138 still have no rollback** — down from 18 an hour earlier, because the concurrent actor is actively authoring them right now.

---

## 1. GOVERNANCE CHAIN — BINDING CONSTRAINTS

### 1.1 Authority order (verified as stated)

| # | Document | Path | Lines | Status at HEAD |
|---|---|---|---|---|
| 1 | Constitution (DOC 01) | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | 471 | Present, RATIFIED header, supreme |
| 2 | AGENTS_V2 (DOC 02) | `AGENTS.md` | 405 | Present, hand-authored, promoted |
| 3 | Canonical systems (DOC 03) | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` | present | Referenced by every local AGENTS.md |
| 4 | Legacy elimination + roadmap | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md`, `…FOUNDATION_ROADMAP.md` | present | — |
| 5 | UI/UX governance | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md` | present | — |
| — | AI operating context | `CLAUDE.md` | 264 | Subordinate; contains merchant-relevant facts, several now stale |

Evidence: `LETBUYY_CONSTITUTION.md:30-41` (P.3 authority hierarchy); `AGENTS.md:26-41` (`AUTH-CHAIN`, `AUTH-R1..R3`).
Evidence type: DOC_CLAIM (chain is self-declaring) + corroborated by `no-scan-generated-agents-validator.mjs` PASS (AGENTS.md is hand-authored, not scan-generated).

### 1.2 Constitutional rules that bind merchant work (with the exact citation)

| Rule | Statement | Citation |
|---|---|---|
| R-1/R-2/R-3/R-4 | RLS ENABLE+FORCE + per-tx tenant GUC; no blanket `service_role` for tenant data; no `USING(true)` to PUBLIC; GUC only from a validated asymmetric claim | `LETBUYY_CONSTITUTION.md:392-395` |
| R-5/R-6 | Append-only double-entry, **derived** balance; every capture/refund/COD posts idempotently; one ledger writer; no UPDATE/DELETE of a posted entry | `LETBUYY_CONSTITUTION.md:398-399` |
| R-7 | Never custody; PA-split only; no self-custody rail | `LETBUYY_CONSTITUTION.md:400` |
| R-8 | `bigint` minor units (paise) everywhere | `LETBUYY_CONSTITUTION.md:401` |
| R-9 | `commission_bps` MUST be 0 | `LETBUYY_CONSTITUTION.md:402` |
| R-10 | Refund/payout second factor MUST be real cryptography | `LETBUYY_CONSTITUTION.md:403` |
| R-11 | Orders only via server-authoritative checkout behind a **cart-bound** signed handoff; reserve-with-TTL, not pre-payment decrement | `LETBUYY_CONSTITUTION.md:406` |
| R-12 | No third-party/extension/Wasm code in the live checkout or storefront path | `LETBUYY_CONSTITUTION.md:407` |
| R-13 | No consent-gated message without a consent record; gate fails closed | `LETBUYY_CONSTITUTION.md:408` |
| R-14 | `identity-platform` is the SOLE token issuer, asymmetric sole-signer; everyone else verify-only; **no shared symmetric signing secret** | `LETBUYY_CONSTITUTION.md:411` |
| R-15 | Exactly one canonical system per domain | `LETBUYY_CONSTITUTION.md:414` |
| R-16 | No reserved service deployed or declared `production`; outbox, not event bus | `LETBUYY_CONSTITUTION.md:415` |
| R-18 | The gate MUST enforce the Constitution; **a green gate must mean conformance**; no green build with a known un-waived S0 | `LETBUYY_CONSTITUTION.md:419` |
| R-20 | Deployment MUST be from the canonical branch; branch-lag guard stays green | `LETBUYY_CONSTITUTION.md:421` |
| R-21 | No secret committed; live paths `[HUMAN-REQUIRED]`; providers default to mock | `LETBUYY_CONSTITUTION.md:422` |
| R-22 | Every money/fulfillment surface carries a truthful provider-mode badge; a stub MUST NEVER read as `success` | `LETBUYY_CONSTITUTION.md:423` |
| R-23 | **Every migration MUST ship a paired rollback**; no deletion before winner-live + zero-drift/zero-importer proof | `LETBUYY_CONSTITUTION.md:424` |

Additional merchant-binding rules from `AGENTS.md`:
- `ARCH-R1` — the 8-runtime canonical topology table (`AGENTS.md:64-79`).
- `ARCH-R4/R5/R6` — six reserved services + two reserved mobile roots stay manifest-only (`AGENTS.md:86-88`).
- `ARCH-R10` — deprecated app aliases forbidden; `platform-console` is the one ops-console survivor (`AGENTS.md:95`).
- `ARCH-R11..R15` — apps must not import apps; services must not import apps; packages must not import apps/services; cross-runtime via HTTP/outbox/public exports only (`AGENTS.md:99-103`).
- `SEC-R7` — **no shared symmetric secret across trust domains; the `|| AUTH_SECRET` fallback is DEAD** (`AGENTS.md:233`).
- `SEC-R9` — gateway must not connect as blanket `service_role` for tenant data (`AGENTS.md:235`).
- `PAY-R2` — **the legacy `confirm_order_payment_with_ledger` posts ZERO ledger entries despite its name** (`AGENTS.md:246`). Confirmed as a live nuance the mission brief flagged; the SQL proof is Agent-payments' job, not mine.
- `MIG-R2` — "New migrations MUST be numbered sequentially from the **current max (161)**" (`AGENTS.md:156`) — **STALE, see §8**.
- `MIG-R3` — every migration MUST ship a paired DOWN; "the three known unpaired migrations (138/140/157) MUST gain rollbacks; a rollback-pairing validator gates merge for any migration ≥ 138" (`AGENTS.md:157`) — **UNENFORCED AND WORSE, see §8 / G-A-05**.
- `THEME-R1/R2` — Liquid canonical; React frozen; **MUST NOT add new sections to the React renderer once frozen** (`AGENTS.md:275-276`).
- `DEPLOY-R1/R2/R3` — branch-lag = 0; one deploy matrix == the 8 runtimes; one canonical domain `letbuyy.com` (`AGENTS.md:330-332`).

### 1.3 Local `AGENTS.md` inventory (46 files under apps/services/packages)

Full list produced by `find apps services packages database -name AGENTS.md`. Merchant-relevant ones and what each adds beyond root law:

| Path | Lines | Substantive local constraint |
|---|---|---|
| `apps/merchant-control-plane/AGENTS.md` | 25 | Boilerplate ownership template. Boundary = `apps/merchant-control-plane`. No imports from other app roots, `legacy/*`, repo-level `infrastructure/*`, generated output. "Reserved roots must stay manifest-only. Frozen roots are source-kept and de-deployed." |
| `apps/identity-platform/AGENTS.md` | 25 | Same template, boundary `apps/identity-platform`. |
| `apps/storefront-runtime/AGENTS.md` | 25 | Same template. |
| `apps/platform-console/AGENTS.md` | 25 | Same template. |
| `apps/mobile/merchant-app/AGENTS.md` | 25 | Same template. |
| `services/api-gateway/AGENTS.md` | 34 | **Real, specific rules.** Allowed: `packages/typescript/*`, packages declared in `runtime.manifest.json`, execution adapters under `src/execution`, providers **only** via `packages/infrastructure`. Forbidden: imports from `apps/*`, `legacy/*`, direct provider SDK imports, `dist/*`, client-side token storage. Tenant rules: "Every merchant-owned mutation must resolve `site_id` or prove explicit store ownership"; "Payment, checkout, and webhook-facing mutations must be idempotent"; unknown errors → sanitized `AppError`. (`services/api-gateway/AGENTS.md:24-34`) |
| `services/queue-workers/AGENTS.md` | 7 | "Status: **Incubating**. New queue consumers require explicit retry, dead-letter, tenant, and observability policies before activation." Also describes itself as a "**Reserved** background job runtime" — a wording conflict with `ARCH-R1` which lists it as canonical runtime #2. Minor DOC drift (G-A-11). |
| `services/webhook-service/AGENTS.md` | 23 | "Verify signatures before parsing business side effects"; "Persist provider event ids or idempotency keys **before** mutation"; "No unauthenticated provider side effects before signature verification". |
| `services/mobile-bff/AGENTS.md` | 25 | Boilerplate template. |
| `packages/payments/AGENTS.md` | 25 | Template; boundary `packages/payments`; no imports from `apps/*` or `services/*`. |
| `packages/commerce-core/`, `packages/checkout-core/`, `packages/theme-engine/AGENTS.md` | 25 each | Same template. |
| `services/checkout-runtime/AGENTS.md` | 14 | **Reserved root rules.** "MUST remain manifest-only. MUST NOT add source, tests, package.json, wrangler.toml, or deployment config. MUST NOT extract checkout, payments, inventory reservation, or order finalization into this root." Active owner named as `services/api-gateway` + hosted storefront checkout. |
| `apps/mobile/shopper-app/`, `apps/mobile/operator-app/AGENTS.md` | 25 each | Reserved. |
| `apps/app-marketplace/`, `apps/developer-portal/`, `apps/theme-marketplace/`, `apps/platform-operations-portal/AGENTS.md` | 25 each | Frozen; source-kept, de-deployed. |
| `database/` | **NONE** | There is no `database/AGENTS.md`. Migration/RLS law lives only in root `AGENTS.md` §4 (`MIG`) and §8 (`SEC`). Gap for a later agent to note (G-A-12). |

**Honest read:** 12 of the 14 merchant-relevant local `AGENTS.md` files are a 25-line boilerplate template that adds no boundary-specific rule beyond "follow root law + stay in your directory". Only `services/api-gateway`, `services/webhook-service`, `services/queue-workers`, and the reserved-root files carry real local constraints. Do not treat the boilerplate files as a source of domain rules.

---

## 2. ACTUAL RUNTIME TOPOLOGY vs THE CONSTITUTIONAL 8

### 2.1 Classification table (every directory under `apps/` and `services/`)

File counts exclude `node_modules`, `.next`, `dist`, `.wrangler`, `build`, `.turbo`.

| Root | Files | Code files | `src/` TS | Tests | package.json | wrangler.toml | vercel.json | In prod deploy matrix | **Classification** |
|---|---|---|---|---|---|---|---|---|---|
| `services/api-gateway` | 312 | 306 | 306 | 79 | YES | **YES** | no | YES (Worker) | **CANONICAL** |
| `services/queue-workers` | 26 | 20 | 11 | 9 | YES | **YES** | no | YES (Worker) | **CANONICAL** |
| `services/mobile-bff` | 8 | 2 | 1 | 1 | YES | **YES** | no | YES (Worker) | **CANONICAL** (thin — see note) |
| `services/webhook-service` | 13 | 7 | 4 | 3 | YES | **YES** | no | YES (Worker) | **CANONICAL** |
| `apps/identity-platform` | 96 | 72 | 67 | 5 | YES | no | YES | YES (Vercel) | **CANONICAL** |
| `apps/storefront-runtime` | 169 | 146 | 142 | 0 (in-app) | YES | no | YES | YES (Vercel) | **CANONICAL** |
| `apps/merchant-control-plane` | 347 | 308 | 290 | 13 | YES | no | YES | YES (Vercel) | **CANONICAL** |
| `apps/marketing-site` | 126 | 106 | 102 | 0 | YES | no | YES | YES (Vercel) | **CANONICAL** |
| `apps/platform-console` | 64 | 47 | 43 | 0 (in-app) | YES | no | YES | YES (Vercel) | **CANONICAL** (the one ops console, ARCH-R10) |
| `apps/mobile/merchant-app` | 332 | 157 (.dart) | — | 5 | no (pubspec) | no | no | separate workflow | **CANONICAL** (Flutter) |
| `services/checkout-runtime` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `services/event-bus` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `services/notification-service` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `services/analytics-pipeline` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `services/media-service` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `services/search-service` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `apps/mobile/shopper-app` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `apps/mobile/operator-app` | **2** | 0 | 0 | 0 | no | no | no | no | **RESERVED-AND-EMPTY** ✅ |
| `apps/app-marketplace` | 108 | 95 | 91 | 0 | YES | no | no | no | **FROZEN** |
| `apps/theme-marketplace` | 127 | 74 | 67 | 3 | YES | no | no | no | **FROZEN** |
| `apps/developer-portal` | 40 | 26 | 22 | 0 | YES | no | no | no | **FROZEN** |
| `apps/platform-operations-portal` | 53 | 36 | 32 | 0 | YES | no | no | no | **FROZEN** (fold-then-delete loser per ARCH-R10) |
| `services/lcis-api` | 9 | 6 | 4 | 2 | **YES** | no | no | no | **UNCLASSIFIED — see §2.3** |

**Proof of "empty" for reserved roots** (not inferred from a package.json absence). Each contains exactly two files:
```
services/<reserved>/runtime.manifest.json
services/<reserved>/AGENTS.md
```
Same for `apps/mobile/shopper-app` and `apps/mobile/operator-app`. Zero `.ts`/`.dart`/`.js` files, zero `src/`, zero tests, zero deploy config. **ART-19 / ARCH-R4/R5/R6 / R-16 are HELD.** Evidence type: SERVICE_CODE (directory listing).

**`services/mobile-bff` note:** 8 files, 1 `src/` TS file, 2 code files total. It is deployed as a real Worker (`wrangler.toml` present, in both staging and production deploy matrices) but is essentially a thin shim. `AGENTS.md:72` describes it as "a **real** composite/fan-in BFF (`/v1/dashboard`)" and `WIN-R7` says a stub that is the canonical design "MUST be *completed*". Whether `/v1/dashboard` composition actually exists is Agent-mobile's call — flagged here as `G-A-10` (UNVERIFIED by me).

### 2.2 Constitutional 8 vs actual — verdict

`scripts/validators/governance-common.mjs:57-111` defines the machine-enforced lists:
- `canonicalAppRoots` (6): `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/identity-platform`, `apps/marketing-site`, `apps/platform-console`, `apps/mobile/merchant-app`
- `canonicalServiceRoots` (4): `services/api-gateway`, `services/mobile-bff`, `services/webhook-service`, `services/queue-workers`
- `canonicalRuntimeRoots` = 10 (6 + 4)
- `frozenAppRoots` (4), `reservedServiceRoots` (6), `reservedMobileRuntimeRoots` (2), `deprecatedAppAliasRoots` (7 + `apps/mobile/operator-team-app`), `forbiddenRuntimeSubtrees` (`apps/storefront-runtime/consumer-storefront`)

Validator runs (read-only, individually invoked at HEAD `bf35062e`):
```
runtime-topology-validator                exit=0  10 canonical runtime roots, 8 topology edges
runtime-manifest-validator                exit=0  10 active runtime manifests
runtime-validator                         exit=0  10 canonical runtime roots
topology-drift-validator                  exit=0  17 topology roots
deploy-matrix-topology-validator          exit=0  9 production deploy targets + staging/Vercel frozen exclusions
topology-json-antifabrication-validator   exit=0  reserved/frozen production topology statuses
no-reserved-service-activation-validator  exit=0  reserved runtime activation checked
architecture-validator                    exit=0  6904 tracked files scanned
```
`config/runtime/production-topology.json` declares 21 runtimes with honest statuses:
- 11 × `environment: production, status: active` (DB + 4 Workers + 5 Vercel apps + `apps/mobile/merchant-app`)
- 6 × `environment: reserved, status: reserved, deploymentKind: manifest-only`
- 4 × `environment: frozen, status: frozen, deploymentKind: not-deployed`

No reserved or frozen root is declared `production`. **ART-19 / ANTI-R7 held.** Evidence type: PROVIDER_OR_CONFIG_EVIDENCE.

`apps/mobile/shopper-app` and `apps/mobile/operator-app` do **not** appear in `production-topology.json` at all (they have their own `runtime.manifest.json`). Not a violation, just an inventory note.

Deprecated aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) — **none exist** in the tree. `ARCH-R10` held.

### 2.3 `services/lcis-api` + `packages/lcis-*` — the unclassified estate

- `services/lcis-api/package.json` — name `@letbuyy/lcis-api`, "internal read-only HTTP service over the LCIS engine (Hono)", `start: tsx src/server.ts`, depends on 7 `@letbuyy/lcis-*` workspace packages + `hono` + `@hono/node-server` + `zod`.
- Files: `src/{app,index,middleware,server}.ts`, `test/{app,execution}.test.ts`.
- Root `package.json:7` exposes `"lcis:api": "tsx services/lcis-api/src/server.ts"`.
- **20 `packages/lcis-*` workspaces** are declared in `pnpm-workspace.yaml:22-40`.
- Tracked-file count across `packages/lcis-*` + `services/lcis-api`: **591 files** (`git ls-files`).
- `services/lcis-api` has **no** `runtime.manifest.json`, no `wrangler.toml`, no `vercel.json`, and appears in **no** deploy workflow and **no** topology JSON. It is not deployed.

Governance position: it is a **service root** that is in neither `canonicalServiceRoots` nor `reservedServiceRoots`. `ARCH-R2` says "MUST NOT add, deploy, or wire any runtime not in `ARCH-R1`. Adding a new runtime root requires a Constitution amendment + ARB approval + DOC 03/04 updates **before** source is created." No amendment, ARB record, or topology entry exists for it. **Status: PARTIAL** — it is not *deployed* (so `R-16`/`ARCH-R5` are not breached) but it *is* an undeclared runtime root with real source and tests (so `ARCH-R2` is breached on its face). This is the direct cause of the current `package-ownership-validator` gate failure (§4.3). Recorded as **G-A-02**.

### 2.4 Workspace package inventory (`pnpm-workspace.yaml`)

`pnpm-workspace.yaml` globs: `apps/*`, `apps/mobile/*`, 19 named `packages/*` domain packages, 20 named `packages/lcis-*`, `packages/typescript/*`, `services/*`.

Consequences worth knowing:
- `apps/*` pulls in all four **frozen** apps as workspace members. They are excluded from `build`/`lint`/`typecheck` by explicit `--filter=!` flags (see §3.1), not by workspace membership.
- `services/*` includes the six reserved services — harmless, they have no `package.json` so pnpm ignores them — and `services/lcis-api`, which does.
- `packages/dart/*` is **not** in `pnpm-workspace.yaml` (it's Dart; root `pubspec.yaml` covers it).

Domain packages (`governance-common.mjs:118-133`): `commerce-core`, `checkout-core`, `payments`, `auth-core`, `identity-core`, `token-core`, `session-core`, `permission-core`, `organization-core`, `audit-core`, `tenant-core`, `cms-core`, `theme-engine`, `event-core`, `notification-core`, (+ `billing-core`, `infrastructure`, `shared-types`, `typescript/*` in the workspace file).

---

## 3. SCRIPTS A LATER RUNTIME AGENT WILL NEED (exact names + exact commands)

### 3.1 Root `package.json` (merchant-relevant subset)

```
build      = turbo build --filter=!@letbuyy/app-marketplace --filter=!@letbuyy/theme-marketplace --filter=!@letbuyy/developer-portal --filter=!@letbuyy/platform-operations-portal
lint       = turbo lint  --filter=!@letbuyy/app-marketplace --filter=!@letbuyy/theme-marketplace --filter=!@letbuyy/developer-portal --filter=!@letbuyy/platform-operations-portal
typecheck  = turbo typecheck --filter=!… (same four exclusions)
test       = node --test --test-concurrency=1 tests/*/*.test.mjs && pnpm run test:contracts
test:behavioral   = node --test --test-concurrency=1 tests/*/*.test.mjs
test:contracts    = tsx --test tests/contracts/*.test.ts
test:unit:gateway = pnpm --filter @letbuyy/api-gateway run test:unit
test:workspaces   = turbo test
validate:governance      = node scripts/validate-governance.mjs --lane=gate
validate:governance:gate = node scripts/validate-governance.mjs --lane=gate
validate:governance:report = node scripts/validate-governance.mjs --lane=report
validate:migrations = node scripts/validators/migration-safety-validator.mjs
validate:rollback   = node scripts/validators/migration-safety-validator.mjs        # ← same script, see G-A-05
validate:deployment = node scripts/validators/deployment-safety-validator.mjs && node scripts/validators/deploy-matrix-topology-validator.mjs
validate:topology   = node scripts/validators/runtime-topology-validator.mjs && node scripts/validators/topology-json-antifabrication-validator.mjs …
dev        = node scripts/dev/setup-local-env.mjs && turbo run dev --concurrency=25 --filter=./apps/* --filter=@letbuyy/ui --filter=@letbuyy/api-gateway
dev:store  = node scripts/dev/setup-local-env.mjs && turbo run dev --concurrency=12 --filter=@letbuyy/merchant-control-plane …
foundation:pg:start / foundation:pg:stop = node scripts/governance/foundation-ephemeral-postgres.mjs start|stop
test:foundation:wave0..wave7 = per-wave suites (wave1 = payments+billing-core+gateway money; wave2 = tenant red-team; wave7 = mobile-bff + gateway checkout)
```

### 3.2 ⚠️ HAZARD — `scripts/validate-governance.mjs` IS DESTRUCTIVE

`scripts/validate-governance.mjs:170-186` defines `removeGeneratedArtifactDirectories(["apps","packages","services"])` which walks those trees and calls `fs.rmSync(absPath, {recursive:true, force:true})` on any directory named:
`node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods`.

It is invoked unconditionally at `scripts/validate-governance.mjs:190-192` immediately before `stale-artifact-validator.mjs` runs.

**Running `pnpm validate:governance` in this worktree will delete every `node_modules` under `apps/`, `packages/`, and `services/`, plus all Next/Turbo/Wrangler build output.** In CI that is harmless (fresh checkout + reinstall). Locally it destroys the user's installed dependency tree. **Do not run the gate wrapper against the user's tree.** Run individual validators from `scripts/validators/*.mjs` instead — all are read-only except `scripts/validators/validate-design-system.mjs` (which only writes with `--update`). Recorded as **G-A-09**.

### 3.3 Per-runtime scripts (exact strings)

| Runtime | `build` | `typecheck` | `lint` | `test` |
|---|---|---|---|---|
| `apps/merchant-control-plane` | `next build --webpack` | `tsc --noEmit` | `eslint` | `cd ../.. && node --test tests/federation/… + 15 named `apps/merchant-control-plane/tests/theme-editor-*.test.mjs` files` |
| `apps/identity-platform` | `next build --webpack` | `tsc --noEmit` | `eslint` | `pnpm exec tsx --test src/__tests__/*.test.ts && cd ../.. && node --test tests/federation/identity-platform-supabase-boundary.test.mjs tests/auth/identity-password-intent.test.mjs` |
| `apps/storefront-runtime` | `next build --webpack` | `tsc --noEmit` | `eslint` | `cd ../.. && node --test tests/federation/… tests/theme-engine/… tests/launch/…` (12 files) |
| `apps/platform-console` | `next build --webpack` | `tsc --noEmit` | `eslint` | `cd ../.. && node --test tests/federation/platform-console-thin-client.test.mjs tests/auth/session-verifier.test.mjs` |
| `apps/marketing-site` | `next build --webpack` | `tsc --noEmit` | `eslint` | (present) |
| `services/api-gateway` | **`tsc --noEmit`** | `tsc --noEmit` | **none** | `test:unit` = `cd ../.. && tsx --test services/api-gateway/src/__tests__/*.test.ts`; `test` = `test:unit && tsx --test ../../tests/contracts/*.test.ts` |
| `services/queue-workers` | **`tsc --noEmit`** | `tsc --noEmit` | **none** | `node --test --experimental-strip-types test/*.test.mjs` |
| `services/webhook-service` | **`tsc --noEmit`** | `tsc --noEmit` | **none** | `node --test --experimental-strip-types test/*.test.mjs` |
| `services/mobile-bff` | **`tsc --noEmit`** | `tsc --noEmit` | **none** | `tsx --test test/*.test.ts` |
| `packages/payments` | `tsc -b` | `tsc --noEmit` | none | `tsx --test test/*.test.ts` |
| `packages/checkout-core` | `tsc -b` | `tsc --noEmit` | none | `tsx --test test/*.test.ts` |
| `packages/theme-engine` | `tsc -b` | `tsc --noEmit` | none | `tsx --test test/*.test.ts` |
| `packages/billing-core` | `tsc -b` | `tsc --noEmit` | none | `tsx --test test/*.test.ts` |
| `packages/commerce-core` | `tsc -b` | `tsc --noEmit` | none | **no `test` script** |
| `packages/tenant-core` | `tsc -b` | `tsc --noEmit` | none | **no `test` script** |
| `packages/shared-types` | `tsc -b` | `tsc --noEmit` | none | **no `test` script** |
| `packages/typescript/api-client` | `tsc -b` | `tsc --noEmit` | none | **no `test` script** |
| `packages/typescript/ui` | (full script set incl. `test:visual`, `validate:ui`, `lint:css`, `generate:mobile-tokens`) | `tsc --noEmit` | `lint:css` | `test`, `test:codemods`, `test:eslint-rules` |
| `apps/mobile/merchant-app` | (Flutter) | `flutter analyze` | — | `flutter test` |

**Critical caveat for later runtime agents:** every Worker's `build` script is `tsc --noEmit`. There is **no bundling step** in the workspace `build`, and **no `next build` runs anywhere in the governance gate**. `CLAUDE.md:76` says this explicitly ("the gate does NOT cover app `next build`") and it is true. To prove a merchant app actually builds you must run `pnpm --filter @letbuyy/merchant-control-plane build` yourself.

`turbo.json` tasks: `build` (dependsOn `^typecheck`, `^build`), `dev` (persistent, uncached), `lint`, `test` (dependsOn `^typecheck`, `^build`), `typecheck` (dependsOn `^build`). `turbo.json:16-27` pins the build env allowlist to 10 vars including `NEXT_PUBLIC_SUPABASE_URL`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_*`.

### 3.4 Test tree

`tests/` subdirectories (27): `api-graphql app-platform auth billing ci cloudflare contracts dependency e2e executable feature-flags federation governance gst helpers identity-foundation launch localization logistics migrations operations performance queues replay security theme-engine typescript`.

---

## 4. DEPLOY MATRIX — THE REAL ONE

### 4.1 `production-deploy.yml` (`.github/workflows/production-deploy.yml`)

Trigger: `push` to **`main`** + `workflow_dispatch` (`:3-8`).

Job graph: `branch-lag-guard` → `governance-gate` → `release-preflight` → `migration-preflight` → `staging-e2e` → `migrate-production` → `deploy-workers-production` → `deploy-apps-production` → `release-required-jobs-succeeded` → `smoke-test-production`.

**Workers deployed** (`:242` build filter, then per-service `wrangler deploy --env production`):
1. `services/api-gateway`
2. `services/webhook-service`
3. `services/queue-workers`
4. `services/mobile-bff`

**Vercel apps deployed** (matrix at `:392-402`):
1. `marketing-site`
2. `identity-platform`
3. `merchant-control-plane`
4. `storefront-runtime`
5. `platform-console`

**Verdict: the deploy matrix EXACTLY matches the constitutional 8 runtimes + the one thin ops console. No frozen app is deployed. No reserved service is deployed. `DEPLOY-R2` is HELD.** `deploy-matrix-topology-validator.mjs` PASSES and reports "9 production deploy targets and staging/Vercel frozen exclusions checked".

Notable secrets set (NAMES only — no values read or recorded):
- api-gateway: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `CSRF_SECRET`, `CUSTOMER_SESSION_SECRET`, `STEP_UP_SIGNING_SECRET`, `LETBUYY_IDENTITY_PUBLIC_JWKS`, `CHECKOUT_SIGNING_SECRET`, `TURNSTILE_SECRET_KEY`, `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`, `INTERNAL_API_KEYRING`, `QUEUE_TENANT_ENVELOPE_SECRET`, `PLATFORM_CONSOLE_API_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `PAYMENT_CONFIG_ENCRYPTION_KEY`.
- Per-service internal secrets now exist: `PRODUCTION_WEBHOOK_SERVICE_INTERNAL_SECRET`, `PRODUCTION_QUEUE_WORKERS_INTERNAL_SECRET`, `PRODUCTION_MOBILE_BFF_INTERNAL_SECRET`, `PRODUCTION_API_GATEWAY_INTERNAL_SECRET` (partial closure of the shared-`INTERNAL_API_SECRET` finding).
- **Every one of the 5 Vercel apps receives the same `AUTH_SECRET`, `CUSTOMER_SESSION_SECRET`, `CSRF_SECRET`, `INTERNAL_API_SECRET`** (matrix env block `:404-430` is not per-app except `LETBUYY_IDENTITY_PRIVATE_JWK`). See §6 / G-A-06.

### 4.2 Staging workflows — THREE exist (ART-03 said "collapse to one")

| Workflow | Trigger | Governance gate? | Targets |
|---|---|---|---|
| `deploy-staging.yml` | `push: [stepup/main]` + dispatch (`:3-6`) | **YES** — `governance-gate` job runs `node scripts/validate-governance.mjs --lane=gate` (`:43`) **and** rejects untracked Supabase migrations (`:45-52`) | 4 Workers + 5 Vercel apps (matrix `:129-135`) |
| `staging-deploy.yml` | **push trigger DISABLED** (comment `:3-7`: "'develop' branch is fully merged and stale (deleted 2026-06-12) … Active staging deploy lane is deploy-staging.yml"); `workflow_dispatch` only | not inspected as active | 4 Workers + 5 Vercel apps |
| `staging-runtime-deployment.yml` | `push: [main, release/**]` + path filters + dispatch (`:11-24`) | validate job present | Cloudflare primitives + the 4 Workers |

**This closes a prior blocker.** `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` §CLAIM 2 declared as a **BLOCKER**: "`deploy-staging.yml:4-5` deploys the active branch `stepup/main` to staging … with **zero** governance/validate step and **no** untracked-migration guard (counter-verified: grep for validate/governance/ls-files = 0 hits)". At HEAD `bf35062e` that is **REFUTED** — both controls are present. Status of that prior blocker: **RESOLVED**.

Residual: three staging workflows still exist where ART-03 mandates one. Two are dispatch/path-gated rather than deleted. **Status: PARTIAL** (G-A-08).

### 4.3 CI (`.github/workflows/ci.yml`) — the real gap

Trigger (`:3-11`):
```yaml
on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]
```
Jobs: `typecheck`, `secret-hygiene`, `lint`, `unit-tests`, `merge-safety-gate`, `governance`, `mobile-merchant`, `build`.

`.github/BRANCH_STRATEGY.md:23-29` specifies for `stepup/main`:
> Required checks: `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`.

**Those five checks can never report on a `stepup/main` PR, because `ci.yml` does not trigger on `stepup/main` at all.** `develop` is documented as retired (`BRANCH_STRATEGY.md:10`) and `origin/develop` is a stale pointer at `c2547049` (= `origin/main`). So the CI workflow's only live trigger surface is `main` — a branch nobody is supposed to push to directly.

What *does* run on a `stepup/main` PR: `architecture-governance.yml` (`pull_request` with path filters, **no branch filter**, `:4-30`) — it runs `pnpm run validate:governance`, `validate:design-system`, `lint:css`, `validate:design-tokens`, `validate:mobile-tokens`, `validate:runtime`, `validate:deployment`, `validate:topology`, `validate:dependencies`, `production-readiness-validator`. Also `lcis-pr-analysis.yml` (all PRs) and `graph-intelligence.yml` (path-filtered).

**Net: PRs into the canonical integration branch get governance + design-system checks but NO typecheck, NO build, NO unit tests, NO contract tests, NO Flutter analyze/test.** `merge-safety-gate` (full-repo typecheck + gateway unit tests + behavioral + contracts + `flutter analyze` + `flutter test`) never fires for `stepup/main`. Recorded as **G-A-03** [P0].

Corroborating governance seam: `SKIP-A3-GITHUB-GOVERNANCE-STATUS-CHECK` (`SKIPPED_HUMAN_DECISIONS.md:7`) confirms GitHub branch protection has never been configured, so nothing is actually enforced server-side either.

### 4.4 Root exclusions of frozen apps

`package.json:11,12,67` (`build`, `lint`, `typecheck`) exclude `@letbuyy/app-marketplace`, `@letbuyy/theme-marketplace`, `@letbuyy/developer-portal`, `@letbuyy/platform-operations-portal`. Their source (≈30k LOC per the prior certification) is still tracked and still workspace members. `SKIP-D4-FROZEN-VERCEL-PROJECT-DELETION` remains open for provider-side project deletion.

---

## 5. GOVERNANCE GATE — CURRENT REAL STATE

### 5.1 Composition

`scripts/validate-governance.mjs:15-124` — **108** gate-lane validators (I counted programmatically; all 108 files exist under `scripts/validators/`). `reportValidators` = 1 (`foundation-stepup-report-validator.mjs`). `scripts/validators/` contains **112** `.mjs` files, so 3 are helpers (`governance-common.mjs`, `phase-b-common.mjs`, …) and/or unregistered.

`criticalGateValidators` (must never be demoted, `:127-133`): `dependency-manifest-validator`, `undeclared-import-validator`, `package-export-validator`, `dependency-graph-validator`, `circular-import-validator`. `demotedValidators` is empty.

### 5.2 I RAN ALL 108 INDIVIDUALLY. RESULT: 83 PASS / 25 FAIL.

Method: each `scripts/validators/<name>.mjs` invoked directly with `node`, bypassing the destructive wrapper (§3.2). Evidence type: RUNTIME_OBSERVATION.

| Validator | Head of failure |
|---|---|
| `tenant-isolation-validator` | `services/api-gateway/src/tenant/tenant-tables.registry.ts` must match schema-derived registry; run `scripts/generators/generate-tenant-table-registry.mjs` **[HIGH-STAKES — tenancy]** |
| `validate-design-system` | (drift ratchet) |
| `package-ownership-validator` | ~40 offenders: every `packages/lcis-*` + `services/lcis-api` + `tools/central-intelligence` lacks `AGENTS.md` |
| `dependency-manifest-validator` | `packages/lcis-live/test/security.test.ts` imports undeclared; `packages/theme-engine/src/theme-safe-update.ts` imports `${fromVersion}` (template-literal import misparse) **[CRITICAL-GATE validator]** |
| `undeclared-import-validator` | same two offenders **[CRITICAL-GATE validator]** |
| `provider-isolation-validator` | `packages/lcis-adapters/src/{analytics-engine,cloudflare}/…` use provider API URLs outside `packages/infrastructure` |
| `typescript-governance-validator` | `packages/lcis-*` tsconfigs lack declaration maps / composite; `tsconfig.workspace.json` missing references |
| `custom-domain-target-validator` | merchant UI must read public target env |
| `merchant-domains-settings-validator` | domains settings page missing `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET`, `apexMxWarning`, `Ownership` **[merchant-facing]** |
| `platform-domain-literal-validator` | `letbuyy.store` literals in `apps/identity-platform/src/app/api/auth/create-store/route.ts:133`, `apps/identity-platform/src/app/onboarding/page.tsx:378`, … **[violates DEPLOY-R3]** |
| `route-ownership-validator` | (route-count lockstep) |
| `legacy-site-type-validator` | marketing create page exposes portfolio/resume outside the legacy flag |
| `migration-safety-validator` | "Root `supabase/config.toml` is retired; archive duplicate configs under `docs/archive`" |
| `sequential-migration-validator` | **Untracked migration on disk: `database/supabase/migrations/196_theme_rls_tenant_hardening.sql`** |
| `domain-boundary-validator` | `services/api-gateway/src/schemas/theme.schema.ts` defines contracts locally; `apps/marketing-site/src/app/api/founding-pricing/route.ts` lacks ownership classification |
| `route-line-count-validator` | `services/api-gateway/src/routes/themes.ts` = **1870 lines** (limit 1500) |
| `cms-slugify-validator` | `apps/merchant-control-plane/src/app/[store]/products/smart-collections/page.tsx` declares a local slugify |
| `date-format-validator` | local `formatDate` helpers in marketing + merchant apps |
| `api-client-runtime-base-validator` | `apps/marketing-site/src/app/create/page.tsx` must use the shared API base resolver |
| `marketing-dead-twin-validator` | marketing homepage no longer uses live `Header`/`Hero`/`SiteTypes` |
| `raw-error-message-validator` | `services/api-gateway/src/routes/resource-search.ts` returns raw `error.message` for `SEARCH_ERROR` |
| `environment-validator` | secret-like values in `packages/theme-engine/test/{dynamic-source-binding,theme-engine}.test.ts` |
| `stale-artifact-validator` | untracked `.next`/`node_modules` under apps — **likely an artifact of my bypassing the wrapper's cleanup step, not a real defect** |
| `tooling-governance-validator` | `scripts/.DS_Store` |
| `prompt-perimeter-validator` | unregistered prompt-class files under `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/…` |

**Honest caveats I will not compress away:**
- The worktree is **dirty (6784 M, 20 ??)**. I cannot separate "defect on the committed tree" from "consequence of the user's uncommitted work" without a clean checkout, which the mission forbids. Specific offenders I confirmed are **modified**: `apps/identity-platform/src/app/api/auth/create-store/route.ts` (M), `services/api-gateway/src/routes/themes.ts` (M). Migration 196 is **untracked** (??).
- Specific offenders I confirmed are **tracked, committed reality**: all 591 `packages/lcis-*` + `services/lcis-api` files (`git ls-files`), so `package-ownership-validator`, `typescript-governance-validator`, and `provider-isolation-validator` failures are real committed-tree failures.
- `stale-artifact-validator` almost certainly passes under the real wrapper (which deletes the artifacts first). Treat it as a false positive of my method.

**Conclusion: the gate is RED. `R-18` ("a green gate MUST mean conforms to the Constitution") and `PRIME-R4` cannot currently be satisfied, and both `deploy-staging.yml` and `production-deploy.yml` would fail at their `governance-gate` job today.** Recorded as **G-A-01** [P0].

---

## 6. FEATURE FLAGS — SYSTEMS AND DEFAULTS

Three flag systems exist. There is no single flag registry.

### 6.1 Gateway env flags — **FAIL-OPEN outside production**

`services/api-gateway/src/middleware/featureFlags.ts`:
```ts
:4   export type GatewayFeatureFlag = 'FEATURE_GRAPHQL' | 'FEATURE_EXTENSIONS' | 'FEATURE_LIQUID';
:19  export function isGatewayFeatureEnabled(env, flag): boolean {
:20      const value = normalizedFlagValue(env[flag]);
:21      if (value) return ['1','true','on','enabled','yes'].includes(value);
:25      return !isProductionRuntime(env);      // ← UNSET + NON-PRODUCTION ⇒ ENABLED
:26  }
```

Declared values (`services/api-gateway/wrangler.toml`):

| Flag | top-level `[vars]` (:39-41) | `[env.staging.vars]` (:130-132) | `[env.production.vars]` (:246-248) | Default when unset |
|---|---|---|---|---|
| `FEATURE_GRAPHQL` | `"true"` | `"true"` | **`"false"`** | ON in non-prod |
| `FEATURE_EXTENSIONS` | `"true"` | `"true"` | **`"false"`** | ON in non-prod |
| `FEATURE_LIQUID` | `"true"` | `"true"` | **`"false"`** | ON in non-prod |
| `FEATURE_AI_CREDIT_PURCHASE` | `"false"` | `"false"` | `"false"` | — |

Gated routes (`services/api-gateway/src/index.ts:712-716, 759-760`):
- `FEATURE_GRAPHQL` → `/storefront/graphql`, `/graphql/storefront`, `/admin/graphql`, `/graphql/admin`
- `FEATURE_EXTENSIONS` → **`/storefront/:subdomain/checkout/extensions`**, `/app-store/installations/:id/extensions`, `/app-store/installations/:id/extensions/:registrationId`

**Findings:**
- A **checkout-extensions route exists in the gateway** and is ON in staging. `R-12` / `ARCH-R9` / `ART-16` forbid third-party/extension code in the live checkout path and mandate the runtime be a *seam, not a build*. Production is flag-off, which is a mitigation, not conformance. `SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB` (`SKIPPED_HUMAN_DECISIONS.md:52`) is the open ARB seam and describes exactly this: "GraphQL/extensions remain dead-by-flag convergence debt".
- The fail-open default (`:25`) contradicts `SEC-R1` ("Everything fails closed"). Any non-production runtime that forgets the var gets GraphQL + extensions enabled. `services/api-gateway/src/routes/ai.ts:1028` even documents this behaviour in a comment.
Recorded as **G-A-07**.

### 6.2 Theme / Liquid renderer flags

`packages/theme-engine/src/theme-governance.ts`:
```
:13  THEME_RENDERER_GOVERNANCE_DEFAULT_MODE  = 'warn'
:14  THEME_LIQUID_RENDERING_DEFAULT_ENABLED  = false        ← Liquid OFF by default
:143 resolveThemeLiquidRenderingEnabled(input)
:154-158  explicitEngine = [templateConfig.rendererEngine, releaseManifest.renderer_engine,
                            releaseManifest.rendererEngine, rendererManifest.engine]
:159 if (explicitEngine.includes('liquid')) return true;    ← unconditional flip, before canary checks
:161-171 canary candidates: liquidRenderingCanary / liquid_rendering_canary / liquidCanary (6 shapes)
:181 return input.defaultEnabled ?? THEME_LIQUID_RENDERING_DEFAULT_ENABLED
```
`apps/storefront-runtime/src/proxy.ts:175` — `const renderEngine = process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true' ? 'liquid' : 'react';`
`apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:244` passes `defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED`.

**Default = React. `ART-17` "React is the live read path" holds.**

Concern for Agent-theme: the comment at `theme-governance.ts:149-153` states `release_manifest.renderer_engine = 'liquid'` is "set whenever the theme has a liquidBundle" by the gateway's `buildReleaseArtifacts`. If true, **any theme that acquires a Liquid bundle auto-flips to Liquid**, bypassing the per-theme canary gate that `ART-17` requires (`LETBUYY_CONSTITUTION.md:254,256`: "The Liquid default-flip is per-theme + canary, gated on a sanitizer + section ports + a parity/security/perf harness"). I did not trace `buildReleaseArtifacts`. **UNVERIFIED — hand to Agent-theme.** Recorded as **G-A-13**.

`HR-LIQUID-ARB-FLIP` (`EXECUTABLE_HUMAN_REQUIRED.md:29`) records `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status:'deferred'` at `theme-governance.ts:16`, and states `theme-governance-validator.mjs` fails the gate if flipped without ARB sign-off. `theme-governance-validator` PASSES today.

### 6.3 Identity-foundation flags — fail-closed (correct)

`packages/auth-core/src/feature-flags.ts:1-33` — 15 flags, all defaulting **false**, enabled only on the exact string `'true'`:
`FEATURE_IDENTITY_PROVIDER, FEATURE_OIDC_CLIENT, FEATURE_NEW_SESSION_ENGINE, FEATURE_NEW_PERMISSION_ENGINE, FEATURE_NEW_AUDIT_ENGINE, FEATURE_AUDIT_DUAL_WRITE, FEATURE_NEW_KEY_SERVICE, FEATURE_ORG_MODEL, FEATURE_NEW_MFA_ENGINE, FEATURE_SHADOW_AUTH, FEATURE_SHADOW_PERMISSION, FEATURE_SHADOW_SESSION, FEATURE_TOKEN_HASH_SHADOW, FEATURE_NEW_CSRF, FEATURE_PERUSER_ADMIN_TOTP`.
`DEFAULT_IDENTITY_FOUNDATION_FEATURES` = all `false` (`:23-26`). Re-exported through `services/api-gateway/src/identity-foundation/feature-flags.ts`.

### 6.4 Database flag table

`operational_feature_flags` exists in the baseline schema (`database/supabase/migrations/000_baseline.sql:9987-10006`) — columns include `environment` (CHECK: local/development/staging/production), `flag_key`, `status` (CHECK: draft/approved/active/disabled/expired), `site_id`, `owner_runtime`; unique on `(environment, flag_key)`; indexed at `:17647`, `:17654`. It is registered as a tenant table (`services/api-gateway/src/tenant/tenant-tables.registry.ts:1397`). I found **no runtime read path** for it in `apps/` or `services/` — only `packages/lcis-execution/src/rollback/RollbackIntelligenceService.ts:352` mentions it as a rollback lever. **Status: DB_SCHEMA present, wiring UNVERIFIED.** Recorded as **G-A-14**.

**GST flags:** I found none. GST behaviour appears to be data/config-driven, not flagged.
**Payments flags:** only `FEATURE_AI_CREDIT_PURCHASE` (`"false"` in all three env blocks) and provider-mode (sandbox/live) resolution, which is not a boolean flag system.

---

## 7. CODEOWNERS

`.github/CODEOWNERS` — **every path is owned by the single handle `@saai-sidd`.** There is no team split.

```
*                                                   @saai-sidd
/.github/workflows/                                 @saai-sidd
/database/supabase/migrations/                      @saai-sidd
/config/env/                                        @saai-sidd
/services/api-gateway/src/routes/payments.ts        @saai-sidd
/services/webhook-service/                          @saai-sidd
/apps/storefront-runtime/                           @saai-sidd
/apps/merchant-control-plane/                       @saai-sidd
/apps/identity-platform/                            @saai-sidd
/apps/app-marketplace/  /apps/theme-marketplace/    @saai-sidd
/apps/marketing-site/                               @saai-sidd
/apps/platform-console/                             @saai-sidd
/apps/platform-operations-portal/                   @saai-sidd
/apps/mobile/                                       @saai-sidd
/services/  /packages/  /database/  /infrastructure/ @saai-sidd
/docs/governance/                                   @saai-sidd
/scripts/validate-architecture.mjs                  @saai-sidd
/scripts/validate-governance.mjs                    @saai-sidd
/scripts/validators/                                @saai-sidd
```

**Consequences:** (a) `AGENTS.md` and `CLAUDE.md` are **not** listed — a change to supreme operating law requires no specific reviewer; (b) `apps/developer-portal/` is not listed (falls to `*`); (c) `LCIS`/`tools/` are not listed; (d) the "no self-certification" rule in `LAUNCH_READINESS_2026_06_12/LAUNCH_CERTIFICATION.md:3` ("the agent or person who executed a phase may not be its sole certifier") is **structurally impossible** with a single owner. This is a founder-stage reality, not a defect per se, but it means CODEOWNERS provides **zero** review-lane separation for money/auth/tenancy. Recorded as **G-A-15** [P2].

Git identity in use: `SaaiSiddhu`. CODEOWNERS handle: `@saai-sidd`. I did not verify these resolve to the same GitHub account.

---

## 8. DOCUMENTATION DRIFT — PROVEN-FALSE STATEMENTS

Every row below is a statement I can prove false at HEAD `bf35062e`.

| # | Doc statement | Citation | Reality | Evidence |
|---|---|---|---|---|
| D-01 | "New migrations MUST be numbered sequentially from the **current max (161)** — i.e. the next migration is `162`" | `AGENTS.md:156` | Max tracked = **195** (`195_contact_requests.sql`); untracked 196 on disk | `ls database/supabase/migrations/` |
| D-02 | "the three known unpaired migrations (138/140/157) MUST gain rollbacks; a rollback-pairing validator gates merge for any migration ≥ 138" | `AGENTS.md:157` | **@23:21: 12** migrations ≥138 lack a rollback: **138, 140, 157, 170, 175, 179, 182, 183, 184, 186, 187, 194** (it was **18** at ~22:58 — 180/181/188/189/190/191 gained untracked rollbacks at 23:07 from the concurrent actor). **No validator enforces SQL rollback pairing at all** | `ls database/supabase/rollback/` (**47** files, 7 untracked) vs 125 migrations; `grep supabase/rollback scripts/validators/*.mjs` → only commission/provider-badge/session validators reference it incidentally |
| D-03 | "stale counts (19 migrations / 237 tables vs the real **91 / 419**, max migration 161)" | `AGENTS.md:7` | **125** migration files @23:21 (000 baseline + 073…195 contiguous, all tracked, + untracked 196; 001-072 squashed into baseline) | programmatic gap analysis |
| D-04 | "Keep the **107-validator** gate green" | `CLAUDE.md:76` | **108** gate-lane validators | `scripts/validate-governance.mjs:15-124` |
| D-05 | "gate GREEN (**105** validators)" | `LAUNCH_READINESS_2026_06_12/000_LAUNCH_READINESS_INDEX.md:3` | 108; and currently RED | §5.2 |
| D-06 | "**Gate:** GREEN (**106** gate-lane validators)" | `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md:3` | 108; currently RED | §5.2 |
| D-07 | "Governance gate is **123 validators**, fail-fast, and currently fails on exactly ONE thing" | `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:7` | 108; **25** fail | §5.2 |
| D-08 | "`node scripts/validate-governance.mjs --lane=gate` passes at **107+** validators" | `EXECUTABLE_HUMAN_REQUIRED.md:25` | 108 registered; gate currently fails | §5.2 |
| D-09 | "`SKIPPED_HUMAN_DECISIONS.md` (**56 seams**)" | `LAUNCH_READINESS_2026_06_12/000_LAUNCH_READINESS_INDEX.md:5` | **60** table rows / 60 unique SKIP-IDs | `grep -cE '^\| SKIP-'` |
| D-10 | "`main..stepup/main` … is **currently 6**" | `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` §CLAIM 2 | **106** | `git rev-list --count main..stepup/main` |
| D-11 | "`deploy-staging.yml:4-5` deploys `stepup/main` … with **zero** governance/validate step and **no** untracked-migration guard" | `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` §CLAIM 2 BLOCKER | **FIXED** — `deploy-staging.yml:41-52` runs the gate + untracked-migration rejection | file read |
| D-12 | "`sequential-migration-validator.mjs:9` iterates `getTrackedFiles()` only — never tracked-vs-disk" | `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` §CLAIM 2 BLOCKER | **FIXED** — `scripts/validators/sequential-migration-validator.mjs:13-27` reads `getUntrackedFiles()` and it *did* catch migration 196 | validator run |
| D-13 | "**LB-8** announcement bar … live React renderer has no `announcementBar` component → renders `UnknownSectionFallback`" | `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:53` | **IMPLEMENTED** — `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:21,83-85` registers `AnnouncementBar` from `@/components/layout/announcement-bar` (file exists) | file read |
| D-14 | "**LB-9** appearance bridge … storefront **never reads** `sites.site_settings`; `STOREFRONT_SITE_SELECT` omits it" | `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:54` | **IMPLEMENTED** — `services/api-gateway/src/routes/storefront.ts:345,349` both include `site_settings`; `apps/storefront-runtime/src/lib/store-service.ts:576-579,699` merge it | file read |
| D-15 | "**LB-12** shopper registration … no register form/route" | `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:55` | **IMPLEMENTED** — `services/api-gateway/src/routes/storefront/customer-registration.ts:33` (`POST /customer/register`), `apps/storefront-runtime/src/app/api/customer/register/route.ts`, `packages/typescript/api-client/src/index.ts:5470` | file read |
| D-16 | "**Gift cards** … Issuance writes `gift_cards`; checkout redeems `gift_card_accounts` → issued codes unredeemable" | `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:43` | **IMPLEMENTED** — `services/api-gateway/src/routes/gift-cards.ts:19-21,88` uses the canonical `gift_card_accounts` model via `db.rpc('issue_gift_card')`; migrations 173/174 exist | file read + `EXECUTION_LEDGER.md` rows `V1-LAUNCH-LB11`, `V1-COMPLETION-REFUND-RESTORE` |
| D-17 | "**LB-10** … no `order_cancelled`/`order_refunded` email type" | `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:35` | **IMPLEMENTED** per `EXECUTION_LEDGER.md` row `V1-LAUNCH-LB10-DISPATCH` (`enqueueOrderLifecycleEmail`) — **I did not verify the source** | DOC_CLAIM only; hand to Agent-orders |
| D-18 | `HR-B1A-FOUNDATION-PUSH` pre-condition "`git status --porcelain` empty" and "`main` and `stepup/main` must both show `f55fe6e4`" | `EXECUTABLE_HUMAN_REQUIRED.md:25` | Worktree has 6784 M / 20 ??; `f55fe6e4` is not any current ref | `git status`, `git rev-parse` |
| D-19 | `MERGE_RUNBOOK.md:9` "Required local invariant: `git rev-list --count main..stepup/main` returns `0`" | `MERGE_RUNBOOK.md:9` | Returns **106** | git |
| D-20 | `MERGE_RUNBOOK.md:33` expects "`git status --short` is empty" before promotion | `MERGE_RUNBOOK.md:33` | 6804 entries | git |
| D-21 | `CLAUDE.md:81` "`getSupabaseAdmin` (**115 files**)" | `CLAUDE.md:81` | **121 files / 1028 references** across apps+services+packages | grep |
| D-22 | `CLAUDE.md:73` "the design-system ratchet forbids new `rounded-[...]`/raw px" — implies the ratchet is green | `CLAUDE.md:73` | `validate-design-system.mjs` currently **FAILS** | §5.2 |
| D-23 | `.github/BRANCH_STRATEGY.md:25` required checks `ci / typecheck|lint|build|unit-tests|governance` on `stepup/main` | `.github/BRANCH_STRATEGY.md:25` | `ci.yml:4-11` never triggers on `stepup/main` — those checks cannot report | file read |
| D-24 | `services/queue-workers/AGENTS.md:3` "Reserved background job runtime" / "Status: Incubating" | file | `ARCH-R1` lists it as canonical runtime **#2**, actively deployed to production | `AGENTS.md:71`, `production-deploy.yml:242` |
| D-25 | `CAPABILITY_BACKLOG.md` gap IDs jump CAP-C12 → CAP-C15 | `CAPABILITY_BACKLOG.md:18-19` | **CAP-C13 and CAP-C14 do not exist** anywhere in the file. Either retired without a supersession note (violating `DOC-R4`) or a numbering error | grep |
| D-26 | Constitution header "**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`. Evidence pinned at `stepup/main` @ `c4fc3cd6`" | `LETBUYY_CONSTITUTION.md:7` | Repo now at `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store`; `c4fc3cd6` is ~hundreds of commits stale. Cosmetic but it is the supreme document's own provenance line | — |

Also worth recording (not strictly "false", but materially incomplete):
- `AGENTS.md` Appendix B (`:397-401`) still lists `LETBUYY_CONSTITUTION.md` and `LETBUYY_CANONICAL_SYSTEMS.md` as possibly-not-existing ("until they physically exist, follow V1+Freeze"). Both exist. Minor.
- Root `AGENTS.md` describes `services/identity-platform` in the runtime table (`:73`) with a parenthetical "*(app root: `apps/identity-platform`)*". `services/identity-platform` does **not** exist. The parenthetical saves it, but the table is confusing.

---

## 9. PRIOR-TRUTH DOCUMENTS — SKEPTICAL READ

### 9.1 Named human seams H1–H9 (exact definitions, verbatim)

Source of record: `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md:44-53` (dated 2026-06-13, HEAD `140a73db`), duplicated in `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:63-72`.

| # | Seam | Required action | Owner | Dependency | Risk | Launch impact (verbatim) |
|---|---|---|---|---|---|---|
| **C0** | Commit seam (sandbox) | clear `.git/index.lock`; `git add` + commit LB-7 (and any LB-8…12) | engineer at a real checkout | none | low | "**Blocks every per-block commit** the program mandates; blocks LB-7 finalization" |
| **H1** | Push to origin + branch protection | push, protect `main` | eng lead | C0 | med | "origin stays behind until done" |
| **H2** | 32 production secrets | "set Razorpay live, `STEP_UP_SIGNING_SECRET`, `CUSTOMER_SESSION_SECRET`, identity JWK, etc." | founder/eng | Razorpay, Resend, Turnstile accounts | **high** | "money + auth fail closed without" |
| **H3** | DNS + wildcard `*.letbuyy.com` | create zone + records | founder | domain | high | "**storefront unreachable** without" |
| **H4** | Production Supabase + migrations 000→170 | provision + `db push` | eng | C0/H1 | high | "no prod DB = no launch" |
| **H5** | Secret rotation → `INTERNAL_AUTH_LEGACY_ACCEPT=false` | rotate per-caller secrets | eng | H2 | med | "internal-auth hardening" |
| **H6** | Resend live (SPF/DKIM/DMARC, `LETBUYY_EMAIL_MODE=live`) | domain auth | founder | DNS | med | "**all email no-ops** (gates LB-10)" |
| **H7** | Turnstile live keys | provision | founder | none | med | "login/signup fail closed" |
| **H8** | **Razorpay Route onboarding** | **PA split onboarding** | **founder** | **Razorpay** | **high** | "**real payouts blocked** (LB-4 live)" |
| **H9** | Legal ToS/Privacy/DPDP + pricing truth | author + sign | founder/legal | none | med | "compliance / GO-NO-GO row" |

**Current state of each (my corroboration):**

| Seam | Current state | Evidence |
|---|---|---|
| C0 | **RESOLVED.** `.git/index.lock` is gone; 106 commits landed on `stepup/main` after `140a73db`; `EXECUTION_LEDGER.md` has 246 rows including post-`140a73db` `V1-LAUNCH-*` and `V1-COMPLETION-*` entries | git; `EXECUTION_LEDGER.md` tail |
| H1 | **OPEN, and worse.** Local `main` = `140a73db` (106 behind). `origin/main` = `c2547049`, `origin/stepup/main` = `75305725`, `origin/develop` = `c2547049`. Last local fetch: **Jul 31 23:53** — so remote state as I see it may itself be stale; I did not fetch. `origin/main..stepup/main` = 291 commits by local remote-tracking refs (**treat as approximate**). `origin/develop` still exists, contradicting `BRANCH_STRATEGY.md:10` and `HR-B1A` step 4 | git |
| H2 | **OPEN.** `release-preflight` in `production-deploy.yml:60-160` enumerates **31 required production secret names** and hard-fails if any is absent. I recorded names only, never values. `SKIP-PROVIDER-SECRETS` open | workflow |
| H3 | **OPEN.** `SKIP-PROD-DNS-CUTOVER`, `SKIP-D5-DNS-TERRAFORM-APPLY`, `SKIP-W3-DNS-CUTOVER` all open | `SKIPPED_HUMAN_DECISIONS.md:9,11,~` |
| H4 | **OPEN + SCOPE GREW.** The seam says "000→170"; the tree now has through **195** (+ untracked 196). Anyone executing H4 from the doc will under-migrate by 25 files | migrations dir |
| H5 | **OPEN.** `HR-SECRET-ROTATION` (`EXECUTABLE_HUMAN_REQUIRED.md:24`) is the executable version; `SKIP-W4-LIVE-SECRET-ROTATION` open. Repo side is built: `INTERNAL_API_KEYRING` + 9 per-caller secret names exist in `config/env/staging-production-secret-matrix.json` and in `production-deploy.yml` | matrix + workflow |
| H6 | **OPEN.** `HR-ESP-LIVE`, `SKIP-CAP-LIVE-EMAIL-DISPATCH`, `CAP-C18` | registries |
| H7 | **OPEN.** `HR-TURNSTILE-LIVE`, `SKIP-W7-MOBILE-TURNSTILE-SECRET`, `CAP-C09` | registries |
| **H8** | **OPEN — the single highest-value money seam.** Executable twin: `HR-PA-SPLIT-LIVE` (`EXECUTABLE_HUMAN_REQUIRED.md:5`): "Complete PA merchant onboarding, provision live Route/Easy-Split credentials, and install secrets with `wrangler secret put`." Files: `packages/infrastructure/payout-transfer-adapter/index.ts`, `services/api-gateway/src/routes/payouts.ts`, `services/api-gateway/src/routes/settlements.ts`. Backlog twin: `CAP-C03` ("live PA credentials, enablement, and payout smoke remain human-live"). SKIP twins: `SKIP-CAP-PAYOUT-PROVIDER-CLIENT`, `SKIP-PROVIDER-SECRETS`, `SKIP-D5-LIVE-MONEY-RECONCILIATION`. Related residue: `SKIP-RAZORPAYX-ENUM-PURGE` — "the API/database contract can still accept or display a self-custody rail value" (`database/supabase/migrations/000_baseline.sql:8282,8284,10252`; `packages/shared-types/src/index.ts:713`) | registries |
| H9 | **OPEN.** `HR-LEGAL-DPDP-PA`, `SKIP-BRAND-LEGAL-FACTS` | registries |

**Verdict on H1–H9: none is closed. Every one remains BLOCKED_EXTERNAL.** No fabricated closure appears anywhere I checked.

### 9.2 CAP-C01…CAP-C18 (16 rows; C13/C14 absent)

Source: `CAPABILITY_BACKLOG.md:7-22`. Header (`:3`) is explicit: *"These are not convergence cleanup tasks and are not claimed complete."* All 16 are of the form **repository-side built, live certification human-gated** — i.e. `IMPLEMENTED_NOT_RUNTIME_VERIFIED` + `BLOCKED_EXTERNAL`.

| ID | Missing behaviour (compressed) | Named validator/test that detects it | Corroboration |
|---|---|---|---|
| CAP-C01 | Live capture-ledger certification (provider capture smoke + variance-0 recon) | `canonical-ledger-only-validator` migration-aware ratchet | validator PASSES; live evidence absent |
| CAP-C02 | Live refund-ledger certification | same + B1/B2 refund tests | ditto |
| **CAP-C03** | **Live payout provider certification (Razorpay Route creds/enablement/smoke) — this is H8's repo-side twin** | `no-self-custody-rail-validator`; payout-provider client tests | validator PASSES |
| CAP-C04 | Live money reconciliation (zero-break-or-explained-suspense) | `canonical-ledger-only-validator`; queue-worker + console tests | — |
| CAP-C05 | Live settlement executor certification | `no-self-custody-rail-validator`; settlement source tests | — |
| CAP-C06 | Live step-up certification (`STEP_UP_SIGNING_SECRET`, TOTP, smoke) | `stepup-crypto-validator` (bans string-length proof) | validator PASSES |
| CAP-C07 | Live OIDC/HS256-drain certification | `session-security-validator` (bans fake disabled JWKS) | validator PASSES |
| CAP-C08 | Liquid production canary, snapshot corpus, ARB flip, React deletion proof | `no-new-react-sections-validator` | validator PASSES — **but see G-A-04, the freeze is directory-scoped and was walked around** |
| CAP-C09 | Live mobile Turnstile certification | `beta-readiness-validator` | — |
| CAP-C10 | Live alert delivery certification (DSN, on-call drills) | `beta-readiness-validator` | — |
| CAP-C11 | Live tenant red-team certification (RT-1…RT-9 against production roles) | `rls-force-coverage-validator` requires the executable proof; `tests/executable/tenant-redteam-postgres.test.mjs` | validator PASSES statically; **`tenant-isolation-validator` currently FAILS** (registry out of sync) |
| CAP-C12 | Live store-publish certification (publish/rollback smoke) | `beta-readiness-validator` CAP-C12 fragments | — |
| **C13, C14** | **DO NOT EXIST** | — | numbering gap, no supersession note (`DOC-R4` breach) — **G-A-16** |
| CAP-C15 | Live automated KYC (Signzy/HyperVerge); live `manual` → `needs_review` | `provider-mode-badge-validator` bans `live_provider_stub` | validator PASSES |
| CAP-C16 | Live logistics (Shiprocket/Delhivery/Pickrr) — live mode **fails closed** rather than reusing scaffold labels | `provider-mode-badge-validator` | PASSES |
| CAP-C17 | Live AI-credit purchase; grants stay `pending_provider_payment` until webhook proof | `provider-mode-badge-validator` | PASSES. Prior blocker B6 ("AI-credit purchase path posts money to nothing") is at least partially addressed here — **hand to Agent-payments to prove** |
| CAP-C18 | Live email via Resend; missing creds fail closed | `provider-mode-badge-validator` | PASSES |

**Skeptical note:** every CAP row cites a validator that *does* pass. But 12 of the 16 validators cited are **text/fragment-shape assertions** (`beta-readiness-validator`, `provider-mode-badge-validator` assert that specific marker strings and route fragments exist in source), not behavioural tests. `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` §CLAIM 2 makes the same point independently: "of ~118 distinct gate checks, ~55 assert reality … ~45 assert document/config text". Treat a passing CAP validator as **evidence the marker is present**, not evidence the capability works.

### 9.3 `FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12` — the best prior document, scored

Dated 2026-06-12, HEAD `f961e23a` (clean tree). Self-described adversarial 8-agent audit. Verdict: **"Foundation Era verdict: NOT COMPLETE"**, certification **withheld**.

Its scoreboard (`§1`) — **these are the source's own numbers, not mine, and I did not re-derive them**:
Strategic Winners 5.5/10 · Strategic Losers 5/10 · Architecture 6/10 · Governance 5/10 · Money 6.5/10 · Identity 4/10 · Liquid 3/10 · Cleanup 4/10 · Launch Readiness 4/10 · **Repository Reality 5/10** ("Local tree ~7/10; production reality ~1/10 — the repo is two realities").

Its seven named blocker-grade facts, and my corroboration at `bf35062e`:

| # | Blocker | My verdict |
|---|---|---|
| 1 | "production (`origin/main`) is 170 commits stale and still ships the `/api/auth/switch` account takeover, a 3% rake, and pre-RLS-hardening leaks" | **CORROBORATED (worse).** Local `main` is 106 behind; remote refs (stale, last fetch Jul 31) put `origin/main..stepup/main` at 291. The *specific* content claims (takeover / 3% rake on the deployed tree) I could **not** verify without inspecting `origin/main`'s tree — **UNVERIFIED, hand to Agent-identity/Agent-payments** |
| 2 | "the mandated `main..stepup/main == 0` invariant is violated (= 6)" | **CORROBORATED, magnitude 106** |
| 3 | "the active branch deploys to staging through a workflow with **no governance gate**" | **REFUTED / FIXED.** `deploy-staging.yml:41-52` |
| 4 | "the gate lane remains blind to untracked migrations" | **REFUTED / FIXED.** `sequential-migration-validator.mjs:13-27`, proven by it catching migration 196 |
| 5 | "the money-invariant runner (I1–I8) is **structurally false-green**" | **LIKELY FIXED.** `scripts/money-certification/check-invariants.mjs:41-70` now implements a `--probe` negative control that exits 2 if the instrument returns 0 on a known-violation fixture. I1–I8 exist as real SQL under `scripts/money-certification/invariants/`. Requires `STAGING_DB_URL` → **BLOCKED_EXTERNAL to execute.** Hand to Agent-payments |
| 6 | "the AI-credit purchase path posts money to nothing" | **PARTIALLY ADDRESSED** per CAP-C17 (grants deferred to `pending_provider_payment`). **UNVERIFIED by me** |
| 7 | "one shared `INTERNAL_API_SECRET` across ~10 runtimes makes internal identity assertions forgeable from any compromised runtime" | **PARTIALLY ADDRESSED.** `config/env/staging-production-secret-matrix.json` now names 9 per-caller secrets + `INTERNAL_API_KEYRING`; `production-deploy.yml` sets per-service values. But `HR-SECRET-ROTATION` explicitly records `INTERNAL_AUTH_LEGACY_ACCEPT` **defaults ON** and the legacy shared secret is still accepted until a human flips it (= H5). And `services/webhook-service/src/index.ts:584` still does `env.INTERNAL_API_SECRET \|\| env.AUTH_SECRET` — the exact fallback `SEC-R7` calls DEAD |

Its closure list `§5`: B2 (re-point `main`), B3 (gate active-branch deploy), B4 (tracked-vs-disk migration check), B5 (make I1–I8 assert), B6 (ledger or remove AI-credit), B7 (per-runtime secrets / enforce EdDSA issuer outside prod), plus B1 (human push).
**My read of the B-list at `bf35062e`: B3 ✅, B4 ✅, B5 ✅(repo-side), B6 partial, B7 partial, B2 ❌ (regressed — now 106), B1 ❌.**

### 9.4 Other prior-truth documents — one-line skeptical verdicts

| Document | Date / basis | Verdict |
|---|---|---|
| `CAPABILITY_BACKLOG.md` | live registry | **Honest.** Explicitly refuses completion claims. Cites `path:line` for every gap. C13/C14 gap unexplained |
| `EXECUTABLE_HUMAN_REQUIRED.md` | live registry, 27 HR rows | **Honest and highly actionable.** Contains the most precise H8 definition (`HR-PA-SPLIT-LIVE`). Its `HR-B1A` pre-conditions are now unsatisfiable (D-18) |
| `SKIPPED_HUMAN_DECISIONS.md` | live registry, 60 rows | **Honest.** Every row has a "what is mocked in the meantime" column that refuses to fake success. **Zero rows marked RESOLVED** — including `SKIP-A2-REMOTE-BRANCH-CONVERGENCE` which `HR-B1A` step 8 says to resolve after the push |
| `EXECUTION_LEDGER.md` | 246 rows, 280 KB | **Detailed and self-critical** (e.g. `V1-COMPLETION-BUILD` admits `next build` would have failed on 4 type errors that the gate never catches — corroborating the "gate does not cover next build" warning). I did not audit it row-by-row |
| `MERGE_RUNBOOK.md` | 79 lines | **Currently unexecutable** — both pre-conditions false (D-19, D-20). Guardrail 1 ("Do not run `git clean`, `git reset --hard`, blanket `git restore`") is correct and I obeyed it |
| `V1_SCOPE_LOCK_2026_06_12/*` | 2026-06-13 @ `140a73db` | **MATERIALLY STALE.** 5 of its 6 blockers (LB-8/9/10/11/12) are now implemented (D-13…D-17). Its H1–H9 table is still the canonical seam definition and is still accurate as a *seam list*. **Do not use its status columns.** |
| `LAUNCH_READINESS_2026_06_12/*` | 2026-06-12 @ `5c2d3993` | **Program design, not status.** `LAUNCH_CERTIFICATION.md` §2 has a 16-row GO/NO-GO with 11 non-waivable ⛔ rows — a good acceptance frame for the final dossier. Its "no self-certification" rule is unsatisfiable under the current single-owner CODEOWNERS (§7) |
| `FOUNDATION_CLOSURE_2026_06_12/*` | 2026-06-12 | Contains `FOUNDATION_FREEZE_CERTIFICATION.md` with "_pending-human_" fields per `HR-B1A` step 7. Not signed |
| `FINAL_TRUTH_AUDIT_2026_06_11/*` | 2026-06-11 | Contains `G4_HUMAN_EXECUTION_PACKET.md` (the go-live atom) and `LIQUID_CAPABILITY_MATRIX.md` (cited by CAP-C08) |
| `CONVERGENCE_AUDIT_2026_06_10/*` | 2026-06-10 @ `c4fc3cd6` | Oldest. "Repository Health 3.1/10, Production Readiness 2.3/10 from `main`". Its "deploy branch `main` is **30 commits behind**" is now 106. Its winner list matches the Constitution |
| `PROMPTS.md` | live registry, 16 rows | Registry is real and `prompt-perimeter-validator` genuinely checks tree-vs-registry — it currently **FAILS** on unregistered `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/` prompt-class files |

**Claimed completion percentages:** I searched all prior-truth directories for `N% complete|ready|done|coverage|green|passing`. **Zero matches.** The programs express state as X/10 scores, GO/NO-GO rows, and seam counts — never a completion percentage. `LETBUYY_CONSTITUTION.md:459` explicitly says "completion-% measures the working tree, not production". **This is a point in the documentation's favour and should be preserved in the final dossier.**

---

## 10. THE TWO-LANE MERGE RULE

`CLAUDE.md:76` instructs "Respect the two-lane merge rule" but **no governance document defines it.** It is not in `MERGE_RUNBOOK.md`, `.github/BRANCH_STRATEGY.md`, `AGENTS.md`, or the Constitution. I searched every `.md` outside `docs/archive/` and `.claude/worktrees/`.

There are **two unrelated things called "lane"** in this repo:

### 10.1 Validator lanes (machine-enforced, unambiguous)

`scripts/validate-governance.mjs:5-13,153` — `--lane=gate|report|all`.
- `gate` (default): the 108 blocking validators. Run by `production-deploy.yml:57`, `deploy-staging.yml:43`, `architecture-governance.yml:55`, `ci.yml:194`.
- `report`: 1 validator (`foundation-stepup-report-validator.mjs`), non-blocking.
- `all`: both.
`scripts/validate-governance.mjs:136-142` hard-fails if any of the 5 `criticalGateValidators` is removed from the gate lane.

### 10.2 The two-lane MERGE rule (convention only — NOT law)

Defined only inside the theme-platform phase docs. The clearest statement is `docs/storefront-theme-platform/phase-q/PHASE_Q_PLAN.md:14-17`:

> Phase Q is split into two lanes to preserve the two-lane merge rule:
> - **Lane A (Gateway):** All backend additions to `services/api-gateway`, `database/supabase/migrations`, `packages/billing-core`, and `packages/typescript/api-client`.
> - **Lane B (Merchant UI):** All frontend additions to `apps/merchant-control-plane`.

Consistent usage across other phase docs:
- `docs/storefront-theme-platform/phase-s/PHASE_S_PLAN.md:16,28` — Lane A = editor (`merchant-control-plane`), Lane B = storefront preview (`storefront-runtime`)
- `docs/storefront-theme-platform/phase-t/PHASE_T_PLAN.md:25,40` — Lane A = `packages/theme-engine`, Lane B = editor
- `docs/storefront-theme-platform/phase-z/PHASE_Z_REPORT.md:23,65` and `phase-y/PHASE_Y_REPORT.md:21,57` — Lane A = engine, Lane B = editor
- `docs/storefront-theme-platform/phase-ab/PHASE_AB_PLAN.md:34,82` — Lane A = engine, "Lane AB" = gateway
- `docs/storefront-theme-platform/phase-ac/PHASE_AC_REPORT.md:18,78` — Lane B = merchant UI

**Operative synthesis for later work packages (state it as convention, not law):**
> **Lane A = the producer/contract side** — `services/api-gateway`, `database/supabase/migrations` (+ rollback), the domain `packages/*` (`theme-engine`, `billing-core`, `commerce-core`, `payments`, …), and `packages/typescript/api-client`.
> **Lane B = the consumer/UI side** — `apps/merchant-control-plane`, `apps/storefront-runtime`, `apps/platform-console`, `apps/mobile/merchant-app`.
> The rule is: split a change so each lane is independently mergeable and independently testable, with Lane A landing first (the consumer cannot reference a contract that does not exist).

**⚠️ The lane assignment is NOT stable across documents.** In `phase-q` Lane A is the gateway; in `phase-t`/`phase-y`/`phase-z` Lane A is `theme-engine` and the gateway is a separate "Lane AB". **Do not cite a lane letter as if it were fixed.** Cite the *path set*.

**Gap:** a rule that `CLAUDE.md` names as binding is defined nowhere in the authority chain and is internally inconsistent where it *is* described. `DOC-R4` ("one source of truth per fact") is breached. Recorded as **G-A-17**.

---

## 11. CONFIRMED GAPS (provisional IDs G-A-nn)

> `[HIGH-STAKES]` = touches money / payments / refunds / gift cards / payouts / settlements / GST / auth / tenancy / RLS.
> No remediation below is a code prescription; all are approaches. **No remediation anywhere recommends a direct money-table write.**

---

### G-A-01 — The 108-validator governance gate is RED; 25 validators fail at HEAD
- **Domain:** Governance / CI
- **Status:** `BROKEN`
- **Impact:** Both `deploy-staging.yml` and `production-deploy.yml` fail at their `governance-gate` job. Nothing can be deployed by the sanctioned path. Every "gate GREEN" statement in the prior-truth corpus is currently false.
- **Evidence:** `scripts/validate-governance.mjs:15-124` (108 validators); RUNTIME_OBSERVATION — 83 PASS / 25 FAIL at HEAD `bf35062e` (full table in §5.2). Committed-tree failures confirmed by `git ls-files`: `package-ownership-validator` (~40 offenders), `typescript-governance-validator`, `provider-isolation-validator`.
- **Expected:** `node scripts/validate-governance.mjs --lane=gate` exits 0 (`R-18`, `LETBUYY_CONSTITUTION.md:419`).
- **Root cause:** Mixed. (a) The LCIS estate (20 packages + 1 service) was added without the AGENTS.md / tsconfig / provider-isolation conformance every other package has. (b) Real merchant-surface regressions (`merchant-domains-settings-validator`, `custom-domain-target-validator`, `platform-domain-literal-validator`, `route-line-count-validator`). (c) The user's uncommitted work (untracked migration 196, modified `themes.ts`, modified `create-store/route.ts`).
- **Blast radius:** All deploys; all merges that would be gated.
- **Invariant:** `[HIGH-STAKES]` — `tenant-isolation-validator` is among the failures.
- **Severity:** **P0** · **Likelihood:** HIGH (observed) · **Reversibility:** reversible
- **Dependencies:** G-A-02 (LCIS classification) is a prerequisite for ~4 of the 25.
- **Remediation approach:** Triage the 25 into (i) LCIS-estate conformance, (ii) genuine merchant-surface regressions, (iii) dirty-worktree artifacts. Fix (ii) first; make an explicit ARB decision on (i) (classify LCIS as tooling and scope the validators to exclude it, **or** bring it to conformance) — do not silence a validator to go green.
- **Acceptance:** `--lane=gate` exits 0 on a clean checkout of the committed tree, with every exclusion recorded in `EXECUTION_LEDGER.md`.
- **Required tests:** re-run all 108 individually; assert 108/108.
- **Owner:** lead engineer + ARB (for the LCIS classification decision)
- **Confidence:** HIGH for the observation; MEDIUM for the tracked-vs-dirty split (worktree is dirty and I may not clean it).

---

### G-A-02 — `services/lcis-api` + 20 `packages/lcis-*` are an undeclared runtime/package estate (591 tracked files)
- **Domain:** Topology / Governance
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** `ARCH-R2` forbids adding a runtime root not in `ARCH-R1` without a Constitution amendment + ARB approval + DOC 03/04 update *before source is created*. No such record exists. It is not deployed (so `R-16` is intact), but it is a real service root with `package.json`, `src/`, tests, and a root `package.json` start script.
- **Evidence:** `services/lcis-api/package.json` (`@letbuyy/lcis-api`, Hono service, 7 workspace deps); `services/lcis-api/src/{app,index,middleware,server}.ts`; `services/lcis-api/test/*.test.ts`; root `package.json:7` `"lcis:api": "tsx services/lcis-api/src/server.ts"`; `pnpm-workspace.yaml:22-40` (20 lcis packages); `git ls-files 'packages/lcis-*' 'services/lcis-api'` = 591 files. **Absent from** `scripts/validators/governance-common.mjs:57-111` (`canonicalAppRoots` / `canonicalServiceRoots` / `reservedServiceRoots` / `frozenAppRoots`), absent from `config/runtime/production-topology.json`, absent from every deploy workflow, no `runtime.manifest.json`.
- **Expected:** every root under `services/` is CANONICAL, RESERVED, or FROZEN, and is classified in `governance-common.mjs` + `production-topology.json`.
- **Root cause:** LCIS grew as internal tooling and was never put through the topology-classification path.
- **Blast radius:** 4 of the 25 gate failures; `ARCH-R2` conformance; any future "what is our topology" answer.
- **Invariant:** none directly
- **Severity:** **P1** · **Likelihood:** HIGH (observed) · **Reversibility:** reversible
- **Remediation approach:** ARB decision to classify the LCIS estate explicitly — most likely as **tooling, not a runtime** (like `tools/graph-server`), which would mean moving `services/lcis-api` out of `services/` or adding an explicit `toolingRoots` category to `governance-common.mjs` and scoping `package-ownership-validator` / `typescript-governance-validator` / `provider-isolation-validator` accordingly. Record the decision in DOC 03.
- **Acceptance:** every `services/*` and `packages/*` root resolves to exactly one declared class; the three validators pass without a blanket suppression.
- **Owner:** ARB
- **Confidence:** HIGH

---

### G-A-03 — CI never runs on `stepup/main`; the canonical integration branch merges without typecheck, build, tests, or Flutter analyze
- **Domain:** CI / Governance
- **Status:** `BROKEN`
- **Impact:** `BRANCH_STRATEGY.md` mandates `feature/*` → PR → `stepup/main`, with required checks `ci / typecheck`, `ci / lint`, `ci / build`, `ci / unit-tests`, `ci / governance`. Those jobs live in `ci.yml`, which triggers only on `develop` (retired) and `main` (nobody pushes there). So a `stepup/main` PR receives **no typecheck, no build, no unit tests, no contract tests, no `flutter analyze`, no `flutter test`**. The `EXECUTION_LEDGER.md` row `V1-COMPLETION-BUILD` is direct proof of the consequence: certification found 4 build-breaking type errors that `next build` would have failed on, including a typo on the **merchant refund-failure handler** (`orders/page.tsx:441`).
- **Evidence:** `.github/workflows/ci.yml:3-11` (`branches: [develop, main]`); `.github/workflows/ci.yml` job names `typecheck, secret-hygiene, lint, unit-tests, merge-safety-gate, governance, mobile-merchant, build`; `.github/BRANCH_STRATEGY.md:25`; `SKIPPED_HUMAN_DECISIONS.md:7` (`SKIP-A3` — branch protection never configured); mitigation: `.github/workflows/architecture-governance.yml:4-30` runs governance + design-system on all PRs (path-filtered, no branch filter).
- **Expected:** the mandated integration branch's PRs run the mandated checks.
- **Missing link:** `ci.yml` `on.pull_request.branches` / `on.push.branches` omit `stepup/main`.
- **Blast radius:** every merge into `stepup/main` since the branch became canonical — i.e. all 106 commits currently ahead of `main`, and everything before.
- **Invariant:** none directly, but it is the mechanism by which money/auth regressions could land unnoticed.
- **Severity:** **P0** · **Likelihood:** HIGH (observed) · **Reversibility:** reversible
- **Remediation approach:** Add `stepup/main` to `ci.yml`'s PR and push branch lists; remove the retired `develop` entries; then configure GitHub branch protection (closes `SKIP-A3`). Re-run the full `merge-safety-gate` once against `stepup/main` to establish a baseline before enforcement.
- **Acceptance:** a test PR into `stepup/main` shows all 8 `ci /` checks reporting; `BRANCH_STRATEGY.md` required-check names match actual job names 1:1.
- **Required tests:** none new; the existing suites just need to run.
- **Owner:** lead engineer (workflow) + repository owner (branch protection)
- **Confidence:** HIGH

---

### G-A-04 — The React-section freeze is directory-scoped and was walked around: `announcementBar` is a new post-freeze React section renderer
- **Domain:** Theme governance (ART-17 / THEME-R2)
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** `ART-17` forbids "Adding new React-per-section capability after the freeze" (`LETBUYY_CONSTITUTION.md:256`); `THEME-R2` says "MUST NOT add new sections to the React renderer once frozen (CI bans new React sections)" (`AGENTS.md:276`). `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md:30-35` recorded LB-8 as **governance-trapped** and offered three options, of which only option (1) (fold into the existing `header` section) avoided a governance change. What shipped is a **standalone renderer** placed outside the frozen directory.
- **Evidence:**
  - `scripts/validators/no-new-react-sections-validator.mjs:9-30` — the frozen set is 20 explicit paths, **all under `apps/storefront-runtime/src/components/sections/`**; `:32-33` — `phaseBEntries(["apps/storefront-runtime/src/components/sections"])` is the only directory scanned.
  - `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:21` — `import AnnouncementBar, { type AnnouncementBarSettings } from '@/components/layout/announcement-bar';`
  - `renderer-registry.tsx:83-85` — registered with its **own** `rendererKey: 'core.announcement-bar'` and `sectionTypes: ['announcementBar','announcement-bar','announcement_bar']`, `schema: schemaFor('announcementBar')`.
  - `apps/storefront-runtime/src/components/layout/announcement-bar.tsx` exists (4740 bytes).
  - `no-new-react-sections-validator.mjs` **PASSES** ("20 frozen React sections checked").
- **Expected:** either the freeze holds (no new React-per-section renderer), or an ARB-signed ART-17 exception is recorded and the validator is updated in lockstep. `HR-LB8-ANNOUNCEMENT-BAR` (`EXECUTABLE_HUMAN_REQUIRED.md:31`) says exactly this: option (b) requires "an explicit ART-17 exception, signed".
- **Missing link:** no ARB record; the validator's scope was never widened to `components/layout/`.
- **Blast radius:** the freeze is now known-bypassable — any future React section placed in `components/layout/` (or any other directory) is invisible to the gate. `DynamicHeader` and `DynamicFooter` are already registered from `components/layout/` (`renderer-registry.tsx:19-20`), so the pattern is established.
- **Invariant:** none (not money/auth), but it is a **governance-integrity** defect of the class `ANTI-R3`.
- **Severity:** **P1** · **Likelihood:** HIGH (observed) · **Reversibility:** reversible
- **Remediation approach:** ARB decides retroactively: (a) accept `announcementBar` as a signed ART-17 exception and record it, or (b) fold it into `header`. Independently, widen `no-new-react-sections-validator` from a directory scan to a **registry scan** — enumerate the renderers registered in `renderer-registry.tsx` and freeze *that* set, so location cannot evade it.
- **Acceptance:** the validator fails if a 21st renderer is registered from anywhere; the ARB record exists.
- **Required tests:** a negative-control fixture adding a renderer from a non-`sections/` directory must fail the validator.
- **Owner:** ARB + lead engineer
- **Confidence:** HIGH on the facts; MEDIUM on intent (this may have been a deliberate, unrecorded option-(a)-adjacent choice — the file is under `layout/` like header/footer, which is arguably "chrome" rather than "a section". The counter-argument is that it has its own `rendererKey` and `sectionTypes`, which is exactly what a section is.)

---

### G-A-05 — `R-23` / `MIG-R3` (every migration ships a paired rollback) is unenforced; 12 migrations ≥138 have no rollback
- **Domain:** Database / Governance
- **Status:** `BROKEN`
- **Impact:** A production migration failure on any of these 18 has no scripted DOWN path. `production-deploy.yml:352-357` runs `supabase db push --include-all` against production after taking a `pg_dump` — so recovery is restore-from-backup, not rollback.
- **Evidence:**
  - `LETBUYY_CONSTITUTION.md:424` (`R-23`): "Every migration MUST ship a paired rollback."
  - `AGENTS.md:157` (`MIG-R3`): "a **rollback-pairing validator gates merge for any migration ≥ 138** (`[validator-gap]`)" — the doc names 3 unpaired migrations (138/140/157).
  - Reality **@23:21**: `database/supabase/migrations/` = **125** files (124 tracked + untracked 196); `database/supabase/rollback/` = **47** files (40 tracked + 7 untracked). Migrations ≥138 with **no** rollback: **138, 140, 157, 170, 175, 179, 182, 183, 184, 186, 187, 194** (**12**). Migrations of any number without a rollback: **78**.
  - **Moving target:** at ~22:58 the same census returned 40 rollbacks / 18 unpaired ≥138. Between 23:07:00 and 23:07:49 a concurrent actor added untracked rollbacks for 180, 181, 188, 189, 190, 191. Because they are **untracked**, `sequential-migration-validator` does not see them as committed and `git ls-files` excludes them — so on the committed tree the unpaired count is still **18**. Report both numbers; do not let the disk state be mistaken for the repository state.
  - `package.json` maps `"validate:rollback": "node scripts/validators/migration-safety-validator.mjs"` — the **same script** as `validate:migrations`. `grep -n rollback scripts/validators/migration-safety-validator.mjs` returns exactly one hit: `:147 "rollbackManifest"` (a config key, not SQL pairing).
  - `scripts/validators/rollback-integrity-validator.mjs` checks **Cloudflare Worker** version rollback (`wrangler rollback --version-id`), `config/runtime/deployment-lineage-manifest.json`, and `infrastructure/deployment/release-promotion.yaml`. It never reads `database/supabase/rollback/`.
  - `grep -l "supabase/rollback" scripts/validators/*.mjs` → only `commission-bps-zero-validator`, `provider-mode-badge-validator`, `session-security-validator` (each referencing one specific rollback file, not pairing).
- **Expected:** a validator that, for every `database/supabase/migrations/NNN_*.sql` at or above the agreed floor, asserts a matching `database/supabase/rollback/NNN_*.rollback.sql`.
- **Missing link:** the `[validator-gap]` flagged in `AGENTS.md:157` was never closed, and the doc's "3 unpaired" figure was never updated as 15 more accumulated.
- **Blast radius:** 12 migrations on disk / 18 on the committed tree, including `170_v1_shipping_rates_gst` (GST) and `194_demo_requests`.
- **Invariant:** `[HIGH-STAKES]` — the unpaired set includes `170_v1_shipping_rates_gst` (GST) and, on the committed tree, RLS-touching theme migrations 188–191.
- **Severity:** **P1** · **Likelihood:** HIGH (observed) · **Reversibility:** irreversible-in-the-moment (a failed production migration without a DOWN)
- **Remediation approach:** (1) commit the 7 untracked rollbacks the concurrent actor authored, then author the remaining 12 (they are DDL inverses; do **not** touch money data); (2) add a real migration↔rollback pairing validator to the gate lane and stop aliasing `validate:rollback` to `migration-safety-validator`; (3) correct `AGENTS.md:157`.
- **Acceptance:** validator exits 0 with 0 unpaired migrations ≥ the agreed floor; `validate:rollback` invokes the new validator.
- **Required tests:** negative-control — add a fixture migration with no rollback; validator must fail.
- **Owner:** lead engineer + database operator; ARB to set the floor (138 vs 000)
- **Confidence:** HIGH

---

### G-A-06 — Shared symmetric secrets span 6 trust domains; `AUTH_SECRET` fallback chains persist despite `SEC-R7` declaring them DEAD
- **Domain:** Identity / Secrets
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** `R-14` (`LETBUYY_CONSTITUTION.md:411`) and `SEC-R7` (`AGENTS.md:233`) forbid a shared symmetric signing secret across trust domains, and specifically name the `|| AUTH_SECRET` fallback as DEAD. In a shared-symmetric design the verification key **is** the forgery key.
- **Evidence:**
  - `production-deploy.yml:404-430` — the `deploy-apps-production` matrix env block is applied to **all five** Vercel apps and sets `AUTH_SECRET`, `CUSTOMER_SESSION_SECRET`, `CSRF_SECRET`, `INTERNAL_API_SECRET` identically (only `LETBUYY_IDENTITY_PRIVATE_JWK` is conditioned on `matrix.app == 'identity-platform'`). `production-deploy.yml:246-249` sets the same `AUTH_SECRET` + `CUSTOMER_SESSION_SECRET` on `api-gateway`. → **6 runtimes, one key.**
  - Buyer realm is issued by the **gateway**, not identity-platform, with a shared symmetric secret: `services/api-gateway/src/routes/storefront/customer-registration.ts:5` ("Issuer model preserved: customer HS256 session via `CUSTOMER_SESSION_SECRET`; no merchant/admin issuer"), `:141-143` (`issueCustomerSession(..., c.env.CUSTOMER_SESSION_SECRET)`); `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts:610-615, 770`; `services/api-gateway/src/middleware/customer-session.ts:58,61`.
  - `AGENTS.md:262` (`IDN-R1`): "`identity-platform` is the SOLE issuer of all identity for **all three realms** (merchant/staff, **buyer/customer**, platform-operator) … MUST NOT mint sessions/tokens anywhere else."
  - Fallback chains still present (each is `SEC-R7`-forbidden shape):
    - `services/webhook-service/src/index.ts:584` — `env.INTERNAL_API_SECRET || env.AUTH_SECRET` (**the exact example `SEC-R7` calls DEAD**)
    - `services/api-gateway/src/routes/checkout.ts:88` — `CHECKOUT_SIGNING_SECRET || AUTH_SECRET || STORE_ACCESS_SIGNING_KEY` **[cart-bound handoff signing — R-11]**
    - `services/api-gateway/src/routes/storefront/cart-routes.ts:307` — same chain
    - `services/api-gateway/src/routes/export.ts:172-175` — `INTERNAL_API_SECRET || CUSTOMER_SESSION_SECRET || AUTH_SECRET`
    - `services/api-gateway/src/routes/media.ts:60` — `MEDIA_UPLOAD_SIGNING_SECRET || AUTH_SECRET`
  - Mitigation that exists: `production-deploy.yml` does set `CHECKOUT_SIGNING_SECRET` and per-service `INTERNAL_API_SECRET`s, so in a fully-provisioned production the fallbacks should not fire. `HR-SECRET-ROTATION` (`EXECUTABLE_HUMAN_REQUIRED.md:24`) records `INTERNAL_AUTH_LEGACY_ACCEPT` **defaults ON**.
  - `identity-sole-issuer-validator`, `single-source-crypto-validator`, `secret-topology-validator`, `session-security-validator` all **PASS** — none catches the customer-HS256 path or the fallback chains.
  - The deviation is **disclosed**, not hidden: `CLAUDE.md:47` describes the two-issuer model as current design, and `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:25` records it as intentional ("customer (HS256, `CUSTOMER_SESSION_SECRET`) vs merchant (ES256) sessions separate"). `SKIP-IDN-R2-DRAIN-TELEMETRY` is the open seam for the merchant-side HS256 drain.
- **Expected:** per `ART-05`/`R-14`/`IDN-R1` — identity-platform issues all three realms asymmetrically; every other runtime is verify-only with the public key; zero shared symmetric signing secrets; zero `|| AUTH_SECRET` fallbacks.
- **Missing link:** the buyer realm was never migrated to identity-platform, and no validator asserts the absence of a symmetric fallback chain.
- **Blast radius:** every storefront customer session; the checkout handoff HMAC (if `CHECKOUT_SIGNING_SECRET` is ever unset); webhook internal auth; CSV export signing; media upload signing.
- **Invariant:** `[HIGH-STAKES]` (auth) and, via `checkout.ts:88` / `cart-routes.ts:307`, adjacent to `[HIGH-STAKES]` money.
- **Severity:** **P1** (would be P0 if `CHECKOUT_SIGNING_SECRET` were unset in production — unverified; `release-preflight` requires `PRODUCTION_CHECKOUT_SIGNING_SECRET`, so it should be set)
- **Likelihood:** MEDIUM for exploitation (requires compromise of one of the 6 runtimes); HIGH for the structural condition (observed)
- **Reversibility:** reversible with a dual-verify drain
- **Dependencies:** H2 (secrets), H5 (rotation), `SKIP-IDN-R2-DRAIN-TELEMETRY`
- **Remediation approach:** (1) Add a validator that **bans `|| env.AUTH_SECRET` and any cross-purpose secret fallback** — this is cheap and closes the named-DEAD pattern. (2) Make `CHECKOUT_SIGNING_SECRET` and `INTERNAL_API_SECRET` hard-required (fail closed) rather than falling back. (3) The buyer-realm HS256→identity-platform migration is a Class-A/ARB decision, not an engineering fix — record it explicitly as an accepted, time-boxed ART-05 deviation with a named trigger, or schedule the migration. Do **not** silently accept it.
- **Acceptance:** no `|| AUTH_SECRET` in any active runtime; validator green; an ARB record exists for the buyer-realm issuer decision either way.
- **Required tests:** unit — signing helpers throw when their dedicated secret is absent; security — a token minted with `AUTH_SECRET` is rejected by the checkout handoff verifier.
- **Owner:** security + ARB
- **Confidence:** HIGH on the code facts; the *severity* rating depends on production secret provisioning I cannot observe (BLOCKED_EXTERNAL).

---

### G-A-07 — Gateway feature flags fail OPEN outside production; a checkout-extensions route is live in staging
- **Domain:** Gateway / Checkout / Security posture
- **Status:** `PARTIAL`
- **Impact:** `SEC-R1` says "Everything fails closed." `R-12`/`ARCH-R9`/`ART-16` say no third-party/extension/Wasm code in the live checkout or storefront path, and that the extension host must be a **seam, not a build**.
- **Evidence:** `services/api-gateway/src/middleware/featureFlags.ts:19-26` — when the env var is unset, `return !isProductionRuntime(env)` → **enabled**. `services/api-gateway/src/index.ts:695-698, 714-716` — `FEATURE_EXTENSIONS` gates `/storefront/:subdomain/checkout/extensions` and two `/app-store/installations/:id/extensions*` routes. `services/api-gateway/wrangler.toml:39-41` and `:130-132` set all three flags `"true"` for staging; `:246-248` set them `"false"` for production. `services/api-gateway/src/routes/ai.ts:1028` documents the fail-open behaviour in a comment. Open ARB seam: `SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB` (`SKIPPED_HUMAN_DECISIONS.md:52`) — "GraphQL/extensions remain dead-by-flag convergence debt and can keep widening the monolith surface".
- **Expected:** default deny; the extension executor removed from the checkout route entirely (ART-16 "removed from the live order/payment path and downgraded to a documented seam").
- **Missing link:** the deletion decision (`SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB`) has never been made, so the code stays and only a flag holds it back.
- **Blast radius:** staging checkout; any non-production runtime that omits the var; the monolith's attack surface.
- **Invariant:** `[HIGH-STAKES]` — the route path is under `checkout`.
- **Severity:** **P2** (production is flag-off) · **Likelihood:** MEDIUM · **Reversibility:** reversible
- **Remediation approach:** Invert the default to fail-closed (unset ⇒ disabled everywhere), then execute the `SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB` decision — prove no production client depends on `/graphql`, then delete or build-exclude both surfaces with their protecting tests retargeted in lockstep (`DEL-R3`).
- **Acceptance:** `isGatewayFeatureEnabled` returns `false` for an unset flag in every environment; a test asserts it; the ARB row is closed.
- **Required tests:** unit — unset flag ⇒ 404 in dev/staging/production alike.
- **Owner:** ARB + lead engineer
- **Confidence:** HIGH

---

### G-A-08 — Three staging workflows exist where ART-03 mandates one
- **Domain:** Deployment
- **Status:** `PARTIAL`
- **Impact:** `LETBUYY_CONSTITUTION.md:160` (ART-03) requires collapsing "the duplicate staging workflows to one"; `AGENTS.md:331` (`DEPLOY-R2`) repeats it.
- **Evidence:** `.github/workflows/deploy-staging.yml` (active, `push: [stepup/main]`, governance-gated), `.github/workflows/staging-deploy.yml` (push disabled by comment at `:3-7`, `workflow_dispatch` retained, still deploys 4 Workers + 5 apps), `.github/workflows/staging-runtime-deployment.yml` (`push: [main, release/**]` + paths).
- **Expected:** one staging lane.
- **Severity:** **P3** · **Likelihood:** LOW · **Reversibility:** reversible
- **Remediation approach:** delete or archive `staging-deploy.yml`; fold `staging-runtime-deployment.yml`'s Cloudflare-primitive step into `deploy-staging.yml` or convert it to dispatch-only with a documented purpose.
- **Owner:** lead engineer
- **Confidence:** HIGH

---

### G-A-09 — `scripts/validate-governance.mjs` destroys local `node_modules` and build output as a side effect
- **Domain:** Tooling
- **Status:** `IMPLEMENTED_NOT_RUNTIME_VERIFIED` (I read the code; I deliberately did **not** execute it)
- **Impact:** Any engineer or agent who runs `pnpm validate:governance` locally loses every `node_modules` under `apps/`, `packages/`, `services/`, plus all `.next`/`.turbo`/`dist`/`.wrangler`/`.vercel`/`build`/`coverage`/`.cache`/`.dart_tool`/`Pods`. In this repo that is a multi-minute-to-multi-hour recovery and, in a dirty worktree, invites destructive follow-on commands.
- **Evidence:** `scripts/validate-governance.mjs:155-168` (`generatedDirectoryNames` set), `:170-186` (`removeGeneratedArtifactDirectories` → `fs.rmSync(absPath, {recursive:true, force:true})`), `:189-192` (called unconditionally when the loop reaches `stale-artifact-validator.mjs`).
- **Expected:** a validator suite is read-only; artifact cleanup is a separate, opt-in command.
- **Severity:** **P2** · **Likelihood:** HIGH (anyone following `MERGE_RUNBOOK.md:28` or `CLAUDE.md:76` will run it) · **Reversibility:** recoverable via `pnpm install`, but expensive and surprising
- **Remediation approach:** gate the cleanup behind an explicit flag (e.g. `--clean`) that CI passes and humans do not, or move it into a separate `pnpm run clean:artifacts` that CI invokes before the gate. Document the hazard in `MERGE_RUNBOOK.md`.
- **Acceptance:** running the gate twice in a row locally leaves `node_modules` intact and still passes in CI.
- **Owner:** lead engineer
- **Confidence:** HIGH (read the code); the *effect* is `UNVERIFIED_RUNTIME` because I did not and will not run it here.

---

### G-A-10 — `services/mobile-bff` is a 1-source-file Worker deployed to production as a "real composite/fan-in BFF"
- **Domain:** Mobile / Topology
- **Status:** `UNVERIFIED_RUNTIME`
- **Impact:** `AGENTS.md:72` declares it "A **real** composite/fan-in BFF (`/v1/dashboard`) for the Flutter app"; `WIN-R7` (`AGENTS.md:149`) says a stub that is the canonical design MUST be completed. It is deployed to staging and production.
- **Evidence:** `services/mobile-bff` — 8 files total, **1** `src/*.ts`, 2 code files, 1 test file; `wrangler.toml` present; in both deploy matrices (`production-deploy.yml:242, 316-330`).
- **Expected:** either it composes, or it is honestly labelled.
- **Severity:** **P2** · **Likelihood:** UNKNOWN · **Confidence:** LOW on impact
- **Remediation approach:** Agent-mobile to trace `/v1/dashboard` and report `BACKEND_ONLY` vs `STUB_OR_MOCK`. Do not act on my file count alone.
- **Owner:** lead engineer
- **Handoff:** Agent-mobile

---

### G-A-11 — `services/queue-workers/AGENTS.md` calls a canonical production runtime "Reserved" and "Incubating"
- **Domain:** Documentation
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Evidence:** `services/queue-workers/AGENTS.md:3` ("**Reserved** background job runtime"), `:9` ("Status: **Incubating**") vs `AGENTS.md:71` (canonical runtime #2) and `production-deploy.yml:242,332-345` (built and `wrangler deploy --env production`).
- **Impact:** an agent reading only the local file could conclude queue-workers must stay empty — the opposite of the truth. The rest of the file's substantive rule ("New queue consumers require explicit retry, dead-letter, tenant, and observability policies before activation") is good and should be kept.
- **Severity:** **P3** · **Confidence:** HIGH
- **Remediation approach:** rewrite the two status lines; keep the consumer-activation rule.
- **Owner:** lead engineer

---

### G-A-12 — No `database/AGENTS.md`
- **Domain:** Governance coverage
- **Status:** `NOT_IMPLEMENTED`
- **Evidence:** `find database -name AGENTS.md` → empty. 46 `AGENTS.md` files exist across `apps/`, `services/`, `packages/`; `database/` (which holds every migration, RLS policy, and SECURITY DEFINER money RPC) has none.
- **Impact:** `AUTH-R1` tells agents to read "the relevant local `AGENTS.md`" before schema decisions; for the highest-stakes subtree in the repo there is nothing to read. The rules exist only in root `AGENTS.md` §4 (`MIG`) and §8/§9 (`SEC`/`PAY`).
- **Severity:** **P2** · **Invariant:** `[HIGH-STAKES]` (money RPCs, RLS)
- **Remediation approach:** author `database/AGENTS.md` restating `MIG-R1..R6`, `R-23` pairing, `PAY-R1/R2/R6`, `SEC-R6/R8/R9`, and the "money mutates only via SECURITY DEFINER RPC" rule, with the rollback-directory convention.
- **Owner:** ARB + database operator
- **Confidence:** HIGH

---

### G-A-13 — Liquid may auto-flip per theme whenever a `liquidBundle` exists, bypassing the ART-17 canary gate
- **Domain:** Theme governance
- **Status:** `UNVERIFIED_RUNTIME`
- **Evidence:** `packages/theme-engine/src/theme-governance.ts:149-159` — the comment states `release_manifest.renderer_engine = 'liquid'` is set by the gateway's `buildReleaseArtifacts` "**whenever the theme has a liquidBundle**", and `:159` returns `true` unconditionally on that signal, **before** any canary check. `ART-17` (`LETBUYY_CONSTITUTION.md:254,256`) requires the flip to be "per-theme + canary, gated on a sanitizer + section ports + a parity/security/perf harness".
- **Mitigations observed:** platform default is `false` (`theme-governance.ts:14`); production `FEATURE_LIQUID="false"` (`wrangler.toml:248`); `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status:'deferred'` and `theme-governance-validator` PASSES.
- **Impact if real:** a merchant publishing a theme with a Liquid bundle silently switches their live storefront renderer with no parity/security/perf gate.
- **Severity:** **P1 if confirmed**, otherwise NA · **Confidence:** LOW (I did not trace `buildReleaseArtifacts`)
- **Handoff:** Agent-theme. Trace `services/api-gateway/src/execution/theme-execution.adapter.ts` (`buildReleaseArtifacts`) and prove whether `renderer_engine` is set unconditionally.

---

### G-A-14 — `operational_feature_flags` table exists with no runtime reader
- **Domain:** Feature flags
- **Status:** `BACKEND_ONLY`
- **Evidence:** `database/supabase/migrations/000_baseline.sql:9987-10006` (table + CHECKs), `:14538,14546` (constraints), `:17647,17654` (indexes), `:20039` (trigger); registered as a tenant table at `services/api-gateway/src/tenant/tenant-tables.registry.ts:1397`. Only non-test reference in code: `packages/lcis-execution/src/rollback/RollbackIntelligenceService.ts:352` (describes it as a rollback lever). No read path found in `apps/` or `services/`.
- **Impact:** `DOC-R3` risk — a DB-only capability that reads as live. Also a candidate `DEL-R5` "dead-looking table" (do **not** DROP without `pg_stat_user_tables` proof).
- **Severity:** **P3** · **Confidence:** MEDIUM (grep-based; a dynamic table name would evade it)
- **Remediation approach:** decide — wire it as the single flag registry (which would also fix the three-flag-system fragmentation), or record it as reserved. Do not drop it without the live-writer probe (`SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`).
- **Owner:** lead engineer

---

### G-A-15 — CODEOWNERS has a single owner for every path, making the mandated "no self-certification" rule unsatisfiable
- **Domain:** Governance / Review
- **Status:** `PARTIAL`
- **Evidence:** `.github/CODEOWNERS` — `* @saai-sidd` plus 20 path rules all resolving to `@saai-sidd`. `LAUNCH_READINESS_2026_06_12/LAUNCH_CERTIFICATION.md:3`: "**No self-certification:** the agent or person who executed a phase may not be its sole certifier; each domain row below names a human sign-off." `LAUNCH_CERTIFICATION.md` §2 names distinct signers (eng / finance / ops / founder) that do not exist as separate GitHub identities. Also: `AGENTS.md` and `CLAUDE.md` are **not** covered by any specific rule; `apps/developer-portal/` has no rule.
- **Impact:** money/auth/tenancy changes get no independent reviewer; the launch GO/NO-GO ceremony cannot be executed as written.
- **Severity:** **P2** (founder-stage reality, but it is a stated launch gate) · **Confidence:** HIGH
- **Remediation approach:** either add real reviewers before the launch gate, or amend `LAUNCH_CERTIFICATION.md` to state the accepted single-owner risk with an ARB record. Add explicit CODEOWNERS rules for `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE_REWRITE_2026_06_10/`.
- **Owner:** founder + ARB

---

### G-A-16 — `CAPABILITY_BACKLOG.md` skips CAP-C13 and CAP-C14 with no supersession note
- **Domain:** Documentation
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Evidence:** `CAPABILITY_BACKLOG.md:18` = CAP-C12, `:19` = CAP-C15. No CAP-C13 / CAP-C14 anywhere in the repo (grep). 16 rows total.
- **Impact:** `DOC-R4` — a reader cannot tell whether two gaps were closed, retired, or lost. `LAUNCH_READINESS_2026_06_12/000_LAUNCH_READINESS_INDEX.md:5` cites "16 gaps", so the count is consistent — but the IDs are not.
- **Severity:** **P3** · **Confidence:** HIGH
- **Remediation approach:** add a one-line retirement note for C13/C14 with the closing evidence, or renumber. Prefer the note (IDs are cited elsewhere).
- **Owner:** lead engineer

---

### G-A-17 — The "two-lane merge rule" is named as binding in `CLAUDE.md` but defined nowhere in the authority chain, and its lane letters are inconsistent
- **Domain:** Governance
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Evidence:** `CLAUDE.md:76` ("Respect the two-lane merge rule"). Not present in `MERGE_RUNBOOK.md`, `.github/BRANCH_STRATEGY.md`, `AGENTS.md`, or `LETBUYY_CONSTITUTION.md`. Only definitions are in phase docs: `docs/storefront-theme-platform/phase-q/PHASE_Q_PLAN.md:14-17` (Lane A = gateway/migrations/packages, Lane B = merchant UI) vs `docs/storefront-theme-platform/phase-t/PHASE_T_PLAN.md:25,40` and `phase-y/PHASE_Y_REPORT.md:21,57` and `phase-z/PHASE_Z_REPORT.md:23,65` (Lane A = `theme-engine`, Lane B = editor) vs `phase-ab/PHASE_AB_PLAN.md:34,82` (Lane A = engine, "Lane AB" = gateway). Also collides namespace-wise with the unrelated `--lane=gate|report|all` validator lanes.
- **Impact:** later work packages that "respect the two-lane rule" will disagree on what the lanes are.
- **Severity:** **P2** (it directly affects how this mission's own work packages get structured) · **Confidence:** HIGH
- **Remediation approach:** promote a single definition into `MERGE_RUNBOOK.md` or `.github/BRANCH_STRATEGY.md`, stated as **path sets** rather than letters (see §10.2 synthesis), and rename the validator flag or the merge rule so "lane" is unambiguous.
- **Owner:** ARB

---

### G-A-18 — Branch-lag meta-blocker (ART-03 / DEPLOY-R1 / R-20) has re-accumulated to 106 commits
- **Domain:** Deployment / Governance
- **Status:** `BROKEN`
- **Impact:** `production-deploy.yml:3-8` triggers on push to `main`. Local `main` = `140a73db`. Everything landed in the last 106 commits — every LB-8/9/10/11/12 fix, the gift-card canonical model, the theme migrations 171–195 — is undeployable via the sanctioned path. `ANTI-R11` names this exact failure mode ("MUST NOT treat working-tree completion as production state").
- **Evidence:** `git rev-list --count main..stepup/main` = **106**; `git rev-parse main` = `140a73db`; `git rev-parse stepup/main` = `bf35062e`. `MERGE_RUNBOOK.md:9` ("Required local invariant: … returns `0`"); `AGENTS.md:330` (`DEPLOY-R1`: "MUST NOT let the lag silently re-accumulate"); `LETBUYY_CONSTITUTION.md:421` (`R-20`). `branch-lag-guard-validator.mjs` **exits 0 locally** and only prints an informational line ("Local working branch is 106 commit(s) ahead of main; CI enforces the live release-branch comparison") — the enforcement path is `LETBUYY_ENFORCE_BRANCH_LAG=1` in the workflow (`production-deploy.yml:37-41`), so the local run does not fail. `origin/develop` still exists at `c2547049` despite `BRANCH_STRATEGY.md:10` retiring it and `HR-B1A` step 4 saying to delete it.
- **Prior history of the same defect:** 30 commits (`CONVERGENCE_AUDIT_2026_06_10/000_CONVERGENCE_INDEX.md`), then 6 (`FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` §CLAIM 2), now 106. **It has never stayed closed.**
- **Missing link:** the guard is CI-only and CI only runs on `main`/`develop` (G-A-03), so nothing on the working branch ever fails on lag. `branch-lag-monitor.yml` runs hourly on a schedule — but only against the default branch, and `SKIP-A5-BRANCH-LAG-MONITOR-LIVE` records that its live activation is unproven.
- **Blast radius:** total — nothing ships.
- **Invariant:** `[HIGH-STAKES]` indirectly (the undeployed commits include money and RLS work).
- **Severity:** **P0** · **Likelihood:** HIGH (observed) · **Reversibility:** reversible (`MERGE_RUNBOOK.md:39-42`, local-only fast-forward)
- **Dependencies:** `MERGE_RUNBOOK.md` pre-condition "`git status --short` is empty" is currently false (6804 entries), so the runbook cannot be executed as written until the worktree is resolved by the owner. **I must not touch the worktree.**
- **Remediation approach:** owner resolves the dirty worktree (commit or preserve), then executes `MERGE_RUNBOOK.md`; separately, make the branch-lag guard fail on the working branch itself (not only in the `main`-triggered production workflow), which requires G-A-03 first.
- **Acceptance:** `git rev-list --count main..stepup/main` = 0 and a CI job on `stepup/main` asserts it.
- **Owner:** repository owner (privileged) + lead engineer
- **Confidence:** HIGH

---

## 12. CONTRADICTIONS I COULD NOT RESOLVE

| # | Contradiction | Why unresolved |
|---|---|---|
| X-1 | Buyer-realm HS256 (`CUSTOMER_SESSION_SECRET`) is simultaneously **forbidden** by `ART-05`/`R-14`/`IDN-R1` and **described as the current design** by `CLAUDE.md:47` and `V1_SCOPE_LOCK_2026_06_12/ACTUAL_STATE.md:25`, with `identity-sole-issuer-validator` passing. The Constitution and the operating context disagree about what is canonical | Resolving it is a Class-A ARB decision (`LETBUYY_CONSTITUTION.md:337`), not a discovery finding. Recorded as G-A-06 with both sides quoted |
| X-2 | `announcementBar` — is it "option (a) fold into chrome" (allowed) or "a 21st React section" (forbidden)? It lives in `components/layout/` like header/footer, but has its own `rendererKey` and `sectionTypes` | Requires the ARB's intent. Recorded as G-A-04 with both readings stated |
| X-3 | Gate validator count: docs say 105 / 106 / 107 / 123; code says 108 | The code is authoritative; but I cannot tell which doc was right at its own commit, so I cannot say whether validators were added or removed. All four are drift **today** |
| X-4 | `origin/main..stepup/main` = 291 per local remote-tracking refs, but `.git/FETCH_HEAD` is dated **Jul 31** and today is Aug 4. Remote reality may differ | I did not fetch (no network mutation, and remote state is not needed for repo-truth). Marked approximate throughout |
| X-5 | Which of the 25 gate failures pre-exist on the committed tree vs are caused by the user's 6784 modified files | Requires a clean checkout, which I must not create. I confirmed the tracked/untracked status of 4 specific offenders and marked the rest UNVERIFIED |
| X-6 | `FINAL_REPOSITORY_TRUTH_CERTIFICATION.md` blocker #1 claims `origin/main` "still ships the `/api/auth/switch` account takeover, a 3% rake, and pre-RLS-hardening leaks" | I did not inspect `origin/main`'s tree. The *lag* is corroborated; the *content* of the deployed tree is UNVERIFIED. Hand to Agent-identity / Agent-payments |

---

## 13. UNKNOWNS (honest)

1. **Whether the committed tree alone passes the gate.** Untestable without a clean checkout. (X-5)
2. **Whether `next build` succeeds for any of the 5 Vercel apps at HEAD.** No CI job runs it on this branch; `EXECUTION_LEDGER.md` row `V1-COMPLETION-BUILD` proves it has broken before, undetected. A later runtime agent must run `pnpm --filter <app> build` directly.
3. **Whether `buildReleaseArtifacts` sets `renderer_engine='liquid'` unconditionally.** (G-A-13)
4. **Whether `services/mobile-bff` actually composes `/v1/dashboard`.** (G-A-10)
5. **Whether `operational_feature_flags` has any live writer.** (G-A-14) — `SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE` is the sanctioned probe.
6. **Whether `PRODUCTION_CHECKOUT_SIGNING_SECRET` is actually provisioned.** `release-preflight` requires it, which is strong evidence it must be, but that is workflow intent, not observed state. Determines whether G-A-06's `checkout.ts:88` fallback is live. BLOCKED_EXTERNAL.
7. **Whether `@saai-sidd` (CODEOWNERS) and `SaaiSiddhu` (git author) are the same GitHub account.**
8. **Whether GitHub branch protection is configured at all.** `SKIP-A3` says no; I cannot query GitHub. BLOCKED_EXTERNAL.
9. **Whether the 20 LCIS packages import anything from `apps/` or `services/`.** `import-validator` and `architecture-validator` both PASS, which is decent evidence they do not, but I did not audit directly.
10. **The commander's stated "187 .sql migration files" does not match my count of 124/125.** I re-counted three ways (`ls *.sql`, `find -type f`, `find -name '*.sql'`) and got 124 consistently before 23:05 and 125 after (196 appeared), with numbering 000 + 073…195 contiguous. Migrations 001–072 are squashed into `000_baseline.sql` (confirmed by `sequential-migration-validator.mjs:6-7`: "The baseline history starts at 000 and resumes at 073; migrations 001-072 are absent by design"). **I believe 124/125 is correct and 187 is an error, but I flag the discrepancy rather than silently overriding the commander.** Note the commander also said "highest numbered 195" and "rollbacks in `database/supabase/rollback/`" — both correct — so only the file count is off.
11. **Who the concurrent actor is.** Files appeared at 23:05–23:07 (migration 196 + 7 rollbacks, all theme/RLS-related). This mission's agents are read-only except for their own notes file. It could be the user working in parallel, another tool, or an editor plugin. **I did not investigate and did not touch any of those files.** Flagged because it means (a) all snapshot counts are unstable, and (b) migration `196_theme_rls_tenant_hardening.sql` is brand-new, untracked, RLS-touching, and unreviewed — Agent-tenancy should read it. `[HIGH-STAKES]`

---

## 14. BLOCKERS FOR THIS AGENT

1. **Cannot run the governance gate wrapper** — it is destructive to the user's worktree (G-A-09). Worked around by invoking all 108 validators individually.
2. **Cannot produce a clean-tree baseline** — the worktree has 6784 user-owned modifications and the mission forbids `git stash/checkout/restore/reset`. Every gate result is therefore worktree-state, not committed-tree state.
3. **Cannot verify remote reality** — no fetch performed; `.git/FETCH_HEAD` is from Jul 31.
4. **Cannot verify production/staging live state** — BLOCKED_EXTERNAL by design (no production contact permitted, and no credentials exist in the repo — correctly so per `R-21`).
5. **Cannot resolve Class-A contradictions** (X-1, X-2) — those are ARB decisions.
6. **A concurrent actor mutated the repository mid-audit** (23:05–23:07). Every count is a timestamped snapshot, not a stable fact. See the warning banner at the top and Unknown #11.

---

## 15. GROUND-TRUTH REFERENCE TABLE FOR OTHER AGENTS

Reuse these; do not re-derive.

| Fact | Value | How I got it |
|---|---|---|
| HEAD | `bf35062e` on `stepup/main` | `git rev-parse` |
| local `main` | `140a73db` — **106 behind** | `git rev-list --count main..stepup/main` |
| `origin/main` / `origin/stepup/main` / `origin/develop` | `c2547049` / `75305725` / `c2547049` (stale, fetched Jul 31) | `git rev-parse` |
| Worktree | 6784 modified, 20 untracked | `git status --porcelain` |
| Gate-lane validators | **108** (+1 report lane); 112 `.mjs` files in `scripts/validators/` | `scripts/validate-governance.mjs:15-124` |
| Gate result at HEAD | **83 PASS / 25 FAIL** | individual runs |
| Migration files | **@23:21: 125** on disk = 124 tracked (`000_baseline` + 073…195 contiguous; 001–072 squashed) + 1 untracked (196) | `ls database/supabase/migrations/*.sql` |
| Highest migration | tracked `195_contact_requests.sql`; **untracked `196_theme_rls_tenant_hardening.sql`** (written 23:05:18 by a concurrent actor) | ls + `sequential-migration-validator` |
| Rollback files | **@23:21: 47** on disk (40 tracked + 7 untracked). Unpaired: **78** total / **12** at ≥138 **on disk**; **84** total / **18** at ≥138 **on the committed tree** | `ls database/supabase/rollback/`, `git ls-files --others` |
| Canonical runtime roots (machine list) | **10** = 6 apps + 4 services | `scripts/validators/governance-common.mjs:57-116` |
| Production deploy targets | **9** = 4 Workers + 5 Vercel apps | `production-deploy.yml:242,392-402` |
| Reserved roots | 6 services + 2 mobile — **all exactly 2 files (manifest + AGENTS.md)** | directory listing |
| Frozen apps | 4 — excluded from `build`/`lint`/`typecheck` and every deploy matrix | `package.json:11,12,67` |
| `merchant-control-plane` | **77** `page.tsx`, **130** `api/**/route.ts` (all `route.ts` are under `api/`) | find |
| `storefront-runtime` | **28** `page.tsx`, **23** `api/**/route.ts` | find |
| `platform-console` | **24** `page.tsx` | find |
| `identity-platform` | **10** `page.tsx` | find |
| `api-gateway` routes | **67** top-level `.ts`, **97** including subdirectories | ls / find |
| `mobile/merchant-app` | **157** `.dart` files | find |
| `getSupabaseAdmin` | **121 files / 1028 references** (CLAUDE.md says 115 files) | grep |
| `SKIPPED_HUMAN_DECISIONS.md` | **60 rows**, 60 unique SKIP-IDs, **0 marked RESOLVED** | grep |
| `CAPABILITY_BACKLOG.md` | **16 rows**: CAP-C01…C12, C15…C18 (C13/C14 absent) | grep |
| `EXECUTABLE_HUMAN_REQUIRED.md` | **27 HR rows** | read |
| `EXECUTION_LEDGER.md` | **246 rows** | grep |
| Local `AGENTS.md` files | **46** under apps/services/packages; **none** under `database/` | find |
| `tests/` subdirectories | 27 (listed in §3.4) | ls |
| Liquid default | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`theme-engine/src/theme-governance.ts:14`); prod `FEATURE_LIQUID="false"` (`wrangler.toml:248`) | read |
| Gateway flag default | **fail-OPEN** outside production (`featureFlags.ts:25`) | read |

---

*End of Agent A notes. Written to the single permitted file. No other file in the repository was created, modified, or deleted; no git state-changing command, no package install, no migration, no deploy, and no network mutation was performed. No secret value, credential, connection string, or PII appears anywhere above — environment variable NAMES only.*

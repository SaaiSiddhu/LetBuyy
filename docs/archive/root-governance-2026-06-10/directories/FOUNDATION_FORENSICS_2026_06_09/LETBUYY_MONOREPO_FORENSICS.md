# LetBuyy Monorepo Forensics
**Forensic due-diligence — Phase B (Monorepo / Package-Graph Governance)**
**Date:** 2026-06-09 · **Mode:** READ-ONLY · **Method:** Trust manifests, import graph, build config — not status docs.
**Scope root:** `/Users/saai_sidd/Git/Letbuyy_Store`

---

## Executive Summary

On the dimensions a monorepo is normally judged — **package boundaries, dependency-graph acyclicity, app isolation, build-graph correctness** — LetBuyy is **genuinely well-governed.** App→app coupling is zero. No package imports an app. Apps reach the backend through a gateway proxy and never touch Supabase directly. The dependency graph is acyclic and the validators that prove this (`circular-import-validator`, `package-export-validator`, `undeclared-import-validator`) are **real**: they parse imports, resolve workspace aliases, build the graph, and walk it. The `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.workspace.json` triad is internally consistent and covers all 45 workspace packages.

But the governance apparatus is **wildly over-scaled relative to what it protects, and most of it is theater.** Of 177 validators in `scripts/validators/`, only ~8 do real code-graph analysis. **81 (46%) "prove" invariants by string-matching that a function *name* appears in a source file** (`source.includes("simulateSplitBrain")`). **57 read JSON manifests that self-declare `"mode": "governance-contract-not-live-evidence"`** and assert string-equality on policy fields. The flagship `architecture-validator` largely checks that ~40 governance `.md` files *exist*. This is **invariant-cosplay**: a CI gate that can be green while the runtime behavior it claims to guarantee does not exist (and, per the manifests' own admission, "is not live operational evidence").

A second structural problem: **the dead distributed-runtime tower is a first-class TS project reference** (`tsconfig.workspace.json` lines for `distributed-runtime`, `projection-runtime`, `runtime-composition`). It is type-checked and built on every CI run despite being imported by zero product code — **maintained dead weight that inflates build time and onboarding surface.**

**Monorepo Governance Score: 48/100** — excellent boundary hygiene, undermined by a validator suite that is mostly decorative and a large, actively-built dead stratum.

---

## 1. Package Graph

### 1.1 Inventory
45 workspace packages (`find apps services packages -name package.json` excl. node_modules): 10 apps, 10 service roots (4 real + 6 empty), 27 TS packages, 4 Dart packages.

### 1.2 External-consumption ranking (apps+services, excl. self/tests)

| Importers | Package | Tier |
|---|---|---|
| 121 | `shared-types` | hub |
| 63 | `theme-engine` | hub (real, 5,162 LOC) |
| 56 | `auth-core` | hub (the live identity lib) |
| 53 | `infrastructure` | hub (Supabase/queue adapters) |
| 44 | `tenant-core` | core |
| 31 | `commerce-core` | core |
| 23 | `checkout-core` | core |
| 20 | `cms-core`, `billing-core` | core |
| 19 | `app-engine` | core |
| 14 | `identity-core`, `orchestration` | mixed |
| 12 | `application-services` | descriptor hub |
| 9 | `payments` | thin (1 route consumer) |
| 7 | `notification-core` | core |
| 6 | `extension-host` | core |
| 3 | `session-core`, `permission-core`, `audit-core`, `runtime-composition` | **dead/internal** |
| 2 | `token-core`, `organization-core`, `search-core` | **dead/internal** |
| 1 | `projection-runtime` | **dead** |
| 15 | `distributed-runtime` | **dead** (all 15 importers are siblings/validators) |
| 0 | `dart` | Dart-only (N/A) |

> The bottom of this table is the monorepo's debt: a cluster of packages whose only consumers are each other or a dead subsystem.

### 1.3 Dead-package cluster (the identity microkernel)
`token-core`, `session-core`, `permission-core`, `organization-core`, `audit-core` are imported **only** by `services/api-gateway/src/identity-foundation/*`, and that directory's `index.ts` is **imported by nothing reachable** from the gateway entrypoint. These 5 packages + the 18-file `identity-foundation` island + `distributed-runtime` + `projection-runtime` constitute **~10K+ LOC of compiled, validated, dead workspace code.**

---

## 2. Dependency Graph (Import Graph)

### 2.1 Acyclicity — verified, not just claimed
`circular-import-validator.mjs` is a **real** graph validator: it loads tracked + workspace files (`getTrackedFiles`/`listWorkspaceFiles`), maps package names→roots, resolves both relative (`resolveRelativeImport`) and aliased (`resolveAliasImport`) specifiers to tracked targets, and reduces to root-level edges to detect cycles (20 real graph operations in the file). The "52 governed roots / 162 edges / acyclic" claim is **trustworthy** — and coverage is NOT a gap: `governance-common.mjs:107-150` defines governed roots as `canonicalRuntimeRoots` (all apps + all services) ∪ `workspacePackageRoots` (all 27 TS + 4 Dart packages). **The full 45-package workspace is in scope.**

### 2.2 Dependency leaks — guarded by real validators
`undeclared-import-validator.mjs` and `package-export-validator.mjs` both use `extractSpecifiers` + `trackedTargetForResolvedImport` to verify that every imported workspace package is declared in `package.json` and exported via the package's `exports` map. These are legitimate. (Spot-check: `application-services/package.json` declares all 12 of its `@letbuyy/*` deps incl. `orchestration`.)

### 2.3 The one ugly edge
`application-services` declares `@letbuyy/orchestration` as a dependency, and `orchestration` depends transitively on `distributed-runtime`. So **every gateway adapter that imports `application-services` (12 files) drags the dead 7,303-LOC tower into its build closure** — even though it only uses identity-function descriptors. The dead weight is not isolated; it is in the critical build path of the live backend.

---

## 3. Build Graph

### 3.1 `turbo.json`
Minimal and correct in shape: `build` `dependsOn: ["^typecheck","^build"]`; `typecheck dependsOn ["^build"]`; outputs `.next/**`, `dist/**`, `build/**`. Topological build via workspace deps. No per-package overrides — every package builds the same way.

### 3.2 `tsconfig.workspace.json` — the dead tower is a first-class citizen
The project-references list includes **`distributed-runtime`, `projection-runtime`, `runtime-composition`, `application-services`** alongside live packages. Consequence: **`tsc -b` type-checks and emits the entire dead tower on every CI run.** This is the build-graph manifestation of the architecture problem — the cathedral is not merely unused, it is **continuously rebuilt and maintained.**

### 3.3 `tsconfig.base.json`
Sane strict baseline (`strict:true`, `moduleResolution:"bundler"`, `isolatedModules:true`). No complaints.

---

## 4. App-Boundary & Package-Ownership Forensics

| Invariant | Result | Evidence |
|---|---|---|
| App imports another app's internals? | **NONE** | `grep` for `apps/*/src` cross-imports and `@letbuyy/<appname>` in `apps/` → empty |
| Package imports an app? | **NONE** | `grep "apps/" packages/**/*.ts` → empty |
| App hits Supabase directly (bypassing gateway)? | **NONE** | 0 `createClient`/`@supabase/supabase-js` in `apps/{storefront-runtime,merchant-control-plane}/src` |
| Apps share libs appropriately? | **YES** | All consume `@letbuyy/auth-core` only for session-cookie verify (`merchant-control-plane/src/proxy.ts:2`) |
| Shared-package abuse (god package)? | **MILD** | `shared-types` (121) and `infrastructure` (53) are legitimate hubs; no evidence of a dumping-ground god module |

**This is the strongest part of the repository.** Boundary discipline is real and enforceable. A $100M acquirer's integration team would find the app/service/package separation honest and navigable.

---

## 5. Are the 177 Validators Real Invariants or Theater?

I sampled across categories and classified the whole suite programmatically.

### 5.1 Quantified breakdown
- **177** validators in `scripts/validators/*.mjs`.
- **81** assert correctness via `source.includes(<fragment>)` — i.e. **grep that a function *name-string* exists in a file**, never executing it. (e.g. `convergence-proof-validator.mjs:34-42`, `split-brain-validator.mjs:31-39`.)
- **57** read `config/runtime/*contract*.json` manifests that **self-declare** `"mode": "governance-contract-not-live-evidence"` and `"evidencePolicy": "governance-drills-are-not-live-operational-evidence"` (`config/runtime/durable-execution-contract.json:4,266`), then assert string-equality on policy fields.
- **~8** do real import/code-graph parsing (the dependency family).
- The master `architecture-validator.mjs` checks that **~40 `docs/governance/*.md` files exist** (`architecture-validator.mjs:18-55`) — existence-theater, not behavior.

### 5.2 Eight-validator deep sample

| Validator | Category | Real or theater? | Why |
|---|---|---|---|
| `circular-import-validator` | dependency | **REAL** | Builds + walks import graph (`extractSpecifiers`, cycle detection) |
| `package-export-validator` | dependency | **REAL** | Verifies imports resolve to declared `exports` |
| `undeclared-import-validator` | dependency | **REAL** | Cross-checks imports vs `package.json` deps |
| `architecture-validator` | topology | **MOSTLY THEATER** | Primarily asserts governance `.md` files exist |
| `convergence-proof-validator` | distributed | **THEATER** | Asserts manifest strings + `source.includes("compileConvergenceProof")`; manifest self-declares "not live" |
| `split-brain-validator` | distributed | **THEATER** | Same pattern; `source.includes("simulateSplitBrain")` |
| `distributed-runtime-validator` | distributed | **THEATER** | Validates a package imported by no product code |
| `convergence-math-validator` (family) | distributed | **THEATER** | String-equality on policy fields of a "not-live" contract |

### 5.3 Verdict
The validator suite is **bimodal**. The ~8 dependency/import-graph validators enforce **genuine, valuable invariants** (acyclicity, declared deps, export integrity) and are why the package graph is trustworthy. The remaining ~160+ — the entire distributed-execution / replay / projection / durable-execution / certification galaxy — are **governance theater**: they assert that strings match other strings and that named functions exist in files, for a subsystem (`distributed-runtime`) that executes in **zero** production paths and whose own config files admit they are not live evidence. A green `validate:governance` run **proves the contracts are internally consistent; it proves nothing about runtime survivability.** Presenting these as production-readiness gates would be misrepresentation.

---

## 6. Scored Section — Monorepo Governance

| Dimension | Score | Justification |
|---|---|---|
| **Workspace config consistency** | 9/10 | `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.workspace.json` aligned; cover all 45 packages |
| **Dependency-graph acyclicity** | 9/10 | Genuinely acyclic, verified by a real validator with full coverage |
| **App-boundary isolation** | 9/10 | Zero app↔app coupling; no package→app; apps proxy to gateway |
| **Dependency-leak protection** | 8/10 | Real undeclared-import + export validators |
| **Dead-package hygiene** | 3/10 | ~10K LOC dead (distributed-runtime, projection-runtime, 5 identity packages, IF island) still built |
| **Build-graph leanness** | 4/10 | Dead tower is a first-class project reference; rebuilt every CI run; in the gateway's build closure |
| **Validator integrity** | 3/10 | ~8 real, ~160 theater; 46% are name-string grep; 57 validate self-declared-"not-live" manifests |
| **Governance honesty** | 2/10 | The suite's scale implies battle-tested distributed infra; the code is unwired simulation |
| **Duplicate/shadow packages** | 5/10 | No duplicate *packages*, but a dead shadow identity subsystem (`identity-foundation` + 5 core pkgs) |

**Composite Monorepo Governance Score: 48/100.**

> One-line verdict: *Textbook package-boundary and dependency-graph hygiene wrapped in a 177-script validator suite that is ~95% decorative and actively rebuilds ~10K LOC of dead distributed-systems code.*

---

## 7. Recommendations (for the acquirer's first 90 days)

1. **Delete or quarantine the dead tower.** `distributed-runtime`, `projection-runtime`, the `identity-foundation` island, and `{token,session,permission,organization,audit}-core` are imported by no product path. Removing them from `tsconfig.workspace.json` and the workspace would cut build time and ~10K LOC of liability with zero runtime impact. (Verify nothing in `queue-workers` regresses — it's the only place `runtime-composition.plan*` runs.)
2. **Reclassify the validator suite.** Keep the ~8 dependency/import validators as CI gates. Demote the ~160 distributed-execution validators to a clearly-labeled "design-contract lint" tier so no one mistakes a green run for production-readiness. The manifests already admit `"not-live"` — surface that.
3. **Collapse the identity triplet.** Pick one: the live `auth-core` path or the `identity-foundation` scaffold. Today both exist; the scaffold is dead but maintained, and the OIDC app ships endpoints that are off by default. This is a security-surface and audit risk, not just tech debt.
4. **Truth-in-topology for the 6 paper services.** Either implement them or stop shipping `runtime.manifest.json` files that imply deployable microservices. The real topology is *one gateway monolith + 3 helper services*.
5. **Right-size GraphQL claims.** It's a REST shim, not a query engine. Fine to keep; don't market it as Shopify-grade GraphQL.

---

## Appendix — Evidence Index (file:line)

- Workspace coverage: `scripts/validators/governance-common.mjs:107-150` (governed roots = all apps+services+packages)
- Real import-graph validator: `scripts/validators/circular-import-validator.mjs:1-40`
- Real export validator: `scripts/validators/package-export-validator.mjs:1-30`
- Theater (name-grep): `scripts/validators/split-brain-validator.mjs:31-39`; `convergence-proof-validator.mjs:34-42`
- Self-declared "not live": `config/runtime/durable-execution-contract.json:4,266`
- Doc-existence theater: `scripts/validators/architecture-validator.mjs:18-55`
- Dead tower is a TS project ref: `tsconfig.workspace.json` (`distributed-runtime`, `projection-runtime`, `runtime-composition`)
- Dead tower in live build closure: `packages/application-services/package.json` → depends on `@letbuyy/orchestration` → `@letbuyy/distributed-runtime`
- Clean app boundaries: 0 cross-app imports; 0 package→app; 0 `createClient` in app `src/`
- Validator counts: 177 total; 81 `source.includes`; 57 contract-manifest; ~8 import-graph (programmatic grep over `scripts/validators/*.mjs`)

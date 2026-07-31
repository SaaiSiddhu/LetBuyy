# EAOS State Machine Discovery

**Phase 8 — Execution Agent Orchestration System**
**Date:** 2026-06-21 | **Status:** DISCOVERY ONLY — no code written

---

## What EAOS Is

A read-only execution-tracking layer over EINS (`packages/lcis-engineering`). EAOS observes planned work; it never executes, generates code, or mutates state. There is **NO live execution-tracking store** in this repo.

---

## State Models

### `ExecutionStatus`

| State | Derivable? | Source |
|---|---|---|
| `PLANNED` | **CONNECTED** | Every `EngineeringTask` in `EngineeringPackage.tasks` is PLANNED at graph-build time |
| `READY` | **CONNECTED** | `EngineeringGraph.parallelizable` — tasks with `indegree=0` and no unmet external deps (Kahn's algorithm in `EngineeringGraphService`) |
| `BLOCKED` | **CONNECTED** | `EngineeringGraph.blocked` — tasks whose `dependsOn` reference an id outside the task set, or are in a cycle |
| `RUNNING` | **NOT_CONNECTED** | Requires live execution store / CI run-state |
| `WAITING` | **NOT_CONNECTED** | Requires live agent/CI poll signal |
| `REVIEW` | **NOT_CONNECTED** | Requires PR/review-system event |
| `VERIFIED` | **NOT_CONNECTED** | Requires CI gate result (though `ComplianceStatus` from `lcis-governance` gives a structural COMPLIANT/VIOLATED for static gates — see nuance below) |
| `COMPLETED` | **NOT_CONNECTED** | Requires git/fs artifact presence |
| `FAILED` | **NOT_CONNECTED** | Requires CI/execution failure event |
| `CANCELLED` | **NOT_CONNECTED** | Requires human/agent cancellation signal |

**Derivable-initial-state algorithm:** `PLANNED` → promote to `READY` if `!EngineeringGraph.blocked.includes(id) && graph.parallelizable.includes(id)`; else `BLOCKED`. All other transitions require a live execution store.

**Nuance — static gate VERIFIED:** `lcis-governance` `ComplianceStatus` (`COMPLIANT | VIOLATED | PARTIAL | UNKNOWN`) and readiness `verdict` (`PASS | WARN | FAIL | UNKNOWN`) are CONNECTED for static/structural gates (e.g. validator-gate findings derivable from the code graph). These map to a structural `VERIFIED` sub-state, distinct from a live CI `VERIFIED`. EAOS must distinguish `VERIFIED_STRUCTURAL` (CONNECTED) vs `VERIFIED_LIVE` (NOT_CONNECTED — needs CI run).

---

### `AgentStatus`

| State | Derivable? | Source |
|---|---|---|
| `ASSIGNED` | **CONNECTED** | `AgentTask.agentType` in `AgentPlan.tasks` — the planned assignment is structural |
| `WORKING` | **NOT_CONNECTED** | Requires live agent execution signal |
| `WAITING` | **NOT_CONNECTED** | Requires live dependency poll |
| `BLOCKED` | **NOT_CONNECTED** | Requires live blocking event (structurally `AgentTask.dependsOn` signals potential blocking but not live state) |
| `FINISHED` | **NOT_CONNECTED** | Requires agent completion event / artifact presence |

---

### `ArtifactStatus`

| State | Derivable? | Source |
|---|---|---|
| `PLANNED` (artifact existence) | **CONNECTED** | `EngineeringTask.layer` implies the artifact type (migration file, rpc, route, ui component, test, docs) |
| `CREATED` | **NOT_CONNECTED** | Requires fs/git probe |
| `UPDATED` | **NOT_CONNECTED** | Requires git diff/commit event |
| `VERIFIED` | **NOT_CONNECTED** | Requires CI gate result |
| `REJECTED` | **NOT_CONNECTED** | Requires review/CI rejection event |
| `ACCEPTED` | **NOT_CONNECTED** | Requires merge/approval event |

---

### `ValidationStatus`

| State | Derivable? | Source |
|---|---|---|
| `PENDING` | **CONNECTED** | `EngineeringTask.gate` + `EngineeringMilestone.gate` declare the planned validation gate — existence is structural |
| `RUNNING` | **NOT_CONNECTED** | Requires live CI run signal |
| `PASSED` (structural) | **CONNECTED** — nuanced | `lcis-governance` `ComplianceReport` gives COMPLIANT/PASS for static gates (107-validator-gate, design-system-ratchet, canonical-ledger-only-validator, etc.) — a structural PASSED is derivable without CI |
| `PASSED` (live) | **NOT_CONNECTED** | Requires CI execution result for runtime/integration gates |
| `FAILED` (structural) | **CONNECTED** — nuanced | `lcis-governance` finding `VIOLATED` / verdict `FAIL` is a structural FAILED for static gates |
| `FAILED` (live) | **NOT_CONNECTED** | Requires CI failure event |

---

## Existing Enums EAOS Should Reuse

| Type | Package | Location |
|---|---|---|
| `OperationalStatus` (`CONNECTED \| PARTIAL \| NOT_CONNECTED \| UNKNOWN \| NOT_DETECTABLE`) | `lcis-operations` | `src/shared/types.ts:22` — the connectivity/honesty discriminant |
| `ComplianceStatus` (`COMPLIANT \| VIOLATED \| PARTIAL \| UNKNOWN`) | `lcis-governance` | `src/shared/types.ts:68` — maps to structural ValidationStatus |
| Readiness `verdict` (`PASS \| WARN \| FAIL \| UNKNOWN`) | `lcis-governance` | `src/shared/types.ts:179` — maps to structural gate outcome |
| `EngineeringGraph.parallelizable` / `.blocked` | `lcis-engineering` | `EngineeringGraphService.ts` — the CONNECTED derivation source for READY/BLOCKED |

---

## Honesty Contract

Every EAOS state output must carry:
- `connectivity: OperationalStatus` — `CONNECTED` for structurally-derivable states; `NOT_CONNECTED` + `requiredSource` (e.g. `"execution-store"`, `"CI_RUN_ID"`, `"git-probe"`) for live states.
- No fabricated run-state. If the execution store is absent, EAOS surfaces `PLANNED/READY/BLOCKED` only and reports all live states as `NOT_CONNECTED`.

---

## Source Files Verified

- `packages/lcis-engineering/src/graph/EngineeringGraphService.ts` — Kahn sort, `parallelizable`, `blocked` computation
- `packages/lcis-engineering/src/shared/types.ts` — `EngineeringTask`, `AgentTask`, `AgentPlan`, `EngineeringGraph`
- `packages/lcis-governance/src/shared/types.ts` — `ComplianceStatus`, readiness `verdict`
- `packages/lcis-operations/src/shared/types.ts` — `OperationalStatus`, NOT_CONNECTED contract

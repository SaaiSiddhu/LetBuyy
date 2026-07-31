# EINS Architecture — Engineering Intelligence System (LCIS Phase 7)

EINS answers one question: **what exactly must be changed to safely implement a feature?**

It does not generate code, run migrations, execute anything, or call external services. It is a
read-only, deterministic synthesis layer that COMPOSES the four prior LCIS systems and returns a
fully provenance-stamped plan.

---

## Stack position

```
┌─────────────────────────────────────────────────────────────────────┐
│  EINS  (packages/lcis-engineering)  — LCIS Phase 7                 │
│  "plan never execute, compose never duplicate"                      │
├────────────┬────────────────┬───────────────┬───────────────────────┤
│ lcis-core  │ lcis-execution │ lcis-governance│ lcis-operations       │
│ (graph/    │ (EisEngine:    │ (ownership/    │ (ops report,         │
│  evidence/ │  analyze/      │  compliance/   │  runtime/commerce)   │
│  store)    │  migration/    │  security/     │                      │
│            │  testing/      │  readiness)    │                      │
│            │  verification/ │                │                      │
│            │  execution/    │                │                      │
│            │  launch/       │                │                      │
│            │  rollback)     │                │                      │
└────────────┴────────────────┴───────────────┴───────────────────────┘
         ▲            ▲               ▲                ▲
  EINS composes all four — never re-implements their logic
```

---

## The two governing principles

**Plan never execute.** EINS produces plans and findings. It never runs a migration, writes a file,
calls a network endpoint, spawns a process, or executes code of any kind.

**Compose never duplicate.** Every plan that EINS returns is either borrowed verbatim from a prior
engine (e.g. `MigrationPlan` from lcis-execution) or normalized from one (e.g. `EngineeringImpact`
from `eis.analyze`). The composition provenance is always visible in the `evidence` array via
`ev.reuse(system, method, detail)`.

---

## The foundation (`src/shared/`)

Six immutable primitives underpin every EINS service:

| Module | What it does |
|---|---|
| `types.ts` | The FROZEN type vocabulary: `EngineeringImpact`, `EngineeringTask`, `AgentTask`, `AgentPlan`, `EngineeringGraph`, `EngineeringBlueprint`, `EngineeringPackage`, `EngineeringFinding`, `EngineeringVerdict`. |
| `rules.ts` | `EngineeringRuleRegistry` — the 8 construction gates E001–E008, each mapped to a governance rule (R001–R008) and an `EngineeringLayer`. |
| `evidence.ts` | `EngineeringEvidenceBuilder` — typed constructors; the key one is `ev.reuse(system, method, detail)` which cites the exact prior-system call. |
| `confidence.ts` | `EngineeringConfidenceCalculator` — `fromEvidence` (base + 0.05 per evidence item, cap 0.9), `fromComposed` (mean of prior plans' confidences, cap 0.9). Never claims certainty. |
| `severity.ts` | `EngineeringSeverityScorer` — `forFeature({ money, tenant })`. |
| `envelope.ts` | `engineering<T>(body, opts)` — stamps every EINS output with `evidence / confidence / sources / timestamp`. Confidence = 0 when evidence is empty. |

---

## The eight services

All services share the same constructor shape: `(core: LcisEngine, now: () => string)`. All are
read-only and deterministic under a fixed clock.

### FeatureIntelligenceService (`src/feature/`)
Maps `FeatureRequest → EngineeringImpact` by calling `eis.analyze(req)` from lcis-execution, then
normalising the `ChangeAnalysis` into the EINS vocabulary. Sets `unresolved: true` and returns
empty sets when `analysis.unresolved` — no fabrication. Confidence from `conf.fromComposed`.

### ChangeIntelligenceService (`src/change/`)
Calls `eis.analyze(req)`, then walks `affected.{tables, rpcs, apis, domains, workers, queues}` and
fires one or more `EngineeringFinding` per triggered gate. Each finding cites `ev.reuse('lcis-execution', 'eis.analyze', ...)` as mandatory composition provenance plus entity-specific evidence. Also
exposes `changeByLayer(req)` which groups findings by the rule's `layer`. Returns `[]` when
unresolved.

### MigrationIntelligenceService (`src/migration/`)
`planMigration(req)` — delegates verbatim to `eis.migration.analyzeMigration(req)`. No re-implementation.
`migrationGates(req)` — applies three engineering gates over that plan: E002 (data-loss), blockers
(`readiness.ready === false`), and E006 (irreversible steps).

### VerificationIntelligenceService (`src/verification/`)
`planTests` → delegates to `eis.testing.generateTestPlan`.
`planVerification` → delegates to `eis.verification.buildVerificationPlan`.
`coverageGaps` → calls `eis.testing.detectMissingCoverage`, maps each `CoverageGap` to an
`EngineeringFinding` with `rule='E005'`.
`acceptanceCriteria` → combines `TestPlan.acceptancePlan` targets, `VerificationPlan.preMergeGates`,
and `VerificationPlan.checks` into a deduplicated `string[]`.

### LaunchIntelligenceService (`src/launch/`)
`planLaunch(req)` — calls `eis.launch.evaluateLaunch(req)` + `ops.operationsReport()`.
`launchBlockers(req)` — extracts blockers from the launch plan as `EngineeringFinding[]`.

### RollbackIntelligenceService (`src/rollback/`)
`planRollback(req)` — delegates to `eis.rollback` (lcis-execution).
`rollbackBlockers(req)` — returns rollback blockers as `EngineeringFinding[]`.

### TaskIntelligenceService (`src/task/`)
Net-new EINS synthesis. Calls `eis.analyze(req)` + `eis.migration.analyzeMigration`, then emits one
`EngineeringTask` per affected entity following the canonical LetBuyy build order:

```
migration(10) → rpc(20) → gateway(30) → proxy(40) → ui(50)
  → worker(60) → queue(65) → event(70) → test(80)
  → docs(90) → verification(100) → launch(110)
```

Priority numbers are the sort key. Each task carries its `gate` (the authoritative validator name),
`agentType`, and `dependsOn` task ids. Returns `[]` when unresolved.

### AgentIntelligenceService (`src/agent/`)
Net-new EINS synthesis. Maps `EngineeringTask[] → AgentPlan` (1:1 correspondence). Each `AgentTask`
carries `taskRef`, `inputs` (domain / layer / gate), `acceptance` (gate assertion + layer criterion),
and `dependsOn` resolved to `agent:<taskId>` ids. Never executes tasks.

---

## EngineeringGraphService (`src/graph/`)

Net-new EINS synthesis. Builds the `EngineeringGraph` from the ordered `EngineeringTask[]` via:

- **Kahn topological sort** (deterministic tie-break: priority then id)
- **Longest-path DP** → `depth` per node + `criticalPath` reconstruction
- **Parallelizable** = nodes with depth 0 (no inbound deps in the batch)
- **Blocked** = tasks whose deps are outside the batch, or in a cycle
- **6 milestones** (M1 Schema → M2 Backend → M3 Async → M4 UI → M5 Test/Verify → M6 Docs/Launch),
  each with a gate name

---

## EngineeringEngine facade (`src/engine.ts`)

`createEngineeringEngine(opts?)` / `getEngineeringEngine()` (process-wide singleton).

Public API:

| Method | Returns |
|---|---|
| `analyzeFeature(req)` | `EngineeringImpact` |
| `generateTasks(req)` | `EngineeringTask[]` |
| `generateExecutionGraph(req)` | `EngineeringGraph` |
| `generateAgentPlan(req)` | `AgentPlan` |
| `generateVerificationPlan(req)` | `VerificationPlan` (lcis-execution) |
| `generateRollbackPlan(req)` | `RollbackPlan` (lcis-execution) |
| `generateLaunchPlan(req)` | `Promise<LaunchPlan>` (lcis-execution) |
| `generateBlueprint(req)` | `Promise<EngineeringBlueprint>` |
| `generateFullEngineeringPackage(req)` | `Promise<EngineeringPackage>` |

---

## Blueprint composition

`generateBlueprint` assembles the 15 fields of `EngineeringBlueprint` by calling each prior
engine exactly once — nothing is recalculated or invented:

```
blueprint = {
  impact        ← feature.analyzeFeature(req)
  change        ← eis.analyze(req)                       [lcis-execution]
  migration     ← migration.planMigration(req)
  tests         ← verification.planTests(req)
  verification  ← verification.planVerification(req)
  rollback      ← rollback.planRollback(req)
  launch        ← launch.planLaunch(req)
  executionGraph← eis.execution.generateExecutionGraph(req)
  ownership     ← gov.ownership.generateOwnershipReport()  [lcis-governance]
  compliance    ← gov.compliance.generateComplianceReport()
  security      ← gov.security.generateSecurityDriftReport()
  readiness     ← gov.readiness.generateReadinessReport()
  operations    ← ops.operationsReport()                   [lcis-operations]
  gates         ← change.analyzeChange + migration.migrationGates
                  + verification.coverageGaps + rollback.rollbackBlockers
                  + launch.launchBlockers
}
```

---

## EngineeringPackage — the flagship output

`generateFullEngineeringPackage` adds tasks + agentPlan + graph + the `decision` verdict to the
blueprint:

```
verdict:
  NO_GO          if launchVerdict=NO_GO OR any critical gate/blocker
  CONDITIONAL_GO if launchVerdict=CONDITIONAL_GO OR any high finding
  GO             otherwise
```

---

## Access surfaces

| Surface | Entry point |
|---|---|
| CLI | `lcis engineering`, `lcis blueprint`, `lcis tasks`, `lcis rollout`, `lcis rollback`, `lcis eng-verify`, `lcis agent-plan` |
| MCP | 7 `lcis_engineering_*` tools (registry entry 42) |
| API | 7 `POST /engineering/*` routes |
| PR-check | V5 — 6 `EngineeringVerdict` dimensions: readiness / complexity / risk / coverage / rollback / verification |

---

## Worked example — "Build GST Filing"

```
req = { text: "Build GST Filing", domains: ["gst"], tables: ["invoices","gst_filings"] }

analyzeFeature(req)
  → eis.analyze(req) discovers: domains=[gst], tables=[invoices,gst_filings],
    rpcs=[create_gst_invoice], apis=[/v1/gst/file], risk.money=true
  → EngineeringImpact { complexity.band='moderate', risk.level='high', unresolved=false }

change.analyzeChange(req)
  → E001 (money table: invoices), E002 (tenant table: gst_filings),
    E003 (/v1/gst/file proxy required), E005 (route + rpc tests required)

generateTasks(req)
  → TASK-MIGRATION-invoices (priority 10)
  → TASK-MIGRATION-gst_filings (priority 10)
  → TASK-RPC-create_gst_invoice (priority 20, gate=canonical-ledger-only-validator)
  → TASK-GATEWAY-v1-gst-file (priority 30)
  → TASK-PROXY-gst (priority 40)
  → TASK-UI-gst (priority 50)
  → TASK-TEST-gst (priority 80)
  → TASK-DOCS-gst (priority 90)
  → TASK-VERIFICATION-gst (priority 100)

generateBlueprint(req)
  → embeds all of the above + gov.compliance + gov.readiness + ops.operationsReport
  → gates includes E001/E002/E003/E005 findings + migration gates
  → summary: "Blueprint for 'Build GST Filing': 1 domain(s), 2 table(s), N gate(s)/blocker(s); ..."

generateFullEngineeringPackage(req)
  → decision.verdict = CONDITIONAL_GO (high risk.level → high findings present)
```

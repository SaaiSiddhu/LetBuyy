# EAOS Architecture
**Execution & Agent Orchestration System — Phase 8**
**Package:** `@letbuyy/lcis-orchestration` at `packages/lcis-orchestration/`

---

## 1. Position in the LCIS Stack

EAOS is Phase 8 of the LetBuyy Central Intelligence System. It is the topmost layer that makes
execution orchestration intelligence available across all four access surfaces. The full stack reads
bottom-to-top:

```
LCOS observes  (lcis-operations)        Phase 6
LCIS understands (lcis-core)            Phase 1
EIS plans      (lcis-execution)         Phase 4
GDIS governs   (lcis-governance)        Phase 5
EINS engineers (lcis-engineering)       Phase 7
EAOS orchestrates/tracks               Phase 8  ← this package
```

EAOS TRACKS execution; it NEVER executes. Humans and agents execute. EAOS consumes the
`EngineeringPackage` produced by Phase 7 (EINS) and derives execution state, agent assignments,
artifact plans, validation status, progress metrics, rollout readiness, and timeline milestones.
No `exec`, `spawn`, `child_process`, `writeFile`, `fetch`, or DB mutation is present anywhere in
`src/`. This is enforced mechanically by `test/security.test.ts`.

---

## 2. Composition Graph

EAOS holds exactly six approved composition targets (plus `zod`) as declared dependencies:

```json
"@letbuyy/lcis-core"
"@letbuyy/lcis-execution"
"@letbuyy/lcis-governance"
"@letbuyy/lcis-operations"
"@letbuyy/lcis-engineering"
"zod"
```

What each upstream package provides to EAOS:

| Package | What EAOS reuses |
|---------|-----------------|
| `lcis-core` | `LcisEngine`, `getEngine()`, `envelope()`, `evidence()`, `notConnected()`, `Evidence` type |
| `lcis-engineering` | `EngineeringPackage`, `EngineeringGraph`, `EngineeringTask`, `AgentPlan`, `FeatureRequest`, `AgentType`, `EngineeringLayer` — the primary EAOS input |
| `lcis-execution` | Reused by EINS; EAOS cites it via provenance (`eb.reuse('lcis-execution', ...)`) |
| `lcis-governance` | Compliance and readiness gates form the structural `PASSED`/`FAILED` ValidationStatus signal |
| `lcis-operations` | Operations report is embedded in the EINS blueprint; EAOS reads it structurally |

EAOS introduces **no new engine, no duplicated reasoning**. Every output is a pure transform over
the `EngineeringPackage`. The `ExecutionEvidenceBuilder.reuse()` method is the formal
"compose-not-duplicate" citation used in every service.

---

## 3. The Frozen Type Contract

All types live in `src/shared/types.ts`. No service may create new types; they consume these.
The contract is frozen. Key groupings:

### 3.1 Status Enumerations

```ts
// src/shared/types.ts
export type ExecutionStatus =
  | 'PLANNED' | 'READY' | 'RUNNING' | 'BLOCKED' | 'WAITING'
  | 'REVIEW' | 'VERIFIED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type AgentStatus = 'ASSIGNED' | 'WORKING' | 'WAITING' | 'BLOCKED' | 'FINISHED';

export type ArtifactStatus = 'PLANNED' | 'CREATED' | 'UPDATED' | 'VERIFIED' | 'REJECTED' | 'ACCEPTED';

export type ValidationStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
```

CONNECTED derivations: `PLANNED / READY / BLOCKED` (ExecutionStatus), `ASSIGNED` (AgentStatus),
`PLANNED` (ArtifactStatus), `PENDING` + structural `PASSED/FAILED` (ValidationStatus).
All remaining states require a live tracking source and are NOT_CONNECTED.

### 3.2 OrchestrationArtifact — the Provenance Base

Every EAOS output extends `OrchestrationArtifact`:

```ts
export interface OrchestrationArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — structural-only; derived from the composed package; never fabricated. */
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  /** True only if a live execution value was actually read. Always false until a tracker is wired. */
  readonly liveConnected: boolean;
}
```

The `execution()` stamp function in `src/shared/envelope.ts` applies this provenance. `liveConnected`
defaults to `false`. Confidence is capped at 0.9 (structural-only).

### 3.3 Core Graph + Finding Types

| Type | Description |
|------|-------------|
| `ExecutionNode` | Task with structurally-derived status, depth, `onCriticalPath`, `agentType`, `gate`, `connection`, `liveSource` |
| `ExecutionEdge` | `{ from, to, relation: 'depends-on' }` |
| `ExecutionGraph` | Full DAG overlay: nodes, edges, `implementationOrder`, `criticalPath`, `parallelizable`, `blocked` |
| `ExecutionFinding` | EO01–EO08 finding: category, kind, severity, subject, rule, `connection`, confidence, evidence |
| `ExecutionArtifact` | Planned artifact: `taskId`, `layer`, `kind`, `plannedPath`, `status`, `connection`, `liveSource` |
| `ExecutionValidation` | Gate validation: `id`, `subject`, `gate`, `status`, `connection`, `severity`, `liveSource` |
| `ExecutionAgent` | Agent assignment: `id`, `agentType`, `taskRef`, `dependsOn`, `acceptance`, `status`, `connection`, `liveSource` |
| `ExecutionHealth` | Health for an area: `score` (0–100 or null), `band`, `connectedSignals`, `notConnectedSignals` |
| `ProgressMetric` | `label`, `planned` (CONNECTED), `completed` (null = NOT_CONNECTED), `connection`, `liveSource` |
| `TimelineMilestone` | `id`, `title`, `tasks`, `gate`, `connection`, `liveSource` (durations NOT_CONNECTED) |

### 3.4 Per-Service Reports and ExecutionPackage

Seven per-service reports all extend `OrchestrationArtifact`:

| Report | Primary fields |
|--------|---------------|
| `ExecutionReport` | `graph`, `findings`, `health`, `completion` |
| `AgentReport` | `agents`, `byAgentType`, `findings`, `health` |
| `ArtifactReport` | `artifacts`, `byLayer`, `findings`, `coverage` |
| `ValidationReport` | `validations`, `findings`, `health` |
| `StatusReport` | `metrics`, `overall`, `eta` (NOT_CONNECTED), `blockedReasons`, `findings` |
| `RolloutReport` | `launchVerdict` (GO/CONDITIONAL_GO/NO_GO), `rollbackReadiness`, `blockers`, `findings`, `health` |
| `TimelineReport` | `milestones`, `criticalPath`, `stateTransitions` |

The flagship output is the `ExecutionPackage`:

```ts
export interface ExecutionPackage extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly execution: ExecutionReport;
  readonly agent: AgentReport;
  readonly artifact: ArtifactReport;
  readonly validation: ValidationReport;
  readonly status: StatusReport;
  readonly rollout: RolloutReport;
  readonly timeline: TimelineReport;
  readonly health: ExecutionHealth;
  readonly summary: string;
}
```

PR-check V6 exposes six `ExecutionVerdict` dimensions:

```ts
export type ExecutionDimension =
  | 'execution-readiness' | 'execution-health' | 'validation-health'
  | 'rollout-health' | 'artifact-health' | 'agent-health';
```

---

## 4. The Seven Services + Facade

Services live under `src/<name>/`:

| Service | File | Primary output |
|---------|------|---------------|
| `ExecutionIntelligenceService` | `src/execution/` | `ExecutionReport`, `ExecutionGraph`, blocked findings (EO02), `ExecutionHealth`, `ProgressMetric` |
| `AgentIntelligenceService` | `src/agent/` | `AgentReport`, `ExecutionAgent[]`, ownership findings (EO01) |
| `ArtifactIntelligenceService` | `src/artifact/` | `ArtifactReport`, `ExecutionArtifact[]`, missing-artifact findings (EO04) |
| `ValidationIntelligenceService` | `src/validation/` | `ValidationReport`, `ExecutionValidation[]`, failed-gate findings (EO03) |
| `StatusIntelligenceService` | `src/status/` | `StatusReport`, `ProgressMetric[]`, `blockedReasons()` |
| `RolloutIntelligenceService` | `src/rollout/` | `RolloutReport`, `launchBlockers()`, `rolloutHealth()` |
| `TimelineIntelligenceService` | `src/timeline/` | `TimelineReport`, milestones from `EngineeringGraph.milestones` |

The **composition facade** is `ExecutionOrchestrationEngine` in `src/engine/`:

```ts
// src/engine/ExecutionOrchestrationEngine.ts
export class ExecutionOrchestrationEngine implements OrchestrationEngine {
  readonly core: LcisEngine;
  readonly execution: ExecutionIntelligenceService;
  readonly agent: AgentIntelligenceService;
  readonly artifact: ArtifactIntelligenceService;
  readonly validation: ValidationIntelligenceService;
  readonly status: StatusIntelligenceService;
  readonly rollout: RolloutIntelligenceService;
  readonly timeline: TimelineIntelligenceService;

  resolvePackage(input: OrchestrationInput): Promise<EngineeringPackage>;
  generateExecutionReport(input: OrchestrationInput): Promise<ExecutionReport>;
  generateAgentReport(input: OrchestrationInput): Promise<AgentReport>;
  generateArtifactReport(input: OrchestrationInput): Promise<ArtifactReport>;
  generateValidationReport(input: OrchestrationInput): Promise<ValidationReport>;
  generateStatusReport(input: OrchestrationInput): Promise<StatusReport>;
  generateRolloutReport(input: OrchestrationInput): Promise<RolloutReport>;
  generateTimelineReport(input: OrchestrationInput): Promise<TimelineReport>;
  generateFullExecutionPackage(input: OrchestrationInput): Promise<ExecutionPackage>;
  generateBlockersReport(input: OrchestrationInput): Promise<BlockersReport>;
  generateHealthReport(input: OrchestrationInput): Promise<HealthReport>;
}
```

`OrchestrationInput` is either a plain `FeatureRequest` (EAOS builds the EINS package) or a
pre-built `EngineeringPackage` (passed through). The facade builds the package once in
`generateFullExecutionPackage` and fans it out to all seven services synchronously.

The process-wide singleton accessor is `getOrchestrationEngine()`. Tests use
`resetOrchestrationEngine()` to clear it.

`mergeHealth(areas)` is the shared helper that averages non-null scores and maps to a `HealthBand`:
`>= 80 → healthy`, `>= 50 → degraded`, `< 50 → failing`, `null → unknown`.

---

## 5. The Rule Registry — EO01 through EO08

Rules are declared in `src/shared/rules.ts` and consumed by services via `ExecutionRuleRegistry`.
They are metadata; services evaluate them over the EINS package; no rule executes anything.

| Rule | Title | Severity | Category |
|------|-------|----------|----------|
| EO01 | Task ownership | high | ownership |
| EO02 | Blocked tasks | high | blocked |
| EO03 | Failed validation | critical | validation |
| EO04 | Missing artifacts | medium | artifact |
| EO05 | Execution drift | medium | drift |
| EO06 | Stale execution | medium | stale |
| EO07 | Incomplete rollout | high | rollout |
| EO08 | Missing verification | high | verification |

EO02 (blocked tasks) and EO01 (ownership) are CONNECTED findings — derived structurally from
`EngineeringGraph.blocked` and `EngineeringTask.agentType`. EO06 (stale execution) is
NOT_CONNECTED — it requires a live execution tracking signal to determine non-progress.

`ExecutionRuleRegistry` exposes `list()`, `get(id)`, and `byCategory(category)`.

---

## 6. Honesty / Live-Data Law

The `OrchestrationArtifact.liveConnected` field is `false` on every output. The `execution()`
stamp in `src/shared/envelope.ts` defaults it to `false`. No live execution-tracking store exists
in this repository.

CONNECTED signals (structurally derivable):

| Signal | Source |
|--------|--------|
| `ExecutionStatus` PLANNED / READY / BLOCKED | `EngineeringGraph.parallelizable` and `.blocked` |
| `AgentStatus` ASSIGNED | `AgentPlan.tasks` — planned assignment is structural |
| `ArtifactStatus` PLANNED | `EngineeringTask.layer` implies artifact type |
| `ValidationStatus` PENDING | `EngineeringTask.gate` declares the validation gate |
| ValidationStatus structural PASSED/FAILED | `lcis-governance` `ComplianceReport` for static gates |
| Critical path | `EngineeringGraph.criticalPath` (Kahn DP) |
| GO/CONDITIONAL_GO/NO_GO verdict | `EngineeringPackage.decision` (derived from gates + launch) |
| EO01 ownership gaps | `EngineeringTask.agentType` missing |
| EO02 blocked tasks | `EngineeringGraph.blocked` (Kahn residual) |

NOT_CONNECTED signals (require a live tracking source, surfaced honestly with `liveSource`):

| Signal | Would-be source |
|--------|----------------|
| Live run-state (RUNNING/COMPLETED/FAILED) | execution-tracking store (CI / git) |
| Completion percentage | completed count over task-run store |
| ETA | mean cycle time per agent type × remaining critical-path tasks |
| Real artifact presence on disk | filesystem probe at planned path or CI artifact registry |
| Live CI gate pass/fail | CI step exit code mapped to `EngineeringTask.gate` |
| Agent activity (WORKING/FINISHED) | agent heartbeat/event stream keyed on `AgentTask.id` |

The constant `LIVE_RUN_SOURCE = 'execution-tracking store (CI / git)'` is used throughout
`ExecutionIntelligenceService` as the named would-be source.

---

## 7. Security Posture

`test/security.test.ts` (described as "EAOS Phase 15 — mandatory security review source-scan tests")
scans every `.ts` file under `src/` (comments stripped) and fails the suite if any forbidden token
appears.

**Forbidden execution/shell tokens:**
`child_process`, `spawn(`, `spawnSync`, `execSync`, `execFile`, ` exec(`, `.exec(`, `eval(`,
`new Function(`

**Forbidden filesystem-mutation tokens:**
`writeFile`, `appendFile`, `unlink`, `rmSync`, `rmdir`, `mkdir`, `renameSync`, `rename(`,
`copyFile`, `chmod`, `chown`, `truncate`, `createWriteStream`

**Forbidden network tokens:**
`fetch(`, `XMLHttpRequest`, `new WebSocket`, `http.request`, `https.request`, `net.connect`,
`net.createServer`, `dgram.`

**Forbidden module imports:**
`node:child_process`, `node:fs`, `fs`, `node:fs/promises`, `node:http`, `node:https`, `node:net`,
`node:dgram`, `node:worker_threads`, `node:cluster`, `require(`

**Forbidden DB mutation tokens:**
`.insert(`, `.update(`, `.delete(`, `.upsert(`, `.rpc(`

**Forbidden AI tokens:**
`openai`, `anthropic`, `embedding`, `qdrant`, `Qdrant`, `langchain`, `llm(`, `LLM(`

Dependencies are also locked: the security test asserts that `package.json` `dependencies` contains
exactly `@letbuyy/lcis-core`, `@letbuyy/lcis-engineering`, `@letbuyy/lcis-execution`,
`@letbuyy/lcis-governance`, `@letbuyy/lcis-operations`, and `zod` — nothing else.
Package scripts may not contain `deploy`, `push`, `publish`, or `migrate`.

---

## 8. The Four Access Surfaces

### 8.1 CLI — `lcis execution <subcommand> <text...>`

Seven subcommands, each calling the facade:

| Subcommand | Facade method |
|------------|--------------|
| `lcis execution report` | `generateFullExecutionPackage` |
| `lcis execution graph` | `generateExecutionReport` |
| `lcis execution status` | `generateStatusReport` |
| `lcis execution timeline` | `generateTimelineReport` |
| `lcis execution blockers` | `generateBlockersReport` |
| `lcis execution rollout` | `generateRolloutReport` |
| `lcis execution health` | `generateHealthReport` |

### 8.2 MCP — 7 `lcis_execution_*` tools

| Tool name | Facade method |
|-----------|--------------|
| `lcis_execution_report` | `generateFullExecutionPackage` |
| `lcis_execution_graph` | `generateExecutionReport` |
| `lcis_execution_status` | `generateStatusReport` |
| `lcis_execution_blockers` | `generateBlockersReport` |
| `lcis_execution_timeline` | `generateTimelineReport` |
| `lcis_execution_rollout` | `generateRolloutReport` |
| `lcis_execution_health` | `generateHealthReport` |

### 8.3 HTTP API — `POST /execution/*`

Seven REST endpoints in `services/lcis-api/src/app.ts`:

| Route | Facade method |
|-------|--------------|
| `POST /execution/report` | `generateFullExecutionPackage` |
| `POST /execution/graph` | `generateExecutionReport` |
| `POST /execution/status` | `generateStatusReport` |
| `POST /execution/timeline` | `generateTimelineReport` |
| `POST /execution/blockers` | `generateBlockersReport` |
| `POST /execution/rollout` | `generateRolloutReport` |
| `POST /execution/health` | `generateHealthReport` |

### 8.4 PR-check V6 — `## LCIS EXECUTION` section

`analyzeWithExecution()` in `packages/lcis-pr-check/src/analyze.ts` (the V6 async entry point)
calls `eaos.generateFullExecutionPackage()` once and maps its output to six `ExecutionVerdict`
values appended as `report.executionVerdicts`:

| Dimension | Source signal |
|-----------|--------------|
| `execution-readiness` | `rollout.launchVerdict` (GO → PASS, CONDITIONAL_GO → WARN, NO_GO → FAIL) |
| `execution-health` | overall package health band |
| `validation-health` | validation area health + failed validations |
| `rollout-health` | rollout area health + `rollbackReadiness` |
| `artifact-health` | artifact findings (drift/missing); coverage is NOT_CONNECTED |
| `agent-health` | agent area health + ownership/orphan findings |

UNKNOWN is returned when a signal cannot be determined — never fabricated as PASS.

---

## 9. Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `execution()` | `src/shared/envelope.ts` | Stamps provenance (evidence/confidence/sources/timestamp/liveConnected) onto every output |
| `ExecutionEvidenceBuilder` | `src/shared/evidence.ts` | Typed constructors: `task()`, `agent()`, `gate()`, `reuse()`, `notConnected()` |
| `ExecutionRuleRegistry` | `src/shared/rules.ts` | `list()`, `get(id)`, `byCategory()` over EO01–EO08 |
| `ExecutionConfidenceCalculator` | `src/shared/confidence.ts` | Structural-only confidence (capped at 0.9) |
| `ExecutionSeverityScorer` | `src/shared/severity.ts` | Severity mapping for findings |
| `buildEngineeringPackage` | `src/shared/package.ts` | Builds EINS package from a `FeatureRequest` via `lcis-engineering` |
| `mergeHealth` | `src/engine/ExecutionOrchestrationEngine.ts` | Averages per-area scores into overall `ExecutionHealth` |

---

## 10. Limitations

- **No live tracking.** All live signals (run state, completion %, ETA, artifact presence, CI
  results, agent activity) are NOT_CONNECTED. A purpose-built execution-tracking store is required
  to wire them.
- **Point-in-time snapshot.** `EngineeringPackage` is immutable. Callers must re-invoke
  `getOrchestrationEngine().generateFullExecutionPackage(req)` to refresh.
- **No AI/LLM.** EAOS is purely deterministic. All reasoning is structural transforms over the
  EINS package.
- **No persistence.** EAOS holds no state between invocations. The process-wide singleton reuses
  the `lcis-core` graph cache only.

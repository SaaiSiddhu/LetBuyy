# EAOS Phase-8: Operations & Timeline Discovery

> Discovery-only. No code written. Verified against real source.
> Date: 2026-06-21

---

## 1. Source of Truth

| Package | Entry | Singleton factory |
|---|---|---|
| `packages/lcis-operations` | `src/engine.ts` | `getOperationsEngine()` → `OperationsEngine` |
| `packages/lcis-execution` | `src/engine.ts` | `getEisEngine()` → `EisEngine` |

---

## 2. Reusable API: `OperationsEngine`

```ts
const ops = getOperationsEngine();
```

| Method | Return type | Key fields EAOS consumes |
|---|---|---|
| `ops.deployment()` | `DeploymentReport` (AreaReport) | `findings`, `signals`, `health`, `evidence` — deploy topology + SPOF + no-canary |
| `ops.incident()` | `IncidentReport` (AreaReport) | `findings` (blast/runbooks/recovery), `signals` |
| `ops.runtime()` | `RuntimeReport` (AreaReport) | workers, queues, SPOF structural map |
| `ops.forecast()` | `ForecastReport` (AreaReport) | deterministic series (linear/moving-avg/CI); values NOT_CONNECTED |
| `ops.operationsReport()` | `OperationsReport` | composite of all 8 areas + `answers{healthy,degraded,failing,atRisk,changed,investigate}` + `health` + `summary` string + **`liveConnected: false`** hardcoded |

### `OperationsReport` envelope shape (from `shared/types.ts` + `engine.ts`)

```ts
interface OperationsReport extends OperationalArtifact {
  deployment: DeploymentReport;
  incident:   IncidentReport;
  health:     OperationalHealth;   // score: null when no live telemetry
  answers: {
    healthy:     string[];
    degraded:    string[];
    failing:     string[];
    atRisk:      string[];
    changed:     string[];
    investigate: string[];
  };
  summary: string;
  liveConnected: boolean;          // always false — no telemetry creds
}
```

---

## 3. Reusable API: `EisEngine`

```ts
const eis = getEisEngine();
```

| Method | Signature | Return key fields EAOS consumes |
|---|---|---|
| `eis.launch.evaluateLaunch(req)` | `async (ChangeRequest\|ChangeAnalysis) → LaunchPlan` | `decision: 'GO'\|'CONDITIONAL_GO'\|'NO_GO'`, `readiness: number (0..1)`, `blockers: LaunchBlocker[]` |
| `eis.rollback.generateRollbackPlan(req)` | `sync (ChangeRequest) → RollbackPlan` | `readiness: 'READY'\|'CONDITIONAL'\|'NOT_READY'`, `irreversible: IrreversibleChange[]` |
| `eis.planAll(req)` | `async (ChangeRequest) → FullPlan` | full plan bundle if EAOS needs all sub-plans in one call |

### `LaunchPlan` key fields

```ts
interface LaunchPlan extends PlanArtifact {
  decision:  'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readiness: number;          // 0..1 structural, never fabricated
  blockers:  LaunchBlocker[];
  // rationale string embedded in PlanArtifact
}
```

### `RollbackPlan` key fields

```ts
interface RollbackPlan extends PlanArtifact {
  readiness:   'READY' | 'CONDITIONAL' | 'NOT_READY';
  irreversible: IrreversibleChange[];   // money-ledger / high-FK-fanin / tenant tables
}
```

---

## 4. EAOS Capability → Compose Table

| EAOS capability | Compose from | CONNECTED? |
|---|---|---|
| `rolloutState` (deploy topology, SPOFs, no-canary) | `ops.deployment()` | CONNECTED — structural graph |
| `rolloutHealth` (failing/atRisk/degraded areas) | `ops.operationsReport().answers` | CONNECTED — structural; live metric values NOT_CONNECTED |
| `rollbackReadiness` (READY/CONDITIONAL/NOT_READY + irreversibles) | `eis.rollback.generateRollbackPlan(req)` | CONNECTED — structural analysis of ChangeRequest |
| `launchBlockers` (GO/NO_GO/CONDITIONAL_GO + blocker list) | `eis.launch.evaluateLaunch(req)` | CONNECTED — structural readiness; live CI status NOT_CONNECTED |
| `releaseReadiness` (full plan bundle) | `eis.planAll(req)` or compose `launch`+`rollback` directly | CONNECTED (structural); live deploy events NOT_CONNECTED |
| `incidentBlast` (blast radius, runbooks, recovery steps) | `ops.incident()` | CONNECTED — structural runbook/blast map |
| `runtimeSPOF` (workers/queues single-points) | `ops.runtime()` | CONNECTED — structural topology |
| `forecast` (trend series for rollout risk) | `ops.forecast()` | NOT_CONNECTED — deterministic model, no live telemetry |
| Timeline **milestones structure** (from graph) | `eis.execution.planImplementation(change).milestones` | CONNECTED — graph-derived milestone list |
| Timeline **durations / actual timestamps** | no source exists | NOT_CONNECTED — no execution history store; values must be explicitly `null` / `UNKNOWN` |
| `liveConnected` flag (mirror from ops) | `ops.operationsReport().liveConnected` | always `false` — EAOS inherits the honesty contract |

---

## 5. Integration Contract for EAOS

1. **Singleton reuse** — call `getOperationsEngine()` and `getEisEngine()` (both lazily reuse the `lcis-core` singleton). Never `createOperationsEngine()` / `createEisEngine()` in EAOS.
2. **Compose, never re-implement** — all risk/blast/runbook/SPOF logic lives inside the ops/eis services. EAOS only calls the methods above and assembles the EAOS envelope.
3. **Inherit `liveConnected: false`** — mirror `ops.operationsReport().liveConnected` directly into every EAOS rollout/timeline response. Never hardcode `true`.
4. **Timeline durations are NOT_CONNECTED** — the milestone *structure* comes from the execution plan (`milestones[]`); actual start/end/duration timestamps must be `null` or flagged `NOT_CONNECTED` because no execution history store exists in the stack.
5. **`eis.rollback.generateRollbackPlan` takes `ChangeRequest` not `ChangeAnalysis`** (unlike all other eis services which take `ChangeAnalysis`). EAOS must pass the raw request.
6. **`evaluateLaunch` is async** — EAOS `releaseReadiness` and `launchBlockers` endpoints must be `async` to await it.

---

## 6. What EAOS Does NOT Implement

The following are already fully implemented in the composed packages and must not be re-implemented in EAOS:

- Irreversible-change detection (money-ledger / tenant table / FK fan-in) — `RollbackIntelligenceService`
- GO / CONDITIONAL_GO / NO_GO decision logic — `LaunchIntelligenceService`
- Blast radius + runbook map — `IncidentOperationsService`
- SPOF identification — `RuntimeOperationsService`
- Deterministic forecasting (linear trend, moving average, CI) — `ForecastOperationsService`
- Health score aggregation — `OperationalHealthCalculator`

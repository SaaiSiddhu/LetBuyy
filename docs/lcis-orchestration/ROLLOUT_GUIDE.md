# ROLLOUT_GUIDE — RolloutIntelligenceService

**EAOS Phase 8 · `packages/lcis-orchestration/src/rollout/RolloutIntelligenceService.ts`**

> EAOS TRACKS rollout state; it NEVER performs one. Humans and agents execute.
> Read-only, deterministic, no AI, no network, no DB write.

---

## 1. Purpose

`RolloutIntelligenceService` answers the question: **"Is this feature safe to ship, and can it be safely rolled back?"**

It derives those answers from the `EngineeringPackage` emitted by EINS (Phase 7) — specifically from three pre-composed sub-plans: `pkg.blueprint.launch`, `pkg.blueprint.rollback`, and `pkg.blueprint.operations`. No additional computation is performed; this service is a pure composition and re-projection layer.

The full `RolloutReport` is also the `rollout` sub-report inside the `ExecutionPackage` produced by `ExecutionOrchestrationEngine.generateFullExecutionPackage`.

---

## 2. Questions It Answers

| Question | Answer source | Connection |
|---|---|---|
| Is this feature GO / CONDITIONAL_GO / NO_GO for release? | `pkg.blueprint.launch.decision.decision` | CONNECTED |
| Can the rollback be completed? | `pkg.blueprint.rollback.readiness` | CONNECTED |
| What is the combined strictest verdict? | `releaseReadiness` — NO_GO wins | CONNECTED |
| Which tasks are irreversible? | `pkg.blueprint.rollback.irreversible[]` | CONNECTED |
| What specific blockers prevent launch? | `pkg.blueprint.launch.blockers[]` + `ops.answers.failing[]` | CONNECTED |
| What is the overall rollout health score (0–100)? | Structural: launch.readiness − penalties | CONNECTED |
| How far through deployment are we? | Deploy-tracking store | NOT_CONNECTED |
| What is the live error rate after rollout? | Cloudflare Analytics Engine | NOT_CONNECTED |

---

## 3. Public API

All methods accept an already-composed `EngineeringPackage` and return synchronously.

### 3.1 `rolloutState`

```ts
rolloutState(pkg: EngineeringPackage): {
  readonly launchDecision: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly rollbackReadiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  readonly decision: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly evidence: ReturnType<ExecutionEvidenceBuilder['reuse']>[];
  readonly liveConnected: boolean;
}
```

Derives `decision` using strictest-wins logic: `NO_GO` beats `CONDITIONAL_GO` beats `GO`. The three pieces of evidence cite `lcis-execution/eis.launch`, `lcis-execution/eis.rollback`, and `lcis-operations/ops.operationsReport`. `liveConnected` mirrors `pkg.blueprint.operations.liveConnected` — always `false` until a telemetry adapter is wired.

### 3.2 `rolloutHealth`

```ts
rolloutHealth(pkg: EngineeringPackage): ExecutionHealth
```

Returns an `ExecutionHealth` for `area: 'rollout'`. Score formula:

```
score = max(0, round(launch.readiness * 100) − rollbackPenalty − opsPenalty)
  rollbackPenalty: NOT_READY=30, CONDITIONAL=10, READY=0
  opsPenalty:      min(30, failing.length * 10 + atRisk.length * 5)
```

Always `connectedSignals: 3` (launch.readiness + rollback.readiness + ops.answers), `notConnectedSignals: 2` (live deploy progress + live telemetry). Band: `≥80` healthy, `≥50` degraded, `<50` failing.

### 3.3 `rolloutProgress`

```ts
rolloutProgress(pkg: EngineeringPackage): ProgressMetric
```

`planned = pkg.tasks.length` (CONNECTED). `completed = null`, `connection: 'NOT_CONNECTED'`, `liveSource: 'deploy-tracking store (CI/CD pipeline API — e.g. Vercel deploy webhooks)'`. No fabrication.

### 3.4 `rollbackReadiness`

```ts
rollbackReadiness(pkg: EngineeringPackage): {
  readonly readiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  readonly irreversible: readonly { readonly subject: string; readonly reason: string }[];
  readonly connection: 'CONNECTED';
  readonly evidence: ReturnType<ExecutionEvidenceBuilder['reuse']>[];
}
```

Reads `pkg.blueprint.rollback.readiness` and `pkg.blueprint.rollback.irreversible[]` verbatim. Evidence cites `lcis-execution/eis.rollback.generateRollbackPlan` with the complexity and irreversible count embedded.

### 3.5 `launchBlockers`

```ts
launchBlockers(pkg: EngineeringPackage): ExecutionFinding[]
```

Merges two blocker sources into `ExecutionFinding[]` under rule **EO07** (`category: 'rollout'`):

- `pkg.blueprint.launch.blockers[]` — each becomes `kind: 'launch-blocker'`, `connection: 'CONNECTED'`, `confidence: 0.85`, cites `lcis-execution/eis.launch`.
- `pkg.blueprint.operations.answers.failing[]` — each becomes `kind: 'ops-failing-at-launch'`, `connection: 'CONNECTED'`, `confidence: 0.80`, cites `lcis-operations/ops.operationsReport`. The finding detail explicitly notes `liveConnected=false`.

### 3.6 `releaseReadiness`

```ts
releaseReadiness(pkg: EngineeringPackage): {
  readonly verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly launchDecision: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly rollbackReadiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  readonly packageDecision: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly rationale: string;
  readonly connection: 'CONNECTED';
  readonly evidence: ReturnType<ExecutionEvidenceBuilder['reuse']>[];
}
```

Normalises `rollbackReadiness` onto the launch scale (`NOT_READY→NO_GO`, `CONDITIONAL→CONDITIONAL_GO`, `READY→GO`), then takes the strictest across all three inputs. Evidence cites all three sources with `connection: 'CONNECTED'`.

### 3.7 `generateRolloutReport`

```ts
generateRolloutReport(pkg: EngineeringPackage): RolloutReport
```

Composes all six methods above into a stamped `RolloutReport`:

```ts
interface RolloutReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly launchVerdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  readonly rollbackReadiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  readonly blockers: readonly string[];          // "[launch] title" + "[ops-failing] area"
  readonly findings: readonly ExecutionFinding[];
  readonly health: ExecutionHealth;
  readonly summary: string;
}
```

The `summary` string explicitly states: `Live deploy progress: NOT_CONNECTED (source: deploy-tracking store …)` and `Live metrics: NOT_CONNECTED (source: live telemetry …)`. Stamped via `execution()` from `src/shared/envelope.ts` with `liveConnected: pkg.blueprint.operations.liveConnected`.

---

## 4. CONNECTED vs NOT_CONNECTED Signals

| Signal | Connection | Would-be source |
|---|---|---|
| Launch GO/NO/CONDITIONAL verdict | CONNECTED | `pkg.blueprint.launch.decision.decision` (lcis-execution) |
| Rollback readiness | CONNECTED | `pkg.blueprint.rollback.readiness` (lcis-execution) |
| Irreversible operations list | CONNECTED | `pkg.blueprint.rollback.irreversible[]` |
| Launch blockers | CONNECTED | `pkg.blueprint.launch.blockers[]` |
| Failing operational areas | CONNECTED (structural topology) | `pkg.blueprint.operations.answers.failing[]` |
| Rollout health score | CONNECTED (structural composition) | Computed from above three sources |
| Deploy completion % | NOT_CONNECTED | `deploy-tracking store (CI/CD pipeline API — e.g. Vercel deploy webhooks)` |
| Live post-rollout error rate | NOT_CONNECTED | `live telemetry (Cloudflare Analytics Engine — ops.liveConnected)` |
| Live latency after deploy | NOT_CONNECTED | `live telemetry (Cloudflare Analytics Engine — ops.liveConnected)` |

---

## 5. Rule EO07 — Incomplete Rollout

All findings from this service carry `rule: 'EO07'`:

| Field | Value |
|---|---|
| id | `EO07` |
| title | Incomplete rollout |
| description | Rollout / launch is not release-ready. |
| severity | `high` |
| category | `rollout` |

Finding ids follow the pattern `EO07-launch-<n>` (from `launch.blockers`) or `EO07-ops-failing-<n>` (from `ops.answers.failing`).

---

## 6. Access Layers

### CLI

```
lcis execution rollout    # prints launchVerdict, rollbackReadiness, blockers
lcis execution health     # overall health including rollout area
lcis execution blockers   # BlockersReport: blocked tasks + launch blockers
```

### MCP

Tool `lcis_execution_rollout` — accepts an `OrchestrationInput` (request text or pre-built package), returns `RolloutReport` JSON.

### API

```
POST /execution/rollout    body: { text: string, ...FeatureRequest }
POST /execution/full       body: { text: string }  → ExecutionPackage (rollout sub-report inside)
```

### PR-Check V6

The `rollout-health` verdict in `## LCIS EXECUTION`:

| Verdict | Condition |
|---|---|
| PASS | `launchVerdict === 'GO'` and `rollbackReadiness === 'READY'` |
| WARN | `launchVerdict === 'CONDITIONAL_GO'` or `rollbackReadiness === 'CONDITIONAL'` |
| FAIL | `launchVerdict === 'NO_GO'` or `rollbackReadiness === 'NOT_READY'` |

---

## 7. How It Fits the Facade

`ExecutionOrchestrationEngine` (the composition facade) holds a `rollout: RolloutIntelligenceService` instance. The facade's `generateRolloutReport(input)` resolves the `EngineeringPackage` once (or reuses a pre-built one), then delegates:

```ts
async generateRolloutReport(input: OrchestrationInput): Promise<RolloutReport> {
  return this.rollout.generateRolloutReport(await this.resolvePackage(input));
}
```

In `generateFullExecutionPackage`, `rolloutReport.health` contributes one slot to `mergeHealth([executionReport.health, agentReport.health, validationReport.health, rolloutReport.health])`.

---

## 8. Honest Limitations

- Rollout is **tracked, not performed**. The service tells you what the plans say; it cannot observe whether a deploy webhook fired or a canary metric spiked.
- `liveConnected` is always `false`. Until a CI/CD API adapter is wired to supply deploy events and a telemetry adapter is wired to `pkg.blueprint.operations`, every live signal stays `NOT_CONNECTED`.
- `rolloutProgress.completed` is always `null`. Supplying a real value requires wiring a deploy-tracking store and calling a setter on the service — no such interface exists yet.
- The health score can only penalise; it cannot reward. A perfect structural picture still scores at most `round(launch.readiness * 100)` (capped below 100 when any penalty applies).
- Irreversible operations are structural declarations from the rollback plan, not a live audit of what has already been applied to production.

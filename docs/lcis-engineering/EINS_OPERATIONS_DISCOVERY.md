# EINS Discovery D — Operations (the lcis-operations reuse contract)

EINS **composes** `@letbuyy/lcis-operations` (LCOS) for the operational impact of a feature.
Source: `packages/lcis-operations/src/{index.ts,engine.ts,shared/types.ts,*/}`.

## Entry point
- `getOperationsEngine(opts?)` / `createOperationsEngine(opts?)` → `OperationsEngine` (`opts.now` for determinism).
- Per-area methods (all sync): `ops.runtime()`, `ops.commerce()`, `ops.merchant()`, `ops.customer()`, `ops.deployment()`, `ops.incident()`, `ops.security()`, `ops.forecast()`; composite `ops.operationsReport()`.
- Sub-services exposed: `ops.runtimeOps`, `ops.deploymentOps`, `ops.incidentOps`, … and the foundation `SignalCorrelator` (reuses lcis-core blast).

## Methods EINS reuses (as the operational view of a feature)
| EINS need | Reuse | Returns |
|---|---|---|
| Runtime surface the feature touches (workers/queues/DLQ/SPOF) | `ops.runtime()` | `RuntimeReport` {facts,findings:OperationalFinding[],signals:LiveSignal[],health,summary} |
| Deployment surface (workflows/rollback scripts/SPOFs) | `ops.deployment()` | `DeploymentReport` |
| Incident/blast context (will the feature widen blast radius?) | `ops.incident()` (uses SignalCorrelator → lcis-core blast) | `IncidentReport` |
| Operational security signals | `ops.security()` | `SecurityOpsReport` |
| Composite "what is happening now" + answers | `ops.operationsReport()` | `OperationsReport` {8 area reports, health, answers{healthy,degraded,failing,changed,atRisk,investigate}} |

## Honesty model EINS preserves
- Every report carries `evidence/confidence/sources/timestamp` + `liveConnected` (false in this env).
- Live operational VALUES are `NOT_CONNECTED` + the exact env var; `OperationalFinding.status ∈ {CONNECTED,NOT_CONNECTED,PARTIAL,UNKNOWN,NOT_DETECTABLE}`; confidence 0 for NOT_CONNECTED.

## Notes for EINS
- EINS uses LCOS to answer: *what runtime/deployment/incident surface does this feature touch, and does it worsen a known SPOF (queue-workers single-consumer; 256-tenant single-schema)?* It reuses these read-only reports as the operational-readiness slice of the engineering blueprint; it never reimplements them and never connects live telemetry itself.
- All sync except none required for EINS's use; `operationsReport()` is sync.

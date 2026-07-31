# Launch Intelligence Guide — EINS Phase 7

`packages/lcis-engineering/src/launch/LaunchIntelligenceService.ts`

EINS composes two lower-level engines (lcis-execution and lcis-operations) to produce
a unified launch view. It never reimplements launch or operations logic.

---

## How it works

```
LaunchIntelligenceService
  ├── eis  = createEisEngine({ core, now })        ← lcis-execution
  └── ops  = createOperationsEngine({ core, now })  ← lcis-operations
```

---

## planLaunch

```ts
async planLaunch(req: ChangeRequest): Promise<LaunchPlan>
```

Pure delegation — returns `eis.launch.evaluateLaunch(req)` verbatim.
The `LaunchPlan` carries `decision.decision` (`GO | CONDITIONAL_GO | NO_GO`),
`blockers[]`, `decision.unknowns[]`, and full provenance.

No logic is added here. The reuse is intentional.

---

## launchBlockers

```ts
async launchBlockers(req: ChangeRequest): Promise<EngineeringFinding[]>
```

Runs two queries in parallel, then merges:

```
Promise.all([
  eis.launch.evaluateLaunch(req)  →  plan
  ops.operationsReport()          →  opsReport
])
```

### Source 1 — plan.blockers (eis.launch)

Each `LaunchBlocker` becomes an `EngineeringFinding`:

| LaunchBlocker state | Finding category | Finding severity |
|---|---|---|
| `UNKNOWN` | `gap` | blocker.severity |
| anything else | `blocker` | blocker.severity |

UNKNOWN blockers are **never silently converted to passes** — they surface
as `kind: 'launch-unknown'` gap findings with the text
`"UNKNOWN — cannot determine from current artifacts"`.

### Source 2 — plan.decision.unknowns (eis.launch)

Items from `plan.decision.unknowns[]` that are not already captured in
`plan.blockers` are emitted as additional `gap` findings (`kind: 'launch-unknown'`,
`severity: 'medium'`). De-duplication is by stable id (first 48 chars of the
unknown text, slugified).

### Source 3 — opsReport.answers.atRisk (ops)

Each string in `answers.atRisk` → `EngineeringFinding`:
- `category: 'risk'`, `kind: 'ops-at-risk'`, `severity: 'high'`
- Detail records `liveConnected` status (`NOT_CONNECTED` when live telemetry
  adapters are not wired — never fabricated)
- Evidence cites `ops.operationsReport` via `ev.reuse('lcis-operations', ...)`

### Source 4 — opsReport.answers.failing (ops)

Each string in `answers.failing` → `EngineeringFinding`:
- `category: 'blocker'`, `kind: 'ops-failing'`, `severity: 'critical'`
- Launching into a known-failing area is always a blocker.

---

## operationalImpact

```ts
async operationalImpact(_req: ChangeRequest): Promise<string[]>
```

Reads `ops.operationsReport().answers` and returns plain-language lines,
one per non-empty bucket:

| Bucket | Prefix |
|---|---|
| `answers.failing` | `FAILING` |
| `answers.degraded` | `DEGRADED` |
| `answers.atRisk` | `AT RISK` |
| `answers.investigate` | `INVESTIGATE` |
| `answers.healthy` | `HEALTHY` |
| `answers.changed` | `CHANGED` |

Every line includes the live-connection note:
- `(live data CONNECTED)` — telemetry adapters are wired
- `(live data NOT_CONNECTED — structural topology only; source: ops.operationsReport)` — honest structural-only

When all buckets are empty, a single line is returned:
`"No operational signals connected (...). Wire live telemetry adapters for real-time impact."`

---

## GO/NO-GO honesty contract

- `GO` — no blockers, no unknowns, no failing operational areas
- `CONDITIONAL_GO` — `eis.launch` returned CONDITIONAL_GO; high-severity operational risks present
- `NO_GO` — any `plan.blockers` entry with non-UNKNOWN state, or any `answers.failing` entry

**UNKNOWN is never a pass.** A finding with `category: 'gap'` is always
emitted and must be resolved before the verdict can change.

---

## Evidence pattern

Every finding carries evidence built with `EngineeringEvidenceBuilder`:

```ts
ev.reuse('lcis-execution', 'eis.launch.evaluateLaunch', `LaunchBlocker[${b.id}] state=... severity=...`)
ev.reuse('lcis-operations', 'ops.operationsReport', `answers.atRisk: ...`)
```

The `reuse` evidence kind records which downstream LCIS system produced the
original data — the audit trail is unambiguous.

---

## Integration in EngineeringEngine

`engine.generateBlueprint()` calls:
1. `await this.launch.planLaunch(req)` — the full plan
2. `await this.launch.launchBlockers(req)` — merged into `blueprint.gates`

`generateFullEngineeringPackage()` derives the final `decision.verdict` from
`blueprint.launch.decision.decision` combined with any critical-severity gates:

```ts
verdict = (launchVerdict === 'NO_GO' || criticalGates.length > 0) ? 'NO_GO'
        : (launchVerdict === 'CONDITIONAL_GO' || highSeverityGates) ? 'CONDITIONAL_GO'
        : 'GO'
```

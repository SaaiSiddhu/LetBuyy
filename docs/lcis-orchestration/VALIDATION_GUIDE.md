# EAOS Validation Intelligence Guide

**Package:** `@letbuyy/lcis-orchestration`
**Service:** `ValidationIntelligenceService`
**Source:** `packages/lcis-orchestration/src/validation/ValidationIntelligenceService.ts`
**Phase:** EAOS — Phase 8 (Execution & Agent Orchestration System)

---

## Purpose

`ValidationIntelligenceService` maps governance compliance evaluations and verification coverage
into EAOS validation state. It is a **pure, synchronous, read-only transform** over an
`EngineeringPackage` — no fetch, no spawn, no exec, no file writes, no AI, no network.

EAOS **tracks** validation state. It does not execute validators, run CI, or mutate governance
state. Governance evaluation is done by `lcis-governance` (`ComplianceService`,
`SecurityDriftService`, `ReadinessService`) and arrives pre-evaluated inside
`pkg.blueprint.compliance`, `pkg.blueprint.security`, and `pkg.blueprint.readiness`. This service
reuses those results and overlays them with EAOS's `ValidationStatus` / `Connection` vocabulary.

---

## Questions This Service Answers

| Question | Method |
|---|---|
| Which governance gates are PASSED or FAILED right now (structurally)? | `validationStatus(pkg)` |
| How healthy is the validation layer overall? | `validatorHealth(pkg)` |
| Which compliance violations and security findings are currently failing? | `failedValidations(pkg)` |
| Which gates are waiting on a live CI run to confirm? | `pendingValidations(pkg)` |
| In what order should gates be validated (build layer order)? | `validationTimeline(pkg)` |
| Are there verification coverage gaps before completion? | `verificationCoverage(pkg)` |
| Full validation picture for a feature? | `generateValidationReport(pkg)` |

---

## CONNECTED vs NOT_CONNECTED Signals

`ValidationStatus` maps from `lcis-governance` `ComplianceStatus` as follows — the connection
discriminant is structural (no live source required for PASSED/FAILED):

| ComplianceStatus | ValidationStatus | Connection | Meaning |
|---|---|---|---|
| `COMPLIANT` | `PASSED` | **CONNECTED** | Gate passes from the static graph; no CI run needed |
| `VIOLATED` | `FAILED` | **CONNECTED** | Gate fails from the static graph; a violation is present |
| `PARTIAL` | `PENDING` | **NOT_CONNECTED** | Partial evaluation; live CI confirmation needed |
| `UNKNOWN` | `PENDING` | **NOT_CONNECTED** | Cannot evaluate from the static graph alone |

Per-task gate live CI run results are always `PENDING NOT_CONNECTED`:

| Signal | Connection | Live source named |
|---|---|---|
| Governance compliance evaluations (R001–R008) | CONNECTED for COMPLIANT/VIOLATED | — |
| Per-task validator gate live CI run | NOT_CONNECTED | `GitHub Actions CI (validator gate run)` |
| Verification confirmation (test pass counts, coverage) | NOT_CONNECTED | `CI test suite / coverage tool` |
| Readiness factor `present === 'UNKNOWN'` | NOT_CONNECTED | `CI test suite / coverage tool` |
| Readiness factor `present === false` | CONNECTED | — (structural absence) |

`liveConnected` on every `ValidationReport` is always `false` until an execution-tracking
adapter is wired. `confidence` is `0` for any `NOT_CONNECTED` validation.

---

## Public API

All methods are synchronous and accept a pre-built `EngineeringPackage`.

### `validationStatus(pkg: EngineeringPackage): ExecutionValidation[]`

Returns all validations in two populations:

1. **Governance compliance evaluations** — one `ExecutionValidation` per entry in
   `pkg.blueprint.compliance.evaluations`. Connection is CONNECTED for COMPLIANT/VIOLATED,
   NOT_CONNECTED for PARTIAL/UNKNOWN. Each carries a `reuse` evidence citing
   `lcis-governance:ComplianceService.<rule.id>`.

2. **Per-task gate validations** — one `ExecutionValidation` per unique `task.gate` across
   `pkg.tasks`. All are `PENDING NOT_CONNECTED` with `liveSource: 'GitHub Actions CI (validator gate run)'`.
   Duplicate gates are deduplicated (one entry per gate name).

```ts
validationStatus(pkg: EngineeringPackage): ExecutionValidation[]
```

`ExecutionValidation` shape (from `packages/lcis-orchestration/src/shared/types.ts`):

```ts
export interface ExecutionValidation {
  readonly id: string;
  readonly subject: string;
  readonly gate: string;
  readonly status: ValidationStatus;           // 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED'
  readonly connection: Connection;             // 'CONNECTED' | 'NOT_CONNECTED'
  readonly severity: Severity;
  readonly liveSource: string | null;
  readonly evidence: readonly Evidence[];
}
```

### `validatorHealth(pkg: EngineeringPackage): ExecutionHealth`

Computes `ExecutionHealth` for the `'validation'` area. Score is CONNECTED (derived from
`pkg.blueprint.compliance.score` minus a penalty per violation):

```ts
validatorHealth(pkg: EngineeringPackage): ExecutionHealth
```

- `score` = `max(0, compliance.score − violations.length × 5)`, rounded.
- `band`: `'healthy'` (≥ 80), `'degraded'` (≥ 50), `'failing'` (< 50).
- `connectedSignals: 2` — `compliance.score` and `violations.length`.
- `notConnectedSignals` — count of unique task gates (each gate's live CI run is NOT_CONNECTED).

### `failedValidations(pkg: EngineeringPackage): ExecutionFinding[]`

Emits **EO03** findings (`category: 'validation'`, `rule: 'EO03'`, `severity: 'critical'`) for:

1. Each entry in `pkg.blueprint.compliance.violations` — `connection: 'CONNECTED'`, evidence
   cites `lcis-governance:ComplianceService.violations`.
2. Each entry in `pkg.blueprint.security.findings` — `kind: 'security-drift:<kind>'`,
   evidence cites `lcis-governance:SecurityDriftService.findings`.

```ts
failedValidations(pkg: EngineeringPackage): ExecutionFinding[]
```

All findings from this method are CONNECTED — they are structural evaluations from
`lcis-governance`, not live CI results.

### `pendingValidations(pkg: EngineeringPackage): ExecutionValidation[]`

Filter of `validationStatus(pkg)` returning only validations where
`connection === 'NOT_CONNECTED'`. Every per-task gate validation and every PARTIAL/UNKNOWN
compliance evaluation is included.

```ts
pendingValidations(pkg: EngineeringPackage): ExecutionValidation[]
```

These are the validations that require a live execution-tracking adapter (GitHub Actions CI)
to resolve.

### `validationTimeline(pkg: EngineeringPackage): ExecutionValidation[]`

Returns all validations ordered in build sequence:

1. Compliance validations (rule R001–R008) sorted lexicographically by `gate` (rule id).
2. Gate validations sorted by the position of their first associated task in
   `pkg.graph.implementationOrder` (Kahn topological order from `lcis-engineering`).

```ts
validationTimeline(pkg: EngineeringPackage): ExecutionValidation[]
```

This gives the order in which gates should be satisfied during an actual implementation run.

### `verificationCoverage(pkg: EngineeringPackage): ExecutionFinding[]`

Emits **EO08** findings (`category: 'verification'`, `rule: 'EO08'`, `severity: 'high'`) for
every readiness factor across `pkg.blueprint.readiness.scores` where `factor.present === false`
or `factor.present === 'UNKNOWN'`:

```ts
verificationCoverage(pkg: EngineeringPackage): ExecutionFinding[]
```

- `present === false` → `connection: 'CONNECTED'`, `kind: 'verification-gap:missing:<key>'` —
  the structural readiness evaluation from `lcis-governance` confirms the gap is real.
- `present === 'UNKNOWN'` → `connection: 'NOT_CONNECTED'`, `kind: 'verification-gap:unknown:<key>'`,
  `confidence: 0` — undeterminable from the static graph; would need `CI test suite / coverage tool`.

Evidence cites `lcis-governance:ReadinessService.<factor.key>` in both cases.

### `generateValidationReport(pkg: EngineeringPackage): ValidationReport`

Composes all of the above into a `ValidationReport` stamped with provenance via `execution()`:

```ts
generateValidationReport(pkg: EngineeringPackage): ValidationReport
```

```ts
export interface ValidationReport extends OrchestrationArtifact {
  readonly request: FeatureRequest;
  readonly validations: readonly ExecutionValidation[];
  readonly findings: readonly ExecutionFinding[];
  readonly health: ExecutionHealth;
  readonly summary: string;
}
```

- `validations` = `validationStatus(pkg)` (governance evaluations + per-task gate entries).
- `findings` = `failedValidations(pkg)` ++ `verificationCoverage(pkg)` (EO03 + EO08).
- `health` = `validatorHealth(pkg)`.
- `liveConnected: false` always — no live tracker is wired.
- Evidence carries both a `reuse` citation
  (`lcis-governance:ComplianceService + SecurityDriftService + ReadinessService`) and a
  `notConnected` citation (`validation:ci-gate-runs / GitHub Actions CI (validator gate run)`).
- Summary string reports pass/fail/pending counts, compliance score, violation count, security
  finding count, and explicitly states `Live CI gate results NOT_CONNECTED`.

---

## Rules Emitted

| Rule | Category | Severity | When emitted |
|---|---|---|---|
| **EO03** | `validation` | `critical` | Compliance violations (`pkg.blueprint.compliance.violations`) and security drift findings (`pkg.blueprint.security.findings`) — all CONNECTED |
| **EO08** | `verification` | `high` | Readiness factors absent (`present === false`) or undeterminable (`present === 'UNKNOWN'`) — CONNECTED or NOT_CONNECTED respectively |

---

## How the Facade and Access Layers Expose This Service

### Facade: `ExecutionOrchestrationEngine`

```ts
// packages/lcis-orchestration/src/engine/ExecutionOrchestrationEngine.ts
readonly validation: ValidationIntelligenceService;

async generateValidationReport(input: OrchestrationInput): Promise<ValidationReport>
// resolves the EngineeringPackage, then calls this.validation.generateValidationReport(pkg)
```

`validatorHealth(pkg)` is composed into the `HealthReport` alongside three other areas:

```ts
async generateHealthReport(input: OrchestrationInput): Promise<HealthReport>
// mergeHealth([execution.health, agent.health, validation.health, rollout.health])
```

In `generateFullExecutionPackage`, the validation report is one of seven service outputs that
compose the `ExecutionPackage.validation` field.

### CLI (`packages/lcis-cli`)

Planned surface: `lcis execution validation <text...>` — follows the EINS command pattern
(calls `getOrchestrationEngine()`, builds `FeatureRequest`, emits via `emitEins`).

### MCP (`packages/lcis-mcp`)

Planned tool: `lcis_execution_validation` — one of 7 `lcis_execution_*` tools in the EAOS
tool group. Follows the `ToolDef` pattern; handler calls
`getOrchestrationEngine().generateValidationReport(req)` and returns `toText(result, ...)`.

### API (`services/lcis-api`)

Planned route: `POST /execution/validation` — body `{ text, domains?, tables?, symbols? }`,
calls `getOrchestrationEngine().generateValidationReport(...)`, wraps result in `envelope(...)`.

### PR-Check V6 (`packages/lcis-pr-check`)

The `validation-health` dimension of `ExecutionVerdict` is populated from `validatorHealth`
and `failedValidations`. It contributes to the `## LCIS EXECUTION` section alongside five
other verdicts: `execution-readiness`, `execution-health`, `rollout-health`,
`artifact-health`, `agent-health`.

---

## Composition and Honesty Constraints

**EAOS composes; it does not reimplement.** Compliance evaluation, drift detection, and
readiness scoring are all done upstream in `lcis-governance`. This service reads the results
from `pkg.blueprint.*` and maps them to EAOS's `ValidationStatus` vocabulary. Every
evidence entry calling `this.eb.reuse('lcis-governance', ...)` is the proof of that composition.

**No new engine.** `ValidationIntelligenceService` carries no evaluation logic of its own
beyond the `ComplianceStatus → ValidationStatus` mapping and the EO03/EO08 finding
constructors.

**Honest NOT_CONNECTED.** Every live signal (GitHub Actions CI run results, test pass counts,
coverage percentages) is named explicitly and carries `connection: 'NOT_CONNECTED'` with
`confidence: 0`. The service never fabricates a completion percentage or a test count.

---

## Limitations

- Per-task gate CI run results (`PENDING NOT_CONNECTED`) cannot be resolved without wiring a
  GitHub Actions adapter that feeds real run IDs into a future execution-tracking store.
- `verificationCoverage` findings for `present === 'UNKNOWN'` factors require a live probe
  (`CI test suite / coverage tool`) to determine actual presence; the static graph cannot do so.
- `validatorHealth` score is a structural approximation based on `compliance.score` and
  violation count — it does not reflect live CI gate pass rates, which are NOT_CONNECTED.
- All `ValidationReport` outputs have `liveConnected: false`; the flag becomes `true` only
  when a real execution-tracking adapter is wired and supplies run-state to a future version.

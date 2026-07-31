# ARTIFACT_GUIDE — ArtifactIntelligenceService

**Package:** `@letbuyy/lcis-orchestration`
**File:** `packages/lcis-orchestration/src/artifact/ArtifactIntelligenceService.ts`
**Phase:** EAOS Phase 8 — Execution & Agent Orchestration System

---

## Purpose

`ArtifactIntelligenceService` derives the planned artifact surface of an EINS
`EngineeringPackage`, checks for drift against the live structural catalog, and reports
missing coverage across the 12 engineering layers. It answers:

- What artifact does each task plan to produce, and where?
- How many artifacts are planned vs actually produced?
- Does a planned artifact modify an existing RPC or route (drift risk)?
- Which engineering layers have no producing task (missing coverage)?
- What gate must each artifact pass?
- What is the full lineage (task → path → gate → dependencies)?
- Has the planned artifact been accepted?

The service is **read-only and deterministic** — no fetch, no exec, no spawn, no writeFile,
no network, no DB mutation. It is a pure synchronous transform. No AI or embeddings.

> **EAOS principle:** EAOS TRACKS execution; it NEVER executes. Humans/agents execute.
> The PLAN is CONNECTED; actual on-disk artifact existence is NOT_CONNECTED.

---

## Questions Answered

| Question | Method | Connection |
|---|---|---|
| What artifact does each task plan to produce? | `plannedArtifacts` | NOT_CONNECTED (planned path CONNECTED; existence NOT_CONNECTED) |
| How many artifacts are planned vs produced? | `artifactCoverage` | NOT_CONNECTED (planned count CONNECTED; produced count NOT_CONNECTED) |
| Did each artifact's gate pass? | `artifactValidation` | NOT_CONNECTED |
| Was each artifact reviewed and accepted? | `artifactAcceptance` | NOT_CONNECTED |
| Does this plan touch existing RPCs or routes? | `artifactDrift` | CONNECTED (structural catalog comparison) |
| Which layers have no producing task? | `missingArtifacts` | CONNECTED (structural gap detection) |
| Task → planned path → gate → dependencies lineage? | `artifactLineage` | CONNECTED |
| Full artifact report with findings and coverage | `generateArtifactReport` | CONNECTED (structural); NOT_CONNECTED (existence) |

---

## Layer → Artifact Kind Mapping

The service maintains a frozen mapping from `EngineeringLayer` to artifact kind, planned path
pattern, live existence source, and governance gate. The complete table as implemented:

| Layer | `kind` | Planned path pattern | Gate | NOT_CONNECTED live source |
|---|---|---|---|---|
| `migration` | `sql-migration` | `supabase/migrations/${taskId}.sql` | `rollback-integrity-validator` | `fs.existsSync(supabase/migrations/*.sql) or git status at EAOS execution time` |
| `rpc` | `sql-rpc` | `graphify-out/db-intel.json → .functions[name=${taskId}]` | `canonical-ledger-only-validator` | `graphify-out/db-intel.json probe at EAOS execution time (pnpm graph:db)` |
| `gateway` | `route-ts` | `apps/*/src/app/api/**/${taskId}/route.ts` | `route-ownership lockstep` | `find apps/*/src/app/api -name "route.ts" at EAOS execution time` |
| `proxy` | `route-ts` | `apps/*/src/app/api/**/${taskId}/route.ts` | `route-ownership lockstep` | `find apps/*/src/app/api -name "route.ts" at EAOS execution time` |
| `ui` | `component-tsx` | `apps/*/src/components/${taskId}.tsx` | `design-system ratchet` | `find apps/*/src -name "*.tsx" at EAOS execution time` |
| `worker` | `worker-ts` | `services/*/src/${taskId}.ts` | `worker-runbook-gate` | `find services/*/src -name "*.ts" at EAOS execution time (wrangler deployments list)` |
| `queue` | `worker-binding` | `services/queue-workers/src/${taskId}.ts` | `worker-runbook-gate` | `find services/queue-workers/src -name "*.ts" at EAOS execution time` |
| `event` | `event-binding` | `services/event-bus/${taskId}.ts` | `worker-runbook-gate` | `services/event-bus/ is reserved/NOT_IMPLEMENTED; probe deferred until scoped` |
| `test` | `test-ts` | `tests/launch/${taskId}.test.mjs` | `107+ validator gate` | `pnpm validate / gh run view at EAOS execution time` |
| `docs` | `markdown-doc` | `docs/${taskId}.md` | `governance-memory-validator` | `find docs -name "*.md" at EAOS execution time` |
| `verification` | `validator-gate` | `scripts/validators/${taskId}-validator.mjs` | `107+ validator gate` | `find scripts/validators -name "*.mjs" at EAOS execution time` |
| `launch` | `launch-artifact` | `graphify-out/production-readiness-v2.json` | `production-readiness-v2` | `graphify-out/production-readiness-v2.json at EAOS execution time (pnpm graph:omega)` |

`${taskId}` is slugified (`id.toLowerCase().replace(/[^a-z0-9]+/g, '-')`).

---

## Constructor

```ts
constructor(
  private readonly core: LcisEngine,
  private readonly now: () => string = () => new Date().toISOString(),
)
```

`core` is used to construct `OrchestrationArtifactStore` (the structural catalog reader for
drift detection). It is not queried for live data.

---

## Public API

### `plannedArtifacts(pkg: EngineeringPackage): ExecutionArtifact[]`

Maps each `EngineeringTask` in `pkg.tasks` to one `ExecutionArtifact`.

```ts
plannedArtifacts(pkg: EngineeringPackage): ExecutionArtifact[]
```

- `plannedPath` is CONNECTED (derived deterministically from `task.layer` + slugified
  `task.id` via the `LAYER_PATH_PATTERN` map).
- `status` is always `'PLANNED'` — on-disk existence is NOT_CONNECTED.
- `connection: 'NOT_CONNECTED'` on every artifact; `liveSource` names the exact probe
  command for each layer (see table above).
- Evidence: `ev.task(task.id, ...)` + `ev.notConnected(...)`.

### `artifactCoverage(pkg: EngineeringPackage): ProgressMetric`

Returns a `ProgressMetric` describing overall artifact coverage.

```ts
artifactCoverage(pkg: EngineeringPackage): ProgressMetric
```

| Field | Value | Connection |
|---|---|---|
| `label` | `'Planned artifacts'` | — |
| `planned` | `pkg.tasks.length` | **CONNECTED** |
| `completed` | `null` | **NOT_CONNECTED** |
| `connection` | `'NOT_CONNECTED'` | — |
| `liveSource` | `'fs/git scan at EAOS execution time (git status / CI artifact manifest)'` | — |

`completed` is never fabricated — it requires a filesystem or CI artifact manifest scan
that does not exist in EAOS Phase 8.

### `artifactValidation(pkg: EngineeringPackage): ExecutionValidation[]`

Returns one `ExecutionValidation` per task. The planned gate is CONNECTED (declared in
`task.gate` or via the `LAYER_GATE` map); whether CI actually ran and passed is NOT_CONNECTED.

```ts
artifactValidation(pkg: EngineeringPackage): ExecutionValidation[]
```

| Field | Value | Connection |
|---|---|---|
| `gate` | `task.gate \|\| LAYER_GATE[task.layer]` | **CONNECTED** (gate name) |
| `status` | `'PENDING'` | **CONNECTED** (starting state; live run = NOT_CONNECTED) |
| `connection` | `'NOT_CONNECTED'` | — |
| `severity` | `'medium'` | — |
| `liveSource` | `'GitHub Actions run log / pnpm validate at EAOS execution time'` | — |

### `artifactAcceptance(_pkg: EngineeringPackage)`

**Entirely NOT_CONNECTED.** Artifact acceptance requires a live review/acceptance tracker
(PR review status, Figma handoff sign-off, or execution-tracking store) — none wired in
Phase 8.

```ts
artifactAcceptance(_pkg: EngineeringPackage): {
  connection: 'NOT_CONNECTED';
  liveSource: string;   // 'PR review status / Figma handoff sign-off / execution-tracking store'
  confidence: 0;
  detail: string;
}
```

### `artifactDrift(pkg: EngineeringPackage): ExecutionFinding[]`

Checks `rpc`, `gateway`, and `proxy` layer tasks against the structural catalog
(`OrchestrationArtifactStore.functions()` and `.routes()`). Raises **EO05** findings.

```ts
artifactDrift(pkg: EngineeringPackage): ExecutionFinding[]
```

Two finding kinds:

| Kind | Severity | Condition | Connection |
|---|---|---|---|
| `modifies-existing-artifact` | `medium` | Planned slug matches an existing RPC function or route — change-control required | **CONNECTED** |
| `net-new-artifact` | `info` | Planned slug is NOT in the structural catalog — expected for a new feature | **CONNECTED** |

- Catalog source: `graphify-out/db-intel.json → .functions` for RPC; `graphify-out/domain-intel.json → .routes` for gateway/proxy.
- `confidence: 0.8` for existing-artifact matches; `0.9` for net-new.
- On-disk existence of the planned artifact itself remains NOT_CONNECTED regardless of which kind is raised.

### `missingArtifacts(pkg: EngineeringPackage): ExecutionFinding[]`

Checks all 12 layers (`migration | rpc | gateway | proxy | ui | worker | queue | event | test | docs | verification | launch`) and raises **EO04** for any layer with no producing task in `pkg.tasks`.

```ts
missingArtifacts(pkg: EngineeringPackage): ExecutionFinding[]
```

Finding shape (EO04):

| Field | Value |
|---|---|
| `category` | `'artifact'` |
| `kind` | `'missing-artifact-layer'` |
| `severity` | `'medium'` (from `ExecutionSeverityScorer.forFinding({ missingArtifact: true })`) |
| `rule` | `'EO04'` |
| `connection` | `'CONNECTED'` |
| `confidence` | `0.85` |

The structural gap (no task covering a layer) is CONNECTED. Whether a file was produced
outside the plan is NOT_CONNECTED.

### `artifactLineage(pkg: EngineeringPackage)`

Returns the full planning lineage for each task: planned path, gate, and dependency chain.
CONNECTED — pure structural transform.

```ts
artifactLineage(pkg: EngineeringPackage): readonly {
  taskId:      string;
  layer:       EngineeringLayer;
  plannedPath: string;
  gate:        string;
  dependsOn:   readonly string[];
}[]
```

Useful for tracing the build order constraint for a given artifact: which artifacts must
exist before this one can be created.

### `generateArtifactReport(pkg: EngineeringPackage): ArtifactReport`

Composes all of the above into a stamped `ArtifactReport` via the `execution()` envelope.

```ts
generateArtifactReport(pkg: EngineeringPackage): ArtifactReport
```

Composition: `plannedArtifacts + artifactDrift findings + missingArtifacts findings + artifactCoverage`.

`byLayer` is a count of planned artifacts per layer (e.g. `{ migration: 1, rpc: 2, gateway: 1, test: 1 }`).

Summary example:
> `"3 planned artifacts across 3 layers. 1 layer without a producing task (EO04). 1 artifact touches existing catalog entries — change-control required (EO05). On-disk existence is NOT_CONNECTED — probe at EAOS execution time."`

`liveConnected` is always `false`.

---

## CONNECTED vs NOT_CONNECTED Signals

| Signal | Status | Exact source if NOT_CONNECTED |
|---|---|---|
| Planned artifact paths (all layers) | **CONNECTED** | `LAYER_PATH_PATTERN` + slugified task id |
| Gate names per artifact | **CONNECTED** | `task.gate` or `LAYER_GATE[task.layer]` |
| Missing layer coverage (EO04) | **CONNECTED** | cross-check `pkg.tasks` against all 12 layers |
| Drift against existing RPCs/routes (EO05) | **CONNECTED** | `OrchestrationArtifactStore` (structural catalog) |
| Artifact lineage (path + gate + dependsOn) | **CONNECTED** | `pkg.tasks` — static plan |
| Planned artifact count | **CONNECTED** | `pkg.tasks.length` |
| Artifact actually exists on disk | **NOT_CONNECTED** | layer-specific probe command (see table above) |
| Artifact validation/CI gate passed | **NOT_CONNECTED** | `GitHub Actions run log / pnpm validate at EAOS execution time` |
| Artifact produced/completed count | **NOT_CONNECTED** | `fs/git scan at EAOS execution time (git status / CI artifact manifest)` |
| Artifact accepted (review sign-off) | **NOT_CONNECTED** | `PR review status / Figma handoff sign-off / execution-tracking store` |
| Artifact created/updated timestamps | **NOT_CONNECTED** | git commit history at EAOS execution time |

`liveConnected` is always `false` on every report. No live tracker is wired in Phase 8.

---

## Findings Emitted

| Rule | Condition | Severity | Category |
|---|---|---|---|
| EO04 | No task covers a given engineering layer | `medium` | `artifact` |
| EO05 | Planned RPC/route slug matches existing structural catalog entry | `medium` | `drift` |
| EO05 | Planned RPC/route slug is net-new (not in catalog) | `info` | `drift` |

---

## Access Layers

### CLI

```
lcis execution report   → ArtifactReport in ExecutionPackage.artifact
lcis execution status   → coverage ProgressMetric from artifactCoverage
lcis execution blockers → EO04 missing-layer findings surfaced
lcis execution health   → artifact health via ArtifactReport.coverage
```

### MCP

```
lcis_execution_report     → ArtifactReport (via ExecutionOrchestrationEngine.generateArtifactReport)
lcis_execution_blockers   → EO04 missing-artifact findings
lcis_execution_health     → coverage signal in health
lcis_execution_status     → artifact coverage ProgressMetric
```

### API

```
POST /execution/report    → ArtifactReport in ExecutionPackage.artifact
POST /execution/status    → artifact coverage in StatusReport.metrics
POST /execution/blockers  → EO04 missing-artifact findings
```

### PR-check V6

The `## LCIS EXECUTION` section includes an **artifact-health** verdict:

- PASS when no EO04 missing-layer findings and no high-severity EO05 drift findings
- WARN when EO05 `modifies-existing-artifact` findings exist (change-control required)
- FAIL when EO04 findings cover critical layers (migration / test) or multiple layers missing
- UNKNOWN when `pkg.tasks` is empty

### Facade (ExecutionOrchestrationEngine)

```ts
engine.artifact.generateArtifactReport(pkg)  // direct service access
engine.generateArtifactReport(input)          // via facade (resolves pkg first)
engine.generateFullExecutionPackage(input)    // ExecutionPackage.artifact
```

---

## Composition and Reuse

`ArtifactIntelligenceService` does not re-implement any prior LCIS system:

| Used symbol | From | How used |
|---|---|---|
| `pkg.tasks` | lcis-engineering | All artifact mappings, coverage, lineage |
| `OrchestrationArtifactStore` | EAOS shared | Structural catalog for drift detection (functions + routes) |
| `ExecutionEvidenceBuilder` | EAOS shared | Typed evidence constructors |
| `ExecutionSeverityScorer` | EAOS shared | Severity for EO04/EO05 findings |
| `execution()` envelope | EAOS shared | Provenance stamping on the report |
| `evidence()` (lcis-core) | lcis-core | Direct use in `missingArtifacts` for layer-gap evidence |

---

## Honest Limitations

- **On-disk existence is never verified.** Every `ExecutionArtifact` carries
  `status: 'PLANNED'` and `connection: 'NOT_CONNECTED'`. No filesystem probe, git scan,
  or CI artifact query is performed. The `liveSource` field names exactly what probe would
  be needed for each layer.
- **Drift detection covers only RPC and route layers.** `artifactDrift` checks `rpc`,
  `gateway`, and `proxy` against the structural catalog. Other layers (`migration`, `ui`,
  `test`, `docs`, `worker`, `queue`, `event`, `verification`, `launch`) are catalogued as
  net-new or missing but not compared against an existing inventory, because no equivalent
  structural catalog for those layers is available in `OrchestrationArtifactStore`.
- **`event` layer is reserved.** `services/event-bus/` is `NOT_IMPLEMENTED` in the
  canonical runtime map; its probe is deferred until the layer is scoped.
- **Missing-layer findings are intent-based.** EO04 flags a layer with no producing task
  as a structural gap. Whether it is truly missing (versus intentionally omitted) requires
  human review.
- **Acceptance is entirely NOT_CONNECTED.** No PR review, Figma handoff, or
  execution-tracking store is wired; `artifactAcceptance` always returns
  `{ connection: 'NOT_CONNECTED', confidence: 0 }`.

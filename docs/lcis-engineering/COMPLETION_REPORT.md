# EINS (LCIS Phase 7) — Completion Report

**Package:** `@letbuyy/lcis-engineering`
**Date completed:** 2026-06-21
**Authoritative test result:** 2613 pass / 0 fail across 11 LCIS packages — typecheck clean

---

## Primary Question EINS Answers

> **"What exactly must be changed to safely implement a feature?"**

EINS is a read-only, deterministic synthesis layer. It composes the five prior LCIS systems (lcis-core, lcis-execution, lcis-governance, lcis-operations, lcis-live) and produces a single unified engineering package: impact + every reused plan (change/migration/tests/verification/rollback/launch) + governance gates + operational context + an ordered task list + an agent plan + an engineering dependency graph + a `GO / CONDITIONAL_GO / NO_GO` decision with blockers.

EINS **plans**. It never executes, generates code, modifies files, runs migrations, or deploys.

---

## "Build GST Filing" Full Output (engine.test.ts fixture)

`eins.generateFullEngineeringPackage({ text: 'Build GST Filing', domains: ['payments'] })` returns an `EngineeringPackage` containing:

- **blueprint.impact** — affected domains (payments + tax), tables (payment_transactions, gst_invoice_*), services, RPCs, workers, complexity band, risk level (money = true, tenant = true).
- **blueprint.change** — delegated `ChangeAnalysis` from lcis-execution (`eis.changeSurface`) citing affected symbols and blast radius.
- **blueprint.migration** — delegated `MigrationPlan` from lcis-execution; E001 (canonical-ledger-only-validator) and E002 (RLS + site_id) gates emitted.
- **blueprint.tests** — delegated `TestPlan` from lcis-execution.
- **blueprint.verification** — delegated `VerificationPlan` from lcis-execution.
- **blueprint.rollback** — delegated `RollbackPlan` from lcis-execution with readiness assessment.
- **blueprint.launch** — delegated `LaunchPlan` from lcis-execution; decision `CONDITIONAL_GO` or `NO_GO` (money path → never bare `GO`).
- **blueprint.executionGraph** — delegated `ExecutionGraph` from lcis-execution.
- **blueprint.ownership** — delegated `OwnershipReport` from lcis-governance.
- **blueprint.compliance** — delegated `ComplianceReport` from lcis-governance (R001–R008 gates).
- **blueprint.security** — delegated `SecurityDriftReport` from lcis-governance.
- **blueprint.readiness** — delegated `ReadinessReport` from lcis-governance.
- **blueprint.operations** — delegated `OperationsReport` from lcis-operations.
- **blueprint.gates** — merged findings from all services: E001 (critical) + E005 (high) + E002 (critical) + E008 where applicable.
- **tasks** — ordered `EngineeringTask[]`: migration (gst_invoice schema) → rpc (compute_gst RPC) → gateway (/v1/gst) → ui (GST invoice UI) → test → docs → verification → launch; all with `dependsOn`, `gate`, `agentType`, `evidence`.
- **agentPlan** — 1:1 agent tasks from the task list grouped by `agentType`.
- **graph** — `EngineeringGraph` with topo order, critical path, parallelizable set, blocked set, milestones per layer boundary.
- **decision** — `{ verdict: 'CONDITIONAL_GO', blockers: ['[E001] Money mutations route through a canonical SECURITY DEFINER RPC', ...] }`.
- **summary** — human-readable one-liner: `"Engineering package for "Build GST Filing": N task(s) across M milestone(s), K agent task(s); decision CONDITIONAL_GO (2 blocker(s))."`.
- **evidence / confidence / sources / timestamp** — full provenance on the envelope itself.

---

## Architecture

### Package structure

```
packages/lcis-engineering/
  src/
    shared/          # FROZEN foundation (types, rules, artifact-store, evidence,
                     #   confidence, severity, finding, envelope)
    feature/         # FeatureIntelligenceService
    change/          # ChangeIntelligenceService
    migration/       # MigrationIntelligenceService
    verification/    # VerificationIntelligenceService
    launch/          # LaunchIntelligenceService
    rollback/        # RollbackIntelligenceService
    task/            # TaskIntelligenceService  [net-new logic]
    agent/           # AgentIntelligenceService [net-new logic]
    graph/           # EngineeringGraphService  [net-new logic]
    engine.ts        # EngineeringEngine facade (composition root)
    index.ts         # Public exports
  test/
    foundation.test.ts  change.test.ts    feature.test.ts
    migration.test.ts   verification.test.ts  launch.test.ts
    rollback.test.ts    task.test.ts      agent.test.ts
    graph.test.ts       engine.test.ts
```

### Dependencies

```json
{
  "@letbuyy/lcis-core":        "workspace:*",
  "@letbuyy/lcis-live":        "workspace:*",
  "@letbuyy/lcis-execution":   "workspace:*",
  "@letbuyy/lcis-governance":  "workspace:*",
  "@letbuyy/lcis-operations":  "workspace:*",
  "zod":                       "^4.3.6"
}
```

No new engines, no AI/embeddings/vector-DB dependencies.

---

## Discovery-First Multi-Agent Execution

Before any code was written, Phase 7 executed a six-document discovery mission:

| Doc | What it mapped |
|---|---|
| `EINS_FEATURE_ARCHITECTURE_DISCOVERY.md` | FeatureRequest shape, impact normalization, layer anatomy |
| `EINS_EXECUTION_PATTERN_DISCOVERY.md` | How to delegate into EIS without reimplementing |
| `EINS_GOVERNANCE_DISCOVERY.md` | R001–R008 rule operationalization as E001–E008 |
| `EINS_OPERATIONS_DISCOVERY.md` | Operational context embedding pattern |
| `EINS_REPOSITORY_CONSTRUCTION_DISCOVERY.md` | Task ordering, layer build sequence, DAG synthesis |
| `EINS_CAPABILITY_MATRIX.json` | Full capability matrix (CLI/MCP/API/PR-check surface) |

The foundation types (`shared/types.ts`) and rules (`E001–E008`) were frozen from the discovery docs before any service was written. The 8 service agents ran in parallel against the frozen contract.

---

## Key Decisions and Tradeoffs

### Compose-not-duplicate via delegation-equality tests
Every service that reuses a prior LCIS system (lcis-execution, lcis-governance, lcis-operations) is tested with a delegation-equality assertion: the service's output content must deep-equal the raw output from the composed engine method. This enforces that EINS adds framing and provenance metadata but never re-implements reasoning. The reuse-evidence citation (`ref = '<system>:<method>'`, `source = 'packages/<system>'`) is asserted in every service test.

### Net-new logic only for task ordering, agent graph, engineering graph
The only code in EINS that is not a delegation wrapper is:
- `TaskIntelligenceService` — synthesizes an ordered `EngineeringTask[]` across 12 layers from the feature impact, enforcing canonical build order and gate assignment.
- `AgentIntelligenceService` — maps tasks to typed agent tasks with acceptance criteria.
- `EngineeringGraphService` — pure DAG / topological sort / critical path / parallelizable-set synthesis over a task array.

### `FeatureRequest` ≈ `ChangeRequest`
`FeatureRequest` was intentionally given the identical field shape as `lcis-execution`'s `ChangeRequest` (`text`, `domains`, `tables`, `symbols`, `files`). This means the same seed data flows through EINS services and the delegated EIS calls without transformation, removing an entire class of mapping bugs. The type alias is explicit in `shared/types.ts`.

### `GO / CONDITIONAL_GO / NO_GO` decision derivation
The decision in `generateFullEngineeringPackage` is derived from two signals:
1. `blueprint.launch.decision.decision` (the EIS launch verdict, delegated from lcis-execution).
2. `blueprint.gates` severity distribution (EINS-layer E001–E008 critical/high findings).

Logic: `NO_GO` if `launchVerdict === 'NO_GO'` or any critical gate; `CONDITIONAL_GO` if `launchVerdict === 'CONDITIONAL_GO'` or any high-severity gate; `GO` only when both launchers and gates are clean. This means a money feature can never reach `GO` (E001 is `critical`), which is intentional.

### `eng-verify` naming
The CLI command for `generateVerificationPlan` is named `lcis eng-verify`, not `lcis verify`. `lcis verify` was introduced in Phase 2 (lcis-core verification against the governance ruleset). Reusing the name would create a silent collision. The rename is documented in the CLI source comment.

### Honest unresolved / empty
When a `FeatureRequest` cannot be resolved to any real domain or table (e.g., free-text that matches nothing in `graphify-out`), every service returns `unresolved = true` and honest empty sets — never fabricated evidence. This is enforced by test assertions in all 8 service suites.

### Determinism
Determinism is a first-class contract. All 8 service tests + the engine facade test assert that `deepEqual(call1, call2)` for the same request + fixed `now` clock. This property is preserved because EINS is purely synchronous graph traversal with no randomness or external I/O.

---

## Read-Only Security Posture

Every service implementation file is scanned for forbidden IO keywords by a source-scan test in its test suite. The forbidden list: `fetch`, `child_process`, `spawn`, `exec`, `eval`, `writeFile`, `appendFile`, `unlink`, `rmdir`, `mkdir`. Zero violations found. The package has no server, no HTTP client, no DB client, no filesystem writer, and no subprocess launcher.

---

## Workspace and Dependency Changes

- `packages/lcis-engineering/` — new package, added to `pnpm-workspace.yaml`.
- `packages/lcis-cli/` — `@letbuyy/lcis-engineering` added to dependencies; 7 new commands.
- `packages/lcis-mcp/` — `@letbuyy/lcis-engineering` added to dependencies; 7 new tools; registry total 42.
- `packages/lcis-pr-check/` — `@letbuyy/lcis-engineering` added to dependencies; `analyzeWithEngineering` + `EngineeringVerdict` type + `## LCIS ENGINEERING` comment section.
- `lcis-api` (graph-server HTTP layer) — 7 `POST /engineering/*` routes added.

No changes to `lcis-core`, `lcis-adapters`, `lcis-live`, `lcis-execution`, `lcis-governance`, `lcis-operations`.

---

## What Was NOT Built

- No new engine or reasoning model. EINS is pure composition.
- No AI, embeddings, vector-DB, semantic search, or ML inference.
- No autonomous actions. EINS never proposes its own actions or self-executes.
- No code generation. EINS produces task descriptions, not source code.
- No file modification. EINS reads `graphify-out` artifacts; it never writes them.
- No migration execution. Migration plans are read-only analysis.
- No deployment. No Vercel, Cloudflare Workers, or Docker interaction.
- No new live-data adapters. lcis-live is reused as-is; EINS does not probe any live service.
- No lcis-v2 / tools/central-intelligence integration. EINS is in the packages/ layer only.
- No LCIS UI / atlas surface. EINS is CLI/MCP/API/PR-check accessible only.
- No diff-based analysis (PR file diff parsing). EINS analyzes feature requests, not raw diffs (the PR-check layer maps diffs to FeatureRequests before calling EINS).

---

## Authoritative Test Results

```
2613 pass / 0 fail
Typecheck: clean (tsc --noEmit across all 11 LCIS packages)
```

Per-package breakdown: see TEST_REPORT.md.

---

## Honest Gaps and Limitations

- **Live data is NOT CONNECTED.** EINS composes structural intelligence from `graphify-out`. Impact scores, affected sets, and complexity bands reflect the graph topology, not live traffic or real error rates. Every output embeds `evidence` + `sources` that trace to specific graph artifacts, not to telemetry.
- **Task ordering is heuristic.** The canonical build sequence (migration → rpc → gateway → … → launch) is correct for most LetBuyy features but may not capture exotic cross-domain dependency chains. The EngineeringGraphService `blocked` set catches dependency cycles; it does not guarantee a globally optimal schedule.
- **`FeatureRequest.text` is free text.** Resolution uses lcis-core's domain/symbol/table index. Ambiguous or very broad requests (e.g., "improve performance") return `unresolved = true` with honest empty sets rather than guess.
- **Blueprint embeds plans by value, not by reference.** Each call to `generateBlueprint` invokes the composed engines afresh. There is no caching; callers should cache at their layer if latency matters.
- **PR-check engineering verdicts are async.** `analyzeWithEngineering` is the async entry point; the sync `analyzePr`/`analyzeWithVerdicts`/`analyzeWithGovernance`/`analyzeWithOperations` paths return `engineeringVerdicts: []` for back-compat.

---

## Future Roadmap

EINS sits at the top of the deterministic LCIS stack:

```
LCOS (lcis-operations)   observes    — what is happening now in production
LCIS (lcis-core)         understands — what the graph looks like and what it means
EIS  (lcis-execution)    plans       — what a change entails (change/migration/test/rollback/launch)
GDIS (lcis-governance)   governs     — what the rules are and whether they are met
EINS (lcis-engineering)  engineers   — what exactly must be done to safely ship a feature
humans / agents          execute     — perform the actual changes under human approval
```

Near-term candidates (scope not approved):
- **Diff-to-feature mapping improvement**: auto-extract `FeatureRequest` fields from a PR diff so the PR-check `analyzeWithEngineering` call is richer.
- **Incremental task graph**: if a feature is partially implemented (some migrations already applied), EINS could filter the task list to remaining work by querying the graph's known symbol set.
- **Agent handoff format**: emit the `AgentPlan` in a machine-executable format that a multi-agent orchestrator (Claude Code SDK, LangGraph, etc.) can consume directly to spawn per-task agents.
- **Cost estimate**: surface approximate engineering effort (task count × complexity per layer) as a non-binding estimate in the package summary.
- **Live task status**: if a task-tracking integration is added to lcis-operations, EINS could annotate tasks with their current status (not implemented / in progress / done) from the operational graph.

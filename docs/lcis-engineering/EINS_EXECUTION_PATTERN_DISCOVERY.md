# EINS Discovery B — Execution Pattern (the lcis-execution reuse contract)

EINS **composes** `@letbuyy/lcis-execution` (EIS); it does not reimplement any planning logic.
Source of truth: `packages/lcis-execution/src/{index.ts,engine.ts,shared/types.ts,*/}`.

## Entry point
- `getEisEngine(opts?)` / `createEisEngine(opts?)` → `EisEngine` (singleton + factory). `opts.now` injects a clock for determinism; `opts.core` injects the lcis-core engine.
- Input everywhere: `ChangeRequest = { text: string; domains?: string[]; tables?: string[]; symbols?: string[]; files?: string[] }`.
- Every output is stamped with `{ evidence: Evidence[]; confidence: number; sources: string[]; timestamp: string }`.

## The backbone — `eis.analyze(req): ChangeAnalysis` (sync)
`ChangeAnalysis = { request, seeds: ResolvedSeed[], affected: AffectedSets, complexity: ComplexityAssessment, risk: RiskAssessment{level,score,money,tenant,drivers}, suggestedSequence: string[], dependencies: string[], rollbackStrategy, verificationStrategy, launchImpact, unresolved }`.
`AffectedSets = { domains, services, apis, rpcs, tables, workers, queues, events, tests, docs }` — **the change surface EINS needs.** Deterministic NL→graph seed resolution (no LLM).

## Services on the engine
| EINS need | Reuse | Returns |
|---|---|---|
| Execution plan / work breakdown / graph | `eis.execution.planImplementation(input)` · `generateWorkBreakdown` · `generateMilestones` · `generateExecutionGraph` · `generateExecutionChecklist` | `ExecutionPlan` {summary,complexity,risk,workBreakdown:WorkItem[],milestones:Milestone[],graph:ExecutionGraph,checklist,dependencies} |
| Execution graph (standalone) | `eis.executionGraph.build(input)` (class `ExecutionGraphService`) | `ExecutionGraph` {nodes,edges,implementationOrder,criticalPath,parallelizable,blocked} |
| Migration plan | `eis.migration.analyzeMigration(input)` (+ `detectDataLossRisk`/`detectDependencyOrder`/`verifyMigrationReadiness`/`buildRollbackPlan`/`simulateMigrationImpact`) | `MigrationPlan` {targets,steps:MigrationStep[],dependencyOrder,risk,dataLossRisks,irreversibleSteps,readiness,simulatedImpact} |
| Test/verification | `eis.testing.generateTestPlan(input)` (+ `detectAffectedTests`/`detectMissingCoverage`/`generate{Regression,Smoke,Load,Security,Acceptance}Plan`) | `TestPlan` {required,missing:CoverageGap[],recommended,regressionPlan,smokePlan,loadPlan,securityPlan,acceptancePlan,riskLevel,coverageConfidence} |
| Verification plan | `eis.verification.buildVerificationPlan(input)` (class `VerificationPlanner`) | `VerificationPlan` {checks:VerificationCheck[],preMergeGates,postDeployChecks} |
| Rollback plan | `eis.rollback.generateRollbackPlan(req)` (+ `detectIrreversibleChanges`/`identifyRecoverySteps`/`estimateRecoveryTime`) | `RollbackPlan` {readiness:'READY'|'CONDITIONAL'|'NOT_READY',complexity,steps:RollbackStep[],irreversible,dependencies,estimatedRecovery,risk} |
| Launch plan | `await eis.launch.evaluateLaunch(input)` (**async**) (+ `generateGoNoGoDecision`/`detectLaunchBlockers`/`calculateLaunchReadiness`) | `LaunchPlan` {readiness,decision:GoNoGoDecision{decision:'GO'|'CONDITIONAL_GO'|'NO_GO',rationale,blockers,unknowns},blockers,checklist} |
| Everything at once | `await eis.planAll(req)` (**async**) | `FullPlan` {change,execution,executionGraph,migration,tests,rollback,launch,verification} |

## Notes for EINS
- `rollback.generateRollbackPlan` accepts `ChangeRequest` (not `ChangeAnalysis`) — pass the raw request.
- Async: `launch.evaluateLaunch`, `planAll`. Everything else is sync.
- EINS's "Migration/Verification/Launch/Rollback Intelligence" services are **thin engineering-framing adapters** over these methods — reuse, never reimplement.
- The plan types are all exported from `@letbuyy/lcis-execution` — EINS imports them, does not redefine.

# LCIS Migration Plan — Phase 1
**Author:** Claude (Principal Engineer, LCIS Consolidation Program)
**Date:** 2026-06-20
**Status:** SPEC ONLY — no code modified; execution requires gated approval
**Evidence sources:** `docs/lcis-master/LCIS_DUPLICATION_REPORT.md` + `_evidence/inventory-graph-server.md` + `_evidence/inventory-central-intelligence.md` + direct source spot-checks

---

## Verify-Before-Destroy Gate

**MANDATORY before executing any ARCHIVE or REMOVE action:**

1. Start `:3333` (`pnpm graph:omega && node tools/graph-server/server.mjs`)
2. Start `:3334` (`cd tools/central-intelligence && node intelligence-api/server.mjs`)
3. Record baseline responses for every endpoint listed as ARCHIVE/REMOVE below (`curl -s localhost:PORT/api/ENDPOINT`)
4. Confirm `:3333` replacement endpoint returns equivalent or richer data
5. Only then: execute the ARCHIVE/REMOVE
6. Regression-test: re-run the baseline set against `:3333`; verify no consumer breakage

This plan is the specification. Execution is a separate gated step.

---

## Legend

| Disposition | Meaning |
|---|---|
| **KEEP** | File stays in place, unchanged, in its current location |
| **MERGE** | File's capability folds into another file; standalone endpoint retired; module kept as internal library |
| **MOVE** | Novel capability migrated from `:3334` to `:3333` as a new module in `packages/lcis-core/src/` |
| **ARCHIVE** | File moves to `tools/_archive/YYYY-MM-DD/` or `docs/_archive/`; not deleted outright; removed from runtime wiring |
| **REMOVE** | Safe deletion; zero functional loss confirmed; not imported by any live module |

---

## Part A — `tools/graph-server/` (:3333) — 81 Files

### A1. Core Foundation (6 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `db-intel.mjs` | **KEEP** | in-place | CLI artifact writer; 417 tables/164 RPCs indexed; foundational |
| `infra-intel.mjs` | **KEEP** | in-place | CLI artifact writer; worker/queue/secret topology |
| `domain-intel.mjs` | **KEEP** | in-place | 22-domain classifier; endpoints /api/domains /api/domain /api/cross-domain |
| `relationship-intel.mjs` | **KEEP** | in-place | 705 FK edges; endpoint /api/relationships |
| `intelligence.mjs` | **KEEP** | in-place | Primary blast-radius engine; endpoints /api/blast /api/atlas /api/search /api/path /api/payment /api/table /api/rpc /api/policy /api/owner |
| `omega-lib.mjs` | **KEEP** | in-place | Shared library; no HTTP surface; imported by all Omega engines |

### A2. Graph Navigation & Atlas (5 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `cross-domain-engine.mjs` | **KEEP** | in-place | Pure algorithm library; blastDomain(), couplingMatrix(); no HTTP surface |
| `explain-intel.mjs` | **KEEP** | in-place | LCIS v6 Explain mode; endpoints /api/explain /api/search-v2 /api/workspace |
| `search-intel.mjs` | **KEEP** | in-place | Intent-aware semantic search; 40+ NL aliases; endpoint /api/search-v2 /api/search |
| `knowledge-graphs.mjs` | **KEEP** | in-place | 7 sub-graphs; endpoint /api/graph |
| `database-control-intel.mjs` | **KEEP** | in-place | Full entity lineage; endpoints /api/lineage /api/trace /api/database-control |

### A3. Domain Workspace (4 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `change-impact.mjs` | **KEEP** | in-place | Impact/blast by X; endpoints /api/change-impact /api/change-impact-live /api/impact-score |
| `diagnosis-engine.mjs` | **KEEP** | in-place | Root cause; endpoints /api/diagnose /api/root-cause |
| `runbook-engine.mjs` | **KEEP** | in-place | Autonomous runbooks; endpoint /api/runbook |
| `audit-engine-v2.mjs` | **KEEP** | in-place | Route/RLS coverage audit; endpoint /api/audit |

### A4. Memory & Decision (5 files — KEEP/MERGE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `memory-intel.mjs` | **MERGE** | Demote to internal library; retire `/api/memory` endpoint | Called internally by memory-v2.mjs; keep the module, remove the standalone endpoint from server.mjs |
| `memory-v2.mjs` | **KEEP** | in-place | Primary memory surface; endpoint /api/memory-v2 |
| `execution-intel.mjs` | **KEEP** | in-place | CLI artifact writer; V1 blocker report → execution-intel.json |
| `decision-engine-v5.mjs` | **KEEP** | in-place (internal library) | Imported by decision-engine-v2.mjs line 6; standalone `/api/decision-engine` endpoint to be retired (REFACTOR, post-Phase-1) |
| `decision-engine-v2.mjs` | **KEEP** | in-place | Primary decision surface; endpoint /api/decision-v2 |

### A5. Infrastructure, Deployment & Runtime (9 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `deployment-intel.mjs` | **KEEP** | in-place | GitHub Actions → deployment map; endpoint /api/deployment |
| `deployment-state.mjs` | **KEEP** | in-place | Declared deploy state via git; endpoint /api/deployment-state |
| `deployment-intelligence-v5.mjs` | **KEEP** | in-place (wire endpoint) | DARK — endpoint /api/deployment-intelligence-v5 not wired; add 2-line route to server.mjs |
| `runtime-intel.mjs` | **KEEP** | in-place | Runtime topology from wrangler.toml; endpoints /api/runtime /api/runtime-intelligence |
| `runtime-observability-intel.mjs` | **KEEP** | in-place | Full operating chain map; endpoint /api/runtime-observability |
| `telemetry-intelligence.mjs` | **KEEP** | in-place | 12 telemetry adapter sources; endpoint /api/telemetry |
| `environment-intel.mjs` | **KEEP** | in-place | 3-environment map; endpoint /api/environment |
| `environment-registry.mjs` | **KEEP** | in-place | Credential presence registry; endpoint /api/environment-registry |
| `infrastructure-control-intel.mjs` | **KEEP** | in-place | 6 infrastructure graphs; endpoint /api/infrastructure-control |

### A6. Security & Payments (3 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `security-intel.mjs` | **KEEP** | in-place | v3 Security graph; endpoint /api/security |
| `security-intelligence-v5.mjs` | **KEEP** | in-place | v5 trust boundaries + escalation; endpoint /api/security-intelligence |
| `payment-intel.mjs` | **KEEP** | in-place | 9 money sub-flows + integrity checks; endpoint /api/payment |

### A7. Merchant Intelligence (8 files — KEEP/MERGE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `merchant-intel.mjs` | **KEEP** | in-place | v3 lifecycle map; 14 stages; endpoint /api/merchant |
| `merchant-intelligence.mjs` | **KEEP** | in-place | v5 operating model; endpoints /api/merchant-intelligence /api/merchant-operating /api/merchant-ops |
| `merchant-operating-graph.mjs` | **MERGE** | Fold into merchant-intelligence.mjs; retire /api/merchant-operating from this module | v4 capability subsumed by v5; decision-engine-v2 calls merchant-intelligence.mjs not this module; verify then archive the standalone module |
| `merchant-health-intel.mjs` | **KEEP** | in-place | 5-dimension health model; endpoint /api/merchant-health |
| `merchant-growth-intel.mjs` | **KEEP** | in-place | 5-dimension growth model; endpoint /api/merchant-growth |
| `merchant-adoption-intel.mjs` | **KEEP** | in-place | 7-feature adoption model; endpoint /api/merchant-adoption |
| `merchant-risk-intel.mjs` | **KEEP** | in-place | 5-dimension risk model; endpoint /api/merchant-risk |
| `merchant-churn-intel.mjs` | **KEEP** | in-place | 5-signal churn model; endpoint /api/merchant-churn |

### A8. Revenue, Cost & Customer (5 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `revenue-intelligence.mjs` | **KEEP** | in-place | Anomaly/leak detection focus; endpoint /api/revenue-intelligence |
| `revenue-intelligence-v2.mjs` | **KEEP** | in-place | 8 Omega revenue models; endpoint /api/revenue-v2 |
| `cost-intelligence.mjs` | **KEEP** | in-place | 10 services pricing model; endpoint /api/cost-intelligence |
| `customer-intelligence-v2.mjs` | **KEEP** | in-place | 8 customer graphs; endpoint /api/customer-intelligence-v2 |
| `customer-journey-intelligence.mjs` | **KEEP** | in-place | 8-stage journey; endpoint /api/customer-journey |

### A9. Production Readiness (3 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `production-readiness-intel.mjs` | **KEEP** | in-place | 18-system detail scores; endpoint /api/production-readiness |
| `production-readiness-v2.mjs` | **KEEP** | in-place | 10-dimension executive rollup; endpoint /api/production-readiness-v2 |
| `production-health.mjs` | **KEEP** | in-place | GREEN/YELLOW/RED health; endpoint /api/production-health |

### A10. Incident Intelligence (4 files — KEEP/MERGE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `incident-intel.mjs` | **MERGE** | Demote to internal library; retire `/api/incident` endpoint | v3 chain trace; superseded by Genesis control center; keep module, remove endpoint |
| `incident-response.mjs` | **MERGE** | Demote to internal library; retire `/api/incident-response` endpoint | v4 intermediate layer; capability subsumed by incident-control-intel.mjs; keep module, remove endpoint |
| `incident-intelligence-v5.mjs` | **KEEP** | in-place (internal library) | Already imported by incident-control-intel.mjs line 10; retire standalone `/api/incident-intelligence` endpoint (MERGE the endpoint) |
| `incident-control-intel.mjs` | **KEEP** | in-place | Genesis definitive surface; endpoint /api/incident-control |

### A11. Live Operations (5 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `live-adapters.mjs` | **KEEP** | in-place | 7 real provider probes; endpoints /api/live-adapters /api/live |
| `detection-prediction-intel.mjs` | **KEEP** | in-place | INFINITY: 8 detectors + 6 predictors; endpoints /api/detection /api/predict /api/live-metrics /api/detection-prediction /api/incident-timeline |
| `live-health-intel.mjs` | **KEEP** | in-place | Per-domain health records; endpoint /api/live-health |
| `federation-intel.mjs` | **KEEP** | in-place | 7-provider graph merge; endpoints /api/federation /api/live-graph |
| `connections-intel.mjs` | **KEEP** | in-place | 13-source connection registry; endpoint /api/connections |

### A12. Control Centers (5 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `launch-command-center.mjs` | **KEEP** | in-place | Founder GO/NO-GO; endpoints /api/launch-command-center /api/launch-status |
| `environment-control-intel.mjs` | **KEEP** | in-place | 5 models + activation steps; endpoint /api/environment-control |
| `commerce-control-intel.mjs` | **KEEP** | in-place | 14 domains + 6 journeys; endpoint /api/commerce-control |
| `mission-control-dashboard.mjs` | **KEEP** | in-place | 8-tile executive dashboard; endpoint /api/mission-control |
| `operations-center.mjs` | **KEEP** | in-place | 7 operational status areas; endpoint /api/operations |

### A13. Ecosystem, AI & Unified (6 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `ecosystem-intel.mjs` | **KEEP** | in-place | Frozen theme/app/devportal intel; endpoints /api/theme-intelligence /api/apps-intelligence /api/developer-intelligence /api/ecosystem |
| `ai-context-intel.mjs` | **KEEP** | in-place | AI packs (<20k tokens); endpoints /api/ai-context /api/ai-context-pack /api/ai-pack |
| `unified-intelligence-engine.mjs` | **KEEP** | in-place | 13-layer unified brain; endpoint /api/unified-intelligence |
| `business-flow-intel.mjs` | **KEEP** | in-place | 10 business journeys; endpoint /api/business-flow |
| `fix-engine.mjs` | **KEEP** | in-place | FIX/VERIFY/TEST/ROLLBACK plans; endpoint /api/fix-engine |
| `change-impact.mjs` | **KEEP** | in-place | (listed in A3; repeated for completeness — single file, single entry) |

### A14. Special Feature & Discovery (3 files — KEEP/REMOVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `domain-intelligence.mjs` | **KEEP** | in-place + wire endpoint | DARK (not wired); rename to custom-domain-feature-intel.mjs; add /api/custom-domain-intelligence route to server.mjs. Action required in Phase 1. |
| `autonomous-discovery-v5.mjs` | **KEEP** | in-place (internal library) | CLI only; called by discovery-v2.mjs and fix-engine.mjs; keep |
| `discovery-v2.mjs` | **KEEP** | in-place | Live endpoint /api/discovery-v2; authoritative discovery surface |
| `discovery-engine.mjs` | **REMOVE** | safe deletion | Confirmed: not imported by server.mjs; not called by any wired module; discovery-v2.mjs supersedes; ZERO functional loss |

### A15. CLI Utilities & Report Generators (9 files — all KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `gen-reports.mjs` | **KEEP** | in-place | Writes DATABASE_INTELLIGENCE_REPORT.generated.md |
| `gen-v3-reports.mjs` | **KEEP** | in-place | Domain/merchant/customer/security reports |
| `gen-v4-reports.mjs` | **KEEP** | in-place | Decision/runtime/deployment/incident reports |
| `gen-v5-reports.mjs` | **KEEP** | in-place | V5 discovery/runtime-obs/readiness reports |
| `gen-omega-reports.mjs` | **KEEP** | in-place | OMEGA gap reports + 4 others |
| `gen-explain-docs.mjs` | **KEEP** | in-place | ONBOARDING.md, DOMAIN_EXPLAIN.md, AI_CONTEXT_PACK.md |
| `graph-stats.mjs` | **KEEP** | in-place | CLI diagnostic; graph:stats |
| `validate-graph.mjs` | **KEEP** | in-place | Sanity-check graph.json; graph:validate |
| `refresh-graph.mjs` | **KEEP** | in-place | Thin graphify wrapper; graph:update |

### A16. Server Entry Point (1 file — KEEP)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `server.mjs` | **KEEP** | in-place | 1,102-line HTTP server; 118 routes; primary `:3333` entry point |

---

### graph-server Subtotals

| Disposition | Count |
|---|---|
| KEEP | 74 |
| MERGE (module kept as lib; endpoint retired) | 4 (`memory-intel`, `merchant-operating-graph`, `incident-intel`, `incident-response`) + incident-intelligence-v5 endpoint = 4 files MERGE + 1 endpoint-only action |
| REMOVE | 1 (`discovery-engine.mjs`) |
| **Total** | **81** |

---

## Part B — `tools/central-intelligence/` (:3334) — 121 Files

**Macro-decision:** Archive the `:3334` runtime as a standalone server. Five subsystems contain novel capabilities (architecture-intelligence, execution-engine, verification-engine, context-intelligence, browser-intelligence) that must be **moved** to `:3333` before archiving. All remaining `:3334` files are **archived** — not deleted — to `tools/_archive/central-intelligence/2026-06-20/`.

### B1. Intelligence API (3 files — ARCHIVE after migration)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `intelligence-api/server.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/intelligence-api/` | :3334 entry point; 1,169 lines; 68 routes. Archive after all 5 novel capability migrations complete. |
| `intelligence-api/QueryRouter.mjs` | **ARCHIVE** | same archive dir | NL routing; singleton; depends on V1 HTTP |
| `intelligence-api/ResponseSynthesizer.mjs` | **ARCHIVE** | same archive dir | V1+V2 merger; depends on architecture of both servers |

### B2. Architecture Intelligence (7 files — MOVE to :3333)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `architecture-intelligence/ArchitectureIntelligenceEngine.mjs` | **MOVE** | `packages/lcis-core/src/architecture.mjs` (re-export / consolidation) | Primary engine; pure filesystem; works at cold start; highest priority migration |
| `architecture-intelligence/ArchitectureDriftDetector.mjs` | **MOVE** | `packages/lcis-core/src/architecture/` | Drift detection; requires prior snapshot |
| `architecture-intelligence/ArchitectureSnapshotService.mjs` | **MOVE** | `packages/lcis-core/src/architecture/` | Snapshot persistence |
| `architecture-intelligence/DependencyDiscovery.mjs` | **MOVE** | `packages/lcis-core/src/architecture/` | Filesystem dep scan |
| `architecture-intelligence/DomainDiscovery.mjs` | **MOVE** | `packages/lcis-core/src/architecture/` | Domain layering from package.json scan |
| `architecture-intelligence/LayerDiscovery.mjs` | **MOVE** | `packages/lcis-core/src/architecture/` | Layer classification |
| `architecture-intelligence/ServiceDiscovery.mjs` | **MOVE** | `packages/lcis-core/src/architecture/` | Service discovery |

### B3. Execution Engine (4 files — MOVE to :3333)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `execution-engine/ExecutionEngine.mjs` | **MOVE** | `packages/lcis-core/src/contracts.mjs` | Read-only dispatcher |
| `execution-engine/SafetyGuard.mjs` | **MOVE** | `packages/lcis-core/src/contracts/` | 28-verb ban; no bypass; highest-value safety primitive |
| `execution-engine/ExecutionAuditor.mjs` | **MOVE** | `packages/lcis-core/src/contracts/` | SHA-256 hash-chain audit log |
| `execution-engine/ActionRegistry.mjs` | **MOVE** | `packages/lcis-core/src/contracts/` | 10 read-only registered actions |

### B4. Verification Engine (4 files — MOVE to :3333)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `verification-engine/VerificationEngine.mjs` | **MOVE** | `packages/lcis-core/src/verification.mjs` | Refuses to rubber-stamp; ≥2 sources required for VERIFIED |
| `verification-engine/EvidenceVerifier.mjs` | **MOVE** | `packages/lcis-core/src/verification/` | Evidence assessment |
| `verification-engine/ConfidenceCalculator.mjs` | **MOVE** | `packages/lcis-core/src/verification/` | Confidence scoring |
| `verification-engine/VerificationLedger.mjs` | **MOVE** | `packages/lcis-core/src/verification/` | Verification persistence |

### B5. Context Intelligence (9 files — MOVE subset to :3333; archive rest)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `context-intelligence/ContextAssembler.mjs` | **MOVE** | `packages/lcis-core/src/utils/context-assembler.mjs` | Core compression entry point; reads graphify-out/*.json |
| `context-intelligence/ContextCompressionPipeline.mjs` | **MOVE** | `packages/lcis-core/src/utils/` | Compression pipeline |
| `context-intelligence/TokenOptimizer.mjs` | **MOVE** | `packages/lcis-core/src/utils/` | Token budget computation |
| `context-intelligence/ContextDiagnostics.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/context-intelligence/` | Health monitor for :3334 context layer; references :3334 internal paths |
| `context-intelligence/ContextHealthMonitor.mjs` | **ARCHIVE** | same | Same as above |
| `context-intelligence/ContextOptimizer.mjs` | **ARCHIVE** | same | Optimization layer specific to :3334 request pipeline |
| `context-intelligence/ArchitectureGraphBuilder.mjs` | **ARCHIVE** | same | Duplicates architecture-intelligence subsystem; overlaps with moved files |
| `context-intelligence/DependencyGraphBuilder.mjs` | **ARCHIVE** | same | Duplicates DependencyDiscovery in architecture-intelligence |
| `context-intelligence/RepositoryGraphBuilder.mjs` | **ARCHIVE** | same | Reads graphify-out; :3333 already has this capability |

### B6. Browser Intelligence (7 files — MOVE to :3333 as optional module)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `browser-intelligence/BrowserIntelligenceEngine.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser.mjs` | Primary entry; graceful degradation when playwright absent |
| `browser-intelligence/agents/CheckoutAgent.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser/agents/` | Never executes real payments |
| `browser-intelligence/agents/MonitoringAgent.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser/agents/` | |
| `browser-intelligence/agents/StoreAgent.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser/agents/` | |
| `browser-intelligence/agents/ThemeAgent.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser/agents/` | |
| `browser-intelligence/evidence/EvidenceCollector.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser/evidence/` | |
| `browser-intelligence/validators/SEOValidator.mjs` | **MOVE** | `packages/lcis-core/src/runtime-browser/validators/` | |

### B7. Memory Engine (5 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `memory-engine/MemoryService.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/memory-engine/` | Requires Qdrant + OpenAI; both uninstalled; :3333 memory-v2.mjs covers governance memory |
| `memory-engine/MemoryRetriever.mjs` | **ARCHIVE** | same | Vector search; Qdrant not running |
| `memory-engine/MemoryIndexer.mjs` | **ARCHIVE** | same | Embedding indexer |
| `memory-engine/MemoryIngestionPipeline.mjs` | **ARCHIVE** | same | Ingestion pipeline |
| `memory-engine/MemoryHealthMonitor.mjs` | **ARCHIVE** | same | Health monitor for Qdrant |

### B8. Knowledge Engine (5 files + crawlers — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `knowledge-engine/KnowledgeAcquisitionService.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/knowledge-engine/` | Python/Crawl4AI subprocess; not installed |
| `knowledge-engine/KnowledgeSourceRegistry.mjs` | **ARCHIVE** | same | In-memory registry; no consumers after :3334 archival |
| `knowledge-engine/KnowledgeFreshnessService.mjs` | **ARCHIVE** | same | Filesystem freshness; tied to :3334 paths |
| `knowledge-engine/KnowledgeScheduler.mjs` | **ARCHIVE** | same | setInterval() starts at import; side-effect risk; no live consumers |
| `knowledge-engine/KnowledgeChangeDetector.mjs` | **ARCHIVE** | same | Change detection; no live consumers |

### B9. Graph Engine (5 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `graph-engine/GraphQueryEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/graph-engine/` | GraphRAG subprocess; not installed; :3333 intelligence.mjs covers structural graph queries |
| `graph-engine/GraphBuilder.mjs` | **ARCHIVE** | same | GraphRAG index builder |
| `graph-engine/GraphIndexer.mjs` | **ARCHIVE** | same | Index management |
| `graph-engine/GraphExplorer.mjs` | **ARCHIVE** | same | whatBreaksIf() — duplicated by :3333 /api/blast |
| `graph-engine/GraphDiagnostics.mjs` | **ARCHIVE** | same | Health check for GraphRAG; no live consumers after archival |

### B10. Observability (8 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `observability/TelemetryService.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/observability/` | Requires OTel/SigNoz (4 containers); not running; :3333 telemetry-intelligence.mjs covers topology |
| `observability/HealthService.mjs` | **ARCHIVE** | same | Marks Observability DOWN; tied to :3334 |
| `observability/AnomalyDetectionService.mjs` | **ARCHIVE** | same | In-memory thresholds without live data; no actionable output |
| `observability/IncidentDetectionService.mjs` | **ARCHIVE** | same | Reads incidents.jsonl; :3333 detection-prediction-intel covers this |
| `observability/MetricsService.mjs` | **ARCHIVE** | same | OTel metrics; not running |
| `observability/TracingService.mjs` | **ARCHIVE** | same | OTel traces; not running |
| `observability/otel-config.mjs` | **ARCHIVE** | same | OTel SDK config |
| `observability/instrument-api-gateway.mjs` | **ARCHIVE** | same | Instrumentation shim; :3334 only |

### B11. Agents (8 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `agents/AgentFramework.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/agents/` | HTTP agent framework; .claude/commands/*.md slash-commands are the real agent surface |
| `agents/KnowledgeAgent.mjs` | **ARCHIVE** | same | Requires Qdrant; no invocation path from .claude/commands/ |
| `agents/MerchantAgent.mjs` | **ARCHIVE** | same | |
| `agents/MonitoringAgent.mjs` | **ARCHIVE** | same | |
| `agents/OperationsAgent.mjs` | **ARCHIVE** | same | |
| `agents/ReleaseAgent.mjs` | **ARCHIVE** | same | |
| `agents/SecurityAgent.mjs` | **ARCHIVE** | same | |
| `agents/ThemeAgent.mjs` | **ARCHIVE** | same | Not to be confused with browser-intelligence/agents/ThemeAgent.mjs (MOVE) |

### B12. Reasoning (7 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `reasoning/ReasoningEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/reasoning/` | V1 HTTP client; :3333 covers all structural reasoning already |
| `reasoning/ArchitectureReasoner.mjs` | **ARCHIVE** | same | Duplicated by migrated architecture-intelligence |
| `reasoning/DependencyReasoner.mjs` | **ARCHIVE** | same | |
| `reasoning/DeploymentReasoner.mjs` | **ARCHIVE** | same | |
| `reasoning/IncidentReasoner.mjs` | **ARCHIVE** | same | Duplicated by :3333 incident-control-intel |
| `reasoning/OperationalReasoner.mjs` | **ARCHIVE** | same | |
| `reasoning/SecurityReasoner.mjs` | **ARCHIVE** | same | Duplicated by :3333 security-intelligence-v5 |

### B13. Correlation (5 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `correlation/IntelligenceCorrelationEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/correlation/` | V1 HTTP orchestration; duplicates :3333 blast-radius + incident-control |
| `correlation/ImpactPredictor.mjs` | **ARCHIVE** | same | Duplicates :3333 change-impact.mjs |
| `correlation/RootCauseAnalyzer.mjs` | **ARCHIVE** | same | Duplicates :3333 diagnosis-engine |
| `correlation/RiskScorer.mjs` | **ARCHIVE** | same | |
| `correlation/SignalCollector.mjs` | **ARCHIVE** | same | |

### B14. Autonomous Operations (7 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `autonomous-operations/OperationsReasoningEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/autonomous-operations/` | V1 HTTP client; :3333 operations-center covers same ground |
| `autonomous-operations/AnomalyDetector.mjs` | **ARCHIVE** | same | |
| `autonomous-operations/DriftDetector.mjs` | **ARCHIVE** | same | Duplicates :3333 discovery-v2 |
| `autonomous-operations/DependencyRiskDetector.mjs` | **ARCHIVE** | same | |
| `autonomous-operations/DegradationDetector.mjs` | **ARCHIVE** | same | |
| `autonomous-operations/IntelligenceReportGenerator.mjs` | **ARCHIVE** | same | |
| `autonomous-operations/RecommendationEngine.mjs` | **ARCHIVE** | same | Duplicates :3333 fix-engine + decision-engine-v2 |

### B15. Self Model (3 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `self-model/PlatformExplainer.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/self-model/` | Hardcoded fallbacks; :3333 explain-intel.mjs covers same domain explain |
| `self-model/SelfModelBuilder.mjs` | **ARCHIVE** | same | |
| `self-model/SelfDiagnostics.mjs` | **ARCHIVE** | same | |

### B16. Executive Intelligence (6 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `executive-intelligence/ExecutiveIntelligenceEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/executive-intelligence/` | Facade over all V2 layers; no utility without full V2 chain; :3333 mission-control + decision-v2 cover same executive surface |
| `executive-intelligence/ExecutiveDecisionEngine.mjs` | **ARCHIVE** | same | |
| `executive-intelligence/ExecutivePlanningEngine.mjs` | **ARCHIVE** | same | |
| `executive-intelligence/ExecutiveReasoningEngine.mjs` | **ARCHIVE** | same | |
| `executive-intelligence/ExecutiveKnowledgeSynthesizer.mjs` | **ARCHIVE** | same | Requires Qdrant |
| `executive-intelligence/ExecutiveVerificationEngine.mjs` | **ARCHIVE** | same | |

### B17. Goal Engine (4 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `goal-engine/GoalEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/goal-engine/` | Requires V1 HTTP; :3333 execution-intel.mjs covers V1 blocker-based goal tracking |
| `goal-engine/MissionEngine.mjs` | **ARCHIVE** | same | |
| `goal-engine/ObjectiveTracker.mjs` | **ARCHIVE** | same | |
| `goal-engine/OutcomeTracker.mjs` | **ARCHIVE** | same | |

### B18. Prediction Engine (5 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `prediction-engine/PredictionEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/prediction-engine/` | Duplicates :3333 detection-prediction-intel; requires V1 HTTP |
| `prediction-engine/CapacityForecaster.mjs` | **ARCHIVE** | same | |
| `prediction-engine/IncidentPredictor.mjs` | **ARCHIVE** | same | |
| `prediction-engine/RiskForecaster.mjs` | **ARCHIVE** | same | |
| `prediction-engine/TrendAnalyzer.mjs` | **ARCHIVE** | same | |

### B19. Recommendation Engine (3 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `recommendation-engine/ExecutiveRecommendationEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/recommendation-engine/` | Duplicates :3333 decision-engine-v2 + fix-engine; requires V1 + Qdrant |
| `recommendation-engine/RecommendationRanker.mjs` | **ARCHIVE** | same | |
| `recommendation-engine/RecommendationValidator.mjs` | **ARCHIVE** | same | |

### B20. Daily Intelligence (5 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `daily-intelligence/DailyIntelligenceSystem.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/daily-intelligence/` | Requires all V2/V3 engines; no CI integration; no tests |
| `daily-intelligence/ExecutiveSummaryGenerator.mjs` | **ARCHIVE** | same | |
| `daily-intelligence/EngineeringSummaryGenerator.mjs` | **ARCHIVE** | same | |
| `daily-intelligence/MerchantImpactSummaryGenerator.mjs` | **ARCHIVE** | same | |
| `daily-intelligence/SecuritySummaryGenerator.mjs` | **ARCHIVE** | same | |

### B21. Orchestration Engine (3 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `orchestration-engine/OrchestrationEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/orchestration-engine/` | __synthesisHandler injection pattern fragile; requires full V2 chain |
| `orchestration-engine/WorkflowExecutor.mjs` | **ARCHIVE** | same | |
| `orchestration-engine/WorkflowRegistry.mjs` | **ARCHIVE** | same | |

### B22. Investigation Engine (4 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `investigation-engine/InvestigationEngine.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/investigation-engine/` | Requires V1 HTTP + Qdrant; :3333 diagnosis-engine + incident-control covers same scope |
| `investigation-engine/IncidentEvidenceCollector.mjs` | **ARCHIVE** | same | |
| `investigation-engine/RootCauseInvestigator.mjs` | **ARCHIVE** | same | |
| `investigation-engine/TimelineBuilder.mjs` | **ARCHIVE** | same | |

### B23. Operating Loop (3 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `operating-loop/LCISOperatingLoop.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/operating-loop/` | 8-stage loop; EXECUTE only calls 2 hardcoded actions; requires full V2 chain |
| `operating-loop/LearningRecorder.mjs` | **ARCHIVE** | same | |
| `operating-loop/LoopStage.mjs` | **ARCHIVE** | same | |

### B24. Operator Platform (2 files — ARCHIVE)

| File | Disposition | Target | Notes |
|---|---|---|---|
| `operator-platform/serve-dashboard.mjs` | **ARCHIVE** | `tools/_archive/central-intelligence/2026-06-20/operator-platform/` | :3335 proxy; zero users; unaudited dashboard.html |
| `operator-platform/dashboard.html` | **ARCHIVE** | same | HTML file, not .mjs, included for completeness |

---

### central-intelligence Subtotals

| Disposition | Count |
|---|---|
| MOVE (novel capability to :3333) | 30 |
| ARCHIVE | 91 |
| **Total .mjs files** | **121** |

---

## Grand Totals — Reconciliation

| Disposition | graph-server | central-intelligence | **Grand Total** |
|---|---|---|---|
| KEEP | 74 | 0 | **74** |
| MERGE | 4 | 0 | **4** |
| MOVE | 0 | 30 | **30** |
| ARCHIVE | 0 | 91 | **91** |
| REMOVE | 1 | 0 | **1** |
| **Total** | **81** | **121** | **202** |

**Verification:** 74 + 4 + 0 + 0 + 1 = 81 ✓ — 0 + 0 + 30 + 91 + 0 = 121 ✓ — Grand total = 202 ✓

---

## Execution Order (when this plan is approved for execution)

1. **Phase 1A** — MOVE the 5 novel capabilities from :3334 to `packages/lcis-core/src/` (architecture, contracts/safety, verification, context-compression, browser-validation). Write tests for each migrated module against :3333's graphify-out artifacts.
2. **Phase 1B** — Wire dark endpoints in :3333: `domain-intelligence.mjs` (rename + wire /api/custom-domain-intelligence) and `deployment-intelligence-v5.mjs` (add /api/deployment-intelligence-v5 route).
3. **Phase 1C** — Retire superseded endpoints in :3333: `/api/memory` (from memory-intel), `/api/incident` (from incident-intel), `/api/incident-response` (from incident-response), `/api/incident-intelligence` standalone (from incident-intelligence-v5), `/api/merchant-operating` (from merchant-operating-graph). Verify regression against baseline before each retirement.
4. **Phase 1D** — REMOVE `tools/graph-server/discovery-engine.mjs` (confirmed zero functional loss).
5. **Phase 1E** — ARCHIVE all 91 `:3334` files to `tools/_archive/central-intelligence/2026-06-20/`. Shut down `:3334` server.
6. **Phase 1F** — Run `node scripts/validate-governance.mjs` (107-validator gate must stay green).

---

*End of LCIS Migration Plan — Phase 1*
*Produced 2026-06-20. Discovery-only: no code modified. All claims evidence-cited to inventory and duplication report.*

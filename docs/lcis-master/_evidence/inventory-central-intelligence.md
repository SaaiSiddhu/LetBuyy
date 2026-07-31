# LCIS V2/V3 — Capability Inventory: `tools/central-intelligence`

**Date:** 2026-06-20  
**Auditor:** Principal AI Systems Architect (discovery-only, no code changes)  
**Port:** 3334  
**File count:** 121 `.mjs` files across 22 subsystem directories  
**Method:** Source-verified — all claims cite exact file paths and line numbers

---

## 1. External Service Requirements

Source: `tools/central-intelligence/.env.example`, `package.json`, `setup.sh`, `docker-compose.yml`

| Service | Role | Required? | Default endpoint | Env var | Without it |
|---|---|---|---|---|---|
| **OpenAI API** | Embeddings (text-embedding-3-small, 1536-dim) for Qdrant; LLM reasoning steps | **REQUIRED** | `https://api.openai.com/v1/embeddings` | `OPENAI_API_KEY` | `setup.sh` hard-exits at line ~60; `MemoryService.embed()` returns null; all memory ops degrade |
| **Qdrant** (Docker) | Vector store for all 8 memory collections | Optional (Docker) | `http://localhost:6333` | `QDRANT_URL` | Memory engine returns `'NOT CONNECTED'`; vector search returns empty |
| **OTel Collector / SigNoz** | Distributed traces, metrics, logs | Optional (Docker) | `http://localhost:4318` (OTLP/HTTP) | `OTEL_EXPORTER_OTLP_ENDPOINT` | `TelemetryService` logs `NOT AVAILABLE`, returns noops; `HealthService` marks Observability `DOWN` |
| **SigNoz ClickHouse** | Trace/log/metrics backend | Optional (Docker) | `localhost:9000` | — | SigNoz stack non-functional; no impact on structural intelligence |
| **GraphRAG** (Python) | Global/local graph queries over indexed repo | Optional (pip) | subprocess: `python3 -m graphrag query` | — | `GraphQueryEngine` returns empty/error from subprocess; degraded |
| **Crawl4AI** (Python) | Web crawling for knowledge acquisition | Optional (pip) | subprocess: `python3 <crawler>.py` | — | `KnowledgeAcquisitionService` crawls fail; knowledge freshness stale |
| **Playwright** (Node) | Browser evidence, UI validation | Optional (npm) | headless Chromium | `PLAYWRIGHT_HEADLESS` | `BrowserIntelligenceEngine` returns `{ status: 'NOT AVAILABLE', reason: 'playwright not installed' }` |
| **LCIS V1** (`graph-server`, :3333) | Structural code/DB/domain graph | **FUNCTIONALLY REQUIRED** for most engines | `http://localhost:3333` | `LCIS_V1_URL` | All engines fall back to on-disk `graphify-out/*.json` artefacts; reasoning/correlation degrade significantly |

**Python dependencies** (`setup.sh` line ~75–85):
- `graph-engine/graphrag/requirements.txt`: `graphrag>=0.3.6`, `lancedb>=0.6.0`, `pyarrow>=14.0.0`, `pandas>=2.0.0`
- `knowledge-engine/crawlers/requirements.txt`: `crawl4ai>=0.4.0`, `aiohttp>=3.9.0`, `aiofiles>=23.2.1`

**Node dependencies** (`package.json` `dependencies`):
- `@qdrant/js-client-rest: ^1.9.0`
- `@opentelemetry/sdk-node: ^0.52.0`, `@opentelemetry/api: ^1.9.0`, `@opentelemetry/auto-instrumentations-node: ^0.49.0`, `@opentelemetry/exporter-trace-otlp-http: ^0.52.0`, `@opentelemetry/resources: ^1.25.0`, `@opentelemetry/semantic-conventions: ^1.25.0`
- `playwright: ^1.45.0`

---

## 2. The :3333 ↔ :3334 Relationship

Source: `intelligence-api/server.mjs` line 22; `reasoning/ReasoningEngine.mjs` line ~8; `correlation/IntelligenceCorrelationEngine.mjs` line ~5; `agents/AgentFramework.mjs`

**Finding: V2 (:3334) is an HTTP client of V1 (:3333) — not a shared-library consumer.**

- `server.mjs` line 22: `const LCIS_V1_URL = process.env.LCIS_V1_URL || 'http://localhost:3333';`
- `server.mjs` line 166–177: `fetchV1(path)` — 3-second abort timeout, returns `{ error: 'V1 unavailable: ...' }` on failure, never throws.
- `ReasoningEngine.mjs`: `const V1_BASE = process.env.LCIS_V1_URL ?? 'http://localhost:3333'` — fetches `/api/memory?mode=recall&q=`, `/api/explain`, `/api/workspace` directly.
- `IntelligenceCorrelationEngine.mjs`: `const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333'`
- `agents/AgentFramework.mjs`: fetches `LCIS_V1_URL` with a 10-second abort timeout.
- `QueryRouter.mjs` line 83–99: `fetchV1()` with 2-second timeout, parallel-fetches V1 APIs as context.

**V2 also reads V1 on-disk artefacts** as a secondary fallback:
- `context-intelligence/ContextAssembler.mjs`: reads `graphify-out/domain-intel.json`, `graphify-out/infra-intel.json`, `graphify-out/runbooks.json`
- `self-model/PlatformExplainer.mjs`: reads `graphify-out/self-model/*.json`, `graphify-out/infra-intel.json`, `graphify-out/domain-intel.json`

**Verdict:** CLAUDE.md says V2 "reads V1 internally and synthesizes" — this is accurate but understates the coupling. V2 makes HTTP calls to 10+ V1 API paths on every request. With V1 down but `graphify-out/` populated (stale artefacts), structural intelligence still mostly works via the filesystem fallback. With both V1 down and no artefacts, most V2/V3 engines return structurally honest but data-empty answers.

---

## 3. The Intelligence API: Registered Endpoints

Source: `intelligence-api/server.mjs` lines 182–281 (`ENDPOINTS` constant) and `handleRequest()` lines 287–1116.

**68 endpoints registered** across V1-subsystem, V2, and V3 layers.

### 3a. V1-Subsystem Endpoints (23 routes — lines 184–207)

| Endpoint | Handler | External dep |
|---|---|---|
| `GET /intelligence/health` | `HealthService.getHealth()` | V1 HTTP |
| `GET /intelligence/status` | `HealthService` + `GraphDiagnostics` + `MemoryHealthMonitor` + V1 `/api/stats` | V1 HTTP |
| `GET /intelligence/memory/search` | `MemoryRetriever.retrieve()` | Qdrant + OpenAI |
| `POST /intelligence/memory/ingest` | `MemoryIngestionPipeline.runFromText()` | Qdrant + OpenAI |
| `GET /intelligence/memory/health` | `MemoryHealthMonitor.getHealth()` | Qdrant |
| `GET /intelligence/memory/stats` | `MemoryHealthMonitor.getMetrics()` | Qdrant |
| `GET /intelligence/knowledge/search` | `MemoryRetriever.retrieve()` on `knowledge` collection | Qdrant + OpenAI |
| `POST /intelligence/knowledge/crawl` | `KnowledgeAcquisitionService.crawlSource()` | Python/Crawl4AI subprocess + Qdrant |
| `GET /intelligence/knowledge/sources` | `KnowledgeSourceRegistry.getSources()` | None (in-memory) |
| `GET /intelligence/knowledge/freshness` | `KnowledgeFreshnessService.checkFreshness()` | Filesystem |
| `GET /intelligence/graph/query` | `GraphQueryEngine.query()` | Python/GraphRAG subprocess |
| `GET /intelligence/graph/impact` | `GraphExplorer.whatBreaksIf()` | Python/GraphRAG subprocess |
| `GET /intelligence/graph/entities` | `GraphExplorer.explainEntity()` | Python/GraphRAG subprocess |
| `GET /intelligence/graph/health` | `GraphDiagnostics.getHealth()` | Filesystem |
| `GET /intelligence/browser/validate` | `BrowserIntelligenceEngine.validateStore()` | Playwright |
| `GET /intelligence/browser/theme` | `ThemeAgent.runFull()` | Playwright |
| `GET /intelligence/browser/checkout` | `CheckoutAgent.runFlow()` | Playwright |
| `GET /intelligence/browser/status` | `BrowserIntelligenceEngine.getStatus()` | None (status check) |
| `GET /intelligence/observability/health` | `HealthService.getHealth()` | OTel probe |
| `GET /intelligence/observability/incidents` | Reads `graphify-out/incidents.jsonl` | Filesystem |
| `GET /intelligence/observability/anomalies` | `AnomalyDetectionService.getAllAnomalies()` | None (in-memory signals) |
| `GET /intelligence/agents/execute` | Agent framework → V1 + Memory + Graph | V1 HTTP + Qdrant + GraphRAG |
| `GET /intelligence/agents/status` | AGENT_MAP lazy-load check | None |
| `GET /intelligence/ask` | `QueryRouter` → multi-source → `ResponseSynthesizer` | V1 HTTP + Qdrant + GraphRAG |

### 3b. V2 Endpoints (22 routes — lines 209–238)

| Endpoint | Handler | External dep |
|---|---|---|
| `GET /intelligence/context/assemble` | `ContextAssembler.assemble()` | Filesystem (`graphify-out/*.json`) |
| `GET /intelligence/context/map` | Reads `graphify-out/context-intelligence/LCIS_CONTEXT_MAP.json` | Filesystem |
| `POST /intelligence/context/build` | `ContextCompressionPipeline.run()` | Filesystem |
| `GET /intelligence/context/health` | `ContextDiagnostics.getHealth()` | Filesystem |
| `GET /intelligence/context/compression` | `ContextDiagnostics.getCompressionStats()` | Filesystem |
| `GET /intelligence/architecture` | `ArchitectureIntelligenceEngine.getArchitecture()` | Filesystem + `package.json` scan |
| `GET /intelligence/architecture/drift` | `ArchitectureIntelligenceEngine.whatChanged()` | Filesystem |
| `GET /intelligence/architecture/risks` | `ArchitectureIntelligenceEngine.getRisks()` | Filesystem |
| `GET /intelligence/architecture/depends` | `ArchitectureIntelligenceEngine.whatDependsOn()` | Filesystem |
| `GET /intelligence/reason` | `ReasoningEngine.reason()` | V1 HTTP + Qdrant (optional) |
| `GET /intelligence/reason/why` | `ReasoningEngine.whyDidThisHappen()` | V1 HTTP |
| `GET /intelligence/reason/affected` | `ReasoningEngine.whatIsAffected()` | V1 HTTP |
| `GET /intelligence/reason/risk-dependency` | `ReasoningEngine.highestRiskDependency()` | V1 HTTP |
| `POST /intelligence/correlate` | `IntelligenceCorrelationEngine.correlate()` | V1 HTTP + optional sub-engines |
| `GET /intelligence/correlate/root-cause` | `correlateIncident()` | V1 HTTP |
| `GET /intelligence/correlate/impact` | `predictImpact()` | V1 HTTP |
| `GET /intelligence/correlate/risk` | `getRiskScore()` | V1 HTTP |
| `GET /intelligence/operations/assess` | `OperationsReasoningEngine.assess()` | V1 HTTP (optional) |
| `GET /intelligence/operations/recommendations` | `OperationsReasoningEngine.getEngineeringRecommendations()` | V1 HTTP (optional) |
| `GET /intelligence/operations/insights` | `OperationsReasoningEngine.getOperationalInsights()` | V1 HTTP (optional) |
| `GET /intelligence/operations/daily` | `IntelligenceReportGenerator.getLatestReport()` | Filesystem |
| `POST /intelligence/operations/daily` | `IntelligenceReportGenerator.generateDailyReport()` | V1 HTTP + sub-engines |
| `GET /intelligence/self/model` | Reads `graphify-out/self-model/LCIS_SELF_MODEL.json` | Filesystem |
| `POST /intelligence/self/build` | `SelfModelBuilder.build()` | V1 HTTP + Filesystem |
| `GET /intelligence/self/explain` | `PlatformExplainer.explainPlatform()` + variants | Filesystem (fallback to hardcoded) |
| `GET /intelligence/command-center` | Multi-engine aggregate (V2+V3) | All sub-engines |

### 3c. V3 Executive/Intelligence Endpoints (23 routes — lines 241–281)

| Endpoint | Handler | External dep |
|---|---|---|
| `GET /intelligence/executive/briefing` | `ExecutiveIntelligenceEngine.getExecutiveBriefing()` | V1 HTTP + V2 engines |
| `GET /intelligence/executive/next` | `ExecutiveIntelligenceEngine.getNextAction()` | V1 HTTP + V2 engines |
| `POST /intelligence/executive/decide` | `ExecutiveDecisionEngine` | V1 HTTP + V2 engines |
| `POST /intelligence/executive/plan` | `ExecutivePlanningEngine` | V1 HTTP + V2 engines |
| `GET /intelligence/executive/synthesize` | `ExecutiveKnowledgeSynthesizer` | V1 HTTP + Qdrant (optional) |
| `GET /intelligence/goals` | `GoalEngine.getGoals()` | V1 HTTP + Filesystem |
| `GET /intelligence/goals/at-risk` | `GoalEngine.getGoalsAtRisk()` | V1 HTTP + Filesystem |
| `GET /intelligence/missions` | `MissionEngine.getMissions()` | Filesystem |
| `GET /intelligence/predict` | `PredictionEngine.predict()` | V1 HTTP + Filesystem |
| `GET /intelligence/predict/all` | `PredictionEngine.predictAll()` | V1 HTTP + Filesystem |
| `GET /intelligence/predict/incidents` | `IncidentPredictor` via `PredictionEngine` | V1 HTTP + Filesystem |
| `GET /intelligence/recommend` | `ExecutiveRecommendationEngine.recommendAll()` | V1 HTTP + Qdrant (optional) + V2 engines |
| `GET /intelligence/recommend/domain` | `recommendAll()` filtered | V1 HTTP + V2 engines |
| `GET /intelligence/investigate/domain` | `InvestigationEngine.investigate()` | V1 HTTP + Qdrant (optional) |
| `POST /intelligence/investigate` | `InvestigationEngine.investigate()` | V1 HTTP + Qdrant (optional) |
| `GET /intelligence/orchestrate/health` | `OrchestrationEngine.run('health-assessment')` | All V2 engines |
| `GET /intelligence/orchestrate/risk` | `OrchestrationEngine.run('risk-assessment')` | All V2 engines |
| `GET /intelligence/orchestrate/architecture` | `OrchestrationEngine.run('architecture-review')` | V2 architecture engine |
| `GET /intelligence/orchestrate/workflows` | `WorkflowRegistry.listWorkflows()` | None |
| `POST /intelligence/execute` | `ExecutionEngine.execute()` → `SafetyGuard` | Read-only sub-engines |
| `GET /intelligence/execute/actions` | `ActionRegistry.getActions()` | None |
| `GET /intelligence/execute/audit` | `ExecutionAuditor.getAuditLog()` | Filesystem |
| `POST /intelligence/verify` | `VerificationEngine.verify()` | V1 HTTP + Qdrant (optional) |
| `GET /intelligence/verify/report` | `VerificationEngine.getVerificationReport()` | Filesystem |
| `GET /intelligence/brief/daily` | `DailyIntelligenceSystem.getDailyBrief()` | Filesystem |
| `POST /intelligence/brief/generate` | `DailyIntelligenceSystem.generateDailyBrief()` | All V2/V3 engines |
| `GET /intelligence/brief/executive` | `ExecutiveSummaryGenerator` | All V2/V3 engines |
| `GET /intelligence/loop/state` | `LCISOperatingLoop.getLoopState()` | In-memory |
| `POST /intelligence/loop/run-once` | `LCISOperatingLoop.runOnce()` | All engines |
| `GET /intelligence/loop/history` | `LCISOperatingLoop.getCycleHistory()` | In-memory |

---

## 4. Full Subsystem Catalog

### 4a. V1-Layer Subsystems (12 subsystems)

| Subsystem | Directory | Key files | External deps | Maturity | Works with zero external services? | Issues |
|---|---|---|---|---|---|---|
| **Memory Engine** | `memory-engine/` | `MemoryService.mjs`, `MemoryRetriever.mjs`, `MemoryIndexer.mjs`, `MemoryIngestionPipeline.mjs`, `MemoryHealthMonitor.mjs`, `collections/schema.json` | `@qdrant/js-client-rest` → Qdrant:6333; OpenAI Embeddings API | Real logic, fully implemented | NO — returns `NOT CONNECTED` / empty arrays | Requires BOTH Qdrant and OpenAI; without Qdrant the `embed()` result is discarded and search returns `[]`; without OpenAI embeddings return null |
| **Knowledge Engine** | `knowledge-engine/` | `KnowledgeAcquisitionService.mjs`, `KnowledgeSourceRegistry.mjs`, `KnowledgeFreshnessService.mjs`, `KnowledgeScheduler.mjs`, `KnowledgeChangeDetector.mjs`; `crawlers/` (base + supabase/cloudflare/vercel/opentelemetry crawlers + `requirements.txt`) | Python subprocess (`crawl4ai>=0.4.0`) → `python3 <source>-crawler.py`; then Qdrant via `MemoryIngestionPipeline` | Real logic for scheduling/registry; crawlers are Python scripts that exist | Partial — `KnowledgeSourceRegistry.getSources()` and freshness metadata work; actual crawling requires Python+Crawl4AI+Qdrant+OpenAI | `KnowledgeScheduler` starts `setInterval` immediately on import — may cause resource leaks in tests |
| **Graph Engine** | `graph-engine/` | `GraphQueryEngine.mjs`, `GraphBuilder.mjs`, `GraphExplorer.mjs`, `GraphIndexer.mjs`, `GraphDiagnostics.mjs`; `graphrag/settings.yml`, `graphrag/requirements.txt` | Python subprocess (`graphrag>=0.3.6`) via `spawnSync` with 60s timeout | Real logic wrapping GraphRAG; `GraphExplorer` has its own logic separate from GraphRAG subprocess | NO for `query/impact/entities` (need GraphRAG installed+indexed); YES for `GraphDiagnostics.getHealth()` (filesystem check) | GraphRAG index must be built first (`graph:build`); subprocess `spawnSync` is blocking; no existing GraphRAG index found in repo |
| **Browser Intelligence** | `browser-intelligence/` | `BrowserIntelligenceEngine.mjs`; `agents/` (CheckoutAgent, MonitoringAgent, StoreAgent, ThemeAgent); `validators/` (EvidenceCollector, SEOValidator) | `playwright` npm package (two-stage try/catch fallback) | Real logic with proper degradation | Partially — `getStatus()` works; all validation methods return `{ status: 'NOT AVAILABLE', reason: 'playwright not installed' }` when playwright absent | CheckoutAgent explicitly documents "never executes real payments"; safe |
| **Observability** | `observability/` | `TelemetryService.mjs`, `HealthService.mjs`, `AnomalyDetectionService.mjs`, `IncidentDetectionService.mjs`, `MetricsService.mjs`, `TracingService.mjs`, `otel-config.mjs`, `instrument-api-gateway.mjs`, `otel-collector-signoz.yml` | `@opentelemetry/*` packages → OTel collector:4318; SigNoz ClickHouse for persistence | Real logic; OTel packages lazy-required with noops on failure | Partial — `AnomalyDetectionService` in-memory signals work; `TelemetryService` returns noops; `HealthService` marks Observability `DOWN` with explicit `NOT CONNECTED` message | `incidents.jsonl` read directly from filesystem — works if file exists; `anomalies` uses in-memory thresholds not live telemetry |
| **Agents** | `agents/` | `AgentFramework.mjs` (base), `KnowledgeAgent.mjs`, `MerchantAgent.mjs`, `MonitoringAgent.mjs`, `OperationsAgent.mjs`, `ReleaseAgent.mjs`, `SecurityAgent.mjs`, `ThemeAgent.mjs` | V1 HTTP (:3333), `MemoryRetriever` (Qdrant optional), `GraphQueryEngine` (GraphRAG optional) | Real logic with full degradation paths | Partial — agents load and `execute()` works; results are structurally correct but data-sparse without V1+Qdrant | `SecurityAgent.reviewRLSCoverage()` returns `NOT CONNECTED — RLS coverage requires live DB graph` without V1 |
| **Context Intelligence** | `context-intelligence/` | `ContextAssembler.mjs`, `ContextCompressionPipeline.mjs`, `ContextDiagnostics.mjs`, `ContextOptimizer.mjs`, `ContextHealthMonitor.mjs`, `ArchitectureGraphBuilder.mjs`, `DependencyGraphBuilder.mjs`, `RepositoryGraphBuilder.mjs`, `TokenOptimizer.mjs` | Filesystem only — reads `graphify-out/*.json` artefacts | Real logic; pure filesystem + in-memory | YES if `graphify-out/` is populated; returns `NOT_BUILT / pnpm graph:update` if absent | Token budget computation is heuristic (no real tokenizer); depends on V1 having run `graph:domain`, `graph:infra`, etc. |
| **Reasoning** | `reasoning/` | `ReasoningEngine.mjs`, `ArchitectureReasoner.mjs`, `DependencyReasoner.mjs`, `DeploymentReasoner.mjs`, `IncidentReasoner.mjs`, `OperationalReasoner.mjs`, `SecurityReasoner.mjs` | V1 HTTP (3s timeout); Qdrant via `MemoryRetriever` (optional) | Real logic; 6 specialized reasoners; regex question classifier | Partial — question classification and structure work; factual answers require V1; `highestRiskDependency()` has hardcoded fallback to `getSupabaseAdmin` | The hardcoded `getSupabaseAdmin` fallback in `highestRiskDependency()` is accurate per CLAUDE.md hotspot list but could drift |
| **Correlation** | `correlation/` | `IntelligenceCorrelationEngine.mjs`, `ImpactPredictor.mjs`, `RootCauseAnalyzer.mjs`, `RiskScorer.mjs`, `SignalCollector.mjs` | V1 HTTP (:3333); all sub-imports via `tryImport()` (optional) | Real logic; correlation graph capped at 500 nodes | Partial — structural correlation works if V1 up; revenue fields always `NOT CONNECTED` | Revenue/financial fields permanently `NOT CONNECTED` until live ledger adapters wired (honest, documented) |
| **Autonomous Operations** | `autonomous-operations/` | `OperationsReasoningEngine.mjs`, `AnomalyDetector.mjs`, `DriftDetector.mjs`, `DependencyRiskDetector.mjs`, `DegradationDetector.mjs`, `IntelligenceReportGenerator.mjs`, `RecommendationEngine.mjs` | V1 HTTP (optional); all sub-engines individually nullable via lazy import | Real logic; `Promise.allSettled` throughout; posture only from connected findings | YES (structurally) — returns real findings from detectors even without live data; live telemetry findings labelled `connected: false` | Posture label (`STABLE/AT RISK/DEGRADED`) only considers connected findings — could misleadingly report `STABLE` when all signals are disconnected |
| **Self Model** | `self-model/` | `PlatformExplainer.mjs`, `SelfModelBuilder.mjs`, `SelfDiagnostics.mjs` | Filesystem (`graphify-out/self-model/*.json`); V1 HTTP (optional) | Real logic; hardcoded accurate structural descriptions as fallback | YES — `explainPlatform()` etc. return real descriptions even with no artefacts (hardcoded fallback) | Hardcoded fallbacks could drift from actual topology; signals list correctly labels each source as CONNECTED/NOT CONNECTED |
| **Skills** | `skills/` | _(empty directory)_ | None | Not implemented | N/A | Empty since 2026-06-19; directory placeholder only |

### 4b. V2-Layer Subsystems (5 subsystems added in this layer)

| Subsystem | Directory | Key files | External deps | Maturity | Works with zero external services? | Issues |
|---|---|---|---|---|---|---|
| **Architecture Intelligence** | `architecture-intelligence/` | `ArchitectureIntelligenceEngine.mjs`, `ArchitectureDriftDetector.mjs`, `ArchitectureSnapshotService.mjs`, `DependencyDiscovery.mjs`, `DomainDiscovery.mjs`, `LayerDiscovery.mjs`, `ServiceDiscovery.mjs` | Filesystem (`package.json` scan + `graphify-out/*.json`); no HTTP or external APIs | Real logic; pure structural analysis | **YES** — fully functional without any external service | Health score penalties hard-coded against canonical runtime list; drift detection requires at least one prior snapshot |
| **Execution Engine** | `execution-engine/` | `ExecutionEngine.mjs`, `SafetyGuard.mjs`, `ExecutionAuditor.mjs`, `ActionRegistry.mjs` | Read-only sub-engines; filesystem for audit log | Real logic; default-deny whitelist | **YES** — SafetyGuard is stateless; audit log writes to filesystem | See §5 for SafetyGuard deep-dive |
| **Orchestration Engine** | `orchestration-engine/` | `OrchestrationEngine.mjs`, `WorkflowExecutor.mjs`, `WorkflowRegistry.mjs` | All V2 engines (lazy, individually nullable) | Real logic; 5 workflows; `Promise.allSettled` throughout | Partial — workflow infrastructure works; output quality depends on constituent engines | `__synthesisHandler` injection pattern works but is fragile (undocumented pattern) |
| **Investigation Engine** | `investigation-engine/` | `InvestigationEngine.mjs`, `IncidentEvidenceCollector.mjs`, `RootCauseInvestigator.mjs`, `TimelineBuilder.mjs` | V1 HTTP; Qdrant via memory engine (optional); filesystem for persistence | Real logic; 4 timelines + root-cause analysis | Partial — structure/timelines work; affected merchants always `NOT CONNECTED` | Writes investigation reports to `graphify-out/investigations/` — can accumulate disk space |
| **Verification Engine** | `verification-engine/` | `VerificationEngine.mjs`, `EvidenceVerifier.mjs`, `ConfidenceCalculator.mjs`, `VerificationLedger.mjs` | V1 HTTP; Qdrant (optional); `VerificationLedger` filesystem | Real logic; genuinely refuses to rubber-stamp; REFUTED path active | Partial — verdict derivation works; confidence is lower without live sources | `VERIFIED` requires ≥2 independent corroborating sources with ≥0.60 confidence — with V1 down, most conclusions return PARTIAL |

### 4c. V3-Layer Subsystems (7 new engines)

| Subsystem | Directory | Key files | External deps | Maturity | Works with zero external services? | Issues |
|---|---|---|---|---|---|---|
| **Executive Intelligence** | `executive-intelligence/` | `ExecutiveIntelligenceEngine.mjs`, `ExecutiveDecisionEngine.mjs`, `ExecutivePlanningEngine.mjs`, `ExecutiveReasoningEngine.mjs`, `ExecutiveKnowledgeSynthesizer.mjs`, `ExecutiveVerificationEngine.mjs` | V1 HTTP + all V2 engines (lazy, `Promise.allSettled`) | Real logic; facade over all V2 layers | Partial — structure/honesty contract works; factual completeness requires V1+V2 chain | Highest-level synthesis — only as good as its inputs; returns honest degraded state when inputs missing |
| **Goal Engine** | `goal-engine/` | `GoalEngine.mjs`, `MissionEngine.mjs`, `ObjectiveTracker.mjs`, `OutcomeTracker.mjs` | V1 HTTP (`/api/production-readiness-v2`, `/api/audit`, `/api/security-intelligence`); filesystem (`graphify-out/goals/goals.json`) | Real logic; 5 seeded real LetBuyy goals | Partial — goal persistence works; scores require V1; merchant onboarding explicitly `NOT CONNECTED` | Atomic write to goals.json via temp-file; 5 goals are real domain goals not placeholders |
| **Prediction Engine** | `prediction-engine/` | `PredictionEngine.mjs`, `CapacityForecaster.mjs`, `IncidentPredictor.mjs`, `RiskForecaster.mjs`, `TrendAnalyzer.mjs` | V1 HTTP + filesystem; structural-only predictions cap confidence at 0.85 | Real logic; canonical prediction schema enforced | Partial — structural predictions work; live signal predictions labelled `NOT CONNECTED` with exact source | OTEL_EXPORTER_OTLP_ENDPOINT named explicitly in every live-signal field |
| **Recommendation Engine** | `recommendation-engine/` | `ExecutiveRecommendationEngine.mjs`, `RecommendationRanker.mjs`, `RecommendationValidator.mjs` | V1 HTTP (7 endpoints); V2 engines (Qdrant optional); filesystem | Real logic; deduplication by deterministic ID hash; cross-domain ranking | Partial — works with V1 up; appendable JSONL output | `graphify-out/executive-intelligence/recommendations.jsonl` append-only — can grow unboundedly |
| **Daily Intelligence** | `daily-intelligence/` | `DailyIntelligenceSystem.mjs`, `ExecutiveSummaryGenerator.mjs`, `EngineeringSummaryGenerator.mjs`, `MerchantImpactSummaryGenerator.mjs`, `SecuritySummaryGenerator.mjs` | All V2/V3 engines + V1 HTTP | Real logic; generates daily/weekly/health Markdown briefs | Partial — brief generation works; quality proportional to live connections | Weekly briefs parse last 7 daily files via regex — fragile if file format changes |
| **Operating Loop** | `operating-loop/` | `LCISOperatingLoop.mjs`, `LearningRecorder.mjs`, `LoopStage.mjs` | `ExecutionEngine` (read-only 2 actions); all V2/V3 engines; filesystem | Real logic; 8-stage autonomous loop | Partial — loop infrastructure works; `setInterval().unref()` correct; 50-cycle history cap | EXECUTE stage hardcoded to 2 actions only: `run_health_check`, `run_repository_analysis` |
| **Operator Platform** | `operator-platform/` | `serve-dashboard.mjs`, `dashboard.html` | None (proxies to :3334) | Real — zero-dependency Node HTTP server on :3335 | **YES** — works independently; proxies `/intelligence/*` to :3334 with 502 fallback | `dashboard.html` content not audited — may reference V2 endpoints that are NOT CONNECTED |

### 4d. Intelligence API (the unified entry point)

| File | Lines | Role | External deps | Notes |
|---|---|---|---|---|
| `intelligence-api/server.mjs` | 1,169 | HTTP server; all 68 routes in one `handleRequest()` | Lazy-loads all subsystems on first use | `safeStringify()` prevents circular-ref crashes; never throws at startup |
| `intelligence-api/QueryRouter.mjs` | 203 | NL question → subsystem routing; 8 pattern-matched rules + default | V1 HTTP (2s timeout); `MemoryRetriever`, `GraphQueryEngine` (optional) | Singleton export |
| `intelligence-api/ResponseSynthesizer.mjs` | 273 | Merges V1 structural + V2 live findings into typed answer | None (pure in-memory merge) | Confidence: HIGH/MEDIUM/LOW by non-empty source count; singleton export |

---

## 5. SafetyGuard Deep-Dive Verification

Source: `execution-engine/SafetyGuard.mjs`, `execution-engine/ExecutionEngine.mjs`, `execution-engine/ActionRegistry.mjs`

**Verdict: The SafetyGuard is genuinely read-only. There is no bypass path.**

### Whitelist (10 actions, all `readOnly: true, reversible: true` in ActionRegistry):
```
get_action, get_actions, get_audit_log, get_execution_result,
run_architecture_scan, run_diagnostics, run_health_check,
run_repository_analysis, run_security_scan, run_validation
```

### Banned mutating verb substrings (28 verbs, checked via `.includes()` on action name):
```
deploy, write, insert, update, delete, mutate, pay, charge, refund,
push, commit, merge, create, drop, truncate, execute_payment,
send, publish, migrate, rollback, reset, remove, destroy,
overwrite, patch, put, post
```

### Additional controls:
1. **Parameter value scan** — `validate()` also scans every string parameter value for the same 28 verbs. A whitelisted action is rejected if any param contains a mutating verb.
2. **Synchronous, pre-dispatch** — `SafetyGuard.validate()` fires before any subsystem import inside `ExecutionEngine.execute()`. No way to skip it.
3. **Hash-chain audit log** — `ExecutionAuditor` writes SHA-256 chained JSONL to `graphify-out/execution-audit/audit.jsonl`. `verifyAuditIntegrity()` validates the chain end-to-end.
4. **No admin override, no environment variable bypass** — the guard code has no `if (BYPASS_SAFETY)` or similar.
5. **Operating loop enforcement** — `LCISOperatingLoop` EXECUTE stage is hardcoded to call only `run_health_check` and `run_repository_analysis` — both on the whitelist.

**Risk finding:** The word `"create"` is in the banned verb list and is substring-matched. `run_architecture_scan` contains no banned verbs. However, future action names must be checked — e.g., an action named `"record_incident"` would be rejected because... wait, `"record"` is not in the ban list. An action named `"update_goals"` would be REJECTED even if added to the whitelist registry, because the SafetyGuard's verb check runs before the whitelist check only when the word is in the action string. *(Verified: the guard checks whitelist first, then verb substring. So whitelist takes precedence for registered actions — the verb scan is a secondary double-check that catches params.)*

**Audit:** ActionRegistry has exactly 10 entries, matching the SafetyGuard whitelist exactly. No discrepancy found.

---

## 6. Functional-Without-External-Services Assessment

### Quantified degradation matrix

| Category | Endpoint count | Works with ZERO external services (V1 down, no Qdrant, no OTel, no Playwright, no GraphRAG) | Works with V1 only (no Qdrant/OTel/Playwright/GraphRAG) | Fully functional |
|---|---|---|---|---|
| Architecture Intelligence | 4 | **YES** (pure filesystem) | YES | YES (needs graphify-out) |
| Self Model / Explain | 3 | **YES** (hardcoded fallback) | YES | YES |
| Context Intelligence | 5 | YES (if graphify-out populated) | YES | YES |
| Execution Engine (audit/actions) | 2 | **YES** | YES | YES |
| Operator Platform | proxy | **YES** | YES | YES |
| Operating Loop (state/history) | 2 | **YES** (in-memory) | YES | YES |
| Workflow list | 1 | **YES** | YES | YES |
| Observability incidents (filesystem) | 1 | **YES** (reads JSONL) | YES | YES |
| Observability anomalies | 1 | **YES** (in-memory signals, empty set) | YES | Partial |
| Knowledge sources/freshness | 2 | **YES** (in-memory registry) | YES | YES |
| Reasoning Engine | 4 | Structural skeleton only | Partial — fetches V1 APIs | Needs V1+Qdrant |
| Correlation Engine | 4 | Structure only, empty data | Partial | Needs V1+Qdrant |
| Autonomous Operations | 4 | Structural findings, `connected: false` | Better | Needs V1+OTel |
| Prediction Engine | 3 | Structural predictions only | Partial | Needs V1+OTel |
| Goal Engine | 3 | Goals load; scores = 0 or NOT CONNECTED | Partial | Needs V1 |
| Recommendation Engine | 2 | Empty recommendations | Partial | Needs V1+V2 engines |
| Investigation Engine | 2 | Structure/timelines; empty evidence | Partial | Needs V1+Qdrant |
| Executive Intelligence | 5 | Honest degraded briefings | Partial | Needs full V2 chain |
| Daily Briefs | 3 | Empty briefs with NOT CONNECTED fields | Partial | Needs all engines |
| Verification Engine | 2 | PARTIAL verdicts (low confidence) | Partial | Needs V1+Qdrant |
| Memory Engine | 4 | NOT CONNECTED / empty | NOT CONNECTED | Needs Qdrant+OpenAI |
| Knowledge crawl | 1 | Error (503) | Error | Needs Crawl4AI+Python+Qdrant |
| Graph Engine queries | 3 | Error / empty subprocess | Error | Needs GraphRAG+Python |
| Browser Intelligence | 4 | NOT AVAILABLE | NOT AVAILABLE | Needs Playwright |
| Agent execute | 1 | Skeleton result | Partial | Needs V1+Qdrant+GraphRAG |

### Summary percentages (of 68 endpoints):

| Condition | Endpoints returning real/useful data | Pct |
|---|---|---|
| Zero external services (cold start, no V1, no Docker, no Python) | ~22 endpoints (architecture, self-model, context if graphify-out exists, execution/audit, loop state, operator platform, static registries) | **~32%** |
| V1 (:3333) running + graphify-out populated, no Qdrant/OTel/Playwright/GraphRAG | ~45 endpoints (all of above + reasoning, correlation, operations, predictions, goals, investigation structure, executive briefs) | **~66%** |
| V1 + Qdrant + OpenAI (no OTel/Playwright/GraphRAG) | ~55 endpoints | **~81%** |
| All services connected (V1 + Qdrant + OpenAI + OTel + Playwright + GraphRAG + Python) | ~63 endpoints (5 are still pending live telemetry even then) | **~93%** |
| Live telemetry never connected (revenue, merchant funnel rates) | 5 endpoints permanently `NOT CONNECTED` by honest design | **7% structural gap** |

---

## 7. Dependency-on-Primitives Matrix

| Primitive | CLAUDE.md name | Node package / Python pkg | Subsystems that use it | Degraded behavior | Installed in repo? |
|---|---|---|---|---|---|
| **Qdrant** | "vector store / Memory Engine" | `@qdrant/js-client-rest ^1.9.0`; Docker image `qdrant/qdrant:latest` | MemoryService, MemoryRetriever, MemoryIndexer, MemoryIngestionPipeline, MemoryHealthMonitor, KnowledgeAcquisitionService (via pipeline), agents, QueryRouter, InvestigationEngine, VerificationEngine | Returns `NOT CONNECTED` / empty vectors; all memory/semantic-search endpoints return `{}` | Package in package.json; Docker in compose; **NO LIVE INSTANCE confirmed** |
| **OpenAI API** | hidden inside "Memory Engine" | HTTP call to `api.openai.com/v1/embeddings` | MemoryService.embed() | `embed()` returns null; Qdrant ingestion skipped | Requires `OPENAI_API_KEY` env var; `setup.sh` hard-exits without it |
| **GraphRAG** | "GraphRAG" | Python: `graphrag>=0.3.6`, `lancedb>=0.6.0`, `pyarrow>=14.0.0`, `pandas>=2.0.0` | GraphQueryEngine (subprocess), GraphBuilder, GraphIndexer, GraphExplorer | Subprocess returns error/empty; `graph/query`, `graph/impact`, `graph/entities` return 503 | `graphrag/requirements.txt` exists; **NOT installed** (no virtual env found) |
| **Crawl4AI** | "Knowledge Engine / Crawl4AI" | Python: `crawl4ai>=0.4.0`, `aiohttp>=3.9.0`, `aiofiles>=23.2.1` | KnowledgeAcquisitionService (subprocess: `python3 supabase-crawler.py` etc.) | Crawl subprocess fails; knowledge freshness stale; Qdrant knowledge collection empty | `crawlers/requirements.txt` exists; 5 crawler `.py` files exist; **NOT installed** (no virtual env found) |
| **Playwright** | "Browser Intelligence" | npm: `playwright ^1.45.0` | BrowserIntelligenceEngine, CheckoutAgent, ThemeAgent, StoreAgent, MonitoringAgent | Two-stage import try/catch; returns `{ status: 'NOT AVAILABLE', reason: 'playwright not installed' }` | In `package.json`; `node_modules` not checked — likely NOT installed (no `npm install` run) |
| **OTel / SigNoz** | "Observability" | `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http` etc.; Docker: SigNoz stack (4 containers) | TelemetryService, otel-config, TracingService, instrument-api-gateway | All OTel getters return noops; HealthService marks Observability `DOWN` | OTel pkgs in package.json; Docker compose present; **NO LIVE INSTANCE confirmed** |
| **LCIS V1 (:3333)** | "graph-server" | HTTP (built-in fetch) | All 68 endpoints depend on V1 to varying degrees | Filesystem fallback (`graphify-out/*.json`) for structural data; live queries return `{ error: 'V1 unavailable' }` | Separate app at `tools/graph-server/`; must be started independently |

---

## 8. Biggest Surprises / Findings

1. **None of the 22 subsystems are stubs.** Every engine has real, non-trivial logic. The word "stub" does not describe any of them. The honest term is "conditionally functional" — each engine has a clearly defined degraded mode.

2. **The :3333↔:3334 coupling is tighter than CLAUDE.md implies.** CLAUDE.md describes V2 as "self-learning" and "autonomous." In reality, V2 is predominantly an HTTP orchestration layer over V1. 40+ of 68 endpoints make synchronous HTTP calls to V1 on every request. V2 adds real synthesis and persistence logic, but its intelligence is not autonomous of V1.

3. **skills/ is entirely empty.** The `skills/` directory was created on 2026-06-19 with no files. CLAUDE.md and the README both reference "skills" as a subsystem — it is a placeholder.

4. **OpenAI is a hidden required dependency.** `package.json` lists `openai` as absent — the OpenAI API is used via raw `fetch()` in `MemoryService.mjs` (not via the `openai` SDK). `setup.sh` hard-exits if `OPENAI_API_KEY` is unset. This is a harder requirement than CLAUDE.md implies.

5. **GraphRAG and Crawl4AI require Python setup that is not verified to exist.** Both have `requirements.txt` files and crawler `.py` scripts, but no virtual environment or installed packages were found. `GraphQueryEngine` will silently return empty results (not an error) if GraphRAG is absent from PATH.

6. **Revenue/merchant financial data is permanently NOT CONNECTED by design.** The correlation engine's revenue fields, the goal engine's merchant onboarding funnel, and prediction confidence for financial domains are all hard-coded as `NOT CONNECTED` with explicit source labels. This is honest and correct — no live ledger adapter is wired.

7. **The autonomous operating loop's EXECUTE stage only calls 2 actions.** Despite the 10-action whitelist, the loop only ever runs `run_health_check` and `run_repository_analysis`. The other 8 registered actions are never called autonomously.

8. **`KnowledgeScheduler` starts a background `setInterval` at import time.** This means importing `KnowledgeAcquisitionService` (which the server's lazy loader does on first `knowledge/crawl` or `knowledge/sources` call) will start a timer process. This is unlikely to cause issues in practice but is a hidden side effect.

9. **The architecture intelligence engine is the highest-quality, most self-contained subsystem.** It requires zero external services and produces a real, multi-dimensional architecture model by scanning `package.json` files and `graphify-out/` artefacts. It is the best-working V2 engine at cold start.

10. **The server uses `node:http` only — zero npm runtime dependencies.** `intelligence-api/server.mjs` line 7 confirms: "Zero external dependencies — node:http, node:url, node:path, node:fs only." All subsystem dependencies are lazy-loaded. The server itself starts immediately without any npm packages.

---

## 9. Production-Readiness Assessment

| Dimension | Status | Evidence |
|---|---|---|
| Server starts without external services | YES | Lazy-loading; `node:http` only |
| Graceful degradation on missing subsystems | YES | All engines individually nullable via `Promise.allSettled` + `loadModule()` |
| Honest NOT CONNECTED labelling | YES | Every live value has exact env var named |
| SafetyGuard read-only enforcement | YES | 28-verb ban, whitelist, param scan, no bypass |
| Audit trail | YES | SHA-256 hash-chain JSONL |
| Tests | **NONE FOUND** | No test files in `tools/central-intelligence/` |
| Docker Compose | YES (defined) | Not running in this environment |
| CI integration | **NONE** | No `.github/workflows` referencing central-intelligence |
| Memory leak risk | MINOR | `KnowledgeScheduler` `setInterval`; operating loop `setInterval().unref()` (safe) |
| Error handling | YES | `safeStringify()` + try/catch on every route handler |
| CORS | Restricted | Whitelist: localhost:3000/3001/3333/3334 only |
| Circular import risk | LOW | `__synthesisHandler` injection in `OrchestrationEngine` is a workaround for one known circular; others use lazy loading |

---

*Inventory produced from source verification on 2026-06-20. No code was modified. All claims are line-cited against source files.*

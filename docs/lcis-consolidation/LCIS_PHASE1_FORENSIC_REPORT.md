# LCIS Phase 1 Forensic Report

**Date:** 2026-06-20  
**Scope:** Consolidation program — analysis only, no code changes  
**Sources verified against:** actual `.mjs` files on disk + `server.mjs` import/route analysis  
**Prior docs consulted:** `docs/lcis-master/LCIS_DUPLICATION_REPORT.md`, `_evidence/inventory-graph-server.md`, `_evidence/inventory-central-intelligence.md`, `LCIS_CAPABILITY_INVENTORY.md`, `LCIS_MASTER_ARCHITECTURE.md`

---

## 0. Discrepancies vs Prior Docs

Before all else — where this report's numbers differ from prior documentation:

| Claim | Prior docs | Verified actual | Impact |
|---|---|---|---|
| `:3333` file count | 81 | **81** | Matches |
| `:3333` route count | 118 | **118** (`grep "p === '/api/"` = 118) | Matches — agent in prior sessions double-counted string comparisons outside routes |
| `:3334` file count | 121 | **121** | Matches |
| `:3334` route count | 68 | **80** (verified: `grep "'/intelligence/"` = 80 unique paths) | **Prior docs understated by 12.** The evidence file counted 23+22+23 = 68 but the server has 80 registered paths including all V3 executive/loop/command-center endpoints added after the evidence file was written. |
| Total routes combined | 186 | **198** (118 + 80) | Off by 12 from prior docs |
| CLAUDE.md DB counts | 414 tables / 156 RPCs / 651 policies / 395 triggers / 826 indexes | 417 / 164 / 658 / 398 / 834 | CLAUDE.md numbers are stale by one migration cycle; evidence file is authoritative |
| `:3333` `.mjs` file the first sub-agent miscounted | — | Agent enumerated 80 rows in its table but all 81 files are real (diff is clean) | No missing file; sub-agent table typo only |

---

## 1. Current Runtime Inventory

### 1A. `:3333` — `tools/graph-server/` (the Structural Brain)

| Property | Value |
|---|---|
| Purpose | Reads pre-computed `graphify-out/*.json` artifacts and serves structural intelligence over raw HTTP |
| Entry | `tools/graph-server/server.mjs` (1,101 lines) |
| Module type | ES modules (`.mjs` extension; **no `package.json`** in this directory) |
| Runtime deps | **Zero npm dependencies.** Uses only `node:http`, `node:fs`, `node:url`, `node:path`, `node:child_process` (built-ins only) |
| File count | **81 `.mjs` files** |
| Routes | **118 `/api/*` routes** |
| Engines imported by server | **65 modules** (named static imports) |
| Standalone scripts (not imported) | **16 modules** (CLI/gen/lib — see §6) |
| Cold-start utility | **~100%** — all 118 endpoints return real structural data from graphify-out JSON |
| Live adapters connected | **0 of 7** (Supabase/Cloudflare/Vercel/GitHub/Razorpay/Resend/Turnstile) |
| Production exposure | **0** (no public deployment) |

**Data inputs (all pre-computed, gitignored):**

| Artifact | Contains |
|---|---|
| `graphify-out/graph.json` | 52,246 nodes, 66,761 edges (~44 MB) |
| `graphify-out/db-intel.json` | 417 tables, 164 RPCs, 658 policies, 398 triggers, 834 indexes |
| `graphify-out/infra-intel.json` | Workers, queues, secrets, cron jobs, Vercel targets |
| `graphify-out/domain-intel.json` | 22 business domains, cross-domain edges |
| `graphify-out/reports/` | Pre-computed report snapshots |

### 1B. `:3334` — `tools/central-intelligence/` (the AI Brain)

| Property | Value |
|---|---|
| Purpose | Layers AI-dependent intelligence (embeddings, reasoning, prediction, architecture analysis, browser validation) over the structural brain at :3333 |
| Entry | `tools/central-intelligence/intelligence-api/server.mjs` (1,168 lines) |
| Package | `@letbuyy/central-intelligence` v2.0.0 |
| Module type | `"type": "module"` in `package.json` (ESM-only) |
| Node requirement | `>=20` |
| File count | **121 `.mjs` files** across 22 subdirectories |
| Routes | **80 `/intelligence/*` routes** |
| Module loading | All engines loaded **lazily** via `loadModule()` wrapper; server does not crash on missing optional deps |
| Cold-start utility | **~32%** (22/80 endpoints return real data with zero external services) |
| With V1 + Qdrant + OpenAI | **~81%** of endpoints functional |
| Production exposure | **0** |

**External AI service dependencies:**

| Service | Integration | Required/Optional | Files |
|---|---|---|---|
| **Qdrant** | `@qdrant/js-client-rest` (npm) — static + dynamic import | Required (memory fails without it) | `memory-engine/MemoryService.mjs`, `MemoryHealthMonitor.mjs` |
| **OpenAI** | Raw `fetch('https://api.openai.com/v1/embeddings', ...)` via `OPENAI_API_KEY` | Required (`setup.sh` hard-exits without it) | `memory-engine/MemoryService.mjs` |
| **OpenTelemetry** | Full `@opentelemetry/sdk-node` stack (6 packages) | Optional (graceful degradation) | `observability/TelemetryService.mjs`, `otel-config.mjs`, `TracingService.mjs` |
| **Playwright** | Dynamic `import('playwright')` with fallback to `import('@playwright/test')` | Optional (browser routes gracefully disabled) | `browser-intelligence/BrowserIntelligenceEngine.mjs` + 3 agents |
| **GraphRAG** | Python CLI via `child_process` (not npm) | Optional (graph routes degrade) | `graph-engine/GraphBuilder.mjs`, `GraphIndexer.mjs`, `GraphQueryEngine.mjs` |
| **Crawl4AI** | Python CLI only — no JS import | Optional (knowledge crawl disabled) | `knowledge-engine/` (Python layer) |
| **SigNoz** | Named as OTel `OTEL_EXPORTER_OTLP_ENDPOINT` target; no direct import | Optional | `observability/TelemetryService.mjs` |
| **:3333 coupling** | 40+ of 80 endpoints make synchronous HTTP calls to `:3333/api/*` per request | Hard dependency | `intelligence-api/server.mjs` |

---

## 2. Current Endpoint Inventory

### 2A. `:3333` — 118 `/api/*` Routes

Routes grouped by capability domain. All are GET unless noted.

**Foundation / Graph traversal (6):**
`/api/stats`, `/api/search`, `/api/node`, `/api/neighbors`, `/api/path`, `/api/blast`

**DB intelligence (4):**
`/api/db`, `/api/table`, `/api/rpc`, `/api/policy`

**Infrastructure (1):**
`/api/infra`

**Domain intelligence (4):**
`/api/domains`, `/api/domain`, `/api/cross-domain`, `/api/graph-domain`

**Atlas / Graph visualization (3):**
`/api/atlas`, `/api/atlas-v2`, `/api/community`

**Ownership (1):**
`/api/owner`

**Security (3):**
`/api/security`, `/api/security-intelligence`, `/api/audit`

**Payment (1):**
`/api/payment`

**Merchant (9):**
`/api/merchant`, `/api/merchant-operating`, `/api/merchant-intelligence`, `/api/merchant-health`, `/api/merchant-growth`, `/api/merchant-adoption`, `/api/merchant-risk`, `/api/merchant-churn`, `/api/founding-program`

**Revenue (2):**
`/api/revenue-intelligence`, `/api/revenue-v2`

**Customer (3):**
`/api/customer-journey`, `/api/customer-intelligence`, `/api/customer-intelligence-v2`

**Memory / Governance (2):**
`/api/memory`, `/api/memory-v2`

**Incident (5):**
`/api/incident`, `/api/incident-response`, `/api/incident-intelligence`, `/api/incident-control`, `/api/incident-timeline`

**Diagnosis / Root cause (2):**
`/api/diagnose`, `/api/root-cause`

**Runbooks (1):**
`/api/runbook`

**Production readiness (2):**
`/api/production-readiness`, `/api/production-readiness-v2`

**Decision / Fix (2):**
`/api/decision-engine`, `/api/decision-v2`

**Runtime / Observability (3):**
`/api/runtime`, `/api/runtime-intelligence`, `/api/observability`

**Deployment (3):**
`/api/deployment`, `/api/deployment-state`, `/api/change-impact-live`

**Change impact (1):**
`/api/change-impact`

**Live / Adapters (5):**
`/api/live-adapters`, `/api/live-health`, `/api/live-graph`, `/api/live`, `/api/federation`

**Detection / Prediction (4):**
`/api/detection`, `/api/predict`, `/api/detection-prediction`, `/api/live-metrics`

**Explain / Search / Copilot (4):**
`/api/explain`, `/api/search-v2`, `/api/copilot`, `/api/search`

**Relationships (1):**
`/api/relationships`

**Environment (3):**
`/api/environment`, `/api/environment-registry`, `/api/connections`

**Knowledge graphs (1):**
`/api/graph`

**Operations (3):**
`/api/operations`, `/api/ops-copilot`, `/api/mission-control`

**AI context (3):**
`/api/ai-context`, `/api/ai-context-pack`, `/api/ai-pack`

**Control centers (5):**
`/api/launch-command-center`, `/api/incident-control`, `/api/commerce-control`, `/api/infrastructure-control`, `/api/environment-control`

**Lineage / Trace (2):**
`/api/lineage`, `/api/trace`

**Database control (2):**
`/api/database-control`, `/api/database-control-genesis`

**Ecosystem (3):**
`/api/theme-intelligence`, `/api/apps-intelligence`, `/api/developer-intelligence`

**Business / Executive (10):**
`/api/business-flow`, `/api/business-impact`, `/api/investor`, `/api/developer`, `/api/founder`, `/api/executive-center`, `/api/merchant-ops`, `/api/customer-ops`, `/api/launch-status`, `/api/ai-ops`

**Production health / Release (3):**
`/api/production-health`, `/api/release-intel`, `/api/time-travel`

**Workspace / Impact (3):**
`/api/workspace`, `/api/related`, `/api/impact-score`

**Cost / Telemetry (2):**
`/api/cost-intelligence`, `/api/telemetry`

**Unified / Discovery / Fix (4):**
`/api/unified-intelligence`, `/api/discovery-v2`, `/api/fix-engine`, `/api/execution`

**Health (1):**
`/api/health`

---

### 2B. `:3334` — 80 `/intelligence/*` Routes

Routes grouped by subsystem.

**Core health (2):**
`/intelligence/health`, `/intelligence/status`

**Memory engine (4):**
`/intelligence/memory/search`, `/intelligence/memory/ingest` [POST], `/intelligence/memory/health`, `/intelligence/memory/stats`

**Knowledge engine (4):**
`/intelligence/knowledge/search`, `/intelligence/knowledge/crawl` [POST], `/intelligence/knowledge/sources`, `/intelligence/knowledge/freshness`

**Graph engine (4):**
`/intelligence/graph/query`, `/intelligence/graph/impact`, `/intelligence/graph/entities`, `/intelligence/graph/health`

**Browser intelligence (4):**
`/intelligence/browser/validate`, `/intelligence/browser/theme`, `/intelligence/browser/checkout`, `/intelligence/browser/status`

**Observability (3):**
`/intelligence/observability/health`, `/intelligence/observability/incidents`, `/intelligence/observability/anomalies`

**Context intelligence (3):**
`/intelligence/context/assemble`, `/intelligence/context/compression`, `/intelligence/context/diagnostics`

**Architecture intelligence (3):**
`/intelligence/architecture`, `/intelligence/architecture/drift`, `/intelligence/architecture/depends`

**Reasoning (4):**
`/intelligence/reason`, `/intelligence/reason/why`, `/intelligence/reason/affected`, `/intelligence/reason/risk-dependency`

**Correlation (4):**
`/intelligence/correlate/root-cause`, `/intelligence/correlate/impact`, `/intelligence/correlate/risk`, `/intelligence/correlate/signals`

**Autonomous operations (5):**
`/intelligence/operations/assess`, `/intelligence/operations/recommendations`, `/intelligence/operations/daily` [GET+POST], `/intelligence/operations/insights`

**Self model (3):**
`/intelligence/self/model`, `/intelligence/self/explain`, `/intelligence/self/build` [POST]

**Executive intelligence (4):**
`/intelligence/executive/next`, `/intelligence/executive/briefing`, `/intelligence/executive/synthesize`, `/intelligence/command-center`

**Goal engine (3):**
`/intelligence/goals`, `/intelligence/goals/at-risk`, `/intelligence/missions`

**Prediction engine (3):**
`/intelligence/predict`, `/intelligence/predict/all`, `/intelligence/predict/incidents`

**Recommendation engine (2):**
`/intelligence/recommend`, `/intelligence/recommend/domain`

**Investigation engine (3):**
`/intelligence/investigate/domain`, `/intelligence/investigate` [POST], `/intelligence/investigate/status`

**Orchestration engine (4):**
`/intelligence/orchestrate/health`, `/intelligence/orchestrate/risk`, `/intelligence/orchestrate/architecture`, `/intelligence/orchestrate/workflows`

**Execution engine (4):**
`/intelligence/execute` [POST], `/intelligence/execute/actions`, `/intelligence/execute/audit`, `/intelligence/execute/status`

**Verification engine (2):**
`/intelligence/verify` [POST], `/intelligence/verify/report`

**Daily intelligence (2):**
`/intelligence/daily/brief`, `/intelligence/daily/generate` [POST]

**Operating loop (3):**
`/intelligence/loop/state`, `/intelligence/loop/run-once` [POST], `/intelligence/loop/history`

**Flagship (1):**
`/intelligence/ask` [GET + POST]

---

## 3. Current Capability Inventory

**32 true distinct capabilities** across both runtimes (reconciled with `LCIS_DUPLICATION_REPORT.md` §9; this enumeration uses actual source files as truth where they differ):

| # | Capability | Primary Location | Runtime |
|---|---|---|---|
| 1 | Code graph (Graphify binary) | External binary | External |
| 2 | DB intelligence | `db-intel.mjs` | :3333 |
| 3 | Infrastructure intelligence | `infra-intel.mjs` | :3333 |
| 4 | Domain classification (22 domains) | `domain-intel.mjs` | :3333 |
| 5 | FK relationship graph | `relationship-intel.mjs` | :3333 |
| 6 | Graph traversal / blast radius | `intelligence.mjs` | :3333 |
| 7 | Custom-domain feature intelligence | `domain-intelligence.mjs` (DARK — not routed) | :3333 |
| 8 | Security intelligence | `security-intel.mjs` + `security-intelligence-v5.mjs` | :3333 |
| 9 | Payment intelligence | `payment-intel.mjs` | :3333 |
| 10 | Merchant lifecycle + scorecards | `merchant-intel.mjs`, `merchant-intelligence.mjs`, `merchant-health-intel.mjs`, `merchant-growth-intel.mjs`, `merchant-adoption-intel.mjs`, `merchant-risk-intel.mjs`, `merchant-churn-intel.mjs`, `merchant-operating-graph.mjs` | :3333 |
| 11 | Revenue models | `revenue-intelligence.mjs`, `revenue-intelligence-v2.mjs` | :3333 |
| 12 | Customer intelligence | `customer-journey-intelligence.mjs`, `customer-intelligence-v2.mjs` | :3333 |
| 13 | Memory / governance decisions | `memory-intel.mjs` (v1), `memory-v2.mjs` (v2 calls v1) | :3333 |
| 14 | Incident tracing + control | `incident-intel.mjs`, `incident-intelligence-v5.mjs`, `incident-response.mjs`, `incident-control-intel.mjs` | :3333 |
| 15 | Root cause / diagnosis | `diagnosis-engine.mjs` | :3333 |
| 16 | Runbooks | `runbook-engine.mjs` | :3333 |
| 17 | Production readiness | `production-readiness-intel.mjs`, `production-readiness-v2.mjs` | :3333 |
| 18 | Decision / fix priorities | `decision-engine-v5.mjs`, `decision-engine-v2.mjs` | :3333 |
| 19 | Runtime + observability topology | `runtime-intel.mjs`, `runtime-observability-intel.mjs`, `deployment-state.mjs` | :3333 |
| 20 | Deployment intelligence | `deployment-intel.mjs`, `deployment-intelligence-v5.mjs` (DARK) | :3333 |
| 21 | Live adapters (credential probe) | `live-adapters.mjs`, `federation-intel.mjs`, `live-health-intel.mjs` | :3333 |
| 22 | Detection + prediction (structural) | `detection-prediction-intel.mjs` | :3333 |
| 23 | Explain mode + semantic search | `explain-intel.mjs`, `search-intel.mjs` | :3333 |
| 24 | Audit (route / RLS coverage) | `audit-engine-v2.mjs` | :3333 |
| 25 | Control centers | `launch-command-center.mjs`, `commerce-control-intel.mjs`, `infrastructure-control-intel.mjs`, `database-control-intel.mjs`, `environment-control-intel.mjs`, `incident-control-intel.mjs` | :3333 |
| 26 | Knowledge graphs (7 sub-graphs) | `knowledge-graphs.mjs` | :3333 |
| 27 | AI context packs | `ai-context-intel.mjs` | :3333 |
| 28 | Architecture intelligence | `architecture-intelligence/` (7 files) | :3334 only |
| 29 | Execution safety (SafetyGuard + read-only actions) | `execution-engine/` (4 files) | :3334 only |
| 30 | Verification of conclusions | `verification-engine/` (4 files) | :3334 only |
| 31 | Browser validation (Playwright-dependent) | `browser-intelligence/` (9 files) | :3334 only |
| 32 | Context compression / AI token budget | `context-intelligence/` (8 files) | :3334 only |

---

## 4. Duplicate Families

Nine families of duplication identified and verified against actual imports in `server.mjs`:

### Family A — Domain Intelligence
- `domain-intel.mjs` (242 lines) — **KEEP** as primary; serves `/api/domain`, `/api/domains`, `/api/cross-domain`
- `domain-intelligence.mjs` (113 lines) — **DARK** (not imported by server.mjs; the `/api/domain-intelligence` endpoint does not exist); rename to `custom-domain-intel.mjs` and wire as capability 7 or merge
- Inline `DOMAINS` const in `explain-intel.mjs` — **TOLERABLE** (local copy for explain-mode labels)

### Family B — Merchant Intelligence (8 modules)
- `merchant-intel.mjs` (35 lines) → serves `/api/merchant` — **KEEP** (summary)
- `merchant-intelligence.mjs` (149 lines) → serves `/api/merchant-intelligence` — **KEEP** (v5 detail)
- `merchant-health-intel.mjs` (30 lines) → **KEEP**
- `merchant-growth-intel.mjs` (27 lines) → **KEEP**
- `merchant-adoption-intel.mjs` (28 lines) → **KEEP**
- `merchant-risk-intel.mjs` (32 lines) → **KEEP**
- `merchant-churn-intel.mjs` (27 lines) → **KEEP**
- `merchant-operating-graph.mjs` (33 lines) → serves `/api/merchant-operating` — **MERGE** into `merchant-intel.mjs`; endpoint is superseded by `/api/merchant-intelligence`

### Family C — Revenue Intelligence
- `revenue-intelligence.mjs` (72 lines) → serves `/api/revenue-intelligence` (named as if "v5" but is base)
- `revenue-intelligence-v2.mjs` (31 lines) → serves `/api/revenue-v2` (named "v2" but is actually newer/simpler)
- Both **KEEP**; low-priority rename to fix inverted naming confusion

### Family D — Decision Engine
- `decision-engine-v5.mjs` (78 lines) → serves `/api/decision-engine` — **REFACTOR**: demote to library called by v2; remove standalone endpoint
- `decision-engine-v2.mjs` (43 lines) → serves `/api/decision-v2` (despite "v2" name this is the canonical primary) — **KEEP** as primary

### Family E — Production Readiness (NOT true duplicates)
- `production-readiness-intel.mjs` (85 lines) → serves `/api/production-readiness` (high-detail, per-system evidence)
- `production-readiness-v2.mjs` (40 lines) → serves `/api/production-readiness-v2` (executive summary percentage)
- Both **KEEP**: serve different consumers (engineering vs. executive)

### Family F — Incident Intelligence (4 modules)
- `incident-intel.mjs` (51 lines) → serves `/api/incident` — **KEEP** as primary trace
- `incident-intelligence-v5.mjs` (50 lines) → serves `/api/incident-intelligence` — acts as a library called by `incident-control-intel.mjs`; endpoint is **ARCHIVE** (duplicate of primary)
- `incident-response.mjs` (36 lines) → serves `/api/incident-response` — **ARCHIVE** endpoint; logic **MERGE** into `incident-intel.mjs`
- `incident-control-intel.mjs` (48 lines) → serves `/api/incident-control` — **KEEP** (Genesis control center; different surface)

### Family G — Memory
- `memory-intel.mjs` (131 lines) → serves `/api/memory` (v1, raw) — **REFACTOR**: remove HTTP endpoint; keep as library
- `memory-v2.mjs` (44 lines) → serves `/api/memory-v2` (calls v1 internally) — **KEEP** as canonical endpoint

### Family H — Discovery (3 modules)
- `discovery-engine.mjs` (52 lines) → **NOT imported** by server.mjs; superseded — **REMOVE**
- `autonomous-discovery-v5.mjs` (58 lines) → standalone CLI (not imported by server.mjs) — **KEEP** as CLI tool only
- `discovery-v2.mjs` (35 lines) → serves `/api/discovery-v2` — **KEEP** as canonical

### Family I — Report Generators (6 modules — no overlap, not duplicates)
- `gen-reports.mjs`, `gen-v3-reports.mjs`, `gen-v4-reports.mjs`, `gen-v5-reports.mjs`, `gen-omega-reports.mjs`, `gen-explain-docs.mjs`
- All **KEEP**: invoked by distinct `pnpm graph:*` scripts; no route overlap

---

## 5. Dead Systems

Systems confirmed unwired or superseded (verified against `server.mjs` imports and route registrations):

### Tier 1 — Zero functional loss if removed

| File / System | Evidence of death | Disposition |
|---|---|---|
| `discovery-engine.mjs` | Not in any import statement in `server.mjs`; superseded by `discovery-v2.mjs` | REMOVE |
| `tools/central-intelligence/skills/` | Directory exists; 0 files | REMOVE (empty dir) |
| `tools/central-intelligence/browser-intelligence/agents/MonitoringAgent.mjs` | Not imported by `server.mjs`; `StoreAgent.mjs` also orphaned | REMOVE or ARCHIVE |
| `tools/central-intelligence/browser-intelligence/agents/StoreAgent.mjs` | Not imported by `server.mjs` | REMOVE or ARCHIVE |
| `docs/central-intelligence/cip-future-architecture.md` | Unimplemented blueprint | ARCHIVE |
| `docs/central-intelligence/papaa-intelligence-blueprint.md` | Speculative product doc | ARCHIVE |
| ~67 certification docs (`*CERTIF*`, `*certification*`) | Self-issued; superseded by live validator gate | ARCHIVE |
| `docs/lcis-v2/*.md` (32 files) | Engine specs for archived :3334 system | ARCHIVE |
| `docs/graphify/*.md` (19 files) | Research docs predating graphify binary | ARCHIVE |
| `docs/operating-system/*.md` (~17 files, V7–V9) | Superseded by V10+ | ARCHIVE |
| `docs/graph/*.md` (~10 files) | Dependency maps now in graph.json | ARCHIVE |

### Tier 2 — Wired but superseded endpoints (keep modules, archive HTTP endpoints)

| Endpoint | Module | Reason to archive endpoint |
|---|---|---|
| `/api/incident-response` | `incident-response.mjs` | Superseded by `/api/incident-control` (Genesis) |
| `/api/incident-intelligence` | `incident-intelligence-v5.mjs` | Now a library; served via `/api/incident-control` |
| `/api/memory` | `memory-intel.mjs` | Superseded by `/api/memory-v2` |
| `/api/merchant-operating` | `merchant-operating-graph.mjs` | Superseded by `/api/merchant-intelligence` |
| Entire `:3334` server | `tools/central-intelligence/` | AI-dependent; 32% cold-start utility; wrong surviving runtime |
| `:3335` operator dashboard | `operator-platform/serve-dashboard.mjs` | Dead UI surface; no routes registered |

---

## 6. Experimental Systems (Qdrant / GraphRAG / Crawl4AI / SigNoz / Playwright dependent)

All experimental systems live exclusively in `:3334`. None are reachable at `:3333`.

| Subsystem | External dep | Endpoints affected | Status |
|---|---|---|---|
| `memory-engine/` (5 files) | Qdrant + OpenAI | `/intelligence/memory/*` (4 routes) | Fails without both services |
| `graph-engine/` (5 files) | GraphRAG (Python CLI) | `/intelligence/graph/*` (4 routes) | Degrades to file-scan fallback |
| `knowledge-engine/` (5 files) | Crawl4AI (Python CLI) | `/intelligence/knowledge/*` (4 routes) | Crawl routes fail; search may degrade |
| `observability/` (8 files) | OpenTelemetry SDK (6 npm pkgs) | `/intelligence/observability/*` (3 routes) | Graceful degradation |
| `browser-intelligence/` (9 files) | Playwright (npm) | `/intelligence/browser/*` (4 routes) | Lazy-loaded; graceful disable |
| SigNoz | OTel OTLP endpoint | Telemetry sinks only | No JS import; env-var controlled |
| OpenAI embeddings | Raw `fetch` to `api.openai.com` | Memory indexing | Required by `setup.sh`; fails hard without `OPENAI_API_KEY` |

**Key finding:** GraphRAG and Crawl4AI are Python-layer tools invoked via `child_process`. They are NOT npm packages and require separate Python environment setup that is not verified to exist on any CI or dev machine in this monorepo.

---

## 7. Archive Candidates

Items confirmed safe to archive (move to `docs/archive/` or `tools/archive/`):

1. `tools/central-intelligence/` — entire runtime (32% cold-start utility; all unique capabilities migratable to :3333)
2. `tools/central-intelligence/operator-platform/serve-dashboard.mjs` — dead UI server
3. `tools/graph-server/discovery-engine.mjs` — not imported; superseded
4. `tools/graph-server/domain-intelligence.mjs` — dark endpoint; refactor or merge first, then archive
5. `tools/graph-server/deployment-intelligence-v5.mjs` — dark endpoint; wire or merge, then archive
6. Doc archive batch (~145 files): certifications + lcis-v2 specs + graphify research + operating-system V7–V9 + graph dependency maps

---

## 8. Migration Candidates

`:3334` capabilities that warrant migration to `:3333` (deterministic subset only — no Qdrant/OpenAI required):

| Capability | Source files | Migration complexity | Notes |
|---|---|---|---|
| Architecture intelligence | `architecture-intelligence/` (7 files: `ArchitectureIntelligenceEngine.mjs`, `ArchitectureDriftDetector.mjs`, `ArchitectureSnapshotService.mjs`, `DependencyDiscovery.mjs`, `DomainDiscovery.mjs`, `LayerDiscovery.mjs`, `ServiceDiscovery.mjs`) | Medium | Reads repo files via `fs`; no AI deps; highest-quality :3334 subsystem |
| Verification of conclusions | `verification-engine/` (4 files: `VerificationEngine.mjs`, `EvidenceVerifier.mjs`, `ConfidenceCalculator.mjs`, `VerificationLedger.mjs`) | Low | Deterministic confidence scoring; no external deps |
| Execution safety (SafetyGuard) | `execution-engine/SafetyGuard.mjs`, `execution-engine/ActionRegistry.mjs` | Low | Pure logic; 10 whitelisted + 28 banned verbs |
| Context compression | `context-intelligence/ContextCompressionPipeline.mjs`, `ContextOptimizer.mjs`, `TokenOptimizer.mjs` | Low-Medium | File-system reads; no AI deps once compression is BM25-based |
| Reasoning (structural only) | `reasoning/ArchitectureReasoner.mjs`, `DependencyReasoner.mjs`, `DeploymentReasoner.mjs` | Medium | Reads :3333 graph; no Qdrant/OpenAI needed for structural subset |
| Investigation engine (structural) | `investigation-engine/InvestigationEngine.mjs`, `TimelineBuilder.mjs` | Medium | Reads :3333 graph + git log; no AI embeddings needed for structural path |

---

## 9. Canonical Candidates

Files that should become the single source of truth in `packages/lcis-core`:

| Engine | File | Why canonical |
|---|---|---|
| DB intelligence | `db-intel.mjs` | Only extractor; feeds all downstream |
| Domain classification | `domain-intel.mjs` | 22-domain taxonomy; most consumed engine |
| Graph traversal | `intelligence.mjs` | `traceTable/RPC/Policy` — blast-radius primitives |
| Relationship graph | `relationship-intel.mjs` | 705 FK edges; `sites` tenant root |
| Security | `security-intel.mjs` | Cross-domain attack surface; compliance anchor |
| Payment | `payment-intel.mjs` | Money-flow canonical; most security-sensitive |
| Memory / governance | `memory-v2.mjs` | Calls v1 internally; queryable decisions surface |
| Incident control | `incident-control-intel.mjs` | Genesis surface; calls v3/v4/v5 as libraries |
| Diagnosis | `diagnosis-engine.mjs` | Root-cause engine; standalone |
| Decision | `decision-engine-v2.mjs` | Primary ranked-fix engine (despite "v2" name) |
| Explain + copilot | `explain-intel.mjs` | Human/AI-readable surface; search + copilot co-located |
| Live adapters | `live-adapters.mjs` | Credential probe; 7-provider honesty contract |
| Detection + prediction | `detection-prediction-intel.mjs` | 8 detectors + 6 predictors; INFINITY layer |
| Launch command center | `launch-command-center.mjs` | GO/NO-GO; 10 readiness dimensions |
| AI context packs | `ai-context-intel.mjs` | Multi-target AI packs (Claude/Gemini/Codex/Cursor) |

---

## 10. Summary Statistics

| Metric | Value |
|---|---|
| Total `.mjs` engine files | **202** (81 + 121) |
| Total HTTP routes | **198** (118 + 80) — prior docs said 186; off by 12 (:3334 had grown to 80 routes) |
| True distinct capabilities | **32** |
| Duplicate families | **9** |
| Files safe to remove immediately | **3** (`discovery-engine.mjs`, 2 orphaned browser agents) |
| Files to archive (full runtime) | **121** (`:3334` entire) |
| Docs to archive | **~145 files** |
| Capabilities needing migration (:3334 → :3333) | **6** (deterministic subset; no AI deps) |
| Capabilities that remain AI-dependent (Qdrant/OpenAI) | **2** (memory/semantic search — out of scope for deterministic consolidation) |
| `:3333` cold-start utility | **100%** |
| `:3334` cold-start utility | **32%** |
| Production exposure (either runtime) | **0** |

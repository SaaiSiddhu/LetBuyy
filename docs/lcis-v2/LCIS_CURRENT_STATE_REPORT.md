# LCIS CURRENT STATE REPORT
## Forensic Repository Archaeology
**Date:** 2026-06-19  
**Purpose:** Phase 0 pre-flight analysis for LCIS V2 — Autonomous Commerce Intelligence Platform  
**Investigator:** Principal Architecture Review (forensic mode)

---

## 1. EXECUTIVE STATUS

**Current Status: COMPREHENSIVE AND TRUSTWORTHY (A, 95%) — STRUCTURALLY COMPLETE, LIVE-BLIND**

LCIS V1-INFINITY is a rigorously built, incrementally validated intelligence system with 13 intelligence layers, 81 engine files, 117+ REST endpoints, and 107 deterministic governance validators. It answers every architectural question about LetBuyy instantly from pre-computed JSON artifacts. Its fatal limitation: it is **structurally complete but operationally blind** — all 7 live providers are NOT CONNECTED, knowledge is static at build time, agents are prompt files only (no execution runtime), and the system cannot observe actual storefront behavior. LCIS V2 closes this gap by adding semantic memory (Qdrant), autonomous knowledge acquisition (Crawl4AI), relationship reasoning (GraphRAG), browser observation (Playwright MCP), and live telemetry (SigNoz/OTel).

---

## 2. ARCHITECTURE MAP

### Layer 0 — Foundation (Graphify)
**Adds:** 52,246-node code graph from tree-sitter static analysis  
**Files:** External Python CLI (`graphify update .`) → `graphify-out/graph.json` (44MB)  
**Endpoints:** `/api/stats`, `/api/search`, `/api/blast`, `/api/node`, `/api/path`  
**Data source:** TypeScript, TSX, Dart, MJS source files (NOT SQL)

### Layer 1 (V1) — Database Intelligence
**Adds:** SQL/DB layer (the critical gap in Graphify baseline)  
**Files:** `tools/graph-server/db-intel.mjs` — regex SQL parser  
**Endpoints:** `/api/db`, `/api/table`, `/api/rpc`, `/api/policy`  
**Data source:** `database/supabase/migrations/*.sql` (103 files)  
**Extracted:** 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes

### Layer 2 (V2) — Infrastructure Intelligence
**Adds:** Worker/queue/secret topology, FK relationships, ownership  
**Files:** `infra-intel.mjs`, `relationship-intel.mjs`  
**Endpoints:** `/api/infra`, `/api/relationships`, `/api/secrets`, `/api/owner`  
**Data source:** `wrangler.toml` (4 files), `production-deploy.yml`, `CODEOWNERS`  
**Extracted:** 4 workers, 5 queues, 19 secrets, 705 FK relationships

### Layer 3 (V3) — Domain Intelligence
**Adds:** 22 business domains, cross-domain blast radius, payment/security/deployment graphs  
**Files:** `domain-intel.mjs`, `cross-domain-engine.mjs`, `payment-intel.mjs`, `security-intel.mjs`, `deployment-intel.mjs`  
**Endpoints:** `/api/domains`, `/api/domain`, `/api/cross-domain`, `/api/payment`, `/api/security`  
**Extracted:** 22 domains, 49 cross-domain edges, 82% coupling rate

### Layer 4 (V4) — Runtime + Memory
**Adds:** Governance memory, runtime topology, deployment state, change impact  
**Files:** `memory-intel.mjs`, `runtime-intel.mjs`, `deployment-state.mjs`, `change-impact.mjs`  
**Endpoints:** `/api/memory`, `/api/runtime`, `/api/deployment-state`, `/api/change-impact`  
**Extracted:** 180 governance decisions from 41 sources

### Layer 5 (V5) — Live Operating Intelligence
**Adds:** Merchant intelligence, revenue model, security posture, production readiness  
**Files:** `merchant-intelligence.mjs`, `revenue-intelligence.mjs`, `production-readiness-intel.mjs`  
**Endpoints:** `/api/runtime-intelligence`, `/api/merchant-intelligence`, `/api/revenue-intelligence`, `/api/production-readiness`  
**Status:** Structural models CONNECTED; all magnitudes NOT CONNECTED

### Layer 6 (OMEGA) — Unified Brain
**Adds:** 13-layer unified intelligence, fix engine, cost model, telemetry, merchant lifecycle  
**Files:** 15 OMEGA engines including `unified-intelligence-engine.mjs`, `fix-engine.mjs`, `cost-intelligence.mjs`  
**Endpoints:** `/api/unified-intelligence`, `/api/fix-engine`, `/api/cost-intelligence`, `/api/telemetry`  
**Certification:** OMEGA + Genesis + INFINITY + X — A (95%)

### Layer 7 (V6) — Explain Mode / Dual-Mode OS
**Adds:** 22 Explain Nodes for human + AI consumption, AI context packs < 20k tokens  
**Files:** `explain-intel.mjs`, `search-intel.mjs`, `ai-context-intel.mjs`  
**Endpoints:** `/api/explain`, `/api/copilot`, `/api/workspace`, `/api/ai-pack`

### Layer 8+ — V10/V11/OMEGA-OS/INFINITY/X/Genesis
**Adds:** URL deep links (V10), 10 business journeys (V11), Launch Command Center (OMEGA-OS), 8 detectors + 6 predictors (INFINITY), 7 live provider adapters (X), lineage traces (Genesis)  
**Files:** `business-flow-intel.mjs`, `detection-prediction-intel.mjs`, `live-adapters.mjs`, `launch-command-center.mjs`

---

## 3. INTELLIGENCE ENGINE INVENTORY

| File | Version | Purpose | Primary Endpoints |
|------|---------|---------|------------------|
| `server.mjs` | Core | HTTP server, 117+ endpoints, Atlas SPA | ALL |
| `intelligence.mjs` | V1 | Graph queries: deps/consumers/blast/flow | `/api/blast`, `/api/path` |
| `db-intel.mjs` | V1 | SQL migration parser | `/api/db`, `/api/table`, `/api/rpc` |
| `infra-intel.mjs` | V2 | Wrangler/CI config parser | `/api/infra`, `/api/secrets` |
| `relationship-intel.mjs` | V2 | FK extractor | `/api/relationships` |
| `domain-intel.mjs` | V3 | 22-domain classifier | `/api/domains`, `/api/domain` |
| `cross-domain-engine.mjs` | V3 | Cross-domain blast radius | `/api/cross-domain`, `/api/business-impact` |
| `payment-intel.mjs` | V3 | Money/payment graph | `/api/payment` |
| `security-intel.mjs` | V3 | Security posture | `/api/security` |
| `deployment-intel.mjs` | V3 | Deployment topology | `/api/deployment` |
| `incident-intel.mjs` | V3 | Incident analysis | `/api/incident` |
| `merchant-intel.mjs` | V3 | Merchant graph | `/api/merchant` |
| `memory-intel.mjs` | V4 | Governance decisions | `/api/memory` |
| `runtime-intel.mjs` | V4 | Runtime topology | `/api/runtime` |
| `deployment-state.mjs` | V4 | Declared deploy state | `/api/deployment-state` |
| `change-impact.mjs` | V4 | Change impact analysis | `/api/change-impact` |
| `incident-response.mjs` | V4 | Incident response | `/api/incident-response` |
| `execution-intel.mjs` | V4 | Execution state | `/api/execution` |
| `runtime-observability-intel.mjs` | V5 | Runtime observability | `/api/runtime-intelligence` |
| `merchant-intelligence.mjs` | V5 | Merchant intelligence | `/api/merchant-intelligence` |
| `revenue-intelligence.mjs` | V5 | Revenue model | `/api/revenue-intelligence` |
| `security-intelligence-v5.mjs` | V5 | Security intelligence | `/api/security-intelligence` |
| `production-readiness-intel.mjs` | V5 | Production readiness | `/api/production-readiness` |
| `decision-engine-v5.mjs` | V5 | Decision engine | `/api/decision-engine` |
| `unified-intelligence-engine.mjs` | OMEGA | 13-layer brain | `/api/unified-intelligence` |
| `fix-engine.mjs` | OMEGA | Fix plans | `/api/fix-engine` |
| `cost-intelligence.mjs` | OMEGA | Cost model | `/api/cost-intelligence` |
| `telemetry-intelligence.mjs` | OMEGA | Telemetry map | `/api/telemetry` |
| `memory-v2.mjs` | OMEGA | Memory V2 | `/api/memory-v2` |
| `merchant-health-intel.mjs` | OMEGA | Merchant health | `/api/merchant-health` |
| `merchant-growth-intel.mjs` | OMEGA | Growth signals | `/api/merchant-growth` |
| `merchant-adoption-intel.mjs` | OMEGA | Feature adoption | `/api/merchant-adoption` |
| `merchant-risk-intel.mjs` | OMEGA | Risk scoring | `/api/merchant-risk` |
| `merchant-churn-intel.mjs` | OMEGA | Churn indicators | `/api/merchant-churn` |
| `customer-intelligence-v2.mjs` | OMEGA | Customer funnels | `/api/customer-intelligence-v2` |
| `revenue-intelligence-v2.mjs` | OMEGA | Revenue V2 | `/api/revenue-v2` |
| `production-readiness-v2.mjs` | OMEGA | 10-dimension readiness | `/api/production-readiness-v2` |
| `decision-engine-v2.mjs` | OMEGA | Decision V2 | `/api/decision-v2` |
| `discovery-v2.mjs` | OMEGA | Autonomous discovery | `/api/discovery-v2` |
| `explain-intel.mjs` | V6 | 22 Explain Nodes | `/api/explain` |
| `search-intel.mjs` | V6 | Semantic search (keyword) | `/api/search-v2` |
| `ai-context-intel.mjs` | V6 | AI packs | `/api/ai-pack`, `/api/ai-context` |
| `connections-intel.mjs` | V7 | Live adapter registry | `/api/connections` |
| `production-health.mjs` | V7 | G/Y/R health | `/api/production-health` |
| `audit-engine-v2.mjs` | V7 | Autonomous audit | `/api/audit` |
| `mission-control-dashboard.mjs` | V7 | Mission control | `/api/mission-control` |
| `ecosystem-intel.mjs` | V7 | Ecosystem | `/api/ecosystem` |
| `database-control-intel.mjs` | Genesis | DB control center | `/api/database-control` |
| `environment-control-intel.mjs` | Genesis | Environment control | `/api/environment-control` |
| `infrastructure-control-intel.mjs` | Genesis | Infra control | `/api/infrastructure-control` |
| `commerce-control-intel.mjs` | Genesis | Commerce control | `/api/commerce-control` |
| `incident-control-intel.mjs` | Genesis | Incident control | `/api/incident-control` |
| `launch-command-center.mjs` | Genesis | Launch GO/NO-GO | `/api/launch-command-center` |
| `federation-intel.mjs` | LCIS X | Provider federation | `/api/federation`, `/api/live-graph` |
| `live-health-intel.mjs` | LCIS X | Per-domain live health | `/api/live-health` |
| `live-adapters.mjs` | LCIS X | 7 provider adapters | `/api/live-adapters`, `/api/connections` |
| `business-flow-intel.mjs` | V11 | 10 business journeys | `/api/business-flow`, `/api/investor` |
| `detection-prediction-intel.mjs` | INFINITY | 8 detectors + 6 predictors | `/api/detection`, `/api/predict` |
| `knowledge-graphs.mjs` | Shared | 7 knowledge sub-graphs | `/api/graph` |
| `runbook-engine.mjs` | Shared | Per-domain runbooks | `/api/runbook` |
| `diagnosis-engine.mjs` | Shared | Root cause diagnosis | `/api/diagnose` |
| `environment-intel.mjs` | Shared | Environment registry | `/api/environment` |
| `environment-registry.mjs` | Shared | Live integrations | `/api/environment-registry` |

*(81 total .mjs files; remaining files: workspace, related, impact-score, atlas-v2, relationships, lineage, trace, copilot, ops-copilot, atlas-layout, search engines)*

---

## 4. KNOWLEDGE SYSTEM ANALYSIS

### 4.1 Static Knowledge (Pre-built JSON)
All intelligence is pre-computed at `pnpm graph:omega` runtime and served from in-memory Maps.

| Artifact | Size | Content |
|---------|------|---------|
| `graph.json` | 44MB | 52,246 code nodes, 66,761 edges, 3,279 communities |
| `db-intel.json` | ~2MB | 414 tables, 156 RPCs, 651 policies |
| `infra-intel.json` | ~200KB | 4 workers, 5 queues, 19 secrets |
| `domain-intel.json` | ~500KB | 22 domains, 49 cross-domain edges |
| `memory-intel.json` | ~300KB | 180 governance decisions |
| `relationship-intel.json` | ~1MB | 705 FK relationships |
| 44+ derived artifacts | varies | merchant health, cost model, explain nodes, journeys |

### 4.2 Dynamic Knowledge
**Status: NOT CONNECTED (0/7 providers)**  
All 7 live provider adapters exist in `live-adapters.mjs` but return NOT CONNECTED until credentials are set. This is correct by design — but means LCIS cannot answer "what is happening now."

### 4.3 Memory System (V1 Only)
- 180 governance decisions extracted from 41 source documents
- Stored in `graphify-out/memory-intel.json` as structured JSON
- Retrieval: keyword matching (no semantic similarity)
- **Gap: no vector embeddings, no semantic search**

### 4.4 Search System
- `searchV2(query, nodes)` — keyword matching against node labels/names
- `resolveDomain(q)` — keyword hint map (40+ entries) + searchV2 fallback
- `/api/copilot?q=` — NL routing via resolveDomain
- **Gap: zero embeddings, zero vector similarity, no RAG pipeline**

---

## 5. OBSERVABILITY SYSTEM ANALYSIS

### 5.1 What Exists
| Asset | Location | Status |
|-------|---------|--------|
| OTel Collector config | `infrastructure/observability/otel-collector.yaml` | Config exists, not deployed |
| Prometheus rules | `infrastructure/observability/prometheus-rules.yaml` | Rules exist, no metrics emitted |
| Grafana dashboards | `infrastructure/observability/grafana-*.json` | 4 dashboards exist (incident, queue, deployment, runtime) |
| SLO catalog | `infrastructure/monitoring/slo-catalog.yaml` | 1 SLO defined |

### 5.2 Critical Gaps
- **No OTel SDK in any runtime**: `api-gateway`, `queue-workers`, `webhook-service`, `mobile-bff` — none have OTel instrumentation
- **Zero metrics emitted**: Prometheus rules fire on metrics that don't exist yet
- **Zero traces**: No distributed tracing active anywhere in production
- **Grafana dashboards are theoretical**: Beautiful but no data source

### 5.3 The V2 Action
Wire `@opentelemetry/sdk-node` into each runtime. Emit to `infrastructure/observability/otel-collector.yaml`. Connect to SigNoz (replacing the theoretical Grafana + Tempo + Loki stack with a simpler, unified SigNoz deployment).

---

## 6. TESTING SYSTEM ANALYSIS

| System | Files | Status |
|--------|-------|--------|
| Governance validators | `scripts/validators/` (107 files) | Active, blocking |
| V1 launch blockers | `tests/launch/lb*.test.mjs` | 5 tests, LB-7/8/9/10/12 closed 2026-06-19 |
| Contract tests | `tests/contracts/*.test.ts` | Governance contract verification |
| Integration tests | (absent) | **GAP: no integration test suite** |
| E2E tests | (absent) | **GAP: no Playwright E2E** |

---

## 7. AGENT SYSTEM ANALYSIS

### 7.1 What Exists
- 12 `.claude/commands/agent-*.md` files
- These are **prompt files only** — no code execution, no tool use, no state
- Cannot share memory across invocations
- Cannot trigger automated browser actions
- Cannot emit telemetry

### 7.2 Gaps
- No agent runtime (no scheduler, no state machine)
- No shared memory across agents
- No real-time tool integration (cannot call Playwright, cannot write to Qdrant)
- No autonomy — every agent requires a human to invoke it

---

## 8. DEPENDENCY MAP

```
LCIS V1 (tools/graph-server/)
├── Runtime deps: ZERO (node:* built-ins only)
├── Build deps: Graphify Python CLI (external, uv tool install graphifyy)
├── Data deps: graphify-out/*.json (gitignored, built by pnpm graph:omega)
└── AI deps: CLAUDE.md (protocol document only, no SDK)

Repository App Runtimes
├── api-gateway: hono, @supabase/supabase-js, jose, zod
├── queue-workers: @supabase/supabase-js, resend
├── identity-platform: next.js 15, next-auth, jose
├── merchant-control-plane: next.js 15
├── storefront-runtime: next.js 15
└── marketing-site: next.js 15

LCIS V2 (planned — tools/central-intelligence/)
├── @qdrant/js-client-rest — Memory Engine
├── @opentelemetry/* — Observability Engine
├── @playwright/test — Browser Intelligence
├── crawl4ai (Python) — Knowledge Engine
├── graphrag (Python) — Graph Intelligence
└── openai (via OPENAI_API_KEY) — Embeddings + GraphRAG entity extraction
```

---

## 9. INTEGRATION MAP

```
LCIS V1 (:3333)
└── ← Graphify (external build tool)
└── ← pnpm graph:omega (50+ JSON artifacts)
└── → Claude Code (via CLAUDE.md LCIS-FIRST protocol)
└── → CI/CD (graph-intelligence.yml, advisory)
└── → Engineers (CLI queries + Atlas UI)
└── ⟲  Live providers: NOT CONNECTED (0/7)

LCIS V2 (:3334) [planned]
└── → V1 LCIS (:3333/api/*) — reads structural intelligence
└── → Qdrant (:6333) — semantic memory
└── → SigNoz OTel Collector (:4318) — telemetry
└── → Playwright Browser — store observation
└── → OpenAI API — embeddings + GraphRAG entity extraction
└── → Crawl4AI (Python) — knowledge acquisition
└── ← Claude Code (LCIS-V2-FIRST protocol, extended CLAUDE.md)
```

---

## 10. MISSING CAPABILITIES (GAPS)

| # | Gap | Severity | V2 Solution |
|---|-----|---------|------------|
| G1 | No semantic/vector search — all retrieval is keyword-based | **CRITICAL** | Qdrant + OpenAI embeddings (Memory Engine) |
| G2 | No autonomous knowledge acquisition — static at build time | **CRITICAL** | Crawl4AI Knowledge Engine (scheduled crawlers) |
| G3 | No browser intelligence — cannot observe storefronts or checkout | **HIGH** | Playwright MCP Browser Intelligence Engine |
| G4 | No live telemetry — 0/7 providers connected, OTel SDK not wired | **HIGH** | SigNoz + OTel SDK in all runtimes |
| G5 | No distributed tracing in production | **HIGH** | OTel TracingService + Cloudflare Worker instrumentation |
| G6 | No relationship graph with entity reasoning | **HIGH** | GraphRAG Graph Intelligence Engine |
| G7 | No continuous learning — must manually run pnpm graph:omega | **HIGH** | Crawl4AI scheduler + KnowledgeFreshnessService |
| G8 | No agent runtime — agents are prompt files only | **MEDIUM** | AgentFramework + 8 autonomous agents |
| G9 | OTel configs exist but no SDK wired in any service | **MEDIUM** | TelemetryService + instrument-api-gateway.mjs |
| G10 | Single-tenant intelligence — no multi-merchant comparison | **MEDIUM** | MerchantAgent + graph relationships |
| G11 | No E2E test suite | **MEDIUM** | Playwright (from Browser Intelligence) enables E2E |
| G12 | Semantic search uses keyword matching | **MEDIUM** | Qdrant vector search replaces keyword search |

---

## 11. CONSTRAINTS

| Constraint | Description |
|-----------|-------------|
| **Preserve V1** | `tools/graph-server/` must remain completely unchanged |
| **New location** | V2 subsystems live in `tools/central-intelligence/` |
| **New server** | V2 Intelligence API runs on `:3334` (not `:3333`) |
| **Governance law** | LETBUYY_CONSTITUTION.md → AGENTS.md supremacy chain respected |
| **107 validators** | Must stay green after all V2 changes |
| **No money/auth/RLS changes** | V2 never touches payment/auth/RLS code |
| **Docker requirement** | Qdrant and SigNoz require Docker in local dev |
| **Python requirement** | Crawl4AI and GraphRAG are Python packages |
| **OpenAI API key** | GraphRAG entity extraction and embeddings require OPENAI_API_KEY |
| **NOT CONNECTED extended** | V2 inherits the honesty contract — all live values declared NOT CONNECTED until connected |

---

## 12. RISKS

| Risk | Severity | Mitigation |
|------|---------|-----------|
| GraphRAG requires OpenAI API — cost ~$0.50-2.00 per full build | **HIGH** | Use `gpt-4o-mini` (cheaper), build on schedule not per-change |
| Qdrant Docker volume — embeddings lost on rebuild without persistent volume | **HIGH** | `docker-compose.yml` uses named volume `qdrant_storage` |
| Crawl4AI rate limiting by external doc sites | **MEDIUM** | `crawl4ai` respects robots.txt + rate limits; add `wait_for` delays |
| Playwright MCP is a separate process — must be managed | **MEDIUM** | Browser Intelligence uses `@playwright/test` directly (no MCP server process required for server-side) |
| 107-validator gate must stay green | **LOW** | V2 lives in `tools/central-intelligence/` — no existing validators cover this path |
| OPENAI_API_KEY in environment — must not leak to repository | **HIGH** | `.gitignore` + `.env.example` + no hardcoded keys |

---

## 13. PRODUCTION READINESS DELTA

| Capability | V1 Score | V2 Target |
|-----------|----------|----------|
| Code intelligence | 100% | 100% (unchanged) |
| Database intelligence | 100% | 100% (unchanged) |
| Semantic search | 0% | 95% (Qdrant + embeddings) |
| Knowledge acquisition | 10% (manual) | 90% (automated crawlers) |
| Browser intelligence | 0% | 85% (Playwright agents) |
| Live telemetry | 10% (configs only) | 80% (OTel wired in all runtimes) |
| Relationship reasoning | 30% (cross-domain only) | 85% (GraphRAG) |
| Agent autonomy | 5% (prompt files only) | 80% (agent framework) |
| **Overall intelligence** | **A (95%)** | **A+ (98% target)** |

---

## 14. RECOMMENDED V2 ARCHITECTURE

LCIS V2 adds 7 subsystems to the existing V1 foundation:

```
LCIS V2 Intelligence Platform
├── Memory Engine      (Qdrant :6333)          — semantic memory
├── Knowledge Engine   (Crawl4AI Python)         — autonomous learning
├── Graph Intelligence (GraphRAG Python)          — relationship reasoning
├── Browser Intel      (Playwright)               — storefront observation
├── Observability      (SigNoz/OTel :4318/:3301) — live telemetry
├── Agent Framework    (8 autonomous agents)      — unified intelligence
├── Intelligence API   (:3334)                    — unified query surface
└── LCIS V1           (:3333) [unchanged]         — structural foundation
```

See `docs/lcis-v2/LCIS_ARCHITECTURE_V2.md` for complete design.  
See `tools/central-intelligence/setup.sh` for one-command setup.

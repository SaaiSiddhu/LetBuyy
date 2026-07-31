# LCIS V2 — Operations Guide

**Version:** 2.0.0  
**Last Updated:** 2026-06-19  
**Owner:** @saai-sidd  
**Intelligence API:** `http://localhost:3334`  
**V1 LCIS (unchanged):** `http://localhost:3333`

---

## Quick Start

Five steps from zero to a running V2 intelligence stack.

### Step 1: Configure Environment

```bash
cd /Users/saai_sidd/Git/Letbuyy_Store/tools/central-intelligence
cp .env.example .env
```

Open `.env` and set at minimum:

```bash
OPENAI_API_KEY=sk-...          # required — without this, embeddings are NOT CONNECTED
QDRANT_URL=http://localhost:6333  # default, fine for local Docker
```

All other variables have working defaults. See the environment reference at the bottom of this guide.

### Step 2: Run Setup

```bash
bash setup.sh
```

`setup.sh` is idempotent — safe to re-run. It:
1. Checks Node >= 20 and Python 3 (exits with a clear error if missing)
2. Validates `OPENAI_API_KEY` is set
3. Runs `npm install`
4. Installs Python deps (`graph-engine/graphrag/requirements.txt` and `knowledge-engine/crawlers/requirements.txt`)
5. Starts `qdrant`, `signoz-otel-collector`, `signoz-clickhouse` via Docker Compose
6. Waits up to 60 seconds for Qdrant to become healthy
7. Creates `graphify-out/` subdirs: `knowledge-crawls/`, `browser-evidence/`, `graph-intelligence/`, `context-intelligence/`
8. Runs `MemoryIndexer.indexAll()` — initial document ingestion

If Docker is unavailable, step 5–6 are skipped with a warning. The API still starts; memory operations will fail until Qdrant is reachable.

### Step 3: Start the Intelligence API

```bash
npm start
# or for file-watching dev mode:
npm run start:dev
```

Expected output:
```
[LCIS-V2] Memory engine health: HEALTHY
[LCIS-V2] Intelligence API running on http://localhost:3334
[LCIS-V2] V1 proxy target: http://localhost:3333
[LCIS-V2] Registered endpoints:
  GET  /intelligence/health
  GET  /intelligence/status
  ...
```

### Step 4: First Query

Verify the stack with a health check, then ask a question:

```bash
# Health check (all subsystems)
curl -s http://localhost:3334/intelligence/health | jq

# Full status (V1 + V2 subsystem matrix)
curl -s http://localhost:3334/intelligence/status | jq

# Ask a natural-language question
curl -s 'http://localhost:3334/intelligence/ask?q=what+breaks+if+payments+fail' | jq

# Semantic memory search
curl -s 'http://localhost:3334/intelligence/memory/search?q=checkout+flow&collection=architecture&limit=5' | jq
```

### Step 5: Verify V1 LCIS is Running

V2 enriches answers with V1 structural data. Ensure V1 is also running:

```bash
# Start V1 alongside all apps
pnpm dev   # from repo root

# Or start V1 standalone
cd tools/graph-server && node server.mjs
```

---

## Service Management

### Starting Individual Subsystems

```bash
# From tools/central-intelligence/

# Full Intelligence API (all subsystems lazy-loaded on first request)
npm start

# Memory engine only (for re-indexing without the API)
npm run memory:init

# Knowledge crawl (trigger a specific source)
npm run knowledge:crawl  # triggers KnowledgeAcquisitionService

# Graph intelligence build (30-min operation, requires GraphRAG pip install)
npm run graph:build

# Context map build (from graphify-out/graph.json)
npm run context:build

# Self-model refresh
npm run self:model

# Reasoning engine test run
npm run reasoning:run

# Browser intelligence validation
npm run browser:validate
```

### Docker Infrastructure

```bash
# Start minimal (Qdrant only — sufficient for memory operations without observability)
docker compose up -d qdrant

# Start full stack (Qdrant + SigNoz observability stack)
docker compose up -d

# Stop all
docker compose down

# Stop and remove volumes (WARNING: deletes all vector data)
docker compose down -v

# View logs
docker compose logs -f qdrant
docker compose logs -f signoz-otel-collector
docker compose logs -f signoz-clickhouse
docker compose logs -f signoz-query-service

# Check container health
docker compose ps
```

### Starting V1 LCIS (unchanged)

V1 is never started via V2 scripts. Use the repo-level pnpm commands:

```bash
# V1 starts as part of pnpm dev (runs on :3333)
pnpm dev

# Or standalone
node tools/graph-server/server.mjs
```

### Checking Intelligence API Health

```bash
# Quick health (from package.json scripts)
npm run health

# Manual
curl -sf http://localhost:3334/intelligence/health | jq '.overall'
```

Expected healthy response:
```json
{
  "overall": "HEALTHY",
  "subsystems": [
    { "name": "IntelligenceAPI",  "status": "HEALTHY",  "latencyMs": 1 },
    { "name": "MemoryEngine",     "status": "HEALTHY",  "latencyMs": 8 },
    { "name": "GraphEngine",      "status": "HEALTHY",  "latencyMs": 2 },
    { "name": "Observability",    "status": "DEGRADED", "latencyMs": 0 }
  ],
  "timestamp": "2026-06-19T..."
}
```

`Observability` shows `DEGRADED` until OTel SDK is wired into a runtime and sending traces. This is expected and not blocking.

---

## Daily Operations

### Morning Health Checks

Run these on every working day before making changes:

```bash
# 1. Intelligence API health
curl -sf http://localhost:3334/intelligence/health | jq '{overall: .overall, timestamp: .timestamp}'

# 2. Memory engine — check collection sizes
curl -sf http://localhost:3334/intelligence/memory/stats | jq

# 3. V1 LCIS availability (required for enriched answers)
curl -sf http://localhost:3333/api/stats | jq '{nodes: .nodeCount, edges: .edgeCount}'

# 4. Knowledge freshness — which sources are stale
curl -sf http://localhost:3334/intelligence/knowledge/freshness | jq

# 5. Active anomalies
curl -sf http://localhost:3334/intelligence/observability/anomalies | jq '.anomalies | length'

# 6. Recent incidents
curl -sf http://localhost:3334/intelligence/observability/incidents | jq '.count'

# 7. Browser intelligence status
curl -sf http://localhost:3334/intelligence/browser/status | jq
```

### Knowledge Refresh (when docs change)

Trigger after updating any governance, runbook, or architecture doc:

```bash
# Re-index all document sources into memory
npm run memory:init

# OR trigger only specific sources via the API
curl -X POST http://localhost:3334/intelligence/knowledge/crawl \
  -H 'Content-Type: application/json' \
  -d '{"sourceKey": "letbuyy-docs"}'
```

### Evidence Cleanup

Browser evidence accumulates in `graphify-out/browser-evidence/`. Clean weekly:

```bash
# Remove evidence older than 7 days
find /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/browser-evidence \
  -maxdepth 1 -type d -name "202*" \
  -mtime +7 -exec rm -rf {} +

# Check current evidence size
du -sh /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/browser-evidence/
```

### Daily Intelligence Report

The Autonomous Operations subsystem can generate a daily report:

```bash
# Via npm script (runs OperationsReasoningEngine + IntelligenceReportGenerator)
node -e "
  import('./autonomous-operations/IntelligenceReportGenerator.mjs')
    .then(m => m.default.generateDailyReport())
    .then(r => console.log(JSON.stringify(r, null, 2)))
"
```

---

## Knowledge Refresh (Detailed)

### What Gets Indexed

`MemoryIndexer.indexAll()` indexes five source sets:

| Source Set | Collection | Files Indexed |
|-----------|-----------|--------------|
| Governance docs | `architecture` | `AGENTS.md`, `LETBUYY_CONSTITUTION.md`, `CLAUDE.md` |
| Runbooks | `runbooks` | `docs/governance/**/*.md` + `docs/central-intelligence/**/*.md` |
| Security docs | `security` | `infrastructure/security/**/*.md` + `infrastructure/observability/**/*.md` |
| Central Intelligence | `architecture` | `docs/central-intelligence/**/*.md` |
| LCIS V2 docs | `architecture` | `docs/lcis-v2/**/*.md` |

### Triggering a Full Re-index

```bash
npm run memory:init
```

Output shows per-source chunk counts:
```
[MemoryIndexer] Starting full indexing run…
[MemoryIndexer] indexGovernanceDocs: AGENTS.md → 28 chunks
[MemoryIndexer] indexGovernanceDocs: LETBUYY_CONSTITUTION.md → 47 chunks
[MemoryIndexer] indexGovernanceDocs: CLAUDE.md → 89 chunks
[MemoryIndexer] indexRunbooks: docs/governance → 12 files
[MemoryIndexer] indexAll complete — total chunks ingested: 340
```

### Adding New Documents

To index a document not covered by the above sources, use the ingest API:

```bash
curl -X POST http://localhost:3334/intelligence/memory/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Your document text here...",
    "collection": "architecture",
    "metadata": { "source": "custom/my-doc.md", "docType": "custom" }
  }'
```

---

## Graph Rebuild

**Cost:** ~$0.50–$2.00 in OpenAI API tokens per full build  
**Duration:** Up to 30 minutes  
**Trigger:** After major documentation changes or weekly on schedule

```bash
# Build from LCIS central-intelligence docs + domain-intel.json
npm run graph:build   # calls GraphBuilder.buildFromLCIS()

# Full build (adds knowledge crawls)
node -e "import('./graph-engine/GraphBuilder.mjs').then(m => m.default.buildFull()).then(r => console.log(r))"

# Check current build status without triggering a build
node -e "import('./graph-engine/GraphBuilder.mjs').then(m => console.log(m.default.getStatus()))"
```

**Prerequisites:**
- `pip3 install -r graph-engine/graphrag/requirements.txt` (done by setup.sh)
- `OPENAI_API_KEY` set in `.env`
- `docs/central-intelligence/` must contain at least one .md file

**Artifacts produced** (gitignored):
```
graph-engine/graphrag/
├── input/           # source docs copied before build
├── output/artifacts/
│   ├── entities*.parquet
│   ├── relationships*.parquet
│   └── communities*.parquet
├── cache/
└── logs/
```

---

## Context Map Rebuild

```bash
# Full pipeline: RepositoryGraph → DependencyGraph → ArchitectureGraph → PageRank → 5 artifacts
npm run context:build

# Alternative (explicit buildContextMap call)
npm run context:map
```

**Prerequisite:** `graphify-out/graph.json` must exist (built by `pnpm graph:update` from repo root).

**Output** in `graphify-out/context-intelligence/`:
- `LCIS_CONTEXT_MAP.json` — top-300 files by PageRank
- `LCIS_ARCHITECTURE_GRAPH.json` — services, domains, layers
- `LCIS_DEPENDENCY_GRAPH.json` — module dependencies + cycles
- `LCIS_IMPORTANCE_RANKING.json` — full ranking
- `LCIS_CONTEXT_SUMMARY.md` — human-readable overview

---

## Memory Management

### Check Collection Sizes

```bash
curl -sf http://localhost:3334/intelligence/memory/stats | jq
```

Sample output:
```json
{
  "architecture": { "pointsCount": 320, "vectorSize": 1536, "status": "green" },
  "runbooks":     { "pointsCount": 180, "vectorSize": 1536, "status": "green" },
  "incidents":    { "pointsCount": 12,  "vectorSize": 1536, "status": "green" },
  "security":     { "pointsCount": 95,  "vectorSize": 1536, "status": "green" },
  "deployments":  { "pointsCount": 44,  "vectorSize": 1536, "status": "green" },
  "knowledge":    { "pointsCount": 200, "vectorSize": 1536, "status": "green" },
  "merchants":    { "pointsCount": 67,  "vectorSize": 1536, "status": "green" },
  "themes":       { "pointsCount": 88,  "vectorSize": 1536, "status": "green" }
}
```

### Qdrant Dashboard

Available at `http://localhost:6333/dashboard` when Docker is running. Provides visual collection browser, point counts, and vector configuration.

### Clearing a Collection

If a collection becomes corrupt or needs a full refresh:

```bash
# Via Qdrant REST API directly
curl -X DELETE http://localhost:6333/collections/architecture

# Then re-create via memory:init
npm run memory:init
```

**Warning:** Deleting a collection removes all vectors permanently. Re-indexing requires `OPENAI_API_KEY` to re-embed all documents.

### Disk Usage

Qdrant stores vectors in Docker volume `lcis-qdrant/qdrant_storage`. Estimated size: ~50KB per 100 1536-dimensional vectors. With 1000 points across all collections: ~500KB.

---

## Self-Model Refresh

Run after adding new subsystems or changing the V2 architecture:

```bash
npm run self:model
```

Output artifacts written to `graphify-out/self-model/` (gitignored).

---

## Monitoring LCIS V2 Itself

### What to Watch

| Signal | Check | Threshold |
|--------|-------|-----------|
| Intelligence API availability | `GET /intelligence/health` overall | Must be HEALTHY or DEGRADED |
| Memory engine latency | `GET /intelligence/memory/health` latencyMs | Alert > 500ms |
| Qdrant connectivity | MemoryService.getHealth().qdrant | Must be CONNECTED |
| Graph engine artifacts | `GET /intelligence/graph/health` | Must report built=true |
| Knowledge freshness | `GET /intelligence/knowledge/freshness` | Alert if any source > 7 days stale |
| V1 LCIS availability | `GET /intelligence/status` v1.nodeCount | Must be present (V1 running) |

### SigNoz Observability UI

When running the full Docker stack:

- **SigNoz UI:** `http://localhost:3301` — traces, metrics, logs from all instrumented runtimes
- **SigNoz Query Service API:** `http://localhost:8080/api/v1/` — programmatic queries
- **Prometheus metrics:** `http://localhost:9464/metrics` — scrape endpoint for external Prometheus

### Checking OTel Collector Health

```bash
# Health endpoint
curl -sf http://localhost:13133/health

# zPages diagnostics (detailed pipeline stats)
curl -sf http://localhost:55679/debug/pipelinez

# pprof profiling
curl -sf http://localhost:1777/debug/pprof/
```

---

## Common Queries (curl Examples)

```bash
# ── Intelligence API ───────────────────────────────────────────────────────────

# Health
curl -sf http://localhost:3334/intelligence/health | jq

# Full system status
curl -sf http://localhost:3334/intelligence/status | jq

# Ask any question (routes to correct agent + enriches with V1 + memory + graph)
curl -sf 'http://localhost:3334/intelligence/ask?q=how+does+the+payment+flow+work' | jq
curl -sf 'http://localhost:3334/intelligence/ask?q=what+breaks+if+orders+table+changes' | jq
curl -sf 'http://localhost:3334/intelligence/ask?q=is+the+platform+ready+to+launch' | jq
curl -sf 'http://localhost:3334/intelligence/ask?q=how+do+I+recover+from+a+Razorpay+signature+failure' | jq

# ── Memory ─────────────────────────────────────────────────────────────────────

# Semantic search across all collections
curl -sf 'http://localhost:3334/intelligence/memory/search?q=checkout+rpc&limit=5' | jq

# Search a specific collection
curl -sf 'http://localhost:3334/intelligence/memory/search?q=GST+invoice&collection=knowledge&limit=3' | jq

# Ingest a document
curl -X POST http://localhost:3334/intelligence/memory/ingest \
  -H 'Content-Type: application/json' \
  -d '{"text":"New runbook for queue worker restart","collection":"runbooks","metadata":{"source":"ops/queue-restart.md"}}' | jq

# Memory health
curl -sf http://localhost:3334/intelligence/memory/health | jq

# Collection statistics
curl -sf http://localhost:3334/intelligence/memory/stats | jq

# ── Knowledge ──────────────────────────────────────────────────────────────────

# Semantic search in knowledge collection
curl -sf 'http://localhost:3334/intelligence/knowledge/search?q=webhook+signing' | jq

# List all registered sources
curl -sf http://localhost:3334/intelligence/knowledge/sources | jq

# Check freshness
curl -sf http://localhost:3334/intelligence/knowledge/freshness | jq

# Trigger crawl for a specific source
curl -X POST http://localhost:3334/intelligence/knowledge/crawl \
  -H 'Content-Type: application/json' \
  -d '{"sourceKey":"letbuyy-docs"}' | jq

# ── Graph ──────────────────────────────────────────────────────────────────────

# Query the graph (global = community-level summary)
curl -sf 'http://localhost:3334/intelligence/graph/query?q=payment+processing&method=global' | jq

# Local entity query
curl -sf 'http://localhost:3334/intelligence/graph/query?q=create_checkout_order&method=local' | jq

# Impact analysis (what breaks if X changes)
curl -sf 'http://localhost:3334/intelligence/graph/impact?entity=orders' | jq

# Entity explanation
curl -sf 'http://localhost:3334/intelligence/graph/entities?name=payment_transactions' | jq

# Graph build health
curl -sf http://localhost:3334/intelligence/graph/health | jq

# ── Browser Intelligence ───────────────────────────────────────────────────────

# Validate a storefront
curl -sf 'http://localhost:3334/intelligence/browser/validate?url=https://demo.letbuyy.com' | jq

# Validate a theme
curl -sf 'http://localhost:3334/intelligence/browser/theme?url=https://demo.letbuyy.com&themeId=urban-kicks' | jq

# Validate checkout flow (halts before payment gateway)
curl -sf 'http://localhost:3334/intelligence/browser/checkout?url=https://demo.letbuyy.com' | jq

# Browser intelligence status
curl -sf http://localhost:3334/intelligence/browser/status | jq

# ── Observability ──────────────────────────────────────────────────────────────

# Observability health
curl -sf http://localhost:3334/intelligence/observability/health | jq

# Recent incidents
curl -sf http://localhost:3334/intelligence/observability/incidents | jq

# Current anomaly signals
curl -sf http://localhost:3334/intelligence/observability/anomalies | jq

# ── Agents ─────────────────────────────────────────────────────────────────────

# Execute the knowledge agent
curl -sf 'http://localhost:3334/intelligence/agents/execute?agent=knowledge&q=how+does+multi-tenancy+work' | jq

# Execute the security agent
curl -sf 'http://localhost:3334/intelligence/agents/execute?agent=security&q=what+are+the+RLS+gaps' | jq

# Execute the operations agent
curl -sf 'http://localhost:3334/intelligence/agents/execute?agent=operations&q=what+breaks+if+Razorpay+goes+down' | jq

# Execute the merchant agent
curl -sf 'http://localhost:3334/intelligence/agents/execute?agent=merchant&q=what+is+the+merchant+onboarding+flow' | jq

# Execute the release agent
curl -sf 'http://localhost:3334/intelligence/agents/execute?agent=release&q=are+we+ready+to+launch' | jq

# Agent availability status
curl -sf http://localhost:3334/intelligence/agents/status | jq
```

---

## Integration with Existing pnpm graph:* Commands

V2 is additive — all V1 graph commands continue to work unchanged.

| V1 Command | What it does | V2 equivalent / integration |
|-----------|-------------|----------------------------|
| `pnpm graph:update .` | Rebuild Graphify code graph → `graphify-out/graph.json` | Run before `npm run context:build` |
| `pnpm graph:omega` | Build all 50+ V1 intelligence JSON artifacts | No V2 equivalent — V2 reads from these |
| `pnpm graph:intel blast "X"` | Blast radius from V1 code graph | `GET /intelligence/graph/impact?entity=X` adds semantic reasoning on top |
| `pnpm graph:db` | Extract DB intelligence (414 tables, 156 RPCs) | V2 reads `graphify-out/db-intel.json` |
| `pnpm graph:domain` | Build 22-domain intelligence | V2 reads `graphify-out/domain-intel.json` (feeds GraphBuilder) |
| `pnpm graph:v3` | db + infra + domain + reports | Run before `npm run graph:build` for freshest graph input |

### Recommended Combined Workflow for Maximum Intelligence

```bash
# Step 1: Update V1 structural intelligence (repo root)
pnpm graph:v3

# Step 2: Rebuild V2 graph from fresh V1 data
cd tools/central-intelligence
npm run graph:build           # ~30min, needs OPENAI_API_KEY

# Step 3: Rebuild context maps from fresh code graph
npm run context:build

# Step 4: Re-index memory from updated docs
npm run memory:init

# Step 5: Refresh self-model
npm run self:model
```

Run the combined workflow weekly or after any major architecture change.

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | **Required.** OpenAI API key for embeddings and GraphRAG entity extraction |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant instance URL |
| `QDRANT_API_KEY` | — | Qdrant API key (blank = no auth; required for Qdrant Cloud) |
| `EMBED_MODEL` | `text-embedding-3-small` | OpenAI embedding model identifier |
| `EMBED_DIMENSIONS` | `1536` | Must match the embedding model's output dimensions |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTel Collector HTTP endpoint |
| `OTEL_SERVICE_NAME` | `lcis-intelligence` | Service name in all spans and metrics |
| `OTEL_ENVIRONMENT` | `development` | Environment tag: `development`, `staging`, `production` |
| `PLAYWRIGHT_HEADLESS` | `true` | Browser headless mode (`true`/`false`) |
| `BROWSER_INTELLIGENCE_TIMEOUT` | `30000` | Per-page navigation timeout in milliseconds |
| `INCIDENT_ERROR_RATE_THRESHOLD` | `0.05` | Error rate fraction (5%) that triggers an incident signal |
| `INCIDENT_SLOW_QUERY_MS` | `5000` | DB query duration above which a slow-query event fires |
| `ANOMALY_SIGMA_THRESHOLD` | `3.0` | Standard deviations from baseline that flags an anomaly |
| `LCIS_V2_PORT` | `3334` | Intelligence API listen port |
| `LCIS_V1_URL` | `http://localhost:3333` | V1 LCIS proxy target URL |

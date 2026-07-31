# LCIS V2 — Deployment Guide

**Version:** 2.0.0  
**Last Updated:** 2026-06-19  
**Owner:** @saai-sidd

---

## Local Development

The complete local stack runs via Docker Compose + a single Node.js process.

### Prerequisites

| Prerequisite | Minimum Version | Check |
|-------------|----------------|-------|
| Node.js | 20 | `node --version` |
| Python 3 | 3.10+ | `python3 --version` |
| Docker Desktop | Latest stable | `docker --version && docker info` |
| pip3 | Any | `pip3 --version` |

### First-Time Setup

```bash
# 1. Clone / open repo (already done)
cd /Users/saai_sidd/Git/Letbuyy_Store

# 2. Configure environment
cp tools/central-intelligence/.env.example tools/central-intelligence/.env
# Edit .env and set: OPENAI_API_KEY=sk-<real-key>

# 3. Run idempotent setup script (installs deps, starts Docker, inits memory)
cd tools/central-intelligence
bash setup.sh

# 4. Start Intelligence API (foreground — see logs)
npm start

# 5. Start V1 LCIS alongside the rest of the platform (separate terminal)
cd /Users/saai_sidd/Git/Letbuyy_Store
pnpm dev
```

### Verifying Local Stack

```bash
# Intelligence API V2
curl -sf http://localhost:3334/intelligence/health | jq '.overall'
# Expected: "HEALTHY" or "DEGRADED" (DEGRADED = OTel not yet connected, acceptable)

# V1 LCIS (unchanged)
curl -sf http://localhost:3333/api/stats | jq '{nodes: .nodeCount, edges: .edgeCount}'

# Qdrant
curl -sf http://localhost:6333/healthz
# Expected: HTTP 200

# OTel Collector
curl -sf http://localhost:13133/health
# Expected: HTTP 200

# SigNoz UI (open in browser)
open http://localhost:3301
```

### Local Docker Services Quick-Reference

```bash
# Minimal (Qdrant only — memory operations without observability)
docker compose up -d qdrant

# Full stack (Qdrant + SigNoz + OTel Collector + ClickHouse)
docker compose up -d

# Stop all without removing volumes
docker compose stop

# Stop and remove containers (keeps volumes = keeps vector data)
docker compose down

# Stop and destroy all data (full reset)
docker compose down -v

# Check health of all containers
docker compose ps

# Live logs
docker compose logs -f
docker compose logs -f qdrant
docker compose logs -f signoz-otel-collector
```

### Docker Compose Services Summary

| Service | Image | Ports (host) | Persistence |
|---------|-------|-------------|------------|
| `qdrant` | `qdrant/qdrant:latest` | 6333 (REST), 6334 (gRPC) | `qdrant_storage` named volume |
| `signoz-clickhouse` | `clickhouse/clickhouse-server:24.1.2-alpine` | 9000, 8123 | `clickhouse_data` named volume |
| `signoz-otel-collector` | `signoz/signoz-otel-collector:0.88.11` | 4317, 4318 | Stateless |
| `signoz-query-service` | `signoz/query-service:0.43.0` | 8080 | Reads from ClickHouse |
| `signoz-frontend` | `signoz/frontend:0.43.0` | 3301 | Stateless |

The `letbuyy-intelligence` Docker bridge network is created automatically. Services communicate by container name (e.g., ClickHouse exporter URL: `tcp://clickhouse:9000`).

---

## Staging Deployment

Staging uses cloud-managed Qdrant and SigNoz instead of Docker, with the Intelligence API on a lightweight VM or container.

### Environment Variables for Staging

```bash
# Required
OPENAI_API_KEY=sk-<staging-key>

# Qdrant Cloud (staging cluster)
QDRANT_URL=https://<cluster-id>.us-east4-0.gcp.cloud.qdrant.io
QDRANT_API_KEY=<qdrant-staging-api-key>

# Embedding config (match prod)
EMBED_MODEL=text-embedding-3-small
EMBED_DIMENSIONS=1536

# SigNoz Cloud (staging environment)
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443
OTEL_SERVICE_NAME=lcis-intelligence-staging
OTEL_ENVIRONMENT=staging

# Browser Intelligence
PLAYWRIGHT_HEADLESS=true
BROWSER_INTELLIGENCE_TIMEOUT=45000

# Incident thresholds (more sensitive in staging for early detection)
INCIDENT_ERROR_RATE_THRESHOLD=0.03
INCIDENT_SLOW_QUERY_MS=3000
ANOMALY_SIGMA_THRESHOLD=2.5

# API config
LCIS_V2_PORT=3334
LCIS_V1_URL=http://localhost:3333
```

### Staging Deployment Steps

```bash
# On the staging VM / container:

# 1. Checkout repo at the target commit
git clone https://github.com/SaaiSiddhu/Letbuyy_Store.git
cd Letbuyy_Store

# 2. Configure environment (no Docker needed for Qdrant/SigNoz in staging)
cd tools/central-intelligence
cp .env.example .env
# Set all staging env vars as above

# 3. Install Node.js deps only (no Docker setup)
npm install

# 4. Install Python deps for GraphRAG and crawlers
pip3 install -r graph-engine/graphrag/requirements.txt
pip3 install -r knowledge-engine/crawlers/requirements.txt

# 5. Install Playwright browser
npx playwright install chromium

# 6. Initialize memory engine (connects to Qdrant Cloud)
npm run memory:init

# 7. Start Intelligence API
npm start
```

### Health Validation in Staging

```bash
curl -sf http://<staging-host>:3334/intelligence/health | jq

# Confirm Qdrant Cloud connected
curl -sf http://<staging-host>:3334/intelligence/memory/health | jq '.qdrant'
# Expected: "CONNECTED"

# Confirm OTel sending to SigNoz Cloud (check SigNoz Cloud dashboard)
```

---

## Production Architecture

In production, every component is cloud-managed or process-isolated. No self-hosted Docker infra.

```
┌─────────────────────────────────────────────────────────────┐
│  Production Topology                                         │
│                                                              │
│  Intelligence API (Node.js process / Fly.io / GCP Cloud Run)│
│  ├── → Qdrant Cloud (managed vector DB)                     │
│  ├── → SigNoz Cloud (managed observability)                 │
│  ├── → OpenAI API (embeddings)                              │
│  └── → V1 LCIS :3333 (separate process, same host)         │
│                                                              │
│  Batch Jobs (GitHub Actions scheduled / cron)               │
│  ├── Knowledge Crawl (daily, Python)                        │
│  ├── Graph Build / GraphRAG (weekly, Python + OpenAI)       │
│  ├── Context Map Build (after graph:update)                 │
│  └── Memory Re-index (after doc changes)                    │
└─────────────────────────────────────────────────────────────┘
```

### Production Deployment

```bash
# Environment variables are injected by the deployment platform (not .env files)
# The Intelligence API reads from process.env

# Start command
node tools/central-intelligence/intelligence-api/server.mjs

# With explicit env (for manual/test runs)
OPENAI_API_KEY=sk-... \
QDRANT_URL=https://... \
QDRANT_API_KEY=... \
OTEL_EXPORTER_OTLP_ENDPOINT=https://... \
OTEL_ENVIRONMENT=production \
LCIS_V1_URL=http://localhost:3333 \
node tools/central-intelligence/intelligence-api/server.mjs
```

---

## Qdrant in Production

Self-hosted Qdrant (Docker) is not suitable for production. Use Qdrant Cloud.

### Qdrant Cloud Setup

1. Create an account at `https://cloud.qdrant.io`
2. Create a cluster (recommended: at least 1 vCPU, 4GB RAM for 8 collections with ~1000 points each)
3. Under "API Keys" → create a key with read+write permissions on your cluster
4. Get the cluster endpoint URL (format: `https://<cluster-id>.<region>.gcp.cloud.qdrant.io`)

### Production Qdrant Configuration

```bash
QDRANT_URL=https://<cluster-id>.us-east4-0.gcp.cloud.qdrant.io
QDRANT_API_KEY=<qdrant-api-key>
```

`MemoryService` passes the API key to the `QdrantClient` constructor — authentication is handled automatically.

### Collection Management in Production

Collections are created idempotently by `MemoryService.init()`. Safe to call on every deployment — existing collections are not overwritten.

```bash
# Run init after first deploy or after adding new collections
npm run memory:init

# Check all 8 collections exist
curl -sf https://<cluster-endpoint>/collections \
  -H "api-key: <qdrant-api-key>" | jq '.result.collections[].name'
```

### Qdrant Production Sizing

| Scale | Vectors | RAM | Disk |
|-------|---------|-----|------|
| Current (docs only) | ~1,000 | 512MB | 5MB |
| 10k vectors | 10,000 | 1GB | 50MB |
| 100k vectors | 100,000 | 4GB | 500MB |

Current indexing produces approximately 300–500 vectors per full `memory:init` run across all 8 collections. Qdrant's smallest Cloud tier is sufficient.

---

## SigNoz in Production

Self-hosted SigNoz (Docker Compose) is not suitable for production. Use SigNoz Cloud.

### SigNoz Cloud Setup

1. Sign up at `https://signoz.io/teams/`
2. Create a workspace for LetBuyy
3. Under "Data Sources" → get the OTLP endpoint and ingestion key
4. The endpoint format: `https://ingest.<region>.signoz.cloud:443`

### OTel Exporter Configuration for SigNoz Cloud

```bash
# SigNoz Cloud requires the ingestion key as a header
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.us.signoz.cloud:443
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=<your-ingestion-key>
OTEL_SERVICE_NAME=lcis-intelligence
OTEL_ENVIRONMENT=production
```

Note: The `otel-collector-signoz.yml` configuration is used for local/staging. In production, the `TelemetryService.mjs` OTel SDK sends directly to SigNoz Cloud via the OTLP HTTP exporter — no self-hosted collector required.

---

## Graph Build as a Scheduled Batch Job

GraphRAG index builds are expensive (~30 min, ~$1-2 OpenAI API cost). Run as scheduled, not on every commit.

### GitHub Actions Scheduled Build

Create `.github/workflows/lcis-v2-graph-build.yml`:

```yaml
name: LCIS V2 Graph Build (Weekly)
on:
  schedule:
    - cron: '0 2 * * 0'    # Sunday 02:00 UTC
  workflow_dispatch:        # manual trigger

jobs:
  graph-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Node deps
        run: cd tools/central-intelligence && npm install

      - name: Install Python deps
        run: pip3 install -r tools/central-intelligence/graph-engine/graphrag/requirements.txt

      - name: Build V1 intelligence artifacts (input for GraphRAG)
        run: pnpm graph:omega
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}

      - name: Build GraphRAG graph index
        run: cd tools/central-intelligence && npm run graph:build
        env:
          OPENAI_API_KEY: ${{ secrets.LCIS_OPENAI_API_KEY }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: graphrag-output
          path: tools/central-intelligence/graph-engine/graphrag/output/
          retention-days: 14
```

The artifacts are uploaded for inspection but are also deployed to the production server in a separate step (not shown — depends on deployment target).

---

## Context Map Build as a Batch Job

Context maps depend on `graphify-out/graph.json` (from `pnpm graph:update`). Run after any significant code change.

### Manual Trigger

```bash
# From repo root: update code graph then rebuild context maps
pnpm graph:update . && \
  cd tools/central-intelligence && npm run context:build
```

### CI Integration

Add to the existing graph-intelligence CI workflow as an additional step:

```yaml
- name: Build context maps
  run: cd tools/central-intelligence && npm run context:build
  env:
    # No OpenAI key needed — context:build uses graphify-out/graph.json only
```

---

## Knowledge Crawl as a Scheduled Cron Job

```yaml
name: LCIS V2 Knowledge Crawl (Daily)
on:
  schedule:
    - cron: '0 6 * * *'    # 06:00 UTC daily

jobs:
  knowledge-crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Python deps
        run: pip3 install -r tools/central-intelligence/knowledge-engine/crawlers/requirements.txt

      - name: Run crawlers
        run: |
          mkdir -p graphify-out/knowledge-crawls
          for SOURCE_KEY in letbuyy-docs nextjs-docs razorpay-docs supabase-docs; do
            python3 tools/central-intelligence/knowledge-engine/crawlers/${SOURCE_KEY}-crawler.py \
              2>&1 | tee /tmp/crawl-${SOURCE_KEY}.log
          done

      - name: Upload crawl output
        uses: actions/upload-artifact@v4
        with:
          name: knowledge-crawls
          path: graphify-out/knowledge-crawls/
          retention-days: 7
```

After crawl, trigger memory ingestion via the Intelligence API:

```bash
for SOURCE_KEY in letbuyy-docs nextjs-docs razorpay-docs supabase-docs; do
  curl -X POST https://<lcis-v2-host>:3334/intelligence/knowledge/crawl \
    -H 'Content-Type: application/json' \
    -d "{\"sourceKey\": \"$SOURCE_KEY\"}"
done
```

---

## Environment Variables Reference (All V2 Variables)

| Variable | Required | Default | Production Value |
|----------|---------|---------|----------------|
| `OPENAI_API_KEY` | **YES** | — | `sk-<prod-key>` — from OpenAI Platform, injected by deploy platform |
| `QDRANT_URL` | No | `http://localhost:6333` | `https://<cluster>.us-east4-0.gcp.cloud.qdrant.io` |
| `QDRANT_API_KEY` | No (local) **YES** (cloud) | — | Qdrant Cloud API key |
| `EMBED_MODEL` | No | `text-embedding-3-small` | `text-embedding-3-small` (change requires re-indexing all collections) |
| `EMBED_DIMENSIONS` | No | `1536` | `1536` (must match `EMBED_MODEL` output dimensions) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4318` | `https://ingest.us.signoz.cloud:443` |
| `OTEL_SERVICE_NAME` | No | `lcis-intelligence` | `lcis-intelligence-production` |
| `OTEL_ENVIRONMENT` | No | `development` | `production` |
| `PLAYWRIGHT_HEADLESS` | No | `true` | `true` (always headless in server environments) |
| `BROWSER_INTELLIGENCE_TIMEOUT` | No | `30000` | `45000` (more lenient for prod store load times) |
| `INCIDENT_ERROR_RATE_THRESHOLD` | No | `0.05` | `0.02` (stricter in production) |
| `INCIDENT_SLOW_QUERY_MS` | No | `5000` | `3000` (stricter in production) |
| `ANOMALY_SIGMA_THRESHOLD` | No | `3.0` | `2.5` (more sensitive) |
| `LCIS_V2_PORT` | No | `3334` | `3334` |
| `LCIS_V1_URL` | No | `http://localhost:3333` | `http://localhost:3333` (V1 runs on same host) |

### SigNoz Cloud Additional Variable

```bash
# Required for SigNoz Cloud (not used for local Docker SigNoz)
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=<ingestion-key>
```

---

## Health Validation

Run these checks immediately after any deployment:

```bash
#!/usr/bin/env bash
HOST="${1:-http://localhost:3334}"

echo "=== LCIS V2 Deployment Health Check ==="

# 1. API up
echo -n "Intelligence API: "
curl -sf "$HOST/intelligence/health" | jq -r '.overall'

# 2. Memory engine
echo -n "Memory Engine (Qdrant): "
curl -sf "$HOST/intelligence/memory/health" | jq -r '.qdrant'

# 3. V1 LCIS connectivity
echo -n "V1 LCIS integration: "
curl -sf "$HOST/intelligence/status" | jq -r 'if .v1.nodeCount then "CONNECTED (\(.v1.nodeCount) nodes)" else "NOT CONNECTED" end'

# 4. Graph engine
echo -n "Graph Engine: "
curl -sf "$HOST/intelligence/graph/health" | jq -r 'if .built then "INDEX BUILT (\(.lastBuilt))" else "NOT BUILT" end'

# 5. Agent status
echo -n "Agents available: "
curl -sf "$HOST/intelligence/agents/status" | jq '[.agents[] | select(.available)] | length'

# 6. Memory collections populated
echo "Memory collection counts:"
curl -sf "$HOST/intelligence/memory/stats" | jq 'to_entries | map({(.key): .value.pointsCount}) | add'

# 7. End-to-end ask
echo -n "End-to-end ask: "
RESULT=$(curl -sf "$HOST/intelligence/ask?q=how+does+checkout+work" | jq -r '.answer // "FAILED"')
echo "${RESULT:0:80}..."

echo "=== Health Check Complete ==="
```

---

## Rollback (Disable V2 Without Touching V1)

V2 is designed so that disabling it has zero impact on V1 LCIS or the application stack.

### Method 1: Stop the Intelligence API Process

```bash
# Find and kill the V2 process
pkill -f "intelligence-api/server.mjs"
# OR
ps aux | grep server.mjs | awk '{print $2}' | xargs kill
```

V1 LCIS at `:3333` continues unaffected. All pnpm graph:* commands continue to work. Claude Code's LCIS-FIRST protocol falls back to V1 automatically.

### Method 2: Stop Docker Infrastructure

```bash
docker compose -f tools/central-intelligence/docker-compose.yml stop
```

This takes down Qdrant, SigNoz, OTel Collector, and ClickHouse. The Intelligence API process will serve degraded responses (503 on memory endpoints) but will not crash. V1 LCIS is completely unaffected.

### Method 3: Full V2 Shutdown (Process + Infrastructure)

```bash
# Stop the Node.js process
pkill -f "intelligence-api/server.mjs"

# Stop Docker services (keep volumes = keep vector data for re-activation)
cd tools/central-intelligence && docker compose stop
```

### Reactivation

```bash
cd tools/central-intelligence
docker compose up -d qdrant signoz-otel-collector signoz-clickhouse
npm start
```

Memory data persists in Docker volumes — no re-indexing required unless volumes were destroyed.

### V2 Never Modifies V1

V2 reads from V1 (`LCIS_V1_URL`). It never modifies `tools/graph-server/`, never writes to `graphify-out/*.json` (the V1 artifacts), and never changes V1 server configuration. Rolling back V2 requires only stopping V2 processes.

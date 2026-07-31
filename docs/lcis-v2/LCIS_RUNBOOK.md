# LCIS V2 — Operator Runbook

**Version:** 2.0.0  
**Last Updated:** 2026-06-19  
**Escalation Owner:** @saai-sidd  
**Intelligence API:** `http://localhost:3334`  
**Qdrant Dashboard:** `http://localhost:6333/dashboard`  
**SigNoz UI:** `http://localhost:3301`  
**OTel Collector Health:** `http://localhost:13133/health`

This runbook is for LCIS V2 itself — the autonomous intelligence infrastructure. It does not cover LetBuyy application incidents. Each entry follows: Detection → Diagnosis → Recovery → Verification.

---

## 1. Memory Engine Down (Qdrant Unreachable)

### Detection

```bash
curl -sf http://localhost:3334/intelligence/memory/health | jq '.qdrant'
# Returns: "NOT CONNECTED"
# OR
curl -sf http://localhost:3334/intelligence/health | jq '.subsystems[] | select(.name == "MemoryEngine")'
# Returns status: "DOWN"
```

Symptom: all `/intelligence/memory/*` endpoints return 503, and `/intelligence/ask` returns answers without memory context (lower confidence).

### Diagnosis

```bash
# Step 1: Is the container running?
docker compose ps qdrant
# Expected: qdrant   running (healthy)

# Step 2: If not running, check logs
docker compose logs qdrant --tail=50

# Step 3: Can you reach the REST port?
curl -sf http://localhost:6333/healthz
# Expected: {} with HTTP 200

# Step 4: Check if port is bound
lsof -i :6333
```

Common causes:
- Docker daemon not running → restart Docker Desktop
- Container OOM-killed → check `docker inspect lcis-qdrant --format '{{.State.OOMKilled}}'`
- Port 6333 bound by another process → identify with `lsof -i :6333`
- Volume corruption → see Recovery step for wipe-and-restart

### Recovery

```bash
# Case A: Container stopped — restart it
docker compose start qdrant

# Case B: Container unhealthy — force recreate
docker compose up -d --force-recreate qdrant

# Case C: OOM — increase Docker Desktop memory allocation
# Docker Desktop → Settings → Resources → Memory → increase to >= 4GB
# Then:
docker compose up -d qdrant

# Case D: Port conflict
# Find and kill the conflicting process
lsof -i :6333 -t | xargs kill -9
docker compose up -d qdrant

# Case E: Corrupted volume — last resort (loses all vectors, requires re-indexing)
docker compose down qdrant
docker volume rm letbuyy_store_qdrant_storage
docker compose up -d qdrant
npm run memory:init    # re-embed all documents; requires OPENAI_API_KEY
```

### Verification

```bash
# Wait for Qdrant health
until curl -sf http://localhost:6333/healthz; do sleep 2; done
echo "Qdrant up"

# Check memory engine reports CONNECTED
curl -sf http://localhost:3334/intelligence/memory/health | jq '.qdrant'
# Expected: "CONNECTED"

# Confirm collection stats are populated
curl -sf http://localhost:3334/intelligence/memory/stats | jq 'to_entries | map(.value.pointsCount)' 
# Expected: non-zero values if re-indexing completed
```

---

## 2. Knowledge Crawl Failing

### Detection

```bash
curl -sf http://localhost:3334/intelligence/knowledge/freshness | jq
# Look for stale sources: staleDays > 7

# OR trigger a crawl and capture the error
curl -X POST http://localhost:3334/intelligence/knowledge/crawl \
  -H 'Content-Type: application/json' \
  -d '{"sourceKey":"letbuyy-docs"}' | jq
# Returns: {"crawled": false, "errors": 1}
```

### Diagnosis

```bash
# Step 1: Is Python 3 available?
python3 --version
# Expected: Python 3.x.x

# Step 2: Are Python deps installed?
pip3 show crawl4ai
# If not found: crawl4ai not installed

# Step 3: Does the crawler script exist?
ls tools/central-intelligence/knowledge-engine/crawlers/
# Expect: letbuyy-docs-crawler.py (or other sourceKey)

# Step 4: Run the crawler manually and capture stderr
cd tools/central-intelligence
python3 knowledge-engine/crawlers/letbuyy-docs-crawler.py 2>&1 | head -40

# Step 5: Is the output directory writable?
ls -la graphify-out/knowledge-crawls/ 2>/dev/null || echo "MISSING"
```

Common causes:
- `crawl4ai` Python package not installed
- Target site is rate-limiting or blocking the crawler
- Crawler script not found for the requested `sourceKey`
- Output directory `graphify-out/knowledge-crawls/` missing

### Recovery

```bash
# Case A: Python deps missing
pip3 install -r tools/central-intelligence/knowledge-engine/crawlers/requirements.txt

# Case B: Output directory missing
mkdir -p graphify-out/knowledge-crawls

# Case C: Rate limited — add delay and retry
# Edit the crawler script to increase wait_for delay, then retry:
curl -X POST http://localhost:3334/intelligence/knowledge/crawl \
  -H 'Content-Type: application/json' \
  -d '{"sourceKey":"letbuyy-docs"}'

# Case D: Unknown sourceKey — list valid sources
curl -sf http://localhost:3334/intelligence/knowledge/sources | jq '.sources[].key'
```

### Verification

```bash
# Freshness should show recent crawl timestamps
curl -sf http://localhost:3334/intelligence/knowledge/freshness | jq

# Memory should have new points after ingestion
curl -sf http://localhost:3334/intelligence/memory/stats | jq '.knowledge.pointsCount'
```

---

## 3. Graph Index Stale or Corrupt

### Detection

```bash
curl -sf http://localhost:3334/intelligence/graph/health | jq
# Returns: { "built": false } or { "built": true, "lastBuilt": "2026-05-01T..." }

# If built=false or lastBuilt > 7 days ago: stale
# If graph queries return empty results: potentially corrupt
curl -sf 'http://localhost:3334/intelligence/graph/query?q=payment&method=global' | jq
# Returns: { "result": null } = no index
```

### Diagnosis

```bash
# Step 1: Check if GraphRAG output artifacts exist
ls tools/central-intelligence/graph-engine/graphrag/output/artifacts/ 2>/dev/null
# If empty or missing: index was never built or was cleaned

# Step 2: Check if GraphRAG Python package is installed
python3 -m graphrag --version 2>&1
# If error: graphrag not installed

# Step 3: Check if OPENAI_API_KEY is set
cd tools/central-intelligence && [ -f .env ] && grep OPENAI_API_KEY .env
# If empty or missing: embeddings will fail during build

# Step 4: Check for partial build corruption
# If the output directory exists but parquet files are malformed:
python3 -c "import pandas as pd; df = pd.read_parquet('tools/central-intelligence/graph-engine/graphrag/output/artifacts/'); print(len(df))" 2>&1
```

### Recovery

```bash
# Step 1: Install GraphRAG if missing
pip3 install -r tools/central-intelligence/graph-engine/graphrag/requirements.txt

# Step 2: Clean corrupt output
cd tools/central-intelligence
node -e "import('./graph-engine/GraphBuilder.mjs').then(m => m.default.clean())"
# Returns: { "cleaned": true }

# Step 3: Ensure source documents exist
ls docs/central-intelligence/*.md | wc -l
# If zero: run pnpm graph:omega first to generate intelligence docs

# Step 4: Run the full build (may take up to 30 minutes)
npm run graph:build
# Watch stdout for entity/relationship/community counts
```

### Verification

```bash
# Graph health should show built=true with recent timestamp
curl -sf http://localhost:3334/intelligence/graph/health | jq

# A query should return non-null results
curl -sf 'http://localhost:3334/intelligence/graph/query?q=payment+flow&method=global' | jq '.result | length'
# Expected: > 0

# Impact query should work
curl -sf 'http://localhost:3334/intelligence/graph/impact?entity=orders' | jq '.impact | length'
```

---

## 4. Browser Intelligence Timeout

### Detection

```bash
curl -sf 'http://localhost:3334/intelligence/browser/validate?url=https://demo.letbuyy.com' | jq
# Returns: { "status": "NOT AVAILABLE", "reason": "playwright not installed" }
# OR the request hangs for > BROWSER_INTELLIGENCE_TIMEOUT (30s default)
```

### Diagnosis

```bash
# Step 1: Is Playwright installed?
node -e "import('playwright').then(p => console.log('OK', p.chromium.executablePath()))" 2>&1
# If error: not installed

# Step 2: Are browser binaries downloaded?
npx playwright install chromium --dry-run 2>&1 | grep "already installed" || echo "MISSING"

# Step 3: Check current timeout setting
grep BROWSER_INTELLIGENCE_TIMEOUT tools/central-intelligence/.env
# Default: 30000ms

# Step 4: Test a simple navigation
PLAYWRIGHT_HEADLESS=true node -e "
  import('playwright').then(async p => {
    const b = await p.chromium.launch({ headless: true });
    const page = await (await b.newContext()).newPage();
    await page.goto('https://example.com', { timeout: 10000 });
    console.log('title:', await page.title());
    await b.close();
  });
"

# Step 5: Check for zombie browser processes
ps aux | grep -i chrome | grep -v grep
```

Common causes:
- Playwright not installed (`npm install` skipped or failed)
- Chromium browser binary not downloaded
- Target URL unreachable or very slow (increase timeout)
- Zombie browser processes consuming resources
- Headless mode not supported in environment (rare)

### Recovery

```bash
# Case A: Playwright not installed
cd tools/central-intelligence
npm install playwright
npx playwright install chromium

# Case B: Timeout too short for a slow target
# Edit .env:
echo "BROWSER_INTELLIGENCE_TIMEOUT=60000" >> tools/central-intelligence/.env
# Restart API

# Case C: Kill zombie browsers
pkill -f "chrome --headless" || true
pkill -f "chromium --headless" || true

# Case D: CI/server environment — ensure display is not required
export PLAYWRIGHT_HEADLESS=true
npm start
```

### Verification

```bash
# Status should show playwrightInstalled=true
curl -sf http://localhost:3334/intelligence/browser/status | jq
# Expected: { "playwrightInstalled": true, "headless": true, "activeSessions": 0 }

# Simple validate should return a PASS or DEGRADED (not NOT AVAILABLE)
curl -sf 'http://localhost:3334/intelligence/browser/validate?url=https://example.com' | jq '.status'
# Expected: "PASS" or "DEGRADED"
```

---

## 5. OTel Collector Not Receiving Data

### Detection

```bash
# OTel collector health
curl -sf http://localhost:13133/health
# If connection refused: container is down

# Check pipeline stats (zpages)
curl -sf http://localhost:55679/debug/pipelinez | grep -A5 "traces"
# Look for: "receive_items=0" over a period where traces should have been sent
```

### Diagnosis

```bash
# Step 1: Is the container running?
docker compose ps signoz-otel-collector
# Expected: running (healthy)

# Step 2: Container logs for errors
docker compose logs signoz-otel-collector --tail=50

# Step 3: Is ClickHouse dependency healthy?
docker compose ps signoz-clickhouse
# Expected: running (healthy)

# Step 4: Test OTLP HTTP connectivity
curl -X POST http://localhost:4318/v1/traces \
  -H 'Content-Type: application/json' \
  -d '{"resourceSpans":[]}' | jq
# Expected: HTTP 200 with empty response

# Step 5: Is any service actually sending traces?
# OTel SDK must be initialized in the service — TelemetryService.init() must have been called
grep -r "TelemetryService.init\|instrument-api-gateway" apps/api-gateway/src/ 2>/dev/null | head -5
```

Common causes:
- OTel Collector container down (check ClickHouse health first — it's a dependency)
- ClickHouse container unhealthy (OTel Collector won't start without it)
- No runtime has wired `TelemetryService.init()` — instrumentation not active
- `OTEL_EXPORTER_OTLP_ENDPOINT` points to wrong host/port

### Recovery

```bash
# Case A: ClickHouse unhealthy → OTel Collector won't start
docker compose up -d signoz-clickhouse
# Wait for healthy
until docker compose exec signoz-clickhouse clickhouse-client --query "SELECT 1" &>/dev/null; do sleep 3; done
docker compose up -d signoz-otel-collector

# Case B: OTel Collector stopped
docker compose start signoz-otel-collector

# Case C: Wrong endpoint in .env
# Set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 in .env
# Restart the Intelligence API
npm start

# Case D: No instrumentation wired
# Wire TelemetryService in api-gateway per tools/central-intelligence/observability/instrument-api-gateway.mjs
```

### Verification

```bash
# OTel Collector health
curl -sf http://localhost:13133/health

# Pipeline stats show non-zero received items after a test trace
curl -sf http://localhost:55679/debug/pipelinez | grep "receive_items"

# SigNoz UI shows incoming traces
open http://localhost:3301  # Open browser to SigNoz dashboard
```

---

## 6. Intelligence API (:3334) Not Responding

### Detection

```bash
curl -sf http://localhost:3334/intelligence/health
# Connection refused, timeout, or non-200
```

### Diagnosis

```bash
# Step 1: Is the process running?
lsof -i :3334 | grep node
# If empty: process is not running

# Step 2: Was it started recently?
ps aux | grep "server.mjs" | grep -v grep

# Step 3: Check startup error
# Run interactively to see the error
cd tools/central-intelligence && node intelligence-api/server.mjs

# Step 4: Check for port conflict
lsof -i :3334

# Step 5: Check .env is loaded
cd tools/central-intelligence && node -e "
  import('node:fs').then(fs => {
    const env = fs.readFileSync('.env', 'utf8');
    const hasKey = env.includes('OPENAI_API_KEY=sk-');
    console.log('OPENAI_API_KEY set:', hasKey);
  });
"
```

Common causes:
- Process not started (`npm start` not run)
- Fatal startup error (check stderr)
- Port 3334 in use by another process
- `.env` not found (missing `cp .env.example .env`)

### Recovery

```bash
# Case A: Not started
cd tools/central-intelligence && npm start &

# Case B: Fatal startup error — diagnose from stderr
cd tools/central-intelligence && node intelligence-api/server.mjs 2>&1

# Case C: Port conflict
lsof -i :3334 -t | xargs kill -9
cd tools/central-intelligence && npm start &

# Case D: Missing .env
cp tools/central-intelligence/.env.example tools/central-intelligence/.env
# Edit .env and set OPENAI_API_KEY
cd tools/central-intelligence && npm start &
```

### Verification

```bash
# Health endpoint must respond
curl -sf http://localhost:3334/intelligence/health | jq '.overall'
# Expected: "HEALTHY" or "DEGRADED"

# Endpoint list must be present (404 returns the endpoint list)
curl -sf http://localhost:3334/ | jq '.endpoints | length'
# Expected: 24
```

---

## 7. Qdrant Disk Full

### Detection

```bash
# Qdrant returns 5xx errors or refuses writes
curl -X POST http://localhost:6333/collections/architecture/points \
  -H 'Content-Type: application/json' \
  -d '{"points":[]}' | jq
# Returns 500 or "No space left on device"

# Check Docker volume disk usage
docker system df -v | grep qdrant_storage
```

### Diagnosis

```bash
# Host disk usage
df -h $(docker inspect lcis-qdrant --format '{{.Mounts}}' 2>/dev/null | grep -o '/var/lib/docker[^"]*' | head -1) 2>/dev/null \
  || df -h /

# Qdrant collection sizes
curl -sf http://localhost:6333/collections | jq '.result.collections[].name' | \
  xargs -I{} curl -sf http://localhost:6333/collections/{} | jq '.result.vectors_count'

# graphify-out size (non-Docker but co-located)
du -sh /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/
du -sh /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/browser-evidence/
```

### Recovery

```bash
# Step 1: Free space immediately — clean browser evidence
find /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/browser-evidence \
  -maxdepth 1 -type d -name "202*" -mtime +3 -exec rm -rf {} +

# Step 2: Clean GraphRAG build artifacts (can be rebuilt)
rm -rf tools/central-intelligence/graph-engine/graphrag/input/ \
       tools/central-intelligence/graph-engine/graphrag/cache/ \
       tools/central-intelligence/graph-engine/graphrag/logs/
# Note: keep output/ unless rebuilding

# Step 3: If Qdrant volume itself is too large, delete low-value collections
# Example: incidents collection can be purged if very large
curl -X DELETE http://localhost:6333/collections/incidents
# Then recreate via memory:init

# Step 4: Expand available disk (Docker Desktop settings or host disk cleanup)
# Docker Desktop → Settings → Resources → Disk image size → increase

# Step 5: Restart Qdrant after disk freed
docker compose restart qdrant
```

### Verification

```bash
df -h
curl -sf http://localhost:6333/healthz
curl -sf http://localhost:3334/intelligence/memory/health | jq '.qdrant'
# Expected: "CONNECTED"
```

---

## 8. OpenAI API Key Invalid or Rate-Limited

### Detection

```bash
# Memory search returns empty despite Qdrant being healthy
curl -sf 'http://localhost:3334/intelligence/memory/search?q=payment+flow' | jq
# Returns: { "results": [], "count": 0 }

# Memory indexing logs show NOT CONNECTED
npm run memory:init 2>&1 | grep "NOT CONNECTED"
# Returns: [MemoryService] embed: OPENAI_API_KEY NOT CONNECTED

# OR shows rate limit error
npm run memory:init 2>&1 | grep "429"
```

### Diagnosis

```bash
# Step 1: Test the key directly
cd tools/central-intelligence
node -e "
  import('./memory-engine/MemoryService.mjs').then(async m => {
    const v = await m.default.embed('test health check');
    console.log(v ? 'OK length=' + v.length : 'FAILED — null returned');
  }).catch(e => console.error('ERROR:', e.message));
"

# Step 2: Check .env
grep OPENAI_API_KEY tools/central-intelligence/.env | cut -c1-30

# Step 3: Verify key is not expired (direct API call)
source tools/central-intelligence/.env
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.error // "OK"'
```

Common causes:
- `OPENAI_API_KEY` is the placeholder `sk-...` from `.env.example`
- Key has been revoked or expired on the OpenAI dashboard
- Rate limit exceeded (embedding requests per minute)
- OpenAI API outage (check `https://status.openai.com`)

### Recovery

```bash
# Case A: Placeholder key — set a real key
# 1. Get a key from https://platform.openai.com/api-keys
# 2. Edit tools/central-intelligence/.env: OPENAI_API_KEY=sk-...
# 3. Restart Intelligence API
npm start

# Case B: Rate limited — back off and retry
# The embed function will naturally retry on the next memory:init call
# Wait 60 seconds then:
npm run memory:init

# Case C: Key expired — rotate key on OpenAI platform then update .env

# Case D: OpenAI outage — LCIS continues to serve V1 structural intelligence
# Memory search will return empty results until connectivity is restored
# No action needed; alert resolves automatically when OpenAI recovers
```

### Verification

```bash
# Embed test must return a vector
node -e "
  import('./tools/central-intelligence/memory-engine/MemoryService.mjs').then(async m => {
    const v = await m.default.embed('verify key works');
    console.log(v ? 'OK — dimensions=' + v.length : 'FAILED');
  });
"

# After re-indexing, memory search should return results
curl -sf 'http://localhost:3334/intelligence/memory/search?q=payment&limit=3' | jq '.count'
# Expected: > 0
```

---

## 9. Context Map Stale

### Detection

```bash
# Context intelligence files are missing or old
ls -la /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/context-intelligence/
# If files are older than 7 days or missing: stale

# Context summary is absent
[ -f /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/context-intelligence/LCIS_CONTEXT_SUMMARY.md ] \
  || echo "MISSING"
```

### Diagnosis

```bash
# Step 1: Does graph.json exist (prerequisite)?
ls -lh /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/graph.json
# If missing: Graphify has not been run

# Step 2: Run context build with visible output
cd tools/central-intelligence
node context-intelligence/ContextCompressionPipeline.mjs 2>&1 | tail -20
```

### Recovery

```bash
# Step 1: Ensure Graphify code graph exists
cd /Users/saai_sidd/Git/Letbuyy_Store
pnpm graph:update .
# Wait for completion (~2-5 min for 52k nodes)

# Step 2: Build context maps
cd tools/central-intelligence
npm run context:build

# If error about graph.json not found:
GRAPH_PATH=/Users/saai_sidd/Git/Letbuyy_Store/graphify-out/graph.json npm run context:build
```

### Verification

```bash
ls -lh /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/context-intelligence/
# Expect 5 files: LCIS_CONTEXT_MAP.json, LCIS_ARCHITECTURE_GRAPH.json,
#                 LCIS_DEPENDENCY_GRAPH.json, LCIS_IMPORTANCE_RANKING.json,
#                 LCIS_CONTEXT_SUMMARY.md

# Context map should contain top-300 files
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('graphify-out/context-intelligence/LCIS_CONTEXT_MAP.json','utf8'));
  console.log('Files in context map:', m.files?.length ?? 'N/A');
"
```

---

## 10. Self-Model Out of Date

### Detection

```bash
# Self-model artifacts are missing or older than 14 days
ls -la /Users/saai_sidd/Git/Letbuyy_Store/graphify-out/self-model/ 2>/dev/null || echo "MISSING"

# Self-model shows wrong subsystem counts (after adding new subsystems)
node -e "
  const fs = require('fs');
  const sm = JSON.parse(fs.readFileSync('graphify-out/self-model/subsystems.json','utf8'));
  console.log('Subsystem count:', sm.length);
"
```

### Diagnosis

```bash
# Check when last built
ls -la graphify-out/self-model/*.json 2>/dev/null | sort -k6,7 | tail -3

# Check if new subsystem dirs were added since last build
ls tools/central-intelligence/ | grep -v node_modules | wc -l
```

### Recovery

```bash
cd tools/central-intelligence
npm run self:model
```

Output confirms scanning all 13 declared layers and writes artifacts to `graphify-out/self-model/`.

### Verification

```bash
ls graphify-out/self-model/
# Expect multiple .json files written recently

node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('graphify-out/self-model/subsystems.json','utf8'));
  console.log('Layers:', m.map(s => s.layer).join(', '));
"
# Expect 13 layers: Memory, Knowledge, Graph, Browser, Observability, Agents,
#                   Context, Architecture, Reasoning, Correlation, AutonomousOps,
#                   SelfModel, IntelligenceAPI
```

---

## Escalation

All LCIS V2 incidents escalate to: **@saai-sidd**

Priority guidance:

| Severity | Condition | Response Time |
|---------|-----------|--------------|
| P1 | Intelligence API :3334 completely down AND V1 :3333 down | Immediate |
| P2 | Memory engine NOT CONNECTED (semantic search blind) | < 1 hour |
| P2 | Qdrant disk full (writes rejected) | < 1 hour |
| P3 | Graph index stale > 7 days | < 1 business day |
| P3 | Knowledge crawl failing (freshness degraded) | < 1 business day |
| P4 | Context map stale, self-model out of date | < 1 week |
| P4 | OTel collector receiving no data (observability blind) | < 1 week |

Note: LCIS V2 is an intelligence layer, not a production revenue path. V1 LCIS (:3333) continues to answer all structural questions even when V2 is completely down. P1 applies only when both are down simultaneously.

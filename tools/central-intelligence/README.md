# LCIS V2 — Autonomous Commerce Intelligence Platform

LCIS V2 is the autonomous reasoning and intelligence layer for LetBuyy, built on top of V1 (the code/DB graph at `:3333`, `tools/graph-server/`). It adds semantic memory, continuous knowledge acquisition, graph-native reasoning, real-time browser evidence, structured observability, and autonomous operational intelligence — all surfaced through a unified API at `:3334`. The system answers "what breaks / who owns / how to recover" questions autonomously, without a repository scan.

## Subsystems

| Subsystem | Directory | Purpose |
|---|---|---|
| Memory Engine | `memory-engine/` | Semantic vector memory: index, retrieve, and monitor codebase + operational knowledge |
| Knowledge Engine | `knowledge-engine/` | Continuous acquisition and freshness tracking of commerce and platform knowledge |
| Graph Engine | `graph-engine/` | Graph-native reasoning and query over the LetBuyy code + DB graph |
| Browser Intelligence | `browser-intelligence/` | Playwright-driven UI evidence collection and visual validation |
| Observability | `observability/` | Distributed tracing, metrics, anomaly detection, and incident signals via OTel |
| Agents | `agents/` | Autonomous agent runtime for scheduled and event-driven intelligence tasks |
| Intelligence API | `intelligence-api/` | Unified HTTP API at `:3334` — the single entry point for all V2 capabilities |
| Context Intelligence | `context-intelligence/` | Context compression pipeline and context-map construction |
| Reasoning | `reasoning/` | Multi-step reasoning chains over graph + memory + observability data |
| Correlation | `correlation/` | Cross-signal correlation engine linking code changes to runtime incidents |
| Autonomous Operations | `autonomous-operations/` | Self-healing triggers, runbook execution, and recovery orchestration |
| Self Model | `self-model/` | System self-model: topology, capability, and gap tracking |

## Quick Start

```bash
# 1. Configure environment
cp tools/central-intelligence/.env.example tools/central-intelligence/.env
# Edit .env — set OPENAI_API_KEY at minimum

# 2. Run setup (installs deps, starts Docker services, initialises memory)
cd tools/central-intelligence
bash setup.sh

# 3. Start the intelligence API
npm start
```

## Key Endpoints

| Endpoint | Description |
|---|---|
| `GET /intelligence/health` | V2 health check — all subsystems |
| `GET /intelligence/ask?q=` | Natural-language question → answer |
| `GET /intelligence/memory/search?q=` | Semantic memory search |
| `GET /intelligence/graph/blast?symbol=` | Blast radius for a symbol |
| `GET /intelligence/observe/anomalies` | Current anomaly signals |
| `GET /intelligence/browser/evidence?target=` | Browser-collected UI evidence |
| `GET /intelligence/context?domain=` | Compressed context for a domain |
| `GET /intelligence/reasoning/run?q=` | Run a multi-step reasoning chain |
| `GET /intelligence/self/model` | Current self-model snapshot |

## Architecture Contract

The five technology primitives (Qdrant, Crawl4AI, GraphRAG, Playwright, SigNoz) are hidden as LCIS subsystem implementations. They must never be exposed in API responses, route names, or operator-facing documentation. Consumers interact only with LCIS subsystem language (Memory Engine, Knowledge Engine, etc.).

LCIS V1 at `:3333` (`tools/graph-server/`) is unchanged and unaffected. V2 federates over V1 via `LCIS_V1_URL`.

## Further Reading

- Architecture: `docs/lcis-v2/`
- V1 (code + DB graph): `tools/graph-server/README.md`
- Operator runbook: `docs/central-intelligence/`

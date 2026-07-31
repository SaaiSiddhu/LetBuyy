# LCIS Graph Intelligence Engine

**LCIS V2** — `tools/central-intelligence/` — port `:3334`
**LCIS V1** — `tools/graph-server/` — port `:3333`

---

## 1. Overview — Why a Knowledge Graph

LCIS V1 (`tools/graph-server/`) operates on structured data extracted from the repository by Graphify: tables, RPCs, routes, policies, and domain assignments are all indexed deterministically. That approach is excellent for precise, navigable answers about what exists — which tables belong to the payments domain, which RPCs touch `order_items`, what routes the api-gateway exposes. It answers those questions in milliseconds because it is essentially a database query over a static graph snapshot.

The LCIS knowledge graph engine, introduced in V2, exists to fill a different class of question: those whose answers require synthesising meaning across documents rather than looking up structured records. Architecture decision records in `docs/central-intelligence/`, audit reports, domain intelligence dumps, and operational runbooks are unstructured prose. When an engineer asks "why was the canonical-ledger-only pattern chosen?" or "what is the full blast radius if the payment_transactions table becomes unavailable?", keyword search against those documents returns fragments. It does not reason across the connections between fragments. The knowledge graph engine builds a persistent graph of entities and their relationships from those prose documents and then answers questions by traversing that graph — community-level synthesis for broad architectural questions, entity-neighbourhood traversal for precise blast-radius and dependency queries.

The distinction matters operationally. Keyword search ranks by term frequency; graph-level reasoning ranks by structural proximity and community membership. A query about "what breaks if `create_checkout_order` is changed" resolves through the graph's typed edges — PAYMENT depends on ORDER, SERVICE processes QUEUE, DEPLOYMENT causes INCIDENT — rather than through matching the string "create_checkout_order" in text. Entities are extracted from prose once during index build and are then reachable from any other entity in the graph via the relationship taxonomy. This means the engine can answer questions about entities that are never mentioned in the same document: it finds the path through the graph.

---

## 2. Entity Taxonomy

Defined in `tools/central-intelligence/graph-engine/entities/commerce-entities.json` and enumerated in `tools/central-intelligence/graph-engine/graphrag/settings.yml` under `entity_extraction.entity_types`.

| Type | Description |
|------|-------------|
| `MERCHANT` | Business owner or operator who has registered a store. Identified by `site_id`. Owns one or more stores and manages products, orders, payments, and settings. |
| `STORE` | Tenant-scoped commerce store. Identified by `site_id` + store slug. Accessible at `{slug}.letbuyy.com` or a custom domain. Hosts products, collections, customers, orders, and a theme. |
| `THEME` | Visual and layout presentation layer for a storefront. Can be a Liquid template or a React component tree. Managed by `theme-engine`. Each store uses exactly one active theme. |
| `APP` | Third-party or first-party application installed on a store via the app marketplace. Extends store functionality through APIs and webhooks. |
| `ORDER` | Customer purchase record within a store. Contains `order_items`, shipping details, GST invoice data, payment status, and fulfilment state. Money stored as `*_minor bigint` (paise). |
| `PAYMENT` | Financial transaction record associated with an order. Processed via Razorpay or COD. Stored in `payment_transactions`. Mutations only via `SECURITY DEFINER` RPCs. |
| `CUSTOMER` | Shopper registered with a store. Identified by `store_customers` row. Holds `customer_credentials` for authentication. Scoped to a single store's `site_id`. |
| `INCIDENT` | Operational event indicating degradation, failure, or anomaly in a service or domain. Triggers runbook execution, escalation, and blast-radius analysis. |
| `DEPLOYMENT` | Code or configuration change released to a production environment. Tracked by commit SHA and Vercel/Cloudflare deploy ID. Can cause incidents if it breaks dependent services. |
| `SERVICE` | Runtime process in the LetBuyy topology: `api-gateway`, `storefront-runtime`, `merchant-control-plane`, `identity-platform`, `queue-workers`, `webhook-service`, or `mobile-bff`. |
| `QUEUE` | Async work queue processed by `queue-workers`. Carries tenant-scoped jobs (emails, webhooks, inventory updates). Jobs are HMAC-signed envelopes. |
| `WORKER` | Cloudflare Worker or Node.js process consuming queue jobs or serving edge requests. Part of the `queue-workers` or `api-gateway` runtime. |
| `DOMAIN_AREA` | Business capability subdomain (e.g. payments, orders, themes, identity, marketplace). Groups related tables, RPCs, routes, queues, and workers. |
| `DOCUMENT` | Architecture, design, audit, or operational document in `docs/`. Captures decisions, findings, runbooks, and domain knowledge. |
| `MIGRATION` | Database schema migration applied to the Supabase/Postgres instance. Alters tables, policies, triggers, or functions. Immutable once applied to production. |

---

## 3. Relationship Taxonomy

Defined in `tools/central-intelligence/graph-engine/entities/commerce-entities.json` under the `relationships` array.

| Type | From | To | Description |
|------|------|----|-------------|
| `OWNS` | `MERCHANT` | `STORE` | A merchant owns and operates one or more stores. |
| `USES` | `STORE` | `THEME` | A store uses exactly one active theme for its storefront presentation. |
| `INSTALLS` | `STORE` | `APP` | A store installs marketplace apps to extend its functionality. |
| `PLACES` | `CUSTOMER` | `ORDER` | A customer places one or more orders within a store. |
| `PAYS_VIA` | `ORDER` | `PAYMENT` | An order is settled through one or more payment transactions. |
| `IMPACTS` | `INCIDENT` | `MERCHANT` | An incident degrades or blocks one or more merchants and their stores. |
| `CAUSES` | `DEPLOYMENT` | `INCIDENT` | A deployment can introduce regressions that cause operational incidents. |
| `CHANGES` | `DEPLOYMENT` | `SERVICE` | A deployment updates the code or configuration of one or more services. |
| `PROCESSES` | `SERVICE` | `QUEUE` | A service (worker) processes jobs from an async queue. |
| `BELONGS_TO` | `SERVICE` | `DOMAIN_AREA` | A service is the primary owner of a business domain area. |
| `DOCUMENTS` | `DOCUMENT` | `DOMAIN_AREA` | A document captures knowledge, decisions, or runbooks for a domain area. |
| `MIGRATES` | `MIGRATION` | `DOMAIN_AREA` | A database migration alters the schema of tables owned by a domain area. |
| `DEPENDS_ON` | `DOMAIN_AREA` | `DOMAIN_AREA` | One domain area has a runtime or data dependency on another domain area. |

---

## 4. Architecture

### Component Overview

```
Source Documents
  ├── docs/central-intelligence/     (architecture docs, audit reports, runbooks)
  ├── graphify-out/domain-intel.json (22-domain structured dump from pnpm graph:domain)
  └── graphify-out/knowledge-crawls/ (external knowledge crawl results)
          │
          ▼
  ┌──────────────────────────────────────────────────────┐
  │                   GraphIndexer                        │
  │  tools/central-intelligence/graph-engine/             │
  │  GraphIndexer.mjs                                     │
  │                                                       │
  │  prepareDocuments()   – accepts {content,filename}    │
  │                         objects or file paths         │
  │  indexArchitectureDocs() – docs/central-intelligence/ │
  │  indexDomainIntel()   – domain-intel.json → per-      │
  │                          domain .txt files            │
  │  indexKnowledgeCrawls() – knowledge-crawls/           │
  │                                                       │
  │  Output: graph-engine/graphrag/input/  (flat dir)     │
  └──────────────────────────────────────────────────────┘
          │
          ▼
  ┌──────────────────────────────────────────────────────┐
  │                   GraphBuilder                        │
  │  tools/central-intelligence/graph-engine/             │
  │  GraphBuilder.mjs                                     │
  │                                                       │
  │  build() / buildFromLCIS() / buildFromKnowledge()     │
  │  buildFull()                                          │
  │                                                       │
  │  Invokes: python3 -m graphrag index                   │
  │    --root graph-engine/graphrag/                      │
  │  Timeout: 30 minutes                                  │
  │  Config:  graph-engine/graphrag/settings.yml          │
  └──────────────────────────────────────────────────────┘
          │
          ▼ (index build pipeline — see §5)
  ┌──────────────────────────────────────────────────────┐
  │           Graph Engine Index Artifacts                │
  │  graph-engine/graphrag/output/artifacts/              │
  │    entities*.parquet                                  │
  │    relationships*.parquet                             │
  │    communities*.parquet                               │
  │  graph-engine/graphrag/output/lancedb/               │
  │    (vector embeddings — LanceDB)                      │
  └──────────────────────────────────────────────────────┘
          │
          ▼
  ┌──────────────────────────────────────────────────────┐
  │                  GraphQueryEngine                     │
  │  tools/central-intelligence/graph-engine/             │
  │  GraphQueryEngine.mjs                                 │
  │                                                       │
  │  queryGlobal(q)  → python3 -m graphrag query          │
  │                      --method global                  │
  │  queryLocal(q)   → python3 -m graphrag query          │
  │                      --method local                   │
  │  Timeout per query: 60 seconds                        │
  └──────────────────────────────────────────────────────┘
          │
          ├──────────── global ────────────┐
          │                                │
          ▼                                ▼
  ┌────────────────┐             ┌────────────────────────┐
  │  Community-    │             │  Entity-neighbourhood  │
  │  level synth.  │             │  traversal (local)     │
  │  Broad arch.   │             │  Blast-radius, deps,   │
  │  questions     │             │  specific entities     │
  └────────────────┘             └────────────────────────┘
          │                                │
          └────────────────┬───────────────┘
                           ▼
  ┌──────────────────────────────────────────────────────┐
  │                   GraphExplorer                       │
  │  tools/central-intelligence/graph-engine/             │
  │  GraphExplorer.mjs                                    │
  │                                                       │
  │  Intelligent routing (routeMethod) between            │
  │  global and local based on question signals           │
  │  High-level methods: explainEntity, whatBreaksIf,     │
  │  whyBuilt, getAffectedMerchants,                      │
  │  traceDeploymentImpact, answerQuestion                │
  └──────────────────────────────────────────────────────┘
          │
          ▼
  ┌──────────────────────────────────────────────────────┐
  │      Intelligence API  (server.mjs — port 3334)       │
  │                                                       │
  │  GET /intelligence/graph/query?q=&method=             │
  │  GET /intelligence/graph/impact?entity=               │
  │  GET /intelligence/graph/entities?name=               │
  │  GET /intelligence/graph/health                       │
  └──────────────────────────────────────────────────────┘
```

### Directory Layout

```
tools/central-intelligence/
└── graph-engine/
    ├── GraphBuilder.mjs        # Index construction orchestrator
    ├── GraphIndexer.mjs        # Document preparation and input staging
    ├── GraphQueryEngine.mjs    # global/local query execution and parsing
    ├── GraphExplorer.mjs       # High-level exploration API with routing
    ├── GraphDiagnostics.mjs    # Health checks, dependency verification, metrics
    ├── entities/
    │   └── commerce-entities.json   # 15 entity types + 13 relationship types
    └── graphrag/
        ├── settings.yml        # Index/query configuration (operator-facing)
        ├── requirements.txt    # Python dependencies
        ├── input/              # Staged documents (gitignored; populated at build time)
        ├── output/             # Index artifacts and LanceDB (gitignored)
        │   ├── artifacts/      # entities*.parquet, relationships*.parquet, communities*.parquet
        │   └── lancedb/        # Vector embeddings
        ├── cache/              # LLM response cache (gitignored)
        └── logs/               # Build logs (gitignored)
```

---

## 5. Index Build Pipeline

The pipeline proceeds in six stages. All stages are orchestrated by `GraphBuilder.mjs` which calls the underlying engine via `python3 -m graphrag index --root <graphrag-root>`. The maximum allowed wall time for the entire pipeline is **30 minutes** (`BUILD_TIMEOUT_MS = 30 * 60 * 1000` in `GraphBuilder.mjs`).

### Stage 1 — Document Collection

`GraphBuilder.buildFull()` collects source files from three locations:

| Source | Location | File types collected |
|--------|----------|---------------------|
| Architecture documentation | `docs/central-intelligence/` | `.md`, `.txt`, `.json` |
| Domain intelligence dump | `graphify-out/domain-intel.json` | single JSON file |
| Knowledge crawls | `graphify-out/knowledge-crawls/` | `.md`, `.txt`, `.json` |

`buildFromLCIS()` uses only the first two sources. `buildFromKnowledge()` uses only the third. `build(inputPath)` accepts an arbitrary directory.

Collection is recursive: `GraphBuilder.mjs` walks directories via `collectFiles()`, which descends into subdirectories and matches filenames with `/\.(md|txt|json)$/i`.

### Stage 2 — Domain Intel Transformation

`GraphIndexer.indexDomainIntel()` deserialises `graphify-out/domain-intel.json` — the output of `pnpm graph:domain`, which maps 22 business domains to their tables, RPCs, routes, queues, workers, dependencies, and owners — and emits one plaintext file per domain into `graphrag/input/`. The file is named `domain_<safeName>.txt` (e.g. `domain_payments.txt`) and contains structured prose sections (`# Domain: <name>`, `## Tables`, `## RPCs`, etc.) suitable for entity extraction.

### Stage 3 — Input Preparation

`GraphBuilder.copyToInput()` (called after collection) copies all source files into `graphrag/input/`, flattening paths with collision-safe names. Filenames are sanitised: non-alphanumeric characters replaced with `_`, counter suffixes added on collision. The `input/` directory is cleared (`fs.rmSync` with `recursive: true`) before each build to ensure a clean state.

`GraphIndexer.prepareDocuments()` provides the same flattening for callers who supply `{content, filename}` objects rather than file paths — it writes content directly to `input/`.

### Stage 4 — Entity Extraction

The graph engine invokes `python3 -m graphrag index --root graphrag/` which reads `graphrag/settings.yml`. The entity extraction pass:

- Splits all input documents into **chunks of 1200 tokens with 100-token overlap** (`chunks.size: 1200`, `chunks.overlap: 100` in `settings.yml`).
- Sends each chunk to the entity extraction model (`entity_extraction.llm`, `max_tokens: 4000`, `temperature: 0`).
- Performs **1 gleaning pass** (`max_gleanings: 1`) — a second extraction pass over the same chunk to recover entities the first pass missed.
- Extracts instances of all 15 entity types declared in `entity_extraction.entity_types` and their relationships.
- Produces **description summarisation** using the summarisation LLM (`summarize_descriptions.llm`, `max_tokens: 500`) to merge duplicate entity descriptions.

Extracted entities and relationships are written to Parquet files in `graphrag/output/artifacts/` (`entities*.parquet`, `relationships*.parquet`).

### Stage 5 — Community Report Generation

The engine groups closely connected entities into communities using the Leiden algorithm and generates a natural-language summary for each community using the community reports LLM (`community_reports.llm`, `max_tokens: 2000`, `max_input_length: 8000`). Community reports are the basis for **global queries** — they allow the engine to synthesise across the whole graph rather than a single entity neighbourhood. Community parquet files are written to `graphrag/output/artifacts/communities*.parquet`.

Claim extraction is **disabled** (`claim_extraction.enabled: false` in `settings.yml`), keeping build cost predictable.

### Stage 6 — Embedding and Vector Storage

All entity descriptions and community reports are embedded using the graph embedding model (`embeddings.llm`, type `openai_embedding`). Embeddings are stored in **LanceDB** at `graphrag/output/lancedb/` (`vector_store.type: lancedb`, `db_uri: output/lancedb`). The `overwrite: true` flag means each full build replaces the prior vector store.

### Freshness

`GraphDiagnostics.getHealth()` compares the `mtime` of `graphrag/output/artifacts/` against the stale threshold: **24 hours** (`STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000` in `GraphDiagnostics.mjs`). Status values are `HEALTHY` (index exists and is fresh), `STALE` (index exists but older than 24 h), or `NOT BUILT` (no artifacts directory or it is empty).

`GraphIndexer.isIndexFresh(maxAgeMs)` provides the same check with a caller-supplied threshold.

---

## 6. Query Patterns

### Global vs Local

The graph engine exposes two query modes:

| Mode | When to use | Underlying mechanism |
|------|------------|----------------------|
| **global** | Broad, architectural, "what are the main…", trends, strategy, overview questions | Traverses community reports — synthesises across the entire graph at a higher level of abstraction |
| **local** | Specific entity questions, blast-radius, dependencies, incident scope, deployment impact, ownership | Traverses the entity neighbourhood — anchors to nearby nodes and typed edges |

**Global examples:**
- "What is the overall architecture of the LetBuyy payment system?"
- "Summarise all services and their roles."
- "What architectural decisions drive the theme platform design?"
- "What domains exist and how do they relate to each other?"

**Local examples:**
- "What breaks if `create_checkout_order` fails or changes?"
- "What does `api-gateway` depend on?"
- "Which merchants are affected when the payment domain is degraded?"
- "Trace the impact of deployment abc123."
- "What is `queue-workers`? Describe its role."
- "Who owns the identity domain and what depends on it?"

### Intelligent Routing in GraphExplorer

`GraphExplorer.answerQuestion(question)` delegates routing to `routeMethod(question)` in `GraphExplorer.mjs`. The router scores the question against two signal sets:

**Global signals** (each occurrence increments `globalScore`):
`overall`, `architecture`, `what are the main`, `summarise`, `summarize`, `overview`, `describe the system`, `how does the platform`, `what domains`, `trends`, `strategy`, `all services`, `entire`

**Local signals** (each occurrence increments `localScore`):
`what breaks`, `impact`, `dependency`, `depends on`, `who owns`, `owner`, `incident`, `deployment`, `rollback`, `merchant`, `customer`, `payment`, `order`, `why was`, `why is`, `trace`, `specific`, `table`, `rpc`, `queue`, `worker`, `route`, `fix`, `repair`, `recover`

**Decision rule:** if `localScore >= globalScore`, route to `local`; otherwise route to `global`. Tie-breaking favours local, which is intentional — most operational questions about a specific system are better served by entity-neighbourhood traversal.

High-level `GraphExplorer` methods bypass the router and hardcode their method:
- `explainEntity(name)` → always `local` (entity-anchored description)
- `whatBreaksIf(entityName)` → always `local` (blast-radius traversal)
- `whyBuilt(entityName)` → always `global` (architectural reasons require community synthesis)
- `getAffectedMerchants(incidentEntity)` → always `local` (specific tenant scope)
- `traceDeploymentImpact(deploymentId)` → always `local` (specific deployment node)

### Entity Extraction from Answers

`GraphQueryEngine.mjs` (`runQuery`) parses every answer returned by the engine and extracts entity names using a bold Markdown heuristic:

```js
const entityMatches = [...answer.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());
const entities = [...new Set(entityMatches)];
```

The engine wraps significant entity names in `**bold**` in its prose answers. This gives callers a structured `entities: string[]` field on every response without requiring a second parsing pass.

All query responses have the shape:

```json
{
  "success": true,
  "answer": "...",
  "entities": ["payment_transactions", "create_checkout_order", "api-gateway"],
  "method": "local",
  "raw": "SUCCESS: Local Search Response: ..."
}
```

On failure: `{ "success": false, "answer": "", "entities": [], "method": "local", "raw": "", "error": "..." }`

---

## 7. Services Reference

All five service modules are in `tools/central-intelligence/graph-engine/`.

| Service | File | Key Methods |
|---------|------|-------------|
| **GraphBuilder** | `GraphBuilder.mjs` | `build(inputPath)` — index from arbitrary directory; `buildFromLCIS()` — index from `docs/central-intelligence/` + `domain-intel.json`; `buildFromKnowledge()` — index from `graphify-out/knowledge-crawls/`; `buildFull()` — all three sources combined; `getStatus()` — `{built, indexPath, lastBuilt, inputFileCount}` without triggering a build; `clean()` — delete `graphrag/input/` and `graphrag/output/` |
| **GraphIndexer** | `GraphIndexer.mjs` | `prepareDocuments(sources)` — stage `{content,filename}` objects or file paths into `input/`; `indexArchitectureDocs()` — walk `docs/central-intelligence/`, copy to `input/`; `indexDomainIntel()` — parse `domain-intel.json`, emit one `.txt` per domain; `indexKnowledgeCrawls()` — walk `graphify-out/knowledge-crawls/`, copy to `input/`; `getIndexStats()` — `{inputFileCount, inputDir, outputExists, artifactsDir, lastBuilt}`; `isIndexFresh(maxAgeMs)` — boolean freshness check against `artifacts/` mtime |
| **GraphQueryEngine** | `GraphQueryEngine.mjs` | `queryGlobal(question)` — community-level synthesis; `queryLocal(question)` — entity-neighbourhood traversal; `findEntity(name)` — local query: "What is {name}? Describe its role…"; `getImpact(entityName)` — local query: "What breaks if {entityName} fails or changes?"; `getDependencies(entityName)` — local query: upstream services/tables/RPCs/queues; `getRelationships(entityName)` — local query: all related entities with relationship type; `healthCheck()` — `{healthy, indexRoot, error?}` via `python3 -m graphrag --help`; `query(question, 'global'\|'local')` — general-purpose with explicit method |
| **GraphExplorer** | `GraphExplorer.mjs` | `explainEntity(name)` — plain-language description, purpose, domain, owner, dependencies (local); `whatBreaksIf(entityName)` — full blast-radius: services/RPCs/tables/queues/workers/deployments/merchants/customers/revenue (local); `whyBuilt(entityName)` — architectural reasons and trade-offs (global); `getAffectedMerchants(incidentEntity)` — merchant IDs, store slugs, revenue impact (local); `traceDeploymentImpact(deploymentId)` — downstream impact + rollback strategy (local); `answerQuestion(question)` — auto-routes global vs local via `routeMethod()` |
| **GraphDiagnostics** | `GraphDiagnostics.mjs` | `getHealth()` — `{status:'HEALTHY'\|'NOT BUILT'\|'STALE', graphrag:'INSTALLED'\|'NOT FOUND', indexExists, lastBuilt, entityCount}`; `runSelfTest()` — 6-check suite: python3 available, graphrag importable, `OPENAI_API_KEY` set, `settings.yml` present, `input/` populated, artifacts present; `checkDependencies()` — `{python3, graphrag, lancedb, pyarrow, pandas, openaiApiKey}`; `getMetrics()` — `{entityCount, relationshipCount, communityCount, artifactsDir, artifactsPresent}` |

---

## 8. API Endpoints

All endpoints are served by `tools/central-intelligence/intelligence-api/server.mjs` on port **3334** (overridable via `LCIS_V2_PORT`). CORS is allowed from `localhost:3000`, `localhost:3001`, `localhost:3333`, and `localhost:3334`.

| Method | Path | Query Parameters | Response Shape |
|--------|------|-----------------|---------------|
| `GET` | `/intelligence/graph/query` | `q` (question), `method` (`global` or `local`, default `global`) | `{ query, method, result: { success, answer, entities, method, raw, error? } }` |
| `GET` | `/intelligence/graph/impact` | `entity` (entity name) | `{ entity, impact: { success, answer, entities, method, raw, error? } }` |
| `GET` | `/intelligence/graph/entities` | `name` (entity name) | `{ name, entity: { success, answer, entities, method, raw, error? } }` |
| `GET` | `/intelligence/graph/health` | — | `{ status: 'HEALTHY'\|'NOT BUILT'\|'STALE', graphrag: 'INSTALLED'\|'NOT FOUND', indexExists, lastBuilt, entityCount }` |

**Examples:**

```sh
# Ask a broad architectural question (global)
curl "http://localhost:3334/intelligence/graph/query?q=What+are+the+main+services+in+LetBuyy&method=global"

# Blast-radius query for a specific entity
curl "http://localhost:3334/intelligence/graph/impact?entity=create_checkout_order"

# Explain a named entity
curl "http://localhost:3334/intelligence/graph/entities?name=api-gateway"

# Check engine health
curl "http://localhost:3334/intelligence/graph/health"
```

The server lazy-loads `GraphQueryEngine`, `GraphExplorer`, and `GraphDiagnostics` on first request; if a module fails to load (e.g. Python not available), the endpoint returns HTTP 503 with `{ "error": "<module> unavailable" }`.

---

## 9. Cost Model

All LLM calls use the credentials in `OPENAI_API_KEY`. There are no other cloud provider dependencies for the graph engine itself.

### Entity Extraction Pass (per build)

- **Model:** entity extraction model (`gpt-4o-mini` in `settings.yml`)
- **Chunk size:** 1200 tokens; overlap 100 tokens
- **Max tokens per extraction call:** 4000 (`entity_extraction.llm.max_tokens`)
- **Gleaning passes:** 1 additional pass per chunk (`max_gleanings: 1`)
- **Effect:** token cost scales linearly with total document volume. A full build over `docs/central-intelligence/` (dozens of Markdown files) and `domain-intel.json` (22 domains) will consume roughly 2–3× the raw document token count due to the extraction prompt overhead and the gleaning pass.

### Description Summarisation (per build)

- **Model:** entity extraction model
- **Max tokens:** 500 per summary call (`summarize_descriptions.llm.max_tokens`)
- **Effect:** one call per unique entity description that requires merging. Typically a small fraction of total entities.

### Community Report Generation (per build)

- **Model:** entity extraction model
- **Max tokens:** 2000 per report (`community_reports.llm.max_tokens`)
- **Max input per report:** 8000 tokens (`community_reports.max_input_length`)
- **Effect:** one call per detected community. Community count depends on graph density; typical builds produce dozens of communities.

### Embedding (per build)

- **Model:** graph embedding model (`text-embedding-3-small` in `settings.yml`)
- **Dimensions:** 1536 (set by `EMBED_DIMENSIONS` in `.env`)
- **Vector store:** LanceDB at `graphrag/output/lancedb/`
- **Effect:** one embedding call per entity description and per community report chunk. Embedding is significantly cheaper per token than LLM calls.

### Query Cost

- **Global query:** one LLM call summarising relevant community reports. Token cost is bounded by `community_reports.max_input_length` (8000) per community traversed.
- **Local query:** one LLM call over entity neighbourhood context. Token cost bounded by context size of matched entity neighbourhood.
- **Per-query timeout:** 60 seconds (`QUERY_TIMEOUT_MS = 60_000` in `GraphQueryEngine.mjs`).

### LLM Response Cache

The graph engine writes responses to `graphrag/cache/` (configured as `cache.type: file` in `settings.yml`). Subsequent builds that encounter unchanged chunks and entities will hit the cache, substantially reducing cost on incremental rebuilds.

---

## 10. Operations

### Build the Index

```sh
# Install Python dependencies first (one-time)
pip3 install -r tools/central-intelligence/graph-engine/graphrag/requirements.txt

# Full build: architecture docs + domain intel + knowledge crawls
cd tools/central-intelligence
node graph-engine/GraphBuilder.mjs

# Or via package.json script
pnpm --filter @letbuyy/central-intelligence run graph:build
```

`buildFull()` is the default mode when `GraphBuilder.mjs` is invoked directly. To trigger a specific source subset:

```js
import builder from './graph-engine/GraphBuilder.mjs';
builder.buildFromLCIS();     // docs/central-intelligence/ + domain-intel.json only
builder.buildFromKnowledge(); // graphify-out/knowledge-crawls/ only
```

The `domain-intel.json` file must exist before calling `buildFromLCIS()` or `buildFull()`. Generate it with:

```sh
pnpm graph:domain   # runs from repo root; output at graphify-out/domain-intel.json
```

### Check Index Freshness

```sh
curl http://localhost:3334/intelligence/graph/health
```

Response `status` is one of:
- `HEALTHY` — index built within the last 24 hours
- `STALE` — index older than 24 hours; rebuild recommended
- `NOT BUILT` — no artifacts directory or it is empty

Programmatically:

```js
import indexer from './graph-engine/GraphIndexer.mjs';
indexer.isIndexFresh(24 * 60 * 60 * 1000); // true if fresh
```

### Run Self-Test

```sh
curl http://localhost:3334/intelligence/graph/health
# For full dependency check, invoke GraphDiagnostics directly:
node -e "import('./tools/central-intelligence/graph-engine/GraphDiagnostics.mjs').then(m => m.default.runSelfTest()).then(r => console.log(JSON.stringify(r, null, 2)))"
```

`runSelfTest()` checks six conditions and returns `{ passed: boolean, checks: [{name, passed, detail}] }`:

| Check | What it verifies |
|-------|-----------------|
| `python3 available` | `python3 --version` exits 0 |
| `graphrag importable` | `python3 -c "import graphrag"` exits 0 |
| `OPENAI_API_KEY set` | `process.env.OPENAI_API_KEY` is non-empty |
| `settings.yml present` | `graph-engine/graphrag/settings.yml` exists |
| `input directory populated` | `graphrag/input/` exists and has at least one file |
| `index artifacts present` | `graphrag/output/artifacts/` exists and is non-empty |

### Clean and Rebuild

```sh
# Via API (GraphBuilder.clean() + rebuild)
node -e "
import('./tools/central-intelligence/graph-engine/GraphBuilder.mjs')
  .then(m => { m.default.clean(); return m.default.buildFull(); })
  .then(r => console.log(r));
"
```

`clean()` removes both `graphrag/input/` and `graphrag/output/` (LanceDB, artifacts, and the entity Parquet files). Call `buildFull()` immediately after to regenerate everything from source.

### Required Python Dependencies

From `tools/central-intelligence/graph-engine/graphrag/requirements.txt`:

| Package | Minimum Version | Purpose |
|---------|----------------|---------|
| `graphrag` | `>=0.3.6` | Graph knowledge indexing and querying engine |
| `lancedb` | `>=0.6.0` | Local vector store for entity and community embeddings |
| `pyarrow` | `>=14.0.0` | Parquet file read/write for entity and community artifacts |
| `pandas` | `>=2.0.0` | Data manipulation during index pipeline stages |

Install all at once:

```sh
pip3 install -r tools/central-intelligence/graph-engine/graphrag/requirements.txt
```

---

## 11. Environment Variables

Copy `tools/central-intelligence/.env.example` to `tools/central-intelligence/.env` and fill in the required values. Never commit `.env`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | **Yes** | — | API key used for entity extraction, community report generation, description summarisation, and embedding. Consumed by `graphrag/settings.yml` via `${OPENAI_API_KEY}`. |
| `LCIS_V2_PORT` | No | `3334` | Port the LCIS V2 Intelligence API server (`server.mjs`) binds to. |
| `LCIS_V1_URL` | No | `http://localhost:3333` | Base URL of the LCIS V1 graph server (`tools/graph-server/`). V2 proxies V1 status queries via `fetchV1()`. |
| `EMBED_MODEL` | No | `text-embedding-3-small` | Embedding model name sent to the OpenAI Embeddings API. Must match `settings.yml`. |
| `EMBED_DIMENSIONS` | No | `1536` | Vector dimension count. Must match the chosen embedding model. |
| `QDRANT_URL` | No | `http://localhost:6333` | URL of the Qdrant instance used by the memory engine (not the graph engine). |
| `QDRANT_API_KEY` | No | — | API key for Qdrant when authentication is enabled. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4318` | OTLP HTTP endpoint for traces, metrics, and logs (SigNoz or compatible collector). |
| `OTEL_SERVICE_NAME` | No | `lcis-intelligence` | Service name reported in every span and metric. |
| `OTEL_ENVIRONMENT` | No | `development` | Environment tag attached to every resource span. |
| `PLAYWRIGHT_HEADLESS` | No | `true` | Run browsers in headless mode for the browser intelligence engine. |
| `BROWSER_INTELLIGENCE_TIMEOUT` | No | `30000` | Per-page navigation timeout in milliseconds for the browser intelligence engine. |
| `INCIDENT_ERROR_RATE_THRESHOLD` | No | `0.05` | Fraction of requests with errors that triggers an incident signal. |
| `INCIDENT_SLOW_QUERY_MS` | No | `5000` | Database query duration (ms) above which a slow-query event fires. |
| `ANOMALY_SIGMA_THRESHOLD` | No | `3.0` | Standard deviations above rolling baseline that flags an anomaly. |

> The graph engine uses only `OPENAI_API_KEY` directly. The path to `settings.yml` is `tools/central-intelligence/graph-engine/graphrag/settings.yml`; operators can edit that file to adjust model parameters, chunk sizes, or vector store configuration.

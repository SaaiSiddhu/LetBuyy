# LCIS V2 — Memory System

> **Part of the LetBuyy Central Intelligence System (LCIS V2)**
> Source: `tools/central-intelligence/memory-engine/`
> API server: `tools/central-intelligence/intelligence-api/server.mjs` (port **3334**)
> Companion system: LCIS V1 graph server (`tools/graph-server/`, port **3333**) — unchanged

---

## 1. Overview

The LCIS Memory Engine is a semantic, vector-backed knowledge store layered on top of the LCIS V2 intelligence platform. Where the LCIS V1 graph server (port 3333) answers structural questions from a pre-computed code graph, the Memory Engine answers _contextual_ questions by embedding and indexing the platform's own documentation, governance rules, operational runbooks, incident records, and security policies — then retrieving the most semantically relevant chunks for any query at inference time.

The engine exists because the platform's knowledge lives in Markdown prose scattered across `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, runbooks under `docs/`, and security policies under `infrastructure/`. Grepping or regex-matching this corpus at query time is fragile and context-blind. The Memory Engine ingests all of it once, assigns each text chunk a 1536-dimensional embedding, and stores the results in a purpose-built vector store organised into eight domain collections. A subsequent query for "what is the escalation path for a payment failure?" is resolved by embedding the question and performing a cosine-similarity search — without scanning a single file.

Within LCIS V2, the Memory Engine is consumed by higher-level services such as `MemoryRetriever` (which constructs context windows for the reasoning and correlation engines), the four memory-oriented HTTP endpoints in `intelligence-api/server.mjs`, and any agent in `tools/central-intelligence/agents/` that needs grounded, document-backed answers. The engine is designed to be fail-open: if the embedding API key is absent, every call logs `NOT CONNECTED` and returns an empty result set rather than throwing, so the rest of the LCIS V2 platform continues to operate without memory capabilities until credentials are supplied.

---

## 2. Architecture

### Ingestion path

```mermaid
flowchart LR
    subgraph Sources
        A[AGENTS.md\nCLAUDE.md\nLETBUYY_CONSTITUTION.md]
        B[docs/governance/\ndocs/central-intelligence/]
        C[infrastructure/security/\ninfrastructure/observability/]
        D[docs/lcis-v2/]
        E[URL / raw text\n(ad-hoc ingest)]
    end

    subgraph MemoryIndexer
        F[indexGovernanceDocs\nindexRunbooks\nindexSecurityDocs\nindexCentralIntelligence\nindexLcisV2Docs]
    end

    subgraph MemoryIngestionPipeline
        G[run / runFromUrl / runFromText]
        H[chunkText\n~1000 chars, 100 overlap]
        I[makePointId\nSHA-256 hash for idempotency]
    end

    subgraph EmbeddingAPI
        J[embed\ntext-embedding-3-small\n1536 dims\ntruncate at 8191 chars]
    end

    subgraph VectorStore["Vector Store (8 collections)"]
        K[(architecture)]
        L[(runbooks)]
        M[(incidents)]
        N[(security)]
        O[(deployments)]
        P[(knowledge)]
        Q[(merchants)]
        R[(themes)]
    end

    A --> F
    B --> F
    C --> F
    D --> F
    E --> G
    F --> G
    G --> H --> I --> J --> VectorStore

    style VectorStore fill:#1e1e2e,stroke:#7f7fff,color:#cdd6f4
```

### Query / retrieval path

```mermaid
flowchart LR
    subgraph Input
        Z[Natural-language query]
    end

    subgraph MemoryRetriever
        AA[retrieve / retrieveForContext\nretrieveIncidents\nretrieveRunbook\nretrieveSecurityContext]
        BB[Fan-out: Promise.allSettled\nacross N collections]
        CC[Deduplicate by id\nhighest score wins]
        DD[Sort desc by score\nslice to limit]
    end

    subgraph EmbeddingAPI
        EE[embed\nquery → 1536-dim vector]
    end

    subgraph VectorStore["Vector Store — cosine search"]
        FF[(selected collections)]
    end

    subgraph Output
        GG[Ranked hits\n{id, score, payload, collection}]
        HH[Context window\nCHARS_PER_TOKEN=4]
    end

    Z --> EE --> BB
    BB --> FF --> CC --> DD --> GG
    DD --> HH

    style VectorStore fill:#1e1e2e,stroke:#7f7fff,color:#cdd6f4
```

---

## 3. Collections Reference

All eight collections share the same vector configuration: **1536 dimensions, cosine distance**.

| Name | Purpose | Primary Sources | `minScore` default |
|---|---|---|---|
| `architecture` | Governance docs, constitution, agent rules, CLAUDE.md, architectural decisions, LCIS V2 docs | `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, `docs/central-intelligence/`, `docs/lcis-v2/` | 0.3 |
| `runbooks` | Operational runbooks, incident response procedures, recovery playbooks, escalation documentation | `docs/governance/`, `docs/central-intelligence/` | 0.3 |
| `incidents` | Historical incident records, post-mortems, root cause analyses, timeline reconstructions | Ad-hoc ingest via `runFromText` / `runFromUrl` | 0.2 (via `retrieveIncidents`) |
| `security` | Security policies, RLS definitions, OAuth flows, webhook signing, vulnerability docs | `infrastructure/security/`, `infrastructure/observability/` | 0.25 (via `retrieveSecurityContext`) |
| `deployments` | Deployment manifests, CI/CD pipeline documentation, environment configurations, release procedures | Ad-hoc ingest | 0.3 |
| `knowledge` | General platform knowledge, API documentation, data models, integration guides | Ad-hoc ingest; self-test sentinel collection | 0.3 |
| `merchants` | Merchant onboarding flows, control plane docs, store configuration guides | Ad-hoc ingest | 0.3 |
| `themes` | Theme engine docs, Liquid template specs, preset configurations, Urban Kicks theme data | Ad-hoc ingest | 0.3 |

Collection definitions are declared in `tools/central-intelligence/memory-engine/collections/schema.json` and read at startup by `MemoryService.init()`.

---

## 4. Data Model

Each stored point has a text body and a structured payload. The fields below are set by `MemoryIndexer.indexDocument` and `MemoryIngestionPipeline.runFromText`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique point identifier. For repository documents: `base64url(relativePath + ':' + chunkIndex).slice(0, 36)`. For ad-hoc text: `SHA-256(sourceKey + '\x00' + content).slice(0, 32)`. |
| `text` | `string` | The raw chunk content (up to ~1000 characters). Stored in the vector store payload and returned in search results. |
| `source` | `string` | Relative file path from repo root (e.g. `AGENTS.md`, `docs/central-intelligence/ONBOARDING.md`) or the URL / inline key supplied to `runFromUrl` / `runFromText`. |
| `type` | `string` | `"markdown"` for repository files indexed by `MemoryIndexer`; `"text"` for ad-hoc ingestion via `MemoryIngestionPipeline`. |
| `domain` | `string` | The collection name the chunk was ingested into (e.g. `"architecture"`, `"runbooks"`). |
| `timestamp` | `number` | Unix epoch milliseconds at ingest time (`Date.now()`). Used by `MemoryHealthMonitor.checkStaleness`. |
| `chunkIndex` | `number` | Zero-based index of this chunk within its source document. |
| `totalChunks` | `number` | Total number of chunks the source document was split into. |
| `filename` | `string` | `basename` of the source file (e.g. `"AGENTS.md"`). Set only by `MemoryIndexer.indexDocument`. |
| `docType` | `string` (extra metadata) | Optional classifier set by indexer methods: `"constitution"`, `"agents-rulebook"`, `"claude-context"`, `"runbook"`, `"security"`, `"central-intelligence"`, `"lcis-v2"`. |

Additional arbitrary key-value pairs can be passed as `extraMetadata` to `MemoryIndexer.indexDocument` or as `metadata` to `MemoryIngestionPipeline.runFromText`; they are merged into the payload alongside the standard fields above.

---

## 5. Embedding Strategy

**Model**: The LCIS Memory Engine calls the OpenAI Embeddings API using the model configured in `EMBED_MODEL` (default: `text-embedding-3-small`). The model is not hardcoded in user-facing behaviour — operators can substitute any compatible model by setting the environment variable.

**Dimensions**: Every collection is configured at **1536 dimensions** (`VECTOR_SIZE = 1536`, set in `MemoryService.mjs`). The `dimensions` parameter is passed explicitly in each embedding request so the model produces exactly 1536 floats regardless of its native output size.

**Batch size**: Batch ingestion is processed in chunks of **100 documents at a time** (`EMBED_BATCH_SIZE = 100`). Each document is embedded individually (one API call per document within the batch loop). The batch boundary prevents a single large corpus from producing an unbounded sequence of concurrent requests.

**Token ceiling guard**: Before every embedding call, `MemoryService.embed` truncates the input text to **8191 characters**: `text.slice(0, 8191)`. This is a hard guard applied at the embedding layer, independent of the chunking strategy applied by `MemoryIndexer` and `MemoryIngestionPipeline` (which target ~1000 characters per chunk). The two limits never conflict in practice, but the guard ensures no single request can exceed the embedding API's maximum context.

**NOT CONNECTED behaviour**: If `OPENAI_API_KEY` is absent from the environment, `MemoryService.embed` returns `null` and emits a warning: `[MemoryService] embed: OPENAI_API_KEY NOT CONNECTED — embeddings disabled`. Callers (`ingest`, `ingestBatch`, `search`) detect `null` and either skip the document (with a `skipped` counter increment) or return an empty result array. The LCIS V2 platform continues running; collection health is reported as `DOWN` by `MemoryHealthMonitor.getHealth` only if the vector store itself is unreachable — a missing API key degrades search results silently rather than stopping the server.

---

## 6. Ingestion Pipeline

### Chunking

Both `MemoryIndexer` (`tools/central-intelligence/memory-engine/MemoryIndexer.mjs`) and `MemoryIngestionPipeline` (`tools/central-intelligence/memory-engine/MemoryIngestionPipeline.mjs`) apply the same paragraph-aware chunking algorithm:

- **`CHUNK_MAX_CHARS = 1000`** — target maximum characters per chunk.
- **`CHUNK_OVERLAP_CHARS = 100`** — characters carried over from the tail of the previous chunk to maintain contextual continuity at boundaries.
- The text is first split on blank lines (`/\n\s*\n/`). Paragraphs shorter than `CHUNK_MAX_CHARS` are accumulated into the current chunk; when adding a new paragraph would exceed the limit, the current chunk is flushed, and the last 100 characters are prepended to the next chunk. Paragraphs that are themselves longer than 1000 characters are hard-split by `splitBySize`. Chunks shorter than 20 characters are discarded.

### Idempotency

Point IDs are **deterministic** so that re-running the pipeline never produces duplicates.

- **Repository documents** (`MemoryIndexer.indexDocument`): `id = base64url(relativePath + ':' + chunkIndex).slice(0, 36)`. The path and chunk index together uniquely identify every chunk of every file.
- **Ad-hoc text / URL ingest** (`MemoryIngestionPipeline.runFromText`): `id = createHash('sha256').update(sourceKey + '\x00' + content).digest('hex').slice(0, 32)`. The SHA-256 is over the source identifier concatenated with the raw chunk content, so identical content from the same source always produces the same ID. The vector store uses `upsert` (`wait: true`) semantics — a point with a matching ID is overwritten in place.

### File discovery

`MemoryIndexer` uses `collectMarkdownFiles(dir)`, which recursively walks a directory and returns all `.md` files. The five indexer methods target:

| Method | Directory | Collection |
|---|---|---|
| `indexGovernanceDocs` | `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, `CLAUDE.md` | `architecture` |
| `indexRunbooks` | `docs/governance/`, `docs/central-intelligence/` | `runbooks` |
| `indexSecurityDocs` | `infrastructure/security/`, `infrastructure/observability/` | `security` |
| `indexCentralIntelligence` | `docs/central-intelligence/` | `architecture` |
| `indexLcisV2Docs` | `docs/lcis-v2/` | `architecture` |

All five run in parallel via `Promise.all` when `indexAll()` is called.

### State persistence

After every `run`, `runFromUrl`, or `runFromText` call, `MemoryIngestionPipeline` writes a JSON state file to:

```
graphify-out/memory-pipeline-state.json
```

The state file records:

```json
{
  "lastRun": "2026-06-19T12:00:00.000Z",
  "documentsIngested": 1248,
  "failedDocuments": 0,
  "collectionCounts": {
    "architecture": 420,
    "runbooks": 180,
    "security": 95,
    "incidents": 12,
    "deployments": 0,
    "knowledge": 310,
    "merchants": 0,
    "themes": 231
  },
  "runs": [
    {
      "at": "2026-06-19T12:00:00.000Z",
      "source": "repository",
      "collection": "all",
      "ingested": 1248,
      "failed": 0
    }
  ]
}
```

`graphify-out/` is listed in `.gitignore`; the state file is never committed. `loadState()` handles a missing or corrupt file by returning a blank initial state, so the file can be safely deleted to force a full re-index.

---

## 7. Search and Retrieval

### Fan-out and deduplication

`MemoryRetriever.retrieve` (in `tools/central-intelligence/memory-engine/MemoryRetriever.mjs`) is the primary retrieval entry point. It:

1. Calculates `perCollection = max(1, ceil(limit / collections.length))` to distribute the result budget across collections.
2. Fires one `MemoryService.search` call per collection concurrently via `Promise.allSettled`. Failed collection searches are logged and skipped without aborting the overall query.
3. Merges all hits into a flat list. If the same point ID appears in results from multiple collections, **only the hit with the highest score is kept** (`Map<id, hit>` deduplication).
4. Sorts all deduplicated hits by `score` descending and slices to `limit`.

Default parameters: `limit = 10`, `minScore = 0.3` (`DEFAULT_MIN_SCORE`).

### Context window assembly

`MemoryRetriever.retrieveForContext(query, maxTokens = 2000)` builds a context string suitable for insertion into an LLM prompt:

- Runs `retrieve` with `limit = 20` and `minScore = 0.3`.
- Converts the token budget to a character budget: `maxChars = maxTokens * CHARS_PER_TOKEN` where `CHARS_PER_TOKEN = 4`.
- Concatenates each hit's `payload.text`, prefixed with `[Source: <source>]\n`, until the character budget is exhausted. Partial chunks are allowed — the last included chunk may be truncated.
- Returns `{ sources, context, totalChunks, relevanceScore }` where `relevanceScore` is the mean cosine score of all included hits.

### Specialised retrieval methods

| Method | Query template | Collections | `minScore` | `limit` |
|---|---|---|---|---|
| `retrieveIncidents(domain)` | `"${domain} incident failure error outage"` | `['incidents', 'runbooks']` | 0.2 | 5 |
| `retrieveRunbook(domain)` | `"${domain} runbook recovery procedure escalation"` | `['runbooks']` | 0.25 | 3 |
| `retrieveSecurityContext(component)` | `"${component} security authentication authorization RLS JWT webhook"` | `['security', 'architecture']` | 0.25 | 8 |
| `findSimilar(documentId, collection)` | re-embeds the stored chunk text | single collection | 0.2 | 10 (excluding source) |

---

## 8. Services Reference

Five modules make up the Memory Engine. Each is a default-exported singleton.

| Module | File | Key Methods |
|---|---|---|
| **MemoryService** | `memory-engine/MemoryService.mjs` | `init()`, `embed(text)`, `search(query, {collection, limit?, filter?, minScore?})`, `ingest(document, collection)`, `ingestBatch(documents, collection)`, `delete(id, collection)`, `getHealth()`, `getCollectionStats()`, `get collectionNames` |
| **MemoryIndexer** | `memory-engine/MemoryIndexer.mjs` | `indexDocument(filePath, collection, extraMetadata?)`, `indexGovernanceDocs()`, `indexRunbooks()`, `indexSecurityDocs()`, `indexCentralIntelligence()`, `indexLcisV2Docs()`, `indexAll()` |
| **MemoryIngestionPipeline** | `memory-engine/MemoryIngestionPipeline.mjs` | `run(source?)`, `runFromUrl(url, collection, metadata?)`, `runFromText(text, collection, metadata?)`, `verify(collection)`, `getStatus()` |
| **MemoryRetriever** | `memory-engine/MemoryRetriever.mjs` | `retrieve(query, {collections?, limit?, minScore?, filter?})`, `retrieveForContext(query, maxTokens?)`, `retrieveIncidents(domain, {limit?})`, `retrieveRunbook(domain)`, `retrieveSecurityContext(component)`, `findSimilar(documentId, collection)` |
| **MemoryHealthMonitor** | `memory-engine/MemoryHealthMonitor.mjs` | `getHealth()`, `getDiagnostics()`, `runSelfTest()`, `getMetrics()`, `checkStaleness(collection, maxAgeMs?)` |

### Method signatures

```js
// MemoryService
async init(): Promise<void>
async embed(text: string): Promise<number[] | null>
async search(query: string, { collection: string, limit?: number, filter?: Record<string,unknown>, minScore?: number }): Promise<Array<{id: string, score: number, payload: Record<string,unknown>}>>
async ingest(document: {id: string, text: string, payload?: Record<string,unknown>}, collection: string): Promise<void>
async ingestBatch(documents: Array<{id: string, text: string, payload?: Record<string,unknown>}>, collection: string): Promise<{ingested: number, skipped: number}>
async delete(id: string, collection: string): Promise<void>
async getHealth(): Promise<{qdrant: 'CONNECTED'|'NOT CONNECTED', collections: string[], latencyMs: number}>
async getCollectionStats(): Promise<Record<string, {pointsCount: number, vectorSize: number, status: string}>>
get collectionNames: string[]

// MemoryIndexer
async indexDocument(filePath: string, collection: string, extraMetadata?: Record<string,unknown>): Promise<number>
async indexGovernanceDocs(): Promise<number>
async indexRunbooks(): Promise<number>
async indexSecurityDocs(): Promise<number>
async indexCentralIntelligence(): Promise<number>
async indexLcisV2Docs(): Promise<number>
async indexAll(): Promise<{governance: number, runbooks: number, security: number, centralIntelligence: number, lcisV2: number, total: number}>

// MemoryIngestionPipeline
async run(source?: string): Promise<{ingested: number, failed: number, collectionCounts: Record<string,number>}>
async runFromUrl(url: string, collection: string, metadata?: Record<string,unknown>): Promise<{ingested: number, failed: number}>
async runFromText(text: string, collection: string, metadata?: Record<string,unknown>): Promise<{ingested: number, failed: number}>
async verify(collection: string): Promise<{collection: string, pointsCount: number, ok: boolean}>
getStatus(): {lastRun: string|null, documentsIngested: number, failedDocuments: number, collectionCounts: Record<string,number>}

// MemoryRetriever
async retrieve(query: string, options?: {collections?: string[], limit?: number, minScore?: number, filter?: Record<string,unknown>}): Promise<Array<{id: string, score: number, payload: Record<string,unknown>, collection: string}>>
async retrieveForContext(query: string, maxTokens?: number): Promise<{sources: Array<{id: string, collection: string, score: number, source: string}>, context: string, totalChunks: number, relevanceScore: number}>
async retrieveIncidents(domain: string, options?: {limit?: number}): Promise<Array<{id: string, score: number, payload: Record<string,unknown>, collection: string}>>
async retrieveRunbook(domain: string): Promise<{content: string, source: string, score: number} | null>
async retrieveSecurityContext(component: string): Promise<{hits: Array<{id: string, score: number, payload: Record<string,unknown>, collection: string}>, summary: string}>
async findSimilar(documentId: string, collection: string): Promise<Array<{id: string, score: number, payload: Record<string,unknown>, collection: string}>>

// MemoryHealthMonitor
async getHealth(): Promise<{status: 'HEALTHY'|'DEGRADED'|'DOWN', qdrant: 'CONNECTED'|'NOT CONNECTED', collections: string[], latencyMs: number, lastCheck: string}>
async getDiagnostics(): Promise<{health: HealthResult, collectionStats: Record<string,{pointsCount: number, vectorSize: number, status: string}>, openaiConnected: boolean, embedModel: string}>
async runSelfTest(): Promise<'PASS'|'FAIL'>
async getMetrics(): Promise<{totalDocuments: number, collectionsCount: number, avgSearchLatencyMs: number}>
async checkStaleness(collection: string, maxAgeMs?: number): Promise<{collection: string, stale: boolean, newestTimestamp: number|null, ageMs: number|null}>
```

---

## 9. API Endpoints

All endpoints are served by `tools/central-intelligence/intelligence-api/server.mjs` on port **3334** (configurable via `LCIS_V2_PORT`). The base path `/intelligence/memory/` is reserved for the Memory Engine.

| Method | Path | Query Params / Body | Response |
|---|---|---|---|
| `GET` | `/intelligence/memory/search` | `q` (query string), `collection` (optional — one of the 8 names; omit to search all), `limit` (optional, default 10) | `{query, results: [{id, score, payload, collection}], count}` |
| `POST` | `/intelligence/memory/ingest` | JSON body: `{text: string, collection: string, metadata?: Record<string,unknown>}` | `{ingested: true, result: {ingested: number, failed: number}}` |
| `GET` | `/intelligence/memory/health` | — | `{status: 'HEALTHY'|'DEGRADED'|'DOWN', qdrant: 'CONNECTED'|'NOT CONNECTED', collections: string[], latencyMs: number, lastCheck: string}` |
| `GET` | `/intelligence/memory/stats` | — | `{totalDocuments: number, collectionsCount: number, avgSearchLatencyMs: number}` |

### HTTP status codes

- **200** — success.
- **503** — the requested module (`MemoryRetriever`, `MemoryIngestionPipeline`, or `MemoryHealthMonitor`) failed to load. The response body contains `{error: "<module> unavailable"}`.
- **500** — unhandled exception in the handler; response contains `{error: message}`.

### CORS

Requests from `http://localhost:3000`, `http://localhost:3001`, `http://localhost:3333`, and `http://localhost:3334` are accepted without a preflight restriction. Requests from other origins receive the default allowed origin header set to `http://localhost:3333`.

---

## 10. Security

**No PII stored.** The Memory Engine ingests Markdown documentation files, runbooks, governance documents, and operational procedure text. It does not ingest customer records, merchant PII, order data, payment credentials, or any content from the Supabase database. The `MemoryIndexer` only reads from the repository's `docs/` and `infrastructure/` directories and from three root-level Markdown files (`AGENTS.md`, `CLAUDE.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`).

**API key requirement.** The embedding API key (`OPENAI_API_KEY`) is read from the environment at startup. It is never written to disk, logged, or returned in any API response. The key is required for all ingestion and search operations; its absence is surfaced only as a `NOT CONNECTED` status string in log output and health responses.

**Vector store access control.** The vector store is reached at the URL in `QDRANT_URL` (default: `http://localhost:6333`). When `QDRANT_API_KEY` is set in the environment, it is forwarded as the API key on every client request. In a production deployment, access to port 6333 must be restricted to the LCIS V2 server process — the REST API provides no tenant isolation of its own.

**NOT CONNECTED surfacing.** The platform follows a strict "no fabrication" policy for connectivity status. Every service returns a literal `"NOT CONNECTED"` string when a required external dependency is unavailable, rather than returning stale or synthesised data. Callers can distinguish live results from degraded results by inspecting:

- `MemoryService.getHealth()` → `{qdrant: 'NOT CONNECTED'}`
- `MemoryHealthMonitor.getHealth()` → `{status: 'DOWN', qdrant: 'NOT CONNECTED'}`
- `MemoryHealthMonitor.getDiagnostics()` → `{openaiConnected: false}`
- Any search or ingest response returning `{results: [], count: 0}` when `openaiConnected` is false.

**No raw-vector exposure.** `MemoryService.search` returns `{id, score, payload}` triples. The 1536-dimensional embedding vectors are stored internally in the vector store but are never included in API responses.

---

## 11. Operations

### Initial setup

Run the setup script from `tools/central-intelligence/`:

```bash
bash tools/central-intelligence/setup.sh
```

The script: checks Node >= 20 and Python 3, validates that `OPENAI_API_KEY` is set in `.env`, runs `npm install`, optionally starts the vector store container via `docker compose up -d qdrant`, and runs `MemoryIndexer.indexAll()` to perform the initial corpus ingestion. The script is idempotent and safe to re-run.

### Running the vector store

```bash
# Minimal (vector store only)
docker compose -f tools/central-intelligence/docker-compose.yml up -d qdrant

# Full stack (vector store + observability)
docker compose -f tools/central-intelligence/docker-compose.yml up -d
```

The vector store REST API is available at `http://localhost:6333`. Its built-in dashboard is at `http://localhost:6333/dashboard`.

### Starting the LCIS V2 server

```bash
cd tools/central-intelligence
npm start           # production
npm run start:dev   # watch mode (node --watch)
```

The server listens on port **3334** by default.

### Running a full ingestion

```bash
# Via npm script (from tools/central-intelligence/)
npm run memory:init

# Via the API
curl -X POST http://localhost:3334/intelligence/memory/ingest \
  -H 'Content-Type: application/json' \
  -d '{"text": "<your text>", "collection": "knowledge", "metadata": {"source": "manual"}}'
```

The npm script runs `MemoryIndexer.indexAll()` directly, which ingests all five source groups (governance, runbooks, security, central-intelligence, lcis-v2) in parallel. State is written to `graphify-out/memory-pipeline-state.json` on completion.

### Checking pipeline state

```bash
cat graphify-out/memory-pipeline-state.json
```

The `lastRun` ISO timestamp and per-collection `collectionCounts` show when the corpus was last indexed and how many chunks are stored per collection.

### Staleness check

```js
// From Node.js / inside the server:
import monitor from './memory-engine/MemoryHealthMonitor.mjs';

const result = await monitor.checkStaleness('architecture');
// { collection: 'architecture', stale: false, newestTimestamp: 1750000000000, ageMs: 3600000 }
```

`checkStaleness` considers a collection stale if its newest document `timestamp` is older than `maxAgeMs` (default: **24 hours** / `86_400_000 ms`). An empty collection always returns `stale: true`.

### Self-test

```bash
# Via npm script
npm run memory:health

# Via the API
curl http://localhost:3334/intelligence/memory/health
```

`MemoryHealthMonitor.runSelfTest()` inserts a 1536-dimension sentinel vector directly into the `knowledge` collection (bypassing the embedding API so the test does not require `OPENAI_API_KEY`), searches for it, deletes it, and verifies deletion. It returns `'PASS'` or `'FAIL'`. The health endpoint at `GET /intelligence/memory/health` surfaces the overall status (`HEALTHY`, `DEGRADED`, or `DOWN`) and the vector store connection state.

**HEALTHY** = latency < 2000 ms and all 8 collections exist.
**DEGRADED** = latency >= 2000 ms or fewer than 8 collections present.
**DOWN** = vector store not reachable (`NOT CONNECTED`).

### Refreshing after documentation changes

Re-run `npm run memory:init` (or call `MemoryIngestionPipeline.run()`) after adding or modifying files under `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE_REWRITE_2026_06_10/`, `docs/central-intelligence/`, `docs/governance/`, `docs/lcis-v2/`, `infrastructure/security/`, or `infrastructure/observability/`. Because point IDs are deterministic, unchanged chunks are overwritten with identical content and modified chunks are replaced in place.

---

## 12. Environment Variables

All variables are read from the environment at startup. Copy `tools/central-intelligence/.env.example` to `tools/central-intelligence/.env` and fill in the required values. Never commit `.env`.

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | — | **Yes** | API key for the embedding API. Absence disables all ingestion and search; every call logs `NOT CONNECTED`. |
| `QDRANT_URL` | `http://localhost:6333` | No | URL of the vector store instance. Change to a remote or cloud-hosted address in staging/production. |
| `QDRANT_API_KEY` | _(empty)_ | No | API key forwarded to the vector store when `QDRANT__SERVICE__API_KEY` is configured on the server. Leave empty for an unauthenticated local instance. |
| `EMBED_MODEL` | `text-embedding-3-small` | No | Embedding model identifier sent to the embedding API. Must produce 1536-dimensional outputs to match the collection `vectorSize`. |
| `EMBED_DIMENSIONS` | `1536` | No | Declared in `.env.example` for documentation; the in-code constant `VECTOR_SIZE = 1536` in `MemoryService.mjs` takes precedence. Adjust both together if switching models. |
| `LCIS_V2_PORT` | `3334` | No | TCP port the LCIS V2 API server binds to. |
| `LCIS_V1_URL` | `http://localhost:3333` | No | Base URL of the LCIS V1 graph server (`tools/graph-server/`). Used by the V2 server to proxy V1 endpoints and include V1 stats in `/intelligence/status`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | No | OTLP HTTP endpoint for OpenTelemetry traces, metrics, and logs. Targets the SigNoz collector in the Docker Compose stack. |
| `OTEL_SERVICE_NAME` | `lcis-intelligence` | No | Service name reported on every OpenTelemetry span and metric. |
| `OTEL_ENVIRONMENT` | `development` | No | Environment tag attached to every resource span. |
| `PLAYWRIGHT_HEADLESS` | `true` | No | Run browser automation in headless mode. Set to `false` for visual debugging during development. |
| `BROWSER_INTELLIGENCE_TIMEOUT` | `30000` | No | Per-page navigation timeout in milliseconds for the Browser Intelligence subsystem. |
| `INCIDENT_ERROR_RATE_THRESHOLD` | `0.05` | No | Fraction of requests with errors that triggers an incident signal in the Observability subsystem. |
| `INCIDENT_SLOW_QUERY_MS` | `5000` | No | Database query duration (ms) above which a slow-query event fires. |
| `ANOMALY_SIGMA_THRESHOLD` | `3.0` | No | Standard deviations above the rolling baseline required to flag an anomaly. |

---

## 13. Troubleshooting

### Vector store NOT CONNECTED

**Symptom**: `GET /intelligence/memory/health` returns `{"status":"DOWN","qdrant":"NOT CONNECTED"}`. All search calls return empty arrays; all ingestion calls skip every document.

**Cause**: The vector store process is not running, or `QDRANT_URL` points to the wrong address.

**Fix**:
```bash
# Confirm the container is up
docker compose -f tools/central-intelligence/docker-compose.yml ps qdrant

# Start it if stopped
docker compose -f tools/central-intelligence/docker-compose.yml up -d qdrant

# Verify the health endpoint directly
curl http://localhost:6333/healthz

# If using a remote instance, confirm QDRANT_URL is set correctly
echo $QDRANT_URL
```

If `QDRANT_API_KEY` is set on the server side (`QDRANT__SERVICE__API_KEY`), ensure the same value is in `QDRANT_API_KEY` in the LCIS V2 `.env`.

---

### Embedding API NOT CONNECTED

**Symptom**: Ingestion completes with `skipped: N` for every document. Search returns empty results. Logs contain `[MemoryService] embed: OPENAI_API_KEY NOT CONNECTED — embeddings disabled`. `getDiagnostics()` returns `{"openaiConnected": false}`.

**Cause**: `OPENAI_API_KEY` is not set in the environment.

**Fix**:
```bash
# Check the value is present
echo $OPENAI_API_KEY

# If sourcing from .env
cat tools/central-intelligence/.env | grep OPENAI_API_KEY

# Re-run setup after adding the key
bash tools/central-intelligence/setup.sh
```

---

### Stale collections

**Symptom**: Search returns outdated or missing results. `checkStaleness` reports `{stale: true, ageMs: > 86400000}`. The `lastRun` in `graphify-out/memory-pipeline-state.json` is more than 24 hours old.

**Cause**: Documentation files have been updated but the corpus has not been re-ingested.

**Fix**:
```bash
cd tools/central-intelligence
npm run memory:init
```

This calls `MemoryIndexer.indexAll()`, which re-ingests all five source groups. Unchanged chunks are overwritten with identical content (idempotent); only modified or new chunks produce new embeddings. After completion, re-check the state file:
```bash
cat graphify-out/memory-pipeline-state.json | jq '.lastRun, .collectionCounts'
```

---

### Low relevance scores / poor search results

**Symptom**: Searches return results with scores below 0.3, or the most relevant context is not appearing at the top. `retrieveForContext` returns a low `relevanceScore`.

**Causes and fixes**:

1. **Collection not indexed.** Check `collectionCounts` in `graphify-out/memory-pipeline-state.json`. A count of `0` for a collection means it has no content. Run `npm run memory:init` or POST directly to `/intelligence/memory/ingest` with appropriate content.

2. **Wrong collection targeted.** If you call `retrieve` with `collections: ['runbooks']` but the content is in `security`, the query will miss it. Omit the `collections` parameter to fan out across all eight collections (the default behaviour).

3. **minScore too high.** The default `minScore = 0.3` is appropriate for general queries. For incident or runbook retrieval where you want broader recall, use `retrieveIncidents` (which applies `minScore = 0.2`) or `retrieveRunbook` (which applies `minScore = 0.25`). For direct API calls, pass `limit` without a `minScore` override and inspect the raw scores returned to calibrate.

4. **Chunk granularity mismatch.** Queries over very specific technical terms (e.g. an RPC function name) may not match well against ~1000-character prose chunks. Consider also querying the LCIS V1 graph server at port 3333 (`/api/search?q=`) for symbol-level lookups, and reserve the Memory Engine for conceptual and procedural questions.

5. **Stale embeddings after a model change.** If `EMBED_MODEL` is changed, existing vectors were produced by the previous model and are not comparable to new query vectors. Delete all collections from the vector store and run `npm run memory:init` to rebuild the full corpus with the new model.

---

### Self-test FAIL

**Symptom**: `MemoryHealthMonitor.runSelfTest()` returns `'FAIL'`.

**Cause**: The self-test inserts a sentinel vector directly into the `knowledge` collection (bypassing the embedding API), searches for it by vector, and then deletes it. A `FAIL` means one of these three operations did not behave as expected.

**Fix**:
```bash
# Check vector store health first
curl http://localhost:6333/healthz

# Check if the 'knowledge' collection exists
curl http://localhost:6333/collections/knowledge

# If missing, run init to recreate all 8 collections
node -e "import('./memory-engine/MemoryService.mjs').then(m => m.init())"

# Then re-run the self-test via the health endpoint
curl http://localhost:3334/intelligence/memory/health
```

A persistent `FAIL` after confirming vector store connectivity usually indicates a version mismatch between the `@qdrant/js-client-rest` package and the running vector store image. Check `tools/central-intelligence/package.json` for the declared client version and compare it to the image tag in `docker-compose.yml`.

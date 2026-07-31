# MemoryService — Consolidation Spec
**Phase 6 · LCIS Consolidation Program · 2026-06-20**
**Target:** `packages/lcis-core/src/memory/`
**Hard constraint:** Zero external deps. No Qdrant, no embeddings, no OpenAI, no GraphRAG, no vector DBs.

---

## 1. Canonical API

```typescript
// packages/lcis-core/src/memory/MemoryService.ts

export interface MemoryHit {
  id: string;           // "D-001" for decisions, "DOC-<hash>" for corpus docs
  score: number;        // BM25 score (descending)
  type: 'decision' | 'governance' | 'architecture' | 'runbook' | 'migration';
  subtype?: string;     // payment | security | refund | payout | theme | storefront | migration
  source: string;       // relative file path
  section: string;      // heading context (≤90 chars)
  text: string;         // matched passage (≤320 chars)
  rule?: string;        // imperative rule text if decision
}

export interface Citation {
  id: string;
  source: string;
  section: string;
  text: string;
  confidence: 'high' | 'medium' | 'low'; // high = score > 8, medium = 4–8, low < 4
}

export interface ContextPack {
  query: string;
  tokenBudget: number;
  tokensUsed: number;
  hits: MemoryHit[];
  citations: Citation[];
  stale: boolean;       // true when corpus migration version < current latestMigration.n
  builtAtMigration: number;
  schemaHash: string;   // sha256 of memory-intel.json at build time, first 12 chars
}

export interface Decision {
  id: string;           // "D-001"
  type: string;
  subtype?: string;
  source: string;
  section: string;
  rule: string;
  alternatives?: string[];  // from governance/decisions/*.json if promoted
  rejectedAt?: string;       // ISO date if an ADR rejection record exists
  lastConfirmedMigration?: number;
}

export class MemoryService {
  /** BM25-ranked search over the full deterministic corpus. */
  search(query: string, opts?: { limit?: number; type?: string }): MemoryHit[];

  /** Retrieve a single document/decision by id. */
  get(id: string): MemoryHit | Decision | undefined;

  /** Return structured citations for an agent/LLM grounding call. */
  cite(query: string, limit?: number): Citation[];

  /**
   * Build a token-budget-aware context pack for an agent.
   * Selects top BM25 hits, trims to budget, marks freshness.
   */
  buildContext(query: string, tokenBudget: number): ContextPack;

  /** All decisions (full list, typed). */
  decisions(filter?: { type?: string }): Decision[];

  /** Single decision by stable id. */
  decision(id: string): Decision | undefined;
}
```

---

## 2. Deterministic BM25 Algorithm

### 2.1 Tokenizer (zero-dep, in-process)

```
tokenize(text: string): string[]
  → lowercase
  → strip markdown (**, *, #, >, -, backticks)
  → split on /[\s\-_\/\.\,\;\:\!\?\(\)\[\]]+/
  → filter tokens len < 2 or in STOP_WORDS
  → no stemming (deterministic exact-term match)

STOP_WORDS: a, an, the, is, are, was, were, be, been, being,
            have, has, had, do, does, did, will, would, could,
            should, may, might, shall, can, to, of, in, on,
            at, for, with, by, from, or, and, not, this, that,
            it, its, if, via, per, also, only, never, always
```

### 2.2 Inverted Index

Built once at `MemoryService` construction from the pre-processed corpus:

```
InvertedIndex = Map<term, PostingList>
PostingList   = Array<{ docId: string; tf: number; positions: number[] }>

tf(t, d) = count(t in d) / len(d)          // normalized term frequency
idf(t)   = ln((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
             where N = total doc count, df = docs containing term

BM25(q, d) = Σ_t [ idf(t) * (tf_norm) ]
tf_norm    = tf(t,d) * (k1 + 1)
             / (tf(t,d) + k1 * (1 - b + b * |d| / avgdl))

Constants: k1 = 1.5, b = 0.75  (TREC-standard defaults)
```

All state lives in a single `MemoryIndex` object serialized to `graphify-out/memory-index.json` (gitignored, rebuilt by `pnpm graph:memory`).

### 2.3 Document Model

Each corpus file is chunked at **section boundaries** (markdown `#`/`##`/`###` headings). Each chunk becomes one `MemoryDocument`:

```typescript
interface MemoryDocument {
  id: string;         // sha256(source + ':' + section).slice(0,12) → "DOC-<hash>"
  source: string;     // relative file path
  section: string;    // nearest heading above the chunk (≤90 chars)
  text: string;       // raw chunk text (≤1600 chars; overflow goes to next doc)
  tokens: string[];   // tokenize(text) result
  type: string;       // corpus category (see §2.4)
}
```

Decisions from `memory-intel.json` are also loaded as first-class documents with `id = d.id` ("D-001" etc.), keeping them co-indexed with prose chunks.

### 2.4 Corpus Definition (deterministic, file-path pinned)

| Category | Sources |
|---|---|
| `governance` | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md`, `GOVERNANCE_REWRITE_2026_06_10/000_GOVERNANCE_INDEX.md`, `AGENTS.md`, `CLAUDE.md` |
| `architecture` | `docs/architecture/**/*.md` (depth ≤ 2, max 30 files) |
| `governance_detail` | `docs/governance/**/*.md` (depth ≤ 2, max 24 files) |
| `security` | `docs/security/**/*.md` (depth ≤ 2, max 16 files) |
| `runbook` | `docs/central-intelligence/incident-response.md`, any `*runbook*.md` in `docs/` |
| `launch` | `docs/launch-readiness/**/*.md`, `docs/final-v1-certification/**/*.md` (max 12 files) |
| `decisions_json` | Pre-extracted decisions from `graphify-out/memory-intel.json` (180 decisions, 103 migration records at last build) |
| `decisions_promoted` | `governance/decisions/*.json` — structured ADR records (see §3 below; empty at spec time, populated as panel-knowledge R1 is executed) |

**Total corpus at spec time:** ~41 source files → ~600–900 section-chunks after heading-split + the 180 `memory-intel.json` decisions = ~800–1,100 indexed documents. Index fits in memory at < 5 MB.

### 2.5 Index Build Process

```
pnpm graph:memory
  → runs packages/lcis-core/src/memory/build-index.ts (CLI wrapper)
  → reads corpus files + graphify-out/memory-intel.json
  → produces graphify-out/memory-index.json
     { builtAt: ISO, latestMigration: N, schemaHash: string, documents: [...], invertedIndex: {...} }
  → produces graphify-out/memory-v2.json (backward-compat)
```

Build time target: < 3 s on the 800-doc corpus.

---

## 3. Source Consolidation

### What `memory-intel.mjs` provides (PRESERVED → promoted to TypeScript)

| Capability | Status |
|---|---|
| `parseDoc()` — rule extraction via `RULE_RE` | **Preserved**: drives `Decision` corpus ingestion |
| `SUBTYPE` keyword→subtype map | **Preserved**: drives `Decision.subtype` |
| `buildMemoryIntel()` — outputs `decisions[]` + `migrations[]` | **Preserved**: `MemoryService` reads `memory-intel.json` as its decisions corpus |
| `searchDecisions()` — substring filter | **Replaced** by BM25; the substring fallback is retired |
| `whyBuilt()`, `ruleWhy()`, `migrationWhy()`, `decisionsAffecting()` | **Absorbed** into `MemoryService.search()` + `cite()` + `decision()` |

### What `memory-v2.mjs` provides (PRESERVED → promoted)

| Capability | Status |
|---|---|
| Category bucketing (architecture/decision/security/payment/migration) | **Preserved**: exposed as `decisions(filter)` |
| Heading-level sourced categories (incident/launch/audit/ADR/governance) | **Preserved**: these source files are part of the BM25 corpus |
| `answers` object (meta-routing hints) | **Dropped**: replaced by actual BM25 results |

### What is DROPPED (ARCHIVED, not migrated)

- `tools/central-intelligence/memory-engine/` — the Qdrant vector memory engine. **Archived as-is.** Zero of its Qdrant/OpenAI paths are ported. Its 8 collection schemas are not replicated.
- The `:3334` `/intelligence/memory/*` endpoints that called `qdrant.search()`. These routes are removed; traffic routes to the `:3333` `MemoryService` instead.
- All semantic embedding calls (`text-embedding-3-small`, chunk-level vector similarity). Deterministic BM25 replaces them.
- `memory-intel.mjs` and `memory-v2.mjs` as standalone `.mjs` files — their logic is re-implemented in TypeScript in `packages/lcis-core/src/memory/`. The `.mjs` files are kept in `tools/graph-server/` until the graph-server itself is consolidated (a later phase); they are not deleted now.

### What is NEW (no prior implementation)

- BM25 inverted index over prose chunks (the core new capability recommended by panel-ai R1)
- `buildContext()` with token-budget packing (for agent grounding)
- `cite()` with confidence scoring
- `governance/decisions/*.json` store (structured ADRs — empty at spec time; populated by panel-knowledge R1 extraction)
- Staleness detection (`builtAtMigration` vs `latestMigration.n`)

---

## 4. Inputs and Outputs

### Inputs

| Input | Description |
|---|---|
| `graphify-out/memory-intel.json` | Pre-built decisions corpus (77 KB; 180 decisions + 103 migration records). Rebuilt by `pnpm graph:memory` which wraps `memory-intel.mjs`. |
| Corpus files (see §2.4) | Markdown governance + architecture + runbook docs, read at index build time |
| `governance/decisions/*.json` _(future)_ | Structured ADR records per panel-knowledge R1 |

### Outputs (TypeScript types)

```typescript
// Re-exported from packages/lcis-core/src/memory/types.ts

export type { MemoryHit, Citation, ContextPack, Decision };

// Artifacts on disk (gitignored)
// graphify-out/memory-index.json — the BM25 index + documents
// graphify-out/memory-v2.json   — backward-compat summary (replaces tools/graph-server output)
```

### Graph-server HTTP endpoints (after migration)

The existing `/api/memory` and `/api/memory-v2` endpoints in `tools/graph-server/server.mjs` are updated to load `MemoryService` from `packages/lcis-core` instead of calling the `.mjs` functions directly. The API surface is **unchanged** (callers continue to use `?mode=rule&q=X`, `?mode=migration`, `?mode=why`, `?mode=affecting`). New endpoints added: `/api/memory/cite?q=`, `/api/memory/context?q=&budget=`.

---

## 5. Test Cases

All tests are deterministic — no mocks, no network, run against the real corpus files.

### T1 — Canonical-ledger rule
```
search("why must money mutations use RPC")
→ hits[0].id = "D-016" or "D-007"  (R-6 MUST-NOT ledger rule / ART-11)
→ hits[0].source = "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md"
→ hits[0].subtype = "payment"
→ hits[0].score > 5.0
```

### T2 — Two-runtime split rationale
```
search("two runtime split storefront identity")
→ hits contains doc from LETBUYY_CANONICAL_SYSTEMS.md or LETBUYY_CONSTITUTION.md
→ at least one hit.type in ["architecture", "governance"]
```

### T3 — RLS tenant isolation
```
search("RLS tenant isolation site_id policy")
→ hits[0].subtype = "security"
→ hits[0].rule contains "MUST" or "FORCE"
```

### T4 — Migration lookup
```
decision("migration-174") or search("gift card refund restore")
→ returns migration record: { n: 174, name: "v1 gift card refund restore", type: "refund" }
```

### T5 — cite() confidence contract
```
cite("Razorpay HMAC signature verification")
→ returns Citation[] where at least one citation.confidence = "high"
→ citation.source contains "CONSTITUTION" or a payments doc
```

### T6 — buildContext() budget enforcement
```
buildContext("canonical ledger only", 1000)
→ contextPack.tokensUsed ≤ 1000
→ contextPack.hits.length ≥ 1
→ contextPack.stale = false  (assuming index is fresh)
```

### T7 — decisions() filter
```
decisions({ type: "payment" })
→ returns array of Decision where every d.type = "payment"
→ length = 49 (the current byType count from memory-intel.json)
```

### T8 — Staleness detection
```
// Simulate a stale index: builtAtMigration = 100, current latestMigration.n = 174
buildContext("anything", 500)
→ contextPack.stale = true
```

---

## 6. Freshness — Schema Version Binding

Per panel-knowledge R3:

```typescript
interface MemoryIndex {
  builtAt: string;           // ISO timestamp
  builtAtMigration: number;  // latestMigration.n at build time (e.g. 174)
  schemaHash: string;        // sha256(memory-intel.json).slice(0,12)
  documents: MemoryDocument[];
  invertedIndex: Record<string, PostingEntry[]>;
}
```

`MemoryService.buildContext()` compares `builtAtMigration` to the `latestMigration.n` in the live `memory-intel.json`. If they diverge, `ContextPack.stale = true`. The graph-server `/api/memory/context` endpoint surfaces this flag so the caller (Claude Code, `apps/lcis`) can warn: "Memory index is STALE (built at migration 100, current 174). Run `pnpm graph:memory` to refresh."

Rebuild trigger: `pnpm graph:memory` is added to the `pnpm graph:v5` / `pnpm graph:omega` cascade so the index is always current after a full graph refresh.

---

## 7. File Layout

```
packages/lcis-core/src/memory/
  types.ts           ← MemoryHit, Citation, ContextPack, Decision interfaces
  bm25.ts            ← tokenize(), buildIndex(), scoreQuery() — zero deps
  corpus.ts          ← CORPUS_SOURCES list + chunking by heading
  MemoryService.ts   ← class MemoryService (the public API)
  build-index.ts     ← CLI entrypoint: reads corpus + memory-intel.json → writes memory-index.json
  index.ts           ← re-exports MemoryService + types

graphify-out/
  memory-index.json  ← BM25 index (gitignored, rebuilt by pnpm graph:memory)
  memory-intel.json  ← decisions corpus (gitignored, rebuilt by pnpm graph:memory)
  memory-v2.json     ← backward-compat summary (gitignored)

governance/decisions/
  *.json             ← structured ADR records (panel-knowledge R1 — empty at spec time)
```

---

## 8. Non-Goals (explicitly out of scope for this spec)

- Semantic / vector search (no embeddings ever)
- Qdrant, OpenAI, GraphRAG, Crawl4AI — all FORBIDDEN by Phase 6 constraint
- Persisted user query history
- Multi-language tokenization (English corpus only)
- Fuzzy matching / spelling correction
- The `:3334` engine stack — that is a separate consolidation phase

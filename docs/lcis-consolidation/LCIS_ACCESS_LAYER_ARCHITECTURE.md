# LCIS Access Layer Architecture

> Phase 2 — the four consumer surfaces that wrap `@letbuyy/lcis-core`. All surfaces are additive; the core engine and its tests are unchanged from Phase 1.

---

## Overview

The access layer exposes the LCIS intelligence engine through four distinct surfaces plus a GitHub Action that orchestrates them in CI.

```
┌─────────────────────────────────────────────────────────────┐
│                   @letbuyy/lcis-core                         │
│  ArtifactStore · GraphService · BlastRadiusService           │
│  MemoryService · DecisionService · ArchitectureService       │
│  VerificationService                                         │
│                                                              │
│  getEngine() ─── process-wide singleton ──────────────────  │
└──────────────────────────────┬──────────────────────────────┘
                               │  consumed by
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                     ▼          ▼
  @letbuyy/lcis-cli   @letbuyy/lcis-mcp   @letbuyy/lcis-api   @letbuyy/lcis-pr-check
  (terminal / scripts) (Claude / Cursor)  (HTTP REST)          (CI diff analysis)
```

Every surface calls `getEngine()` from `@letbuyy/lcis-core` and nothing else. No surface reimplements graph traversal, BM25 scoring, blast-radius computation, memory recall, or verification logic.

---

## The `getEngine()` Singleton

| Property | Value |
|----------|-------|
| Location | `packages/lcis-core/src/engine.ts` |
| Export | `getEngine(opts?)` — process-wide singleton |
| Cold start | < 3 s (graph load + index build) |
| Warm calls | < 100 ms |
| Test reset | `resetEngine()` — sets singleton to `null`; tests only |

The graph is loaded once per process. All four surfaces share this guarantee: a Docker container running the API, a CLI invocation, or an MCP server process each pays the cold-start cost once and serves all subsequent requests from the hot index.

---

## Shared Response Envelope

Every surface wraps engine output in `LcisEnvelope<T>` (from `packages/lcis-core/src/observability.ts`):

```ts
interface LcisEnvelope<T> {
  success: boolean;
  data: T | null;
  evidence: string[];
  confidence: number;        // 0–1; structural cap 0.9
  source: string;
  executionTime: number;     // ms
  timestamp: string;         // ISO-8601
  version: string;           // LCIS_VERSION = '0.0.0'
  requestId?: string;        // added by API / CLI
}
```

- `confidence` is derived by `confidenceFor(data)`: 0 for null/error, the `confidence` field if the data carries one, otherwise 0.9 structural cap.
- `evidence[]` lists citations, table names, RPC names, file paths — whatever the underlying service returned.
- The CLI renders this via `format.ts`; the MCP JSON-stringifies it into the `content[0].text` field; the API returns it directly as the HTTP response body.

---

## Surface-by-Surface Summary

### 1. CLI (`@letbuyy/lcis-cli`)

- Binary: `lcis` (via `dist/cli.js`)
- Framework: Commander 12
- Commands: `blast`, `explain`, `verify`, `memory`, `decision`, `health`, `graph stats`
- Output modes: `--json | --yaml | --table` (default per command) and `--format json|yaml|csv|markdown`
- Optional writes: `--export <path>` (the ONLY write path in the entire access layer for CLI)
- See `LCIS_CLI_GUIDE.md` for full command reference.

### 2. MCP Server (`@letbuyy/lcis-mcp`)

- Binary: `lcis-mcp` (via `dist/server.js`)
- SDK: `@modelcontextprotocol/sdk ^1.0.0`
- Transport: `StdioServerTransport`
- 7 tools: `lcis_blast`, `lcis_explain`, `lcis_verify`, `lcis_memory`, `lcis_decision`, `lcis_health`, `lcis_graph_stats`
- All tools return `{ content: [{ type: 'text', text: <JSON string of LcisEnvelope> }] }`
- Strictly read-only: no fs writes, no network calls, no process spawning
- See `LCIS_MCP_GUIDE.md` for tool reference and registration instructions.

### 3. REST API (`@letbuyy/lcis-api`)

- Runtime: `@hono/node-server`
- Port: `LCIS_API_PORT` env (default `7100`)
- Endpoints: `GET /health`, `GET /graph/stats`, `POST /blast|/verify|/explain|/memory|/decision`
- Middleware stack: request-id → security headers → rate limiter → audit log → global error handler
- See `LCIS_API_GUIDE.md` for endpoint reference.

### 4. PR Check (`@letbuyy/lcis-pr-check`)

- Binary: `lcis-pr-check` (via `dist/cli.js`)
- Input: changed file paths (stdin, `--files`, or `--files-from`)
- Output formats: `markdown` (PR comment), `json` (artifact), `summary` (step summary)
- Optional write: `--out <path>`
- 8 sensitivity flags derived from path patterns
- See `LCIS_PR_INTELLIGENCE.md` for full analyzer reference.

### 5. GitHub Action (`.github/actions/lcis-analysis/`)

Composite action that orchestrates `lcis-pr-check` in CI. Called by `.github/workflows/lcis-pr-analysis.yml` which also manages the `graphify-out/` artifact cache.

---

## No Duplicate Logic Guarantee

The guarantee is structural, not conventional: the four surface packages have no copies of graph, scoring, memory, or verification code. They import only from `@letbuyy/lcis-core`. A source scan of all four packages finds:

- No `BM25`, `GraphService`, `ArtifactStore`, `BlastRadiusService` implementations
- No SQL, no `child_process`, no `fetch`/`http.request`/`net.connect`
- `lcis-cli` and `lcis-pr-check` each have one controlled write path (`--export` / `--out`)
- Everything else is pure transformation (formatting, serialization, routing)

---

## Package Layout in the Monorepo

```
packages/
  lcis-core/          # Phase 1 — engine + all intelligence
  lcis-cli/           # Phase 2 — terminal surface
  lcis-mcp/           # Phase 2 — MCP surface
  lcis-pr-check/      # Phase 2 — PR diff surface
services/
  lcis-api/           # Phase 2 — REST surface
.github/
  actions/lcis-analysis/   # CI composite action
  workflows/lcis-pr-analysis.yml
```

Root workspace scripts (all additive, no existing scripts changed):

| Script | What it runs |
|--------|-------------|
| `pnpm lcis` | `@letbuyy/lcis-cli` |
| `pnpm lcis:mcp` | `@letbuyy/lcis-mcp` server over stdio |
| `pnpm lcis:api` | `@letbuyy/lcis-api` HTTP server |
| `pnpm lcis:pr-check` | `@letbuyy/lcis-pr-check` |

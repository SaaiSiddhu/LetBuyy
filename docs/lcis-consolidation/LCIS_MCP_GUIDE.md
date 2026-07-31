# LCIS MCP Guide

Package: `@letbuyy/lcis-mcp` | Binary: `lcis-mcp` | SDK: `@modelcontextprotocol/sdk ^1.0.0` (installed: 1.29.0)

---

## Overview

The MCP server exposes the 7 LCIS tools over stdio, making the full intelligence engine available to Claude Code, Cursor, and any other MCP-compatible AI host. The server is strictly read-only: no filesystem writes, no network calls, no process spawning.

---

## Registration

### Claude Code (`.claude/mcp.json`)

```json
{
  "mcpServers": {
    "lcis": {
      "command": "pnpm",
      "args": ["lcis:mcp"],
      "cwd": "/path/to/Letbuyy_Store"
    }
  }
}
```

Or using the built binary directly:

```json
{
  "mcpServers": {
    "lcis": {
      "command": "node",
      "args": ["/path/to/Letbuyy_Store/packages/lcis-mcp/dist/server.js"]
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "lcis": {
      "command": "pnpm",
      "args": ["--filter", "@letbuyy/lcis-mcp", "start"],
      "cwd": "/path/to/Letbuyy_Store"
    }
  }
}
```

The server communicates over stdio and must be started in the repo root so that `graphify-out/` artifact paths resolve correctly.

---

## The 7 Tools

All tools return:
```json
{
  "content": [{ "type": "text", "text": "<JSON string of LcisEnvelope>" }]
}
```

The `LcisEnvelope` includes `success`, `data`, `evidence`, `confidence`, `executionTime`, `version`, `timestamp`.

---

### `lcis_blast`

Compute the blast radius of a named symbol.

**Input schema:**
```json
{
  "symbol": "string (required) — function name, class, RPC, or package",
  "depth": "integer (optional) — traversal depth"
}
```

**Example:**
```
lcis_blast({ "symbol": "getSupabaseAdmin" })
```

Returns: `nodeCount`, `fileCount`, `layers[]`, `criticality`, `evidence[]`.

---

### `lcis_explain`

Plain-language explanation of any domain, service, table, or runtime component.

**Input schema:**
```json
{
  "entity": "string (required) — domain key, service name, table name, or runtime component"
}
```

**Example:**
```
lcis_explain({ "entity": "payments" })
lcis_explain({ "entity": "storefront-runtime" })
```

Returns: purpose, owner, criticality, dependencies, consumers, failure impact, architecture narrative.

---

### `lcis_verify`

Structural verification of a system's posture.

**Input schema:**
```json
{
  "entity": "architecture | production-readiness | runtime | security"
}
```

**Statuses:** `VERIFIED | PARTIAL | UNVERIFIED | REFUTED`

Note: `runtime` always returns `PARTIAL` — 13 live signal sources are NOT CONNECTED. This is an honest signal.

**Example:**
```
lcis_verify({ "entity": "production-readiness" })
```

---

### `lcis_memory`

BM25 recall over the governance corpus.

**Input schema:**
```json
{
  "query": "string (required) — natural language or keyword query",
  "limit": "integer (optional) — max results, default 10"
}
```

Collections searched: architecture, runbooks, incidents, security, deployments, knowledge, merchants, themes.

**Example:**
```
lcis_memory({ "query": "COD inventory rollback RPC" })
```

Returns: `hits[]` with `id`, `score`, `excerpt`, `collection`; plus `confidence`, `staleness`.

---

### `lcis_decision`

Ranked operational decisions.

**Input schema:**
```json
{
  "subject": "risks | fixes | launch | scale | <decision-id>"
}
```

| Subject | Returns |
|---------|---------|
| `risks` | Ranked risk list with severity and evidence |
| `fixes` | Fix list ordered by impact vs effort |
| `launch` | GO / NO-GO / CONDITIONAL-GO with blockers |
| `scale` | Scale tier blockers for 100 / 10k / 100k users |
| `<id>` | Single decision trace |

**Example:**
```
lcis_decision({ "subject": "launch" })
```

---

### `lcis_health`

Engine health: graph stats, cache entries, artifact staleness, version.

**Input schema:** none required.

**Example:**
```
lcis_health({})
```

Returns: `nodeCount`, `edgeCount`, `commit`, `cacheEntries`, `artifactAge`, `version`.

---

### `lcis_graph_stats`

Raw graph statistics without engine overhead.

**Input schema:** none required.

**Example:**
```
lcis_graph_stats({})
```

Returns: `nodeCount`, `edgeCount`, `commit`.

---

## Read-Only Guarantee

The read-only guarantee is verified by the test suite (`tools.test.ts`), which performs a source scan of `tools.ts` and asserts the absence of:

- `fs.write*`, `fs.append*`, `createWriteStream`
- `child_process`, `exec`, `spawn`, `execSync`
- `eval`, `Function(`
- `fetch`, `http.request`, `https.request`, `net.connect`
- SQL mutation keywords in string literals

A violation of any of these causes the test suite to fail.

---

## Server Internals

`createServer()` (from `src/server.ts`):

1. Creates an `McpServer` instance with `name = 'lcis'` and `version = LCIS_VERSION`
2. Calls `getEngine()` once to warm the singleton
3. Iterates `TOOLS` registry and registers each tool handler
4. Connects `StdioServerTransport`

An `import.meta.url` guard prevents the stdio transport from starting when the module is imported (e.g., in tests).

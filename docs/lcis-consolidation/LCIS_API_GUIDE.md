# LCIS API Guide

Package: `@letbuyy/lcis-api` | Runtime: `@hono/node-server` | Framework: Hono 4

---

## Starting the Server

```bash
# via workspace script
pnpm lcis:api

# or directly
pnpm --filter @letbuyy/lcis-api start
```

Default port: `7100`. Override with:

```bash
LCIS_API_PORT=8080 pnpm lcis:api
```

The server logs a JSON startup line to stderr and then per-request audit lines.

---

## Middleware Stack

Every request passes through this chain (order matters):

| Middleware | Effect |
|------------|--------|
| `requestIdMiddleware` | Passes through or generates `x-request-id` + `x-trace-id`; both are echoed in the response envelope |
| `securityHeadersMiddleware` | Sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` |
| `rateLimiterMiddleware` | In-process token bucket per client IP; capacity=60, refill=10/s; returns HTTP 429 on exhaustion |
| `auditLogMiddleware` | Structured JSON line to stderr per request: `method`, `path`, `status`, `ms`, `requestId` |
| `globalErrorHandler` | Catches unhandled errors; returns 500 JSON with no stack trace in the response body |

---

## Endpoints

### `GET /health`

Engine health check. Returns cache stats, graph stats, version.

```bash
curl http://localhost:7100/health
```

Response:
```json
{
  "success": true,
  "data": {
    "nodeCount": 52246,
    "edgeCount": 66761,
    "commit": "abc123",
    "cacheEntries": 4,
    "version": "0.0.0"
  },
  "evidence": [],
  "confidence": 0.9,
  "executionTime": 2,
  "timestamp": "2026-06-20T18:30:00.000Z",
  "version": "0.0.0"
}
```

---

### `GET /graph/stats`

Raw graph statistics without engine cache overhead.

```bash
curl http://localhost:7100/graph/stats
```

Response:
```json
{
  "success": true,
  "data": { "nodeCount": 52246, "edgeCount": 66761, "commit": "abc123" },
  "evidence": [],
  "confidence": 0.9,
  "executionTime": 1,
  "timestamp": "...",
  "version": "0.0.0"
}
```

---

### `POST /blast`

Compute blast radius for a symbol.

```bash
curl -X POST http://localhost:7100/blast \
  -H 'Content-Type: application/json' \
  -d '{"symbol": "getSupabaseAdmin", "depth": 3}'
```

Request body:
```ts
{ symbol: string; depth?: number }
```

Response `data`:
```ts
{
  symbol: string;
  nodeCount: number;
  fileCount: number;
  layers: number[];
  criticality: 'critical' | 'high' | 'medium' | 'low';
  evidence: string[];
}
```

---

### `POST /verify`

Structural verification.

```bash
curl -X POST http://localhost:7100/verify \
  -H 'Content-Type: application/json' \
  -d '{"entity": "production-readiness"}'
```

Request body:
```ts
{ entity: 'architecture' | 'production-readiness' | 'runtime' | 'security' }
```

Response `data` includes: `status` (`VERIFIED|PARTIAL|UNVERIFIED|REFUTED`), `findings[]`, `confidence`, `notConnected[]` (for `runtime`).

---

### `POST /explain`

Plain-language explanation of any domain, service, or runtime entity.

```bash
curl -X POST http://localhost:7100/explain \
  -H 'Content-Type: application/json' \
  -d '{"entity": "payments"}'
```

Request body:
```ts
{ entity: string }
```

The handler routes to one of: `explainDomain`, `explainService`, `explainArchitecture`, `explainRuntime`, `explainOwnership`, `explainRisk` based on the entity name.

---

### `POST /memory`

BM25 governance corpus recall.

```bash
curl -X POST http://localhost:7100/memory \
  -H 'Content-Type: application/json' \
  -d '{"query": "RLS policy tenant tables", "limit": 5}'
```

Request body:
```ts
{ query: string; limit?: number }
```

Response `data`: `hits[]`, `diagnostics`, `staleness`.

---

### `POST /decision`

Ranked operational decisions.

```bash
curl -X POST http://localhost:7100/decision \
  -H 'Content-Type: application/json' \
  -d '{"subject": "launch"}'
```

Request body:
```ts
{ subject: 'risks' | 'fixes' | 'launch' | 'scale' | string }
```

The handler routes: `fixes` → `rankFixes`, `launch` → `launchVerdict`, `risks` → `rankRisks`, anything else → `trace(subject)`.

---

## Error Responses

All errors follow the same envelope shape:

```json
{
  "success": false,
  "data": null,
  "evidence": [],
  "confidence": 0,
  "executionTime": 5,
  "error": "human-readable message",
  "timestamp": "...",
  "version": "0.0.0"
}
```

| HTTP Status | Cause |
|-------------|-------|
| 400 | Zod validation failure — `issues[]` included |
| 404 | Unknown route |
| 429 | Rate limit exceeded (token bucket depleted) |
| 500 | Unhandled engine error (no stack trace in body) |

---

## Response Envelope

Every response is `LcisEnvelope<T>`:

```ts
interface LcisEnvelope<T> {
  success: boolean;
  data: T | null;
  evidence: string[];
  confidence: number;     // 0–1
  source: string;
  executionTime: number;  // ms
  timestamp: string;      // ISO-8601
  version: string;        // '0.0.0'
  requestId?: string;     // from x-request-id header or generated
}
```

---

## Programmatic Use

```ts
import { createApp } from '@letbuyy/lcis-api';

const app = createApp();
// Hono app instance — can be used with any compatible adapter
// e.g., @hono/node-server, Cloudflare Workers, etc.
```

The `createApp()` export is the test boundary — `app.test.ts` uses it directly without starting a real HTTP server.

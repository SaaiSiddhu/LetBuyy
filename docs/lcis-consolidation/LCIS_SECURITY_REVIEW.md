# LCIS Security Review

Phase 2 access layer (`@letbuyy/lcis-cli`, `@letbuyy/lcis-mcp`, `@letbuyy/lcis-api`, `@letbuyy/lcis-pr-check`)

---

## Posture: Read-Only

The entire access layer is read-only by design. The engine reads artifacts from `graphify-out/`; it never writes to the database, never executes shell commands, and never makes outbound network connections.

---

## Source Scan Results

A source scan of all four access-layer packages was performed. Results:

| Dangerous pattern | Occurrences |
|-------------------|-------------|
| `fs.write*`, `fs.append*`, `createWriteStream` | 2 (see below) |
| `child_process`, `exec`, `spawn`, `execSync` | 0 |
| `eval`, `new Function(` | 0 |
| `fetch`, `http.request`, `https.request` | 0 |
| `net.connect`, `net.createConnection` | 0 |
| SQL keywords in string literals (`INSERT`, `UPDATE`, `DELETE`) | 0 |

### The 2 Permitted Writes

Both are explicit, user-requested export paths:

1. **`packages/lcis-cli/src/format.ts` — `exportToFile(path, content)`**  
   Called only when the user passes `--export <path>` to the CLI. The path is supplied by the user at runtime; no implicit writes.

2. **`packages/lcis-pr-check/src/cli.ts` — `--out <path>` flag**  
   Called only when the user passes `--out <path>` to the PR check CLI.

No other writes exist anywhere in the access layer.

---

## MCP Read-Only Guarantee

The `lcis-mcp` test suite includes a source-scan test in `tools.test.ts` that asserts the absence of all dangerous patterns listed above. If any are introduced, the test fails and the package will not pass CI.

All 7 MCP tools:
- Call `getEngine()` and one engine method
- JSON-stringify the result into `content[0].text`
- Return immediately

No tool handler has any side effect beyond consuming CPU.

---

## Threat Model

### Threat 1: Path Traversal via `--export` / `--out`

**Mitigated:** The CLI is a local developer tool run by the repository owner. The `--export` and `--out` flags take a user-supplied path, which is the intended behavior. There is no server-side exposure of these flags.

### Threat 2: API Abuse / DoS

**Mitigated:** The REST API includes:
- In-process token bucket rate limiter (capacity=60, refill=10/s per IP)
- Zod schema validation on all POST bodies (400 on invalid input)
- `globalErrorHandler` that suppresses stack traces in error responses (no internal path disclosure)
- No authentication required (the API is designed for internal/localhost use; do not expose to the public internet without adding auth)

**Residual risk:** The API has no authentication layer. If exposed beyond localhost, add an `Authorization` header check at the `requestIdMiddleware` level before the rate limiter.

### Threat 3: Engine Data Exfiltration via MCP

**Mitigated:** All 7 MCP tools return data already present in `graphify-out/` artifacts (which are gitignored and not secrets). The artifacts contain structural code-graph data — file paths, symbol names, RPC names, table names — not credentials, secrets, or customer data.

The `graphify-out/` artifacts must never be committed to git or included in Docker images that leave the developer environment.

### Threat 4: Malicious `graphify-out/` Artifacts

If the artifact files are tampered with (e.g., path traversal in graph node paths), the engine would return those paths in blast-radius evidence. The engine does not execute or evaluate any content from artifacts — it reads JSON and performs BM25 index builds. No code execution from artifact content is possible.

### Threat 5: Dependency Supply Chain

| Package | Version | Role |
|---------|---------|------|
| `commander` | ^12.1.0 | CLI arg parsing |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP protocol |
| `hono` | ^4.7.0 | HTTP framework |
| `@hono/node-server` | ^1.13.0 | Node.js adapter |
| `zod` | ^4.3.6 | Schema validation |

All are well-maintained, widely audited packages with no known critical CVEs at Phase-2 ship date.

---

## API Security Headers

Every response from `@letbuyy/lcis-api` includes:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cache-Control: no-store
```

These prevent MIME sniffing, framing attacks, referrer leaks, and caching of sensitive graph data.

---

## Audit Logging

Every API request produces a structured JSON log line to stderr:

```json
{
  "method": "POST",
  "path": "/blast",
  "status": 200,
  "ms": 42,
  "requestId": "req_abc123",
  "timestamp": "2026-06-20T18:30:00.000Z"
}
```

Request and trace IDs are propagated from client headers (`x-request-id`, `x-trace-id`) or generated via `node:crypto`.

---

## Error Handling

`globalErrorHandler` in `app.ts`:
- Returns HTTP 500 with `{ success: false, error: "Internal error" }` — no stack trace, no internal paths
- Logs the full error (with stack) to stderr for operator visibility
- Prevents information leakage through error messages

---

## Summary

| Control | Status |
|---------|--------|
| No shell execution | VERIFIED (source scan + MCP test suite) |
| No outbound network | VERIFIED (source scan) |
| No SQL mutations | VERIFIED (source scan) |
| Controlled writes (2 paths) | DOCUMENTED + user-initiated only |
| Rate limiting | IMPLEMENTED (token bucket, API) |
| Input validation | IMPLEMENTED (Zod, API) |
| Security headers | IMPLEMENTED (API) |
| Audit logging | IMPLEMENTED (API) |
| No stack-trace leakage | IMPLEMENTED (globalErrorHandler) |
| MCP read-only assertion | AUTOMATED (tools.test.ts source scan) |

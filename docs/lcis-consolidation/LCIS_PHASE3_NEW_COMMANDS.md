# LCIS Phase 3 — New Commands, Tools, and Endpoints

All surfaces added in Phase 3. All are read-only.

---

## CLI Commands

New commands added to `packages/lcis-cli/src/cli.ts`.

### `lcis live health`

All adapter health checks in parallel.

```bash
pnpm lcis live health
```

Example output (no credentials set):
```json
{
  "overall": "NOT_CONNECTED",
  "adapters": [
    {
      "name": "supabase",
      "status": "NOT_CONNECTED",
      "missingEnvVars": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      "latencyMs": 0,
      "checkedAt": "2026-06-20T10:00:00.000Z"
    },
    {
      "name": "github",
      "status": "NOT_CONNECTED",
      "missingEnvVars": ["GITHUB_TOKEN", "GITHUB_REPOSITORY"],
      "latencyMs": 0,
      "checkedAt": "2026-06-20T10:00:00.000Z"
    },
    {
      "name": "cloudflare",
      "status": "NOT_CONNECTED",
      "missingEnvVars": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      "latencyMs": 0,
      "checkedAt": "2026-06-20T10:00:00.000Z"
    },
    {
      "name": "vercel",
      "status": "NOT_CONNECTED",
      "missingEnvVars": ["VERCEL_TOKEN"],
      "latencyMs": 0,
      "checkedAt": "2026-06-20T10:00:00.000Z"
    }
  ],
  "generatedAt": "2026-06-20T10:00:00.000Z"
}
```

### `lcis live status`

Collects full `AdapterSnapshot` from all adapters. Includes `LiveFact[]` when CONNECTED.

```bash
pnpm lcis live status
```

Example output (NOT_CONNECTED):
```json
{
  "adapters": [
    {
      "adapter": "supabase",
      "status": "NOT_CONNECTED",
      "facts": [],
      "collectedAt": "2026-06-20T10:00:00.000Z",
      "ttlMs": 60000
    }
  ],
  "generatedAt": "2026-06-20T10:00:00.000Z"
}
```

### `lcis live adapters`

Lists registered adapter names and metadata (no network calls).

```bash
pnpm lcis live adapters
```

### `lcis live investigate <subject>`

Cross-adapter investigation for a subject. Runs against CONNECTED adapters only.

```bash
pnpm lcis live investigate payments
pnpm lcis live investigate deployment
```

Example output (all NOT_CONNECTED):
```json
{
  "subject": "payments",
  "correlation": {
    "summary": "No live facts available for correlation.",
    "correlatedFacts": [],
    "otherFacts": [],
    "confidence": 0,
    "structural": null
  },
  "contributingAdapters": [],
  "notConnected": ["supabase", "github", "cloudflare", "vercel"],
  "evidence": [],
  "generatedAt": "2026-06-20T10:00:00.000Z"
}
```

### `lcis db status`

Supabase adapter health check (probe only, no Management API).

```bash
pnpm lcis db status
```

### `lcis db tables`

Live table list from Supabase PostgREST OpenAPI root.

```bash
pnpm lcis db tables
```

### `lcis db policies`

RLS policies from Supabase Management API. Requires `SUPABASE_ACCESS_TOKEN`.

```bash
pnpm lcis db policies
```

### `lcis db migrations`

Migration history and status from Supabase Management API. Requires `SUPABASE_ACCESS_TOKEN`.

```bash
pnpm lcis db migrations
```

### `lcis db drift`

Schema drift + missing-rls + dangerous-policy + broken-migration findings. Requires `SUPABASE_ACCESS_TOKEN` + `graphify-out/db-intel.json`.

```bash
pnpm lcis db drift
```

### `lcis db health`

Full Supabase adapter health detail (same as `db status` but verbose).

```bash
pnpm lcis db health
```

### `lcis github status`

GitHub adapter health + recent commits, PRs, workflow runs.

```bash
pnpm lcis github status
```

### `lcis cloudflare status`

Cloudflare adapter health + worker/route/queue inventory.

```bash
pnpm lcis cloudflare status
```

### `lcis vercel status`

Vercel adapter health + project/deployment/domain summary.

```bash
pnpm lcis vercel status
```

### `lcis investigate <target>`

Named cross-adapter investigations with pre-scoped subjects.

```bash
pnpm lcis investigate database    # supabase facts + structural blast for "database"
pnpm lcis investigate deployment  # github + vercel facts + structural blast for "deployment"
pnpm lcis investigate edge        # cloudflare facts + structural blast for "edge"
```

---

## MCP Tools

Defined in `packages/lcis-mcp/src/tools.ts`. All return `ToolResult` with `content: [{ type: 'text', text: JSON }]`.

### `lcis_live_status`

Input: none (or optional `adapter` string to filter)

Returns all adapter statuses — CONNECTED / NOT_CONNECTED / DEGRADED / ERROR — with `missingEnvVars` when not connected.

Example NOT_CONNECTED output (text field):
```json
{
  "overall": "NOT_CONNECTED",
  "adapters": [
    { "name": "supabase", "status": "NOT_CONNECTED", "missingEnvVars": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
    { "name": "github", "status": "NOT_CONNECTED", "missingEnvVars": ["GITHUB_TOKEN", "GITHUB_REPOSITORY"] },
    { "name": "cloudflare", "status": "NOT_CONNECTED", "missingEnvVars": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"] },
    { "name": "vercel", "status": "NOT_CONNECTED", "missingEnvVars": ["VERCEL_TOKEN"] }
  ]
}
```

### `lcis_live_investigate`

Input: `{ subject: string }`

Cross-adapter investigation. Returns `Investigation` with structural correlation.

Example NOT_CONNECTED output:
```json
{
  "subject": "orders",
  "notConnected": ["supabase", "github", "cloudflare", "vercel"],
  "contributingAdapters": [],
  "correlation": { "summary": "No live facts available.", "confidence": 0, "correlatedFacts": [], "otherFacts": [] }
}
```

### `lcis_db_health`

Input: none

Returns Supabase adapter health + all `VerificationFinding[]` from `verify()`.

### `lcis_recent_changes`

Input: none (or optional `limit: number`)

Returns GitHub adapter `LiveFact[]` (commits, PRs, releases, failed workflows) combined with the structural graph commit hash from `@letbuyy/lcis-core`.

### `lcis_deployment_status`

Input: none

Returns combined GitHub + Vercel deployment status. Each contributes its `AdapterSnapshot.facts` filtered to deployment-type facts.

---

## API Endpoints

Defined in `services/lcis-api/src/app.ts`. All responses use `LcisEnvelope` with `requestId` and `traceId`.

### `GET /live/health`

All adapter health checks.

```bash
curl http://localhost:3001/live/health
```

NOT_CONNECTED response:
```json
{
  "ok": true,
  "data": {
    "overall": "NOT_CONNECTED",
    "adapters": [
      { "name": "supabase", "status": "NOT_CONNECTED", "missingEnvVars": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
      { "name": "github", "status": "NOT_CONNECTED", "missingEnvVars": ["GITHUB_TOKEN", "GITHUB_REPOSITORY"] },
      { "name": "cloudflare", "status": "NOT_CONNECTED", "missingEnvVars": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"] },
      { "name": "vercel", "status": "NOT_CONNECTED", "missingEnvVars": ["VERCEL_TOKEN"] }
    ]
  },
  "requestId": "req_...",
  "traceId": "trace_..."
}
```

### `GET /live/status`

All adapter snapshots with `LiveFact[]`.

```bash
curl http://localhost:3001/live/status
```

### `POST /live/investigate`

Cross-adapter investigation.

```bash
curl -X POST http://localhost:3001/live/investigate \
  -H 'Content-Type: application/json' \
  -d '{"subject": "payments"}'
```

NOT_CONNECTED response:
```json
{
  "ok": true,
  "data": {
    "subject": "payments",
    "notConnected": ["supabase", "github", "cloudflare", "vercel"],
    "contributingAdapters": [],
    "correlation": { "summary": "No live facts available.", "confidence": 0 }
  }
}
```

### `GET /db/status`

Supabase adapter health + `VerificationFinding[]`.

```bash
curl http://localhost:3001/db/status
```

### `GET /github/status`

GitHub adapter health + snapshot facts.

```bash
curl http://localhost:3001/github/status
```

### `GET /cloudflare/status`

Cloudflare adapter health + snapshot facts.

```bash
curl http://localhost:3001/cloudflare/status
```

### `GET /vercel/status`

Vercel adapter health + snapshot facts.

```bash
curl http://localhost:3001/vercel/status
```

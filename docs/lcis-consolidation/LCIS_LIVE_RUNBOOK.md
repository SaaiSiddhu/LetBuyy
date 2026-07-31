# LCIS Live Adapter — Operations Runbook

How to operate the Phase 3 live adapter platform day-to-day.

---

## Prerequisites

### 1. Provider credentials

Set environment variables in your shell or `.env.local`. LCIS never reads their values except to place them in outbound Authorization headers.

```bash
# Supabase (required: URL + service role; optional: access token for Management API)
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
export SUPABASE_ACCESS_TOKEN="sbp_..."   # optional; enables migrations/policies/functions

# GitHub
export GITHUB_TOKEN="ghp_..."
export GITHUB_REPOSITORY="letbuyy-org/letbuyy-store"

# Cloudflare
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."

# Vercel
export VERCEL_TOKEN="..."
export VERCEL_TEAM_ID="..."              # optional; omit for personal account
```

### 2. lcis-core artifact dependency

The CorrelationEngine and structural checks (`schema-drift`, `missing-rls`, `orphan-rpc`) require the lcis-core artifacts in `graphify-out/`. If the artifacts are stale or absent, correlation runs with reduced scope (structural blast returns no results; drift checks are skipped).

Refresh the artifact store before running correlation-heavy investigations:

```bash
pnpm graph:update    # updates code graph
pnpm graph:db        # updates db-intel.json (414 tables, 156 RPCs, 651 policies)
pnpm graph:omega     # full refresh (db + infra + domain + reports)
```

---

## NOT_CONNECTED Behavior

When a required credential is absent, the adapter returns immediately without making any network call:

```json
{
  "status": "NOT_CONNECTED",
  "missingEnvVars": ["GITHUB_TOKEN", "GITHUB_REPOSITORY"],
  "latencyMs": 0,
  "checkedAt": "2026-06-20T..."
}
```

`lcis live health` summarizes this across all adapters. `lcis live status` shows per-adapter `NOT_CONNECTED` entries. `POST /live/investigate` runs against CONNECTED adapters only and lists the disconnected ones in `notConnected[]`.

No fabricated values are returned. A NOT_CONNECTED adapter does not degrade unrelated adapters.

---

## Running Live Surfaces

### CLI

```bash
# Check all adapters
lcis live health
lcis live status
lcis live adapters

# Per-provider
lcis db status
lcis db drift
lcis github status
lcis cloudflare status
lcis vercel status

# Cross-adapter investigation
lcis investigate database
lcis investigate deployment
lcis investigate edge
lcis live investigate payments
```

All commands are available via:

```bash
pnpm lcis live health
# or directly if lcis is on PATH:
node packages/lcis-cli/src/cli.ts live health
```

### MCP (Claude / operator usage)

Five live MCP tools are registered in `@letbuyy/lcis-mcp`:

| Tool | Description |
|------|-------------|
| `lcis_live_status` | All adapter statuses (CONNECTED/NOT_CONNECTED/DEGRADED) |
| `lcis_live_investigate` | Cross-adapter investigation for a subject string |
| `lcis_db_health` | Supabase adapter health + drift findings |
| `lcis_recent_changes` | GitHub adapter facts + structural commit from graph |
| `lcis_deployment_status` | GitHub + Vercel deployment status combined |

```bash
# Start MCP server
pnpm lcis:mcp
```

### API

```bash
# Start the API service
pnpm lcis:api   # starts on the configured port (default :3001)

# Live endpoints
curl http://localhost:3001/live/health
curl http://localhost:3001/live/status
curl -X POST http://localhost:3001/live/investigate -H 'Content-Type: application/json' \
     -d '{"subject":"payments"}'

# Per-provider
curl http://localhost:3001/db/status
curl http://localhost:3001/github/status
curl http://localhost:3001/cloudflare/status
curl http://localhost:3001/vercel/status
```

All API responses use the `LcisEnvelope` format from `@letbuyy/lcis-core`:

```json
{
  "ok": true,
  "data": { ... },
  "requestId": "...",
  "traceId": "..."
}
```

---

## The Investigate Flow

`lcis investigate <subject>` / `POST /live/investigate`:

1. **Collect** — `LivePlatform.status()` runs all adapters in parallel. Adapters with valid snapshots in the TTL cache skip network calls.
2. **Filter CONNECTED** — only adapters that returned a snapshot with facts participate. NOT_CONNECTED adapters are added to the `notConnected[]` list.
3. **Correlate** — `CorrelationEngine.correlate(subject, allFacts[])`:
   - Calls `lcis-core` for blast radius of `subject` and cross-domain edges.
   - Intersects live facts with the structural surface.
   - Produces `correlatedFacts` (live facts that match structural nodes) and `otherFacts` (live facts with no structural match).
4. **Return** — `Investigation` result with `summary`, `evidence`, `confidence`, `correlatedFacts`, `otherFacts`, `notConnected`, `generatedAt`.

If all adapters are NOT_CONNECTED, the investigation returns `notConnected: [all adapters]` and `correlatedFacts: []`. Confidence: 0.0.

If `graphify-out/` artifacts are absent, `CorrelationEngine.structuralContext()` returns empty structural context. The investigation still runs but `correlatedFacts` will be empty (no structural surface to match against).

---

## Snapshot TTL and Caching

| Adapter | TTL |
|---------|-----|
| Supabase | 60 s |
| GitHub | 60 s |
| Cloudflare | 120 s |
| Vercel | 120 s |

The `SnapshotStore` is in-memory and scoped to the process lifetime. Restarting the CLI or API server clears all cached snapshots. The rate limiter (30 tokens, 5/s refill) applies per adapter key across all calls in the same process.

---

## Troubleshooting

### "All adapters NOT_CONNECTED"

Check that env vars are set in the shell that runs `lcis` or `pnpm lcis:api`. The `missingEnvVars` field in the health response lists the exact missing variables.

### "Schema drift detected — table in live but not in graph"

The `db-intel.json` artifact is stale. Run `pnpm graph:db` to refresh the data layer graph. Then re-run `lcis db drift`.

### "Cloudflare routing-drift: route references missing worker"

A Cloudflare route points to a worker script that was deleted or renamed. Verify in the Cloudflare dashboard and update the route.

### "CorrelationEngine returns empty correlatedFacts"

`graphify-out/code-graph.json` or `graphify-out/domain-intel.json` is absent or stale. Run `pnpm graph:update && pnpm graph:domain` then re-run `lcis investigate`.

### "SUPABASE_ACCESS_TOKEN not set — migrations/policies not available"

Without `SUPABASE_ACCESS_TOKEN`, the Supabase adapter falls back to PostgREST only (table list from `/rest/v1/`). `missing-rls`, `broken-migration`, `dangerous-policy`, and `orphan-rpc` checks are skipped. Set `SUPABASE_ACCESS_TOKEN` with a Supabase personal access token to enable them.

### "Rate limiter blocked a request"

The token bucket (capacity 30, refill 5/s) is exhausted. This occurs only in high-frequency programmatic use. Wait for the bucket to refill or reduce call frequency.

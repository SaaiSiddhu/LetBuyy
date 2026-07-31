# LCIS Access Layer Runbook

Operating the CLI, MCP server, REST API, and PR check in development and CI.

---

## Prerequisites

### The `graphify-out/` Artifact

All four surfaces depend on artifacts in `graphify-out/` (gitignored). Without them the engine fails to start with `ArtifactMissingError`.

**Refresh the full artifact set:**
```bash
uv tool install graphifyy          # install once
graphify update .                  # code graph
pnpm graph:db                      # DB graph (414 tables, 156 RPCs, 651 policies)
pnpm graph:infra                   # infra graph (workers, queues, secrets, deploy)
pnpm graph:domain                  # domain graph (22 domains, cross-domain edges)
pnpm graph:relationships           # FK/foreign-key relationship graph (705 FKs)
```

Or run everything in one shot:
```bash
pnpm graph:v3    # db + infra + domain + reports
pnpm graph:omega # all layers including v5 + omega
```

**Check artifact age:**
```bash
pnpm lcis health --json | jq '.data.artifactAge'
```

**Staleness flag:** `MemoryService` sets `staleness: true` when the BM25 index is built from artifacts older than the current HEAD.

---

## Starting Each Surface

### CLI
```bash
pnpm lcis <command> [flags]
# e.g.
pnpm lcis health
pnpm lcis blast getSupabaseAdmin --json
```

No long-running process. Each invocation: cold-start graph load → command → exit.

### MCP Server
```bash
pnpm lcis:mcp
# stays running, communicates over stdio
```

Register it in your AI host (see `LCIS_MCP_GUIDE.md`). The process idles between tool calls; the engine singleton stays warm.

### REST API
```bash
pnpm lcis:api                      # port 7100
LCIS_API_PORT=8080 pnpm lcis:api   # custom port
```

Check it is up:
```bash
curl http://localhost:7100/health
```

### PR Check
```bash
git diff --name-only HEAD~1 | pnpm lcis:pr-check --format markdown
```

---

## Troubleshooting

### `ArtifactMissingError: graphify-out/graph.json not found`

The code graph does not exist. Run:
```bash
graphify update .
```

### `ArtifactMissingError: graphify-out/db-intel.json not found`

The DB graph does not exist. Run:
```bash
pnpm graph:db
```

### Engine cold-start takes > 10 s

Normal cold-start is < 3 s. If slower:
- Check disk I/O — `graphify-out/graph.json` can be large (52k nodes)
- `pnpm lcis health --json` → inspect `artifactAge`; stale artifacts may be larger than expected after many `graphify update` runs
- Rebuild: `rm -rf graphify-out && graphify update . && pnpm graph:db && pnpm graph:domain`

### MCP server not showing tools in Claude Code

1. Verify the server starts: `pnpm lcis:mcp` — should print startup line to stderr
2. Verify `graphify-out/` exists in the working directory the server is launched from
3. Check `.claude/mcp.json` `cwd` points to the repo root
4. Restart Claude Code after changing `mcp.json`

### API returning 429 (rate limited)

The in-process token bucket is per-IP with capacity=60 and refill=10/s. In local dev this is unlikely but can happen in scripted loops. Wait 6 s for the bucket to refill or restart the server process.

### API returning 500

Check stderr for the audit log line. The `globalErrorHandler` returns no stack trace in the response — the full error is in stderr.

### PR check missing domains

`domain-map.ts` `PATH_DOMAIN_RULES` uses first-match-wins. If a file is not matched, it lands in the `unknown` domain. Add a rule to `PATH_DOMAIN_RULES` and rerun.

### `verify runtime` always returns `PARTIAL`

This is correct. 13 live signal sources (Cloudflare Analytics Engine, Supabase telemetry, Razorpay webhooks, etc.) are NOT CONNECTED — the engine cannot probe them without credentials, which are deploy-time secrets not present in the repo. PARTIAL is the honest answer.

---

## CI Artifact Dependency

In `.github/workflows/lcis-pr-analysis.yml`, `graphify-out/` is cached by `github.sha`. On cache miss, the workflow regenerates it before calling the LCIS composite action. Each graph script uses `|| true` — a failure in one step does not block the others or the overall job.

If the cache is stale or missing in CI:
1. Push a new commit (new SHA busts the cache)
2. Or manually delete the Actions cache via `gh cache delete`

---

## Known Caveats

### Governance Tenant Registry

The governance validator at `scripts/validate-governance.mjs` references a `tenant-registry` concept that is pre-existing and unrelated to the LCIS Phase-2 packages. If `pnpm validate-governance` reports a tenant-registry warning, this is not caused by the access layer. The LCIS packages (cli/mcp/api/pr-check) are additive and do not touch the governance topology, import declarations, or package registry.

---

## Health Check Summary

| Surface | How to check |
|---------|-------------|
| CLI | `pnpm lcis health` |
| MCP | Call `lcis_health` tool from your AI host |
| API | `curl http://localhost:7100/health` |
| PR check | `echo "test.ts" \| pnpm lcis:pr-check --format summary` |
| Artifacts | `ls graphify-out/` — must include `graph.json`, `db-intel.json`, `domain-intel.json` |

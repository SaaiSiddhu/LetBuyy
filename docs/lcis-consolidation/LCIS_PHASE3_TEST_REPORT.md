# LCIS Phase 3 Test Report

Total Phase 3 additions: **~245+ tests, 0 failures** across 5 packages (2 new + 3 extended). All typecheck clean.

Phase 2 total was 356. Combined Phase 1+2+3 total: **~600+ tests, 0 failures** across 8 LCIS packages.

Test runner: `tsx --test` (Node.js built-in test runner).

---

## Per-Package Breakdown

| Package | Test file(s) | Tests | Notes |
|---------|-------------|-------|-------|
| `@letbuyy/lcis-adapters` | `test/shared.test.ts`, `test/supabase.test.ts`, `test/github.test.ts`, `test/cloudflare.test.ts`, `test/vercel.test.ts`, `test/contract.test.ts` | ~172 | New package |
| `@letbuyy/lcis-live` | `test/live.test.ts` | ~55 | New package |
| `@letbuyy/lcis-cli` | `test/cli.test.ts` (extended) | +~8 | Live commands added |
| `@letbuyy/lcis-mcp` | `test/tools.test.ts` (extended) | +~5 | Live MCP tools added |
| `services/lcis-api` | `test/app.test.ts` (extended) | +~5 | Live API routes added |

---

## `@letbuyy/lcis-adapters` — ~172 Tests

### `test/shared.test.ts` — Shared platform components

**CredentialProvider**
- `check()` returns all variables as present when all are set
- `check()` returns `missing` list when env vars are absent
- `value()` returns the raw string when present
- `check()` with injectable env object (no process.env mutation)

**FetchHttpClient**
- Throws on host not in allowlist (before network call)
- Passes correct Authorization header to fetch
- Propagates `HttpError` with status + redacted URL on non-2xx
- 8-second `AbortSignal.timeout` is set on the request

**MockHttpClient**
- Returns canned response for matching URL pattern
- Returns 404 for unmatched URL

**SnapshotStore**
- `get()` returns null for expired entry (TTL eviction via `Map.delete`)
- `get()` returns snapshot for non-expired entry
- `set()` / `clear()` / `size()` behave correctly

**RateLimitManager**
- `tryAcquire()` returns true while tokens available
- `tryAcquire()` returns false when bucket exhausted
- Refills correctly with injectable clock

**AdapterHealthMonitor**
- `record()` accumulates success/error counts
- `state()` returns correct success rate and rolling latency average (last 50 samples)
- `all()` returns per-adapter summary

**AuditLogger**
- `record()` stores structured operation entry
- Operation types: `health | collect | verify | investigate`

**EvidenceBuilder**
- `observed()` produces correct evidence item via lcis-core
- `notConnected()` produces NOT_CONNECTED entry with env var name

**CorrelationEngine**
- `correlate()` with empty `facts[]` returns `correlatedFacts: []`
- `correlate()` intersects fact domain names with structural blast surface
- `confidence` stays in [0.2, 0.9] range
- `notConnected` list is returned when adapters are NOT_CONNECTED

### `test/supabase.test.ts` — Supabase adapter

- `health()` returns `NOT_CONNECTED` + `missingEnvVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']` when credentials absent
- `health()` returns `CONNECTED` when `probe()` responds 200
- `health()` returns `ERROR` when `probe()` throws
- `collect()` emits `LiveFact` per table, migration, policy, function
- `verify()` emits `schema-drift` finding when live table not in graph
- `verify()` emits `missing-rls` (severity `critical`) when tenant table has no policy
- `verify()` emits `broken-migration` (severity `high`) for `FAILED` migration status
- `verify()` emits `dangerous-policy` (severity `critical`) for `USING (true)` policy
- `verify()` emits `orphan-rpc` (severity `low`) for function not in graph
- `verify()` skips drift/rls checks gracefully when `db-intel.json` absent
- All checks are skipped and empty snapshot returned when `NOT_CONNECTED`

### `test/github.test.ts` — GitHub adapter

- `health()` returns `NOT_CONNECTED` + `missingEnvVars` when credentials absent
- `health()` returns `CONNECTED` when `probe()` to `/repos/{owner}/{repo}` succeeds
- `collect()` emits `LiveFact` per commit, PR, release, deployment, failed workflow run
- CODEOWNERS base64 decoding tested with mock response
- `verify()` emits `failed-workflow` (severity `high`) for failed runs
- `verify()` emits `stale-deployment` (severity `low`) for deployments > 7 days old

### `test/cloudflare.test.ts` — Cloudflare adapter

- `health()` returns `NOT_CONNECTED` when credentials absent
- `health()` returns `CONNECTED` when token verify endpoint returns `success: true`
- `collect()` emits `LiveFact` per worker, route, queue, KV namespace, R2 bucket
- Route fetch graceful degradation on zone-access error tested
- `verify()` emits `missing-route` (severity `medium`) for worker with no route
- `verify()` emits `routing-drift` (severity `high`) for route referencing missing worker
- `verify()` emits `queue-backlog` as `info` with NOT_CONNECTED note

### `test/vercel.test.ts` — Vercel adapter

- `health()` returns `NOT_CONNECTED` when `VERCEL_TOKEN` absent
- `health()` returns `CONNECTED` when `/v2/user` probe succeeds
- `collect()` emits `LiveFact` per project, deployment, domain
- Domain fetch failure per project is non-fatal (tested with mixed mock)
- `verify()` emits `failed-deployment` severity `high` for ERROR state, `medium` for CANCELED
- `verify()` emits `stale-deployment` for > 7 days old
- `verify()` emits `build-drift` for project without framework
- `verify()` emits `domain-drift` for unverified domain

### `test/contract.test.ts` — Read-only enforcement

- `ReadOnlyHttpClient` interface has no `post`, `put`, `patch`, `delete` method
- `FetchHttpClient` does not call `fetch` with a non-GET method
- No adapter source imports `child_process`, `fs`, or `node:fs`
- `CredentialProvider.value()` result does not appear in `HealthResult` fields
- All adapter `gather()` calls use only the `ReadOnlyHttpClient.get()` method

---

## `@letbuyy/lcis-live` — ~55 Tests

### `test/live.test.ts`

**createLivePlatform + factory**
- Wires 4 adapters by default
- Accepts injectable adapters, engine, and `now` for testing
- Each adapter gets the correct host allowlist

**LivePlatform.health()**
- Runs health checks in parallel
- Records results in `AdapterHealthMonitor`
- Returns `overall: NOT_CONNECTED` when all adapters NOT_CONNECTED
- Returns `overall: CONNECTED` when all adapters CONNECTED
- Returns `overall: DEGRADED` when mixed

**LivePlatform.status()**
- Returns cached snapshot within TTL
- Calls adapter `collect()` after TTL expiry

**LivePlatform.verify()**
- Runs all adapter `verify()` calls without a name arg
- Runs only the named adapter's `verify()` with a name arg

**LivePlatform.investigate()**
- Collects only from CONNECTED adapters
- Lists NOT_CONNECTED adapters in `investigation.notConnected`
- Passes collected facts to `CorrelationEngine`
- Returns `Investigation` with correct shape

**LivePlatform.observability()**
- Returns `AdapterHealthMonitor.all()` output

---

## Extended Packages — CLI / MCP / API

### `@letbuyy/lcis-cli` (+~8 tests)

- `lcis live health` command returns structured output
- `lcis live status` command returns per-adapter status
- `lcis live investigate <subject>` command returns investigation
- `lcis db status` / `lcis db drift` subcommands route to SupabaseAdapter
- `lcis github status` / `lcis cloudflare status` / `lcis vercel status` commands exist

### `@letbuyy/lcis-mcp` (+~5 tests)

- `lcis_live_status` tool handler returns `ToolResult` with adapter statuses
- `lcis_live_investigate` tool handler returns `ToolResult` with investigation
- `lcis_db_health` tool returns SupabaseAdapter health + findings
- `lcis_recent_changes` tool returns GitHub facts
- `lcis_deployment_status` tool returns GitHub + Vercel combined status

### `services/lcis-api` (+~5 tests)

- `GET /live/health` responds 200 with `LcisEnvelope`
- `GET /live/status` responds 200 with adapter snapshot array
- `POST /live/investigate` with `{ subject }` responds 200 with investigation
- `GET /db/status` responds 200 with Supabase health + findings
- `GET /github/status` / `GET /cloudflare/status` / `GET /vercel/status` each respond 200

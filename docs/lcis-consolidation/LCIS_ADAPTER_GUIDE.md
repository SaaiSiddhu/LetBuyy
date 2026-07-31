# LCIS Adapter Guide

Per-adapter reference: credentials, what is read, what findings are emitted, and how to access each adapter.

---

## Connecting Adapters — Environment Variables

Set these in your local environment (or CI secrets). LCIS reads presence only — values are used exclusively in outbound Authorization headers.

| Adapter | Env var | Required? | Notes |
|---------|---------|-----------|-------|
| Supabase | `SUPABASE_URL` | Yes | Project URL (e.g. `https://abc.supabase.co`) |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role JWT; gates PostgREST + Management API |
| Supabase | `SUPABASE_ACCESS_TOKEN` | Optional | Personal access token; gates Management API (migrations, policies, functions). Without it, only PostgREST table list is available. |
| GitHub | `GITHUB_TOKEN` | Yes | Fine-grained or classic PAT with `repo` read scope |
| GitHub | `GITHUB_REPOSITORY` | Yes | `owner/repo` format (e.g. `letbuyy-org/letbuyy-store`) |
| Cloudflare | `CLOUDFLARE_API_TOKEN` | Yes | Scoped to Account Read + Workers Read + Queues Read |
| Cloudflare | `CLOUDFLARE_ACCOUNT_ID` | Yes | Account ID from the Cloudflare dashboard |
| Vercel | `VERCEL_TOKEN` | Yes | Personal or team token with read access |
| Vercel | `VERCEL_TEAM_ID` | Optional | If omitted, personal account is used |

With no credentials set: all adapters return `NOT_CONNECTED`; CLI, MCP tools, and API endpoints report `missingEnvVars` and return no fabricated values.

---

## Supabase Adapter

**Source:** `packages/lcis-adapters/src/supabase/`

### What it reads

| Source | Data | Requires |
|--------|------|---------|
| PostgREST `/rest/v1/` | OpenAPI root → live table list | `SUPABASE_SERVICE_ROLE_KEY` |
| Management API `/projects/{ref}/database/migrations` | Migration history, status per migration | `SUPABASE_ACCESS_TOKEN` |
| Management API `/projects/{ref}/database/policies` | Row-level security policies (name, table, command, USING definition) | `SUPABASE_ACCESS_TOKEN` |
| Management API `/projects/{ref}/database/functions` | DB functions (name, language, return_type, security_definer flag) | `SUPABASE_ACCESS_TOKEN` |
| Management API `/projects/{ref}/database/extensions` | Installed extensions (read; no per-item facts emitted) | `SUPABASE_ACCESS_TOKEN` |

### Findings (`verify()`)

| Finding key | Severity | Condition |
|-------------|----------|-----------|
| `schema-drift` | `medium` | Table in live DB not in `db-intel.json` graph, or in graph not in live DB |
| `missing-rls` | `critical` | Tenant tables in graph have no live RLS policy |
| `broken-migration` | `high` | Migration with status `FAILED` or `FAILED_CLEANUP` |
| `dangerous-policy` | `critical` | RLS policy with `USING (true)` on a tenant table |
| `orphan-rpc` | `low` | Live DB function not referenced in the `db-intel.json` RPC graph |

Drift and missing-RLS checks require `graphify-out/db-intel.json`. If the artifact is absent, those checks are skipped gracefully.

### Commands and endpoints

```
# CLI
lcis db status        # health + CONNECTED/NOT_CONNECTED + missingEnvVars
lcis db tables        # live table list from PostgREST
lcis db policies      # RLS policies from Management API
lcis db migrations    # migration history and status
lcis db drift         # schema-drift + missing-rls findings
lcis db health        # same as "lcis db status" with full AdapterHealth detail

# API
GET /db/status        # HealthResult + VerificationFinding[]
```

---

## GitHub Adapter

**Source:** `packages/lcis-adapters/src/github/`

### What it reads

| Resource | Limit | Notes |
|----------|-------|-------|
| Recent commits | 10 | Sorted newest-first |
| Open pull requests | 10 | State: open |
| Recent releases | 5 | — |
| Deployments | 10 | All environments |
| Workflow runs | 20 (failed only) | `conclusion: failure` filter applied |
| CODEOWNERS | 1 file | Checked at root `/` then `/.github/`; base64-decoded |

Host allowlist: `api.github.com` only.

### Findings (`verify()`)

| Finding key | Severity | Condition |
|-------------|----------|-----------|
| `failed-workflow` | `high` | Any workflow run with `conclusion: failure` in the last 20 |
| `deployment-timeline` | `info` | Summary of recent deployment activity |
| `stale-deployment` | `low` | Most recent deployment is more than 7 days old |

### Commands and endpoints

```
# CLI
lcis github status    # health + recent facts summary

# API
GET /github/status    # HealthResult + AdapterSnapshot facts
```

---

## Cloudflare Adapter

**Source:** `packages/lcis-adapters/src/cloudflare/`

### What it reads

| Resource | Notes |
|----------|-------|
| Worker scripts | Account-level list |
| Routes | Account-level; gracefully degrades on zone-access errors |
| Queues | Name and ID; backlog/message-count NOT CONNECTED (requires Analytics Engine API) |
| KV namespaces | Name and ID |
| R2 buckets | Name only |

Host allowlist: `api.cloudflare.com` only.

**Honest gap:** Queue backlog metrics require the Cloudflare Analytics Engine API (a separate credential scope). The adapter documents this as `NOT CONNECTED` in the `queue-backlog` finding rather than returning a zero or estimate.

### Findings (`verify()`)

| Finding key | Severity | Condition |
|-------------|----------|-----------|
| `missing-route` | `medium` | Worker script has no associated route |
| `routing-drift` | `high` | Route references a worker that no longer exists |
| `queue-backlog` | `info` | Emitted as NOT CONNECTED; exact source: Analytics Engine API |
| `worker-inventory` | `info` | Summary count of workers, routes, queues |

### Commands and endpoints

```
# CLI
lcis cloudflare status    # health + worker/route/queue inventory

# API
GET /cloudflare/status    # HealthResult + AdapterSnapshot facts + VerificationFinding[]
```

---

## Vercel Adapter

**Source:** `packages/lcis-adapters/src/vercel/`

### What it reads

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Projects | `GET /v9/projects` | Page 1 only; full history NOT CONNECTED |
| Deployments | `GET /v6/deployments` | Sorted newest-first; page 1 only |
| Domains per project | `GET /v9/projects/{id}/domains` | Per-project; domain fetch failure is non-fatal |

Host allowlist: `api.vercel.com` only.

**Honest gap:** The Vercel API paginates; the adapter reads page 1 only. Full deployment history is documented as NOT CONNECTED.

### Findings (`verify()`)

| Finding key | Severity | Condition |
|-------------|----------|-----------|
| `failed-deployment` | `high` (ERROR) / `medium` (CANCELED) | Deployment in ERROR or CANCELED state |
| `stale-deployment` | `low` | Most recent deployment is more than 7 days old |
| `build-drift` | `low` | Project has no `framework` set |
| `domain-drift` | `medium` | Project has an unverified domain |
| `project-inventory` | `info` | Summary count of projects, deployments, domains |

### Commands and endpoints

```
# CLI
lcis vercel status    # health + project/deployment/domain summary

# API
GET /vercel/status    # HealthResult + AdapterSnapshot facts + VerificationFinding[]
```

---

## Cross-Adapter Investigation

`lcis investigate <subject>` (CLI) and `POST /live/investigate` (API) run `LivePlatform.investigate(subject)`. The platform:

1. Collects `LiveFact[]` from every CONNECTED adapter.
2. Passes facts + subject to `CorrelationEngine`, which queries lcis-core for blast radius and cross-domain context.
3. Returns an `Investigation` with `correlatedFacts`, `otherFacts`, `evidence`, `confidence`, and an honest `notConnected[]` list of adapters that could not contribute.

```
# CLI
lcis investigate database    # Supabase + structural blast for "database"
lcis investigate deployment  # GitHub + Vercel + structural blast for "deployment"
lcis investigate edge        # Cloudflare + structural blast for "edge"

# API
POST /live/investigate
{ "subject": "payments" }
```

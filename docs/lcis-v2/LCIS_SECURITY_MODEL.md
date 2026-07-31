# LCIS V2 — Security Model

**Version:** 2.0.0  
**Last Updated:** 2026-06-19  
**Owner:** @saai-sidd  
**Classification:** Internal — Architecture Documentation

---

## Threat Model

### What LCIS V2 Can Access

LCIS V2 has intentionally narrow access. It reads only — it never writes to LetBuyy application data, executes payments, modifies the database, or changes production configuration.

| Access | Mechanism | Scope |
|--------|-----------|-------|
| Repository files | Direct filesystem read (Node.js `fs`) | Read-only; all repo `.md`, `.json`, `.mjs` files |
| V1 LCIS API | HTTP GET to `localhost:3333` | Structural intelligence only; V1 has no write endpoints |
| Qdrant (Memory Engine) | `@qdrant/js-client-rest` | LCIS-managed collections only; no application data |
| OpenAI API | HTTPS POST to `api.openai.com/v1/embeddings` | Text embedding only; no completions, no chat |
| GraphRAG | Python subprocess (`python3 -m graphrag`) | Reads docs; writes local parquet files; no network in build |
| Browser (Playwright) | Headless Chromium | Outbound-only navigation; no authentication, no payment execution |
| OTel Collector | OTLP HTTP POST to `:4318` | Telemetry sink only; LCIS does not read from ClickHouse |
| Repo credentials | None | LCIS V2 has no database credentials, no Supabase key, no Razorpay key |

### What LCIS V2 Cannot Access

| Cannot Access | Why |
|-------------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Not in LCIS V2 env; only app runtimes hold it |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Not in LCIS V2 env; checkout runtime only |
| `CUSTOMER_SESSION_SECRET` | Not in LCIS V2 env; identity-platform only |
| `LETBUYY_IDENTITY_*` JWKS | Not in LCIS V2 env; merchant auth only |
| Production database | No direct DB connection; V1 parses migrations, not live DB |
| Customer PII | Not indexed; MemoryIndexer reads only `.md`/governance docs |
| Payment records | Never accessed; canonical-ledger-only validator covers app layer |
| Merchant secrets | Not in LCIS V2 env |

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│  LCIS V2 Trust Zone (localhost:3334)                                │
│  ├── Intelligence API — no credentials except OPENAI_API_KEY        │
│  │                       and QDRANT_API_KEY                         │
│  ├── Memory Engine — reads/writes LCIS-managed Qdrant collections   │
│  ├── Knowledge Engine — spawns Python crawlers; outbound HTTP only  │
│  ├── Graph Engine — spawns Python subprocess; no network in build   │
│  ├── Browser Intelligence — outbound-only Chromium; no auth        │
│  └── Observability — emits telemetry to OTel Collector; no reads   │
│                                                                      │
│  ┌────────────────────────────────────────────┐                     │
│  │  Docker Bridge (letbuyy-intelligence)       │                     │
│  │  ├── Qdrant :6333/:6334 (internal)         │                     │
│  │  ├── ClickHouse :9000/:8123 (internal)     │                     │
│  │  ├── OTel Collector :4317/:4318 (internal) │                     │
│  │  └── SigNoz Query :8080 (internal)         │                     │
│  └────────────────────────────────────────────┘                     │
│                                                                      │
│  External (outbound only):                                          │
│  ├── OpenAI API (api.openai.com) — TLS, API key in Authorization   │
│  ├── Knowledge crawl targets — robots.txt-compliant HTTP            │
│  └── Storefront URLs for Browser Intelligence — TLS, read-only     │
└─────────────────────────────────────────────────────────────────────┘
         ↑ no inbound connections from LCIS to app runtimes
         ↓ V1 LCIS :3333 is a dependency (read-only GET)
```

---

## Credential Security

### Credential Surface

LCIS V2 requires only two credentials:

| Credential | Env Var | Where Set | Never Committed |
|-----------|---------|----------|----------------|
| OpenAI API key | `OPENAI_API_KEY` | `.env` (gitignored) | `.gitignore` entry: `.env` |
| Qdrant API key | `QDRANT_API_KEY` | `.env` (gitignored) | `.gitignore` entry: `.env` |

`.env.example` contains only placeholder values:
```
OPENAI_API_KEY=sk-...
QDRANT_API_KEY=
```

The `sk-...` placeholder is never a real key. `setup.sh` validates `OPENAI_API_KEY` is set (non-empty) before proceeding; it exits with a clear error if the placeholder was not replaced.

### `.gitignore` Coverage

`tools/central-intelligence/.gitignore` lists:
```
node_modules/
.env
*.pyc
__pycache__/
graph-engine/graphrag/input/
graph-engine/graphrag/output/
graph-engine/graphrag/cache/
graph-engine/graphrag/logs/
*.log
```

`.env` is explicitly listed. Git will refuse to stage it. The root `.gitignore` provides additional coverage; there is no `!.env` override anywhere in the repository.

### GraphRAG and OpenAI

GraphRAG uses `OPENAI_API_KEY` for entity extraction during index builds. The key is passed via environment variable to the `python3 -m graphrag index` subprocess — it is never written to disk and never appears in GraphRAG's own output artifacts.

### Qdrant Authentication

In local development, `QDRANT_API_KEY` is blank — Qdrant runs without authentication. This is acceptable because Qdrant is bound to `localhost` only on the Docker bridge network.

In production (Qdrant Cloud), `QDRANT_API_KEY` must be set. The `docker-compose.yml` passes it as:
```yaml
environment:
  QDRANT__SERVICE__API_KEY: "${QDRANT_API_KEY:-}"
```
This enables Qdrant's built-in API key authentication. All requests from `MemoryService` include the key in the `@qdrant/js-client-rest` client constructor.

### Key Rotation

1. Generate a new key on OpenAI Platform or Qdrant Cloud
2. Update `tools/central-intelligence/.env`
3. Restart the Intelligence API (`npm start`)
4. Verify with `npm run memory:health`

No other services need the LCIS V2 credentials.

---

## Browser Intelligence Constraints

Browser Intelligence uses Playwright (Chromium) to observe live storefronts. The following constraints are enforced in code, not policy:

### Headless-Only Default

`BrowserIntelligenceEngine.mjs` line:
```javascript
const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? 'true') !== 'false';
```

The default is `true`. Setting `PLAYWRIGHT_HEADLESS=false` requires explicit env var override — it is never the default.

### No Payment Execution

`CheckoutAgent` (`browser-intelligence/agents/CheckoutAgent.mjs`) walks the checkout flow but halts before any Razorpay or payment gateway redirect. The implementation checks for payment gateway URL patterns and stops. Real order creation or payment authorization never occurs.

### No Session Injection

`SessionPool.acquire()` creates a fresh browser context for every operation:
```javascript
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  userAgent: 'Mozilla/5.0 (compatible; LCIS-BrowserIntelligence/2.0; ...)',
  ignoreHTTPSErrors: false,
});
```

No cookies are pre-loaded. No `storageState` is passed. Each session starts completely unauthenticated.

### Transparent User-Agent

Every browser session identifies as:
```
Mozilla/5.0 (compatible; LCIS-BrowserIntelligence/2.0; +https://letbuyy.com)
```

This is not impersonating a real browser. Site operators can identify and block this user-agent if desired.

### Evidence Stored Locally Only

All evidence (screenshots, HTML, console logs) is written to `graphify-out/browser-evidence/<date>/<label>/` on the local filesystem. Nothing is transmitted externally. Evidence is ephemeral — it is cleaned periodically and is not indexed into Qdrant.

### `ignoreHTTPSErrors: false`

TLS certificate errors are not suppressed. If a storefront has an expired or invalid certificate, the navigation fails rather than proceeding insecurely.

---

## Knowledge Crawl Security

### robots.txt Compliance

The Python crawlers (Crawl4AI) respect `robots.txt` by default. No override flag is set in any crawler configuration. If `robots.txt` disallows the LCIS user-agent, the crawler will not fetch those paths.

### Rate Limiting

Crawlers include `wait_for` delays between requests. No crawler performs concurrent bulk fetching that could constitute a denial-of-service. The schedule in `KnowledgeScheduler` ensures at most one crawl per source at a time.

### No Authenticated Crawls

No crawler script injects authentication tokens, session cookies, or API keys into crawl requests. All crawled content is publicly accessible documentation.

### External Targets Only

Crawlers target external documentation sites (Next.js docs, Supabase docs, Razorpay docs, etc.) and LetBuyy public documentation. They do not crawl internal LetBuyy application endpoints or the Supabase database.

---

## Graph Data Security

### No PII Indexed

`MemoryIndexer` indexes only:
- Governance documents (`AGENTS.md`, `LETBUYY_CONSTITUTION.md`, `CLAUDE.md`)
- Operational runbooks (docs/governance/, docs/central-intelligence/)
- Security documentation (infrastructure/security/, infrastructure/observability/)
- LCIS V2 docs (docs/lcis-v2/)

None of these contain customer PII, payment card data, or merchant credentials. The indexer does not process application logs, database records, or API responses.

### GraphRAG Input Screening

GraphRAG's input directory (`graph-engine/graphrag/input/`) is populated by `GraphBuilder.copyToInput()`, which copies only `.md`, `.txt`, and `.json` files from explicitly listed documentation directories. Application source code, migration SQL, and configuration files are not included.

### Qdrant Payload Content

Every vector point stored in Qdrant has a `payload` containing:
```json
{
  "text": "<chunk text>",
  "source": "relative/path/to/doc.md",
  "type": "markdown",
  "domain": "architecture",
  "timestamp": 1718755200000,
  "chunkIndex": 0,
  "totalChunks": 12,
  "filename": "AGENTS.md",
  "docType": "agents-rulebook"
}
```

No user IDs, email addresses, phone numbers, payment data, or session tokens are present in any payload.

---

## Observability PII Policy

### What Is Allowed in Telemetry

Only `site_id` is permitted as a tenant identifier in spans, metrics, and logs. `site_id` is the UUID primary key of the `sites` table — not a human-readable identifier.

### What the OTel Collector Deletes

The `attributes/redaction` processor in `observability/otel-collector-signoz.yml` deletes these attribute keys before export to ClickHouse:

| Attribute | Category |
|-----------|---------|
| `authorization` | Auth header |
| `cookie` | Session cookie |
| `set-cookie` | Set-Cookie response header |
| `x-api-key` | API key header |
| `enduser.id` | OpenTelemetry PII attribute |
| `enduser.email` | OpenTelemetry PII attribute |
| `user.email` | Custom PII attribute |
| `user.name` | Custom PII attribute |

This redaction is enforced at the collector, not in application code. Even if an instrumented service accidentally emits one of these fields, the collector removes it before storage.

### ClickHouse Data Residency

ClickHouse stores telemetry in the Docker volume `lcis-clickhouse/clickhouse_data`. In production, SigNoz Cloud handles storage with its own data residency guarantees. Trace data retention is configured at 90 days (`ttl: 2160` hours in the collector config).

---

## Network Security

### Local Development

All infrastructure services (Qdrant, ClickHouse, OTel Collector, SigNoz) run on the `letbuyy-intelligence` Docker bridge network. Port bindings:

| Service | Host Binding | Scope |
|---------|-------------|-------|
| Qdrant :6333 | `127.0.0.1:6333` | Localhost only |
| Qdrant :6334 (gRPC) | `127.0.0.1:6334` | Localhost only |
| ClickHouse :9000 | `127.0.0.1:9000` | Localhost only |
| ClickHouse :8123 | `127.0.0.1:8123` | Localhost only |
| OTel :4317 (gRPC) | `127.0.0.1:4317` | Localhost only |
| OTel :4318 (HTTP) | `127.0.0.1:4318` | Localhost only |
| SigNoz Query :8080 | `127.0.0.1:8080` | Localhost only |
| SigNoz UI :3301 | `127.0.0.1:3301` | Localhost only |
| Intelligence API :3334 | `0.0.0.0:3334` | All interfaces (dev only) |

In production, only the Intelligence API (:3334) is exposed — all infrastructure services are internal or cloud-managed.

### Production Network Topology

```
Internet
  ↓
  ☐ Intelligence API :3334 (behind reverse proxy / VPN)
    ↓
  ☐ Qdrant Cloud (HTTPS, authenticated)
  ☐ SigNoz Cloud (HTTPS, authenticated)
  ☐ OpenAI API (HTTPS, API key)
  ☐ V1 LCIS :3333 (localhost, no external exposure)
```

Qdrant and SigNoz are never directly exposed to the internet in production.

### CORS Policy

The Intelligence API allows cross-origin requests only from declared development origins:
```javascript
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3333',
  'http://localhost:3334',
]);
```

Requests from any other origin get `Access-Control-Allow-Origin: http://localhost:3333` — a fixed non-matching value that browsers reject. There is no wildcard (`*`) origin.

---

## Access Control

LCIS V2 has no authentication layer on the Intelligence API itself. This is intentional for local development. The API is designed for:
- Developer workstations (localhost access only)
- Claude Code CLI sessions (same machine)
- CI pipelines (localhost within the same runner)

In production, access must be controlled at the network level (VPN, IP allowlist, or reverse proxy with auth). The API itself does not implement auth to keep the operator model simple.

---

## Audit Trail

### What Is Logged

| Event | Where Logged | Format |
|-------|-------------|--------|
| Memory indexing start/completion | stdout | `[MemoryIndexer] indexAll complete — total chunks: N` |
| Qdrant collection creation | stdout | `[MemoryService] Created collection: architecture` |
| Knowledge crawl start | stdout | `[KnowledgeAcquisitionService] Starting crawl for source 'X'` |
| GraphRAG index build | stdout + `graph-engine/graphrag/logs/` | Build progress and entity counts |
| Intelligence API request errors | stderr | `[LCIS-V2] Handler error on GET /intelligence/...` |
| Memory NOT CONNECTED (no key) | stdout (warn) | `[MemoryService] embed: OPENAI_API_KEY NOT CONNECTED` |
| Browser evidence captured | `graphify-out/browser-evidence/meta.json` | Per-run JSON artifact |
| OTel traces (when connected) | SigNoz (ClickHouse) | Structured traces with `site_id` only |

### What Is Not Logged

- Query text of `/intelligence/ask?q=` requests (only errors are logged)
- Qdrant search results (not retained beyond the API response)
- GraphRAG intermediate entity extractions (ephemeral; written to output/)
- Browser screenshots (stored locally in `browser-evidence/`; not transmitted)

---

## Safety Boundaries Summary

| Boundary | Enforcement | Location |
|---------|------------|---------|
| No payment execution | Checkout agent halts before gateway redirect | `browser-intelligence/agents/CheckoutAgent.mjs` |
| No PII in telemetry | `attributes/redaction` processor deletes PII fields | `observability/otel-collector-signoz.yml` |
| No PII indexed | MemoryIndexer only reads governance/runbook/security docs | `memory-engine/MemoryIndexer.mjs` |
| No auth credentials in LCIS env | Supabase, Razorpay, JWKS keys not in `.env.example` | `tools/central-intelligence/.env.example` |
| `.env` not committed | Explicit `.gitignore` entry | `tools/central-intelligence/.gitignore` |
| Headless browser default | `PLAYWRIGHT_HEADLESS=true` hardcoded default | `browser-intelligence/BrowserIntelligenceEngine.mjs` |
| No authenticated crawls | No session injection in `SessionPool.acquire()` | `browser-intelligence/BrowserIntelligenceEngine.mjs` |
| robots.txt compliance | Crawl4AI default behavior | Python crawler scripts |
| Qdrant on Docker bridge | Port bindings to localhost | `docker-compose.yml` |
| CORS restricted | Explicit allowlist, no wildcard | `intelligence-api/server.mjs` |
| Qdrant API key via env | `QDRANT__SERVICE__API_KEY` from `${QDRANT_API_KEY:-}` | `docker-compose.yml` |

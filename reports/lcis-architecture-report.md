# LCIS Architecture Report
**LetBuyy Central Intelligence System — Complete Architectural Analysis**
*Date: 2026-06-19 | Source: tools/graph-server/, graphify-out/, docs/central-intelligence/*

---

## 1. Conceptual Architecture

### 1.1 The Core Philosophy

LCIS is built on three philosophical pillars:

**1. Repository-as-truth.** The source code, database migrations, and infrastructure definitions are the single source of truth. LCIS does not maintain a separate knowledge database — it re-derives all intelligence from the repository on each build run.

**2. Honesty over completeness.** Live values (error rates, GMV, merchant counts) are explicitly marked `NOT CONNECTED` with the exact adapter source. The system never fabricates operational metrics. This makes every answer trustworthy.

**3. Query-first, scan-last.** Every question an AI agent or engineer might ask is answerable via a single API call. The repository scan is the fallback of last resort, not the first action.

### 1.2 The 13 Intelligence Layers

LCIS was built incrementally. Each version added a new layer:

| Layer | Version | Capability | Primary Files |
|-------|---------|-----------|---------------|
| **Code Graph** | V1 | 52,246 nodes, 66,761 edges — TS/TSX/Dart symbols, imports, routes | `graphify-out/graph.json` |
| **DB Intelligence** | V2 | 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes | `tools/graph-server/db-intel.mjs` |
| **Infrastructure** | V2 | 4 Workers, 5 queues, 5 Vercel apps, 19 secrets, Crons | `tools/graph-server/infra-intel.mjs` |
| **Domain Intelligence** | V3 | 22 business domains, cross-domain blast radius, coupling matrix | `tools/graph-server/domain-intel.mjs` |
| **Runtime Intelligence** | V4 | Worker→queue→cron→RPC→table chains, deployment state, memory | `tools/graph-server/runtime-intel.mjs` |
| **Live Operating** | V5 | Merchant health, revenue model, security posture, production readiness | `tools/graph-server/merchant-intelligence.mjs` |
| **OMEGA** | OMEGA | 13-layer unified brain, fix engine, cost/telemetry/memory | `tools/graph-server/unified-intelligence-engine.mjs` |
| **Explain Mode** | V6 | Human+AI dual mode, per-domain onboarding, AI context packs | `tools/graph-server/explain-intel.mjs` |
| **Genesis Controls** | Genesis | Lineage, full trace, 16-perspective workspace, control centers | `tools/graph-server/launch-command-center.mjs` |
| **INFINITY** | INFINITY | 8 autonomous detectors, 6 predictors, 11-metric ingestion map | `tools/graph-server/detection-prediction-intel.mjs` |
| **Live Federation** | X | 7 provider adapters, live health per domain, autonomous ops | `tools/graph-server/live-adapters.mjs` |
| **Knowledge Graphs** | V6+ | 10 graph types (business/journey/security/ownership/revenue/ai/…) | `tools/graph-server/knowledge-graphs.mjs` |
| **Business Flow** | V11 | 10 business journeys, flow graph, investor/founder/developer modes | `tools/graph-server/business-flow-intel.mjs` |

### 1.3 Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        SOURCE INPUTS                         │
├─────────────────┬─────────────────┬──────────────────────────┤
│  Source Code    │   Database SQL  │    Infrastructure        │
│  TypeScript/TSX │   Migrations    │    Wrangler configs      │
│  Dart/Flutter   │   SQL functions │    CODEOWNERS            │
│  Route files    │   RLS policies  │    GitHub Actions        │
└────────┬────────┴────────┬────────┴──────────────┬───────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  graphify   │  │  db-intel.mjs   │  │   infra-intel.mjs    │
│ (tree-sitter│  │  (SQL parser +  │  │  (wrangler + CI +    │
│  code scan) │  │   grep patterns)│  │   CODEOWNERS parser) │
└──────┬──────┘  └────────┬────────┘  └───────────┬──────────┘
       │                  │                        │
       ▼                  ▼                        ▼
┌──────────────┐ ┌────────────────┐ ┌──────────────────────────┐
│ graph.json   │ │ db-intel.json  │ │    infra-intel.json      │
│ 52k nodes    │ │ 414 tables     │ │    4 workers, 5 queues   │
│ 66k edges    │ │ 156 RPCs       │ │    5 Vercel apps         │
│              │ │ 651 policies   │ │    19 secrets            │
└──────┬───────┘ └───────┬────────┘ └────────────┬─────────────┘
       │                 │                        │
       └─────────────────┴────────────────────────┘
                                │
                                ▼
              ┌────────────────────────────────────────┐
              │      domain-intel.mjs (V3 layer)        │
              │   Composes graph + DB + infra into       │
              │   22 business domain models              │
              └────────────────┬───────────────────────┘
                               │
                               ▼
          ┌────────────────────────────────────────────────┐
          │        81 Intelligence Engines                   │
          │    (V4→V5→OMEGA→Genesis→INFINITY→X layers)      │
          │  Each reads the 4 base artifacts + computes      │
          │  specialized intelligence                        │
          └────────────────────┬───────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────────┐
              │           server.mjs                    │
              │    90+ REST API endpoints               │
              │    localhost:3333                       │
              │    Atlas visualization UI               │
              └────────────────────────────────────────┘
```

---

## 2. The Four Primary Data Sources

### 2.1 graph.json — The Code Graph

**Generated by:** `graphify` (external tool, tree-sitter based)
**Command:** `pnpm graph:update` → runs `graphify update .`
**Location:** `graphify-out/graph.json` (gitignored)
**Size:** 52,246 nodes, 66,761 edges

**Node schema:**
```json
{
  "id": "unique-node-id",
  "label": "FunctionName",
  "source_file": "apps/storefront-runtime/src/app/page.tsx",
  "source_location": "line:col",
  "community": "42",
  "file_type": "tsx"
}
```

**Edge schema:**
```json
{
  "source": "node-id-A",
  "target": "node-id-B",
  "relation": "imports | calls | references | defines | ..."
}
```

**15 typed edge relations:**
`imports`, `imports_from`, `re_exports`, `exports`, `calls`, `method`, `references`, `defines`, `contains`, `inherits`, `extends`, `implements`, `mixes_in`, `navigates`, `path`

**Community detection:** Graphify automatically groups nodes into communities (clusters). LCIS maps community IDs to workspace names (e.g., community 42 → "API Gateway").

### 2.2 db-intel.json — Database Intelligence

**Generated by:** `tools/graph-server/db-intel.mjs` (custom SQL scanner)
**Command:** `pnpm graph:db`
**Location:** `graphify-out/db-intel.json` (gitignored)

**Schema:**
```json
{
  "summary": {
    "tables": 414,
    "functions": 156,
    "policies": 651,
    "triggers": 395,
    "indexes": 826,
    "tenantTables": "N",
    "forceRlsTables": "N",
    "moneyTablesPresent": ["payment_transactions", "refunds", ...],
    "tenantTablesWithoutRls": ["..."]
  },
  "tables": [{
    "name": "orders",
    "columns": 28,
    "rls": true,
    "force": true,
    "tenant": true,
    "money": false,
    "policies": ["..."],
    "triggers": ["..."],
    "indexes": 14
  }],
  "functions": [{
    "name": "create_checkout_order",
    "securityDefiner": true,
    "hasIdempotency": true,
    "forUpdate": true,
    "money": true,
    "touches": ["orders", "payment_transactions"],
    "callers": ["services/api-gateway/src/routes/checkout.ts"]
  }],
  "routeRpc": { "/v1/checkout": ["create_checkout_order"] },
  "routeTables": { "/v1/checkout": ["orders", "order_items"] }
}
```

**Generation method:** The extractor scans `database/supabase/migrations/*.sql` files, parses:
- `CREATE TABLE` statements → table metadata
- `CREATE POLICY` statements → RLS policy coverage
- `CREATE OR REPLACE FUNCTION` statements → RPC definitions
- `SECURITY DEFINER` keywords → privileged functions
- `idempotency_key` column presence → idempotency detection
- `FOR UPDATE` clauses → concurrency lock detection
- Money table names → money path detection

**Cross-references computed:**
- Route → RPC: from `.rpc('function_name')` call sites in gateway source
- RPC → Table: from SQL body table references in migration SQL

### 2.3 infra-intel.json — Infrastructure Intelligence

**Generated by:** `tools/graph-server/infra-intel.mjs`
**Command:** `pnpm graph:infra`
**Location:** `graphify-out/infra-intel.json` (gitignored)

**Schema (summary):**
```json
{
  "summary": {
    "workers": 4,
    "queues": 5,
    "queueConsumers": ["..."],
    "queueProducers": ["..."],
    "deadLetterQueues": ["..."],
    "r2Buckets": ["..."],
    "hyperdriveBindings": ["..."],
    "vercelApps": 5,
    "secrets": 19,
    "hasMigrateGate": true,
    "cronJobs": ["..."]
  },
  "workers": [{ "name": "api-gateway", "queues": [...], "secrets": [...] }],
  "secrets": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", ...],
  "deploymentTargets": [...]
}
```

**Generation method:** Parses `wrangler.toml`/`wrangler.jsonc` files across all services for queue bindings, worker names, secret declarations, D1/R2 bindings, cron triggers.

### 2.4 domain-intel.json — Business Domain Intelligence

**Generated by:** `tools/graph-server/domain-intel.mjs`
**Command:** `pnpm graph:domain`
**Location:** `graphify-out/domain-intel.json` (gitignored)

**Schema:**
```json
{
  "summary": { "domains": 22, "edges": "N", "crossDomainEdges": "N" },
  "domains": [{
    "key": "payments",
    "label": "Payments",
    "routes": ["/v1/checkout/confirm-payment", ...],
    "rpcs": ["confirm_order_payment_with_ledger", ...],
    "tables": ["payment_transactions", "ledger_entries", ...],
    "queues": ["PAYMENT_QUEUE"],
    "workers": ["queue-workers"],
    "secrets": ["RAZORPAY_KEY_SECRET", ...],
    "money": true,
    "tenant": true,
    "owners": ["@saai-sidd"]
  }],
  "edges": [{ "from": "payments", "to": "orders", "type": "depends-on" }]
}
```

**Generation method:** Domain assignments are rule-based, matching file paths and symbol names against domain keyword patterns. Cross-domain edges are derived from RPC calls that touch tables in a different domain.

---

## 3. Server Architecture (server.mjs)

The LCIS server is a **zero-dependency Node.js HTTP server** (no Express, no Fastify). It:

1. **Loads all 4 base intelligence artifacts at startup** from `graphify-out/`
2. **Computes derived intelligence at startup** (50+ additional computations)
3. **Caches all results in memory** (never re-reads files per request)
4. **Serves REST API** via simple `if (p === '/api/X') return json(res, Y)` routing

**Startup sequence:**
```
1. Read graph.json → nodes[], links[]
2. Build indexes (byId Map, outAdj Map, inAdj Map, degree Map)
3. Read db-intel.json → dbIntel
4. Read infra-intel.json → infraIntel
5. Read domain-intel.json → domainIntel
6. Build/load V4 layer (runtimeIntel, memoryIntel, deploymentStateData, executionIntel)
7. Build/load V5 layer (runtimeObs, merchantIntelV5, revenueIntel, ...)
8. Load or build OMEGA layer (merchantHealth, customerV2, unifiedIntel, ...)
9. Build Genesis layer (envControl, dbControlGenesis, launchCenter, ...)
10. Build LCIS X (federationIntel, liveHealth)
11. Build INFINITY (detectPredict)
12. Start HTTP server on PORT 3333
```

**Pattern for each intelligence module:**
```javascript
const merchantHealth = loadOrBuild('merchant-health.json', buildMerchantHealth);
// If pre-built JSON exists in graphify-out/ → use it (fast)
// Otherwise → build it fresh (slower but always available)
```

---

## 4. API Surface (90+ Endpoints)

### 4.1 Foundation Layer (V1)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/stats` | Graph statistics (node/edge/community counts, freshness) |
| `GET /api/search?q=` | Fuzzy search over all 52k nodes by label or file path |
| `GET /api/node?id=` | Single node with its 1-hop neighborhood |
| `GET /api/neighbors?id=&depth=` | N-hop neighborhood graph |
| `GET /api/path?a=&b=` | Shortest path between two nodes with typed edge explanations |
| `GET /api/graph-domain?key=` | All nodes matching a domain filter (payments/identity/themes/…) |
| `GET /api/atlas?limit=&domain=` | Force-directed layout for N nodes (up to 75k) |
| `GET /api/community?id=` | Community profile (name, hint, top nodes) |
| `GET /api/blast?q=` | Blast radius: who breaks if this node changes |
| `GET /api/health` | Server liveness check |

### 4.2 DB Intelligence Layer (V2)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/db` | Full DB summary + top tables + money RPCs |
| `GET /api/table?name=` | Single table trace (policies, triggers, indexes, callers) |
| `GET /api/rpc?name=` | Single RPC trace (body, tables it touches, callers) |
| `GET /api/policy?table=` | All RLS policies on a table |
| `GET /api/owner?q=` | CODEOWNERS lookup for a symbol or file path |
| `GET /api/infra` | Infrastructure summary |

### 4.3 Domain Intelligence Layer (V3)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/domains` | List all 22 business domains |
| `GET /api/domain?key=` | Single domain detail (routes, RPCs, tables, queues, secrets) |
| `GET /api/cross-domain?key=` | What domains break if this domain changes |
| `GET /api/payment` | Full payment flow (ledger RPCs, money tables, invariants) |
| `GET /api/security` | Security graph (auth, RLS, webhook, tenant) |
| `GET /api/deployment` | Deployment intelligence (targets, workers, migrations) |
| `GET /api/incident?domain=` | Incident trace for a domain |
| `GET /api/merchant` | Merchant lifecycle intelligence |
| `GET /api/customer-journey` | 9-stage customer journey map |
| `GET /api/secrets` | Secret-to-domain-to-worker mapping |

### 4.4 Runtime Intelligence Layer (V4)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/runtime` | Worker→Queue→Cron→RPC→Table runtime topology |
| `GET /api/deployment-state` | Current deployment state (targets, rollback, gate) |
| `GET /api/change-impact?key=` | What changes if this domain is modified |
| `GET /api/execution` | Open blockers, gaps, launch verdict |
| `GET /api/merchant-operating` | Multi-tenant operating graph |
| `GET /api/incident-response?domain=` | Full incident response (root cause → rollback → owner) |
| `GET /api/memory?q=` | Architecture memory (why decisions were made, migration history) |

### 4.5 Live Operating Intelligence Layer (V5)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/runtime-intelligence` | Full runtime intelligence (Workers+Queues+Crons+RPCs+Tables+Merchants+Deployments) |
| `GET /api/merchant-intelligence` | Merchant operating stages, founding program |
| `GET /api/revenue-intelligence` | Revenue model, money RPCs, gift card liability |
| `GET /api/security-intelligence` | 11 security controls, cross-tenant candidates |
| `GET /api/incident-intelligence?domain=` | Per-domain incident intelligence |
| `GET /api/customer-intelligence` | Customer journey intelligence |
| `GET /api/production-readiness` | Structural production readiness (%) |
| `GET /api/decision-engine` | Ranked fix-next / blocks-launch / blocks-scale |

### 4.6 OMEGA Layer
| Endpoint | Purpose |
|----------|---------|
| `GET /api/merchant-health` | Merchant health scores (structural) |
| `GET /api/merchant-growth` | Merchant growth signals (structural) |
| `GET /api/merchant-adoption` | Merchant feature adoption (structural) |
| `GET /api/merchant-risk` | Merchant risk scores |
| `GET /api/merchant-churn` | Churn predisposition signals |
| `GET /api/customer-intelligence-v2` | 8-graph customer intelligence |
| `GET /api/revenue-v2` | Revenue v2 (ledger model, reconciliation RPCs) |
| `GET /api/cost-intelligence` | Infrastructure cost model |
| `GET /api/telemetry` | 12 telemetry adapters, metric sources |
| `GET /api/memory-v2` | Why decisions were made, architecture memory |
| `GET /api/fix-engine` | Fix plans with verify/test/rollback steps |
| `GET /api/unified-intelligence` | 13-layer unified brain |
| `GET /api/discovery-v2` | Autonomous drift detection |
| `GET /api/production-readiness-v2` | Deep readiness (10 dimensions) |
| `GET /api/decision-v2` | Enhanced decision engine v2 |

### 4.7 Explain / V6 Layer
| Endpoint | Purpose |
|----------|---------|
| `GET /api/explain` | Full explain intel (all 22 domain nodes + flows + onboarding) |
| `GET /api/explain?node=orders` | Single domain explain (purpose, importance, failure impact, owner, flow) |
| `GET /api/copilot?q=` | Natural-language domain routing |
| `GET /api/relationships?table=` | Full FK relationship map (705 FKs) |
| `GET /api/environment` | Local/staging/production environment declarations |
| `GET /api/graph?kind=` | Knowledge sub-graphs (business/security/ownership/revenue/ai/…) |
| `GET /api/operations` | Operations center (incidents/deploys/queues/workers) |

### 4.8 Genesis / Control Centers
| Endpoint | Purpose |
|----------|---------|
| `GET /api/connections` | Live connection status for all providers |
| `GET /api/production-health` | Production health (GREEN/YELLOW/RED per dimension) |
| `GET /api/audit` | Autonomous audit (missing auth/rate-limit/RLS candidates) |
| `GET /api/mission-control` | Executive mission control dashboard |
| `GET /api/atlas-v2?node=` | One-click composed answer for a domain |
| `GET /api/ai-context?pack=` | AI context packs (project/architecture/launch/feature/domain) |
| `GET /api/search-v2?q=` | Semantic natural-language search |
| `GET /api/ai-pack?target=` | Self-contained AI pack < 20k tokens for claude/gemini/codex/cursor |
| `GET /api/live-adapters` | Live provider adapter status |
| `GET /api/environment-registry` | Environment credential registry |
| `GET /api/diagnose?target=&error=` | Autonomous diagnosis (root cause, confidence) |
| `GET /api/runbook?domain=` | Full runbook (detection/diagnosis/recovery/rollback/verification) |
| `GET /api/lineage?entity=` | Full entity lineage (table↔rpc, route→rpc, worker→table) |
| `GET /api/database-control-genesis` | Database control center (schema/relationship/policy explorer) |
| `GET /api/environment-control` | Environment control center |
| `GET /api/infrastructure-control` | Infrastructure control center |
| `GET /api/commerce-control` | Commerce control center |
| `GET /api/incident-control?target=` | Incident control (root cause → rollback → owner) |
| `GET /api/launch-command-center` | Launch GO/NO-GO (10 readiness dimensions) |
| `GET /api/trace?entity=` | One-click full trace (entity→route→rpc→tables→policies→queues→emails→analytics→merchant) |
| `GET /api/ai-context-pack?target=` | AI context pack (Claude/Gemini/Codex/Cursor/OpenAI) |
| `GET /api/workspace?domain=` | 16-perspective domain workspace |
| `GET /api/related?domain=` | Related knowledge (domains/tables/routes/runbooks/docs/AI packs) |
| `GET /api/impact-score?domain=` | Impact/risk/recovery scores with affected APIs/tables/workers |

### 4.9 LCIS X — Live Federation + Autonomous Ops
| Endpoint | Purpose |
|----------|---------|
| `GET /api/federation?provider=` | Live provider federation (Supabase/Cloudflare/Vercel/GitHub/Resend/Razorpay/Turnstile) |
| `GET /api/live-graph` | Unified live graph across all providers |
| `GET /api/live-health?domain=` | Live health per domain (structural scores; live=NOT CONNECTED) |
| `GET /api/investigate?q=` | Autonomous investigation of a question |
| `GET /api/root-cause?domain=` | Root cause analysis |
| `GET /api/time-travel` | Time-travel (HEAD/last migration/last release) |
| `GET /api/executive-center` | Executive command center (Founder mode) |
| `GET /api/merchant-ops` | Merchant operations center |
| `GET /api/customer-ops` | Customer operations center |
| `GET /api/change-impact-live?domain=` | Pre-deployment change impact |
| `GET /api/release-intel` | Release intelligence (risk score, rollback availability) |
| `GET /api/observability` | Observability hub (logs/events/deploys/incidents/queues/workers) |
| `GET /api/ops-copilot?q=` | AI operations copilot |
| `GET /api/live?provider=` | Real read-only live probe (only if credentials present) |

### 4.10 V11 — Business Intelligence
| Endpoint | Purpose |
|----------|---------|
| `GET /api/business-flow?journey=` | 10 business journeys + flow graph |
| `GET /api/business-impact?domain=` | Plain-language business impact |
| `GET /api/investor` | Investor mode (platform/business/growth/revenue/risk) |
| `GET /api/developer` | New Developer mode (30-minute onboarding) |
| `GET /api/founder` | Founder mode (executive readiness) |

### 4.11 OMEGA Production OS
| Endpoint | Purpose |
|----------|---------|
| `GET /api/launch-status` | Per-area READY/AT RISK/BLOCKED (no manual status) |
| `GET /api/ai-ops` | AI Operations Commander (fix-next/will-break-next/blocks-launch) |

### 4.12 INFINITY — Autonomous Detection + Prediction
| Endpoint | Purpose |
|----------|---------|
| `GET /api/detection` | 8 autonomous detectors (checkout/payment/refund/worker/queue/db/webhook/deploy) |
| `GET /api/live-metrics` | 11-metric ingestion map |
| `GET /api/predict` | 6 predictors + what-will-fail-next |
| `GET /api/detection-prediction` | Full detection+prediction object |
| `GET /api/incident-timeline?domain=` | Incident timeline for a domain |

---

## 5. The Intelligence Engine Pattern

Every intelligence engine follows the same pattern:

```javascript
// tools/graph-server/example-intel.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function buildExampleIntel() {
  // 1. Load base artifacts
  const graph = JSON.parse(readFileSync(join(ROOT, 'graphify-out/graph.json'), 'utf8'));
  const dbIntel = JSON.parse(readFileSync(join(ROOT, 'graphify-out/db-intel.json'), 'utf8'));
  const domainIntel = JSON.parse(readFileSync(join(ROOT, 'graphify-out/domain-intel.json'), 'utf8'));
  
  // 2. Compute intelligence
  const result = {
    summary: { ... },
    domains: domainIntel.domains.map(d => ({ ... })),
    metrics: { live: 'NOT CONNECTED', source: 'Analytics Engine / Supabase' }
  };
  
  // 3. Write output artifact
  writeFileSync(join(ROOT, 'graphify-out/example-intel.json'), JSON.stringify(result, null, 2));
  
  return result;
}

// When run directly: node tools/graph-server/example-intel.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildExampleIntel();
}
```

---

## 6. Atlas Visualization

The Atlas is a **force-directed graph visualization** rendered entirely server-side using a custom spring-repulsion algorithm (`buildLayout()` in `server.mjs`). Key properties:

- **Node limit:** 100 to 75,000 nodes per render
- **Layout algorithm:** Simulated annealing with grid-based spatial hashing for O(n) repulsion
- **Community coloring:** 18-color palette, ranked by community size
- **Iteration count:** 15 (>30k nodes) → 280 (≤1.2k nodes)
- **UI:** Single-page app served from `tools/graph-server/index.html`
- **Deep links:** `/domain/<key>`, `/domain/<key>/<perspective>` are URL-addressable and refresh-safe (SPA fallback pattern)
- **Command palette:** ⌘K for natural-language navigation

---

## 7. The Resolver Chain

For natural-language domain resolution (used in investigate, root-cause, etc.):

```javascript
function resolveDomain(q) {
  // 1. Direct key match (e.g., "orders" → "orders")
  // 2. Keyword hint map (e.g., "checkout" → "orders", "pay" → "payments")
  // 3. Semantic search via searchV2(q, explainIntel)
  // Returns: domain key string | null
}
```

Keyword hint map covers: checkout→orders, pay→payments, refund→refunds, ship→shipping, tax→gst, login→authentication, auth→authentication, theme→themes, store→storefront, email→notifications, gift→gift-cards, discount→discounts, inventory→inventory, product→products, collection→collections, order→orders, merchant→merchant, identity→identity.

---

## 8. Community Profiling

Each graph community (cluster detected by graphify) gets profiled:

```javascript
// Workspace name derived from top workspace in community
{ id: "42", name: "API Gateway", hint: "API routes", workspace: "services/api-gateway", size: 412, top: ["createCheckoutOrder", "verifyPayment", ...] }
```

Communities are colored using an 18-color palette, ranked by size. The top workspace in each community determines the community name via the `WS_NAMES` mapping (26 workspace→name mappings defined).

---

## 9. SPA Deep Linking (V10)

All non-`/api/` paths return the index.html, enabling client-side deep linking:
- `/domain/<key>` — domain detail view
- `/domain/<key>/<perspective>` — specific perspective (explain/technical/graphs/trace/…)
- `/page/launch` — launch command center
- `/journey/<key>` — business journey workspace

Back/forward navigation works. Share URLs are refreshable.

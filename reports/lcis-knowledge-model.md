# LCIS Knowledge Model
**LetBuyy Central Intelligence System — Complete Knowledge Object Analysis**
*Date: 2026-06-19 | Source: tools/graph-server/, graphify-out/, docs/central-intelligence/UNIFIED_KNOWLEDGE_MODEL.md*

---

## 1. Overview: What LCIS Knows

LCIS maintains knowledge across four primary layers that are joined into a unified model. Every knowledge object has a defined purpose, a set of attributes, a provenance chain (which extraction script produced it), and a set of relationships to other objects.

**The 4 primary knowledge layers:**

| Layer | What it knows | Provenance | Join keys |
|-------|--------------|-----------|-----------|
| **Code Graph** | Symbols, imports, routes, pages, function definitions, type references | `graphify update .` → `graph.json` | Node `id`, `source_file`, `label` |
| **Database Intelligence** | Tables, RPCs, RLS policies, triggers, indexes, FK relationships | `db-intel.mjs` → `db-intel.json` | Table name, RPC name |
| **Infrastructure Intelligence** | Workers, queues, R2, Hyperdrive, Vercel apps, secrets, CODEOWNERS | `infra-intel.mjs` → `infra-intel.json` | Queue binding name, file path |
| **Domain Intelligence** | 22 business domains, cross-domain edges, domain-to-artifact mapping | `domain-intel.mjs` → `domain-intel.json` | Domain key, regex classification |

**How the layers join:**
- **Code ↔ DB:** Gateway `.rpc('name')` call sites link a route TypeScript node to a database RPC; RPC SQL body touches tables
- **Code ↔ Infra:** Queue binding names (`NOTIFICATION_QUEUE`, etc.) link producer routes to consumer workers
- **Any layer ↔ Ownership:** File path matched against CODEOWNERS rules
- **Any entity ↔ Domain:** Regex classification of table/route/RPC names against domain patterns

---

## 2. Knowledge Object Catalog

### 2.1 Node (Code Graph Node)

**Purpose:** Represents a single code symbol, file, page, or route in the TypeScript/TSX/Dart codebase.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique node identifier (hash) |
| `label` | string | Symbol name or file name |
| `source_file` | string | Relative path to the defining file |
| `source_location` | string | `line:col` offset in the file |
| `community` | string | Community ID assigned by Graphify (Louvain clustering) |
| `file_type` | string | `tsx`, `ts`, `dart`, `mjs`, `md` |

**Relationships:**
- **outbound edges** → `Edge[]` (what this node imports, calls, references, exports)
- **inbound edges** → `Edge[]` (what imports, calls, or references this node)
- **community** → Community object (parent cluster)
- **source_file** → Infrastructure ownership via CODEOWNERS

**Computed attributes (at server build time):**
- `degree` — count of inbound + outbound edges
- `blast radius` — BFS over inbound edges, 3 levels deep

**Scale:** 52,246 nodes, 66,761 edges

---

### 2.2 Edge (Code Graph Edge)

**Purpose:** Represents a typed, directed relationship between two code nodes.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `source` | string | Source node id |
| `target` | string | Target node id |
| `relation` | string | One of 15 typed relations |

**15 typed relation strings:**

| Relation | Semantics |
|----------|-----------|
| `imports` | Module-level import declaration |
| `imports_from` | Named import from a module |
| `re_exports` | `export { X } from 'Y'` |
| `exports` | `export function X` |
| `calls` | Function call site |
| `method` | Method invocation on an object |
| `references` | Type reference or variable usage |
| `defines` | Symbol definition (class, function) |
| `contains` | Structural containment (file → function) |
| `inherits` | Class inheritance |
| `extends` | Interface extension |
| `implements` | Class implements interface |
| `mixes_in` | Mixin composition |
| `navigates` | Next.js router navigation |
| `path` | Route path definition |

---

### 2.3 Community (Graph Cluster)

**Purpose:** Groups related nodes into workspaces (clusters detected by Louvain algorithm).

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Community identifier |
| `workspace` | string | Dominant workspace directory in cluster |
| `name` | string | Human-readable name (from WS_NAMES mapping) |
| `hint` | string | Brief description of workspace |
| `size` | number | Count of nodes in community |
| `color` | string | Hex color from 18-color palette |
| `top` | string[] | Top node labels by degree within community |

**Scale:** 3,279 communities; 26 workspace→name mappings

---

### 2.4 Table (Database Table)

**Purpose:** Represents a Postgres database table extracted from SQL migrations.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Table name (e.g., `payment_transactions`) |
| `createdIn` | string | Migration file that created this table |
| `columns` | number | Column count (approximate from SQL) |
| `hasSiteId` | boolean | Has `site_id` column (tenant identifier) |
| `hasStoreId` | boolean | Has `store_id` column (legacy tenant identifier) |
| `rls` | boolean | Row-Level Security is enabled |
| `force` | boolean | RLS is FORCE-enabled (bypasses postgres superuser) |
| `tenant` | boolean | Is a tenant-scoped table (has `site_id` or `store_id`) |
| `money` | boolean | Is in the canonical MONEY_TABLES set |
| `policies` | Policy[] | RLS policies on this table |
| `triggers` | string[] | Trigger names on this table |
| `indexes` | number | Index count on this table |

**Relationships:**
- **policies** → Policy objects (RLS access rules)
- **triggers** → Trigger names (function names that fire on DML)
- **touched by** → Function objects (RPCs/functions that reference this table)
- **reached by** → Route files (via transitive RPC chain)

**Scale:** 414 tables; 255 tenant tables; 394 RLS-enabled; 18 money tables

---

### 2.5 Function / RPC

**Purpose:** Represents a Postgres function or stored procedure, typically a `SECURITY DEFINER` RPC.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Function name |
| `definedIn` | string | Migration file where defined |
| `securityDefiner` | boolean | Has `SECURITY DEFINER` (runs as owner) |
| `args` | number | Count of `p_*` parameter names |
| `touches` | string[] | Tables referenced in SQL body |
| `hasIdempotency` | boolean | Has `idempotency_key` parameter |
| `forUpdate` | boolean | Uses `FOR UPDATE` row lock |
| `money` | boolean | Touches at least one money table |
| `callers` | string[] | Route/worker files that call `.rpc('name')` |

**Relationships:**
- **callers** → Route files (via `.rpc('name')` call sites)
- **touches** → Table names (SQL body parse)
- **definedIn** → Migration file

**Critical money RPCs (canonical ledger):**
- `create_checkout_order`
- `confirm_order_payment_with_ledger`
- `complete_order_refund`
- `issue_gift_card`
- `set_gift_card_status`
- `restore_gift_card_on_refund`

**Scale:** 156 functions; 128 SECURITY DEFINER; 34 money functions; 53 called via gateway `db.rpc`

---

### 2.6 Policy (RLS Policy)

**Purpose:** Represents a Postgres Row-Level Security policy on a table.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Policy name |
| `table` | string | Target table name |
| `public` | boolean | Uses `USING (true)` — potentially permissive |
| `usesSiteId` | boolean | Filters by `site_id` column |
| `serviceRole` | boolean | Scoped to service-role JWT |

**Governance rule:** No policy may use `USING (true)` for publicly accessible data — `no-public-using-true-validator` enforces this. 34 policies match `USING (true)` but all are service-role-scoped (verified by validator).

**Scale:** 651 policies

---

### 2.7 Trigger

**Purpose:** Represents a Postgres trigger (event-driven function execution on DML).

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Trigger name |
| `table` | string | Table the trigger fires on |
| `function` | string | Function invoked when trigger fires |
| `timing` | string | `BEFORE` or `AFTER` |
| `events` | string[] | `INSERT`, `UPDATE`, `DELETE` |

**Scale:** 395 triggers

---

### 2.8 Index

**Purpose:** Represents a Postgres index for query performance.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Index name |
| `table` | string | Indexed table |
| `unique` | boolean | Is a unique index |
| `columns` | string[] | Indexed column names |

**Scale:** 826 indexes

---

### 2.9 Worker

**Purpose:** Represents a Cloudflare Worker runtime (a serverless function process).

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Worker name (from wrangler.toml) |
| `queues` | QueueBinding[] | Queue producer/consumer bindings |
| `secrets` | string[] | Required secret names |
| `r2` | string[] | R2 bucket bindings |
| `hyperdrive` | string[] | Hyperdrive connection pool bindings |
| `kv` | string[] | KV namespace bindings |
| `crons` | string[] | Cron trigger schedules |
| `routes` | string[] | URL route patterns served |

**Relationships:**
- **produces to** → Queue names
- **consumes from** → Queue names
- **uses** → Secrets, R2 buckets, Hyperdrive connections

**Scale:** 4 workers: `api-gateway`, `queue-workers`, `webhook-service`, `mobile-bff`

---

### 2.10 Queue

**Purpose:** Represents a Cloudflare Queue (async message queue for durable jobs).

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Queue binding name |
| `producers` | string[] | Worker names that send to this queue |
| `consumers` | string[] | Worker names that consume from this queue |
| `hasDeadLetter` | boolean | Has a DLQ for failed messages |
| `domain` | string | Business domain this queue belongs to |

**Scale:** 5 queues, 7 consumer bindings

---

### 2.11 Secret

**Purpose:** Represents a deploy-time environment secret required by a worker or app.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | string | Environment variable name |
| `worker` | string | Worker or app that requires it |
| `provider` | string | Which provider this secret authenticates with |
| `domain` | string | Which business domain uses this secret |

**Scale:** 19 required production secrets. Examples: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CUSTOMER_SESSION_SECRET`, `LETBUYY_IDENTITY_PUBLIC_JWKS`

---

### 2.12 Domain (Business Domain)

**Purpose:** Represents one of 22 classified business domains — the primary organizational unit in LCIS.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `key` | string | Domain identifier (e.g., `payments`, `orders`) |
| `label` | string | Human-readable name |
| `money` | boolean | Domain posts to the canonical money ledger |
| `tenant` | boolean | Domain's tables are tenant-scoped |
| `routes` | string[] | API route files in this domain |
| `rpcs` | string[] | Database function names in this domain |
| `tables` | string[] | Table names in this domain |
| `queues` | string[] | Queue bindings used by this domain |
| `apps` | string[] | Runtime applications serving this domain |
| `workers` | string[] | Cloudflare workers serving this domain |
| `secrets` | string[] | Environment secrets required by this domain |
| `owners` | string[] | CODEOWNERS entries for this domain |
| `workflows` | string[] | GitHub Actions workflow files |
| `counts` | object | `{routes, rpcs, tables, policies, triggers, indexes}` |
| `dependsOn` | DomainEdge[] | Domains this domain depends on, with strength |
| `consumedBy` | DomainEdge[] | Domains that depend on this domain |

**Cross-domain edge attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `from` | string | Source domain key |
| `to` | string | Target domain key |
| `via` | string[] | Specific RPC→table cross-domain callsites |
| `strength` | number | 1-10 coupling strength rating |

**Scale:** 22 domains, 49 cross-domain edges, 82% coupling rate (18/22 domains coupled)

**22 domain keys (in classification priority order):**
`themes`, `marketplace`, `developer`, `gift-cards`, `refunds`, `payouts`, `payments`, `gst`, `discounts`, `shipping`, `inventory`, `collections`, `products`, `orders`, `storefront`, `authorization`, `authentication`, `identity`, `merchant`, `notifications`, `analytics`, `operations`

---

### 2.13 Governance Decision

**Purpose:** Represents an architectural or operational decision extracted from governance documents.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string | Decision ID (e.g., `D-001`) |
| `type` | string | Category: governance/security/migration/payment/refund/payout/architecture/theme/storefront |
| `source` | string | Governance document path |
| `section` | string | Section heading in the document |
| `rule` | string | Verbatim rule text |

**Scale:** 180 governance decisions from 41 source documents; 103 migration decisions; 9 decision types

**Examples:**
- `D-001` (governance): "money mutations MUST route through SECURITY DEFINER RPCs" — from LETBUYY_CONSTITUTION.md
- `D-042` (security): "Two issuers never crossed — customer HS256, merchant ES256" — from AGENTS.md
- `D-077` (payment): "canonical-ledger-only validator forbids `.from(money_table).insert/update`" — from canonical-ledger-only-validator.mjs

---

### 2.14 FK Relationship

**Purpose:** Represents a foreign key constraint between two database tables.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `from` | string | Child table name |
| `column` | string | FK column name |
| `to` | string | Parent table name |
| `toColumn` | string | Referenced column (usually `id` or `site_id`) |
| `onDelete` | string | `CASCADE`, `SET NULL`, `RESTRICT`, etc. |

**Tenant root:** `sites` table has 260 inbound FK references — it is the root of the multi-tenant graph. All tenant data ultimately traces back to `sites.id`.

**Scale:** 705 foreign keys across 367 tables

---

### 2.15 Explain Node (V6 Human-Readable Domain Node)

**Purpose:** The highest-level knowledge object — a human and AI readable object for one business domain, designed for Explain mode.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `key` | string | Domain key |
| `label` | string | Human-readable name |
| `kind` | string | Node classification |
| `purpose` | string | What this domain does (1–2 sentences, hand-authored narrative) |
| `importance` | string | Why it matters to the business |
| `businessValue` | string | Direct business value |
| `failureImpact` | string | What breaks when this domain fails |
| `criticality` | string | `Tier 1 (Critical)`, `Tier 2 (Important)` |
| `owner` | string[] | CODEOWNERS-derived owners |
| `dependsOn` | string[] | Domain keys this domain requires |
| `consumers` | string[] | Domain keys that depend on this domain |
| `operationalNotes` | string | Runtime/deployment operational notes |
| `merchantImpact` | string | Impact on merchant experience |
| `customerImpact` | string | Impact on customer experience |
| `recoveryPath` | string | Recovery steps if this domain fails |
| `runbooks` | string[] | Links to runbook procedures |
| `launchRelevance` | string | Relevance to launch readiness |
| `relatedDomains` | string[] | Related domain keys |
| `technical` | ExplainTechnical | routes, rpcs, tables, policies, triggers, indexes, workers, queues, secrets, services, money, tenant, relationships, blastRadius |
| `atlas` | object | `{search: string, blast: string}` for Atlas deep links |
| `flow` | FlowStep[] | Step-by-step flow for the domain's primary operation |
| `aiContext` | string | Paste-ready single-string AI context summary |
| `docs` | ExplainDocs | `{overview, problemSolved, tags, readingTime, difficulty, codeRefs, dbRefs, deepDiveUrl}` |

**Scale:** 22 explain nodes, one per business domain

---

### 2.16 Business Journey (V11)

**Purpose:** Represents one of the 10 business journeys (end-to-end flows).

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `key` | string | Journey identifier (e.g., `checkout`, `payment`) |
| `label` | string | Human-readable name |
| `actors` | string[] | Who participates (merchant, customer, system) |
| `flow` | FlowStep[] | Ordered steps with system, action, domain |
| `domains` | string[] | Business domains involved |
| `failurePoints` | FailurePoint[] | Where the journey can fail and why |
| `recovery` | RecoveryStep[] | Recovery steps per failure mode |
| `metrics` | object | KPIs (all NOT CONNECTED) |
| `perspectives` | object | 9 workspace perspectives |

**Implemented journeys (9):**
`checkout`, `payment`, `refund`, `customer-registration`, `merchant-onboarding`, `inventory-management`, `order-fulfillment`, `discount-application`, `product-catalog`

**NOT IMPLEMENTED:** `subscription` — no subscriptions domain exists in the codebase.

---

### 2.17 Detector (INFINITY)

**Purpose:** Represents an autonomous failure detector binding a live signal source to a structural risk.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `key` | string | Detector identifier |
| `label` | string | Display name |
| `category` | string | Detection category |
| `severity` | string | `critical`, `high`, `medium` |
| `liveSignal` | object | `{description, source, status: 'NOT CONNECTED', envVar}` |
| `structuralRisk` | string | Repository-truth risk description |
| `affectedDomains` | string[] | Domains impacted if this detector fires |
| `openBlockers` | string[] | Open launch blockers related to this detector |
| `runbook` | string | Runbook URL |
| `diagnose` | string | Diagnosis query URL |

**8 detectors:** `checkout-failure`, `payment-failure`, `refund-failure`, `worker-crash`, `queue-backlog`, `database-failure`, `webhook-failure`, `deployment-failure`

---

### 2.18 Predictor (INFINITY)

**Purpose:** Represents a structural predisposition toward a class of failures.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `key` | string | Predictor identifier |
| `label` | string | Display name |
| `structuralPredisposition` | string | Repository-truth explanation |
| `confirmingSignal` | object | Live metric that would confirm this trend (NOT CONNECTED) |
| `domains` | string[] | Domains at risk |
| `riskScore` | number | Composite risk score (0–100) |

**6 predictors:** approaching-limits, storage-growth, queue-saturation, traffic-spikes, cost-spikes, operational-risk

---

### 2.19 Live Adapter

**Purpose:** Represents a connection adapter for a live operational provider.

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `provider` | string | Provider name (Supabase, Cloudflare, etc.) |
| `category` | string | database / runtime / deployment / ci / email / payments / security |
| `status` | string | `CONNECTED` or `NOT CONNECTED` |
| `exactSource` | string | Exact env var names needed |
| `integration` | string | Human-readable connection step |
| `metrics` | string[] | Metrics targeted when connected |
| `httpStatus` | number | Last probe HTTP status (if connected) |

**7 providers:** Supabase, Cloudflare, Vercel, GitHub, Resend, Razorpay, Cloudflare Turnstile

**Current status:** 0/7 CONNECTED (dev context, no deploy-time secrets present)

---

## 3. Knowledge Object Relationships Map

```
                    ┌──────────────────────────────────────────┐
                    │           22 Business Domains             │
                    │  (primary organizational unit)            │
                    └────────┬─────────────────────────────────┘
                             │ classify by regex
                ┌────────────┼─────────────────┬────────────────────┐
                ▼            ▼                  ▼                    ▼
         ┌──────────┐  ┌──────────┐    ┌──────────────┐    ┌──────────────┐
         │  Tables  │  │   RPCs   │    │    Routes    │    │   Workers    │
         │  (414)   │  │  (156)   │    │   (API files)│    │    (4)       │
         └──────────┘  └──────────┘    └──────────────┘    └──────────────┘
              │             │                  │                   │
              │◄────────────┘ SQL body         │ .rpc('name')     │ queue binding
              │ column scan   references        │ call sites        │ names
              │
         ┌──────────┐
         │ Policies │
         │  (651)   │
         └──────────┘
         ┌──────────┐
         │ Triggers │
         │  (395)   │
         └──────────┘
         ┌──────────┐
         │ Indexes  │
         │  (826)   │
         └──────────┘
              │
              │ FK relationship
              ▼
         ┌──────────┐
         │  sites   │◄──── tenant root: 260 inbound FK refs
         └──────────┘
```

---

## 4. Knowledge Storage Model

All knowledge is stored as JSON files in `graphify-out/` (gitignored, rebuilt from source):

| Artifact | Producer | Consumers |
|---------|---------|---------|
| `graph.json` | `graphify update .` | server.mjs, intelligence.mjs |
| `db-intel.json` | `db-intel.mjs` | server.mjs, domain-intel.mjs, explain-intel.mjs, all v4+ engines |
| `infra-intel.json` | `infra-intel.mjs` | server.mjs, domain-intel.mjs |
| `domain-intel.json` | `domain-intel.mjs` | server.mjs, all v4+ engines |
| `memory-intel.json` | `memory-intel.mjs` | server.mjs |
| `knowledge-graphs.json` | `knowledge-graphs.mjs` | server.mjs |
| `unified-intelligence.json` | `unified-intelligence-engine.mjs` | server.mjs |
| `merchant-health.json` et al. | Omega build scripts | server.mjs |
| `audit-engine-v2.json` | `audit-engine-v2.mjs` | server.mjs |
| `connections-intel.json` | `connections-intel.mjs` | server.mjs |
| `environment-registry.json` | `environment-registry.mjs` | server.mjs |

**No external storage:** LCIS uses no database, no vector store, no embeddings. All knowledge is pre-computed JSON loaded into memory at server startup.

**Loading pattern:**
```javascript
const merchantHealth = loadOrBuild('merchant-health.json', buildMerchantHealth);
// If cached JSON exists → load from disk (fast, ~10ms)
// Otherwise → compute fresh (slow, ~200ms)
```

---

## 5. Knowledge Lifecycle

1. **Extraction:** Source code / SQL / configs are scanned by extraction engines (`db-intel.mjs`, `infra-intel.mjs`, `domain-intel.mjs`) → JSON artifacts in `graphify-out/`
2. **Loading:** Server starts, loads all JSON artifacts into memory
3. **Composition:** Intelligence engines compose loaded artifacts into derived intelligence objects
4. **Serving:** HTTP server exposes all intelligence via 90+ REST API endpoints
5. **Regeneration:** Triggered by `pnpm graph:*` scripts (manually) or CI/CD (automatically on migration/gateway code changes)
6. **Invalidation:** No TTL — artifacts are regenerated on demand. The CI job regenerates on every migration or gateway source change.

---

## 6. What LCIS Does NOT Know (by Design)

| Gap | Reason | Honest marking |
|-----|--------|---------------|
| Live error rates | No telemetry adapter wired | `NOT CONNECTED + Analytics Engine` |
| Revenue amounts | No Supabase live rows access | `NOT CONNECTED + Supabase ledger` |
| Merchant counts | No live tenant query | `NOT CONNECTED + Supabase` |
| Queue depths | No Cloudflare queue metrics | `NOT CONNECTED + Cloudflare Queues` |
| RPC SQL body semantics | Regex parser, not SQL AST | Candidates surfaced, validators authoritative |
| SQL symbol relationships | Graphify doesn't index SQL function bodies | db-intel.mjs fills this gap partially |
| Subscriptions | No subscriptions domain in codebase | `NOT IMPLEMENTED` surfaced explicitly |

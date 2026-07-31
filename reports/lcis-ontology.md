# LCIS Ontology
**LetBuyy Central Intelligence System — Complete Entity Types, Attributes, and Relationships**
*Date: 2026-06-19 | Source: Forensic analysis of tools/graph-server/, graphify-out/ JSON schemas*

---

## Ontology Overview

The LCIS ontology covers 24 distinct entity types organized across 4 abstraction layers. Every entity has a defined provenance (which source and which extraction script produced it), a set of attributes, and typed relationships to other entities.

---

## Layer 1: Code Graph Entities

### C1. Module Node
A distinct symbol in the code graph: function, class, type, constant, component, route handler, or page.
- **Attributes:** `id` (hash), `label` (symbol name), `source_file` (path), `source_location` (line:col), `community` (cluster ID), `file_type` (ts|tsx|dart|mjs)
- **Relationships:**
  - `→ IMPORTS` → Module Node (import statement)
  - `→ CALLS` → Module Node (function call site)
  - `→ EXPORTS` → Module Node (export declaration)
  - `→ DEFINES` → Module Node (definition containment)
  - `→ REFERENCES` → Module Node (type/variable usage)
  - `→ NAVIGATES` → Route Node (Next.js router.push)
  - `→ BELONGS_TO` → Community
- **Scale:** 52,246 nodes

### C2. Route Node
A special Module Node representing an API route handler (detected by file path pattern and `export default` handler).
- **Additional attributes:** `method` (GET|POST|PUT|DELETE|PATCH), `path` (URL pattern)
- **Relationships:**
  - `→ CALLS_RPC` → Database Function (via `.rpc('name')` in TypeScript)
  - `→ SENDS_TO` → Queue (via queue binding name)
  - `→ BELONGS_TO` → Domain
- **Scale:** Part of the 52,246 nodes (~87–90 API route files in gateway)

### C3. Page Node
A Next.js page component (detected by `app/*/page.tsx` or `pages/` path pattern).
- **Relationships:**
  - `→ RENDERS` → Module Node (component usage)
  - `→ IMPORTS` → Module Node (import)

### C4. Community
A cluster of related code nodes (Louvain algorithm output).
- **Attributes:** `id`, `name` (from WS_NAMES mapping), `hint`, `workspace` (dominant directory), `size` (node count), `color` (hex, from 18-color palette)
- **Relationships:**
  - `← BELONGS_TO` → Module Node (members)

---

## Layer 2: Database Entities

### D1. Table
A Postgres database table.
- **Attributes:** `name`, `createdIn` (migration), `columns` (count), `hasSiteId`, `hasStoreId`, `rls` (boolean), `force` (boolean), `tenant` (boolean), `money` (boolean)
- **Relationships:**
  - `← DEFINES` → Policy (1..N RLS policies)
  - `← FIRES` → Trigger (1..N triggers)
  - `← INDEXES` → Index (1..N indexes)
  - `← TOUCHED_BY` → Database Function (SQL body reference)
  - `← REACHED_BY` → Route Node (transitive via RPC chain)
  - `→ FK_TO` → Table (foreign key, 705 total)
  - `← FK_FROM` → Table (referenced as FK target)
- **Scale:** 414 tables; `sites` is tenant root (260 inbound FKs)

### D2. Database Function (RPC)
A Postgres function — typically a `SECURITY DEFINER` stored procedure.
- **Attributes:** `name`, `definedIn` (migration), `securityDefiner` (boolean), `args` (count), `hasIdempotency` (boolean), `forUpdate` (boolean), `money` (boolean)
- **Relationships:**
  - `→ TOUCHES` → Table (1..N tables referenced in SQL body)
  - `← CALLED_BY` → Route Node (via `.rpc('name')` call sites)
  - `← CALLED_BY` → Worker Node (via queue worker .rpc calls)
- **Scale:** 156 functions; 128 SECURITY DEFINER; 34 money functions

### D3. Policy (RLS Policy)
A Postgres Row-Level Security policy.
- **Attributes:** `name`, `table` (target table), `public` (USING (true)), `usesSiteId` (boolean), `serviceRole` (boolean)
- **Relationships:**
  - `→ GOVERNS` → Table
- **Scale:** 651 policies

### D4. Trigger
An event-driven Postgres trigger.
- **Attributes:** `name`, `table`, `function` (invoked function), `timing` (BEFORE|AFTER), `events` (INSERT|UPDATE|DELETE)
- **Relationships:**
  - `→ FIRES_ON` → Table
  - `→ INVOKES` → Database Function
- **Scale:** 395 triggers

### D5. Index
A Postgres index.
- **Attributes:** `name`, `table`, `unique` (boolean), `columns` (string[])
- **Relationships:**
  - `→ COVERS` → Table
- **Scale:** 826 indexes

### D6. FK Relationship
A foreign key constraint (extracted from `relationship-intel.mjs`).
- **Attributes:** `from` (child table), `column` (FK column), `to` (parent table), `toColumn` (referenced column), `onDelete` (CASCADE|SET NULL|RESTRICT|...)
- **Relationships:**
  - `→ REFERENCES` → Table (parent)
  - `← REFERENCED_BY` → Table (child)
- **Scale:** 705 foreign keys

---

## Layer 3: Infrastructure Entities

### I1. Worker
A Cloudflare Worker (serverless edge runtime).
- **Attributes:** `name`, `routes` (URL patterns), `queues` (bindings), `secrets` (required names), `r2` (bucket names), `hyperdrive` (connection pool names), `kv` (namespace names), `crons` (schedules)
- **Relationships:**
  - `→ PRODUCES_TO` → Queue (async message producer)
  - `→ CONSUMES_FROM` → Queue (message consumer)
  - `→ USES` → Secret (1..N secrets required)
  - `→ USES` → R2 Bucket
  - `→ USES` → Hyperdrive Connection Pool
  - `→ CALLS` → Database Function (via db.rpc)
- **Scale:** 4 workers

### I2. Queue
A Cloudflare Queue (durable async message queue).
- **Attributes:** `name`, `producers` (worker names), `consumers` (worker names), `hasDeadLetter` (boolean), `domain` (business domain)
- **Relationships:**
  - `← PRODUCES_TO` → Worker
  - `← CONSUMES_FROM` → Worker
  - `→ PROCESSES` → Domain (work belongs to a business domain)
- **Scale:** 5 queues, 7 consumer bindings

### I3. Secret
A deploy-time environment variable.
- **Attributes:** `name`, `worker` (required by), `provider` (authenticates with), `domain` (used by)
- **Relationships:**
  - `→ AUTHENTICATES` → Provider
  - `→ USED_BY` → Domain
  - `→ REQUIRED_BY` → Worker
- **Scale:** 19 required production secrets

### I4. R2 Bucket
A Cloudflare R2 object storage bucket.
- **Attributes:** `name`, `worker` (bound to)
- **Relationships:**
  - `← USES` → Worker
- **Scale:** 1 R2 bucket (media storage)

### I5. Hyperdrive Connection Pool
A Cloudflare Hyperdrive connection pool for Supabase Postgres.
- **Attributes:** `name`, `worker` (bound to), `target` (Supabase database URL pattern)
- **Relationships:**
  - `← USES` → Worker
  - `→ POOLS` → Supabase (Postgres)

### I6. Vercel App
A Next.js application deployed on Vercel.
- **Attributes:** `name`, `directory` (source root), `purpose`, `domain` (associated business domains)
- **Relationships:**
  - `→ PROXIES_TO` → Worker (API calls proxied to api-gateway)
  - `→ BELONGS_TO` → Domain (primary business domain)
- **Scale:** 5 apps

### I7. CODEOWNERS Rule
An ownership rule from `.github/CODEOWNERS`.
- **Attributes:** `path` (file pattern), `owners` (GitHub usernames/teams)
- **Relationships:**
  - `→ OWNS` → Module Node (matched by path prefix)
  - `→ OWNS` → Domain (all paths in domain)

---

## Layer 4: Domain Intelligence Entities

### B1. Business Domain
The primary organizational unit — one of 22 classified business domains.
- **Attributes:** `key`, `label`, `money` (boolean), `tenant` (boolean), plus aggregated counts: `routes`, `rpcs`, `tables`, `queues`, `apps`, `workers`, `secrets`, `owners`, `workflows`
- **Relationships:**
  - `→ DEPENDS_ON` → Business Domain (cross-domain dependency, with strength)
  - `← CONSUMED_BY` → Business Domain (downstream dependents)
  - `→ CONTAINS` → Route Node (API routes classified in this domain)
  - `→ CONTAINS` → Database Function (RPCs classified in this domain)
  - `→ CONTAINS` → Table (tables classified in this domain)
  - `→ USES` → Queue (queues assigned to this domain)
  - `→ RUNS_ON` → Worker (workers serving this domain)
  - `→ RUNS_ON` → Vercel App (apps serving this domain)
  - `→ REQUIRES` → Secret (secrets needed by this domain)
  - `→ OWNED_BY` → CODEOWNERS Rule
- **Scale:** 22 domains, 49 cross-domain edges

### B2. Cross-Domain Edge
A typed dependency between two business domains.
- **Attributes:** `from` (source domain), `to` (target domain), `via` (specific RPC→table call sites), `strength` (1–10)
- **Relationships:**
  - `→ FROM` → Business Domain
  - `→ TO` → Business Domain

### B3. Business Journey (V11)
A complete end-to-end business flow.
- **Attributes:** `key`, `label`, `actors` (string[]), `flow` (FlowStep[]), `domains` (string[]), `failurePoints`, `recovery`, `metrics` (NOT CONNECTED)
- **Relationships:**
  - `→ TRAVERSES` → Business Domain (1..N domains involved)
  - `→ USES_ROUTE` → Route Node
  - `→ USES_RPC` → Database Function
- **Scale:** 9 implemented journeys; 1 NOT IMPLEMENTED (subscription)

### B4. Governance Decision
An architectural or operational decision extracted from governance documents.
- **Attributes:** `id` (D-001 to D-180), `type` (governance|security|migration|payment|refund|payout|architecture|theme|storefront), `source` (document path), `section` (heading), `rule` (verbatim text)
- **Relationships:**
  - `→ SOURCED_FROM` → Governance Document
  - `→ GOVERNS` → Business Domain (inferred from type)
- **Scale:** 180 decisions; 103 migration decisions

### B5. Explain Node (V6)
The highest-level knowledge object — a complete domain description for human and AI consumption.
- **Attributes:** All attributes from Business Domain + `purpose` (prose), `importance`, `businessValue`, `failureImpact`, `criticality` (Tier 1|2), `operationalNotes`, `merchantImpact`, `customerImpact`, `recoveryPath`, `runbooks[]`, `launchRelevance`, `flow[]` (FlowStep[]), `aiContext` (paste-ready string), `docs` (metadata: tags, reading time, difficulty, code refs, db refs, deep-dive URL)
- **Relationships:** Identical to Business Domain, plus:
  - `→ HAS_FLOW` → Flow Step (ordered steps)

---

## Layer 5: Operational Intelligence Entities

### O1. Detector (INFINITY)
An autonomous failure detector binding a live signal source to a structural risk.
- **Attributes:** `key`, `label`, `category`, `severity` (critical|high|medium), `liveSignal` ({description, source, status: 'NOT CONNECTED', envVar}), `structuralRisk`, `affectedDomains[]`, `openBlockers[]`, `runbook`, `diagnose`
- **Relationships:**
  - `→ AFFECTS` → Business Domain (1..N)
  - `→ LINKED_TO` → Blocker (open launch blockers)
  - `→ HAS_RUNBOOK` → Runbook
- **Scale:** 8 detectors

### O2. Predictor (INFINITY)
A structural predisposition toward a class of failures.
- **Attributes:** `key`, `label`, `structuralPredisposition`, `confirmingSignal` (NOT CONNECTED), `domains[]`, `riskScore` (0–100)
- **Relationships:**
  - `→ PREDICTS_FAILURE_IN` → Business Domain
- **Scale:** 6 predictors

### O3. Live Adapter
A connection adapter for a live operational provider.
- **Attributes:** `provider`, `category`, `status` (CONNECTED|NOT CONNECTED), `exactSource` (env var names), `integration` (connection step), `metrics[]`, `httpStatus`
- **Relationships:**
  - `→ PROBES` → Provider
  - `→ PROVIDES_METRICS_FOR` → Business Domain
- **Scale:** 7 adapters (all NOT CONNECTED in dev)

### O4. Runbook
A per-domain operational runbook with detection/diagnosis/recovery/rollback/verification steps.
- **Attributes:** `domain`, `severity`, `detection[]`, `diagnosis[]`, `recovery[]`, `rollback[]`, `verification[]`, `escalation` (chain: on-call → team lead → CTO)
- **Relationships:**
  - `→ COVERS` → Business Domain
  - `← REFERENCED_BY` → Detector
- **Scale:** 22 runbooks (one per domain)

### O5. Knowledge Sub-Graph
One of 7 purpose-built projections of the full knowledge graph.
- **Attributes:** `kind` (business|journey|security|ownership|infrastructure|revenue|ai), `nodes[]`, `edges[]`
- **Relationships:**
  - `→ PROJECTS` → Entity Layer (the set of entities this graph includes)

---

## Complete Relationship Taxonomy

### Cross-Layer Relationships

| From Entity | Relationship | To Entity | Layer |
|-------------|------------|----------|-------|
| Route Node | `→ CALLS_RPC` | Database Function | C→D |
| Route Node | `→ SENDS_TO` | Queue | C→I |
| Module Node | `→ CLASSIFIED_IN` | Business Domain | C→B |
| Database Function | `→ TOUCHES` | Table | D→D |
| Database Function | `→ CLASSIFIED_IN` | Business Domain | D→B |
| Table | `→ CLASSIFIED_IN` | Business Domain | D→B |
| Table | `→ FK_TO` | Table (sites) | D→D |
| Worker | `→ PRODUCES_TO` | Queue | I→I |
| Worker | `→ USES` | Secret | I→I |
| Queue | `→ CLASSIFIED_IN` | Business Domain | I→B |
| Business Domain | `→ DEPENDS_ON` | Business Domain | B→B |
| Business Domain | `→ DESCRIBED_BY` | Explain Node | B→B |
| Detector | `→ AFFECTS` | Business Domain | O→B |
| Predictor | `→ PREDICTS_FAILURE_IN` | Business Domain | O→B |
| Live Adapter | `→ PROBES` | Business Domain | O→B |

---

## Entity Counts Summary

| Entity Type | Count |
|-------------|-------|
| Module Nodes | 52,246 |
| Communities | 3,279 |
| Tables | 414 |
| Database Functions | 156 |
| RLS Policies | 651 |
| Triggers | 395 |
| Indexes | 826 |
| FK Relationships | 705 |
| Workers | 4 |
| Queues | 5 |
| Secrets | 19 |
| Vercel Apps | 5 |
| Business Domains | 22 |
| Cross-Domain Edges | 49 |
| Business Journeys | 9 (+ 1 NOT IMPLEMENTED) |
| Governance Decisions | 180 |
| Explain Nodes | 22 |
| Detectors | 8 |
| Predictors | 6 |
| Live Adapters | 7 |
| Runbooks | 22 |
| Knowledge Sub-Graphs | 7 |

---

## Provenance Map (Entity → Producer)

| Entity | Producer Script | Source |
|--------|---------------|--------|
| Module Node, Edge, Community | `graphify update .` | TypeScript/TSX/Dart source |
| Table, Function, Policy, Trigger, Index | `db-intel.mjs` | SQL migration files |
| FK Relationship | `relationship-intel.mjs` | SQL migration files |
| Worker, Queue, Secret, R2, Vercel App | `infra-intel.mjs` | wrangler.toml, CI YAMLs, CODEOWNERS |
| Business Domain, Cross-Domain Edge | `domain-intel.mjs` | db-intel.json + infra-intel.json |
| Governance Decision | `memory-intel.mjs` | Governance markdown docs |
| Explain Node | `explain-intel.mjs` | All artifacts + hand-authored narrative |
| Business Journey | `business-flow-intel.mjs` | domain-intel.json + hand-authored flows |
| Detector | `detection-prediction-intel.mjs` | domain-intel.json + execution-intel.json |
| Predictor | `detection-prediction-intel.mjs` | All artifacts |
| Live Adapter | `live-adapters.mjs` | `process.env` + network probes |
| Runbook | `runbook-engine.mjs` | All artifacts + hand-authored escalation |
| Knowledge Sub-Graph | `knowledge-graphs.mjs` | All artifacts |

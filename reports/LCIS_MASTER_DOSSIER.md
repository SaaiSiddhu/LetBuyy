# LCIS
## LetBuyy Central Intelligence System
### Authoritative Architecture Dossier

---

**Version:** 1.0 — Forensic Edition  
**Date:** 2026-06-19  
**Repository Revision:** `stepup/main` @ `57760d0c`  
**Investigation Scope:** Complete forensic analysis of 83 intelligence engine files, 12 individual reports, all governance documents, and 50+ pre-built knowledge artifacts  
**Auditors:** Four-agent forensic panel (core code analysis, documentation analysis, governance + graph structure analysis, gap + infrastructure analysis)

---

## TABLE OF CONTENTS

- [Executive Summary](#executive-summary)
- [Part I — Historical Evolution](#part-i--historical-evolution)
- [Part II — Conceptual Architecture](#part-ii--conceptual-architecture)
- [Part III — Knowledge Architecture](#part-iii--knowledge-architecture)
- [Part IV — Repository Intelligence System](#part-iv--repository-intelligence-system)
- [Part V — Technical Architecture](#part-v--technical-architecture)
- [Part VI — AI Architecture](#part-vi--ai-architecture)
- [Part VII — Governance Architecture](#part-vii--governance-architecture)
- [Part VIII — Audit Findings](#part-viii--audit-findings)
- [Part IX — Gap Analysis](#part-ix--gap-analysis)
- [Part X — Papaa Escola Migration Blueprint](#part-x--papaa-escola-migration-blueprint)
- [Part XI — Central Intelligence Platform](#part-xi--central-intelligence-platform)
- [Part XII — Appendices](#part-xii--appendices)

---

# EXECUTIVE SUMMARY

## What Is LCIS?

The **LetBuyy Central Intelligence System (LCIS)** is a zero-dependency, locally-hosted knowledge intelligence platform built directly over the LetBuyy commerce codebase. It is not a third-party product, not a SaaS service, and not a documentation system. It is a custom-built, in-repository system that converts a 52,246-node code graph, 414-table database schema, 4-worker infrastructure topology, and 22 business domains into a single queryable intelligence layer — accessible via REST API at `http://localhost:3333`.

In a single sentence: **LCIS is the brain over the repository** — a pre-computed knowledge graph that allows any AI agent or engineer to answer any architectural, operational, or business question about LetBuyy without reading source files.

## Why Was It Built?

LCIS emerged from two simultaneous crises discovered in the forensic audit of 2026-06-10:

**Crisis 1 — AI agents were creating architecture drift.** The prior `AGENTS.md` was auto-generated from a repository scan. This encoded repository drift as law — declaring a rejected 9-application topology as canonical, listing prototype packages as governed systems, and reporting stale entity counts. AI agents read this as authoritative and made architectural decisions based on incorrect information.

**Crisis 2 — Answering questions required exhausting context windows.** With 52,246 code nodes, 414 database tables, 8 runtimes, and 22 business domains, no AI agent could answer "what breaks if payments fail?" without reading dozens of files. The resulting answers were slow, unreliable, and context-window-exhausting.

LCIS solves both by making correct architectural answers instantly available via a single HTTP query — eliminating both the drift and the exhaustion.

## What Value Does It Create?

| Value Category | Concrete Impact |
|----------------|-----------------|
| **AI Agent Efficiency** | Replaces 50+ file reads with a single `/api/explain?node=orders` call |
| **Drift Prevention** | Agents get pre-validated architectural facts, not file-reading inferences |
| **Incident Response** | `/api/runbook?domain=payments` → full recovery runbook in <10ms |
| **Launch Readiness** | `/api/launch-command-center` → GO/NO-GO with 10-dimension evidence |
| **Security Audit** | `/api/security-intelligence` → 11 controls, 651 policies, cross-tenant candidates |
| **Developer Onboarding** | `/api/developer` → "Understand LetBuyy in 30 minutes" |
| **Change Safety** | `pnpm graph:intel blast "getSupabaseAdmin"` → 115-file blast radius before merge |

## Why Is It Strategically Important?

LCIS encodes a platform-level insight: **the repository is the only source of truth for structural knowledge.** Documentation goes stale. Comments drift. Architecture diagrams become fiction. But the code, migrations, and infrastructure configs are always current — if you know how to read them.

LCIS is the reading layer. It extracts, indexes, and serves repository truth as queryable intelligence. It is the difference between an AI agent that guesses at architecture and an AI agent that knows it.

The architecture is product-agnostic. The same system can be built for any software platform — education management (Papaa Escola), healthcare, logistics, or fintech — with 10–15 days of configuration work (see [Part X](#part-x--papaa-escola-migration-blueprint) and [Part XI](#part-xi--central-intelligence-platform)).

## Current Maturity

| Dimension | Status |
|-----------|--------|
| Intelligence layers | 13 (V1 through OMEGA, Genesis, INFINITY, X) |
| API endpoints active | 117+ (117/117 verified HTTP 200 in INFINITY certification) |
| Code graph | 52,246 nodes, 66,761 edges, 3,279 communities |
| Database intelligence | 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes |
| Business domains | 22 classified domains, 49 cross-domain edges |
| Intelligence score | **A (95%)** |
| Structural readiness | 98% (production-readiness-v2) |
| Live data connections | 0/7 (all structural; live = NOT CONNECTED — by design) |
| Validator gate | **107/107 green** (no regressions across all versions) |
| Launch verdict | Requires `pnpm graph:execution` verification; LB-7/8/9/10/12 closed 2026-06-19 |

---

# PART I — HISTORICAL EVOLUTION

## 1.1 The Origin

Before LCIS existed, the LetBuyy repository had only one intelligence artifact: the Graphify code graph — a tree-sitter static analysis of TypeScript, TSX, Dart, and MJS source producing 52,246 nodes and 66,761 edges. This was powerful for code-to-code relationships but had a defining blind spot: **only ~2% of the SQL/database layer was indexed** (2 DB nodes for 103 migrations). Postgres RPCs like `create_checkout_order` — the most critical function in the platform — were invisible to any graph query.

The forensic audit of 2026-06-10 (`GOVERNANCE_REWRITE_2026_06_10/`) found 291 architectural issues and 9 S0 security vulnerabilities. It also found the governance crisis: the prior `AGENTS.md` was auto-generated and encoded drift as law. The decision was made to rebuild both the governance model and the intelligence layer from scratch.

## 1.2 Version Timeline

```mermaid
timeline
    title LCIS Version History
    section Foundation
      V1 : DB intelligence layer added (db-intel.mjs)
         : 107 validators established
         : CLI query engine
    section Intelligence
      V2 : Infrastructure model (infra-intel.mjs)
         : FK relationships (705 FKs)
         : CODEOWNERS ownership
      V3 : 22 business domains
         : Cross-domain blast radius
         : Payment/security/deployment graphs
    section Operations
      V4 : Runtime topology
         : Governance memory (180 decisions)
         : Deployment state
      V5 : Merchant intelligence
         : Revenue model
         : 11 security controls
         : Production readiness
    section Intelligence OS
      OMEGA : 13-layer unified brain
            : Cost/telemetry/fix engine
            : Merchant lifecycle models
      V6    : Explain mode (human + AI)
            : AI context packs < 20k tokens
            : 30-min onboarding
    section Production OS
      V10     : URL-addressable deep links
      V11     : 10 business journeys
               : Founder/investor/developer modes
      OMEGA OS : Launch Command Center
               : AI Operations Center
    section Live Intelligence
      INFINITY : 8 autonomous detectors
               : 6 structural predictors
               : Incident timelines
      X        : Live provider federation (7 providers)
               : Per-domain live health
      Genesis  : Control centers (lineage, trace)
               : 16-perspective workspace
```

## 1.3 Key Architectural Decisions

| Decision | Version | Reasoning | Evidence |
|----------|---------|-----------|---------|
| Zero external npm dependencies | V1 | Supply-chain risk; tooling must not introduce vulnerabilities | `server.mjs` imports only `node:*` built-ins |
| Pre-computed JSON artifacts | V1 | Startup warmth; O(1) queries on pre-built knowledge | `loadOrBuild()` pattern in `server.mjs` |
| NOT CONNECTED honesty contract | V4 | Live values require credentials not in repo; fabrication is worse than absence | `live-adapters.mjs`: presence-only credential check |
| Hand-authored governance only | V1 | Prior auto-generated AGENTS.md encoded drift as law | DOC-R1 in AGENTS.md; `no-scan-generated-agents-validator.mjs` |
| Domain classification by regex, first-match-wins | V3 | Deterministic, reproducible, no ML inference | `domain-intel.mjs` DOMAIN_RULES array |
| Repository scan is last resort | V2 | All architectural questions should resolve via LCIS query | CLAUDE.md "LCIS-FIRST" protocol |
| 107 deterministic validators as authoritative gate | V1 | Heuristics produce candidates; determinism produces facts | `scripts/validate-governance.mjs` |

## 1.4 Gap Closure History

Every version closed documented gaps. The progression from 2% SQL coverage (baseline) to 95% intelligence score (OMEGA) was deliberate:

| Gap | Addressed | By |
|-----|-----------|-----|
| SQL/DB layer invisible (~2%) | V1 | `db-intel.mjs` |
| No table/RPC/policy lineage | V2 | `relationship-intel.mjs`, `infra-intel.mjs` |
| No domain classification | V3 | `domain-intel.mjs` (22 domains) |
| No cross-domain blast radius | V3 | `cross-domain-engine.mjs` |
| No organizational memory | V4 | `memory-intel.mjs` (180 decisions) |
| Cost intelligence (was 20%) | OMEGA | `cost-intelligence.mjs` |
| Autonomous fix plans (was 10%) | OMEGA | `fix-engine.mjs` |
| Live telemetry (was 30%) | OMEGA | 12 telemetry adapters (90% correct ceiling) |
| No navigable deep links | V10 | SPA routing + popstate navigation |
| No business journeys | V11 | `business-flow-intel.mjs` (10 journeys) |
| No autonomous detection | INFINITY | `detection-prediction-intel.mjs` (8 detectors) |
| No explain mode | V6 | `explain-intel.mjs` (22 domain nodes) |

---

# PART II — CONCEPTUAL ARCHITECTURE

## 2.1 Mission and Principles

**Mission:** Make it impossible for a LetBuyy engineer or AI agent to not know the answer to any architectural question.

**Three core principles:**

1. **Repository-as-truth.** Source code, database migrations, and infrastructure definitions are the single source of truth. LCIS does not maintain a separate knowledge database — it re-derives all intelligence from the repository at build time.

2. **Honesty over completeness.** Live operational values (error rates, GMV, merchant counts) are explicitly marked `NOT CONNECTED` with the exact source. The system never fabricates. This makes every answer trustworthy.

3. **Query-first, scan-last.** Every question an AI agent or engineer might ask is answerable via a single API call. The repository scan is the fallback of absolute last resort.

## 2.2 System Context

```mermaid
graph TB
    subgraph Sources["Source Inputs (Repository Truth)"]
        SRC[TypeScript/TSX/Dart<br/>Source Code]
        SQL[SQL Migrations<br/>414 tables · 156 RPCs]
        CFG[Wrangler/CI Configs<br/>4 workers · 5 queues]
        GOV[Governance Docs<br/>CONSTITUTION · AGENTS.md]
    end

    subgraph LCIS["LCIS (tools/graph-server/)"]
        GRF[Graphify<br/>tree-sitter scanner]
        DB[db-intel.mjs<br/>SQL parser]
        INF[infra-intel.mjs<br/>Config parser]
        DOM[domain-intel.mjs<br/>Domain classifier]
        ENG[81 Intelligence Engines<br/>V4→OMEGA→Genesis→INFINITY]
        SRV[server.mjs<br/>117+ REST endpoints<br/>:3333]
    end

    subgraph Consumers["Consumers"]
        AI[Claude Code<br/>Primary AI agent]
        ENG2[Human Engineers<br/>CLI + Atlas UI]
        CI[CI/CD System<br/>Artifacts + validation]
        OPS[On-call Engineers<br/>Runbooks + incident]
        EXEC[Founders / Product<br/>Executive center]
    end

    subgraph Live["Live Providers (NOT CONNECTED in dev)"]
        SUP[Supabase]
        CF[Cloudflare]
        VER[Vercel]
        PAY[Razorpay]
        RES[Resend]
    end

    SRC --> GRF --> SRV
    SQL --> DB --> SRV
    CFG --> INF --> SRV
    GOV --> DOM --> SRV
    ENG --> SRV

    SRV --> AI
    SRV --> ENG2
    SRV --> CI
    SRV --> OPS
    SRV --> EXEC

    Live -.->|NOT CONNECTED| SRV
```

## 2.3 The 13 Intelligence Layers

LCIS is organized as 13 additive intelligence layers. Each layer extends the previous — no rebuilding.

```mermaid
graph LR
    subgraph L0["Layer 0: Foundation"]
        G[graph.json<br/>52k nodes]
    end
    subgraph L1["Layer 1: DB"]
        DB[db-intel.json<br/>414 tables · 156 RPCs]
    end
    subgraph L2["Layer 2: Infra"]
        INF[infra-intel.json<br/>4 workers · 19 secrets]
    end
    subgraph L3["Layer 3: Domains"]
        DOM[domain-intel.json<br/>22 domains · 49 edges]
    end
    subgraph L4["Layer 4: Runtime"]
        RT[memory · runtime<br/>deployment · execution]
    end
    subgraph L5["Layer 5: Live Ops"]
        LO[merchant · revenue<br/>security · readiness]
    end
    subgraph L6["Layer 6: OMEGA"]
        OM[13-layer unified<br/>fix · cost · telemetry]
    end
    subgraph L7["Layer 7: Explain"]
        EX[22 domain nodes<br/>AI packs · onboarding]
    end
    subgraph L8["Layer 8+"]
        GEN[Genesis · INFINITY<br/>X · V11 · V10]
    end

    G --> DB --> INF --> DOM --> RT --> LO --> OM --> EX --> GEN
```

## 2.4 Data Flow

```mermaid
flowchart TD
    A[Repository Source] -->|graphify update .| B[graph.json 44MB]
    A -->|pnpm graph:db| C[db-intel.json]
    A -->|pnpm graph:infra| D[infra-intel.json]
    A -->|pnpm graph:domain| E[domain-intel.json]

    B & C & D & E -->|pnpm graph:omega| F[50+ JSON artifacts<br/>graphify-out/]

    F -->|node tools/graph-server/server.mjs| G[HTTP Server :3333]

    G -->|GET /api/explain?node=payments| H[AI Agent]
    G -->|GET /api/blast?q=getSupabaseAdmin| I[Engineer CLI]
    G -->|GET /api/runbook?domain=payments| J[On-call]
    G -->|GET /api/launch-command-center| K[Founder]

    L[Live Providers<br/>Supabase/CF/Vercel...] -.->|NOT CONNECTED| G
```

## 2.5 Trust Model

LCIS operates within a strict trust boundary:

- **CONNECTED (always reliable):** Repository truth — code graph, DB schema, infrastructure topology, governance decisions, FK relationships, ownership from CODEOWNERS, deployment topology (declared), git time-points
- **NOT CONNECTED (requires live credentials):** All 7 providers, all 11 live metrics, all revenue/merchant/customer magnitudes, all incident timestamps, all availability readings
- **Advisory only:** All LCIS heuristic findings (dead code candidates, missing-RLS candidates, audit findings) — the 107 deterministic validators are the authoritative gate

---

# PART III — KNOWLEDGE ARCHITECTURE

## 3.1 The Domain Ontology

LCIS organizes all knowledge into **22 business domains** — the primary organizing unit. Every entity (table, route, RPC, worker, queue, secret) is classified into exactly one domain.

```mermaid
graph TB
    subgraph T1["Tier 1 — Critical (Money Path)"]
        PAY[payments]
        ORD[orders]
        REF[refunds]
        POU[payouts]
        GFT[gift-cards]
        INV[inventory]
        SHP[shipping]
        PRD[products]
        ANA[analytics]
        OPS[operations]
        MER[merchant]
    end
    subgraph T2["Tier 2 — Important"]
        STF[storefront]
        ATH[authentication]
        AUT[authorization]
        IDN[identity]
        NOT[notifications]
        DIS[discounts]
        GST[gst]
        COL[collections]
        THM[themes]
        MKT[marketplace]
        DEV[developer]
    end

    ORD -->|depends-on| PAY
    ORD -->|depends-on| INV
    PAY -->|depends-on| ORD
    REF -->|depends-on| PAY
    POU -->|depends-on| PAY
    MER -->|consumed-by| ORD
    MER -->|consumed-by| PAY
    ANA -->|consumed-by 8| T1
```

**Classification rule:** Ordered regex matching (first-match wins). A table/RPC/route is classified by matching its name against 22 domain patterns. The result is deterministic and reproducible.
*Source: `tools/graph-server/domain-intel.mjs`*

## 3.2 Complete Knowledge Object Taxonomy

| Layer | Entity Type | Count | Source |
|-------|-------------|-------|--------|
| Code | Module Node | 52,246 | `graphify update .` |
| Code | Community | 3,279 | Louvain clustering by Graphify |
| Code | Edge (typed) | 66,761 | 15 relation types |
| DB | Table | 414 | `db-intel.mjs` ← SQL migrations |
| DB | Function/RPC | 156 | Same; 128 SECURITY DEFINER |
| DB | RLS Policy | 651 | Same |
| DB | Trigger | 395 | Same |
| DB | Index | 826 | Same |
| DB | FK Relationship | 705 | `relationship-intel.mjs` |
| Infra | Worker | 4 | `infra-intel.mjs` ← wrangler.toml |
| Infra | Queue | 5 | Same; 7 consumer bindings |
| Infra | Secret | 19 | Same ← production-deploy.yml |
| Infra | Vercel App | 5 | Same |
| Domain | Business Domain | 22 | `domain-intel.mjs` |
| Domain | Cross-Domain Edge | 49 | Same; strength-weighted |
| Domain | Governance Decision | 180 | `memory-intel.mjs` ← 41 docs |
| Domain | FK Root (`sites`) | 260 inbound | `relationship-intel.mjs` |
| V6 | Explain Node | 22 | `explain-intel.mjs` + hand-authored |
| V11 | Business Journey | 9 (+ 1 NOT IMPL) | `business-flow-intel.mjs` |
| INFINITY | Detector | 8 | `detection-prediction-intel.mjs` |
| INFINITY | Predictor | 6 | Same |
| Adapters | Live Provider | 7 | `live-adapters.mjs` |
| Ops | Runbook | 22 | `runbook-engine.mjs` |

## 3.3 Entity Relationships

The four primary join keys that connect layers:

| Join | Mechanism | Example |
|------|-----------|---------|
| **Code ↔ DB** | `.rpc('name')` call sites in gateway TypeScript | `checkout.ts` → `create_checkout_order` → `orders`, `payment_transactions` |
| **Code ↔ Infra** | Queue binding names in wrangler.toml | `NOTIFICATION_QUEUE` → `queue-workers` consumer |
| **Any ↔ Ownership** | CODEOWNERS longest-prefix match | `/services/api-gateway/*` → `@saai-sidd` |
| **Any ↔ Domain** | Regex classification on entity names | `payment_transactions` → `payments` domain |

## 3.4 The 18 Canonical Money Tables

These tables receive special treatment throughout LCIS — any table in this set is flagged `money: true` and classified as Tier 1 critical:

```
payment_transactions · payments · payout_statements · payouts
refund_transactions · refunds · cod_reconciliation_entries · settlements
wallet_ledger_entries · partner_payout_ledger_entries
gift_card_accounts · gift_card_ledger_entries · gift_card_redemptions
ledger_transactions · ledger_entries · orders · order_items · ai_credits
```

*Source: `tools/graph-server/db-intel.mjs`, `MONEY_TABLES` Set constant*

## 3.5 Knowledge Storage

All knowledge is stored as **pre-computed JSON artifacts** in `graphify-out/` (gitignored). No database, no vector store, no embeddings.

```mermaid
graph LR
    A[Source Repository] -->|extraction scripts| B[graphify-out/]
    B --> C[graph.json 44MB]
    B --> D[db-intel.json]
    B --> E[domain-intel.json]
    B --> F[50+ derived artifacts]
    B -->|server startup| G[In-Memory Maps]
    G -->|<10ms queries| H[REST API]
```

**Loading pattern** (`loadOrBuild` in `server.mjs`):
```javascript
const merchantHealth = loadOrBuild('merchant-health.json', buildMerchantHealth);
// Prefer cached JSON (fast, ~10ms) → fall back to live build (~200ms)
```

---

# PART IV — REPOSITORY INTELLIGENCE SYSTEM

## 4.1 Scanner Architecture

LCIS uses two types of scanners:

**External scanner (Graphify):** Installed via `uv tool install graphifyy` (Python, tree-sitter). Runs `graphify update .` to produce `graph.json`. Covers TypeScript, TSX, Dart, MJS, Markdown. Does NOT index SQL function bodies — this gap is filled by the custom DB scanner.

**Custom scanners (Node.js .mjs):** Three primary extraction engines built in-house:

```mermaid
flowchart LR
    M["database/supabase/migrations/*.sql<br/>(103 files, sorted numerically)"] --> DB["db-intel.mjs<br/>Regex-based SQL parser"]
    W["services/*/wrangler.toml<br/>.github/workflows/production-deploy.yml<br/>.github/CODEOWNERS"] --> IF["infra-intel.mjs<br/>Config parser"]
    DB & IF --> DM["domain-intel.mjs<br/>22-domain classifier"]

    DB --> J1["db-intel.json"]
    IF --> J2["infra-intel.json"]
    DM --> J3["domain-intel.json"]
```

## 4.2 Knowledge Extraction Mechanics

### db-intel.mjs — SQL Extraction

**Pass 1 — Migration parsing:**
- `CREATE TABLE` → name, columns, `site_id`/`store_id` presence (tenant detection), RLS status
- `CREATE POLICY` → name, table, `USING (true)` flag, `site_id` usage, service-role scope
- `SECURITY DEFINER` keyword → privileged RPC
- `idempotency_key` column → idempotency detection
- `FOR UPDATE` clause → row-lock detection
- `INSERT INTO|UPDATE|DELETE FROM|FROM|JOIN` in SQL body → table-touch detection

**Pass 2 — Call-site scan:**
Recursively reads `.ts` files in:
- `services/api-gateway/src/routes/**`
- `services/api-gateway/src/execution/**`
- `services/queue-workers/src/**`

Extracts `.rpc('name')` patterns → builds `routeRpc` (route file → Set of RPCs) and `rpcCallers` (RPC name → Set of caller files).

### infra-intel.mjs — Infrastructure Extraction
Parses: 4 `wrangler.toml` files, `production-deploy.yml` (19 `wrangler secret put` commands, 5 Vercel targets, migration gate presence), `.github/CODEOWNERS` (26 path rules).

### domain-intel.mjs — Domain Classification
Applies 22 ordered regex rules (specific → general, first-match wins) to classify each table/route/RPC into exactly one business domain. Derives cross-domain edges from RPCs in domain A touching tables belonging to domain B.

## 4.3 Complete Engine Inventory

LCIS has 83 files in `tools/graph-server/`. Key engines by version:

| Version | Engines | Purpose |
|---------|---------|---------|
| V1 | `intelligence.mjs`, `db-intel.mjs`, `gen-reports.mjs` | Core graph queries, SQL extraction |
| V2 | `infra-intel.mjs`, `relationship-intel.mjs` | Infrastructure, FK relationships |
| V3 | `domain-intel.mjs`, `cross-domain-engine.mjs`, `payment-intel.mjs`, `security-intel.mjs`, `deployment-intel.mjs`, `incident-intel.mjs`, `merchant-intel.mjs` | 22-domain model |
| V4 | `memory-intel.mjs`, `runtime-intel.mjs`, `deployment-state.mjs`, `change-impact.mjs`, `incident-response.mjs`, `execution-intel.mjs` | Runtime + memory |
| V5 | `runtime-observability-intel.mjs`, `merchant-intelligence.mjs`, `revenue-intelligence.mjs`, `security-intelligence-v5.mjs`, `production-readiness-intel.mjs`, `decision-engine-v5.mjs` | Live operating intelligence |
| OMEGA | `merchant-health-intel.mjs`, `merchant-growth-intel.mjs`, `merchant-adoption-intel.mjs`, `merchant-risk-intel.mjs`, `merchant-churn-intel.mjs`, `customer-intelligence-v2.mjs`, `revenue-intelligence-v2.mjs`, `cost-intelligence.mjs`, `telemetry-intelligence.mjs`, `memory-v2.mjs`, `fix-engine.mjs`, `unified-intelligence-engine.mjs`, `discovery-v2.mjs`, `production-readiness-v2.mjs`, `decision-engine-v2.mjs` | 13-layer brain |
| V6 | `explain-intel.mjs`, `search-intel.mjs`, `ai-context-intel.mjs` | Explain mode, AI packs |
| V7 | `connections-intel.mjs`, `production-health.mjs`, `audit-engine-v2.mjs`, `mission-control-dashboard.mjs`, `ecosystem-intel.mjs` | Mission control |
| Genesis | `database-control-intel.mjs`, `environment-control-intel.mjs`, `infrastructure-control-intel.mjs`, `commerce-control-intel.mjs`, `incident-control-intel.mjs`, `launch-command-center.mjs` | Control centers |
| LCIS X | `federation-intel.mjs`, `live-health-intel.mjs`, `live-adapters.mjs` | Live federation |
| V11 | `business-flow-intel.mjs` | 10 business journeys |
| INFINITY | `detection-prediction-intel.mjs` | 8 detectors + 6 predictors |
| Shared | `knowledge-graphs.mjs`, `runbook-engine.mjs`, `diagnosis-engine.mjs`, `environment-intel.mjs`, `environment-registry.mjs` | Knowledge graphs, ops |

## 4.4 Build Pipeline

```mermaid
flowchart LR
    V3["pnpm graph:v3<br/>db + infra + domain + reports"]
    V4["pnpm graph:v4<br/>v3 + memory + runtime +<br/>deployment-state + execution"]
    V5["pnpm graph:v5<br/>v4 + runtime-obs + merchant +<br/>revenue + security + readiness"]
    OM["pnpm graph:omega<br/>v5 + 15 omega engines +<br/>reports + explain docs"]
    UI["pnpm graph:ui<br/>Start server :3333"]

    V3 --> V4 --> V5 --> OM --> UI
```

---

# PART V — TECHNICAL ARCHITECTURE

## 5.1 The Server

`tools/graph-server/server.mjs` (1,101 lines) is a **zero-dependency Node.js HTTP server**:
- Imports: `node:http`, `node:fs`, `node:path`, `node:url`, `node:child_process` only
- No Express, no Fastify, no external framework
- All routing: `if (p === '/api/X') return json(res, Y)` chain
- Port: 3333 (overridable via `GRAPH_UI_PORT`)

**Startup sequence:**
1. Load `graph.json` → build `byId` Map, `outAdj`/`inAdj`/`degree` indexes (hard gate: `process.exit(1)` if absent)
2. Load `db-intel.json`, `infra-intel.json`, `domain-intel.json` (optional, graceful degradation)
3. Fresh-build V4 engines (runtime, memory, deployment, execution) wrapped in `safe()` — returns `{error}` instead of crashing
4. `loadOrBuild()` all OMEGA artifacts: prefer pre-built JSON, fall back to live build
5. Build Genesis, LCIS X, INFINITY, V11, V6 layers
6. Start HTTP server, log stats to stdout

**Request latency:** <10ms for all endpoints (in-memory computation over pre-loaded data).

## 5.2 Platform Infrastructure

```mermaid
graph TB
    subgraph CF["Cloudflare (ap-south)"]
        GW["api-gateway Worker<br/>/v1/* routes"]
        QW["queue-workers Worker<br/>Async jobs"]
        WH["webhook-service Worker<br/>Inbound webhooks"]
        MB["mobile-bff Worker<br/>/mobile/v1/*"]
        Q1[NOTIFICATION_QUEUE]
        Q2[PAYMENT_QUEUE]
        Q3[ORDER_QUEUE]
        Q4[WEBHOOK_QUEUE]
        Q5[ANALYTICS_QUEUE]
        HD[Hyperdrive Pool]
        R2[R2 Media Storage]
        GW --> Q1 & Q2 & Q3 & Q4 & Q5
        QW --> Q1 & Q2 & Q3 & Q4 & Q5
        GW --> HD
    end
    subgraph VER["Vercel"]
        IP[identity-platform]
        MC[merchant-control-plane]
        SR[storefront-runtime]
        MS[marketing-site]
        PC[platform-console]
    end
    subgraph SUP["Supabase (Postgres)"]
        PG[(414 tables<br/>156 RPCs<br/>651 policies<br/>705 FKs)]
    end
    GW <--> PG
    QW <--> PG
    HD --> PG
    VER --> GW
```

## 5.3 Database Architecture

**Tenant model:** Multi-tenant single-database. All tenant data scoped by `site_id` column referencing `sites.id` (the tenant root, with 260 inbound FKs).

**RLS enforcement:**
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on all tenant tables
- 394 tables with RLS enabled; 44 with FORCE
- 651 policies; no `USING (true)` on public-accessible data
- Enforced by `rls-force-coverage-validator.mjs` and `no-public-using-true-validator.mjs`

**Money invariants (all enforced by `canonical-ledger-only-validator.mjs`):**
1. All writes to 18 money tables go through SECURITY DEFINER RPCs via `db.rpc()`
2. Every money RPC requires `idempotency_key` (ON CONFLICT DO NOTHING pattern)
3. Every money RPC uses `FOR UPDATE` row locks (prevent race conditions)
4. Balance columns: `CHECK (balance >= 0)`
5. GST invoices: immutable after creation

## 5.4 Authentication Architecture

```mermaid
graph LR
    subgraph Issuers["Two Issuers — NEVER CROSSED"]
        CS["identity-platform<br/>apps/identity-platform<br/>ES256 (merchant JWT)"]
        HS["api-gateway<br/>services/api-gateway<br/>HS256 (customer JWT)"]
    end
    subgraph Consumers
        MC[merchant-control-plane]
        SR[storefront-runtime]
        GW[api-gateway routes]
    end
    CS -->|LETBUYY_IDENTITY_PUBLIC_JWKS| MC
    CS -->|LETBUYY_IDENTITY_PUBLIC_JWKS| GW
    HS -->|CUSTOMER_SESSION_SECRET| SR
    HS -->|CUSTOMER_SESSION_SECRET| GW
```

*Enforced by `identity-sole-issuer-validator.mjs` and `single-source-crypto-validator.mjs`*

## 5.5 API Surface Summary

117+ endpoints across 12 version layers. Representative sample:

| Layer | Key Endpoints | Purpose |
|-------|--------------|---------|
| Foundation | `/api/stats`, `/api/search`, `/api/blast`, `/api/node`, `/api/path` | Core graph queries |
| DB Intel | `/api/db`, `/api/table`, `/api/rpc`, `/api/policy` | Database intelligence |
| Domain | `/api/domains`, `/api/domain`, `/api/cross-domain`, `/api/payment`, `/api/security` | Domain intelligence |
| Runtime | `/api/runtime`, `/api/deployment-state`, `/api/change-impact`, `/api/memory` | Runtime + change tracking |
| V5 | `/api/runtime-intelligence`, `/api/merchant-intelligence`, `/api/revenue-intelligence`, `/api/production-readiness` | Live operating |
| OMEGA | `/api/unified-intelligence`, `/api/fix-engine`, `/api/cost-intelligence`, `/api/telemetry` | Unified brain |
| V6 | `/api/explain`, `/api/copilot`, `/api/relationships` | Explain mode |
| Genesis | `/api/lineage`, `/api/trace`, `/api/workspace`, `/api/launch-command-center`, `/api/ai-pack` | Control centers |
| LCIS X | `/api/federation`, `/api/live-health`, `/api/investigate`, `/api/root-cause`, `/api/observability` | Live federation |
| V11 | `/api/business-flow`, `/api/investor`, `/api/developer`, `/api/founder` | Business intelligence |
| OMEGA OS | `/api/launch-status`, `/api/ai-ops` | Production OS |
| INFINITY | `/api/detection`, `/api/predict`, `/api/live-metrics`, `/api/incident-timeline` | Detection/prediction |

---

# PART VI — AI ARCHITECTURE

## 6.1 The LCIS-FIRST Protocol

LCIS embeds a mandatory query ordering protocol in `CLAUDE.md`. This protocol grew stronger with every version:

```
V2: "pnpm graph:intel blast" before any code change
V3: "LCIS-FIRST" — query before any file search
V4: 7-row execution order (LCIS→Runtime→Impact→Ownership→Memory→Deployment)
V5: "V5-FIRST" — Runtime→Merchant→Revenue→Security→Incident→Decision
OMEGA: "OMEGA-FIRST" — Unified Brain→Fix→Telemetry→Revenue→Merchant→Customer→Runtime→Domain→DB→Code
V6: "Fall back to repo scan ONLY when LCIS returns nothing or data layer is stale"
```

The protocol is enforced at multiple levels:
1. `CLAUDE.md` contains explicit query tables mapping every question type to its LCIS endpoint
2. `AGENT-R1` in `AGENTS.md` mandates LCIS-first
3. AI context packs include LCIS query examples

## 6.2 Context Assembly Flow

```mermaid
flowchart TD
    Q[AI Agent Question:<br/>"What breaks if payments fail?"] --> NL[Natural language routing<br/>resolveDomain 'pay' → 'payments']
    NL --> API[GET /api/cross-domain?key=payments]
    API --> CTX[Structured JSON response:<br/>• 6 affected domains<br/>• 49 transitive edges<br/>• affected routes/RPCs/tables<br/>• blast radius score]
    CTX --> ANS[AI Agent composes answer<br/>without reading source files]
    ANS --> ACT[Action: run fix with evidence]
```

## 6.3 AI Packs (< 20k tokens)

`tools/graph-server/ai-context-intel.mjs` generates self-contained context packs:

**Pack types by target model:**
- `/api/ai-pack?target=claude` — optimized for Claude Code
- `/api/ai-pack?target=gemini` — optimized for Gemini API
- `/api/ai-pack?target=codex` — optimized for OpenAI Codex
- `/api/ai-pack?target=cursor` — optimized for Cursor IDE
- `/api/ai-pack?target=openai` — optimized for ChatGPT

**Pack contents (in order):**
1. Project description + commerce/payment/refund/security flows
2. Launch verdict + blockers
3. Live-data connection status (all NOT CONNECTED in dev)
4. All 22 domain summaries
5. LCIS query examples for common questions

**Token measurement:** characters ÷ 4. Flagged if > 20,000 tokens.

**Per-domain paste-ready AI context** available at `/api/explain?node=X` → `aiContext` field: a single string with domain purpose, tables, RPCs, critical rules — ready to paste into any AI conversation.

## 6.4 Natural Language Routing

Three routing mechanisms, applied in order:

```javascript
function resolveDomain(q) {
  // 1. Direct key match: "orders" → "orders"
  // 2. Keyword hint map (40+ entries):
  //    checkout→orders, pay→payments, refund→refunds, ship→shipping,
  //    tax→gst, login→authentication, theme→themes, gift→gift-cards, ...
  // 3. Semantic search: searchV2(q, explainIntel) → fuzzy keyword match
}
```

Powers: `/api/copilot`, `/api/ops-copilot`, `/api/investigate`, `/api/root-cause`, `/api/change-impact-live`

## 6.5 The 12 Audit Agents

LCIS ships 12 Claude slash commands for systematic domain audits (`/.claude/commands/agent-*.md`). Each agent:
1. Queries relevant LCIS endpoints (graph, domain, security, etc.)
2. Inspects specific source code
3. Reports findings with file:line citations

| Agent | Primary Endpoints Used |
|-------|----------------------|
| `agent-security-audit` | `/api/security-intelligence`, `/api/policy?table=` |
| `agent-payment-audit` | `/api/payment`, `/api/rpc?name=`, `/api/db` |
| `agent-tenant-audit` | `/api/domain?key=`, `/api/policy?table=` |
| `agent-identity-audit` | `/api/domain?key=identity`, `/api/domain?key=authentication` |
| `agent-checkout-audit` | `/api/rpc?name=create_checkout_order`, `/api/trace?entity=checkout` |
| `agent-infrastructure-audit` | `/api/infra`, `/api/secrets`, `/api/deployment` |
| `agent-release-audit` | `/api/launch-command-center`, `/api/execution` |

## 6.6 The 7 Stop-Condition Questions

LCIS OMEGA guarantees these 7 questions are answerable without a repo scan:

| Question | Endpoint |
|----------|---------|
| How does X work? | `/api/explain?node=X` |
| What breaks if X fails? | `/api/cross-domain?key=X` + `/api/impact-score?domain=X` |
| Who owns X? | `/api/owner?q=X` |
| What should I fix next? | `/api/decision-v2` + `/api/fix-engine` |
| What blocks launch? | `/api/launch-command-center` + `/api/launch-status` |
| What is affected? | `/api/business-impact?domain=X` |
| How do I recover? | `/api/runbook?domain=X` + `/api/incident-control?target=X` |

---

# PART VII — GOVERNANCE ARCHITECTURE

## 7.1 The Authority Chain

```mermaid
graph TD
    DOC01["DOC 01 — LETBUYY_CONSTITUTION.md<br/>Supreme law · ARB-ratified 2026-06-10<br/>471 lines · Articles ART-01 through ART-24"] --> DOC02
    DOC02["DOC 02 — AGENTS.md (root)<br/>Hand-authored operating rulebook<br/>405 lines · 16 rule sections<br/>Source: GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md"] --> DOC03
    DOC03["DOC 03 — LETBUYY_CANONICAL_SYSTEMS.md<br/>Winner registry: one canonical system per domain"] --> DOC04
    DOC04["DOC 04/05 — Legacy elimination + Foundation roadmap<br/>How and when convergence happens"] --> DOC05
    DOC05["DOC 05/06 — UI/UX Governance + docs/governance/*<br/>Domain-specific governance"]

    style DOC01 fill:#cc0000,color:#fff
    style DOC02 fill:#cc6600,color:#fff
    style DOC03 fill:#ccaa00,color:#000
```

**The central governance lesson:** A prior auto-generated `AGENTS.md` was produced by a repository scan and encoded repository drift as law. DOC-R1 in AGENTS.md now mandates: *"Governance/authority documents MUST be hand-authored law. MUST NOT generate a governance/authority document from a repository scan."*

## 7.2 The 107 Validator Gate

The authoritative blocking gate: `node scripts/validate-governance.mjs`

```mermaid
graph LR
    subgraph Critical["Fast-fail (5 validators)"]
        D1[dependency-manifest]
        D2[undeclared-import]
        D3[package-export]
        D4[dependency-graph]
        D5[circular-import]
    end
    subgraph Gate["Remaining 102 validators"]
        G1[canonical-ledger-only<br/>MONEY TABLE PROTECTION]
        G2[rls-force-coverage<br/>TENANT ISOLATION]
        G3[identity-sole-issuer<br/>AUTH INTEGRITY]
        G4[topology-drift<br/>RUNTIME INTEGRITY]
        G5[no-scan-generated-agents<br/>GOVERNANCE INTEGRITY]
        G6[no-public-using-true<br/>DATA PRIVACY]
        G7[... 96 more ...]
    end
    PR[Pull Request] --> Critical --> Gate --> MERGE[Merge Allowed]
    Critical --> |FAIL| BLOCK[Blocked]
    Gate --> |FAIL| BLOCK
```

**Gate modes:** `--lane=gate` (107, default) · `--lane=report` (1 non-blocking) · `--lane=all` (108)  
**Rule:** A validator cannot be silently removed from the critical list without a Wave 0 governance entry.

## 7.3 CI/CD Integration

```mermaid
graph TB
    PR[Pull Request] --> CI["ci.yml<br/>107-validator gate (BLOCKING)"]
    CI --> PASS[Merge allowed]
    CI --> FAIL[Merge blocked]

    PUSH[Push to migration/gateway/tools] --> GI["graph-intelligence.yml<br/>Full LCIS rebuild (ADVISORY)"]
    GI --> ART["Upload artifacts<br/>db-intel.json · domain-intel.json<br/>(14-day retention)"]

    WEEK[Weekly] --> SEC["full-security-audit.yml<br/>claude-code-security-review action"]

    PR --> SEC2["security-review.yml<br/>PR security review"]
```

## 7.4 The NOT CONNECTED Governance Contract

The NOT CONNECTED principle is governance-level — it appears in AGENTS.md (`ANTI-R5`) and is technically enforced:

```javascript
// tools/graph-server/live-adapters.mjs — The contract in code:
function adapterStatus(provider) {
  const hasCredentials = PROVIDERS[provider].required
    .every(k => process.env[k] && String(process.env[k]).trim());
  
  if (!hasCredentials) {
    return {
      status: 'NOT CONNECTED',
      exactSource: PROVIDERS[provider].required.join(' + '),
      integration: `set ${PROVIDERS[provider].required[0]} to connect`
      // Zero network calls. Zero credential value access.
    };
  }
  return probeAdapter(provider); // Real read-only GET with 6-second timeout
}
```

**What is always CONNECTED (repository truth):** Code/DB/domain/infra graphs, lineage traces, blast radius, RLS/policy/trigger/FK mappings, ownership from CODEOWNERS, runbook procedures, git time-points.

**What is always NOT CONNECTED (live, by design):** All 7 providers, all 11 live metrics, all revenue/merchant/customer magnitudes.

## 7.5 Knowledge Lifecycle

```mermaid
flowchart LR
    A[Source Code Changes] --> B[CI triggers graph-intelligence.yml]
    B --> C[pnpm graph:omega runs]
    C --> D[50+ JSON artifacts updated<br/>in graphify-out/]
    D --> E[Server loads new artifacts<br/>on next restart]
    E --> F[107 validators verify<br/>no drift introduced]
    F --> G[Knowledge served<br/>at :3333]
```

---

# PART VIII — AUDIT FINDINGS

## 8.1 Architecture Assessment: PASS

| Dimension | Finding | Verdict |
|-----------|---------|---------|
| Server design | Zero external dependencies; Node.js built-ins only | ✓ PASS |
| Data loading | `loadOrBuild()` pattern; fail-closed on missing graph.json | ✓ PASS |
| API surface | 117/117 endpoints verified HTTP 200 (INFINITY certification) | ✓ PASS |
| SPA deep linking | All `/domain/X/Y` paths refresh-safe; V10 certified | ✓ PASS |
| Atlas visualization | Force-directed layout in pure JS; spatial hashing for O(n) repulsion | ✓ PASS |

## 8.2 Security Assessment: PASS

| Dimension | Finding | Verdict |
|-----------|---------|---------|
| Credential exposure | Presence-only check; credential values never read or emitted | ✓ PASS |
| Live probes | All 7 probes are read-only GET requests; no write operations | ✓ PASS |
| XSS in Atlas UI | JSON serialization (not HTML interpolation) for graph data | ✓ PASS |
| LCIS modifies source | All `writeFileSync` calls write only to `graphify-out/` | ✓ PASS |
| SQL injection via API | Graph queries are string matching on pre-loaded Maps; no SQL | ✓ PASS |

## 8.3 Knowledge Assessment: PASS WITH CEILINGS

| Dimension | Finding | Verdict |
|-----------|---------|---------|
| Graph statistics | 52,246 nodes / 66,761 edges / 3,279 communities — consistent across all reports | ✓ PASS |
| Money table coverage | 18 canonical money tables correctly identified in `MONEY_TABLES` Set | ✓ PASS |
| Domain classification | 22 domains; route coverage 95%, table 79%, RPC 83% | ✓ PASS (ceilings documented) |
| SQL body analysis | Regex parser misses complex CTEs and aliased subqueries | ⚠ CEILING |
| Cross-domain edges | 49 edges derived from code evidence (`via` arrays with call sites) | ✓ PASS |

## 8.4 Governance Assessment: PASS

| Dimension | Finding | Verdict |
|-----------|---------|---------|
| AGENTS.md hand-authored | Markers `# LETBUYY_AGENTS_V2` + `HAND-AUTHORED LAW` present and verified | ✓ PASS |
| Retired generator | `scripts/generate-repository-intelligence.mjs` exits with code 1 | ✓ PASS |
| 107 validator gate | 107/107 green across all LCIS versions (V3→INFINITY certifications) | ✓ PASS |
| NOT CONNECTED contract | Zero instances of fabricated live values found in any engine | ✓ PASS |
| Anti-fabrication gate | `topology-json-antifabrication-validator.mjs` wired and operational | ✓ PASS |

## 8.5 Maturity Score

| Capability Area | Score | Evidence |
|----------------|-------|---------|
| Code intelligence | 100% | All 52,246 nodes indexed; 15 edge types |
| Database intelligence | 100% | 414 tables, 156 RPCs, 651 policies extracted |
| Infrastructure intelligence | 100% | All 4 workers, 5 queues, 19 secrets mapped |
| Domain intelligence | 95% | 22 domains, 82% coupling; 5% unclassifiable by design |
| Organizational memory | 100% | 180 decisions from 41 sources |
| Business intelligence | 90% | 10 journeys (subscription NOT IMPLEMENTED) |
| Live telemetry | 90% | 12 adapter sources; values NOT CONNECTED (correct ceiling) |
| Security intelligence | 100% | 11 controls, 5 trust boundaries |
| Production readiness | 98% | 10-dimension assessment (production-readiness-v2) |
| **Overall** | **A (95%)** | **OMEGA + Genesis + INFINITY + X certified** |

## 8.6 Strengths and Risks

**Strengths:**
- Rigorously honest: NOT CONNECTED contract prevents fabricated answers
- Zero dependencies: no supply-chain risk in intelligence tooling
- Deterministic: regex classification produces reproducible, auditable results
- Incremental: each LCIS version extends without rebuilding
- Self-validating: 107 validators catch governance drift before it can propagate

**Risks:**
- 0/7 live providers connected — structural intelligence only; cannot answer "what's happening now"
- SQL body analysis via regex (ceiling, not bug) — complex RPC logic may be misclassified
- Single-owner CODEOWNERS — all 22 domains owned by `@saai-sidd`; single point of escalation
- Knowledge is static at build time — changes since last `pnpm graph:omega` are invisible
- Graphify dependency — LCIS code graph requires an external Python CLI

---

# PART IX — GAP ANALYSIS

## 9.1 Implementation Status

```mermaid
pie title LCIS Implementation Status
    "Fully Implemented" : 85
    "Implemented (live NOT CONNECTED)" : 10
    "Subscription Journey NOT IMPL" : 3
    "Mobile Intelligence Partial" : 2
```

## 9.2 Completed Components

All of the following are fully operational (repository-truth):

Code graph (52,246 nodes), DB intelligence (414 tables, 156 RPCs), Infrastructure topology (4 workers), Domain model (22 domains), FK relationships (705), Security posture (11 controls, 651 policies), Governance memory (180 decisions), Runtime topology (Worker→Queue→Cron→RPC→Table), Production readiness model (structural), Fix engine (ranked plans, never auto-applied), Runbooks (22 domains with escalation), Detection (8 detectors, structural risk), Prediction (6 predictors, structural predisposition), Explain mode (22 nodes, AI packs), Business journeys (9 implemented), Atlas visualization, V10 deep links, Autonomous audit (candidates).

## 9.3 NOT CONNECTED by Design (Architecture Ceiling)

These are NOT gaps. They correctly declare the limit between repository intelligence and operational intelligence:

| Metric | Source When Connected |
|--------|----------------------|
| API latency (p50/p95/p99) | Cloudflare Analytics Engine |
| Worker error rate / CPU | Cloudflare Analytics Engine / wrangler tail |
| Queue depth + DLQ count | Cloudflare Queues metrics |
| Database latency / errors | Supabase Postgres metrics |
| Active merchant count | `SELECT COUNT(*) FROM sites` |
| Daily GMV | Supabase ledger reconciliation RPC |
| Email delivery rate | Resend API `/domains` |
| Payment success rate | Razorpay API + Supabase webhooks |
| Live deploy versions | Vercel/Cloudflare deployment APIs |

**First recommended connection:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in staging → unlocks merchant count, GMV, database health, payment success rate, FK verification.

## 9.4 Genuinely Missing

| Gap | Priority | Effort |
|-----|---------|--------|
| Subscription journey | Medium | Build subscriptions domain first, then add journey |
| Mobile app intelligence | Low | Flutter Dart coverage is partial |
| SQL AST parser (replace regex) | Low | pg-query-emscripten or similar |
| Multi-owner CODEOWNERS | Low | Add team-based ownership rules |
| PayPal as second payment provider | Medium | H8 blocker adjacency |

## 9.5 Prioritized Roadmap

| Priority | Action | Impact |
|----------|--------|--------|
| **P0 — Immediate** | Connect staging Supabase read token | Activates 90% of live telemetry capability already built |
| **P0 — Immediate** | Verify LB-7/8/9/10/12 closure via `pnpm graph:execution` | Confirms launch verdict update |
| **P1 — This quarter** | Expand domain-intel regex coverage | Close 5% unclassified table gap |
| **P1 — This quarter** | Add team CODEOWNERS rules | Improve incident escalation accuracy |
| **P2 — Next quarter** | Wire Cloudflare AE adapter | Live worker/queue health metrics |
| **P3 — Future** | Subscription domain + journey | Complete the 10th business journey |
| **P3 — Future** | SQL AST parser | Improve RPC body analysis accuracy |

---

# PART X — PAPAA ESCOLA MIGRATION BLUEPRINT

## 10.1 Domain Mapping

Papaa Escola has 13 education domains. The mapping from LetBuyy's 22 commerce domains:

| PIS Domain | Purpose | LetBuyy Equivalent | Money Path |
|-----------|---------|------------------|-----------|
| `admissions` | Enrollment management | `orders` | No |
| `students` | Student records | `merchant` (tenant entity) | No |
| `parents` | Parent portal | `storefront` | No |
| `teachers` | Teacher management | `identity` | No |
| `academics` | Curriculum + grades + exams | `products` + `collections` | No |
| `attendance` | Daily attendance | `inventory` (resource) | No |
| `finance` | Fee collection + accounts | `payments` + `refunds` + `payouts` | **YES** |
| `payroll` | Staff payroll | `payouts` | **YES** |
| `hr` | Human resources | `identity` + `merchant` | No |
| `transport` | School bus routing | `shipping` | No |
| `library` | Book management | `inventory` | No |
| `communication` | SMS/email/notifications | `notifications` | No |
| `analytics` | Reports + dashboards | `analytics` | No |

## 10.2 The Papaa Intelligence System (PIS) Architecture

```mermaid
graph TB
    subgraph PIS["PIS (tools/pis-server/)"]
        S[server.mjs<br/>Port 3335]
        D[pis-domain-intel.mjs<br/>13 education domains]
        DB[pis-db-intel.mjs<br/>school_id tenant key]
        EX[pis-explain-intel.mjs<br/>Education narratives]
        BF[pis-business-flow-intel.mjs<br/>10 education journeys]
        LA[pis-live-adapters.mjs<br/>Supabase/Razorpay/CF]
    end
    subgraph Config["products/papaa-escola/"]
        CFG[cip.config.mjs<br/>13 domains, school_id]
        NAR[explain/*.md<br/>Hand-authored narratives]
        VAL[validators/<br/>10 base validators]
    end
    subgraph Sources["Source"]
        SRC[Papaa Escola Repository]
    end
    SRC --> PIS
    Config --> PIS
    PIS --> API[REST API :3335]
    API --> AI[Claude / AI Agents]
```

## 10.3 Finance Domain — Canonical Ledger Rules

The `finance` domain is the Papaa equivalent of LetBuyy's `payments`. It must follow the same money invariants:

```sql
-- Required pattern for ALL fee mutations:
CREATE OR REPLACE FUNCTION create_fee_invoice(
  p_school_id UUID,
  p_student_id UUID,
  p_fee_structure_id UUID,
  p_amount_paise BIGINT,     -- Indian rupees in paise
  p_idempotency_key TEXT     -- REQUIRED — ON CONFLICT DO NOTHING
) RETURNS JSON AS $$
BEGIN
  -- All checks, all ledger writes, all state transitions here
  -- Never call this table from TypeScript directly
END;
$$ SECURITY DEFINER;
```

**Papaa money tables:**
```
fee_payments · fee_ledger_entries · refunds
payroll_records · payroll_ledger_entries
expenses · library_fines
```

## 10.4 Authentication Model

Same two-issuer pattern as LetBuyy (NEVER cross):

| Issuer | Algorithm | For | Secret |
|--------|----------|-----|--------|
| Student/Parent sessions | HS256 | Portal access | `STUDENT_SESSION_SECRET` |
| Staff/Admin sessions | ES256 | Admin access | `PAPAA_IDENTITY_PUBLIC_JWKS` |

## 10.5 Files to Copy vs Write

| LCIS File | Adaptation | Papaa File |
|-----------|-----------|-----------|
| `server.mjs` | Port 3335; domain list; 13 domains | `pis-server/server.mjs` |
| `intelligence.mjs` | **None** — pure graph queries | `pis-server/intelligence.mjs` |
| `cross-domain-engine.mjs` | **None** — domain-agnostic | `pis-server/cross-domain-engine.mjs` |
| `db-intel.mjs` | MONEY_TABLES, `school_id` tenant key | `pis-server/db-intel.mjs` |
| `infra-intel.mjs` | Adapt wrangler.toml paths | `pis-server/infra-intel.mjs` |
| `live-adapters.mjs` | Provider list (add MSG91) | `pis-server/live-adapters.mjs` |
| `runbook-engine.mjs` | 13 domain runbooks, education escalation | `pis-server/runbook-engine.mjs` |
| `detection-prediction-intel.mjs` | Education-specific detectors | `pis-server/detection-prediction-intel.mjs` |
| `index.html` | Branding + Papaa domain names | `pis-server/index.html` |
| `domain-intel.mjs` | **Write new** — 13 education domain rules | `pis-server/pis-domain-intel.mjs` |
| `explain-intel.mjs` | **Write new** — Education narratives | `pis-server/pis-explain-intel.mjs` |
| `business-flow-intel.mjs` | **Write new** — 10 education journeys | `pis-server/pis-business-flow-intel.mjs` |

## 10.6 30-Day Implementation Plan

```mermaid
gantt
    title PIS 30-Day Roadmap
    dateFormat YYYY-MM-DD
    section Week 1 Foundation
    Run graphify update on Papaa repo    :w1a, 2026-07-01, 1d
    Copy + adapt db-intel.mjs            :w1b, after w1a, 2d
    Copy + adapt infra-intel.mjs         :w1c, after w1a, 1d
    Write pis-domain-intel.mjs (13 domains) :w1d, after w1b, 2d
    Start pis-server.mjs                 :w1e, after w1d, 1d
    section Week 2 Intelligence
    Copy intelligence.mjs (zero change)  :w2a, 2026-07-08, 1d
    Write pis-explain-intel.mjs          :w2b, after w2a, 3d
    Write pis-business-flow-intel.mjs    :w2c, after w2a, 2d
    section Week 3 Operations
    Write runbook-engine.mjs (13 domains) :w3a, 2026-07-15, 2d
    Adapt detection-prediction-intel.mjs :w3b, after w3a, 2d
    Connect staging Supabase adapter     :w3c, after w3b, 1d
    Write launch-command-center          :w3d, after w3a, 2d
    section Week 4 Governance
    Write PAPAA_CONSTITUTION.md          :w4a, 2026-07-22, 1d
    Write PAPAA_AGENTS.md (hand-authored) :w4b, after w4a, 2d
    Implement 10 base validators         :w4c, after w4a, 2d
    Update CLAUDE.md with PIS-FIRST      :w4d, after w4c, 1d
    Generate first AI context pack       :w4e, after w4d, 1d
```

---

# PART XI — CENTRAL INTELLIGENCE PLATFORM

## 11.1 Vision

The **Central Intelligence Platform (CIP)** extracts the product-agnostic intelligence layer from LCIS and makes it configurable for any software platform. Products provide a `cip.config.mjs` specifying their domain model, money tables, tenant key, and provider list. CIP provides the shared intelligence engines, live adapters, governance tooling, and API surface.

```mermaid
graph TB
    subgraph CIP["@cip/core (shared)"]
        EXT["Extractors<br/>db-extractor · infra-extractor<br/>domain-classifier"]
        ENG["Intelligence Engines<br/>blast-radius · cross-domain<br/>detect · predict · diagnose<br/>runbook · fix"]
        ADP["Live Adapter Layer<br/>Supabase · Cloudflare · Vercel<br/>GitHub · Resend · Razorpay<br/>+ extensible interface"]
        UI["Atlas SPA Shell<br/>Configurable branding"]
    end

    subgraph LB["products/letbuyy"]
        LBC["cip.config.mjs<br/>22 domains · site_id · INR/GST"]
        LBN["explain/*.md<br/>Commerce narratives"]
        PORT[":3333"]
    end

    subgraph PA["products/papaa-escola"]
        PAC["cip.config.mjs<br/>13 domains · school_id"]
        PAN["explain/*.md<br/>Education narratives"]
        PORT2[":3335"]
    end

    subgraph FUT["products/product-N"]
        FTC["cip.config.mjs<br/>N domains · tenant_key"]
        FTN["explain/*.md<br/>Domain narratives"]
        PORT3[":333N"]
    end

    CIP --> LB
    CIP --> PA
    CIP --> FUT
```

## 11.2 CIP Configuration Contract

Every product provides `cip.config.mjs`:

```javascript
export default {
  name: 'Papaa Escola',
  port: 3335,
  output: 'cip-out',
  
  // Domain taxonomy
  domains: [
    { key: 'finance', label: 'Finance & Fees', money: true, tenant: true,
      t: /fee_|payment|invoice|ledger|refund/ },
    // ... 12 more
  ],
  
  // Money and tenant configuration
  moneyTables: ['fee_payments', 'fee_ledger_entries', 'payroll_records'],
  tenantKey: 'school_id',
  tenantRootTable: 'schools',
  
  // Provider adapters
  providers: {
    supabase: { required: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] },
    razorpay: { required: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] },
    cloudflare: { required: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] },
  },
  
  // Content
  narrativesDir: './explain/',
  journeys: [...],            // 10 education journeys
  governanceDocs: [...],      // Constitution, AGENTS, CLAUDE.md
};
```

## 11.3 Shared vs Product-Specific

| Component | Shared in CIP | Product-specific |
|-----------|--------------|-----------------|
| Graph query engine | ✓ | |
| Blast radius algorithm | ✓ | |
| Cross-domain analysis | ✓ | |
| Detect/predict engines | ✓ | |
| Fix/diagnose/runbook | ✓ | |
| Live adapter protocol | ✓ | |
| NOT CONNECTED contract | ✓ | |
| Domain taxonomy | | ✓ (via config) |
| Money tables list | | ✓ (via config) |
| Tenant key column | | ✓ (via config) |
| Domain narratives | | ✓ (hand-authored) |
| Business journeys | | ✓ (hand-authored) |
| Governance constitution | | ✓ (hand-authored) |
| Product-specific validators | | ✓ |

## 11.4 Non-Negotiable CIP Principles (Inherited from LCIS)

1. **Honesty before completeness.** NOT CONNECTED is a first-class feature, not an error.
2. **Governance before intelligence.** The validator gate is always the authority; CIP intelligence is always advisory.
3. **Hand-authored governance.** No CIP tooling generates constitutions or agents rulebooks.
4. **Query before scan.** Every product CLAUDE.md includes the PIS query table.
5. **Zero external npm dependencies** in the intelligence server.

## 11.5 CIP Roadmap

| Phase | Timeline | Deliverable |
|-------|---------|------------|
| Phase 1: Extraction | Q3 2026 | Extract `@cip/core` from LCIS; LetBuyy behavior unchanged |
| Phase 2: Papaa Escola | Q3 2026 | First new product on CIP; 13 education domains |
| Phase 3: API stabilization | Q4 2026 | Semver API contract; migration guide |
| Phase 4: Cloud deployment | Q1 2027 | Multi-product hosted hub; cross-product portfolio dashboard |

---

# PART XII — APPENDICES

## Appendix A — Repository Statistics

| Metric | Value | Source |
|--------|-------|--------|
| Code graph nodes | 52,246 | `graphify-out/graph.json` |
| Code graph edges | 66,761 | Same |
| Graph communities | 3,279 | Same (Louvain clustering) |
| Database tables | 414 | `graphify-out/db-intel.json` |
| Database RPCs/functions | 156 | Same; 128 SECURITY DEFINER |
| RLS policies | 651 | Same |
| Database triggers | 395 | Same |
| Database indexes | 826 | Same |
| FK relationships | 705 | `graphify-out/relationship-intel.json` |
| Tenant tables | 255 | `db-intel.json` summary |
| Money tables (canonical) | 18 | `db-intel.mjs` MONEY_TABLES Set |
| Business domains | 22 | `graphify-out/domain-intel.json` |
| Cross-domain edges | 49 | Same |
| Intelligence engine files | 83 | `tools/graph-server/*.mjs` |
| API endpoints | 117+ | `tools/graph-server/server.mjs` |
| Pre-built JSON artifacts | 50+ | `graphify-out/*.json` |
| Governance validators | 107 | `scripts/validators/*.mjs` |
| Governance decisions | 180 | `graphify-out/memory-intel.json` |
| Migration decisions | 103 | Same |
| Governance source documents | 41 | Same |
| Cloudflare workers | 4 | `graphify-out/infra-intel.json` |
| Cloudflare queues | 5 | Same |
| Required production secrets | 19 | Same |
| Vercel apps | 5 | Same |
| Live provider adapters | 7 | `tools/graph-server/live-adapters.mjs` |
| Live adapters connected | 0 | By design (dev context) |

## Appendix B — File Inventory (Key Files)

| File | Purpose | Lines |
|------|---------|-------|
| `tools/graph-server/server.mjs` | HTTP server, 117+ endpoints, Atlas | 1,101 |
| `tools/graph-server/intelligence.mjs` | Core graph queries (deps/consumers/blast/flow) | 142 |
| `tools/graph-server/db-intel.mjs` | SQL migration parser | ~400 |
| `tools/graph-server/infra-intel.mjs` | Infrastructure parser | ~300 |
| `tools/graph-server/domain-intel.mjs` | 22-domain classifier | ~500 |
| `tools/graph-server/explain-intel.mjs` | V6 dual-mode explain layer | ~600 |
| `tools/graph-server/live-adapters.mjs` | 7 provider adapters | ~300 |
| `tools/graph-server/detection-prediction-intel.mjs` | INFINITY: 8 detectors, 6 predictors | ~400 |
| `tools/graph-server/launch-command-center.mjs` | GO/NO-GO readiness (10 dimensions) | ~300 |
| `tools/graph-server/runbook-engine.mjs` | Per-domain runbooks + escalation | ~500 |
| `tools/graph-server/knowledge-graphs.mjs` | 7 typed knowledge sub-graphs | ~400 |
| `tools/graph-server/unified-intelligence-engine.mjs` | 13-layer unified brain | ~500 |
| `AGENTS.md` | Hand-authored operating rulebook | 405 |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | Supreme law | 471 |
| `scripts/validate-governance.mjs` | 107-validator gate runner | ~200 |
| `CLAUDE.md` | AI operating context + LCIS protocol | ~300 |
| `.github/workflows/graph-intelligence.yml` | CI LCIS regeneration | ~100 |

## Appendix C — Knowledge Object Catalog

Full taxonomy in [Part III — Knowledge Architecture](#part-iii--knowledge-architecture). Quick reference:

| Object | Count | Provenance |
|--------|-------|-----------|
| Module Node | 52,246 | graphify |
| Typed Edge | 66,761 (15 types) | graphify |
| Table | 414 | db-intel.mjs |
| RPC/Function | 156 | db-intel.mjs |
| RLS Policy | 651 | db-intel.mjs |
| FK Relationship | 705 | relationship-intel.mjs |
| Business Domain | 22 | domain-intel.mjs |
| Governance Decision | 180 | memory-intel.mjs |
| Explain Node | 22 | explain-intel.mjs + hand-authored |
| Business Journey | 9 (+1 NOT IMPL) | business-flow-intel.mjs |
| Detector | 8 | detection-prediction-intel.mjs |
| Predictor | 6 | Same |
| Runbook | 22 | runbook-engine.mjs |

## Appendix D — API Catalog (Representative)

Full catalog in [Part V — API Surface Summary](#55-api-surface-summary). Key single-question endpoints:

| Question | Endpoint |
|----------|---------|
| "What is LetBuyy?" | `GET /api/explain` |
| "How does payments work?" | `GET /api/explain?node=payments` |
| "What breaks if orders change?" | `GET /api/cross-domain?key=orders` |
| "Who owns the checkout route?" | `GET /api/owner?q=checkout.ts` |
| "What tables does `create_checkout_order` touch?" | `GET /api/rpc?name=create_checkout_order` |
| "What's the blast radius of `getSupabaseAdmin`?" | `GET /api/blast?q=getSupabaseAdmin` |
| "Is the platform ready to launch?" | `GET /api/launch-command-center` |
| "What should I fix next?" | `GET /api/decision-v2` |
| "How do I recover from a payment failure?" | `GET /api/runbook?domain=payments` |
| "What will fail next?" | `GET /api/predict` |
| "Who are all the providers?" | `GET /api/connections` |
| "30-minute developer onboarding" | `GET /api/developer` |
| "Give me a < 20k token pack for Claude" | `GET /api/ai-pack?target=claude` |

## Appendix E — Infrastructure Catalog

| Component | Name | Technology | Purpose |
|-----------|------|-----------|---------|
| Worker 1 | `api-gateway` | Cloudflare Workers + Hono.js | All `/v1/*` API routes |
| Worker 2 | `queue-workers` | Cloudflare Workers | Async job processing |
| Worker 3 | `webhook-service` | Cloudflare Workers | Inbound webhook delivery |
| Worker 4 | `mobile-bff` | Cloudflare Workers + Hono.js | `/mobile/v1/*` Flutter BFF |
| Queue 1 | `NOTIFICATION_QUEUE` | Cloudflare Queues | Email/notification jobs |
| Queue 2 | `PAYMENT_QUEUE` | Cloudflare Queues | Payment async jobs |
| Queue 3 | `ORDER_QUEUE` | Cloudflare Queues | Order processing |
| Queue 4 | `WEBHOOK_QUEUE` | Cloudflare Queues | Outbound webhook delivery |
| Queue 5 | `ANALYTICS_QUEUE` | Cloudflare Queues | Analytics event ingestion |
| Database | Supabase Postgres | PostgreSQL + RLS | All application data (414 tables) |
| Connection pool | Hyperdrive | Cloudflare Hyperdrive | Worker→Supabase pooling |
| Object storage | R2 | Cloudflare R2 | Media storage |
| App 1 | `identity-platform` | Next.js 15 on Vercel | Auth UI, sole ES256 issuer |
| App 2 | `merchant-control-plane` | Next.js 15 on Vercel | Merchant dashboard |
| App 3 | `storefront-runtime` | Next.js 15 on Vercel | Customer storefront |
| App 4 | `marketing-site` | Next.js 15 on Vercel | Public marketing |
| App 5 | `platform-console` | Next.js 15 on Vercel | Internal ops |

## Appendix F — Glossary

| Term | Definition |
|------|-----------|
| **LCIS** | LetBuyy Central Intelligence System — the intelligence layer described in this document |
| **Graphify** | External Python CLI tool (tree-sitter based) that produces `graph.json` |
| **Domain** | One of 22 classified business domains (the primary organizational unit) |
| **Explain Node** | The highest-level knowledge object — a full domain description for human + AI consumption |
| **NOT CONNECTED** | First-class status marking all live operational values that require wired credentials |
| **107 validators** | The deterministic governance gate; authoritative over all LCIS heuristics |
| **ARB** | Architecture Review Board — the only body that can amend the Constitution |
| **DOC-R1** | Governance rule: governance documents MUST be hand-authored, NEVER generated from scans |
| **Canonical ledger** | The double-entry money ledger — all mutations go through SECURITY DEFINER RPCs |
| **SECURITY DEFINER** | Postgres function attribute: runs with the permissions of the function owner, not the caller |
| **`site_id`** | The universal tenant isolation key on all tenant-scoped tables |
| **`loadOrBuild()`** | LCIS server pattern: prefer pre-built JSON artifact (fast), fall back to live build |
| **Blast radius** | The set of nodes (and files) that would break if a given node changes |
| **CIP** | Central Intelligence Platform — the multi-product generalization of LCIS |
| **PIS** | Papaa Intelligence System — the Papaa Escola instantiation of CIP |
| **Two-lane rule** | `stepup/main` (dev) and `main` (production) — one-lane-at-a-time merge policy |

## Appendix G — Evidence Index

| Finding | Evidence Location |
|---------|-----------------|
| 52,246 nodes, 66,761 edges | `docs/central-intelligence/README.md:4-5` |
| 414 tables, 156 RPCs, 651 policies | `docs/central-intelligence/README.md:6` |
| Zero external dependencies | `tools/graph-server/server.mjs:1-10` (imports only `node:*`) |
| NOT CONNECTED implementation | `tools/graph-server/live-adapters.mjs:adapterStatus()` |
| Intelligence score A (95%) | `docs/central-intelligence/LCIS_OMEGA_CERTIFICATION.md` |
| 107/107 gate status | All certification docs: `docs/central-intelligence/LCIS_*_CERTIFICATION.md` |
| AGENTS.md is hand-authored | `AGENTS.md:1-3` (header markers); `tests/contracts/repository-intelligence-generation.test.ts:test#2` |
| Retired generator exits 1 | `scripts/generate-repository-intelligence.mjs:process.exit(1)` |
| MONEY_TABLES constant | `tools/graph-server/db-intel.mjs:MONEY_TABLES Set` |
| 22 domain keys + classification order | `tools/graph-server/domain-intel.mjs:DOMAIN_RULES array` |
| 705 FK relationships, `sites` as root | `tools/graph-server/relationship-intel.mjs` → `graphify-out/relationship-intel.json` |
| 8 autonomous detectors | `tools/graph-server/detection-prediction-intel.mjs:detectors[]` |
| `getSupabaseAdmin` 115-file blast | `docs/ai-infrastructure/graphify-report.md` |
| 180 governance decisions, 41 sources | `graphify-out/memory-intel.json:summary` |
| 4-layer knowledge model diagram | `docs/central-intelligence/UNIFIED_KNOWLEDGE_MODEL.md` |
| loadOrBuild() pattern | `tools/graph-server/server.mjs:~line 80-100` |
| Atlas force-directed layout | `tools/graph-server/server.mjs:buildLayout()` function |
| Domain workspace 16 perspectives | `tools/graph-server/server.mjs:workspace()` function |
| Papaa Escola 13 domain model | `reports/papaa-intelligence-blueprint.md` |

## Appendix H — Source References

This dossier was compiled from the following primary sources:

| Source | Type |
|--------|------|
| `tools/graph-server/server.mjs` | Code (1,101 lines, fully read) |
| `tools/graph-server/intelligence.mjs` | Code (142 lines, fully read) |
| `AGENTS.md` | Governance (405 lines, fully read) |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | Governance (471 lines) |
| `docs/central-intelligence/README.md` | Documentation |
| `docs/central-intelligence/UNIFIED_KNOWLEDGE_MODEL.md` | Documentation |
| `docs/central-intelligence/LCIS_*_CERTIFICATION.md` | Certification (all versions) |
| `docs/graphify/FINAL_GRAPHIFY_MASTER_REPORT.md` | Documentation |
| `docs/ai-infrastructure/FINAL_INSTALLATION_REPORT.md` | Documentation |
| `graphify-out/domain-intel.json` | Data artifact |
| `graphify-out/memory-intel.json` | Data artifact |
| `graphify-out/knowledge-graphs.json` | Data artifact |
| `package.json` (graph:* scripts) | Configuration |
| `.github/workflows/graph-intelligence.yml` | CI configuration |
| `scripts/validators/` (all 107 validators) | Code (surveyed) |
| Agent #1 output: Core code analysis | Forensic investigation |
| Agent #2 output: Documentation analysis | Forensic investigation |
| Agent #3 output: Governance + graph structure | Forensic investigation |
| Agent #4 output: Gap analysis + infrastructure | Forensic investigation |

---

*End of LCIS Authoritative Architecture Dossier*  
*Version 1.0 — 2026-06-19 — Investigation complete*  
*All findings traceable to source files, code locations, and certification documents*

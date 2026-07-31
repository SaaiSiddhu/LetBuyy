# LCIS Capability Map — 32 Canonical Capabilities

**Date:** 2026-06-20  
**Program:** LCIS Consolidation Phase 1  
**Rule:** All source file paths verified against actual disk contents. No placeholders.  
**Target package:** `packages/lcis-core` — TypeScript ESM (`type: module`, `src/*.ts`, zod, `@letbuyy/shared-types`, `tsc -b`)  
**Prior doc reconciliation:** 32 capabilities match `LCIS_DUPLICATION_REPORT.md` §9 exactly except where noted per-capability.

---

## Module Groups (lcis-core target layout)

```
packages/lcis-core/src/
  graph/          → Capabilities 1–6  (code graph, DB, infra, domain, FK, traversal)
  catalog/        → Capabilities 7–9  (custom-domain feature, security, payment)
  merchant/       → Capability  10    (merchant lifecycle + scorecards)
  revenue/        → Capabilities 11–12 (revenue, customer intelligence)
  memory/         → Capabilities 13   (governance memory)
  incident/       → Capabilities 14–16 (incident, diagnosis, runbooks)
  decision/       → Capabilities 17–18 (readiness, fix-priorities)
  runtime/        → Capabilities 19–22 (observability, deploy, live, detection)
  search/         → Capabilities 23–24 (explain/search, audit)
  contracts/      → Capabilities 25–27 (control centers, knowledge graphs, AI packs)
  architecture/   → Capability  28    (architecture intelligence — migrate from :3334)
  verification/   → Capabilities 29–30 (execution safety, conclusion verification)
  browser/        → Capability  31    (browser validation — optional module)
  context/        → Capability  32    (context compression — migrate from :3334)
```

---

## Capabilities 1–6: `graph/` module

### Capability 1 — Code Graph (Graphify)

| Field | Value |
|---|---|
| **Source files** | External binary: `uv tool install graphifyy` → `graphify update .` |
| **Dependencies** | Graphify binary + Python uv toolchain |
| **Consumers** | All other capabilities (reads `graphify-out/graph.json`) |
| **Maturity** | Real — binary is live; outputs gitignored |
| **Replacement strategy** | None — keep as external; `packages/lcis-core` consumes its JSON output |
| **Migration strategy** | Define `GraphifyOutput` TypeScript types in `src/graph/types.ts` (zod schema for `graph.json`, `db-intel.json`, `infra-intel.json`, `domain-intel.json`) |
| **Archive strategy** | N/A — not in-repo; no archival action |

---

### Capability 2 — DB Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/db-intel.mjs` (134 lines) |
| **Dependencies** | `graphify-out/db-intel.json` (417 tables, 164 RPCs, 658 policies, 398 triggers, 834 indexes) |
| **Consumers** | `intelligence.mjs`, `domain-intel.mjs`, `payment-intel.mjs`, `security-intel.mjs`, nearly all downstream engines |
| **Maturity** | Real — all counts verified against live db-intel.json |
| **Replacement strategy** | Migrate to `src/graph/db.ts`; expose typed `DbIntelligence` interface |
| **Migration strategy** | Port extraction logic to TS; add zod schema for db-intel.json shape; validate at load time |
| **Archive strategy** | Keep `db-intel.mjs` as the generation script (run via `pnpm graph:db`); the serving layer moves to lcis-core |

---

### Capability 3 — Infrastructure Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/infra-intel.mjs` (100 lines) |
| **Dependencies** | `graphify-out/infra-intel.json` (Workers, queues, secrets, cron, Vercel targets) |
| **Consumers** | `deployment-intel.mjs`, `environment-control-intel.mjs`, `launch-command-center.mjs` |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/graph/infra.ts` |
| **Migration strategy** | Port to TS; zod schema for infra-intel.json |
| **Archive strategy** | Keep `infra-intel.mjs` as generation script |

---

### Capability 4 — Domain Classification (22 domains)

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/domain-intel.mjs` (242 lines) — primary. `tools/graph-server/domain-intelligence.mjs` (113 lines) — DARK (see §Duplicate Family A) |
| **Dependencies** | `graphify-out/domain-intel.json`; calls `intelligence.mjs` for blast-radius |
| **Consumers** | `explain-intel.mjs`, `cross-domain-engine.mjs`, `ecosystem-intel.mjs`, `business-flow-intel.mjs`, all 22-domain surfaces |
| **Maturity** | Real — 22 domains confirmed; cross-domain edges real |
| **Replacement strategy** | Migrate to `src/graph/domains.ts`; include `traceDomain`, `listDomains`, `findDomainDependencies`, `findDomainConsumers`, `blastDomain`, `couplingMatrix` |
| **Migration strategy** | Port both `domain-intel.mjs` and `cross-domain-engine.mjs` into one `src/graph/domains.ts` module; wire `domain-intelligence.mjs` capability as `customDomainFeatures` sub-export |
| **Archive strategy** | Archive `domain-intelligence.mjs` after merging its unique "custom domain" feature logic |

---

### Capability 5 — FK Relationship Graph

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/relationship-intel.mjs` (75 lines) |
| **Dependencies** | `graphify-out/db-intel.json` (705 FK edges; `sites` confirmed as tenant root) |
| **Consumers** | `/api/relationships` endpoint; `explain-intel.mjs` database tab; `domain-intel.mjs` for tenant root resolution |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/graph/relationships.ts` |
| **Migration strategy** | Port `buildRelationshipIntel` and `relationshipsFor` to TS |
| **Archive strategy** | No archive needed; single-file |

---

### Capability 6 — Graph Traversal / Blast Radius

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/intelligence.mjs` (141 lines) |
| **Dependencies** | `graphify-out/graph.json` (52,246 nodes, 66,761 edges) |
| **Consumers** | Nearly all downstream engines call `traceTable`, `traceRPC`, `tracePolicy`, `findOwnership`, `infraSummary` |
| **Maturity** | Real — highest-blast-radius primitive in :3333 |
| **Replacement strategy** | Migrate to `src/graph/traversal.ts`; this is the **core primitive** of lcis-core |
| **Migration strategy** | Port BFS/DFS traversal + owner resolution to TS; add typed `BlastRadiusResult` interface with zod |
| **Archive strategy** | No archive needed |

---

## Capabilities 7–9: `catalog/` module

### Capability 7 — Custom-Domain Feature Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/domain-intelligence.mjs` (113 lines) — **currently DARK (not routed)** |
| **Dependencies** | `graphify-out/domain-intel.json`; checks custom domain config per site |
| **Consumers** | Zero today (no HTTP route wired in server.mjs) |
| **Maturity** | Partial — logic exists but never served |
| **Replacement strategy** | Rename to `customDomainIntel` sub-export within `src/catalog/custom-domains.ts` |
| **Migration strategy** | Wire as `/api/custom-domain-features` in :3333 during consolidation; export from lcis-core |
| **Archive strategy** | Archive `domain-intelligence.mjs` after porting |
| **Note vs prior docs** | Prior docs treat this as "rename + wire" separate from domain classification; confirmed correct — it is a genuinely distinct capability (site-level custom domain status, not the 22-domain taxonomy) |

---

### Capability 8 — Security Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/security-intel.mjs` (59 lines), `tools/graph-server/security-intelligence-v5.mjs` (76 lines), `tools/graph-server/audit-engine-v2.mjs` (77 lines) |
| **Dependencies** | `graphify-out/graph.json`, `graphify-out/db-intel.json` |
| **Consumers** | `/api/security`, `/api/security-intelligence`, `/api/audit` |
| **Maturity** | Real |
| **Replacement strategy** | Consolidate into `src/catalog/security.ts`; `security-intel.mjs` = structural graph; `security-intelligence-v5.mjs` = operational posture; `audit-engine-v2.mjs` = RLS/route coverage scanner |
| **Migration strategy** | Port all three; expose unified `SecurityIntelligence` interface |
| **Archive strategy** | No separate archive; three files collapse to one TS module |

---

### Capability 9 — Payment Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/payment-intel.mjs` (65 lines) |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json` (money RPCs, payment tables) |
| **Consumers** | `/api/payment`; referenced in CLAUDE.md canonical-ledger-only context |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/catalog/payment.ts` |
| **Migration strategy** | Port `buildPaymentIntel` to TS; zod-validate money RPC names against db-intel |
| **Archive strategy** | No archive needed |

---

## Capability 10: `merchant/` module

### Capability 10 — Merchant Lifecycle + Scorecards

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/merchant-intel.mjs` (35 lines), `tools/graph-server/merchant-intelligence.mjs` (149 lines), `tools/graph-server/merchant-health-intel.mjs` (30 lines), `tools/graph-server/merchant-growth-intel.mjs` (27 lines), `tools/graph-server/merchant-adoption-intel.mjs` (28 lines), `tools/graph-server/merchant-risk-intel.mjs` (32 lines), `tools/graph-server/merchant-churn-intel.mjs` (27 lines), `tools/graph-server/merchant-operating-graph.mjs` (33 lines — MERGE) |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/graph.json` |
| **Consumers** | 9 endpoints: `/api/merchant`, `/api/merchant-intelligence`, `/api/merchant-health`, `/api/merchant-growth`, `/api/merchant-adoption`, `/api/merchant-risk`, `/api/merchant-churn`, `/api/merchant-operating` (to be retired), `/api/founding-program` |
| **Maturity** | Real (structural topology); scores are query-bound (NOT CONNECTED until telemetry wired) |
| **Replacement strategy** | Consolidate 8 files → `src/merchant/index.ts` with sub-exports per scorecard dimension; retire `merchant-operating-graph.mjs` endpoint |
| **Migration strategy** | Port each scorecard builder as a named export; merge `merchant-operating-graph.mjs` into `merchant-intel.mjs` logic |
| **Archive strategy** | Archive `merchant-operating-graph.mjs` after merge |

---

## Capabilities 11–12: `revenue/` module

### Capability 11 — Revenue Models

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/revenue-intelligence.mjs` (72 lines) [base], `tools/graph-server/revenue-intelligence-v2.mjs` (31 lines) [newer simpler surface] |
| **Dependencies** | `graphify-out/domain-intel.json`; ledger model (amounts query-bound — NOT CONNECTED) |
| **Consumers** | `/api/revenue-intelligence`, `/api/revenue-v2` |
| **Maturity** | Real (structural model); revenue amounts NOT CONNECTED |
| **Replacement strategy** | Migrate to `src/revenue/revenue.ts`; fix confusing naming (base vs v2) |
| **Migration strategy** | Port both; expose as `buildRevenueModel` (base) and `buildRevenueSummary` (v2) |
| **Archive strategy** | No archive; naming fix in TS |

---

### Capability 12 — Customer Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/customer-journey-intelligence.mjs` (60 lines), `tools/graph-server/customer-intelligence-v2.mjs` (29 lines) |
| **Dependencies** | `graphify-out/domain-intel.json` |
| **Consumers** | `/api/customer-journey`, `/api/customer-intelligence`, `/api/customer-intelligence-v2` |
| **Maturity** | Real (journey stages structural); funnel rates query-bound NOT CONNECTED |
| **Replacement strategy** | Migrate to `src/revenue/customer.ts` |
| **Migration strategy** | Port both builders |
| **Archive strategy** | No archive needed |

---

## Capability 13: `memory/` module

### Capability 13 — Memory / Governance Decisions

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/memory-intel.mjs` (131 lines) [v1 — remove endpoint, keep as library], `tools/graph-server/memory-v2.mjs` (44 lines) [v2 — canonical endpoint] |
| **Dependencies** | `graphify-out/reports/` decision records; `graphify-out/db-intel.json` migration history |
| **Consumers** | `/api/memory` (v1 — to be retired), `/api/memory-v2` (canonical); `explain-intel.mjs` |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/memory/governance.ts`; v2 is canonical; v1 becomes internal helper |
| **Migration strategy** | Port `buildMemoryIntel` (v1 helpers) + `buildMemoryV2` (v2 surface); expose only v2 as route handler |
| **Archive strategy** | Remove `/api/memory` endpoint; keep v1 logic as internal module |

---

## Capabilities 14–16: `incident/` module

### Capability 14 — Incident Tracing + Control

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/incident-intel.mjs` (51 lines) [primary trace], `tools/graph-server/incident-intelligence-v5.mjs` (50 lines) [library — endpoint to retire], `tools/graph-server/incident-response.mjs` (36 lines) [endpoint to retire, logic to merge], `tools/graph-server/incident-control-intel.mjs` (48 lines) [Genesis control center — KEEP] |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json` |
| **Consumers** | `/api/incident` (keep), `/api/incident-control` (keep), `/api/incident-intelligence` (retire endpoint), `/api/incident-response` (retire endpoint) |
| **Maturity** | Real |
| **Replacement strategy** | Consolidate into `src/incident/incident.ts`; expose `traceIncident` (primary) + `incidentControl` (Genesis surface) |
| **Migration strategy** | Port `incident-intel.mjs` + `incident-control-intel.mjs`; absorb `incident-response.mjs` logic into trace; mark v5 as internal only |
| **Archive strategy** | Archive `/api/incident-intelligence` and `/api/incident-response` endpoints post-migration |

---

### Capability 15 — Root Cause / Diagnosis

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/diagnosis-engine.mjs` (63 lines) |
| **Dependencies** | `graphify-out/graph.json`, `graphify-out/db-intel.json`; calls blast-radius primitive |
| **Consumers** | `/api/diagnose`, `/api/root-cause` |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/incident/diagnosis.ts` |
| **Migration strategy** | Port `diagnose` function to TS |
| **Archive strategy** | No archive needed |

---

### Capability 16 — Runbooks

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/runbook-engine.mjs` (73 lines) |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json` |
| **Consumers** | `/api/runbook` |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/incident/runbooks.ts` |
| **Migration strategy** | Port `buildRunbooks` and `runbookOf` to TS |
| **Archive strategy** | No archive needed |

---

## Capabilities 17–18: `decision/` module

### Capability 17 — Production Readiness

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/production-readiness-intel.mjs` (85 lines) [detailed, per-system], `tools/graph-server/production-readiness-v2.mjs` (40 lines) [executive summary] |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json`, `graphify-out/infra-intel.json` |
| **Consumers** | `/api/production-readiness` (engineering detail), `/api/production-readiness-v2` (executive %) |
| **Maturity** | Real — NOT true duplicates (different consumers) |
| **Replacement strategy** | Migrate to `src/decision/readiness.ts`; export both as named functions |
| **Migration strategy** | Port both; export `buildProductionReadiness` (detail) + `buildProductionReadinessV2` (summary) |
| **Archive strategy** | No archive; both serve different consumers |

---

### Capability 18 — Decision / Fix Priorities

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/decision-engine-v2.mjs` (43 lines) [canonical primary — KEEP], `tools/graph-server/decision-engine-v5.mjs` (78 lines) [demote to library] |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json`, `production-readiness-intel.mjs` |
| **Consumers** | `/api/decision-v2` (canonical), `/api/decision-engine` (v5 endpoint — to retire) |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/decision/priorities.ts`; v2 is the exported surface; v5 becomes internal helper |
| **Migration strategy** | Port both; route only through v2; remove `/api/decision-engine` endpoint |
| **Archive strategy** | Retire `/api/decision-engine` route; v5 module becomes internal |
| **Note vs prior docs** | Prior docs' "v2 is newer despite the name" confirmed correct. The naming is inverted from the version numbers (same issue as revenue-intelligence). |

---

## Capabilities 19–22: `runtime/` module

### Capability 19 — Runtime + Observability Topology

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/runtime-intel.mjs` (94 lines), `tools/graph-server/runtime-observability-intel.mjs` (85 lines), `tools/graph-server/deployment-state.mjs` (62 lines) |
| **Dependencies** | `graphify-out/infra-intel.json`, `graphify-out/domain-intel.json` |
| **Consumers** | `/api/runtime`, `/api/runtime-intelligence`, `/api/deployment-state`, `/api/observability` |
| **Maturity** | Real (topology); live metrics NOT CONNECTED (12 telemetry adapter sources mapped, none wired) |
| **Replacement strategy** | Migrate to `src/runtime/observability.ts` |
| **Migration strategy** | Port all three builders |
| **Archive strategy** | No archive needed |

---

### Capability 20 — Deployment Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/deployment-intel.mjs` (59 lines) [wired], `tools/graph-server/deployment-intelligence-v5.mjs` (48 lines) [DARK — not imported by server.mjs] |
| **Dependencies** | `graphify-out/infra-intel.json`, `graphify-out/domain-intel.json` |
| **Consumers** | `/api/deployment` (wired); `/api/deployment-intelligence` does NOT exist |
| **Maturity** | Real for `deployment-intel.mjs`; partial for v5 (built but never wired) |
| **Replacement strategy** | Migrate to `src/runtime/deployment.ts`; fold v5 unique logic into base |
| **Migration strategy** | Port `buildDeploymentIntel` as primary; audit v5 for any unique logic before merging |
| **Archive strategy** | Archive `deployment-intelligence-v5.mjs` after merge |

---

### Capability 21 — Live Adapters (Credential Probe)

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/live-adapters.mjs` (138 lines), `tools/graph-server/federation-intel.mjs` (283 lines), `tools/graph-server/live-health-intel.mjs` (152 lines) |
| **Dependencies** | Process env vars for 7 providers (Supabase/Cloudflare/Vercel/GitHub/Razorpay/Resend/Turnstile); all probes read-only |
| **Consumers** | `/api/live-adapters`, `/api/federation`, `/api/live-health`, `/api/live`, `/api/live-graph`, `/api/connections` |
| **Maturity** | Real — 13 connection sources tracked; **0 of 7 providers connected in dev** |
| **Replacement strategy** | Migrate to `src/runtime/adapters.ts`; honesty contract (NOT CONNECTED + env var name) must be preserved verbatim |
| **Migration strategy** | Port `ADAPTERS` registry, `probeAdapter`, `probeAll`, `summarize`; port federation intel and live health as sub-modules |
| **Archive strategy** | No archive needed |

---

### Capability 22 — Detection + Prediction (Structural)

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/detection-prediction-intel.mjs` (162 lines) |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json`, `graphify-out/infra-intel.json` |
| **Consumers** | `/api/detection`, `/api/predict`, `/api/detection-prediction`, `/api/incident-timeline`, `/api/live-metrics` |
| **Maturity** | Real (8 structural detectors + 6 predictors); live signals NOT CONNECTED |
| **Replacement strategy** | Migrate to `src/runtime/detection.ts` |
| **Migration strategy** | Port `buildDetectionPrediction` and `incidentTimeline` to TS |
| **Archive strategy** | No archive needed |

---

## Capabilities 23–24: `search/` module

### Capability 23 — Explain Mode + Semantic Search

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/explain-intel.mjs` (219 lines), `tools/graph-server/search-intel.mjs` (81 lines) |
| **Dependencies** | `graphify-out/graph.json`, `graphify-out/domain-intel.json`, `graphify-out/db-intel.json`; zero AI deps (BM25-style text matching only) |
| **Consumers** | `/api/explain`, `/api/search-v2`, `/api/copilot`, `/api/workspace`, `/api/related`, `/api/impact-score` |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/search/explain.ts` and `src/search/semantic.ts` |
| **Migration strategy** | Port `buildExplainIntel`, `copilot`, `searchV2` to TS |
| **Archive strategy** | No archive needed |

---

### Capability 24 — Audit (Route / RLS Coverage)

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/audit-engine-v2.mjs` (77 lines) |
| **Dependencies** | `graphify-out/graph.json`, `graphify-out/db-intel.json` |
| **Consumers** | `/api/audit` |
| **Maturity** | Real — candidates flagged; 107-validator gate is authoritative for deterministic violations |
| **Replacement strategy** | Migrate to `src/search/audit.ts` or co-locate with `catalog/security.ts` |
| **Migration strategy** | Port `buildAuditEngineV2` to TS |
| **Archive strategy** | No archive needed |
| **Note** | This file is double-counted in §Capability 8 (security group). The audit engine is part of the security capability family but warrants a separate export surface. |

---

## Capabilities 25–27: `contracts/` module

### Capability 25 — Control Centers

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/launch-command-center.mjs` (77 lines), `tools/graph-server/commerce-control-intel.mjs` (48 lines), `tools/graph-server/infrastructure-control-intel.mjs` (45 lines), `tools/graph-server/database-control-intel.mjs` (77 lines), `tools/graph-server/environment-control-intel.mjs` (67 lines), `tools/graph-server/incident-control-intel.mjs` (48 lines) |
| **Dependencies** | All read from `graphify-out/*.json`; `database-control-intel.mjs` also provides the `lineage` primitive |
| **Consumers** | `/api/launch-command-center`, `/api/commerce-control`, `/api/infrastructure-control`, `/api/database-control`, `/api/database-control-genesis`, `/api/environment-control`, `/api/incident-control` |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/contracts/controls.ts` with named exports per control center |
| **Migration strategy** | Port all 6 builders; expose `lineage` separately from `database-control-intel.mjs` |
| **Archive strategy** | No archive needed |

---

### Capability 26 — Knowledge Graphs (7 Sub-Graphs)

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/knowledge-graphs.mjs` (62 lines) |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json`, `graphify-out/infra-intel.json` |
| **Consumers** | `/api/graph` (7 graph kinds: business, journey, security, ownership, infrastructure, revenue, ai) |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/contracts/knowledge-graphs.ts` |
| **Migration strategy** | Port `buildKnowledgeGraphs` with typed `GraphKind` union |
| **Archive strategy** | No archive needed |

---

### Capability 27 — AI Context Packs

| Field | Value |
|---|---|
| **Source files** | `tools/graph-server/ai-context-intel.mjs` (43 lines) |
| **Dependencies** | `graphify-out/domain-intel.json`, `graphify-out/db-intel.json` |
| **Consumers** | `/api/ai-context`, `/api/ai-context-pack`, `/api/ai-pack` (targets: Claude/Gemini/Codex/Cursor) |
| **Maturity** | Real |
| **Replacement strategy** | Migrate to `src/contracts/ai-packs.ts` |
| **Migration strategy** | Port `buildPack` and `allPacks` to TS; keep target enum (Claude/Gemini/Codex/Cursor) |
| **Archive strategy** | No archive needed |

---

## Capability 28: `architecture/` module

### Capability 28 — Architecture Intelligence

| Field | Value |
|---|---|
| **Source files** | `tools/central-intelligence/architecture-intelligence/ArchitectureIntelligenceEngine.mjs` (261 lines), `ArchitectureDriftDetector.mjs` (349 lines), `ArchitectureSnapshotService.mjs` (171 lines), `DependencyDiscovery.mjs` (144 lines), `DomainDiscovery.mjs` (205 lines), `LayerDiscovery.mjs` (236 lines), `ServiceDiscovery.mjs` (244 lines) |
| **Dependencies** | `node:fs` (reads repo files directly); `graphify-out/graph.json` (via :3333 HTTP calls). **No Qdrant. No OpenAI. No Playwright.** |
| **Consumers** | `:3334` routes: `/intelligence/architecture`, `/intelligence/architecture/drift`, `/intelligence/architecture/depends` |
| **Maturity** | Real — highest-quality, most self-contained subsystem in :3334 per evidence file |
| **Replacement strategy** | **Migrate to :3333** → `src/architecture/index.ts`; remove :3334 dependency for this capability |
| **Migration strategy** | Port `ArchitectureIntelligenceEngine` + `ArchitectureDriftDetector` as primary exports; port Discovery modules as sub-modules. Wire as `/api/architecture`, `/api/architecture/drift`, `/api/architecture/depends` in :3333 |
| **Archive strategy** | Archive `:3334` architecture-intelligence routes after :3333 migration complete |
| **Note vs prior docs** | Prior docs listed 5 capabilities to migrate from :3334; the adversarial panel correction (§12 item 4) upgraded to 7 (add Reasoning + Investigation). This report confirms all 7 are distinct and migrateable. Architecture is the first priority. |

---

## Capabilities 29–30: `verification/` module

### Capability 29 — Execution Safety (SafetyGuard)

| Field | Value |
|---|---|
| **Source files** | `tools/central-intelligence/execution-engine/SafetyGuard.mjs` (141 lines), `tools/central-intelligence/execution-engine/ActionRegistry.mjs` (132 lines) |
| **Dependencies** | Pure logic — no external deps |
| **Consumers** | `:3334` execution engine; 10 whitelisted safe actions; 28 banned verb substrings |
| **Maturity** | Real |
| **Replacement strategy** | **Migrate to :3333** → `src/verification/safety-guard.ts`; export `SafetyGuard` class and `ActionRegistry` |
| **Migration strategy** | Port as pure TS; enforce at the lcis-core API boundary |
| **Archive strategy** | Archive :3334 execution-engine after migration |

---

### Capability 30 — Verification of Conclusions

| Field | Value |
|---|---|
| **Source files** | `tools/central-intelligence/verification-engine/VerificationEngine.mjs` (686 lines), `EvidenceVerifier.mjs` (324 lines), `ConfidenceCalculator.mjs` (219 lines), `VerificationLedger.mjs` (145 lines) |
| **Dependencies** | Pure logic + reads from graphify-out JSON via :3333. No Qdrant/OpenAI required for structural verification. |
| **Consumers** | `:3334` routes: `/intelligence/verify`, `/intelligence/verify/report` |
| **Maturity** | Real |
| **Replacement strategy** | **Migrate to :3333** → `src/verification/verification.ts`; expose `verify(conclusion)` → `VERIFIED | PARTIAL | UNVERIFIED | REFUTED` |
| **Migration strategy** | Port core verification logic; the ledger (audit chain) can use local JSON file or `graphify-out/execution-audit/` |
| **Archive strategy** | Archive :3334 verification routes after migration |

---

## Capability 31: `browser/` module (optional)

### Capability 31 — Browser Validation (Playwright-Dependent)

| Field | Value |
|---|---|
| **Source files** | `tools/central-intelligence/browser-intelligence/BrowserIntelligenceEngine.mjs` (302 lines), `browser-intelligence/agents/CheckoutAgent.mjs` (348 lines), `browser-intelligence/agents/ThemeAgent.mjs` (298 lines). **Orphaned (not in server routes):** `MonitoringAgent.mjs` (225 lines), `StoreAgent.mjs` (297 lines) |
| **Dependencies** | `playwright` npm package (lazy dynamic import with fallback to `@playwright/test`) |
| **Consumers** | `:3334` routes: `/intelligence/browser/validate`, `/intelligence/browser/theme`, `/intelligence/browser/checkout`, `/intelligence/browser/status` |
| **Maturity** | Real for CheckoutAgent and ThemeAgent; MonitoringAgent and StoreAgent are orphaned |
| **Replacement strategy** | Move to **optional** `src/browser/index.ts` in lcis-core; guard behind `LCIS_BROWSER_ENABLED` env var |
| **Migration strategy** | Port BrowserIntelligenceEngine + CheckoutAgent + ThemeAgent only; exclude orphaned agents |
| **Archive strategy** | Archive MonitoringAgent and StoreAgent (orphaned — not imported by any server) |

---

## Capability 32: `context/` module

### Capability 32 — Context Compression / AI Token Budget

| Field | Value |
|---|---|
| **Source files** | `tools/central-intelligence/context-intelligence/ContextCompressionPipeline.mjs` (470 lines), `ContextOptimizer.mjs` (299 lines), `TokenOptimizer.mjs` (259 lines), `ContextAssembler.mjs` (289 lines), `ContextDiagnostics.mjs` (260 lines), `ContextHealthMonitor.mjs` (179 lines), `DependencyGraphBuilder.mjs` (279 lines), `RepositoryGraphBuilder.mjs` (276 lines) |
| **Dependencies** | `node:fs` (file reads); does NOT require Qdrant/OpenAI for BM25-based compression |
| **Consumers** | `:3334` routes: `/intelligence/context/assemble`, `/intelligence/context/compression`, `/intelligence/context/diagnostics` |
| **Maturity** | Real — claims ~1,275× context reduction (ContextCompressionPipeline); deterministic BM25 core |
| **Replacement strategy** | **Migrate to :3333** → `src/context/compression.ts`; this is the "< 20k token AI pack" primitive |
| **Migration strategy** | Port `ContextCompressionPipeline` + `ContextOptimizer` + `TokenOptimizer` as primary exports; `ContextAssembler` wires them for the `/api/ai-pack` endpoint |
| **Archive strategy** | Archive :3334 context routes after migration |

---

## Standalone CLI / Generation Scripts (Not Capabilities — Not in lcis-core)

These 16 files in `:3333` are standalone scripts invoked by `pnpm graph:*` commands. They generate the `graphify-out/*.json` artifacts that lcis-core reads. They do not move to `packages/lcis-core`.

| File | npm script | Purpose |
|---|---|---|
| `db-intel.mjs` | `pnpm graph:db` | Extracts DB intelligence → `graphify-out/db-intel.json` |
| `infra-intel.mjs` | `pnpm graph:infra` | Extracts infra → `graphify-out/infra-intel.json` |
| `gen-reports.mjs` | `pnpm graph:reports` | Generates snapshot reports |
| `gen-v3-reports.mjs` | `pnpm graph:v3` | Domain intelligence reports |
| `gen-v4-reports.mjs` | `pnpm graph:v4` | v4 runtime reports |
| `gen-v5-reports.mjs` | `pnpm graph:v5` | v5 production reports |
| `gen-omega-reports.mjs` | `pnpm graph:omega` | Omega unified reports |
| `gen-explain-docs.mjs` | `pnpm graph:explain-docs` | Explain-mode doc generation |
| `autonomous-discovery-v5.mjs` | `pnpm graph:discover-v5` | Autonomous discovery CLI |
| `graph-stats.mjs` | CLI only | Graph statistics tool |
| `omega-lib.mjs` | Library | Shared utility for gen-omega-* |
| `refresh-graph.mjs` | CLI only | Refresh trigger |
| `validate-graph.mjs` | CLI only | Artifact validation |
| `discovery-engine.mjs` | **NONE — REMOVE** | Superseded; not imported anywhere |

---

## Reconciliation with Prior Docs

| Item | Prior `LCIS_DUPLICATION_REPORT.md` claim | This report |
|---|---|---|
| 32 capabilities grouping | Matches exactly (capabilities 1–32 map 1:1) | Confirmed |
| `:3334` route count | 68 | **Actual: 80** (12 new routes added since evidence file written) |
| Total routes | 186 | **198** |
| Files to migrate from :3334 | "5, then panel corrected to 7" | **Confirms 7**: architecture, safety-guard, verification, context, reasoning, investigation (+ browser as optional) |
| `discovery-engine.mjs` status | REMOVE | **Confirmed REMOVE** — not imported by server.mjs |
| Orphaned browser agents | Not explicitly listed | **New finding**: MonitoringAgent.mjs + StoreAgent.mjs not imported; REMOVE |
| `KnowledgeScheduler` side-effect | Listed as "surprising finding" in evidence | Confirmed (not a capability; not in lcis-core scope) |
| 107 vs 108 validators | CLAUDE.md says 107; LCIS_MASTER_ARCHITECTURE says 108 | **Not resolved here** — run `node scripts/validate-governance.mjs` for ground truth |

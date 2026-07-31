# LCIS Duplication Report — Phase 3: Definitive Classification

**Author:** Claude (Principal Platform Architect, discovery-only)
**Date:** 2026-06-20
**Mission:** Classify every duplication/overlap across LCIS; prescribe MERGE / KEEP / REMOVE / REFACTOR / ARCHIVE for each.
**Evidence sources:** `docs/lcis-master/_evidence/inventory-graph-server.md`, `docs/lcis-master/_evidence/inventory-central-intelligence.md`, `docs/lcis-master/_evidence/lead-strategic-notes.md`, `docs/lcis-master/LCIS_DOCUMENT_ARCHAEOLOGY.md`, `docs/lcis-master/LCIS_REPOSITORY_ARCHAEOLOGY.md`, plus direct source spot-checks cited inline.

---

## 0. Orientation: The Numbers Before Deduplication

| Layer | Files | HTTP Endpoints | Wired/deployed? |
|---|---|---|---|
| `tools/graph-server` (LCIS :3333) | **81** `.mjs` modules | **118** `/api/*` routes | Local dev only — not in `pnpm-workspace.yaml`, no `vercel.json` |
| `tools/central-intelligence` (LCIS :3334) | **121** `.mjs` files | **68** `/intelligence/*` routes | Local dev only — no `wrangler.toml`, not in workspace |
| `.claude/commands/agent-*.md` | **14** slash-command files | (CLI prompts, not HTTP) | Developer tool only |
| Total engine + agent files | **202+** | **186** HTTP routes | 0 production exposure |

**Core finding before classification:** 202 engine files across two runtimes expose 186 HTTP endpoints that serve zero production traffic and have zero user access other than a single developer. The only external consumers are AI agents (Claude) and the operator themselves.

---

## 1. Duplicate Intelligence Systems — The Headline Cross-Runtime Overlap

### 1.1 :3333 vs :3334 — The Philosophical Split

| Dimension | `:3333` (graph-server) | `:3334` (central-intelligence) |
|---|---|---|
| Architecture | Zero npm deps; `node:http` only | `@qdrant/js-client-rest`, `@opentelemetry/*`, `playwright` |
| Knowledge model | Pre-computed JSON artifacts; deterministic | Vector DB (Qdrant) + embeddings (OpenAI) + RAG (Python/GraphRAG) |
| V1-dependency | Source of truth | HTTP client of :3333 (40+ V1 calls per request) |
| Cold-start utility | ~100% (all 118 endpoints return real structural data) | ~32% (22/68 endpoints work with zero external services) |
| Current live-data | 0/7 providers connected | 0 providers connected (same honesty contract) |
| Self-philosophy | Own future-architecture doc ("Why no RAG?" — `reports/cip-future-architecture.md:380-389`) OPPOSES :3334's approach | No self-critique doc; no certification in `docs/central-intelligence/` |

**Verdict:** ARCHIVE `:3334` as a standalone runtime. See Dimension 1.2 below for what to preserve.

**Rationale:** The prior team's own architectural analysis (`reports/cip-future-architecture.md:380-389`) explicitly argues against RAG/vector DB in favour of pre-computed structural graphs. :3334 is functionally 68% dependent on :3333 (HTTP client); its novel capabilities (Qdrant semantic memory, Playwright browser validation, GraphRAG queries, OTel observability) require external services that are **all uninstalled and unconnected**. Zero external services are running in the current environment. :3334 has no certification, no CI integration, and its `skills/` directory is entirely empty (`tools/central-intelligence/skills/` has 0 files — `inventory-central-intelligence.md §4a`). The structural intelligence that works is already in :3333.

**What to preserve from :3334:** five patterns that are genuinely novel vs :3333:
1. `architecture-intelligence/` — pure filesystem, zero deps, works standalone, no :3333 equivalent (`inventory-central-intelligence.md §4b`)
2. `execution-engine/` + `SafetyGuard.mjs` — read-only enforcement with 28-verb ban + SHA-256 audit chain; no :3333 equivalent
3. `verification-engine/` — refuses to rubber-stamp conclusions; distinct from :3333's diagnosis-engine
4. `browser-intelligence/` — Playwright store/checkout/theme validation; unique capability when Playwright is installed
5. `operating-loop/` infrastructure (the 8-stage loop pattern) — design is sound even if implementation requires full V2 chain

These five should be **re-homed as modules within a consolidated :3333 runtime** (the "single-core" target state).

---

### 1.2 Intra-:3333 Duplicate Families (9 families, per `inventory-graph-server.md §3`)

#### Family A: Domain Intelligence (naming collision)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `domain-intel.mjs` | `/api/domain`, `/api/domains`, `/api/cross-domain` | YES | **KEEP** | Foundational 22-domain classifier; consumed by almost all downstream engines | Core foundation |
| `domain-intelligence.mjs` | `/api/domain-intelligence` | **DARK** — NOT wired in `server.mjs` (inventory §2, §3A) | **REFACTOR** | Orthogonal concern (custom-domain *feature*, not business domain graph); unwired; rename to `custom-domain-feature-intel.mjs` and wire the endpoint | Renamed + wired as distinct endpoint |

**Evidence:** `grep -c "domain-intelligence" tools/graph-server/server.mjs` = 0 (inventory-graph-server.md §2, "Gap discovered").

#### Family B: Merchant Intelligence (8 modules)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `merchant-intel.mjs` (v3) | `/api/merchant` | YES | **KEEP** | 14-stage lifecycle map; distinct answer format from v5 | Keep as lightweight lifecycle endpoint |
| `merchant-intelligence.mjs` (v5) | `/api/merchant-intelligence`, `/api/merchant-ops` | YES | **KEEP** | Richest model: Founding Merchant Program + 5 structural detectors | Primary merchant intelligence surface |
| `merchant-operating-graph.mjs` (v4) | `/api/merchant-operating` | YES | **MERGE** | Functional subset of `merchant-intelligence.mjs`; `decision-engine-v2.mjs` calls `merchant-intelligence.mjs` not this module; the endpoint is served but the capability is subsumed | Fold into `merchant-intelligence.mjs`; expose same endpoint from there |
| `merchant-health-intel.mjs` | `/api/merchant-health` | YES | **KEEP** | Distinct 5-dimension health model | Keep |
| `merchant-growth-intel.mjs` | `/api/merchant-growth` | YES | **KEEP** | Distinct 5-dimension growth model | Keep |
| `merchant-adoption-intel.mjs` | `/api/merchant-adoption` | YES | **KEEP** | Distinct 7-feature adoption model | Keep |
| `merchant-risk-intel.mjs` | `/api/merchant-risk` | YES | **KEEP** | Distinct 5-dimension risk model | Keep |
| `merchant-churn-intel.mjs` | `/api/merchant-churn` | YES | **KEEP** | Distinct 5-signal churn model | Keep |

**Evidence for MERGE call:** `grep -n "merchant-operating-graph\|merchantOperating" tools/graph-server/decision-engine-v2.mjs` — `decision-engine-v2.mjs` imports `merchant-intelligence.mjs` line 6 (spot-check confirmed), not `merchant-operating-graph.mjs`.

#### Family C: Revenue Intelligence (naming inversion)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `revenue-intelligence.mjs` (named v5) | `/api/revenue-intelligence` | YES | **KEEP** | Anomaly/leak detector focus; genuinely distinct from v2 | Keep as anomaly-detection surface |
| `revenue-intelligence-v2.mjs` (Omega era — newer despite "v2" name) | `/api/revenue-v2` | YES | **KEEP** | 8-model comprehensive revenue model; different scope | Keep as comprehensive revenue surface |

**Note:** The naming is inverted — "v2" is the newer Omega-era module. Recommend renaming to `revenue-anomaly-intel.mjs` + `revenue-models-intel.mjs` in a future refactor, but do not change now (REFACTOR, low priority).

#### Family D: Decision Engine (supersession)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `decision-engine-v5.mjs` | `/api/decision-engine` | YES | **REFACTOR** | Older base rankings; `decision-engine-v2.mjs` imports it (line 6, confirmed spot-check); both endpoints wired | Demote to internal library; remove standalone `/api/decision-engine` endpoint; expose only via v2 |
| `decision-engine-v2.mjs` (Omega) | `/api/decision-v2` | YES | **KEEP** | Adds 1k/10k scale tiers; what `graph:ai-ops` actually calls | Primary decision surface |

**Evidence:** `tools/graph-server/decision-engine-v2.mjs` line 6: `import { buildDecisionEngine } from './decision-engine-v5.mjs';` (spot-check confirmed). This makes v5 a library, not an independent surface.

#### Family E: Production Readiness (layered, not duplicate)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `production-readiness-intel.mjs` (v5) | `/api/production-readiness` | YES | **KEEP** | 18-system detail view; v2 calls this internally | Keep as detail layer |
| `production-readiness-v2.mjs` (Omega) | `/api/production-readiness-v2` | YES | **KEEP** | 10-dimension executive rollup; genuinely different abstraction level | Keep as executive layer |

**Verdict rationale:** These are NOT duplicates — they are a detail/summary pair. Both endpoints serve real needs (automated gate + executive readiness, respectively).

#### Family F: Incident Intelligence (4-layer lineage)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `incident-intel.mjs` (v3) | `/api/incident` | YES | **ARCHIVE** | Chain trace only; superseded by v5 and Genesis; no caller uses the v3 endpoint in preference to the richer ones | Archive endpoint; keep module as internal library call |
| `incident-response.mjs` (v4) | `/api/incident-response` | YES | **ARCHIVE** | Adds rollback path — this capability is now inside `incident-control-intel.mjs`; intermediate layer | Archive endpoint |
| `incident-intelligence-v5.mjs` | `/api/incident-intelligence` | YES | **MERGE** | Called by `incident-control-intel.mjs` (spot-check line 10: `import { incidentIntelligenceV5 }`) — already a library | Demote to internal library; remove standalone endpoint |
| `incident-control-intel.mjs` (Genesis) | `/api/incident-control` | YES | **KEEP** | Definitive surface: diagnosis + runbook + v5; composed answer | Primary incident surface |

**Evidence:** Spot-check: `tools/graph-server/incident-control-intel.mjs` line 10: `import { incidentIntelligenceV5 } from './incident-intelligence-v5.mjs';` — v5 is already consumed internally.

#### Family G: Memory (v1 superseded by v2)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `memory-intel.mjs` (v1) | `/api/memory` | YES | **REFACTOR** | Foundational extractor; `memory-v2.mjs` calls this internally; standalone endpoint less useful | Demote to library; remove standalone `/api/memory` endpoint |
| `memory-v2.mjs` (Omega) | `/api/memory-v2` | YES | **KEEP** | 9 categories + rejected/failed decisions; richer; the recommended surface | Primary memory surface |

#### Family H: Discovery (v3 deprecated, v5 is library, v2 is live)

| Item | Endpoint | Wired? | Verdict | Rationale | Target |
|---|---|---|---|---|---|
| `discovery-engine.mjs` (v3) | NOT wired (CLI only) | NO | **REMOVE** | Not imported by `server.mjs`; not called by any wired module; `discovery-v2.mjs` supersedes it (inventory §3H) | Safe removal — zero functional loss |
| `autonomous-discovery-v5.mjs` | NOT wired (CLI only) | NO — internal library | **KEEP** | Consumed by `discovery-v2.mjs`; required as library even though not directly routed | Keep as internal library |
| `discovery-v2.mjs` (Omega) | `/api/discovery-v2` | YES | **KEEP** | Live endpoint; the authoritative discovery surface | Primary discovery surface |

#### Family I: Report Generators (no overlap within set)

| Item | Verdict | Rationale |
|---|---|---|
| `gen-reports.mjs`, `gen-v3-reports.mjs`, `gen-v4-reports.mjs`, `gen-v5-reports.mjs`, `gen-omega-reports.mjs`, `gen-explain-docs.mjs` | **KEEP ALL** | Each writes to a different version layer of `docs/central-intelligence/`; no internal overlap; all CLI-only with no HTTP surface |

---

## 2. Duplicate APIs — Overlapping Endpoints

### 2.1 Cross-Runtime API Overlap (:3333 vs :3334)

| Capability | :3333 endpoint | :3334 endpoint | Winner | Verdict |
|---|---|---|---|---|
| Root cause / incident investigation | `/api/diagnose`, `/api/root-cause`, `/api/incident-control` | `/intelligence/correlate/root-cause`, `/intelligence/investigate/domain` | **:3333** — deterministic, no external deps | :3334 endpoints ARCHIVE with :3334 |
| Memory / "have we seen this" | `/api/memory-v2` | `/intelligence/memory/search` | **:3334** — semantic Qdrant search is genuinely distinct from :3333's document-extraction memory | **MERGE pattern**: re-home Qdrant memory into :3333 as an optional module |
| Operations / observability status | `/api/operations`, `/api/runtime-observability` | `/intelligence/operations/assess`, `/intelligence/operations/recommendations` | **:3333** — structural ops always works; :3334 ops requires V1 anyway | :3334 ops endpoints ARCHIVE |
| Recommendations / "what to fix" | `/api/decision-v2`, `/api/fix-engine` | `/intelligence/recommend`, `/intelligence/executive/next` | **:3333** — V1 blocker report is ground truth; :3334 recommendation calls :3333 decision-v2 | :3334 recommend endpoints ARCHIVE |
| Architecture analysis | No direct equivalent | `/intelligence/architecture`, `/intelligence/architecture/drift` | **:3334** — novel capability; pure filesystem; works standalone | **PRESERVE** by migrating to :3333 |
| Prediction | `/api/predict`, `/api/detection-prediction` | `/intelligence/predict`, `/intelligence/predict/all` | **:3333** — structural predictors; :3334 prediction calls :3333 | :3334 prediction ARCHIVE |
| Verification of conclusions | No :3333 equivalent | `/intelligence/verify` | **:3334** only | **PRESERVE** by migrating to :3333 |
| Browser validation | No :3333 equivalent | `/intelligence/browser/validate`, `/intelligence/browser/checkout` | **:3334** only | **PRESERVE** as optional module (requires Playwright) |
| Execution safety (SafetyGuard) | No :3333 equivalent | `/intelligence/execute` | **:3334** only | **PRESERVE** by migrating to :3333 |
| Context compression | No :3333 equivalent | `/intelligence/context/assemble`, `/intelligence/context/compression` | **:3334** only | **PRESERVE** by migrating to :3333 |

### 2.2 Dark (Unwired) Endpoints in :3333

| Module | Claimed endpoint | Evidence | Verdict |
|---|---|---|---|
| `domain-intelligence.mjs` | `/api/domain-intelligence` | `grep "domain-intelligence" tools/graph-server/server.mjs` = 0 (inventory §2) | REFACTOR: rename + wire |
| `deployment-intelligence-v5.mjs` | `/api/deployment-intelligence-v5` | `grep "deployment-intelligence-v5" tools/graph-server/server.mjs` = 0 (inventory §2) | WIRE: artifact is built by `graph:v5`; trivial to add route |

---

## 3. Duplicate Dashboards

| Surface | Port | Tech | Users | Wired? | Verdict |
|---|---|---|---|---|---|
| `tools/graph-server/index.html` (LCIS SPA) | :3333 | Single-page app; 9+ tab panels; URL deep-linking (V10); domain Explorer, Atlas, Business Intelligence, Launch Command Center | Developer/AI agent | YES — served by `server.mjs` SPA fallback | **KEEP** — primary developer-facing UI |
| `tools/central-intelligence/operator-platform/` | :3335 | Static HTML + zero-dep proxy server (`serve-dashboard.mjs`); proxies `/intelligence/*` to :3334 | Operator | Requires :3334 | **ARCHIVE** with :3334 — zero users today; `dashboard.html` content unaudited |
| V10/V11/OMEGA command centers (embedded in :3333 SPA) | :3333 | JS tab panels; Launch Command Center, AI Operations Center, Mission Control, Live Operations Center | Developer/AI | YES — implemented inside index.html navigation | **KEEP** — part of primary SPA |

**Net:** 3 surfaces → 1 primary SPA at :3333.

---

## 4. Duplicate Graph Systems

| System | What it is | Authority for what? | Status |
|---|---|---|---|
| **Graphify** (external, Python/tree-sitter) | 52,246-node code graph → `graphify-out/graph.json` | Code relationships: imports, exports, calls, file structure | **AUTHORITATIVE** for code graph; external binary at `~/.local/bin/graphify` |
| **:3333 reading layer** (`intelligence.mjs`) | Loads `graph.json` + domain/db/infra JSON artifacts; exposes blast-radius/deps/consumers/search | Intelligence queries over Graphify output + SQL/infra overlays | **AUTHORITATIVE** for intelligence API; reads Graphify output |
| **:3334 GraphRAG** (`graph-engine/GraphQueryEngine.mjs`) | Python subprocess (`python3 -m graphrag query`) over a separately-indexed GraphRAG corpus | Semantic graph queries ("what entities are related to X?") | **NOT FUNCTIONAL** — GraphRAG index not built; no Python venv found; subprocess returns empty/503 (inventory §4a) |

**Verdict table:**

| Item | Type | Verdict | Rationale |
|---|---|---|---|
| Graphify external scanner | Graph source | **KEEP** | Sole code-graph authority; not replaceable |
| :3333 intelligence.mjs reading layer | Query engine | **KEEP** | Primary intelligence surface over Graphify output |
| :3334 GraphRAG engine | Semantic RAG | **REMOVE** (with :3334 archival) | Never functional; external Python dependency not installed; structural Graphify + :3333 domain graph is more accurate per own architecture docs |

**Consolidation verdict:** There is one authoritative graph (Graphify). The :3333 reading layer is the correct place to expose intelligence queries over it. GraphRAG is redundant with the :3333 structural traversal and adds a Python subprocess dependency for lower accuracy (per `cip-future-architecture.md:380-389`).

---

## 5. Duplicate Monitoring/Observability

| System | Location | What it monitors | External deps | Works today? |
|---|---|---|---|---|
| `runtime-intel.mjs` + `runtime-observability-intel.mjs` + `telemetry-intelligence.mjs` | `:3333` | Worker/Queue/Cron topology from `wrangler.toml`; 10 metric sources mapped (topology only — values NOT CONNECTED) | None | YES — structural topology always works |
| `production-health.mjs` + `detection-prediction-intel.mjs` | `:3333` | GREEN/YELLOW/RED per system; 8 autonomous detectors + 6 predictors (all structural-only, NOT CONNECTED to live signals) | None | YES |
| `observability/` (`TelemetryService.mjs`, `AnomalyDetectionService.mjs`, OTel/SigNoz stack) | `:3334` | OTel traces/metrics/logs; in-memory anomaly thresholds; reads `graphify-out/incidents.jsonl` | `@opentelemetry/*` (npm), SigNoz Docker (4 containers) | NO — OTel noop; SigNoz not running; `HealthService` marks Observability `DOWN` (inventory §4a) |

**Classification:**

| Item | Evidence | Verdict | Rationale | Target |
|---|---|---|---|---|
| `:3333` runtime + health + detection stack | Inventory §1E, §1K | **KEEP** | Structural observability is always functional; the correct layer given 0 live adapters | Primary observability surface |
| `:3334` OTel/SigNoz observability | inventory §4a; spot-check: `OperationsReasoningEngine.mjs` header confirms `NOT CONNECTED` labelling | **ARCHIVE** with :3334 | Requires 4-container Docker stack + OTel credentials; currently returns noops; not needed when :3333 structural layer covers the same ground structurally | N/A |
| `:3334` `AnomalyDetectionService` in-memory signals | inventory §4a | **ARCHIVE** | In-memory threshold checks without live data produce no actionable signal; :3333 `detection-prediction-intel.mjs` covers structural detection | N/A |

---

## 6. Duplicate Memory/Knowledge Systems

| System | Location | Mechanism | Works today? | What it knows |
|---|---|---|---|---|
| `memory-intel.mjs` + `memory-v2.mjs` | `:3333` | Regex parse of governance docs + migration ledger → 9 categories of decisions/rules/rejections | YES — pure filesystem | Governance rules, architecture decisions, migration history, rejection rationale |
| `memory-engine/` (Qdrant) | `:3334` | OpenAI embeddings → Qdrant vectors → semantic retrieval across 8 collections | NO — requires Qdrant + OpenAI API key (setup.sh hard-exits without OPENAI_API_KEY) | Would hold: architecture/runbooks/incidents/security/deployments/knowledge/merchants/themes |
| `knowledge-engine/` (Crawl4AI) | `:3334` | Python subprocess (`crawl4ai`) → crawls Supabase/Cloudflare/Vercel docs → Qdrant ingestion | NO — Python+Crawl4AI not installed; Qdrant not running | Would hold: vendor documentation freshness |

**Classification:**

| Item | Verdict | Rationale | Target |
|---|---|---|---|
| `:3333` `memory-intel.mjs` + `memory-v2.mjs` | **KEEP** | Governance-document memory is functional and correct; hand-authored, not ML-generated | Primary memory surface |
| `:3334` Qdrant memory engine | **ARCHIVE** with :3334 (optional future reintegration) | Requires 3 external services (Qdrant + OpenAI + Docker); zero of these are running; no practical benefit until at least one live adapter (Supabase) is wired first | N/A |
| `:3334` Crawl4AI knowledge engine | **ARCHIVE** with :3334 | Python subprocess, not installed; lower priority than wiring live Supabase adapter | N/A |

**Strategic note:** Wiring Qdrant/OpenAI for semantic memory is a **second-order improvement**. The first-order improvement is connecting one live Supabase adapter so structural memory has real data to reason over. The "earn live data" thesis (`lead-strategic-notes.md §cross-cutting thesis 3`) applies here.

---

## 7. Duplicate Agents

Three parallel agent systems exist with overlapping concerns but distinct mechanisms:

| System | Count | Location | Mechanism | Invoked by | Works today? |
|---|---|---|---|---|---|
| `.claude/commands/agent-*.md` | **14** slash commands | `.claude/commands/` | Claude Code slash commands — prompt files that instruct Claude to query LCIS + inspect code + report | Human developer typing `/agent-payment` etc. in Claude Code | YES — always; they are prompt files |
| `:3334` `agents/` | **8** `.mjs` agents | `tools/central-intelligence/agents/` | `AgentFramework.mjs` → V1 HTTP + Qdrant (optional) + GraphRAG (optional); exposed via `/intelligence/agents/execute` | HTTP GET; never called by the slash commands | PARTIAL — skeleton works; meaningful output requires V1 + Qdrant |
| `:3333/:3334` executive/orchestration engines | V3 layer | `tools/central-intelligence/executive-intelligence/`, `orchestration-engine/` | Multi-engine async orchestration; Executive Briefing / Orchestrate health/risk | `/intelligence/executive/*`, `/intelligence/orchestrate/*` | PARTIAL — structure works; quality requires full V2 chain |

**Classification:**

| Item | Type | Verdict | Rationale | Target |
|---|---|---|---|---|
| `.claude/commands/agent-*.md` (14 files) | Dim 7 — slash-command agents | **KEEP ALL** | These are the working, used agent surface; they are what Claude actually runs; domain coverage is correct (architecture/checkout/compliance/developer/identity/infrastructure/marketplace/operations/payment/production/release/security/tenant/theme) | Primary agent surface |
| `:3334` `agents/` 8 .mjs files | Dim 7 — HTTP agents | **ARCHIVE** with :3334 | Zero usage path today: the slash commands don't call the `/intelligence/agents/execute` endpoint; the agents themselves need Qdrant for any semantic memory; the slash commands do the same job better via direct Claude reasoning + LCIS V1 queries | N/A |
| Executive/orchestration V3 layer | Dim 7 — orchestration agents | **ARCHIVE** with :3334 | High-quality intent; zero practical utility without full V2 chain (Qdrant + all sub-engines); the `agent-*.md` slash commands + :3333 decision-v2/fix-engine serve the same "what to do next" need | N/A |

**Clarification:** These are NOT three parallel agent systems in meaningful practice — the `.claude/commands/` slash commands are the only real agent surface. The :3334 agent framework and executive layer are aspirational infrastructure with no current invocation path.

---

## 8. Duplicate Documentation

### 8.1 The Certification Quintet Pattern (12+ generations)

| Pattern | Count | Location | Verdict |
|---|---|---|---|
| Full quintets (baseline+audit+implementation+test+cert) | 4 (V10/V11/OMEGA/INFINITY) | `docs/v10/`, `docs/v11/`, `docs/omega-production/`, `docs/infinity/` | **ARCHIVE ALL 4 quintets** — historical record; the current state is in `:3333` source + inventory docs; these quintets are self-certified by the building team (archaeology §5.2); no external value |
| Partial sets (V8/V9/Genesis/V7-OS) | 4 partial sets (~16 docs) | `docs/operating-system/` | **ARCHIVE** — superseded by OMEGA/INFINITY |
| Individual certs (V2–V6) | 5 | `docs/central-intelligence/` | **ARCHIVE** — superseded |
| No cert for :3334 | — | — | **GAP** — not a duplication issue; a missing document |

**Total certification docs to archive: ~67 files** (`find docs -name "*CERTIF*" -o -name "*certification*"` = 67 count confirmed).

### 8.2 Generated Reports vs Hand-authored

| Category | Count | Location | Verdict |
|---|---|---|---|
| Auto-generated `.generated.md` reports (pnpm graph:*) | 2 explicitly suffixed + ~18 generated | `docs/central-intelligence/` | **KEEP** — they are live outputs of the system; `.generated` suffix marks them correctly |
| Hand-generated reports (not suffixed) in same dir | ~35 | `docs/central-intelligence/` | **ARCHIVE majority** — most are certification/gap docs from previous generations; keep only ONBOARDING.md, AI_CONTEXT_PACK.md, DOMAIN_EXPLAIN.md |

### 8.3 Engine Spec Docs vs Implementation

| Category | Count | Location | Verdict |
|---|---|---|---|
| `docs/lcis-v2/` engine specs | **32** | `docs/lcis-v2/` | **ARCHIVE** — these describe the design of `:3334` at a time when it was planned; now that :3334 has 121 implemented files, the design specs are superseded by source code; the current `inventory-central-intelligence.md` is the better reference |
| `docs/graphify/` research docs | **19** | `docs/graphify/` | **ARCHIVE** — Graphify is now in production use; the research phase is over |
| `docs/graph/` dependency maps | **10** | `docs/graph/` | **ARCHIVE** — generated intelligence from `:3333` is more current |
| `docs/ai-infrastructure/` | **7** | `docs/ai-infrastructure/` | **KEEP** — `graphify-queries.md` is a live reference; others may be archived |
| `docs/operating-system/` (V7–V9 program docs) | **17** | `docs/operating-system/` | **ARCHIVE** — superseded by current :3333 inventory |

### 8.4 "V2" Naming Collision in Docs

| Usage | Location | Verdict |
|---|---|---|
| "LCIS V2" = infrastructure layer (FK + workers) | `docs/central-intelligence/LCIS_V2_CERTIFICATION.md` | **ARCHIVE** the cert; clarify naming in master index |
| "LCIS V2" = autonomous intelligence platform (:3334) | All 32 `docs/lcis-v2/*.md` files | **ARCHIVE** design specs; source is the truth now |

**This naming collision must be resolved in the Master Architecture:** the new canonical term for `:3334` is "LCIS Autonomous Platform (uncertified, archived)" and the "V2 infrastructure layer" within :3333 is "DB+Infra intelligence layer (V2 era)."

### 8.5 Reports Directory

| Item | Count | Verdict |
|---|---|---|
| `reports/cip-future-architecture.md` | 1 | **ARCHIVE** — CIP extraction has not happened; aspirational |
| `reports/papaa-intelligence-blueprint.md` | 1 | **ARCHIVE** — Papaa Escola is speculative; no code exists |
| `reports/lcis-*.md` forensic analysis set | ~11 | **KEEP** — Phase 0 archaeology inputs; valuable for master architecture |

---

## 9. Target-State Summary

**Before consolidation:** 81 :3333 engines + 121 :3334 files + 14 slash-command agents + 172 docs = **~388 artifacts**

**True distinct capabilities beneath the duplication:** Analysis reveals **32 genuinely distinct capabilities**:

| # | Capability | Current home | Post-consolidation home |
|---|---|---|---|
| 1 | Code graph (Graphify) | External binary | External binary (unchanged) |
| 2 | DB intelligence (tables/RPCs/policies) | `db-intel.mjs` | Core foundation |
| 3 | Infrastructure intelligence (workers/queues/secrets) | `infra-intel.mjs` | Core foundation |
| 4 | Domain classification (22 domains) | `domain-intel.mjs` | Core foundation |
| 5 | FK relationship graph | `relationship-intel.mjs` | Core foundation |
| 6 | Graph traversal / blast radius | `intelligence.mjs` | Core foundation |
| 7 | Custom-domain feature intelligence | `domain-intelligence.mjs` (DARK) | Renamed + wired |
| 8 | Security intelligence | `security-intel.mjs` + `security-intelligence-v5.mjs` | Security layer |
| 9 | Payment intelligence | `payment-intel.mjs` | Commerce layer |
| 10 | Merchant lifecycle + health/growth/adoption/risk/churn | 7 merchant modules | Merchant layer (keep all 7) |
| 11 | Revenue models + anomaly detection | 2 revenue modules | Revenue layer |
| 12 | Customer intelligence (funnel/journey) | 2 customer modules | Customer layer |
| 13 | Memory / governance decisions | `memory-v2.mjs` (calls v1) | Memory layer |
| 14 | Incident tracing + control | `incident-control-intel.mjs` (calls v3/v4/v5) | Incident layer |
| 15 | Root cause / diagnosis | `diagnosis-engine.mjs` | Diagnosis layer |
| 16 | Runbooks | `runbook-engine.mjs` | Operations layer |
| 17 | Production readiness (detail + executive) | 2 readiness modules | Readiness layer |
| 18 | Decision / fix priorities | `decision-engine-v2.mjs` (calls v5) | Decision layer |
| 19 | Runtime + observability topology | `runtime-intel.mjs` + `runtime-observability-intel.mjs` + `telemetry-intelligence.mjs` | Runtime layer |
| 20 | Deployment intelligence | `deployment-intel.mjs` + `deployment-state.mjs` | Deploy layer |
| 21 | Live adapters (credential probe) | `live-adapters.mjs` | Live layer |
| 22 | Detection + prediction (structural) | `detection-prediction-intel.mjs` | INFINITY layer |
| 23 | Explain mode (human/AI readable) | `explain-intel.mjs` + `search-intel.mjs` | UX layer |
| 24 | Audit (route/RLS coverage) | `audit-engine-v2.mjs` | Security layer |
| 25 | Control centers (launch/incident/commerce/infra) | 5 control center modules | Control layer |
| 26 | Knowledge graphs (7 sub-graphs) | `knowledge-graphs.mjs` | Knowledge layer |
| 27 | AI context packs | `ai-context-intel.mjs` | AI layer |
| 28 | Architecture intelligence (drift/layers/services) | `:3334` only | **Migrate to :3333** |
| 29 | Execution safety (SafetyGuard + audit chain) | `:3334` only | **Migrate to :3333** |
| 30 | Verification of conclusions | `:3334` only | **Migrate to :3333** |
| 31 | Browser validation (Playwright) | `:3334` only | **Optional module in :3333** |
| 32 | Context compression / AI token budget | `:3334` only | **Migrate to :3333** |

**After consolidation:** 1 runtime (:3333, ~70 engine files after merges) + 1 dashboard (SPA at :3333) + 14 slash-command agents (unchanged) + ~25 live docs = **~110 artifacts** (72% reduction)

---

## 10. Safe-Removal Manifest

Ranked by safety (1 = most safe to remove, zero functional loss):

### Tier 1: Remove with Zero Functional Loss (confirmed unwired, superseded, or empty)

| Item | Path | Evidence | Risk |
|---|---|---|---|
| `discovery-engine.mjs` | `tools/graph-server/discovery-engine.mjs` | Not imported by `server.mjs`; not called by any wired module; `discovery-v2.mjs` is live (inventory §3H) | ZERO |
| `:3334` `skills/` directory | `tools/central-intelligence/skills/` | 0 files; placeholder only (inventory §4a) | ZERO |
| All 67 certification docs | `docs/` (find by name `*CERTIF*\|*certification*`) | Self-issued by same team; superseded by current source (archaeology §5.2) | ZERO |
| 32 `docs/lcis-v2/*.md` engine specs | `docs/lcis-v2/` | Describe design of :3334 which is now implemented; source code is authoritative | ZERO |
| 19 `docs/graphify/*.md` research docs | `docs/graphify/` | Research phase over; Graphify is in production | ZERO |
| 17 `docs/operating-system/*.md` (V7–V9 program) | `docs/operating-system/` | Superseded by OMEGA/INFINITY state | ZERO |
| 10 `docs/graph/*.md` dependency maps | `docs/graph/` | :3333 generates richer live versions | ZERO |
| `reports/cip-future-architecture.md` | `reports/` | Unimplemented; no `packages/@cip/` exists | ZERO |
| `reports/papaa-intelligence-blueprint.md` | `reports/` | Speculative product; no code | ZERO |

### Tier 2: Archive with Near-Zero Functional Loss (wired but superseded)

| Item | Path | Evidence | Migration needed before archive? |
|---|---|---|---|
| `/api/incident` endpoint | routes in `server.mjs` + `incident-intel.mjs` | Superseded by `/api/incident-control`; `incident-intel.mjs` is internally called by the v5 module | Keep module as internal library; remove only the endpoint |
| `/api/incident-response` endpoint | routes in `server.mjs` + `incident-response.mjs` | Intermediate layer; superseded by genesis control center | Keep module; remove endpoint |
| `/api/incident-intelligence` endpoint | routes in `server.mjs` + `incident-intelligence-v5.mjs` | Already imported as library by `incident-control-intel.mjs` | Keep module; remove endpoint |
| `/api/memory` endpoint | routes in `server.mjs` + `memory-intel.mjs` | `memory-v2.mjs` calls `memory-intel.mjs` internally; v2 endpoint is richer | Keep module; remove v1 endpoint |
| `/api/merchant-operating` endpoint | routes in `server.mjs` + `merchant-operating-graph.mjs` | Subset of `merchant-intelligence.mjs` capability | Verify v5 covers all v4 use cases; then archive endpoint |
| Entire `:3334` runtime | `tools/central-intelligence/` | 68% dependent on :3333; all 5 external services unconnected and uninstalled; no certification; no CI; no production exposure | Migrate 5 novel capabilities to :3333 first (capabilities #28–32 above) |
| `:3335` operator dashboard | `tools/central-intelligence/operator-platform/` | Proxies :3334; no users; unaudited `dashboard.html` | Archive with :3334 |

### Tier 3: Refactor (rename/wire/consolidate, not remove)

| Item | Action | Rationale |
|---|---|---|
| `domain-intelligence.mjs` | Rename to `custom-domain-feature-intel.mjs`; wire `/api/custom-domain-intelligence` in `server.mjs` | Currently DARK (unwired); distinct from `domain-intel.mjs`; provides real value once wired |
| `deployment-intelligence-v5.mjs` | Wire `/api/deployment-intelligence-v5` in `server.mjs` | Artifact is built by `graph:v5`; trivial 2-line server.mjs addition |
| `/api/decision-engine` (v5 endpoint) | Remove standalone endpoint; expose only via `/api/decision-v2` | v5 is already a library called by v2; dual endpoint confuses consumers |
| Revenue module names | Rename: `revenue-intelligence.mjs` → `revenue-anomaly-intel.mjs`; `revenue-intelligence-v2.mjs` → `revenue-models-intel.mjs` | "V2" is the newer module; naming is inverted and confusing |

---

## 11. Consolidation Map — Proposed Single-Core Capability Set

The target state is **one runtime** (`:3333` lineage) with all 32 capabilities, no parallel implementations, exposed via:
- **HTTP API** (the 118 cleaned-up routes → ~90 after endpoint retirement)
- **CLI** (`graph:intel` and the `graph:*` pipeline scripts — unchanged)
- **MCP** (`graphify-mcp` — already registered; stays)

```
SINGLE-CORE CAPABILITY SET (post-consolidation)
──────────────────────────────────────────────────
FOUNDATION (capabilities 1–6)
  graphify-out/graph.json ← external Graphify binary
  db-intel.json, infra-intel.json, domain-intel.json, relationship-intel.json
  intelligence.mjs (blast/deps/consumers/search)

FEATURE INTELLIGENCE (7)
  custom-domain-feature-intel.mjs [renamed from domain-intelligence.mjs, wired]

SECURITY + PAYMENTS (8, 9)
  security-intel.mjs + security-intelligence-v5.mjs → single /api/security-v5
  payment-intel.mjs

MERCHANT + REVENUE + CUSTOMER (10, 11, 12)
  7 merchant modules (keep distinct: v3 lifecycle + v5 operating + 5 Omega models)
  revenue-anomaly-intel.mjs + revenue-models-intel.mjs [renamed]
  customer-intelligence-v2.mjs + customer-journey-intelligence.mjs

MEMORY + DECISION (13, 14, 16, 17, 18)
  memory-v2.mjs [primary; v1 as internal lib]
  incident-control-intel.mjs [primary; v3/v4/v5 as internal libs]
  runbook-engine.mjs
  production-readiness-intel.mjs + production-readiness-v2.mjs
  decision-engine-v2.mjs [primary; v5 as internal lib]

DIAGNOSIS + AUDIT (15, 24)
  diagnosis-engine.mjs
  audit-engine-v2.mjs

RUNTIME + DEPLOYMENT (19, 20)
  runtime-intel.mjs + runtime-observability-intel.mjs + telemetry-intelligence.mjs
  deployment-intel.mjs + deployment-state.mjs

LIVE + DETECTION (21, 22)
  live-adapters.mjs
  detection-prediction-intel.mjs

UX + AI (23, 27)
  explain-intel.mjs + search-intel.mjs
  ai-context-intel.mjs

CONTROL CENTERS (25)
  launch-command-center.mjs + incident-control-intel.mjs + commerce-control-intel.mjs
  infrastructure-control-intel.mjs + database-control-intel.mjs + environment-control-intel.mjs

KNOWLEDGE + ECOSYSTEM (26)
  knowledge-graphs.mjs + ecosystem-intel.mjs

MIGRATED FROM :3334 (28–32) [new modules to be written/ported]
  architecture-intelligence.mjs [port from tools/central-intelligence/architecture-intelligence/]
  safety-guard.mjs + execution-engine.mjs [port from tools/central-intelligence/execution-engine/]
  verification-engine.mjs [port from tools/central-intelligence/verification-engine/]
  context-assembly.mjs [port from tools/central-intelligence/context-intelligence/]
  browser-validator.mjs [optional; port from tools/central-intelligence/browser-intelligence/]
```

---

## 12. The Cross-Runtime Verdict (the headline call)

**:3333 is the correct surviving runtime. :3334 should be archived as a standalone server.**

Evidence for this verdict:
1. **Own team agrees:** `reports/cip-future-architecture.md:380-389` — "Why Pre-Computed JSON (Not Vector DB)?" and "Why No RAG?" explicitly endorse the :3333 philosophy over the :3334 philosophy. This is the prior team's own conclusion.
2. **Dependency direction is one-way:** :3334 makes 40+ HTTP calls to :3333 per request; :3333 never calls :3334. :3333 is the source; :3334 is the consumer.
3. **Cold-start utility ratio is 100% vs 32%:** :3333 serves real structural data for 100% of its 118 endpoints with zero external services. :3334 serves real data for only 32% of its 68 endpoints with zero external services.
4. **No certification exists for :3334.** Every :3333 generation has a certification quintet. :3334 has none (`archaeology §6.2`).
5. **:3334's 5 novel capabilities** (architecture intelligence, execution safety, verification, context compression, browser validation) are worth preserving but belong inside :3333's unified runtime — not behind a separate server that requires Docker, Python, OpenAI API keys, and Playwright to function at all.
6. **:3334's primary external dependencies are all uninstalled:** Qdrant not running, OpenAI API key absent, GraphRAG not installed, Crawl4AI not installed, Playwright not installed, OTel not running.

---

*End of LCIS Duplication Report — Phase 3*
*Produced 2026-06-20. Discovery-only: no code modified. All claims evidence-cited to inventory files, archaeology reports, or direct source spot-checks.*

# LCIS Capability Inventory — Phase 2 Deliverable

**Author:** Claude (Principal Platform Architect, discovery-only)
**Date:** 2026-06-20
**Status:** Authoritative. Supersedes all prior per-version capability lists.
**Evidence sources:** `docs/lcis-master/_evidence/inventory-graph-server.md` · `docs/lcis-master/_evidence/inventory-central-intelligence.md` · `docs/lcis-master/LCIS_DUPLICATION_REPORT.md`
**Rule:** every claim cites a source evidence file. No capability is invented that is not present in the evidence.

---

## 1. Executive Snapshot

| Metric | Value | Source |
|--------|-------|--------|
| Total engine/module files | **202** (81 :3333 + 121 :3334) | inventory-graph-server.md §0; inventory-central-intelligence.md §1 |
| HTTP endpoints today | **186** (118 at :3333 + 68 at :3334) | inventory-graph-server.md §0; inventory-central-intelligence.md §3 |
| True distinct capabilities (post-dedup analysis) | **32** | LCIS_DUPLICATION_REPORT.md §9 |
| Safely removable files (REMOVE verdict) | **1 module** (`discovery-engine.mjs`) | LCIS_DUPLICATION_REPORT.md §10 Tier 1 |
| Archive-ready (ARCHIVE verdict, wired or runtime) | **1 full runtime** (:3334) + **~167 docs** | LCIS_DUPLICATION_REPORT.md §10 Tier 2 + §8 |
| Refactor targets (REFACTOR verdict) | **4 items** | LCIS_DUPLICATION_REPORT.md §10 Tier 3 |
| Runtime A (:3333, `tools/graph-server`) | 81 `.mjs` modules; 118 API routes; **100% functional at cold start** | inventory-graph-server.md §4 |
| Runtime B (:3334, `tools/central-intelligence`) | 121 `.mjs` files; 68 intelligence routes; **32% functional at cold start** | inventory-central-intelligence.md §6 |
| Production exposure | **0** — both runtimes are local-dev-only tools | LCIS_DUPLICATION_REPORT.md §0 |
| Live adapters connected (:3333) | 0 of 7 (dev env — no provider creds) | inventory-graph-server.md §4A |
| Live adapters connected (:3334) | 0 (same honesty contract) | inventory-central-intelligence.md §6 |

**The strategic verdict (per LCIS_DUPLICATION_REPORT.md §12):** :3333 is the correct surviving runtime. :3334 should be archived as a standalone server. Five novel capabilities from :3334 (capabilities #28–32 below) are worth migrating into :3333.

---

## 2. The 32-Capability Catalog

Capabilities are grouped by the mission-required taxonomy. Each entry provides: **Name · Location · Purpose · Dependencies · Maturity · Production Readiness · Current Issues · Future Relevance**.

---

### Category A: Extraction / Graph (Capabilities 1–6)

The foundational layer. Everything else reads from these artifacts. All are 100% functional at cold start.

#### Capability 1 — Code Graph (Graphify)

| Field | Value |
|-------|-------|
| **Name** | Code Graph — Graphify External Scanner |
| **Location** | External binary (`~/.local/bin/graphify`); output: `graphify-out/graph.json` (52,246 nodes, 66,761 edges) |
| **Runtime** | :3333 reads the output |
| **Purpose** | Generates the authoritative code-relationship graph: imports, exports, calls, file structure across the entire monorepo. Single source of truth for all code-topology queries. |
| **Dependencies** | `uv tool install graphifyy` (one-time install); no runtime deps |
| **Maturity** | REAL — actively maintained; `graph:update` script refreshes |
| **Production Readiness** | YES — operational; artifact validated by `validate-graph.mjs` |
| **Current Issues** | None found. Nodes/edges counts in CLAUDE.md are slightly stale (52,246 actual vs "52k-node" documented — close). |
| **Future Relevance** | **KEEP** (external binary, unchanged by consolidation) |

#### Capability 2 — DB Intelligence

| Field | Value |
|-------|-------|
| **Name** | DB Intelligence — Tables / RPCs / Policies / Triggers / Indexes |
| **Location** | `tools/graph-server/db-intel.mjs`; output: `graphify-out/db-intel.json` |
| **Runtime** | :3333 |
| **Purpose** | Parses all SQL migrations → 417 tables, 164 RPCs, 658 policies, 398 triggers, 834 indexes. Also scans TS routes for `db.rpc()` callers. The data layer source of truth. |
| **Dependencies** | Filesystem only — `migrations/*.sql`, `services/api-gateway/src/routes/**/*.ts` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | CLAUDE.md dossier claims (414 tables, 156 RPCs, 651 policies) are slightly stale; actual values from latest `graph:db` run are higher. |
| **Future Relevance** | **KEEP** — core foundation |

#### Capability 3 — Infrastructure Intelligence

| Field | Value |
|-------|-------|
| **Name** | Infrastructure Intelligence — Workers / Queues / Secrets / Vercel Apps |
| **Location** | `tools/graph-server/infra-intel.mjs`; output: `graphify-out/infra-intel.json` |
| **Runtime** | :3333 |
| **Purpose** | Parses 4 × `wrangler.toml` + `production-deploy.yml` + `CODEOWNERS` → workers, queues, secrets, Vercel app targets. Infrastructure topology source of truth. |
| **Dependencies** | Filesystem only |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** — core foundation |

#### Capability 4 — Domain Classification

| Field | Value |
|-------|-------|
| **Name** | Domain Classification — 22 Business Domains |
| **Location** | `tools/graph-server/domain-intel.mjs`; output: `graphify-out/domain-intel.json` |
| **Runtime** | :3333 |
| **Purpose** | Classifies the entire codebase into 22 business domains; computes cross-domain edges (an RPC in domain A touching a table in domain B). Per-domain: queues, workers, apps, secrets, routes, tables. |
| **Dependencies** | `db-intel.json`, `infra-intel.json`, `services/api-gateway/src/routes/**/*.ts` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** — core foundation; consumed by nearly every downstream engine |

#### Capability 5 — FK Relationship Graph

| Field | Value |
|-------|-------|
| **Name** | FK Relationship Graph — 705 Foreign Key Edges |
| **Location** | `tools/graph-server/relationship-intel.mjs`; output: `graphify-out/relationship-intel.json` |
| **Runtime** | :3333 |
| **Purpose** | Builds bidirectional FK graph from SQL migrations. `sites` confirmed as tenant root. Exposes `/api/relationships?table=X` for table-centric exploration. |
| **Dependencies** | Filesystem only — `migrations/*.sql` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** — core foundation |

#### Capability 6 — Graph Traversal / Blast Radius

| Field | Value |
|-------|-------|
| **Name** | Graph Traversal — Blast Radius / Deps / Consumers / Search / Path / Payment / Tenant Flows |
| **Location** | `tools/graph-server/intelligence.mjs` (+ library: `tools/graph-server/cross-domain-engine.mjs`, `tools/graph-server/omega-lib.mjs`) |
| **Runtime** | :3333 |
| **Purpose** | In-memory traversal of the 52k-node `graph.json` + domain/db/infra overlays. Answers: what breaks if I change X, who calls X, what tables does RPC R touch, what does route R→RPC→table chain look like, who owns X. |
| **Dependencies** | `graph.json`, `db-intel.json`, `infra-intel.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** — primary intelligence query surface |

---

### Category B: Context (Capabilities 27, 32)

#### Capability 27 — AI Context Packs

| Field | Value |
|-------|-------|
| **Name** | AI Context Packs — Self-Contained Packs (<20k tokens) for Claude/Gemini/Codex/Cursor |
| **Location** | `tools/graph-server/ai-context-intel.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Generates distilled, AI-model-specific context packs from the structural graph. Endpoint: `/api/ai-context`, `/api/ai-context-pack`, `/api/ai-pack`. |
| **Dependencies** | `execution-intel.json`, `connections-intel.json`, `domain-intel.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** |

#### Capability 32 — Context Compression / Assembly

| Field | Value |
|-------|-------|
| **Name** | Context Compression — Token Budget Assembly, Repository Context Map |
| **Location** | `tools/central-intelligence/context-intelligence/ContextAssembler.mjs`, `ContextCompressionPipeline.mjs`, `ContextDiagnostics.mjs`, `TokenOptimizer.mjs` (plus `RepositoryGraphBuilder.mjs`, `ArchitectureGraphBuilder.mjs`, `DependencyGraphBuilder.mjs`) |
| **Runtime** | :3334 (migrate to :3333 per Duplication Report §9) |
| **Purpose** | Assembles ranked top-300 files with token-budget awareness; produces `LCIS_CONTEXT_MAP.json`; compresses repository context to ~1,275× reduction claim. |
| **Dependencies** | Filesystem only — reads `graphify-out/*.json` artefacts. No external services required. |
| **Maturity** | REAL — pure filesystem; works if `graphify-out/` is populated |
| **Production Readiness** | Partial — token budget is heuristic (no real tokenizer); output quality depends on prior `graph:domain` / `graph:infra` runs |
| **Current Issues** | No tests; 1,275× compression claim is heuristic not cryptographically verified |
| **Future Relevance** | **MIGRATE to :3333** (per Duplication Report §9 capability #32) |

---

### Category C: Memory / Knowledge (Capability 13)

#### Capability 13 — Memory / Governance Knowledge

| Field | Value |
|-------|-------|
| **Name** | Memory — Governance Rules, Architecture Decisions, Migration Ledger, Rejected Decisions |
| **Location** | Primary: `tools/graph-server/memory-v2.mjs` (9 categories + rejected/failed); internal library: `tools/graph-server/memory-intel.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Parses `LETBUYY_CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md`, `docs/architecture/`, and `migrations/` for RULE patterns, governance decisions, migration ledger, and rejected alternatives. |
| **Dependencies** | Filesystem only |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | `memory-intel.mjs` (v1) exposes redundant standalone endpoint `/api/memory`; it is called internally by `memory-v2.mjs`. The standalone v1 endpoint is a REFACTOR target (per Duplication Report §1.2 Family G). |
| **Future Relevance** | **KEEP** `memory-v2.mjs` as primary surface; demote `memory-intel.mjs` to internal library |

**Note:** :3334 has a separate Qdrant semantic memory engine (`tools/central-intelligence/memory-engine/`) that provides vector-search recall across 8 collections (architecture/runbooks/incidents/security/deployments/knowledge/merchants/themes). This requires Qdrant + OpenAI API key — both uninstalled. This :3334 capability is ARCHIVED with :3334 per Duplication Report §6. Semantic memory is a future second-order improvement after live Supabase adapter is wired.

---

### Category D: Observability / Runtime (Capabilities 19, 20, 21, 22)

#### Capability 19 — Runtime / Observability Topology

| Field | Value |
|-------|-------|
| **Name** | Runtime & Observability Topology — Workers / Queues / Crons / Telemetry Emission Points |
| **Location** | `tools/graph-server/runtime-intel.mjs`, `tools/graph-server/runtime-observability-intel.mjs`, `tools/graph-server/telemetry-intelligence.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Declares Worker/Queue/Cron/R2/Cache topology from `wrangler.toml`; maps 12 telemetry adapter sources + per-source metric mappings; constructs full `Worker→Queue→Cron→RPC→Table→Merchant→Customer→Deployment→Domain` chain with 10 metric sources. Structural topology only — live metric values are NOT CONNECTED. |
| **Dependencies** | Filesystem only — 4× `wrangler.toml`, `domain-intel.json`, `db-intel.json`, `infra-intel.json`, `deployment-state.json`; optional `runtime-metrics.json` snapshot |
| **Maturity** | REAL — 100% functional for topology; NOT CONNECTED for live values |
| **Production Readiness** | YES (structural layer) |
| **Current Issues** | Three modules serve overlapping concerns; Duplication Report does not prescribe merging these (distinct answer shapes); naming is clear enough. |
| **Future Relevance** | **KEEP** all three (distinct scopes: bare topology / full chain / telemetry adapter map) |

#### Capability 20 — Deployment Intelligence

| Field | Value |
|-------|-------|
| **Name** | Deployment Intelligence — GitHub Actions / Workers / Vercel / Migrations / Secrets / Deploy State |
| **Location** | `tools/graph-server/deployment-intel.mjs`, `tools/graph-server/deployment-state.mjs`, `tools/graph-server/deployment-intelligence-v5.mjs` (DARK — not wired in server.mjs) |
| **Runtime** | :3333 |
| **Purpose** | Maps GitHub Actions → Worker/Vercel/migration/queue/secret/subdomain deployments. Declares HEAD commit + latest migration + configured targets via git. SPOF detection + missing-rollback + secret-dependency analysis. |
| **Dependencies** | Filesystem + git (`execSync`) |
| **Maturity** | REAL — `deployment-intel.mjs` and `deployment-state.mjs` fully wired; `deployment-intelligence-v5.mjs` artifact built by `graph:v5` but NOT wired in `server.mjs` (inventory-graph-server.md §2) |
| **Production Readiness** | Partial — SPOF analysis endpoint is dark (unwired) |
| **Current Issues** | `deployment-intelligence-v5.mjs` endpoint `/api/deployment-intelligence-v5` is not wired in `server.mjs`. Duplication Report §2.2 classifies as WIRE target (trivial 2-line addition). |
| **Future Relevance** | **KEEP** all three; WIRE the dark endpoint |

#### Capability 21 — Live Adapters (Credential Probe)

| Field | Value |
|-------|-------|
| **Name** | Live Adapters — 7 Provider Credential Probes (Supabase / Cloudflare / Vercel / GitHub / Resend / Razorpay / Turnstile) |
| **Location** | `tools/graph-server/live-adapters.mjs`, `tools/graph-server/connections-intel.mjs`, `tools/graph-server/federation-intel.mjs`, `tools/graph-server/live-health-intel.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Real read-only HTTP probe to provider API when credentials present; returns NOT CONNECTED + exact env var when absent. Merges 7 provider graphs with repository topology. Per-domain health records. 13 connection sources tracked. |
| **Dependencies** | `process.env` (presence only, never values); `infra-intel.json`, `environment-registry.json` |
| **Maturity** | REAL — probe logic verified (inventory-graph-server.md §4A). 0 of 7 connected in dev. |
| **Production Readiness** | YES (structural); 0 live connections in current environment |
| **Current Issues** | Turnstile has no pull-metrics API; credential presence = configured (documented). `connections-intel.mjs` reports 13 NOT CONNECTED in dev. |
| **Future Relevance** | **KEEP** — honesty contract is a design strength |

#### Capability 22 — Detection / Prediction (INFINITY Layer)

| Field | Value |
|-------|-------|
| **Name** | Detection & Prediction — 8 Autonomous Detectors + 6 Predictors + What-Will-Fail-Next |
| **Location** | `tools/graph-server/detection-prediction-intel.mjs` |
| **Runtime** | :3333 |
| **Purpose** | INFINITY layer: 8 structural detectors (checkout/payment/refund/worker/queue/db/webhook/deploy — each binding a live signal to a structural risk). 6 predictors + ranked what-will-fail-next. 11-metric ingestion map. Incident timeline per domain. Structural-only — NOT CONNECTED to live signals. |
| **Dependencies** | `domain-intel.json`, `db-intel.json`, `infra-intel.json`, `launch-command-center.json` |
| **Maturity** | REAL — structural risk topology connected; live signals NOT CONNECTED |
| **Production Readiness** | YES (structural layer) |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** |

---

### Category E: Security (Capabilities 8, 24)

#### Capability 8 — Security Intelligence

| Field | Value |
|-------|-------|
| **Name** | Security Intelligence — Identity / JWT / OAuth / Webhook / Tenant / RLS / Attack Surface / Trust Boundaries |
| **Location** | `tools/graph-server/security-intel.mjs` (v3), `tools/graph-server/security-intelligence-v5.mjs` (v5 — extends v3 with trust-boundary + cross-tenant path candidates + privilege-escalation surface) |
| **Runtime** | :3333 |
| **Purpose** | Constructs security graph from db-intel + infra-intel + domain-intel. v5 adds trust boundaries, privilege-escalation surface, and hotspot analysis. |
| **Dependencies** | `db-intel.json`, `infra-intel.json`, `domain-intel.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | Two endpoints (`/api/security`, `/api/security-intelligence`) for the same capability. Duplication Report §11 proposes merging to a single `/api/security-v5` (REFACTOR, low priority). |
| **Future Relevance** | **KEEP** both modules; REFACTOR endpoint surface when convenient |

#### Capability 24 — Audit (Route / RLS Coverage)

| Field | Value |
|-------|-------|
| **Name** | Audit — Missing Auth / Rate-Limit / Validation on Routes; RLS Coverage |
| **Location** | `tools/graph-server/audit-engine-v2.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Scans actual route files for missing `auth`, `rate-limit`, `validation` middleware. Pulls RLS coverage from `db-intel`. Exposes `/api/audit`. |
| **Dependencies** | `services/api-gateway/src/routes/**/*.ts` (filesystem scan), `db-intel.json`, `domain-intel.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found. Findings are candidates; the 107 deterministic validators remain authoritative. |
| **Future Relevance** | **KEEP** |

---

### Category F: Reasoning / Correlation / Investigation (Capabilities 14, 15, 30)

#### Capability 14 — Incident Tracing / Control

| Field | Value |
|-------|-------|
| **Name** | Incident Intelligence — Root Cause / Blast Radius / Rollback / Control Center |
| **Location** | Primary: `tools/graph-server/incident-control-intel.mjs` (Genesis — composes v3/v4/v5); internal libraries: `tools/graph-server/incident-intel.mjs` (v3), `tools/graph-server/incident-response.mjs` (v4), `tools/graph-server/incident-intelligence-v5.mjs` (v5) |
| **Runtime** | :3333 |
| **Purpose** | Full incident answer: target → domain → Route→RPC→Table→Queue→Worker chain + rollback path + deployment info + runbook + diagnosis. |
| **Dependencies** | `domain-intel.json`, `db-intel.json`, `infra-intel.json`, `deployment-state.json`; calls `diagnosis-engine` and `runbook-engine` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | v3 (`/api/incident`) and v4 (`/api/incident-response`) endpoints are ARCHIVE targets; v5 (`/api/incident-intelligence`) is a MERGE target (already used as library). Three lower-level endpoints should be retired. Per Duplication Report §1.2 Family F. |
| **Future Relevance** | **KEEP** `incident-control-intel.mjs` as primary; ARCHIVE three intermediate endpoints |

#### Capability 15 — Root Cause / Diagnosis

| Field | Value |
|-------|-------|
| **Name** | Diagnosis Engine — Root Cause from Failure Signal |
| **Location** | `tools/graph-server/diagnosis-engine.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Given a failure signal, derives affected domains/merchants/customers/revenue with confidence 0–100. Exposes `/api/diagnose`, `/api/root-cause`. |
| **Dependencies** | `domain-intel.json`, `fix-engine.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | Revenue/customer magnitude fields are query-bound (NOT CONNECTED) |
| **Future Relevance** | **KEEP** |

#### Capability 30 — Verification of Conclusions

| Field | Value |
|-------|-------|
| **Name** | Verification Engine — Refuses to Rubber-Stamp; VERIFIED / PARTIAL / UNVERIFIED / REFUTED |
| **Location** | `tools/central-intelligence/verification-engine/VerificationEngine.mjs`, `EvidenceVerifier.mjs`, `ConfidenceCalculator.mjs`, `VerificationLedger.mjs` |
| **Runtime** | :3334 (migrate to :3333 per Duplication Report §9) |
| **Purpose** | Evaluates a conclusion against evidence sources. Requires ≥2 independent corroborating sources at ≥0.60 confidence for VERIFIED. Writes to `VerificationLedger` (filesystem). Distinct from :3333's `diagnosis-engine` which explains failure; this engine validates truth claims. |
| **Dependencies** | V1 HTTP (optional), Qdrant (optional for richer evidence), filesystem for ledger |
| **Maturity** | REAL — verdict derivation works; confidence lower without live sources |
| **Production Readiness** | Partial — `VERIFIED` rarely achievable without V1 + Qdrant both running |
| **Current Issues** | No tests; part of :3334 which is ARCHIVED as standalone |
| **Future Relevance** | **MIGRATE to :3333** (per Duplication Report §9 capability #30) |

---

### Category G: Decision / Recommendation / Fix (Capabilities 16, 17, 18)

#### Capability 16 — Runbooks

| Field | Value |
|-------|-------|
| **Name** | Runbooks — Autonomous Detection / Diagnosis / Recovery / Rollback / Verification / Escalation per Domain |
| **Location** | `tools/graph-server/runbook-engine.mjs`; output: `graphify-out/runbooks.json` |
| **Runtime** | :3333 |
| **Purpose** | Generates structural runbooks per domain. Each runbook has Detection, Diagnosis, Recovery, Rollback, Verification, and Escalation steps. Exposes `/api/runbook`. |
| **Dependencies** | `explain-intel` chain |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** |

#### Capability 17 — Production Readiness

| Field | Value |
|-------|-------|
| **Name** | Production Readiness — 18-System Detail + 10-Dimension Executive Rollup |
| **Location** | `tools/graph-server/production-readiness-intel.mjs` (18-system detail), `tools/graph-server/production-readiness-v2.mjs` (10-dimension executive rollup), `tools/graph-server/production-health.mjs` (GREEN/YELLOW/RED) |
| **Runtime** | :3333 |
| **Purpose** | Scores 18 systems 0–100 from repository evidence. Rolls up into 10 program dimensions. Produces GREEN/YELLOW/RED per system with evidence. RED on open critical blocker. |
| **Dependencies** | `domain-intel.json`, `db-intel.json`, `infra-intel.json`, `execution-intel.json`, `connections-intel.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | Not duplicates — they are a detail/summary pair. Both endpoints serve distinct real needs. |
| **Future Relevance** | **KEEP** all three |

#### Capability 18 — Decision / Fix Priorities

| Field | Value |
|-------|-------|
| **Name** | Decision Engine — What to Fix Next / Highest Risk / Blocks Launch / Scale Tiers |
| **Location** | Primary: `tools/graph-server/decision-engine-v2.mjs` (Omega — adds 1k/10k/100k scale tiers); internal library: `tools/graph-server/decision-engine-v5.mjs` (base rankings). Also: `tools/graph-server/fix-engine.mjs` (generates FIX/VERIFY/TEST/ROLLBACK plans, never applies them). |
| **Runtime** | :3333 |
| **Purpose** | Ranks what to fix next from V1 blocker report + security + merchant/revenue signals. `fix-engine.mjs` generates structured fix plans per issue. |
| **Dependencies** | `execution-intel.json`, `revenue-intelligence.json`, `security-intelligence-v5.json`, `merchant-intelligence.json`, `production-readiness-v2.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | `decision-engine-v5.mjs` exposes redundant `/api/decision-engine` endpoint; `graph:ai-ops` calls `decision-engine-v2.mjs` (the Omega variant). v5 standalone endpoint is a REFACTOR target (per Duplication Report §1.2 Family D). |
| **Future Relevance** | **KEEP** `decision-engine-v2.mjs` as primary; demote v5 endpoint; KEEP `fix-engine.mjs` |

---

### Category H: Detection / Prediction (Capabilities 22 — see Category D; and :3334 engines below)

*Capability 22 (structural detection/prediction) is documented under Category D. The :3334 `prediction-engine/` and `:3334 autonomous-operations/` are ARCHIVED with :3334 — they require V1 HTTP and produce lower-confidence outputs than :3333's structural stack.*

---

### Category I: Agents (`.claude/commands` — 14 slash-command agents)

#### Capability (unnumbered in 32-set, but explicitly in Duplication Report §7)

| Field | Value |
|-------|-------|
| **Name** | Domain Audit Agents — 14 Slash-Command Agents |
| **Location** | `.claude/commands/agent-architecture.md`, `agent-checkout.md`, `agent-compliance.md`, `agent-developer.md`, `agent-identity.md`, `agent-infrastructure.md`, `agent-marketplace.md`, `agent-operations.md`, `agent-payment.md`, `agent-production.md`, `agent-release.md`, `agent-security.md`, `agent-tenant.md`, `agent-theme.md` |
| **Runtime** | Claude Code CLI (not HTTP) |
| **Purpose** | Per-domain audit workflows: each agent queries LCIS + inspects code + reports. Coverage: security, architecture, payment, tenant, identity, checkout, marketplace, theme, developer, release, infrastructure, compliance, operations, production. |
| **Dependencies** | Claude Code CLI; queries :3333 via curl or `graph:intel` commands |
| **Maturity** | REAL — prompt files; always functional |
| **Production Readiness** | YES — the primary working agent surface |
| **Current Issues** | :3334 has 8 HTTP agents (`tools/central-intelligence/agents/`) that cover overlapping domain concerns — those are ARCHIVED with :3334 (Duplication Report §7) |
| **Future Relevance** | **KEEP ALL** — these are the only real agent surface |

---

### Category J: Execution / Verification / SafetyGuard (Capabilities 29, 30)

#### Capability 29 — Execution Safety (SafetyGuard)

| Field | Value |
|-------|-------|
| **Name** | Execution Engine + SafetyGuard — Read-Only Enforcement + SHA-256 Audit Chain |
| **Location** | `tools/central-intelligence/execution-engine/ExecutionEngine.mjs`, `SafetyGuard.mjs`, `ExecutionAuditor.mjs`, `ActionRegistry.mjs` |
| **Runtime** | :3334 (migrate to :3333 per Duplication Report §9) |
| **Purpose** | Default-deny execution gate. 28-verb ban list (deploy/write/insert/update/delete/pay/refund/push/merge/…). 10-action whitelist (all `readOnly: true`). Parameter value scan. SHA-256 hash-chain audit log to `graphify-out/execution-audit/audit.jsonl`. No environment variable bypass. |
| **Dependencies** | Read-only sub-engines; filesystem for audit log |
| **Maturity** | REAL — SafetyGuard is stateless and fully functional; audit log writes to filesystem |
| **Production Readiness** | YES — no external services required |
| **Current Issues** | Part of :3334 which is ARCHIVED as standalone; no tests; `"create"` verb in ban list could reject future valid read-only action names if not carefully named (inventory-central-intelligence.md §5 risk note) |
| **Future Relevance** | **MIGRATE to :3333** (per Duplication Report §9 capability #29) |

*(Capability 30 — Verification Engine — documented under Category F above.)*

---

### Category K: Browser Intelligence (Capability 31)

#### Capability 31 — Browser Validation (Playwright)

| Field | Value |
|-------|-------|
| **Name** | Browser Intelligence — Store / Checkout / Theme Validation via Playwright |
| **Location** | `tools/central-intelligence/browser-intelligence/BrowserIntelligenceEngine.mjs`; agents: `CheckoutAgent.mjs`, `ThemeAgent.mjs`, `StoreAgent.mjs`, `MonitoringAgent.mjs`; validators: `EvidenceCollector.mjs`, `SEOValidator.mjs` |
| **Runtime** | :3334 (migrate as optional module to :3333 per Duplication Report §9) |
| **Purpose** | Validates live storefronts, checkout flows, and themes via headless Chromium. CheckoutAgent explicitly never executes real payments. SEO and evidence collection. Unique capability with no :3333 equivalent. |
| **Dependencies** | `playwright ^1.45.0` npm package (two-stage try/catch fallback) |
| **Maturity** | REAL logic with proper degradation — returns `{ status: 'NOT AVAILABLE', reason: 'playwright not installed' }` when absent |
| **Production Readiness** | NOT AVAILABLE — Playwright not installed in current environment |
| **Current Issues** | Part of :3334 which is ARCHIVED as standalone; Playwright not installed |
| **Future Relevance** | **MIGRATE to :3333 as optional module** (per Duplication Report §9 capability #31) |

---

### Category L: Self-Model (Capability — within :3334)

#### Capability (part of :3334 V2 layer, preserved)

| Field | Value |
|-------|-------|
| **Name** | Self Model / Platform Explainer — How LCIS Works, Topology Self-Description |
| **Location** | `tools/central-intelligence/self-model/PlatformExplainer.mjs`, `SelfModelBuilder.mjs`, `SelfDiagnostics.mjs` |
| **Runtime** | :3334 |
| **Purpose** | Explains LCIS's own topology, service interactions, deployment propagation, failure propagation, incident emergence. Has hardcoded accurate structural descriptions as fallbacks. |
| **Dependencies** | Filesystem (`graphify-out/self-model/*.json`); V1 HTTP (optional) |
| **Maturity** | REAL — `explainPlatform()` returns real descriptions even with no artifacts (hardcoded fallback) |
| **Production Readiness** | Partial — hardcoded fallbacks could drift from actual topology over time |
| **Current Issues** | Part of :3334 which is ARCHIVED as standalone; capability partially overlaps with :3333's `explain-intel.mjs` |
| **Future Relevance** | **ARCHIVE with :3334** — :3333's `explain-intel.mjs` covers the per-domain human/AI explanation need; self-model is a lower priority |

---

### Category M: Dashboards / Command Centers (Capabilities 25, 26 partial)

#### Capability 25 — Control Centers

| Field | Value |
|-------|-------|
| **Name** | Control Centers — Launch / Incident / Commerce / Infrastructure / Database / Environment |
| **Location** | `tools/graph-server/launch-command-center.mjs`, `tools/graph-server/incident-control-intel.mjs`, `tools/graph-server/commerce-control-intel.mjs`, `tools/graph-server/infrastructure-control-intel.mjs`, `tools/graph-server/database-control-intel.mjs`, `tools/graph-server/environment-control-intel.mjs`. Also: `tools/graph-server/mission-control-dashboard.mjs` (8-tile executive dashboard), `tools/graph-server/operations-center.mjs`, `tools/graph-server/unified-intelligence-engine.mjs` |
| **Runtime** | :3333 |
| **Purpose** | Founder GO/NO-GO (10 dimensions + verdict from V1 blocker report). Incident Control (diagnosis + runbook + v5 composition). Commerce Control (14 domains + 6 journeys). Infrastructure Control (6 graphs). Database Control (bidirectional lineage). Environment Control (activation steps per provider). Mission Control (8-tile executive view). |
| **Dependencies** | Multiple graphify-out artifacts; composition of other capabilities |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | :3334 has an operator dashboard at :3335 that duplicates some of this surface — ARCHIVED with :3334 |
| **Future Relevance** | **KEEP** all 9 modules |

#### LCIS SPA (the primary dashboard)

| Field | Value |
|-------|-------|
| **Name** | LCIS SPA — `tools/graph-server/index.html` |
| **Location** | `tools/graph-server/index.html` served by `server.mjs` SPA fallback |
| **Runtime** | :3333 |
| **Purpose** | Single-page app with 9+ tab panels: Domain Explorer, Atlas (52k-node galaxy), Business Intelligence, Launch Command Center, AI Operations Center, Mission Control, Live Operations Center. URL deep-linking (V10). |
| **Dependencies** | All :3333 API endpoints |
| **Maturity** | REAL — primary developer-facing UI |
| **Production Readiness** | YES (local-dev only) |
| **Current Issues** | :3335 operator dashboard proxies :3334 and is ARCHIVED |
| **Future Relevance** | **KEEP** |

---

### Category N: APIs / Query Surfaces (Capabilities 23, remainder)

#### Capability 23 — Explain Mode + Semantic Search (Human / AI Readable)

| Field | Value |
|-------|-------|
| **Name** | Explain Mode — Per-Domain Purpose / Criticality / Owner / Dependencies / Failure / AI Context; Search V2 |
| **Location** | `tools/graph-server/explain-intel.mjs`, `tools/graph-server/search-intel.mjs` |
| **Runtime** | :3333 |
| **Purpose** | LCIS v6 Explain mode: per-domain Purpose/Criticality/Owner/Dependencies/Failure-impact/aiContext for all 22 domains. Intent-aware semantic search with 40+ NL aliases and 7 intent types. 16-perspective workspace per domain. |
| **Dependencies** | `domain-intel.json`, `db-intel.json`, `infra-intel.json`, `production-readiness-v2.json`, `execution-intel.json`, `relationship-intel.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | None found |
| **Future Relevance** | **KEEP** both |

#### Capability 26 — Knowledge Graphs (7 Sub-Graphs) + Ecosystem

| Field | Value |
|-------|-------|
| **Name** | Knowledge Graphs — Business / Journey / Security / Ownership / Infrastructure / Revenue / AI Sub-Graphs |
| **Location** | `tools/graph-server/knowledge-graphs.mjs`; output: `graphify-out/knowledge-graphs.json`. Also: `tools/graph-server/ecosystem-intel.mjs` (Theme + App Marketplace + Developer Platform intelligence — all FROZEN) |
| **Runtime** | :3333 |
| **Purpose** | 7 typed sub-graphs for different query personas. Ecosystem intel for the three frozen platform surfaces. |
| **Dependencies** | `domain-intel.json`, `infra-intel.json`, `db-intel.json`, `unified-intelligence.json` |
| **Maturity** | REAL — 100% functional |
| **Production Readiness** | YES |
| **Current Issues** | Ecosystem surfaces (theme-marketplace, app-marketplace, developer-portal) are FROZEN — intel reflects frozen state |
| **Future Relevance** | **KEEP** both |

#### Capability 7 — Custom-Domain Feature Intelligence (DARK — currently unwired)

| Field | Value |
|-------|-------|
| **Name** | Custom-Domain Feature Intelligence — Domain Provider Detection / CNAME Health / NS-Based Routing |
| **Location** | `tools/graph-server/domain-intelligence.mjs` |
| **Runtime** | :3333 — but NOT wired in `server.mjs` (dark endpoint) |
| **Purpose** | Checks actual source files for custom-domain feature implementation: `migrations/185_v1_site_domains.sql`, `services/api-gateway/src/routes/custom-domains.ts`, `src/lib/domain-provider.ts`, `src/lib/custom-domain-health.ts`, `apps/storefront-runtime/src/proxy.ts`. Orthogonal to `domain-intel.mjs` (business domains). |
| **Dependencies** | Filesystem — specific source files |
| **Maturity** | REAL — but unwired; `grep "domain-intelligence" tools/graph-server/server.mjs` = 0 (inventory-graph-server.md §2) |
| **Production Readiness** | NOT ACCESSIBLE — dark endpoint |
| **Current Issues** | Confusingly named vs `domain-intel.mjs` (naming collision). Endpoint `/api/domain-intelligence` is unwired. |
| **Future Relevance** | **REFACTOR** — rename to `custom-domain-feature-intel.mjs`; wire as `/api/custom-domain-intelligence` (per Duplication Report §1.2 Family A, Tier 3) |

#### Capabilities 9, 10, 11, 12 — Commerce Intelligence Layer

| Capability | Name | Location | Runtime | Maturity | Future |
|---|---|---|---|---|---|
| **9** | Payment Intelligence — 9 Money Sub-Flows (COD/Razorpay/Refunds/Payouts/GiftCards/GST/Settlement/Commission/Ledger) | `tools/graph-server/payment-intel.mjs` | :3333 | REAL | KEEP |
| **10** | Merchant Intelligence — Lifecycle (v3 14-stage) + Operating Model (v5 + Founding Merchant Program + 5 structural detectors) + Health + Growth + Adoption + Risk + Churn | `merchant-intel.mjs` (v3), `merchant-intelligence.mjs` (v5), `merchant-operating-graph.mjs` (v4 — MERGE), `merchant-health-intel.mjs`, `merchant-growth-intel.mjs`, `merchant-adoption-intel.mjs`, `merchant-risk-intel.mjs`, `merchant-churn-intel.mjs` | :3333 | REAL — scores query-bound | KEEP 7; MERGE `merchant-operating-graph.mjs` into v5 |
| **11** | Revenue Intelligence — Anomaly/Leak Detection (v5) + 8-Model Comprehensive Revenue (Omega) | `revenue-intelligence.mjs` (anomaly), `revenue-intelligence-v2.mjs` (8 models) | :3333 | REAL — amounts query-bound | KEEP both; low-priority rename to clarify inverted versioning |
| **12** | Customer Intelligence — 8 Graphs (Funnel/Conversion/Refund/Retention/Risk/Journey/Abandonment/Loyalty) + 8-Stage Journey | `customer-intelligence-v2.mjs`, `customer-journey-intelligence.mjs` | :3333 | REAL — rates query-bound | KEEP both |

#### Capability 28 — Architecture Intelligence (Filesystem, No External Deps)

| Field | Value |
|-------|-------|
| **Name** | Architecture Intelligence — Drift Detection / Layer Discovery / Service Discovery / Dependency Discovery |
| **Location** | `tools/central-intelligence/architecture-intelligence/ArchitectureIntelligenceEngine.mjs`, `ArchitectureDriftDetector.mjs`, `ArchitectureSnapshotService.mjs`, `DependencyDiscovery.mjs`, `DomainDiscovery.mjs`, `LayerDiscovery.mjs`, `ServiceDiscovery.mjs` |
| **Runtime** | :3334 (migrate to :3333 per Duplication Report §9) |
| **Purpose** | Pure filesystem analysis of `package.json` files + `graphify-out/` artefacts. Architecture model, drift detection between snapshots, risk analysis, dependency graph. No :3333 equivalent. |
| **Dependencies** | Filesystem only — zero external services |
| **Maturity** | REAL — fully functional at cold start; "highest-quality, most self-contained subsystem" (inventory-central-intelligence.md §8 finding #9) |
| **Production Readiness** | YES — zero external services required |
| **Current Issues** | Health score penalties hard-coded against canonical runtime list (could drift); drift detection requires at least one prior snapshot. Part of :3334 which is ARCHIVED as standalone. |
| **Future Relevance** | **MIGRATE to :3333** (per Duplication Report §9 capability #28) |

---

## 3. The 202 → 32 Mapping Table

Full mapping of current modules to consolidated capabilities. Source: LCIS_DUPLICATION_REPORT.md §9 + inventory-graph-server.md §1 + inventory-central-intelligence.md §4.

| Cap # | Consolidated Capability | :3333 modules that map here | :3334 subsystems / files that map here | Verdict |
|---|---|---|---|---|
| 1 | Code Graph | (external Graphify binary) | — | KEEP |
| 2 | DB Intelligence | `db-intel.mjs` | — | KEEP |
| 3 | Infrastructure Intelligence | `infra-intel.mjs` | — | KEEP |
| 4 | Domain Classification | `domain-intel.mjs`, `cross-domain-engine.mjs` | — | KEEP |
| 5 | FK Relationship Graph | `relationship-intel.mjs` | — | KEEP |
| 6 | Graph Traversal / Blast Radius | `intelligence.mjs`, `omega-lib.mjs` | — | KEEP |
| 7 | Custom-Domain Feature Intel | `domain-intelligence.mjs` (DARK) | — | REFACTOR (rename + wire) |
| 8 | Security Intelligence | `security-intel.mjs`, `security-intelligence-v5.mjs` | — | KEEP (consolidate endpoints) |
| 9 | Payment Intelligence | `payment-intel.mjs` | — | KEEP |
| 10 | Merchant Intelligence | `merchant-intel.mjs`, `merchant-intelligence.mjs`, `merchant-operating-graph.mjs` (MERGE), `merchant-health-intel.mjs`, `merchant-growth-intel.mjs`, `merchant-adoption-intel.mjs`, `merchant-risk-intel.mjs`, `merchant-churn-intel.mjs` | — | KEEP 7; MERGE 1 |
| 11 | Revenue Intelligence | `revenue-intelligence.mjs`, `revenue-intelligence-v2.mjs` | — | KEEP both (rename low-priority) |
| 12 | Customer Intelligence | `customer-intelligence-v2.mjs`, `customer-journey-intelligence.mjs` | — | KEEP both |
| 13 | Memory / Governance Knowledge | `memory-v2.mjs` (primary), `memory-intel.mjs` (demote to library) | `memory-engine/` (5 files) → ARCHIVE | KEEP :3333 stack; ARCHIVE :3334 Qdrant memory |
| 14 | Incident Tracing / Control | `incident-control-intel.mjs` (primary), `incident-intel.mjs` (library), `incident-response.mjs` (library), `incident-intelligence-v5.mjs` (library) | `investigation-engine/` (4 files) → ARCHIVE as standalone | ARCHIVE 3 standalone endpoints; KEEP incident-control |
| 15 | Root Cause / Diagnosis | `diagnosis-engine.mjs` | — | KEEP |
| 16 | Runbooks | `runbook-engine.mjs` | — | KEEP |
| 17 | Production Readiness | `production-readiness-intel.mjs`, `production-readiness-v2.mjs`, `production-health.mjs` | — | KEEP all 3 |
| 18 | Decision / Fix | `decision-engine-v2.mjs` (primary), `decision-engine-v5.mjs` (library), `fix-engine.mjs` | `recommendation-engine/` (3 files) → ARCHIVE | KEEP :3333; ARCHIVE :3334 |
| 19 | Runtime / Observability Topology | `runtime-intel.mjs`, `runtime-observability-intel.mjs`, `telemetry-intelligence.mjs` | `observability/` (9 files) → ARCHIVE | KEEP :3333; ARCHIVE :3334 OTel stack |
| 20 | Deployment Intelligence | `deployment-intel.mjs`, `deployment-state.mjs`, `deployment-intelligence-v5.mjs` (DARK — WIRE) | — | KEEP; WIRE dark endpoint |
| 21 | Live Adapters | `live-adapters.mjs`, `connections-intel.mjs`, `federation-intel.mjs`, `live-health-intel.mjs` | — | KEEP |
| 22 | Detection / Prediction | `detection-prediction-intel.mjs` | `prediction-engine/` (5 files) → ARCHIVE | KEEP :3333; ARCHIVE :3334 |
| 23 | Explain Mode + Search | `explain-intel.mjs`, `search-intel.mjs` | — | KEEP |
| 24 | Audit | `audit-engine-v2.mjs` | — | KEEP |
| 25 | Control Centers | `launch-command-center.mjs`, `commerce-control-intel.mjs`, `infrastructure-control-intel.mjs`, `database-control-intel.mjs`, `environment-control-intel.mjs`, `mission-control-dashboard.mjs`, `operations-center.mjs`, `unified-intelligence-engine.mjs`, `business-flow-intel.mjs` | `operator-platform/` (2 files) → ARCHIVE | KEEP :3333; ARCHIVE :3334 |
| 26 | Knowledge Graphs + Ecosystem | `knowledge-graphs.mjs`, `ecosystem-intel.mjs` | — | KEEP |
| 27 | AI Context Packs | `ai-context-intel.mjs` | — | KEEP |
| 28 | Architecture Intelligence | — | `architecture-intelligence/` (7 files) | MIGRATE to :3333 |
| 29 | Execution Safety (SafetyGuard) | — | `execution-engine/` (4 files) | MIGRATE to :3333 |
| 30 | Verification | — | `verification-engine/` (4 files) | MIGRATE to :3333 |
| 31 | Browser Validation | — | `browser-intelligence/` (7 files) | MIGRATE to :3333 as optional module |
| 32 | Context Compression | — | `context-intelligence/` (9 files) | MIGRATE to :3333 |
| — | Slash-command Agents | — (`.claude/commands/agent-*.md`, 14 files) | `agents/` (8 files) → ARCHIVE | KEEP 14 .md agents; ARCHIVE :3334 HTTP agents |
| — | Report Generators | `gen-reports.mjs`, `gen-v3-reports.mjs`, `gen-v4-reports.mjs`, `gen-v5-reports.mjs`, `gen-omega-reports.mjs`, `gen-explain-docs.mjs` | — | KEEP all |
| — | CLI Utilities | `graph-stats.mjs`, `validate-graph.mjs`, `refresh-graph.mjs` | — | KEEP all |
| — | :3334 V3 executive/orchestration/operating-loop | — | `executive-intelligence/` (6), `goal-engine/` (4), `orchestration-engine/` (3), `operating-loop/` (3), `daily-intelligence/` (5), `self-model/` (3), `skills/` (0), `intelligence-api/` (3) | ARCHIVE all with :3334 |
| — | :3334 Knowledge/Graph/Reasoning/Correlation/Autonomous-Ops | — | `knowledge-engine/` (8), `graph-engine/` (5), `reasoning/` (7), `correlation/` (5), `autonomous-operations/` (7) | ARCHIVE all with :3334 |
| REMOVE | `discovery-engine.mjs` | `discovery-engine.mjs` (CLI, unwired, superseded) | — | REMOVE |

**Modules mapping to single surviving capability by category:**

- `discovery-v2.mjs` → cap 4 (domain/discovery) / KEEP
- `deployment-intelligence-v5.mjs` → cap 20 / WIRE
- `environment-intel.mjs`, `environment-registry.mjs` → cap 21 (live/environment) / KEEP
- `execution-intel.mjs` → cap 17/18 (execution state → readiness/decision inputs) / KEEP
- `autonomous-discovery-v5.mjs` → internal library of `discovery-v2.mjs` / KEEP (library)

---

## 4. "Works with Zero External Services" Reality

| Layer | Condition | Endpoints returning real/useful data | Evidence |
|-------|-----------|-------------------------------------|----------|
| **:3333 (graph-server)** | Cold start, zero external services, no credentials | **118 of 118 (100%)** — all 81 modules are REAL; all endpoints return structural intelligence from `graphify-out/*.json` | inventory-graph-server.md §6: "Modules classified REAL: 81 (100%)" |
| **:3334 (central-intelligence)** | Cold start, zero external services, no V1, no Docker, no Python | **~22 of 68 (~32%)** — architecture intelligence, self-model, context (if graphify-out/ populated), execution/audit, loop state, static registries | inventory-central-intelligence.md §6 |
| **:3334 with V1 running** | :3333 up + graphify-out/ populated, no Qdrant/OTel/Playwright/GraphRAG | **~45 of 68 (~66%)** | inventory-central-intelligence.md §6 |
| **:3334 with V1 + Qdrant + OpenAI** | No OTel/Playwright/GraphRAG | **~55 of 68 (~81%)** | inventory-central-intelligence.md §6 |
| **:3334 fully connected** | All services (V1 + Qdrant + OpenAI + OTel + Playwright + GraphRAG + Python) | **~63 of 68 (~93%)** — 5 endpoints permanently NOT CONNECTED by honest design (revenue/merchant funnel rates) | inventory-central-intelligence.md §6 |

**The key asymmetry:** :3333 derives 100% of its intelligence from static repository artifacts (code graph, SQL migrations, TOML files, governance docs, git). :3334's novel value requires 6 external services (Qdrant, OpenAI, GraphRAG Python, Crawl4AI Python, Playwright, OTel) — none of which are installed or running in the current environment.

**NOT CONNECTED is enforced honestly across both runtimes:**
- :3333: 7 live provider adapters return NOT CONNECTED (dev env); 13 connection sources all NOT CONNECTED; revenue/customer amounts labelled "LIVE QUERY REQUIRED"
- :3334: all live signal fields permanently labelled NOT CONNECTED with exact env var source

---

## 5. Cross-Reference Index

For per-module detail beyond what is captured here, consult the Phase 2 evidence catalogs:

| Document | Scope | Contents |
|----------|-------|----------|
| `docs/lcis-master/_evidence/inventory-graph-server.md` | :3333 (81 modules, 118 endpoints) | Per-module table (Purpose / Endpoint / Script / Reads / Writes / Maturity); 9 duplicate families flagged; live vs structural breakdown; verified vs unverified dossier claims |
| `docs/lcis-master/_evidence/inventory-central-intelligence.md` | :3334 (121 files, 68 endpoints) | External service requirements matrix; 22 subsystem catalog with "works with zero external services" per subsystem; SafetyGuard deep-dive; functional degradation matrix; production-readiness dimension table |
| `docs/lcis-master/LCIS_DUPLICATION_REPORT.md` | Both runtimes + docs + agents | MERGE/KEEP/REMOVE/REFACTOR/ARCHIVE verdicts; 32-capability target state; safe-removal manifest (Tier 1/2/3); cross-runtime headline verdict; dashboard deduplication; graph system deduplication |
| `docs/lcis-master/LCIS_DOCUMENT_ARCHAEOLOGY.md` | All docs/ subdirectories | Document inventory by era; 67 certification docs; naming collision resolution; "V2" naming disambiguation |
| `docs/lcis-master/LCIS_REPOSITORY_ARCHAEOLOGY.md` | Repository history / topology | When each LCIS generation was introduced; version lineage per family |

---

## 6. Discrepancies Between Evidence Files and Duplication Report

The following discrepancies were found when cross-referencing the three source documents:

| Topic | Inventory Claim | Duplication Report Claim | Resolution |
|-------|-----------------|--------------------------|------------|
| :3334 endpoint count | "68 endpoints registered" (inventory-central-intelligence.md §3) | "68 `/intelligence/*` routes" (Duplication Report §0) | No discrepancy — consistent |
| :3333 endpoint count | "118 `/api/*` routes" (inventory-graph-server.md §0) | "118 `/api/*` routes" (Duplication Report §0) | No discrepancy — consistent |
| `decision-engine-v5.mjs` standalone endpoint verdict | Flags as "REFACTOR — demote to library" (inventory-graph-server.md §3D) | "REFACTOR — remove standalone `/api/decision-engine` endpoint" (Duplication Report §1.2 Family D) | Consistent; Duplication Report is more specific |
| `:3334 investigation-engine` vs :3333 `incident-control` | Not flagged as duplicate in inventory-central-intelligence.md | Duplication Report §9 maps `investigation-engine/` (4 files) to capability #14 as ARCHIVE | Minor gap in inventory-central-intelligence.md; Duplication Report is authoritative |
| `merchant-operating-graph.mjs` verdict | inventory-graph-server.md §3B: "REDUNDANT — subset of merchant-intelligence.mjs" | Duplication Report §1.2 Family B: "MERGE" | Consistent — same outcome |
| 5 novel :3334 capabilities for migration | Named in Duplication Report §1.1 (5 patterns) and §9 (caps #28–32) | inventory-central-intelligence.md §4b lists architecture-intelligence and §4c lists execution/orchestration/investigation/verification | Inventory §4b and §4c are the source evidence; Duplication Report synthesizes the "migrate these 5" verdict — consistent |
| Operating loop EXECUTE stage | inventory-central-intelligence.md §4c: "hardcoded to 2 actions only" | Duplication Report does not call this out separately | Not a discrepancy; Duplication Report archives the operating loop with :3334 broadly |

---

*End of LCIS Capability Inventory*
*Produced 2026-06-20. Discovery-only: no code modified. All capabilities evidence-cited to `docs/lcis-master/_evidence/` source documents.*

# LCIS Repository Structure Analysis
**LetBuyy Central Intelligence System — Complete Directory and File Inventory**
*Date: 2026-06-19 | Source: Repository filesystem scan, package.json, CLAUDE.md*

---

## 1. LCIS-Related Directory Map

```
/Users/saai_sidd/Git/Letbuyy_Store/
├── tools/
│   └── graph-server/              ← LCIS intelligence server (83 .mjs files)
│       ├── server.mjs             ← HTTP server, 90+ endpoints (1101 lines)
│       ├── intelligence.mjs       ← Core graph query engine (142 lines)
│       ├── db-intel.mjs           ← SQL migration parser → db-intel.json
│       ├── infra-intel.mjs        ← Wrangler/CI/CODEOWNERS parser → infra-intel.json
│       ├── domain-intel.mjs       ← 22-domain classifier → domain-intel.json
│       ├── memory-intel.mjs       ← Governance doc parser → memory-intel.json
│       ├── explain-intel.mjs      ← V6 dual-mode explain layer
│       ├── live-adapters.mjs      ← 7 provider adapters (all NOT CONNECTED in dev)
│       ├── detection-prediction-intel.mjs ← INFINITY: 8 detectors, 6 predictors
│       ├── runbook-engine.mjs     ← Per-domain runbooks with escalation
│       ├── launch-command-center.mjs ← GO/NO-GO launch readiness (10 dimensions)
│       ├── knowledge-graphs.mjs   ← 7 typed knowledge sub-graphs
│       ├── unified-intelligence-engine.mjs ← 13-layer brain
│       ├── fix-engine.mjs         ← Ranked fix plans (never auto-applied)
│       ├── diagnosis-engine.mjs   ← Root cause + confidence
│       ├── search-intel.mjs       ← Semantic natural-language search
│       ├── federation-intel.mjs   ← Live federation (LCIS X)
│       ├── live-health-intel.mjs  ← Per-domain live health (LCIS X)
│       ├── business-flow-intel.mjs ← V11: 10 business journeys
│       ├── audit-engine-v2.mjs    ← V7: missing auth/RLS/rate-limit audit
│       ├── connections-intel.mjs  ← Connection registry (CONNECTED/NOT CONNECTED)
│       ├── production-health.mjs  ← G/Y/R structural health
│       ├── mission-control-dashboard.mjs ← Executive dashboard
│       ├── ecosystem-intel.mjs    ← Theme/App/Developer ecosystem (all frozen)
│       ├── environment-registry.mjs ← Credential presence per environment
│       ├── environment-intel.mjs  ← Local/staging/production environment
│       ├── relationship-intel.mjs ← 705 FK relationships
│       ├── knowledge-graphs.mjs   ← 7 knowledge sub-graphs
│       ├── operations-center.mjs  ← Operations hub
│       ├── ai-context-intel.mjs   ← AI packs < 20k tokens
│       ├── database-control-intel.mjs ← Database control center
│       ├── environment-control-intel.mjs ← Environment control center
│       ├── infrastructure-control-intel.mjs ← Infrastructure control center
│       ├── commerce-control-intel.mjs ← Commerce control center
│       ├── incident-control-intel.mjs ← Incident control center
│       ├── gen-reports.mjs        ← Markdown report generation
│       ├── gen-v3-reports.mjs     ← V3 report generation
│       ├── gen-v4-reports.mjs     ← V4 report generation
│       ├── gen-v5-reports.mjs     ← V5 report generation
│       ├── gen-omega-reports.mjs  ← Omega report generation
│       ├── gen-explain-docs.mjs   ← V6 documentation generation
│       ├── refresh-graph.mjs      ← Graph refresh orchestrator
│       ├── cross-domain-engine.mjs ← Domain coupling analysis
│       ├── payment-intel.mjs      ← Payment intelligence
│       ├── security-intel.mjs     ← Security graph
│       ├── deployment-intel.mjs   ← Deployment intelligence
│       ├── incident-intel.mjs     ← Incident intelligence
│       ├── merchant-intel.mjs     ← Merchant lifecycle
│       ├── runtime-intel.mjs      ← V4: runtime topology
│       ├── deployment-state.mjs   ← V4: declared deployment state
│       ├── change-impact.mjs      ← V4: change impact analysis
│       ├── incident-response.mjs  ← V4: incident root cause + rollback
│       ├── merchant-operating-graph.mjs ← V4: multi-tenant merchant graph
│       ├── execution-intel.mjs    ← V4: open blockers + launch verdict
│       ├── runtime-observability-intel.mjs ← V5: runtime observability
│       ├── merchant-intelligence.mjs ← V5: merchant intelligence
│       ├── revenue-intelligence.mjs ← V5: revenue model
│       ├── security-intelligence-v5.mjs ← V5: 11 security controls
│       ├── incident-intelligence-v5.mjs ← V5: per-domain incident intel
│       ├── customer-journey-intelligence.mjs ← V5: 8-stage customer journey
│       ├── production-readiness-intel.mjs ← V5: structural readiness
│       ├── decision-engine-v5.mjs ← V5: ranked decision priorities
│       ├── merchant-health-intel.mjs ← Omega: merchant health
│       ├── merchant-growth-intel.mjs ← Omega: merchant growth
│       ├── merchant-adoption-intel.mjs ← Omega: feature adoption
│       ├── merchant-risk-intel.mjs ← Omega: merchant risk
│       ├── merchant-churn-intel.mjs ← Omega: churn risk
│       ├── customer-intelligence-v2.mjs ← Omega: 8-graph customer intel
│       ├── revenue-intelligence-v2.mjs ← Omega: revenue v2
│       ├── cost-intelligence.mjs  ← Omega: cost model
│       ├── telemetry-intelligence.mjs ← Omega: 12 telemetry adapters
│       ├── memory-v2.mjs          ← Omega: governance decision graph
│       ├── discovery-v2.mjs       ← Omega: autonomous drift detection
│       ├── production-readiness-v2.mjs ← Omega: deep readiness
│       ├── decision-engine-v2.mjs ← Omega: decision engine v2
│       └── index.html             ← SPA shell for Atlas UI
│
├── graphify-out/                  ← Pre-built JSON artifacts (gitignored)
│   ├── graph.json                 ← 44MB; 52,246 nodes, 66,761 edges
│   ├── db-intel.json              ← 414 tables, 156 RPCs, 651 policies
│   ├── infra-intel.json           ← 4 workers, 5 queues, 19 secrets
│   ├── domain-intel.json          ← 22 domains, 49 cross-domain edges
│   ├── memory-intel.json          ← 180 decisions, 103 migrations
│   ├── knowledge-graphs.json      ← 7 typed knowledge sub-graphs
│   ├── unified-intelligence.json  ← 13-layer brain
│   ├── merchant-health.json       ← Merchant health scores
│   ├── merchant-growth.json       ← Merchant growth signals
│   ├── merchant-adoption.json     ← Feature adoption model
│   ├── merchant-risk.json         ← Risk scores
│   ├── merchant-churn.json        ← Churn risk model
│   ├── customer-intelligence-v2.json ← 8-graph customer intel
│   ├── revenue-intelligence-v2.json ← Revenue v2
│   ├── cost-intelligence.json     ← Cost model
│   ├── telemetry-intelligence.json ← 12 telemetry sources
│   ├── fix-engine.json            ← Fix plans
│   ├── discovery-v2.json          ← Drift detection candidates
│   ├── production-readiness-v2.json ← 10-dimension readiness
│   ├── decision-engine-v2.json    ← Ranked decisions
│   ├── connections-intel.json     ← Connection registry
│   ├── environment-registry.json  ← Credential presence
│   ├── audit-engine-v2.json       ← Audit findings
│   ├── GRAPH_REPORT.md            ← Community hub navigation (838KB)
│   ├── manifest.json              ← Graphify file-level cache manifest (821KB)
│   └── cache/                     ← Graphify internal cache
│
├── scripts/
│   ├── validate-governance.mjs    ← 107-validator gate runner
│   ├── generate-repository-intelligence.mjs ← RETIRED (exits 1)
│   └── validators/                ← ~107 deterministic validator .mjs files
│       ├── canonical-ledger-only-validator.mjs
│       ├── rls-force-coverage-validator.mjs
│       ├── no-public-using-true-validator.mjs
│       ├── tenant-isolation-validator.mjs
│       ├── topology-drift-validator.mjs
│       ├── no-scan-generated-agents-validator.mjs
│       ├── repository-intelligence-validator.mjs
│       ├── identity-sole-issuer-validator.mjs
│       ├── canonical-ledger-only-validator.mjs
│       └── ... (103 more)
│
├── docs/
│   ├── central-intelligence/      ← 40+ certification and report files
│   │   ├── README.md              ← LCIS overview + stats
│   │   ├── UNIFIED_KNOWLEDGE_MODEL.md ← 4-layer joined model diagram
│   │   ├── LETBUYY_CENTRAL_INTELLIGENCE_CERTIFICATION.md
│   │   ├── LCIS_V2_CERTIFICATION.md
│   │   ├── LCIS_V3_CERTIFICATION.md
│   │   ├── LCIS_V4_CERTIFICATION.md
│   │   ├── LCIS_V5_CERTIFICATION.md
│   │   ├── LCIS_OMEGA_CERTIFICATION.md
│   │   ├── LCIS_V6_CERTIFICATION.md
│   │   ├── LCIS_INFINITY_CERTIFICATION.md
│   │   ├── ONBOARDING.md          ← Auto-generated "30 minutes" guide
│   │   ├── DOMAIN_EXPLAIN.md      ← Auto-generated domain explanations
│   │   ├── AI_CONTEXT_PACK.md     ← Auto-generated AI context pack
│   │   └── ... (30+ more)
│   │
│   ├── graphify/                  ← 20 files
│   │   ├── FINAL_GRAPHIFY_MASTER_REPORT.md ← Baseline analysis (pre-LCIS)
│   │   ├── community-hubs/       ← Per-community analysis reports
│   │   └── ...
│   │
│   ├── ai-infrastructure/         ← AI tooling docs
│   │   ├── graphify-report.md    ← Installation + security decisions
│   │   ├── FINAL_INSTALLATION_REPORT.md ← Full AI infra integration
│   │   ├── graphify-queries.md   ← Query reference
│   │   └── ...
│   │
│   ├── v10/                       ← V10 URL state certification
│   ├── v11/                       ← V11 business intelligence certification
│   ├── omega-production/          ← Omega production OS docs
│   ├── infinity/                  ← INFINITY real-time ops docs
│   ├── graph/                     ← Graph platform report
│   ├── operating-system/          ← OS layer docs
│   ├── mission-control/           ← Mission control docs
│   └── archive/                   ← Historical subdirs (dozens)
│
├── .claude/
│   └── commands/                  ← 37 slash command files
│       ├── agent-security-audit.md ← Security audit agent
│       ├── agent-architecture-audit.md ← Architecture audit agent
│       ├── agent-payment-audit.md ← Payment audit agent
│       ├── agent-tenant-audit.md  ← Tenant isolation audit agent
│       ├── agent-identity-audit.md ← Identity audit agent
│       ├── agent-checkout-audit.md ← Checkout flow audit agent
│       ├── agent-marketplace-audit.md ← Marketplace audit agent
│       ├── agent-theme-audit.md   ← Theme engine audit agent
│       ├── agent-developer-audit.md ← Developer platform audit agent
│       ├── agent-release-audit.md ← Release readiness audit agent
│       ├── agent-infrastructure-audit.md ← Infrastructure audit agent
│       ├── agent-compliance-audit.md ← Compliance audit agent
│       ├── full-security-review.md ← Full security review command
│       ├── build-component.md     ← Build component command
│       ├── graph-blast.md         ← Blast radius graph command
│       └── ... (22+ more)
│
├── GOVERNANCE_REWRITE_2026_06_10/ ← Supreme governance docs
│   ├── LETBUYY_CONSTITUTION.md   ← DOC 01: Supreme law (471 lines)
│   ├── LETBUYY_AGENTS_V2.md      ← Source of root AGENTS.md
│   ├── LETBUYY_CANONICAL_SYSTEMS.md ← DOC 03: Winner registry
│   └── ...
│
├── AGENTS.md                      ← DOC 02: Operating rulebook (405 lines)
├── CLAUDE.md                      ← AI operating context + LCIS protocol
│
├── tests/
│   ├── contracts/
│   │   └── repository-intelligence-generation.test.ts ← 4 governance contracts
│   └── launch/
│       ├── lb7.test.mjs           ← LB-7 acceptance contract
│       ├── lb8.test.mjs           ← LB-8 acceptance contract
│       ├── lb9.test.mjs           ← LB-9 acceptance contract
│       ├── lb10.test.mjs          ← LB-10 acceptance contract
│       └── lb12.test.mjs          ← LB-12 acceptance contract
│
└── .github/
    └── workflows/
        ├── ci.yml                 ← Runs 107-validator gate
        ├── graph-intelligence.yml ← Regenerates LCIS artifacts (advisory)
        ├── security-review.yml    ← PR security review
        ├── full-security-audit.yml ← Weekly security audit
        ├── production-deploy.yml  ← Main branch deploy
        └── branch-lag-monitor.yml ← Branch lag guard
```

---

## 2. The 83 Intelligence Engine Files

Complete listing from `tools/graph-server/`:

| File | Version | Purpose |
|------|---------|---------|
| `server.mjs` | All | HTTP server (1101 lines, 90+ endpoints, SPA, Atlas) |
| `intelligence.mjs` | V1 | Core graph queries: deps, consumers, blast, critical, flows |
| `db-intel.mjs` | V2 | SQL parser: tables, RPCs, policies, triggers, indexes |
| `infra-intel.mjs` | V2 | Infrastructure: workers, queues, secrets, CODEOWNERS |
| `domain-intel.mjs` | V3 | 22-domain classifier + cross-domain edges |
| `cross-domain-engine.mjs` | V3 | Domain coupling analysis functions |
| `payment-intel.mjs` | V3 | Payment flow intelligence |
| `security-intel.mjs` | V3 | Security graph (7 controls) |
| `deployment-intel.mjs` | V3 | Deployment graph |
| `incident-intel.mjs` | V3 | Incident trace per domain |
| `merchant-intel.mjs` | V3 | Merchant lifecycle (14 stages) |
| `discovery-engine.mjs` | V3 | V3 autonomous discovery |
| `memory-intel.mjs` | V4 | Governance decision extraction (180 decisions) |
| `runtime-intel.mjs` | V4 | Runtime topology |
| `deployment-state.mjs` | V4 | Declared deployment state |
| `change-impact.mjs` | V4 | Change impact analysis |
| `incident-response.mjs` | V4 | Incident root cause + rollback |
| `merchant-operating-graph.mjs` | V4 | Multi-tenant merchant graph |
| `execution-intel.mjs` | V4 | Open blockers + launch verdict |
| `runtime-observability-intel.mjs` | V5 | Runtime observability chain |
| `merchant-intelligence.mjs` | V5 | Merchant intelligence (10 stages) |
| `revenue-intelligence.mjs` | V5 | Revenue model + canonical ledger |
| `security-intelligence-v5.mjs` | V5 | 11 security controls |
| `incident-intelligence-v5.mjs` | V5 | Per-domain incident intelligence |
| `customer-journey-intelligence.mjs` | V5 | 8-stage customer journey |
| `production-readiness-intel.mjs` | V5 | Structural production readiness |
| `decision-engine-v5.mjs` | V5 | Ranked fix priorities (V5) |
| `merchant-health-intel.mjs` | Omega | Merchant health scores |
| `merchant-growth-intel.mjs` | Omega | Merchant growth signals |
| `merchant-adoption-intel.mjs` | Omega | Feature adoption model |
| `merchant-risk-intel.mjs` | Omega | Merchant risk scores |
| `merchant-churn-intel.mjs` | Omega | Churn risk model |
| `customer-intelligence-v2.mjs` | Omega | 8-graph customer intelligence |
| `revenue-intelligence-v2.mjs` | Omega | Revenue v2 (ledger + gift-card) |
| `cost-intelligence.mjs` | Omega | Infrastructure cost model |
| `telemetry-intelligence.mjs` | Omega | 12 telemetry adapter sources |
| `memory-v2.mjs` | Omega | Governance decision graph v2 |
| `fix-engine.mjs` | Omega | Ranked fix plans |
| `unified-intelligence-engine.mjs` | Omega | 13-layer unified brain |
| `discovery-v2.mjs` | Omega | Drift detection candidates |
| `production-readiness-v2.mjs` | Omega | Deep readiness (10 dimensions) |
| `decision-engine-v2.mjs` | Omega | Enhanced decision engine |
| `explain-intel.mjs` | V6 | Dual-mode explain layer (22 nodes) |
| `relationship-intel.mjs` | V7 | 705 FK relationships |
| `environment-intel.mjs` | V7 | Environment classification |
| `knowledge-graphs.mjs` | V7 | 7 typed knowledge sub-graphs |
| `operations-center.mjs` | V7 | Operations hub |
| `connections-intel.mjs` | V7 | Connection registry |
| `production-health.mjs` | V7 | G/Y/R structural health |
| `audit-engine-v2.mjs` | V7 | Autonomous audit (candidates) |
| `mission-control-dashboard.mjs` | V7 | Executive dashboard |
| `ecosystem-intel.mjs` | V7 | Frozen ecosystem (theme/app/dev) |
| `search-intel.mjs` | V7 | Semantic natural-language search |
| `ai-context-intel.mjs` | Genesis | AI context packs < 20k tokens |
| `database-control-intel.mjs` | Genesis | Database control center |
| `environment-control-intel.mjs` | Genesis | Environment control center |
| `infrastructure-control-intel.mjs` | Genesis | Infrastructure control center |
| `commerce-control-intel.mjs` | Genesis | Commerce control center |
| `incident-control-intel.mjs` | Genesis | Incident control center |
| `launch-command-center.mjs` | Genesis | 10-dimension launch GO/NO-GO |
| `live-adapters.mjs` | Omega/X | 7 provider adapters (NOT CONNECTED) |
| `environment-registry.mjs` | Omega | Credential presence per env |
| `diagnosis-engine.mjs` | Omega | Root cause + confidence |
| `runbook-engine.mjs` | Omega | Per-domain runbooks |
| `federation-intel.mjs` | X | Live federation (7 providers) |
| `live-health-intel.mjs` | X | Per-domain live health |
| `business-flow-intel.mjs` | V11 | 10 business journeys |
| `detection-prediction-intel.mjs` | INFINITY | 8 detectors, 6 predictors |
| `gen-reports.mjs` | V1+ | Markdown report generation |
| `gen-v3-reports.mjs` | V3 | V3 reports |
| `gen-v4-reports.mjs` | V4 | V4 reports |
| `gen-v5-reports.mjs` | V5 | V5 reports |
| `gen-omega-reports.mjs` | Omega | Omega reports |
| `gen-explain-docs.mjs` | V6 | Documentation generation |
| `refresh-graph.mjs` | V1+ | Graph refresh orchestrator |
| `index.html` | V1+ | SPA shell for Atlas UI |

---

## 3. Package.json Script Inventory (graph:*)

Complete list of 40+ LCIS scripts from `package.json`:

```json
{
  "graph:ui": "node tools/graph-server/server.mjs",
  "graph:update": "node tools/graph-server/refresh-graph.mjs",
  "graph:validate": "node tools/graph-server/validate-graph.mjs",
  "graph:stats": "node tools/graph-server/stats.mjs",
  "graph:intel": "node tools/graph-server/intelligence.mjs",
  "graph:reports": "node tools/graph-server/gen-reports.mjs",
  "graph:db": "node tools/graph-server/db-intel.mjs",
  "graph:infra": "node tools/graph-server/infra-intel.mjs",
  "graph:domain": "node tools/graph-server/domain-intel.mjs",
  "graph:domains": "node tools/graph-server/domain-intelligence.mjs",
  "graph:cross": "node tools/graph-server/cross-domain-engine.mjs",
  "graph:payment": "node tools/graph-server/payment-intel.mjs",
  "graph:security": "node tools/graph-server/security-intel.mjs",
  "graph:deployment": "node tools/graph-server/deployment-intel.mjs",
  "graph:incident": "node tools/graph-server/incident-intel.mjs",
  "graph:merchant": "node tools/graph-server/merchant-intel.mjs",
  "graph:discover": "node tools/graph-server/discovery-engine.mjs",
  "graph:v3": "pnpm graph:db && pnpm graph:infra && pnpm graph:domain && pnpm graph:reports",
  "graph:memory": "node tools/graph-server/memory-intel.mjs",
  "graph:runtime": "node tools/graph-server/runtime-intel.mjs",
  "graph:depstate": "node tools/graph-server/deployment-state.mjs",
  "graph:impact": "node tools/graph-server/change-impact.mjs",
  "graph:incident-response": "node tools/graph-server/incident-response.mjs",
  "graph:merchant-graph": "node tools/graph-server/merchant-operating-graph.mjs",
  "graph:execution": "node tools/graph-server/execution-intel.mjs",
  "graph:v4": "pnpm graph:v3 && pnpm graph:memory && pnpm graph:runtime && pnpm graph:depstate && pnpm graph:execution && node tools/graph-server/gen-v4-reports.mjs",
  "graph:runtime-obs": "node tools/graph-server/runtime-observability-intel.mjs",
  "graph:merchant-intel": "node tools/graph-server/merchant-intelligence.mjs",
  "graph:revenue": "node tools/graph-server/revenue-intelligence.mjs",
  "graph:security-v5": "node tools/graph-server/security-intelligence-v5.mjs",
  "graph:readiness": "node tools/graph-server/production-readiness-intel.mjs",
  "graph:decision": "node tools/graph-server/decision-engine-v5.mjs",
  "graph:discover-v5": "node tools/graph-server/discovery-v2.mjs",
  "graph:v5": "pnpm graph:v4 && pnpm graph:runtime-obs && pnpm graph:merchant-intel && pnpm graph:revenue && pnpm graph:security-v5 && pnpm graph:readiness && pnpm graph:decision && pnpm graph:discover-v5 && node tools/graph-server/gen-v5-reports.mjs",
  "graph:cost": "node tools/graph-server/cost-intelligence.mjs",
  "graph:telemetry": "node tools/graph-server/telemetry-intelligence.mjs",
  "graph:unified": "node tools/graph-server/unified-intelligence-engine.mjs",
  "graph:fix": "node tools/graph-server/fix-engine.mjs",
  "graph:omega": "[v5 + all omega engines + gen-omega-reports + gen-explain-docs]",
  "graph:explain": "node tools/graph-server/explain-intel.mjs && node tools/graph-server/gen-explain-docs.mjs",
  "graph:runbooks": "node tools/graph-server/runbook-engine.mjs",
  "graph:live": "node tools/graph-server/live-adapters.mjs",
  "graph:genesis": "pnpm graph:db-control && pnpm graph:env-control && pnpm graph:infra-control && pnpm graph:commerce && pnpm graph:launch"
}
```

---

## 4. Key Source Inputs to LCIS

### Source code parsed by LCIS engines:
- `services/api-gateway/src/routes/**/*.ts` → `.rpc('name')` call sites (route→RPC map)
- `services/api-gateway/src/execution/**/*.ts` → additional RPC call sites
- `services/queue-workers/src/**/*.ts` → RPC call sites in workers
- `services/api-gateway/wrangler.toml` → worker bindings, queues, secrets
- `services/queue-workers/wrangler.toml` → same
- `services/webhook-service/wrangler.toml` → same
- `services/mobile-bff/wrangler.toml` → same

### Database migrations parsed by db-intel.mjs:
- `database/supabase/migrations/*.sql` — 103+ migration files, sorted numerically

### CI/CD configs parsed by infra-intel.mjs:
- `.github/workflows/production-deploy.yml` — deploy targets, secrets, migration gate
- `.github/CODEOWNERS` — ownership rules

### Governance docs parsed by memory-intel.mjs:
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`
- `AGENTS.md` (root)
- `CLAUDE.md`
- `docs/architecture/**/*.md` (all markdown files)
- `docs/governance/**/*.md`
- `docs/security/**/*.md`
- (41 sources total)

---

## 5. What Is Not in the Repository (By Design)

| Item | Location | Reason |
|------|---------|--------|
| `graphify-out/` contents | Local only (gitignored) | Large binary artifacts; rebuilt locally |
| `graphify-out/manifest.json` | Local only (821KB, gitignored) | Graphify internal cache manifest |
| Live provider credentials | Deploy-time secrets | Never committed to repository |
| Live telemetry values | Runtime (not in-repo) | Provider APIs at runtime only |
| `graphify` CLI binary | `~/.local/bin/graphify` (uv venv) | External tool, not repo-internal |
| Mobile app source (partially) | `apps/mobile/merchant-app` | In active development |

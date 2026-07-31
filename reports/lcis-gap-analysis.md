# LCIS Gap Analysis
**LetBuyy Central Intelligence System — Implemented vs Planned vs Missing**
*Date: 2026-06-19 | Source: All version certification documents, INFINITY/OMEGA/Genesis certifications*

---

## 1. Executive Gap Summary

| Category | Status |
|----------|--------|
| Code intelligence | **100% implemented** — all 52,246 nodes, 66,761 edges indexed |
| Database intelligence | **100% implemented** — 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes |
| Infrastructure intelligence | **100% implemented** — all 4 workers, 5 queues, 19 secrets, 5 Vercel apps |
| Domain intelligence | **100% implemented** — 22 domains, 49 cross-domain edges |
| Organizational memory | **100% implemented** — 180 decisions from 41 sources |
| Runtime topology | **100% implemented** — Worker→Queue→Cron→RPC→Table chains |
| Merchant intelligence | **100% implemented** (structural) — live scores NOT CONNECTED |
| Revenue intelligence | **100% implemented** (ledger model) — live amounts NOT CONNECTED |
| Security intelligence | **100% implemented** — 11 controls, 651 policies, 5 trust boundaries |
| Cost intelligence | **100% implemented** (pricing model) — live usage NOT CONNECTED |
| Live telemetry | **90% implemented** — 12 adapters + ingestion contract; values NOT CONNECTED |
| Autonomous fix plans | **100% implemented** (plans exist) — never auto-applied (by design) |
| Live provider connections | **0/7 connected** — all NOT CONNECTED in dev (deploy-time credentials required) |
| Subscription journey | **NOT IMPLEMENTED** — no subscriptions domain in codebase |

**Overall intelligence score: A (95%)**
**Final certification level: OMEGA + Genesis + INFINITY + X**

---

## 2. Historical Gap Tracking

### Pre-LCIS (Graphify baseline): Major Gaps

| Gap | Impact | Status |
|-----|--------|--------|
| SQL/DB layer invisible (~2% indexed) | Cannot answer any database question | Closed in LCIS V1 |
| No table/RPC/policy lineage | Cannot trace payment flow | Closed in LCIS V2 |
| No infrastructure model | Cannot map worker→queue→secret topology | Closed in LCIS V2 |
| No ownership tracking | Cannot answer "who owns this?" | Closed in LCIS V2 |
| No domain classification | Cannot answer "which domain owns payments?" | Closed in LCIS V3 |
| No cross-domain blast radius | Cannot answer "what breaks if payments fail?" | Closed in LCIS V3 |
| No "why" / architectural memory | Cannot answer "why does this rule exist?" | Closed in LCIS V4 |
| No runtime topology | Cannot map Worker→Queue→Cron→RPC→Table | Closed in LCIS V4 |
| No deployment state | Cannot answer "what's currently deployed?" | Closed in LCIS V4 |
| No live operating intelligence | Cannot answer "is the system healthy?" | Closed in LCIS V5 |
| Cost intelligence (was 20% coverage) | Cannot model infrastructure costs | Closed in LCIS OMEGA |
| Autonomous fix plans (was 10%) | No ranked fix recommendations | Closed in LCIS OMEGA |
| Live telemetry (was 30%) | No live metric ingestion | OMEGA raised to 90% (correct ceiling) |
| No navigable deep links | Cannot share/bookmark intelligence views | Closed in V10 |
| No business journey workspaces | Cannot view end-to-end flows | Closed in V11 |
| No production OS control surfaces | Cannot operate the system via LCIS | Closed in OMEGA production OS |
| No autonomous detection/prediction | Cannot predict what will fail next | Closed in INFINITY |
| No plain-language explain mode | Requires technical knowledge to use | Closed in LCIS V6 |

---

## 3. Currently Implemented (Full Inventory)

### 3.1 Always Available (Repository Truth)

| Capability | Endpoint | Evidence |
|-----------|---------|---------|
| Code graph search | `/api/search?q=` | 52,246 nodes indexed |
| Blast radius | `/api/blast?q=` | 3-level BFS on 66,761 edges |
| DB table trace | `/api/table?name=` | 414 tables |
| RPC trace | `/api/rpc?name=` | 156 RPCs |
| RLS policy trace | `/api/policy?table=` | 651 policies |
| FK relationships | `/api/relationships?table=` | 705 FKs |
| Domain classification | `/api/domain?key=` | 22 domains |
| Cross-domain blast | `/api/cross-domain?key=` | 49 edges |
| Payment flow | `/api/payment` | 34 money RPCs, 18 money tables |
| Security posture | `/api/security-intelligence` | 11 controls |
| Governance memory | `/api/memory-v2` | 180 decisions |
| Infrastructure topology | `/api/infra` | 4 workers, 5 queues, 19 secrets |
| Runbooks | `/api/runbook?domain=` | 22 domains with escalation |
| Launch GO/NO-GO | `/api/launch-command-center` | 10 readiness dimensions |
| Fix plans | `/api/fix-engine` | Ranked with verify/test/rollback |
| Diagnosis | `/api/diagnose?target=` | Root cause + confidence |
| Business journeys | `/api/business-flow?journey=` | 9 journeys |
| Structural detectors | `/api/detection` | 8 detectors (structural risk CONNECTED) |
| Structural predictors | `/api/predict` | 6 predictors (structural CONNECTED) |
| Explain mode | `/api/explain?node=` | 22 domain nodes |
| AI context packs | `/api/ai-pack?target=` | < 20k tokens per model |
| Domain workspace | `/api/workspace?domain=` | 16 perspectives |
| Ownership | `/api/owner?q=` | CODEOWNERS (26 rules) |
| Production health | `/api/production-health` | G/Y/R structural |
| Autonomous audit | `/api/audit` | 87 routes scanned, 0 hard violations |
| Git time-travel | `/api/time-travel` | HEAD + last-migration (git CONNECTED) |

### 3.2 Structurally Computed (Available, NOT Live)

| Capability | Endpoint | Gap |
|-----------|---------|-----|
| Merchant health scores | `/api/merchant-health` | Scores structural; live magnitudes NOT CONNECTED |
| Revenue model | `/api/revenue-v2` | Model structural; revenue amounts NOT CONNECTED |
| Cost model | `/api/cost-intelligence` | Unit pricing × topology; usage NOT CONNECTED |
| Customer funnel | `/api/customer-intelligence-v2` | Structure structural; rates NOT CONNECTED |
| Telemetry sources | `/api/telemetry` | 12 adapters mapped; values NOT CONNECTED |
| Merchant risk | `/api/merchant-risk` | Structural predisposition; live incidents NOT CONNECTED |
| Deployment state | `/api/deployment-state` | Declared state (HEAD hash, migration #174); live version NOT CONNECTED |

---

## 4. Currently NOT Implemented

### 4.1 Genuinely Missing (Not by design)

| Gap | Evidence | Priority |
|-----|---------|---------|
| **Subscription journey** | No subscriptions domain in codebase; no schema tables | Medium (future feature) |
| **Mobile intelligence** | Mobile BFF topology mapped; app graph not indexed by Graphify | Low (coverage gap) |
| **PayPal as second payment provider** | Identified in launch readiness audit as gap | Medium (H8 blocker adjacency) |

### 4.2 NOT CONNECTED by Design (Architecture ceiling — not a bug)

These are NOT gaps — they represent the correct ceiling. The system correctly declares them as NOT CONNECTED rather than fabricating values.

| Capability | Honest Status | Exact Source Needed |
|-----------|-------------|---------------------|
| API latency (p50/p95/p99) | NOT CONNECTED | Cloudflare Analytics Engine |
| Worker CPU/error rate | NOT CONNECTED | Cloudflare Analytics Engine |
| Queue depth / DLQ count | NOT CONNECTED | Cloudflare Queues metrics |
| Database latency / errors | NOT CONNECTED | Supabase Postgres metrics |
| Active merchant count | NOT CONNECTED | Supabase `SELECT COUNT(*) FROM sites` |
| Daily GMV | NOT CONNECTED | Supabase ledger reconciliation RPC |
| Email delivery rate | NOT CONNECTED | Resend API |
| Payment success rate | NOT CONNECTED | Razorpay webhook data |
| Live deploy version | NOT CONNECTED | Vercel/Cloudflare deployment APIs |
| Live incident feed | NOT CONNECTED | PagerDuty/Incident.io |
| Uptime/availability | NOT CONNECTED | External uptime monitor |

**Recommended first connection:** Staging Supabase read token + Cloudflare read token would immediately connect: merchant count, GMV, payment success rate (via ledger), database health, worker health, queue depth.

---

## 5. Gap Risk Assessment

### High Risk Gaps

**1. 0/7 live providers connected**
- Risk: AI agents and on-call engineers cannot see live system state
- LCIS provides structural intelligence only — "what should happen" vs "what is happening"
- Impact: All INFINITY detection/prediction is structural, not live
- Remediation: Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in staging

**2. Subscription journey NOT IMPLEMENTED**
- Risk: If subscriptions are added without a domain, LCIS will not represent them
- Impact: Future subscription features will be invisible to LCIS intelligence
- Remediation: Create `subscriptions` domain in domain-intel.mjs when feature is built

### Medium Risk Gaps

**3. Graphify does not index SQL function bodies**
- Risk: RPC internal logic, SQL CASE expressions, conditional writes are not graph-queryable
- Impact: `db-intel.mjs` partially compensates (regex body scan) but cannot follow complex SQL logic
- Remediation: Accept as permanent ceiling; db-intel.mjs is the workaround

**4. LCIS knowledge is static at build time**
- Risk: Changes since last `pnpm graph:omega` are invisible
- Impact: New tables, routes, or RPCs added today won't appear in LCIS until rebuilt
- Remediation: CI job (`graph-intelligence.yml`) auto-rebuilds on migration/gateway changes

**5. Mobile intelligence partial**
- Risk: Flutter/Dart mobile app partly indexed but not deeply represented in domain intelligence
- Impact: `services/mobile-bff` topology is mapped but mobile-side code paths less visible
- Remediation: Low priority until mobile launch scope

### Low Risk Gaps

**6. Semantic search is keyword-based**
- Risk: Natural language questions with uncommon phrasing may not route correctly
- Impact: `resolveDomain(q)` fallback relies on keyword matching, not embeddings
- Remediation: Add more hint map entries as gaps are discovered

**7. CODEOWNERS has single owner**
- Risk: `@saai-sidd` owns all 22 domains — no differentiated team ownership
- Impact: Incident response ownership chain is flat
- Remediation: Add team-based CODEOWNERS rules as team grows

---

## 6. 107 Validator Gate Gap Analysis

**Current gate status: 107/107 green (all versions)**

Gaps that validators do NOT currently catch (heuristic, not deterministic):

| Issue | Validator Approach | Gap |
|-------|------------------|-----|
| `tenantTablesWithoutRls` — 20 candidates | Flagged as heuristic candidates | RLS may be service-role-scoped (pattern not detected by regex) |
| `USING (true)` — 34 policies | Flagged as candidates | All confirmed service-role-scoped; validator passes |
| 75 dead RPC candidates | Heuristic from autonomous discovery | Many are trigger-internal functions, not dead |
| 44 dead table candidates | Heuristic | Many are event-sourcing/projection internals |
| 4 dead route candidates | Heuristic | ai/media/resume/upload endpoints |
| 4 orphaned domain candidates | Heuristic | developer/gst/collections/identity |

**Key principle:** Heuristic findings are candidates. The 107 deterministic validators are authoritative. A candidate that passes the validator gate is not a confirmed violation.

---

## 7. Launch Blockers (Active at Time of Last Certification)

As of the INFINITY certification, 5 V1 launch blockers were open. Memory records show LB-7/8/9/10/12 were closed on 2026-06-19 with acceptance contracts in `tests/launch/lb*.test.mjs`.

| Blocker | Domain | Status |
|---------|--------|--------|
| LB-7 | Checkout | Closed 2026-06-19 |
| LB-8 | Payments | Closed 2026-06-19 |
| LB-9 | Refunds | Closed 2026-06-19 |
| LB-10 | Queue Workers | Closed 2026-06-19 |
| LB-12 | Identity | Closed 2026-06-19 |

**Updated launch verdict:** Needs verification against current `pnpm graph:execution` output. The INFINITY certification showed NO-GO; memory shows all 5 blockers closed on 2026-06-19.

---

## 8. Planned but Not Yet Built

Based on version certification "known gap" sections:

| Item | First Flagged | Priority |
|------|-------------|---------|
| Per-tenant sharding | V5 (database SPOF) | Medium |
| DLQ coverage audit | V5 (queue backlog risk) | Medium |
| Live Cloudflare Analytics Engine adapter | OMEGA | High (first live adapter) |
| Live Supabase ledger read adapter | OMEGA | High |
| Subscription domain model | V11 | Low (future feature) |
| Multi-owner CODEOWNERS | V3 | Low (team growth) |
| Load-tested capacity numbers | Launch readiness | Medium |

---

## 9. The 90% Live Telemetry Ceiling

The telemetry ceiling of 90% (not 100%) is intentional and correct:

- **What's at 100% (done):** 12 telemetry adapter sources identified and mapped; ingestion contract defined; adapter code written; connections-intel registry implemented
- **What's at 90% (correct ceiling):** Live metric values require deploy-time provider credentials that are never in the repository
- **Why NOT 100%:** Claiming 100% telemetry intelligence would require fabricating live values — violating the NOT CONNECTED honesty contract

The 10% gap is the inherent boundary between repository intelligence (CONNECTED always) and runtime intelligence (NOT CONNECTED until deployed and wired).

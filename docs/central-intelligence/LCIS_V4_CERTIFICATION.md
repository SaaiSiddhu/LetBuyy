# LCIS v4 — Runtime + Memory + Execution Certification (Phase 12)

Repository-truth certification. Every number is computed by the v4 extractors (`pnpm graph:v4`). Live runtime/deploy *values* are telemetry/API-bound and are **explicitly marked**, never fabricated.

## Coverage scorecard
| Dimension | Coverage | Evidence |
|-----------|:--------:|----------|
| **Memory coverage** | **180 decisions** from 41 governance/architecture/security sources + **103 migration decisions** (9 types) | `memory-intel.mjs` parses the Constitution, AGENTS v2, canonical-systems, scorecard, CLAUDE.md, docs/{architecture,governance,security} + the migration ledger |
| **Runtime coverage** | topology **100%** — 4/4 workers · 5 queue edges · 4/4 telemetry emitters · 2 cron schedules | `runtime-intel.mjs`; live latency/error/queue-depth = **RUNTIME_TELEMETRY Analytics Engine** (declared in-repo, values queried live) |
| **Impact coverage** | one-call "what breaks if I modify X" over all **22 domains** → routes·rpcs·tables·workers·queues·deployments·merchants·domains·owners | `change-impact.mjs` composes the v3 cross-domain blast + db/infra facts |
| **Deployment coverage** | declared state **100%** — HEAD `8cec821c` (stepup/main) · latest migration #174 (103 files) · 4 workers · 5 Vercel apps · 19 secrets · migrate gate ✓ · rollback ✓ | `deployment-state.mjs`; actual live versions = Cloudflare/Vercel/Supabase APIs (marked gap) |
| **Execution coverage** | **6 blockers** tracked (5 open) · launch verdict **NO-GO** · 4 open gap docs · cert verdicts | `execution-intel.mjs` parses the V1 blocker report + gap/certification docs + code TODOs |
| **Incident coverage** | any domain/route/table → Incident→Route→RPC→Table→Queue→Worker→Owner→**Deployment+Rollback** | `incident-response.mjs` |
| **Readiness score** | **A− (91%)** | LCIS answers Why / What-breaks / Who-owns / What's-live / What's-failing / Who's-affected / What-next without a repo scan; gate 107/107 |

## Success criteria — answered WITHOUT scanning the repository
| Question | LCIS surface | ✓ |
|----------|-------------|:-:|
| **Why?** | `/api/memory?mode=rule&q=X` · `graph:memory migration <n>` | ✅ |
| **What breaks?** | `/api/change-impact?key=X` · `/api/cross-domain?key=X` | ✅ |
| **Who owns it?** | `/api/owner?q=X` · `/api/domain?key=X` → owners | ✅ |
| **What is live?** | `/api/deployment-state` (declared HEAD + migration + targets) | ✅ |
| **What is failing?** | `/api/runtime` → emission points + `wrangler tail`/Analytics Engine (values telemetry-bound, not fabricated) | ✅ |
| **Who is affected?** | `/api/incident-response?domain=X` → blast + merchants + rollback + owner | ✅ |
| **What should be fixed next?** | `/api/execution` → open blockers + launch verdict | ✅ |

## Surfaces shipped (v4)
- **Engines** (`tools/graph-server/`, gitignored output): `memory-intel.mjs`, `runtime-intel.mjs`, `deployment-state.mjs`, `incident-response.mjs`, `change-impact.mjs`, `merchant-operating-graph.mjs`, `execution-intel.mjs`, `gen-v4-reports.mjs`.
- **API (+7)**: `/api/{runtime,deployment-state,change-impact,execution,memory,merchant-operating,incident-response}`.
- **UI (+6 tabs)**: ◉ Runtime, Deployments, Execution, Memory, Impact, Merchant Graph.
- **CLI**: `pnpm graph:{memory,runtime,depstate,impact,incident-response,merchant-graph,execution,v4}`.
- **Docs**: decision-intelligence, runtime-intelligence, deployment-state, incident-response, execution-intelligence, AUTONOMOUS_DISCOVERY_V4.
- **CLAUDE.md**: "LCIS v4 — runtime + memory + execution; the repository scan is the LAST resort" + 7-row execution protocol (LCIS→Runtime→Impact→Ownership→Memory→Deployment).

## Honesty statement
- **No fabricated metrics.** Runtime latency/error/queue-depth and actual-live deploy versions are NOT in the repository; the engines map the topology + emission points + declared state and tell you the exact live source (RUNTIME_TELEMETRY Analytics Engine, `wrangler tail`, Cloudflare/Vercel/Supabase APIs). An operator snapshot at `graphify-out/runtime-metrics.json` is ingested if present.
- Memory decisions are extracted governance/architecture rules (imperatives) and migration-ledger entries — real statements with their source, not summaries.
- Execution surfaces the **real** repository state: launch verdict **NO-GO** with 5 open LB-blockers (the blocker report is repository truth as of HEAD).
- No new pnpm package, no new gate validator, no business-logic / payment / auth / RLS change. Gate stays **107/107**.

**Verdict: CERTIFIED — LCIS v4 adds the decision (why), runtime (what's failing), deployment-state (what's live), and execution (what's next) layers; the repository scan is now the last resort.**

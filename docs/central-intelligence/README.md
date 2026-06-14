# LetBuyy Central Intelligence System (LCIS)

The architecture-intelligence layer over the codebase: the Graphify code graph + a custom **database intelligence** extractor + a **central intelligence engine** (dependency / impact / flow tracing). It is the knowledge layer for architecture reviews, security reviews, impact analysis, and Claude Code.

## Run it
```bash
pnpm graph:update     # rebuild the code graph (graphify)
pnpm graph:db         # extract the database graph (tables/RPCs/policies/triggers → graphify-out/db-intel.json)
pnpm graph:reports    # regenerate the data-driven reports
pnpm graph:ui         # http://localhost:3333 — Atlas + Data Layer + domain dashboards
```

## Query it (CLI)
```bash
pnpm graph:intel deps "<symbol>"        # what it depends on
pnpm graph:intel consumers "<symbol>"   # who depends on it
pnpm graph:intel blast "<symbol>"       # blast radius (impact of changing it)
pnpm graph:intel critical [N]           # highest-connectivity systems
pnpm graph:intel payment                # money RPC → table flow
pnpm graph:intel tenant                 # tenant table / RLS coverage
pnpm graph:intel flow "<route>"         # route → rpc → table chain
```
HTTP API (for Claude / scripts): `/api/db`, `/api/blast?q=`, `/api/atlas`, `/api/domain?key=`, `/api/community?id=`, `/api/search`, `/api/path`, `/api/neighbors`.

## What each layer covers
| Layer | Source | Covers |
|-------|--------|--------|
| Code graph | Graphify (tree-sitter) | 52,246 nodes / 66,761 edges — TS/TSX/Dart symbols, imports, routes, pages |
| **DB intelligence** | `db-intel.mjs` (this repo) | 414 tables, 156 functions, 651 policies, 395 triggers, 826 indexes, RPC→route→table chains — **the layer Graphify's tree-sitter misses** |
| Intelligence engine | `intelligence.mjs` | dependency / consumer / blast-radius / payment-flow / tenant-flow / critical-systems |

## Reports (docs/central-intelligence/)
`CURRENT_STATE_AUDIT` · `GRAPH_QUALITY_AUDIT` · `DATABASE_INTELLIGENCE_REPORT.generated` · `FLOW_GRAPH_REPORT` · `CROSS_APP_INTELLIGENCE` · `DOMAIN_INTELLIGENCE` · `AUTONOMOUS_DISCOVERY_REPORT` · `PRODUCTION_INTELLIGENCE_REPORT` · `LETBUYY_CENTRAL_INTELLIGENCE_CERTIFICATION`.

## Honesty contract
Heuristic findings (uncalled RPCs, tenant-tables-without-detected-RLS, `USING(true)` policies) are **candidates** — the 107 deterministic governance validators remain authoritative. Graph artifacts (`graph.json`, `db-intel.json`) are gitignored; rebuild locally.

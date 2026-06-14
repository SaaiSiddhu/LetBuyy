# LCIS V8 Implementation — Unified Domain Workspace

Every search now opens a **Domain Workspace** with six intelligence perspectives, composed from the existing engines. No engine was rebuilt or duplicated; no new graph extraction; no mock data.

## Core change: search → workspace
Selecting (or searching) a domain opens a workspace with a **perspective switcher**:

`📖 Explain · ⚙ Technical · ◈ Graphs · ⟿ Trace · ⚯ Related · ✦ AI · 🔗 Copy link`

| Phase | Perspective / feature | Reuses | Surface |
|-------|----------------------|--------|---------|
| 1 | Domain Workspace | explain + all engines | `/api/workspace?domain=X` |
| 2 | **Explain (blog)** — breadcrumbs · reading-progress bar · reading time · owner · table-of-contents jump-nav · Purpose/Impact/Dependencies sections · FAQ · related cards · runbooks · prev/next | explain-intel | `xArticle` |
| 3 | **Technical** — routes/rpcs/tables/policies/triggers/indexes/FK/workers/queues/secrets/blast/owner/security | explain-intel `.technical` | `xWsTech` |
| 4/5 | **Graphs** — isolated layers: business · journey · security · ownership · infrastructure · revenue · ai (each its own engine) + "Open full Atlas" | knowledge-graphs (`/api/graph?kind=`) | `xWsGraphs` |
| 6 | **Trace (NL)** — natural-language question → answer + full path + blast | search-v2 + `/api/trace` | `xWsTrace` |
| 7 | **Related** — domains/services/tables/FK-neighbors/routes/runbooks/incidents/docs/AI packs | `/api/related?domain=X` | `xWsRelated` |
| 9 | **AI** — Claude/Gemini/Codex/Cursor/OpenAI packs (< 20k tokens) with **Copy** + **Download** | ai-context-intel | `xWsAi` |
| 8 | **Search V3** — command palette grouped by Domains / Pages / Code & data; opens the workspace | search-v2 | `⌘K` |
| 10 | **Mobile-first** — header wraps ≤880px, perspective tabs scroll, ≥44px touch targets, no horizontal overflow 320–1440px | CSS | — |

## New endpoints (composition only)
`/api/workspace?domain=X` · `/api/related?domain=X`. Everything else reuses existing endpoints.

## Honesty
Live values (revenue, runtime metrics, provider data) remain **NOT CONNECTED** with their exact source; the graph layers and lineage are repository truth. No fabricated telemetry/health/revenue/incidents.
